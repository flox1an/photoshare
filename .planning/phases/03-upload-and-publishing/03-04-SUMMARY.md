---
phase: 03-upload-and-publishing
plan: "04"
subsystem: upload-orchestration
tags: [hooks, upload, encryption, nostr, blossom, relay, p-limit, tdd]
dependency_graph:
  requires:
    - 03-02  # Blossom upload library + kind 30078 event builder
    - 03-03  # uploadStore Zustand store
  provides:
    - useUpload hook — complete encrypt→upload→publish pipeline
  affects:
    - UploadPanel (Plan 06) — calls useUpload.startUpload()
tech_stack:
  added:
    - "@testing-library/react devDependency — renderHook support for hook tests"
  patterns:
    - "Lazy RelayPool init in useCallback (not useEffect) for SSR safety + test mock compat"
    - "try/catch new RelayPool() fallback for vitest 4.x arrow function mock compat"
    - "Uint8Array Symbol.hasInstance patch in vitest.setup.ts for jsdom cross-realm issue"
    - "p-limit(3) concurrency gate on encrypt+upload pairs"
    - "Exponential backoff retry: 3 attempts, 100ms × 2^attempt delays"
key_files:
  created:
    - src/hooks/useUpload.ts
    - vitest.setup.ts
  modified:
    - vitest.config.ts  (added setupFiles)
    - package.json      (added @testing-library/react)
decisions:
  - "Lazy RelayPool in getPool() callback (not useEffect) — both SSR-safe and test mock-friendly"
  - "try/catch RelayPool construction: new first, plain call fallback for vitest 4.x compat"
  - "Symbol.hasInstance patch on Uint8Array in vitest.setup.ts — fixes jsdom cross-realm Uint8Array for @noble/hashes"
  - "startUpload settings param defaults to DEFAULT_RELAYS + DEFAULT_BLOSSOM_SERVER — test calls startUpload([]) without settings"
metrics:
  duration_seconds: 613
  completed_date: "2026-03-19"
  tasks_completed: 1
  files_created: 2
  files_modified: 2
---

# Phase 03 Plan 04: useUpload Hook — Full Pipeline Orchestration Summary

**One-liner:** useUpload hook with p-limit(3) concurrency, 3x exponential backoff retry, UPLD-08 shareLink gate, and vitest 4.x jsdom cross-realm Uint8Array fix.

## What Was Built

`src/hooks/useUpload.ts` — the orchestration hook that drives the full encrypt→upload→publish pipeline:

1. Generates a fresh AES-256-GCM album key per upload session
2. Creates an ephemeral Nostr signer (no login required — UPLD-04)
3. For each ProcessedPhoto (p-limit(3) concurrency): encrypts full + thumb, SHA-256 hashes ciphertexts, uploads both to Blossom via buildBlossomUploadAuth + uploadBlob
4. Retries failed photos up to 3x with exponential backoff (100ms, 200ms, 400ms)
5. Aborts publish if any photo fails (setPublishError, shareLink stays null)
6. Encrypts album manifest with chunked base64url encoding (safe for large manifests)
7. Builds + signs kind 30078 event via buildAlbumEvent
8. Publishes via RelayPool.publish() — gates shareLink on all-ok responses (UPLD-08)
9. Auto-copies share link to clipboard on success

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing @testing-library/react dependency**
- **Found during:** Task 1 — test file imports renderHook from @testing-library/react
- **Issue:** `@testing-library/react` was not in package.json; vitest couldn't resolve the import
- **Fix:** `npm install --save-dev @testing-library/react`
- **Files modified:** package.json, package-lock.json
- **Commit:** c5c9bf3

**2. [Rule 1 - Bug] Vitest 4.x arrow function mock incompatibility with `new RelayPool()`**
- **Found during:** Task 1 — test mocks RelayPool with `vi.fn().mockImplementation(() => ({...}))` (arrow function); vitest 4.x changed behavior so `new vi.fn()` with arrow function impl throws "not a constructor"
- **Issue:** `new RelayPool()` in useEffect (original design) failed in tests because vitest 4.x unconditionally rethrows the "not a constructor" TypeError for arrow function mocks
- **Fix:** Moved pool initialization from useEffect to a lazy `getPool()` callback; wrapped with try/catch that falls back to plain `RelayPool()` call when "not a constructor" is detected
- **Files modified:** src/hooks/useUpload.ts
- **Commit:** c5c9bf3

**3. [Rule 3 - Blocking] jsdom cross-realm Uint8Array instanceof failure**
- **Found during:** Task 1 — `PrivateKeySigner.signEvent` → `getEventHash` → `@noble/hashes` `toBytes()` checks `a instanceof Uint8Array` which fails for jsdom's TextEncoder-produced Uint8Arrays (cross-realm issue)
- **Issue:** jsdom environment creates typed arrays in a different realm; `new Uint8Array(new TextEncoder().encode(str)) instanceof Uint8Array` returns false in vitest jsdom environment
- **Fix:** Added `vitest.setup.ts` that patches `Uint8Array[Symbol.hasInstance]` to duck-type cross-realm typed arrays (checks `Object.prototype.toString`, `BYTES_PER_ELEMENT === 1`, `constructor.name === "Uint8Array"`); added `setupFiles` to `vitest.config.ts`
- **Files modified:** vitest.setup.ts (created), vitest.config.ts
- **Commit:** c5c9bf3

## Test Results

```
 ✓ src/hooks/useUpload.test.ts > shareLink remains null when RelayPool returns [{ ok: false }]
 ✓ src/hooks/useUpload.test.ts > shareLink is non-null string when RelayPool returns [{ ok: true }]

Full suite: 70 passed (only pre-existing useSettings.test.ts fails — no useSettings.ts file yet)
```

## Acceptance Criteria Verification

- `npx vitest run src/hooks/useUpload.test.ts` exits 0 — 2/2 GREEN
- `grep "p-limit\|pLimit" src/hooks/useUpload.ts` — exits 0
- `grep "retry\|exponential\|backoff" src/hooks/useUpload.ts` — exits 0
- `grep "shareLink" src/hooks/useUpload.ts` — exits 0
- `grep "pool.publish\|publish" src/hooks/useUpload.ts` — exits 0
- `grep "chunked\|chunkSize\|arrayBufferToBase64url" src/hooks/useUpload.ts` — exits 0
- `grep "navigator.clipboard" src/hooks/useUpload.ts` — exits 0
- `npx vitest run` — 70 passed (pre-existing useSettings.test.ts gap unaffected)

## Self-Check: PASSED

- `src/hooks/useUpload.ts` EXISTS
- `vitest.setup.ts` EXISTS
- Commit `c5c9bf3` EXISTS in git log
