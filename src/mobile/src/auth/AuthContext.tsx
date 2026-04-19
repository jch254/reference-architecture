import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking } from 'react-native';
import { api, clearToken, getToken, setToken, setOnUnauthorized, setPendingEmail, getPendingEmail, clearPendingEmail } from '../api';

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
    await setPendingEmail(userEmail);
    await api.post<{ message: string }>('/api/auth/request-link', { email: userEmail });
  }, []);

  const verifyAndSignIn = useCallback(async (userEmail: string, otp: string) => {
    const { token: bearerToken } = await api.get<{ ok: boolean; token: string }>(
      `/api/auth/verify?token=${encodeURIComponent(otp)}&json=1`,
    );
    await setToken(bearerToken);
    await clearPendingEmail();
    setEmail(userEmail);
    setIsAuthenticated(true);
  }, []);

  // Handle deep link auth: referenceapp://auth/verify?token=X&email=Y
  // new URL('referenceapp://auth/verify?token=X') → host='auth', pathname='/verify'
  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        console.log('[DeepLink] RAW URL:', url);
        if (!url.includes('auth/verify')) return;

        const tokenMatch = url.match(/token=([^&]+)/);
        const emailMatch = url.match(/email=([^&]+)/);

        const otp = tokenMatch?.[1];
        console.log('[DeepLink] token:', otp ? '(present)' : '(missing)');
        if (!otp) return;
        const linkEmail = emailMatch?.[1] ? decodeURIComponent(emailMatch[1]) : await getPendingEmail();
        console.log('[DeepLink] email:', linkEmail ?? '(missing)');
        if (!linkEmail) return;
        console.log('[DeepLink] calling verifyAndSignIn...');
        await verifyAndSignIn(linkEmail, otp);
        console.log('[DeepLink] AUTH SUCCESS');
      } catch (err) {
        console.error('[DeepLink] auth failed', err);
        Alert.alert('Sign-in failed', 'The link may have expired. Please request a new one.');
      }
    };

    // Cold start
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // App already running
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [verifyAndSignIn]);

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
