import type { ReactNode } from 'react';

import type { RuntimeConfig } from '../../../shared/api-types';

import { DemoShell, StatusLine } from './DemoShell';
import { DeploymentComparison } from './DeploymentComparison';
import { DeploymentReadout } from './DeploymentReadout';
import { Explainer } from './Explainer';
import { RequestLog } from './RequestLog';
import { HEADLINE, LEDE, deploymentFact } from './demo-copy';

/**
 * The signed-out page. The copy keeps the left edge and the product sits on
 * the right: a readout of this deployment and the log of the requests the
 * page made to load. Under them are the comparison and the explainer.
 *
 * Signing in differs by auth provider, so each shell passes its own control
 * as children. `headline` and `lede` replace the page's own for a state that
 * needs the whole column, such as a link that has been sent.
 *
 * `config` is null when GET /api/config failed.
 */
export function SignedOutPage({
  config,
  headline = HEADLINE,
  lede = LEDE,
  children,
}: {
  config: RuntimeConfig | null;
  headline?: string[];
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DemoShell>
      <div className="split split-lead hero">
        <div className="stack">
          <StatusLine fact={deploymentFact()} />
          <h1 className="h1">
            {headline.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p className="lede">{lede}</p>
          {children}
        </div>

        <div className="hero-side">
          <DeploymentReadout config={config} />
          <RequestLog openFirst="/api/config" />
        </div>
      </div>

      <DeploymentComparison config={config} />
      <Explainer authProvider={config?.authProvider} />
    </DemoShell>
  );
}
