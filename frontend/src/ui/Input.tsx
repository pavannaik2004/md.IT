import { useId, type InputHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Kbd } from './Kbd';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  shortcut?: string;
}

export function Input({ label, hint, error, icon, shortcut, className, id, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;
  // The label element holds only the label text, so help and error text never become part of the field's name.
  return (
    <div className={cx('md-field', className)}>
      {label && (
        <label className="md-field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <span className={cx('md-input', icon && 'has-icon')}>
        {icon && <Icon name={icon} />}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...rest}
        />
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </span>
      {error ? (
        <span id={messageId} className="md-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="md-field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
