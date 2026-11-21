import { CodeBlock } from '../ui/Code';
import { CopyButton } from '../ui/CopyButton';
import { SectionLabel } from '../ui/SectionLabel';

import { KEY, tenantSource } from './demo-copy';
import { findDeployment } from './deployments';
import { EXAMPLE_ID_PLACEHOLDER, exampleKey, exampleKeySegments, type KeySegment } from './keys';
import type { Example, LocalUser } from './types';

function Segments({ segments }: { segments: KeySegment[] }) {
  return (
    <span className="key-value">
      {segments.map((segment, index) => (
        <span
          key={index}
          className={segment.fixed || segment.text === EXAMPLE_ID_PLACEHOLDER ? 'key-fixed' : undefined}
        >
          {segment.text}
        </span>
      ))}
    </span>
  );
}

/**
 * Where a record lives in the table: its partition key and sort key, with
 * the fixed prefixes in ink 3 and the ids in ink, and a legend that says
 * where each id came from. With no record selected the sort key ends in a
 * placeholder, which leaves the prefix the list query matches.
 *
 * `inline` is the version that opens inside a row below 981px.
 */
export function KeyReadout({
  user,
  record,
  inline = false,
}: {
  user: LocalUser;
  record: Example | null;
  inline?: boolean;
}) {
  if (!user.tenantId) return null;

  const { PK, SK } = exampleKeySegments(user.tenantId, user.userId, record?.id);
  const tenancy = findDeployment()?.tenancy ?? null;

  const body = (
    <>
      <CodeBlock className="key-block">
        <div className="key-lines">
          <div className="key-line">
            <span className="key-fixed">PK</span>
            <Segments segments={PK} />
          </div>
          <div className="key-line">
            <span className="key-fixed">SK</span>
            <Segments segments={SK} />
          </div>
        </div>
        {record && (
          <CopyButton value={JSON.stringify(exampleKey(user.tenantId, user.userId, record.id))} label={KEY.copy} />
        )}
      </CodeBlock>

      <ul className="key-legend">
        <li>
          <span>tenant</span>
          <span>
            {user.tenantId}, {tenantSource(tenancy)}
          </span>
        </li>
        <li>
          <span>owner</span>
          <span>
            {KEY.owner} <code>/api/me</code>
          </span>
        </li>
        <li>
          <span>record</span>
          <span>{record ? `${record.id}, ${KEY.recordSelected}` : KEY.recordUnselected}</span>
        </li>
        {record && (
          // The list shows "2 min ago". This is the same moment exactly, where
          // the keyboard and a finger can reach it as well as a pointer.
          <li>
            <span>created</span>
            <span>
              <time dateTime={record.createdAt}>{record.createdAt}</time>
            </span>
          </li>
        )}
      </ul>

      <p className="small">
        Listing your records is one query on this partition with <code>begins_with</code> on the sort key. Nothing is
        scanned.
      </p>
    </>
  );

  if (inline) return <div className="key key-inline">{body}</div>;

  const label = record ? KEY.selected : KEY.unselected;
  return (
    <section className="key" aria-label={label}>
      <SectionLabel label={label} count={record?.id} />
      {body}
    </section>
  );
}
