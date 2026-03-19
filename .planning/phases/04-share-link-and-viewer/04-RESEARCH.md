# Phase 4: Share Link and Viewer - Research

**Researched:** 2026-03-19
**Domain:** Browser gallery viewer — Nostr event fetch, AES-GCM decryption, image grid, lightbox, ZIP download
**Confidence:** HIGH (all critical paths verified against installed package source and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Share link format: `/naddr1...#<base64url-secret>`
- `decodeAlbumNaddr()` from `src/lib/nostr/naddr.ts` extracts kind, pubkey, d-tag, relay hints
- `importKeyFromBase64url()` from `src/lib/crypto.ts` reconstructs CryptoKey from fragment
- `decryptBlob()` from `src/lib/crypto.ts` decrypts each image blob
- Album manifest: encrypted JSON in kind 30078 event content, IV in `["iv", ...]` tag
- applesauce-loaders: `createAddressLoader` for fetching events by naddr
- Thumbnails are separate encrypted Blossom blobs (lazy-load full images)
- Mobile responsive with touch/swipe support
- CSS Grid with auto-fill: 3 columns on mobile, 4-5 on desktop
- Each thumbnail maintains its original aspect ratio (no square cropping)
- Click on thumbnail opens lightbox overlay with fade-in transition
- Gallery header shows: album title (if set) + photo count + "Download all" button
- Skeleton placeholders with shimmer animation while thumbnails decrypt and load
- Navigation: left/right arrows on hover + keyboard arrow keys + touch swipe on mobile
- Close: click overlay background + Escape key + X button top-right
- Image loading: show blurred/low-res thumbnail first → load full-res → cross-fade when ready
- Photo counter: "3 / 12" displayed at bottom center
- Full-screen overlay with dark background
- ZIP file with original filenames from manifest (e.g., IMG_2847.jpg not hash-based names)
- Progress bar showing "Downloading 5/12..." while fetching and decrypting
- Use JSZip library for client-side ZIP creation

### Claude's Discretion
- Lightbox component implementation (custom vs lightweight library)
- Touch swipe implementation (use-gesture vs custom touch handlers)
- Grid gap sizes and responsive breakpoints
- Error states (invalid link, expired album, missing blobs)
- Loading animation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-01 | Viewer decrypts Nostr event using key from URL #fragment | `importKeyFromBase64url()` + `decryptBlob()` ready in crypto.ts; `window.location.hash` access pattern documented below |
| VIEW-02 | Viewer fetches and decrypts image blobs from Blossom | BUD-01 `GET /<sha256>` → ArrayBuffer → `decryptBlob()`; fetch pattern documented below |
| VIEW-03 | Thumbnail grid gallery displays all album photos | CSS Grid `auto-fill` + `minmax()` pattern; PhotoEntry has width/height for aspect-ratio |
| VIEW-04 | Full-screen lightbox with swipe/arrow navigation | `@use-gesture/react` `useDrag` + `swipe` state; keyboard `keydown` listener |
| VIEW-05 | User can download all album images as decrypted files | JSZip 3.10.1 `file(name, ArrayBuffer)` + `generateAsync({type:"blob"})` pattern |
| VIEW-06 | Images lazy-load (thumbnails first, full images on demand) | IntersectionObserver API for lazy-loading; blurred thumbnail → crossfade pattern |
| VIEW-07 | Gallery is mobile-responsive with touch/swipe support | `@use-gesture/react` + CSS `touch-action: none` + responsive grid breakpoints |
| CONF-03 | Relay hints encoded in share link so viewer knows where to fetch | naddr relay hints pass through `decodeAlbumNaddr()` → `pointer.relays` → `createAddressLoader` followRelayHints |
</phase_requirements>

---

## Summary

Phase 4 builds a self-contained album viewer at `/view/[naddr]` that works in a fresh browser tab with zero prior state. The viewer reads the naddr from the route param (via `React.use(params)` — already set up in page.tsx) and the AES key from `window.location.hash`. All crypto infrastructure from Phase 1 is ready and just needs orchestrating. All relay infrastructure from Phase 3 (`RelayPool`) is ready to use for the address loader.

The key data flow is: decode naddr → fetch kind 30078 event via `createAddressLoader` → extract `["iv", ...]` tag → decrypt event content → parse `AlbumManifest` → for each `PhotoEntry`, lazy-fetch the thumbnail blob via BUD-01 `GET /<sha256>` → decrypt → display as `<img>` with object-URL. Full-size images load on demand (when lightbox opens). JSZip handles the download-all feature.

The viewer is stateless — the album key never touches any server. The `followRelayHints` option in `createAddressLoader` ensures the viewer uses the relay URLs embedded in the naddr automatically.

**Primary recommendation:** Build the viewer as a single `ViewerPanel` component orchestrating three sub-components: `ThumbnailGrid`, `Lightbox`, and `DownloadProgress`. Use `@use-gesture/react` for swipe, a custom lightbox (not a third-party lightbox library), and JSZip for ZIP creation.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| applesauce-loaders | 5.1.0 | Fetch kind 30078 event by address pointer | Already in project; `createAddressLoader` built-in batching + relay hints |
| applesauce-relay | 5.1.0 | `RelayPool` for relay connections | Already used in Phase 3; same pattern |
| rxjs | 7.8.2 | Observable → Promise via `firstValueFrom` | Installed as applesauce-loaders peer dep |
| Web Crypto API | native | `importKeyFromBase64url` + `decryptBlob` | Already in crypto.ts; no new dependency |
| Intersection Observer | native | Lazy-load thumbnails | Browser API; no library needed |

### New Dependencies to Install
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|-------------|
| jszip | 3.10.1 | Client-side ZIP creation and download | De-facto standard; pure JS; supports ArrayBuffer input |
| @use-gesture/react | 10.3.1 | Touch swipe detection for lightbox | Battle-tested; integrates cleanly with React; small bundle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @use-gesture/react | Hammer.js | Hammer is older, not tree-shakeable, more config-heavy |
| @use-gesture/react | Custom touch handlers | Custom handlers miss edge cases (velocity, scroll conflict) |
| JSZip | StreamSaver.js | StreamSaver is better for huge files; overkill for photos |
| Custom lightbox | yet-another-react-lightbox | Third-party adds bundle weight; custom gives full control |

**Installation:**
```bash
npm install jszip @use-gesture/react
npm install --save-dev @types/jszip
```

**Version verification (confirmed 2026-03-19):**
- `jszip`: 3.10.1 (published 2025-03-14)
- `@use-gesture/react`: 10.3.1 (published 2024-03-21)

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/viewer/
│   ├── ViewerPanel.tsx        # Top-level orchestrator (existing stub to replace)
│   ├── ThumbnailGrid.tsx      # CSS Grid gallery with skeleton loaders
│   ├── Lightbox.tsx           # Full-screen overlay with swipe/arrow/keyboard
│   ├── DownloadProgress.tsx   # Progress bar during ZIP creation
│   └── SkeletonCard.tsx       # Shimmer placeholder for loading state
├── hooks/
│   └── useAlbumViewer.ts      # Data-fetching + decryption orchestration hook
├── lib/nostr/
│   └── viewer.ts              # createAddressLoader wrapper, manifest decrypt helper
└── lib/blossom/
    └── fetch.ts               # fetchBlob(server, hash) → ArrayBuffer
```

### Pattern 1: Hash Fragment Key Access
**What:** Read the AES key from `window.location.hash` after the `#` character.
**When to use:** On mount inside a `useEffect` (never at module scope — SSR boundary).
**Example:**
```typescript
// Inside useEffect, after ssr:false dynamic import confirms browser context
const fragment = window.location.hash.slice(1); // strip leading '#'
const key = await importKeyFromBase64url(fragment);
```
**Critical:** The viewer page already has `dynamic(..., { ssr: false })` wrapping ViewerPanel, so `window` is safe to access inside ViewerPanel directly, but still guard inside `useEffect`.

### Pattern 2: createAddressLoader Usage
**What:** Convert `AddressPointer` from `decodeAlbumNaddr()` to the `LoadableAddressPointer` shape expected by the loader.
**When to use:** Fetching the kind 30078 event in the viewer.
**Example:**
```typescript
import { RelayPool } from 'applesauce-relay/pool';
import { createAddressLoader } from 'applesauce-loaders/loaders/address-loader';
import { firstValueFrom } from 'rxjs';
import { decodeAlbumNaddr } from '@/lib/nostr/naddr';

// createAddressLoader takes an UpstreamPool (RelayPool implements this)
const pool = new RelayPool();
const loadAddress = createAddressLoader(pool, {
  followRelayHints: true,  // uses relay hints embedded in naddr (CONF-03)
});

// decodeAlbumNaddr returns nip19.AddressPointer which matches LoadableAddressPointer shape
const pointer = decodeAlbumNaddr(naddr);
// pointer has: { kind: 30078, pubkey, identifier (d-tag), relays }

const event = await firstValueFrom(loadAddress(pointer));
// event.content = encrypted manifest (base64url)
// event.tags has ["iv", "<manifestIvB64url>"]
```
**Note:** `RelayPool.request` satisfies the `UpstreamPool` type directly — confirmed in applesauce-loaders 5.1.0 type definitions.

### Pattern 3: Manifest Decryption
**What:** Decrypt the event content using the key from the URL fragment and IV from the event tag.
**Example:**
```typescript
import { decryptBlob, importKeyFromBase64url, base64urlToUint8Array } from '@/lib/crypto';

const key = await importKeyFromBase64url(fragment);
const ivTag = event.tags.find(t => t[0] === 'iv');
const iv = base64urlToUint8Array(ivTag![1]);

// event.content is base64url-encoded ciphertext
const ciphertextBytes = base64urlToUint8Array(event.content);
const plaintext = await decryptBlob(ciphertextBytes.buffer, key, iv);
const manifest: AlbumManifest = JSON.parse(new TextDecoder().decode(plaintext));
```

### Pattern 4: Blossom Blob Fetch (BUD-01)
**What:** Fetch encrypted blob by SHA-256 hash from Blossom server.
**BUD-01 endpoint:** `GET https://<server>/<sha256>` → returns blob bytes with MIME type header.
**Example:**
```typescript
async function fetchBlob(server: string, sha256: string): Promise<ArrayBuffer> {
  const url = `${server.replace(/\/$/, '')}/${sha256}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Blossom fetch failed: ${res.status}`);
  return res.arrayBuffer();
}
```
**Note:** Blossom servers must include `Access-Control-Allow-Origin: *` per BUD-01 spec. The viewer reads blobs from the server URL embedded in the manifest (Phase 3 stores it) or falls back to `DEFAULT_BLOSSOM_SERVER`.

### Pattern 5: Blob → Object URL Display
**What:** Convert decrypted ArrayBuffer to a displayable URL using `URL.createObjectURL`.
**Example:**
```typescript
const decrypted = await decryptBlob(ciphertext, key, iv);
const blob = new Blob([decrypted], { type: 'image/webp' });
const objectUrl = URL.createObjectURL(blob);
// use as <img src={objectUrl} />
// MUST revoke when component unmounts or image is replaced:
// URL.revokeObjectURL(objectUrl);
```

### Pattern 6: Intersection Observer Lazy Loading
**What:** Load thumbnails only when their grid cell enters the viewport.
**Example:**
```typescript
const observerRef = useRef<IntersectionObserver | null>(null);

useEffect(() => {
  observerRef.current = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute('data-index'));
          loadThumbnail(index); // fetch + decrypt thumb for this index
          observerRef.current?.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '200px' } // preload 200px before viewport edge
  );
  return () => observerRef.current?.disconnect();
}, []);
```

### Pattern 7: Touch Swipe with @use-gesture/react
**What:** Detect left/right swipe in the lightbox to navigate images.
**Critical detail:** `swipe` state property returns `[swipeX, swipeY]` where each value is -1, 0, or 1.
**Example:**
```typescript
import { useDrag } from '@use-gesture/react';

const bind = useDrag(({ swipe: [swipeX] }) => {
  if (swipeX === 1) showPrev();   // swipe right = go back
  if (swipeX === -1) showNext();  // swipe left = go forward
});

// In JSX:
<div {...bind()} style={{ touchAction: 'none' }}>
  {/* lightbox content */}
</div>
```
**CSS requirement:** `touch-action: none` on the draggable element prevents browser scroll conflicts.

### Pattern 8: JSZip Download All
**What:** Create a ZIP of all decrypted images using original filenames.
**Example:**
```typescript
import JSZip from 'jszip';

async function downloadAll(photos: PhotoEntry[], key: CryptoKey, blossomServer: string) {
  const zip = new JSZip();
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    setProgress(i + 1); // "Downloading 5/12..."
    const ciphertext = await fetchBlob(blossomServer, photo.hash);
    const iv = base64urlToUint8Array(photo.iv);
    const decrypted = await decryptBlob(ciphertext, key, iv);
    zip.file(photo.filename, decrypted); // ArrayBuffer supported directly
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  // Trigger download without FileSaver.js:
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'photos.zip';
  a.click();
  URL.revokeObjectURL(url);
}
```
**Note:** FileSaver.js is NOT required — the `<a download>` pattern works in all modern browsers.

### Pattern 9: CSS Grid Responsive Layout
**What:** 3-column mobile → 4-5 column desktop grid with original aspect ratios preserved.
**Example (Tailwind CSS v4 — already in project):**
```tsx
<div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 p-4">
  {photos.map((photo, i) => (
    <div key={i} style={{ aspectRatio: `${photo.width}/${photo.height}` }}>
      <img src={thumbUrl} className="w-full h-full object-cover" />
    </div>
  ))}
</div>
```
**Note:** `PhotoEntry.width` and `PhotoEntry.height` are ORIGINAL pre-resize dimensions — confirmed in ProcessedPhoto interface (Phase 2 decision). These are sufficient for stable aspect-ratio layout even though displayed images are resized.

### Pattern 10: Blurred Thumbnail → Full-Res Crossfade
**What:** Show decrypted thumbnail immediately; load full-res on lightbox open; crossfade when ready.
**Example:**
```tsx
function LightboxImage({ photo, thumbUrl, albumKey, blossomServer }) {
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const cipher = await fetchBlob(blossomServer, photo.hash);
      const iv = base64urlToUint8Array(photo.iv);
      const plain = await decryptBlob(cipher, albumKey, iv);
      if (!cancelled) {
        const url = URL.createObjectURL(new Blob([plain], { type: 'image/webp' }));
        setFullUrl(url);
      }
    }
    load().finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [photo.hash]);

  return (
    <div className="relative w-full h-full">
      {/* Blurred thumbnail always mounted as background */}
      <img src={thumbUrl} className="absolute inset-0 w-full h-full object-contain blur-sm" />
      {/* Full-res overlaid, fades in when ready */}
      {fullUrl && (
        <img src={fullUrl} className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300" />
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Accessing `window.location.hash` at module scope:** SSR will throw. Must be inside `useEffect` or event handler.
- **Calling `decryptBlob` at module scope:** `crypto.subtle` is unavailable during Next.js prerender. Same rule.
- **Not revoking object URLs:** Every `URL.createObjectURL()` must be matched with `URL.revokeObjectURL()` on cleanup or the browser will leak memory.
- **Loading all full-size images immediately:** Only load full-size on lightbox open. Thumbnails first, always.
- **Using `window.location.hash` without `.slice(1)`:** The hash includes the leading `#` character.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Touch swipe detection | Custom `touchstart`/`touchend` handlers | `@use-gesture/react` `useDrag` + `swipe` | Handles velocity, cancellation, scroll conflict, multi-touch edge cases |
| ZIP creation | Custom ZIP binary format | `JSZip` | ZIP spec has CRC-32, local file headers, central directory — dozens of edge cases |
| Batch relay fetching | Manual WebSocket REQ filters | `createAddressLoader` | Built-in batching (1000ms buffer, 200 max), deduplication, relay hint following |
| Observable → Promise | Custom subscription management | `firstValueFrom(observable)` from rxjs | Handles unsubscription automatically; already installed |

**Key insight:** The viewer does not need any new state management beyond local React state — no Zustand store needed. The viewer is read-only and disposable. A single `useAlbumViewer` hook with `useState` is sufficient.

---

## Common Pitfalls

### Pitfall 1: URL Fragment Lost on Server-Side Render
**What goes wrong:** Next.js tries to render the viewer on the server. `window.location.hash` does not exist on the server. If accessed during render, throws `ReferenceError: window is not defined`.
**Why it happens:** The `#fragment` is never sent to the server by the browser — it's strictly client-side.
**How to avoid:** The existing stub already uses `dynamic(..., { ssr: false })`. Inside ViewerPanel, only access `window.location.hash` inside a `useEffect`. Do NOT pass it as a prop from the page component.
**Warning signs:** "ReferenceError: window is not defined" in server logs or build errors.

### Pitfall 2: RelayPool Created Before SSR Boundary
**What goes wrong:** `new RelayPool()` at module scope or in component render body triggers WebSocket connection attempts during SSR prerender.
**Why it happens:** Same SSR issue as the upload pipeline.
**How to avoid:** Create RelayPool inside a `useRef` initialized in `useEffect`, or use the lazy pattern from `useUpload.ts` (`useRef<RelayPool | null>(null)`, initialized on first use). The `ssr: false` dynamic import boundary means the component body runs only in the browser, but `useRef` initialization is still safer inside `useEffect`.
**Warning signs:** Next.js build warnings about WebSocket or network in SSR.

### Pitfall 3: createAddressLoader Observable Never Completes
**What goes wrong:** `firstValueFrom` resolves on the first event emitted. If the relay returns no event (album expired, wrong relays), the Observable never emits and `firstValueFrom` throws `EmptyError` after no events.
**Why it happens:** `createAddressLoader` buffers by time (default 1000ms) before issuing the REQ. If no relay has the event, it emits nothing.
**How to avoid:** Wrap `firstValueFrom` in try/catch and show "Album not found or expired" error state. Also set a reasonable timeout using rxjs `timeout()` operator.
**Warning signs:** Viewer hangs indefinitely with no error shown.

### Pitfall 4: Blossom Fetch CORS Issues
**What goes wrong:** Browser blocks Blossom blob fetch due to CORS policy. The Blossom server at `tempstore.apps3.slidestr.net` was empirically verified to support CORS during Phase 3. Other servers may not.
**Why it happens:** BUD-01 requires `Access-Control-Allow-Origin: *`, but not all servers comply.
**How to avoid:** Fetch blobs with standard `fetch()` — no special headers needed for GET. If CORS fails, show an error state explaining the album cannot be loaded from this server.
**Warning signs:** Network tab shows "CORS error" or "blocked by CORS policy" on blob fetch.

### Pitfall 5: Decryption Failure (Wrong Key or IV)
**What goes wrong:** `decryptBlob` throws `DOMException` (GCM authentication tag mismatch) if the key is wrong or the ciphertext is corrupted.
**Why it happens:** URL fragment mangled (e.g., `#` encoded as `%23` by some link-shorteners), or the user copy-pasted an incomplete link.
**How to avoid:** Wrap all `decryptBlob` calls in try/catch. Show "Invalid share link — decryption failed" error.
**Warning signs:** DOMException with name "OperationError" from crypto.subtle.decrypt.

### Pitfall 6: Object URL Memory Leaks
**What goes wrong:** Each `URL.createObjectURL()` allocates memory that is NOT garbage-collected until `URL.revokeObjectURL()` is called. A 200-photo album with unrevoked object URLs will leak ~200MB of RAM.
**Why it happens:** Browser holds a reference to the Blob until the URL is revoked.
**How to avoid:** Keep a ref tracking all created object URLs. Revoke in `useEffect` cleanup and on component unmount. Revoke per-image URLs when that image scrolls out of view and is unmounted.
**Warning signs:** Memory usage growing steadily; Chrome DevTools Memory tab shows many Blob entries.

### Pitfall 7: Lightbox Keyboard Event Cleanup
**What goes wrong:** `keydown` event listener added in `useEffect` without cleanup causes duplicate navigation if the component re-renders, and leaks listeners if the lightbox unmounts.
**How to avoid:** Always return the cleanup function from `useEffect`:
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'Escape') closeLightbox();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [showNext, showPrev, closeLightbox]);
```

---

## Code Examples

### Complete Event Fetch Flow (Verified against installed source)
```typescript
// Source: applesauce-loaders 5.1.0 dist/loaders/address-loader.d.ts
import { RelayPool } from 'applesauce-relay/pool';
import { createAddressLoader } from 'applesauce-loaders/loaders/address-loader';
import { firstValueFrom } from 'rxjs';
import { decodeAlbumNaddr } from '@/lib/nostr/naddr';
import { importKeyFromBase64url, decryptBlob, base64urlToUint8Array } from '@/lib/crypto';
import type { AlbumManifest } from '@/types/album';

