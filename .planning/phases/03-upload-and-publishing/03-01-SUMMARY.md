---
phase: 03-upload-and-publishing
plan: "01"
subsystem: test-scaffolds
tags: [tdd, red-tests, blossom, nostr, upload, settings]
dependency_graph:
  requires: []
  provides:
    - RED test contracts for src/lib/blossom/upload.ts
    - RED test contracts for src/lib/blossom/validate.ts
    - RED test contracts for src/lib/nostr/event.ts
    - RED test contracts for src/store/uploadStore.ts
    - RED test contracts for src/hooks/useUpload.ts
    - RED test contracts for src/hooks/useSettings.ts
  affects:
    - Plans 03-02 through 03-05 (all implementation plans in Phase 3)
tech_stack:
  added: []
  patterns:
    - Vitest jsdom environment for browser API testing
    - vi.stubGlobal for fetch mocking in upload/validation tests
    - renderHook from @testing-library/react for hook testing
    - useUploadStore.getState() pattern for Zustand store testing (mirrors processingStore pattern)
key_files:
  created:
    - src/lib/blossom/upload.test.ts
    - src/lib/blossom/validate.test.ts
    - src/lib/nostr/event.test.ts
    - src/store/uploadStore.test.ts
    - src/hooks/useUpload.test.ts
    - src/hooks/useSettings.test.ts
  modified: []
decisions:
  - "uploadBlob test signature includes localHashHex param to enable hash mismatch verification (UPLD-02 requirement)"
  - "uploadStore.test.ts uses addPhoto(id, filename) API pattern — parallel to processingStore.addPhotos() but per-photo for upload phase"
  - "useSettings.test.ts uses lazy useState initializer pattern — consistent with Pitfall 5 (localStorage SSR safety) from RESEARCH.md"
metrics:
  duration_seconds: 570
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
---

# Phase 03 Plan 01: Wave 0 RED Test Scaffolds Summary

**One-liner:** 6 RED test files covering all 10 Phase 3 requirements — UPLD-01 through UPLD-08, CONF-01, CONF-02 — all failing by import error before any implementation exists.

## What Was Built

All 6 Wave 0 test files were created, each importing from source modules that do not yet exist. Tests fail with "Cannot find module" errors, establishing the behavioral contracts that Plans 03-02 through 03-05 will drive to GREEN.

### Test File Coverage

| File | Requirements | Behavior Tested |
|------|-------------|-----------------|
| `src/lib/blossom/upload.test.ts` | UPLD-01, UPLD-02, UPLD-03 | sha256Hex correctness, kind 24242 auth event structure, uploadBlob hash verification, error cases |
| `src/lib/blossom/validate.test.ts` | CONF-02 | validateBlossomServer CORS header check, network error handling |
| `src/lib/nostr/event.test.ts` | UPLD-05, UPLD-06 | buildAlbumEvent kind=30078, d-tag, iv-tag, alt-tag, expiration range |
| `src/store/uploadStore.test.ts` | UPLD-07 | State transitions: pending→encrypting→uploading→done/error |
| `src/hooks/useUpload.test.ts` | UPLD-08 | Share link gate: null when relay returns ok:false, non-null when ok:true |
| `src/hooks/useSettings.test.ts` | CONF-01, CONF-02 | localStorage persistence for relays and blossom server, DEFAULT_RELAYS fallback |

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Blossom upload + validate tests | `1498bea` | upload.test.ts, validate.test.ts |
| Task 2: Event, store, hooks tests | `2b828a8` | event.test.ts, uploadStore.test.ts, useUpload.test.ts, useSettings.test.ts |

## Verification

Running `npx vitest run src/lib/blossom/ src/lib/nostr/event.test.ts src/store/uploadStore.test.ts src/hooks/useUpload.test.ts src/hooks/useSettings.test.ts` reports:

```
Test Files  6 failed (6)
      Tests  no tests
```

All 6 test files fail with import errors — zero false greens. No implementation files were created.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Design Notes

- `uploadStore.test.ts` uses `addPhoto(id, filename)` API — slightly different from processingStore's `addPhotos(files)` since the upload phase needs per-photo granularity with pre-assigned IDs from the processing phase
- `useUpload.test.ts` keeps tests minimal per plan instruction: only the two share link gate cases
- `useSettings.test.ts` confirms lazy `useState` initializer pattern for SSR safety as documented in RESEARCH.md Pitfall 5

## Self-Check

**Files created:**

```
[ -f "src/lib/blossom/upload.test.ts" ] → FOUND
[ -f "src/lib/blossom/validate.test.ts" ] → FOUND
[ -f "src/lib/nostr/event.test.ts" ] → FOUND
[ -f "src/store/uploadStore.test.ts" ] → FOUND
[ -f "src/hooks/useUpload.test.ts" ] → FOUND
[ -f "src/hooks/useSettings.test.ts" ] → FOUND
```

**Commits verified:** `1498bea`, `2b828a8`

## Self-Check: PASSED
