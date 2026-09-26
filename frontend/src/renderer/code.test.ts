import { describe, expect, it } from 'vitest';
import { readDiagramSource } from './code';
import { render } from './render';

const parse = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
};

describe('code blocks', () => {
  it('renders a fence as the design system CodeBlock', () => {
    const figure = parse(render('```python\nprint(1)\n```')).querySelector('figure.md-code');
    expect(figure).not.toBeNull();
    const button = figure!.querySelector('button.md-code-copy');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Copy code');
    expect(button?.querySelector('svg')).not.toBeNull();
    expect(button?.textContent).toBe('Copy');
    expect(figure!.querySelector('.md-code-lang')?.textContent).toBe('python');
    expect(figure!.querySelector('pre > code')?.className).toBe('hljs language-python');
    expect(figure!.querySelector('pre > code')?.textContent).toBe('print(1)\n');
  });

  it.each([
    ['java', 'class A { int x = 1; }'],
    ['javascript', 'const a = 1;'],
    ['js', 'let b = "x";'],
    ['typescript', 'let a: number = 1;'],
    ['ts', 'interface A { b: string }'],
    ['python', 'def f():\n    return 1'],
    ['py', 'import os'],
    ['sql', 'SELECT * FROM t WHERE id = 1;'],
    ['json', '{"a": 1}'],
    ['html', '<p class="x">hi</p>'],
    ['css', 'a { color: red; }'],
    ['bash', 'echo "hi"'],
    ['sh', 'if true; then ls; fi'],
    ['shell', 'if true; then cd /tmp; fi'],
  ])('highlights %s', (lang, code) => {
    const html = render(`\`\`\`${lang}\n${code}\n\`\`\``);
    expect(html).toMatch(/<span class="hljs-[a-z_]+/);
    expect(html).toContain(`<span class="md-code-lang">${lang}</span>`);
  });

  it('keeps an unknown language as escaped plain text with its label', () => {
    const host = parse(render('```brainfuck\n<+>\n```'));
    expect(host.querySelector('.md-code-lang')?.textContent).toBe('brainfuck');
    expect(host.querySelector('pre > code')?.className).toBe('');
    expect(host.querySelector('pre > code')?.textContent).toBe('<+>\n');
    expect(host.innerHTML).not.toContain('hljs');
  });

  it('omits the label without a language and handles indented code', () => {
    const host = parse(render('```\nplain\n```\n\n    indented'));
    expect(host.querySelectorAll('figure.md-code')).toHaveLength(2);
    expect(host.querySelector('.md-code-lang')).toBeNull();
  });

  it('escapes code instead of running it', () => {
    const html = render('```\n<script>alert(1)</script>\n```');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('turns a mermaid fence into a diagram placeholder whose source survives sanitizing', () => {
    // DOMPurify drops attribute values containing "-->", which nearly every flowchart has, so the source is URI-encoded.
    const host = parse(render('```mermaid\ngraph TD\n  A-->B\n```'));
    expect(host.querySelector('figure')).toBeNull();
    expect(readDiagramSource(host.querySelector('.md-mermaid')!)).toBe('graph TD\n  A-->B\n');
  });

  it('reads a diagram source that was not encoded, as written', () => {
    const el = document.createElement('div');
    el.setAttribute('data-source', 'graph TD\n  A-->B 100%');
    expect(readDiagramSource(el)).toBe('graph TD\n  A-->B 100%');
  });
});
