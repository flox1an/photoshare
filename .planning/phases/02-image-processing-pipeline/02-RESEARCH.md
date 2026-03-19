# Phase 2: Image Processing Pipeline - Research

**Researched:** 2026-03-19
**Domain:** Client-side image processing — HEIC conversion, canvas resize/WebP, Web Workers, memory management
**Confidence:** HIGH (core Web APIs verified via MDN; library capabilities verified via GitHub/npm)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full-size images: max 2560px on the long edge, maintain original aspect ratio, no cropping
- Thumbnails: max 300px on the long edge, maintain original aspect ratio
- Both full and thumbnail are WebP output
- Full-size WebP quality: 85
- Thumbnail WebP quality: 75
- Processing starts immediately on drop — no preview/confirmation step
- User can add more photos after initial drop (accumulate into batch)
- Per-photo progress tracking (processing state per file)
- EXIF stripping happens automatically when image is drawn to Canvas and re-exported (canvas does not preserve EXIF)
- Processing runs in Web Workers to avoid blocking the UI
- Memory management: process 3-5 photos concurrently, release each after processing completes

### Claude's Discretion
- Web Worker architecture (Comlink vs raw postMessage)
- HEIC conversion library choice (heic2any vs libheif-js)
- Canvas vs OffscreenCanvas in workers
- Exact concurrency limit for batch processing
- Progress state management (React state vs external store)
- Whether to use browser-image-compression library or raw Canvas API

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROC-01 | User can drag-and-drop image files to upload | react-dropzone `onDrop` handler with `File[]`; file picker input |
| PROC-02 | User can drag-and-drop entire folders to upload | `DataTransferItem.webkitGetAsEntry()` recursive traversal; react-dropzone does NOT handle this natively — custom `onDrop` needed |
| PROC-03 | All EXIF data including geolocation is stripped client-side before upload | Canvas re-encode to WebP strips all EXIF automatically; no separate EXIF library needed |
| PROC-04 | Images are resized to full-screen optimized dimensions client-side | OffscreenCanvas in worker: draw to target dimensions using aspect-ratio math |
| PROC-05 | Images are converted to WebP format client-side | `OffscreenCanvas.convertToBlob({ type: 'image/webp', quality })` — but Safari does NOT support WebP from OffscreenCanvas; fallback required |
| PROC-06 | Thumbnails are generated client-side for each image | Second OffscreenCanvas pass in same worker function, 300px long edge |
| PROC-07 | HEIC/HEIF files from iPhones are detected and converted client-side | Magic byte detection (bytes 4-11: `ftyp` + brand `heic`/`mif1`/`heix`); use `heic-to` library with `/next` import for worker compat |
| PROC-08 | Image processing runs in Web Workers to avoid blocking the UI | Comlink + module worker; `new Worker(new URL(...), { type: 'module' })` in `useEffect` |
| PROC-09 | Processing handles up to 200 photos without crashing the browser | Concurrency limit of 4 (p-limit or manual semaphore); `ImageBitmap.close()` after draw; no `toDataURL()` |
</phase_requirements>

---

## Summary

Phase 2 builds the client-side image processing pipeline that transforms raw dropped files (including HEIC) into WebP full-size and thumbnail `ArrayBuffer` outputs. The pipeline runs entirely in a Web Worker to keep the UI responsive, uses OffscreenCanvas for off-thread drawing, and manages memory via explicit `ImageBitmap.close()` calls and a concurrency limit of 3-5 concurrent photos.

The critical architectural finding is that **heic2any does NOT work in Web Workers** (throws `window is not defined`). The replacement is **heic-to**, a newer library that wraps libheif and explicitly supports workers via `import { heicTo } from "heic-to/next"`. This is a locked recommendation — not a choice between equals.

