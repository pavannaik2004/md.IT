import type { ReactNode } from 'react';

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'positive' | 'warning' | 'danger'; children?: ReactNode }) {
  return <span className={`md-badge md-badge-${tone}`}>{children}</span>;
}
