import { useSyncExternalStore } from 'react';

// The width at which the page takes two columns. It matches the 980px
// breakpoint in styles/primitives.css.
const QUERY = '(min-width: 981px)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

function isWide(): boolean {
  return window.matchMedia ? window.matchMedia(QUERY).matches : true;
}

/**
 * True at 981px and wider. CSS handles every change of layout it can. This
 * is for the two places where the markup itself differs: a record's key sits
 * beside the list or inside the row, and the comparison is a table or a list.
 */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, isWide);
}
