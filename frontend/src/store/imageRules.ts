import { ValidationError } from './errors';
import type { ImageType } from './types';

/** Extensions per supported type; the first is used when a name has none. */
export const IMAGE_EXTENSIONS: Readonly<Record<ImageType, readonly string[]>> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** For <input type="file" accept>. */
export const IMAGE_ACCEPT = Object.keys(IMAGE_EXTENSIONS).join(',');

const TYPES = Object.keys(IMAGE_EXTENSIONS) as ImageType[];

export function extensionOf(name: string): string {
  const match = /\.[^./\\]+$/.exec(name);
  return match ? match[0].toLowerCase() : '';
}

/** The declared type wins; only an empty type falls back to the extension. */
export function imageTypeOf(name: string, type: string): ImageType | null {
  const declared = type.toLowerCase();
  if (declared !== '') return TYPES.includes(declared as ImageType) ? (declared as ImageType) : null;
  const ext = extensionOf(name);
  return TYPES.find((candidate) => IMAGE_EXTENSIONS[candidate].includes(ext)) ?? null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns the image type, or throws a ValidationError written for the user. */
export function checkImageFile(name: string, type: string, size: number): ImageType {
  const imageType = imageTypeOf(name, type);
  if (!imageType) throw new ValidationError(`“${name}” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).`);
  if (size > MAX_IMAGE_BYTES) throw new ValidationError(`“${name}” is ${formatSize(size)}; images can be up to 5 MB.`);
  return imageType;
}

/** "Screen Shot.PNG" → { stem: 'screen-shot', ext: '.png' }: no spaces, so inserted paths need no escaping. */
export function cleanImageName(name: string, type: ImageType): { stem: string; ext: string } {
  const given = extensionOf(name);
  const base = given ? name.slice(0, -given.length) : name;
  const stem =
    base
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/-{2,}/g, '-')
      .slice(0, 100)
      .replace(/^[-.]+|[-.]+$/g, '') || 'image';
  const allowed = IMAGE_EXTENSIONS[type];
  return { stem, ext: allowed.includes(given) ? given : allowed[0]! };
}

/** Renamed images keep an extension for their type, the way documents keep .md. */
export function withImageExtension(name: string, type: ImageType): string {
  return IMAGE_EXTENSIONS[type].includes(extensionOf(name)) ? name : `${name}${IMAGE_EXTENSIONS[type][0]}`;
}
