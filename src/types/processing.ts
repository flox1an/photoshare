/**
 * Phase 2 processing pipeline output types.
 * ProcessedPhoto is the handoff contract from Phase 2 → Phase 3 (encrypt + upload).
 */

/** Status of a single photo in the processing queue */
export type PhotoProcessingStatus = 'pending' | 'processing' | 'done' | 'error';

/** Per-photo state tracked in the Zustand store during processing */
export interface PhotoProcessingState {
  /** Unique ID — use crypto.randomUUID() or file.name+index at queue time */
  id: string;
  /** Original filename (e.g. IMG_2847.HEIC) */
  filename: string;
  status: PhotoProcessingStatus;
  /** Set when status === 'error' */
  error?: string;
  /** Set when status === 'done' — the processing output ready for Phase 3 */
  result?: ProcessedPhoto;
}

/**
 * Output of the image processing pipeline for a single photo.
 * Phase 3 reads this and calls encryptBlob(full, key) and encryptBlob(thumb, key).
 * width/height are the ORIGINAL dimensions (before resize) — used by Phase 4 for aspect ratio layout.
 */
export interface ProcessedPhoto {
  /** WebP ArrayBuffer at max 2560px long edge, quality 85 */
  full: ArrayBuffer;
  /** WebP ArrayBuffer at max 300px long edge, quality 75 */
  thumb: ArrayBuffer;
  /** Original width in pixels BEFORE any resize (from createImageBitmap before drawImage) */
  width: number;
  /** Original height in pixels BEFORE any resize */
  height: number;
  /** Original filename preserved for PhotoEntry.filename */
  filename: string;
  /** Actual MIME type of the output — 'image/webp' normally, 'image/png' on Safari fallback */
  mimeType: string;
}

/**
 * Comlink-exposed API of image-processor.worker.ts
 * Typed here so main-thread hook and tests share the same contract.
 */
export interface ProcessorApi {
  processImage(file: File): Promise<ProcessedPhoto>;
}
