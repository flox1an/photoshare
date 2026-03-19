---
phase: 04-share-link-and-viewer
plan: "03"
subsystem: ui
tags: [react, hooks, jszip, crypto, blossom, lazy-loading, object-url]

# Dependency graph
requires:
  - phase: 04-share-link-and-viewer/04-02
    provides: "loadAlbumEvent, decryptManifest, fetchBlob — all called by useAlbumViewer"
  - phase: 01-foundation
    provides: "importKeyFromBase64url, decryptBlob, base64urlToUint8Array from crypto.ts"
provides:
  - "useAlbumViewer hook: central data orchestration for album viewer"
  - "downloadAll(photos, key, server, onProgress?) with JSZip + <a> anchor trigger"
  - "loadThumbnail(index) and loadFullImage(index) for lazy on-demand blob decryption"
affects:
  - "04-04 — ThumbnailGrid and Lightbox UI components consume this hook"
  - "04-05 — ViewerPanel root component wires useAlbumViewer to all sub-components"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useCallback for stable function references in hooks with mutable closure deps"
    - "useRef for object URL tracking across renders (reliable unmount cleanup)"
    - "downloadAll as standalone async function (not side-effecting useEffect)"

key-files:
  created:
    - src/hooks/useAlbumViewer.ts
  modified:
    - src/hooks/useAlbumViewer.test.ts

key-decisions:
  - "downloadAll signature: downloadAll(photos, key, server, onProgress?) — params not from hook state, enabling unit-testable function without full mount sequence"
  - "renderHook called before createElement spy in tests — spy is only needed for downloadAll anchor creation, not hook initialization"
  - "vitest 4.x constructor mocks require function() not arrow function in mockImplementation"

patterns-established:
  - "Object URL memory rule: all createObjectURL calls tracked in useRef for deterministic revocation on unmount"
  - "Hook download trigger: creates <a> element, appends to body, clicks, removes, revokes blob URL — no FileSaver.js dependency"

requirements-completed: [VIEW-01, VIEW-02, VIEW-05, VIEW-06]

# Metrics
duration: 6min
completed: 2026-03-19
---

# Phase 4 Plan 03: useAlbumViewer Hook Summary

**React hook with JSZip downloadAll + lazy thumbnail/full-image decryption via fetchBlob + decryptBlob, keyed object URL state, and deterministic cleanup via useRef**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T18:11:39Z
- **Completed:** 2026-03-19T18:17:26Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `useAlbumViewer` hook implemented with full state interface: `status`, `error`, `manifest`, `thumbUrls`, `fullUrls`, `albumKey`, `blossomServer`, `downloadProgress`
- `downloadAll(photos, key, server, onProgress?)` fetches+decrypts all photos in sequence, zips with JSZip, triggers `<a download>` without FileSaver.js
- `loadThumbnail(index)` and `loadFullImage(index)` for lazy-load decryption on demand
- All 2 useAlbumViewer tests GREEN; full suite 83 tests passing, 0 regressions

## Task Commits

1. **Task 1: Implement useAlbumViewer hook** - `91a2905` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/hooks/useAlbumViewer.ts` — Central data orchestration hook: state machine, downloadAll, loadThumbnail, loadFullImage, object URL cleanup
- `src/hooks/useAlbumViewer.test.ts` — Fixed two test bugs (recursive spy + constructor arrow function)

## Decisions Made

- `downloadAll` accepts `photos`, `key`, `server` as parameters rather than reading from hook state — enables unit testing without full manifest load
- Object URLs tracked in `createdUrlsRef` (useRef) for reliable cleanup on unmount — avoids stale closure issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recursive document.createElement spy caused stack overflow in tests**
- **Found during:** Task 1 (running tests after implementation)
- **Issue:** Both test cases called `vi.spyOn(document.createElement)` BEFORE `renderHook`. The spy's else branch did `return document.createElement(tag)` — calling the mock again recursively. Since `renderHook` internally calls `document.createElement('div')` to create its container, the spy immediately caused a "Maximum call stack size exceeded" error.
- **Fix:** Moved `renderHook` call to BEFORE the `createElement` spy is installed. Added `const originalCreateElement = document.createElement.bind(document)` and used it in the else branch to break the recursion.
- **Files modified:** `src/hooks/useAlbumViewer.test.ts`
- **Verification:** Both tests pass GREEN after fix
- **Committed in:** `91a2905` (Task 1 commit)

**2. [Rule 1 - Bug] vitest 4.x JSZip constructor mock used arrow function**
- **Found during:** Task 1 (after fixing bug 1, next failure was "not a constructor")
- **Issue:** `beforeEach` and the top-level `vi.mock` block used `mockImplementation(() => ({...}))` (arrow function). vitest 4.x requires `function()` (not arrow) when mock is used as a `new` constructor — this is documented in STATE.md from prior phase work.
- **Fix:** Changed both occurrences to `mockImplementation(function() { return {...}; })`
- **Files modified:** `src/hooks/useAlbumViewer.test.ts`
- **Verification:** Both tests pass GREEN after fix
- **Committed in:** `91a2905` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes were in the test file (bugs in RED tests written before implementation). Hook implementation itself needed no deviation from plan spec.

## Issues Encountered

None in the hook implementation itself. Both issues were pre-existing bugs in the committed test file that only became visible once the hook existed and tests could actually run.

## Next Phase Readiness

- `useAlbumViewer` hook is ready for 04-04 (ThumbnailGrid + Lightbox components)
- `downloadAll` tested and GREEN
- `loadThumbnail` / `loadFullImage` implemented (will gain coverage in 04-04 UI tests)
- `thumbUrls` / `fullUrls` state maps are ready for ThumbnailGrid and Lightbox to consume

## Self-Check: PASSED

- src/hooks/useAlbumViewer.ts: FOUND
- .planning/phases/04-share-link-and-viewer/04-03-SUMMARY.md: FOUND
- commit 91a2905: FOUND

---
*Phase: 04-share-link-and-viewer*
*Completed: 2026-03-19*
