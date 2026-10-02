import { toBase64 } from './base64';

export type FetchBytes = (url: string) => Promise<Uint8Array>;

const FONT_FACE = /@font-face\s*\{[^}]*\}/g;
const URL_REF = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const MIME: Record<string, string> = {
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
};

const mimeOf = (url: string) => MIME[(/\.([a-z0-9]+)(?:[?#].*)?$/i.exec(url)?.[1] ?? '').toLowerCase()] ?? 'application/octet-stream';

/** "U+0000-00FF, U+0131, U+1F??" → [[0, 255], [305, 305], [7936, 8191]] */
export function parseUnicodeRange(value: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const part of value.split(',')) {
    const token = part.trim().replace(/^u\+/i, '');
    if (token === '') continue;
    if (token.includes('?')) {
      ranges.push([parseInt(token.replace(/\?/g, '0'), 16), parseInt(token.replace(/\?/g, 'F'), 16)]);
      continue;
    }
    const [startHex = '', endHex = startHex] = token.split('-');
    const start = parseInt(startHex, 16);
    const end = parseInt(endHex.replace(/^u\+/i, ''), 16);
    if (Number.isFinite(start) && Number.isFinite(end)) ranges.push([start, end]);
  }
  return ranges;
}

/** Drop @font-face blocks whose unicode-range covers no character of `text` (P-035). */
export function pickFontFaces(css: string, text: string): string {
  const codePoints = new Set<number>();
  for (const ch of text) codePoints.add(ch.codePointAt(0)!);
  return css.replace(FONT_FACE, (block) => {
    const match = /unicode-range\s*:\s*([^;}]+)/i.exec(block);
    if (!match) return block;
    const ranges = parseUnicodeRange(match[1]!);
    for (const cp of codePoints) if (ranges.some(([a, b]) => cp >= a && cp <= b)) return block;
    return '';
  });
}

/** In `src:` lists keep only the woff2 sources: every browser that opens the export reads woff2. */
function keepWoff2(css: string): string {
  return css.replace(/src\s*:\s*([^;}]+)/gi, (decl, list: string) => {
    const sources = list.split(',').map((s) => s.trim());
    const woff2 = sources.filter((s) => /woff2/i.test(s));
    return woff2.length > 0 && woff2.length < sources.length ? `src: ${woff2.join(', ')}` : decl;
  });
}

/** Replace every url(...) with a base64 data URI; a url that can't be fetched stays as it was. */
export async function inlineCssUrls(css: string, fetchBytes: FetchBytes): Promise<string> {
  const trimmed = keepWoff2(css);
  const urls = new Set<string>();
  for (const match of trimmed.matchAll(URL_REF)) {
    const url = match[2]!.trim();
    if (!/^data:/i.test(url)) urls.add(url);
  }
  const inlined = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        inlined.set(url, `data:${mimeOf(url)};base64,${toBase64(await fetchBytes(url))}`);
      } catch {
        // keep the original url
      }
    }),
  );
  return trimmed.replace(URL_REF, (whole, _quote: string, url: string) => {
    const data = inlined.get(url.trim());
    return data ? `url("${data}")` : whole;
  });
}
