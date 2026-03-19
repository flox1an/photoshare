---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 03-05-PLAN.md — useSettings hook and SettingsPanel component
last_updated: "2026-03-19T17:05:00.885Z"
last_activity: 2026-03-19 — Roadmap created
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 14
  completed_plans: 13
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Anyone can securely share a batch of photos via a single link — no accounts, no server-side storage of plaintext images, no metadata leaks — and everything disappears after 30 days.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 4 (Foundation)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-19 — Roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 569 | 2 tasks | 9 files |
| Phase 01-foundation P02 | 279 | 2 tasks | 3 files |
| Phase 01-foundation P03 | 350 | 2 tasks | 6 files |
| Phase 02-image-processing-pipeline P01 | 7 | 2 tasks | 7 files |
| Phase 02-image-processing-pipeline P03 | 1 | 1 tasks | 1 files |
| Phase 02-image-processing-pipeline P02 | 3 | 2 tasks | 3 files |
| Phase 02-image-processing-pipeline P04 | 1 | 2 tasks | 2 files |
| Phase 02-image-processing-pipeline P05 | 45 | 3 tasks | 3 files |
| Phase 03-upload-and-publishing P01 | 570 | 2 tasks | 6 files |
| Phase 03-upload-and-publishing P03 | 2 | 1 tasks | 3 files |
| Phase 03-upload-and-publishing P02 | 3 | 2 tasks | 4 files |
| Phase 03-upload-and-publishing P04 | 613 | 1 tasks | 4 files |
| Phase 03-upload-and-publishing P05 | 323 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-phase]: applesauce ecosystem over raw nostr-tools — higher-level API by hzrd149 (noStrudel author)
- [Pre-phase]: blossom-client-sdk 4.1.0 for Blossom upload/auth — written by spec author
- [Pre-phase]: Web Crypto API (native) for AES-256-GCM — no third-party crypto library
- [Pre-phase]: Comlink + browser-image-compression for Web Worker pipeline
- [Pre-phase]: NIP-40 is advisory (SHOULD, not MUST) — privacy relies on encryption, not deletion
- [Phase 01-foundation]: Next.js 16 Turbopack requires ssr:false dynamic imports in Client Components — page wrappers use 'use client'
- [Phase 01-foundation]: React.use(params) instead of async/await for route params in Client Component pages
- [Phase 01-foundation]: InstanceType<typeof SimpleSigner> instead of SimpleSigner as type annotation — applesauce-signers exports SimpleSigner as value, not named type
- [Phase 01-foundation]: InstanceType<typeof SimpleSigner> required as return/param type because SimpleSigner is a const alias in applesauce-signers@5.1.0
- [Phase 01-foundation]: AlbumManifest and PhotoEntry interfaces established as the canonical data contract between all phases
- [Phase 02-image-processing-pipeline]: exifr installed as devDependency (test-only) — not in production bundle
- [Phase 02-image-processing-pipeline]: ProcessedPhoto interface: width/height are ORIGINAL pre-resize dimensions feeding PhotoEntry for Phase 4 layout
- [Phase 02-image-processing-pipeline]: Wave 0 RED tests committed before implementation — 3 fail (no impl), 1 passes (static EXIF-strip proof)
- [Phase 02-image-processing-pipeline]: Worker re-implements HEIC detection inline to avoid Worker import boundary complexity
- [Phase 02-image-processing-pipeline]: mimeType read from blob.type after convertToBlob — Safari returns image/png silently; viewer handles both
- [Phase 02-image-processing-pipeline]: useImageProcessor creates worker in useEffect for SSR safety; p-limit(4) gates 144 MB peak GPU memory ceiling; addPhotos accumulates across drops
- [Phase 02-image-processing-pipeline]: Native onDrop intercepts folder drops using webkitGetAsEntry; react-dropzone handles file picker and individual file drops
- [Phase 02-image-processing-pipeline]: Files streamed into store in chunks during native drop handling to prevent UI lag on large batches
- [Phase 03-upload-and-publishing]: uploadBlob test signature includes localHashHex param to enable hash mismatch verification (UPLD-02 requirement)
- [Phase 03-upload-and-publishing]: uploadStore uses addPhoto(id, filename) API — per-photo granularity vs processingStore batch pattern
- [Phase 03-upload-and-publishing]: uploadStore includes addPhoto(id, filename) — tests are ground truth over plan interface spec
- [Phase 03-upload-and-publishing]: setUploadDone takes full BlobDescriptor (url, sha256, size, type, uploaded) matching actual test expectations
- [Phase 03-upload-and-publishing]: includeSingletonTag([d, dTag]) used instead of includeReplaceableIdentifier(dTag) because applesauce-factory build() pre-applies nanoid d-tag before user operations
- [Phase 03-upload-and-publishing]: uploadBlob signature includes localHashHex as explicit parameter to enable pre-computed hash reuse and match test contract from 03-01
- [Phase 03-upload-and-publishing]: Lazy RelayPool in getPool() callback for SSR safety and vitest 4.x arrow-function mock compatibility
- [Phase 03-upload-and-publishing]: vitest.setup.ts Uint8Array Symbol.hasInstance patch for jsdom cross-realm typed array issue with @noble/hashes
- [Phase 03-upload-and-publishing]: useSettings hook delegates Blossom validation to SettingsPanel — keeps hook unit-testable without network mocks (tests are ground truth)
- [Phase 03-upload-and-publishing]: vitest.config.ts execArgv --no-experimental-webstorage required for Node.js 25 — disables built-in Web Storage that overrides jsdom localStorage

### Pending Todos

None yet.

### Blockers/Concerns

- blossom-client-sdk@4.1.0 type compatibility with nostr-tools@2.23.3 — needs verification during Phase 3
- Default Blossom server CORS support needs empirical testing from a browser context before committing
- Relay OK message handling in nostr-tools SimplePool — exact API surface to confirm during Phase 3 planning

## Session Continuity

Last session: 2026-03-19T17:05:00.883Z
Stopped at: Completed 03-05-PLAN.md — useSettings hook and SettingsPanel component
Resume file: None
