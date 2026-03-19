# Phase 3: Upload and Publishing - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Encrypt processed images with AES-256-GCM, upload encrypted blobs to configurable Blossom server(s), publish encrypted album manifest as Nostr kind 30078 event with NIP-40 expiration, generate share link with naddr + key in URL fragment, and provide a settings panel for relay/Blossom server configuration. Upload progress UI extends Phase 2's Zustand store with encrypting/uploading states.

</domain>

<decisions>
## Implementation Decisions

### Upload Flow & Progress
- Encryption happens after all photos are processed — keeps processing and upload as distinct phases
- Per-photo state progression: processing → encrypting → uploading → done (extends existing Zustand store)
- On upload failure for a single photo: retry 3x with exponential backoff, then mark as error
- User can retry individual failed photos
- Share link auto-copies to clipboard when generated

### Settings Panel
- Collapsible section below the drop zone — always accessible, not a separate page
- Settings persist in localStorage — survives page reload, no server needed
- Default relay list: wss://relay.nostu.be, wss://relay.damus.io, wss://nos.lol
- Default Blossom server: https://24242.io (60-day retention)
- Blossom server validated on save (HEAD request to confirm CORS and availability)

### Share Link Generation
- Optional album title text field shown after upload completes, before share link is displayed
- "Publishing to Nostr..." spinner shown after all uploads complete (brief step)
- Share link displayed as large copyable text + copy button
- Share link only shown after ALL uploads succeed AND relay confirms event

### Prior Locked Decisions (from Phase 1)
- AES-256-GCM with single key per album, fresh IV per blob
- naddr format for share URL: `https://photoshare.app/naddr1...#<base64url-secret>`
- Kind 30078 event with NIP-40 expiration tag, d-tag as album UUID
- Manifest IV stored as event tag `["iv", "<base64url>"]`
- applesauce ecosystem: EventFactory + PrivateKeySigner + RelayPool
- Blossom expiration header requesting ~60-day retention

### Claude's Discretion
- Blossom upload implementation details (blossom-client-sdk vs raw fetch)
- SHA-256 hashing approach (Web Crypto vs library)
- Upload concurrency (sequential vs parallel blob uploads)
- Settings panel UI component design
- Error recovery UX details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Code (integration points)
- `src/lib/crypto.ts` — `encryptBlob()`, `generateAlbumKey()`, `exportKeyToBase64url()`, `uint8ArrayToBase64url()`
- `src/lib/nostr/signer.ts` — `createEphemeralSigner()`, `getSignerPubkey()` using PrivateKeySigner
- `src/lib/nostr/naddr.ts` — `encodeAlbumNaddr()` for share link
- `src/lib/config.ts` — `DEFAULT_RELAYS`, `DEFAULT_BLOSSOM_SERVER`, `ALBUM_EXPIRY_SECONDS`, `BLOSSOM_EXPIRY_SECONDS`
- `src/types/album.ts` — `AlbumManifest`, `PhotoEntry`

### Phase 2 Code (processing output)
- `src/types/processing.ts` — `ProcessedPhoto` (the input to this phase's encrypt+upload)
- `src/store/processingStore.ts` — Zustand store to extend with upload states
- `src/hooks/useImageProcessor.ts` — processing hook, model for upload hook

### Protocols
- BUD-02 — Blossom blob upload endpoint, auth header, SHA-256 verification
- BUD-04 — Blossom expiration hint headers
- NIP-78 — Kind 30078 application-specific data
- NIP-40 — Event expiration tag
- NIP-19 — naddr encoding

### Research
- `.planning/research/STACK.md` — blossom-client-sdk, applesauce packages
- `.planning/research/ARCHITECTURE.md` — upload flow, data flow diagrams
- `.planning/research/PITFALLS.md` — Blossom CORS, relay publish confirmation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/crypto.ts` — `encryptBlob(data, key)` returns `{ciphertext, iv}`, `generateAlbumKey()`, key export/import
- `src/lib/nostr/signer.ts` — `createEphemeralSigner()` returns PrivateKeySigner
- `src/lib/nostr/naddr.ts` — `encodeAlbumNaddr(identifier, pubkey, relays)`
- `src/lib/config.ts` — all defaults ready
- `src/types/album.ts` — `AlbumManifest`, `PhotoEntry` interfaces ready
- `src/store/processingStore.ts` — Zustand pattern to follow for upload store
- `src/hooks/useImageProcessor.ts` — hook pattern with worker lifecycle

### Established Patterns
- Zustand store with `create<State>((set) => ({...}))` pattern
- `'use client'` + `dynamic(..., { ssr: false })` for browser-only APIs
- Vitest + jsdom for unit testing

### Integration Points
- `ProcessedPhoto` from Phase 2 → encrypt each `.full` and `.thumb` ArrayBuffer
- Build `AlbumManifest` from encrypted blob hashes + IVs + dimensions + filenames
- Encrypt manifest JSON → publish as kind 30078 content
- Generate naddr from event → combine with key → share link

</code_context>

<specifics>
## Specific Ideas

- The upload flow is: encrypt all blobs → upload all to Blossom → build manifest → encrypt manifest → publish Nostr event → generate share link
- Each blob needs SHA-256 hash computed BEFORE upload (Blossom addresses blobs by hash)
- SHA-256 of the encrypted ciphertext (not plaintext) is the Blossom blob address
- The manifest contains per-image `hash` (SHA-256 of encrypted blob) and `iv` (for decryption)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-upload-and-publishing*
*Context gathered: 2026-03-19*
