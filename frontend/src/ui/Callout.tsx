import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

type Tone = 'info' | 'positive' | 'warning' | 'danger';
const ICON: Record<Tone, IconName> = { info: 'info', positive: 'check', warning: 'alert', danger: 'alert' };

export function Callout({ tone = 'info', title, children, actions }: { tone?: Tone; title?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cx('md-callout', `md-callout-${tone}`)} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon name={ICON[tone]} size={18} />
      <div className="md-callout-body">
        {title && <div className="md-callout-title">{title}</div>}
        {children && <div className="md-callout-text">{children}</div>}
        {actions && <div className="md-callout-actions">{actions}</div>}
      </div>
    </div>
  );
}
