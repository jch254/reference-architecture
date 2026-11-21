import type { CSSProperties, ReactNode } from 'react';

type JsonValue = unknown;

function scalar(value: JsonValue): string {
  return value === undefined ? 'undefined' : JSON.stringify(value);
}

/** One JSON value as lines: keys in ink, values in ink 2, punctuation in ink 3. */
function lines(value: JsonValue, depth: number, key: string | null, last: boolean, path: string): ReactNode[] {
  const style = { '--depth': depth } as CSSProperties;
  const name =
    key === null ? null : (
      <>
        {JSON.stringify(key)}
        <span className="json-mark">: </span>
      </>
    );
  const comma = last ? null : <span className="json-mark">,</span>;

  if (value !== null && typeof value === 'object') {
    const isArray = Array.isArray(value);
    const entries: [string | null, JsonValue][] = isArray
      ? (value as JsonValue[]).map((item) => [null, item])
      : Object.entries(value as Record<string, JsonValue>);
    const [open, close] = isArray ? ['[', ']'] : ['{', '}'];

    if (entries.length === 0) {
      return [
        <div className="json-line" style={style} key={path}>
          {name}
          <span className="json-mark">{open + close}</span>
          {comma}
        </div>,
      ];
    }

    return [
      <div className="json-line" style={style} key={`${path}<`}>
        {name}
        <span className="json-mark">{open}</span>
      </div>,
      ...entries.flatMap(([entryKey, entryValue], index) =>
        lines(entryValue, depth + 1, entryKey, index === entries.length - 1, `${path}.${entryKey ?? index}`),
      ),
      <div className="json-line" style={style} key={`${path}>`}>
        <span className="json-mark">{close}</span>
        {comma}
      </div>,
    ];
  }

  return [
    <div className="json-line" style={style} key={path}>
      {name}
      <span className="json-value">{scalar(value)}</span>
      {comma}
    </div>,
  ];
}

/** A JSON value, indented two characters a level, in three inks and no hue. */
export function Json({ value }: { value: unknown }) {
  return <div className="json">{lines(value, 0, null, true, '$')}</div>;
}

/** A block of mono on the --side fill: a body, a key. */
export function CodeBlock({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={['code-block', className].filter(Boolean).join(' ')}>{children}</div>;
}

/**
 * Keys and values as a definition list: the key in mono ink 3, the value in
 * mono ink. Rows with no value are left out.
 */
export function KeyValues({
  rows,
  keyWidth,
}: {
  rows: [key: string, value: ReactNode][];
  keyWidth?: number;
}) {
  const style = keyWidth === undefined ? undefined : ({ '--kv-key': `${keyWidth}px` } as CSSProperties);
  return (
    <dl className="kv" style={style}>
      {rows
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => (
          <div className="kv-row" key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}
