import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { RuntimeConfig } from '../../../shared/api-types';
import { clearRequestLog } from '../demo/request-log';
import { apiError, fakeApi, stubLocalStorage, visit } from '../test-support';

import { OidcApp } from './OidcApp';

const { mockUseAuth0 } = vi.hoisted(() => ({ mockUseAuth0: vi.fn() }));
vi.mock('@auth0/auth0-react', () => ({ useAuth0: mockUseAuth0 }));

const CONFIG: RuntimeConfig = {
  authProvider: 'oidc',
  compute: 'lambda',
  auth0: { domain: 'tenant.auth0.com', clientId: 'spa-client-id', audience: 'https://example.test/api' },
};

const OIDC_USER = { userId: 'u-1', tenantId: 'refarch-auth0-demo', provider: 'oidc', providerSubject: 'auth0|abc' };
const OIDC_PRINCIPAL = { provider: 'oidc', subject: 'auth0|abc' };

const baseAuth0 = {
  isLoading: false,
  isAuthenticated: false,
  user: undefined,
  error: undefined,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
  getAccessTokenSilently: vi.fn().mockResolvedValue('access-token-xyz'),
};

const signedIn = { ...baseAuth0, isAuthenticated: true, user: { email: 'demo@example.com' } };

function authorization(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

describe('OidcApp', () => {
  beforeEach(() => {
    mockUseAuth0.mockReset();
    baseAuth0.loginWithRedirect.mockReset();
    baseAuth0.logout.mockReset();
    baseAuth0.getAccessTokenSilently.mockReset().mockResolvedValue('access-token-xyz');
    clearRequestLog();
    stubLocalStorage();
    visit('reference-architecture-auth0.603.nz');
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders a login button when unauthenticated', async () => {
    mockUseAuth0.mockReturnValue(baseAuth0);
    fakeApi();

    render(<OidcApp config={CONFIG} />);
    await screen.findByText('Responding');

    expect(screen.getByRole('link', { name: 'reference-architecture.603.nz' })).toHaveAttribute(
      'href',
      'https://reference-architecture.603.nz',
    );
    expect(screen.getByRole('link', { name: 'reference-architecture-lambda.603.nz' })).toHaveAttribute(
      'href',
      'https://reference-architecture-lambda.603.nz',
    );
    expect(screen.getByText(/maps you to a local user in this tenant/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log in with Auth0' }));
    expect(baseAuth0.loginWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('calls /api/me with a bearer token and shows local auth details when authenticated', async () => {
    mockUseAuth0.mockReturnValue(signedIn);
    const { calls } = fakeApi({ user: OIDC_USER, principal: OIDC_PRINCIPAL });

    render(<OidcApp config={CONFIG} />);

    await waitFor(() => expect(calls('GET', '/api/me')).toHaveLength(1));
    expect(authorization(calls('GET', '/api/me')[0][1])).toBe('Bearer access-token-xyz');
    expect(authorization(calls('GET', '/api/auth/check')[0][1])).toBe('Bearer access-token-xyz');

    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.getByText('demo@example.com')).toBeInTheDocument();

    const identity = screen.getByRole('region', { name: 'Identity' });
    await waitFor(() => expect(identity).toHaveTextContent('userIdu-1'));
    expect(identity).toHaveTextContent('provideroidc');
    expect(identity).toHaveTextContent('subjectauth0|abc');
  });

  it('shows each response in the request log and never the access token', async () => {
    mockUseAuth0.mockReturnValue(signedIn);
    fakeApi({ user: OIDC_USER, principal: OIDC_PRINCIPAL });

    render(<OidcApp config={CONFIG} />);

    const log = screen.getByRole('region', { name: 'Request log' });
    const row = await within(log).findByRole('button', { name: /GET \/api\/example/ });
    fireEvent.click(row);

    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(within(log).getByText('response body')).toBeInTheDocument();
    expect(within(log).getByRole('group', { name: 'Response body' })).toHaveTextContent('"data": []');
    // The header is listed so the bearer scheme can be seen, with the token replaced.
    expect(within(log).getByText('Bearer [redacted]')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('access-token-xyz');
  });

  it('sends a bearer token on example create (CRUD) in OIDC mode', async () => {
    mockUseAuth0.mockReturnValue(signedIn);
    const { calls } = fakeApi({ user: OIDC_USER, principal: OIDC_PRINCIPAL });

    render(<OidcApp config={CONFIG} />);

    await screen.findByRole('button', { name: 'Log out' });

    fireEvent.change(screen.getByPlaceholderText('Name a record'), {
      target: { value: 'My example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(calls('POST', '/api/example')).toHaveLength(1));
    expect(authorization(calls('POST', '/api/example')[0][1])).toBe('Bearer access-token-xyz');
    expect(await screen.findByRole('button', { name: 'My example' })).toBeInTheDocument();
  });

  it('logs out through Auth0 and back to this origin', async () => {
    mockUseAuth0.mockReturnValue(signedIn);
    fakeApi({ user: OIDC_USER, principal: OIDC_PRINCIPAL });

    render(<OidcApp config={CONFIG} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(baseAuth0.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } });
  });

  it('says the session is no longer valid on a 401 and does not retry', async () => {
    mockUseAuth0.mockReturnValue(signedIn);
    const { calls } = fakeApi({
      override: (_method, path) => (path === '/api/me' ? apiError(401, 'UNAUTHORIZED', 'Unauthorized') : undefined),
    });

    render(<OidcApp config={CONFIG} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your session is no longer valid. Log out and sign in again.',
    );
    expect(calls('GET', '/api/me')).toHaveLength(1);
    expect(calls('GET', '/api/example')).toHaveLength(0);
    // Auth0 still reports signed in, so the way out stays on the page.
    expect(screen.getAllByRole('button', { name: 'Log out' }).length).toBeGreaterThan(0);
    expect(baseAuth0.loginWithRedirect).not.toHaveBeenCalled();
  });

  it('shows the Auth0 error when a sign-in fails', async () => {
    mockUseAuth0.mockReturnValue({ ...baseAuth0, error: new Error('access_denied') });
    fakeApi();

    render(<OidcApp config={CONFIG} />);
    await screen.findByText('Responding');

    expect(screen.getByRole('alert')).toHaveTextContent('Auth0 did not complete the sign-in: access_denied');
  });

  it('shows a loading state while Auth0 initializes', () => {
    mockUseAuth0.mockReturnValue({ ...baseAuth0, isLoading: true });
    fakeApi();

    render(<OidcApp config={CONFIG} />);

    expect(screen.getByRole('status')).toHaveTextContent('Waiting for Auth0');
  });
});
