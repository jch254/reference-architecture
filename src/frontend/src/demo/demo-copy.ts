import type { RuntimeAuthProvider, RuntimeCompute, RuntimeConfig } from '../../../shared/api-types';

import { DEPLOYMENTS, findDeployment, type DeploymentSettings, type TenantMode } from './deployments';

/**
 * Every word on the demo page that is not read from the API. Each fact here
 * comes from the README, docs/architecture.md or the code it names.
 */

export const REPO = 'https://github.com/jch254/reference-architecture';

export const DOCS = {
  readme: `${REPO}#readme`,
  architecture: `${REPO}/blob/main/docs/architecture.md`,
  infrastructure: `${REPO}/blob/main/infrastructure/README.md`,
};

export const SITE_NAME = 'Reference Architecture';
export const OWNER = 'Jordan Hornblow';

/** config.authTokenExpiryMinutes in src/backend/common/config.ts. */
export const LINK_EXPIRY_MINUTES = 15;

export const HEADLINE = ['The baseline I copy', 'when I start', 'a product.'];

export const LEDE =
  'A NestJS API on one DynamoDB table, with a React frontend, built in Docker by CodeBuild and deployed with Terraform. Every record is partitioned by tenant and owned by a local user. The same app runs on ECS Fargate and on Lambda.';

interface Fact {
  /** The value, as the readout and the comparison name it. */
  name: string;
  /** The same value inside a line of mono. */
  short: string;
  /** The mono line under the value in the comparison. */
  sub: string;
  /** One sentence for the readout. */
  text: string;
}

export const AUTH: Record<RuntimeAuthProvider, Fact> = {
  internal_magic_link: {
    name: 'Magic link',
    short: 'magic link',
    sub: 'internal_magic_link',
    text: 'The API emails a one-time link, then keeps a signed session cookie.',
  },
  oidc: {
    name: 'Auth0',
    short: 'Auth0',
    sub: 'oidc',
    text: 'Auth0 signs you in and the API validates the access token on every request.',
  },
  none: {
    name: 'None',
    short: 'no auth',
    sub: 'none',
    text: 'No principal is created, so every protected route answers 401.',
  },
};

export const COMPUTE: Record<RuntimeCompute, Fact> = {
  ecs: {
    name: 'ECS Fargate',
    short: 'ECS Fargate',
    sub: 'ecs',
    text: 'One container serves the API and this page.',
  },
  lambda: {
    name: 'Lambda',
    short: 'Lambda',
    sub: 'lambda, container image',
    text: 'A container image run as a Lambda function, behind an API Gateway HTTP API.',
  },
  local: {
    name: 'Local',
    short: 'local',
    sub: 'local',
    text: 'The API found neither the Lambda nor the ECS environment.',
  },
};

export const TENANCY: Record<TenantMode, Fact> = {
  subdomain: {
    name: 'Subdomain',
    short: 'subdomain',
    sub: 'tenant from the host',
    text: 'The tenant is read from the request host.',
  },
  fixed: {
    name: 'Fixed',
    short: 'fixed',
    sub: 'one tenant id for every request',
    text: 'Every request resolves to one tenant id.',
  },
};

/** The status line's second fact when signed out: "1 of 3 deployments" on a known host. */
export function deploymentFact(): string | undefined {
  return findDeployment() ? `1 of ${DEPLOYMENTS.length} deployments` : undefined;
}

