import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Where toasts appear. It is always in the page, empty or not, so a screen
 * reader hears a toast when one arrives.
 */
export function Toasts({ children }: { children?: ReactNode }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {children}
    </div>
  );
}

/**
 * One message with one action. It closes itself after `duration`. The clock
 * stops while the pointer or the keyboard is on the toast, so the action is
 * never taken away from someone who is reaching for it.
 */
export function Toast({
  children,
  actionLabel,
  onAction,
  onClose,
  duration = 5000,
}: {
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
  duration?: number;
}) {
  const [held, setHeld] = useState(false);
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [held, duration]);

  return (
    <div
      className="toast"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className="toast-text">{children}</span>
      <button type="button" className="toast-action" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
