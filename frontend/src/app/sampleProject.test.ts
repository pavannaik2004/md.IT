import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '../renderer';
import { clearDatabase, getDocument, getImageBytes, getProject, listDocuments, listFolders, listImages } from '../store';
import { createSampleProject, SAMPLE_PROJECT_NAME, sampleProjectData } from './sampleProject';

beforeEach(async () => {
  await clearDatabase();
});

describe('sample project', () => {
  it('creates the tour project with its folders, documents and image', async () => {
    const { projectId: id, startDocId } = await createSampleProject();
    expect((await getProject(id))?.name).toBe(SAMPLE_PROJECT_NAME);
    expect((await getDocument(startDocId!))?.title).toBe('Start here.md');
    const folders = await listFolders(id);
    expect(folders.map((f) => f.name).sort()).toEqual(['Guides', 'images']);
    const documents = await listDocuments(id);
    expect(documents.map((d) => d.title).sort()).toEqual(['Code and math.md', 'Images.md', 'Start here.md', 'Writing.md']);
    const [image] = await listImages(id);
    expect(image?.name).toBe('pipeline.svg');
    const bytes = await getImageBytes(image!.id);
    expect(new TextDecoder().decode(bytes!)).toContain('<svg');
  });

  it('can be created twice', async () => {
    const first = await createSampleProject();
    const second = await createSampleProject();
    expect(second.projectId).not.toBe(first.projectId);
  });

  it.each(sampleProjectData().documents.map((d) => [d.title, d.content]))('renders %s without errors', (_title, content) => {
    const html = render(content);
    expect(html).not.toContain('md-render-error');
    expect(html).not.toContain('md-math-error');
  });
});
