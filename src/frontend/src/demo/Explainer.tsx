import type { RuntimeAuthProvider } from '../../../shared/api-types';
import { ButtonLink } from '../ui/Button';
import { Ledger, LedgerRow } from '../ui/LedgerRow';

import { DOCS, EXPLAINER } from './demo-copy';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/**
 * "What you are looking at": the five parts a new product inherits, one row
 * each, with links to the three documents that go further.
 */
export function Explainer({ authProvider }: { authProvider?: RuntimeAuthProvider }) {
  return (
    <section className="split split-flow explainer">
      <div className="stack explainer-lead">
        <h2 className="h2">{EXPLAINER.title}</h2>
        <p className="body">{authProvider === 'none' ? EXPLAINER.textNoAuth : EXPLAINER.text}</p>
        <div className="actions">
          <ButtonLink href={DOCS.readme} {...external}>
            Read the README
          </ButtonLink>
          <a className="link" href={DOCS.architecture} {...external}>
            Architecture
          </a>
          <a className="link" href={DOCS.infrastructure} {...external}>
            Infrastructure
          </a>
        </div>
      </div>

      <Ledger ordered className="explainer-rows">
        <LedgerRow margin="01" name="Tenancy">
          Every item sits under <code>TENANT#&lt;tenantId&gt;</code>. The tenant comes from the host or from a fixed
          id, never from whoever signed in.
        </LedgerRow>
        <LedgerRow margin="02" name="Auth">
          A deployment runs one provider, magic link or OIDC. Either way the guard hands controllers the same
          principal.
        </LedgerRow>
        <LedgerRow margin="03" name="Identity">
          The provider says who signed in. <code>GET /api/me</code> maps that to a local user inside the tenant, and
          records store the local user id.
        </LedgerRow>
        <LedgerRow margin="04" name="Keys">
          One table with no indexes and no scans. A record's sort key is{' '}
          <code>USER#&lt;userId&gt;#EXAMPLE#&lt;exampleId&gt;</code>.
        </LedgerRow>
        <LedgerRow margin="05" name="Compute">
          One app factory backs the ECS container and the Lambda handler. This page asks <code>/api/config</code>{' '}
          which one it is on.
        </LedgerRow>
      </Ledger>
    </section>
  );
}
