import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { App } from './App';
import { setTokenProvider } from './api/api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('App magic-link auth details', () => {
  beforeEach(() => {
    setTokenProvider(null);
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows the signed-in email, auth provider, and local user id', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/auth/session') {
        return jsonResponse({ data: { email: 'jordan@example.com', tenantSlug: 'demo' } });
      }
      if (url === '/api/me') {
        return jsonResponse({
          data: {
            user: {
              userId: 'user-123',
              provider: 'internal_magic_link',
              email: 'jordan@example.com',
            },
          },
        });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.anything()));

    expect(
      screen.getByText(/jordan@example.com · internal_magic_link · user-123/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});
