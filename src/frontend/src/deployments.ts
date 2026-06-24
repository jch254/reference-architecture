import type { RuntimeAuthProvider, RuntimeCompute } from '../../shared/api-types';

export interface Deployment {
  id: string;
  authProvider: RuntimeAuthProvider;
  compute: RuntimeCompute;
  href: string;
  /** Short label naming the auth model and compute backend, used in switcher links. */
  label: string;
}

/**
 * The live demo deployments. The same frontend bundle ships to all of them, so
 * a deployment is identified by its (authProvider × compute) pair rather than by
 * the bundle. The header's switcher links between them so each demo can reach
 * the others.
 */
export const DEPLOYMENTS: Deployment[] = [
  {
    id: 'fargate-magic',
    authProvider: 'internal_magic_link',
    compute: 'ecs',
    href: 'https://reference-architecture.603.nz',
    label: 'magic-link on ECS Fargate',
  },
  {
    id: 'fargate-auth0',
    authProvider: 'oidc',
    compute: 'ecs',
    href: 'https://reference-architecture-auth0.603.nz',
    label: 'Auth0/OIDC on ECS Fargate',
  },
  {
    id: 'lambda-magic',
    authProvider: 'internal_magic_link',
    compute: 'lambda',
    href: 'https://reference-architecture-lambda.603.nz',
    label: 'magic-link on AWS Lambda',
  },
];

/**
 * The other live deployments to link to from the current one. Matches the
 * current deployment by its (authProvider, compute) pair; when the current
 * deployment isn't one of the known live ones (e.g. local dev or auth disabled),
 * every live deployment is offered.
 */
export function getAlternateDeployments(
  authProvider: RuntimeAuthProvider,
  compute?: RuntimeCompute,
): Deployment[] {
  return DEPLOYMENTS.filter(
    (d) => !(d.authProvider === authProvider && d.compute === compute),
  );
}
