# Roadmap: Nostr PhotoShare

## Overview

Four phases deliver the complete photo-sharing pipeline in strict dependency order. Phase 1 establishes the security foundations and project scaffolding that every later phase depends on. Phase 2 builds the client-side image processing pipeline in isolation, where cryptographic bugs and memory problems are cheapest to fix. Phase 3 wires in Blossom upload and Nostr event publishing, completing the upload path. Phase 4 delivers the viewer, share link, and final UX — the user-facing output of everything built before it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Next.js project, AES-256-GCM crypto module, ephemeral keypair, SSR boundaries, and config defaults (completed 2026-03-19)
- [ ] **Phase 2: Image Processing Pipeline** - Client-side EXIF strip, resize, WebP convert, thumbnail generation, HEIC handling, and memory-safe batch processing in a Web Worker
- [x] **Phase 3: Upload and Publishing** - Blossom blob upload with SHA-256 verification, Nostr kind 30078 event publish with NIP-40 expiry, upload progress UI, and configurable relay/server settings (completed 2026-03-19)
- [ ] **Phase 4: Share Link and Viewer** - Share link generation with key in URL fragment, relay hints encoding, thumbnail grid gallery, lightbox slideshow, and download-all

## Phase Details

### Phase 1: Foundation
**Goal**: The project runs, builds without SSR errors, and the security-critical crypto primitives are correct and tested
**Depends on**: Nothing (first phase)
**Requirements**: CRYPT-01, CRYPT-02, CRYPT-03, CRYPT-04, CONF-04
**Success Criteria** (what must be TRUE):
  1. `next build` completes without errors — no `window is not defined` or Web Crypto SSR exceptions
  2. `lib/crypto.ts` encrypts and decrypts a test blob using AES-256-GCM and produces a unique IV on every call — verified by unit tests
  3. An ephemeral Nostr keypair is generated in-browser with no persistent storage — confirmed by inspecting localStorage after page reload
  4. Default Blossom server (24242.io) and default relay (relay.nostu.be) are configured and accessible via `lib/config.ts`
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Scaffold Next.js 16 project, install all dependencies, configure Vitest with jsdom, establish SSR boundaries
- [ ] 01-02-PLAN.md — Implement AES-256-GCM crypto module with TDD (CRYPT-01 through CRYPT-04)
- [ ] 01-03-PLAN.md — Implement types/album.ts, lib/config.ts, lib/nostr/signer.ts, lib/nostr/naddr.ts with tests (CONF-04, UPLD-04)

### Phase 2: Image Processing Pipeline
**Goal**: Up to 200 photos can be dragged in and processed client-side without blocking the UI or exhausting browser memory
**Depends on**: Phase 1
**Requirements**: PROC-01, PROC-02, PROC-03, PROC-04, PROC-05, PROC-06, PROC-07, PROC-08, PROC-09
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop a folder of 200 iPhone photos and processing starts without a page freeze
  2. Each processed image has EXIF and geolocation data removed — confirmed by inspecting output with an EXIF reader
  3. Each processed image is a WebP file sized appropriately for full-screen display and accompanied by a smaller WebP thumbnail
  4. HEIC files from an iPhone are detected and converted — they appear in the processed output alongside JPEG/PNG inputs
  5. Processing completes for 200 photos and the browser tab remains stable (no out-of-memory crash)
**Plans**: 5 plans
Plans:
- [ ] 02-01-PLAN.md — Install dependencies, define ProcessedPhoto/ProcessorApi types, create Wave 0 test scaffolds
- [ ] 02-02-PLAN.md — Implement heic-detect.ts, dimensions.ts, and image-processor.worker.ts (Comlink + OffscreenCanvas)
- [ ] 02-03-PLAN.md — Implement folder-traverse.ts with webkitGetAsEntry pagination loop
- [ ] 02-04-PLAN.md — Implement Zustand processing store and useImageProcessor hook (p-limit concurrency)
- [ ] 02-05-PLAN.md — Wire DropZone.tsx, ProgressList.tsx, UploadPanel.tsx; human-verify end-to-end pipeline

### Phase 3: Upload and Publishing
**Goal**: Processed and encrypted images are uploaded to Blossom and an encrypted album manifest is published to a Nostr relay, with clear per-photo progress feedback
**Depends on**: Phase 2
**Requirements**: UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05, UPLD-06, UPLD-07, UPLD-08, CONF-01, CONF-02
**Success Criteria** (what must be TRUE):
  1. The upload progress UI shows each photo moving through processing, encrypting, uploading, and done states
  2. Every encrypted blob uploaded to the Blossom server has its SHA-256 hash verified against the server response — mismatches are surfaced as errors, not silently ignored
  3. A Nostr kind 30078 event with NIP-40 expiration (~30 days) is published and confirmed via relay OK response before any share link is generated
  4. User can change the Blossom server(s) and Nostr relay list via a settings panel, and the next upload uses the new values
  5. The share link is only shown after all photo uploads succeed and the relay confirms the event
**Plans**: 6 plans
Plans:
- [ ] 03-01-PLAN.md — Wave 0 TDD scaffolds: 6 failing test files for all Phase 3 source modules
- [ ] 03-02-PLAN.md — Implement Blossom upload library (sha256Hex, BUD-11 auth, uploadBlob, validateBlossomServer) and kind 30078 event builder
- [ ] 03-03-PLAN.md — Implement upload Zustand store with encrypting/uploading/done/error status union
- [ ] 03-04-PLAN.md — Implement useUpload hook: full encrypt→upload→publish pipeline with p-limit and relay OK gate
- [ ] 03-05-PLAN.md — Implement useSettings hook (localStorage persistence, Blossom CORS validation) and SettingsPanel component
- [ ] 03-06-PLAN.md — Wire UploadPanel with ShareCard, SettingsPanel, Upload button; human-verify end-to-end

### Phase 4: Share Link and Viewer
**Goal**: Anyone with the share link can view the full album in a browser — thumbnail grid, lightbox slideshow, and download all — without any account or prior knowledge
**Depends on**: Phase 3
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, VIEW-07, CONF-03
**Success Criteria** (what must be TRUE):
  1. Opening a share link in a fresh browser tab (no account, no app state) decrypts and displays the full thumbnail grid
  2. Clicking a thumbnail opens a full-screen lightbox with working keyboard arrow navigation and touch swipe on mobile
  3. The gallery is usable on a mobile phone in portrait orientation — thumbnails grid is legible and the lightbox is not clipped
  4. Thumbnails load immediately from Blossom on page open; full-resolution images load only when opened in the lightbox
  5. User can tap "Download all" and receives decrypted full-resolution images as a zip file
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-19 |
| 2. Image Processing Pipeline | 3/5 | In Progress|  |
| 3. Upload and Publishing | 6/6 | Complete   | 2026-03-19 |
| 4. Share Link and Viewer | 0/? | Not started | - |
