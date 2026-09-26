import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, createDocument, createFolder, createProject, getDocument, listDocuments } from '../store';
import { FileTree } from './FileTree';

beforeEach(clearDatabase);

function renderTree(projectId: string, activeDocId?: string) {
  const onOpen = vi.fn();
  const onActiveDeleted = vi.fn();
  render(<FileTree projectId={projectId} activeDocId={activeDocId} onOpen={onOpen} onActiveDeleted={onActiveDeleted} />);
  return { onOpen, onActiveDeleted };
}

describe('FileTree', () => {
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
