import { useEffect, useRef, useState, type DragEvent, type FocusEvent, type MouseEvent } from 'react';
import { ConfirmDialog } from '../dialogs';
import {
  addImageFiles, ancestorFolderIds, createDocument, createFolder, deleteDocument, deleteFolder, deleteImage, duplicateDocument,
  moveDocument, moveFolder, moveImage, renameDocument, renameFolder, renameImage, useDocuments, useFolders, useImages, userMessage,
  type ImageAsset,
} from '../store';
import { Button, Callout, EmptyState, IconButton, MenuButton, TreeItem, cx, type MenuItem } from '../ui';
import { buildTree, canMoveTo, flattenVisible, folderContents, isInsideFolder, type TreeNode } from './buildTree';
import { ImageThumb } from './ImageThumb';
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
  /** Insert a reference to this image into the open document; omit when no document is open. */
  onInsertImage?: (image: ImageAsset) => void;
  /** Object URLs by image id, for hover thumbnails. */
  imageUrls?: ReadonlyMap<string, string>;
}

type TreeDialog = { kind: 'move'; node: TreeNode } | { kind: 'delete'; node: TreeNode } | null;
/** undefined = no drop target; null = project root. */
type DropTarget = string | null | undefined;

const DELETE_LABEL = { folder: 'Delete folder', file: 'Delete document', image: 'Delete image' } as const;
const THUMB_DELAY = 400;

function withAll(set: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  return ids.every((id) => set.has(id)) ? set : new Set([...set, ...ids]);
}

/** Files dragged in from the computer (not a row being moved). */
function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export function FileTree({ projectId, activeDocId, onOpen, onActiveDeleted, onInsertImage, imageUrls }: FileTreeProps) {
  const folders = useFolders(projectId);
  const documents = useDocuments(projectId);
  const images = useImages(projectId);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<TreeDialog>(null);
  const [dragging, setDragging] = useState<TreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [thumb, setThumb] = useState<{ id: string; rect: DOMRect } | null>(null);
  const thumbTimer = useRef<number | undefined>(undefined);

  const openFolders = (ids: readonly string[]) => setOpen((prev) => withAll(prev, ids));

  // Keep the active document visible.
  useEffect(() => {
    if (!activeDocId || !folders || !documents) return;
    const doc = documents.find((d) => d.id === activeDocId);
    if (doc) setOpen((prev) => withAll(prev, ancestorFolderIds(folders, doc.folderId)));
  }, [activeDocId, folders, documents]);

  useEffect(() => () => window.clearTimeout(thumbTimer.current), []);

  if (!folders || !documents || !images) return null;

  const rows = flattenVisible(buildTree(folders, documents, images), open);

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
    node.kind === 'folder' ? moveFolder(node.id, targetId) : node.kind === 'image' ? moveImage(node.id, targetId) : moveDocument(node.id, targetId);

  const rename = (node: TreeNode, value: string) =>
    node.kind === 'folder' ? renameFolder(node.id, value) : node.kind === 'image' ? renameImage(node.id, value) : renameDocument(node.id, value);

  const remove = async (node: TreeNode) => {
    const active = documents.find((d) => d.id === activeDocId);
    const activeGone = node.kind === 'file' ? node.id === activeDocId : node.kind === 'folder' && isInsideFolder(active, node.id, folders);
    if (node.kind === 'folder') await deleteFolder(node.id);
    else if (node.kind === 'image') await deleteImage(node.id);
    else await deleteDocument(node.id);
    if (activeGone) onActiveDeleted();
  };

  const addFiles = (folderId: string | null, files: File[]) =>
    run(async () => {
      const { errors } = await addImageFiles(projectId, folderId, files);
      if (folderId) openFolders([folderId]);
      if (errors.length > 0) setError(errors.join(' '));
    });

  const showThumbLater = (id: string) => (event: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    window.clearTimeout(thumbTimer.current);
    const rect = event.currentTarget.getBoundingClientRect();
    thumbTimer.current = window.setTimeout(() => setThumb({ id, rect }), THUMB_DELAY);
  };
  const hideThumb = () => {
    window.clearTimeout(thumbTimer.current);
    setThumb(null);
  };

  const menuFor = (node: TreeNode): MenuItem[] => {
    const tail: MenuItem[] = [
      { label: 'Move to…', onSelect: () => setDialog({ kind: 'move', node }) },
      'separator',
      { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', node }) },
    ];
    const renameItem: MenuItem = { label: 'Rename', icon: 'pencil', onSelect: () => setRenamingId(node.id) };
    if (node.kind === 'folder') {
      return [
        { label: 'New document', icon: 'file', onSelect: () => void newDocument(node.id) },
        { label: 'New folder', icon: 'folder', onSelect: () => void newFolder(node.id) },
        'separator',
        renameItem,
        ...tail,
      ];
    }
    if (node.kind === 'image') {
      const insert = () => {
        const image = images.find((i) => i.id === node.id);
        if (image) onInsertImage?.(image);
      };
      return [{ label: 'Insert in document', icon: 'image', disabled: !onInsertImage, onSelect: insert }, 'separator', renameItem, ...tail];
    }
    return [
      renameItem,
      { label: 'Duplicate', icon: 'copy', onSelect: () => void run(async () => onOpen((await duplicateDocument(node.id)).id)) },
      ...tail,
    ];
  };

  const canDrop = (targetId: string | null) => dragging !== null && canMoveTo(dragging, targetId, folders);
  const endDrag = () => {
    setDragging(null);
    setDropTarget(undefined);
  };
  const dragOver = (targetId: string | null) => (event: DragEvent) => {
    const fromComputer = dragging === null && hasFiles(event);
    if (!fromComputer && !canDrop(targetId)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(targetId);
  };
  const drop = (targetId: string | null) => (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const node = dragging;
    endDrag();
    if (node) {
      if (canMoveTo(node, targetId, folders)) void run(() => move(node, targetId));
      return;
    }
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) void addFiles(targetId, files);
  };

  const thumbImage = thumb ? images.find((i) => i.id === thumb.id) : undefined;
  const thumbUrl = thumb ? imageUrls?.get(thumb.id) : undefined;

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
                  await rename(node, value);
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
                onClick={node.kind === 'folder' ? () => toggleFolder(node.id) : node.kind === 'file' ? () => onOpen(node.id) : undefined}
                {...(node.kind === 'image'
                  ? { onMouseEnter: showThumbLater(node.id), onMouseLeave: hideThumb, onFocus: showThumbLater(node.id), onBlur: hideThumb }
                  : {})}
                draggable
                onDragStart={(event) => {
                  hideThumb();
                  event.dataTransfer?.setData('text/plain', node.name);
                  setDragging(node);
                }}
                onDragEnd={endDrag}
                // Dropping onto a document or image means "into the folder that holds it".
                onDragOver={dragOver(node.kind === 'folder' ? node.id : node.parentId)}
                onDrop={drop(node.kind === 'folder' ? node.id : node.parentId)}
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
          title={DELETE_LABEL[dialog.node.kind]}
          message={deleteMessage(dialog.node, dialog.node.kind === 'folder' ? folderContents(dialog.node.id, folders, documents, images) : undefined)}
          confirmLabel={DELETE_LABEL[dialog.node.kind]}
          onClose={() => setDialog(null)}
          onConfirm={() => remove(dialog.node)}
        />
      )}
      {thumb && thumbImage && thumbUrl && <ImageThumb anchor={thumb.rect} url={thumbUrl} size={thumbImage.size} />}
    </div>
  );
}
