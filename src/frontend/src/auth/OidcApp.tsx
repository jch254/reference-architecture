import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useLayoutEffect, useState } from 'react';

import type { RuntimeConfig } from '../../../shared/api-types';
import { setTokenProvider } from '../api/api-client';
import { LoadingPage } from '../demo/DemoShell';
import { SessionInvalidPage, SignedInView } from '../demo/SignedInView';
import { SignedOutPage } from '../demo/SignedOutPage';
import { LOADING, SIGN_IN, SIGN_OUT } from '../demo/demo-copy';
import { Button } from '../ui/Button';
import { Baseline } from '../ui/Field';

/**
 * The OIDC (Auth0) shell. Rendered only when the runtime config reports
 * AUTH_PROVIDER=oidc with a configured Auth0 SPA client id, and only inside
 * an <Auth0Provider>. It owns only this provider's auth: the Auth0 login and
 * logout, the access-token source for the API client and what a 401 means.
 * The pages themselves are in demo/ and are shared with the magic-link shell.
 */
export function OidcApp({ config }: { config: RuntimeConfig }) {
  const {
    isLoading,
    isAuthenticated,
    user,
    error,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [sessionInvalid, setSessionInvalid] = useState(false);

  // Register the Auth0 access-token source for the API client while signed in.
  // getAccessTokenSilently() returns a token for the audience configured on
  // <Auth0Provider>, so the API client never sees raw Auth0 internals.
  //
  // A layout effect, because the signed-in view below asks for /api/me in an
  // effect of its own and a child's effects run before its parent's. Layout
  // effects all run first, so the token source is in place for that request.
  useLayoutEffect(() => {
    if (isAuthenticated) {
      setTokenProvider(() => getAccessTokenSilently());
    }
    return () => setTokenProvider(null);
  }, [isAuthenticated, getAccessTokenSilently]);

  // Predictable signed-out state on a 401: no retry loop. Auth0 still reports
  // signed in, so the page says the session is no longer valid and offers
  // the way out.
  const handleUnauthorized = useCallback(() => setSessionInvalid(true), []);

  const signOut = useCallback(() => {
    setTokenProvider(null);
    logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

  if (isLoading) {
    return <LoadingPage fact={LOADING.auth0} />;
  }

  if (!isAuthenticated) {
    return (
      <SignedOutPage config={config}>
        <Baseline
          bare
          label={SIGN_IN.oidc.label}
          help={SIGN_IN.oidc.help}
          error={error && `Auth0 did not complete the sign-in: ${error.message}`}
        >
          <Button onClick={() => loginWithRedirect()}>{SIGN_IN.oidc.button}</Button>
        </Baseline>
      </SignedOutPage>
    );
  }

  const frame = {
    config,
    account: user?.email ?? user?.name ?? 'Signed in',
    signOutLabel: SIGN_OUT.oidc,
    onSignOut: signOut,
  };

  if (sessionInvalid) {
    return <SessionInvalidPage {...frame} />;
  }

  return <SignedInView {...frame} onUnauthorized={handleUnauthorized} />;
}
