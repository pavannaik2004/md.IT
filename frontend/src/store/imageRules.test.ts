import { describe, expect, it } from 'vitest';
import { checkImageFile, cleanImageName, formatSize, imageTypeOf, MAX_IMAGE_BYTES, withImageExtension } from './imageRules';

describe('image rules', () => {
  it('takes the type from the file, or from the extension when the file has none', () => {
    expect(imageTypeOf('a.png', 'image/png')).toBe('image/png');
    expect(imageTypeOf('a.svg', '')).toBe('image/svg+xml');
    expect(imageTypeOf('a.JPEG', '')).toBe('image/jpeg');
    expect(imageTypeOf('a.bmp', 'image/bmp')).toBeNull();
    expect(imageTypeOf('a.png', 'text/plain')).toBeNull();
    expect(imageTypeOf('notes', '')).toBeNull();
  });

  it('rejects unsupported and oversized files with plain messages', () => {
    expect(() => checkImageFile('screen.bmp', 'image/bmp', 10)).toThrow('“screen.bmp” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).');
    expect(() => checkImageFile('screen.png', 'image/png', Math.round(7.2 * 1024 * 1024))).toThrow('“screen.png” is 7.2 MB; images can be up to 5 MB.');
    expect(checkImageFile('ok.png', 'image/png', MAX_IMAGE_BYTES)).toBe('image/png');
  });

  it('cleans names into link-friendly stems and keeps a matching extension', () => {
    expect(cleanImageName('Screen Shot.PNG', 'image/png')).toEqual({ stem: 'screen-shot', ext: '.png' });
    expect(cleanImageName('photo.JPEG', 'image/jpeg')).toEqual({ stem: 'photo', ext: '.jpeg' });
    expect(cleanImageName('photo', 'image/jpeg')).toEqual({ stem: 'photo', ext: '.jpg' });
    expect(cleanImageName('Äpfel & Birnen (1).webp', 'image/webp')).toEqual({ stem: 'äpfel-birnen-1', ext: '.webp' });
    expect(cleanImageName('???.png', 'image/png')).toEqual({ stem: 'image', ext: '.png' });
    expect(cleanImageName('diagram.png', 'image/svg+xml')).toEqual({ stem: 'diagram', ext: '.svg' });
  });

  it('re-adds the extension on rename when it is dropped', () => {
    expect(withImageExtension('diagram', 'image/png')).toBe('diagram.png');
    expect(withImageExtension('final.PNG', 'image/png')).toBe('final.PNG');
    expect(withImageExtension('photo.jpeg', 'image/jpeg')).toBe('photo.jpeg');
  });

  it('formats sizes', () => {
    expect(formatSize(900)).toBe('900 bytes');
    expect(formatSize(340 * 1024)).toBe('340 KB');
    expect(formatSize(Math.round(7.2 * 1024 * 1024))).toBe('7.2 MB');
  });
});
