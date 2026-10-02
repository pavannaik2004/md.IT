import { md } from './md';

type Token = ReturnType<typeof md.parse>[number];

export interface OutlineHeading {
  level: number;
  text: string;
  /** 0-based source line, the same as the heading's data-line in the preview. */
  line: number;
}

export interface DocumentStats {
  words: number;
  characters: number;
  headings: number;
  codeBlocks: number;
  diagrams: number;
  math: number;
  images: number;
  links: number;
  readingMinutes: number;
}

export interface Analysis {
  headings: OutlineHeading[];
  stats: DocumentStats;
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const WORDS_PER_MINUTE = 225;

const countWords = (text: string) => text.match(WORD)?.length ?? 0;

/** Plain text of an inline token's children: text, inline code and inline math, without markup. */
function inlineText(children: readonly Token[]): string {
  return children.map((child) => (['text', 'code_inline', 'math_inline'].includes(child.type) ? child.content : '')).join('');
}

function emptyStats(markdown: string): DocumentStats {
  return { words: 0, characters: [...markdown].length, headings: 0, codeBlocks: 0, diagrams: 0, math: 0, images: 0, links: 0, readingMinutes: 0 };
}

/** Outline and statistics from the same token stream the preview renders. Never throws. */
export function analyze(markdown: string): Analysis {
  const stats = emptyStats(markdown);
  const headings: OutlineHeading[] = [];
  let tokens: Token[];
  try {
    tokens = md.parse(markdown, {});
  } catch {
    return { headings, stats };
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    switch (token.type) {
      case 'heading_open': {
        const inline = tokens[i + 1];
        headings.push({
          level: Number(token.tag.slice(1)),
          text: inline?.type === 'inline' ? inlineText(inline.children ?? []).trim() : '',
          line: token.map?.[0] ?? 0,
        });
        stats.headings++;
        break;
      }
      case 'fence':
        if ((token.info.trim().split(/\s+/)[0] ?? '').toLowerCase() === 'mermaid') stats.diagrams++;
        else stats.codeBlocks++;
        break;
      case 'code_block':
        stats.codeBlocks++;
        break;
      case 'math_block':
        stats.math++;
        break;
      case 'inline':
        for (const child of token.children ?? []) {
          if (child.type === 'text' || child.type === 'code_inline') stats.words += countWords(child.content);
          else if (child.type === 'math_inline') stats.math++;
          else if (child.type === 'image') stats.images++;
          else if (child.type === 'link_open') stats.links++;
        }
        break;
    }
  }
  stats.readingMinutes = stats.words === 0 ? 0 : Math.ceil(stats.words / WORDS_PER_MINUTE);
  return { headings, stats };
}
