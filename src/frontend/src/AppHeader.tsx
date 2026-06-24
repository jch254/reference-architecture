import { Fragment } from 'react';

import type { RuntimeAuthProvider, RuntimeCompute } from '../../shared/api-types';

import { getDemoCopy } from './demo-copy';
import { getAlternateDeployments } from './deployments';

const COMPUTE_META: Record<RuntimeCompute, { label: string; color: string }> = {
  lambda: { label: 'AWS Lambda', color: '#ED7100' },
  ecs: { label: 'ECS Fargate', color: '#2563EB' },
  local: { label: 'local', color: '#6B7280' },
};

export function AppHeader({
  authProvider,
  compute,
}: {
  authProvider: RuntimeAuthProvider;
  compute?: RuntimeCompute;
}) {
  const copy = getDemoCopy(authProvider);
  const computeMeta = compute ? COMPUTE_META[compute] : null;
  const alternateDeployments = getAlternateDeployments(authProvider, compute);

  return (
    <header className="app-header">
      <h1 className="app-title">{copy.heading}</h1>
      <p className="app-subtitle">{copy.subheading}</p>
      {computeMeta && (
        <p className="compute-badge" title="Compute backend serving this deployment">
          <span
            className="compute-badge-dot"
            style={{ backgroundColor: computeMeta.color }}
            aria-hidden="true"
          />
          Running on <strong>{computeMeta.label}</strong>
        </p>
      )}
      {alternateDeployments.length > 0 && (
        <p className="deploy-switcher">
          {copy.deployIntro} Compare{' '}
          {alternateDeployments.map((deployment, index) => (
            <Fragment key={deployment.id}>
              {index > 0 && (index === alternateDeployments.length - 1 ? ' or ' : ', ')}
              <a href={deployment.href}>{deployment.label}</a>
            </Fragment>
          ))}
          .
        </p>
      )}
    </header>
  );
}