The second critical finding is that **Safari does not support `OffscreenCanvas.convertToBlob()` with `image/webp`** (0% Safari support per caniuse). The fallback strategy is to transfer the OffscreenCanvas result back to the main thread and use `HTMLCanvasElement.toBlob()` for Safari, or use `browser-image-compression` with `fileType: 'image/webp'` as it handles cross-browser WebP gracefully.

**Primary recommendation:** Use raw OffscreenCanvas + Comlink in the worker for Chrome/Firefox/Edge, with a main-thread HTMLCanvasElement fallback for Safari WebP encoding. Do not use `browser-image-compression` as the primary pipeline — it does not support HEIC input and gives less control over the two-pass (full + thumb) output.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Comlink | 4.4.2 | RPC bridge for Web Worker | Eliminates postMessage boilerplate; Google Chrome team; works with Next.js `new Worker(new URL(...))` pattern |
| heic-to | 1.4.2 | HEIC/HEIF to Blob conversion in browser | Only library with explicit Web Worker support (`/next` subpath); wraps libheif 1.21.2; actively maintained |
| p-limit | 7.3.0 | Concurrency limit for batch processing | 0-dep utility; pure ESM; controls max in-flight worker tasks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dropzone | 15.0.0 | File/folder drop zone UI | File-drop UX layer; folder traversal requires custom `onDrop` with `webkitGetAsEntry()` |
| Zustand | 5.0.8 | Per-photo processing state | Already in stack; track `pending/processing/done/error` per photo ID |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| heic-to | heic2any | heic2any throws `window is not defined` in Web Workers — eliminated |
| heic-to | libheif-js directly | libheif-js lower-level API; heic-to wraps it cleanly; no benefit to bypassing the wrapper |
| heic-to | browser-image-compression | browser-image-compression does NOT handle HEIC input at all |
| Raw OffscreenCanvas | browser-image-compression | browser-image-compression does not return two separate outputs (full + thumb) in one call |
| p-limit | Custom semaphore | p-limit is 0-dep, battle-tested; custom semaphore is unnecessary complexity |

**Installation:**
```bash
npm install comlink heic-to p-limit
# react-dropzone and zustand already decided in stack research
```

**Version verification (confirmed 2026-03-19):**
- `heic-to`: 1.4.2 (published ~1 month ago — actively maintained)
- `libheif-js`: 1.19.8
- `comlink`: 4.4.2
- `p-limit`: 7.3.0
- `react-dropzone`: 15.0.0

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── workers/
│   └── image-processor.worker.ts   # OffscreenCanvas + heic-to; Comlink.expose()
├── lib/
│   └── image/
│       ├── heic-detect.ts           # Magic byte detection (no library)
│       └── processor.ts             # Main-thread fallback for Safari WebP
├── hooks/
│   └── useImageProcessor.ts        # Worker lifecycle + concurrency via p-limit
├── components/
│   └── upload/
│       ├── UploadPanel.tsx          # Drop zone + progress list orchestrator
│       ├── DropZone.tsx             # react-dropzone wrapper + folder traversal
│       └── ProgressList.tsx         # Per-photo status display
└── types/
    └── processing.ts                # ProcessedPhoto, PhotoProcessingState types
```

### Pattern 1: Folder Drag-Drop via webkitGetAsEntry()

**What:** `DataTransferItem.webkitGetAsEntry()` returns a `FileSystemEntry` that can be a file or directory. Directories require recursive `readEntries()` calls.

**When to use:** Any time the user drops a folder (not individual files). Must be called synchronously in the drop handler before the event ends — `dataTransfer.items` is cleared asynchronously.

**Browser support:** All modern browsers (Chrome, Firefox, Safari). The method is still prefixed as `webkitGetAsEntry` in Firefox but works identically.

**Key pitfall:** `readEntries()` returns at most 100 entries per call. Must call it in a loop until it returns an empty array.

**Example:**
```typescript
// Source: MDN DataTransferItem.webkitGetAsEntry() + custom traversal
async function traverseEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject)
    );
  }
  // Directory: must loop readEntries() until empty (max 100 per call)
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const allEntries: FileSystemEntry[] = [];
  while (true) {
    const batch: FileSystemEntry[] = await new Promise((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );
    if (batch.length === 0) break;
    allEntries.push(...batch);
  }
  const nested = await Promise.all(allEntries.map(traverseEntry));
  return nested.flat();
}

