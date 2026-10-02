import { encodeSegment } from '../paths';
import { addImageFiles, checkImageFile, findOrCreateFolder, userMessage } from '../store';

/** `![alt](href)`, with the file name (no extension) as alt text. */
export function imageMarkdown(name: string, href: string): string {
  const alt = name.replace(/\.[^.]+$/, '').replace(/[[\]\\]/g, '\\$&');
  return `![${alt}](${href})`;
}

/**
 * Store dropped, pasted or picked files in an `images` folder next to the document (created on first use, any case)
 * and return the Markdown to insert plus every error, in file order. No folder is created if every file is refused.
 */
export async function addImagesNextTo(projectId: string, docFolderId: string | null, files: readonly File[]): Promise<{ markdown: string; errors: string[] }> {
  const errors: string[] = [];
  const valid = files.filter((file) => {
    try {
      checkImageFile(file.name, file.type, file.size);
      return true;
    } catch (error) {
      errors.push(userMessage(error));
      return false;
    }
  });
  if (valid.length === 0) return { markdown: '', errors };
  try {
    const folder = await findOrCreateFolder(projectId, docFolderId, 'images');
    const result = await addImageFiles(projectId, folder.id, valid);
    const markdown = result.added.map((image) => imageMarkdown(image.name, `${encodeSegment(folder.name)}/${encodeSegment(image.name)}`)).join('\n\n');
    return { markdown, errors: [...errors, ...result.errors] };
  } catch (error) {
    return { markdown: '', errors: [...errors, userMessage(error)] };
  }
}
