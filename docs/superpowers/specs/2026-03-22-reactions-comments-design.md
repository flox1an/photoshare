# Reactions & Comments — Design Spec

**Date:** 2026-03-22
**Status:** Draft

---

## Overview

Add opt-in reactions (likes) and comments to photo albums using NIP-59 Gift Wrap. The feature is disabled by default; the album uploader explicitly enables it. When enabled, viewers can react and comment on individual photos — either anonymously or with a Nostr identity. The album viewer shows reaction/comment indicators in the masonry grid and a full feed in the lightbox.

Privacy model: all interaction content is encrypted inside NIP-59 gift wraps. To a Nostr relay the published events are indistinguishable from ordinary encrypted DMs (kind 1059). Only someone with the album share link can decrypt and attribute them.

---

## URL Scheme Change (v2)

The existing v1 URL stores a random AES-256 key in the fragment:

```
/abc123...#{aesKeyB64url}        ← v1: raw AES key in fragment
```

v2 replaces this with a Nostr **nsec** (secp256k1 private key, 32 bytes, base64url-encoded). The AES key is then derived from the nsec:

```
/abc123...#{nsecB64url}          ← v2: nsec in fragment, AES key derived
```

### Why this unifies the design

The nsec serves three roles with a single value in the URL:

| Role | How |
|---|---|
| AES decryption key | `HKDF-SHA256(nsec, info="photoshare-aes-v2")` |
| Gift wrap recipient key | `secp256k1_pubkey(nsec)` → the `p` tag in all gift wraps |
| Gift wrap decryption key | nsec directly, via NIP-44 |

There is no separate reaction keypair. No private key needs to be stored in the manifest. The album identity, its decryption capability, and its reaction inbox are all the same thing.

### AES key derivation

```
albumAESKey = HKDF-SHA256(
  ikm  = nsecBytes,               // 32 bytes from URL fragment
  salt = [],                      // empty; nsec has sufficient entropy
  info = "photoshare-aes-v2",
  len  = 32
)
```

Implemented via Web Crypto `importKey` + `deriveBits` with HKDF algorithm.

### Versioning

`AlbumManifest.v` is bumped to `2` for albums using the new scheme. The viewer checks `v` after decryption:
- `v: 1` — fragment is raw AES key; use directly (legacy read-only support).
- `v: 2` — fragment is nsec; derive AES key before use.

v1 albums remain readable; they simply have no reactions capability.

---

## Key Design Decisions

### Album nsec as unified credential

The nsec in the URL is a throwaway keypair — it has no connection to the uploader's real Nostr identity. It is generated freshly for every album upload, exactly as the AES key was before. The only change is what gets stored in the URL and what gets derived from it.

- **Why not the uploader's real nsec?** It would expose their full Nostr identity to anyone they share the link with, and allow any link recipient to sign events as the uploader. The per-album throwaway nsec carries none of that risk.
- **Why not keep a separate reaction keypair in the manifest?** The nsec already ends up in the share URL. Deriving the reaction keypair from it means one value does everything — no key material to embed, rotate, or lose.

### Gift Wrap Routing

All gift wraps are addressed to `secp256k1_pubkey(nsec)` in the `p` tag. The viewer:
1. Reads `nsecBytes` from the URL fragment.
2. Derives `albumPubkey = secp256k1_pubkey(nsecBytes)`.
3. Queries configured relays: `{"kinds":[1059],"#p":["<albumPubkey>"]}`
4. Decrypts each gift wrap using `nsecBytes` as the recipient key.
5. Groups rumors by `img` tag to associate with individual photos.

### Anonymous vs Identified Comments

| Mode | Rumor `pubkey` | Seal signing key |
|---|---|---|
| Anonymous | Ephemeral (throwaway) | Same ephemeral key |
| Identified (NIP-07 / bunker) | User's real pubkey | User's real key |

