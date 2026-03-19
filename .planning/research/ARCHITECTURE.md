# Architecture Research

**Domain:** Encrypted ephemeral photo sharing — Nostr + Blossom, client-side-only
**Researched:** 2026-03-19
**Confidence:** HIGH (protocol specs verified via official sources; implementation patterns verified via recent articles and library docs)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js Client)                       │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                      UI Layer (React)                          │   │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐│   │
│  │  │  UploadPage  │  │   SharePage   │  │     ViewerPage       ││   │
│  │  │  (drop zone, │  │  (share link  │  │  (gallery lightbox)  ││   │
│  │  │  progress UI)│  │   display)    │  │                      ││   │
│  │  └──────┬───────┘  └───────────────┘  └──────────┬───────────┘│   │
│  └─────────┼──────────────────────────────────────── ┼────────────┘   │
│            │                                          │               │
│  ┌─────────▼──────────────────────────────────────── ▼────────────┐   │
│  │                    Service / Hook Layer                         │   │
│  │  ┌────────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────┐ │   │
│  │  │  useUpload │  │ useAlbumKey  │  │ useRelay  │  │useViewer│ │   │
│  │  │  (orchestr)│  │ (key derive/ │  │ (publish/ │  │(fetch/  │ │   │
│  │  │            │  │  encode URL) │  │ subscribe)│  │ decrypt)│ │   │
│  │  └─────┬──────┘  └──────────────┘  └─────┬─────┘  └────┬────┘ │   │
│  └────────┼──────────────────────────────────┼─────────────┼───────┘  │
│           │                                   │             │          │
│  ┌────────▼──────────────┐  ┌────────────────▼─────────────▼───────┐  │
│  │   Web Worker Thread   │  │        Crypto Module (main thread)    │  │
│  │  ┌─────────────────┐  │  │  (SubtleCrypto / WebCrypto API)       │  │
│  │  │  ImageProcessor │  │  │  - generateKey (AES-256-GCM)          │  │
│  │  │  - EXIF strip   │  │  │  - encrypt(blob, key, iv)             │  │
│  │  │  - resize/crop  │  │  │  - decrypt(ciphertext, key, iv)       │  │
│  │  │  - WebP convert │  │  │  - exportKey / importKey              │  │
│  │  │  - thumb gen    │  │  └───────────────────────────────────────┘  │
│  │  └─────────────────┘  │                                              │
│  └───────────────────────┘                                              │
└──────────────────────────────────────────────────────────────────────┘
            │                          │
            ▼                          ▼
┌───────────────────┐      ┌──────────────────────┐
│  Blossom Server   │      │    Nostr Relays        │
│  (BUD-01/02/04)   │      │  (WebSocket, NIP-40)   │
│  PUT /upload      │      │  kind 30078 event      │
│  GET /<sha256>    │      │  expiration tag        │
│  1-month TTL hint │      │  1-month expiry        │
└───────────────────┘      └──────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `UploadPage` | Drag-drop UI, progress display, triggers upload orchestration | `useUpload`, `SharePage` after completion |
| `ViewerPage` | Gallery grid, lightbox slideshow, download trigger | `useViewer` hook |
| `SharePage` | Renders generated share URL with fragment key | Receives data from `useUpload` |
| `useUpload` | Orchestrates the full uploader flow: dispatch to worker, encrypt blobs, upload to Blossom, publish Nostr event, build URL | `ImageProcessor` (worker), `CryptoModule`, `BlossomClient`, `NostrClient` |
| `useViewer` | Orchestrates viewer flow: parse URL, fetch Nostr event, decrypt metadata, fetch + decrypt blobs | `CryptoModule`, `BlossomClient`, `NostrClient` |
| `useAlbumKey` | Generates or parses the AES key embedded in the URL fragment | `CryptoModule` |
| `ImageProcessor` (Web Worker) | CPU-bound: EXIF strip, resize, WebP convert, thumbnail generation — runs off main thread | Comlink RPC to main thread |
| `CryptoModule` | AES-256-GCM encrypt/decrypt using WebCrypto `SubtleCrypto` API | Called by `useUpload`, `useViewer` |
| `BlossomClient` | HTTP PUT /upload and GET /<sha256> against configurable Blossom servers; signs auth via NIP-98-style kind 24242 events | Blossom servers over HTTPS |
| `NostrClient` | WebSocket connection pool to relays; signs + publishes kind 30078 events; fetches events by address; handles reconnection | Nostr relays over WSS |
| `KeypairManager` | Generates an ephemeral secp256k1 keypair per upload session; never persisted | `NostrClient`, `BlossomClient` (both need signing) |

