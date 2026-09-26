import { describe, expect, it } from 'vitest';
import { newId } from './ids';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(newId({ randomUUID: () => 'from-random-uuid', getRandomValues: crypto.getRandomValues.bind(crypto) } as unknown as Crypto)).toBe('from-random-uuid');
  });

  it('falls back to a random v4 UUID on plain-HTTP pages where randomUUID is missing', () => {
    const insecure = { getRandomValues: crypto.getRandomValues.bind(crypto) } as Crypto;
    const a = newId(insecure);
    const b = newId(insecure);
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});
