// Turns on passkeys (fingerprint / face-lock sign-in) inside the app's web
// view. Android's WebView keeps WebAuthn switched off unless the app asks
// for it, and react-native-webview has no setting for it, so this adds two
// lines where the library creates its WebView. Runs after every npm install.
//
// When the phone's WebView supports it, the page also gets a small
// `window.ArogyaPasskeys` object, which is how the website knows it can
// offer fingerprint sign-in inside the app.
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewManagerImpl.kt',
);
const MARK = '// arogya-passkeys';

if (!fs.existsSync(file)) {
  console.log('patch-webview-passkeys: react-native-webview not installed yet, skipping');
  process.exit(0);
}
let src = fs.readFileSync(file, 'utf8');
if (src.includes(MARK)) {
  console.log('patch-webview-passkeys: already applied');
  process.exit(0);
}

const anchor = 'settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW';
if (!src.includes(anchor)) {
  console.error('patch-webview-passkeys: could not find where the WebView is set up — react-native-webview changed. Passkeys stay off in the app.');
  process.exit(1);
}

src = src.replace(
  anchor,
  `${anchor}
        ${MARK}
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(settings, WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP)
            webView.addJavascriptInterface(object {
                @android.webkit.JavascriptInterface
                fun available(): Boolean = true
            }, "ArogyaPasskeys")
        }`,
);
fs.writeFileSync(file, src);
console.log('patch-webview-passkeys: passkeys enabled in the app web view');