## Recommended Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Upload page (UploadPage)
│   ├── view/[naddr]/page.tsx     # Viewer page (ViewerPage)
│   └── layout.tsx
├── components/
│   ├── upload/
│   │   ├── DropZone.tsx          # Drag-drop area
│   │   ├── ProgressList.tsx      # Per-photo status list
│   │   └── ShareCard.tsx         # Post-upload share link display
│   └── viewer/
│       ├── Gallery.tsx           # Thumbnail grid
│       └── Lightbox.tsx          # Full-screen lightbox + swipe
├── hooks/
│   ├── useUpload.ts              # Upload orchestration hook
│   ├── useViewer.ts              # Viewer orchestration hook
│   └── useAlbumKey.ts            # Key generation + URL fragment encoding
├── lib/
│   ├── crypto.ts                 # WebCrypto AES-256-GCM wrappers
│   ├── nostr/
│   │   ├── client.ts             # Relay pool, publish, fetch
│   │   ├── keypair.ts            # Ephemeral keypair generation
│   │   └── event.ts              # Kind 30078 event builders
│   ├── blossom/
│   │   ├── client.ts             # HTTP upload/fetch, auth signing
│   │   └── types.ts              # BUD response types, NIP-94 tags
│   └── config.ts                 # Default relay + Blossom server lists
├── workers/
│   └── image-processor.worker.ts # Web Worker: EXIF strip, resize, WebP, thumb
└── types/
    ├── album.ts                  # AlbumMetadata, PhotoEntry types
    └── blossom.ts                # Blossom blob descriptor types
```

### Structure Rationale

- **`workers/`:** Isolated from `lib/` because Web Workers cannot import Node.js APIs; keeping them separate avoids accidental SSR-incompatible code paths.
- **`lib/nostr/` and `lib/blossom/`:** Protocol clients separated by concern — they have distinct auth models and transport layers.
- **`lib/crypto.ts`:** Single module wrapping `window.crypto.subtle` so all encryption/decryption is centralized and testable.
- **`hooks/`:** Orchestration logic lives in hooks, not components, to enable easier testing and future extraction.
- **`app/view/[naddr]/`:** The viewer route uses the Nostr `naddr` (addressable reference) as the path segment, with the AES key in the URL fragment.

## Architectural Patterns

### Pattern 1: URL Fragment as Out-of-Band Key Transport

**What:** The AES-256-GCM key is base64url-encoded and placed in the URL `#fragment` (hash). The relay hint is encoded in the path or query string. The fragment is never sent to any server by the browser.

**When to use:** Any time a decryption key must be shared via a URL without the server learning the key. Used by Enclosed, hardbin, and similar zero-knowledge sharing tools.

**Trade-offs:** The server never sees the key (good for privacy). The key is visible in the browser's address bar and can appear in browser history. HTTPS prevents network interception. Anyone who receives the full URL can decrypt.

**Example:**
```
https://yourapp.com/view/naddr1...?relays=wss%3A%2F%2Frelay.example.com#base64url-aes-key-here
```

```typescript
// Generate key, encode for URL fragment
async function buildShareURL(key: CryptoKey, naddr: string, relays: string[]): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  const fragment = btoa(String.fromCharCode(...new Uint8Array(raw)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const relayParam = relays.map(r => `relay=${encodeURIComponent(r)}`).join("&");
  return `${window.location.origin}/view/${naddr}?${relayParam}#${fragment}`;
}

