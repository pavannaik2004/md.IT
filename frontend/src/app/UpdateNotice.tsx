import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Button, Callout } from '../ui';

type UpdateFn = (reloadPage?: boolean) => Promise<void>;
export type RegisterFn = (options: { onNeedRefresh?: () => void }) => UpdateFn;

/** Registers the service worker (production only) and offers a reload when a new version is waiting (P-032). */
export function UpdateNotice({ enabled = import.meta.env.PROD, register = registerSW }: { enabled?: boolean; register?: RegisterFn }) {
  const [update, setUpdate] = useState<UpdateFn | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const updateSW = register({ onNeedRefresh: () => setUpdate(() => updateSW) });
  }, [enabled, register]);
  if (!update) return null;
  return (
    <div className="update-notice" role="status">
      <Callout
        tone="info"
        actions={
          <Button size="sm" onClick={() => void update(true)}>
            Reload
          </Button>
        }
      >
        A new version of md.IT is ready.
      </Callout>
    </div>
  );
}
