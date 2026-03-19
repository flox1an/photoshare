---
phase: 01-foundation
plan: "03"
subsystem: nostr
tags: [applesauce-signers, nostr-tools, nip19, typescript, vitest, album-manifest]

# Dependency graph
requires:
  - phase: 01-foundation-01-01
    provides: Next.js scaffold with vitest configured and src/lib/crypto.ts established
provides:
  - PhotoEntry and AlbumManifest TypeScript interfaces (data contract for all phases)
  - DEFAULT_RELAYS and DEFAULT_BLOSSOM_SERVER configuration constants
  - createEphemeralSigner() using applesauce SimpleSigner (no key persistence)
  - encodeAlbumNaddr() / decodeAlbumNaddr() for kind 30078 share URLs
  - 15 passing unit tests for CONF-04 and UPLD-04 requirements
affects:
  - 02-image-processing (imports AlbumManifest/PhotoEntry from src/types/album.ts)
  - 03-upload (imports createEphemeralSigner, encodeAlbumNaddr, DEFAULT_RELAYS, DEFAULT_BLOSSOM_SERVER)
  - 04-viewer (imports decodeAlbumNaddr, AlbumManifest/PhotoEntry)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SimpleSigner is a value alias (typeof PrivateKeySigner) — use InstanceType<typeof SimpleSigner> not SimpleSigner as a type
    - Ephemeral signer pattern — new SimpleSigner() generates fresh keypair, never persisted
    - nip19.naddrEncode with kind 30078 + identifier + pubkey + relays for share URLs

key-files:
  created:
    - src/types/album.ts
    - src/lib/config.ts
    - src/lib/config.test.ts
    - src/lib/nostr/signer.ts
    - src/lib/nostr/naddr.ts
    - src/lib/nostr/signer.test.ts
  modified: []

key-decisions:
  - "InstanceType<typeof SimpleSigner> required as return/param type because SimpleSigner is a const alias (typeof PrivateKeySigner), not a class declaration"
  - "ALBUM_EXPIRY_SECONDS=2592000 (30 days) and BLOSSOM_EXPIRY_SECONDS=5184000 (60 days) established as app-wide constants"
  - "encodeAlbumNaddr uses kind 30078 hardcoded — NIP-78 parameterized replaceable event for album manifests"

patterns-established:
  - "Pattern: applesauce SimpleSigner as value alias — type via InstanceType<typeof SimpleSigner>"
  - "Pattern: ephemeral signer lifecycle — created per upload session, discarded after event publish"
  - "Pattern: naddr share URL encodes identifier + pubkey + kind 30078 + relay hints"

requirements-completed:
  - CONF-04

# Metrics
duration: 6min
completed: "2026-03-19"
---

# Phase 1 Plan 3: Shared Library Contracts Summary