// Parse key from URL fragment on viewer side
async function keyFromFragment(fragment: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(fragment.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}
```

### Pattern 2: Web Worker Image Pipeline via Comlink

**What:** CPU-bound image processing (EXIF strip, resize, WebP conversion, thumbnail generation) runs in a Web Worker thread using Comlink for ergonomic RPC instead of raw `postMessage`.

**When to use:** Any time you process >1 image or images >1 MB; without this the UI freezes, especially for 200-photo batches.

**Trade-offs:** Workers cannot use DOM APIs or `window.crypto` (use `self.crypto` instead). Comlink adds a small overhead per call but eliminates `postMessage` boilerplate. Structured clone algorithm handles ArrayBuffer transfer efficiently.

**Example:**
```typescript
// workers/image-processor.worker.ts
import * as Comlink from "comlink";

const api = {
  async processImage(file: File): Promise<{ full: ArrayBuffer; thumb: ArrayBuffer }> {
    const bitmap = await createImageBitmap(file);
    // draw to OffscreenCanvas, strip EXIF via re-encode, resize, convert to WebP
    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const fullBlob = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
    // ... generate thumbnail similarly
    return { full: await fullBlob.arrayBuffer(), thumb: await thumbBlob.arrayBuffer() };
  }
};
Comlink.expose(api);

// In React component (useEffect, "use client"):
const worker = new Worker(new URL("@/workers/image-processor.worker.ts", import.meta.url), { type: "module" });
const processor = Comlink.wrap<typeof api>(worker);
const { full, thumb } = await processor.processImage(file);
```

### Pattern 3: Encrypted Album Metadata as kind 30078 Nostr Event

**What:** A single Nostr kind 30078 event holds the album manifest (photo list with per-photo encrypted blob SHA256 hashes and per-photo IVs). The event `content` is itself AES-256-GCM encrypted with the album key; only the fragment-key holder can decrypt the manifest to know which blobs to fetch.

**When to use:** Required for this use case — the manifest must be on a decentralized, expiring relay store, and the content must be opaque to relay operators.

**Trade-offs:** Relay operators see event size and creation time but not content. NIP-40 expiration tag is honored by compliant relays but is advisory — non-compliant relays may retain events longer. The `d` tag is publicly visible (use a random UUID to avoid leaking structure).

**Event structure:**
```typescript
// Plaintext manifest (encrypted before publishing)
interface AlbumManifest {
  title?: string;
  photos: Array<{
    sha256: string;    // SHA256 of the encrypted blob (Blossom address)
    thumbSha256: string;
    iv: string;        // base64 IV used when encrypting this specific blob
    width: number;
    height: number;
  }>;
  servers: string[];   // Blossom server URLs where blobs were uploaded
}

// Encrypted event structure
const event = {
  kind: 30078,
  content: encryptedManifestBase64,  // AES-256-GCM of JSON.stringify(manifest)
  tags: [
    ["d", randomUUID()],
    ["expiration", String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)],  // NIP-40
    ["alt", "Encrypted photo album"],
  ],
  // pubkey: ephemeral, created_at, id, sig — standard Nostr event fields
};
```

## Data Flow

### Uploader Flow

```
[User drops N photos]
        │
        ▼
[useUpload hook]
        │
        ├──► [KeypairManager] → generate ephemeral secp256k1 keypair (nsec/npub)
        │
        ├──► [useAlbumKey] → generate random 256-bit AES-GCM key
        │
        │    For each photo (batched, concurrency-limited):
        │
        ├──► [ImageProcessor Worker via Comlink]
        │         EXIF strip + resize + WebP convert + thumb
        │         Returns: { fullBuffer: ArrayBuffer, thumbBuffer: ArrayBuffer }
        │
        ├──► [CryptoModule]
        │         generateIV() → 12-byte random IV per image
        │         encrypt(fullBuffer, albumKey, iv) → encryptedFull
        │         encrypt(thumbBuffer, albumKey, thumbIV) → encryptedThumb
        │
        ├──► [BlossomClient]
        │         sha256(encryptedFull) → hash
        │         PUT /upload (encryptedFull, auth signed with ephemeral key)
        │         PUT /upload (encryptedThumb, auth signed with ephemeral key)
        │         Receive blob descriptors (sha256, url, mime)
        │
        │    Build AlbumManifest with all sha256 hashes + IVs
        │
        ├──► [CryptoModule]
        │         encrypt(JSON.stringify(manifest), albumKey, manifestIV) → encryptedManifest
        │
        ├──► [NostrClient]
        │         Build kind 30078 event (content = encryptedManifest, NIP-40 expiry)
        │         Sign with ephemeral keypair
        │         Publish to relay pool
        │         Receive event ID → encode as naddr
        │
        ▼
