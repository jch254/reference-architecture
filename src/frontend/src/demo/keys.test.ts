import { describe, it, expect } from 'vitest';

import { Keys } from '../../../backend/common/dynamodb/entity.types';

import { exampleKey, exampleKeyPrefix, exampleKeySegments } from './keys';

const TENANT = 'reference-architecture';
const USER = '6f1c2a9e-4b7d-4e2a-9c31-0d5e8a7b2f14';
const EXAMPLE = '3f9a1c2e';

describe('exampleKey', () => {
  it('pins the pattern the README and docs/architecture.md give', () => {
    expect(exampleKey(TENANT, USER, EXAMPLE)).toEqual({
      PK: 'TENANT#reference-architecture',
      SK: 'USER#6f1c2a9e-4b7d-4e2a-9c31-0d5e8a7b2f14#EXAMPLE#3f9a1c2e',
    });
  });

  it('matches the key the backend builds', () => {
    expect(exampleKey(TENANT, USER, EXAMPLE)).toEqual(Keys.userExample(TENANT, USER, EXAMPLE));
    expect(exampleKey('refarch-auth0-demo', 'u-1', 'abcd1234')).toEqual(
      Keys.userExample('refarch-auth0-demo', 'u-1', 'abcd1234'),
    );
  });

  it('marks the fixed prefixes apart from the ids', () => {
    const { PK, SK } = exampleKeySegments(TENANT, USER, EXAMPLE);
    expect(PK.filter((segment) => segment.fixed).map((segment) => segment.text)).toEqual(['TENANT#']);
    expect(SK.filter((segment) => segment.fixed).map((segment) => segment.text)).toEqual(['USER#', '#EXAMPLE#']);
    expect(SK.filter((segment) => !segment.fixed).map((segment) => segment.text)).toEqual([USER, EXAMPLE]);
  });

  it('gives the prefix the list query uses, which every key of that user starts with', () => {
    expect(exampleKeyPrefix(USER)).toBe(`USER#${USER}#EXAMPLE#`);
    expect(exampleKey(TENANT, USER, EXAMPLE).SK.startsWith(exampleKeyPrefix(USER))).toBe(true);
  });
});
