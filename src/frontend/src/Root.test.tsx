import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { Root } from './Root';
import type { RuntimeConfig } from './runtime-config';

const { mockFetchRuntimeConfig, mockUseAuth0 } = vi.hoisted(() => ({
  mockFetchRuntimeConfig: vi.fn(),
  mockUseAuth0: vi.fn(),
}));

vi.mock('./runtime-config', () => ({
  fetchRuntimeConfig: mockFetchRuntimeConfig,
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: mockUseAuth0,
  Auth0Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Root auth-provider selection', () => {
  beforeEach(() => {
    mockFetchRuntimeConfig.mockReset();
    mockUseAuth0.mockReset();
    // App (magic-link path) hits the network on mount; make it resolve to
    // unauthenticated without real requests.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'no' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders the magic-link app without requiring Auth0 config in non-OIDC mode', async () => {
    const cfg: RuntimeConfig = {
      authProvider: 'internal_magic_link',
      compute: 'lambda',
      auth0: null,
    };
    mockFetchRuntimeConfig.mockResolvedValue(cfg);

    render(<Root />);

    // The existing magic-link sign-in UI renders; Auth0 is never consulted.
    expect(await screen.findByRole('button', { name: /send link/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reference Architecture Demo' })).toBeInTheDocument();
    // Compute badge reflects the runtime config's detected backend.
    expect(screen.getByText('AWS Lambda')).toBeInTheDocument();
    // The Lambda magic-link deployment links to the other two live deployments,
    // not itself.
    expect(
      screen.getByRole('link', { name: /magic-link on ECS Fargate/i }),
    ).toHaveAttribute('href', 'https://reference-architecture.603.nz');
    expect(
      screen.getByRole('link', { name: /Auth0\/OIDC on ECS Fargate/i }),
    ).toHaveAttribute('href', 'https://reference-architecture-auth0.603.nz');
    expect(
      screen.queryByRole('link', { name: /magic-link on AWS Lambda/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(mockUseAuth0).not.toHaveBeenCalled();
  });

  it('renders the Auth0 login flow in OIDC mode', async () => {
    const cfg: RuntimeConfig = {
      authProvider: 'oidc',
      compute: 'ecs',
      auth0: {
        domain: 'tenant.auth0.com',
        clientId: 'spa-client-id',
        audience: 'https://reference-architecture-auth0.603.nz/api',
      },
    };
    mockFetchRuntimeConfig.mockResolvedValue(cfg);
    mockUseAuth0.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: undefined,
      error: undefined,
      loginWithRedirect: vi.fn(),
      logout: vi.fn(),
      getAccessTokenSilently: vi.fn(),
    });

    render(<Root />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /log in with auth0/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Reference Architecture Auth0 Demo' })).toBeInTheDocument();
    expect(screen.getByText('ECS Fargate')).toBeInTheDocument();
    // The Fargate Auth0 deployment links to the two magic-link deployments.
    expect(
      screen.getByRole('link', { name: /magic-link on ECS Fargate/i }),
    ).toHaveAttribute('href', 'https://reference-architecture.603.nz');
    expect(
      screen.getByRole('link', { name: /magic-link on AWS Lambda/i }),
    ).toHaveAttribute('href', 'https://reference-architecture-lambda.603.nz');
  });
});
