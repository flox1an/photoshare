---
phase: 03-upload-and-publishing
plan: "02"
subsystem: blossom-upload
tags:
  - blossom
  - nostr
  - crypto
  - upload
  - tdd
dependency_graph:
  requires:
    - 03-01
  provides:
    - src/types/blossom.ts (BlobDescriptor)
    - src/lib/blossom/upload.ts (sha256Hex, buildBlossomUploadAuth, uploadBlob)
    - src/lib/blossom/validate.ts (validateBlossomServer)
    - src/lib/nostr/event.ts (buildAlbumEvent)
  affects:
    - 03-03 (upload store uses uploadBlob and buildAlbumEvent)
tech_stack:
  added: []
  patterns:
    - Web Crypto API SHA-256 via crypto.subtle.digest
    - BUD-11 Authorization header with btoa (standard base64, not base64url)
    - SHA-256 hash verification against server response
    - CORS header validation for Blossom server compatibility
    - kind 30078 NIP-78 parameterized replaceable event via applesauce-factory
    - includeSingletonTag override pattern for d-tag (build() pre-applies includeReplaceableIdentifier with nanoid)
key_files:
  created:
    - src/types/blossom.ts
    - src/lib/blossom/upload.ts
    - src/lib/blossom/validate.ts
    - src/lib/nostr/event.ts
  modified: []
decisions:
  - "includeSingletonTag([d, dTag]) used instead of includeReplaceableIdentifier(dTag) because applesauce-factory build() internally calls includeReplaceableIdentifier() with nanoid before user operations run — the d-tag already exists by the time user operations execute, so includeReplaceableIdentifier would no-op; includeSingletonTag replaces it"
  - "uploadBlob signature includes localHashHex as explicit parameter (not computed internally) — matches test contract established in 03-01 and enables pre-computed hash reuse across the upload flow"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 03 Plan 02: Blossom Upload Library and Event Builder Summary

**One-liner:** BUD-11 kind 24242 auth + SHA-256 verification upload library and kind 30078 album event builder using Web Crypto and applesauce-factory.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement Blossom upload library | dcb8c1e | src/types/blossom.ts, src/lib/blossom/upload.ts, src/lib/blossom/validate.ts |
| 2 | Implement buildAlbumEvent for kind 30078 | 8b6db81 | src/lib/nostr/event.ts |

## What Was Built

**src/types/blossom.ts** — BlobDescriptor interface per BUD-02 spec (url, sha256, size, type, uploaded).

**src/lib/blossom/upload.ts:**
- `sha256Hex(buffer)` — Web Crypto API only (`crypto.subtle.digest("SHA-256")`), returns lowercase 64-char hex. Called on ENCRYPTED bytes.
- `buildBlossomUploadAuth(signer, blobHashHex)` — Builds kind 24242 event with `["t", "upload"]`, `["x", hash]`, `["expiration", now+3600]` tags. Authorization header uses standard `btoa()` base64 (NOT base64url).
- `uploadBlob(serverUrl, ciphertext, authHeader, localHashHex, mimeType?)` — PUT to Blossom server, throws on non-2xx status, throws on SHA-256 mismatch between server response and local hash.

**src/lib/blossom/validate.ts:**
- `validateBlossomServer(url)` — HEAD request with `AbortSignal.timeout(5000)`, returns true only when response is ok AND `access-control-allow-origin` header is present. Returns false on any error.

**src/lib/nostr/event.ts:**
- `buildAlbumEvent(signer, encryptedManifestB64url, manifestIvB64url, dTag)` — Builds and signs kind 30078 event with d, iv, alt, and expiration tags using applesauce-factory. Content = encrypted manifest.

## Test Results

```
Test Files: 3 passed (3)
Tests:      19 passed (19)
  - src/lib/blossom/validate.test.ts: 3/3
  - src/lib/blossom/upload.test.ts:   10/10 (2 sha256Hex + 5 buildBlossomUploadAuth + 3 uploadBlob)
  - src/lib/nostr/event.test.ts:      6/6
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed kind 30078 d-tag not using provided dTag value**
- **Found during:** Task 2 (first test run)
- **Issue:** `includeReplaceableIdentifier(dTag)` was not applying the provided dTag. The `build()` function in applesauce-factory@4.0.0 internally calls `includeReplaceableIdentifier()` (with nanoid as default) inside `wrapCommon()` before any user operations run. By the time user operations execute, the "d" tag already exists, so `includeReplaceableIdentifier`'s `if (!getTagValue(draft, "d"))` guard causes it to skip.
- **Fix:** Replaced `includeReplaceableIdentifier(dTag)` with `includeSingletonTag(["d", dTag])` which unconditionally replaces the tag value.
- **Files modified:** src/lib/nostr/event.ts
- **Commit:** 8b6db81

## TypeScript Notes

`npx tsc --noEmit` shows 4 errors in pre-existing RED test stubs (useSettings.test.ts, useUpload.test.ts) for hooks not yet implemented. These are out-of-scope — not caused by this plan's changes. The 4 new source files are error-free.

## Self-Check: PASSED
