import { useRef, useState } from 'react';
import { userMessage } from '../store';
import { Input } from '../ui';

export interface RenameFieldProps {
  name: string;
  depth: number;
  onCommit: (value: string) => Promise<void>;
  onCancel: () => void;
}

/** Inline rename: Enter or blur saves, Escape cancels, errors stay visible under the field. */
export function RenameField({ name, depth, onCommit, onCancel }: RenameFieldProps) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const finished = useRef(false);

  const commit = async () => {
    if (finished.current) return;
    finished.current = true;
    if (value.trim() === name) return onCancel();
    try {
      await onCommit(value);
    } catch (err) {
      finished.current = false;
      setError(userMessage(err));
    }
  };

  const cancel = () => {
    finished.current = true;
    onCancel();
  };

  return (
    <div className="tree-rename" style={{ paddingLeft: `${8 + depth * 16}px` }}>
      <Input
        aria-label={`Rename ${name}`}
        value={value}
        error={error}
        autoFocus
        onFocus={(event) => {
          const el = event.currentTarget;
          const end = /\.md$/i.test(el.value) ? el.value.length - 3 : el.value.length;
          el.setSelectionRange(0, end);
        }}
        onChange={(event) => {
          setValue(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }
        }}
        onBlur={() => void commit()}
      />
    </div>
  );
}
