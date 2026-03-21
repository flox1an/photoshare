# Blossom-Only Photo Share v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Nostr relay layer with Blossom-only architecture — manifest stored as an encrypted Blossom blob, simplified URL format, IV prepended to all blobs.

**Architecture:** Encrypted manifest uploaded as a Blossom blob alongside photos. Share URL contains manifest hash + optional server hint + decryption key in fragment. All encrypted blobs use IV-prepend format (12-byte IV || ciphertext). No Nostr relays, no NIP-19 encoding.

**Tech Stack:** Next.js 16, Web Crypto API (AES-256-GCM), Blossom BUD-01/BUD-02/BUD-11, applesauce-signers/factory (BUD-11 auth), Vitest 4, Zustand.

**Spec:** `docs/superpowers/specs/2026-03-21-blossom-only-v2-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/crypto.ts` | IV-prepend encrypt/decrypt pattern |
| Modify | `src/lib/crypto.test.ts` | Updated tests for new signatures |
| Modify | `src/types/album.ts` | Remove iv/thumbIv, add v:1 |
| Modify | `src/lib/config.ts` | Remove relays/ALBUM_EXPIRY, add DEFAULT_BLOSSOM_SERVERS |
| Modify | `src/lib/config.test.ts` | Updated config tests |
| Create | `src/lib/blossom/resolve.ts` | Server resolution with fallback |
| Create | `src/lib/blossom/resolve.test.ts` | Resolution tests |
| Create | `src/lib/blossom/manifest.ts` | Manifest encrypt/upload + decrypt/validate |
| Create | `src/lib/blossom/manifest.test.ts` | Manifest round-trip + validation tests |
| Modify | `src/hooks/useUpload.ts` | Remove relay logic, use manifest upload |
| Modify | `src/hooks/useUpload.test.ts` | Updated hook tests |
| Modify | `src/hooks/useAlbumViewer.ts` | Blossom-based manifest fetch |
| Modify | `src/hooks/useAlbumViewer.test.ts` | Updated viewer tests |
| Modify | `src/hooks/useSettings.ts` | Remove relay state |
| Modify | `src/hooks/useSettings.test.ts` | Updated settings tests |
| Modify | `src/components/upload/SettingsPanel.tsx` | Remove relay UI |
| Modify | `src/components/upload/UploadPanel.tsx` | Remove relay refs in text/props |
| Modify | `src/components/upload/ShareCard.tsx` | Update spinner text |
| Delete | `src/app/view/[naddr]/page.tsx` | Old route |
| Create | `src/app/[hash]/page.tsx` | New hash-based route |
| Modify | `src/components/viewer/ViewerPanel.tsx` | Accept hash prop instead of naddr |
| Modify | `src/components/viewer/Lightbox.tsx` | Rename blossomServer prop to resolvedServer |
| Modify | `src/components/viewer/Lightbox.test.tsx` | Update prop name in test fixtures |
| Delete | `src/lib/blossom/fetch.ts` | Replaced by resolve.ts |
| Delete | `src/lib/blossom/fetch.test.ts` | Replaced by resolve.test.ts |
| Delete | `src/lib/nostr/event.ts` | No longer needed |
| Delete | `src/lib/nostr/event.test.ts` | No longer needed |
| Delete | `src/lib/nostr/naddr.ts` | No longer needed |
| Delete | `src/lib/nostr/viewer.ts` | No longer needed |
| Delete | `src/lib/nostr/viewer.test.ts` | No longer needed |
| Move | `src/lib/nostr/signer.ts` → `src/lib/blossom/signer.ts` | Signer is now a Blossom concern |
| Move | `src/lib/nostr/signer.test.ts` → `src/lib/blossom/signer.test.ts` | Signer test follows source |

---

## Task 1: Modify crypto.ts — IV-prepend pattern

**Files:**
- Modify: `src/lib/crypto.ts`
- Modify: `src/lib/crypto.test.ts`

- [ ] **Step 1: Write failing tests for new encrypt/decrypt signatures**

Replace the `encryptBlob` and `decryptBlob` test suites in `src/lib/crypto.test.ts`:

```typescript
describe("encryptBlob", () => {
  it("returns Uint8Array with byteLength equal to 12 (IV) + input + 16 (GCM tag)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key);
    expect(blob).toBeInstanceOf(Uint8Array);
    expect(blob.byteLength).toBe(12 + data.byteLength + 16);
  });

  it("first 12 bytes are the IV (non-zero randomness check)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("test").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key);
    const iv = blob.slice(0, 12);
    // At least some bytes should be non-zero (probabilistic — 12 random bytes)
    expect(iv.some((b: number) => b !== 0)).toBe(true);
  });

  it("produces unique IVs across 200 calls (no IV reuse)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("x").buffer as ArrayBuffer;
    const ivSet = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const blob = await encryptBlob(data, key);
      ivSet.add(uint8ArrayToBase64url(blob.slice(0, 12)));
    }
    expect(ivSet.size).toBe(200);
  });
});

describe("decryptBlob", () => {
  it("round-trips: decrypt(encrypt(data)) recovers original data", async () => {
    const key = await generateAlbumKey();
    const original = new TextEncoder().encode("photoshare test payload").buffer as ArrayBuffer;
    const blob = await encryptBlob(original, key);
    const recovered = await decryptBlob(blob, key);
    expect(new Uint8Array(recovered)).toEqual(new Uint8Array(original));
  });

  it("throws when key is wrong (GCM auth tag mismatch)", async () => {
    const key1 = await generateAlbumKey();
    const key2 = await generateAlbumKey();
    const data = new TextEncoder().encode("test").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key1);
    await expect(decryptBlob(blob, key2)).rejects.toThrow();
  });

  it("throws when blob is truncated below 28 bytes", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("test").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key);
    const truncated = blob.slice(0, 20); // less than 28 bytes (12 IV + 16 GCM tag)
    await expect(decryptBlob(truncated, key)).rejects.toThrow("too short");
  });
});
```

