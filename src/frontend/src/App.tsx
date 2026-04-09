import { useState, useEffect, FormEvent } from 'react';

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
    } catch (err) {
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
    } catch (err) {
      setError('Failed to create example');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Reference Architecture Demo</h1>

      <p style={{ color: '#666' }}>
        Tenant: <strong>{tenant}</strong>
      </p>

      <hr />

      <h2>Create Example</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
        />
        <button type="submit" disabled={loading} style={{ padding: '8px 16px', fontSize: 14 }}>
          {loading ? 'Creating...' : 'Create'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <hr />

      <h2>Examples</h2>
      {examples.length === 0 ? (
        <p style={{ color: '#999' }}>No examples yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Name</th>
              <th style={th}>Created At</th>
            </tr>
          </thead>
          <tbody>
            {examples.map((ex) => (
              <tr key={ex.id}>
                <td style={td}>{ex.id}</td>
                <td style={td}>{ex.name}</td>
                <td style={td}>{ex.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr />

      <button onClick={() => setShowRaw(!showRaw)} style={{ fontSize: 13, cursor: 'pointer' }}>
        {showRaw ? 'Hide' : 'Show'} Raw Response
      </button>
      {showRaw && (
        <pre style={{ background: '#f5f5f5', padding: 12, overflow: 'auto', fontSize: 12 }}>
          {rawResponse}
        </pre>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '2px solid #ddd',
  padding: '8px 4px',
};

const td: React.CSSProperties = {
  borderBottom: '1px solid #eee',
  padding: '8px 4px',
};
