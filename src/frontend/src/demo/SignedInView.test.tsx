import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { RuntimeConfig } from '../../../shared/api-types';
import { setTokenProvider } from '../api/api-client';
import { USER, apiError, example, fakeApi, stubLocalStorage, visit } from '../test-support';

import { SignedInView } from './SignedInView';
import { clearRequestLog } from './request-log';

const CONFIG: RuntimeConfig = { authProvider: 'internal_magic_link', compute: 'ecs', auth0: null };

const RECORDS = [
  example('3f9a1c2e', 'Renamed after a typo', '2026-11-20T10:42:08.114Z'),
  example('b07d44f1', 'Created from the Fargate demo', '2026-11-20T10:38:51.630Z'),
  example('91c6e0aa', 'Delete me, then undo', '2026-11-20T10:35:12.402Z'),
];

function renderView(onUnauthorized = vi.fn()) {
  const onSignOut = vi.fn();
  render(
    <SignedInView
      config={CONFIG}
      account="ada@example.com"
      signOutLabel="Sign out"
      onSignOut={onSignOut}
      onUnauthorized={onUnauthorized}
    />,
  );
  return { onSignOut, onUnauthorized };
}

const row = (name: string) => screen.getByRole('button', { name });
const list = () => within(screen.getByRole('region', { name: 'Examples' })).getAllByRole('listitem');

