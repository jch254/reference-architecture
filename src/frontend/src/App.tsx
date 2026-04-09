import { useState, useEffect, FormEvent } from 'react';
import './App.css';

interface Example {
  id: string;
  name: string;
  createdAt: string;
}

const tenant = window.location.hostname.split('.')[0];

export function App() {
  const [examples, setExamples] = useState<Example[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fetchExamples = async () => {
    try {
      const res = await fetch('/api/example');
      const json = await res.json();
      setExamples(json.data);
      setRawResponse(JSON.stringify(json, null, 2));
      setError(null);
    } catch (_err) {
      setError('Failed to fetch examples');
    }
  };

  useEffect(() => {
    fetchExamples();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error('Create failed');
      setName('');
      await fetchExamples();
      setError(null);
    } catch (_err) {
      setError('Failed to create example');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/example/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await fetchExamples();
      setError(null);
    } catch (_err) {
      setError('Failed to delete example');
    }
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Reference Architecture Demo</h1>

      <div className="tenant">
        Tenant <span className="tenant-value">{tenant}</span>
      </div>

      <hr className="section-divider" />

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
                <span className="example-cell">{ex.name}</span>
                <span className="example-cell">{ex.createdAt}</span>
                <button className="btn-delete" onClick={() => handleDelete(ex.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="section-divider" />

      <div className="raw-toggle">
        <button onClick={() => setShowRaw(!showRaw)} className="btn btn-ghost">
          {showRaw ? 'Hide' : 'Show'} Raw Response
        </button>
        {showRaw && <pre className="raw-block">{rawResponse}</pre>}
      </div>
    </div>
  );
}
