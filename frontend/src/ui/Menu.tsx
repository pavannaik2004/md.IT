import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type MenuItem =
  | 'separator'
  | { label: string; icon?: IconName; shortcut?: string; danger?: boolean; disabled?: boolean; onSelect?: () => void };

export function Menu({ items, className }: { items: readonly MenuItem[]; className?: string }) {
  return (
    <div className={cx('md-menu', className)} role="menu">
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="md-menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cx('md-menu-item', item.danger && 'is-danger')}
            onClick={item.onSelect}
          >
            <span className="md-menu-icon">{item.icon && <Icon name={item.icon} />}</span>
            <span className="md-menu-label">{item.label}</span>
            {item.shortcut && <span className="md-menu-kbd">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