The gift wrap outer layer is always signed by a fresh ephemeral key — NIP-59 standard. The relay never learns who sent it.

An identified commenter's real pubkey appears in the rumor and seal, visible to anyone who can decrypt (i.e., anyone with the share link). Not visible to the relay.

---

## Album Manifest Changes

`AlbumManifest.v` becomes `2`. The `reactions` field is simplified — no key material needed:

```ts
interface AlbumReactionConfig {
  /** NIP-59 relay URLs to publish/query gift wraps */
  relays: string[];
}

interface AlbumManifest {
  v: 2;
  title?: string;
  createdAt: string;
  photos: PhotoEntry[];
  /** Present only when uploader enabled reactions/comments */
  reactions?: AlbumReactionConfig;
}
```

The album pubkey and privkey are derived at runtime from the nsec in the URL — they are never stored anywhere.

When `reactions` is absent the viewer renders no UI for interactions and makes no relay queries.

---

## Event Structure

### Rumor — Reaction (kind 7)

```json
{
  "kind": 7,
  "pubkey": "<reactor_pubkey_or_ephemeral>",
  "created_at": 1234567890,
  "tags": [
    ["img", "<photo_encrypted_blob_hash>"],
    ["album", "<manifest_hash>"]
  ],
  "content": "+"
}
```

`content` follows NIP-25: `"+"` for like. May also be an emoji (`"🔥"`, etc.).

### Rumor — Comment (kind 1)

```json
{
  "kind": 1,
  "pubkey": "<commenter_pubkey_or_ephemeral>",
  "created_at": 1234567890,
  "tags": [
    ["img", "<photo_encrypted_blob_hash>"],
    ["album", "<manifest_hash>"]
  ],
  "content": "Great shot!"
}
```

### Seal (kind 13)

```json
{
  "kind": 13,
  "pubkey": "<sender_real_or_ephemeral_pubkey>",
  "created_at": <jittered_timestamp>,
  "tags": [],
  "content": "<NIP-44 encrypted rumor JSON>",
  "sig": "<sender signs this>"
}
```

Encryption key: NIP-44 shared secret between sender privkey and `albumPubkey`.
Timestamp jittered ±2 days per NIP-59.

### Gift Wrap (kind 1059) — published to relay

```json
{
  "kind": 1059,
  "pubkey": "<ephemeral_pubkey>",
  "created_at": <jittered_timestamp>,
  "tags": [
    ["p", "<albumPubkey>"]
  ],
  "content": "<NIP-44 encrypted seal JSON>",
  "sig": "<ephemeral key signs this>"
}
```

Encryption key: NIP-44 shared secret between ephemeral privkey and `albumPubkey`.
Fresh ephemeral keypair generated per gift wrap regardless of sender identity.

---

## Unwrap Flow (Viewer Reads Reactions)

```
1. Parse URL fragment → nsecBytes (base64url decode)
2. Derive albumAESKey via HKDF (for manifest decryption)
3. Decrypt manifest → read reactions.relays
4. Derive albumPubkey = secp256k1_pubkey(nsecBytes)
5. Subscribe on reactions.relays: {"kinds":[1059], "#p":["<albumPubkey>"]}
6. For each gift wrap event received:
   a. Compute NIP-44 secret: nsecBytes × giftWrap.pubkey
   b. Decrypt giftWrap.content → seal JSON
   c. Compute NIP-44 secret: nsecBytes × seal.pubkey
   d. Decrypt seal.content → rumor JSON
   e. Validate: check kind (7 or 1), check img tag hash exists in manifest.photos
   f. Store: Map<photoHash, { reactions: Rumor[], comments: Rumor[] }>
7. Update UI reactively as subscription delivers events
```

Ignore / discard:
- Gift wraps that fail decryption.
- Rumors with `img` hashes not in the manifest (wrong album or garbage).
- Duplicate rumors (same content + pubkey + timestamp within 1s).

---

## Publish Flow (Viewer Sends Reaction or Comment)

