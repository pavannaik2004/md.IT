import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RENDERING } from '../settings';
import { clearDatabase, createDocument, createProject, saveDocumentContent } from '../store';
import { exportDocument, exportProject, type ExportEnv } from './actions';

beforeEach(clearDatabase);

function testEnv() {
  const saved: Array<{ name: string; blob: Blob }> = [];
  const env: ExportEnv = {
    save: (name, blob) => saved.push({ name, blob }),
    print: vi.fn(async () => {}),
    deps: { baseCss: '', mathCss: '', fontCss: '', fetchBytes: async () => new Uint8Array() },
  };
  return { saved, env };
}

async function setup() {
  const project = await createProject('OS');
  const doc = await createDocument(project.id, null, 'Intro');
  await saveDocumentContent(doc.id, 'saved text');
  return { project, doc };
}

describe('exportDocument', () => {
  it('saves the given text as Markdown, named after the document', async () => {
    const { project, doc } = await setup();
    const { saved, env } = testEnv();
    await exportDocument('markdown', { projectId: project.id, docId: doc.id, text: '# Typed', rendering: DEFAULT_RENDERING }, env);
    expect(saved[0]!.name).toBe('Intro.md');
    expect(saved[0]!.blob.type).toBe('text/markdown;charset=utf-8');
    expect(await saved[0]!.blob.text()).toBe('# Typed');
  });

  it('saves HTML with the given settings', async () => {
    const { project, doc } = await setup();
    const { saved, env } = testEnv();
    await exportDocument('html', { projectId: project.id, docId: doc.id, text: '# Typed', rendering: { ...DEFAULT_RENDERING, padding: 16 } }, env);
    expect(saved[0]!.name).toBe('Intro.html');
    const html = await saved[0]!.blob.text();
    expect(html).toContain('<title>Intro</title>');
    expect(html).toContain('--doc-padding: 16px');
  });

  it('prints PDF without copy buttons', async () => {
    const { project, doc } = await setup();
    const { env } = testEnv();
    await exportDocument('pdf', { projectId: project.id, docId: doc.id, text: '```js\nx\n```', rendering: DEFAULT_RENDERING }, env);
    expect(env.print).toHaveBeenCalledWith(expect.not.stringContaining('md-code-copy'), 'Intro');
  });

  it('says so when the document is gone', async () => {
    const { project } = await setup();
    const { env } = testEnv();
    await expect(exportDocument('markdown', { projectId: project.id, docId: 'nope', text: '', rendering: DEFAULT_RENDERING }, env)).rejects.toThrow(
      'This document no longer exists.',
    );
  });
});

describe('exportProject', () => {
  it('saves a zip named after the project', async () => {
    const { project } = await setup();
    const { saved, env } = testEnv();
    await exportProject(project.id, env);
    expect(saved[0]!.name).toBe('OS.zip');
    expect(saved[0]!.blob.type).toBe('application/zip');
    const files = unzipSync(new Uint8Array(await saved[0]!.blob.arrayBuffer()));
    expect(strFromU8(files['OS/Intro.md']!)).toBe('saved text');
  });
});
