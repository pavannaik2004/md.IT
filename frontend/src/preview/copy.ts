import { CHECK_ICON, COPY_ICON } from '../renderer/icons';

/** Clipboard API on secure pages; a hidden textarea and execCommand on plain HTTP (P-021's LAN case). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea
  }
  if (typeof document.execCommand !== 'function') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'md-copy-buffer';
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

function setButton(button: HTMLButtonElement, label: string, icon: string, ariaLabel = label): void {
  button.innerHTML = `${icon}<span>${label}</span>`;
  button.setAttribute('aria-label', ariaLabel);
}

export async function copyCode(button: HTMLButtonElement): Promise<void> {
  const code = button.closest('.md-code')?.querySelector('pre')?.textContent ?? '';
  const copied = await copyText(code);
  setButton(button, copied ? 'Copied' : 'Couldn’t copy', copied ? CHECK_ICON : COPY_ICON);
  window.setTimeout(() => setButton(button, 'Copy', COPY_ICON, 'Copy code'), 1400);
}
