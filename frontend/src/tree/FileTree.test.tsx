import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addImage, clearDatabase, createDocument, createFolder, createProject, getDocument, listDocuments, listImages } from '../store';
import { FileTree, type FileTreeProps } from './FileTree';

beforeEach(clearDatabase);

function renderTree(projectId: string, activeDocId?: string, extra: Partial<FileTreeProps> = {}) {
  const onOpen = vi.fn();
  const onActiveDeleted = vi.fn();
  render(<FileTree projectId={projectId} activeDocId={activeDocId} onOpen={onOpen} onActiveDeleted={onActiveDeleted} {...extra} />);
  return { onOpen, onActiveDeleted };
}

const png = (name: string) => ({ name, type: 'image/png', bytes: new TextEncoder().encode('x').buffer as ArrayBuffer });

describe('FileTree', () => {
  it('reveals an item that search asked for', async () => {
    const project = await createProject('OS');
    const outer = await createFolder(project.id, null, 'Outer');
    const inner = await createFolder(project.id, outer.id, 'Inner');
    const image = await addImage(project.id, inner.id, png('pic.png'));
    const onRevealed = vi.fn();
    renderTree(project.id, undefined, { revealId: image.id, onRevealed });
    const row = await screen.findByRole('treeitem', { name: 'pic.png' });
    await waitFor(() => expect(row).toHaveFocus());
    expect(onRevealed).toHaveBeenCalled();
  });

  it('creates a document from the empty state and names it', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const { onOpen } = renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Create document' }));
    const input = await screen.findByRole('textbox', { name: 'Rename Untitled.md' });
    await user.clear(input);
    await user.type(input, 'Processes{Enter}');
    expect(await screen.findByRole('treeitem', { name: 'Processes.md' })).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens a document on click', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const doc = await createDocument(project.id, null, 'Threads');
    const { onOpen } = renderTree(project.id);
    await user.click(await screen.findByRole('treeitem', { name: 'Threads.md' }));
    expect(onOpen).toHaveBeenCalledWith(doc.id);
  });

  it('creates a document inside a folder from the folder’s menu and opens the folder', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createFolder(project.id, null, 'Scheduling');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Scheduling' }));
    await user.click(screen.getByRole('menuitem', { name: 'New document' }));
    await screen.findByRole('textbox', { name: 'Rename Untitled.md' });
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('treeitem', { name: 'Untitled.md' })).toHaveAttribute('aria-level', '2');
    expect(screen.getByRole('treeitem', { name: 'Scheduling' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('rejects a duplicate name inline', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'Processes');
    await createDocument(project.id, null, 'Threads');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Threads.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename Threads.md' });
    await user.clear(input);
    await user.type(input, 'processes.md{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('“processes.md” already exists here.');
  });

  it('cancels a rename with Escape', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'Threads');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Threads.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    await user.type(screen.getByRole('textbox', { name: 'Rename Threads.md' }), 'xyz{Escape}');
    expect(await screen.findByRole('treeitem', { name: 'Threads.md' })).toBeInTheDocument();
  });

  it('duplicates a document', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'Threads');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Threads.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(await screen.findByRole('treeitem', { name: 'Threads copy.md' })).toBeInTheDocument();
  });

  it('confirms before deleting a folder, reports what goes with it, and closes the open document inside', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    const inner = await createFolder(project.id, folder.id, 'Old');
    const active = await createDocument(project.id, folder.id, 'A');
    await createDocument(project.id, inner.id, 'B');
    const { onActiveDeleted } = renderTree(project.id, active.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Scheduling' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “Scheduling” and the 2 documents and 1 folder inside it? This can’t be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete folder' }));
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'Scheduling' })).not.toBeInTheDocument());
    expect(onActiveDeleted).toHaveBeenCalledTimes(1);
    expect(await listDocuments(project.id)).toHaveLength(0);
  });

  it('moves a document with Move to…', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    const doc = await createDocument(project.id, null, 'RR');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for RR.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    await user.click(screen.getByRole('radio', { name: 'Scheduling' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(async () => expect((await getDocument(doc.id))?.folderId).toBe(folder.id));
  });

  it('shows a conflict when moving onto a same-named item and moves nothing', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    await createDocument(project.id, folder.id, 'RR');
    const doc = await createDocument(project.id, null, 'RR');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for RR.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    await user.click(screen.getByRole('radio', { name: 'Scheduling' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('“RR.md” already exists here.');
    expect((await getDocument(doc.id))?.folderId).toBeNull();
  });

  it('moves a document by dragging it onto a folder', async () => {
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    const doc = await createDocument(project.id, null, 'RR');
    renderTree(project.id);
    const row = await screen.findByRole('treeitem', { name: 'RR.md' });
    const target = screen.getByRole('treeitem', { name: 'Scheduling' });
    fireEvent.dragStart(row);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(async () => expect((await getDocument(doc.id))?.folderId).toBe(folder.id));
  });

  it('dropping onto a document moves the item into that document’s folder, not the root', async () => {
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    const inside = await createDocument(project.id, folder.id, 'Inside');
    const doc = await createDocument(project.id, null, 'RR');
    renderTree(project.id, inside.id); // active document keeps the folder open
    const row = await screen.findByRole('treeitem', { name: 'RR.md' });
    const target = await screen.findByRole('treeitem', { name: 'Inside.md' });
    fireEvent.dragStart(row);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(async () => expect((await getDocument(doc.id))?.folderId).toBe(folder.id));
  });
});

describe('FileTree images', () => {
  it('lists images with files and does not open anything on click', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'B');
    await addImage(project.id, null, png('a.png'));
    const { onOpen } = renderTree(project.id);
    await user.click(await screen.findByRole('treeitem', { name: 'a.png' }));
    expect(screen.getAllByRole('treeitem').map((row) => row.getAttribute('aria-label'))).toEqual(['a.png', 'B.md']);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('inserts an image into the open document from its menu', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await addImage(project.id, null, png('a.png'));
    const onInsertImage = vi.fn();
    renderTree(project.id, undefined, { onInsertImage });
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    await user.click(screen.getByRole('menuitem', { name: 'Insert in document' }));
    expect(onInsertImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.png' }));
  });

  it('disables Insert in document when no document is open', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await addImage(project.id, null, png('a.png'));
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    expect(screen.getByRole('menuitem', { name: 'Insert in document' })).toBeDisabled();
  });

  it('renames an image, keeping its extension', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await addImage(project.id, null, png('a.png'));
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename a.png' });
    await user.clear(input);
    await user.type(input, 'diagram{Enter}');
    expect(await screen.findByRole('treeitem', { name: 'diagram.png' })).toBeInTheDocument();
  });

  it('deletes an image after confirming', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await addImage(project.id, null, png('a.png'));
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “a.png”? This can’t be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete image' }));
    await waitFor(async () => expect(await listImages(project.id)).toEqual([]));
  });

  it('counts images when deleting a folder', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    await createDocument(project.id, folder.id, 'A');
    await addImage(project.id, folder.id, png('a.png'));
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Scheduling' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “Scheduling” and the 1 document and 1 image inside it? This can’t be undone.');
  });

  it('moves an image by dragging it onto a folder', async () => {
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Pics');
    const image = await addImage(project.id, null, png('a.png'));
    renderTree(project.id);
    const row = await screen.findByRole('treeitem', { name: 'a.png' });
    const target = screen.getByRole('treeitem', { name: 'Pics' });
    fireEvent.dragStart(row);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(async () => expect((await listImages(project.id)).find((i) => i.id === image.id)?.folderId).toBe(folder.id));
  });

  it('adds image files dropped from the computer onto a folder', async () => {
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Pics');
    renderTree(project.id);
    const target = await screen.findByRole('treeitem', { name: 'Pics' });
    const files = [new File(['x'], 'Shot 1.png', { type: 'image/png' })];
    fireEvent.dragOver(target, { dataTransfer: { types: ['Files'], files } });
    fireEvent.drop(target, { dataTransfer: { types: ['Files'], files } });
    expect(await screen.findByRole('treeitem', { name: 'shot-1.png' })).toBeInTheDocument();
    expect((await listImages(project.id))[0]?.folderId).toBe(folder.id);
  });

  it('reports dropped files it could not add', async () => {
    const project = await createProject('OS');
    await createDocument(project.id, null, 'A');
    renderTree(project.id);
    const tree = await screen.findByRole('tree', { name: 'Files' });
    const files = [new File(['x'], 'notes.txt', { type: 'text/plain' })];
    fireEvent.dragOver(tree, { dataTransfer: { types: ['Files'], files } });
    fireEvent.drop(tree, { dataTransfer: { types: ['Files'], files } });
    expect(await screen.findByText('“notes.txt” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).')).toBeInTheDocument();
  });

  it('shows a thumbnail after hovering an image', async () => {
    const project = await createProject('OS');
    const image = await addImage(project.id, null, png('a.png'));
    renderTree(project.id, undefined, { imageUrls: new Map([[image.id, 'blob:test/thumb']]) });
    const row = await screen.findByRole('treeitem', { name: 'a.png' });
    fireEvent.mouseEnter(row);
    const tip = await screen.findByRole('tooltip', {}, { timeout: 1500 });
    expect(tip.querySelector('img')?.getAttribute('src')).toBe('blob:test/thumb');
    expect(tip).toHaveTextContent('1 byte');
    fireEvent.mouseLeave(row);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
