import type { MarkdownIt } from 'markdown-it';
import type { RenderEnv } from './context';

export function links(md: MarkdownIt): void {
  const base = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const { context } = (env ?? {}) as RenderEnv;
    const token = tokens[idx]!;
    const href = String(token.attrGet('href') ?? '');
    if (/^https?:\/\//i.test(href)) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    } else if (context) {
      const link = context.resolveLink(href);
      if ('docId' in link) token.attrSet('data-doc-id', link.docId);
      else if ('missing' in link) token.attrSet('data-missing', 'true');
    }
    return base(tokens, idx, options, env, self);
  };
}
