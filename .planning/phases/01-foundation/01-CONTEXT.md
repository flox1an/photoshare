# Phase 1: Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Next.js project scaffolding, AES-256-GCM crypto module, ephemeral Nostr keypair generation, SSR boundaries for browser-only APIs, and default configuration for Blossom server (24242.io) and Nostr relay (relay.nostu.be). This phase establishes the security-critical foundation that every subsequent phase depends on.

</domain>

<decisions>
## Implementation Decisions

### Crypto Key Derivation
- Single random AES-256 key per album: `crypto.getRandomValues(new Uint8Array(32))`
- Key encoded as base64url (~43 chars) in URL fragment
- Same key used for encrypting all blobs (full images, thumbnails) AND the Nostr event manifest
- No HKDF or sub-key derivation — if the key leaks, everything is exposed anyway since it's in one URL
- Fresh random 12-byte IV per encrypt call (CRITICAL — never reuse IV with same key)

### Share Link Format
- Format: `https://photoshare.app/naddr1...#<base64url-secret>`
- `naddr` (NIP-19 addressable) in the URL path — correct encoding for kind 30078 (parameterized replaceable)
- `naddr` encodes: kind (30078) + author pubkey + d-tag (album ID) + relay hints
- Decryption secret in URL #fragment — never sent to server
- No path prefix — naddr directly at root path

### Album Manifest Format
- Encrypted JSON stored as content of kind 30078 Nostr event
- Per-image entry contains:
  - `hash`: SHA-256 hash (Blossom blob address for full image)
  - `iv`: base64url-encoded 12-byte IV used to encrypt this blob
  - `thumbHash`: SHA-256 hash (Blossom blob address for thumbnail)
  - `thumbIv`: base64url-encoded IV for thumbnail blob
  - `width`: original image width in pixels (for grid layout/aspect ratio)
  - `height`: original image height in pixels
  - `filename`: original filename (for download naming, e.g. IMG_2847.jpg)
- Album-level metadata:
  - `title`: optional user-provided album title
  - `createdAt`: ISO 8601 timestamp
- Thumbnails are separate encrypted Blossom blobs (not base64 embedded)
- Blossom server URL NOT in manifest — viewer discovers from naddr relay hints or uses default

### Nostr Library
- Use **applesauce** ecosystem (by hzrd149/noStrudel author) instead of raw nostr-tools
- `applesauce-signers` → `SimpleSigner` for ephemeral keypair generation
- `applesauce-factory` → `EventFactory` + `build()` for creating kind 30078 events
- `applesauce-relay` → `RelayPool` for publishing to relays
- `applesauce-core` → `EventStore` for event management
- `applesauce-loaders` → `createAddressLoader` for viewer (Phase 4)
- `nostr-tools` still used for `nip19.naddrEncode()` (applesauce uses nostr-tools types)

### Claude's Discretion
- Next.js project structure and folder layout
- TypeScript types/interfaces for the manifest schema
- SSR boundary implementation (dynamic imports vs useEffect guards)
- Config module design (lib/config.ts vs environment variables)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Nostr Protocol
- NIP-19 (bech32 encoding) — `naddr` format for parameterized replaceable events (kind + pubkey + d-tag + relay hints)
- NIP-40 — Event expiration tag format (`expiration` tag with Unix timestamp)
- NIP-78 — Application-specific data (kind 30078), free-form content field

### Blossom Protocol
- BUD-02 — Blob upload endpoint, auth header format, SHA-256 hash verification
- BUD-04 — Expiration hint headers

### Web Crypto
- AES-GCM — 12-byte IV requirement, 256-bit key, `crypto.subtle.encrypt/decrypt`

### Research
- `.planning/research/STACK.md` — Library choices and versions
- `.planning/research/ARCHITECTURE.md` — Component boundaries and data flow
- `.planning/research/PITFALLS.md` — SSR boundary patterns, IV reuse prevention, memory management

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- `lib/crypto.ts` will be imported by Phase 2 (image encryption), Phase 3 (manifest encryption), Phase 4 (decryption)
- `lib/nostr.ts` will be imported by Phase 3 (event publishing) and Phase 4 (event fetching)
- `lib/config.ts` will be imported by all phases for default server/relay values
- TypeScript types for manifest schema will be the data contract between all phases

</code_context>

<specifics>
## Specific Ideas

- User wants `naddr` specifically because kind 30078 is parameterized replaceable — nevent would be wrong for this event kind
- Blossom server URL intentionally NOT in manifest — keeps manifest smaller, viewer uses defaults or discovers from relay
- Original filenames preserved in manifest for meaningful downloads (not hash-based names)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-19*
