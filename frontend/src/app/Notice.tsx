import { useEffect } from 'react';
import { Callout, IconButton } from '../ui';

export interface NoticeMessage {
  id: number;
  text: string;
}

/** A short-lived message at the bottom of the document area; the live region stays mounted so screen readers hear it. */
export function Notice({ notice, onDismiss }: { notice: NoticeMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);
  return (
    <div className="ws-notice" role="status">
      {notice && (
        <Callout tone="warning" actions={<IconButton icon="x" label="Dismiss" onClick={onDismiss} />}>
          {notice.text}
        </Callout>
      )}
    </div>
  );
}
