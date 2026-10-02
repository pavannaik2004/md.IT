import { ValidationError } from './errors';

const MAX_NAME_LENGTH = 200;

export function normalizeName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new ValidationError('Name can’t be empty.');
  if (name.includes('/') || name.includes('\\')) throw new ValidationError('Names can’t contain / or \\.');
  if (name === '.' || name === '..') throw new ValidationError('Choose a name other than . or ..');
  if (name.length > MAX_NAME_LENGTH) throw new ValidationError(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  return name;
}

export function withMdExtension(name: string): string {
  return /\.md$/i.test(name) ? name : `${name}.md`;
}

export function stripMdExtension(name: string): string {
  return name.replace(/\.md$/i, '');
}

export function nameKey(name: string): string {
  return name.toLocaleLowerCase();
}

/** "Untitled.md", then "Untitled 2.md", … — the first not in `taken`. Images use "-" ("a-2.png"). */
export function nextAvailableName(stem: string, ext: string, taken: readonly string[], separator = ' '): string {
  const used = new Set(taken.map(nameKey));
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${stem}${ext}` : `${stem}${separator}${n}${ext}`;
    if (!used.has(nameKey(candidate))) return candidate;
  }
}
