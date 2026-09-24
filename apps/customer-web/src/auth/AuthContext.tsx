import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, decodeJwt, getSession, setSession, setUnauthorizedHandler } from '../api/client';
import type { AuthSession, Role } from '../api/types';

export interface CurrentUser {
  userId: string;
  phone?: string;
  role: Role;
}

import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
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
  loginWithGoogle: (idToken: string) => Promise<void>;
  // fullName is only needed the first time a given phone number signs
  // in — the API rejects a brand-new phone with no name (see ApiError
  // status 412), which is the caller's cue to ask for one and retry.
  loginWithPhoneOtp: (idToken: string, fullName?: string) => Promise<void>;
  // Fingerprint / Face ID via a passkey registered on this device.
  loginWithPasskey: () => Promise<void>;
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

  const loginWithGoogle = async (idToken: string) => {
    const session = await api.post<AuthSession>('/auth/google', { idToken });
    setSession(session);
    setUser(sessionToUser(session));
  };

  const loginWithPhoneOtp = async (idToken: string, fullName?: string) => {
    const session = await api.post<AuthSession>('/auth/phone-otp', { idToken, fullName });
    setSession(session);
    setUser(sessionToUser(session));
  };

  const loginWithPasskey = async () => {
    const { challengeId, options } = await api.post<{
      challengeId: string;
      options: PublicKeyCredentialRequestOptionsJSON;
    }>('/auth/passkeys/login/options');
    const response = await startAuthentication({ optionsJSON: options });
    const session = await api.post<AuthSession>('/auth/passkeys/login', { challengeId, response });
    setSession(session);
    setUser(sessionToUser(session));
  };

  const logout = () => {
    setSession(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, login, register, loginWithGoogle, loginWithPhoneOtp, loginWithPasskey, logout }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