```
1. User clicks ❤️ or submits comment text
2. Determine sender identity:
   - If not logged in → generate ephemeral keypair (anonymous)
   - If logged in (NIP-07 / bunker) → use account signer
3. Derive albumPubkey from nsecBytes
4. Build rumor (unsigned, no id)
5. Sign seal:
   - Sender signs kind 13, NIP-44 encrypts rumor (key: senderPriv × albumPubkey)
   - Jitter created_at ±2 days
6. Wrap gift:
   - Generate fresh ephemeral keypair
   - Ephemeral key signs kind 1059, NIP-44 encrypts seal (key: ephemeralPriv × albumPubkey)
   - Jitter created_at ±2 days
7. Publish gift wrap to all relays in manifest.reactions.relays
```

---

## Upload Panel Changes

### New Setting: Enable Reactions & Comments

Add a toggle to the upload settings panel (alongside existing Blossom server / keep originals / expiry settings):

```
[ ] Enable reactions & comments
    Viewers can like and comment on photos.
    Interactions are end-to-end encrypted.
```

When toggled on, reveal a relay configuration sub-section:

```
Reaction relays
[wss://relay.damus.io        ] [×]
[wss://nos.lol               ] [×]
[+ Add relay]
```

Default reaction relay (pre-filled):
```
wss://nos.lol
```

### Changes to `startUpload`

The upload flow changes as follows for v2:

1. **Generate album nsec** (32 random bytes, valid secp256k1 scalar) instead of a random AES key.
2. **Derive AES key** via HKDF from the nsec before use.
3. **If reactions enabled:** embed `reactions: { relays }` in the manifest — no keypair fields needed.
4. **Build share URL:** fragment = `base64url(nsecBytes)` instead of `base64url(aesKeyBytes)`.

No `generateReactionKeypair()` function is needed. The nsec generation replaces what was formerly AES key generation.

---

## Viewer Panel Changes

### URL Parsing

`useAlbumLoader` (or equivalent) is updated to:
1. Base64url-decode the fragment → `nsecBytes`.
2. Run HKDF to get `albumAESKey`.
3. Detect manifest `v` field after decryption; fall back to treating fragment as raw AES key if `v: 1`.

### Login Entry Point

When `manifest.reactions` is present, the viewer shows a login affordance for identified commenting. Reuses existing `LoginDialog` and `nostrAccountStore`.

Viewers who are not logged in can still react/comment anonymously.

### Masonry Grid — Reaction Indicator

Photos with at least one reaction or comment show a small overlay badge:

```
┌──────────────────┐
│                  │
│   [thumbnail]    │
│                  │
│ 💬 3  ❤ 7        │  ← absolute bottom-1 left-1, semi-transparent pill
└──────────────────┘
```

- Shows only counts. Updates live as subscription delivers events.
- Hidden entirely when `manifest.reactions` is absent.

### Lightbox — Comments & Reactions Panel

Desktop: side panel slides in from the right, toggled by a toolbar button.
Mobile: bottom sheet (partial height, scrollable).

```
┌─────────────────────────────┐
│  Reactions                  │
│  ❤ 7   🔥 2   😍 1          │  ← grouped by emoji, sorted by count
│─────────────────────────────│
│  Comments                 3 │
│  [anon]  Great shot!  2m    │
│  npub1ab…  Love it!   5m    │
│  [anon]  Where is this? 1h  │
│─────────────────────────────│
│  [             ] [Send]     │
│  [Sign in to identify] or   │
│  leave anonymously          │
└─────────────────────────────┘
```

- Anonymous: display as `[anon]`.
- Identified: truncated npub (`npub1abc…xyz`), no profile fetch.
- Timestamps: relative (`2m`, `1h`, `3d`). Comments oldest-first.
- Panel button hidden when `manifest.reactions` absent.

---

## New Files

### `src/lib/nostr/nip59.ts`

