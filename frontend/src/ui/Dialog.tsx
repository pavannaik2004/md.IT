import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import { IconButton } from './IconButton';

export interface DialogProps {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  tone?: 'danger';
  inline?: boolean;
  open?: boolean;
}

const FIRST_FOCUS = 'input, textarea, select, .md-dialog-actions button';

export function Dialog({ title, children, actions, onClose, tone, inline, open = true }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || inline) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FIRST_FOCUS) ?? panelRef.current;
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open, inline]);

  if (!open) return null;
  const panel = (
    <div
      ref={panelRef}
      className={cx('md-dialog', tone === 'danger' && 'is-danger')}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div className="md-dialog-head">
        <h2 id={titleId} className="md-dialog-title">
          {title}
        </h2>
        {onClose && <IconButton icon="x" label="Close" onClick={onClose} />}
      </div>
      <div className="md-dialog-body">{children}</div>
      {actions && <div className="md-dialog-actions">{actions}</div>}
    </div>
  );
  if (inline) return panel;
  return (
    <div
      className="md-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.();
      }}
    >
      {panel}
    </div>
  );
}