[buildShareURL(albumKey, naddr, relays)] → share URL with #fragment key
[UploadPage] → show ShareCard with copy button
```

### Viewer Flow

```
[User opens share URL: /view/naddr1...?relay=wss://...#base64key]
        │
        ▼
[ViewerPage] — "use client"
        │
        ├──► [useAlbumKey] — parse #fragment, importKey → CryptoKey
        │
        ├──► [NostrClient]
        │         connect to relays (from query params + defaults)
        │         REQ for kind 30078 event by naddr (pubkey + d-tag)
        │         Receive signed event
        │
        ├──► [CryptoModule]
        │         decrypt(event.content, albumKey, manifestIV) → manifest JSON
        │         Parse AlbumManifest
        │
        │    For each photo (lazy / viewport-triggered):
        │
        ├──► [BlossomClient]
        │         GET /<sha256> from servers listed in manifest
        │         Receive encrypted blob ArrayBuffer
        │
        ├──► [CryptoModule]
        │         decrypt(encryptedBlob, albumKey, photo.iv) → plainBlob
        │         createObjectURL(new Blob([plainBlob], {type: "image/webp"}))
        │
        ▼
[Gallery.tsx] renders decrypted thumbnail grid
[Lightbox.tsx] on click → fetch + decrypt full-res on demand
```

### State Management

This app has no server-side state. All state is ephemeral browser state:

```
Upload session state (in-memory, useUpload hook):
  - photos[]: { file, status, progress, sha256, encryptedBlob }
  - albumKey: CryptoKey (never serialized)
  - keypair: { privkey, pubkey } (dropped after publish)
  - shareURL: string | null

Viewer state (in-memory, useViewer hook):
  - albumKey: CryptoKey (from URL fragment)
  - manifest: AlbumManifest | null
  - photos[]: { sha256, status, objectURL | null }
```

No localStorage, no IndexedDB, no server-side session. Refresh loses upload session (intentional).

## Integration Points

### External Services

| Service | Integration Pattern | Auth | Notes |
|---------|---------------------|------|-------|
| Blossom servers | HTTP REST (PUT, GET, DELETE) | NIP-98-style kind 24242 auth event in `Authorization` header (base64) | Multiple servers for redundancy; try all on upload, try in order on fetch |
| Nostr relays | WebSocket (NIP-01 protocol: EVENT, REQ, CLOSE) | Schnorr signature on event | Use nostr-tools SimplePool or NDK for multi-relay management |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Main thread ↔ Web Worker | Comlink RPC over postMessage; ArrayBuffer transferred (zero-copy) | Worker cannot access `window` — use `self.crypto` for any crypto in worker |
| `useUpload` ↔ `BlossomClient` | Direct async function calls; returns blob descriptors | Client is a plain module, not a React hook |
| `useUpload` ↔ `NostrClient` | Direct async function calls; publish/await receipt | NostrClient manages WebSocket lifecycle internally |
| `CryptoModule` ↔ all callers | Async functions returning `ArrayBuffer` or `CryptoKey` | Never passes raw key material as string — always `CryptoKey` object or `ArrayBuffer` |

## Anti-Patterns

### Anti-Pattern 1: Processing Images on the Main Thread

**What people do:** Call Canvas API resize/convert synchronously in the component or event handler.
**Why it's wrong:** For 200 photos, this blocks the UI for tens of seconds. The browser tab becomes unresponsive. Progress UI cannot update.
**Do this instead:** Dispatch all CPU-bound work to a Web Worker via Comlink. The main thread only handles UI updates triggered by worker messages.

### Anti-Pattern 2: Storing the AES Key in URL Query Params or the Event

**What people do:** Put the decryption key in `?key=...` or inside the Nostr event tags.
**Why it's wrong:** Query params are sent to servers in HTTP request logs; tags are public on relays. Either approach leaks the key.
**Do this instead:** Encode the key exclusively in the `#fragment` (hash). The fragment is not transmitted by the browser to any server.

### Anti-Pattern 3: Single IV Reused Across All Photos

**What people do:** Generate one IV for the album key and reuse it for every encrypted blob.
**Why it's wrong:** AES-GCM IV reuse with the same key is catastrophic — it allows an attacker who obtains two ciphertexts to recover the keystream, breaking confidentiality.
**Do this instead:** Generate a fresh 12-byte random IV for every encrypt operation (per-photo full image, per-photo thumbnail, and manifest). Store each IV alongside its ciphertext in the manifest.

### Anti-Pattern 4: Fetching and Decrypting All Photos Up Front

**What people do:** On viewer load, immediately fetch and decrypt all 200 encrypted blobs in parallel.
**Why it's wrong:** 200 × ~2 MB = ~400 MB of encrypted data transferred and decrypted immediately. Slow first paint, heavy memory usage, possible OOM on mobile.
**Do this instead:** Lazy-load: decrypt thumbnails for the grid on load, decrypt full-res blobs only when the user opens a specific photo in the lightbox. Use `IntersectionObserver` for thumbnail lazy loading.

### Anti-Pattern 5: Persisting the Ephemeral Keypair

**What people do:** Save the generated `nsec` in localStorage so the user can "manage" the album later.
**Why it's wrong:** Breaks the ephemeral / no-account model. If localStorage is compromised (XSS), the keypair leaks. The uploader cannot delete blobs once the link is shared anyway (no incentive to keep the key).
**Do this instead:** Treat the keypair as a one-time signing credential. Drop it from memory after the event is published. The NIP-40 expiry handles cleanup.

## Scaling Considerations

This is a purely client-side app with no backend. "Scaling" means relay and Blossom server capacity, not application servers.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k albums/day | Single default Blossom server + 2-3 relays is fine. Library defaults cover this. |
| 1k-100k albums/day | Users should configure their own Blossom servers. Official public servers may rate-limit. Consider recommending self-hosted Blossom (e.g., blossom-server, satellite-cdn). |
| 100k+ albums/day | Outside scope — public Blossom servers are the bottleneck, not the app. App itself has no backend to scale. |

### Scaling Priorities

1. **First bottleneck:** Blossom server rate limits / storage quotas — users should configure their own servers; the app must surface useful error messages when upload is rejected.
2. **Second bottleneck:** Client memory for 200-photo batch — must process photos in batches of ~5-10 rather than all at once; concurrency limit in the upload orchestrator is essential.

## Build Order Implications

The component dependency graph implies this build order:

1. **`lib/crypto.ts`** — No dependencies. All other modules depend on it.
2. **`workers/image-processor.worker.ts`** — Depends on Canvas/OffscreenCanvas APIs only.
3. **`lib/nostr/keypair.ts` + `lib/nostr/event.ts`** — Pure functions, no external deps beyond nostr-tools.
4. **`lib/blossom/client.ts`** — Depends on keypair for auth signing.
5. **`lib/nostr/client.ts`** — Depends on keypair + event builders.
6. **`hooks/useAlbumKey.ts`** — Depends on crypto.ts.
7. **`hooks/useUpload.ts`** — Depends on all lib/* and worker.
8. **`hooks/useViewer.ts`** — Depends on crypto.ts, blossom client, nostr client.
9. **UI components** — Depend on hooks only.

## Sources

- Blossom protocol BUD specifications: [hzrd149/blossom on GitHub](https://github.com/hzrd149/blossom)
- Blossom NIP-B7 integration spec: [nips.nostr.com/B7](https://nips.nostr.com/B7)
- Nostrify BlossomUploader: [nostrify.dev/upload/blossom](https://nostrify.dev/upload/blossom)
- NIP-78 (kind 30078): [nostr-protocol/nips/78.md](https://github.com/nostr-protocol/nips/blob/master/78.md)
- NIP-40 expiration: [nostr-protocol/nips](https://github.com/nostr-protocol/nips)
- URL fragment as key transport (Enclosed): [docs.enclosed.cc/how-it-works](https://docs.enclosed.cc/how-it-works)
- Web Workers + Comlink in Next.js 15: [park.is/blog_posts/20250417_nextjs_comlink_examples](https://park.is/blog_posts/20250417_nextjs_comlink_examples/)
- WebCrypto AES-GCM: [MDN SubtleCrypto encrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
- WebCrypto AES-GCM IV requirements: [MDN AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- NDK React + Next.js integration: [ndk-react-demo.vercel.app](https://ndk-react-demo.vercel.app/)

---
*Architecture research for: Nostr + Blossom encrypted ephemeral photo sharing*
*Researched: 2026-03-19*
