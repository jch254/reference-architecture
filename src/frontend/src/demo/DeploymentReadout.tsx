import { useEffect } from 'react';

import type { RuntimeConfig } from '../../../shared/api-types';
import { api } from '../api/api-client';
import { Ledger, LedgerRow } from '../ui/LedgerRow';
import { Node, SectionLabel } from '../ui/SectionLabel';

import { AUTH, COMPUTE, TENANCY } from './demo-copy';
import { findDeployment } from './deployments';
import { useRequestLog } from './request-log';

const HEALTH = '/api/health';

/**
 * What this deployment is, read from the API as the page loads: the auth
 * provider and compute from GET /api/config and whether GET /api/health
 * answers. The tenant mode is not served by any endpoint, so it is shown
 * only on the three hosts deployments.ts knows.
 *
 * `config` is null when GET /api/config failed. The page then assumes magic
 * link sign-in, and this readout says so.
 */
export function DeploymentReadout({ config }: { config: RuntimeConfig | null }) {
  const deployment = findDeployment();
  // The health row reads the log, so it shows the same status and time as
  // the request listed under it.
  const health = useRequestLog().find((entry) => entry.path === HEALTH);

  useEffect(() => {
    api.get(HEALTH).catch(() => {
      // The failure is in the log, which the row below reads.
    });
  }, []);

  const body = health?.responseBody as { data?: { status?: string } } | undefined;
  const answer = body?.data?.status;

  return (
    <section className="readout-section" aria-label="This deployment">
      <SectionLabel label="This deployment" count="from /api/config and /api/health" />
      <Ledger className="readout">
        {config ? (
          <>
            <LedgerRow margin="auth" name={AUTH[config.authProvider].name}>
              {AUTH[config.authProvider].text}
            </LedgerRow>
            <LedgerRow margin="compute" name={COMPUTE[config.compute].name}>
              {COMPUTE[config.compute].text}
            </LedgerRow>
          </>
        ) : (
          <LedgerRow margin="config" name="No answer">
            <code>GET /api/config</code> failed, so the page is assuming magic link sign-in.
          </LedgerRow>
        )}

        {deployment && (
          <LedgerRow margin="tenancy" name={TENANCY[deployment.tenancy].name}>
            {TENANCY[deployment.tenancy].text}
          </LedgerRow>
        )}

        {!health ? (
          <LedgerRow margin="health" name="Checking">
            <code>GET {HEALTH}</code> has not answered yet.
          </LedgerRow>
        ) : health.status === 200 ? (
          <LedgerRow
            margin="health"
            name={
              <span className="readout-live">
                <Node />
                Responding
              </span>
            }
          >
            <code>GET {HEALTH}</code> answered {answer ?? health.status} in {health.durationMs} ms.
          </LedgerRow>
        ) : (
          <LedgerRow margin="health" name="Not responding">
            <code>GET {HEALTH}</code>{' '}
            {health.status === null ? 'got no answer.' : `answered ${health.status} in ${health.durationMs} ms.`}
          </LedgerRow>
        )}
      </Ledger>
    </section>
  );
}
