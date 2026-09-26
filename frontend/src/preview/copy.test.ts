import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyCode, copyText } from './copy';

function stubClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true });
}
function stubExecCommand(result: boolean) {
  const execCommand = vi.fn(() => result);
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
  return execCommand;
}

afterEach(() => {
  vi.useRealTimers();
  stubClipboard();
  Reflect.deleteProperty(document, 'execCommand');
});

describe('copy', () => {
  it('uses the clipboard API when there is one', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    expect(await copyText('abc')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('falls back to a hidden textarea on plain-HTTP pages', async () => {
    const execCommand = stubExecCommand(true);
    expect(await copyText('abc')).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('reports failure when nothing can copy', async () => {
    expect(await copyText('abc')).toBe(false);
  });

  it('copies a code block and shows Copied, then Copy again', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    document.body.innerHTML =
      '<figure class="md-code"><div class="md-code-bar"><button class="md-code-copy" aria-label="Copy code"><span>Copy</span></button></div><pre><code><span>const</span> a = 1;\n</code></pre></figure>';
    const button = document.querySelector('button')!;
    await copyCode(button);
    expect(writeText).toHaveBeenCalledWith('const a = 1;\n');
    expect(button.getAttribute('aria-label')).toBe('Copied');
    expect(button.textContent).toBe('Copied');
    vi.advanceTimersByTime(1400);
    expect(button.getAttribute('aria-label')).toBe('Copy code');
    expect(button.textContent).toBe('Copy');
  });

  it('says so when copying fails', async () => {
    document.body.innerHTML = '<figure class="md-code"><button class="md-code-copy"></button><pre><code>x</code></pre></figure>';
    const button = document.querySelector('button')!;
    await copyCode(button);
    expect(button.textContent).toBe('Couldn’t copy');
  });
});
