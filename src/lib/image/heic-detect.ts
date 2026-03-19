/**
 * HEIC/HEIF detection via ISO Base Media File Format magic bytes.
 * Source: strukturag/libheif issue #83 — ftyp box structure
 *
 * Do NOT use File.type — it is unreliable for HEIC (may be "", "image/heic",
 * or "application/octet-stream" depending on OS and browser).
 */
export async function isHeic(file: File): Promise<boolean> {
  if (file.size < 12) return false;
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return boxType === 'ftyp' && ['heic', 'heix', 'mif1', 'msf1'].includes(brand);
}
