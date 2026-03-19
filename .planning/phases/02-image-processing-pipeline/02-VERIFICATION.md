---
phase: 02-image-processing-pipeline
verified: 2026-03-19T16:04:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Drag-and-drop folder of 200 photos — verify no page freeze and all files processed"
    expected: "Folder contents appear progressively in ProgressList; processing completes without tab crash"
    why_human: "PROC-09 memory stability under real browser load cannot be verified by static analysis or unit tests — requires real GPU bitmap allocation with 200 12 MP images in Chrome"
  - test: "Drop HEIC files from iPhone — verify they process to done status"
    expected: "HEIC files appear in ProgressList and reach 'done' state with no error"
    why_human: "PROC-07 HEIC conversion via heic-to/next WASM requires a real browser with a live worker — jsdom cannot run OffscreenCanvas or WASM"
  - test: "Drop a geotagged JPEG (from smartphone with location enabled), then inspect the processed WebP for EXIF/GPS"
    expected: "exifr.gps() returns undefined; no Make/Model/DateTimeOriginal present"
    why_human: "PROC-03 automated coverage (exif-strip.test.ts) uses a static WebP blob. Full confirmation requires a real camera photo run through the live worker pipeline and checked with an external EXIF reader"
  - test: "Drop individual files, then drop more files — verify accumulate mode"
    expected: "Second drop adds to the existing list rather than resetting it; all entries visible"
    why_human: "Requires interactive browser session — accumulate mode wiring is correct in code but confirmation is visual"
---

# Phase 2: Image Processing Pipeline — Verification Report

