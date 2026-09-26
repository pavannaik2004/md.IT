import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { useProject, useSettingState } from './hooks';
import { createProject, renameProject } from './projects';

beforeEach(clearDatabase);

describe('store hooks', () => {
  it('useProject is undefined while loading, null when missing, and live after changes', async () => {
    const { result: missing } = renderHook(() => useProject('nope'));
    await waitFor(() => expect(missing.current).toBeNull());

    const project = await createProject('OS');
    const { result } = renderHook(() => useProject(project.id));
    await waitFor(() => expect(result.current?.name).toBe('OS'));
    await act(async () => {
      await renameProject(project.id, 'Operating systems');
    });
    await waitFor(() => expect(result.current?.name).toBe('Operating systems'));
  });

  it('useSettingState returns the fallback, then the stored value', async () => {
    const { result } = renderHook(() => useSettingState('ui.mode', 'split'));
    expect(result.current[0]).toBe('split');
    act(() => result.current[1]('editor'));
    await waitFor(() => expect(result.current[0]).toBe('editor'));
  });
});
