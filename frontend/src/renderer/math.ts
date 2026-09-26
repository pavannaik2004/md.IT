import katex from 'katex';
import type { MarkdownIt } from 'markdown-it';
import type { RenderEnv } from './context';
import { escapeHtml } from './escape';

type InlineRule = Parameters<MarkdownIt['inline']['ruler']['push']>[1];
type BlockRule = Parameters<MarkdownIt['block']['ruler']['before']>[2];

const DOLLAR = 0x24;
const SPACE = /\s/;

/** `$…$`: no space just inside either `$`, and the closing `$` isn't followed by a digit, so "$5 and $10" stays text. */
const mathInline: InlineRule = (state, silent) => {
  const { src, pos, posMax } = state;
  if (src.charCodeAt(pos) !== DOLLAR || src.charCodeAt(pos + 1) === DOLLAR) return false;
  const first = src[pos + 1];
  if (first === undefined || pos + 1 >= posMax || SPACE.test(first)) return false;
  for (let end = src.indexOf('$', pos + 1); end !== -1 && end < posMax; end = src.indexOf('$', end + 1)) {
    const before = src[end - 1]!;
    if (before === '\\' || SPACE.test(before) || /\d/.test(src[end + 1] ?? '')) continue;
    if (!silent) {
      const token = state.push('math_inline', 'math', 0);
      token.markup = '$';
      token.content = src.slice(pos + 1, end);
    }
    state.pos = end + 1;
    return true;
  }
  return false;
};

/** `$$` opens a line; the math ends at a line ending in `$$` (possibly the same line). A blank line or no closer means text. */
const mathBlock: BlockRule = (state, startLine, endLine, silent) => {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;
  if (!state.src.startsWith('$$', start)) return false;
  const firstLine = state.src.slice(start + 2, max).trimEnd();
  let content: string;
  let last = startLine;
  if (firstLine.length >= 2 && firstLine.endsWith('$$')) {
    content = firstLine.slice(0, -2);
  } else {
    const lines = [firstLine];
    let closed = false;
    for (let line = startLine + 1; line < endLine; line++) {
      const text = state.src.slice(state.bMarks[line]! + state.tShift[line]!, state.eMarks[line]!).trimEnd();
      if (text === '' || state.sCount[line]! < state.blkIndent) break;
      if (text.endsWith('$$')) {
        lines.push(text.slice(0, -2));
        last = line;
        closed = true;
        break;
      }
      lines.push(text);
    }
    if (!closed) return false;
    content = lines.join('\n');
  }
  if (silent) return true;
  state.line = last + 1;
  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.markup = '$$';
  token.content = content.trim();
  token.map = [startLine, state.line];
  return true;
};

function mathHtml(env: RenderEnv, tex: string, display: boolean): string {
  try {
    const html = katex.renderToString(tex, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore', output: 'htmlAndMathml' });
    const index = env.math.push(html) - 1;
    const tag = display ? 'div' : 'span';
    return `<${tag} data-mdit-math="${env.nonce}:${index}"></${tag}>`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return display
      ? `<div class="md-render-error">Couldn’t render math: ${escapeHtml(message)}</div>`
      : `<code class="md-math-error" title="${escapeHtml(message)}">$${escapeHtml(tex)}$</code>`;
  }
}

export function math(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'math_inline', mathInline);
  md.block.ruler.before('fence', 'math_block', mathBlock, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.renderer.rules.math_inline = (tokens, idx, _options, env) => mathHtml(env as RenderEnv, tokens[idx]!.content, false);
  md.renderer.rules.math_block = (tokens, idx, _options, env) => `${mathHtml(env as RenderEnv, tokens[idx]!.content, true)}\n`;
}

const PLACEHOLDER = /<(span|div) data-mdit-math="([0-9a-f]+):(\d+)"><\/\1>/g;

/** After sanitizing: swap this render's placeholders for KaTeX HTML and drop any others (forged by the document). */
export function spliceMath(html: string, env: RenderEnv): string {
  return html.replace(PLACEHOLDER, (_whole, _tag: string, nonce: string, index: string) =>
    nonce === env.nonce ? (env.math[Number(index)] ?? '') : '',
  );
}
