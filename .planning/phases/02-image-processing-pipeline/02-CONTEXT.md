# Phase 2: Image Processing Pipeline - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Client-side image processing pipeline: drag-and-drop files/folders, HEIC detection and conversion, EXIF/geolocation stripping, resize to full-screen dimensions, WebP conversion, thumbnail generation, and memory-safe batch processing in Web Workers for up to 200 photos. This phase does NOT upload or encrypt — it produces processed `ArrayBuffer` outputs that Phase 3 will encrypt and upload.

</domain>

<decisions>
## Implementation Decisions

### Output Dimensions
- Full-size images: max 2560px on the long edge, maintain original aspect ratio, no cropping
- Thumbnails: max 300px on the long edge, maintain original aspect ratio
- Both full and thumbnail are WebP output

### Quality & Compression
- Full-size WebP quality: 85 (good quality/size balance, ~200-400KB per photo at 2560px)
- Thumbnail WebP quality: 75 (sufficient for small grid view, ~10-15KB per thumb)

### Drag-Drop UX
- Processing starts immediately on drop — no preview/confirmation step
- User can add more photos after initial drop (accumulate into batch)
- Per-photo progress tracking (processing state per file)

### Processing Pipeline Order
- Claude's Discretion — but the logical flow is: detect HEIC → convert if needed → read into canvas → strip EXIF (implicit via canvas re-encode) → resize to full → export WebP full → resize to thumb → export WebP thumb → capture dimensions → pass to Phase 3
- EXIF stripping happens automatically when image is drawn to Canvas and re-exported (canvas does not preserve EXIF)
- Processing runs in Web Workers to avoid blocking the UI
- Memory management: process 3-5 photos concurrently, release each after processing completes (don't hold all 200 bitmaps in memory)

### Claude's Discretion
- Web Worker architecture (Comlink vs raw postMessage)
- HEIC conversion library choice (heic2any vs libheif-js)
- Canvas vs OffscreenCanvas in workers
- Exact concurrency limit for batch processing
- Progress state management (React state vs external store)
- Whether to use browser-image-compression library or raw Canvas API

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Code (integration points)
- `src/lib/crypto.ts` — `encryptBlob(data: ArrayBuffer, key: CryptoKey)` — Phase 3 will encrypt the outputs of this phase
- `src/types/album.ts` — `PhotoEntry` interface needs `width`, `height`, `filename` from processing output

### Research
- `.planning/research/STACK.md` — browser-image-compression, Comlink recommendations
- `.planning/research/ARCHITECTURE.md` — uploader flow, Web Worker pipeline
- `.planning/research/PITFALLS.md` — Browser memory limits at 200 photos (~7GB bitmaps), HEIC detection, OffscreenCanvas availability

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/crypto.ts` — `encryptBlob()` for Phase 3 (not used directly in Phase 2 but defines the output format)
- `src/types/album.ts` — `PhotoEntry` with `width`, `height`, `filename` fields that Phase 2 must populate
- `src/app/page.tsx` — Upload page with `dynamic(..., { ssr: false })` pattern already established
- `src/components/upload/UploadPanel.tsx` — Stub component, will be the main entry point for drag-drop

### Established Patterns
- `'use client'` + `dynamic(..., { ssr: false })` for browser-only APIs (Phase 1 decision)
- Vitest + jsdom for testing (`vitest.config.ts` configured)

### Integration Points
- `src/components/upload/UploadPanel.tsx` — main drop zone and processing orchestrator
- Output of processing pipeline feeds into Phase 3's encrypt + upload flow
- Each processed photo must produce: full WebP ArrayBuffer, thumb WebP ArrayBuffer, width, height, original filename

</code_context>

<specifics>
## Specific Ideas

- User expects immediate processing on drop — no "confirm" step, just start working
- Accumulation mode: dropping more files adds to the batch (not replaces)
- 200-photo stress test is a key success criterion — browser must not crash

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-image-processing-pipeline*
*Context gathered: 2026-03-19*
