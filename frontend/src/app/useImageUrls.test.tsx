import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addImage, clearDatabase, createProject, type ImageAsset } from '../store';
import { useImageUrls } from './useImageUrls';

const png = (name: string) => ({ name, type: 'image/png', bytes: new TextEncoder().encode('x').buffer as ArrayBuffer });

beforeEach(clearDatabase);

describe('useImageUrls', () => {
  it('makes one URL per image and revokes it when the image goes or on unmount', async () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const pid = (await createProject('OS')).id;
    const a = await addImage(pid, null, png('a.png'));
    const b = await addImage(pid, null, png('b.png'));
    const { result, rerender, unmount } = renderHook(({ images }: { images: ImageAsset[] }) => useImageUrls(images), {
      initialProps: { images: [a, b] },
    });
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(create).toHaveBeenCalledTimes(2);
    const urlA = result.current.get(a.id)!;
    const urlB = result.current.get(b.id)!;

    rerender({ images: [a] });
    await waitFor(() => expect(result.current.size).toBe(1));
    expect(revoke).toHaveBeenCalledWith(urlB);

    rerender({ images: [{ ...a, name: 'renamed.png' }] }); // bytes never change: same URL
    expect(create).toHaveBeenCalledTimes(2);

    unmount();
    expect(revoke).toHaveBeenCalledWith(urlA);
  });
});
