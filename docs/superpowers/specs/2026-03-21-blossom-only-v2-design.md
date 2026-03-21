# Blossom-Only Photo Share v2

## Problem

The current architecture uses Nostr relays to store an encrypted album manifest (kind 30078 event). This adds complexity: relay pool management, NIP-19 encoding, event signing/publishing, relay availability concerns, and multiple Nostr-specific dependencies. The actual photo blobs already live on Blossom.

## Solution

Eliminate the Nostr relay layer. Upload the encrypted manifest as a Blossom blob alongside the photos. The share URL points to the manifest blob by SHA-256 hash, with the decryption key in the URL fragment.

## URL Format

```
https://photoshare.app/{64-char-hex-hash}?xs=tempstore.apps3.slidestr.net#{base64urlKey}
```

- **Path segment**: SHA-256 hex hash of the encrypted manifest blob
- **Query param `xs`** (optional): Blossom server domain hint (https assumed). Included by default in generated URLs. If omitted or server unreachable, fall back to a hardcoded list of known Blossom servers.
- **Fragment**: Base64url-encoded AES-256-GCM decryption key. Never sent to any server.

## Encryption: IV-Prepend Pattern

All encrypted blobs (manifest, photos, thumbnails) use the same format:

```
[12 bytes IV] [AES-256-GCM ciphertext + 16-byte auth tag]
```

- Fresh random 12-byte IV per blob
- IV prepended to ciphertext before upload
- On decrypt: slice first 12 bytes as IV, decrypt remainder
- Single universal encrypt/decrypt function for all blob types

This eliminates separate IV storage. No `iv` or `thumbIv` fields in the manifest.

## Data Models

### AlbumManifest

```typescript
interface AlbumManifest {
  v: 1;
  title?: string;
  createdAt: string;   // ISO 8601
  photos: PhotoEntry[];
}
```

### PhotoEntry

```typescript
interface PhotoEntry {
  hash: string;       // SHA-256 hex of encrypted full-size blob (IV || ciphertext)
  thumbHash: string;  // SHA-256 hex of encrypted thumbnail blob (IV || ciphertext)
  width: number;      // Original image dimensions
  height: number;
  filename: string;   // Original filename for download
}
```

## Upload Flow

1. **Image processing** (unchanged): Web Worker converts to WebP, generates thumbnails, captures dimensions.
2. **Encrypt + upload photos** (p-limit 3 concurrency): For each photo:
   - `fullBlob = IV || encrypt(full-size)` — fresh 12-byte IV prepended
   - `thumbBlob = IV || encrypt(thumbnail)` — fresh 12-byte IV prepended
   - `hash = SHA-256(fullBlob)` — hash computed on the **complete blob** (IV + ciphertext), not ciphertext alone
   - `thumbHash = SHA-256(thumbBlob)`
   - Upload each blob to Blossom with BUD-11 auth (hash passed to auth header before upload)
   - Verify server-returned hash matches locally computed hash
   - Record `{ hash, thumbHash, width, height, filename }` in photo list
3. **Build manifest**: `{ v: 1, title?, createdAt, photos: [...] }`
4. **Encrypt + upload manifest**:
   - Serialize manifest to JSON, encode as UTF-8
   - `manifestBlob = IV || encrypt(jsonBytes)` — fresh 12-byte IV prepended
   - `manifestHash = SHA-256(manifestBlob)` — computed locally before upload (required for BUD-11 auth header)
   - Upload to Blossom with BUD-11 auth
5. **Generate share URL**: `/{manifestHash}?xs={serverDomain}#{exportedKeyBase64url}`

## Viewer Flow

1. **Parse URL**: Extract manifest hash from path, optional `xs` domain from query, decryption key from fragment.
2. **Resolve server + fetch manifest**:
   - If `xs` present: try `https://{xs}/{manifestHash}`
   - If fails or missing: try each server in `DEFAULT_BLOSSOM_SERVERS[]`
   - First successful fetch wins; remember which server responded (likely has all blobs)
3. **Decrypt manifest**: Slice first 12 bytes as IV, decrypt rest with key, parse JSON.
4. **Validate manifest**:
   - Verify parsed JSON has `v` field. If `v !== 1`, show "unsupported album version" error.
   - Verify `photos` is a non-empty array.
   - Verify each entry has required fields: `hash` (64-char hex), `thumbHash` (64-char hex), `width` (positive int), `height` (positive int), `filename` (non-empty string).
   - Reject manifest and show error if validation fails. Do not silently skip malformed entries.
5. **Load thumbnails** (lazy, IntersectionObserver): Fetch `https://{server}/{thumbHash}`, decrypt (IV-prepend), create object URL.
6. **Load full images** (on lightbox open): Same pattern with `hash`.
7. **Download all**: Batch fetch + decrypt, ZIP or individual files.

## Blossom Server Resolution

