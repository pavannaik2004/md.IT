import { listPhrase, plural } from '../lib/text';

export function deleteMessage(
  node: { kind: 'folder' | 'file' | 'image'; name: string },
  contents?: { folders: number; documents: number; images?: number },
): string {
  const parts: string[] = [];
  if (contents?.documents) parts.push(plural(contents.documents, 'document'));
  if (contents?.images) parts.push(plural(contents.images, 'image'));
  if (contents?.folders) parts.push(plural(contents.folders, 'folder'));
  const inside = parts.length > 0 ? ` and the ${listPhrase(parts)} inside it` : '';
  return `Delete “${node.name}”${inside}? This can’t be undone.`;
}
