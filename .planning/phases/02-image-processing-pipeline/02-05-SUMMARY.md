---
phase: 02-image-processing-pipeline
plan: "05"
subsystem: ui
tags: [react, react-dropzone, zustand, drag-drop, folder-traversal, heic, exif-strip, webp, nextjs]

# Dependency graph
requires:
  - phase: 02-image-processing-pipeline
    provides: useImageProcessor hook, processingStore, folder-traverse, image-processor.worker
provides:
  - Drop zone UI component with folder traversal via webkitGetAsEntry
  - Per-photo progress list reading live from Zustand store
  - UploadPanel composing DropZone + ProgressList + useImageProcessor
  - Complete user-facing image processing pipeline
affects: [03-nostr-publishing, 04-album-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native onDrop handler for folder drops (webkitGetAsEntry) alongside react-dropzone for file picker"
    - "Streaming file batches into store as entries are resolved (avoids UI lag on large drops)"
    - "StatusDot with animate-pulse for live processing state feedback"

key-files:
  created:
    - src/components/upload/DropZone.tsx
    - src/components/upload/ProgressList.tsx
  modified:
    - src/components/upload/UploadPanel.tsx

key-decisions:
  - "Native onDrop intercepts folder drops using webkitGetAsEntry; react-dropzone handles file picker and individual file drops"
  - "Files streamed into store in chunks during native drop handling to prevent UI lag on large batches"
  - "Individual file drops handled by react-dropzone's onDrop callback; hasDirectory check routes folder drops to traversal path"

patterns-established:
  - "DropZone pattern: combine react-dropzone getRootProps/getInputProps with native onDrop override for folder support"
  - "ProgressList pattern: pure read from Zustand store — no local state, re-renders driven by store updates"

requirements-completed: [PROC-01, PROC-02]

# Metrics
duration: ~45min
completed: 2026-03-19
---

# Phase 2 Plan 05: Upload UI Summary

**Drag-drop upload panel with folder traversal (webkitGetAsEntry), per-photo Zustand-driven progress list, and accumulate-mode batching wired to the complete HEIC/EXIF-strip/WebP processing pipeline**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-19
- **Completed:** 2026-03-19
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 3

## Accomplishments

- DropZone.tsx with dual-mode drop handling: react-dropzone for individual file picks and native onDrop for folder traversal via webkitGetAsEntry API
- ProgressList.tsx rendering per-photo status (pending/processing/done/error) with animated blue dot for in-progress items, read directly from Zustand processingStore
- UploadPanel.tsx replacing stub — composes DropZone + ProgressList with useImageProcessor, providing the complete user-facing surface of Phase 2
- Browser verification confirmed: individual file drops, folder traversal, accumulate mode, and HEIC conversion all working; two bugs found and fixed during verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement DropZone.tsx and ProgressList.tsx** - `2ab4815` (feat)
2. **Task 2: Wire UploadPanel.tsx** - `093b294` (feat)
3. **Task 3: Browser verification checkpoint** - Approved by user; bugs fixed at `401faf1` (fix)

## Files Created/Modified

- `src/components/upload/DropZone.tsx` - Drop zone UI using react-dropzone + native folder traversal; filters image files; streams to processBatch
- `src/components/upload/ProgressList.tsx` - Per-photo status list reading from Zustand store; StatusDot with animate-pulse for processing state
- `src/components/upload/UploadPanel.tsx` - Orchestrator composing DropZone + ProgressList with useImageProcessor hook

## Decisions Made

- Native onDrop handler intercepts all drops to access dataTransfer.items for webkitGetAsEntry; individual files fall through to react-dropzone's onDrop callback via hasDirectory check
- Files streamed into the store in chunks as entries are resolved to avoid UI lag on large folder drops (200+ files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Individual file drops not processed by native handler**
- **Found during:** Task 3 (Browser verification)
- **Issue:** The native onDrop handler only forwarded to traversal when hasDirectory was true; plain file drops had entries but no directories, so the handler returned without calling onFiles — react-dropzone's onDrop was also not firing because the native handler called e.stopPropagation()
- **Fix:** Adjusted the native handler to call onFiles for individual file entries when hasDirectory is false, preventing the event from being silently swallowed
- **Files modified:** src/components/upload/DropZone.tsx
- **Verification:** Dropped individual JPEGs — all appeared in ProgressList and processed to done
- **Committed in:** 401faf1

**2. [Rule 1 - Bug] UI lag when dropping large batches (streaming fix)**
- **Found during:** Task 3 (Browser verification)
- **Issue:** All file entries were collected via Promise.all before any were added to the store; dropping a folder of 200 photos caused a noticeable freeze before the list appeared
- **Fix:** Streamed file additions to the store in chunks as each traverseEntry promise resolved, so the list populates progressively
- **Files modified:** src/components/upload/DropZone.tsx
- **Verification:** 200-photo folder drop showed entries appearing progressively; no UI freeze observed
- **Committed in:** 401faf1

---

**Total deviations:** 2 auto-fixed (2 bugs found during browser verification)
**Impact on plan:** Both fixes necessary for correctness and UX. No scope creep.

## Issues Encountered

- dataTransfer.items must be read synchronously before any await (browser clears the object after the microtask boundary) — this was documented in the plan interfaces section and was correctly handled in the initial implementation

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete Phase 2 image processing pipeline is working end-to-end: drag-drop → HEIC detection → EXIF strip → WebP encode → Zustand store → ProgressList
- Phase 3 (Nostr publishing) can consume processed photos from processingStore
- The ProcessedPhoto shape (ArrayBuffer full + thumb, width/height as original pre-resize) is established and ready for Phase 4 album viewer layout

---
*Phase: 02-image-processing-pipeline*
*Completed: 2026-03-19*
