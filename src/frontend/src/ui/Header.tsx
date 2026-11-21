import type { ReactNode } from 'react';

import { linkTarget, type NavLink } from './links';
import { ThemeToggle } from './ThemeToggle';

export interface SiteLink {
  label: string;
  href: string;
  current?: boolean;
}

/**
 * The family header: the mark, the site switch, the page links and the theme
 * toggle. The current site carries the node and the title weight. Below
 * 980px the page links are hidden, so the footer repeats them.
 */
export function Header({
  mark,
  sites,
  links,
}: {
  mark?: ReactNode;
  sites: SiteLink[];
  links: NavLink[];
}) {
  return (
    <header className="site-header wrap">
      <div className="site-brand">
        {mark}
        <nav className="site-switch" aria-label="Sites">
          {sites.map((site) => (
            <a key={site.href} href={site.href} aria-current={site.current ? 'true' : undefined}>
              {site.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="site-nav">
        <nav className="site-nav-links" aria-label="Pages">
          {links.map((link) => (
            <a key={link.href} href={link.href} {...linkTarget(link)}>
              {link.label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
