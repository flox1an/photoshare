# Project Research Summary

**Project:** Nostr + Blossom Encrypted Ephemeral Photo Sharing
**Domain:** Privacy-first ephemeral photo sharing — decentralized, client-side-only
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a zero-knowledge, client-side-only photo sharing application built on the Nostr protocol and Blossom blob storage. The core value proposition — "encrypt in the browser, store encrypted bytes on decentralized servers, share a single link that contains the decryption key in its fragment" — is a well-understood pattern used by tools like Firefox Send and Enclosed, but this project extends it with a Nostr-native storage layer, per-photo EXIF stripping, and a polished gallery viewer. Research confirms this architecture is sound and achievable with current browser APIs and the Nostr/Blossom ecosystem as of 2026.

The recommended approach is: Next.js 16 App Router for the framework (project constraint), nostr-tools (not NDK) for Nostr protocol work since the app only needs ephemeral key generation and single-event publishing, blossom-client-sdk for the upload/auth flow, Web Crypto API (native, no library) for AES-256-GCM encryption, and browser-image-compression + Comlink for a non-blocking image processing pipeline in Web Workers. The entire processing-and-upload pipeline runs in the browser — no server sees plaintext. This is achievable with a focused implementation across 4 development phases.

The highest risks are implementation-level rather than architectural: AES-GCM IV reuse across photos with the same key is catastrophically exploitable and easy to get wrong in a batch loop; browser memory exhaustion with 200 high-resolution photos requires a concurrency-limited pipeline from day one; HEIC files from iOS users will silently fail without explicit format handling; and Next.js SSR will throw `window is not defined` errors if crypto code is not isolated behind `useEffect` and `{ ssr: false }` dynamic imports. These must be addressed in the correct phases, not retrofitted.

## Key Findings

### Recommended Stack

The stack is dominated by one key decision: nostr-tools over NDK. NDK is built for full Nostr social clients with multi-account session management, outbox model relay selection, and wallet integration — this app generates one ephemeral keypair, publishes one event, and is done. nostr-tools gives direct, minimal access to signing and relay pools at a fraction of the bundle cost. The blossom-client-sdk (authored by the Blossom spec author) handles the upload auth flow including kind 24242 auth events.

All image processing is browser-native: Canvas API + OffscreenCanvas for resize and WebP conversion, Web Crypto API for AES-256-GCM, and Comlink for ergonomic Web Worker RPC. Zustand manages upload queue state. The UI layer uses shadcn/ui (Tailwind v4), react-dropzone for file intake, and yet-another-react-lightbox for the gallery viewer.

**Core technologies:**
- Next.js 16 (App Router, Turbopack): Framework — project constraint; Turbopack default in v16
- nostr-tools 2.23.3: Nostr protocol — minimal, direct API; NDK is overkill for single-event publish
- blossom-client-sdk 4.1.0: Blossom upload/auth — written by spec author, handles full auth flow
- Web Crypto API (native): AES-256-GCM encryption — no third-party crypto library needed
- browser-image-compression 2.x + Comlink 4.4.2: Image pipeline — non-blocking Web Worker processing
- Zustand 5.0.8: Upload state — minimal API, perfect for per-photo progress tracking
- shadcn/ui + Tailwind CSS 4.x: UI — copy-owned components, v4-compatible
- react-dropzone 15.0.0: File intake — handles folder drops via `webkitdirectory`
- yet-another-react-lightbox 3.29.1: Gallery viewer — swipe/keyboard, React 19 compatible

### Expected Features

The feature set divides cleanly into a core upload pipeline, a sharing mechanism, and a viewer. All three must work end-to-end for the product to be usable. Research confirms the dependency chain: EXIF strip → resize → encrypt → upload → publish Nostr event → generate share link; the link cannot be generated until all uploads succeed and the event is confirmed by relay. The viewer reverses this: parse URL fragment → fetch event → decrypt manifest → lazy-load and decrypt blobs.

**Must have (table stakes):**
- Drag-and-drop upload (files and folders) with click-to-browse fallback
- Client-side pipeline: EXIF strip → resize → WebP → AES-256-GCM encrypt
- Per-photo progress UI (queued / processing / encrypting / uploading / done / error)
- Blossom upload with SHA-256 addressing and configurable server
- Nostr event publication (kind 30078, NIP-40 expiry, ephemeral keypair)
- Shareable link with decryption key in URL fragment and relay hints
- Copy link to clipboard
- Viewer: fetch Nostr event, decrypt manifest, fetch and decrypt Blossom blobs
- Viewer: thumbnail grid gallery (lazy-loaded)
- Viewer: full-screen lightbox with keyboard and swipe navigation
- Viewer: download all (client-side zip)
- Mobile-responsive layout for both uploader and viewer