Also update the key round-trip test to use new signatures:

```typescript
it("round-trip: imported key decrypts data encrypted with original key", async () => {
  const key = await generateAlbumKey();
  const b64url = await exportKeyToBase64url(key);
  const imported = await importKeyFromBase64url(b64url);
  const data = new TextEncoder().encode("round-trip test").buffer as ArrayBuffer;
  const blob = await encryptBlob(data, key);
  const recovered = await decryptBlob(blob, imported);
  expect(new Uint8Array(recovered)).toEqual(new Uint8Array(data));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/crypto.test.ts`
Expected: FAIL — `encryptBlob` returns `{ ciphertext, iv }` not `Uint8Array`, `decryptBlob` requires 3 args not 2.

- [ ] **Step 3: Update encryptBlob and decryptBlob implementations**

In `src/lib/crypto.ts`, replace `encryptBlob` and `decryptBlob`:

```typescript
/**
 * Encrypt a blob with AES-256-GCM.
 * Returns IV || ciphertext as a single Uint8Array (self-contained for Blossom upload).
 * First 12 bytes = fresh random IV. Remaining bytes = ciphertext + 16-byte GCM auth tag.
 */
export async function encryptBlob(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  const result = new Uint8Array(12 + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), 12);
  return result;
}

/**
 * Decrypt an IV-prepended AES-256-GCM blob.
 * Expects first 12 bytes to be the IV, remainder is ciphertext + GCM tag.
 * Throws if blob is too short, key is wrong, or data is tampered.
 */
export async function decryptBlob(
  blob: Uint8Array,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  if (blob.byteLength < 28) {
    throw new Error("Encrypted blob too short (must be at least 28 bytes: 12 IV + 16 GCM tag)");
  }
  const iv = blob.slice(0, 12);
  const ciphertext = blob.slice(12);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
}
```

Remove the `arrayBufferToBase64` function and its `void` suppressor (lines 104-115) — no longer needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/crypto.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts src/lib/crypto.test.ts
git commit -m "refactor(crypto): IV-prepend pattern for encrypt/decrypt"
```

---

## Task 2: Update data models and config

**Files:**
- Modify: `src/types/album.ts`
- Modify: `src/lib/config.ts`
- Modify: `src/lib/config.test.ts`

- [ ] **Step 1: Update album types**

Replace `src/types/album.ts`:

```typescript
/** Per-image entry stored in the album manifest */
export interface PhotoEntry {
  /** SHA-256 hash of the encrypted full-size blob (IV || ciphertext) */
  hash: string;
  /** SHA-256 hash of the encrypted thumbnail blob (IV || ciphertext) */
  thumbHash: string;
  /** Original image width in pixels */
  width: number;
  /** Original image height in pixels */
  height: number;
  /** Original filename (e.g. IMG_2847.jpg) used for download naming */
  filename: string;
}

/** Album manifest — serialized to JSON, encrypted, uploaded to Blossom as a blob */
export interface AlbumManifest {
  /** Manifest format version */
  v: 1;
  /** Optional user-provided album title */
  title?: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Ordered list of photo entries */
  photos: PhotoEntry[];
}
```

- [ ] **Step 2: Update config**

Replace `src/lib/config.ts`:

```typescript
/**
 * Default Blossom server for uploading encrypted blobs.
 * Can be overridden via settings panel.
 */
export const DEFAULT_BLOSSOM_SERVER = "https://tempstore.apps3.slidestr.net";

/**
 * Fallback Blossom servers for blob resolution.
 * Tried in order when the xs hint is missing or the hinted server is down.
 */
export const DEFAULT_BLOSSOM_SERVERS: string[] = [
  "https://tempstore.apps3.slidestr.net",
];

/**
 * Blossom server expiration hint in seconds.
 * Blossom upload requests include an expiration header requesting this TTL.
 * 60 days = 5,184,000 seconds.
 */
export const BLOSSOM_EXPIRY_SECONDS = 60 * 24 * 60 * 60; // 5184000
```

- [ ] **Step 3: Update config test**

Replace `src/lib/config.test.ts` to match new exports:

```typescript
import { describe, it, expect } from "vitest";
import {
  DEFAULT_BLOSSOM_SERVER,
  DEFAULT_BLOSSOM_SERVERS,
  BLOSSOM_EXPIRY_SECONDS,
} from "@/lib/config";

