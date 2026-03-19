# Nostr PhotoShare

## What This Is

A privacy-first ephemeral photo sharing web app built on Nostr and Blossom protocols. Users drag-and-drop photos (up to ~200), which are processed entirely client-side (EXIF stripped, resized, converted to WebP, thumbnails generated), encrypted with AES-256-GCM, and uploaded to configurable Blossom servers. An encrypted Nostr event (kind 30078, parameterized replaceable, NIP-40 expiration) stores the album metadata. A shareable link with the decryption key in the URL fragment lets anyone view a grid gallery with full-screen lightbox slideshow. All content auto-expires after 1 month.

## Core Value

Anyone can securely share a batch of photos via a single link — no accounts, no server-side storage of plaintext images, no metadata leaks — and everything disappears after 30 days.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Drag-and-drop upload of photos (files or entire folders, up to ~200)
- [ ] Client-side EXIF/geolocation stripping
- [ ] Client-side resize and WebP conversion (full-screen optimized)
- [ ] Client-side thumbnail generation
- [ ] Client-side AES-256-GCM encryption of all image blobs
- [ ] Upload encrypted blobs to configurable Blossom server(s)
- [ ] Blossom expiration header (1 month) if supported by server
- [ ] Ephemeral Nostr keypair generation (no login required)
- [ ] Publish encrypted album metadata as Nostr kind 30078 event with NIP-40 expiration tag (1 month)
- [ ] Configurable Nostr relay list with sensible defaults
- [ ] Configurable Blossom server list with sensible defaults
- [ ] Shareable link with decryption secret in URL #fragment
- [ ] Relay hints encoded in the share link
- [ ] Viewer: decrypt Nostr event, fetch and decrypt images
- [ ] Viewer: thumbnail grid gallery
- [ ] Viewer: full-screen lightbox slideshow (swipe/arrow navigation)
- [ ] Viewer: client-side download of all album images (decrypted)
- [ ] Upload progress UI with per-photo status (processing, uploading, done)

### Out of Scope

- User accounts / persistent Nostr identity login — deferred, maybe later
- Server-side image processing — everything happens in the browser
- Real-time collaboration / multi-user editing
- Video support
- Comments or reactions on albums
- Mobile native app — web-only for now

## Context

- **Nostr** is a decentralized protocol for social data. Events are signed JSON objects published to relays. NIP-40 defines expiration tags that compliant relays honor.
- **Blossom** (BLOb Storage Simply Made) is a Nostr-adjacent protocol for hosting binary blobs (images, files) on servers, addressed by SHA-256 hash. Servers can accept expiration hints.
- **Default Blossom server:** `https://24242.io/` — 60-day retention by default, good fit for ephemeral sharing.
- **Dev relay:** `wss://relay.nostu.be`
- Kind 30078 is a parameterized replaceable event — good for app-specific structured data. The `d` tag acts as an identifier.
- The URL fragment (#) is never sent to the server, making it safe for embedding decryption keys.
- Client-side WebP conversion and resizing can be done via Canvas API; EXIF stripping via parsing the JPEG binary structure or libraries like `exifr`.
- For ~200 photos, chunked/batched processing with a progress UI is essential to avoid browser freezes. Web Workers are a good fit.
- **NIP-40 expiration is advisory** — relays SHOULD honor it but MAY persist events. Privacy relies on encryption, not deletion.

## Constraints

- **Privacy**: No plaintext image data or metadata may leave the browser unencrypted
- **Tech stack**: Next.js (App Router)
- **Processing**: All image processing client-side (Canvas API, Web Workers)
- **Encryption**: AES-256-GCM, single symmetric key derived from random secret
- **Expiration**: ~60-day TTL on Blossom blobs (24242.io default), 1-month on Nostr events
- **Album size**: Support up to ~200 photos per album

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single AES key in URL fragment | Simpler UX, one link decrypts everything, fragment never sent to server | — Pending |
| All client-side processing | Privacy — no server ever sees plaintext images or EXIF data | — Pending |
| Kind 30078 + NIP-40 expiry | Parameterized replaceable event is good for app-specific data; NIP-40 gives relay-honored expiration | — Pending |
| Configurable relays + Blossom servers | Flexibility for power users, sensible defaults for everyone else | — Pending |
| WebP output format | Best compression/quality ratio for photos, widely supported | — Pending |
| Ephemeral keypair (no login) | Minimal friction for anonymous sharing | — Pending |

---
*Last updated: 2026-03-19 after initialization*
