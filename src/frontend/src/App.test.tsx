import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { RuntimeConfig } from '../../shared/api-types';

import { App } from './App';
import { setTokenProvider } from './api/api-client';
import { clearRequestLog } from './demo/request-log';
import { apiError, fakeApi, stubLocalStorage, visit } from './test-support';

const CONFIG: RuntimeConfig = { authProvider: 'internal_magic_link', compute: 'ecs', auth0: null };
const SESSION = { email: 'jordan@example.com', tenantSlug: 'demo' };
const USER = {
  userId: 'user-123',
  tenantId: 'demo',
  provider: 'internal_magic_link',
  providerSubject: 'jordan@example.com',
  email: 'jordan@example.com',
};

describe('App magic-link auth', () => {
  beforeEach(() => {
    setTokenProvider(null);
    clearRequestLog();
    stubLocalStorage();
    visit('localhost');
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows the signed-in email, auth provider and local user id', async () => {
    const { fetchMock } = fakeApi({ session: SESSION, user: USER });

    render(<App config={CONFIG} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.anything()));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/check', expect.anything());

    // The account bar names who is signed in and how to leave.
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByText('jordan@example.com', { selector: '.account-user span' })).toBeInTheDocument();

    // The identity readout holds what the old auth bar ran together.
    const identity = screen.getByRole('region', { name: 'Identity' });
    await waitFor(() => expect(identity).toHaveTextContent('userIduser-123'));
    expect(identity).toHaveTextContent('providerinternal_magic_link');
    expect(identity).toHaveTextContent('tenantIddemo');
  });

  it('asks the API for a link and says to check the email it was sent to', async () => {
    const { calls } = fakeApi();
    render(<App config={CONFIG} />);

    fireEvent.change(await screen.findByLabelText('Sign in with a magic link'), {
      target: { value: ' ada@example.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Check your email.' })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText(/expires after 15 minutes/)).toBeInTheDocument();

    const [[, init]] = calls('POST', '/api/auth/request-link');
    expect(JSON.parse(init!.body as string)).toEqual({ email: 'ada@example.com' });

    // The way back to the form.
    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByRole('button', { name: 'Send link' })).toBeInTheDocument();
  });

  it('says to wait when the rate limiter answers 429', async () => {
    fakeApi({
      override: (_method, path) =>
        path === '/api/auth/request-link' ? apiError(429, 'RATE_LIMITED', 'Too Many Requests') : undefined,
    });
    render(<App config={CONFIG} />);

    fireEvent.change(await screen.findByLabelText('Sign in with a magic link'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests for a link. Wait a minute and try again.',
    );
    expect(screen.getByRole('button', { name: 'Send link' })).toBeEnabled();
  });

  it('gives one message for a link that was used or has expired, and keeps the form', async () => {
    visit('localhost', '/?auth=error&reason=consumed');
    const { calls } = fakeApi();

    render(<App config={CONFIG} />);

    expect(screen.getByRole('heading', { level: 1, name: 'That link did not sign you in.' })).toBeInTheDocument();
    expect(screen.getByText(/has already been used or has expired/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send link' })).toBeInTheDocument();
    // As before, a failed link does not go on to check for a session.
    expect(calls('GET', '/api/auth/session')).toHaveLength(0);
    expect(window.location.search).toBe('');
    await screen.findByText('Responding');
  });

  it('says the token was missing when a link error has no reason', async () => {
    visit('localhost', '/?auth=error');
    fakeApi();

    render(<App config={CONFIG} />);

    expect(screen.getByText(/missing its token/)).toBeInTheDocument();
    await screen.findByText('Responding');
  });

  it('signs out when the API answers 401, with no message, as before', async () => {
    const { calls } = fakeApi({
      session: SESSION,
      override: (_method, path) => (path === '/api/me' ? apiError(401, 'UNAUTHORIZED', 'Unauthorized') : undefined),
    });

    render(<App config={CONFIG} />);

    expect(await screen.findByRole('button', { name: 'Send link' })).toBeInTheDocument();
    expect(calls('POST', '/api/auth/logout')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('signs out through the API', async () => {
    const { calls } = fakeApi({ session: SESSION, user: USER });
    render(<App config={CONFIG} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Send link' })).toBeInTheDocument();
    expect(calls('POST', '/api/auth/logout')).toHaveLength(1);
  });
});