```
function resolveAndFetch(hash, xsHint?):
  servers = xsHint ? [`https://${xsHint}`, ...DEFAULT_BLOSSOM_SERVERS] : DEFAULT_BLOSSOM_SERVERS
  for server in servers:
    response = GET `${server}/${hash}`
    if response.ok: return { data: response.arrayBuffer(), server }
  throw BlobNotFoundError
```

Resolution and fetching are combined into one step — the GET returns the blob data. For photos and thumbnails this is the intended behavior (we need the data). No separate HEAD-based discovery step; the first server that responds with the blob wins.

Once the manifest is fetched from a server, photo fetches try that server first (it likely hosts all blobs from the same upload).

### Partial album failure

If individual photo blobs are missing (expired or server error), the viewer should:
- Show a placeholder/error state for that photo in the grid
- Continue loading remaining photos
- Not fail the entire album

If the manifest blob itself is missing from all servers, show "Album not found or expired."

## What Gets Removed

- **`src/lib/nostr/event.ts`** — kind 30078 event builder
- **`src/lib/nostr/naddr.ts`** — NIP-19 encoding/decoding
- **`src/lib/nostr/viewer.ts`** — relay-based event loading
- **Dependencies removed**: `applesauce-relay`, `applesauce-loaders`, `applesauce-core`
- **Dependencies retained**: `applesauce-signers` (PrivateKeySigner for BUD-11 auth), `applesauce-factory` (event building for BUD-11 auth), `nostr-tools` (transitive dependency of applesauce packages)
- **Relay configuration** in SettingsPanel and useSettings
- **Relay pool management** in useUpload
- **`src/app/view/[naddr]/`** route — replaced by `src/app/[hash]/`

## What Stays (Unchanged)

- **Ephemeral signer** (`src/lib/nostr/signer.ts`): Still needed for BUD-11 auth. Move from `src/lib/nostr/` to `src/lib/blossom/` since it's now purely a Blossom concern.
- **Image processing pipeline**: Web Worker, HEIC detection, WebP conversion, thumbnail generation.
- **Blossom upload/fetch**: `src/lib/blossom/upload.ts`, `src/lib/blossom/fetch.ts`, `src/lib/blossom/validate.ts`.
- **UI structure**: UploadPanel, DropZone, ProgressList, ThumbnailGrid, Lightbox, DownloadProgress.
- **Zustand stores**: processingStore, uploadStore.

## What Changes

### `src/lib/crypto.ts`
- `encrypt(key, data)` → returns `Uint8Array(IV || ciphertext)` (currently returns `{ ciphertext, iv }`)
- `decrypt(key, blob)` → reads IV from first 12 bytes, decrypts rest (currently takes separate IV param)
- Remove `exportIvToBase64url` / `importIvFromBase64url` helpers

### `src/types/album.ts`
- `PhotoEntry`: remove `iv`, `thumbIv` fields
- `AlbumManifest`: add `v: 1` field

### `src/hooks/useUpload.ts`
- Remove relay pool initialization and event publishing
- After photo uploads: encrypt manifest → upload to Blossom → generate URL
- URL generation: simple string concat instead of NIP-19 encoding

### `src/hooks/useAlbumViewer.ts`
- Replace relay-based event loading with Blossom fetch
- Parse hash from URL path, xs from query params, key from fragment
- Server resolution with fallback list

### `src/hooks/useSettings.ts`
- Remove relay list state and persistence
- Keep Blossom server configuration

### `src/components/upload/SettingsPanel.tsx`
- Remove relay list UI section

### `src/app/view/[naddr]/page.tsx` → `src/app/[hash]/page.tsx`
- Rename route segment
- Pass hash (not naddr) to ViewerPanel

### `src/components/upload/ShareCard.tsx`
- Update URL display/copy logic for new format (was naddr-based)

### `src/lib/config.ts`
- Remove `DEFAULT_RELAYS`
- Remove `ALBUM_EXPIRY_SECONDS` (was for Nostr event expiration)
- Keep `BLOSSOM_EXPIRY_SECONDS` (blob TTL on Blossom server)
- Add `DEFAULT_BLOSSOM_SERVERS` (array of fallback servers for resolution)
- Keep `DEFAULT_BLOSSOM_SERVER` (upload target)

## Security Properties (Preserved)

- AES-256-GCM encryption with fresh random IV per blob
- One key per album, never reused across albums (nonce collision risk at ~2^48 encryptions — a 200-photo album uses ~401 encryptions, well within safe bounds)
- Decryption key only in URL fragment (never sent to server)
- Ephemeral signer (no persistent identity)
- SHA-256 hash verification on upload
- EXIF stripped by Canvas pipeline
- GCM auth tag prevents tampering — a compromised Blossom server substituting blob data would cause decryption to fail
- The `xs` query param leaks which server hosts the content to anyone who sees the URL (browser history, referrer headers). Accepted trade-off for usability; users can strip it for privacy.

## Migration

No backward compatibility needed. This is a clean replacement (option A). Existing links using the naddr format will stop working. The `view/[naddr]` route is removed entirely.
