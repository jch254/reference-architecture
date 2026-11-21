import type { ReactNode } from 'react';

import { KeyValues } from '../ui/Code';
import { SectionLabel } from '../ui/SectionLabel';

import { IDENTITY } from './demo-copy';
import type { LocalUser, Principal } from './types';

function Group({
  className,
  label,
  source,
  children,
}: {
  className: string;
  label: string;
  source: string;
  children: ReactNode;
}) {
  return (
    <div className={`identity-group ${className}`}>
      <h3 className="identity-name">
        {label}
        <span className="section-count">{source}</span>
      </h3>
      {children}
    </div>
  );
}

/**
 * Who the API says you are, twice over: the principal the auth provider
 * proved, from GET /api/auth/check, beside the local user the API mapped it
 * to, from GET /api/me. Records store the local user id, which is why the two
 * are shown apart.
 *
 * `principal` is undefined while the request is out and null if it failed.
 */
export function IdentityReadout({
  principal,
  user,
}: {
  principal: Principal | null | undefined;
  user: LocalUser | null;
}) {
  return (
    <section className="identity" aria-label={IDENTITY.label}>
      <SectionLabel label={IDENTITY.label} />
      <p className="text">{IDENTITY.text}</p>

      <div className="identity-groups">
        <Group className="identity-principal" label={IDENTITY.principal} source="GET /api/auth/check">
          {principal ? (
            <KeyValues
              rows={[
                ['provider', principal.provider],
                ['subject', principal.subject],
                ['email', principal.email],
                ['name', principal.name],
              ]}
            />
          ) : (
            <p className="small">{principal === null ? 'The API did not return a principal.' : 'Loading'}</p>
          )}
        </Group>

        <Group className="identity-user" label={IDENTITY.user} source="GET /api/me">
          {user ? (
            <KeyValues
              rows={[
                ['userId', user.userId],
                ['tenantId', user.tenantId],
                ['provider', user.provider],
                ['providerSubject', user.providerSubject],
                ['createdAt', user.createdAt],
              ]}
            />
          ) : (
            <p className="small">Loading</p>
          )}
        </Group>
      </div>
    </section>
  );
}
