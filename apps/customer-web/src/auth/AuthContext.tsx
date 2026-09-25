import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, decodeJwt, getSession, setSession, setUnauthorizedHandler } from '../api/client';
import type { AuthSession, Role } from '../api/types';

export interface CurrentUser {
  userId: string;
  phone?: string;
  role: Role;
}

interface RegisterInput {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  referralCode?: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithGoogle: (idToken: string, referralCode?: string) => Promise<void>;
  // fullName is only needed the first time a given phone number signs
  // in — the API rejects a brand-new phone with no name (see ApiError
  // status 412), which is the caller's cue to ask for one and retry.
  // referralCode is only applied when that first sign-in creates the account.
  loginWithPhoneOtp: (idToken: string, fullName?: string, referralCode?: string) => Promise<void>;
  // "Forgot password" — idToken is a Firebase phone-auth token proving
  // the customer owns that number, same trust as loginWithPhoneOtp.
  resetPasswordWithPhone: (idToken: string, newPassword: string) => Promise<void>;
  logout: () => void;
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

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const login = async (phone: string, password: string) => {
    const session = await api.post<AuthSession>('/auth/login', { phone, password });
    setSession(session);
    setUser(sessionToUser(session));
  };

  const register = async (input: RegisterInput) => {
    // Public registration is always forced to CUSTOMER on the API side.
    const session = await api.post<AuthSession>('/auth/register', input);
    setSession(session);
    setUser(sessionToUser(session));
  };

  const loginWithGoogle = async (idToken: string, referralCode?: string) => {
    const session = await api.post<AuthSession>('/auth/google', { idToken, referralCode });
    setSession(session);
    setUser(sessionToUser(session));
  };

  const loginWithPhoneOtp = async (idToken: string, fullName?: string, referralCode?: string) => {
    const session = await api.post<AuthSession>('/auth/phone-otp', { idToken, fullName, referralCode });
    setSession(session);
    setUser(sessionToUser(session));
  };

  const resetPasswordWithPhone = async (idToken: string, newPassword: string) => {
    const session = await api.post<AuthSession>('/auth/reset-password', { idToken, newPassword });
    setSession(session);
    setUser(sessionToUser(session));
  };

  const logout = () => {
    setSession(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, login, register, loginWithGoogle, loginWithPhoneOtp, resetPasswordWithPhone, logout }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
