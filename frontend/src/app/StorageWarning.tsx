import { setSetting, SETTINGS, useSetting } from '../store';
import { Button, Callout } from '../ui';

export function StorageWarning() {
  const dismissed = useSetting(SETTINGS.storageWarningDismissed, false);
  if (dismissed !== false) return null;
  return (
    <Callout
      tone="warning"
      title="Your work is saved in this browser"
      actions={
        <Button size="sm" onClick={() => void setSetting(SETTINGS.storageWarningDismissed, true)}>
          Got it
        </Button>
      }
    >
      Clearing browser data deletes it.
    </Callout>
  );
}
