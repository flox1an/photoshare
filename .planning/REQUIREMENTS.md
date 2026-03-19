# Requirements: Nostr PhotoShare

**Defined:** 2026-03-19
**Core Value:** Anyone can securely share a batch of photos via a single link — no accounts, no server-side storage of plaintext images, no metadata leaks — and everything disappears after 30 days.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Image Processing

- [x] **PROC-01**: User can drag-and-drop image files to upload
- [x] **PROC-02**: User can drag-and-drop entire folders to upload
- [x] **PROC-03**: All EXIF data including geolocation is stripped client-side before upload
- [x] **PROC-04**: Images are resized to full-screen optimized dimensions client-side
- [x] **PROC-05**: Images are converted to WebP format client-side
- [x] **PROC-06**: Thumbnails are generated client-side for each image
- [x] **PROC-07**: HEIC/HEIF files from iPhones are detected and converted client-side
- [x] **PROC-08**: Image processing runs in Web Workers to avoid blocking the UI
- [x] **PROC-09**: Processing handles up to 200 photos without crashing the browser (memory-managed pipeline)

### Encryption

- [x] **CRYPT-01**: All image blobs (full + thumbnail) are encrypted with AES-256-GCM client-side
- [x] **CRYPT-02**: A fresh random IV is generated per encrypt operation (never reused)
- [x] **CRYPT-03**: A single random symmetric key is generated per album
- [x] **CRYPT-04**: The decryption key is embedded in the share link URL #fragment (never sent to server)

### Upload & Publishing

- [ ] **UPLD-01**: Encrypted blobs are uploaded to a Blossom server with proper auth headers
- [ ] **UPLD-02**: SHA-256 hash of each upload is verified against server response
- [ ] **UPLD-03**: Blossom expiration header is sent requesting ~60-day retention
- [ ] **UPLD-04**: An ephemeral Nostr keypair is generated (no login required)
- [ ] **UPLD-05**: Encrypted album manifest is published as Nostr kind 30078 event
- [ ] **UPLD-06**: NIP-40 expiration tag is set on the Nostr event (~30 days)
- [ ] **UPLD-07**: Upload progress UI shows per-photo status (processing, uploading, done)
- [ ] **UPLD-08**: Share link is generated only after all uploads succeed and relay confirms

### Viewer

- [ ] **VIEW-01**: Viewer decrypts Nostr event using key from URL #fragment
- [ ] **VIEW-02**: Viewer fetches and decrypts image blobs from Blossom
- [ ] **VIEW-03**: Thumbnail grid gallery displays all album photos
- [ ] **VIEW-04**: Full-screen lightbox with swipe/arrow navigation
- [ ] **VIEW-05**: User can download all album images as decrypted files
- [ ] **VIEW-06**: Images lazy-load (thumbnails first, full images on demand)
- [ ] **VIEW-07**: Gallery is mobile-responsive with touch/swipe support

### Settings

- [ ] **CONF-01**: User can configure Nostr relay list via settings panel
- [ ] **CONF-02**: User can configure Blossom server(s) via settings panel
- [ ] **CONF-03**: Relay hints are encoded in the share link so viewer knows where to fetch
- [x] **CONF-04**: Sensible defaults (24242.io for Blossom, relay.nostu.be for dev relay)

## v2 Requirements

### User Identity

- **IDENT-01**: User can log in with persistent Nostr identity (NIP-07 browser extension)
- **IDENT-02**: User can manage their own albums (list, delete)

### Sharing

- **SHARE-01**: QR code generation for share links (in-person sharing at events)
- **SHARE-02**: Password-protected albums (additional passphrase on top of URL key)

### Notifications

- **NOTIF-01**: Album expiration warning (approaching 30-day limit)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side image processing | Privacy model requires all processing client-side |
| Video support | High complexity, storage costs, different processing pipeline |
| Comments / reactions | Not core to ephemeral photo sharing use case |
| Mobile native app | Web-first; mobile web is sufficient for v1 |
| Real-time collaboration | Complexity, not needed for share-and-view model |
| User accounts / registration | Ephemeral keys are the point; persistent identity is v2 |
| Analytics / tracking | Anti-feature — violates privacy model |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROC-01 | Phase 2 | Complete |
| PROC-02 | Phase 2 | Complete |
| PROC-03 | Phase 2 | Complete |
| PROC-04 | Phase 2 | Complete |
| PROC-05 | Phase 2 | Complete |
| PROC-06 | Phase 2 | Complete |
| PROC-07 | Phase 2 | Complete |
| PROC-08 | Phase 2 | Complete |
| PROC-09 | Phase 2 | Complete |
| CRYPT-01 | Phase 1 | Complete |
| CRYPT-02 | Phase 1 | Complete |
| CRYPT-03 | Phase 1 | Complete |
| CRYPT-04 | Phase 1 | Complete |
| UPLD-01 | Phase 3 | Pending |
| UPLD-02 | Phase 3 | Pending |
| UPLD-03 | Phase 3 | Pending |
| UPLD-04 | Phase 1 | Pending |
| UPLD-05 | Phase 3 | Pending |
| UPLD-06 | Phase 3 | Pending |
| UPLD-07 | Phase 3 | Pending |
| UPLD-08 | Phase 3 | Pending |
| VIEW-01 | Phase 4 | Pending |
| VIEW-02 | Phase 4 | Pending |
| VIEW-03 | Phase 4 | Pending |
| VIEW-04 | Phase 4 | Pending |
| VIEW-05 | Phase 4 | Pending |
| VIEW-06 | Phase 4 | Pending |
| VIEW-07 | Phase 4 | Pending |
| CONF-01 | Phase 3 | Pending |
| CONF-02 | Phase 3 | Pending |
| CONF-03 | Phase 4 | Pending |
| CONF-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