**Should have (competitive):**
- QR code for share link — high-value for in-person event sharing
- Individual photo download — single-photo save without full zip
- Configurable relay list UI — power user / self-hosting path
- Upload error retry — per-photo retry for failed uploads
- Multiple Blossom server upload — redundancy for content availability

**Defer (v2+):**
- NIP-07 browser extension login (opt-in persistent identity)
- Custom expiration duration (1-month fixed is correct for v1)
- Album updating after sharing (add/replace photos in existing album)
- Blossom server mirroring UI

### Architecture Approach

The architecture is purely client-side: a Next.js App Router app with no backend, two main routes (upload page at `/`, viewer page at `/view/[naddr]`), orchestration logic in React hooks, protocol clients in `lib/`, and CPU-bound work in a Web Worker. The key transport is the URL fragment — the AES-256-GCM key is base64url-encoded into the `#fragment` so the browser never sends it to any server. The album manifest (photo list with per-photo blob hashes and IVs) is itself AES-256-GCM encrypted and stored as the content of a kind 30078 Nostr event. Relay operators see only ciphertext.

**Major components:**
1. `ImageProcessor` (Web Worker) — EXIF strip, resize, WebP convert, thumbnail generation; isolated from main thread via Comlink
2. `CryptoModule` (`lib/crypto.ts`) — AES-256-GCM encrypt/decrypt via SubtleCrypto; single centralized module
3. `BlossomClient` (`lib/blossom/client.ts`) — HTTP PUT/GET to Blossom servers with kind 24242 auth event signing
4. `NostrClient` (`lib/nostr/client.ts`) — WebSocket relay pool, publish kind 30078 events, fetch by naddr
5. `KeypairManager` (`lib/nostr/keypair.ts`) — generates ephemeral secp256k1 keypair per session; never persisted
6. `useUpload` hook — orchestrates the full upload flow: dispatch to worker → encrypt → upload → publish → build URL
7. `useViewer` hook — orchestrates viewer flow: parse URL → fetch event → decrypt manifest → lazy-load blobs
8. UI components (`DropZone`, `ProgressList`, `ShareCard`, `Gallery`, `Lightbox`) — thin wrappers over hooks

The architecture research provides an explicit build order: `lib/crypto.ts` first (no dependencies), then the Web Worker, then nostr/blossom protocol clients, then hooks, then UI components. Following this order avoids circular dependencies and isolates security-critical code early.

### Critical Pitfalls

1. **IV reuse across photos in the same album** — Call `crypto.getRandomValues(new Uint8Array(12))` inside the per-photo loop, never outside it. Write a unit test that asserts all 200 IVs in a batch are unique. This is cryptographically catastrophic if wrong.

2. **Browser memory exhaustion at 200 photos** — Process in a concurrency-limited pipeline (3-5 concurrent), not all at once. Use `createImageBitmap()` not `<img>` elements, `canvas.toBlob()` not `toDataURL()`, and `URL.revokeObjectURL()` aggressively. Load-test with real 12 MP iPhone photos.

3. **Next.js SSR errors for crypto/window APIs** — Mark all upload/viewer components with `{ ssr: false }` dynamic imports and wrap all crypto calls in `useEffect`. Test with `next build`, not just `next dev`. Establish this pattern before writing any crypto code.

4. **HEIC/HEIF files from iOS silently failing** — Detect HEIC via magic bytes (not just file extension), then either convert with `heic2any`/`libheif-js` or surface a clear rejection message. Test with actual HEIC files from an iPhone.

5. **Blossom partial upload corruption** — Do not publish the Nostr event until all photo uploads succeed. Validate that the SHA-256 hash returned by the server matches the locally computed hash of the encrypted blob. Gate share link generation on confirmed relay `OK` response.

6. **NIP-40 expiration is not deletion** — NIP-40 is a hint, not a guarantee. Relays MAY retain expired events. Privacy comes from encryption, not expiration. Never describe the app as "auto-deleting" content — say "expires from most relays within ~30 days."

## Implications for Roadmap

Based on research, the dependency chain implies 4 development phases ordered by technical dependencies and risk surface. The security-critical code (crypto, SSR boundaries) must be established before the processing pipeline, which must be established before the upload integration, which must be established before the viewer.

### Phase 1: Foundation and Security Model

