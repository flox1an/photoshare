# Reactions & Comments — Design Spec

**Date:** 2026-03-22
**Status:** Draft

---

## Overview

Add opt-in reactions (likes) and comments to photo albums using NIP-59 Gift Wrap. The feature is disabled by default; the album uploader explicitly enables it. When enabled, viewers can react and comment on individual photos — either anonymously or with a Nostr identity. The album viewer shows reaction/comment indicators in the masonry grid and a full feed in the lightbox.

Privacy model: all interaction content is encrypted inside NIP-59 gift wraps. To a Nostr relay the published events are indistinguishable from ordinary encrypted DMs (kind 1059). Only someone with the album share link can decrypt and attribute them.

---

## Key Design Decisions

### Album Reaction Keypair (not the uploader's identity)

A dedicated keypair is generated for each album at upload time and stored in the encrypted manifest. This keypair is the routing target for all gift wraps.

- **Why not the uploader's pubkey?** Uploaders may use ephemeral signers and have no persistent Nostr identity. We cannot guarantee a real pubkey exists.
- **Why not derive from the AES key?** HKDF over a symmetric key into secp256k1 is non-standard and creates an odd coupling. A fresh keypair is cleaner.
- **Security:** The reaction private key lives inside the encrypted manifest. Anyone with the share link (and thus the AES key) can decrypt the manifest and therefore decrypt all gift wraps. This is intentional — the share link is the access credential.

### Gift Wrap Routing

All gift wraps are addressed to the album's reaction pubkey (`p` tag). The viewer:
1. Extracts `reactionPrivkey` from the decrypted manifest.
2. Queries configured relays: `{"kinds":[1059],"#p":["<reactionPubkey>"]}`
3. Decrypts each gift wrap → seal → rumor.
4. Groups rumors by `img` tag (encrypted blob hash) to associate with individual photos.

### Anonymous vs Identified Comments

| Mode | Rumor `pubkey` | Seal signing key |
|---|---|---|
| Anonymous | Ephemeral (throwaway) | Same ephemeral key |
| Identified (NIP-07 / bunker) | User's real pubkey | User's real key |

In both cases the gift wrap outer layer is always signed by a fresh ephemeral key — this is the NIP-59 standard. The relay never learns who sent it.

An identified commenter's real pubkey appears in the *rumor* and *seal*, meaning it is visible to anyone who can decrypt (i.e., anyone with the share link). It is not visible to the relay.

---

## Album Manifest Changes

Add an optional `reactions` field to `AlbumManifest`:

```ts
interface AlbumReactionConfig {
  /** NIP-59 relay URLs to publish/query gift wraps */
  relays: string[];
  /** Hex public key — included in gift wrap `p` tags; safe to expose */
  pubkey: string;
  /** Hex private key — kept inside the encrypted manifest, never in the URL */
  privkey: string;
}

interface AlbumManifest {
  v: 1;
  title?: string;
  createdAt: string;
  photos: PhotoEntry[];
  /** Present only when uploader enabled reactions/comments */
  reactions?: AlbumReactionConfig;
}
```

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

Encryption key: NIP-44 shared secret between sender privkey and album `reactionPubkey`.
Timestamp is jittered ±2 days per NIP-59.

### Gift Wrap (kind 1059) — published to relay

```json
{
  "kind": 1059,
  "pubkey": "<ephemeral_pubkey>",
  "created_at": <jittered_timestamp>,
  "tags": [
    ["p", "<album_reactionPubkey>"]
  ],
  "content": "<NIP-44 encrypted seal JSON>",
  "sig": "<ephemeral key signs this>"
}
```

Encryption key: NIP-44 shared secret between ephemeral privkey and album `reactionPubkey`.
A fresh ephemeral keypair is generated for every gift wrap, regardless of sender identity.

---

## Unwrap Flow (Viewer Reads Reactions)

