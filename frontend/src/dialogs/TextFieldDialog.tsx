import { useId, useState, type FormEvent } from 'react';
import { userMessage } from '../store';
import { Button, Dialog, Input } from '../ui';

export interface TextFieldDialogProps {
  title: string;
  label: string;
  submitLabel: string;
  initialValue?: string;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}

export function TextFieldDialog({ title, label, submitLabel, initialValue = '', onSubmit, onClose }: TextFieldDialogProps) {
  const formId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(value);
      onClose();
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void submit(event)}>
        <Input
          label={label}
          value={value}
          error={error}
          onChange={(event) => {
            setValue(event.target.value);
            setError(undefined);
          }}
        />
      </form>
    </Dialog>
  );
}
