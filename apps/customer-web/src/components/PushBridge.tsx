import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { inArogyaApp, nativeBridge } from '../lib/inApp';
import { registerPushToken } from '../lib/push';

// Glue between the Android app and this site, invisible. Does nothing in a
// normal browser.
//  - Signed in: ask the app for the phone's push token; when it answers
//    (or Google later refreshes the token) register it.
//  - The app tells us a notification was tapped: open that page.
export function PushBridge() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!inArogyaApp) return;
    const onOpen = (e: Event) => {
      const route = (e as CustomEvent<unknown>).detail;
      if (typeof route === 'string' && route.startsWith('/') && !route.startsWith('//')) navigate(route);
    };
    window.addEventListener('arogya-open', onOpen);
    return () => window.removeEventListener('arogya-open', onOpen);
  }, [navigate]);

  useEffect(() => {
    if (!inArogyaApp || !user) return;
    const onToken = (e: Event) => {
      const token = (e as CustomEvent<unknown>).detail;
      if (typeof token === 'string' && token.length >= 20) registerPushToken(token).catch(() => undefined);
    };
    window.addEventListener('arogya-push-token', onToken);
    nativeBridge?.postMessage(JSON.stringify({ type: 'push-token-request' }));
    return () => window.removeEventListener('arogya-push-token', onToken);
  }, [user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
