export interface NavLink {
  label: string;
  href: string;
  /** Opens in a new tab. For links that leave the app for documentation. */
  external?: boolean;
}

/** What a link takes when it opens in a new tab. */
export function linkTarget(link: Pick<NavLink, 'external'>) {
  return link.external ? ({ target: '_blank', rel: 'noopener noreferrer' } as const) : {};
}