```
1. Decrypt manifest → extract reactionPrivkey + relays
2. Subscribe: {"kinds":[1059], "#p":["<reactionPubkey>"]}
3. For each gift wrap event received:
   a. Compute NIP-44 secret: reactionPrivkey × giftWrap.pubkey
   b. Decrypt giftWrap.content → seal JSON
   c. Compute NIP-44 secret: reactionPrivkey × seal.pubkey
   d. Decrypt seal.content → rumor JSON
   e. Validate rumor: check kind (7 or 1), check img tag hash is in manifest photos
   f. Store: Map<photoHash, { reactions: Rumor[], comments: Rumor[] }>
4. Update UI reactively as subscription delivers events
```

Ignore / discard:
- Gift wraps that fail decryption.
- Rumors with `img` hashes not present in the manifest (garbage or wrong album).
- Duplicate rumors (same content + pubkey + timestamp within 1s).

---

## Publish Flow (Viewer Sends Reaction or Comment)

```
1. User clicks ❤️ or submits comment text
2. Determine sender identity:
   - If not logged in → generate ephemeral keypair for this rumor
   - If logged in (NIP-07 / bunker) → use account signer
3. Build rumor (unsigned, no id)
4. Sign seal:
   - sender signs kind 13 with NIP-44 encrypted rumor (key: senderPriv × reactionPubkey)
   - Jitter created_at ±2 days
5. Wrap gift:
   - Generate fresh ephemeral keypair
   - Ephemeral key signs kind 1059 with NIP-44 encrypted seal (key: ephemeralPriv × reactionPubkey)
   - Jitter created_at ±2 days
6. Publish gift wrap to all relays in manifest.reactions.relays
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

Default reaction relays (pre-filled):
```
wss://relay.damus.io
wss://nos.lol
wss://relay.nostr.band
```

When `startUpload` runs:
- If reactions enabled: `generateReactionKeypair()` → `{ privkey, pubkey }` → include in manifest as `reactions: { relays, pubkey, privkey }`.
- If reactions disabled: omit `reactions` field entirely.

---

## Viewer Panel Changes

### Login Entry Point

When `manifest.reactions` is present, the viewer shows a login affordance for identified commenting. This reuses the existing `LoginDialog` and `nostrAccountStore` (from the Nostr Login spec).

Viewers who are not logged in can still react/comment anonymously.

### Masonry Grid — Reaction Indicator

After reactions are loaded, photos with at least one reaction or comment show a small overlay badge in the bottom-left corner of the thumbnail:

```
┌──────────────────┐
│                  │
│   [thumbnail]    │
│                  │
│ 💬 3  ❤ 7        │  ← overlay, only shown when count > 0
└──────────────────┘
```

- Semi-transparent dark pill, small text, positioned `absolute bottom-1 left-1`.
- Icons: a chat bubble for comments, a heart for reactions.
- Show only counts (not avatars or names) — keeps the masonry view clean.
- Counts update live as the subscription delivers new events.

### Lightbox — Comments & Reactions Panel

On desktop: a side panel slides in from the right when the user opens the reactions view (toggled by a button in the lightbox toolbar).

On mobile: a bottom sheet (partial height, scrollable).

**Panel layout:**

```
┌─────────────────────────────┐
│  Reactions                  │
│  ❤ 7   🔥 2   😍 1          │  ← emoji reaction summary row
│─────────────────────────────│
│  Comments                 3 │
│  ──────────────────────     │
│  [anon]  Great shot!  2m    │
│  npub1ab…  Love it!   5m    │
│  [anon]  Where is this? 1h  │
│─────────────────────────────│
│  [             ] [Send]     │  ← comment input
│  [Sign in to identify] or   │
│  leave anonymously          │
└─────────────────────────────┘
```

- Anonymous commenters display as `[anon]`.
- Identified commenters display as truncated npub (`npub1abc…xyz`) — no profile fetch.
- Timestamps: relative (`2m`, `1h`, `3d`).
- Comments sorted oldest-first.
- Reaction row: group by `content` string, show emoji + count, sorted by count desc.
- If reactions are disabled (`manifest.reactions` absent): panel button is hidden entirely; no relay queries.

### Toolbar Button

Add a speech bubble icon button to the lightbox toolbar (alongside the existing download button). Shows a dot indicator if the current photo has any reactions/comments.

---

## New Files

### `src/lib/nostr/nip59.ts`

Core gift wrap logic:

```ts
// Build and sign a gift wrap containing a reaction or comment
export async function createGiftWrap(
  rumor: UnsignedRumor,
  senderSigner: ISigner | null,   // null → anonymous (generates ephemeral internally)
  recipientPubkey: string         // album reaction pubkey
): Promise<NostrEvent>            // signed kind 1059, ready to publish

