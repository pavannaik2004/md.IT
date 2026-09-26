import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type SaveStatusState = 'saved' | 'saving' | 'failed' | 'cloud';

const COPY: Record<SaveStatusState, { icon: IconName | null; text: string }> = {
  saved: { icon: 'check', text: 'Saved locally' },
  saving: { icon: null, text: 'Saving…' },
  failed: { icon: 'alert', text: 'Couldn’t save' },
  cloud: { icon: 'cloud', text: 'Version saved' },
};

export function SaveStatus({ state = 'saved', detail, children }: { state?: SaveStatusState; detail?: string; children?: ReactNode }) {
  const copy = COPY[state];
  return (
    <span className={cx('md-save', `md-save-${state}`)} role="status" aria-live="polite">
      {copy.icon ? <Icon name={copy.icon} size={14} /> : <span className="md-save-spin" aria-hidden="true" />}
      <span>{children ?? copy.text}</span>
      {detail && <span className="md-save-detail">· {detail}</span>}
    </span>
  );
}
