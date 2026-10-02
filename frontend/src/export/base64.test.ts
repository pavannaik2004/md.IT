import { describe, expect, it } from 'vitest';
import { dataUri, toBase64 } from './base64';

describe('base64', () => {
  it('encodes bytes', () => {
    expect(toBase64(new Uint8Array([1, 2, 3]))).toBe('AQID');
    expect(toBase64(new Uint8Array([137, 80, 78, 71]))).toBe('iVBORw==');
  });

  it('encodes large inputs without overflowing the call stack', () => {
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => i % 256);
    const decoded = Uint8Array.from(atob(toBase64(bytes)), (c) => c.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  });

  it('builds data URIs', () => {
    expect(dataUri('image/png', new Uint8Array([1, 2, 3]))).toBe('data:image/png;base64,AQID');
  });
});