describe("config", () => {
  it("DEFAULT_BLOSSOM_SERVER is a valid https URL", () => {
    expect(DEFAULT_BLOSSOM_SERVER).toMatch(/^https:\/\//);
  });

  it("DEFAULT_BLOSSOM_SERVERS is a non-empty array of https URLs", () => {
    expect(DEFAULT_BLOSSOM_SERVERS.length).toBeGreaterThan(0);
    for (const url of DEFAULT_BLOSSOM_SERVERS) {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it("BLOSSOM_EXPIRY_SECONDS is 60 days in seconds", () => {
    expect(BLOSSOM_EXPIRY_SECONDS).toBe(5184000);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/album.ts src/lib/config.ts src/lib/config.test.ts
git commit -m "refactor: update album types (drop iv fields, add v:1) and config (remove relays)"
```

---

## Task 3: Move signer to blossom directory

**Files:**
- Move: `src/lib/nostr/signer.ts` → `src/lib/blossom/signer.ts`
- Move: `src/lib/nostr/signer.test.ts` → `src/lib/blossom/signer.test.ts`

- [ ] **Step 1: Move files**

```bash
mv src/lib/nostr/signer.ts src/lib/blossom/signer.ts
mv src/lib/nostr/signer.test.ts src/lib/blossom/signer.test.ts
```

- [ ] **Step 2: Update import in `src/lib/blossom/upload.ts`**

Change the signer import at the top of `src/lib/blossom/upload.ts` — no change needed since it imports from `applesauce-signers` directly, not from `@/lib/nostr/signer`.

- [ ] **Step 3: Run signer test to verify it passes in new location**

Run: `npx vitest run src/lib/blossom/signer.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/blossom/signer.ts src/lib/blossom/signer.test.ts
git rm src/lib/nostr/signer.ts src/lib/nostr/signer.test.ts
git commit -m "refactor: move signer to blossom directory (BUD-11 concern)"
```

---

## Task 4: Create Blossom server resolution

**Files:**
- Create: `src/lib/blossom/resolve.ts`
- Create: `src/lib/blossom/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/blossom/resolve.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveAndFetch } from "@/lib/blossom/resolve";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("resolveAndFetch", () => {
  it("fetches from xs hint first when provided", async () => {
    const mockData = new ArrayBuffer(10);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockData),
    });

    const result = await resolveAndFetch("abc123", "myserver.com");
    expect(mockFetch).toHaveBeenCalledWith("https://myserver.com/abc123");
    expect(result.data).toBe(mockData);
    expect(result.server).toBe("https://myserver.com");
  });

  it("falls back to DEFAULT_BLOSSOM_SERVERS when xs hint fails", async () => {
    const mockData = new ArrayBuffer(10);
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // xs hint fails
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockData),
      });

    const result = await resolveAndFetch("abc123", "down.server.com");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.data).toBe(mockData);
  });

  it("tries DEFAULT_BLOSSOM_SERVERS when no xs hint given", async () => {
    const mockData = new ArrayBuffer(10);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockData),
    });

    const result = await resolveAndFetch("abc123");
    expect(result.data).toBe(mockData);
  });

  it("throws BlobNotFoundError when all servers fail", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(resolveAndFetch("abc123")).rejects.toThrow(
      "Blob not found on any server",
    );
  });

  it("handles fetch network errors gracefully (tries next server)", async () => {
    const mockData = new ArrayBuffer(10);
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockData),
      });

    const result = await resolveAndFetch("abc123");
    expect(result.data).toBe(mockData);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/blossom/resolve.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement resolve.ts**

Create `src/lib/blossom/resolve.ts`:

```typescript
import { DEFAULT_BLOSSOM_SERVERS } from "@/lib/config";

export interface ResolveResult {
  data: ArrayBuffer;
  server: string;
}

/**
 * Fetch a blob by SHA-256 hash, trying xs hint first then fallback servers.
 *
 * @param hash - 64-char lowercase hex SHA-256 of the blob
 * @param xsHint - Optional domain hint (https assumed, no protocol prefix)
 * @returns The blob data and which server it came from
 * @throws Error if blob not found on any server
 */
export async function resolveAndFetch(
  hash: string,
  xsHint?: string,
): Promise<ResolveResult> {
  const servers = xsHint
    ? [`https://${xsHint}`, ...DEFAULT_BLOSSOM_SERVERS.filter((s) => s !== `https://${xsHint}`)]
    : DEFAULT_BLOSSOM_SERVERS;

  for (const server of servers) {
    try {
      const base = server.replace(/\/$/, "");
      const res = await fetch(`${base}/${hash}`);
      if (res.ok) {
        return { data: await res.arrayBuffer(), server: base };
      }
    } catch {
      // Network error — try next server
    }
  }

  throw new Error("Blob not found on any server");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/blossom/resolve.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/blossom/resolve.ts src/lib/blossom/resolve.test.ts
git commit -m "feat: add Blossom server resolution with fallback"
```

---

## Task 5: Create manifest encrypt/upload and decrypt/validate

**Files:**
- Create: `src/lib/blossom/manifest.ts`
- Create: `src/lib/blossom/manifest.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/blossom/manifest.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateAlbumKey, encryptBlob, decryptBlob } from "@/lib/crypto";
import {
  encryptManifest,
  decryptAndValidateManifest,
} from "@/lib/blossom/manifest";
import type { AlbumManifest } from "@/types/album";

describe("encryptManifest", () => {
  it("returns a Uint8Array with IV-prepended ciphertext", async () => {
    const key = await generateAlbumKey();
    const manifest: AlbumManifest = {
      v: 1,
      createdAt: new Date().toISOString(),
      photos: [],
    };
    const blob = await encryptManifest(manifest, key);
    expect(blob).toBeInstanceOf(Uint8Array);
    expect(blob.byteLength).toBeGreaterThan(12); // at least IV + some ciphertext
  });
});

