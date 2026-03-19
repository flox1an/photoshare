# Phase 4: Share Link and Viewer - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the viewer page at `/[naddr]` that decrypts the Nostr event using the key from the URL fragment, fetches and decrypts images from Blossom, displays a thumbnail grid gallery with full-screen lightbox slideshow, and offers a download-all ZIP function. The viewer works without any account or prior state — anyone with the link can view the album. Relay hints are encoded in the share link via naddr.

</domain>

<decisions>
## Implementation Decisions

### Gallery Layout
- CSS Grid with auto-fill: 3 columns on mobile, 4-5 on desktop
- Each thumbnail maintains its original aspect ratio (no square cropping)
- Click on thumbnail opens lightbox overlay with fade-in transition
- Gallery header shows: album title (if set) + photo count + "Download all" button
- Skeleton placeholders with shimmer animation while thumbnails decrypt and load

### Lightbox Behavior
- Navigation: left/right arrows on hover + keyboard arrow keys + touch swipe on mobile
- Close: click overlay background + Escape key + X button top-right
- Image loading: show blurred/low-res thumbnail first → load full-res → cross-fade when ready
- Photo counter: "3 / 12" displayed at bottom center
- Full-screen overlay with dark background

### Download All
- ZIP file with original filenames from manifest (e.g., IMG_2847.jpg not hash-based names)
- Progress bar showing "Downloading 5/12..." while fetching and decrypting
- Use JSZip library for client-side ZIP creation

### Prior Locked Decisions (from Phase 1 & 3)
- Share link format: `/naddr1...#<base64url-secret>`
- `decodeAlbumNaddr()` from `src/lib/nostr/naddr.ts` extracts kind, pubkey, d-tag, relay hints
- `importKeyFromBase64url()` from `src/lib/crypto.ts` reconstructs CryptoKey from fragment
- `decryptBlob()` from `src/lib/crypto.ts` decrypts each image blob
- Album manifest: encrypted JSON in kind 30078 event content, IV in `["iv", ...]` tag
- applesauce-loaders: `createAddressLoader` for fetching events by naddr
- Thumbnails are separate encrypted Blossom blobs (lazy-load full images)
- Mobile responsive with touch/swipe support

### Claude's Discretion
- Lightbox component implementation (custom vs lightweight library)
- Touch swipe implementation (use-gesture vs custom touch handlers)
- Grid gap sizes and responsive breakpoints
- Error states (invalid link, expired album, missing blobs)
- Loading animation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Code
- `src/lib/crypto.ts` — `importKeyFromBase64url()`, `decryptBlob()`, `base64urlToUint8Array()`
- `src/lib/nostr/naddr.ts` — `decodeAlbumNaddr()` extracts kind, pubkey, d-tag, relays
- `src/types/album.ts` — `AlbumManifest`, `PhotoEntry` (manifest schema)
- `src/lib/config.ts` — `DEFAULT_BLOSSOM_SERVER` fallback

### Phase 3 Code
- `src/lib/nostr/event.ts` — event structure reference (manifest in content, IV in tag)

### Existing Viewer Stub
- `src/app/view/[naddr]/page.tsx` — stub with `dynamic(..., { ssr: false })` pattern

### Protocols
- NIP-19 — naddr decoding (kind + pubkey + d-tag + relay hints)
- BUD-01 — Blossom blob retrieval by SHA-256 hash (`GET /<sha256>`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/crypto.ts` — all decrypt functions ready
- `src/lib/nostr/naddr.ts` — `decodeAlbumNaddr()` ready
- `src/app/view/[naddr]/page.tsx` — stub viewer page with SSR boundary
- `applesauce-loaders` — `createAddressLoader` installed, ready for event fetching

### Established Patterns
- `'use client'` + `dynamic(..., { ssr: false })` for browser-only APIs
- Zustand for state management
- Vitest + jsdom for testing

### Integration Points
- Viewer page reads naddr from URL path params and key from `window.location.hash`
- Fetches event from relays in naddr → decrypts manifest → fetches blobs from Blossom by hash → decrypts each → displays

</code_context>

<specifics>
## Specific Ideas

- Blurred thumbnail → full-res crossfade is key to perceived performance
- Must work in fresh browser tab with no app state — zero-setup viewing
- Relay hints in naddr tell the viewer where to find the event

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-share-link-and-viewer*
*Context gathered: 2026-03-19*
