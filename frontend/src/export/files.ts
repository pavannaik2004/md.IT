const RESERVED = '\\/:*?"<>|';
const MAX_LENGTH = 120;

/** A name every common file system accepts: reserved and control characters become "-". */
export function safeFileName(name: string): string {
  const replaced = Array.from(name, (ch) => (ch.charCodeAt(0) < 32 || RESERVED.includes(ch) ? '-' : ch)).join('');
  return replaced.trim().slice(0, MAX_LENGTH).replace(/^\.+/, '') || 'untitled';
}

export function fileStem(title: string): string {
  return title.replace(/\.md$/i, '');
}
