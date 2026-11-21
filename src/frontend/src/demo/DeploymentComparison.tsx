import type { RuntimeConfig } from '../../../shared/api-types';
import { useWide } from '../ui/use-wide';

import { AUTH, COMPARISON, COMPUTE, TENANCY, difference } from './demo-copy';
import { DEPLOYMENTS, findDeployment, type DeploymentSettings } from './deployments';

const DIMENSIONS = ['authProvider', 'compute', 'tenancy'] as const;

function facts(settings: DeploymentSettings) {
  return {
    authProvider: AUTH[settings.authProvider],
    compute: COMPUTE[settings.compute],
    tenancy: TENANCY[settings.tenancy],
  };
}

/**
 * The three public deployments side by side. The row for the host the page
 * was loaded from is the current one: it takes the node, the title weight
 * and the row fill, and its auth and compute are the live values from
 * GET /api/config. On the other rows a value that matches the current one
 * recedes and a value that differs is set in ink, so the difference is
 * carried by type. Off the three hosts there is no current row and nothing
 * recedes.
 */
export function DeploymentComparison({ config }: { config: RuntimeConfig | null }) {
  const wide = useWide();
  const here = findDeployment();
  const current: DeploymentSettings | null = here
    ? {
        authProvider: config?.authProvider ?? here.authProvider,
        compute: config?.compute ?? here.compute,
        tenancy: here.tenancy,
      }
    : null;

  const rows = DEPLOYMENTS.map((deployment) => {
    const isCurrent = deployment.id === here?.id;
    const settings: DeploymentSettings = isCurrent && current ? current : deployment;
    return {
      deployment,
      isCurrent,
      settings,
      facts: facts(settings),
      differs: (dimension: (typeof DIMENSIONS)[number]) =>
        isCurrent || !current || settings[dimension] !== current[dimension],
    };
  });

  const head = (
    <div className="split split-head comparison-head">
      <h2 className="h2">{COMPARISON.title}</h2>
      <p className="body">
        {COMPARISON.text}
        {current && ` ${COMPARISON.textCurrent}`}
      </p>
    </div>
  );

  if (!wide) {
    return (
      <section className="comparison">
        {head}
        <ul className="rows comparison-list">
          {rows.map(({ deployment, isCurrent, settings, facts, differs }) => (
            <li
              key={deployment.id}
              className={`row row-wide comparison-item${isCurrent ? ' row-current' : ''}`}
              aria-current={isCurrent ? 'true' : undefined}
            >
              {isCurrent ? (
                <span className="comparison-host comparison-host-current">{deployment.host}</span>
              ) : (
                <a className="link-quiet comparison-host" href={deployment.href}>
                  {deployment.host}
                </a>
              )}
              <span className="comparison-line">
                {DIMENSIONS.map((dimension) => (
                  <span key={dimension} className={differs(dimension) ? 'comparison-differs' : undefined}>
                    {facts[dimension].name}
                  </span>
                ))}
              </span>
              {current && (
                <span className="small">{isCurrent ? COMPARISON.hereSentence : difference(settings, current)}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="comparison">
      {head}
      <div role="table" aria-label="Deployments">
        <div role="row" className="comparison-cols comparison-labels">
          <span role="columnheader">Deployment</span>
          <span role="columnheader">Auth</span>
          <span role="columnheader">Compute</span>
          <span role="columnheader">Tenancy</span>
          <span role="columnheader">
            <span className="sr-only">Link</span>
          </span>
        </div>
        <div role="rowgroup" className="comparison-rows">
          {rows.map(({ deployment, isCurrent, facts, differs }) => (
            <div
              role="row"
              key={deployment.id}
              className={`row row-wide comparison-cols comparison-row${isCurrent ? ' row-current' : ' row-hover'}`}
              aria-current={isCurrent ? 'true' : undefined}
            >
              <span role="cell" className="comparison-cell">
                {isCurrent ? (
                  <>
                    <span className="comparison-host comparison-host-current">{deployment.host}</span>
                    <span className="comparison-sub">{COMPARISON.here}</span>
                  </>
                ) : (
                  <a className="link-quiet comparison-host" href={deployment.href}>
                    {deployment.host}
                  </a>
                )}
              </span>
              {DIMENSIONS.map((dimension) => (
                <span role="cell" className="comparison-cell" key={dimension}>
                  <span className={`comparison-value${differs(dimension) ? ' comparison-differs' : ''}`}>
                    {facts[dimension].name}
                  </span>
                  <span className="comparison-sub">{facts[dimension].sub}</span>
                </span>
              ))}
              <span role="cell" className="comparison-open">
                {!isCurrent && (
                  <a className="link-quiet" href={deployment.href} aria-label={`${COMPARISON.open} ${deployment.host}`}>
                    {COMPARISON.open}
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
