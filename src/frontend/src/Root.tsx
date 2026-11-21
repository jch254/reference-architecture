import { Auth0Provider } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

import { App } from './App';
import { OidcApp } from './auth/OidcApp';
import { LoadingPage } from './demo/DemoShell';
import { MissingAuth0 } from './demo/NoSignIn';
import { SignedOutPage } from './demo/SignedOutPage';
import { LOADING } from './demo/demo-copy';
import { fetchRuntimeConfig, type RuntimeConfig } from './runtime-config';

/**
 * Picks the auth experience from the deployment's public runtime config so the
 * same bundle works everywhere:
 *  - oidc + Auth0 SPA settings → Auth0 login/logout via <OidcApp>
 *  - none / internal_magic_link → <App>
 * If the config request fails we fall back to <App> so a transient outage can
 * never break the non-OIDC demo. <App> is told there is no config, and the
 * page's readout says so.
 */
export function Root() {
  const [cfg, setCfg] = useState<RuntimeConfig | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchRuntimeConfig().then(setCfg).catch(() => setFailed(true));
  }, []);

  if (failed) return <App config={null} />;

  if (!cfg) return <LoadingPage fact={LOADING.config} />;

  if (cfg.authProvider === 'oidc') {
    if (!cfg.auth0) {
      return (
        <SignedOutPage config={cfg}>
          <MissingAuth0 />
        </SignedOutPage>
      );
    }

    const { domain, clientId, audience } = cfg.auth0;
    return (
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{ audience, redirect_uri: window.location.origin }}
        cacheLocation="localstorage"
        onRedirectCallback={() =>
          window.history.replaceState({}, '', window.location.pathname)
        }
      >
        <OidcApp config={cfg} />
      </Auth0Provider>
    );
  }

  return <App config={cfg} />;
}
