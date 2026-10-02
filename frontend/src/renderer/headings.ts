import type { MarkdownIt } from 'markdown-it';

/** `data-line` = 0-based source line, so the outline can scroll the preview to a heading without ids (P-040). */
export function headings(md: MarkdownIt): void {
  const base = md.renderer.rules.heading_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    if (token.map) token.attrSet('data-line', String(token.map[0]));
    return base(tokens, idx, options, env, self);
  };
}