describe("decryptAndValidateManifest", () => {
  it("round-trips a valid manifest", async () => {
    const key = await generateAlbumKey();
    const manifest: AlbumManifest = {
      v: 1,
      title: "Test Album",
      createdAt: "2026-03-21T00:00:00.000Z",
      photos: [
        { hash: "a".repeat(64), thumbHash: "b".repeat(64), width: 1920, height: 1080, filename: "test.jpg" },
      ],
    };
    const blob = await encryptManifest(manifest, key);
    const result = await decryptAndValidateManifest(blob, key);
    expect(result).toEqual(manifest);
  });

  it("rejects manifest with unsupported version", async () => {
    const key = await generateAlbumKey();
    const badManifest = { v: 99, createdAt: "2026-01-01", photos: [] };
    const json = new TextEncoder().encode(JSON.stringify(badManifest));
    const blob = await encryptBlob(json.buffer as ArrayBuffer, key);
    await expect(decryptAndValidateManifest(blob, key)).rejects.toThrow(
      "Unsupported album version",
    );
  });

  it("rejects manifest with missing photos array", async () => {
    const key = await generateAlbumKey();
    const badManifest = { v: 1, createdAt: "2026-01-01" };
    const json = new TextEncoder().encode(JSON.stringify(badManifest));
    const blob = await encryptBlob(json.buffer as ArrayBuffer, key);
    await expect(decryptAndValidateManifest(blob, key)).rejects.toThrow(
      "Invalid manifest",
    );
  });

  it("rejects manifest with invalid photo entry (missing hash)", async () => {
    const key = await generateAlbumKey();
    const badManifest = {
      v: 1,
      createdAt: "2026-01-01",
      photos: [{ thumbHash: "b".repeat(64), width: 100, height: 100, filename: "x.jpg" }],
    };
    const json = new TextEncoder().encode(JSON.stringify(badManifest));
    const blob = await encryptBlob(json.buffer as ArrayBuffer, key);
    await expect(decryptAndValidateManifest(blob, key)).rejects.toThrow(
      "Invalid photo entry",
    );
  });

  it("throws on wrong key", async () => {
    const key1 = await generateAlbumKey();
    const key2 = await generateAlbumKey();
    const manifest: AlbumManifest = { v: 1, createdAt: "2026-01-01", photos: [] };
    const blob = await encryptManifest(manifest, key1);
    await expect(decryptAndValidateManifest(blob, key2)).rejects.toThrow();
  });

  it("accepts manifest without title", async () => {
    const key = await generateAlbumKey();
    const manifest: AlbumManifest = { v: 1, createdAt: "2026-01-01", photos: [] };
    const blob = await encryptManifest(manifest, key);
    const result = await decryptAndValidateManifest(blob, key);
    expect(result.title).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/blossom/manifest.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement manifest.ts**

Create `src/lib/blossom/manifest.ts`:

```typescript
import { encryptBlob, decryptBlob } from "@/lib/crypto";
import type { AlbumManifest, PhotoEntry } from "@/types/album";

/**
 * Encrypt an AlbumManifest to an IV-prepended blob ready for Blossom upload.
 */
export async function encryptManifest(
  manifest: AlbumManifest,
  key: CryptoKey,
): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  return encryptBlob(json.buffer as ArrayBuffer, key);
}

/**
 * Decrypt an IV-prepended blob and validate it as an AlbumManifest.
 *
 * Validation rules:
 * - v must be 1
 * - photos must be an array
 * - each photo must have: hash (64-char hex), thumbHash (64-char hex),
 *   width (positive), height (positive), filename (non-empty string)
 *
 * @throws Error on decryption failure, unsupported version, or invalid structure
 */
export async function decryptAndValidateManifest(
  blob: Uint8Array,
  key: CryptoKey,
): Promise<AlbumManifest> {
  const plaintext = await decryptBlob(blob, key);
  const json = new TextDecoder().decode(plaintext);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid manifest: not valid JSON");
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.v !== 1) {
    throw new Error(`Unsupported album version: ${obj.v}`);
  }

  if (!Array.isArray(obj.photos)) {
    throw new Error("Invalid manifest: missing photos array");
  }

  if (typeof obj.createdAt !== "string" || obj.createdAt.length === 0) {
    throw new Error("Invalid manifest: missing createdAt");
  }

  const hexPattern = /^[a-f0-9]{64}$/;
  for (let i = 0; i < obj.photos.length; i++) {
    const p = obj.photos[i] as Record<string, unknown>;
    if (
      typeof p.hash !== "string" || !hexPattern.test(p.hash) ||
      typeof p.thumbHash !== "string" || !hexPattern.test(p.thumbHash) ||
      typeof p.width !== "number" || p.width <= 0 ||
      typeof p.height !== "number" || p.height <= 0 ||
      typeof p.filename !== "string" || p.filename.length === 0
    ) {
      throw new Error(`Invalid photo entry at index ${i}`);
    }
  }

  return {
    v: 1,
    ...(typeof obj.title === "string" ? { title: obj.title } : {}),
    createdAt: String(obj.createdAt),
    photos: obj.photos as PhotoEntry[],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/blossom/manifest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/blossom/manifest.ts src/lib/blossom/manifest.test.ts
git commit -m "feat: add manifest encrypt/decrypt with validation"
```

---

## Task 6: Rewrite useUpload hook — remove relay, add manifest upload

**Files:**
- Modify: `src/hooks/useUpload.ts`
- Modify: `src/hooks/useUpload.test.ts`

- [ ] **Step 1: Rewrite useUpload.ts**

Replace `src/hooks/useUpload.ts` with:

```typescript
'use client';

/**
 * useUpload — orchestration hook for encrypt→upload→share pipeline (Blossom-only v2).
 *
 * Pipeline:
 *   1. Generate album key (AES-256-GCM)
 *   2. Create ephemeral signer (BUD-11 auth)
 *   3. For each photo (p-limit(3) concurrency):
 *      a. encrypt full + thumb (IV-prepend)
 *      b. SHA-256 each blob
 *      c. upload both blobs to Blossom
 *      d. accumulate PhotoEntry
 *   4. Build + encrypt manifest → upload to Blossom
 *   5. Generate share URL: /{manifestHash}?xs={domain}#{key}
 */

import { useCallback, useRef, useState } from 'react';
import pLimit from 'p-limit';
import {
  generateAlbumKey,
  encryptBlob,
  exportKeyToBase64url,
} from '@/lib/crypto';
import { createEphemeralSigner } from '@/lib/blossom/signer';
import { sha256Hex, buildBlossomUploadAuth, uploadBlob } from '@/lib/blossom/upload';
import { encryptManifest } from '@/lib/blossom/manifest';
import { useUploadStore } from '@/store/uploadStore';
import { DEFAULT_BLOSSOM_SERVER } from '@/lib/config';
import type { ProcessedPhoto } from '@/types/processing';
import type { AlbumManifest, PhotoEntry } from '@/types/album';

/** Settings consumed by startUpload */
export interface UploadSettings {
  blossomServer: string;
  title?: string;
}

/** Return type of the useUpload hook */
export interface UseUploadReturn {
  startUpload: (photos: ProcessedPhoto[], settings?: UploadSettings) => Promise<void>;
  shareLink: string | null;
  isUploading: boolean;
  publishError: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useUpload(): UseUploadReturn {
  const limitRef = useRef(pLimit(3));

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { setEncrypting, setUploading, setUploadDone, setUploadError } = useUploadStore();

  const startUpload = useCallback(
    async (
      photos: ProcessedPhoto[],
      settings: UploadSettings = { blossomServer: DEFAULT_BLOSSOM_SERVER },
    ): Promise<void> => {
      setIsUploading(true);
      setShareLink(null);
      setPublishError(null);

      try {
        const albumKey = await generateAlbumKey();
        const signer = createEphemeralSigner();

        const photoEntries: PhotoEntry[] = [];
        let hasUploadError = false;

        await Promise.all(
          photos.map((photo, index) =>
            limitRef.current(async () => {
              const photoId = `photo-${index}`;
              let lastError: unknown;

              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  setEncrypting(photoId);

                  // Encrypt with IV-prepend pattern
                  const fullBlob = await encryptBlob(photo.full, albumKey);
                  const thumbBlob = await encryptBlob(photo.thumb, albumKey);

                  // Hash the complete blob (IV + ciphertext)
                  const fullHash = await sha256Hex(fullBlob.buffer as ArrayBuffer);
                  const thumbHash = await sha256Hex(thumbBlob.buffer as ArrayBuffer);

                  setUploading(photoId);

                  const fullAuthHeader = await buildBlossomUploadAuth(signer, fullHash);
                  const thumbAuthHeader = await buildBlossomUploadAuth(signer, thumbHash);

                  const fullDescriptor = await uploadBlob(
                    settings.blossomServer,
                    fullBlob.buffer as ArrayBuffer,
                    fullAuthHeader,
                    fullHash,
                  );
                  await uploadBlob(
                    settings.blossomServer,
                    thumbBlob.buffer as ArrayBuffer,
                    thumbAuthHeader,
                    thumbHash,
                  );

                  setUploadDone(photoId, fullDescriptor);

                  photoEntries[index] = {
                    hash: fullHash,
                    thumbHash,
                    width: photo.width,
                    height: photo.height,
                    filename: photo.filename,
                  };

                  return;
                } catch (err) {
                  lastError = err;
                  if (attempt < 2) {
                    await sleep(100 * Math.pow(2, attempt));
                  }
                }
              }

              const message = lastError instanceof Error ? lastError.message : String(lastError);
              setUploadError(photoId, message);
              hasUploadError = true;
            }),
          ),
        );

        if (hasUploadError) {
          setPublishError('One or more photos failed to upload after 3 retries');
          return;
        }

        // Build and encrypt manifest
        const manifest: AlbumManifest = {
          v: 1,
          ...(settings.title ? { title: settings.title } : {}),
          createdAt: new Date().toISOString(),
          photos: photoEntries,
        };

        const manifestBlob = await encryptManifest(manifest, albumKey);
        const manifestHash = await sha256Hex(manifestBlob.buffer as ArrayBuffer);
        const manifestAuthHeader = await buildBlossomUploadAuth(signer, manifestHash);
        await uploadBlob(
          settings.blossomServer,
          manifestBlob.buffer as ArrayBuffer,
          manifestAuthHeader,
          manifestHash,
        );

        // Build share URL
        const keyB64url = await exportKeyToBase64url(albumKey);
        // Extract domain from server URL for xs param
        const serverDomain = settings.blossomServer.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const link = `/${manifestHash}?xs=${serverDomain}#${keyB64url}`;

        // Auto-copy to clipboard
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(
              (typeof window !== 'undefined' ? window.location.origin : '') + link,
            );
          }
        } catch {
          // Clipboard permission denied — non-fatal
        }

        setShareLink(link);
      } finally {
        setIsUploading(false);
      }
    },
    [setEncrypting, setUploading, setUploadDone, setUploadError],
  );

  return { startUpload, shareLink, isUploading, publishError };
}
```

- [ ] **Step 2: Rewrite useUpload.test.ts**

The test file needs significant rewrite — remove all relay mocking, test the Blossom-only flow. Read the existing test file first, then replace it. Key test cases:

1. "calls encryptBlob for each photo (full + thumb)" — verify 2 encrypt calls per photo
2. "calls sha256Hex on encrypted blobs" — verify hash computed on full blob
3. "calls uploadBlob for each photo (full + thumb) + manifest" — verify 2N+1 upload calls
4. "generates share URL with manifest hash, xs param, and key fragment"
5. "sets publishError when a photo upload fails after 3 retries"
6. "does not upload manifest when a photo upload fails"

The mocks to set up:
- `vi.mock('@/lib/crypto')` — mock generateAlbumKey, encryptBlob, exportKeyToBase64url
- `vi.mock('@/lib/blossom/signer')` — mock createEphemeralSigner
- `vi.mock('@/lib/blossom/upload')` — mock sha256Hex, buildBlossomUploadAuth, uploadBlob
- `vi.mock('@/lib/blossom/manifest')` — mock encryptManifest
- `vi.mock('@/store/uploadStore')` — mock store actions

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/hooks/useUpload.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useUpload.ts src/hooks/useUpload.test.ts
git commit -m "feat: rewrite useUpload for Blossom-only manifest upload"
```

