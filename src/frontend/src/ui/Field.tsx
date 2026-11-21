import type { FormEvent, InputHTMLAttributes, ReactNode, Ref } from 'react';

import { Button } from './Button';
import { Icon } from './Icon';

/**
 * The base line block: a label, one row on a 2px ink rule, help under it and
 * what went wrong, if anything. With `onSubmit` it is a form and the row
 * holds a field and the primary button. With `bare` there is no rule, for a
 * sign-in that is a single button.
 */
export function Baseline({
  label,
  labelFor,
  help,
  error,
  bare = false,
  onSubmit,
  children,
}: {
  label: string;
  labelFor?: string;
  help?: ReactNode;
  error?: ReactNode;
  bare?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const content = (
    <>
      {labelFor ? (
        <label className="baseline-label" htmlFor={labelFor}>
          {label}
        </label>
      ) : (
        <p className="baseline-label">{label}</p>
      )}
      <div className={bare ? 'baseline-action' : 'baseline-field'}>{children}</div>
      {help && <p className="small">{help}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );

  return onSubmit ? (
    <form className="baseline" onSubmit={onSubmit}>
      {content}
    </form>
  ) : (
    <div className="baseline">{content}</div>
  );
}

/**
 * Quick add: one field on a 1px ink rule. `hint` is the mono slot beside the
 * field. It moves under the rule when the window is narrow.
 */
export function QuickAdd({
  id,
  label,
  hint,
  submitLabel,
  error,
  onSubmit,
  inputRef,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onSubmit'> & {
  id: string;
  label: string;
  hint?: string;
  submitLabel: string;
  error?: ReactNode;
  onSubmit: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <form
      className="quick-add"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="quick-add-row">
        <span className="quick-add-plus">
          <Icon name="plus" />
        </span>
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
        <input id={id} ref={inputRef} type="text" autoComplete="off" {...input} />
        {hint && <span className="quick-add-hint quick-add-hint-wide">{hint}</span>}
        <Button type="submit" variant="ghost">
          {submitLabel}
        </Button>
      </div>
      {hint && <span className="quick-add-hint quick-add-hint-narrow">{hint}</span>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
