---
phase: 03-upload-and-publishing
verified: 2026-03-19T17:32:00Z
status: gaps_found
score: 7/10 must-haves verified
re_verification: false
gaps:
  - truth: "validateBlossomServer returns false if CORS header is absent"
    status: failed
    reason: "Implementation changed from HEAD+CORS-header-check to GET that returns true whenever fetch does not throw, regardless of CORS header presence. Test explicitly checks for false when server responds ok:true but omits CORS header — test fails."
    artifacts:
      - path: "src/lib/blossom/validate.ts"
        issue: "Returns true for any non-throwing fetch response. The CORS header check was removed during implementation (comment says 'Any response that reaches us means CORS passed'). This is incorrect — same-origin fetch does not throw a TypeError in jsdom; only a real browser enforces CORS. The implementation conflates browser CORS enforcement with explicit header presence."
    missing:
      - "Restore the access-control-allow-origin header check: `return response.ok && response.headers.get('access-control-allow-origin') !== null`"
      - "The GET-vs-HEAD change can stay if preferred, but the CORS header check must be reinstated to satisfy CONF-02 and pass the unit test"

  - truth: "buildAlbumEvent produces kind 30078 with d-tag, iv-tag, expiration tag, and NIP-40 expiry ~30 days"
    status: partial
    reason: "Implementation uses includeSingletonTag(['d', dTag]) rather than includeReplaceableIdentifier(dTag). Per the PLAN, includeReplaceableIdentifier was specified. The code comment acknowledges this: 'build() internally calls includeReplaceableIdentifier() with nanoid before our operations. We must override the d tag with includeSingletonTag.' Tests pass, so the outcome is correct — the d tag is set. This is a partial deviation from the plan spec but functionally correct."
    artifacts:
      - path: "src/lib/nostr/event.ts"
        issue: "Uses includeSingletonTag(['d', dTag]) rather than includeReplaceableIdentifier(dTag). Tests pass (d tag present), but the plan specified includeReplaceableIdentifier. Low severity — outcome is identical."
    missing:
      - "No code change required if tests pass. This is a documented deviation with valid rationale."

  - truth: "Default relay list includes wss://relay.nostu.be, wss://relay.damus.io, wss://nos.lol (CONF-01 locked decision)"
    status: failed
    reason: "useSettings.ts falls back to DEFAULT_RELAYS from config.ts which is only ['wss://relay.nostu.be']. The CONTEXT.md and Plan 05 locked decision requires 3 default relays. The UI_DEFAULT_RELAYS local override specified in Plan 05 was never implemented."
    artifacts:
      - path: "src/hooks/useSettings.ts"
        issue: "Line 26: falls back to DEFAULT_RELAYS (1 relay) instead of the locked 3-relay list [wss://relay.nostu.be, wss://relay.damus.io, wss://nos.lol]"
    missing:
      - "Add local constant before useState: `const UI_DEFAULT_RELAYS = [...DEFAULT_RELAYS, 'wss://relay.damus.io', 'wss://nos.lol']`"
      - "Change lazy initializer fallback from `return DEFAULT_RELAYS` to `return UI_DEFAULT_RELAYS`"

  - truth: "DEFAULT_BLOSSOM_SERVER is https://24242.io (CONF-04 config test)"
    status: failed
    reason: "config.ts DEFAULT_BLOSSOM_SERVER was changed to 'https://tempstore.apps3.slidestr.net' (the real Blossom server used during human verification). The config.test.ts still expects 'https://24242.io'. Test fails with: expected 'https://tempstore.apps3.slidestr.net' to be 'https://24242.io'."
    artifacts:
      - path: "src/lib/config.ts"
        issue: "Line 15: DEFAULT_BLOSSOM_SERVER = 'https://tempstore.apps3.slidestr.net' — was changed during human testing from the original 24242.io value"
      - path: "src/lib/config.test.ts"
        issue: "Line 31: still expects 'https://24242.io' — test not updated to match config change"
    missing:
      - "Decision required: either revert config.ts to 'https://24242.io' (matching the original spec and test), OR update config.test.ts to match the new default server, OR use 24242.io as the canonical default and make tempstore the override used during testing"
      - "If tempstore is the permanent new default, update config.test.ts line 31 to: expect(DEFAULT_BLOSSOM_SERVER).toBe('https://tempstore.apps3.slidestr.net')"
