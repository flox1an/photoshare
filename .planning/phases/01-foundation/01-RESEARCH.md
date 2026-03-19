# Phase 1: Foundation - Research

**Researched:** 2026-03-19
**Domain:** Next.js App Router scaffolding, AES-256-GCM Web Crypto, ephemeral Nostr keypair, NIP-19 naddr encoding, SSR boundaries
**Confidence:** HIGH (Web Crypto API and nostr-tools v2 APIs verified against live source; Next.js SSR patterns verified against official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single random AES-256 key per album: `crypto.getRandomValues(new Uint8Array(32))`
- Key encoded as base64url (~43 chars) in URL fragment
- Same key used for encrypting all blobs (full images, thumbnails) AND the Nostr event manifest
- No HKDF or sub-key derivation — if the key leaks, everything is exposed anyway since it's in one URL
- Fresh random 12-byte IV per encrypt call (CRITICAL — never reuse IV with same key)
- Share link format: `https://photoshare.app/naddr1...#<base64url-secret>`
- `naddr` (NIP-19 addressable) in the URL path — correct encoding for kind 30078 (parameterized replaceable)
- `naddr` encodes: kind (30078) + author pubkey + d-tag (album ID) + relay hints
- Decryption secret in URL #fragment — never sent to server
- No path prefix — naddr directly at root path
- Album manifest: encrypted JSON stored as content of kind 30078 Nostr event
- Per-image entry contains: `hash`, `iv`, `thumbHash`, `thumbIv`, `width`, `height`, `filename`
- Album-level metadata: `title` (optional), `createdAt` (ISO 8601)
- Thumbnails are separate encrypted Blossom blobs (not base64 embedded)
- Blossom server URL NOT in manifest — viewer discovers from naddr relay hints or uses default
- applesauce (not nostr-tools directly or NDK) — higher-level Nostr library by hzrd149 (noStrudel author), uses nostr-tools types under the hood
- blossom-client-sdk 4.1.0 for Blossom upload/auth
- Web Crypto API (native) for AES-256-GCM — no third-party crypto library
- Default Blossom server: 24242.io; default relay: relay.nostu.be

### Claude's Discretion
- Next.js project structure and folder layout
- TypeScript types/interfaces for the manifest schema
- SSR boundary implementation (dynamic imports vs useEffect guards)
- Config module design (lib/config.ts vs environment variables)
- nostr-tools API usage for keypair generation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRYPT-01 | All image blobs (full + thumbnail) are encrypted with AES-256-GCM client-side | Web Crypto `subtle.encrypt` with AES-GCM algorithm verified; `generateKey` + `importKey` patterns documented |
| CRYPT-02 | A fresh random IV is generated per encrypt operation (never reused) | `crypto.getRandomValues(new Uint8Array(12))` inside per-blob loop; pitfall documented with anti-pattern |
| CRYPT-03 | A single random symmetric key is generated per album | `crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt","decrypt"])` verified |
| CRYPT-04 | The decryption key is embedded in the share link URL #fragment (never sent to server) | base64url encode/decode patterns documented; exportKey → raw → base64url flow confirmed |
| CONF-04 | Sensible defaults (24242.io for Blossom, relay.nostu.be for dev relay) | lib/config.ts pattern documented; no env vars needed for hardcoded defaults |
</phase_requirements>

---

## Summary

Phase 1 establishes the security-critical foundation: a working Next.js 16 App Router project that builds without SSR errors, a correct AES-256-GCM crypto module, an ephemeral Nostr keypair generation utility, and the default configuration for the Blossom server and relay. Every subsequent phase imports from `lib/crypto.ts`, `lib/nostr/keypair.ts`, and `lib/config.ts` — getting these right first is non-negotiable.

The two highest-risk items in this phase are SSR compatibility and IV uniqueness. Next.js App Router aggressively prerenders client components on the server, and any call to `window.crypto` at module scope or during render will throw `ReferenceError: window is not defined`. The fix is mechanical: `dynamic(() => import(...), { ssr: false })` for upload/viewer components, and `useEffect` guards for any crypto initialization. The IV uniqueness risk is addressed by a unit test that verifies 200 calls to `encrypt()` produce 200 distinct IVs.

The nostr-tools v2.23.3 API is stable and verified from source: `generateSecretKey()` returns a `Uint8Array`, `getPublicKey()` takes a `Uint8Array` and returns a hex string, `nip19.naddrEncode()` accepts an `AddressPointer` object with `{ identifier, pubkey, kind, relays? }`. The `publish()` method on `SimplePool` returns `Promise<string>[]` (an array of promises, one per relay) — this is a common gotcha.

**Primary recommendation:** Build `lib/crypto.ts` and its unit tests first; scaffold the Next.js project and verify `next build` passes before touching any Nostr or config logic.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.0 | App Router, SSR boundary control, build pipeline | Project constraint; Turbopack default in v16 |
| React | 19.x (ships with Next 16) | UI | Required by Next.js 16 |
| TypeScript | 5.x | Type safety | nostr-tools v2 uses `Uint8Array` keys — strict mode catches hex/bytes confusion early |
| Web Crypto API | Browser built-in | AES-256-GCM encrypt/decrypt, random key/IV generation | No dependency; spec-correct; universally available in modern browsers |
| applesauce-signers | latest | SimpleSigner for ephemeral keypair | Higher-level API; generates keypair with `new SimpleSigner()` |
| applesauce-factory | latest | EventFactory for creating/signing kind 30078 events | `factory.build()` with operations for tags, content |
| applesauce-relay | latest | RelayPool for publishing events | `relay.publish(event)` with promise-based API |
| applesauce-core | latest | EventStore, core types | Foundation for event management |
| applesauce-loaders | latest | createAddressLoader for viewer (Phase 4) | Fetch events by naddr address |
| nostr-tools | 2.23.3 (peer dep) | NIP-19 naddr encoding, types | Used via applesauce; `nip19.naddrEncode()` still from nostr-tools |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @noble/hashes | (peer dep of nostr-tools) | `bytesToHex` / `hexToBytes` utilities for key display | When converting `Uint8Array` secret/public keys to displayable hex strings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Crypto (native) | CryptoJS / forge | Web Crypto is faster, audited, built-in; third-party crypto adds bundle size with no benefit |
| nostr-tools | NDK | NDK is 60-80kB of social client machinery (outbox model, WoT, sessions) we don't need |

**Installation:**
```bash
npx create-next-app@latest photoshare --typescript --tailwind --app --turbopack
cd photoshare
npm install applesauce-core applesauce-signers applesauce-factory applesauce-relay applesauce-loaders nostr-tools
```

**Version verification (run before implementing):**
```bash
npm view applesauce-core version
npm view applesauce-signers version
npm view next version                 # 16.2.0 confirmed 2026-03-19
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)
```
src/
├── app/
│   ├── layout.tsx               # Root layout — no crypto here
│   ├── page.tsx                 # Upload page stub (client component wrapper)
│   └── view/[naddr]/
│       └── page.tsx             # Viewer page stub
├── lib/
│   ├── crypto.ts                # AES-256-GCM wrappers — PHASE 1 DELIVERABLE
│   ├── config.ts                # Default relay + Blossom server — PHASE 1 DELIVERABLE
│   └── nostr/
│       └── keypair.ts           # Ephemeral keypair generation — PHASE 1 DELIVERABLE
└── types/
    └── album.ts                 # AlbumManifest + PhotoEntry TS interfaces — PHASE 1 DELIVERABLE
```

### Pattern 1: AES-256-GCM Encrypt/Decrypt Module

**What:** A `lib/crypto.ts` module that wraps `window.crypto.subtle` with typed async functions. Callers never touch SubtleCrypto directly.

**When to use:** All encryption/decryption operations in the entire app flow through this module.

**Example:**
```typescript
// lib/crypto.ts
// Source: MDN SubtleCrypto encrypt() + AesGcmParams

/**
 * Generate a new random 256-bit AES-GCM key for an album.
 * extractable: true so we can exportKey() → base64url for the share URL.
 */
export async function generateAlbumKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a blob. Returns { ciphertext, iv } where iv is a freshly generated
 * 12-byte random value. Never reuse an iv with the same key.
 */
export async function encryptBlob(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // FRESH per call
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return { ciphertext, iv };
}

/**
 * Decrypt a ciphertext. iv must be the same 12-byte value used during encrypt.
 */
export async function decryptBlob(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
}

/**
 * Export CryptoKey → base64url string (no padding, URL-safe chars).
 * This value goes in the URL #fragment.
 */
export async function exportKeyToBase64url(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return uint8ArrayToBase64url(new Uint8Array(raw));
}

/**
 * Import a base64url string back into a CryptoKey for decryption.
 * extractable: false (viewer only needs to decrypt, not re-export).
 */
export async function importKeyFromBase64url(b64url: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(b64url);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

// --- Base64url helpers (no external library needed) ---

export function uint8ArrayToBase64url(bytes: Uint8Array): string {
  // Use btoa on the binary string, then make URL-safe and strip padding
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function base64urlToUint8Array(b64url: string): Uint8Array {
  // Restore standard base64 padding before decoding
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
```

### Pattern 2: Ephemeral Nostr Keypair with applesauce SimpleSigner

**What:** A `lib/nostr/signer.ts` module that creates a `SimpleSigner` instance for ephemeral album upload sessions. SimpleSigner generates a fresh secp256k1 keypair internally and implements the Nip07Interface for event signing.

**When to use:** Called once at the start of each upload session. The signer is held in memory only; discarded after event publishing.

**applesauce API (verified from Context7):**
```typescript
// lib/nostr/signer.ts
import { SimpleSigner } from "applesauce-signers";

/**
 * Create an ephemeral signer for a single album upload session.
 * SimpleSigner() generates a random keypair internally.
 * The signer is never persisted — discarded after publishing.
 */
export function createEphemeralSigner(): SimpleSigner {
  return new SimpleSigner(); // generates random key internally
}

/**
 * Get the public key from a signer (hex string).
 */
export async function getSignerPubkey(signer: SimpleSigner): Promise<string> {
  return signer.getPublicKey();
}
```

**Critical:** Do NOT persist the signer or extract the secret key. The signer lives in memory for one upload session only.

### Pattern 3: NIP-19 naddr Encoding

**What:** Encode a kind 30078 event address as an `naddr1...` bech32 string for the share URL path.

**When to use:** After publishing the Nostr event, to build the share URL.

**nostr-tools v2 API (verified from source):**
```typescript
// Source: https://raw.githubusercontent.com/nbd-wtf/nostr-tools/master/nip19.ts
import { nip19 } from "nostr-tools";

// AddressPointer type (from nip19.ts):
// {
//   identifier: string   // the d-tag value (album UUID)
//   pubkey: string        // hex public key of the signing keypair
//   kind: number          // 30078
//   relays?: string[]     // relay hints for viewer to find the event
// }

export function encodeAlbumNaddr(
  identifier: string,
  pubkey: string,
  relays: string[],
): string {
  return nip19.naddrEncode({
    identifier,
    pubkey,
    kind: 30078,
    relays,
  });
}

// Decoding (for viewer side):
export function decodeAlbumNaddr(naddr: string): nip19.AddressPointer {
  const { type, data } = nip19.decode(naddr);
  if (type !== "naddr") throw new Error("Expected naddr");
  return data as nip19.AddressPointer;
}
```

### Pattern 4: SSR Boundary — dynamic import with { ssr: false }

**What:** Any component that uses `window.crypto`, `window`, or Web Workers must be excluded from Next.js server-side rendering.

**When to use:** Upload page, viewer page — any component touching crypto or browser-only APIs.

**Example:**
```typescript
// app/page.tsx (Server Component wrapper — no 'use client')
import dynamic from "next/dynamic";

// Dynamic import with ssr: false prevents prerender on the server
const UploadPanel = dynamic(
  () => import("@/components/upload/UploadPanel"),
  {
    ssr: false,
    loading: () => <div>Loading...</div>,
  },
);

export default function Home() {
  return <UploadPanel />;
}
```

```typescript
// components/upload/UploadPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { generateAlbumKey } from "@/lib/crypto";

export function UploadPanel() {
  const [albumKey, setAlbumKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    // crypto.subtle is only available in browser — safe inside useEffect
    generateAlbumKey().then(setAlbumKey);
  }, []);
  // ...
}
```

**NEVER call `crypto.subtle` or `crypto.getRandomValues` at module scope or in the render body of a client component — it runs during Next.js prerender on the server.**

### Pattern 5: kind 30078 Event with applesauce EventFactory

**What:** NIP-78 kind 30078 is an addressable event with free-form content. The content field holds the AES-256-GCM encrypted manifest JSON. The `d` tag is the unique album identifier.

**Event shape using applesauce (verified from Context7):**
```typescript
import { EventFactory } from "applesauce-factory";
import { setContent, includeSingletonTag } from "applesauce-factory/operations";

const factory = new EventFactory({ signer });

const event = await factory.build(
  { kind: 30078 },
  setContent(encryptedManifestBase64),
  includeSingletonTag(["d", albumIdentifier]),
  includeSingletonTag(["expiration", String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)]),
  includeSingletonTag(["alt", "Encrypted photo album"]),
  includeSingletonTag(["iv", manifestIvBase64url]), // IV for decrypting the manifest content
);

const signed = await factory.sign(event);
```

**Note on `content` encoding:** The AES-GCM output is an `ArrayBuffer`. Convert to base64 (standard, not base64url) for the JSON content field — base64url is used only for the IV values in the manifest entries and the key in the URL fragment, not the event content itself. Either encoding works; pick one and be consistent.

### Pattern 6: applesauce RelayPool publish

**What:** applesauce `RelayPool` provides both observable and promise-based publish methods.

**applesauce API (verified from Context7):**
```typescript
import { RelayPool } from "applesauce-relay";

const pool = new RelayPool();

// Promise-based publish with automatic reconnection and retries
const response = await relay.publish(signedEvent);
console.log(`Published: ${response.ok}`, response.message);
```

**Note:** applesauce relay publish returns a single promise (not an array like nostr-tools SimplePool). This is simpler but means you publish to one relay at a time. For publishing to multiple relays, iterate and collect responses.

### Pattern 7: Default Configuration Module

**What:** A plain TypeScript module exporting default relay and Blossom server URLs. No environment variables needed for these publicly known defaults.

**Example:**
```typescript
// lib/config.ts
export const DEFAULT_RELAYS: string[] = [
  "wss://relay.nostu.be",
];

export const DEFAULT_BLOSSOM_SERVER = "https://24242.io";

export const ALBUM_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const BLOSSOM_EXPIRY_SECONDS = 60 * 24 * 60 * 60; // 60 days (Blossom TTL hint)
```

### Pattern 8: Album Manifest TypeScript Types

**What:** The canonical TypeScript interfaces that define the manifest schema. All phases import from `types/album.ts`.

```typescript
// types/album.ts

/** Per-image entry stored in the album manifest */
export interface PhotoEntry {
  /** SHA-256 hash of the encrypted full-size blob (Blossom blob address) */
  hash: string;
  /** base64url-encoded 12-byte IV used to encrypt the full-size blob */
  iv: string;
  /** SHA-256 hash of the encrypted thumbnail blob */
  thumbHash: string;
  /** base64url-encoded 12-byte IV used to encrypt the thumbnail blob */
  thumbIv: string;
  /** Original image width in pixels (for layout/aspect ratio) */
  width: number;
  /** Original image height in pixels */
  height: number;
  /** Original filename (e.g., IMG_2847.jpg) for download naming */
  filename: string;
}

/** Album manifest — serialized to JSON, then encrypted as event content */
export interface AlbumManifest {
  /** Optional user-provided album title */
  title?: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Ordered list of photo entries */
  photos: PhotoEntry[];
}
```

### Anti-Patterns to Avoid
- **Crypto at module scope:** `const key = await crypto.subtle.generateKey(...)` at module top level throws on SSR. Wrap in `useEffect` or guard with `typeof window !== "undefined"`.
- **Re-exporting IV outside the pair:** Never store IV separately from its ciphertext in a positional array. Always return `{ ciphertext, iv }` as a unit.
- **Hex secret keys in nostr-tools v2:** `generateSecretKey()` returns `Uint8Array` — passing it to functions expecting hex strings fails silently. Use `bytesToHex` from `@noble/hashes/utils.js` only for display purposes.
- **`pool.publish()` with a single await:** See Pattern 6 — returns an array of promises, not a single promise.
- **`btoa()` on large ArrayBuffers without chunking:** `String.fromCharCode(...bytes)` with spread on a large `Uint8Array` can throw "Maximum call stack size exceeded" for blobs >64kB. Use a chunked approach:

```typescript
// Safe base64 encoding for large buffers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Nostr event signing | Custom secp256k1 Schnorr | `factory.sign(event)` from applesauce-factory | EventFactory handles id computation, Schnorr signing via SimpleSigner |
| NIP-19 bech32 encoding | Custom bech32 encoder | `nip19.naddrEncode({ identifier, pubkey, kind, relays })` | TLV encoding for naddr has specific byte layout requirements for relay list |
| AES-GCM key/IV generation | Custom PRNG | `crypto.subtle.generateKey()` + `crypto.getRandomValues()` | CSPRNG — no third-party library needed |
| base64url encoding for small values | External library | `btoa().replace(...)` pattern in Pattern 1 | Standard for key material (~43 chars); use chunked approach for large buffers |
| NIP-40 timestamp calculation | Custom date math | `Math.floor(Date.now() / 1000) + seconds` | Simple Unix timestamp arithmetic |

**Key insight:** applesauce provides the higher-level API surface this phase needs — `SimpleSigner` for keypair, `EventFactory.build()` + `factory.sign()` for events, `RelayPool.publish()` for relay interaction. `nip19.naddrEncode()` from nostr-tools is still used for NIP-19 encoding (applesauce uses nostr-tools types under the hood).

---

## Common Pitfalls

### Pitfall 1: SSR Crash — window/crypto Not Defined
**What goes wrong:** Next.js App Router prerenders client components on the server. Any call to `window.crypto`, `crypto.subtle`, `crypto.getRandomValues`, or `window` at module scope or in the render body throws `ReferenceError: window is not defined`. This is not caught in `next dev` (permissive) but fails `next build`.

**Why it happens:** Developers assume `'use client'` prevents server execution. It doesn't prevent prerender — it only enables browser APIs during hydration. The prerender pass still runs the component on the server.

**How to avoid:**
- Wrap all upload/viewer components with `dynamic(() => import(...), { ssr: false })`
- Move all crypto calls into `useEffect` or event handlers — never in render body or module scope
- Run `next build` in CI as the primary test; `next dev` will not catch SSR errors

**Warning signs:** Crypto calls outside `useEffect`; missing `{ ssr: false }` on upload component import.

### Pitfall 2: IV Reuse Across Blobs
**What goes wrong:** Generating one IV for the album and reusing it for all encrypted blobs. AES-GCM with repeated `(key, IV)` is catastrophically broken — XORing two ciphertexts reveals both plaintexts.

**How to avoid:** Call `crypto.getRandomValues(new Uint8Array(12))` **inside** the per-blob loop. Unit tests must verify all IVs across a batch are unique.

**Warning signs:** IV generation code outside the encrypt function; IV stored as album-level constant.

### Pitfall 3: nostr-tools v2 Key Type Confusion
**What goes wrong:** nostr-tools v2 uses `Uint8Array` for secret keys (breaking change from v1 which used hex strings). Passing a hex string where `Uint8Array` is expected causes silent failures or incorrect signatures.

**How to avoid:** Keep `secretKey` as `Uint8Array` throughout. Only convert to hex with `bytesToHex` from `@noble/hashes/utils.js` for display.

**Warning signs:** `const sk = Buffer.from(generateSecretKey()).toString('hex')` — wrong.

### Pitfall 4: btoa() Stack Overflow on Large Buffers
**What goes wrong:** `btoa(String.fromCharCode(...new Uint8Array(largeBuffer)))` uses spread, which exhausts call stack for buffers >~65KB.

**How to avoid:** Use chunked encoding (see Anti-Patterns section). For IV values (~12 bytes) and keys (~32 bytes), spread is fine. For ciphertext blobs, use chunked.

**Warning signs:** Direct spread of image-sized ArrayBuffers.

### Pitfall 5: SimplePool.publish() Awaited Wrong
**What goes wrong:** `await pool.publish(relays, event)` appears to work (TypeScript may not catch it) but actually awaits the first element of the returned array, not all relay confirmations.

**How to avoid:** Use `Promise.allSettled(pool.publish(relays, event))`. See Pattern 6.

---

## Code Examples

Verified patterns from official sources:

### Generate Album Key
```typescript
// Source: MDN SubtleCrypto generateKey()
const albumKey = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  true,             // extractable — needed for exportKey → base64url
  ["encrypt", "decrypt"],
);
```

### Encrypt with Fresh IV
```typescript
// Source: MDN AesGcmParams
const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes = 96 bits
const ciphertext = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },  // tagLength defaults to 128 bits (optimal)
  albumKey,
  plaintext, // ArrayBuffer
);
// AES-GCM output = ciphertext bytes + 16-byte auth tag appended automatically
```

### Decrypt
```typescript
// Same iv must be passed that was used during encrypt
const plaintext = await crypto.subtle.decrypt(
  { name: "AES-GCM", iv },
  albumKey,
  ciphertext, // ArrayBuffer (includes the appended auth tag)
);
```

### Export Key → base64url
```typescript
const raw = await crypto.subtle.exportKey("raw", albumKey);
const b64url = btoa(String.fromCharCode(...new Uint8Array(raw)))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=/g, "");
// Result: 43-char base64url string (256 bits / 6 bits per char = ~43)
```

### Import Key from base64url
```typescript
const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const key = await crypto.subtle.importKey(
  "raw",
  raw,
  { name: "AES-GCM" },
  false,             // not extractable on viewer side
  ["decrypt"],
);
```

### Generate Ephemeral Signer
```typescript
// Source: applesauce-signers (verified from Context7)
import { SimpleSigner } from "applesauce-signers";

const signer = new SimpleSigner(); // generates random keypair
const pubkey = await signer.getPublicKey(); // hex string
```

### Encode naddr for Share URL
```typescript
// Source: nostr-tools/nip19.ts (verified from GitHub)
import { nip19 } from "nostr-tools";

const naddr = nip19.naddrEncode({
  identifier: albumId,  // d-tag value — random UUID
  pubkey: publicKey,    // hex string
  kind: 30078,
  relays: ["wss://relay.nostu.be"],
});
// Result: "naddr1..." bech32 string
```

### Build and Sign kind 30078 Event with applesauce
```typescript
// Source: applesauce-factory (verified from Context7)
import { EventFactory } from "applesauce-factory";
import { setContent, includeSingletonTag } from "applesauce-factory/operations";

const factory = new EventFactory({ signer });

const event = await factory.build(
  { kind: 30078 },
  setContent(encryptedManifestBase64),
  includeSingletonTag(["d", albumId]),
  includeSingletonTag(["expiration", String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)]),
  includeSingletonTag(["alt", "Encrypted photo album"]),
);
const signed = await factory.sign(event);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nostr-tools: hex secret keys | nostr-tools v2: `Uint8Array` secret keys | nostr-tools v2.0 | `generateSecretKey()` returns `Uint8Array` — hex string usage causes silent failures |
| Next.js: `pages/` router | Next.js 16: App Router with Server Components | Next.js 13+, stable in 15+ | Client components still prerender on server — `{ ssr: false }` required for crypto |
| AES-CBC (NIP-04 style) | AES-GCM with per-blob IV | — | AES-GCM provides authentication; NIP-04 uses ECDH + AES-CBC for DM pairs, not this use case |
| Turbopack opt-in | Turbopack default in Next.js 16 | Next.js 16 | `next dev --turbopack` is now just `next dev` |

**Deprecated/outdated:**
- NIP-04 encryption: Designed for Nostr DM pairs (secp256k1 ECDH + AES-CBC). NOT appropriate for symmetric blob encryption with a shareable key. Never use `nip04.encrypt()` for this app.
- nostr-tools hex secret keys: Pre-v2 pattern. All v2 functions take `Uint8Array`.

---

## Open Questions

1. **blossom-client-sdk type compatibility with nostr-tools@2.23.3**
   - What we know: blossom-client-sdk@4.1.0 uses nostr-tools signing primitives internally; STATE.md flags this as a known concern.
   - What's unclear: Exact TypeScript type intersection; whether the SDK expects `Uint8Array` or hex string for signing keys.
   - Recommendation: Defer to Phase 3 (Blossom upload integration). Phase 1 does not use blossom-client-sdk.

2. **Default relay (relay.nostu.be) availability**
   - What we know: Configured as the dev relay default.
   - What's unclear: Whether this relay supports NIP-40 (check `supported_nips` in NIP-11 response).
   - Recommendation: `lib/config.ts` should be easily overridable; add a comment that relay selection is validated in Phase 3.

3. **Content encoding for manifest in kind 30078 event**
   - What we know: AES-GCM `encrypt()` returns an `ArrayBuffer` containing ciphertext + 16-byte auth tag.
   - What's unclear: Whether to base64-encode the whole ciphertext or treat IV + ciphertext as a combined blob.
   - Recommendation: Store IV separately in the manifest's per-photo entries (as base64url). The event `content` field holds only the base64-encoded encrypted manifest ciphertext (IV for the manifest itself also needs to be stored — encode it as an event tag, e.g., `["iv", "<base64url-manifest-iv>"]`).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended — native ESM, no transform needed for nostr-tools ESM exports, fast) |
| Config file | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| Quick run command | `npx vitest run --reporter=verbose src/lib/crypto.test.ts` |
| Full suite command | `npx vitest run` |

**Why Vitest over Jest:** nostr-tools v2.23.3 ships ESM-only exports. Jest requires complex transform config to handle ESM. Vitest handles ESM natively with zero config.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRYPT-01 | `encryptBlob(data, key)` returns an ArrayBuffer larger than input (ciphertext + 16-byte tag) | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ Wave 0 |
| CRYPT-01 | `decryptBlob(ciphertext, key, iv)` round-trips to original data | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ Wave 0 |
| CRYPT-02 | 200 calls to `encryptBlob` produce 200 distinct IVs | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ Wave 0 |
| CRYPT-03 | `generateAlbumKey()` returns a CryptoKey with `algorithm.name === "AES-GCM"` and `algorithm.length === 256` | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ Wave 0 |
| CRYPT-04 | `exportKeyToBase64url` + `importKeyFromBase64url` round-trip: key exported, re-imported, and used to decrypt | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ Wave 0 |
| CRYPT-04 | base64url string contains no `+`, `/`, or `=` characters | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ Wave 0 |
| CONF-04 | `DEFAULT_RELAYS` contains at least one relay URL starting with `wss://` | unit | `npx vitest run src/lib/config.test.ts` | ❌ Wave 0 |
| CONF-04 | `DEFAULT_BLOSSOM_SERVER` starts with `https://` | unit | `npx vitest run src/lib/config.test.ts` | ❌ Wave 0 |
| Build | `next build` exits with code 0 and no stderr lines containing "window is not defined" | smoke | `npm run build 2>&1 \| grep -c "window is not defined" \| grep -q "^0$"` | ❌ Wave 0 |

**Note on UPLD-04 (ephemeral keypair, referenced in REQUIREMENTS.md as Phase 1):** `generateEphemeralKeypair()` in `lib/nostr/keypair.ts` can be tested with a unit test verifying `secretKey instanceof Uint8Array && secretKey.length === 32` and `typeof publicKey === 'string' && /^[0-9a-f]{64}$/.test(publicKey)`. This test file is also a Wave 0 gap.

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/crypto.test.ts`
- **Per wave merge:** `npx vitest run && npm run build`
- **Phase gate:** Full `npx vitest run` green + `next build` exits 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/crypto.test.ts` — covers CRYPT-01, CRYPT-02, CRYPT-03, CRYPT-04
- [ ] `src/lib/config.test.ts` — covers CONF-04
- [ ] `src/lib/nostr/keypair.test.ts` — covers UPLD-04 (ephemeral keypair correctness)
- [ ] `vitest.config.ts` — framework setup (environment: "jsdom" for Web Crypto API in tests)
- [ ] Framework install: `npm install -D vitest @vitest/ui jsdom`
- [ ] Verify `globalThis.crypto` available in vitest jsdom environment (Node 19+ has Web Crypto built-in; confirm with `node -e "console.log(typeof crypto.subtle)"`)

---

## Sources

### Primary (HIGH confidence)
- `https://raw.githubusercontent.com/nbd-wtf/nostr-tools/master/pure.ts` — `generateSecretKey`, `getPublicKey`, `finalizeEvent`, `EventTemplate` signatures verified directly from source
- `https://raw.githubusercontent.com/nbd-wtf/nostr-tools/master/nip19.ts` — `naddrEncode`, `AddressPointer` type verified directly from source
- `https://raw.githubusercontent.com/nbd-wtf/nostr-tools/master/abstract-pool.ts` — `SimplePool.publish()` return type `Promise<string>[]` verified from source
- `https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams` — IV 12-byte requirement, tagLength default 128 bits, algorithm object structure
- `https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey` — AES-GCM key generation exact parameter shape
- `https://github.com/nostr-protocol/nips/blob/master/78.md` — kind 30078 content/tag structure (free-form, d-tag required, addressable event confirmed)
- npm registry: `npm view nostr-tools version` = 2.23.3 (verified 2026-03-19)
- npm registry: `npm view next version` = 16.2.0 (from STACK.md, verified 2026-03-19)

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — Version table and technology decisions (researched 2026-03-19 by prior research pass)
- `.planning/research/PITFALLS.md` — SSR boundary patterns, IV reuse risk, btoa stack overflow, WebCrypto key type issues (researched 2026-03-19)
- `.planning/research/ARCHITECTURE.md` — Project folder structure, component boundaries, data flow (researched 2026-03-19)
- Next.js SSR/crypto prerender docs (via PITFALLS.md): `nextjs.org/docs/messages/next-prerender-crypto-client` — Suspense + `{ ssr: false }` pattern confirmed

### Tertiary (LOW confidence)
- None — all key claims verified with primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from npm registry and GitHub source files
- Architecture: HIGH — patterns derived from verified API signatures and established Next.js docs
- Pitfalls: HIGH — SSR pattern verified via official Next.js docs; IV reuse risk verified via MDN AesGcmParams spec; nostr-tools key type change verified from source

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (nostr-tools moves fast; re-verify if > 30 days)
