import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons';

export function EmptyState({ icon, title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="md-empty">
      {icon && (
        <span className="md-empty-icon">
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="md-empty-title">{title}</div>
      {children && <p className="md-empty-text">{children}</p>}
      {action}
    </div>
  );
}
