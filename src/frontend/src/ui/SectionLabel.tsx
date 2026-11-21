import type { ReactNode } from 'react';

/**
 * The label over a group: its name at 13px and, beside it, a count or a
 * source in mono. Anything passed as children sits at the far right.
 */
export function SectionLabel({
  label,
  count,
  level = 2,
  children,
}: {
  label: string;
  count?: ReactNode;
  level?: 2 | 3;
  children?: ReactNode;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className="section-head">
      <Heading className="section-label">
        {label}
        {count !== undefined && count !== '' && <span className="section-count">{count}</span>}
      </Heading>
      {children}
    </div>
  );
}

/** The green node. It means current and always sits beside a word. */
export function Node() {
  return <span className="node" aria-hidden="true" />;
}
