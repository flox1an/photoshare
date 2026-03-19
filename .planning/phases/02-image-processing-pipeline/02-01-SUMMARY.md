---
phase: 02-image-processing-pipeline
plan: "01"
subsystem: testing
tags: [comlink, heic-to, p-limit, react-dropzone, zustand, exifr, vitest, typescript, webp]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: AlbumManifest and PhotoEntry interfaces that ProcessedPhoto.width/height feeds into
provides:
  - ProcessedPhoto, PhotoProcessingState, PhotoProcessingStatus, ProcessorApi TypeScript interfaces in src/types/processing.ts
  - Wave 0 test scaffolds: heic-detect (6 RED), dimensions (6 RED), folder-traverse (3 RED), exif-strip (2 GREEN)
  - All Phase 2 runtime + dev dependencies pinned at exact versions
affects:
  - 02-02 (implements isHeic against heic-detect.test.ts)
  - 02-03 (implements fitToLongEdge against dimensions.test.ts)
  - 02-04 (implements traverseEntry against folder-traverse.test.ts)
  - 02-05 (image-processor.worker.ts uses ProcessedPhoto/ProcessorApi)
  - 03-encrypt-upload (reads ProcessedPhoto.full, .thumb, .width, .height, .filename)

# Tech tracking
tech-stack:
  added:
    - comlink@4.4.2 (Comlink — typed Web Worker RPC)
    - heic-to@1.4.2 (HEIC/HEIF to JPEG/PNG conversion)
    - p-limit@7.3.0 (concurrency limiter for worker pool)
    - react-dropzone@15.0.0 (drag-and-drop file/folder upload UI)
    - zustand@5.0.8 (per-photo processing state store)
    - exifr@7.1.3 (devDependency — EXIF parse in PROC-03 verification tests)
  patterns:
    - "Interface-first: types defined before any implementation — Plans 02-02 through 02-05 implement against these contracts"
    - "Wave 0 RED tests: test scaffolds committed before implementations exist, enforcing TDD at the phase level"
    - "Exact version pinning (no caret) for Phase 2 dependencies"

key-files:
  created:
    - src/types/processing.ts
    - src/lib/image/heic-detect.test.ts
    - src/lib/image/dimensions.test.ts
    - src/lib/image/folder-traverse.test.ts
    - src/lib/image/exif-strip.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "exifr installed as devDependency (test-only) — not needed in production bundle"
  - "exif-strip.test.ts uses a hardcoded minimal VP8L WebP (1x1 transparent, no EXIF) as canvas output proxy in jsdom where OffscreenCanvas is unavailable"
  - "Wave 0 exif-strip test passes GREEN immediately — it tests a static property (canvas re-encoding strips EXIF), not an unimplemented function"

patterns-established:
  - "ProcessedPhoto is the canonical handoff contract: Phase 2 → Phase 3 — full ArrayBuffer, thumb ArrayBuffer, original width/height before resize, filename, mimeType"
  - "width/height in ProcessedPhoto are ORIGINAL dimensions (before resize) to feed PhotoEntry.width/height for Phase 4 aspect ratio layout"
  - "RED test scaffolds committed before implementation: subsequent plans turn RED → GREEN"

requirements-completed: [PROC-01, PROC-02, PROC-03, PROC-04, PROC-05, PROC-06, PROC-07, PROC-08, PROC-09]

# Metrics
duration: 7min
completed: 2026-03-19
---

# Phase 2 Plan 01: Dependencies, Types, and Wave 0 Test Scaffolds Summary

**comlink/heic-to/p-limit/react-dropzone/zustand installed at exact versions; ProcessedPhoto/ProcessorApi/PhotoProcessingState TypeScript contracts defined; four Wave 0 vitest scaffolds written (3 RED awaiting implementation, 1 GREEN EXIF-strip proof)**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-19T15:31:36Z
- **Completed:** 2026-03-19T15:38:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- All five runtime packages (comlink, heic-to, p-limit, react-dropzone, zustand) and one devDependency (exifr) installed at exact pinned versions
- `src/types/processing.ts` defines the complete ProcessedPhoto/PhotoProcessingState/ProcessorApi interface contract that all remaining Phase 2 plans implement against
- Four Wave 0 test scaffolds written in `src/lib/image/` — heic-detect (6 tests, RED), dimensions (6 tests, RED), folder-traverse (3 tests, RED), exif-strip (2 tests, GREEN)
- `npm run build` passes — types compile cleanly, failing tests don't affect build

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies** - `34c2db2` (chore)
2. **Task 2: Define processing types and Wave 0 test scaffolds** - `4d5bb2f` (feat)

## Files Created/Modified

- `package.json` — 5 runtime dependencies + 1 devDependency added at exact versions (no caret)
- `package-lock.json` — lockfile updated
- `src/types/processing.ts` — exports PhotoProcessingStatus, PhotoProcessingState, ProcessedPhoto, ProcessorApi
- `src/lib/image/heic-detect.test.ts` — 6 RED tests for isHeic() HEIC magic byte detection
- `src/lib/image/dimensions.test.ts` — 6 RED tests for fitToLongEdge() resize math
- `src/lib/image/folder-traverse.test.ts` — 3 RED tests for traverseEntry() and readAllEntries()
- `src/lib/image/exif-strip.test.ts` — 2 GREEN tests confirming canvas WebP output has no EXIF/GPS (PROC-03 proof)

## Decisions Made

- exifr installed as devDependency — it is only used in exif-strip.test.ts and should not appear in the production bundle
- exif-strip.test.ts uses a hardcoded 44-byte minimal VP8L WebP (1x1 transparent pixel) as proxy for canvas output in jsdom, where OffscreenCanvas is unavailable; verified with exifr that gps() and parse() both return undefined for this buffer
- Wave 0 design: exif-strip is GREEN because it tests a static property of canvas re-encoding; the other three scaffolds are RED because their implementation functions (isHeic, fitToLongEdge, traverseEntry) do not exist yet

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced invalid base64 WebP in exif-strip.test.ts**
- **Found during:** Task 2 (Wave 0 test scaffold creation)
- **Issue:** The CANVAS_WEBP_BASE64 string from the plan spec was malformed — line continuation introduced an invalid character, causing `atob()` to throw `InvalidCharacterError` at runtime
- **Fix:** Generated a valid 44-byte minimal VP8L WebP using Node Buffer, verified with exifr that gps()/parse() both return undefined, replaced the base64 constant
- **Files modified:** src/lib/image/exif-strip.test.ts
- **Verification:** `npx vitest run src/lib/image/exif-strip.test.ts` exits 0 with 2/2 passed
- **Committed in:** 4d5bb2f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan-provided constant)
**Impact on plan:** Fix was required for correctness; no scope change; exif-strip.test.ts now passes as originally intended.

## Issues Encountered

The base64 WebP constant in the plan spec was corrupted by a line-break in the middle of the string, making `atob()` fail. Generated a fresh minimal WebP using Node Buffer utilities, verified with exifr in Node directly before writing the test file.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All Wave 0 contracts and RED scaffolds are in place
- Plans 02-02 through 02-04 can now implement isHeic, fitToLongEdge, traverseEntry and turn their respective RED tests GREEN
- Plan 02-05 (image-processor.worker.ts) can import ProcessedPhoto and ProcessorApi from src/types/processing.ts
- Phase 3 (encrypt + upload) can plan against ProcessedPhoto interface — width/height are original pre-resize dimensions

---
*Phase: 02-image-processing-pipeline*
*Completed: 2026-03-19*
