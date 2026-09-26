import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import * as Location from 'expo-location';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// The app is the Arogya website in a full-screen web view, so every
// feature on the site is in the app the moment it's deployed — no
// separate native screens to keep in step. The native side only adds
// what a web page can't do on its own inside an app: the back button,
// phone/WhatsApp/UPI links, and saving downloaded files.
const SITE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://arogya-customer-web.onrender.com';
const SITE_HOST = new URL(SITE_URL).host;

// Pages allowed to open inside the app; anything else (maps, WhatsApp web,
// Google's policy pages…) opens in the phone's own browser or app.
const INSIDE_HOSTS = [SITE_HOST, 'checkout.razorpay.com', 'api.razorpay.com', 'razorpay.com'];

function opensInside(url: string): boolean {
  if (url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
  try {
    const host = new URL(url).host;
    return INSIDE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

const EXT_BY_TYPE: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// The page asks the app to fetch a file (report, invoice, document) with
// the signed-in token, then offers it through the share sheet so it can be
// saved or opened in any viewer.
async function saveAndShare(url: string, fileName: string, token?: string) {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  const safe = (fileName || 'arogya-file').replace(/[^\w.\- ]+/g, '_');
  const name = /\.[a-z0-9]{2,5}$/i.test(safe) ? safe : `${safe}${EXT_BY_TYPE[type] ?? ''}`;
  const file = new ExpoFile(Paths.cache, `${Date.now()}-${name}`);
  file.write(new Uint8Array(await res.arrayBuffer()));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: type || undefined, dialogTitle: name });
  }
}

function ArogyaWebApp() {
  const webRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Finding nearby centers uses the phone's location.
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => (p.status === 'undetermined' ? Location.requestForegroundPermissionsAsync() : p))
      .catch(() => undefined);
  }, []);

  // Android back button goes back a page, and only leaves the app from the
  // first page.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onShouldStart = useCallback((req: WebViewNavigation & { isTopFrame?: boolean }) => {
    // Embedded frames (reCAPTCHA, payment widgets) always load in place.
    if (req.isTopFrame === false || opensInside(req.url)) return true;
    // tel:, mailto:, upi:, whatsapp:, intent: and outside websites.
    Linking.openURL(req.url).catch(() => undefined);
    return false;
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let msg: { type?: string; url?: string; fileName?: string; token?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'download' && msg.url) {
      saveAndShare(msg.url, msg.fileName ?? '', msg.token).catch((err: Error) =>
        webRef.current?.injectJavaScript(`alert(${JSON.stringify(`Couldn't open the file: ${err.message}`)}); true;`),
      );
    }
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.title}>Can’t reach Arogya</Text>
          <Text style={styles.sub}>Check your internet connection and try again.</Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              setFailed(false);
              setLoading(true);
              webRef.current?.reload();
            }}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={webRef}
        style={failed ? styles.hidden : styles.web}
        source={{ uri: SITE_URL }}
        applicationNameForUserAgent="ArogyaApp/1.1"
        onShouldStartLoadWithRequest={onShouldStart}
        setSupportMultipleWindows={false}
        onNavigationStateChange={(s) => (canGoBack.current = s.canGoBack)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setFailed(true)}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        allowFileAccess
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        mediaPlaybackRequiresUserAction
        originWhitelist={['*']}
        {...(Platform.OS === 'android' ? { overScrollMode: 'never' as const } : {})}
      />
      {loading && !failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.splash]}>
          <View style={styles.logo}>
            <Text style={styles.logoPlus}>+</Text>
          </View>
          <Text style={styles.brand}>Arogya</Text>
          <ActivityIndicator color="#0c9490" style={{ marginTop: 18 }} />
          <Text style={styles.sub}>Loading… this can take a few seconds the first time.</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ArogyaWebApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f7fb' },
  web: { flex: 1, backgroundColor: '#f5f7fb' },
  hidden: { flex: 0, height: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  splash: { backgroundColor: '#f5f7fb' },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#0ea5a0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlus: { color: '#fff', fontSize: 38, fontWeight: '800', marginTop: -4 },
  brand: { marginTop: 12, fontSize: 26, fontWeight: '800', color: '#067571' },
  title: { fontSize: 20, fontWeight: '800', color: '#10182c' },
  sub: { marginTop: 8, fontSize: 14, color: '#5b6478', textAlign: 'center' },
  button: { marginTop: 18, backgroundColor: '#0ea5a0', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
