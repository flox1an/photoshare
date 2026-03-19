# Stack Research

**Domain:** Privacy-first ephemeral photo sharing — Nostr protocol + Blossom blob storage
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH (Nostr/Blossom ecosystem is fast-moving; core Web APIs are HIGH confidence)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x (current: 16.2.0) | App framework, App Router | Project constraint; Turbopack now default, stable production bundler as of v16 |
| React | 19.x | UI | Ships with Next.js 16; required for latest RSC and concurrent features |
| TypeScript | 5.x | Type safety | NDK and nostr-tools both require TS 5+; catches protocol shape errors early |
| Tailwind CSS | 4.x | Styling | shadcn/ui now targets v4 by default; no config file required; OKLCH color system |
| shadcn/ui | latest | Accessible component primitives | Copy-owned components prevent lockout from upstream breaking changes; v4-compatible |

### Nostr Protocol Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nostr-tools | 2.23.3 (latest) | Event creation, relay WebSocket, key generation, NIP helpers | De-facto standard (381 dependent packages); v2.x has stable API with `generateSecretKey()`, `finalizeEvent()`, `kinds` constants. Lower-level than NDK — better fit for an app that generates ephemeral keys and fires one event, not a full social client |
| blossom-client-sdk | 4.1.0 (latest) | Upload blobs to Blossom servers, create auth events (kind 24242), encode Authorization headers, SHA-256 verification | Written by the Blossom spec author (hzrd149); handles the full upload auth flow including `createUploadAuth()` and `encodeAuthorizationHeader()` |

**Decision: nostr-tools over NDK.** NDK is optimized for full social clients with outbox model, multi-relay coordination, session management, Web of Trust, and wallet integration. This app generates one ephemeral keypair and publishes one event — NDK adds 60-80kB of overhead for features not needed. nostr-tools gives direct, minimal access to signing and relay pools.

### Image Processing (Client-Side Only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Canvas API (native) | browser built-in | Resize images, convert to WebP, generate thumbnails | Zero dependency; `canvas.toBlob('image/webp', quality)` is universally supported; sufficient for this use case |
| browser-image-compression | 2.0.x | Resize + compress pipeline with Web Worker support | Wraps Canvas API with `useWebWorker: true` option; handles multi-thread non-blocking compression for up to 200 photos; built-in `preserveExif: false` default strips metadata |
| Web Crypto API (native) | browser built-in | AES-256-GCM encrypt/decrypt blobs and metadata | `SubtleCrypto.encrypt()` with `AES-GCM` algorithm; available in all modern browsers; no library needed; the spec-correct way to do this — no third-party crypto library required |
| Comlink | 4.4.2 | RPC bridge between main thread and Web Workers | 1.1kB library from Google Chrome team; abstracts `postMessage`; essential for offloading 200-photo processing without blocking the UI; works in Next.js App Router via `useEffect` initialization |

**EXIF stripping strategy:** `browser-image-compression` strips EXIF by default when re-encoding via Canvas (`preserveExif` defaults to `false`). After canvas re-encode to WebP, EXIF data from the original JPEG is gone. No separate EXIF library required for stripping — only needed if you want to read coordinates before stripping (not in scope).

### State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Zustand | 5.0.8 (latest) | Upload queue state, per-photo status, album metadata | Minimal API (one `create()` call), no Provider boilerplate, React 18+ `useSyncExternalStore`-based; perfect for upload progress tracking across 200 items |

### UI Components

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dropzone | 15.0.0 (latest) | Drag-and-drop file/folder intake | Handles folder drag (`webkitdirectory`), MIME type filtering, file size limits; pairs with shadcn primitives for styling |
| yet-another-react-lightbox | 3.29.1 (latest) | Full-screen lightbox slideshow | Supports swipe/keyboard/touchpad navigation; works with React 19; plugin system for zoom; supports dynamic blob URLs from decrypted images |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript strict mode | Catch protocol shape errors | Enable `"strict": true`; nostr-tools v2 uses `Uint8Array` for keys — strict mode catches hex/bytes confusion |
| ESLint + eslint-config-next | Code quality | Ships with Next.js; catches RSC/Client boundary issues |
| Prettier | Formatting | Standard; no project-specific config needed |

## Installation

