import type { RuntimeAuthProvider, RuntimeCompute } from '../../shared/api-types';

import { getDemoCopy } from './demo-copy';

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
      <p className="deploy-switcher">
        {copy.alternateDeploy.description}{' '}
        <a href={copy.alternateDeploy.href}>{copy.alternateDeploy.label}</a>.
      </p>
    </header>
  );
}
