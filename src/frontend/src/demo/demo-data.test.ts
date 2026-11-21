import { describe, it, expect } from 'vitest';

import { difference, recordCount, tenantSource } from './demo-copy';
import { DEPLOYMENTS, findDeployment } from './deployments';
import { relativeTime } from './relative-time';

const [fargate, auth0, lambda] = DEPLOYMENTS;

describe('deployments', () => {
  it('lists the three public deployments with their tenant modes', () => {
    expect(DEPLOYMENTS.map(({ host, authProvider, compute, tenancy }) => [host, authProvider, compute, tenancy])).toEqual([
      ['reference-architecture.603.nz', 'internal_magic_link', 'ecs', 'subdomain'],
      ['reference-architecture-auth0.603.nz', 'oidc', 'lambda', 'fixed'],
      ['reference-architecture-lambda.603.nz', 'internal_magic_link', 'lambda', 'subdomain'],
    ]);
  });

  it('finds a deployment by its host and nothing anywhere else', () => {
    expect(findDeployment('reference-architecture-auth0.603.nz')).toBe(auth0);
    expect(findDeployment('localhost')).toBeNull();
    expect(findDeployment('other.603.nz')).toBeNull();
  });
});

describe('difference', () => {
  it('names the one thing that differs', () => {
    expect(difference(lambda, fargate)).toBe('The same settings, with the app on Lambda.');
    expect(difference(fargate, lambda)).toBe('The same settings, with the app on ECS Fargate.');
  });

  it('joins two or three differences without an Oxford comma', () => {
    expect(difference(auth0, lambda)).toBe('Sign-in moves to Auth0 and every request resolves to one tenant.');
    expect(difference(auth0, fargate)).toBe(
      'Sign-in moves to Auth0, the app runs on Lambda and every request resolves to one tenant.',
    );
    expect(difference(fargate, auth0)).toBe(
      'Sign-in moves to a magic link, the app runs on ECS Fargate and the tenant is read from the host.',
    );
  });
});

describe('copy helpers', () => {
  it('counts records in words a person would use', () => {
    expect(recordCount(0)).toBe('no records');
    expect(recordCount(1)).toBe('1 record');
    expect(recordCount(3)).toBe('3 records');
  });

  it('says where the tenant id came from', () => {
    expect(tenantSource('subdomain')).toBe('read from the request host');
    expect(tenantSource('fixed')).toBe('the fixed id this deployment sets');
    expect(tenantSource(null)).toBe('resolved by the API');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-11-21T10:44:00.000Z');

  it('rounds down to the largest whole unit', () => {
    expect(relativeTime('2026-11-21T10:43:30.000Z', now)).toBe('just now');
    expect(relativeTime('2026-11-21T10:42:08.114Z', now)).toBe('1 min ago');
    expect(relativeTime('2026-11-21T10:35:12.402Z', now)).toBe('8 min ago');
    expect(relativeTime('2026-11-21T07:44:00.000Z', now)).toBe('3 h ago');
    expect(relativeTime('2026-11-16T10:44:00.000Z', now)).toBe('5 d ago');
  });

  it('gives the date once a record is a month old', () => {
    expect(relativeTime('2026-08-26T09:00:00.000Z', now)).toBe('26 Aug 2026');
  });

  it('never reports a time in the future', () => {
    expect(relativeTime('2026-11-21T10:44:05.000Z', now)).toBe('just now');
  });
});
