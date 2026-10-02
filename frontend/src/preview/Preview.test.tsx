import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render as renderMarkdown } from '../renderer';
import { Preview } from './Preview';

function setup(html: string) {
  const onOpenDocument = vi.fn();
  const onNotice = vi.fn();
  render(<Preview html={html} theme="light" onOpenDocument={onOpenDocument} onNotice={onNotice} />);
  return { onOpenDocument, onNotice };
}

describe('Preview', () => {
  it('puts the rendering variables on the prose element', () => {
    render(
      <Preview html="<p>x</p>" theme="light" style={{ '--doc-padding': '12px' } as CSSProperties} onOpenDocument={vi.fn()} onNotice={vi.fn()} />,
    );
    expect(document.querySelector<HTMLElement>('.md-prose')!.style.getPropertyValue('--doc-padding')).toBe('12px');
  });

  it('opens a linked document instead of navigating the browser', () => {
    const { onOpenDocument } = setup('<p><a href="Threads.md" data-doc-id="d2">Next</a></p>');
    const link = screen.getByRole('link', { name: 'Next' });
    const event = createEvent.click(link);
    fireEvent(link, event);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenDocument).toHaveBeenCalledWith('d2');
  });

  it('gives a notice for a missing document', () => {
    const { onNotice, onOpenDocument } = setup('<p><a href="Gone.md" data-missing="true">Gone</a></p>');
    fireEvent.click(screen.getByRole('link', { name: 'Gone' }));
    expect(onNotice).toHaveBeenCalledWith('“Gone.md” isn’t in this project.');
    expect(onOpenDocument).not.toHaveBeenCalled();
  });

  it('lets external links through', () => {
    const { onNotice } = setup('<p><a href="https://example.com" target="_blank">Site</a></p>');
    const link = screen.getByRole('link', { name: 'Site' });
    const event = createEvent.click(link);
    fireEvent(link, event);
    expect(event.defaultPrevented).toBe(false);
    expect(onNotice).not.toHaveBeenCalled();
  });

  it('copies code from a rendered code block', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup(renderMarkdown('```js\nconst a = 1;\n```'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('const a = 1;\n');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
});
