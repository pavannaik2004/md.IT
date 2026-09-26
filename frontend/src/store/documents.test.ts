import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import {
  createDocument, deleteDocument, duplicateDocument, getDocument, listDocuments, moveDocument, renameDocument, saveDocumentContent,
} from './documents';
import { InvalidMoveError, NameConflictError, NotFoundError } from './errors';
import { createFolder } from './folders';
import { createProject } from './projects';

beforeEach(clearDatabase);

async function setup() {
  return (await createProject('OS')).id;
}

describe('documents', () => {
  it('creates "Untitled.md", then "Untitled 2.md"', async () => {
    const pid = await setup();
    expect((await createDocument(pid, null)).title).toBe('Untitled.md');
    expect((await createDocument(pid, null)).title).toBe('Untitled 2.md');
  });

  it('adds .md to a given title and starts empty', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null, 'Processes');
    expect(doc).toMatchObject({ title: 'Processes.md', content: '', folderId: null, dirty: true });
  });

  it('rejects names that differ only by case or spaces', async () => {
    const pid = await setup();
    await createDocument(pid, null, 'Notes');
    await expect(createDocument(pid, null, '  notes.md ')).rejects.toBeInstanceOf(NameConflictError);
  });

  it('shares the namespace with folders', async () => {
    const pid = await setup();
    await createFolder(pid, null, 'Notes.md');
    await expect(createDocument(pid, null, 'Notes')).rejects.toBeInstanceOf(NameConflictError);
  });

  it('renames, keeping the .md extension', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null, 'A');
    expect((await renameDocument(doc.id, 'Threads')).title).toBe('Threads.md');
  });

  it('duplicates as "X copy.md" with the same content', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null, 'Threads');
    await saveDocumentContent(doc.id, '# Threads');
    const copy = await duplicateDocument(doc.id);
    expect(copy).toMatchObject({ title: 'Threads copy.md', content: '# Threads', folderId: null });
    expect((await duplicateDocument(doc.id)).title).toBe('Threads copy 2.md');
  });

  it('saves content and marks the document dirty', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null);
    await saveDocumentContent(doc.id, 'hello');
    expect(await getDocument(doc.id)).toMatchObject({ content: 'hello', dirty: true });
  });

  it('refuses to save a document that was deleted', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null);
    await deleteDocument(doc.id);
    await expect(saveDocumentContent(doc.id, 'late')).rejects.toBeInstanceOf(NotFoundError);
    expect(await getDocument(doc.id)).toBeNull();
  });

  it('moves between root and folders', async () => {
    const pid = await setup();
    const folder = await createFolder(pid, null, 'Scheduling');
    const doc = await createDocument(pid, null, 'RR');
    expect((await moveDocument(doc.id, folder.id)).folderId).toBe(folder.id);
    expect((await moveDocument(doc.id, null)).folderId).toBeNull();
  });

  it('rejects a move into a folder with a same-named item', async () => {
    const pid = await setup();
    const folder = await createFolder(pid, null, 'Scheduling');
    await createDocument(pid, folder.id, 'RR');
    const doc = await createDocument(pid, null, 'rr');
    await expect(moveDocument(doc.id, folder.id)).rejects.toBeInstanceOf(NameConflictError);
    expect((await getDocument(doc.id))?.folderId).toBeNull();
  });

  it('refuses to create in a folder of another project', async () => {
    const pid = await setup();
    const other = await createProject('Other');
    const foreign = await createFolder(other.id, null, 'F');
    await expect(createDocument(pid, foreign.id)).rejects.toBeInstanceOf(InvalidMoveError);
  });

  it('lists only the project’s documents', async () => {
    const pid = await setup();
    const other = await createProject('Other');
    await createDocument(pid, null, 'Mine');
    await createDocument(other.id, null, 'Theirs');
    expect((await listDocuments(pid)).map((d) => d.title)).toEqual(['Mine.md']);
  });
});
