# Feature Research

**Domain:** Encrypted ephemeral photo sharing (Nostr + Blossom)
**Researched:** 2026-03-19
**Confidence:** HIGH (core features well-established across multiple comparable products)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any photo sharing tool. Missing these = product feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop upload | Standard for file sharing since Dropbox normalized it; click-to-browse as fallback is required too | LOW | Must accept both individual files and folder drops; folder API via `webkitdirectory` attribute |
| Batch upload (many files at once) | Users share events in bulk (vacation, wedding, party); selecting one-by-one is unusable for 50+ photos | MEDIUM | Need chunked processing pipeline to avoid UI freeze; Web Workers essential at ~200 files |
| Per-photo upload progress | Firefox Send, Wormhole, every modern uploader shows per-file status; users abandon silent uploads | MEDIUM | States: queued → processing → encrypting → uploading → done / error; aggregate progress bar |
| Shareable single link | Core mental model of ephemeral sharing — one link, send to anyone | LOW | Key in URL fragment (#) is the privacy-critical design; link must work without any login |
| Thumbnail grid gallery viewer | Photo sharing without a grid view is not a gallery — it's a file list | MEDIUM | Responsive grid, lazy-load thumbnails, masonry or uniform grid acceptable |
| Full-screen lightbox | Expected by anyone who has used Google Photos, iCloud, Instagram; tap-to-expand is universal | MEDIUM | Keyboard navigation (arrows, Escape), swipe on mobile, preload adjacent images |
| Download all images | Users need to save their photos; no download = photos trapped behind an expiring link | MEDIUM | Zip packaging on client-side preferred; individual file download as fallback |
| EXIF / geolocation stripping | Privacy-conscious users expect this from any privacy-focused sharing tool; GPS in photos is a known risk | MEDIUM | Must happen before encryption; JPEG binary parsing or `exifr` library; Canvas re-encode strips most EXIF |
| Client-side image resizing | Raw camera photos are 5–20 MB each; uploading 200 unresized photos is not viable | MEDIUM | Canvas API resize to screen-optimized dimensions; WebP conversion gives ~30–50% size savings |
| Auto-expiration of content | Ephemeral sharing is the core promise; if content lives forever it's not ephemeral sharing | MEDIUM | NIP-40 tag on Nostr event; Blossom expiration header; 1-month TTL per PROJECT.md spec |
| No account required to share | Mainstream ephemeral tools (Wormhole, old Firefox Send) all offered this; accounts = friction = abandonment | LOW | Ephemeral Nostr keypair generated at share time; never stored |
| No account required to view | Anyone must be able to open the link and see photos — adding a login wall breaks the share model | LOW | Pure viewer: fetch event, decrypt, display; zero dependencies on any Nostr identity |
| Copy link to clipboard | Universal UX pattern; must be one-click after upload completes | LOW | Navigator.clipboard API; fallback to `document.execCommand` for older browsers |
| Mobile-responsive viewer | Most links are opened on phones; a desktop-only viewer is a broken experience | MEDIUM | Touch swipe in lightbox, tap targets sized for thumbs, grid reflows for narrow screens |
| Encryption indicator / trust signal | Users sharing private photos need visible confirmation that encryption is active | LOW | Brief explanation of "your key is in the link" in UI; not a detailed security audit, just reassurance |

### Differentiators (Competitive Advantage)

Features that distinguish this product from generic file-sharing tools. These align with the core value proposition: decentralized, censorship-resistant, private photo sharing.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Decentralized storage via Blossom | No single server can take down an album; content survives platform shutdowns that would kill Dropbox/Drive shares | HIGH | Requires Blossom client library, multiple server upload, SHA-256 addressing; ndk-blossom available |
| Configurable relay + Blossom server list | Power users can route through servers they trust or self-host; unique in consumer photo sharing space | MEDIUM | Sensible defaults for casual users; settings panel for power users; relay hints in share link |
| Truly zero-knowledge server | Even the storage server sees only encrypted ciphertext; plaintext never leaves the browser — stronger than Proton Drive which processes server-side | HIGH | AES-256-GCM with key in URL fragment (never sent to server); client-side processing pipeline |
| No phone number / email required | Zero PII collected vs. Google Photos, iCloud, even Signal which require phone numbers | LOW | Ephemeral keypair means genuinely anonymous sharing; no signup flow at all |
| Relay hints in share URL | Viewer can find the album even if default relays don't have the event; Nostr-native robustness | LOW | Encode relay URL list in the share link alongside the decryption key; increases reliability |
| Folder-drop support | Upload an entire vacation folder in one drag; most web uploaders require file-by-file or zip first | LOW | `webkitdirectory` attribute on file input; drag DataTransferItem API for folder drops |
| QR code for share link | For in-person sharing at events (wedding, party), QR enables instant album access without typing a URL | LOW | Generate QR client-side using a QR library (qrcode.js, qr-code-styling); display alongside copy link button |
| Swipe navigation in lightbox | Mobile-first interaction; most lightbox libraries support it but must be explicitly tested and tuned | MEDIUM | Touch events or Pointer Events API; velocity-based swipe detection |
| Individual photo download | Download a single photo without downloading the whole album zip | LOW | Decrypt single blob, trigger browser download via Blob URL |
| Thumbnail + full-res lazy loading | Thumbnails display instantly; full-res loads on demand in lightbox; reduces perceived wait time | MEDIUM | Two encrypted blobs per photo: thumbnail and full-size; lightbox requests full-res on open |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but conflict with the core design, create privacy risks, or add complexity disproportionate to benefit.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / persistent identity | "I want to see all my albums" | Requires server-side state, email/phone, sessions — destroys the zero-PII model; Firefox Send shut down partly because accounts created abuse surface | Use ephemeral keypair; if album management is needed later, use NIP-07 browser extension login as an opt-in feature |
| Password protection on top of link key | "Extra security layer" | URL-fragment key already provides ~128-bit security; a password layer adds UX friction with minimal cryptographic benefit for the threat model (the link IS the secret) | Educate users: "don't share the link with people you don't trust" — the link IS the password |
| View count / analytics | "I want to know if anyone viewed it" | Requires server-side tracking, breaks zero-knowledge model; any server-side counter leaks viewer IP/timing metadata | Not feasible without compromising privacy; omit entirely |
| Comments / reactions on albums | "Social engagement" | Adds social graph complexity, moderation needs, and requires linked Nostr identities — scope creep away from simple sharing | Out of scope per PROJECT.md; if needed, link to a Nostr discussion thread instead |
| Video support | "Share event videos too" | Videos are orders of magnitude larger; Blossom expiration + browser-side encryption + streaming playback is a separate, complex problem | Explicitly out of scope for v1; photo-only keeps the scope manageable |
| Server-side image processing | "Faster for low-powered devices" | Breaks the zero-knowledge guarantee — server would see plaintext images and EXIF before encryption | Use Web Workers to offload processing; show progress so users know it's happening |
| Real-time multi-user upload collaboration | "Multiple people contribute to one album" | Requires shared key management, conflict resolution, and live sync — fundamentally different product | Out of scope; a single uploader creates the album and shares the link |
| Permanent / non-expiring albums | "I want this to last forever" | Contradicts ephemeral design; creates storage burden on free Blossom servers; Nostr relays may not honor NIP-40 forever but it's the intent | Not supported; users who want permanent storage should use a different tool |
| Social login (Google/Apple Sign In) | "Easier onboarding" | Defeats anonymity, introduces OAuth dependency, creates identity linkability | No login at all — ephemeral keypair is simpler AND more private |
| Thumbnail-only mode (no full-res) | "Save bandwidth" | Users who open an album expect to see full-quality photos; thumbnail-only degrades the core viewing experience | Always upload both thumbnail + full-res; let bandwidth concerns drive compression quality choices |

## Feature Dependencies

```
[Client-side image pipeline]
    └──requires──> [Web Worker processing]
                       └──requires──> [Canvas API resize + WebP conversion]
                       └──requires──> [EXIF stripping]
                           └──feeds──> [AES-256-GCM encryption]

[AES-256-GCM encryption]
    └──requires──> [Random secret key generation]
    └──produces──> [Encrypted blobs for Blossom upload]

[Blossom upload]
    └──requires──> [Encrypted blobs]
    └──produces──> [SHA-256 blob hashes]

[Nostr event publication]
    └──requires──> [SHA-256 blob hashes] (to build album metadata)
    └──requires──> [Ephemeral keypair]
    └──requires──> [NIP-40 expiration tag]
    └──requires──> [Configured relay list]

[Shareable link generation]
    └──requires──> [Nostr event published] (event ID + relay hints)
    └──requires──> [Decryption key]
    └──produces──> [URL with #fragment containing key + relay hints]

[QR code] ──enhances──> [Shareable link generation]
[Copy to clipboard] ──enhances──> [Shareable link generation]

[Viewer: album display]
    └──requires──> [Shareable link] (to extract key + event location)
    └──requires──> [Nostr event fetch from relays]
    └──requires──> [AES-256-GCM decryption]
    └──requires──> [Blossom blob fetch]

[Thumbnail grid] ──requires──> [Viewer: album display]
[Lightbox slideshow] ──requires──> [Thumbnail grid]
[Download all] ──requires──> [Viewer: album display]

[Upload progress UI] ──enhances──> [Client-side image pipeline]
[Upload progress UI] ──enhances──> [Blossom upload]
```

### Dependency Notes

- **EXIF stripping requires Canvas re-encode:** Drawing to Canvas and calling `toBlob()` discards most EXIF. A library like `exifr` can verify GPS is gone. Both approaches are complementary.
- **Thumbnail + full-res are parallel tracks:** The pipeline processes each photo twice — thumbnail and full-size — both encrypted separately. Thumbnail hashes and full-res hashes are both stored in the Nostr event metadata.
- **Share link requires completed upload:** The link cannot be generated until the Nostr event is published, which requires all Blossom hashes. Progress UI must make this sequencing visible.
- **Viewer has no dependency on uploader identity:** The viewer only needs the share link (key + event address). No Nostr login, no session, no account.
- **Configurable relays conflict with hardcoded relay assumptions:** Relay list must be user-configurable and stored locally (localStorage); relay hints in the share link are the fallback discovery mechanism.

## MVP Definition

### Launch With (v1)

Minimum viable product — everything needed to validate the core "share encrypted photos via a link" concept.

- [ ] Drag-and-drop upload (files + folders) with click-to-browse fallback — without this, the upload experience is broken
- [ ] Client-side pipeline: EXIF strip → resize → WebP → AES-256-GCM encrypt — the entire privacy guarantee depends on this running before any upload
- [ ] Upload progress UI with per-photo state (queued / processing / uploading / done / error) — 200-photo uploads without feedback feel frozen
- [ ] Blossom upload with configurable server and SHA-256 addressing — the storage layer
- [ ] Nostr event publication (kind 30078, NIP-40 expiry, ephemeral keypair) — the metadata and discovery layer
- [ ] Shareable link with decryption key in URL #fragment and relay hints — the core sharing action
- [ ] Copy link to clipboard — one-click completion after upload
- [ ] Viewer: fetch Nostr event, decrypt, fetch Blossom blobs — the receiving side
- [ ] Viewer: thumbnail grid gallery — photo viewing experience
- [ ] Viewer: full-screen lightbox with keyboard + swipe navigation — photo viewing experience
- [ ] Viewer: download all (decrypted) — users must be able to save their photos
- [ ] Mobile-responsive layout for both uploader and viewer — most links opened on phones

### Add After Validation (v1.x)

Features to add once core sharing flow is validated with real users.

- [ ] QR code for share link — add when users report in-person sharing use cases (events, parties)
- [ ] Individual photo download — add when users report needing single-photo saves
- [ ] Configurable relay list with UI — add when power users request self-hosting or custom relay routing
- [ ] Upload error recovery / retry — add when Blossom server reliability issues are observed in production
- [ ] Multiple Blossom server upload (redundancy) — add when single-server availability is reported as a concern

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] NIP-07 browser extension login (opt-in persistent identity) — only if users request album management; adds significant auth complexity
- [ ] Blossom server mirroring UI — only if users encounter content loss due to server churn
- [ ] Custom expiration duration — only if 1-month TTL is reported as wrong for a significant use case
- [ ] Encrypted album updating (replace/add photos to existing album) — only if creators need to curate after sharing

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Drag-and-drop upload | HIGH | LOW | P1 |
| Client-side EXIF strip + resize + encrypt pipeline | HIGH | HIGH | P1 |
| Per-photo progress UI | HIGH | MEDIUM | P1 |
| Blossom upload | HIGH | MEDIUM | P1 |
| Nostr event publish (kind 30078 + NIP-40) | HIGH | MEDIUM | P1 |
| Shareable link with key in fragment | HIGH | LOW | P1 |
| Copy link to clipboard | HIGH | LOW | P1 |
| Viewer: decrypt + grid gallery | HIGH | MEDIUM | P1 |
| Viewer: lightbox with swipe/keyboard | HIGH | MEDIUM | P1 |
| Viewer: download all | HIGH | MEDIUM | P1 |
| Mobile-responsive layout | HIGH | MEDIUM | P1 |
| QR code for share link | MEDIUM | LOW | P2 |
| Individual photo download | MEDIUM | LOW | P2 |
| Configurable relay list UI | MEDIUM | MEDIUM | P2 |
| Upload error retry | MEDIUM | MEDIUM | P2 |
| Multiple Blossom server redundancy | MEDIUM | MEDIUM | P2 |
| NIP-07 login (persistent identity) | LOW | HIGH | P3 |
| Custom expiration duration | LOW | MEDIUM | P3 |
| Album updating after share | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Firefox Send (defunct) | Wormhole.app | Bitwarden Send | Our Approach |
|---------|----------------------|--------------|----------------|--------------|
| Encryption | AES-128-GCM client-side | E2E encrypted | AES-256 | AES-256-GCM client-side |
| Account required | Optional (larger files) | No | Yes | Never |
| Expiration | Download count or time | Fixed duration | Configurable | 1-month fixed |
| Photo gallery view | No (file download only) | No (file download only) | No | Yes — grid + lightbox |
| EXIF stripping | No | No | No | Yes — differentiator |
| Decentralized storage | No (Mozilla servers) | No (centralized) | No (Bitwarden servers) | Yes — Blossom protocol |
| Censorship resistance | No | No | No | Yes — Nostr + Blossom |
| Key in URL fragment | Yes | Yes | No | Yes |
| Mobile gallery UX | N/A | N/A | N/A | Yes — swipe lightbox |
| Folder upload | No | Yes | No | Yes |
| Batch 200+ files | No (file size limit) | Yes (up to 10 GB) | No | Yes |