---

## Task 7: Rewrite useAlbumViewer hook — Blossom-based viewer

**Files:**
- Modify: `src/hooks/useAlbumViewer.ts`
- Modify: `src/hooks/useAlbumViewer.test.ts`

- [ ] **Step 1: Rewrite useAlbumViewer.ts**

Replace the hook. Key changes:
- Accept `hash` instead of `naddr`
- Read `xs` from `window.location.search` and key from `window.location.hash`
- Use `resolveAndFetch` to get manifest blob
- Use `decryptAndValidateManifest` to decrypt
- For thumbnails/full images: use `resolveAndFetch` (try the manifest's server first)
- For downloads: use the new `decryptBlob(blob, key)` 2-arg signature

```typescript
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { decryptBlob, importKeyFromBase64url } from '@/lib/crypto';
import { resolveAndFetch } from '@/lib/blossom/resolve';
import { decryptAndValidateManifest } from '@/lib/blossom/manifest';
import type { AlbumManifest, PhotoEntry } from '@/types/album';

export interface DownloadProgress {
  current: number;
  total: number;
}

export interface AlbumViewerState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  manifest: AlbumManifest | null;
  thumbUrls: Record<string, string>;
  fullUrls: Record<string, string>;
  albumKey: CryptoKey | null;
  resolvedServer: string | null;
  downloadProgress: DownloadProgress | null;
  downloadAll: (
    photos: PhotoEntry[],
    key: CryptoKey,
    server: string,
    onProgress?: (current: number, total: number) => void,
  ) => Promise<void>;
  downloadSingle: (
    photo: PhotoEntry,
    key: CryptoKey,
    server: string,
  ) => Promise<void>;
  loadThumbnail: (index: number) => void;
  loadFullImage: (index: number) => void;
}

export function useAlbumViewer(opts?: { hash?: string }): AlbumViewerState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<AlbumManifest | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [albumKey, setAlbumKey] = useState<CryptoKey | null>(null);
  const [resolvedServer, setResolvedServer] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  const createdUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!opts?.hash) return;
    let cancelled = false;

    async function init() {
      try {
        // 1. Extract key from fragment
        const keyB64url = window.location.hash.slice(1);
        if (!keyB64url) {
          throw new Error('Missing decryption key in URL fragment');
        }

        // 2. Extract xs hint from query params
        const params = new URLSearchParams(window.location.search);
        const xsHint = params.get('xs') ?? undefined;

        // 3. Import AES key
        const key = await importKeyFromBase64url(keyB64url);

        // 4. Fetch manifest from Blossom
        const { data, server } = await resolveAndFetch(opts!.hash!, xsHint);

        if (cancelled) return;

        // 5. Decrypt and validate manifest
        const albumManifest = await decryptAndValidateManifest(
          new Uint8Array(data),
          key,
        );

        if (cancelled) return;

        setAlbumKey(key);
        setManifest(albumManifest);
        setResolvedServer(server);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load album');
        setStatus('error');
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [opts?.hash]);

  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /** Fetch and decrypt a blob, trying resolvedServer first then fallback */
  const fetchAndDecrypt = useCallback(
    async (hash: string, key: CryptoKey): Promise<ArrayBuffer> => {
      // Extract xs from resolved server domain for hint
      const xsHint = resolvedServer
        ? resolvedServer.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : undefined;
      const { data } = await resolveAndFetch(hash, xsHint);
      return decryptBlob(new Uint8Array(data), key);
    },
    [resolvedServer],
  );

  const downloadSingle = useCallback(
    async (photo: PhotoEntry, key: CryptoKey, _server: string): Promise<void> => {
      const plaintext = await fetchAndDecrypt(photo.hash, key);
      triggerDownload(new Blob([plaintext]), photo.filename);
    },
    [fetchAndDecrypt, triggerDownload],
  );

  const downloadAll = useCallback(
    async (
      photos: PhotoEntry[],
      key: CryptoKey,
      _server: string,
      onProgress?: (current: number, total: number) => void,
    ): Promise<void> => {
      const total = photos.length;
      setDownloadProgress({ current: 0, total });

      if (isIOS) {
        const zip = new JSZip();
        for (let i = 0; i < photos.length; i++) {
          const plaintext = await fetchAndDecrypt(photos[i].hash, key);
          zip.file(photos[i].filename, plaintext);
          const current = i + 1;
          if (onProgress) onProgress(current, total);
          setDownloadProgress({ current, total });
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerDownload(zipBlob, 'album.zip');
      } else {
        for (let i = 0; i < photos.length; i++) {
          const plaintext = await fetchAndDecrypt(photos[i].hash, key);
          triggerDownload(new Blob([plaintext]), photos[i].filename);
          const current = i + 1;
          if (onProgress) onProgress(current, total);
          setDownloadProgress({ current, total });
        }
      }

      setDownloadProgress(null);
    },
    [isIOS, fetchAndDecrypt, triggerDownload],
  );

  const loadThumbnail = useCallback(
    (index: number) => {
      if (!albumKey || !manifest) return;
      const photo = manifest.photos[index];
      if (!photo) return;
      if (thumbUrls[photo.thumbHash]) return;

      void (async () => {
        try {
          const plaintext = await fetchAndDecrypt(photo.thumbHash, albumKey);
          const objectUrl = URL.createObjectURL(
            new Blob([plaintext], { type: 'image/webp' }),
          );
          createdUrlsRef.current.push(objectUrl);
          setThumbUrls(prev => ({ ...prev, [photo.thumbHash]: objectUrl }));
        } catch {
          // Thumbnail load failure is non-fatal
        }
      })();
    },
    [albumKey, manifest, thumbUrls, fetchAndDecrypt],
  );

  const loadFullImage = useCallback(
    (index: number) => {
      if (!albumKey || !manifest) return;
      const photo = manifest.photos[index];
      if (!photo) return;
      if (fullUrls[photo.hash]) return;

      void (async () => {
        try {
          const plaintext = await fetchAndDecrypt(photo.hash, albumKey);
          const objectUrl = URL.createObjectURL(
            new Blob([plaintext], { type: 'image/webp' }),
          );
          createdUrlsRef.current.push(objectUrl);
          setFullUrls(prev => ({ ...prev, [photo.hash]: objectUrl }));
        } catch {
          // Full image load failure is non-fatal
        }
      })();
    },
    [albumKey, manifest, fullUrls, fetchAndDecrypt],
  );

  return {
    status,
    error,
    manifest,
    thumbUrls,
    fullUrls,
    albumKey,
    resolvedServer,
    downloadProgress,
    downloadAll,
    downloadSingle,
    loadThumbnail,
    loadFullImage,
  };
}
```

- [ ] **Step 2: Rewrite useAlbumViewer.test.ts**

Key test cases:
1. "fetches manifest from Blossom using hash and xs hint"
2. "decrypts and validates manifest"
3. "sets status to error when manifest not found"
4. "sets status to error when key is missing from fragment"
5. "loadThumbnail fetches and decrypts thumbnail blob"
6. "loadFullImage fetches and decrypts full-size blob"

Mock `resolveAndFetch`, `decryptAndValidateManifest`, `importKeyFromBase64url`, and `decryptBlob`.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/hooks/useAlbumViewer.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAlbumViewer.ts src/hooks/useAlbumViewer.test.ts
git commit -m "feat: rewrite useAlbumViewer for Blossom-only manifest fetch"
```

---

## Task 8: Simplify useSettings — remove relay state

**Files:**
- Modify: `src/hooks/useSettings.ts`
- Modify: `src/hooks/useSettings.test.ts`

- [ ] **Step 1: Remove relay state from useSettings.ts**

Remove all relay-related code. The hook should only manage `blossomServer`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_BLOSSOM_SERVER } from '@/lib/config';

export interface UseSettingsReturn {
  blossomServer: string;
  setBlossomServer: (url: string) => Promise<void>;
  blossomError: string | null;
  isValidating: boolean;
}

export function useSettings(): UseSettingsReturn {
  const [blossomServer, setBlossomServerState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('blossom-server');
      if (stored) return stored;
    } catch {
      // localStorage unavailable (SSR) — fall back to default
    }
    return DEFAULT_BLOSSOM_SERVER;
  });

  const [blossomError, setBlossomError] = useState<string | null>(null);
  const [isValidating] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('blossom-server', blossomServer);
    } catch {
      // localStorage unavailable — ignore
    }
  }, [blossomServer]);

  const setBlossomServer = async (url: string): Promise<void> => {
    setBlossomError(null);
    setBlossomServerState(url);
  };

  return {
    blossomServer,
    setBlossomServer,
    blossomError,
    isValidating,
  };
}
```

- [ ] **Step 2: Update useSettings.test.ts**

Remove all relay-related tests. Keep only blossom server tests.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/hooks/useSettings.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSettings.ts src/hooks/useSettings.test.ts
git commit -m "refactor: remove relay state from useSettings"
```

---

## Task 9: Update UI components

**Files:**
- Modify: `src/components/upload/SettingsPanel.tsx`
- Modify: `src/components/upload/UploadPanel.tsx`
- Modify: `src/components/upload/ShareCard.tsx`

- [ ] **Step 1: Remove relay UI from SettingsPanel**

Remove the entire "Relays section" `<div>` block (lines 57-78 of current SettingsPanel.tsx) that contains the relay textarea. Keep only the Blossom Server section.

- [ ] **Step 2: Update UploadPanel text and props**

In `src/components/upload/UploadPanel.tsx`:

1. Remove `relays` from the `startUpload` settings object (line 32 — remove `relays: settings.relays,`)
2. Update the subtitle text from "Encrypted photo albums on Nostr. Nothing leaves your device unencrypted." to "Encrypted photo albums. Nothing leaves your device unencrypted."
3. Update the button text from `Upload {n} photo{s} to Nostr` to `Upload {n} photo{s}`

- [ ] **Step 3: Update ShareCard spinner text**

In `src/components/upload/ShareCard.tsx`, change "Publishing to Nostr..." to "Uploading..."

- [ ] **Step 4: Verify build compiles**

Run: `npx next build`
Expected: Build succeeds (we'll fix remaining errors — this is a smoke check)

- [ ] **Step 5: Commit**

```bash
git add src/components/upload/SettingsPanel.tsx src/components/upload/UploadPanel.tsx src/components/upload/ShareCard.tsx
git commit -m "refactor: remove relay UI, update text for Blossom-only"
```

---

## Task 10: Create new viewer route, update ViewerPanel and Lightbox

**Files:**
- Delete: `src/app/view/[naddr]/page.tsx`
- Create: `src/app/[hash]/page.tsx`
- Modify: `src/components/viewer/ViewerPanel.tsx`
- Modify: `src/components/viewer/Lightbox.tsx`
- Modify: `src/components/viewer/Lightbox.test.tsx`

- [ ] **Step 1: Create new route**

Create `src/app/[hash]/page.tsx`:

```typescript
"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const ViewerPanel = dynamic(
  () => import("@/components/viewer/ViewerPanel"),
  { ssr: false, loading: () => <p>Loading...</p> },
);