// In drop handler (must be synchronous at start — dataTransfer.items cleared async):
async function handleDrop(e: DragEvent) {
  e.preventDefault();
  const items = Array.from(e.dataTransfer!.items);
  const entries = items
    .map(item => item.webkitGetAsEntry())
    .filter(Boolean) as FileSystemEntry[];
  const files = (await Promise.all(entries.map(traverseEntry))).flat();
  // files is now a flat File[] including all nested files
}
```

**react-dropzone note:** react-dropzone's `onDrop` receives a `File[]` from the browser's file picker but does NOT recursively traverse dropped folders to yield nested files. For folder drag-drop with recursive traversal, override `onDrop` to use the `dataTransfer.items` API directly, or use a custom `onDrop` with `event.dataTransfer.items` rather than react-dropzone's `acceptedFiles`.

### Pattern 2: HEIC Detection via Magic Bytes

**What:** Read the first 12 bytes of a `File` to detect HEIC/HEIF without relying on `File.type` (OS-assigned, can be wrong or empty).

**Why magic bytes:** `File.type` for HEIC files is unreliable — it may be `""`, `"image/heic"`, or `"application/octet-stream"` depending on OS and browser. Magic bytes are definitive.

**HEIC structure:**
- Bytes 4-7: `ftyp` (ASCII: `66 74 79 70`) — ISO Base Media File Format box
- Bytes 8-11 (major brand): one of `heic`, `heix`, `mif1`, `msf1`

**Example:**
```typescript
// Source: strukturag/libheif GitHub issue #83 + bigcat88/pillow_heif issue #8
export async function isHeic(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const boxType = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return boxType === 'ftyp' && ['heic', 'heix', 'mif1', 'msf1'].includes(brand);
}
```

### Pattern 3: Web Worker with Comlink + OffscreenCanvas

**What:** The worker exposes a `processImage(file, options)` function via Comlink. Inside the worker, `heicTo()` converts HEIC to Blob, `createImageBitmap()` decodes it, two `OffscreenCanvas` passes produce full + thumb WebP blobs.

**When to use:** All image processing — every file goes through the worker regardless of format.

**Key constraints:**
- Workers use `self.crypto` not `window.crypto` (no crypto in this worker, but important to know)
- `OffscreenCanvas.convertToBlob({ type: 'image/webp' })` does NOT work in Safari — returns PNG silently or throws
- `createImageBitmap()` resize options (`resizeWidth`/`resizeHeight`) have inconsistent browser support — do NOT use them for primary resize; use draw-to-canvas instead
- `ImageBitmap.close()` MUST be called explicitly after `drawImage()` — GC alone is too slow for batch workloads

**Example:**
```typescript
// Source: ARCHITECTURE.md + MDN OffscreenCanvas + MDN ImageBitmap.close()
// workers/image-processor.worker.ts
import * as Comlink from 'comlink';
import { heicTo } from 'heic-to/next';  // /next subpath = Worker-safe build

export interface ProcessResult {
  full: ArrayBuffer;
  thumb: ArrayBuffer;
  width: number;   // original width
  height: number;  // original height
}

function calcDimensions(srcW: number, srcH: number, maxLongEdge: number) {
  const long = Math.max(srcW, srcH);
  if (long <= maxLongEdge) return { w: srcW, h: srcH };
  const scale = maxLongEdge / long;
  return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) };
}

async function drawAndEncode(
  bitmap: ImageBitmap,
  targetW: number,
  targetH: number,
  quality: number,
): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  return blob.arrayBuffer();
}

