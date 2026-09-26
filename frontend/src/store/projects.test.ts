import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase } from './db';
import { NotFoundError, ValidationError } from './errors';
import { createProject, deleteProject, getProject, listProjectSummaries, renameProject, setProjectDescription } from './projects';

beforeEach(clearDatabase);

describe('projects', () => {
  it('creates a project with a trimmed name and empty description', async () => {
    const project = await createProject('  Operating Systems Notes ');
    expect(project).toMatchObject({ name: 'Operating Systems Notes', description: '' });
    expect(await getProject(project.id)).toEqual(project);
  });

  it('rejects an empty name', async () => {
    await expect(createProject('   ')).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns null for a project that is not stored', async () => {
    expect(await getProject('missing')).toBeNull();
  });

  it('renames, describes, and bumps updatedAt', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const project = await createProject('OS');
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const renamed = await renameProject(project.id, 'Operating systems');
    expect(renamed).toMatchObject({ name: 'Operating systems', updatedAt: 2000 });
    const described = await setProjectDescription(project.id, '  Lecture notes  ');
    expect(described.description).toBe('Lecture notes');
    vi.restoreAllMocks();
  });

  it('lists projects newest first with document counts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const older = await createProject('Older');
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const newer = await createProject('Newer');
    vi.restoreAllMocks();
    const summaries = await listProjectSummaries();
    expect(summaries.map((p) => p.id)).toEqual([newer.id, older.id]);
    expect(summaries[0]?.documentCount).toBe(0);
  });

  it('throws NotFoundError when renaming or deleting a missing project', async () => {
    await expect(renameProject('missing', 'x')).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteProject('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
