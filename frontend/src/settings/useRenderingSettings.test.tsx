import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, getSetting, setSetting, SETTINGS } from '../store';
import { DEFAULT_RENDERING } from './rendering';
import { useRenderingSettings } from './useRenderingSettings';

beforeEach(clearDatabase);

describe('useRenderingSettings', () => {
  it('reads the stored settings', async () => {
    await setSetting(SETTINGS.rendering, { ...DEFAULT_RENDERING, lineHeight: 2 });
    const { result } = renderHook(() => useRenderingSettings());
    await waitFor(() => expect(result.current[0].lineHeight).toBe(2));
  });

  it('cleans a bad stored value', async () => {
    await setSetting(SETTINGS.rendering, { font: 'comic', padding: 999 });
    const { result } = renderHook(() => useRenderingSettings());
    await waitFor(() => expect(result.current[0].padding).toBe(96));
    expect(result.current[0].font).toBe('serif');
  });

  it('applies a change at once and stores it shortly after', async () => {
    const { result } = renderHook(() => useRenderingSettings());
    act(() => result.current[1]({ padding: 24 }));
    expect(result.current[0].padding).toBe(24);
    await waitFor(async () => expect(await getSetting(SETTINGS.rendering, null)).toMatchObject({ padding: 24 }));
    expect(result.current[0].padding).toBe(24);
  });

  it('resets to the defaults', async () => {
    await setSetting(SETTINGS.rendering, { ...DEFAULT_RENDERING, margin: 40 });
    const { result } = renderHook(() => useRenderingSettings());
    await waitFor(() => expect(result.current[0].margin).toBe(40));
    act(() => result.current[2]());
    expect(result.current[0]).toEqual(DEFAULT_RENDERING);
    await waitFor(async () => expect(await getSetting(SETTINGS.rendering, null)).toEqual(DEFAULT_RENDERING));
  });
});
