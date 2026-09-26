import DOMPurify, { type Config } from 'dompurify';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import type { RenderContext, RenderEnv } from './context';
import { codeBlocks } from './code';
import { escapeHtml } from './escape';
import { images } from './images';
import { links } from './links';
import { math, spliceMath } from './math';

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
md.use(taskLists, { enabled: false });
md.use(links);
md.use(images);
md.use(codeBlocks);
md.use(math);

// DOMPurify's default URI allow-list plus blob:, the object URLs of images stored in this browser.
const ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

// Inline style and <style> blocks are dropped: they can smuggle url(javascript:…), and a <style> block would restyle the whole app.
const SANITIZE: Config = { ADD_ATTR: ['target'], FORBID_ATTR: ['style'], FORBID_TAGS: ['style'], ALLOWED_URI_REGEXP: ALLOWED_URI };

function newNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Markdown → sanitized HTML. Pure apart from DOMPurify; never throws. */
export function render(markdown: string, context?: RenderContext): string {
  try {
    const env: RenderEnv = { context, nonce: newNonce(), math: [] };
    const clean = DOMPurify.sanitize(md.render(markdown, env), SANITIZE);
    // KaTeX output needs inline styles, which SANITIZE strips, so it goes in after sanitizing (P-025).
    return spliceMath(clean, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="md-render-error">Couldn’t render this document: ${escapeHtml(message)}</div>`;
  }
}