**Phase Goal:** Up to 200 photos can be dragged in and processed client-side without blocking the UI or exhausting browser memory
**Verified:** 2026-03-19T16:04:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | comlink, heic-to, p-limit, react-dropzone, and zustand are installed and importable | VERIFIED | All 5 packages present in package.json dependencies at exact pinned versions; exifr in devDependencies |
| 2 | ProcessedPhoto and PhotoProcessingState types define the canonical output contract for Phase 3 | VERIFIED | `src/types/processing.ts` exports ProcessedPhoto, PhotoProcessingState, PhotoProcessingStatus, ProcessorApi with all required fields including mimeType for Safari fallback |
| 3 | isHeic() correctly identifies HEIC files by magic bytes, never by File.type | VERIFIED | `src/lib/image/heic-detect.ts` reads bytes 4-11 via `file.slice(0, 12).arrayBuffer()`; File.type appears only in a comment; 6 unit tests passing |
| 4 | fitToLongEdge() scales dimensions respecting aspect ratio and never upscales | VERIFIED | `src/lib/image/dimensions.ts` uses `Math.max` + guard; 6 unit tests all passing including portrait, landscape, no-upscale, and thumbnail cases |
| 5 | The worker processes a File through HEIC-detect → heicTo → createImageBitmap → two OffscreenCanvas passes → bitmap.close() | VERIFIED | `src/workers/image-processor.worker.ts` implements full pipeline; `bitmap.close()` called before return; uses heic-to/next (not heic2any); Comlink.expose(api) present |
| 6 | Folder traversal handles pagination (readEntries returns at most 100 per call) | VERIFIED | `src/lib/image/folder-traverse.ts` uses `while (true)` loop with `batch.length === 0` break; 3 unit tests including pagination test all passing |
| 7 | Zustand store tracks per-photo status with five actions | VERIFIED | `src/store/processingStore.ts` exports useProcessingStore with addPhotos, setProcessing, setResult, setError, reset; accumulate-by-default (does not call reset in addPhotos) |
| 8 | useImageProcessor hook creates worker in useEffect, limits concurrency to 4 via p-limit, terminates on unmount | VERIFIED | `src/hooks/useImageProcessor.ts` — useEffect creates worker; `pLimit(4)` in limitRef; `workerRef.current?.terminate()` in cleanup; 'use client' directive present |
| 9 | DropZone + ProgressList + UploadPanel compose the complete user-facing surface with no stubs | VERIFIED | UploadPanel renders DropZone and ProgressList; DropZone wires traverseEntry + processBatch; ProgressList reads live from useProcessingStore; no placeholder text; `npm run build` exits 0 |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/processing.ts` | ProcessedPhoto, PhotoProcessingState, PhotoProcessingStatus, ProcessorApi types | VERIFIED | All 4 exported; mimeType field present for Safari fallback |
| `src/lib/image/heic-detect.ts` | isHeic() magic byte detector | VERIFIED | Exports `isHeic`; reads slice(0,12); checks ftyp + brand array; no File.type usage in code |
| `src/lib/image/dimensions.ts` | fitToLongEdge() aspect-ratio calculator | VERIFIED | Exports `fitToLongEdge`; Math.round applied; no-upscale guard present |
| `src/workers/image-processor.worker.ts` | Comlink-exposed processImage() | VERIFIED | heic-to/next import; bitmap.close(); Comlink.expose(api); fitToLongEdge used for both passes; origW/origH captured before resize |
| `src/lib/image/folder-traverse.ts` | traverseEntry() and readAllEntries() with pagination | VERIFIED | Both exported; while(true) pagination loop; recursive directory flattening |
| `src/store/processingStore.ts` | Zustand store with 5 actions | VERIFIED | useProcessingStore exported; all 5 actions present; accumulate mode confirmed |
| `src/hooks/useImageProcessor.ts` | Worker lifecycle + p-limit(4) + store integration | VERIFIED | useEffect worker init; pLimit(4); terminate on unmount; processBatch exported |
| `src/components/upload/DropZone.tsx` | Drop zone with folder traversal wired | VERIFIED | webkitGetAsEntry + traverseEntry present; onFiles wired; isImageFile filter; streaming chunk pattern |
| `src/components/upload/ProgressList.tsx` | Per-photo status list | VERIFIED | useProcessingStore; renders filename + status + error; animate-pulse for processing state |
| `src/components/upload/UploadPanel.tsx` | Orchestrator composing DropZone + ProgressList | VERIFIED | No stub text; useImageProcessor; DropZone + ProgressList imported and rendered |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/types/processing.ts` | `src/workers/image-processor.worker.ts` | ProcessorApi and ProcessedPhoto types | WIRED | Worker imports `type { ProcessedPhoto, ProcessorApi }` from `@/types/processing`; api is typed as `ProcessorApi` |
| `src/types/processing.ts` | `src/hooks/useImageProcessor.ts` | PhotoProcessingState per-photo store shape | WIRED | Hook imports `type { ProcessorApi }`; store imports `PhotoProcessingState` from processing.ts |
| `src/workers/image-processor.worker.ts` | `heic-to/next` | heicTo({ blob: file, type: 'image/jpeg', quality: 1 }) | WIRED | `import { heicTo } from 'heic-to/next'` present; called in processImage when HEIC detected |
| `src/lib/image/dimensions.ts` | `src/workers/image-processor.worker.ts` | fitToLongEdge used for both full and thumb passes | WIRED | Worker imports fitToLongEdge; calls it twice with 2560 and 300 max |
| `src/hooks/useImageProcessor.ts` | `src/workers/image-processor.worker.ts` | Comlink.wrap<ProcessorApi>(new Worker(new URL(...))) | WIRED | Exact pattern present in useEffect |
| `src/hooks/useImageProcessor.ts` | `src/store/processingStore.ts` | calls addPhotos(), setProcessing(), setResult(), setError() | WIRED | All four store actions called in processBatch |
| `src/hooks/useImageProcessor.ts` | `p-limit` | pLimit(4) gates concurrent processImage() calls | WIRED | `import pLimit from 'p-limit'`; `pLimit(4)` in limitRef; limit() wraps each worker call |
| `src/components/upload/DropZone.tsx` | `src/lib/image/folder-traverse.ts` | traverseEntry called on webkitGetAsEntry results | WIRED | `import { traverseEntry }` present; called inside handleNativeDrop |
| `src/components/upload/DropZone.tsx` | `src/hooks/useImageProcessor.ts` | onFiles prop receives processBatch | WIRED | UploadPanel passes processBatch as onFiles to DropZone |
| `src/components/upload/ProgressList.tsx` | `src/store/processingStore.ts` | useProcessingStore() reads photos map | WIRED | `useProcessingStore((state) => state.photos)` — selector-based subscription |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROC-01 | 02-01, 02-05 | User can drag-and-drop image files | SATISFIED | DropZone accepts file drops via react-dropzone + native handler; onFiles → processBatch wired |
| PROC-02 | 02-01, 02-03, 02-05 | User can drag-and-drop entire folders | SATISFIED | folder-traverse.ts with pagination loop; traverseEntry called from DropZone native handler |
| PROC-03 | 02-01, 02-02 | EXIF/geolocation stripped client-side | SATISFIED | Canvas re-encoding in worker strips EXIF; exif-strip.test.ts passes with hardcoded WebP blob |
| PROC-04 | 02-01, 02-02 | Images resized to full-screen dimensions | SATISFIED | fitToLongEdge(origW, origH, 2560) applied in worker; 6 passing unit tests |
| PROC-05 | 02-02 | Images converted to WebP format | SATISFIED | `convertToBlob({ type: 'image/webp', quality: 0.85 })` in encodeCanvas; mimeType returned |
| PROC-06 | 02-01, 02-02 | Thumbnails generated client-side | SATISFIED | Second OffscreenCanvas pass with fitToLongEdge(origW, origH, 300), quality 0.75 |
| PROC-07 | 02-01, 02-02 | HEIC/HEIF files detected and converted | SATISFIED (automated) | isHeic() by magic bytes; heicTo({ blob: file, type: 'image/jpeg' }) in worker; 6 unit tests |
| PROC-08 | 02-01, 02-04 | Processing in Web Workers (non-blocking UI) | SATISFIED | Worker created via new Worker(...) in useEffect; Comlink bridges main thread; processBatch is async |
| PROC-09 | 02-01, 02-04 | 200 photos without browser crash | SATISFIED (code) / NEEDS HUMAN | bitmap.close() after each photo; pLimit(4) caps concurrent GPU allocations; runtime stability needs browser confirmation |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/upload/ProgressList.tsx` | 10 | `return null` | Info | Intentional guard: returns null when no photos queued — correct empty-state handling, not a stub |

No blockers. The `return null` at line 10 of ProgressList is the correct React pattern for rendering nothing when the queue is empty.

### Human Verification Required

#### 1. Memory stability under 200-photo load (PROC-09)

**Test:** Open the app in Chrome; drag a folder of 200 high-resolution photos (12+ MP JPEG or HEIC) onto the drop zone
**Expected:** All 200 entries appear in ProgressList and progress to "done"; the browser tab does not crash or freeze; Chrome Task Manager shows heap stabilizing rather than growing monotonically
**Why human:** bitmap.close() and pLimit(4) are present in code, but actual GPU memory allocation and release can only be confirmed under a real browser with real image data. No jsdom equivalent exists for OffscreenCanvas or ImageBitmap.

#### 2. HEIC conversion end-to-end (PROC-07)

**Test:** Drop 2-3 actual .HEIC files from an iPhone onto the drop zone
**Expected:** HEIC files transition from pending to processing to done without error; processed result is a WebP ArrayBuffer
**Why human:** The worker uses heic-to/next WASM, which requires a real browser environment. jsdom cannot execute OffscreenCanvas or WebAssembly modules. The unit tests only cover isHeic() detection logic, not the full conversion pipeline.

#### 3. EXIF/GPS strip confirmation (PROC-03)

**Test:** Drop a geotagged smartphone photo; after processing reaches "done", extract the WebP from the Zustand store and check it with an EXIF tool (e.g. https://www.metadata2go.com/ or exiftool)
**Expected:** No GPS coordinates, no Make/Model, no DateTimeOriginal in the output WebP
**Why human:** exif-strip.test.ts uses a pre-baked EXIF-free WebP blob. It confirms that a canvas-produced WebP without EXIF has no EXIF — but does not run a geotagged source image through the live worker to confirm the strip happens. Manual confirmation closes this gap.

#### 4. Accumulate mode (PROC-01/PROC-02)

**Test:** Drop 5 files; wait for "done"; drop 5 more files
**Expected:** ProgressList shows 10 entries total (original 5 still visible + 5 new ones processing)
**Why human:** Accumulate behavior is correctly coded (addPhotos spreads into existing state), but the visual confirmation and the absence of a reset on second drop is a runtime behavior that merits a quick human check.

### Gaps Summary

No automated gaps. All 9 required truths are verified in the codebase:

- All 10 required source files exist with substantive implementations (not stubs)
- All 10 key wiring links are confirmed present and active
- All 9 requirements (PROC-01 through PROC-09) are implemented
- 43 tests pass across 7 test files including all 17 lib/image tests
- TypeScript compiles without errors
- `npm run build` exits 0

The 4 human-verification items above are runtime/browser behaviors that static analysis cannot confirm. They do not represent code gaps — the code is complete. They confirm that the implementations work correctly under real-world conditions (real images, real GPU memory, real browser WASM execution).

---

_Verified: 2026-03-19T16:04:00Z_
_Verifier: Claude (gsd-verifier)_