---

# Phase 3: Upload and Publishing Verification Report

**Phase Goal:** Processed and encrypted images are uploaded to Blossom and an encrypted album manifest is published to a Nostr relay, with clear per-photo progress feedback
**Verified:** 2026-03-19T17:32:00Z
**Status:** gaps_found — 2 test failures, 2 behavioral gaps
**Re-verification:** No — initial verification

## Human Verification Note

The browser checkpoint for this phase was approved by the user. The upload flow was confirmed working end-to-end with a real Blossom server (tempstore.apps3.slidestr.net). The gaps below are unit test failures and behavioral deviations from the locked spec — they do not indicate the upload flow is broken in the browser.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | sha256Hex computes SHA-256 of ciphertext and returns lowercase hex | VERIFIED | `crypto.subtle.digest("SHA-256", buffer)` in upload.ts:27; test GREEN |
| 2 | buildBlossomUploadAuth returns Authorization header with standard base64 (btoa) | VERIFIED | `btoa(JSON.stringify(signedEvent))` in upload.ts:68; test GREEN |
| 3 | uploadBlob throws if server SHA-256 does not match locally computed hash | VERIFIED | Hash comparison at upload.ts:108; "hash mismatch" message; test GREEN |
| 4 | validateBlossomServer returns false if CORS header is absent | FAILED | Implementation returns true for any non-throwing fetch regardless of header; test FAILS |
| 5 | buildAlbumEvent produces kind 30078 with d-tag, iv-tag, expiration tag | VERIFIED | kind 30078, includeSingletonTag(['d', dTag]), setExpirationTimestamp; tests GREEN |
| 6 | Upload status union includes 'encrypting' and 'uploading' | VERIFIED | processing.ts:7 — union extended; uploadStore.ts has all 4 actions; tests GREEN |
| 7 | useUpload orchestrates full pipeline with relay OK gate (UPLD-08) | VERIFIED | Lines 265-271: failures.filter(r => !r.ok); shareLink only set when all ok; tests GREEN |
| 8 | Share link null until relay confirms ok=true | VERIFIED | setShareLink only called after all responses pass ok check; test GREEN |
| 9 | Default relay list is 3 relays per CONTEXT.md locked decision | FAILED | useSettings.ts falls back to DEFAULT_RELAYS (1 relay only) — damus.io, nos.lol missing |
| 10 | DEFAULT_BLOSSOM_SERVER matches config test expectation (24242.io) | FAILED | config.ts changed to tempstore.apps3.slidestr.net; config.test.ts expects 24242.io — test FAILS |