/** The status line's second fact when signed in: "magic link · ECS Fargate · subdomain". */
export function settingsFact(config: RuntimeConfig | null): string | undefined {
  if (!config) return undefined;
  const deployment = findDeployment();
  return [
    AUTH[config.authProvider].short,
    COMPUTE[config.compute].short,
    deployment && TENANCY[deployment.tenancy].short,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');
}

export const SIGN_IN = {
  internal_magic_link: {
    label: 'Sign in with a magic link',
    placeholder: 'you@example.com',
    button: 'Send link',
    busy: 'Sending',
    help: 'The API emails a link that works once. Records you create belong to your user and nobody else can read them.',
  },
  oidc: {
    label: 'Sign in with Auth0',
    button: 'Log in with Auth0',
    help: 'Auth0 handles the login and hands the page an access token. The API maps you to a local user in this tenant, and records you create belong to that user.',
  },
  none: {
    label: 'There is no sign-in on this deployment',
  },
};

export const SIGN_OUT = {
  internal_magic_link: 'Sign out',
  oidc: 'Log out',
};

export const LINK_SENT = {
  headline: ['Check your email.'],
  different: 'Use a different email',
};

export const LINK_ERROR = {
  headline: ['That link did not', 'sign you in.'],
  /** reason=consumed. The API gives one reason for a used link and an expired one. */
  consumed: `A sign-in link works once and expires after ${LINK_EXPIRY_MINUTES} minutes. This one has already been used or has expired. Send yourself a new one.`,
  /** No reason. In practice the link had no token in it. */
  invalid: 'The link was missing its token, so the API had nothing to check. Send yourself a new one.',
};

export const LOADING = {
  config: 'Loading the deployment config',
  session: 'Checking for a session',
  auth0: 'Waiting for Auth0',
};

export const RECORDS = {
  title: 'Examples',
  intro: "Each record belongs to your local user and is stored in this tenant's partition. Select one to see its key.",
  inputLabel: 'Record name',
  placeholder: 'Name a record',
  request: 'POST /api/example',
  add: 'Add',
  loading: 'Loading your records',
  empty:
    "No records yet. Name one above and the API will store it in this tenant's partition under your user id. Its key will show here.",
  pending: 'saving',
};

export function recordCount(count: number): string {
  if (count === 0) return 'no records';
  return count === 1 ? '1 record' : `${count} records`;
}

export const KEY = {
  selected: 'Where this record lives',
  unselected: 'Where your records live',
  owner: 'your local user id, from',
  recordSelected: 'set by the API on create',
  recordUnselected: 'set by the API when a record is created',
  copy: 'Copy the key',
};

export function tenantSource(tenancy: TenantMode | null): string {
  if (tenancy === 'subdomain') return 'read from the request host';
  if (tenancy === 'fixed') return 'the fixed id this deployment sets';
  return 'resolved by the API';
}

export const IDENTITY = {
  label: 'Identity',
  text: 'Signing in proves the principal. The API maps it to a local user inside this tenant, and your records point at that user, not at the email.',
  principal: 'Provider principal',
  user: 'Local user',
};

export const SESSION_INVALID = 'Your session is no longer valid. Log out and sign in again.';

export const COMPARISON = {
  title: 'Three deployments of one app.',
  text: 'The same backend and the same frontend bundle, deployed three times. Each deployment sets its own auth provider, compute and tenant mode.',
  textCurrent: 'Values that differ from the one you are on are set in ink.',
  here: 'you are here',
  hereSentence: 'You are here.',
  open: 'Open',
};

/**
 * One sentence on how another deployment differs from the one you are on.
 * It stands in for the columns below 980px, where there is no table to
 * compare by eye.
 */
export function difference(other: DeploymentSettings, current: DeploymentSettings): string {
  const auth = other.authProvider !== current.authProvider;
  const compute = other.compute !== current.compute;
  const tenancy = other.tenancy !== current.tenancy;

  if (compute && !auth && !tenancy) return `The same settings, with the app on ${COMPUTE[other.compute].name}.`;
  if (auth && !compute && !tenancy) return `The same settings, with sign-in through ${AUTH[other.authProvider].short}.`;
  if (tenancy && !auth && !compute) {
    return other.tenancy === 'fixed'
      ? 'The same settings, with one fixed tenant.'
      : 'The same settings, with the tenant read from the host.';
  }

  const clauses = [
    auth &&
      (other.authProvider === 'internal_magic_link'
        ? 'sign-in moves to a magic link'
        : `sign-in moves to ${AUTH[other.authProvider].short}`),
    compute && `the app runs on ${COMPUTE[other.compute].name}`,
    tenancy && (other.tenancy === 'fixed' ? 'every request resolves to one tenant' : 'the tenant is read from the host'),
  ].filter((clause): clause is string => Boolean(clause));

  if (clauses.length === 0) return 'The same settings.';

  const last = clauses.pop();
  const sentence = clauses.length ? `${clauses.join(', ')} and ${last}` : last!;
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}

export const EXPLAINER = {
  title: 'What you are looking at',
  text: 'The demo has one resource, a named record, and it exists to show the parts a new product inherits. Sign in, create a record and the page shows the request, the response and the key it was stored under.',
  textNoAuth:
    'The demo has one resource, a named record, and it exists to show the parts a new product inherits. With a sign-in, creating a record shows the request, the response and the key it was stored under.',
};
