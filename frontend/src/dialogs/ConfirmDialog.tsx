import { useState } from 'react';
import { userMessage } from '../store';
import { Button, Dialog } from '../ui';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={title}
      tone="danger"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon="trash" disabled={busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
      {error && (
        <p className="md-field-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