const api = {
  async processImage(file: File): Promise<ProcessResult> {
    // 1. HEIC conversion if needed (detected by caller or re-detect here)
    let sourceBlob: Blob = file;
    const buf12 = await file.slice(0, 12).arrayBuffer();
    const b = new Uint8Array(buf12);
    const boxType = String.fromCharCode(b[4], b[5], b[6], b[7]);
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (boxType === 'ftyp' && ['heic', 'heix', 'mif1', 'msf1'].includes(brand)) {
      sourceBlob = await heicTo({ blob: file, type: 'image/jpeg', quality: 1 });
    }

    // 2. Decode to ImageBitmap (captures original dimensions)
    const bitmap = await createImageBitmap(sourceBlob);
    const { width: origW, height: origH } = bitmap;

    // 3. Full-size pass
    const { w: fullW, h: fullH } = calcDimensions(origW, origH, 2560);
    const full = await drawAndEncode(bitmap, fullW, fullH, 0.85);

    // 4. Thumbnail pass
    const { w: thumbW, h: thumbH } = calcDimensions(origW, origH, 300);
    const thumb = await drawAndEncode(bitmap, thumbW, thumbH, 0.75);

    // 5. CRITICAL: explicit memory release
    bitmap.close();

    return { full, thumb, width: origW, height: origH };
  }
};

Comlink.expose(api);
```

**Main thread setup (useEffect — never in render):**
```typescript
// hooks/useImageProcessor.ts
import * as Comlink from 'comlink';
import { useEffect, useRef } from 'react';

