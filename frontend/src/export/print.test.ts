import { afterEach, describe, expect, it, vi } from 'vitest';
import { printHtml } from './print';

const frame = () => document.querySelector<HTMLIFrameElement>('iframe.print-frame');

afterEach(() => {
  frame()?.remove();
  document.title = '';
});

describe('printHtml', () => {
  it('prints the HTML from a hidden frame titled for the PDF, then cleans up', async () => {
    document.title = 'md.IT';
    const done = printHtml('<p>Hi</p>', 'Notes');
    const el = frame()!;
    expect(el.srcdoc).toBe('<p>Hi</p>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    const print = vi.spyOn(el.contentWindow!, 'print').mockImplementation(() => {});
    await done;
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.title).toBe('Notes');
    el.contentWindow!.dispatchEvent(new Event('afterprint'));
    expect(frame()).toBeNull();
    expect(document.title).toBe('md.IT');
  });
});