```bash
# Core framework (use Next.js 16 with App Router + Turbopack)
npx create-next-app@latest --typescript --tailwind --app --turbopack

# shadcn/ui init (v4 mode)
npx shadcn@latest init

# Nostr + Blossom protocol
npm install nostr-tools blossom-client-sdk

# Image processing + worker bridge
npm install browser-image-compression comlink

# Upload UX + gallery
npm install react-dropzone yet-another-react-lightbox

# State management
npm install zustand

# Dev dependencies
npm install -D @types/node
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| nostr-tools | @nostr-dev-kit/ndk | When building a full social client with multi-account sessions, outbox model relay selection, Web of Trust filtering, or wallet integration — not this app |
| blossom-client-sdk | @nostr-dev-kit/ndk-blossom (v0.1.32) | When already using NDK as the Nostr layer; ndk-blossom is an NDK extension, not standalone |
| Web Crypto API (native) | tweetnacl, libsodium-wrappers | Only if you need Curve25519 operations not in SubtleCrypto; AES-GCM is natively supported — no third-party crypto library needed |
| browser-image-compression | @jsquash/webp (WASM) | For AVIF or advanced codec support; WASM bundle is larger and harder to Web Worker; Canvas-based WebP is sufficient here |
| Zustand | Jotai, Redux Toolkit | Jotai is fine; Redux is overkill for a single-session upload flow |
| yet-another-react-lightbox | PhotoSwipe React | PhotoSwipe is comparable; YARL has better TypeScript support and plugin architecture |
| react-dropzone | shadcn/ui dropzone (community) | Community shadcn dropzone wrappers exist but add a layer of abstraction that complicates folder upload support |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Sharp (Node.js) | Runs server-side; project constraint requires all image processing client-side; can't run in browser | Canvas API + browser-image-compression |
| CryptoJS / forge / sjcl | Outdated browser crypto libraries; slower than SubtleCrypto; not audited to the same standard; unnecessary dependency | Web Crypto API (`window.crypto.subtle`) |
| NIP-04 encryption (nostr-tools/nip04) | NIP-04 uses secp256k1 ECDH + AES-CBC, not AES-GCM; designed for Nostr DM pairs, not symmetric blob encryption with a shareable key | Web Crypto API AES-256-GCM directly |
| Next.js `<Image>` component for gallery display | Expects static/server-optimized images; decrypted blobs are ephemeral object URLs created client-side at runtime — the optimization pipeline can't process them | Standard `<img>` tag with blob object URLs |
| Server Actions for upload | Would route encrypted blobs through Next.js server, adding latency and defeating the privacy model | Direct browser `fetch()` PUT to Blossom server from client component |
| next/font or server-side data fetching for album load | Album metadata is fetched from Nostr relays client-side after URL fragment decryption — no server can pre-fetch it | Client-side `useEffect` + WebSocket relay subscription via nostr-tools |

## Stack Patterns by Variant

**If the user has a Nostr extension (NIP-07, window.nostr):**
- Offer to sign the kind 30078 event with their extension key instead of the ephemeral key
- nostr-tools v2 has `nip07` helpers; detect `window.nostr` availability before generating ephemeral key
- This is an enhancement path, not required for MVP

**If uploading to multiple Blossom servers for redundancy:**
- blossom-client-sdk supports multi-server upload natively
- Store all server URLs in album metadata so viewer can try each if one fails
- Implement as parallel `Promise.all()` uploads, not sequential

**If processing 200 photos causes memory pressure:**
- Process in batches of 10-20 using a queue managed by Zustand
- Use `URL.revokeObjectURL()` aggressively after encryption to release memory
- Comlink + Web Worker isolates GC pressure from the main thread

**If relay publishing fails:**
- nostr-tools `SimplePool` handles multiple relays; publish to 3+ relays in parallel
- Encode relay hints in the shareable URL fragment so the viewer doesn't depend on the same relays being available

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| nostr-tools@2.23.3 | TypeScript >= 5.0 | Keys are `Uint8Array`, not hex strings — convert with `bytesToHex()` from nostr-tools for display |
| blossom-client-sdk@4.1.0 | nostr-tools@2.x | Auth event signing uses nostr-tools signing primitives; confirm type compatibility during integration |
| browser-image-compression@2.x | React 19 / Next.js 16 | `useWebWorker: true` requires OffscreenCanvas support (all modern browsers); falls back to main thread gracefully |
| yet-another-react-lightbox@3.29.1 | React 16.8+, React 19 | Fully compatible with React 19 per documentation |
| react-dropzone@15.0.0 | React 18+, React 19 | Latest major release; verify folder/directory drag support (`webkitdirectory`) in target browsers |
| Zustand@5.0.8 | React 18+ | Uses `useSyncExternalStore`; requires React 18 minimum — fine with Next.js 16 + React 19 |
| shadcn/ui (latest) | Tailwind CSS v4, React 19 | February 2025 update fully migrated to Tailwind v4; do not mix with Tailwind v3 components |
| Comlink@4.4.2 | Next.js 16 App Router | Must initialize worker inside `useEffect` (not render, not RSC) to avoid SSR errors; singleton pattern recommended |

## Sources

- [nostr-tools npm / JSR](https://jsr.io/@nostr/tools/versions) — version 2.23.3 confirmed (HIGH confidence)
- [blossom-client-sdk npm](https://www.npmjs.com/package/blossom-client-sdk) — version 4.1.0 (MEDIUM confidence, 7 months old)
- [blossom-client-sdk GitHub (hzrd149)](https://github.com/hzrd149/blossom-client-sdk) — auth flow features verified (HIGH confidence)
- [NDK GitHub monorepo](https://github.com/nostr-dev-kit/ndk) — package list and scope confirmed (HIGH confidence)
- [browser-image-compression GitHub](https://github.com/Donaldcwl/browser-image-compression) — WebP support, Web Worker, preserveExif confirmed (HIGH confidence)
- [react-dropzone npm](https://www.npmjs.com/package/react-dropzone) — version 15.0.0 (HIGH confidence)
- [yet-another-react-lightbox npm](https://www.npmjs.com/package/yet-another-react-lightbox) — version 3.29.1 (HIGH confidence)
- [Zustand GitHub/npm](https://github.com/pmndrs/zustand) — version 5.0.8 (HIGH confidence)
- [Comlink npm](https://www.npmjs.com/package/comlink) — version 4.4.2 (HIGH confidence)
- [Web Workers in Next.js 15 with Comlink](https://park.is/blog_posts/20250417_nextjs_comlink_examples/) — App Router pattern confirmed (MEDIUM confidence)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — v4 compatibility confirmed (HIGH confidence)
- [Next.js 16 release](https://nextjs.org/blog/next-16) — current version 16.2.0, Turbopack default (HIGH confidence)
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — AES-GCM support confirmed (HIGH confidence)
- [Blossom spec (hzrd149)](https://github.com/hzrd149/blossom) — protocol auth pattern (kind 24242, NIP-98 style) confirmed (HIGH confidence)

---
*Stack research for: Nostr + Blossom encrypted ephemeral photo sharing web app*
*Researched: 2026-03-19*
