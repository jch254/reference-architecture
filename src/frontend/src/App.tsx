import { useState, useEffect, useCallback, type FormEvent } from 'react';

import type { RuntimeConfig } from '../../shared/api-types';

import { api, ApiError, clearToken } from './api/api-client';
import { LoadingPage } from './demo/DemoShell';
import { NoSignIn } from './demo/NoSignIn';
import { SignedInView } from './demo/SignedInView';
import { SignedOutPage } from './demo/SignedOutPage';
import { LINK_ERROR, LINK_EXPIRY_MINUTES, LINK_SENT, LOADING, SIGN_IN, SIGN_OUT } from './demo/demo-copy';
import { Button } from './ui/Button';
import { Baseline } from './ui/Field';

type AuthState = 'loading' | 'unauthenticated' | 'sent' | 'authenticated';

/** Why an emailed link did not sign the visitor in, from ?auth=error&reason=. */
type LinkError = 'consumed' | 'invalid';

function requestLinkError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'RATE_LIMITED') return 'Too many requests for a link. Wait a minute and try again.';
    if (err.code === 'NETWORK_ERROR') return 'The request did not reach the API. Check your connection and try again.';
    return err.message;
  }
  return 'The link was not sent.';
}

/**
 * The magic-link shell. It owns only this provider's auth: the session
 * check, requesting a link, the result of opening one and signing out. The
 * pages themselves are in demo/ and are shared with the OIDC shell.
 *
 * It also renders for AUTH_PROVIDER=none, where there is nothing to sign in
 * to and the page says so. `config` is null when GET /api/config failed, in
 * which case the page assumes this provider.
 */
export function App({ config }: { config: RuntimeConfig | null }) {
  const copy = SIGN_IN.internal_magic_link;
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [sessionEmail, setSessionEmail] = useState('');
  const [email, setEmail] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<LinkError | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'error') {
      setLinkError(params.get('reason') === 'consumed' ? 'consumed' : 'invalid');
      setAuthState('unauthenticated');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    api
      .get<{ email: string; tenantSlug: string }>('/api/auth/session')
      .then((session) => {
        setSessionEmail(session.email);
        setAuthState('authenticated');
      })
      .catch(() => {
        setAuthState('unauthenticated');
      });
  }, []);

  // Also what a 401 does: the session is gone, so the page signs out.
  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // ignore
    }
    clearToken();
    setAuthState('unauthenticated');
    setSessionEmail('');
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoginLoading(true);
    setLoginError(null);
    try {
      await api.post('/api/auth/request-link', { email: email.trim() });
      setLinkError(null);
      setAuthState('sent');
    } catch (err) {
      setLoginError(requestLinkError(err));
    } finally {
      setLoginLoading(false);
    }
  };

  if (authState === 'loading') {
    return <LoadingPage fact={LOADING.session} />;
  }

  if (authState === 'authenticated') {
    return (
      <SignedInView
        config={config}
        account={sessionEmail}
        signOutLabel={SIGN_OUT.internal_magic_link}
        onSignOut={logout}
        onUnauthorized={logout}
      />
    );
  }

  if (config?.authProvider === 'none') {
    return (
      <SignedOutPage config={config}>
        <NoSignIn />
      </SignedOutPage>
    );
  }

  if (authState === 'sent') {
    return (
      <SignedOutPage
        config={config}
        headline={LINK_SENT.headline}
        lede={
          <>
            The API has sent a sign-in link to <strong>{email.trim()}</strong>. It works once and expires after{' '}
            {LINK_EXPIRY_MINUTES} minutes. Open it and you will come back here signed in.
          </>
        }
      >
        <button
          type="button"
          className="link"
          onClick={() => {
            setAuthState('unauthenticated');
            setLoginError(null);
            setLinkError(null);
          }}
        >
          {LINK_SENT.different}
        </button>
      </SignedOutPage>
    );
  }

  return (
    <SignedOutPage
      config={config}
      {...(linkError && { headline: LINK_ERROR.headline, lede: LINK_ERROR[linkError] })}
    >
      <Baseline label={copy.label} labelFor="email" help={copy.help} error={loginError} onSubmit={handleLogin}>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={copy.placeholder}
          autoComplete="email"
        />
        <Button type="submit" disabled={loginLoading} className="sign-in-submit">
          {loginLoading ? copy.busy : copy.button}
        </Button>
      </Baseline>
    </SignedOutPage>
  );
}
