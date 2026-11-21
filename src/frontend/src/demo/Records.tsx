import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { IconButton } from '../ui/Button';
import { QuickAdd } from '../ui/Field';

import { RECORDS, recordCount } from './demo-copy';
import { relativeTime } from './relative-time';
import { QUICK_ADD, type RecordRow } from './types';

/** The time now, refreshed often enough to keep "2 min ago" honest. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

interface RecordsProps {
  /** null while GET /api/example is out. */
  records: RecordRow[] | null;
  selectedId: string | null;
  /** True at 981px and wider, where a row is one line and the key sits beside the list. */
  wide: boolean;
  error: string | null;
  /** The row to move keyboard focus to on the next render: a record id, or QUICK_ADD. */
  focus: string | null;
  onFocus: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<string | null>;
  onRename: (record: RecordRow, name: string) => void;
  onDelete: (record: RecordRow) => void;
  /** Below 981px the selected record's key opens inside its row. */
  renderKey?: (record: RecordRow) => ReactNode;
}

/**
 * The examples: a title with its count, quick add and the list. A row's mono
 * margin holds the record id, because the id is the last segment of its sort
 * key. Selecting a row shows its key. Enter saves a rename, Esc cancels it
 * and the arrow keys move the selection.
 */
export function Records({
  records,
  selectedId,
  wide,
  error,
  focus,
  onFocus,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  renderKey,
}: RecordsProps) {
  const now = useNow();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const names = useRef(new Map<string, HTMLButtonElement>());
  const input = useRef<HTMLInputElement>(null);

  // Move focus once the row it is meant for is on the page.
  useEffect(() => {
    if (!focus) return;
    const target = focus === QUICK_ADD ? input.current : names.current.get(focus);
    if (!target) return;
    target.focus();
    onFocus(null);
  }, [focus, onFocus, records, editing]);

  const add = async () => {
    const value = name.trim();
    if (!value) return;
    setName('');
    const id = await onCreate(value);
    // The API refused it. Give the name back unless something new was typed.
    if (!id) setName((current) => current || value);
  };

  const save = (record: RecordRow) => {
    const value = editing?.name.trim();
    if (!value) return;
    setEditing(null);
    onFocus(record.id);
    if (value !== record.name) onRename(record, value);
  };

  const cancel = (record: RecordRow) => {
    setEditing(null);
    onFocus(record.id);
  };

  const remove = (record: RecordRow) => {
    const rows = records ?? [];
    const index = rows.findIndex((row) => row.id === record.id);
    const neighbour = rows[index + 1] ?? rows[index - 1] ?? null;
    onDelete(record);
    // Focus was on a button that has just left the page. It goes to the row
    // that took its place, and the selection goes with it.
    onFocus(neighbour ? neighbour.id : QUICK_ADD);
    if (record.id === selectedId) onSelect(neighbour && !neighbour.pending ? neighbour.id : null);
  };

  const onRowKey = (event: KeyboardEvent, record: RecordRow) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rows = (records ?? []).filter((row) => !row.pending);
    const index = rows.findIndex((row) => row.id === record.id);
    const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    onSelect(next.id);
    names.current.get(next.id)?.focus();
  };

  const nameRef = (id: string) => (element: HTMLButtonElement | null) => {
    if (element) names.current.set(id, element);
    else names.current.delete(id);
  };

  const editField = (record: RecordRow) => (
    <input
      className="field record-edit"
      aria-label={`New name for ${record.name}`}
      value={editing?.name ?? ''}
      autoFocus
      onFocus={(event) => event.target.select()}
      onChange={(event) => setEditing({ id: record.id, name: event.target.value })}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        // Focus moves to the row's button while the key is still down. Without
        // this the same press would go on to click it and change the selection.
        event.preventDefault();
        if (event.key === 'Enter') save(record);
        else cancel(record);
      }}
    />
  );

  const actions = (record: RecordRow) => {
    if (record.pending) return null;
    if (editing?.id === record.id) {
      return (
        <>
          <IconButton icon="check" label="Save the new name" onClick={() => save(record)} />
          <IconButton icon="close" label="Cancel the rename" onClick={() => cancel(record)} />
        </>
      );
    }
    return (
      <>
        <IconButton
          icon="edit"
          label={`Rename ${record.name}`}
          onClick={() => setEditing({ id: record.id, name: record.name })}
        />
        <IconButton icon="close" label={`Delete ${record.name}`} onClick={() => remove(record)} />
      </>
    );
  };

  const rowClass = (record: RecordRow, selected: boolean) =>
    [
      'row row-wide row-hover record',
      selected && 'row-current',
      record.pending && 'record-pending',
      editing?.id === record.id && 'record-editing',
    ]
      .filter(Boolean)
      .join(' ');

  const time = (record: RecordRow) => (
    <time className="record-time tip" dateTime={record.createdAt} data-tip={record.createdAt}>
      {relativeTime(record.createdAt, now)}
    </time>
  );

  const wideRow = (record: RecordRow) => {
    const selected = record.id === selectedId;
    return (
      <li key={record.id} className={rowClass(record, selected)}>
        <span className="record-id">{record.pending ? RECORDS.pending : record.id}</span>
        {editing?.id === record.id ? (
          editField(record)
        ) : (
          <button
            type="button"
            ref={nameRef(record.id)}
            className="record-name"
            aria-pressed={selected}
            disabled={record.pending}
            onClick={() => onSelect(selected ? null : record.id)}
            onKeyDown={(event) => onRowKey(event, record)}
          >
            {record.name}
          </button>
        )}
        {time(record)}
        <span className="record-actions">{actions(record)}</span>
      </li>
    );
  };

  const narrowRow = (record: RecordRow) => {
    const selected = record.id === selectedId;
    return (
      <li key={record.id} className={rowClass(record, selected)}>
        <div className="record-main">
          {editing?.id === record.id ? (
            editField(record)
          ) : (
            <button
              type="button"
              ref={nameRef(record.id)}
              className="record-name"
              aria-expanded={selected}
              disabled={record.pending}
              onClick={() => onSelect(selected ? null : record.id)}
              onKeyDown={(event) => onRowKey(event, record)}
            >
              <span className="record-title">{record.name}</span>
              <span className="record-sub">
                <span>{record.pending ? RECORDS.pending : record.id}</span>
                {time(record)}
              </span>
            </button>
          )}
          <span className="record-actions">{actions(record)}</span>
        </div>
        {selected && renderKey?.(record)}
      </li>
    );
  };

  return (
    <section className={`records ${wide ? 'records-wide' : 'records-narrow'}`} aria-label={RECORDS.title}>
      <div className="records-head">
        <div className="records-title">
          <h1 className="view-title">{RECORDS.title}</h1>
          {records && <span className="records-count">{recordCount(records.length)}</span>}
        </div>
        <p className="text">{RECORDS.intro}</p>
      </div>

      <QuickAdd
        id="record-name"
        inputRef={input}
        label={RECORDS.inputLabel}
        placeholder={RECORDS.placeholder}
        hint={RECORDS.request}
        submitLabel={RECORDS.add}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onSubmit={add}
        error={error}
      />

      {records === null ? (
        <p className="records-note" role="status">
          {RECORDS.loading}
        </p>
      ) : records.length === 0 ? (
        <p className="text records-empty">{RECORDS.empty}</p>
      ) : (
        <ul className="rows">{records.map(wide ? wideRow : narrowRow)}</ul>
      )}

      {wide && records !== null && records.length > 0 && (
        <p className="records-keys">
          <span>
            <kbd>Enter</kbd> saves a rename
          </span>
          <span>
            <kbd>Esc</kbd> cancels it
          </span>
          <span>
            <kbd>Up</kbd> <kbd>Down</kbd> move the selection
          </span>
        </p>
      )}
    </section>
  );
}
