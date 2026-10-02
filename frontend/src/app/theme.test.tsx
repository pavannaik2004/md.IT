import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, setSetting, SETTINGS } from '../store';
import { useResolvedTheme } from './theme';

beforeEach(clearDatabase);
afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useResolvedTheme', () => {
  it('uses the stored choice', async () => {
    await setSetting(SETTINGS.theme, 'dark');
    const { result } = renderHook(() => useResolvedTheme());
    await waitFor(() => expect(result.current).toBe('dark'));
  });

  it('follows the system preference for "system"', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    const { result } = renderHook(() => useResolvedTheme());
    await waitFor(() => expect(result.current).toBe('dark'));
  });

  it('falls back to light when the browser can’t say', () => {
    const { result } = renderHook(() => useResolvedTheme());
    expect(result.current).toBe('light');
  });
});
