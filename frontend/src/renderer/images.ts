import type { MarkdownIt } from 'markdown-it';
import type { ImageResolution, RenderEnv } from './context';
import { escapeHtml } from './escape';

export type ImageAlign = 'left' | 'center' | 'right';
export interface ImageAttrs { width?: string; align?: ImageAlign }

const ATTR_BLOCK = /^\{([^{}\n]*)\}/;
const EXTERNAL = /^[a-z][a-z0-9+.-]*:|^\/\//i;
const ALIGNS: readonly string[] = ['left', 'center', 'right'];

function parseWidth(value: string): string | null {
  const px = /^(\d{1,5})(?:px)?$/.exec(value);
  if (px && Number(px[1]) > 0) return String(Number(px[1]));
  const pct = /^(\d{1,3})%$/.exec(value);
  if (pct && Number(pct[1]) >= 1 && Number(pct[1]) <= 100) return `${Number(pct[1])}%`;
  return null;
}

/** `width=400 align=left` → attrs; null unless every key is known and valid, so typos stay visible. */
export function parseImageAttrs(body: string): ImageAttrs | null {
  const parts = body.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const attrs: ImageAttrs = {};
  for (const part of parts) {
    const match = /^(width|align)=(.+)$/.exec(part);
    if (!match) return null;
    const [, name, value] = match;
    if (name === 'width') {
      const width = parseWidth(value!);
      if (!width || attrs.width) return null;
      attrs.width = width;
    } else {
      if (!ALIGNS.includes(value!) || attrs.align) return null;
      attrs.align = value as ImageAlign;
    }
  }
  return attrs;
}

function resolve(env: RenderEnv, src: string): ImageResolution {
  if (env.context) return env.context.resolveImage(src);
  return EXTERNAL.test(src) ? { src } : { missing: true };
}

function displayPath(src: string): string {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
}

export function images(md: MarkdownIt): void {
  // `![a](b){width=400}`: the block arrives as plain text right after the image token; move it onto the image.
  md.core.ruler.after('inline', 'image_attrs', (state) => {
    for (const block of state.tokens) {
      const children = block.type === 'inline' ? block.children : null;
      if (!children) continue;
      for (let i = 0; i < children.length - 1; i++) {
        const image = children[i]!;
        const next = children[i + 1]!;
        if (image.type !== 'image' || next.type !== 'text') continue;
        const match = ATTR_BLOCK.exec(next.content);
        const attrs = match ? parseImageAttrs(match[1]!) : null;
        if (!match || !attrs) continue;
        image.meta = { ...(image.meta ?? {}), attrs };
        next.content = next.content.slice(match[0].length);
      }
    }
  });

  const base = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    const src = String(token.attrGet('src') ?? '');
    const resolved = resolve((env ?? {}) as RenderEnv, src);
    if ('missing' in resolved || 'pending' in resolved) {
      const path = escapeHtml(displayPath(src));
      return 'pending' in resolved
        ? `<span class="md-img-missing is-pending" role="img" aria-label="Loading image: ${path}">Loading image…</span>`
        : `<span class="md-img-missing" role="img" aria-label="Missing image: ${path}">Image not found: ${path}</span>`;
    }
    token.attrSet('src', resolved.src);
    const attrs = (token.meta as { attrs?: ImageAttrs } | null)?.attrs;
    if (attrs?.width) token.attrSet('width', attrs.width);
    if (attrs?.align) token.attrSet('data-align', attrs.align);
    return base(tokens, idx, options, env, self);
  };
}
