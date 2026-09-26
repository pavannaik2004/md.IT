import { ancestorFolderIds, descendantFolderIds, type Folder, type ImageAsset, type MdDocument } from '../store';

export type TreeNode =
  | { kind: 'folder'; id: string; name: string; parentId: string | null; depth: number; children: TreeNode[] }
  | { kind: 'file' | 'image'; id: string; name: string; parentId: string | null; depth: number };

export type NodeRef = Pick<TreeNode, 'kind' | 'id' | 'parentId'>;

export interface MoveTarget {
  id: string | null;
  label: string;
  depth: number;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const byName = (a: { name: string }, b: { name: string }) => collator.compare(a.name, b.name);

export function buildTree(folders: readonly Folder[], documents: readonly MdDocument[], images: readonly ImageAsset[] = []): TreeNode[] {
  const known = new Set(folders.map((f) => f.id));
  // An item whose parent is missing (should not happen) is shown at the root rather than lost.
  const parentOf = (id: string | null) => (id !== null && known.has(id) ? id : null);

  const build = (parentId: string | null, depth: number, seen: Set<string>): TreeNode[] => {
    const childFolders = folders
      .filter((f) => parentOf(f.parentFolderId) === parentId && !seen.has(f.id))
      .sort(byName)
      .map((f): TreeNode => ({
        kind: 'folder', id: f.id, name: f.name, parentId, depth,
        children: build(f.id, depth + 1, new Set([...seen, f.id])),
      }));
    const childFiles: TreeNode[] = [
      ...documents.filter((d) => parentOf(d.folderId) === parentId).map((d) => ({ kind: 'file' as const, id: d.id, name: d.title, parentId, depth })),
      ...images.filter((i) => parentOf(i.folderId) === parentId).map((i) => ({ kind: 'image' as const, id: i.id, name: i.name, parentId, depth })),
    ].sort(byName);
    return [...childFolders, ...childFiles];
  };
  return build(null, 0, new Set());
}

export function flattenVisible(nodes: readonly TreeNode[], open: ReadonlySet<string>): TreeNode[] {
  const rows: TreeNode[] = [];
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      rows.push(node);
      if (node.kind === 'folder' && open.has(node.id)) walk(node.children);
    }
  };
  walk(nodes);
  return rows;
}

export function moveTargets(node: NodeRef, folders: readonly Folder[]): MoveTarget[] {
  const excluded = new Set<string>(node.kind === 'folder' ? [node.id, ...descendantFolderIds(folders, node.id)] : []);
  const all = flattenVisible(buildTree(folders, []), new Set(folders.map((f) => f.id)));
  const targets: MoveTarget[] = [{ id: null, label: 'Project root', depth: 0 }];
  for (const row of all) {
    if (!excluded.has(row.id)) targets.push({ id: row.id, label: row.name, depth: row.depth + 1 });
  }
  return targets.filter((target) => target.id !== node.parentId);
}

export function canMoveTo(node: NodeRef, targetId: string | null, folders: readonly Folder[]): boolean {
  return moveTargets(node, folders).some((target) => target.id === targetId);
}

export function folderContents(folderId: string, folders: readonly Folder[], documents: readonly MdDocument[], images: readonly ImageAsset[] = []) {
  const nested = descendantFolderIds(folders, folderId);
  const inside = new Set([folderId, ...nested]);
  const within = (parent: string | null) => parent !== null && inside.has(parent);
  return {
    folders: nested.length,
    documents: documents.filter((d) => within(d.folderId)).length,
    images: images.filter((i) => within(i.folderId)).length,
  };
}

export function isInsideFolder(document: MdDocument | undefined, folderId: string, folders: readonly Folder[]): boolean {
  return document !== undefined && ancestorFolderIds(folders, document.folderId).includes(folderId);
}
