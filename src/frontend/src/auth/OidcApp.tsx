import { useAuth0 } from '@auth0/auth0-react';
import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';

import { AppHeader } from '../AppHeader';
import { api, ApiError, setTokenProvider } from '../api/api-client';
import { getDemoCopy } from '../demo-copy';

interface Example {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface LocalUser {
  userId: string;
  provider: string;
  email?: string;
  name?: string;
}

/**
 * OIDC (Auth0) deployment shell. Rendered only when the runtime config reports
 * AUTH_PROVIDER=oidc with a configured Auth0 SPA client id, and only inside an
 * <Auth0Provider>. The default/magic-link deployment keeps using <App>; this
 * component never runs there.
 */
export function OidcApp() {
  const copy = getDemoCopy('oidc');
  const {
    isLoading,
    isAuthenticated,
    user,
    error,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [examples, setExamples] = useState<Example[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error_, setError] = useState<string | null>(null);
  const bootstrappedRef = useRef(false);

  // Register the Auth0 access-token source for the API client while signed in.
  // getAccessTokenSilently() returns a token for the audience configured on
  // <Auth0Provider>, so the API client never sees raw Auth0 internals.
  useEffect(() => {
    if (isAuthenticated) {
      setTokenProvider(() => getAccessTokenSilently());
    }
    return () => setTokenProvider(null);
  }, [isAuthenticated, getAccessTokenSilently]);

  const handleUnauthorized = useCallback((err: unknown, fallback: string): string => {
    if (err instanceof ApiError && err.status === 401) {
      // Predictable signed-out state — no retry loop.
      setLocalUser(null);
      return 'Your session is no longer valid. Please sign in again.';
    }
    return err instanceof ApiError ? err.message : fallback;
  }, []);

  const fetchExamples = useCallback(async () => {
    try {
      const data = await api.get<Example[]>('/api/example');
      setExamples(
        [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
      setError(null);
    } catch (err) {
      setError(handleUnauthorized(err, 'Failed to fetch examples'));
    }
  }, [handleUnauthorized]);

  // Bootstrap once after login: /api/me is the local-app entrypoint (it
  // creates/returns the tenant-scoped local user); then load examples.
  useEffect(() => {
    if (!isAuthenticated || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      try {
        const { user: u } = await api.get<{ user: LocalUser }>('/api/me');
        setLocalUser(u);
        setBootstrapError(null);
        await fetchExamples();
      } catch (err) {
        setBootstrapError(handleUnauthorized(err, 'Failed to load your account'));
      }
    })();
  }, [isAuthenticated, fetchExamples, handleUnauthorized]);

  const signOut = useCallback(() => {
    setTokenProvider(null);
    setLocalUser(null);
    setExamples([]);
    logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post('/api/example', { name: name.trim() });
      setName('');
      await fetchExamples();
    } catch (err) {
      setError(handleUnauthorized(err, 'Failed to create example'));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await api.patch(`/api/example/${id}`, { name: editingName.trim() });
      setEditingId(null);
      setEditingName('');
      await fetchExamples();
    } catch (err) {
      setError(handleUnauthorized(err, 'Failed to update example'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/example/${id}`);
      await fetchExamples();
    } catch (err) {
      setError(handleUnauthorized(err, 'Failed to delete example'));
    }
  };

  if (isLoading) {
    return (
      <div className="app-container">
        <AppHeader authProvider="oidc" />
        <hr className="section-divider" />
        <p className="muted-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <AppHeader authProvider="oidc" />
      <hr className="section-divider" />

      {!isAuthenticated && (
        <>
          <section className="section">
            <h2 className="section-header">Sign In</h2>
            <p className="auth-description">{copy.signInDescription}</p>
            <button
              className="btn btn-primary"
              onClick={() => loginWithRedirect()}
            >
              {copy.signInButton}
            </button>
            {error && (
              <p className="error-message">
                Sign-in failed: {error.message}
              </p>
            )}
          </section>

          <section className="section">
            <h2 className="section-header">Examples</h2>
            <p className="empty-state">{copy.signedOutExamples}</p>
          </section>
        </>
      )}

      {isAuthenticated && (
        <>
          <div className="auth-bar">
            <span className="auth-email">
              {user?.email ?? user?.name ?? 'Signed in'}
              {localUser && (
                <>
                  {' · '}
                  {localUser.provider} · {localUser.userId}
                </>
              )}
            </span>
            <button onClick={signOut} className="btn btn-ghost">
              Log Out
            </button>
          </div>

          {bootstrapError && <p className="error-message">{bootstrapError}</p>}

          <section className="section">
            <h2 className="section-header">Create Example</h2>
            <p className="section-note">
              Create, edit, and delete actions apply only to examples owned by your signed-in user.
            </p>
            <form onSubmit={handleCreate} className="create-form">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="create-input"
              />
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </form>
            {error_ && <p className="error-message">{error_}</p>}
          </section>

          <hr className="section-divider" />

          <section className="section">
            <h2 className="section-header">Examples</h2>
            {examples.length === 0 ? (
              <p className="empty-state">No examples yet.</p>
            ) : (
              <div className="example-list">
                <div className="example-header">
                  <span>ID</span>
                  <span>Name</span>
                  <span>Created</span>
                  <span></span>
                </div>
                {examples.map((ex) => (
                  <div className="example-row" key={ex.id}>
                    <span className="example-cell example-cell-id">{ex.id}</span>
                    {editingId === ex.id ? (
                      <span className="example-cell example-cell-edit">
                        <input
                          className="edit-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(ex.id);
                            if (e.key === 'Escape') {
                              setEditingId(null);
                              setEditingName('');
                            }
                          }}
                          autoFocus
                        />
                      </span>
                    ) : (
                      <span className="example-cell">{ex.name}</span>
                    )}
                    <span className="example-cell">{ex.createdAt}</span>
                    {editingId === ex.id ? (
                      <span className="example-cell-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleUpdate(ex.id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditingId(null);
                            setEditingName('');
                          }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="example-cell-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditingId(ex.id);
                            setEditingName(ex.name);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(ex.id)}
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