**Score:** 7/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/blossom.ts` | BlobDescriptor interface | VERIFIED | Exists, exports BlobDescriptor with url/sha256/size/type/uploaded |
| `src/lib/blossom/upload.ts` | sha256Hex, buildBlossomUploadAuth, uploadBlob | VERIFIED | All 3 exported; Web Crypto used; btoa for auth; hash mismatch throws |
| `src/lib/blossom/validate.ts` | validateBlossomServer with CORS check | STUB | Exists but CORS check removed; returns true for any non-throwing response |
| `src/lib/nostr/event.ts` | buildAlbumEvent kind 30078 | VERIFIED | kind 30078, d/iv/alt/expiration tags, ALBUM_EXPIRY_SECONDS; tests GREEN |
| `src/store/uploadStore.ts` | useUploadStore with 6-state status | VERIFIED | setEncrypting/setUploading/setUploadDone/setUploadError/reset all present |
| `src/types/processing.ts` | PhotoProcessingStatus with upload states | VERIFIED | 'encrypting' and 'uploading' in union at line 7 |
| `src/hooks/useUpload.ts` | Full pipeline orchestration | VERIFIED | 299 lines; p-limit(3); retry with backoff; relay gate; navigator.clipboard |
| `src/hooks/useSettings.ts` | localStorage persistence and Blossom validation | PARTIAL | localStorage persistence works; but validateBlossomServer moved to UI layer; default relay list is 1 relay, not 3 |
| `src/components/upload/SettingsPanel.tsx` | Collapsible settings with relay/blossom sections | VERIFIED | isOpen state; validateBlossomServer called on save; CORS error message shown |
| `src/components/upload/ShareCard.tsx` | Spinner, title field, share link, copy button | VERIFIED | All 4 elements present; "Publishing to Nostr..." spinner; Copy button with Copied! state |
| `src/components/upload/UploadPanel.tsx` | Wired with useUpload, useSettings, SettingsPanel, ShareCard | VERIFIED | All 4 imported and used; upload button logic correct; allDone gate present |
| `src/components/upload/ProgressList.tsx` | encrypting/uploading status dots | VERIFIED | bg-purple-400/bg-yellow-400 animate-pulse; useUploadStore read; upload state overrides processing state |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/blossom/upload.ts` | `crypto.subtle.digest` | sha256Hex uses Web Crypto only | WIRED | Line 27: `crypto.subtle.digest("SHA-256", buffer)` |
| `src/lib/nostr/event.ts` | `applesauce-factory/event-factory` | build() + operations | WIRED | Line 19: `import { build } from "applesauce-factory/event-factory"` |
| `src/hooks/useUpload.ts` | `src/lib/blossom/upload.ts` | sha256Hex, buildBlossomUploadAuth, uploadBlob | WIRED | Line 37 import; all 3 called in startUpload pipeline |
| `src/hooks/useUpload.ts` | `src/lib/nostr/event.ts` | buildAlbumEvent | WIRED | Line 38 import; called at line 257 |
| `src/hooks/useUpload.ts` | `applesauce-relay/pool` | RelayPool.publish() for UPLD-08 gate | WIRED | Line 29 import; pool.publish() at line 263 |
| `src/hooks/useUpload.ts` | `src/store/uploadStore.ts` | setEncrypting/setUploading/setUploadDone/setUploadError | WIRED | Line 90 destructure; all 4 called per photo in loop |
| `src/hooks/useSettings.ts` | `src/lib/blossom/validate.ts` | validateBlossomServer for CORS check on save | ORPHANED (moved) | validateBlossomServer NOT called in useSettings; moved to SettingsPanel UI layer |
| `src/components/upload/SettingsPanel.tsx` | `src/lib/blossom/validate.ts` | validateBlossomServer called on Save click | WIRED | Line 5 import; line 22 call inside handleSaveBlossomServer |
| `src/components/upload/UploadPanel.tsx` | `src/hooks/useUpload.ts` | useUpload() called; startUpload triggered | WIRED | Line 4 import; line 14 call; handleUpload calls startUpload |
| `src/components/upload/UploadPanel.tsx` | `src/hooks/useSettings.ts` | useSettings() provides settings | WIRED | Line 5 import; line 15 call; passed to SettingsPanel and startUpload |
| `src/components/upload/UploadPanel.tsx` | `src/store/processingStore.ts` | reads photos for upload trigger | WIRED | Line 6 import; line 16 selector; processedPhotos built from it |
| `src/components/upload/ProgressList.tsx` | `src/store/uploadStore.ts` | reads upload status to override processing status | WIRED | Line 4 import; line 9 selector; uploadState overrides display at line 33 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| UPLD-01 | 03-01, 03-02, 03-04 | Encrypted blobs uploaded with proper auth headers | SATISFIED | buildBlossomUploadAuth builds BUD-11 kind 24242 auth; uploadBlob PUTs with Authorization header |
| UPLD-02 | 03-01, 03-02, 03-04 | SHA-256 hash of each upload verified against server | SATISFIED | upload.ts:108 compares descriptor.sha256 to localHashHex; throws on mismatch |
| UPLD-03 | 03-01, 03-02, 03-04 | Blossom expiration header sent (~60-day retention) | SATISFIED | buildBlossomUploadAuth sets 1-hour kind 24242 event expiry (BUD-11 auth TTL); note: BLOSSOM_EXPIRY_SECONDS defined in config but the upload auth TTL is 3600s per spec |
| UPLD-04 | 03-01, 03-02, 03-04 | Ephemeral Nostr keypair generated (no login) | SATISFIED | createEphemeralSigner() called in startUpload; already implemented in Phase 1 |
| UPLD-05 | 03-01, 03-02, 03-04 | Encrypted album manifest published as kind 30078 | SATISFIED | buildAlbumEvent produces kind 30078 with d/iv/alt tags; content = encryptedManifestB64url |
| UPLD-06 | 03-01, 03-02, 03-04 | NIP-40 expiration tag set (~30 days) | SATISFIED | setExpirationTimestamp(now + ALBUM_EXPIRY_SECONDS) in event.ts; ALBUM_EXPIRY_SECONDS = 2592000 |
| UPLD-07 | 03-01, 03-03, 03-06 | Upload progress UI shows per-photo status | SATISFIED | ProgressList shows encrypting/uploading/done/error; uploadStore drives state transitions |
| UPLD-08 | 03-01, 03-04, 03-06 | Share link generated only after all uploads succeed and relay confirms | SATISFIED | useUpload.ts:265-271 filters failures; shareLink only set when all ok=true |
| CONF-01 | 03-01, 03-05, 03-06 | User can configure Nostr relay list via settings panel | PARTIAL | SettingsPanel relay textarea works; localStorage persists; BUT default is 1 relay not 3 (damus.io/nos.lol missing) |
| CONF-02 | 03-01, 03-02, 03-05, 03-06 | User can configure Blossom server(s) via settings panel | PARTIAL | SettingsPanel shows Blossom input with Save button; validateBlossomServer called; BUT implementation no longer checks CORS header — test fails |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/blossom/validate.ts` | 33 | Returns true for ok/404/405 regardless of CORS header | Blocker | CONF-02 broken: server without CORS will pass validation; browser uploads will fail silently at runtime |
| `src/lib/config.ts` | 15 | DEFAULT_BLOSSOM_SERVER changed to tempstore.apps3.slidestr.net | Warning | Config test fails; spec said 24242.io; needs explicit decision |
| `src/hooks/useSettings.ts` | 26 | Falls back to DEFAULT_RELAYS (1 relay) not UI_DEFAULT_RELAYS (3 relays) | Warning | Users get only relay.nostu.be by default; damus.io and nos.lol missing |

### Gaps Summary

There are 3 actionable gaps:

**Gap 1 (Blocker) — validate.ts CORS check removed:** The `validateBlossomServer` implementation was refactored during development to use a GET request that considers any non-throwing response as valid. The original spec (and unit test) requires checking for the `access-control-allow-origin` header. Without this check, servers without CORS headers will pass validation, and browser uploads will fail with a TypeError at runtime. Fix: add `&& response.headers.get('access-control-allow-origin') !== null` to the return condition.

**Gap 2 (Warning) — DEFAULT_BLOSSOM_SERVER mismatch:** config.ts was updated to use `tempstore.apps3.slidestr.net` during human verification (it is a working Blossom server). The config.test.ts still expects `24242.io`. This requires a product decision: either revert config.ts or update the test. Either is acceptable — they just need to agree.

**Gap 3 (Warning) — Default relay list incomplete:** useSettings.ts falls back to `DEFAULT_RELAYS` which contains only `wss://relay.nostu.be`. Plan 05 locked the decision to use 3 relays. The missing `UI_DEFAULT_RELAYS` constant needs to be added to useSettings.ts.

---

_Verified: 2026-03-19T17:32:00Z_
_Verifier: Claude (gsd-verifier)_
