import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { OidcApp } from './OidcApp';

const { mockUseAuth0 } = vi.hoisted(() => ({ mockUseAuth0: vi.fn() }));
vi.mock('@auth0/auth0-react', () => ({ useAuth0: mockUseAuth0 }));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseAuth0 = {
  isLoading: false,
  isAuthenticated: false,
  user: undefined,
  error: undefined,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn().mockResolvedValue('access-token-xyz'),
};

describe('OidcApp', () => {
  beforeEach(() => {
    mockUseAuth0.mockReset();
    baseAuth0.loginWithRedirect.mockReset();
    baseAuth0.logout.mockReset();
    baseAuth0.getAccessTokenSilently.mockReset().mockResolvedValue('access-token-xyz');
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders a login button when unauthenticated', () => {
    mockUseAuth0.mockReturnValue({ ...baseAuth0, isAuthenticated: false });
    render(<OidcApp compute="ecs" />);
    expect(screen.getByRole('heading', { name: 'Reference Architecture Auth0 Demo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /magic-link on ECS Fargate/i })).toHaveAttribute(
      'href',
      'https://reference-architecture.603.nz',
    );
    expect(screen.getByRole('link', { name: /magic-link on AWS Lambda/i })).toHaveAttribute(
      'href',
      'https://reference-architecture-lambda.603.nz',
    );
    expect(screen.getByRole('button', { name: /log in with auth0/i })).toBeInTheDocument();
    expect(screen.getByText(/local app user/i)).toBeInTheDocument();
  });

  it('calls /api/me with a bearer token and shows local auth details when authenticated', async () => {
    mockUseAuth0.mockReturnValue({
      ...baseAuth0,
      isAuthenticated: true,
      user: { email: 'demo@example.com' },
    });

    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/me') {
        return jsonResponse({ data: { user: { userId: 'u-1', provider: 'oidc' } } });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OidcApp />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.anything()));

    const meCall = fetchMock.mock.calls.find(([u]) => u === '/api/me')!;
    const headers = (meCall[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-token-xyz');

    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    expect(await screen.findByText(/demo@example.com · oidc · u-1/i)).toBeInTheDocument();
  });

  it('shows the raw example response in OIDC mode', async () => {
    mockUseAuth0.mockReturnValue({
      ...baseAuth0,
      isAuthenticated: true,
      user: { email: 'demo@example.com' },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/me') {
          return jsonResponse({ data: { user: { userId: 'u-1', provider: 'oidc' } } });
        }
        return jsonResponse({ data: [] });
      }),
    );

    render(<OidcApp />);

    await screen.findByRole('button', { name: /show raw response/i });
    fireEvent.click(screen.getByRole('button', { name: /show raw response/i }));

    expect(screen.getByRole('button', { name: /hide raw response/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.classList.contains('raw-block') === true &&
          element.textContent?.includes('"data": []') === true,
      ),
    ).toBeInTheDocument();
  });

  it('sends a bearer token on example create (CRUD) in OIDC mode', async () => {
    mockUseAuth0.mockReturnValue({
      ...baseAuth0,
      isAuthenticated: true,
      user: { email: 'demo@example.com' },
    });

    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/me') {
        return jsonResponse({ data: { user: { userId: 'u-1', provider: 'oidc' } } });
      }
      if (url === '/api/example') {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: {} });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OidcApp />);

    await screen.findByRole('button', { name: /log out/i });

    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'My example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([u, init]) => u === '/api/example' && (init as RequestInit).method === 'POST',
      );
      expect(post).toBeTruthy();
      const headers = (post![1] as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer access-token-xyz');
    });
  });

  it('shows a loading state while Auth0 initializes', () => {
    mockUseAuth0.mockReturnValue({ ...baseAuth0, isLoading: true });
    render(<OidcApp />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
