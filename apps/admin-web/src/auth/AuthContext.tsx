import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, decodeJwt, endSession, getSession, recordActivity, setSession, setUnauthorizedHandler } from '../api/client';
import type { AuthSession, Role } from '../api/types';

export interface CurrentUser {
  userId: string;
  phone: string;
  role: Role;
}

type Portal = 'ADMIN' | 'STAFF';

interface AuthContextValue {
  user: CurrentUser | null;
  login: (phone: string, password: string, expectedRole?: Portal) => Promise<void>;
  // OTP / Google: the server only signs in an existing account of this role.
  loginWithPhoneOtp: (idToken: string, portal: Portal) => Promise<void>;
  loginWithGoogle: (idToken: string, portal: Portal) => Promise<void>;
  logout: () => void;
  // True right after a sign-in, so the welcome animation plays once.
  welcome: boolean;
  clearWelcome: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToUser(session: AuthSession | null): CurrentUser | null {
  if (!session) return null;
  const payload = decodeJwt(session.accessToken);
  if (!payload) return null;
  return { userId: payload.sub, phone: payload.phone, role: payload.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(() => sessionToUser(getSession()));
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  // Any tap, key, scroll or touch counts as activity (throttled), and a
  // periodic check signs out a tab left idle past the limit.
  useEffect(() => {
    if (!user) return;
    let lastWrite = 0;
    const onActivity = () => {
      if (Date.now() - lastWrite < 15_000) return;
      lastWrite = Date.now();
      recordActivity();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const check = () => {
      if (!getSession()) setUser(null);
    };
    const timer = window.setInterval(check, 30_000);
    // Coming back to a tab that sat in the background: check right away.
    document.addEventListener('visibilitychange', check);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [user]);


  const login = async (phone: string, password: string, expectedRole?: 'ADMIN' | 'STAFF') => {
    let session: AuthSession;
    try {
      session = await api.post<AuthSession>('/auth/login', { phone, password });
    } catch (err) {
      // The API's own "Invalid credentials" is accurate but curt —
      // spell out what to do about it instead of just naming the problem.
      if (err instanceof ApiError && err.status === 401) {
        throw new Error('Incorrect phone number or password. Please check your credentials and try again.');
      }
      throw err;
    }
    startSession(session, expectedRole);
  };

  // Shared by every sign-in method.
  const startSession = (session: AuthSession, expectedRole?: Portal) => {
    const nextUser = sessionToUser(session);
    // The API issues a token for any valid login — CUSTOMER accounts
    // included. This console is staff/admin-only, so gate it here too.
    if (!nextUser || (nextUser.role !== 'ADMIN' && nextUser.role !== 'STAFF')) {
      throw new Error("This account doesn't have admin dashboard access.");
    }
    // The login page's Admin/Agent tab is a real check, not just a label —
    // picking the wrong one refuses the session rather than silently
    // logging someone into a portal built for the other role.
    if (expectedRole && nextUser.role !== expectedRole) {
      throw new Error(
        expectedRole === 'ADMIN'
          ? 'This is an agent account — use the Agent Login tab instead.'
          : 'This is an admin account — use the Admin Login tab instead.',
      );
    }
    setSession(session);
    setUser(nextUser);
    setWelcome(true);
  };

  const loginWithPhoneOtp = async (idToken: string, portal: Portal) => {
    startSession(await api.post<AuthSession>('/auth/phone-otp', { idToken, portal }), portal);
  };

  const loginWithGoogle = async (idToken: string, portal: Portal) => {
    startSession(await api.post<AuthSession>('/auth/google', { idToken, portal }), portal);
  };

  const logout = () => {
    endSession(null);
    setUser(null);
    setWelcome(false);
  };

  const value = useMemo(
    () => ({ user, login, loginWithPhoneOtp, loginWithGoogle, logout, welcome, clearWelcome: () => setWelcome(false) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, welcome],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
