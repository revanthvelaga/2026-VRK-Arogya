// True when the site is running inside the Arogya Android/iOS app (a
// full-screen web view). A few browser-only things behave differently
// there: files go to the phone's share sheet, and Google sign-in / Drive
// (which Google blocks inside embedded web views) are hidden.
interface NativeBridge {
  postMessage: (data: string) => void;
}

export const nativeBridge: NativeBridge | undefined = (window as Window & { ReactNativeWebView?: NativeBridge })
  .ReactNativeWebView;

export const inArogyaApp = Boolean(nativeBridge) && /ArogyaApp/.test(navigator.userAgent);
