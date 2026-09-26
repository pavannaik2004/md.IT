import { useState } from 'react';
import { userMessage, type Folder } from '../store';
import { Button, Dialog, Icon } from '../ui';
import { moveTargets, type NodeRef } from './buildTree';

export interface MoveDialogProps {
  node: NodeRef & { name: string };
  folders: readonly Folder[];
  onMove: (targetId: string | null) => Promise<void>;
  onClose: () => void;
}

export function MoveDialog({ node, folders, onMove, onClose }: MoveDialogProps) {
  const targets = moveTargets(node, folders);
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const move = async () => {
    if (target === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      await onMove(target);
      onClose();
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Move “${node.name}”`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={target === undefined || busy} onClick={() => void move()}>
            Move
          </Button>
        </>
      }
    >
      {targets.length === 0 ? (
        <p>There’s nowhere else to move this.</p>
      ) : (
        <fieldset className="move-targets">
          <legend className="sr-only">Destination</legend>
          {targets.map((option) => (
            <label key={option.id ?? 'root'} className="move-target" style={{ paddingLeft: `${4 + option.depth * 16}px` }}>
              <input type="radio" name="move-target" checked={target === option.id} onChange={() => setTarget(option.id)} />
              <Icon name="folder" />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p className="md-field-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
