import type { RuntimeAuthProvider, RuntimeCompute } from '../../../shared/api-types';

/** How a deployment decides which tenant a request belongs to. */
export type TenantMode = 'subdomain' | 'fixed';

export interface Deployment {
  id: string;
  host: string;
  href: string;
  authProvider: RuntimeAuthProvider;
  compute: RuntimeCompute;
  /**
   * TENANT_RESOLUTION_MODE in the deployment's terraform.tfvars. No endpoint
   * reports it, so this file is the only place the page can learn it.
   */
  tenancy: TenantMode;
}

/** The three settings a deployment chooses. */
export type DeploymentSettings = Pick<Deployment, 'authProvider' | 'compute' | 'tenancy'>;

/**
 * The public demo deployments. The same frontend bundle ships to all three.
 * The page works out which one it is on from the host it was loaded from, and
 * reads that deployment's auth provider and compute from GET /api/config.
 */
export const DEPLOYMENTS: Deployment[] = [
  {
    id: 'fargate-magic',
    host: 'reference-architecture.603.nz',
    href: 'https://reference-architecture.603.nz',
    authProvider: 'internal_magic_link',
    compute: 'ecs',
    tenancy: 'subdomain',
  },
  {
    id: 'lambda-auth0',
    host: 'reference-architecture-auth0.603.nz',
    href: 'https://reference-architecture-auth0.603.nz',
    authProvider: 'oidc',
    compute: 'lambda',
    tenancy: 'fixed',
  },
  {
    id: 'lambda-magic',
    host: 'reference-architecture-lambda.603.nz',
    href: 'https://reference-architecture-lambda.603.nz',
    authProvider: 'internal_magic_link',
    compute: 'lambda',
    tenancy: 'subdomain',
  },
];

/**
 * The deployment this page was loaded from, or null anywhere else, such as
 * local development or a fork on its own domain.
 */
export function findDeployment(hostname: string = window.location.hostname): Deployment | null {
  return DEPLOYMENTS.find((deployment) => deployment.host === hostname) ?? null;
}
