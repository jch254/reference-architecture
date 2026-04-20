import { useState, useEffect, useCallback, FormEvent } from 'react';
import './App.css';
import { api, ApiError, clearToken } from './api/api-client';

interface Example {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

type AuthState = 'loading' | 'unauthenticated' | 'sent' | 'authenticated';

const tenant = window.location.hostname.split('.')[0];

export function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [sessionEmail, setSessionEmail] = useState('');
  const [email, setEmail] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [examples, setExamples] = useState<Example[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'error') {
      const reason = params.get('reason');
      setAuthError(
        reason === 'consumed'
          ? 'This sign-in link has already been used. If you signed in on another device, you\u2019re all set there. Otherwise, please request a new link.'
          : 'Your sign-in link was invalid or has expired. Please request a new one.',
      );
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

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // ignore
    }
    clearToken();
    setAuthState('unauthenticated');
    setSessionEmail('');
    setExamples([]);
    setRawResponse('');
  }, []);

  const handleApiError = useCallback(
    (err: unknown, fallback: string): string | null => {
      if (err instanceof ApiError && err.status === 401) {
        if (authState === 'authenticated') logout();
        return null;
      }
      return err instanceof ApiError ? err.message : fallback;
    },
    [logout, authState],
  );

  const fetchExamples = useCallback(async () => {
    try {
      const data = await api.get<Example[]>('/api/example');
      setExamples([...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setRawResponse(JSON.stringify({ data }, null, 2));
      setError(null);
    } catch (err) {
      const msg = handleApiError(err, 'Failed to fetch examples');
      if (msg) setError(msg);
    }
  }, [handleApiError]);

  useEffect(() => {
    if (authState === 'authenticated' || authState === 'unauthenticated') {
      fetchExamples();
    }
  }, [authState, fetchExamples]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoginLoading(true);
    setLoginError(null);
    try {
      await api.post('/api/auth/request-link', { email: email.trim() });
      setAuthState('sent');
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Failed to send sign-in link');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await api.post('/api/example', { name: name.trim() });
      setName('');
      await fetchExamples();
      setError(null);
    } catch (err) {
      const msg = handleApiError(err, 'Failed to create example');
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/example/${id}`);
      await fetchExamples();
      setError(null);
    } catch (err) {
      const msg = handleApiError(err, 'Failed to delete example');
      if (msg) setError(msg);
    }
  };

  const startEdit = (ex: Example) => {
    setEditingId(ex.id);
    setEditingName(ex.name);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await api.patch(`/api/example/${id}`, { name: editingName.trim() });
      setEditingId(null);
      setEditingName('');
      await fetchExamples();
      setError(null);
    } catch (err) {
      const msg = handleApiError(err, 'Failed to update example');
      if (msg) setError(msg);
    }
  };

  if (authState === 'loading') {
    return (
      <div className="app-container">
        <h1 className="app-title">Reference Architecture Demo</h1>
        <div className="tenant">
          Tenant <span className="tenant-value">{tenant}</span>
        </div>
        <hr className="section-divider" />
        <p className="muted-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1 className="app-title">Reference Architecture Demo</h1>

      <div className="tenant">
        Tenant <span className="tenant-value">{tenant}</span>
      </div>

      <hr className="section-divider" />

      {authState === 'unauthenticated' && (
        <section className="section">
          <h2 className="section-header">Sign In</h2>
          <p className="auth-description">Enter your email address and we'll send you a sign-in link.</p>
          <form onSubmit={handleLogin} className="create-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="create-input"
              autoComplete="email"
            />
            <button type="submit" disabled={loginLoading} className="btn btn-primary">
              {loginLoading ? 'Sending…' : 'Send link'}
            </button>
          </form>
          {authError && <p className="error-message">{authError}</p>}
          {loginError && <p className="error-message">{loginError}</p>}
        </section>
      )}

      {authState === 'sent' && (
        <section className="section auth-sent">
          <h2 className="section-header">Check your email</h2>
          <p className="auth-description">
            We sent a sign-in link to <strong>{email}</strong>. Click the link in the email to continue.
          </p>
          <p className="auth-hint">
            Didn't receive it?{' '}
            <button
              className="btn-link"
              onClick={() => {
                setAuthState('unauthenticated');
                setLoginError(null);
                setAuthError(null);
              }}
            >
              Try again
            </button>
          </p>
        </section>
      )}

      {authState === 'authenticated' && (
        <>
          <div className="auth-bar">
            <span className="auth-email">{sessionEmail}</span>
            <button onClick={logout} className="btn btn-ghost">Sign Out</button>
          </div>

          <section className="section">
            <h2 className="section-header">Create Example</h2>
            <form onSubmit={handleSubmit} className="create-form">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="create-input"
              />
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Creating…' : 'Create'}
              </button>
            </form>
            {error && <p className="error-message">{error}</p>}
          </section>

          <hr className="section-divider" />
        </>
      )}

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
                        if (e.key === 'Escape') cancelEdit();
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
                    <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(ex.id)}>Save</button>
                    <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
                  </span>
                ) : (
                  <span className="example-cell-actions">
                    {authState === 'authenticated' && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(ex)}>Edit</button>
                        <button className="btn-delete" onClick={() => handleDelete(ex.id)}>Delete</button>
                      </>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {authState === 'authenticated' && (
        <>
          <hr className="section-divider" />

          <div className="raw-toggle">
            <button onClick={() => setShowRaw(!showRaw)} className="btn btn-ghost">
              {showRaw ? 'Hide' : 'Show'} Raw Response
            </button>
            {showRaw && <pre className="raw-block">{rawResponse}</pre>}
          </div>
        </>
      )}
    </div>
  );
}
