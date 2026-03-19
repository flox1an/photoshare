# Pitfalls Research

**Domain:** Encrypted ephemeral photo sharing over Nostr + Blossom
**Researched:** 2026-03-19
**Confidence:** MEDIUM (Nostr/Blossom ecosystem is young; community patterns verified where possible, some protocol behavior verified against specs)

---

## Critical Pitfalls

### Pitfall 1: NIP-40 Expiration Is Not a Security Guarantee

**What goes wrong:**
The app treats Nostr event expiration as a hard privacy boundary — after 30 days, the album is gone. In reality, the NIP-40 spec explicitly states relays MAY persist expired events indefinitely and only SHOULD NOT serve them to clients. Many relays in the wild do not implement deletion at all; they simply stop serving the event but keep it stored. Any relay operator (or third party who scraped events before expiration) can retain and serve your encrypted event forever.

**Why it happens:**
Developers read "expiration tag" and assume it means deletion. The spec's use of SHOULD (not MUST) is easy to overlook. Since the content is encrypted anyway, this might seem like a minor concern — but the album metadata ciphertext and the Nostr pubkey are still exposed indefinitely.

**How to avoid:**
- Treat NIP-40 expiration as a best-effort cache hint, not a privacy mechanism. Privacy comes from encryption, not from relay behavior.
- Document this clearly in any user-facing copy ("Content expires from relays within ~30 days" not "Content is deleted after 30 days").
- Do not rely on NIP-40 for the security model. The AES-256-GCM encryption is the actual privacy layer.
- Check relay NIP-40 support via the NIP-11 `supported_nips` field before publishing; skip relays that do not declare support.
- Apply the same reasoning to Blossom servers: expiration headers are hints only, not guarantees.

**Warning signs:**
- Copy anywhere in the UI that says "auto-deleted" or "permanently removed"
- Security model docs that cite NIP-40 as a privacy guarantee

**Phase to address:** Foundation / Nostr integration phase. Establish the correct mental model before wiring up any event publishing logic.

---

### Pitfall 2: IV Reuse Across Files With the Same AES Key

**What goes wrong:**
All 200 photos in an album are encrypted with one shared AES-256-GCM key (by design — it goes in the URL fragment). If each photo does not use a unique, cryptographically random 12-byte IV (nonce), you risk IV reuse. AES-GCM with a repeated (key, IV) pair is catastrophic: it allows an attacker who intercepts two ciphertexts to XOR them and recover the plaintext of both. This is not theoretical — it is trivially exploitable.

**Why it happens:**
When looping over 200 photos in a Web Worker, developers sometimes generate the IV once outside the loop, or mistakenly copy an IV generation pattern that seeds from a counter rather than `crypto.getRandomValues()`. The bug is invisible — encryption succeeds, decryption succeeds, but the security is broken.

**How to avoid:**
- Call `crypto.getRandomValues(new Uint8Array(12))` independently inside the loop for each photo, never outside it.
- Prepend the 12-byte IV to the ciphertext blob before encryption so it is always stored alongside the ciphertext it was used with.
- Store `{iv, ciphertext}` pairs in album metadata so the viewer can decrypt each image independently.
- Write a unit test that asserts no two IVs in an album batch are equal.

**Warning signs:**
- IV generated once before the encryption loop
- IV stored separately from ciphertext (relies on correct positional reconstruction)
- No test for IV uniqueness across a batch

**Phase to address:** Encryption / client-side processing phase. Must be correct before any upload logic is built.

---

### Pitfall 3: Browser Memory Exhaustion With 200-Photo Batch Processing

**What goes wrong:**
Processing 200 high-resolution photos (EXIF strip → resize → WebP convert → encrypt) serially in the main thread, or even in a single Web Worker pass that loads all images into memory simultaneously, causes the tab to crash or become unresponsive. A 12 MP JPEG decoded to a raw bitmap is ~36 MB; 200 of them simultaneously is 7 GB — well beyond Chrome's ~4 GB per-tab limit.

**Why it happens:**
The happy-path implementation loads all `File` objects, creates `Image` elements, draws to Canvas, and collects all output blobs before starting uploads. This is fine for 5 photos and catastrophic for 200.

**How to avoid:**
- Process photos in a concurrency-limited pipeline: read → process → encrypt → upload → release references, one or a few at a time (concurrency of 3-5 is a reasonable starting point).
- Explicitly release resources after each photo: revoke object URLs with `URL.revokeObjectURL()`, null out canvas references, and close the `ImageBitmap` (call `.close()` on it).
- Use `createImageBitmap()` instead of `<img>` element + Canvas decode — it is memory-managed and does not require DOM attachment.
- Prefer `canvas.toBlob()` over `canvas.toDataURL()` — `toDataURL` encodes the whole image as a base64 string in memory, doubling the footprint.
- Track total in-flight memory and pause the pipeline if estimates exceed a threshold.
- Test with 200 real 12 MP iPhone photos, not small test images.