**Rationale:** Two pitfalls (SSR errors, NIP-40 misunderstanding) must be addressed before writing any feature code. Establishing the correct SSR boundary pattern, the module structure, and the accurate mental model for the security guarantees prevents expensive rewrites later.
**Delivers:** Initialized Next.js 16 project, correct SSR boundaries (`{ ssr: false }` for crypto components), `lib/crypto.ts` with AES-256-GCM wrappers + unit tests, `lib/nostr/keypair.ts`, baseline `lib/config.ts` with default relay and Blossom server lists, and the build pipeline passing `next build` with no SSR errors.
**Addresses:** Project setup, correct security model documentation, and foundation for all subsequent phases.
**Avoids:** Next.js SSR crashes; establishes that NIP-40 is a cache hint not a deletion guarantee from the start.

### Phase 2: Client-Side Image Processing Pipeline

**Rationale:** The image processing pipeline (EXIF strip → resize → WebP → encrypt) is the highest-risk implementation detail in the project. It must be built and tested in isolation before connecting to any external services — errors here (IV reuse, memory exhaustion, HEIC failures) are the hardest to fix post-launch.
**Delivers:** `workers/image-processor.worker.ts` with Comlink RPC (EXIF strip, resize, WebP, thumbnail), `lib/crypto.ts` fully exercised with per-photo IV generation, concurrency-limited batch processing pipeline (3-5 concurrent), HEIC detection and handling, and memory profiling validation with 200 real photos.
**Uses:** browser-image-compression, Comlink, Web Crypto API, OffscreenCanvas
**Avoids:** IV reuse catastrophe; browser memory exhaustion; HEIC silent failures.

### Phase 3: Upload Pipeline and External Protocol Integration

**Rationale:** With a tested processing pipeline, wire up the two external integrations (Blossom upload, Nostr event publish). Both require careful error handling — the pitfall research identifies partial upload corruption and unconfirmed relay publish as the two most likely sources of a broken share link in production.
**Delivers:** `lib/blossom/client.ts` with kind 24242 auth signing, SHA-256 response verification, CORS validation against default server list, and per-photo retry logic; `lib/nostr/client.ts` with relay pool, kind 30078 event building with NIP-40 expiry, and relay `OK` confirmation; `useUpload` hook orchestrating the full pipeline; upload progress UI (`DropZone`, `ProgressList`).
**Uses:** blossom-client-sdk 4.1.0, nostr-tools 2.23.3, Zustand 5.0.8, react-dropzone 15.0.0
**Avoids:** Blossom partial upload corruption; SHA-256 mismatch going undetected; unconfirmed relay publish; share link generated before all uploads succeed.

### Phase 4: Share Link Generation and Viewer

**Rationale:** Once the upload pipeline is confirmed working end-to-end, build the share output and the viewer. The viewer's lazy-loading strategy (thumbnails first, full-res on lightbox open) is essential for performance with large albums and must be implemented correctly from the start.
**Delivers:** `useAlbumKey` hook with base64url fragment encoding/decoding; `ShareCard` component with copy-to-clipboard and (v1.x) QR code; `useViewer` hook with URL parsing, relay fetching, manifest decryption, and lazy blob loading; `Gallery` thumbnail grid with IntersectionObserver lazy-loading; `Lightbox` with swipe and keyboard navigation; download-all as client-side zip; mobile-responsive layouts for both pages.
**Uses:** yet-another-react-lightbox 3.29.1, JSZip (or streaming zip), Navigator.clipboard API
**Avoids:** Key in query param instead of fragment; eager full-album decryption on load; download-all triggering repeated browser download dialogs.

### Phase Ordering Rationale

- **Crypto before pipeline before integrations before viewer** — strict dependency order; nothing can run without correct encryption, nothing can be shared without working uploads.
- **Security-critical pitfalls addressed in early phases** — IV reuse and SSR errors are the two pitfalls with HIGH recovery cost; they must be caught before any external traffic reaches the app.
- **HEIC handling in Phase 2, not a later retrofit** — HEIC failures are invisible during testing with sample files; they surface in production. Building detection and handling as part of the pipeline phase is less expensive than discovering it post-launch.
- **Viewer deferred to Phase 4** — The viewer depends on working upload output; building it against mock data would require significant rework once the real event format is confirmed.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (image pipeline):** HEIC-to-JPEG conversion library evaluation (`heic2any` vs `libheif-js`) — both are viable but have different WASM bundle sizes and decoding fidelity; needs hands-on evaluation.
- **Phase 3 (Blossom integration):** Default Blossom server selection — CORS support, rate limits, and storage quotas vary significantly across public servers; needs testing against actual servers from a browser context before committing to defaults.
- **Phase 3 (Nostr relay integration):** NIP-40 support coverage across default relays — needs verification of `supported_nips` field on candidate relay list; some popular relays do not implement NIP-40.