// Unwrap a gift wrap: returns the inner rumor or throws
export async function unwrapGiftWrap(
  giftWrap: NostrEvent,
  recipientPrivkey: string
): Promise<Rumor>
```

NIP-44 encryption via `nostr-tools/nip44`.

### `src/hooks/useReactions.ts`

```ts
export function useReactions(manifest: AlbumManifest | null): {
  // Map from photoHash → aggregated reaction data
  reactionsByPhoto: Map<string, PhotoReactions>;
  // Submit a reaction (kind 7)
  react: (photoHash: string, content: string) => Promise<void>;
  // Submit a comment (kind 1)
  comment: (photoHash: string, text: string) => Promise<void>;
  // True while initial subscription is loading
  loading: boolean;
}

interface PhotoReactions {
  comments: Rumor[];
  reactions: Rumor[];
}
```

Internally:
- If `manifest.reactions` is absent: returns empty state immediately, never queries.
- Opens a `SimplePool` subscription on mount; closes on unmount.
- Decrypts each received gift wrap in a try/catch; silently discards failures.

### `src/components/viewer/ReactionsPanel.tsx`

Side panel / bottom sheet rendering comments and reactions for the currently open lightbox photo. Receives `PhotoReactions | undefined` and renders accordingly. Contains the comment input form.

### `src/components/viewer/ReactionsBadge.tsx`

Small overlay badge for the masonry thumbnail. Props: `{ reactions: number; comments: number }`. Returns `null` when both are zero.

---

## Modified Files

### `src/types/album.ts`

Add `AlbumReactionConfig` interface and extend `AlbumManifest` with optional `reactions` field.

### `src/components/upload/UploadPanel.tsx` / settings section

Add reactions toggle and relay list editor.

### `src/hooks/useUpload.ts`

When reactions are enabled, call `generateReactionKeypair()` and embed result in manifest before encryption.

### `src/components/viewer/ThumbnailGrid.tsx`

Render `<ReactionsBadge>` overlay on each thumbnail when `manifest.reactions` is present.

### `src/components/viewer/Lightbox.tsx`

- Add reactions panel toggle button to toolbar.
- Conditionally render `<ReactionsPanel>` as side panel (desktop) or bottom sheet (mobile).
- Pass current photo hash to panel.

---

## New Dependencies

| Package | Purpose |
|---|---|
| `nostr-tools/nip44` | NIP-44 v2 encryption (already in nostr-tools 2.x) |
| `nostr-tools/nip59` | Gift wrap helpers if available, otherwise implement inline |

No new npm packages required — `nostr-tools` 2.23.3 already ships NIP-44.

---

## Relay Behavior

Gift wraps (kind 1059) look like ordinary encrypted DMs to the relay. No relay-side categorization of "album reactions" occurs. The relay only knows:

- There is a kind 1059 event.
- It is addressed to some pubkey (the album reaction pubkey).
- The content is opaque ciphertext.

The album reaction pubkey is fresh per album and not linked to any user identity, so relay operators cannot correlate activity across albums.

---

## Out of Scope

- Moderation / deleting others' comments (no server, no moderator key).
- Reactions to the album as a whole (only per-photo reactions).
- Push notifications for new reactions.
- Reply threading on comments.
- Comment editing or deletion by the sender.
- Displaying reaction sender avatars or display names (would require profile fetches; kept minimal intentionally).
- Rate limiting / spam protection (trust model: share link = access; spammers would need the link).
