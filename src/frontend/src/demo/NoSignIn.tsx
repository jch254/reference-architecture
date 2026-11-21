/**
 * What stands where the sign-in control would be on a deployment that has
 * nothing to sign in to. Both keep the base line block's label, so the
 * column reads the same as on the other deployments.
 */

/** AUTH_PROVIDER=none. The mode creates no principal, so there is no sign-in. */
export function NoSignIn() {
  return (
    <div className="baseline">
      <p className="baseline-label">There is no sign-in on this deployment</p>
      <p className="text">
        <code>AUTH_PROVIDER=none</code> creates no authenticated principal, so protected routes answer 401 and there
        is nothing to sign in to. The readout, the comparison and the request log on this page still work.
      </p>
    </div>
  );
}

/** AUTH_PROVIDER=oidc with no Auth0 SPA settings in GET /api/config. */
export function MissingAuth0() {
  return (
    <div className="notice" role="alert">
      <p>
        This deployment runs <code>AUTH_PROVIDER=oidc</code>, but <code>/api/config</code> returned no Auth0 settings,
        so the page cannot start a login. Set <code>AUTH0_SPA_CLIENT_ID</code> for this deployment.
      </p>
    </div>
  );
}
