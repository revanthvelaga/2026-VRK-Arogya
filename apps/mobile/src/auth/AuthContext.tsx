import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, decodeJwt, loadSession, setSession, setUnauthorizedHandler } from '../api/client';
import type { AuthSession, Role } from '../api/types';

export interface CurrentUser {
  userId: string;
  phone: string;
  role: Role;
}

interface RegisterInput {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  bootstrapping: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
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
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    loadSession().then((session) => {
      setUser(sessionToUser(session));
      setBootstrapping(false);
    });
  }, []);

  const login = async (phone: string, password: string) => {
    const session = await api.post<AuthSession>('/auth/login', { phone, password });
    await setSession(session);
    setUser(sessionToUser(session));
  };

  const register = async (input: RegisterInput) => {
    // Public registration is always forced to CUSTOMER on the API side.
    const session = await api.post<AuthSession>('/auth/register', input);
    await setSession(session);
    setUser(sessionToUser(session));
  };

  const logout = () => {
    setSession(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, bootstrapping, login, register, logout }), [user, bootstrapping]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