async function loadAlbum(naddr: string, keyFragment: string): Promise<AlbumManifest> {
  const pool = new RelayPool();
  const loadAddress = createAddressLoader(pool, { followRelayHints: true });

  const pointer = decodeAlbumNaddr(naddr);
  // pointer: { kind: 30078, pubkey, identifier: dTag, relays: [...] }

  const event = await firstValueFrom(loadAddress(pointer));
  // event.content = base64url-encoded ciphertext
  // event.tags = [["d", dTag], ["iv", "<b64url>"], ...]

  const key = await importKeyFromBase64url(keyFragment);
  const ivTag = event.tags.find(t => t[0] === 'iv');
  if (!ivTag) throw new Error('Missing IV tag in event');
  const iv = base64urlToUint8Array(ivTag[1]);
  const ciphertext = base64urlToUint8Array(event.content);
  const plaintext = await decryptBlob(ciphertext.buffer, key, iv);

  return JSON.parse(new TextDecoder().decode(plaintext)) as AlbumManifest;
}
```

### Shimmer Skeleton CSS (Tailwind v4)
```tsx
// Source: project uses Tailwind CSS v4 — animate-pulse is available
function SkeletonCard() {
  return (
    <div className="animate-pulse bg-gray-200 rounded" style={{ aspectRatio: '4/3' }} />
  );
}
```

### JSZip Download All (Verified against JSZip 3.10.1 official docs)
```typescript
// Source: https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html
import JSZip from 'jszip';

