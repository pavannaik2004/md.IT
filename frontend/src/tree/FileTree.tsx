import { useEffect, useState, type DragEvent } from 'react';
import { ConfirmDialog } from '../dialogs';
import {
  ancestorFolderIds, createDocument, createFolder, deleteDocument, deleteFolder, duplicateDocument, moveDocument, moveFolder,
  renameDocument, renameFolder, useDocuments, useFolders, userMessage,
} from '../store';
import { Button, Callout, EmptyState, IconButton, MenuButton, TreeItem, cx, type MenuItem } from '../ui';
import { buildTree, canMoveTo, flattenVisible, folderContents, isInsideFolder, type TreeNode } from './buildTree';
import { deleteMessage } from './messages';
import { MoveDialog } from './MoveDialog';
import { RenameField } from './RenameField';
import './tree.css';

export interface FileTreeProps {
  projectId: string;
  activeDocId?: string;
  onOpen: (docId: string) => void;
  /** Called after the open document was deleted (directly or with its folder). */
  onActiveDeleted: () => void;
}

type TreeDialog = { kind: 'move'; node: TreeNode } | { kind: 'delete'; node: TreeNode } | null;
/** undefined = no drop target; null = project root. */
type DropTarget = string | null | undefined;

function withAll(set: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  return ids.every((id) => set.has(id)) ? set : new Set([...set, ...ids]);
}

export function FileTree({ projectId, activeDocId, onOpen, onActiveDeleted }: FileTreeProps) {
  const folders = useFolders(projectId);
  const documents = useDocuments(projectId);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<TreeDialog>(null);
  const [dragging, setDragging] = useState<TreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(undefined);
  const [error, setError] = useState<string | null>(null);

  const openFolders = (ids: readonly string[]) => setOpen((prev) => withAll(prev, ids));

  // Keep the active document visible.
  useEffect(() => {
    if (!activeDocId || !folders || !documents) return;
    const doc = documents.find((d) => d.id === activeDocId);
    if (doc) setOpen((prev) => withAll(prev, ancestorFolderIds(folders, doc.folderId)));
  }, [activeDocId, folders, documents]);

  if (!folders || !documents) return null;

  const rows = flattenVisible(buildTree(folders, documents), open);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(userMessage(err));
    }
  };

  const toggleFolder = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const newDocument = (folderId: string | null) =>
    run(async () => {
      const doc = await createDocument(projectId, folderId);
      if (folderId) openFolders([folderId]);
      setRenamingId(doc.id);
      onOpen(doc.id);
    });

  const newFolder = (parentId: string | null) =>
    run(async () => {
      const folder = await createFolder(projectId, parentId);
      if (parentId) openFolders([parentId]);
      setRenamingId(folder.id);
    });

  const move = (node: TreeNode, targetId: string | null) =>
    node.kind === 'folder' ? moveFolder(node.id, targetId) : moveDocument(node.id, targetId);

  const remove = async (node: TreeNode) => {
    const active = documents.find((d) => d.id === activeDocId);
    const activeGone = node.kind === 'file' ? node.id === activeDocId : isInsideFolder(active, node.id, folders);
    if (node.kind === 'folder') await deleteFolder(node.id);
    else await deleteDocument(node.id);
    if (activeGone) onActiveDeleted();
  };

  const menuFor = (node: TreeNode): MenuItem[] =>
    node.kind === 'folder'
      ? [
          { label: 'New document', icon: 'file', onSelect: () => void newDocument(node.id) },
          { label: 'New folder', icon: 'folder', onSelect: () => void newFolder(node.id) },
          'separator',
          { label: 'Rename', icon: 'pencil', onSelect: () => setRenamingId(node.id) },
          { label: 'Move to…', onSelect: () => setDialog({ kind: 'move', node }) },
          'separator',
          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', node }) },
        ]
      : [
          { label: 'Rename', icon: 'pencil', onSelect: () => setRenamingId(node.id) },
          { label: 'Duplicate', icon: 'copy', onSelect: () => void run(async () => onOpen((await duplicateDocument(node.id)).id)) },
          { label: 'Move to…', onSelect: () => setDialog({ kind: 'move', node }) },
          'separator',
          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', node }) },
        ];

  const canDrop = (targetId: string | null) => dragging !== null && canMoveTo(dragging, targetId, folders);
  const endDrag = () => {
    setDragging(null);
    setDropTarget(undefined);
  };
  const dragOver = (targetId: string | null) => (event: DragEvent) => {
    if (!canDrop(targetId)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(targetId);
  };
  const drop = (targetId: string | null) => (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const node = dragging;
    endDrag();
    if (node && canMoveTo(node, targetId, folders)) void run(() => move(node, targetId));
  };

  return (
    <div className="tree">
      <div className="tree-head">
        <h2>Files</h2>
        <div className="tree-head-actions">
          <IconButton icon="plus" label="New document" onClick={() => void newDocument(null)} />
          <IconButton icon="folder" label="New folder" onClick={() => void newFolder(null)} />
        </div>
      </div>

      {error && (
        <div className="tree-message">
          <Callout tone="danger">{error}</Callout>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="file"
          title="No documents yet"
          action={
            <Button variant="primary" icon="plus" onClick={() => void newDocument(null)}>
              Create document
            </Button>
          }
        >
          Create a document to start writing.
        </EmptyState>
      ) : (
        <div
          className={cx('tree-rows', dropTarget === null && 'is-drop-root')}
          role="tree"
          aria-label="Files"
          onDragOver={dragOver(null)}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDropTarget(undefined);
          }}
          onDrop={drop(null)}
        >
          {rows.map((node) =>
            node.id === renamingId ? (
              <RenameField
                key={node.id}
                name={node.name}
                depth={node.depth}
                onCancel={() => setRenamingId(null)}
                onCommit={async (value) => {
                  if (node.kind === 'folder') await renameFolder(node.id, value);
                  else await renameDocument(node.id, value);
                  setRenamingId(null);
                }}
              />
            ) : (
              <TreeItem
                key={node.id}
                kind={node.kind}
                name={node.name}
                depth={node.depth}
                open={node.kind === 'folder' ? open.has(node.id) : undefined}
                active={node.kind === 'file' && node.id === activeDocId}
                dropTarget={node.kind === 'folder' && dropTarget === node.id}
                onClick={() => (node.kind === 'folder' ? toggleFolder(node.id) : onOpen(node.id))}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer?.setData('text/plain', node.name);
                  setDragging(node);
                }}
                onDragEnd={endDrag}
                onDragOver={node.kind === 'folder' ? dragOver(node.id) : undefined}
                onDrop={node.kind === 'folder' ? drop(node.id) : undefined}
                trailing={<MenuButton size="sm" label={`Actions for ${node.name}`} items={menuFor(node)} />}
              />
            ),
          )}
        </div>
      )}

      {dialog?.kind === 'move' && (
        <MoveDialog node={dialog.node} folders={folders} onClose={() => setDialog(null)} onMove={(targetId) => move(dialog.node, targetId).then(() => undefined)} />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={dialog.node.kind === 'folder' ? 'Delete folder' : 'Delete document'}
          message={deleteMessage(dialog.node, dialog.node.kind === 'folder' ? folderContents(dialog.node.id, folders, documents) : undefined)}
          confirmLabel={dialog.node.kind === 'folder' ? 'Delete folder' : 'Delete document'}
          onClose={() => setDialog(null)}
          onConfirm={() => remove(dialog.node)}
        />
      )}
    </div>
  );
}
