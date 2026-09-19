import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, decodeJwt, getSession, setSession, setUnauthorizedHandler } from '../api/client';
import type { AuthSession, Role } from '../api/types';

export interface CurrentUser {
  userId: string;
  phone: string;
  role: Role;
}

interface AuthContextValue {
  user: CurrentUser | null;
  login: (phone: string, password: string) => Promise<void>;
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
    const nextUser = sessionToUser(session);
    // The API issues a token for any valid login — CUSTOMER accounts
    // included. This console is staff/admin-only, so gate it here too.
    if (!nextUser || (nextUser.role !== 'ADMIN' && nextUser.role !== 'STAFF')) {
      throw new Error("This account doesn't have admin dashboard access.");
    }
    setSession(session);
    setUser(nextUser);
  };

  const logout = () => {
    setSession(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
