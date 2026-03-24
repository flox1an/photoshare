# PhotoShare Performance Optimization Plan

## Goal
Make the viewer and upload flows feel consistently fast on mobile and desktop, including large albums.

## Prioritized Improvements

### 1. Virtualize the masonry grid (highest impact)
- Render only visible thumbnails plus overscan.
- Avoid mounting hundreds/thousands of DOM nodes at once.
- Expected impact: largest reduction in main-thread work and memory pressure for large albums.

### 2. Memoize thumbnail tiles
- Extract `ThumbnailItem` and wrap with `React.memo`.
- Stabilize props with `useCallback` and avoid recreating inline objects where possible.
- Ensure one thumbnail state update does not rerender the full grid.

### 3. Reduce state fan-out in viewer data
- Avoid replacing large `objectUrls`/`fullUrls` maps if only one key changes.
- Move toward keyed/per-item updates so only changed tiles rerender.
- Consider lightweight selector-based store patterns for per-item subscriptions.

### 4. Tune image loading and decoding
- Use `loading="lazy"` and `decoding="async"` for non-critical images.
- Use `img.decode()` before swapping into view to reduce visual jank.
- Keep `fetchpriority="high"` only for currently focused lightbox image.

### 5. Keep heavy work off the main thread
- Continue running expensive transforms/decryption in workers.
- Ensure main thread does orchestration and rendering only.

### 6. Improve caching strategy
- Leverage service worker cache for thumbnails/manifest/static assets.
- Add in-memory LRU cache for recently viewed/decrypted full-size images.
- Version and prune caches to avoid unbounded growth.

### 7. Avoid layout thrash during scroll
- Keep using fixed aspect-ratio placeholders.
- Avoid synchronous measure/reflow loops in scroll handlers.
- Keep scroll listeners passive and throttled/debounced where applicable.

### 8. Maintain route/feature code-splitting
- Keep heavy viewer functionality lazily loaded.
- Defer non-critical logic until needed.

## Measurement and Rollout Strategy

### Baseline first
- Capture current metrics before changes:
  - Initial load time (cold/warm)
  - Time to interactive on viewer route
  - Scroll FPS in large albums
  - Lightbox open latency
  - Memory usage during extended browsing

### Implement in phases
1. Memoized thumbnail item isolation.
2. Virtualized masonry rendering.
3. Viewer state fan-out reduction.
4. Image decode/fetch-priority tuning.
5. Cache and worker improvements.

### Verify each phase
- Re-run the same metrics after each phase.
- Keep only changes that measurably improve user-perceived performance.

## Suggested Immediate Next Step
Implement memoized `ThumbnailItem` plus stable props first (low risk, clear gain), then profile again before introducing virtualization.