interface Props {
  params: Promise<{ hash: string }>;
}

export default function ViewerPage({ params }: Props) {
  const { hash } = use(params);
  return <ViewerPanel hash={hash} />;
}
```

- [ ] **Step 2: Update ViewerPanel to accept hash**

In `src/components/viewer/ViewerPanel.tsx`:

1. Change props from `{ naddr: string }` to `{ hash: string }`
2. Change `useAlbumViewer({ naddr })` to `useAlbumViewer({ hash })`
3. Change `blossomServer` references to `resolvedServer` (check the `viewer` return object matches the updated hook)
4. Update the `handleDownloadAll` and `handleDownloadSingle` to pass `viewer.resolvedServer ?? ''` instead of `viewer.blossomServer`

- [ ] **Step 3: Update Lightbox prop**

In `src/components/viewer/Lightbox.tsx`: rename the `blossomServer` prop to `resolvedServer` in the interface and all internal references. In `src/components/viewer/Lightbox.test.tsx`: update the test fixtures to use `resolvedServer` instead of `blossomServer`.

- [ ] **Step 4: Delete old route**

```bash
rm src/app/view/[naddr]/page.tsx
rmdir src/app/view/[naddr]
rmdir src/app/view
```

- [ ] **Step 5: Commit**

```bash
git add src/app/[hash]/page.tsx src/components/viewer/ViewerPanel.tsx src/components/viewer/Lightbox.tsx src/components/viewer/Lightbox.test.tsx
git rm src/app/view/[naddr]/page.tsx
git commit -m "feat: replace naddr route with hash-based route, update Lightbox prop"
```

---

## Task 11: Delete Nostr modules, fetch.ts, and remove unused dependencies

**Files:**
- Delete: `src/lib/nostr/event.ts`, `src/lib/nostr/event.test.ts`
- Delete: `src/lib/nostr/naddr.ts`
- Delete: `src/lib/nostr/viewer.ts`, `src/lib/nostr/viewer.test.ts`
- Delete: `src/lib/blossom/fetch.ts`, `src/lib/blossom/fetch.test.ts` (replaced by resolve.ts)

- [ ] **Step 1: Delete Nostr files**

```bash
rm src/lib/nostr/event.ts src/lib/nostr/event.test.ts
rm src/lib/nostr/naddr.ts
rm src/lib/nostr/viewer.ts src/lib/nostr/viewer.test.ts
rmdir src/lib/nostr
rm src/lib/blossom/fetch.ts src/lib/blossom/fetch.test.ts
```

- [ ] **Step 2: Remove unused npm dependencies**

```bash
npm uninstall applesauce-core applesauce-loaders applesauce-relay
```

Keep: `applesauce-signers`, `applesauce-factory`, `nostr-tools` (needed for BUD-11 auth).

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass. No imports reference deleted modules.

- [ ] **Step 4: Build check**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Nostr relay modules and unused dependencies"
```

---

## Task 12: Final integration verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Grep for stale references**

Search for any remaining references to removed modules/concepts:

```bash
# Should return no results:
grep -r "nostr/event" src/ --include="*.ts" --include="*.tsx"
grep -r "nostr/naddr" src/ --include="*.ts" --include="*.tsx"
grep -r "nostr/viewer" src/ --include="*.ts" --include="*.tsx"
grep -r "DEFAULT_RELAYS" src/ --include="*.ts" --include="*.tsx"
grep -r "ALBUM_EXPIRY" src/ --include="*.ts" --include="*.tsx"
grep -r "applesauce-relay" src/ --include="*.ts" --include="*.tsx"
grep -r "applesauce-loaders" src/ --include="*.ts" --include="*.tsx"
grep -r "RelayPool" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 4: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final cleanup — verify no stale references"
```