export function useImageProcessor() {
  const workerRef = useRef<Comlink.Remote<typeof api> | null>(null);
  const instanceRef = useRef<Worker | null>(null);

  useEffect(() => {
    instanceRef.current = new Worker(
      new URL('@/workers/image-processor.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = Comlink.wrap(instanceRef.current);
    return () => { instanceRef.current?.terminate(); };
  }, []);

  return workerRef;
}
```

### Pattern 4: Concurrency-Limited Batch with p-limit

**What:** A p-limit limiter gates how many `processImage()` calls are in-flight simultaneously. Each photo processes then releases before the next starts.

**Concurrency recommendation:** 4 concurrent photos. At 12 MP (36 MB raw bitmap each), 4 concurrent = ~144 MB peak bitmap memory, well within Chrome's ~4 GB tab limit. The PITFALLS.md analysis notes 3-5 as the acceptable range; 4 is the midpoint.

**Example:**
```typescript
// Source: sindresorhus/p-limit README
import pLimit from 'p-limit';

const limit = pLimit(4);

async function processBatch(files: File[], processor: Comlink.Remote<typeof api>) {
  return Promise.all(
    files.map(file =>
      limit(async () => {
        const result = await processor.processImage(file);
        // result.full and result.thumb are ArrayBuffers transferred from worker
        return result;
      })
    )
  );
}
```

### Pattern 5: Safari WebP Fallback

**What:** `OffscreenCanvas.convertToBlob({ type: 'image/webp' })` returns PNG in Safari (silently falls back — no error). Safari does not support WebP output from OffscreenCanvas as of Safari 26.4.

**Detection:** The worker cannot detect this at runtime. Two options:
1. Detect in worker: encode, read `blob.type` — if `'image/png'` was returned instead of `'image/webp'`, fall back
2. Feature-detect on main thread before spinning up the worker

**Recommended approach:** Check `blob.type` after `convertToBlob()`. If Safari returned PNG, the output is still valid (Safari decodes WebP for display anyway), but file size will be larger. For v1, accept this — output will be PNG on Safari but WebP everywhere else. Document as known limitation.

```typescript
// In worker, after convertToBlob:
const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
// Safari returns image/png silently — blob.type will be 'image/png'
// For v1: accept either; Phase 3 viewer decrypts and creates ObjectURL
// regardless of mime type
return blob.arrayBuffer();
```

### Anti-Patterns to Avoid
- **heic2any in a Worker:** Throws `window is not defined`. Use `heic-to/next` instead.
- **`canvas.toDataURL()` anywhere in the pipeline:** Doubles memory footprint vs `toBlob()`; never acceptable for batch work.
- **`createImageBitmap(file, { resizeWidth, resizeHeight })`:** Resize options have inconsistent browser support (historically disabled by default in Firefox). Do the resize in `ctx.drawImage()` on the canvas instead.
- **Single worker instance processing all 200 files serially:** One worker can still block if HEIC conversion is slow. Use p-limit with 4 workers or a single worker that processes 4 in parallel (since HEIC conversion is I/O-like with libheif WASM).
- **Not calling `bitmap.close()`:** ImageBitmap holds GPU memory. GC alone is too slow; by photo 20+ the tab will feel sluggish without explicit close.
- **Reading folder contents from `event.dataTransfer.files`:** This is a flat list and does not include files from nested subdirectories. Must use `webkitGetAsEntry()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker RPC | Custom postMessage protocol | Comlink | postMessage + structured clone has transfer semantics edge cases; Comlink handles error propagation, Transferable objects, and TypeScript types |
| HEIC decoding | Custom HEIF parser | heic-to (wrapping libheif) | HEIF is an extremely complex container format (ISOBMFF + HEVC NAL units); libheif is the reference implementation |
| Concurrency limiting | `counter + queue` semaphore | p-limit | Battle-tested; handles rejection; 0 deps |
| Magic byte detection | MIME type sniffing from File.type | Custom 12-byte slicer (trivial, DO build this) | This one is simple enough to hand-roll; it's just 3 lines |

**Key insight:** The hardest problem in this phase is not image processing — it is HEIC decoding. Every other operation (canvas draw, WebP encode) is a native browser API. Invest zero effort in decoding HEIF/HEVC manually.

---

## Common Pitfalls

### Pitfall 1: heic2any Window Dependency
**What goes wrong:** Importing `heic2any` in a Web Worker throws `ReferenceError: window is not defined`. The issue is closed/wontfix by the maintainer.
**Why it happens:** heic2any internally uses the `Worker` API itself and depends on `window` globals.
**How to avoid:** Use `heic-to` with the `/next` subpath: `import { heicTo } from 'heic-to/next'`. This is the worker-safe build.
**Warning signs:** Any import of `heic2any` inside a `.worker.ts` file.

### Pitfall 2: Safari WebP from OffscreenCanvas
**What goes wrong:** `convertToBlob({ type: 'image/webp' })` silently returns a PNG blob in Safari. Global support is only 80.92% (no Safari at all).
**Why it happens:** Safari has not implemented WebP encoding from OffscreenCanvas (as of Safari 26.4, March 2026).
**How to avoid:** After calling `convertToBlob`, check `blob.type`. For v1, accept the PNG fallback. Document for users on Safari that thumbnails will be slightly larger.
**Warning signs:** Assuming all output blobs are WebP without checking `blob.type`.

### Pitfall 3: readEntries() Returns Max 100 Entries
**What goes wrong:** Dropping a folder of 200 photos only processes the first 100.
**Why it happens:** `FileSystemDirectoryReader.readEntries()` returns at most 100 entries per call by spec.
**How to avoid:** Loop `readEntries()` until it returns an empty array.
**Warning signs:** A single `readEntries()` call without a loop.

### Pitfall 4: Memory Exhaustion at Scale
**What goes wrong:** Processing 200 photos without releasing ImageBitmaps causes progressive memory growth; tab crashes around photo 50-80.
**Why it happens:** Each 12 MP bitmap = ~36 MB. Without `bitmap.close()`, GC is too slow.
**How to avoid:** Call `bitmap.close()` immediately after all `drawImage()` calls are complete. Pair with p-limit concurrency of 4.
**Warning signs:** No `bitmap.close()` in the worker; `toDataURL()` used instead of `toBlob()`; concurrency > 10.

### Pitfall 5: EXIF Still Present After Processing
**What goes wrong:** Output WebP/PNG still contains GPS coordinates.
**Why it happens:** Usually caused by using a library that copies the EXIF block rather than doing a full re-encode through canvas, OR by processing the file without drawing to canvas at all.
**How to avoid:** Always decode → draw to canvas → encode. Never copy bytes from source to output. Canvas draw + re-encode is the stripping mechanism.
**Warning signs:** Using a library that has `preserveExif: true` default; using `FileReader` to read and re-save without canvas draw.

### Pitfall 6: Capturing Dimensions After Resize
**What goes wrong:** `PhotoEntry.width/height` records the resized dimensions (e.g., 2560×1920) instead of the original (e.g., 4032×3024). Phase 4 viewer uses these for aspect ratio layout.
**Why it happens:** Reading `bitmap.width/height` after resize or reading canvas dimensions.
**How to avoid:** Capture `bitmap.width` and `bitmap.height` from `createImageBitmap(sourceBlob)` BEFORE any canvas operations. Pass `{ width: origW, height: origH }` in the return value.

---

## Code Examples

Verified patterns from official sources:

### HEIC Magic Byte Detection
```typescript
// Source: strukturag/libheif issue #83 — ISOBMFF ftyp box structure
export async function isHeic(file: File): Promise<boolean> {
  const buf = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(buf);
  const boxType = String.fromCharCode(b[4], b[5], b[6], b[7]);
  const brand  = String.fromCharCode(b[8], b[9], b[10], b[11]);
  return boxType === 'ftyp' && ['heic', 'heix', 'mif1', 'msf1'].includes(brand);
}
```

### Aspect-Ratio Dimension Calculator
```typescript
// No library needed — pure math
function fitToLongEdge(srcW: number, srcH: number, maxLongEdge: number) {
  const long = Math.max(srcW, srcH);
  if (long <= maxLongEdge) return { w: srcW, h: srcH };
  const scale = maxLongEdge / long;
  return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) };
}
// Usage: fitToLongEdge(4032, 3024, 2560) → { w: 2560, h: 1920 }
// Usage: fitToLongEdge(4032, 3024, 300)  → { w: 300, h: 225 }
```

### OffscreenCanvas WebP Encode
```typescript
// Source: MDN OffscreenCanvas.convertToBlob()
async function encodeWebP(
  bitmap: ImageBitmap,
  w: number,
  h: number,
  quality: number,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  return { buffer: await blob.arrayBuffer(), mimeType: blob.type };
}
```

### Folder Drop Traversal
```typescript
// Source: MDN DataTransferItem.webkitGetAsEntry()
async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  while (true) {
    const batch: FileSystemEntry[] = await new Promise((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

async function traverseEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return [await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject)
    )];
  }
  const dirEntry = entry as FileSystemDirectoryEntry;
  const entries = await readAllEntries(dirEntry.createReader());
  const nested = await Promise.all(entries.map(traverseEntry));
  return nested.flat();
}
```

### p-limit Batch Processing
```typescript
// Source: sindresorhus/p-limit README
import pLimit from 'p-limit';
const limit = pLimit(4);  // 4 concurrent photos

const results = await Promise.all(
  files.map(file =>
    limit(async () => {
      const result = await processorRef.current!.processImage(file);
      updatePhotoStatus(file.name, 'done');
      return result;
    })
  )
);
```

### Comlink Worker Setup in React (useEffect pattern)
```typescript
// Source: park.is Comlink + Next.js 15 blog post
'use client';
import * as Comlink from 'comlink';
import { useEffect, useRef } from 'react';
import type { ProcessorApi } from '@/workers/image-processor.worker';

export function useImageProcessor() {
  const proxyRef = useRef<Comlink.Remote<ProcessorApi> | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('@/workers/image-processor.worker.ts', import.meta.url),
      { type: 'module' }
    );
    proxyRef.current = Comlink.wrap<ProcessorApi>(workerRef.current);
    return () => workerRef.current?.terminate();
  }, []);

  return proxyRef;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| heic2any for HEIC conversion | heic-to (wraps libheif 1.21.2) | heic-to: active; heic2any: last commit 2023 | Worker support; stays current with libheif releases |
| canvas.toDataURL() | canvas.toBlob() / OffscreenCanvas.convertToBlob() | ~2016 | Half the memory for large images |
| main-thread Canvas for resize | OffscreenCanvas in Web Worker | Safari support: 2023 (Safari 17) | No UI blocking; 96% global browser support |
| `new Worker('path/to/file.js')` | `new Worker(new URL(..., import.meta.url), { type: 'module' })` | ~2020 (Webpack/Next.js) | Bundler can tree-shake and chunk the worker |

**Deprecated/outdated:**
- `heic2any`: No Web Worker support; last updated April 2023; do not use.
- `createImageBitmap(file, { resizeWidth, resizeHeight })`: Historically disabled by default in Firefox; use ctx.drawImage() for resizing instead.
- `canvas.toDataURL()`: Never use in a batch processing pipeline — allocates full base64 string in memory.

---

## Open Questions

1. **OffscreenCanvas in Next.js Turbopack**
   - What we know: `new Worker(new URL(..., import.meta.url), { type: 'module' })` is the standard pattern and is verified to work with Comlink in Next.js 15 (park.is article).
   - What's unclear: Whether Next.js 16 Turbopack requires any additional webpack/turbopack config for `.worker.ts` files.
   - Recommendation: Write the worker file, test in dev with `npm run dev`, and check for bundler errors. If the worker URL fails to resolve, add `next.config.js` webpack rule for `*.worker.ts`.

2. **p-limit ESM in Worker context**
   - What we know: p-limit 7.x is pure ESM. Workers using `{ type: 'module' }` support ESM imports.
   - What's unclear: Whether Turbopack correctly bundles p-limit as a worker dependency.
   - Recommendation: Use p-limit on the main thread (in the hook) rather than inside the worker. The concurrency limit controls how many `Comlink.wrap().processImage()` calls are in-flight, not worker-internal parallelism.

3. **heic-to CSP/eval restrictions**
   - What we know: heic-to has a `/csp` subpath suggesting the standard build uses eval (WASM instantiation).
   - What's unclear: Whether the `/next` worker subpath also requires relaxed CSP (`wasm-unsafe-eval`).
   - Recommendation: If CSP is enforced in Next.js headers config (Phase 1 may have set this), add `wasm-unsafe-eval` to `script-src`. Test with real HEIC file.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x + jsdom |
| Config file | `vitest.config.ts` (exists, configured with jsdom + @vitejs/plugin-react + `@` alias) |
| Quick run command | `npx vitest run --reporter=verbose src/lib/image/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROC-01 | File drop handler accepts image files | unit | `npx vitest run src/lib/image/heic-detect.test.ts` | ❌ Wave 0 |
| PROC-02 | Folder traversal reads nested files | unit | `npx vitest run src/lib/image/folder-traverse.test.ts` | ❌ Wave 0 |
| PROC-03 | Output WebP contains no EXIF GPS tags | integration | `npx vitest run src/lib/image/exif-strip.test.ts` | ❌ Wave 0 |
| PROC-04 | Resize respects max long edge and aspect ratio | unit | `npx vitest run src/lib/image/dimensions.test.ts` | ❌ Wave 0 |
| PROC-05 | WebP output produced (or PNG fallback on Safari) | unit | included in dimensions.test.ts | ❌ Wave 0 |
| PROC-06 | Thumbnail dimensions ≤ 300px on long edge | unit | included in dimensions.test.ts | ❌ Wave 0 |
| PROC-07 | HEIC magic byte detection accurate | unit | `npx vitest run src/lib/image/heic-detect.test.ts` | ❌ Wave 0 |
| PROC-08 | Worker initialized off main thread | manual | DevTools Performance timeline — manual only | N/A |
| PROC-09 | 200-photo batch completes without OOM | manual | Chrome DevTools Memory profiler — manual only | N/A |

**Note:** PROC-08 and PROC-09 require manual browser testing; they cannot be meaningfully tested in jsdom.

**EXIF verification note:** jsdom does not support canvas or blob encoding. EXIF strip test (PROC-03) should use a real browser integration test (Playwright) or verify via the `exifr` library reading the output blob. For unit testing, a mock approach that verifies the pipeline calls `drawImage` (not byte-copy) is acceptable.

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/image/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual 200-photo load test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/image/heic-detect.test.ts` — covers PROC-01, PROC-07
- [ ] `src/lib/image/dimensions.test.ts` — covers PROC-04, PROC-05, PROC-06
- [ ] `src/lib/image/folder-traverse.test.ts` — covers PROC-02 (mock FileSystemEntry)
- [ ] `src/lib/image/exif-strip.test.ts` — covers PROC-03 (requires exifr or manual verification)

---

## Sources

### Primary (HIGH confidence)
- [MDN OffscreenCanvas.convertToBlob()](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob) — convertToBlob API, quality param, type param
- [MDN ImageBitmap.close()](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap/close) — explicit memory release requirement
- [MDN WorkerGlobalScope.createImageBitmap()](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/createImageBitmap) — Baseline Widely Available; resize options
- [MDN DataTransferItem.webkitGetAsEntry()](https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry) — folder traversal API
- [caniuse OffscreenCanvas](https://caniuse.com/offscreencanvas) — 96.34% global support, Safari 17+
- [caniuse OffscreenCanvas convertToBlob WebP](https://caniuse.com/mdn-api_offscreencanvas_converttoblob_option_type_parameter_webp) — 80.92%; **Safari: 0% support** for WebP output

### Secondary (MEDIUM confidence)
- [heic-to GitHub (hoppergee)](https://github.com/hoppergee/heic-to) — Web Worker support via `/next` subpath; version 1.4.2 confirmed
- [heic2any GitHub issue #19](https://github.com/alexcorvi/heic2any/issues/19) — confirmed `window is not defined` in workers; wontfix
- [park.is — Web Workers in Next.js 15 with Comlink](https://park.is/blog_posts/20250417_nextjs_comlink_examples/) — useEffect pattern, Comlink.wrap, module worker URL
- [p-limit GitHub (sindresorhus)](https://github.com/sindresorhus/p-limit) — version 7.3.0, API verified
- [strukturag/libheif issue #83](https://github.com/strukturag/libheif/issues/83) — HEIC magic byte structure (ftyp box + major brand)

### Tertiary (LOW confidence)
- [Trailhead Technology: Safely Process Images Without Memory Overflows](https://trailheadtechnology.com/safely-process-images-in-the-browser-without-memory-overflows/) — batch pipeline design; single source, unverified
- React-dropzone folder traversal: community documentation; `webkitGetAsEntry` not exposed natively by react-dropzone — requires custom drop handler

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm view; heic-to worker support confirmed via GitHub source
- Architecture: HIGH — OffscreenCanvas, Comlink, createImageBitmap all from MDN + official sources
- Pitfalls: HIGH — heic2any limitation confirmed via GitHub issue; Safari WebP confirmed via caniuse data; readEntries() 100-entry limit is in the File System API spec

**Research date:** 2026-03-19
**Valid until:** 2026-06-19 (stable Web APIs; heic-to is actively maintained; re-check if Safari adds WebP encode support)
