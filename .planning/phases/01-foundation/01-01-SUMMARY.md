---
phase: 01-foundation
plan: "01"
subsystem: scaffold
tags: [nextjs, vitest, ssr, dependencies, turbopack]
dependency_graph:
  requires: []
  provides:
    - Next.js 16 App Router project with TypeScript and Tailwind
    - Vitest test runner configured with jsdom environment
    - SSR boundary pattern via dynamic import with ssr:false
    - All applesauce and nostr-tools packages installed
  affects:
    - All subsequent plans depend on this buildable project base
tech_stack:
  added:
    - next@16.2.0
    - react@19.2.4
    - applesauce-core@^5.1.0
    - applesauce-signers@^5.1.0
    - applesauce-factory@^4.0.0
    - applesauce-relay@^5.1.0
    - applesauce-loaders@^5.1.0
    - nostr-tools@^2.23.3
    - vitest@^4.1.0
    - jsdom@^29.0.0
    - "@vitejs/plugin-react@^6.0.1"
  patterns:
    - Client Component wrapper with dynamic(..., { ssr: false }) for browser-only components
    - React.use(params) for async route params in Client Components
key_files:
  created:
    - path: package.json
      purpose: Project manifest with all dependencies declared
    - path: vitest.config.ts
      purpose: Vitest configuration with jsdom environment and @/* alias
    - path: src/app/page.tsx
      purpose: Upload page — Client Component wrapper with ssr:false dynamic import
    - path: src/app/view/[naddr]/page.tsx
      purpose: Viewer route — Client Component wrapper with ssr:false dynamic import
    - path: src/components/upload/UploadPanel.tsx
      purpose: Upload panel stub (use client, full implementation in Phase 3)
    - path: src/components/viewer/ViewerPanel.tsx
      purpose: Viewer panel stub (use client, full implementation in Phase 4)
  modified:
    - path: next.config.ts
      purpose: Added turbopack.root to silence workspace root warning
    - path: tsconfig.json
      purpose: Updated @/* path alias to ./src/* for src/ directory layout
decisions:
  - "Next.js 16 Turbopack requires ssr:false dynamic imports in Client Components — page wrappers use 'use client'"
  - "React.use(params) instead of async/await for params in Client Component viewer page"
  - "Moved app/ to src/app/ after scaffolding since create-next-app didn't create src/ dir automatically"
metrics:
  duration_seconds: 569
  completed_date: "2026-03-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 3
---

# Phase 1 Plan 1: Next.js Scaffold and SSR Boundaries Summary

**One-liner:** Next.js 16.2.0 App Router project scaffolded with full applesauce/nostr-tools ecosystem, Vitest jsdom test runner, and client-side SSR boundary pattern using `dynamic(..., { ssr: false })` in Client Component wrappers.

## What Was Built

### Scaffolded Stack
- **Next.js 16.2.0** with Turbopack, App Router, TypeScript strict mode, Tailwind CSS v4
- **React 19.2.4** (ships with Next.js 16)
- Project structure uses `src/` directory with `@/*` alias pointing to `./src/*`

### Packages Installed
All applesauce ecosystem packages at latest (^5.1.0 for core/signers/relay/loaders, ^4.0.0 for factory):
- `applesauce-core`, `applesauce-signers`, `applesauce-factory`, `applesauce-relay`, `applesauce-loaders`
- `nostr-tools@^2.23.3` (peer dependency and NIP-19 encoding)
- `vitest@^4.1.0`, `jsdom@^29.0.0`, `@vitejs/plugin-react@^6.0.1`

### SSR Boundary Pattern
Both `src/app/page.tsx` and `src/app/view/[naddr]/page.tsx` use `"use client"` with `dynamic(..., { ssr: false })` to prevent `window is not defined` crashes during Next.js prerender.

### Vitest Configuration
`vitest.config.ts` at project root with `environment: "jsdom"` (Web Crypto API available in tests via Node 19+ built-in) and `@/*` alias matching TypeScript paths.

## Build Verification

`npm run build` exits 0. Output:
- Route `/` — Static (prerendered)
- Route `/view/[naddr]` — Dynamic (server-rendered on demand)
- No `window is not defined` errors
- No TypeScript errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 16 Turbopack rejects `ssr: false` in Server Components**
- **Found during:** Task 2 — first build attempt
- **Issue:** Next.js 16 with Turbopack enforces that `dynamic(..., { ssr: false })` can only be called inside Client Components, not Server Components. The plan's pattern (Server Component wrapper) fails with: `` `ssr: false` is not allowed with `next/dynamic` in Server Components ``
- **Fix:** Added `"use client"` to both `src/app/page.tsx` and `src/app/view/[naddr]/page.tsx`. For the viewer page, `async function + await params` was replaced with `React.use(params)` since Client Components cannot be async.
- **Files modified:** `src/app/page.tsx`, `src/app/view/[naddr]/page.tsx`
- **Commits:** 5f6f261

**2. [Rule 1 - Bug] Turbopack workspace root warning from lockfiles in parent directories**
- **Found during:** Task 2 — first build attempt
- **Issue:** Turbopack detected multiple `package-lock.json` files in parent directories and emitted a workspace root warning
- **Fix:** Added `turbopack: { root: path.resolve(__dirname) }` to `next.config.ts`
- **Files modified:** `next.config.ts`
- **Commit:** 5f6f261

**3. [Rule 3 - Structural] `create-next-app` did not create `src/` directory**
- **Found during:** Task 1 — scaffold
- **Issue:** Running `create-next-app` in the photoshare directory fails due to `.planning/` directory conflict. Scaffolding to a temp directory (`photoshare-scaffold`) produced `app/` layout without `src/`
- **Fix:** Rsync'd scaffold files to photoshare, manually moved `app/` to `src/app/`, updated `tsconfig.json` paths alias from `./*` to `./src/*`
- **Files modified:** `tsconfig.json`
- **Commit:** 0a9483a

## Self-Check: PASSED

All created files confirmed present on disk. Both task commits (0a9483a, 5f6f261) confirmed in git log. `npm run build` exits 0 with no errors.
