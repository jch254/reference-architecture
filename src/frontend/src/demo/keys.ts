/**
 * The DynamoDB key of an example record, as the backend builds it in
 * Keys.userExample (src/backend/common/dynamodb/entity.types.ts). The page
 * never reads the table. It shows the key the API will have used, worked out
 * from tenantId and userId in GET /api/me and the record's id.
 *
 * keys.test.ts compares this with the backend function, so the two cannot
 * drift apart unnoticed.
 */

export interface KeySegment {
  text: string;
  /** A fixed prefix such as TENANT#, as opposed to an id. */
  fixed: boolean;
}

export const EXAMPLE_ID_PLACEHOLDER = '<exampleId>';

/** The partition and sort key as segments, so a readout can set the prefixes apart from the ids. */
export function exampleKeySegments(
  tenantId: string,
  userId: string,
  exampleId: string = EXAMPLE_ID_PLACEHOLDER,
): { PK: KeySegment[]; SK: KeySegment[] } {
  return {
    PK: [
      { text: 'TENANT#', fixed: true },
      { text: tenantId, fixed: false },
    ],
    SK: [
      { text: 'USER#', fixed: true },
      { text: userId, fixed: false },
      { text: '#EXAMPLE#', fixed: true },
      { text: exampleId, fixed: false },
    ],
  };
}

const join = (segments: KeySegment[]) => segments.map((segment) => segment.text).join('');

/** The partition and sort key as the two strings stored in the table. */
export function exampleKey(tenantId: string, userId: string, exampleId: string): { PK: string; SK: string } {
  const { PK, SK } = exampleKeySegments(tenantId, userId, exampleId);
  return { PK: join(PK), SK: join(SK) };
}

/** What the list query matches the sort key against with begins_with. */
export function exampleKeyPrefix(userId: string): string {
  return `USER#${userId}#EXAMPLE#`;
}
