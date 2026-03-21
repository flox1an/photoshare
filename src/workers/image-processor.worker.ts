/// <reference lib="webworker" />
/**
 * Image processing Web Worker.
 * Exposed via Comlink — main thread wraps with Comlink.wrap<ProcessorApi>(worker).
 *
 * Pipeline: HEIC detect → optional heicTo conversion → createImageBitmap →
 *   pass 1: full-size OffscreenCanvas WebP (2560px, q=0.85) →
 *   pass 2: thumbnail OffscreenCanvas WebP (512px, q=0.75) →
 *   pass 3: blurhash from 32×32 downsample →
 *   bitmap.close() (CRITICAL: explicit GPU memory release) →
 *   return ProcessedPhoto
 *
 * HEIC note: uses heic-to/next (worker-safe build) — NOT heic2any (throws window is not defined)
 * Safari note: OffscreenCanvas.convertToBlob({ type: 'image/webp' }) returns image/png on Safari.
 *   We check blob.type and populate mimeType accordingly. Viewer handles both transparently.
 */
import * as Comlink from 'comlink';
import { heicTo } from 'heic-to/next';
import { encode as blurhashEncode } from 'blurhash';
import { fitToLongEdge } from '@/lib/image/dimensions';
import type { ProcessedPhoto, ProcessorApi } from '@/types/processing';

const HEIC_BRANDS = ['heic', 'heix', 'mif1', 'msf1'] as const;

async function detectHeicInWorker(file: File): Promise<boolean> {
  if (file.size < 12) return false;
  const buf = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(buf);
  const boxType = String.fromCharCode(b[4], b[5], b[6], b[7]);
  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  return boxType === 'ftyp' && (HEIC_BRANDS as readonly string[]).includes(brand);
}

async function encodeCanvas(
  bitmap: ImageBitmap,
  targetW: number,
  targetH: number,
  quality: number,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  // Safari returns image/png silently — check blob.type for actual output format
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  return { buffer: await blob.arrayBuffer(), mimeType: blob.type };
}

const api: ProcessorApi = {
  async processImage(file: File): Promise<ProcessedPhoto> {
    // Step 1: HEIC detection and conversion (worker-internal, re-detect in worker)
    let sourceBlob: Blob = file;
    if (await detectHeicInWorker(file)) {
      // heicTo from heic-to/next — worker-safe HEIF decoder (wraps libheif WASM)
      sourceBlob = await heicTo({ blob: file, type: 'image/jpeg', quality: 1 });
    }

    // Step 2: Decode to ImageBitmap — captures ORIGINAL dimensions before any resize
    const bitmap = await createImageBitmap(sourceBlob);
    const origW = bitmap.width;
    const origH = bitmap.height;

    // Step 3: Full-size pass (max 2560px long edge, quality 0.85)
    const { w: fullW, h: fullH } = fitToLongEdge(origW, origH, 2560);
    const { buffer: fullBuffer, mimeType } = await encodeCanvas(bitmap, fullW, fullH, 0.85);

    // Step 4: Thumbnail pass (max 512px long edge, quality 0.75)
    const { w: thumbW, h: thumbH } = fitToLongEdge(origW, origH, 512);
    const { buffer: thumbBuffer } = await encodeCanvas(bitmap, thumbW, thumbH, 0.75);

    // Step 5: BlurHash — compute from a 32×32 downsample for speed (O(1024) vs O(262144))
    let blurhash = '';
    try {
      const bhSize = 32;
      const bhCanvas = new OffscreenCanvas(bhSize, bhSize);
      const bhCtx = bhCanvas.getContext('2d');
      if (bhCtx) {
        bhCtx.drawImage(bitmap, 0, 0, bhSize, bhSize);
        const { data } = bhCtx.getImageData(0, 0, bhSize, bhSize);
        blurhash = blurhashEncode(data, bhSize, bhSize, 4, 3);
      }
    } catch {
      // BlurHash failure is non-fatal — viewer falls back to skeleton
    }

    // Step 6: CRITICAL — explicit GPU memory release. GC alone is too slow for 200-photo batches.
    // Each 12 MP bitmap = ~36 MB GPU memory. Without close(), tab crashes ~photo 50-80.
    bitmap.close();

    return {
      full: fullBuffer,
      thumb: thumbBuffer,
      width: origW,   // ORIGINAL dimensions — Phase 4 uses for aspect ratio grid layout
      height: origH,
      filename: file.name.replace(/\.[^.]+$/, '.webp'),
      mimeType,       // 'image/webp' normally, 'image/png' on Safari (accepted for v1)
      blurhash,
    };
  },
};

Comlink.expose(api);
