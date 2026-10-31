import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import type { NotificationResponse } from 'expo-notifications';
import * as Location from 'expo-location';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';

// The app is the Arogya website in a full-screen web view, so every
// feature on the site is in the app the moment it's deployed — no
// separate native screens to keep in step. The native side only adds
// what a web page can't do on its own inside an app: the back button,
// phone/WhatsApp/UPI links, and saving downloaded files.
const SITE_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://arogya-customer-web.onrender.com').replace(/\/$/, '');
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

// ---- Push notifications (Firebase Cloud Messaging) ----
// The server sends the pushes; this app only gets permission, fetches the
// phone's FCM token and hands it to the website, which (being the part
// that is signed in) registers it with the API. No keys live in the app.
// Delivery is best-effort — a phone that is offline or has notifications
// blocked just doesn't get it; everything is also in the in-app bell.
const CHANNEL_ID = 'arogya_updates'; // must match the server's FCM message

// Shown while the app is open too, not only in the background.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    // Android shows the heads-up banner only when sound is allowed.
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// The server puts the page to open in `data.route` (e.g. /bookings/<id>).
// Only paths on our own site are ever opened.
function routeOf(response: NotificationResponse | null | undefined): string | null {
  const raw = response?.notification.request.content.data?.route;
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
}

// ---- Google sign-in ----
// Google refuses to sign in inside an embedded web view, so the app opens
// the site's /app-google page in a Chrome tab (a real browser, where
// Google allows it). That page sends the Google token back through the
// arogya:// link, and the app hands it to the web view, which signs in.
const GOOGLE_RETURN = 'arogya://google-auth';

function randomState(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
}

async function googleSignInInBrowser(): Promise<string | null> {
  const state = randomState();
  const url = `${SITE_URL}/app-google?return=${encodeURIComponent(GOOGLE_RETURN)}&state=${state}`;
  const result = await WebBrowser.openAuthSessionAsync(url, GOOGLE_RETURN, { showInRecents: false });
  if (result.type !== 'success') return null;
  const params = new URLSearchParams(result.url.split('#')[1] ?? result.url.split('?')[1] ?? '');
  // Only accept the answer to the request this app just made.
  if (params.get('state') !== state) return null;
  return params.get('idToken');
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
  // Opened from a tap on a notification while the app was closed: start
  // straight on that booking / report instead of Home.
  const [startUrl] = useState(() => {
    let route: string | null = null;
    try {
      route = routeOf(Notifications.getLastNotificationResponse());
      if (route) Notifications.clearLastNotificationResponse();
    } catch {
      // Notifications unavailable — just open Home.
    }
    return SITE_URL + (route ?? '');
  });
  const pageReady = useRef(false);
  const pendingRoute = useRef<string | null>(null);
  const settingUpPush = useRef(false);

  const tellWeb = useCallback((eventName: string, detail: string) => {
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)},{detail:${JSON.stringify(detail)}}));true;`,
    );
  }, []);

  // Asked for once the person is signed in (the website says so), so the
  // permission prompt has a reason. Token refresh is handled below.
  const setUpPush = useCallback(async () => {
    if (settingUpPush.current) return;
    settingUpPush.current = true;
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Booking and report updates',
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: '#0ea5a0',
        });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return;
      const token = await Notifications.getDevicePushTokenAsync();
      tellWeb('arogya-push-token', String(token.data));
    } catch {
      // No Google Play services, or this build has no Firebase file: no push.
    } finally {
      settingUpPush.current = false;
    }
  }, [tellWeb]);

  const openRoute = useCallback(
    (route: string) => {
      if (pageReady.current) tellWeb('arogya-open', route);
      else pendingRoute.current = route; // delivered once the page has loaded
    },
    [tellWeb],
  );

  // Google rotates the token now and then: pass the new one along. A tap on
  // a notification while the app is running opens its page.
  useEffect(() => {
    const tokenSub = Notifications.addPushTokenListener((token) => tellWeb('arogya-push-token', String(token.data)));
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeOf(response);
      if (route) openRoute(route);
      Notifications.clearLastNotificationResponse();
    });
    return () => {
      tokenSub.remove();
      responseSub.remove();
    };
  }, [tellWeb, openRoute]);

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
    if (msg.type === 'google-sign-in') {
      googleSignInInBrowser()
        .then((idToken) => tellWeb('arogya-google-token', idToken ?? ''))
        .catch(() => tellWeb('arogya-google-token', ''));
      return;
    }
    if (msg.type === 'push-token-request') {
      void setUpPush();
      return;
    }
    if (msg.type === 'download' && msg.url) {
      saveAndShare(msg.url, msg.fileName ?? '', msg.token).catch((err: Error) =>
        webRef.current?.injectJavaScript(`alert(${JSON.stringify(`Couldn't open the file: ${err.message}`)}); true;`),
      );
    }
  }, [setUpPush, tellWeb]);

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
        source={{ uri: startUrl }}
        applicationNameForUserAgent="ArogyaApp/1.3 ArogyaGoogle"
        onShouldStartLoadWithRequest={onShouldStart}
        setSupportMultipleWindows={false}
        onNavigationStateChange={(s) => (canGoBack.current = s.canGoBack)}
        onLoadEnd={() => {
          setLoading(false);
          pageReady.current = true;
          if (pendingRoute.current) {
            tellWeb('arogya-open', pendingRoute.current);
            pendingRoute.current = null;
          }
        }}
        onError={() => setFailed(true)}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        allowFileAccess
        bounces={false}
        overScrollMode="never"
        scrollEnabled
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        textZoom={100}
        mediaPlaybackRequiresUserAction
        originWhitelist={['*']}
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
