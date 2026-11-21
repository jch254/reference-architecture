import type { ReactNode } from 'react';

/**
 * The page ledger. A row is a mono margin that holds the one fact the list
 * is about, a name and one line of text. The two fixed columns are set with
 * --ledger-margin and --ledger-name on the list. Below 980px the name and the
 * text share the second column.
 */
export function Ledger({
  ordered = false,
  className,
  children,
}: {
  ordered?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const List = ordered ? 'ol' : 'ul';
  return <List className={['ledger', className].filter(Boolean).join(' ')}>{children}</List>;
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
