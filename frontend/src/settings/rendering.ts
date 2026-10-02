export type DocFont = 'serif' | 'sans' | 'mono';

export interface RenderingSettings {
  font: DocFont;
  /** em */
  letterSpacing: number;
  lineHeight: number;
  /** px */
  margin: number;
  /** px */
  padding: number;
}

export type NumericSetting = Exclude<keyof RenderingSettings, 'font'>;

/** The design system's --doc-* token defaults (ui/tokens.css). */
export const DEFAULT_RENDERING: RenderingSettings = { font: 'serif', letterSpacing: 0, lineHeight: 1.65, margin: 0, padding: 48 };

export const RENDERING_LIMITS: Readonly<Record<NumericSetting, { min: number; max: number; step: number }>> = {
  letterSpacing: { min: -0.05, max: 0.15, step: 0.01 },
  lineHeight: { min: 1.2, max: 2.2, step: 0.05 },
  margin: { min: 0, max: 96, step: 4 },
  padding: { min: 0, max: 96, step: 4 },
};

const FONTS: readonly DocFont[] = ['serif', 'sans', 'mono'];
const NUMERIC: readonly NumericSetting[] = ['letterSpacing', 'lineHeight', 'margin', 'padding'];

function snap(value: number, { min, max, step }: { min: number; max: number; step: number }): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Number((min + Math.round((clamped - min) / step) * step).toFixed(4));
}

/** Anything (a stored row, an imported mdit.json) → valid settings; bad fields fall back to the defaults. */
export function clampRendering(value: unknown): RenderingSettings {
  const raw = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const result: RenderingSettings = { ...DEFAULT_RENDERING };
  if (FONTS.includes(raw.font as DocFont)) result.font = raw.font as DocFont;
  for (const key of NUMERIC) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) result[key] = snap(v, RENDERING_LIMITS[key]);
  }
  return result;
}

export function sameRendering(a: RenderingSettings, b: RenderingSettings): boolean {
  return a.font === b.font && NUMERIC.every((key) => a[key] === b[key]);
}

export function formatSetting(key: NumericSetting, value: number): string {
  const n = String(Number(value.toFixed(2)));
  if (key === 'letterSpacing') return `${n}em`;
  if (key === 'lineHeight') return n;
  return `${n}px`;
}

/** Set on the preview's .md-prose element (which defines --doc-font itself) and on exports. */
export function toCssVars(s: RenderingSettings): Record<string, string> {
  return {
    '--doc-font': `var(--font-${s.font})`,
    '--doc-letter-spacing': formatSetting('letterSpacing', s.letterSpacing),
    '--doc-line-height': formatSetting('lineHeight', s.lineHeight),
    '--doc-margin': formatSetting('margin', s.margin),
    '--doc-padding': formatSetting('padding', s.padding),
  };
}
