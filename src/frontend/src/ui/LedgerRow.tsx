import type { CSSProperties, ReactNode } from 'react';

/**
 * The page ledger. A row is a mono margin that holds the one fact the list
 * is about, a name and one line of text. `margin` and `name` set the two
 * fixed columns in pixels. Below 980px the name and the text share the
 * second column.
 */
export function Ledger({
  ordered = false,
  margin,
  name,
  className,
  children,
}: {
  ordered?: boolean;
  margin?: number;
  name?: number;
  className?: string;
  children: ReactNode;
}) {
  const List = ordered ? 'ol' : 'ul';
  const style = {
    ...(margin !== undefined && { '--ledger-margin': `${margin}px` }),
    ...(name !== undefined && { '--ledger-name': `${name}px` }),
  } as CSSProperties;

  return (
    <List className={['ledger', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </List>
  );
}

export function LedgerRow({
  margin,
  name,
  children,
}: {
  margin: ReactNode;
  name: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="ledger-row">
      <span className="ledger-margin">{margin}</span>
      <span className="ledger-name">{name}</span>
      <span className="ledger-text">{children}</span>
    </li>
  );
}