```ts
export async function createGiftWrap(
  rumor: UnsignedRumor,
  senderSigner: ISigner | null,  // null → anonymous ephemeral
  recipientPubkey: string        // albumPubkey derived from nsec
): Promise<NostrEvent>           // signed kind 1059, ready to publish

export async function unwrapGiftWrap(
  giftWrap: NostrEvent,
  recipientPrivkey: Uint8Array   // nsecBytes from URL fragment
): Promise<Rumor>
```

### `src/lib/crypto.ts` (additions)

```ts
// Derive album AES key from nsec bytes
export async function deriveAlbumAESKey(nsecBytes: Uint8Array): Promise<CryptoKey>

// Generate a fresh album nsec (random valid secp256k1 scalar)
export function generateAlbumNsec(): Uint8Array

// Derive Nostr pubkey (hex) from nsec bytes
export function nsecToPubkey(nsecBytes: Uint8Array): string
```

### `src/hooks/useReactions.ts`

```ts
export function useReactions(
  manifest: AlbumManifest | null,
  nsecBytes: Uint8Array | null
): {
  reactionsByPhoto: Map<string, PhotoReactions>;
  react: (photoHash: string, content: string) => Promise<void>;
  comment: (photoHash: string, text: string) => Promise<void>;
  loading: boolean;
}
```

- No-ops if `manifest.reactions` absent or `nsecBytes` null.
- Opens `SimplePool` subscription on mount, closes on unmount.

### `src/components/viewer/ReactionsPanel.tsx`

Side panel / bottom sheet. Receives `PhotoReactions | undefined` and `nsecBytes`. Contains comment input.

### `src/components/viewer/ReactionsBadge.tsx`

Overlay badge. Props: `{ reactions: number; comments: number }`. Returns `null` when both zero.

---

## Modified Files

| File | Change |
|---|---|
| `src/types/album.ts` | Add `AlbumReactionConfig` (relays only); `AlbumManifest.v: 1 \| 2`; add `reactions?` |
| `src/lib/crypto.ts` | Add `deriveAlbumAESKey`, `generateAlbumNsec`, `nsecToPubkey` |
| `src/hooks/useUpload.ts` | Generate nsec instead of AES key; derive AES; embed `reactions` in manifest when enabled |
| `src/hooks/useAlbumLoader.ts` | Decode nsec from fragment; derive AES key; pass nsecBytes down |
| `src/components/upload/UploadPanel.tsx` | Add reactions toggle + relay list editor to settings panel |
| `src/components/viewer/ThumbnailGrid.tsx` | Render `<ReactionsBadge>` overlays |
| `src/components/viewer/Lightbox.tsx` | Add reactions panel toggle button; render `<ReactionsPanel>` |

---

## New Dependencies

None. `nostr-tools` 2.23.3 ships NIP-44, and secp256k1 pubkey derivation (`getPublicKey`) is already available. HKDF is native Web Crypto.

---

## Relay Behavior

Gift wraps (kind 1059) are indistinguishable from encrypted DMs to relays. The album pubkey is fresh per album and unlinked from any user identity — relay operators cannot correlate activity across albums or link it to any known pubkey.

---

## Migration / Backward Compatibility

| Scenario | Behavior |
|---|---|
| Opening a v1 URL | Viewer detects `manifest.v === 1` after decryption; no reactions UI shown; fragment treated as raw AES key |
| Opening a v2 URL | Fragment decoded as nsec; AES key derived; reactions available if `manifest.reactions` present |
| v1 album, reactions query | Never happens — reactions UI only shown for v2 manifests |

No re-encoding or migration of existing share links is required.

---

## Out of Scope

- Moderation / deleting others' comments.
- Reactions to the album as a whole (only per-photo).
- Push notifications for new reactions.
- Reply threading on comments.
- Comment editing or deletion by the sender.
- Reaction sender avatars or display names.
- Rate limiting / spam protection (trust model: share link = access).
