import { linkTarget, type NavLink } from './links';

/**
 * The family footer: quiet links, the source as a mono address and the
 * copyright line. No rule above it. It repeats the header's page links
 * because the header hides them below 980px.
 */
export function Footer({
  links,
  source,
  owner,
}: {
  links: NavLink[];
  source: NavLink;
  owner: string;
}) {
  return (
    <footer className="site-footer wrap">
      <nav aria-label="Footer">
        <ul className="site-footer-links">
          {links.map((link) => (
            <li key={link.href}>
              <a className="link-quiet" href={link.href} {...linkTarget(link)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <a className="link-quiet site-footer-source" href={source.href} {...linkTarget(source)}>
        {source.label}
      </a>

      <p className="site-footer-legal">
        &copy; {new Date().getFullYear()} {owner}.
      </p>
    </footer>
  );
}