async function downloadAllPhotos(
  photos: PhotoEntry[],
  key: CryptoKey,
  blossomServer: string,
  onProgress: (current: number, total: number) => void,
) {
  const zip = new JSZip();
  for (let i = 0; i < photos.length; i++) {
    onProgress(i + 1, photos.length);
    const ciphertext = await fetchBlob(blossomServer, photos[i].hash);
    const iv = base64urlToUint8Array(photos[i].iv);
    const decrypted = await decryptBlob(ciphertext, key, iv);
    zip.file(photos[i].filename, decrypted); // ArrayBuffer accepted directly
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  // No FileSaver.js needed — native browser download:
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'photos.zip',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
```

### use-gesture Swipe (Verified against @use-gesture/react 10.3.1 docs)
```typescript
// Source: https://use-gesture.netlify.app/docs/state/
import { useDrag } from '@use-gesture/react';

function LightboxNav({ onPrev, onNext }) {
  const bind = useDrag(({ swipe: [swipeX] }) => {
    if (swipeX === 1) onPrev();   // swipe right → previous
    if (swipeX === -1) onNext();  // swipe left → next
  });
  return <div {...bind()} style={{ touchAction: 'none', width: '100%', height: '100%' }} />;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct `useEffect` relay subscriptions | `createAddressLoader` with batching | applesauce-loaders 5.x | Handles deduplication and relay hints automatically |
| `nostr-tools` SimplePool | `applesauce-relay` RelayPool | Pre-phase decision | Higher-level API, used in Phase 3 already |
| Hammer.js for touch | `@use-gesture/react` | ~2021 | Tree-shakeable, React-native, velocity detection |
| `file-saver` npm package | Native `<a download>` + Object URL | Modern browsers | No extra dependency; works in Chrome/Firefox/Safari/Edge |

**Deprecated/outdated:**
- `Hammer.js`: Last release 2016, not maintained, large bundle; use `@use-gesture/react` instead.
- `FileSaver.js`: No longer needed for modern browser ZIP downloads; native `<a download>` is sufficient.

---

## Open Questions

1. **Blossom server URL storage in manifest**
   - What we know: Phase 3 uploads to a configured Blossom server and stores the blob URL in `BlobDescriptor.url`
   - What's unclear: Is the Blossom server URL stored per-photo in the manifest? The current `PhotoEntry` type only has `hash` and `thumbHash` — no server URL field.
   - Recommendation: Viewer should fall back to `DEFAULT_BLOSSOM_SERVER` when no server is specified in the photo entry. The planner should decide whether to add a `server` field to `PhotoEntry` or rely on the default. Given Phase 3 stores only hashes in `PhotoEntry`, use `DEFAULT_BLOSSOM_SERVER` as the fallback — the same server that uploaded will serve the blobs.

2. **RelayPool lifecycle in viewer (pool cleanup)**
   - What we know: Phase 3's `useUpload` uses `useRef<RelayPool | null>` and never explicitly closes the pool.
   - What's unclear: Should the viewer pool be closed when the viewer unmounts?
   - Recommendation: Call `pool.relays.forEach(r => r.close())` or check if RelayPool has a `close()` method in `useEffect` cleanup. For a one-shot viewer (fetch event, done), this matters less.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x with jsdom |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/nostr/viewer.test.ts src/hooks/useAlbumViewer.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIEW-01 | `importKeyFromBase64url` + `decryptBlob` reconstructs manifest from encrypted event content | unit | `npx vitest run src/lib/nostr/viewer.test.ts -t "decryptManifest"` | ❌ Wave 0 |
| VIEW-01 | `window.location.hash.slice(1)` yields correct base64url key | unit | `npx vitest run src/lib/nostr/viewer.test.ts -t "hash fragment"` | ❌ Wave 0 |
| VIEW-02 | `fetchBlob(server, sha256)` returns ArrayBuffer on 200 response | unit | `npx vitest run src/lib/blossom/fetch.test.ts` | ❌ Wave 0 |
| VIEW-03 | ThumbnailGrid renders correct number of skeleton + image items | unit | `npx vitest run src/components/viewer/ThumbnailGrid.test.tsx` | ❌ Wave 0 |
| VIEW-04 | Lightbox prev/next state transitions on arrow key + swipe | unit | `npx vitest run src/components/viewer/Lightbox.test.tsx` | ❌ Wave 0 |
| VIEW-05 | `downloadAllPhotos` calls JSZip.file() for each photo with correct filename | unit | `npx vitest run src/hooks/useAlbumViewer.test.ts -t "download"` | ❌ Wave 0 |
| VIEW-06 | IntersectionObserver fires loadThumbnail for visible entries | unit | `npx vitest run src/components/viewer/ThumbnailGrid.test.tsx -t "lazy load"` | ❌ Wave 0 |
| VIEW-07 | Lightbox close on Escape key | unit | `npx vitest run src/components/viewer/Lightbox.test.tsx -t "close"` | ❌ Wave 0 |
| CONF-03 | `createAddressLoader` called with `followRelayHints: true` | unit | `npx vitest run src/lib/nostr/viewer.test.ts -t "relay hints"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/nostr/viewer.test.ts src/lib/blossom/fetch.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/nostr/viewer.test.ts` — covers VIEW-01 (manifest decrypt), CONF-03 (relay hints)
- [ ] `src/lib/blossom/fetch.test.ts` — covers VIEW-02 (blob fetch)
- [ ] `src/components/viewer/ThumbnailGrid.test.tsx` — covers VIEW-03, VIEW-06
- [ ] `src/components/viewer/Lightbox.test.tsx` — covers VIEW-04, VIEW-07
- [ ] `src/hooks/useAlbumViewer.test.ts` — covers VIEW-05 (download all)
- [ ] `src/lib/blossom/fetch.ts` — new file (fetchBlob function)
- [ ] `src/lib/nostr/viewer.ts` — new file (decryptManifest, loader setup)

---

## Sources

### Primary (HIGH confidence)
- `node_modules/applesauce-loaders/dist/loaders/address-loader.d.ts` — `createAddressLoader` signature, `LoadableAddressPointer` type, `AddressLoaderOptions`
- `node_modules/applesauce-loaders/dist/loaders/address-loader.js` — `createAddressLoader` implementation, `followRelayHints` behavior
- `node_modules/applesauce-relay/dist/pool.d.ts` — `RelayPool.request` satisfies `UpstreamPool`
- `node_modules/rxjs/package.json` — rxjs 7.8.2 installed; `firstValueFrom` confirmed present
- `src/lib/crypto.ts` — all decrypt functions; API surface verified
- `src/lib/nostr/naddr.ts` — `decodeAlbumNaddr` returns `nip19.AddressPointer` (compatible with `LoadableAddressPointer`)
- `src/types/album.ts` — `PhotoEntry` has `hash`, `iv`, `thumbHash`, `thumbIv`, `width`, `height`, `filename`
- `src/hooks/useUpload.ts` — `RelayPool` lazy init pattern; Phase 3 established convention

### Secondary (MEDIUM confidence)
- https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html — JSZip `generateAsync` options and `onUpdate` callback
- https://stuk.github.io/jszip/documentation/api_jszip/file_data.html — `file(name, ArrayBuffer)` accepted directly
- https://use-gesture.netlify.app/docs/state/ — `swipe: [swipeX, swipeY]` state property; values -1/0/1
- https://use-gesture.netlify.app/docs/gestures/ — `useDrag` config, `touch-action: none` requirement
- BUD-01 spec (fetched) — `GET /<sha256>` endpoint, `Access-Control-Allow-Origin: *` requirement

### Tertiary (LOW confidence)
- None — all critical claims verified against installed source or official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against installed node_modules; versions confirmed via npm registry
- Architecture: HIGH — patterns derived directly from installed type definitions and Phase 3 established conventions
- Pitfalls: HIGH — derived from actual Phase 3 decisions log and known applesauce/Next.js SSR behavior

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable ecosystem; applesauce-loaders API unlikely to change in 30 days)
