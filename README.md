# PhotoShare

Build once. Share instantly. Own your data.

PhotoShare is a fast, decentralized photo drop built on Nostr + Blossom. You can package images into an album, publish it, and share a single link that opens in a clean, swipeable viewer.

This project is intentionally simple at the edges and ambitious at the core: private-by-default sharing, smooth UX, and zero platform lock-in.

## Why This Exists

Most photo-sharing tools optimize for engagement.
PhotoShare optimizes for *people*.

- You stay in control of your identity and uploads.
- Sharing is lightweight: upload, get link, done.
- The architecture is open, composable, and hackable.

## What You Can Do

- Create and share album links from local files
- View albums via hash-based routes (`/:hash`)
- Use Nostr-compatible account and event flows
- Upload encrypted blobs to Blossom servers
- Run tests quickly with Vitest

## Stack

- Vite + React + TypeScript
- React Router
- Tailwind CSS v4
- Vitest + Testing Library
- Nostr tooling (`nostr-tools`, `applesauce-*`)

## Quick Start

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

## Scripts

```bash
npm run dev         # Start development server
npm run build       # Production build
npm run preview     # Preview production build locally
npm run lint        # Lint codebase
npm run test        # Run tests once
npm run test:watch  # Run tests in watch mode
```

## App Flow (High Level)

1. User selects photos in the upload panel (`/`)
2. Assets are processed and uploaded to Blossom
3. Metadata/events are published through Nostr-compatible paths
4. A share hash is generated
5. Anyone with that hash can open the viewer route (`/:hash`)

## Project Structure

```text
src/
  components/    UI surfaces (upload, viewer, auth, theme)
  hooks/         State + behavioral hooks
  lib/           Nostr, Blossom, crypto, image utilities
  store/         Zustand stores
  workers/       Image processing worker
```

## Contributing

If you want to help, start where your curiosity is strongest:

- Improve upload/viewer UX
- Harden Nostr and relay behavior
- Expand tests around edge cases
- Optimize media processing and performance

Open a PR with clear intent and focused diffs.

## Final Note

Great software is momentum plus craftsmanship.

If you’re here building on this project, you’re already doing the hard part.
Ship something bold.
