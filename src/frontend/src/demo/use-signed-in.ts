import { useCallback, useEffect, useRef, useState } from 'react';

import { api, ApiError } from '../api/api-client';

import { setRequestLogScope } from './request-log';
import type { Example, LocalUser, Principal, RecordRow } from './types';

/** How long a delete is held so it can be undone. */
export const UNDO_MS = 5000;

const byNewest = (a: Example, b: Example) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

function isExample(value: unknown): value is Example {
  return typeof value === 'object' && value !== null && typeof (value as Example).id === 'string';
}

/** What the API did, in a sentence, for the end of an error message. */
function reason(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === undefined) return 'The request did not reach the API.';
    return `The API answered ${err.status}: ${err.message.replace(/\.$/, '')}.`;
  }
  return 'The page hit an error of its own.';
}

/**
 * Everything the signed-in view reads and writes: the provider principal,
 * the local user and the example records. It is the same for every auth
 * provider. What to do when the API answers 401 is not, so each shell
 * passes that in.
 *
 * Writes are optimistic. The list changes at once and is reconciled from
 * each response. A failed write is put back and reported in `error`.
 *
 * A delete is held in the browser for UNDO_MS so it can be undone. The
 * DELETE is sent when `commitDelete` is called (the toast closing), when
 * the page is hidden and when the view unmounts. A record deleted in the
 * moment before a tab is killed may survive.
 */
export function useSignedIn(onUnauthorized: () => void) {
  // undefined is loading, null is no answer.
  const [principal, setPrincipal] = useState<Principal | null | undefined>(undefined);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState<RecordRow | null>(null);

  const heldRef = useRef<RecordRow | null>(null);
  const unauthorized = useRef(onUnauthorized);
  const alive = useRef(true);
  const started = useRef(false);
  const counter = useRef(0);

  useEffect(() => {
    unauthorized.current = onUnauthorized;
  }, [onUnauthorized]);

  const fail = useCallback((err: unknown, what: string, report: (message: string) => void = setError) => {
    if (!alive.current) return;
    if (err instanceof ApiError && err.status === 401) {
      unauthorized.current();
      return;
    }
    report(`${what} ${reason(err)}`);
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const list = await api.get<Example[]>('/api/example');
      setRecords(Array.isArray(list) ? list.filter(isExample).sort(byNewest) : []);
    } catch (err) {
      fail(err, 'The list did not load.', setLoadError);
    }
  }, [fail]);

  /** GET /api/me creates or returns the local user, so it goes before the list. */
  const load = useCallback(async () => {
    setLoadError(null);

    api
      .get<{ principal?: Principal }>('/api/auth/check')
      .then((check) => setPrincipal(check?.principal ?? null))
      // A 401 here is also a 401 on /api/me below, which is where it is handled.
      .catch(() => setPrincipal(null));

    let me: LocalUser;
    try {
      ({ user: me } = await api.get<{ user: LocalUser }>('/api/me'));
    } catch (err) {
      fail(err, 'Your account did not load.', setLoadError);
      return;
    }
    setUser(me);
    setRequestLogScope(me.tenantId ? { tenant: me.tenantId, owner: me.userId } : null);

    await loadRecords();
  }, [fail, loadRecords]);

  useEffect(() => {
    alive.current = true;
    // Once per sign-in, so React's development double mount does not ask twice.
    if (!started.current) {
      started.current = true;
      void load();
    }
    return () => {
      alive.current = false;
    };
  }, [load]);

  /** Returns the new record's id, or null if the API refused it. */
  const create = useCallback(
    async (name: string): Promise<string | null> => {
      const tempId = `pending-${++counter.current}`;
      const now = new Date().toISOString();
      setError(null);
      setRecords((rows) => [{ id: tempId, name, createdAt: now, updatedAt: now, pending: true }, ...(rows ?? [])]);

      try {
        const created = await api.post<Example>('/api/example', { name });
        if (!isExample(created)) {
          await loadRecords();
          return null;
        }
        setRecords((rows) => (rows ?? []).map((row) => (row.id === tempId ? created : row)).sort(byNewest));
        return created.id;
      } catch (err) {
        setRecords((rows) => (rows ?? []).filter((row) => row.id !== tempId));
        fail(err, 'The record was not created.');
        return null;
      }
    },
    [fail, loadRecords],
  );

  const rename = useCallback(
    async (record: RecordRow, name: string) => {
      const set = (next: Partial<Example>) =>
        setRecords((rows) => rows && rows.map((row) => (row.id === record.id ? { ...row, ...next } : row)));

      setError(null);
      set({ name });
      try {
        const updated = await api.patch<Example>(`/api/example/${record.id}`, { name });
        if (isExample(updated)) set(updated);
      } catch (err) {
        set({ name: record.name });
        fail(err, 'The rename was not saved.');
      }
    },
    [fail],
  );

  /** Send the held DELETE, if there is one. */
  const commitDelete = useCallback(
    (options: { keepalive?: boolean } = {}) => {
      const record = heldRef.current;
      if (!record) return;
      heldRef.current = null;
      setHeld(null);

      api.delete(`/api/example/${record.id}`, options).catch((err) => {
        // Already gone is the result that was asked for.
        if (err instanceof ApiError && err.status === 404) return;
        setRecords((rows) => rows && [...rows, record].sort(byNewest));
        fail(err, 'The record was not deleted, so it is back in the list.');
      });
    },
    [fail],
  );

  /** Take a record out of the list and hold its DELETE. One is held at a time. */
  const remove = useCallback(
    (record: RecordRow) => {
      commitDelete();
      setError(null);
      setRecords((rows) => rows && rows.filter((row) => row.id !== record.id));
      heldRef.current = record;
      setHeld(record);
    },
    [commitDelete],
  );

  /** Put the held record back. Nothing was sent, so nothing needs undoing. */
  const undoDelete = useCallback((): RecordRow | null => {
    const record = heldRef.current;
    if (!record) return null;
    heldRef.current = null;
    setHeld(null);
    setRecords((rows) => rows && [...rows, record].sort(byNewest));
    return record;
  }, []);

  // A held delete must not be lost when the page goes away. keepalive lets
  // the request finish after the page has.
  useEffect(() => {
    const flush = () => commitDelete({ keepalive: true });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
      setRequestLogScope(null);
    };
  }, [commitDelete]);

  return {
    principal,
    user,
    records,
    loadError,
    error,
    held,
    reload: load,
    create,
    rename,
    remove,
    undoDelete,
    commitDelete,
  };
}
