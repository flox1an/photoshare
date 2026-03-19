# Phase 3: Upload and Publishing - Research

**Researched:** 2026-03-19
**Domain:** Blossom blob upload (BUD-02/BUD-11), Nostr kind 30078 event publishing (applesauce-factory + applesauce-relay), settings persistence, share link generation
**Confidence:** HIGH — all key APIs verified against installed node_modules type definitions and live Blossom spec pages

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Encryption happens after all photos are processed — processing and upload are distinct phases
- Per-photo state progression: processing → encrypting → uploading → done (extends existing Zustand store)
- On upload failure for a single photo: retry 3x with exponential backoff, then mark as error
- User can retry individual failed photos
- Share link auto-copies to clipboard when generated
- Settings panel: collapsible section below drop zone, persists in localStorage, no separate page
- Default relay list: wss://relay.nostu.be, wss://relay.damus.io, wss://nos.lol
- Default Blossom server: https://24242.io (60-day retention)
- Blossom server validated on save (HEAD request to confirm CORS and availability)
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPLD-01 | Encrypted blobs are uploaded to a Blossom server with proper auth headers | BUD-11 auth flow confirmed: kind 24242 signed with PrivateKeySigner, Authorization header format verified |
| UPLD-02 | SHA-256 hash of each upload is verified against server response | BUD-02 response includes `sha256` field; Web Crypto `crypto.subtle.digest("SHA-256")` confirmed for computing hash pre-upload |
| UPLD-03 | Blossom expiration header is sent requesting ~60-day retention | Header is `X-Content-Length` is NOT how expiration works — expiration goes in the kind 24242 auth event's `expiration` tag; 24242.io honors it |
| UPLD-04 | Ephemeral Nostr keypair is generated (no login required) | `createEphemeralSigner()` already exists in src/lib/nostr/signer.ts using PrivateKeySigner |
| UPLD-05 | Encrypted album manifest is published as Nostr kind 30078 event | applesauce-factory `build()` + applesauce-relay `RelayPool.publish()` confirmed; PublishResponse has `ok: boolean` |
| UPLD-06 | NIP-40 expiration tag is set on the Nostr event (~30 days) | `setExpirationTimestamp(timestamp)` operation in applesauce-factory common operations, verified in type definitions |
| UPLD-07 | Upload progress UI shows per-photo status (processing, uploading, done) | Extend existing Zustand processingStore with `encrypting` and `uploading` states; follow useImageProcessor hook pattern |
| UPLD-08 | Share link is generated only after all uploads succeed and relay confirms | RelayPool.publish() returns `Promise<PublishResponse[]>` with `ok: boolean`; gate on all-ok |
| CONF-01 | User can configure Nostr relay list via settings panel | localStorage persistence confirmed; settings hook pattern established |
| CONF-02 | User can configure Blossom server(s) via settings panel | HEAD request validation pattern; localStorage persistence |
</phase_requirements>

---

## Summary

Phase 3 integrates three distinct systems: (1) raw HTTP uploads to Blossom servers with BUD-11 authorization, (2) Nostr kind 30078 event publishing through applesauce-relay's RelayPool with RxJS Observables, and (3) a settings panel with localStorage persistence. The critical discovery is that **blossom-client-sdk is NOT installed** — Blossom upload auth must be implemented manually using the raw BUD-11 spec, or the SDK must be added. The installed applesauce-factory@4.0.0 provides `build()`, `includeSingletonTag()`, `setExpirationTimestamp()`, and `setIdentifier()` operations but has NO built-in kind 24242 builder — the Blossom operations in it only handle kind 10063 server-list events, not upload auth events.

The applesauce-relay@5.1.0 RelayPool uses RxJS Observables throughout. The `publish()` method is Promise-based and returns `Promise<PublishResponse[]>` where each `PublishResponse` has `{ ok: boolean, message?: string, from: string }` — this is the OK-confirmation gate needed for UPLD-08.

24242.io has been empirically verified (curl) to serve `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: Authorization, *` — browser uploads work without CORS issues.

