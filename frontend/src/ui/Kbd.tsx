import type { ReactNode } from 'react';

export function Kbd({ children }: { children?: ReactNode }) {
  return <kbd className="md-kbd">{children}</kbd>;
}
