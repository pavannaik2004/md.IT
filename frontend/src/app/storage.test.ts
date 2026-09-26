import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './storage';

function stubStorage(value: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { ...navigator, storage: value });
}

afterEach(() => vi.unstubAllGlobals());

describe('requestPersistentStorage', () => {
  it('asks only when not already persisted', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when already persisted', async () => {
    const persist = vi.fn();
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns false when the browser has no storage manager or it throws', async () => {
    stubStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
    stubStorage({ persisted: vi.fn().mockRejectedValue(new Error('nope')), persist: vi.fn() });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
