import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, setToken, setOnUnauthorized } from '../api';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  requestLink: (email: string) => Promise<void>;
  verifyAndSignIn: (email: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await clearToken();
    setIsAuthenticated(false);
    setEmail(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setIsAuthenticated(false);
      setEmail(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const session = await api.get<{ email: string; tenantSlug: string }>('/api/auth/session');
        setEmail(session.email);
        setIsAuthenticated(true);
      } catch {
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const requestLink = useCallback(async (userEmail: string) => {
    await api.post<{ message: string }>('/api/auth/request-link', { email: userEmail });
  }, []);

  const verifyAndSignIn = useCallback(async (userEmail: string, otp: string) => {
    await api.get(`/api/auth/verify?t=${encodeURIComponent(otp)}&json=1`);
    const { token } = await api.post<{ token: string }>('/api/auth/token', { email: userEmail });
    await setToken(token);
    setEmail(userEmail);
    setIsAuthenticated(true);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, email, requestLink, verifyAndSignIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
