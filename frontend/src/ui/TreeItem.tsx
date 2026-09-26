import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface TreeItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  kind: 'folder' | 'file' | 'image';
  name: string;
  depth?: number;
  open?: boolean;
  active?: boolean;
  dirty?: boolean;
  dropTarget?: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
}

export function TreeItem({
  kind, name, depth = 0, open, active, dirty, dropTarget, trailing, onClick, onKeyDown, className, ...rest
}: TreeItemProps) {
  const isFolder = kind === 'folder';
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
      event.preventDefault();
      onClick?.();
    }
    onKeyDown?.(event);
  };
  return (
    <div
      aria-label={name}
      {...rest}
      className={cx('md-tree-item', active && 'is-active', dirty && 'is-dirty', dropTarget && 'is-drop-target', className)}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={isFolder ? Boolean(open) : undefined}
      aria-selected={Boolean(active)}
      tabIndex={0}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <span className="md-tree-chev">
        {isFolder && <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />}
      </span>
      <Icon name={isFolder ? (open ? 'folder-open' : 'folder') : kind === 'image' ? 'image' : 'file'} />
      <span className="md-tree-name">{name}</span>
      {dirty && <span className="md-tree-dirty" title="Changed since last saved version" />}
      {trailing && <span className="md-tree-trailing">{trailing}</span>}
    </div>
  );
}
