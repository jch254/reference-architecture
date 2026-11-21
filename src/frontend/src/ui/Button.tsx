import type { AnchorHTMLAttributes, ButtonHTMLAttributes, Ref } from 'react';

import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'ghost';

function classes(variant: Variant, className?: string) {
  return ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
}

/** Primary is the one ink button a view has. Ghost is every other action. */
export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={classes(variant, className)} {...rest} />;
}

/** A link that is the primary action of its section. */
export function ButtonLink({
  variant = 'primary',
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return <a className={classes(variant, className)} {...rest} />;
}

/**
 * A button that is only an icon. `label` is its accessible name. `inline`
 * keeps the pointer size inside a line of text and pads the touch target.
 */
export function IconButton({
  icon,
  label,
  inline = false,
  className,
  ref,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  icon: IconName;
  label: string;
  inline?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={['icon-btn', inline && 'icon-btn-inline', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
