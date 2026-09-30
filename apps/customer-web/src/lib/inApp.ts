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

// Make the site behave like an app rather than a web page inside the app:
// no pinch-zoom (a zoomed page can be dragged sideways, which showed up
// as the whole screen sliding left and right) and no elastic overscroll.
if (inArogyaApp) {
  document.documentElement.classList.add('in-app');
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}
