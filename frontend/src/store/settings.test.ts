import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { getSetting, setSetting, SETTINGS } from './settings';

beforeEach(clearDatabase);

describe('settings', () => {
  it('returns the fallback until a value is stored', async () => {
    expect(await getSetting(SETTINGS.mode, 'split')).toBe('split');
    await setSetting(SETTINGS.mode, 'preview');
    expect(await getSetting(SETTINGS.mode, 'split')).toBe('preview');
  });

  it('stores falsy values faithfully', async () => {
    await setSetting(SETTINGS.storageWarningDismissed, false);
    expect(await getSetting(SETTINGS.storageWarningDismissed, true)).toBe(false);
  });
});
