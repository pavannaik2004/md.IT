import type { MarkdownIt } from 'markdown-it';
import { escapeHtml } from './escape';
import { highlight } from './highlight';
import { COPY_ICON } from './icons';

function codeFigure(code: string, lang: string): string {
  const highlighted = highlight(code, lang);
  const body = highlighted ?? escapeHtml(code);
  const cls = highlighted !== null ? ` class="hljs language-${escapeHtml(lang.toLowerCase())}"` : '';
  const label = lang ? `<span class="md-code-lang">${escapeHtml(lang)}</span>` : '';
  const copy = `<button type="button" class="md-code-copy" aria-label="Copy code">${COPY_ICON}<span>Copy</span></button>`;
  return `<figure class="md-code"><div class="md-code-bar">${copy}${label}</div><pre><code${cls}>${body}</code></pre></figure>\n`;
}

/** The diagram source of a `.md-mermaid` placeholder. */
export function readDiagramSource(el: Element): string {
  const raw = el.getAttribute('data-source') ?? '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Code renders as the design system's CodeBlock; ```mermaid becomes a placeholder the preview fills. */
export function codeBlocks(md: MarkdownIt): void {
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!;
    const lang = token.info.trim().split(/\s+/)[0] ?? '';
    // URI-encoded: DOMPurify drops attribute values containing "-->", which nearly every flowchart has.
    if (lang.toLowerCase() === 'mermaid') return `<div class="md-mermaid" data-source="${encodeURIComponent(token.content)}"></div>\n`;
    return codeFigure(token.content, lang);
  };
  md.renderer.rules.code_block = (tokens, idx) => codeFigure(tokens[idx]!.content, '');
}
