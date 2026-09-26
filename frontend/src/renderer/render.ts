import DOMPurify, { type Config } from 'dompurify';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import type { RenderContext, RenderEnv } from './context';
import { escapeHtml } from './escape';
import { images } from './images';
import { links } from './links';

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
md.use(taskLists, { enabled: false });
md.use(links);
md.use(images);

// DOMPurify's default URI allow-list plus blob:, the object URLs of images stored in this browser.
const ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

// Inline style and <style> blocks are dropped: they can smuggle url(javascript:…), and a <style> block would restyle the whole app.
const SANITIZE: Config = { ADD_ATTR: ['target'], FORBID_ATTR: ['style'], FORBID_TAGS: ['style'], ALLOWED_URI_REGEXP: ALLOWED_URI };

/** Markdown → sanitized HTML. Pure apart from DOMPurify; never throws. */
export function render(markdown: string, context?: RenderContext): string {
  try {
    const env: RenderEnv = { context };
    return DOMPurify.sanitize(md.render(markdown, env), SANITIZE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="md-render-error">Couldn’t render this document: ${escapeHtml(message)}</div>`;
  }
}
