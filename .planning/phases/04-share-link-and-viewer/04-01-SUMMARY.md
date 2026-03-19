---
phase: 04-share-link-and-viewer
plan: "01"
subsystem: testing
tags: [vitest, tdd, nostr, blossom, jszip, react-testing-library, intersection-observer]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: crypto.ts (generateAlbumKey, encryptBlob, decryptBlob), naddr.ts (decodeAlbumNaddr), album.ts types
  - phase: 03-upload-and-publishing
    provides: vitest.setup.ts Uint8Array patch, applesauce-loaders patterns
provides:
  - 5 RED test files defining contracts for all Phase 4 viewer components and logic
  - viewer.test.ts — decryptManifest, loadAlbumEvent contracts (VIEW-01, CONF-03)
  - fetch.test.ts — fetchBlob BUD-01 URL contract (VIEW-02)
  - ThumbnailGrid.test.tsx — grid render + IntersectionObserver lazy-load contract (VIEW-03, VIEW-06)
  - Lightbox.test.tsx — keyboard nav + overlay close + counter contract (VIEW-04, VIEW-07)
  - useAlbumViewer.test.ts — downloadAll JSZip + progress reporting contract (VIEW-05)
affects: [04-02, 04-03, 04-04, 04-05]

# Tech tracking
tech-stack:
  added:
    - jszip (ZIP creation — installed as dependency)
    - "@use-gesture/react" (touch swipe — installed as dependency)
  patterns:
    - TDD RED phase committed before any implementation
    - vi.mock for applesauce-loaders and applesauce-relay with rxjs Observable stubs
    - vi.stubGlobal('fetch') in beforeEach + vi.unstubAllGlobals() in afterEach
    - IntersectionObserver mock via window.IntersectionObserver = vi.fn() in beforeEach
    - JSZip mock returning { file: vi.fn(), generateAsync: vi.fn() } instance

key-files:
  created:
    - src/lib/nostr/viewer.test.ts
    - src/lib/blossom/fetch.test.ts
    - src/components/viewer/ThumbnailGrid.test.tsx
    - src/components/viewer/Lightbox.test.tsx
    - src/hooks/useAlbumViewer.test.ts
  modified: []

key-decisions:
  - "jszip and @use-gesture/react installed as production dependencies (required by implementation plans 04-02 through 04-05)"
  - "ThumbnailGrid objectUrls keyed by thumbHash (not index) — allows sparse URL map as thumbnails load asynchronously"
  - "Lightbox test uses data-testid='lightbox-overlay' for overlay click-to-close test — contracts the implementation"
  - "useAlbumViewer downloadAll signature includes optional onProgress callback: (current: number, total: number) => void"
  - "ThumbnailGrid loadThumbnail called with numeric index (not hash) — consistent with IntersectionObserver data-index pattern"

patterns-established:
  - "Pattern: Mock rxjs Observable via of(fakeEvent) for successful address loader; EMPTY for EmptyError rejection"
  - "Pattern: ThumbnailGrid props — { photos, objectUrls: Record<string, string>, loadThumbnail, onPhotoClick }"
  - "Pattern: Lightbox props — { photos, currentIndex, thumbUrls, fullUrls, albumKey, blossomServer, onNext, onPrev, onClose }"
  - "Pattern: useAlbumViewer hook exposes downloadAll(photos, key, server, onProgress?) method"

requirements-completed: [VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, VIEW-07, CONF-03]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 4 Plan 01: Wave 0 TDD Red Tests for Share Link Viewer Summary

**5 failing test files defining API contracts for viewer manifest decrypt, Blossom blob fetch, thumbnail grid, lightbox navigation, and JSZip download-all before any implementation exists**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-19T17:58:00Z
- **Completed:** 2026-03-19T18:02:48Z
- **Tasks:** 2
- **Files modified:** 5 created, 0 modified

## Accomplishments

- All 5 Wave 0 test files written and confirmed RED (module not found — no implementations exist yet)
- Pre-existing 13 tests remain GREEN — zero regressions
- jszip and @use-gesture/react installed as production dependencies
- Contracts locked for all 8 Phase 4 requirements (VIEW-01 through VIEW-07, CONF-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: viewer.test.ts + fetch.test.ts (logic layer contracts)** - `64724cd` (test)
2. **Task 2: ThumbnailGrid.test.tsx + Lightbox.test.tsx + useAlbumViewer.test.ts (UI + hook contracts)** - `c70a966` (test)

## Files Created/Modified

- `src/lib/nostr/viewer.test.ts` — decryptManifest real WebCrypto test, followRelayHints spy, EmptyError rejection
- `src/lib/blossom/fetch.test.ts` — fetchBlob happy path, 404 error, BUD-01 URL construction
- `src/components/viewer/ThumbnailGrid.test.tsx` — N skeleton cards, IntersectionObserver lazy-load, img with objectUrls
- `src/components/viewer/Lightbox.test.tsx` — ArrowRight/ArrowLeft/Escape keyboard nav, photo counter, overlay click-to-close
- `src/hooks/useAlbumViewer.test.ts` — downloadAll JSZip.file per photo filename, incremental progress reporting

## Decisions Made

- jszip and @use-gesture/react installed as production dependencies (needed by subsequent implementation plans)
- ThumbnailGrid objectUrls keyed by thumbHash (not photo index) — allows sparse loading as thumbnails arrive asynchronously
- Lightbox contracts data-testid="lightbox-overlay" on the overlay div — implementation must use this attribute
- downloadAll onProgress is optional callback signature: (current: number, total: number) => void
- loadThumbnail receives numeric index (not hash) — aligns with IntersectionObserver data-index attribute pattern from RESEARCH.md

## Deviations from Plan

None — plan executed exactly as written. jszip and @use-gesture/react installation was implicit (required for tests to run in later phases) and done as part of setup before writing tests.

## Issues Encountered

None — baseline test suite was 13 passing. All 5 new files confirmed FAIL with "Cannot find module" errors before commit, as required for TDD RED state.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 5 RED test files committed and ready to be turned GREEN by implementation plans 04-02 through 04-05
- All component prop interfaces locked (ThumbnailGrid, Lightbox, useAlbumViewer)
- All module import paths locked: @/lib/nostr/viewer, @/lib/blossom/fetch, @/components/viewer/ThumbnailGrid, @/components/viewer/Lightbox, @/hooks/useAlbumViewer
- No blockers

---
*Phase: 04-share-link-and-viewer*
*Completed: 2026-03-19*
