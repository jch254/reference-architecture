import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { Root } from './Root';
import { clearRequestLog } from './demo/request-log';
import type { RuntimeConfig } from './runtime-config';
import { fakeApi, stubLocalStorage, visit } from './test-support';

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

const signedOutAuth0 = {
  isLoading: false,
  isAuthenticated: false,
  user: undefined,
  error: undefined,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn(),
};

describe('Root auth-provider selection', () => {
  beforeEach(() => {
    mockFetchRuntimeConfig.mockReset();
    mockUseAuth0.mockReset();
    clearRequestLog();
    stubLocalStorage();
    // App (magic-link path) hits the network on mount; the fake API answers
    // the session check with 401, as the real one does when signed out.
    fakeApi();
    visit('localhost');
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders the magic-link app without requiring Auth0 config in non-OIDC mode', async () => {
    const cfg: RuntimeConfig = {
      authProvider: 'internal_magic_link',
      compute: 'lambda',
      auth0: null,
    };
    mockFetchRuntimeConfig.mockResolvedValue(cfg);
    visit('reference-architecture-lambda.603.nz');

    render(<Root />);

    // The magic-link sign-in renders; Auth0 is never consulted.
    expect(await screen.findByRole('button', { name: 'Send link' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'The baseline I copy when I start a product.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Sign in with a magic link')).toHaveAttribute('placeholder', 'you@example.com');

    // The readout reflects the runtime config's auth provider and detected
    // compute, and the tenant mode deployments.ts holds for this host.
    const readout = screen.getByRole('region', { name: 'This deployment' });
    expect(readout).toHaveTextContent('authMagic link');
    expect(readout).toHaveTextContent('computeLambda');
    expect(readout).toHaveTextContent('tenancySubdomain');
    expect(await screen.findByText('Responding')).toBeInTheDocument();

    // The Lambda magic-link deployment is marked as the one you are on and
    // links to the other two, not to itself.
    expect(screen.getByText('you are here')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'reference-architecture.603.nz' })).toHaveAttribute(
      'href',
      'https://reference-architecture.603.nz',
    );
    expect(screen.getByRole('link', { name: 'reference-architecture-auth0.603.nz' })).toHaveAttribute(
      'href',
      'https://reference-architecture-auth0.603.nz',
    );
    expect(screen.queryByRole('link', { name: 'reference-architecture-lambda.603.nz' })).not.toBeInTheDocument();
    expect(mockUseAuth0).not.toHaveBeenCalled();
  });

  it('renders the Auth0 login flow in OIDC mode', async () => {
    const cfg: RuntimeConfig = {
      authProvider: 'oidc',
      compute: 'lambda',
      auth0: {
        domain: 'tenant.auth0.com',
        clientId: 'spa-client-id',
        audience: 'https://reference-architecture-auth0.603.nz/api',
      },
    };
    mockFetchRuntimeConfig.mockResolvedValue(cfg);
    mockUseAuth0.mockReturnValue(signedOutAuth0);
    visit('reference-architecture-auth0.603.nz');

    render(<Root />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Log in with Auth0' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Send link' })).not.toBeInTheDocument();

    const readout = screen.getByRole('region', { name: 'This deployment' });
    expect(readout).toHaveTextContent('authAuth0');
    expect(readout).toHaveTextContent('computeLambda');
    expect(readout).toHaveTextContent('tenancyFixed');

    // The Lambda Auth0 deployment links to the two magic-link deployments.
    expect(screen.getByRole('link', { name: 'reference-architecture.603.nz' })).toHaveAttribute(
      'href',
      'https://reference-architecture.603.nz',
    );
    expect(screen.getByRole('link', { name: 'reference-architecture-lambda.603.nz' })).toHaveAttribute(
      'href',
      'https://reference-architecture-lambda.603.nz',
    );
  });

  it('says there is nothing to sign in to when AUTH_PROVIDER=none', async () => {
    mockFetchRuntimeConfig.mockResolvedValue({ authProvider: 'none', compute: 'local', auth0: null });

    render(<Root />);

    expect(await screen.findByText('There is no sign-in on this deployment')).toBeInTheDocument();
    expect(screen.getByText(/creates no authenticated principal/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    // The readout, the comparison and the request log are still there.
    const readout = screen.getByRole('region', { name: 'This deployment' });
    expect(readout).toHaveTextContent('authNone');
    expect(readout).toHaveTextContent('computeLocal');
    expect(readout).not.toHaveTextContent('tenancy');
    expect(screen.getByRole('table', { name: 'Deployments' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Request log' })).toHaveTextContent('/api/auth/session');
    expect(mockUseAuth0).not.toHaveBeenCalled();
  });

  it('falls back to the magic-link app and says so when the config request fails', async () => {
    mockFetchRuntimeConfig.mockRejectedValue(new Error('down'));

    render(<Root />);

    expect(await screen.findByRole('button', { name: 'Send link' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'This deployment' })).toHaveTextContent(
      'GET /api/config failed, so the page is assuming magic link sign-in.',
    );
  });

  it('names the missing setting when OIDC is on without Auth0 SPA settings', async () => {
    mockFetchRuntimeConfig.mockResolvedValue({ authProvider: 'oidc', compute: 'lambda', auth0: null });

    render(<Root />);

    expect(await screen.findByRole('alert')).toHaveTextContent('AUTH0_SPA_CLIENT_ID');
    expect(screen.queryByRole('button', { name: 'Log in with Auth0' })).not.toBeInTheDocument();
    expect(mockUseAuth0).not.toHaveBeenCalled();
  });

  it('shows what it is waiting for while the config loads', () => {
    mockFetchRuntimeConfig.mockReturnValue(new Promise(() => {}));

    render(<Root />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading the deployment config');
  });
});
