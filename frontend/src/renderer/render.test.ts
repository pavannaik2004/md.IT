import { describe, expect, it } from 'vitest';
import { render } from './render';

describe('render', () => {
  it('renders GFM headings, tables, strikethrough', () => {
    expect(render('# Title')).toContain('<h1>Title</h1>');
    const table = render('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(table).toContain('<table>');
    expect(table).toContain('<td>1</td>');
    expect(render('~~gone~~')).toContain('<s>gone</s>');
  });

  it('renders task lists as disabled checkboxes', () => {
    const html = render('- [x] done\n- [ ] todo');
    expect(html).toMatch(/<input[^>]*type="checkbox"/);
    expect(html).toMatch(/checked/);
    expect(html).toMatch(/disabled/);
  });

  it('opens external links in a new tab safely, but not relative links', () => {
    const external = render('https://example.com');
    expect(external).toContain('href="https://example.com"');
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');
    expect(render('[next](Threads.md)')).not.toContain('target=');
  });

  it.each([
    ['<script>alert(1)</script>', /<script/i],
    ['<img src="x" onerror="alert(1)">', /onerror/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript:/i],
    // markdown-it refuses the link and leaves harmless text; only a javascript: href would be dangerous.
    ['[x](javascript:alert(1))', /href\s*=\s*["']?javascript:/i],
    ['<iframe src="https://evil.example"></iframe>', /<iframe/i],
    ['<div style="background:url(javascript:alert(1))">x</div>', /javascript:/i],
    // A <style> block would restyle the whole app, not just the preview.
    ['Hello\n\n<style>body{display:none}</style>', /<style/i],
  ])('strips dangerous markup: %s', (source, forbidden) => {
    expect(render(source)).not.toMatch(forbidden);
  });

  it('keeps harmless inline HTML', () => {
    expect(render('H<sub>2</sub>O')).toContain('<sub>2</sub>');
  });

  it('turns a failure into a visible error block instead of throwing', () => {
    const html = render(null as unknown as string);
    expect(html).toContain('class="md-render-error"');
  });
});
