---
phase: 04-share-link-and-viewer
plan: "02"
subsystem: api
tags: [blossom, nostr, rxjs, applesauce, aes-gcm, crypto]

# Dependency graph
requires:
  - phase: 04-share-link-and-viewer
    provides: Wave 0 RED tests for fetch.test.ts and viewer.test.ts
  - phase: 01-foundation
    provides: crypto.ts (decryptBlob, base64urlToUint8Array), naddr.ts (decodeAlbumNaddr), album types
  - phase: 03-upload-and-publishing
    provides: lazy RelayPool pattern (SSR safety)

provides:
  - fetchBlob(server, sha256): Promise<ArrayBuffer> — BUD-01 GET blob retrieval
  - loadAlbumEvent(pointer): Promise<NostrEvent> — kind 30078 event fetch via applesauce-loaders
  - decryptManifest(event, key): Promise<AlbumManifest> — AES-256-GCM manifest decryption

affects:
  - 04-03-components (ThumbnailGrid, Lightbox use fetchBlob via useAlbumViewer)
  - 04-04-hook (useAlbumViewer calls fetchBlob and loadAlbumEvent)
  - 04-05-page (viewer page assembles hook + components)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - lazy RelayPool init inside async function (SSR safety, vitest mock compatibility)
    - firstValueFrom(observable.pipe(timeout(N))) for single-event fetch with deadline
    - try/catch wrapping entire loadAlbumEvent body to convert all errors to user-friendly message

key-files:
  created:
    - src/lib/blossom/fetch.ts
    - src/lib/nostr/viewer.ts
  modified:
    - src/lib/nostr/viewer.test.ts

key-decisions:
  - "loadAlbumEvent accepts AddressPointer object not naddr string — tests are ground truth over plan spec"
  - "RelayPool created inside try block to ensure constructor errors produce user-friendly error message"
  - "vitest 4.x requires function() {} not arrow () => {} in mockImplementation when mock used as constructor"

patterns-established:
  - "Pattern: Wrap entire async function body in try/catch for consistent error message normalization"
  - "Pattern: AddressPointer passed directly — caller decodes naddr; viewer.ts stays decoupled from naddr format"

requirements-completed: [VIEW-01, VIEW-02, CONF-03]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 4 Plan 02: Viewer Logic Library (fetchBlob + loadAlbumEvent + decryptManifest) Summary

**fetchBlob (BUD-01 GET) and loadAlbumEvent + decryptManifest (AES-256-GCM manifest decrypt via applesauce-loaders with followRelayHints) implemented, all 6 Wave 0 tests GREEN**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-19T18:06:11Z
- **Completed:** 2026-03-19T18:09:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `fetchBlob` implements BUD-01 GET — strips trailing slash, throws on non-2xx, returns ArrayBuffer
- `loadAlbumEvent` fetches kind 30078 Nostr event via createAddressLoader with followRelayHints: true (CONF-03)
- `decryptManifest` extracts IV tag, decrypts AES-256-GCM ciphertext, returns parsed AlbumManifest
- All 6 Wave 0 logic-layer tests GREEN (3 fetch + 3 viewer)
- TypeScript build passes with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement src/lib/blossom/fetch.ts** - `2b6ffa6` (feat)
2. **Task 2: Implement src/lib/nostr/viewer.ts (loadAlbumEvent + decryptManifest)** - `7a73ee5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/blossom/fetch.ts` - fetchBlob: BUD-01 GET blob retrieval, ~12 lines
- `src/lib/nostr/viewer.ts` - loadAlbumEvent + decryptManifest, ~50 lines
- `src/lib/nostr/viewer.test.ts` - Fixed RelayPool mock constructor for vitest 4.x compatibility

## Decisions Made
- `loadAlbumEvent` accepts `AddressPointer` directly (not `naddr: string` as plan spec stated) — tests call it with a pointer object; tests are ground truth
- `RelayPool` instantiation moved inside the try block so constructor failures produce the standard "Album not found or expired" message rather than leaking internal errors
- Entire `loadAlbumEvent` body wrapped in try/catch to handle EmptyError (no relay has event) and timeout equally

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed viewer.test.ts RelayPool mock for vitest 4.x constructor compatibility**
- **Found during:** Task 2 (loadAlbumEvent implementation and test run)
- **Issue:** vitest 4.x requires `function()` (not arrow function) in `mockImplementation` when the mock is used as a constructor via `new`. The test used `vi.fn().mockImplementation(() => ({}))` which threw `TypeError: () => ({}) is not a constructor` in vitest 4.1.0.
- **Fix:** Changed mock implementation to `vi.fn().mockImplementation(function () { return {}; })`
- **Files modified:** `src/lib/nostr/viewer.test.ts`
- **Verification:** All 3 viewer.test.ts tests GREEN after fix
- **Committed in:** `7a73ee5` (Task 2 commit)

**2. [Rule 1 - Bug] loadAlbumEvent signature accepts AddressPointer not naddr string**
- **Found during:** Task 2 (reading viewer.test.ts against plan spec)
- **Issue:** Plan spec defines `loadAlbumEvent(naddr: string)` but the test calls `loadAlbumEvent(pointer)` with an `AddressPointer` object directly. Tests are ground truth.
- **Fix:** Implementation accepts `pointer: AddressPointer` directly, no internal naddr decoding needed
- **Files modified:** `src/lib/nostr/viewer.ts`
- **Verification:** All 3 viewer.test.ts tests GREEN
- **Committed in:** `7a73ee5` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 x Rule 1 bugs)
**Impact on plan:** Both auto-fixes required for tests to pass. Test file fix is vitest 4.x compatibility. Signature change aligns implementation with test contract (tests are ground truth).

## Issues Encountered
- vitest 4.x arrow-function-as-constructor restriction is a recurring theme in this project (also seen in Phase 3). Fixed with same pattern.

## Next Phase Readiness
- `fetchBlob` ready for use in `useAlbumViewer` hook (04-04)
- `loadAlbumEvent` + `decryptManifest` ready for use in `useAlbumViewer` hook (04-04)
- Data pipeline foundation complete: blob fetch + manifest decryption established
- Remaining RED tests: useAlbumViewer.test.ts, ThumbnailGrid.test.tsx, Lightbox.test.tsx (plans 04-03 through 04-05)

## Self-Check: PASSED

- `src/lib/blossom/fetch.ts` — FOUND
- `src/lib/nostr/viewer.ts` — FOUND
- `04-02-SUMMARY.md` — FOUND
- Commit `2b6ffa6` — FOUND
- Commit `7a73ee5` — FOUND

---
*Phase: 04-share-link-and-viewer*
*Completed: 2026-03-19*
