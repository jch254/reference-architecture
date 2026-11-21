import { useEffect, useRef, useState } from 'react';

import { Button } from '../ui/Button';
import { CodeBlock, Json } from '../ui/Code';
import { CopyButton } from '../ui/CopyButton';
import { Icon } from '../ui/Icon';
import { SectionLabel } from '../ui/SectionLabel';

import { clearRequestLog, useRequestLog, type LogEntry } from './request-log';

function statusText(entry: LogEntry): string {
  return entry.status === null ? 'ERR' : String(entry.status);
}

function failed(entry: LogEntry): boolean {
  return entry.status === null || entry.status >= 400;
}

function Detail({ entry }: { entry: LogEntry }) {
  const authorization = Object.entries(entry.requestHeaders).find(
    ([name]) => name.toLowerCase() === 'authorization',
  )?.[1];

  return (
    <CodeBlock className="log-detail">
      <dl className="log-meta">
        {entry.requestId && (
          <div>
            <dt>x-request-id</dt>
            <dd className="with-copy">
              <span>{entry.requestId}</span>
              <CopyButton value={entry.requestId} label="Copy the request id" inline />
            </dd>
          </div>
        )}
        {authorization && (
          <div>
            <dt>authorization</dt>
            <dd>{authorization}</dd>
          </div>
        )}
        {entry.scope && (
          <>
            <div>
              <dt>tenant</dt>
              <dd>{entry.scope.tenant}</dd>
            </div>
            <div>
              <dt>owner</dt>
              <dd>{entry.scope.owner}</dd>
            </div>
          </>
        )}
      </dl>
      {entry.requestBody !== undefined && (
        <div>
          <div className="log-part">request body</div>
          <Json value={entry.requestBody} />
        </div>
      )}
      <div>
        <div className="log-part">response body</div>
        {entry.responseBody !== undefined ? (
          // Focusable, so a body long enough to scroll can be scrolled from the keyboard.
          <div className="log-body" tabIndex={0} role="group" aria-label="Response body">
            <Json value={entry.responseBody} />
          </div>
        ) : (
          <div className="log-part">{entry.status === null ? 'no answer' : 'none'}</div>
        )}
      </div>
    </CodeBlock>
  );
}

/**
 * Every request the page has made, newest first. A row opens to show the
 * request id, the bodies and, for a record, the tenant and owner the API
 * acted for. The newest write opens by itself, so what you just did is
 * answered beside it. `openFirst` names a path to open when the log first
 * shows, before anything has been written.
 */
export function RequestLog({ openFirst, clearable = false }: { openFirst?: string; clearable?: boolean }) {
  const entries = useRequestLog();
  const [open, setOpen] = useState<number | null>(
    () => (openFirst && entries.find((entry) => entry.path === openFirst)?.id) || null,
  );
  const newest = entries[0]?.id ?? 0;
  const seen = useRef(newest);
  const touched = useRef(open !== null);

  useEffect(() => {
    if (newest <= seen.current) return;
    const arrived = entries.filter((entry) => entry.id > seen.current);
    seen.current = newest;

    const write = arrived.find((entry) => entry.method !== 'GET');
    if (write) {
      touched.current = true;
      setOpen(write.id);
      return;
    }
    const first = !touched.current && openFirst && arrived.find((entry) => entry.path === openFirst);
    if (first) {
      touched.current = true;
      setOpen(first.id);
    }
  }, [entries, newest, openFirst]);

  const toggle = (id: number) => {
    touched.current = true;
    setOpen((current) => (current === id ? null : id));
  };

  return (
    <section className="log" aria-label="Request log">
      <SectionLabel label="Request log" count={entries.length}>
        {clearable && entries.length > 0 && (
          <Button variant="ghost" className="log-clear" onClick={clearRequestLog}>
            Clear
          </Button>
        )}
      </SectionLabel>

      {entries.length === 0 ? (
        <p className="small log-empty">Nothing yet. Each request the page makes is listed here as it is answered.</p>
      ) : (
        <ul className="rows">
          {entries.map((entry) => {
            const isOpen = open === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`row row-hover log-row${isOpen ? ' log-row-open' : ''}`}
                  aria-expanded={isOpen}
                  onClick={() => toggle(entry.id)}
                >
                  <span className={`log-status${failed(entry) ? ' log-status-failed' : ''}`}>
                    {statusText(entry)}
                  </span>
                  <span className="log-method">{entry.method}</span>
                  <span className="log-path">{entry.path}</span>
                  <span className="log-time">{entry.durationMs} ms</span>
                  <span className="log-chevron">
                    <Icon name={isOpen ? 'up' : 'down'} size={14} />
                  </span>
                </button>
                {isOpen && <Detail entry={entry} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