## Sources

- [Firefox Send — Wikipedia](https://en.wikipedia.org/wiki/Firefox_Send) — Feature set of the now-defunct Mozilla encrypted file sharing service
- [Wormhole.app](https://wormhole.app/) — Ephemeral E2E encrypted file sharing with instant link generation
- [Bitwarden Send](https://bitwarden.com/products/send/) — Password-manager-adjacent secure file sharing with optional password + expiration
- [NIP-40: Expiration Timestamp](https://nips.nostr.com/40) — Official Nostr NIP defining relay behavior for event expiration
- [NIP-68: Picture-first feeds](https://nips.nostr.com/68) — Nostr standard for image-centric events (kind 20)
- [Blossom Protocol GitHub](https://github.com/hzrd149/blossom) — Reference implementation and protocol spec for Blossom blob storage
- [Nostrify Blossom Uploader](https://nostrify.dev/upload/blossom) — Library-level Blossom upload documentation
- [Privacy Guides: Photo Management](https://www.privacyguides.org/en/photo-management/) — Privacy-focused photo tool evaluation criteria
- [Uploadcare: File Uploader UX Best Practices](https://uploadcare.com/blog/file-uploader-ux-best-practices/) — Per-file progress, batch upload UX patterns
- [lightGallery](https://www.lightgalleryjs.com/) — Full-featured gallery lightbox reference for touch/swipe/keyboard patterns

---
*Feature research for: Encrypted ephemeral photo sharing over Nostr + Blossom*
*Researched: 2026-03-19*
