import { describe, expect, it } from 'vitest';
import type { Folder, ImageAsset, MdDocument } from '../store';
import { buildTree, flattenVisible, folderContents, moveTargets } from './buildTree';

const folder = (id: string, parentFolderId: string | null, name: string): Folder => ({ id, projectId: 'p', parentFolderId, name, createdAt: 0, updatedAt: 0 });
const doc = (id: string, folderId: string | null, title: string): MdDocument => ({ id, projectId: 'p', folderId, title, content: '', dirty: true, createdAt: 0, updatedAt: 0 });

const folders = [folder('f1', null, 'b-folder'), folder('f2', null, 'A-folder'), folder('f3', 'f1', 'inner')];
const documents = [doc('d1', null, 'z.md'), doc('d2', 'f1', 'c.md'), doc('d3', null, 'a.md'), doc('d4', 'f3', 'deep.md')];

describe('buildTree', () => {
  it('puts folders first, sorts case-insensitively, and nests with depth', () => {
    const tree = buildTree(folders, documents);
    expect(tree.map((n) => n.name)).toEqual(['A-folder', 'b-folder', 'a.md', 'z.md']);
    const b = tree[1]!;
    expect(b.kind === 'folder' && b.children.map((n) => `${n.name}@${n.depth}`)).toEqual(['inner@1', 'c.md@1']);
  });

  it('sorts numbers naturally', () => {
    const tree = buildTree([], [doc('1', null, 'Part 10.md'), doc('2', null, 'Part 2.md')]);
    expect(tree.map((n) => n.name)).toEqual(['Part 2.md', 'Part 10.md']);
  });

  it('shows children only of open folders', () => {
    const tree = buildTree(folders, documents);
    expect(flattenVisible(tree, new Set()).map((n) => n.name)).toEqual(['A-folder', 'b-folder', 'a.md', 'z.md']);
    expect(flattenVisible(tree, new Set(['f1'])).map((n) => n.name)).toEqual(['A-folder', 'b-folder', 'inner', 'c.md', 'a.md', 'z.md']);
  });

  it('keeps items whose parent folder is missing at the root instead of hiding them', () => {
    const tree = buildTree([], [doc('x', 'ghost', 'orphan.md')]);
    expect(tree.map((n) => n.name)).toEqual(['orphan.md']);
  });
});

describe('moveTargets', () => {
  it('excludes a folder, its descendants and its current parent', () => {
    expect(moveTargets({ kind: 'folder', id: 'f1', parentId: null }, folders).map((t) => t.id)).toEqual(['f2']);
  });

  it('offers the root and every other folder for a document', () => {
    const targets = moveTargets({ kind: 'file', id: 'd2', parentId: 'f1' }, folders);
    expect(targets.map((t) => t.id)).toEqual([null, 'f2', 'f3']);
    expect(targets[0]).toEqual({ id: null, label: 'Project root', depth: 0 });
    expect(targets.find((t) => t.id === 'f3')?.depth).toBe(2);
  });
});

describe('folderContents', () => {
  it('counts nested folders and documents', () => {
    expect(folderContents('f1', folders, documents)).toEqual({ folders: 1, documents: 2, images: 0 });
  });
});

describe('images in the tree', () => {
  const image = (id: string, folderId: string | null, name: string): ImageAsset => ({
    id, projectId: 'p', folderId, name, contentType: 'image/png', size: 1, sha256: '', createdAt: 0, updatedAt: 0,
  });

  it('lists images among files, sorted by name, after folders', () => {
    const tree = buildTree([folder('f', null, 'Z folder')], [doc('d', null, 'b.md')], [image('i', null, 'a.png'), image('j', 'f', 'inner.png')]);
    expect(tree.map((node) => [node.kind, node.name])).toEqual([['folder', 'Z folder'], ['image', 'a.png'], ['file', 'b.md']]);
    const top = tree[0]!;
    expect(top.kind === 'folder' && top.children.map((node) => node.name)).toEqual(['inner.png']);
  });

  it('counts images inside a folder', () => {
    expect(folderContents('f', [folder('f', null, 'F')], [], [image('i', 'f', 'a.png'), image('j', null, 'b.png')])).toEqual({ folders: 0, documents: 0, images: 1 });
  });
});
