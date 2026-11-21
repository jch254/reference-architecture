import type { ReactNode } from 'react';

import { Footer } from '../ui/Footer';
import { Header } from '../ui/Header';
import { Node } from '../ui/SectionLabel';

import './demo.css';
import { DOCS, OWNER, REPO, SITE_NAME } from './demo-copy';

const SITES = [
  { label: '603.nz', href: 'https://603.nz' },
  { label: SITE_NAME, href: '/', current: true },
];

const HEADER_LINKS = [
  { label: 'Architecture', href: DOCS.architecture, external: true },
  { label: 'GitHub', href: REPO, external: true },
];

const FOOTER_LINKS = [
  { label: '603.nz', href: 'https://603.nz' },
  { label: 'jch254.com', href: 'https://jch254.com' },
  { label: 'README', href: DOCS.readme, external: true },
  { label: 'Architecture', href: DOCS.architecture, external: true },
  { label: 'Infrastructure', href: DOCS.infrastructure, external: true },
];

const SOURCE = { label: REPO.replace('https://', ''), href: REPO, external: true };

/** The frame every state of the demo sits in: the family header and footer. */
export function DemoShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to the page
      </a>
      <Header mark={<span className="avatar" aria-hidden="true" />} sites={SITES} links={HEADER_LINKS} />
      <main id="main" className="wrap demo-main">
        {children}
      </main>
      <Footer links={FOOTER_LINKS} source={SOURCE} owner={OWNER} />
    </>
  );
}

/**
 * Where you are: the node, the host the page was loaded from and one more
 * fact in ink 3.
 */
export function StatusLine({ fact, live }: { fact?: ReactNode; live?: boolean }) {
  return (
    <p className="status" role={live ? 'status' : undefined}>
      <Node />
      <span>{window.location.host}</span>
      {fact && <span className="status-fact">{fact}</span>}
    </p>
  );
}

/** The whole page while the first request is out. */
export function LoadingPage({ fact }: { fact: string }) {
  return (
    <DemoShell>
      <div className="loading-page">
        <StatusLine fact={fact} live />
      </div>
    </DemoShell>
  );
}
