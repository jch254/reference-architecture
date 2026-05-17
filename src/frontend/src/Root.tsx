import { Auth0Provider } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

import './App.css';
import { App } from './App';
import { OidcApp } from './auth/OidcApp';
import { fetchRuntimeConfig, type RuntimeConfig } from './runtime-config';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container">
      <h1 className="app-title">Reference Architecture Demo</h1>
      <hr className="section-divider" />
      {children}
    </div>
  );
}

/**
 * Picks the auth experience from the deployment's public runtime config so the
 * same bundle works everywhere:
 *  - oidc + Auth0 SPA settings → Auth0 login/logout via <OidcApp>
 *  - none / internal_magic_link → existing <App> (unchanged behaviour)
 * If the config request fails we fall back to <App> so a transient outage can
 * never break the existing non-OIDC demo.
 */
export function Root() {
  const [cfg, setCfg] = useState<RuntimeConfig | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchRuntimeConfig().then(setCfg).catch(() => setFailed(true));
  }, []);

  if (failed) return <App />;

  if (!cfg) {
    return (
      <Shell>
        <p className="muted-text">Loading…</p>
      </Shell>
    );
  }

  if (cfg.authProvider === 'oidc') {
    if (!cfg.auth0) {
      return (
        <Shell>
          <p className="error-message">
            This deployment is configured for OIDC login but is missing Auth0
            SPA settings. Set AUTH0_SPA_CLIENT_ID for this deployment.
          </p>
        </Shell>
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
        <OidcApp />
      </Auth0Provider>
    );
  }

  // none / internal_magic_link → existing demo behaviour, untouched.
  return <App />;
}