**AlbumManifest/PhotoEntry types, DEFAULT_RELAYS/DEFAULT_BLOSSOM_SERVER config, applesauce SimpleSigner ephemeral keypair, and nostr-tools nip19 naddr encode/decode — 15 unit tests covering CONF-04 and UPLD-04**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T14:26:54Z
- **Completed:** 2026-03-19T14:32:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- PhotoEntry and AlbumManifest TypeScript interfaces established as the canonical data contract between all phases
- DEFAULT_RELAYS (wss://relay.nostu.be) and DEFAULT_BLOSSOM_SERVER (https://24242.io) config constants with ALBUM_EXPIRY_SECONDS and BLOSSOM_EXPIRY_SECONDS
- createEphemeralSigner() returns a fresh applesauce SimpleSigner with no localStorage/sessionStorage persistence
- encodeAlbumNaddr() / decodeAlbumNaddr() wrapping nostr-tools nip19 for kind 30078 share URL encoding
- 15 tests passing: 7 for config (CONF-04) + 8 for signer/naddr (UPLD-04 + naddr round-trip)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement types, config, and their tests** - `aec554a` (feat)
2. **Task 2: Implement ephemeral signer and naddr utilities with tests** - `ee52bd0` (feat) + `fe52c1d` (fix: InstanceType type correction by linter)

_Note: TDD tasks — RED phase wrote failing tests, GREEN phase implemented to pass._

## Files Created/Modified

- `src/types/album.ts` - PhotoEntry and AlbumManifest TypeScript interfaces
- `src/lib/config.ts` - DEFAULT_RELAYS, DEFAULT_BLOSSOM_SERVER, ALBUM_EXPIRY_SECONDS, BLOSSOM_EXPIRY_SECONDS
- `src/lib/config.test.ts` - 7 unit tests for CONF-04
- `src/lib/nostr/signer.ts` - createEphemeralSigner(), getSignerPubkey() via applesauce SimpleSigner
- `src/lib/nostr/naddr.ts` - encodeAlbumNaddr(), decodeAlbumNaddr() via nostr-tools nip19
- `src/lib/nostr/signer.test.ts` - 8 unit tests for UPLD-04 and naddr round-trip

## Decisions Made

- `InstanceType<typeof SimpleSigner>` used instead of `SimpleSigner` as a type annotation because `SimpleSigner` in applesauce-signers@5.1.0 is `declare const SimpleSigner: typeof PrivateKeySigner` — a value alias, not a class declaration. TypeScript correctly rejects it as a type reference.
- Expiry constants (ALBUM_EXPIRY_SECONDS, BLOSSOM_EXPIRY_SECONDS) defined as computed expressions `30 * 24 * 60 * 60` for readability, with comment showing evaluated value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SimpleSigner type reference in signer.ts**
- **Found during:** Task 2 (build verification after implementing signer)
- **Issue:** `SimpleSigner` is `declare const SimpleSigner: typeof PrivateKeySigner` in applesauce-signers@5.1.0 — a value alias, not a class type. TypeScript error: "'SimpleSigner' refers to a value, but is being used as a type here."
- **Fix:** Changed return type and parameter type from `SimpleSigner` to `InstanceType<typeof SimpleSigner>`
- **Files modified:** `src/lib/nostr/signer.ts`
- **Verification:** `npm run build` exits 0; all 26 tests still pass
- **Committed in:** `fe52c1d` (auto-fixed by linter, captured in subsequent commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug)
**Impact on plan:** Necessary for TypeScript correctness and build success. No scope creep.

## Discovered applesauce-signers@5.1.0 API Surface

```
Exports: AmberClipboardSigner, ExtensionMissingError, ExtensionSigner, Helpers,
         NostrConnectProvider, NostrConnectSigner, PasswordSigner, PrivateKeySigner,
         ReadonlySigner, SerialPortSigner, SimpleSigner, getConnectionMethods
```

Key finding: `SimpleSigner` is deprecated in favor of `PrivateKeySigner` (same class, alias). Both work. The plan's `import { SimpleSigner } from "applesauce-signers"` works correctly — only the type annotation requires `InstanceType<typeof SimpleSigner>`.

## Test Results

| File | Tests | Result |
|------|-------|--------|
| src/lib/config.test.ts | 7 | PASS |
| src/lib/nostr/signer.test.ts | 8 | PASS |
| src/lib/crypto.test.ts | 11 | PASS (pre-existing) |
| **Total** | **26** | **ALL PASS** |

## Issues Encountered

None beyond the auto-fixed SimpleSigner type annotation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All shared contracts in place: AlbumManifest/PhotoEntry types, config defaults, ephemeral signer, naddr utilities
- Phase 2 (image processing) can import `AlbumManifest` and `PhotoEntry` from `src/types/album.ts`
- Phase 3 (upload) can import `createEphemeralSigner`, `encodeAlbumNaddr`, `DEFAULT_RELAYS`, `DEFAULT_BLOSSOM_SERVER`
- Phase 4 (viewer) can import `decodeAlbumNaddr`, `AlbumManifest`
- `npm run build` exits 0, `npx vitest run` exits 0

## Self-Check: PASSED

All created files confirmed present on disk. All task commits verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-19*