Phases with standard patterns (skip research-phase):
- **Phase 1 (foundation):** Next.js App Router setup and Web Crypto API wrappers are extremely well-documented; no research needed.
- **Phase 4 (viewer):** yet-another-react-lightbox is well-documented and its patterns are standard; IntersectionObserver lazy-loading is well-understood.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core package versions verified against npm/jsr; Web Crypto and Canvas APIs are browser standards; nostr-tools vs NDK decision is well-reasoned |
| Features | HIGH | Feature set derived from established comparable products (Firefox Send, Wormhole); Nostr event structure verified against NIPs |
| Architecture | HIGH | Protocol specs verified against official sources (BUD-01, BUD-02, NIP-78, NIP-40); implementation patterns verified via recent articles and library docs |
| Pitfalls | MEDIUM | Nostr/Blossom ecosystem is young; some relay and server behavior (NIP-40 compliance, CORS headers) must be validated empirically; crypto pitfalls are verified against specs |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Default Blossom server list:** No public list of Blossom servers with confirmed CORS support, rate limits, and NIP-40/expiration header compliance. Must be tested from a browser context before shipping. Mitigation: start with one or two known-good servers (e.g., blossom.band, cdn.satellite.earth) and surface clear error messages when a server rejects uploads.
- **blossom-client-sdk@4.1.0 type compatibility with nostr-tools@2.x:** The blossom-client-sdk was last updated 7 months ago; confirm that its auth event signing types are compatible with nostr-tools 2.23.3 `Uint8Array` key format during initial integration. There may be a type adapter needed.
- **Memory behavior on mid-range Android devices:** The 200-photo batch processing design was validated conceptually and against Chrome DevTools; behavior on low-memory Android devices with constrained browser tabs is unverified. The concurrency limit (3-5 concurrent) may need to be tuned downward.
- **Relay `OK` message handling in nostr-tools SimplePool:** The pitfall research flags that relay publish success must be confirmed via the relay `OK` message, not just WebSocket send completion. The exact SimplePool API surface for awaiting `OK` responses should be confirmed during Phase 3 planning.

## Sources

### Primary (HIGH confidence)
- [nostr-tools npm/jsr](https://jsr.io/@nostr/tools/versions) — version 2.23.3, API surface, Uint8Array key format
- [blossom-client-sdk GitHub (hzrd149)](https://github.com/hzrd149/blossom-client-sdk) — auth flow, createUploadAuth(), encodeAuthorizationHeader()
- [Blossom BUD-01, BUD-02, BUD-04 specs](https://github.com/hzrd149/blossom) — PUT/GET protocol, SHA-256 addressing, auth header format
- [NIP-40 Expiration Timestamp](https://nips.nostr.com/40) — SHOULD NOT serve expired events (not MUST NOT delete)
- [NIP-78 kind 30078](https://github.com/nostr-protocol/nips/blob/master/78.md) — arbitrary app data event structure
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — AES-GCM, IV requirements, SubtleCrypto
- [MDN HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) — prefer over toDataURL for memory
- [Next.js 16 release notes](https://nextjs.org/blog/next-16) — Turbopack default, current version 16.2.0
- [Next.js crypto in client components](https://nextjs.org/docs/messages/next-prerender-crypto-client) — Suspense/useEffect requirements
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — v4 compatibility confirmed

### Secondary (MEDIUM confidence)
- [Web Workers + Comlink in Next.js 15](https://park.is/blog_posts/20250417_nextjs_comlink_examples/) — App Router Worker pattern
- [HEIC rendering on the web (DEV Community)](https://dev.to/upsidelab/rendering-heic-on-the-web-how-to-make-your-web-app-handle-iphone-photos-pj1) — zero browser support for HEIC decode
- [Safely process images without memory overflows](https://trailheadtechnology.com/safely-process-images-in-the-browser-without-memory-overflows/) — batching and pipeline design
- [AES-GCM developer guide](https://medium.com/@thomas_40553/how-to-secure-encrypt-and-decrypt-data-within-the-browser-with-aes-gcm-and-pbkdf2-057b839c96b6) — IV reuse consequences
- [NIP-11 relay information document](https://nips.nostr.com/11) — supported_nips field
- [Enclosed (zero-knowledge sharing)](https://docs.enclosed.cc/how-it-works) — URL fragment key transport pattern reference

### Tertiary (LOW confidence)
- Blossom public server list — no authoritative source; default server selection needs empirical testing
- blossom-client-sdk@4.1.0 + nostr-tools@2.23.3 type compatibility — not explicitly documented; needs integration testing

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