**Primary recommendation:** Implement Blossom auth manually with raw `fetch()` (avoids adding blossom-client-sdk as dependency); use `crypto.subtle.digest("SHA-256", buffer)` for hash computation; use applesauce-factory `build()` to construct kind 24242 auth events; use applesauce-relay RelayPool for Nostr publishing.

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| applesauce-factory | 4.0.0 | Build kind 24242 auth events and kind 30078 manifest events | Provides `build()` with `includeSingletonTag`, `setExpirationTimestamp`, `setIdentifier` |
| applesauce-relay | 5.1.0 | RelayPool for publishing kind 30078 to multiple relays | `publish()` returns `Promise<PublishResponse[]>` with `ok: boolean` for UPLD-08 gate |
| applesauce-signers | 5.1.0 | PrivateKeySigner for signing both kinds of events | Already used in src/lib/nostr/signer.ts |
| nostr-tools | ^2.23.3 | nip19 for naddr encoding (already used in naddr.ts) | Existing integration |
| zustand | 5.0.8 | Extend processingStore with upload states | Already established pattern |
| rxjs | 7.8.2 | Required peer dep of applesauce-relay; imported transitively | Pool observables use rxjs operators |
| Web Crypto API | browser built-in | SHA-256 hashing for Blossom blob addressing | `crypto.subtle.digest("SHA-256", buffer)` — returns ArrayBuffer |

### Not Installed (decision required)

| Library | Version | Purpose | Install? |
|---------|---------|---------|----------|
| blossom-client-sdk | 4.1.0 | Higher-level Blossom upload client | Discretionary — raw fetch is sufficient; avoids dependency; recommended NOT to install |

