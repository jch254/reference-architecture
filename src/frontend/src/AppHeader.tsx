import type { RuntimeAuthProvider } from '../../shared/api-types';

import { getDemoCopy } from './demo-copy';

export function AppHeader({ authProvider }: { authProvider: RuntimeAuthProvider }) {
  const copy = getDemoCopy(authProvider);

  return (
    <header className="app-header">
      <h1 className="app-title">{copy.heading}</h1>
      <p className="app-subtitle">{copy.subheading}</p>
      <p className="deploy-switcher">
        {copy.alternateDeploy.description}{' '}
        <a href={copy.alternateDeploy.href}>{copy.alternateDeploy.label}</a>.
      </p>
    </header>
  );
}