describe('SignedInView', () => {
  beforeEach(() => {
    setTokenProvider(null);
    clearRequestLog();
    stubLocalStorage();
    visit('reference-architecture.603.nz');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lists the records newest first with their ids, and selects the newest', async () => {
    fakeApi({ records: [RECORDS[2], RECORDS[0], RECORDS[1]] });
    renderView();

    expect(screen.getByText('Loading your records')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Renamed after a typo' })).toHaveAttribute('aria-pressed', 'true');
    expect(list().map((item) => item.textContent)).toEqual([
      expect.stringContaining('3f9a1c2eRenamed after a typo'),
      expect.stringContaining('b07d44f1Created from the Fargate demo'),
      expect.stringContaining('91c6e0aaDelete me, then undo'),
    ]);
    expect(screen.getByText('3 records')).toBeInTheDocument();
    expect(row('Created from the Fargate demo')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the key of the selected record, built from /api/me and the record id', async () => {
    fakeApi({ records: RECORDS });
    renderView();

    const key = await screen.findByRole('region', { name: 'Where this record lives' });
    expect(key).toHaveTextContent('PKTENANT#reference-architecture');
    expect(key).toHaveTextContent(`SKUSER#${USER.userId}#EXAMPLE#3f9a1c2e`);
    // On a known host the tenant's source is the host, from deployments.ts.
    expect(key).toHaveTextContent('reference-architecture, read from the request host');

    fireEvent.click(row('Delete me, then undo'));
    expect(key).toHaveTextContent(`SKUSER#${USER.userId}#EXAMPLE#91c6e0aa`);

    // Deselecting leaves the prefix the list query matches.
    fireEvent.click(row('Delete me, then undo'));
    expect(screen.getByRole('region', { name: 'Where your records live' })).toHaveTextContent(
      `SKUSER#${USER.userId}#EXAMPLE#<exampleId>`,
    );
  });

  it('says what creating a record will do when there are none', async () => {
    fakeApi({ records: [] });
    renderView();

    expect(await screen.findByText(/No records yet/)).toHaveTextContent("this tenant's partition under your user id");
    expect(screen.getByText('no records')).toBeInTheDocument();
  });

  it('adds a record at once, then takes its id from the response and selects it', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { fetchMock, calls } = fakeApi({ records: RECORDS });
    const answer = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, init) => {
      if (url === '/api/example' && init?.method === 'POST') await gate;
      return answer(url, init);
    });
    renderView();
    await screen.findByRole('button', { name: 'Renamed after a typo' });

    fireEvent.change(screen.getByLabelText('Record name'), { target: { value: '  A new record ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // On the page before the API has answered, without an id.
    expect(screen.getByRole('button', { name: 'A new record' })).toBeDisabled();
    expect(list()[0]).toHaveTextContent('saving');
    expect(screen.getByLabelText('Record name')).toHaveValue('');

    await act(async () => release());

    await waitFor(() => expect(row('A new record')).toHaveAttribute('aria-pressed', 'true'));
    expect(list()[0]).toHaveTextContent('new00001');
    expect(JSON.parse(calls('POST', '/api/example')[0][1]!.body as string)).toEqual({ name: 'A new record' });
    // Reconciled from the response: the list is not fetched again.
    expect(calls('GET', '/api/example')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Where this record lives' })).toHaveTextContent('#EXAMPLE#new00001');
  });

  it('takes a refused record back out and returns the name to the field', async () => {
    fakeApi({
      records: RECORDS,
      override: (method, path) =>
        method === 'POST' && path === '/api/example' ? apiError(400, 'BAD_REQUEST', 'name is required') : undefined,
    });
    renderView();
    await screen.findByRole('button', { name: 'Renamed after a typo' });

    fireEvent.change(screen.getByLabelText('Record name'), { target: { value: 'Refused' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The record was not created. The API answered 400: name is required.',
    );
    expect(screen.queryByRole('button', { name: 'Refused' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Record name')).toHaveValue('Refused');
    expect(list()).toHaveLength(3);
  });

  it('saves a rename on Enter and returns focus to the row', async () => {
    const { calls } = fakeApi({ records: RECORDS });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Rename Created from the Fargate demo' }));
    const field = screen.getByLabelText('New name for Created from the Fargate demo');
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { value: 'Created on Fargate' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    // The new name shows before the PATCH is answered.
    expect(row('Created on Fargate')).toHaveFocus();
    await waitFor(() => expect(calls('PATCH', '/api/example/b07d44f1')).toHaveLength(1));
    expect(JSON.parse(calls('PATCH', '/api/example/b07d44f1')[0][1]!.body as string)).toEqual({
      name: 'Created on Fargate',
    });
    expect(calls('GET', '/api/example')).toHaveLength(1);
  });

  it('cancels a rename on Esc without a request and returns focus to the row', async () => {
    const { calls } = fakeApi({ records: RECORDS });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Rename Created from the Fargate demo' }));
    const field = screen.getByLabelText('New name for Created from the Fargate demo');
    fireEvent.change(field, { target: { value: 'Abandoned' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(row('Created from the Fargate demo')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Abandoned' })).not.toBeInTheDocument();
    expect(calls('PATCH', '/api/example/b07d44f1')).toHaveLength(0);
  });

  it('puts the old name back when a rename is refused', async () => {
    fakeApi({
      records: RECORDS,
      override: (method) => (method === 'PATCH' ? apiError(404, 'NOT_FOUND', 'Example not found') : undefined),
    });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Rename Created from the Fargate demo' }));
    const field = screen.getByLabelText('New name for Created from the Fargate demo');
    fireEvent.change(field, { target: { value: 'Will not stick' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The rename was not saved. The API answered 404: Example not found.',
    );
    expect(row('Created from the Fargate demo')).toBeInTheDocument();
  });

  it('moves the selection with the arrow keys', async () => {
    fakeApi({ records: RECORDS });
    renderView();

    const first = await screen.findByRole('button', { name: 'Renamed after a typo' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });

    const second = row('Created from the Fargate demo');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(first).toHaveAttribute('aria-pressed', 'false');

    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-pressed', 'true');
  });

  it('holds a delete, and undo puts the record back without a request', async () => {
    const { calls } = fakeApi({ records: RECORDS });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Renamed after a typo' }));

    // The row leaves at once. Focus and the selection move to its neighbour.
    expect(screen.queryByRole('button', { name: 'Renamed after a typo' })).not.toBeInTheDocument();
    expect(row('Created from the Fargate demo')).toHaveFocus();
    expect(row('Created from the Fargate demo')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2 records')).toBeInTheDocument();
    expect(calls('DELETE', '/api/example/3f9a1c2e')).toHaveLength(0);

    const toast = screen.getByText(/Deleted/).closest('.toast') as HTMLElement;
    fireEvent.click(within(toast).getByRole('button', { name: 'Undo' }));

    expect(row('Renamed after a typo')).toHaveFocus();
    expect(row('Renamed after a typo')).toHaveAttribute('aria-pressed', 'true');
    expect(list()).toHaveLength(3);
    expect(screen.queryByText(/Deleted/)).not.toBeInTheDocument();
    expect(calls('DELETE', '/api/example/3f9a1c2e')).toHaveLength(0);
  });

  it('sends the DELETE when the toast closes after five seconds', async () => {
    const { calls } = fakeApi({ records: RECORDS });
    renderView();
    const button = await screen.findByRole('button', { name: 'Delete Delete me, then undo' });

    vi.useFakeTimers();
    fireEvent.click(button);

    // The client resolves its token before it fetches, so each step is
    // followed through to the request.
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(calls('DELETE', '/api/example/91c6e0aa')).toHaveLength(0);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(calls('DELETE', '/api/example/91c6e0aa')).toHaveLength(1);
    expect(screen.queryByText(/Deleted/)).not.toBeInTheDocument();
  });

  it('sends a held DELETE with keepalive when the page is hidden', async () => {
    const { calls } = fakeApi({ records: RECORDS });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Delete me, then undo' }));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => expect(calls('DELETE', '/api/example/91c6e0aa')).toHaveLength(1));
    expect(calls('DELETE', '/api/example/91c6e0aa')[0][1]).toMatchObject({ method: 'DELETE', keepalive: true });
    expect(screen.queryByText(/Deleted/)).not.toBeInTheDocument();
  });

  it('sends a held DELETE before signing out', async () => {
    const { calls } = fakeApi({ records: RECORDS });
    const { onSignOut } = renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Delete me, then undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(calls('DELETE', '/api/example/91c6e0aa')).toHaveLength(1));
    expect(calls('DELETE', '/api/example/91c6e0aa')[0][1]).toMatchObject({ keepalive: true });
  });

  it('sends the first held DELETE when a second record is deleted', async () => {
    const { calls } = fakeApi({ records: RECORDS });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Delete me, then undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Created from the Fargate demo' }));

    await waitFor(() => expect(calls('DELETE', '/api/example/91c6e0aa')).toHaveLength(1));
    expect(calls('DELETE', '/api/example/b07d44f1')).toHaveLength(0);
    expect(screen.getByText(/Deleted/)).toHaveTextContent('Created from the Fargate demo');
  });

  it('undoes a held delete with Ctrl+Z', async () => {
    fakeApi({ records: RECORDS });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Delete me, then undo' }));
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });

    expect(row('Delete me, then undo')).toBeInTheDocument();
    expect(screen.queryByText(/Deleted/)).not.toBeInTheDocument();
  });

  it('puts a record back when the API refuses to delete it', async () => {
    fakeApi({
      records: RECORDS,
      override: (method) => (method === 'DELETE' ? apiError(500, 'INTERNAL_ERROR', 'Internal server error') : undefined),
    });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Delete me, then undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Created from the Fargate demo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The record was not deleted, so it is back in the list. The API answered 500: Internal server error.',
    );
    expect(row('Delete me, then undo')).toBeInTheDocument();
  });

  it('logs every request, opens the newest write and shows the tenant and owner it was made for', async () => {
    fakeApi({ records: RECORDS });
    renderView();
    await screen.findByRole('button', { name: 'Renamed after a typo' });
    const log = screen.getByRole('region', { name: 'Request log' });

    expect(within(log).getAllByRole('button', { name: /GET \/api\// }).map((entry) => entry.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('200GET/api/example'),
        expect.stringContaining('200GET/api/me'),
        expect.stringContaining('200GET/api/auth/check'),
      ]),
    );
    expect(within(log).queryByText('response body')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Record name'), { target: { value: 'Logged' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const write = await within(log).findByRole('button', { name: /201 POST \/api\/example/ });
    expect(write).toHaveAttribute('aria-expanded', 'true');
    expect(log).toHaveTextContent('tenantreference-architecture');
    expect(log).toHaveTextContent(`owner${USER.userId}`);
    expect(log).toHaveTextContent('request body{"name": "Logged"}');
    expect(log).toHaveTextContent('"id": "new00001"');

    fireEvent.click(within(log).getByRole('button', { name: 'Clear' }));
    expect(log).toHaveTextContent('Nothing yet.');
  });

  it('reports a list that did not load and tries again when asked', async () => {
    let fail = true;
    const { calls } = fakeApi({
      records: RECORDS,
      override: (method, path) =>
        fail && method === 'GET' && path === '/api/example'
          ? apiError(500, 'INTERNAL_ERROR', 'Internal server error')
          : undefined,
    });
    renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The list did not load. The API answered 500: Internal server error.',
    );

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Renamed after a typo' })).toBeInTheDocument();
    expect(calls('GET', '/api/example')).toHaveLength(2);
  });

  it('hands a 401 to the shell and says nothing itself', async () => {
    fakeApi({
      override: (_method, path) => (path === '/api/me' ? apiError(401, 'UNAUTHORIZED', 'Unauthorized') : undefined),
    });
    const { onUnauthorized } = renderView();

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
