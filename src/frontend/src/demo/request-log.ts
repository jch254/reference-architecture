import { useSyncExternalStore } from 'react';

import { observeApi, REDACTED_AUTHORIZATION, type ApiExchange } from '../api/api-client';

/**
 * The request log: every call the page makes through the API client, newest
 * first. It lives in memory only, is capped at MAX_ENTRIES and is gone on
 * reload. Nothing is written to storage or to the console.
 */

/** Who the API was acting for when a record request was made. */
export interface LogScope {
  tenant: string;
  owner: string;
}

export interface LogEntry extends ApiExchange {
  id: number;
  /** Set on requests for a record, which the API scopes to a tenant and a user. */
  scope: LogScope | null;
}

export const MAX_ENTRIES = 50;

const REDACTED = '[redacted]';
const SECRET_KEY = /token|secret|password|authorization|cookie/i;

let entries: LogEntry[] = [];
let nextId = 1;
let scope: LogScope | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * A copy of a body with anything that could be a credential replaced. The
 * page calls no endpoint that returns one today. This keeps that true of the
 * log if an app built on this repo adds one.
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        SECRET_KEY.test(key) && inner !== null && inner !== undefined ? REDACTED : redact(inner),
      ]),
    );
  }
  return value;
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      name.toLowerCase() === 'authorization' ? REDACTED_AUTHORIZATION : value,
    ]),
  );
}

/**
 * Store one exchange. The Authorization header is replaced with
 * "Bearer [redacted]" before the entry exists, whatever the observer was
 * handed, so an access token can never be read back out of the log.
 */
export function recordExchange(exchange: ApiExchange): void {
  const entry: LogEntry = {
    ...exchange,
    id: nextId++,
    requestHeaders: redactHeaders(exchange.requestHeaders),
    ...(exchange.requestBody !== undefined && { requestBody: redact(exchange.requestBody) }),
    ...(exchange.responseBody !== undefined && { responseBody: redact(exchange.responseBody) }),
    scope: scope && exchange.path.startsWith('/api/example') ? scope : null,
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  emit();
}

/** Say who record requests are being made for, once /api/me has answered. */
export function setRequestLogScope(next: LogScope | null): void {
  scope = next;
}

export function clearRequestLog(): void {
  entries = [];
  emit();
}

export function getRequestLog(): LogEntry[] {
  return entries;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The log as React state. */
export function useRequestLog(): LogEntry[] {
  return useSyncExternalStore(subscribe, getRequestLog);
}

// The demo registers itself with the API client's observer. The client knows
// nothing about the log.
observeApi(recordExchange);
