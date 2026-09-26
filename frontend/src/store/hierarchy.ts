type FolderLink = { id: string; parentFolderId: string | null };

export function descendantFolderIds(folders: readonly FolderLink[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parentFolderId === null) continue;
    const list = children.get(folder.parentFolderId) ?? [];
    list.push(folder.id);
    children.set(folder.parentFolderId, list);
  }
  const result: string[] = [];
  const stack = [...(children.get(rootId) ?? [])];
  const seen = new Set<string>([rootId]);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return result;
}

export function ancestorFolderIds(folders: readonly FolderLink[], folderId: string | null): string[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const result: string[] = [];
  const seen = new Set<string>();
  let current = folderId;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    result.push(current);
    current = byId.get(current)?.parentFolderId ?? null;
  }
  return result;
}
