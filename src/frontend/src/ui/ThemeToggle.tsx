import { useEffect, useState } from 'react';

import { Icon } from './Icon';

function nextTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
}

/**
 * The family theme toggle. public/theme.js owns the theme: it sets
 * data-theme on <html> before first paint, handles the press on any
 * [data-theme-toggle] and stores the choice. This component only draws the
 * button and keeps its label in step with the theme in use.
 */
export function ThemeToggle() {
  const [next, setNext] = useState(nextTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setNext(nextTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <button className="theme-toggle" type="button" data-theme-toggle aria-label={`Switch to ${next} theme`}>
      <Icon name="moon" className="icon-moon" />
      <Icon name="sun" className="icon-sun" />
    </button>
  );
}
