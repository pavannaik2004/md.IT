import { describe, expect, it } from 'vitest';
import { render } from './render';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('math', () => {
  it('renders inline math', () => {
    const html = render('Euler: $e^{i\\pi}+1=0$');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('data-mdit-math');
  });

  it('renders block math over several lines and on one line', () => {
    expect(render('$$\n\\int_0^1 x\\,dx\n$$')).toContain('katex-display');
    expect(render('$$x^2$$')).toContain('katex-display');
  });

  it('keeps KaTeX layout styles even though document styles are stripped', () => {
    expect(render('$\\frac{1}{2}$')).toMatch(/class="katex[\s\S]*style="/);
    expect(render('<span style="color:red">x</span>')).not.toContain('style=');
  });

  it('leaves dollar amounts alone', () => {
    const html = render('It costs $5 and $10.');
    expect(html).not.toContain('katex');
    expect(html).toContain('$5 and $10.');
  });

  it.each(['$ x$', '$x $', '$x$5', '\\$x$', '`$x$`', '```\n$x$\n```'])('does not treat %s as math', (source) => {
    expect(render(source)).not.toContain('katex');
  });

  it.each([
    ['Costs $5; the regex `^\\d+$` matches.', '<code>^\\d+$</code>'],
    ['Set $HOME, then run `echo x$`.', '<code>echo x$</code>'],
  ])('never reaches into a later code span: %s', (source, code) => {
    const html = render(source);
    expect(html).not.toContain('katex');
    expect(html).toContain(code);
  });

  it('treats an unclosed block as text', () => {
    const html = render('$$\nx');
    expect(html).not.toContain('katex');
    expect(html).toContain('$$');
  });

  it('shows invalid inline math as an inline error and keeps rendering', () => {
    const html = render('$\\foo$ and **bold**');
    expect(html).toContain('class="md-math-error"');
    expect(html).toContain('Undefined control sequence');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('shows invalid block math as an error block', () => {
    expect(render('$$\n\\foo\n$$')).toContain('Couldn’t render math: ');
  });

  it('does not trust links inside math', () => {
    expect(render('$\\href{javascript:alert(1)}{x}$')).not.toMatch(/href="javascript:/i);
  });

  it('ignores forged placeholders', () => {
    const forged = render('<span data-mdit-math="abc:0"></span>');
    expect(forged).not.toContain('katex');
    expect(forged).not.toContain('data-mdit-math');
    expect(count(render('<span data-mdit-math="abc:0"></span> $x$'), 'class="katex"')).toBe(1);
  });
});
