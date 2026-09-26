import { db, now } from './db';
import { requireProject } from './guards';
import { newId } from './ids';
import { normalizeName } from './names';
import type { Project, ProjectSummary } from './types';

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await db.projects.orderBy('updatedAt').reverse().toArray();
  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      documentCount: await db.documents.where('projectId').equals(project.id).count(),
    })),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  return (await db.projects.get(id)) ?? null;
}

export async function createProject(name: string): Promise<Project> {
  const at = now();
  const project: Project = { id: newId(), name: normalizeName(name), description: '', createdAt: at, updatedAt: at };
  await db.projects.add(project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<Project> {
  const clean = normalizeName(name);
  return db.transaction('rw', db.projects, async () => {
    const project = await requireProject(id);
    const updated = { ...project, name: clean, updatedAt: now() };
    await db.projects.put(updated);
    return updated;
  });
}

export async function setProjectDescription(id: string, text: string): Promise<Project> {
  return db.transaction('rw', db.projects, async () => {
    const project = await requireProject(id);
    const updated = { ...project, description: text.trim(), updatedAt: now() };
    await db.projects.put(updated);
    return updated;
  });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.folders, db.documents, db.images], async () => {
    await requireProject(id);
    await db.documents.where('projectId').equals(id).delete();
    await db.folders.where('projectId').equals(id).delete();
    await db.images.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}
