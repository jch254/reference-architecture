import { useEffect, useState } from 'react';

import { IconButton } from './Button';

/**
 * Copies a value to the clipboard. The icon turns to a tick for a moment and
 * the button's name says what happened, so the result is seen and heard.
 */
export function CopyButton({
  value,
  label,
  inline = false,
}: {
  value: string;
  label: string;
  inline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // No clipboard access (an insecure origin, or permission refused). The
      // value is on the page and can still be selected.
    }
  };

  return (
    <IconButton
      icon={copied ? 'check' : 'copy'}
      label={copied ? 'Copied' : label}
      inline={inline}
      onClick={copy}
    />
  );
}
