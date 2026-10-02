import { describe, expect, it } from 'vitest';
import { clampRendering, DEFAULT_RENDERING, formatSetting, sameRendering, toCssVars } from './rendering';

describe('rendering settings', () => {
  it('match the design-system tokens by default', () => {
    expect(DEFAULT_RENDERING).toEqual({ font: 'serif', letterSpacing: 0, lineHeight: 1.65, margin: 0, padding: 48 });
  });

  it('fall back to the defaults for anything that is not an object', () => {
    for (const value of [undefined, null, 42, 'x', []]) expect(clampRendering(value)).toEqual(DEFAULT_RENDERING);
  });

  it('keep valid fields and replace invalid ones with defaults', () => {
    expect(clampRendering({ font: 'mono', lineHeight: 1.8, padding: 'wide', margin: Number.NaN })).toEqual({
      ...DEFAULT_RENDERING,
      font: 'mono',
      lineHeight: 1.8,
    });
    expect(clampRendering({ font: 'comic' }).font).toBe('serif');
  });

  it('clamp to the limits and snap to the step', () => {
    expect(clampRendering({ letterSpacing: 1, lineHeight: 0.5, margin: -10, padding: 1000 })).toEqual({
      ...DEFAULT_RENDERING,
      letterSpacing: 0.15,
      lineHeight: 1.2,
      margin: 0,
      padding: 96,
    });
    expect(clampRendering({ lineHeight: 1.67, padding: 49, letterSpacing: 0.013 })).toMatchObject({ lineHeight: 1.65, padding: 48, letterSpacing: 0.01 });
  });

  it('format values with their units', () => {
    expect(formatSetting('letterSpacing', 0)).toBe('0em');
    expect(formatSetting('letterSpacing', -0.05)).toBe('-0.05em');
    expect(formatSetting('lineHeight', 1.7)).toBe('1.7');
    expect(formatSetting('margin', 8)).toBe('8px');
  });

  it('become the --doc-* variables', () => {
    expect(toCssVars({ font: 'sans', letterSpacing: 0.02, lineHeight: 1.8, margin: 8, padding: 32 })).toEqual({
      '--doc-font': 'var(--font-sans)',
      '--doc-letter-spacing': '0.02em',
      '--doc-line-height': '1.8',
      '--doc-margin': '8px',
      '--doc-padding': '32px',
    });
  });

  it('compare by value', () => {
    expect(sameRendering(DEFAULT_RENDERING, { ...DEFAULT_RENDERING })).toBe(true);
    expect(sameRendering(DEFAULT_RENDERING, { ...DEFAULT_RENDERING, margin: 4 })).toBe(false);
  });
});
