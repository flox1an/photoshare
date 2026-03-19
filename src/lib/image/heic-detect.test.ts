import { describe, it, expect } from 'vitest';
import { isHeic } from '@/lib/image/heic-detect';

/**
 * Wave 0 test scaffold for HEIC magic byte detection (PROC-07) and file accept logic (PROC-01).
 * These tests are RED — isHeic is not yet implemented.
 * Plans 02-02+ will implement the function and turn these GREEN.
 */

function makeHeicFile(brand: string, name = 'test.heic'): File {
  // HEIC/ISOBMFF structure: 4 bytes size, 4 bytes 'ftyp', 4 bytes major brand
  const buf = new Uint8Array(12);
  // box size (big-endian): 0x00 0x00 0x00 0x0C = 12
  buf[0] = 0x00;
  buf[1] = 0x00;
  buf[2] = 0x00;
  buf[3] = 0x0c;
  // 'ftyp' at offset 4
  buf[4] = 0x66; // f
  buf[5] = 0x74; // t
  buf[6] = 0x79; // y
  buf[7] = 0x70; // p
  // major brand at offset 8 (4 bytes)
  for (let i = 0; i < 4 && i < brand.length; i++) {
    buf[8 + i] = brand.charCodeAt(i);
  }
  return new File([buf.buffer], name, { type: 'image/heic' });
}

function makeJpegFile(name = 'test.jpg'): File {
  const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  return new File([buf.buffer], name, { type: 'image/jpeg' });
}

function makePngFile(name = 'test.png'): File {
  const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  return new File([buf.buffer], name, { type: 'image/png' });
}

function makeTooShortFile(name = 'short.bin'): File {
  const buf = new Uint8Array(11);
  return new File([buf.buffer], name, { type: 'application/octet-stream' });
}

describe('isHeic — HEIC magic byte detection', () => {
  it('returns true for ftyp+heic brand', async () => {
    const file = makeHeicFile('heic');
    expect(await isHeic(file)).toBe(true);
  });

  it('returns true for ftyp+heix brand', async () => {
    const file = makeHeicFile('heix');
    expect(await isHeic(file)).toBe(true);
  });

  it('returns true for ftyp+mif1 brand', async () => {
    const file = makeHeicFile('mif1');
    expect(await isHeic(file)).toBe(true);
  });

  it('returns false for JPEG (FF D8 FF header)', async () => {
    const file = makeJpegFile();
    expect(await isHeic(file)).toBe(false);
  });

  it('returns false for PNG (89 50 4E 47 header)', async () => {
    const file = makePngFile();
    expect(await isHeic(file)).toBe(false);
  });

  it('returns false for 11-byte file (too short to contain ftyp box)', async () => {
    const file = makeTooShortFile();
    expect(await isHeic(file)).toBe(false);
  });
});
