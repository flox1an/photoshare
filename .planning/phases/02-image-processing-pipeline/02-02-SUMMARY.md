---
phase: 02-image-processing-pipeline
plan: "02"
subsystem: image-processing
tags: [heic, offscreencanvas, web-worker, comlink, heic-to, webp, image-resize]

# Dependency graph
requires:
  - phase: 02-image-processing-pipeline
    plan: "01"
    provides: Wave 0 test scaffolds (heic-detect.test.ts, dimensions.test.ts), ProcessedPhoto/ProcessorApi types, heic-to/next + comlink dependencies
provides:
  - isHeic() HEIC magic byte detector (src/lib/image/heic-detect.ts)
  - fitToLongEdge() aspect-ratio dimension calculator (src/lib/image/dimensions.ts)
  - Comlink-exposed processImage() Web Worker (src/workers/image-processor.worker.ts)
affects:
  - 02-image-processing-pipeline plan 04 (useImageProcessor hook wires main thread to this worker)
  - 02-image-processing-pipeline plan 05 (UI manual browser test uses worker)
  - 03-encryption-and-upload (consumes ProcessedPhoto.full and .thumb ArrayBuffers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HEIC detection via ISO BMFF magic bytes (ftyp box), never File.type"
    - "Triple-slash reference lib=webworker for worker-specific globals without polluting tsconfig"
    - "Two-pass OffscreenCanvas encoding: full (2560px q=0.85) then thumb (300px q=0.75) from same ImageBitmap"
    - "bitmap.close() immediately after all encoding passes — explicit GPU memory release for 200-photo batches"
    - "heic-to/next (worker-safe WASM HEIF decoder) instead of heic2any (breaks in Worker, uses window)"

key-files:
  created:
    - src/lib/image/heic-detect.ts
    - src/lib/image/dimensions.ts
    - src/workers/image-processor.worker.ts
  modified: []

key-decisions:
  - "Worker re-implements HEIC detection inline (detectHeicInWorker) to avoid importing main-thread isHeic across Worker boundary — same logic, avoids serialization concerns"
  - "origW/origH captured from bitmap.width/height before any OffscreenCanvas resize — these feed PhotoEntry for Phase 4 aspect-ratio grid"
  - "mimeType read from blob.type after convertToBlob — Safari silently returns image/png; caller must not assume image/webp"

patterns-established:
  - "Magic byte detection: read 12 bytes, check bytes[4-7]=ftyp and bytes[8-11] in HEIC brands"
  - "fitToLongEdge: long = max(w, h); if long <= max return original; else scale = max/long, round both"

requirements-completed:
  - PROC-03
  - PROC-04
  - PROC-05
  - PROC-06
  - PROC-07
  - PROC-08
  - PROC-09

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 02 Plan 02: Image Processing Core Summary

**HEIC magic-byte detector, aspect-ratio resize math, and Comlink Web Worker with two-pass OffscreenCanvas encoding — all 12 Wave 0 unit tests GREEN in 3 minutes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T15:39:40Z
- **Completed:** 2026-03-19T15:42:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `isHeic()` reads 12-byte HEIC ftyp magic bytes to detect HEIC files (never trusts File.type) — all 6 heic-detect tests GREEN
- `fitToLongEdge()` scales dimensions to max long-edge while preserving aspect ratio, never upscales — all 6 dimensions tests GREEN
- `image-processor.worker.ts` implements the full pipeline: HEIC detect/convert → createImageBitmap → two OffscreenCanvas passes → bitmap.close() → ProcessedPhoto return
- TypeScript compiles clean with zero errors (webworker globals via triple-slash reference)

## Task Commits

Each task was committed atomically:

1. **Task 1: heic-detect.ts + dimensions.ts** - `9c7fa2f` (feat)
2. **Task 2: image-processor.worker.ts** - `4cd193a` (feat)

## Files Created/Modified
- `src/lib/image/heic-detect.ts` - Async HEIC detection via ISO BMFF magic bytes (ftyp box)
- `src/lib/image/dimensions.ts` - fitToLongEdge() resize calculator with no-upscale guard
- `src/workers/image-processor.worker.ts` - Comlink-exposed Web Worker: HEIC convert + bitmap + dual canvas encode + bitmap.close()

## Decisions Made
- Worker re-implements HEIC detection inline rather than importing isHeic from main-thread lib — avoids Worker import boundary complexity, same logic
- origW/origH captured from bitmap.width/height immediately after createImageBitmap (before any resize) — these are the ORIGINAL dimensions that feed PhotoEntry for Phase 4 layout
- mimeType populated from blob.type after convertToBlob (not hardcoded 'image/webp') — Safari silently returns image/png; viewer handles both

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — both implementations compiled and tested GREEN on first attempt.

## Next Phase Readiness
- Processing engine complete; Plan 03 (encryption helpers) and Plan 04 (useImageProcessor hook) can proceed in parallel
- Worker is only validatable in a real browser (OffscreenCanvas unavailable in jsdom) — Plan 05 manual browser test covers end-to-end

---
*Phase: 02-image-processing-pipeline*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: src/lib/image/heic-detect.ts
- FOUND: src/lib/image/dimensions.ts
- FOUND: src/workers/image-processor.worker.ts
- FOUND: .planning/phases/02-image-processing-pipeline/02-02-SUMMARY.md
- FOUND: commit 9c7fa2f (Task 1)
- FOUND: commit 4cd193a (Task 2)
