import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
md.use(taskLists, { enabled: false });

const renderLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!;
  if (/^https?:\/\//i.test(String(token.attrGet('href') ?? ''))) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return renderLinkOpen(tokens, idx, options, env, self);
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Markdown → sanitized HTML. Pure apart from DOMPurify; never throws. */
export function render(markdown: string): string {
  try {
    // Inline style and <style> blocks are dropped: they can smuggle url(javascript:…), and a <style> block would restyle the whole app.
    return DOMPurify.sanitize(md.render(markdown), { ADD_ATTR: ['target'], FORBID_ATTR: ['style'], FORBID_TAGS: ['style'] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="md-render-error">Couldn’t render this document: ${escapeHtml(message)}</div>`;
  }
}
