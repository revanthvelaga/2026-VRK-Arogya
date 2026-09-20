import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { RazorpayOrder } from '../api/types';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { ErrorBanner } from '../components/EmptyState';
import { FullScreenLoading } from '../components/Spinner';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

// Razorpay's native SDK needs an EAS Build (a compiled binary with its
// module linked in) — unavailable in this environment, which has no
// simulator/emulator/physical device to build for. This instead renders
// Razorpay's own web checkout.js inside a WebView and bridges its result
// back over postMessage, same JS SDK customer-web loads directly.
function checkoutHtml(order: RazorpayOrder, bookingId: string, contact?: string): string {
  const options = {
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amount,
    currency: order.currency,
    name: 'Arogya Diagnostics',
    description: `Booking ${bookingId.slice(0, 8)}`,
    prefill: { contact: contact ?? '' },
    theme: { color: '#0EA5A0' },
  };
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="margin:0;background:#F6F8FA;font-family:sans-serif;">
  <script>
    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    try {
      var options = ${JSON.stringify(options)};
      options.handler = function (response) {
        post({ type: 'success', response: response });
      };
      options.modal = {
        ondismiss: function () { post({ type: 'dismiss' }); },
      };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        post({ type: 'error', message: resp.error && resp.error.description });
      });
      rzp.open();
    } catch (e) {
      post({ type: 'error', message: String(e) });
    }
  </script>
</body>
</html>`;
}

export function PaymentScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const { user } = useAuth();
  const orderApi = useApi<RazorpayOrder>(() => api.post(`/bookings/${bookingId}/payment/order`), [bookingId]);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleMessage = async (raw: string) => {
    let msg: { type: string; response?: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }; message?: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'success' && msg.response) {
      setVerifying(true);
      setError(null);
      try {
        await api.post('/payments/verify', {
          razorpayOrderId: msg.response.razorpay_order_id,
          razorpayPaymentId: msg.response.razorpay_payment_id,
          razorpaySignature: msg.response.razorpay_signature,
        });
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not verify the payment');
      } finally {
        setVerifying(false);
      }
    } else if (msg.type === 'error') {
      setError(msg.message ?? 'Payment failed');
    } else if (msg.type === 'dismiss') {
      navigation.goBack();
    }
  };

  if (orderApi.loading) return <FullScreenLoading />;
  if (orderApi.error) {
    return (
      <View style={styles.center}>
        <ErrorBanner message={orderApi.error} />
        <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    );
  }
  if (!orderApi.data) return null;

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={styles.successTitle}>Payment successful</Text>
        <Text style={styles.successHint}>Your booking is now marked as paid.</Text>
        <View style={{ marginTop: spacing.lg }}>
          <Button title="Back to booking" onPress={() => navigation.replace('BookingDetail', { id: bookingId })} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {verifying && (
        <View style={styles.verifyingBanner}>
          <Text style={styles.verifyingText}>Verifying payment…</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorWrap}>
          <ErrorBanner message={error} />
          <Button title="Close" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      )}
      {!error && (
        <WebView
          source={{ html: checkoutHtml(orderApi.data, bookingId, user?.phone) }}
          onMessage={(e) => handleMessage(e.nativeEvent.data)}
          style={styles.flex}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  successTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  successHint: { fontSize: 13.5, color: colors.inkSoft, marginTop: 4, textAlign: 'center' },
  verifyingBanner: { padding: spacing.md, backgroundColor: colors.accentSoft },
  verifyingText: { fontSize: 13, color: '#0B7A76', fontWeight: '600', textAlign: 'center' },
  errorWrap: { padding: spacing.lg },
});