**Warning signs:**
- All files are loaded and decoded before any upload begins
- `toDataURL()` used anywhere in the image processing pipeline
- No explicit `URL.revokeObjectURL()` calls after blob URLs are used
- Processing tested only with small sample images

**Phase to address:** Client-side image processing phase (Web Worker pipeline design). This is the highest risk implementation detail in the project.

---

### Pitfall 4: HEIC/HEIF Files From iOS Users Break Canvas Processing

**What goes wrong:**
iPhone users on iOS/macOS may upload HEIC files directly, especially from camera rolls accessed via file picker or drag-and-drop. No major browser has native HEIC decode support. `new Image()` fails to load the file, `createImageBitmap()` rejects the promise, and the Canvas never gets painted — resulting in a silent failure or an empty/transparent output blob. The user sees their photo "processed" but the album viewer shows blank images.

**Why it happens:**
Testing with sample JPEG and PNG files passes all the way through. The failure only appears when a real user uploads directly from their iOS camera roll. Safari 17+ on macOS has introduced a regression where it converts PNG to HEIC on upload, making this broader than just iPhone users.

**How to avoid:**
- Detect HEIC/HEIF MIME type (`image/heic`, `image/heif`) and the magic bytes `ftypheic`/`ftypmif1` at the file header level before attempting Canvas decode.
- Convert HEIC to JPEG client-side using `heic2any` (npm) or `libheif-js` (WebAssembly) before feeding into the main processing pipeline.
- Show a clear per-photo error state if a file format cannot be decoded rather than silently producing a blank image.
- Test with actual HEIC files from an iPhone (not just renamed files).

**Warning signs:**
- File format detection relies only on `.name.endsWith('.heic')` rather than MIME type + magic bytes
- No test with real iPhone HEIC uploads
- No explicit error handling for `createImageBitmap()` rejection

**Phase to address:** Client-side image processing phase. Must handle HEIC before the pipeline is considered functional.

---

### Pitfall 5: Blossom Upload Failures Silently Corrupt the Album

**What goes wrong:**
The album metadata Nostr event stores the list of Blossom blob URLs for all photos. If some photo uploads fail (network error, server rejection, size limit exceeded, CORS preflight failure) and the event is published anyway with partial or missing blob entries, the viewer silently shows missing images with no way to recover. The share link is handed to the recipient but the album is broken.

**Why it happens:**
Upload code handles per-photo progress states but the success/failure of individual uploads is not aggregated into a final gate before event publication. Partial uploads are treated as success because "some photos made it."

**How to avoid:**
- Do not publish the Nostr event until ALL photo uploads report success (200 response with a valid blob descriptor including the SHA-256 hash).
- Validate that the SHA-256 the Blossom server returns in its response matches the locally computed hash of the encrypted blob — this catches corrupted or modified uploads.
- Implement per-photo retry logic (2-3 attempts with backoff) before treating an upload as failed.
- If any photo upload ultimately fails, prevent share link generation and surface a clear error state with a retry option.
- For resilience, support uploading to multiple Blossom servers and include the successful URL for each server in the album metadata.

**Warning signs:**
- Share link generation triggered immediately after the last upload resolves, without checking all results
- No SHA-256 verification of Blossom server response
- Upload errors logged to console only, not surfaced in UI state

**Phase to address:** Upload pipeline and Blossom integration phase.

---

### Pitfall 6: Next.js SSR Causes crypto.subtle / Window Unavailability