**Decision (Claude's discretion):** Do NOT add blossom-client-sdk. The raw BUD-11 auth pattern is ~30 lines of code and we already have all the signing primitives. blossom-client-sdk uses `btoa(JSON.stringify(event))` for the Authorization header and appends `"Nostr "` prefix — easy to replicate. The SDK also only accepts `File | Blob | Buffer` types, not `ArrayBuffer`, requiring conversion anyway.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| raw fetch + applesauce | blossom-client-sdk | SDK adds a dependency; its signer type (`async (event) => SignedEvent`) maps to PrivateKeySigner.signEvent, but SDK would require installing and adapting types |
| crypto.subtle.digest | @noble/hashes/sha2 | noble/hashes is already installed (via applesauce-relay's @noble/hashes dep) as a transitive dep; but Web Crypto is simpler and no import needed |

---

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
src/
├── lib/
│   ├── blossom/
│   │   └── upload.ts            # Raw fetch upload + BUD-11 auth event builder
│   └── nostr/
│       └── event.ts             # kind 30078 builder using applesauce-factory
├── hooks/
│   └── useUpload.ts             # Upload orchestration hook (model: useImageProcessor)
├── store/
│   └── uploadStore.ts           # Zustand store extending processing states for upload phases
├── components/
│   └── upload/
│       ├── SettingsPanel.tsx    # Collapsible relay + blossom server config
│       └── ShareCard.tsx        # Post-upload share link display + copy button
└── types/
    └── blossom.ts               # BlobDescriptor type from BUD-02 response
```

### Pattern 1: BUD-11 Blossom Upload Auth (Manual Implementation)

**What:** Build a kind 24242 Nostr event signed with the ephemeral keypair, base64-encode it, and set it as the `Authorization` header on the PUT /upload request.

**Auth event structure (verified against BUD-11 spec):**
```typescript
// src/lib/blossom/upload.ts
// Source: BUD-11 spec (github.com/hzrd149/blossom/blob/master/buds/11.md)
// Source: applesauce-factory/dist/operations/tags.d.ts (includeSingletonTag)
// Source: applesauce-factory/dist/operations/common.d.ts (setExpirationTimestamp)

import { build } from "applesauce-factory/event-factory";
import { includeSingletonTag } from "applesauce-factory/operations";
import { setExpirationTimestamp } from "applesauce-factory/operations";
import type { PrivateKeySigner } from "applesauce-signers";

async function buildUploadAuthEvent(
  signer: PrivateKeySigner,
  blobHex: string,           // SHA-256 hex of the encrypted blob
  expiresInSeconds = 60 * 60 // 1 hour — auth event TTL, not blob TTL
) {
  const context = { signer };
  const template = await build(
    { kind: 24242, content: "Upload blob" },
    context,
    includeSingletonTag(["t", "upload"]),
    includeSingletonTag(["x", blobHex]),
    setExpirationTimestamp(Math.floor(Date.now() / 1000) + expiresInSeconds),
  );
  // Sign the template — factory.build() returns EventTemplate (unsigned)
  return signer.signEvent(template);
}

function encodeAuthHeader(signedEvent: object): string {
  // BUD-11: "Nostr " + btoa(JSON.stringify(event))
  // Note: standard base64 (btoa), NOT base64url
  return "Nostr " + btoa(JSON.stringify(signedEvent));
}
```

**CRITICAL:** The `Authorization` header uses **standard base64** (`btoa`), NOT base64url. This differs from the URL fragment key encoding (which uses base64url). Do not mix them.

### Pattern 2: SHA-256 Hash of Encrypted Blob via Web Crypto

**What:** Compute SHA-256 of the encrypted ciphertext (`ArrayBuffer`) using `crypto.subtle.digest`. This hash is the Blossom blob address AND goes in the kind 24242 `x` tag.

```typescript
// Source: MDN SubtleCrypto.digest()
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
// Returns lowercase hex string — correct format for Blossom x-tags and blob URLs
```

**Compute BEFORE upload.** SHA-256 must be of the exact bytes that will be sent (encrypted ciphertext, not plaintext).

### Pattern 3: Raw PUT /upload with Blossom Auth

```typescript
// Source: BUD-02 (github.com/hzrd149/blossom/blob/master/buds/02.md)
interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

async function uploadBlob(
  serverUrl: string,
  ciphertext: ArrayBuffer,
  authHeader: string,
  mimeType = "application/octet-stream",
): Promise<BlobDescriptor> {
  const response = await fetch(`${serverUrl}/upload`, {
    method: "PUT",
    headers: {
      "Authorization": authHeader,
      "Content-Type": mimeType,
    },
    body: ciphertext,
  });
  if (!response.ok) {
    throw new Error(`Blossom upload failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<BlobDescriptor>;
}
```

**Verify response hash:** After upload, compare `descriptor.sha256` against the locally computed hex. If they differ, the server modified the blob — throw and retry.

### Pattern 4: applesauce-factory build() for kind 30078

```typescript
// Source: applesauce-factory/dist/event-factory.d.ts (build function)
// Source: applesauce-factory/dist/operations/common.d.ts (setExpirationTimestamp, includeReplaceableIdentifier)
// Source: applesauce-factory/dist/operations/tags.d.ts (includeSingletonTag)

import { build } from "applesauce-factory/event-factory";
import {
  setExpirationTimestamp,
  includeReplaceableIdentifier,
} from "applesauce-factory/operations";
import { includeSingletonTag } from "applesauce-factory/operations";
import type { PrivateKeySigner } from "applesauce-signers";

async function buildAlbumEvent(
  signer: PrivateKeySigner,
  encryptedManifest: string,       // base64url-encoded encrypted manifest JSON
  manifestIvB64url: string,        // base64url IV used to encrypt the manifest
  dTag: string,                    // UUID for the album
  expirySeconds = 30 * 24 * 60 * 60, // 30 days
) {
  const context = { signer };
  const template = await build(
    { kind: 30078, content: encryptedManifest },
    context,
    includeReplaceableIdentifier(dTag),        // sets ["d", dTag]
    setExpirationTimestamp(Math.floor(Date.now() / 1000) + expirySeconds), // NIP-40
    includeSingletonTag(["iv", manifestIvB64url]),   // manifest IV tag
    includeSingletonTag(["alt", "Encrypted photo album"]),
  );
  // stamp() adds pubkey, sign() adds id+sig
  return signer.signEvent(template);
}
```

**Important:** `build()` returns `Promise<EventTemplate>` (no pubkey/id/sig). Call `signer.signEvent(template)` to get a `NostrEvent` with all fields. The factory's `.sign()` operation can also be used, but calling `signer.signEvent()` directly is simpler when not using the full EventFactory class.

### Pattern 5: RelayPool.publish() with OK Confirmation

```typescript
// Source: applesauce-relay/dist/pool.d.ts
// Source: applesauce-relay/dist/types.d.ts (PublishResponse)
import { RelayPool } from "applesauce-relay/pool";

// PublishResponse = { ok: boolean; message?: string; from: string }
const pool = new RelayPool();

async function publishToRelays(
  relayUrls: string[],
  event: NostrEvent,
): Promise<{ success: boolean; failures: string[] }> {
  const results = await pool.publish(relayUrls, event);
  // results is PublishResponse[] — one per relay
  const failures = results.filter((r) => !r.ok).map((r) => r.from);
  return { success: failures.length === 0, failures };
}
```

**RelayPool is RxJS-based internally** but `publish()` is a `Promise`-based convenience method — no RxJS subscription required in application code for publishing. The pool handles WebSocket connection lifecycle.

**Cleanup:** RelayPool keeps connections alive. For a one-shot upload session, call `pool.remove(url, true)` on each relay URL after publish completes, or let GC handle it (connections have a 30s keepAlive default).

### Pattern 6: Extend Zustand Store for Upload States

```typescript
// Follow processingStore.ts pattern exactly
// Add upload-specific status values to existing types

export type PhotoUploadStatus =
  | 'pending'       // in queue
  | 'processing'    // Phase 2 worker processing
  | 'encrypting'    // AES-256-GCM encrypt
  | 'uploading'     // PUT to Blossom server
  | 'done'          // success
  | 'error';        // failed all retries

// Option A: Extend processingStore.ts in-place by broadening the status union
// Option B: Create a parallel uploadStore.ts that maps id → upload state
// Recommendation: single store, extend PhotoProcessingStatus to include upload states
// This lets ProgressList component show one unified status column
```

### Pattern 7: Settings Panel with localStorage

```typescript
// Settings hook — no library needed, plain localStorage
function useSettings() {
  const [relays, setRelays] = useState<string[]>(() => {
    const stored = localStorage.getItem("nostr-relays");
    return stored ? JSON.parse(stored) : DEFAULT_RELAYS;
  });
  const [blossomServer, setBlossomServer] = useState<string>(() => {
    return localStorage.getItem("blossom-server") ?? DEFAULT_BLOSSOM_SERVER;
  });
  // Persist on change
  useEffect(() => {
    localStorage.setItem("nostr-relays", JSON.stringify(relays));
  }, [relays]);
  useEffect(() => {
    localStorage.setItem("blossom-server", blossomServer);
  }, [blossomServer]);
  return { relays, setRelays, blossomServer, setBlossomServer };
}
```

**Blossom server validation on save:**
```typescript
async function validateBlossomServer(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    const corsOk = res.headers.get("access-control-allow-origin");
    return res.ok && corsOk !== null;
  } catch {
    return false;
  }
}
```

**Note:** `localStorage` access must be inside `useEffect` or event handlers, never during render or at module scope (SSR safety — same rule as crypto).

### Anti-Patterns to Avoid

- **Calling RelayPool at module scope:** RelayPool instantiates WebSocket connections. Create it inside `useEffect` or as a module-level singleton initialized lazily.
- **Using RxJS subscribe() and forgetting to unsubscribe:** If you use `pool.event()` or `pool.req()` (Observable variants), always clean up. Prefer `pool.publish()` (Promise) and `pool.request()` with RxJS `firstValueFrom()` for one-shot operations.
- **Computing SHA-256 of plaintext instead of ciphertext:** The hash goes in the Blossom URL and auth event. It MUST be computed on the encrypted bytes, not the raw image data.
- **Encrypting the manifest with the same IV as a photo:** Each `encryptBlob()` call generates a fresh IV. The manifest gets its own fresh IV — store it in the kind 30078 `["iv", "<base64url>"]` tag.
- **Using `JSON.stringify` directly on the manifest for the event content:** The content field of kind 30078 must be the base64url-encoded encrypted blob, not plain JSON. Encrypt first, then encode to base64url using the existing `uint8ArrayToBase64url()` helper.
- **Publishing the event before all blob uploads confirm:** Gate event building on collecting all `hash`, `iv`, `thumbHash`, `thumbIv` values from successful uploads.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Nostr event signing + id computation | Custom SHA-256 + Schnorr | `signer.signEvent(template)` (PrivateKeySigner) | Schnorr signing over secp256k1 with correct serialization is non-trivial; applesauce-signers wraps nostr-tools correctly |
| Kind 30078 event structure | Custom tag assembly | applesauce-factory `build()` + operations | Factory handles `created_at`, `pubkey` stamping, and tag deduplication |
| NIP-40 expiration tag | Custom `["expiration", ts]` | `setExpirationTimestamp(ts)` operation | Factory operation handles the operation correctly; prevents typos |
| Replaceable event d-tag | Manual `["d", uuid]` push | `includeReplaceableIdentifier(uuid)` | Ensures correct singleton behavior for addressable events |
| naddr encoding | Custom bech32 | `encodeAlbumNaddr()` in `src/lib/nostr/naddr.ts` | Already implemented using nostr-tools nip19 |
| Relay WebSocket management | Raw WebSocket + reconnect logic | `RelayPool` from applesauce-relay | Pool handles connection lifecycle, reconnect, OK-message parsing |
| localStorage type-safe persistence | Custom hooks | Simple `useState` + `useEffect` + `localStorage` | No library needed for two settings values |
| Clipboard copy | Custom execCommand | `navigator.clipboard.writeText()` | Native async clipboard API; works in all modern browsers on HTTPS |

---

## Common Pitfalls

### Pitfall 1: base64 vs base64url Confusion

**What goes wrong:** The Blossom Authorization header uses standard base64 (`btoa(JSON.stringify(event))`). The URL fragment key uses base64url (no padding, `-` for `+`, `_` for `/`). The manifest content uses base64url after encryption. Mixing these causes auth header parse failures on the server or broken share links.

**How to avoid:** Use `btoa()` only for the Authorization header encoding. Use `uint8ArrayToBase64url()` from `src/lib/crypto.ts` for all IV and key encoding. Use a dedicated `arrayBufferToBase64` (chunked version available in crypto.ts — currently unexported) for the large manifest ciphertext.

**Warning signs:** Server rejects auth event with 401; encoded key fails to import on viewer.

### Pitfall 2: applesauce-relay RelayPool Observable Lifecycle in React

**What goes wrong:** RelayPool's `event()`, `req()`, and `subscription()` methods return RxJS Observables. Calling `.subscribe()` without cleanup leaks WebSocket connections and causes memory leaks and re-emission of stale events on re-render.

**How to avoid:** For publishing (UPLD-05/UPLD-08), exclusively use `pool.publish(relayUrls, event)` — it is Promise-based and self-cleaning. Never use the Observable-returning `pool.event()` variant in React component code unless you add `useEffect` cleanup.

**Warning signs:** Multiple OK responses for a single event; WebSocket connections accumulating in DevTools.

### Pitfall 3: SHA-256 on Plaintext Instead of Ciphertext

**What goes wrong:** Blossom addresses blobs by SHA-256 of the received bytes. If you hash the plaintext ArrayBuffer and use that as the blob URL, it won't match what the server computes, making the album viewer unable to fetch blobs.

**How to avoid:** Compute SHA-256 on the `ciphertext` ArrayBuffer returned by `encryptBlob()`. The hash must be computed AFTER encryption, BEFORE upload. The flow is: `encryptBlob()` → `sha256Hex(ciphertext)` → `uploadBlob(ciphertext, hash)`.

### Pitfall 4: RelayPool WebSocket Connects Before Relay Is Ready

**What goes wrong:** `pool.publish()` is called immediately when the upload hook initializes. Some relays take 200-500ms to establish WebSocket and handshake. The publish completes but the relay never received it.

**How to avoid:** RelayPool handles this internally — the `publish()` method waits for `ready$` before sending. No explicit wait is needed in application code. Do NOT add a manual `setTimeout` — trust the pool's internal ready state machine.

### Pitfall 5: localStorage Access During SSR

**What goes wrong:** Any call to `localStorage.getItem()` outside `useEffect` causes `ReferenceError: localStorage is not defined` during Next.js SSR/prerender.

**How to avoid:** Initialize settings state with a function initializer `useState(() => { ... localStorage ... })` — React lazy state initializers only run client-side after hydration. Alternatively, initialize with defaults and update in `useEffect`. The settings component must use `'use client'` and follow the `dynamic(...)` SSR-false pattern established in Phase 1.

### Pitfall 6: Upload Concurrency Memory Pressure

**What goes wrong:** Encrypting and uploading all N photos simultaneously keeps N × ~2–5 MB ciphertext buffers in memory simultaneously. For 200 photos this is 400 MB–1 GB of simultaneous ciphertext.

**How to avoid:** Use `p-limit` (already installed: `p-limit@7.3.0`) to cap concurrent encrypt+upload pairs at 3-4. Process one photo at a time through the encrypt→hash→upload pipeline, then release the ciphertext buffer before moving to the next.

### Pitfall 7: 24242.io vs Other Blossom Servers CORS

**What goes wrong:** 24242.io has been empirically verified to serve `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Headers: Authorization, *`. Self-hosted or other public Blossom servers may not. The settings panel HEAD validation must check for the CORS header, not just HTTP 200.

**How to avoid:** The `validateBlossomServer()` function must check `response.headers.get("access-control-allow-origin")` is non-null. Surface a clear "Server does not allow browser uploads (CORS)" error — not a generic "unreachable" error.

---

## Code Examples

### SHA-256 Computation (Web Crypto)

```typescript
// Source: MDN SubtleCrypto.digest() - HIGH confidence
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

### Building kind 24242 Upload Auth Event

```typescript
// Source: applesauce-factory/dist/event-factory.d.ts + operations/common.d.ts
// Source: BUD-11 spec (hzrd149/blossom buds/11.md)
import { build } from "applesauce-factory/event-factory";
import { setExpirationTimestamp } from "applesauce-factory/operations";
import { includeSingletonTag } from "applesauce-factory/operations";

async function createBlossomUploadAuth(
  signer: PrivateKeySigner,
  blobHashHex: string,
): Promise<string> {
  const context = { signer };
  const template = await build(
    { kind: 24242, content: "Upload blob" },
    context,
    includeSingletonTag(["t", "upload"]),
    includeSingletonTag(["x", blobHashHex]),
    setExpirationTimestamp(Math.floor(Date.now() / 1000) + 3600),
  );
  const signed = await signer.signEvent(template);
  // Standard base64 (NOT base64url) per BUD-11
  return "Nostr " + btoa(JSON.stringify(signed));
}
```

### Building kind 30078 Album Event

```typescript
// Source: applesauce-factory/dist/operations/common.d.ts + tags.d.ts
import { build } from "applesauce-factory/event-factory";
import {
  setExpirationTimestamp,
  includeReplaceableIdentifier,
} from "applesauce-factory/operations";
import { includeSingletonTag } from "applesauce-factory/operations";

async function buildAlbumEvent(
  signer: PrivateKeySigner,
  encryptedManifestB64url: string,
  manifestIvB64url: string,
  dTag: string,
) {
  const context = { signer };
  const expiresAt = Math.floor(Date.now() / 1000) + ALBUM_EXPIRY_SECONDS; // 2592000
  const template = await build(
    { kind: 30078, content: encryptedManifestB64url },
    context,
    includeReplaceableIdentifier(dTag),
    setExpirationTimestamp(expiresAt),
    includeSingletonTag(["iv", manifestIvB64url]),
    includeSingletonTag(["alt", "Encrypted photo album"]),
  );
  return signer.signEvent(template); // NostrEvent with id, pubkey, sig
}
```

### Publishing with RelayPool and Getting OK Confirmation

```typescript
// Source: applesauce-relay/dist/pool.d.ts + types.d.ts
import { RelayPool } from "applesauce-relay/pool";

const pool = new RelayPool(); // singleton — create once per session

async function publishEvent(
  relayUrls: string[],
  event: NostrEvent,
): Promise<{ ok: boolean; failures: string[] }> {
  // pool.publish() returns Promise<PublishResponse[]>
  // PublishResponse = { ok: boolean, message?: string, from: string }
  const results = await pool.publish(relayUrls, event);
  const failures = results.filter((r) => !r.ok).map((r) => `${r.from}: ${r.message}`);
  return { ok: failures.length === 0, failures };
}
```

### Upload Hook Shell (follows useImageProcessor pattern)

```typescript
'use client';
// src/hooks/useUpload.ts
// Mirrors useImageProcessor.ts: no Worker (sync crypto), same Zustand pattern

import { useCallback, useRef } from 'react';
import { useUploadStore } from '@/store/uploadStore';
import { encryptBlob } from '@/lib/crypto';
import { sha256Hex } from '@/lib/blossom/upload';
import { uploadBlobToServer } from '@/lib/blossom/upload';
import { buildAlbumEvent } from '@/lib/nostr/event';
import { RelayPool } from 'applesauce-relay/pool';
import type { ProcessedPhoto } from '@/types/processing';
import type { AlbumManifest } from '@/types/album';

export function useUpload() {
  const poolRef = useRef<RelayPool | null>(null);
  // ... (full implementation in plan)
}
```

### Manifest Encryption

```typescript
// The manifest is a JSON string encrypted as a blob
// Content of kind 30078 = base64url of ciphertext (NOT base64)
async function encryptManifest(
  manifest: AlbumManifest,
  key: CryptoKey,
): Promise<{ encryptedB64url: string; ivB64url: string }> {
  const json = JSON.stringify(manifest);
  const data = new TextEncoder().encode(json).buffer as ArrayBuffer;
  const { ciphertext, iv } = await encryptBlob(data, key);  // from src/lib/crypto.ts

  // For large ArrayBuffer, use chunked base64 approach (not spread-btoa)
  // Re-export or inline the arrayBufferToBase64 helper from crypto.ts
  const encryptedB64url = uint8ArrayToBase64url(new Uint8Array(ciphertext));
  // Note: uint8ArrayToBase64url uses spread-btoa which may stack overflow on large manifests
  // For 200-photo manifests (large JSON), implement chunked encoding

  const ivB64url = uint8ArrayToBase64url(iv);  // 12-byte IV — spread-btoa is fine
  return { encryptedB64url, ivB64url };
}
```

**CRITICAL NOTE on manifest encoding:** `uint8ArrayToBase64url()` uses `String.fromCharCode(...bytes)` which can stack-overflow on large Uint8Arrays (>64KB). The unexported `arrayBufferToBase64` in `crypto.ts` uses a safe chunked approach. Either export and adapt it, or inline a chunked base64url encoder for the manifest ciphertext.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nostr-tools SimplePool for relay publish | applesauce-relay RelayPool | Phase 1 decision | RelayPool is RxJS-based with better reconnect/auth handling; publish() is Promise-based |
| NIP-98 auth (kind 27235) for uploads | BUD-11 auth (kind 24242) | Blossom spec evolution | Kind 24242 is specific to Blossom; kind 27235 is for generic HTTP auth; Blossom servers expect 24242 |
| Storing AES key in Nostr event | Key only in URL fragment | By design | Relay operators cannot decrypt; key never touches any server |

**Deprecated/outdated:**
- Kind 27235 for Blossom auth: Never use NIP-98 (kind 27235) for Blossom upload authorization. BUD-11 specifies kind 24242 explicitly.
- `blossom-client-sdk` `createUploadAuth(file, signer)` pattern: Not applicable — SDK is not installed, and it expects `File | Blob`, not `ArrayBuffer`.

---

## Open Questions

1. **`includeReplaceableIdentifier` vs manual `["d", uuid]` tag**
   - What we know: `includeReplaceableIdentifier(identifier)` is in `applesauce-factory/dist/operations/common.d.ts`
   - What's unclear: Whether it accepts an explicit identifier string (confirmed: `identifier?: string | (() => string)` — optional, so it generates a random one if not provided)
   - Recommendation: Pass the UUID explicitly: `includeReplaceableIdentifier(dTag)`

2. **RelayPool singleton vs per-upload instance**
   - What we know: RelayPool creates WebSocket connections; keepAlive default is 30s
   - What's unclear: Whether creating a new RelayPool per upload causes any issues
   - Recommendation: Create RelayPool once in `useEffect` (useRef pattern, same as workerRef in useImageProcessor), terminate connections after publish completes

3. **Blossom server for 200-photo albums (60-day retention at 24242.io)**
   - What we know: 24242.io deletes blobs not accessed for 60 days; CORS is confirmed working
   - What's unclear: Whether there's a per-file or per-session upload size limit
   - Recommendation: Surface a "429 Too Many Requests" or "413 Payload Too Large" error clearly in the UI; allow retry

4. **manifest ciphertext size for 200 photos**
   - What we know: AlbumManifest with 200 PhotoEntry entries would be ~200 × ~200 bytes = ~40KB JSON; encrypted = ~40KB + 16 bytes GCM tag
   - What's unclear: Whether event content size limits on target relays (most relays have 64KB–1MB limit)
   - Recommendation: 40KB encrypted manifest is well within typical relay limits; no issue expected

---

## Validation Architecture

> `workflow.nyquist_validation: true` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 with jsdom environment |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose src/lib/blossom/ src/lib/nostr/event.test.ts src/store/uploadStore.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPLD-01 | kind 24242 auth event has `t=upload`, `x=<hash>`, `expiration` tags; Authorization header starts with "Nostr " | unit | `npm test -- src/lib/blossom/upload.test.ts` | ❌ Wave 0 |
| UPLD-02 | SHA-256 of response matches locally computed hash; mismatch throws | unit | `npm test -- src/lib/blossom/upload.test.ts` | ❌ Wave 0 |
| UPLD-03 | kind 24242 auth event's `expiration` tag is ~3600s in the future | unit | `npm test -- src/lib/blossom/upload.test.ts` | ❌ Wave 0 |
| UPLD-04 | createEphemeralSigner produces unique pubkeys | unit | `npm test -- src/lib/nostr/signer.test.ts` | ✅ Exists |
| UPLD-05 | kind 30078 event has correct kind, d-tag UUID, iv-tag, alt-tag, encrypted content | unit | `npm test -- src/lib/nostr/event.test.ts` | ❌ Wave 0 |
| UPLD-06 | kind 30078 event has expiration tag ~30 days in the future | unit | `npm test -- src/lib/nostr/event.test.ts` | ❌ Wave 0 |
| UPLD-07 | uploadStore transitions: pending→encrypting→uploading→done and pending→error | unit | `npm test -- src/store/uploadStore.test.ts` | ❌ Wave 0 |
| UPLD-08 | Share link not generated if any PublishResponse has ok=false | unit | `npm test -- src/hooks/useUpload.test.ts` | ❌ Wave 0 |
| CONF-01 | Settings hook reads relays from localStorage, falls back to DEFAULT_RELAYS | unit | `npm test -- src/hooks/useSettings.test.ts` | ❌ Wave 0 |
| CONF-02 | validateBlossomServer rejects URLs without CORS header | unit | `npm test -- src/lib/blossom/validate.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/lib/blossom/ src/lib/nostr/event.test.ts src/store/uploadStore.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/blossom/upload.test.ts` — covers UPLD-01, UPLD-02, UPLD-03
- [ ] `src/lib/nostr/event.test.ts` — covers UPLD-05, UPLD-06
- [ ] `src/store/uploadStore.test.ts` — covers UPLD-07
- [ ] `src/hooks/useUpload.test.ts` — covers UPLD-08 (requires mock RelayPool)
- [ ] `src/hooks/useSettings.test.ts` — covers CONF-01 (requires jsdom localStorage)
- [ ] `src/lib/blossom/validate.test.ts` — covers CONF-02 (requires fetch mock)
- [ ] Source files: `src/lib/blossom/upload.ts`, `src/lib/nostr/event.ts`, `src/store/uploadStore.ts`, `src/hooks/useUpload.ts`, `src/hooks/useSettings.ts`

**Mocking strategy for tests:**
- `RelayPool.publish()` — mock with `vi.fn()` returning `[{ ok: true, from: 'wss://relay.nostu.be' }]`
- `fetch` — use `vi.stubGlobal('fetch', vi.fn())` for Blossom upload tests
- `localStorage` — jsdom provides it; no mock needed

---

## Sources

### Primary (HIGH confidence — verified against installed type definitions)

- `node_modules/applesauce-factory/dist/event-factory.d.ts` — `build()`, `EventFactory` class API
- `node_modules/applesauce-factory/dist/operations/common.d.ts` — `setExpirationTimestamp`, `includeReplaceableIdentifier`, `includeAltTag`
- `node_modules/applesauce-factory/dist/operations/tags.d.ts` — `includeSingletonTag`, `includeNameValueTag`
- `node_modules/applesauce-relay/dist/pool.d.ts` — `RelayPool`, `publish()` signature
- `node_modules/applesauce-relay/dist/types.d.ts` — `PublishResponse { ok, message, from }`, `PublishOptions`
- `node_modules/applesauce-relay/dist/relay.d.ts` — `Relay` class, `eventTimeout`, `publishTimeout` options
- `node_modules/applesauce-signers/dist/signers/private-key-signer.d.ts` — `PrivateKeySigner` constructor and methods
- `curl -X OPTIONS https://24242.io/upload` — live CORS headers empirically verified 2026-03-19

### Secondary (MEDIUM confidence — WebFetch of official source)

- [BUD-11 spec](https://github.com/hzrd149/blossom/blob/master/buds/11.md) — kind 24242 structure, Authorization header format (`"Nostr " + btoa(JSON.stringify(event))`), required tags (t, expiration, x)
- [BUD-02 spec](https://github.com/hzrd149/blossom/blob/master/buds/02.md) — PUT /upload response: BlobDescriptor with `sha256`, `url`, `size`, `type`, `uploaded`
- [blossom-client-sdk README](https://github.com/hzrd149/blossom-client-sdk) — confirmed `encodeAuthorizationHeader` = `"Nostr " + btoa(JSON.stringify(event))`; uses Web Crypto for SHA-256 with noble/hashes fallback
- [MDN SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) — SHA-256 returns `ArrayBuffer`; convert to hex with `Uint8Array` + `toString(16)`

### Tertiary (LOW confidence — not independently verified)

- applesauce-relay RelayPool internals: `ignoreOffline = true` default in pool.js constructor — could affect publish behavior when relay is slow to connect; needs empirical testing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in node_modules type definitions; blossom-client-sdk deliberately excluded
- Architecture: HIGH — BUD-11, BUD-02, applesauce APIs all verified; 24242.io CORS empirically confirmed
- Pitfalls: HIGH — base64 vs base64url sourced from spec; SHA-256 sourced from MDN; CORS sourced from live curl
- Test strategy: MEDIUM — test file structure inferred from existing patterns; mock approach standard for vitest+jsdom

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days; applesauce packages are stable; Blossom spec changes slowly)

**Key deviation from CONTEXT.md canonical refs:** The CONTEXT.md references blossom-client-sdk as a key tool, but it is NOT in package.json. Research confirms the raw implementation is straightforward and preferred. All other referenced libraries (applesauce-factory, applesauce-relay, applesauce-signers) are confirmed installed at the expected versions.