**What goes wrong:**
Any component that calls `crypto.getRandomValues()`, `crypto.subtle.importKey()`, or accesses `window` during server-side render (including Next.js App Router's prerender pass) throws `ReferenceError: window is not defined` or `crypto is not defined`. This is particularly insidious because Next.js App Router aggressively prerenders client components on the server.

**Why it happens:**
The Web Crypto API and DOM APIs are browser-only. Next.js explicitly calls out that `crypto.getRandomValues()` in a Client Component without a Suspense boundary will break prerender. All the core logic of this app (key generation, encryption, Nostr event signing) uses these APIs.

**How to avoid:**
- Mark all encryption/key generation modules with `'use client'` and wrap their first render in a `useEffect` — never call crypto APIs at module scope or during render.
- Use `dynamic(() => import('./UploadPanel'), { ssr: false })` for any component that touches the Web Crypto API, Canvas, or Web Workers.
- Add a Suspense boundary around components that use crypto for random values, as Next.js docs prescribe.
- Test with `next build && next start` (not just `next dev`) because dev mode is more permissive about SSR failures.

**Warning signs:**
- `crypto.subtle` or `crypto.getRandomValues()` called at module top level or in component body outside `useEffect`
- No `{ ssr: false }` dynamic import for upload/processing components
- CI only runs `next dev`, not `next build`

**Phase to address:** Project foundation / Next.js setup phase. Establish the SSR boundary pattern before any crypto code is written.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single hardcoded relay list | Simpler initial setup | Users without access to those relays can't publish or retrieve; relays go down | Never — make configurable from day 1, even if defaults are provided |
| Single hardcoded Blossom server | Simpler upload code | Single point of failure; server policy changes break all old links | Never — configurable with defaults |
| `toDataURL()` instead of `toBlob()` | One fewer async callback | Double memory usage per image; breaks at large canvas sizes | Never for batch processing |
| Process all images before any upload | Simpler sequential logic | Memory exhaustion with large batches | Never at 200-photo scale |
| Skip SHA-256 verification of Blossom response | Simpler upload logic | Cannot detect corrupted or man-in-the-middle'd uploads | Never — this is a security property |
| Inline IV in album metadata JSON as array index | Simpler metadata structure | Brittle: any reordering corrupts decryption | Never — store IV alongside each ciphertext |
| Treat NIP-40 expiration as deletion | Simpler UX copy | Misleads users about privacy guarantees | Never — only describe it as "expires from most relays" |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Blossom upload | Not sending `Authorization: Nostr <base64-kind-24242-event>` header — many servers require it | Generate a kind 24242 ephemeral auth event with `t: upload` tag and the blob's SHA-256 in an `x` tag; include NIP-40 expiry on the auth event itself |
| Blossom upload | Computing SHA-256 of the plaintext file, not the encrypted blob | SHA-256 must be computed over the exact bytes that will be sent in the request body (the AES-GCM ciphertext) |
| Blossom CORS | Assuming all Blossom servers have correct CORS headers | Many self-hosted Blossom servers lack `Access-Control-Allow-Origin: *` — test against your default server list before shipping; surface a clear error when CORS blocks an upload |
| Nostr relay publish | Publishing event and assuming it succeeded | WebSocket relay responses include an `OK` message with success/failure; wait for and validate it before treating publish as confirmed |
| Nostr relay publish | Publishing to relays that don't support NIP-40, then expecting expiry | Check `supported_nips` in NIP-11 relay metadata; skip or warn for relays that lack NIP-40 |
| Web Worker crypto | Passing `CryptoKey` objects across the Worker message boundary | `CryptoKey` objects are not transferable/cloneable; either re-import the raw key material in the worker or use `exportKey` + `importKey` inside the worker |
| Nostr event signing | Signing events on the main thread with large payloads | The secp256k1 Schnorr signing is fast but JSON serialization of large metadata events with many photo entries can block the main thread; sign in a Worker |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all 200 File objects into memory before processing | Tab freezes or crashes during "processing" phase | Concurrency-limited pipeline: process one (or a few) at a time, release after upload | ~20+ high-res photos |
| Drawing oversized source images to canvas at full resolution before downscaling | Excessive canvas memory; potential `createImageBitmap` rejection | Downscale via `createImageBitmap(file, { resizeWidth, resizeHeight })` before Canvas draw to avoid allocating the full-res bitmap | Source images > ~4000px on either axis |
| Generating thumbnails synchronously on main thread | UI freezes during thumbnail generation | Offload thumbnail generation to Web Worker alongside full-size processing | 10+ photos |
| Fetching and decrypting all 200 photos eagerly on viewer load | Viewer takes 30+ seconds to become interactive | Lazy-load: render thumbnail grid first, only decrypt and load full-size image when user opens lightbox | Any album with more than ~10 photos |
| Creating a new WebSocket connection to each relay per operation | Connection overhead compounds; connections may be rate-limited | Reuse a connection pool across publish and subscribe operations within a single session | Any multi-relay configuration |
| Not revoking blob URLs after canvas processing | Gradual memory growth throughout a 200-photo batch | Call `URL.revokeObjectURL()` immediately after the blob is no longer needed | ~50+ photos processed |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging decryption key or raw AES key material to console | Key exposed in DevTools, error reporting services (Sentry, etc.) | Never log key material; sanitize error objects before sending to any analytics or error tracking service |
| Storing the AES key in localStorage or sessionStorage | Key survives session, accessible to XSS | Key lives only in memory (derived from URL fragment); never write it to any persistent store |
| Generating the album share URL with key in query parameter (`?key=`) instead of fragment (`#key=`) | Server receives key in request logs, CDN logs, Referer headers | Always use `#fragment` — the fragment is never sent to the server by the browser |
| Not stripping EXIF before Canvas draw | GPS coordinates remain in re-exported WebP if using certain libraries | Strip EXIF from the raw file bytes before drawing to Canvas, or parse and zero-out GPS/timestamp tags using a library like `exifr`; then draw cleaned bytes to Canvas |
| Trusting MIME type from `File.type` for security decisions | `File.type` is set by the OS/browser and can be spoofed | Use magic byte inspection (first 4-12 bytes of the file) in addition to MIME type for any security-relevant format check |
| No `Referrer-Policy: no-referrer` header | Fragment may not leak in Referer, but other metadata does; defense-in-depth | Set `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff` in Next.js response headers config |
| Using the same ephemeral keypair across multiple album publish operations | Links multiple albums to the same pseudonymous identity on-chain | Generate a fresh keypair per album publish; discard immediately after signing |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No per-photo upload status during a 200-photo batch | User has no feedback for a 2-5 minute operation; thinks it's frozen | Show a progress bar with per-photo status: "processing", "uploading", "done", "failed" — update in real time from Worker messages |
| Share link shown before all uploads and relay publish are confirmed | User shares a broken link; recipient sees missing images | Only generate and display the share link after all uploads succeed AND the Nostr event publish is confirmed with an OK response |
| Silent failure for unsupported file types (HEIC, RAW, TIFF) | Photo appears in the list, shows "done", but is a blank image in the album | Detect unsupported formats immediately on file drop; show a clear rejection message per file, with guidance ("iPhone HEIC photos: enable 'Most Compatible' in Camera Settings") |
| No way to retry individual failed photos | User must restart the entire 200-photo batch if 2 fail | Track per-photo state; surface a "retry failed" button that re-processes and re-uploads only the failed subset |
| Viewer requires knowing which relays the event was published to | Recipient opens share link, viewer queries default relays, finds nothing | Encode relay hints directly in the share URL alongside the key fragment; viewer tries hint relays first before falling back to defaults |
| Album download ("download all") implemented as sequential single-file saves | Browser blocks repeated download dialogs; download triggers one at a time | Decrypt all images client-side, zip them with JSZip or a streaming zip library, trigger a single `.zip` download |

---

## "Looks Done But Isn't" Checklist

- [ ] **Encryption pipeline:** Verify each photo's IV is freshly generated from `crypto.getRandomValues()` inside the per-photo loop, not outside it. Check that IV bytes are unique across the batch.
- [ ] **EXIF stripping:** Verify GPS and timestamp tags are absent from the output WebP, not just absent from the source metadata object. Use `exifr` to read the output blob and confirm zeroed fields.
- [ ] **Blossom upload:** Verify that the SHA-256 hash the server returns in its response matches the locally computed hash of the encrypted blob — not just that the HTTP status was 2xx.
- [ ] **Nostr publish:** Verify that the relay responded with an `OK` message (not just that the WebSocket send completed without throwing).
- [ ] **Share link:** Verify the key is in the URL `#fragment`, not `?queryParam`, in the actual generated URL string.
- [ ] **Expiration:** Verify the Nostr event includes a `["expiration", "<unix_timestamp>"]` tag and that the Blossom upload includes the expiration header — not just that the code path exists.
- [ ] **NIP-40 relay filter:** Verify that relays without NIP-40 in `supported_nips` are either skipped or warned about — test against a relay that lacks NIP-40 support.
- [ ] **Memory cleanup:** Run a 200-photo batch in Chrome DevTools Memory profiler and verify heap does not grow unboundedly; look for detached canvas nodes and unreleased blob URLs.
- [ ] **HEIC handling:** Test with an actual HEIC file from an iPhone camera roll — not a JPEG renamed to `.heic`.
- [ ] **SSR build:** Run `next build` (not `next dev`) and verify there are no `window is not defined` or `crypto is not defined` errors in the build output.
- [ ] **Viewer lazy-load:** Open a 200-photo album and verify the network tab shows only thumbnails loading initially, not all 200 full-size encrypted blobs.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| IV reuse discovered after launch | HIGH | Invalidate all existing albums (they cannot be safely decrypted without risk); force re-upload with corrected pipeline; publish security advisory |
| EXIF not stripped (GPS in outputs) | HIGH | Re-process all affected photos client-side and re-upload; existing share links remain active but point to location-tagged images |
| Blossom upload corruption (SHA-256 mismatch ignored) | MEDIUM | Add hash verification; user must re-create affected albums |
| Memory crash discovered in production | MEDIUM | Patch concurrency limit; existing albums unaffected; users must retry failed batches |
| NIP-40 expiry not on published events | LOW | Republish events with expiry tag; old events without expiry persist (not a security issue since content is encrypted) |
| Relay publish not confirmed before share link shown | LOW | Add OK-confirmation gate; existing broken links cannot be repaired but rate should be low |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| NIP-40 is not deletion (security model) | Phase 1: Foundation & security model documentation | Confirm UI copy never says "deleted"; confirm code comments describe NIP-40 as hint only |
| IV reuse across batch | Phase 2: Client-side crypto pipeline | Unit test: encrypt 200 dummy blobs, assert all IVs are unique |
| Browser memory exhaustion | Phase 2: Client-side image processing (Web Worker pipeline design) | Load test: 200 real 12 MP photos; monitor DevTools Memory heap |
| HEIC/HEIF unsupported format | Phase 2: Client-side image processing | Integration test: upload real HEIC file; verify error surfaced or conversion succeeded |
| Next.js SSR / crypto unavailability | Phase 1: Project setup & Next.js App Router configuration | `next build` produces no SSR errors; processing components use `{ ssr: false }` |
| Blossom upload partial failure | Phase 3: Upload pipeline & Blossom integration | Test: simulate one failing upload mid-batch; verify share link not generated |
| SHA-256 mismatch not verified | Phase 3: Upload pipeline & Blossom integration | Unit test: mock Blossom server returning wrong hash; verify upload rejected |
| Relay publish not confirmed | Phase 3: Nostr relay integration | Integration test: mock relay returning `OK: false`; verify publish retried or failed gracefully |
| CORS blocking Blossom uploads | Phase 3: Default server selection & testing | Test against all default Blossom servers from a browser context (not Node); verify CORS headers present |
| Share link key in query param (not fragment) | Phase 4: Share link generation | Automated assertion: parse generated URL, confirm `hash` property is non-empty, `search` property has no key |
| Viewer loading all 200 photos eagerly | Phase 4: Viewer implementation | Performance test: open 200-photo album; verify only thumbnail requests fire initially |
| Download all as separate files | Phase 4: Viewer download feature | Manual test: trigger download all; verify single `.zip` file produced |

---

## Sources

- [NIP-40 Expiration Timestamp spec](https://nips.nostr.com/40) — explicitly states relays MAY persist expired events indefinitely
- [Blossom BUD-01 blob retrieval spec](https://github.com/hzrd149/blossom/blob/master/buds/01.md) — cross-origin header requirements
- [Blossom BUD-02 upload spec](https://github.com/hzrd149/blossom/blob/master/buds/02.md) — SHA-256 hash must be over exact received bytes, no modification
- [SubtleCrypto encrypt() MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) — IV must be unique per encryption operation with a given key
- [HTMLCanvasElement toBlob() MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) — prefer over toDataURL for memory efficiency
- [Next.js crypto in client components](https://nextjs.org/docs/messages/next-prerender-crypto-client) — Suspense boundary requirement for crypto in prerender
- [Safely process images without memory overflows](https://trailheadtechnology.com/safely-process-images-in-the-browser-without-memory-overflows/) — batching and pipeline design
- [HEIC rendering on the web (DEV Community)](https://dev.to/upsidelab/rendering-heic-on-the-web-how-to-make-your-web-app-handle-iphone-photos-pj1) — zero browser support for HEIC decode
- [heic2any library](https://alexcorvi.github.io/heic2any/) — client-side HEIC-to-JPEG conversion
- [AES-GCM developer guide (Medium)](https://medium.com/@thomas_40553/how-to-secure-encrypt-and-decrypt-data-within-the-browser-with-aes-gcm-and-pbkdf2-057b839c96b6) — IV reuse catastrophe
- [NIP-11 relay information document](https://nips.nostr.com/11) — `max_message_length` and `supported_nips` fields
- [Cross-domain Referer leakage (PortSwigger)](https://portswigger.net/kb/issues/00500400_cross-domain-referer-leakage) — fragment vs query param security
- Canvas area limit: width × height > 16,777,216 causes toBlob/toDataURL to return empty — [JavaScript-Load-Image issue #133](https://github.com/blueimp/JavaScript-Load-Image/issues/133)
- [Blossom Nostrify uploader docs](https://nostrify.dev/upload/blossom) — authorization header format reference

---
*Pitfalls research for: Encrypted ephemeral photo sharing over Nostr + Blossom*
*Researched: 2026-03-19*
