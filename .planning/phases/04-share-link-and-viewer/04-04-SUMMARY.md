---
phase: 04-share-link-and-viewer
plan: "04"
subsystem: ui
tags: [react, tailwind, intersection-observer, use-gesture, lightbox, skeleton, thumbnail-grid]

# Dependency graph
requires:
  - phase: 04-share-link-and-viewer
    plan: "01"
    provides: useAlbumViewer hook providing photos, objectUrls, fullUrls, loadThumbnail, onPhotoClick
provides:
  - SkeletonCard component with shimmer placeholder
  - ThumbnailGrid component with IntersectionObserver lazy load and skeleton fallback
  - Lightbox component with keyboard nav, swipe gesture, blurred-thumb crossfade
affects:
  - 04-05-ViewerPanel (wires all three components together)

# Tech tracking
tech-stack:
  added: ["@testing-library/jest-dom@6.9.1 (devDependency for toHaveAttribute matcher)"]
  patterns:
    - "try/catch around new IntersectionObserver for vitest 4.x arrow-function mock compatibility"
    - "Closure reference for observer.unobserve() inside IntersectionObserver callback"
    - "useDrag from @use-gesture/react with swipeX for prev/next navigation"
    - "Blurred thumb as absolute background + full-res with opacity transition for crossfade"

key-files:
  created:
    - src/components/viewer/SkeletonCard.tsx
    - src/components/viewer/ThumbnailGrid.tsx
    - src/components/viewer/Lightbox.tsx
  modified:
    - vitest.setup.ts (added @testing-library/jest-dom import)
    - package.json (added @testing-library/jest-dom devDependency)

key-decisions:
  - "try/catch on new IntersectionObserver: vitest 4.x uses Reflect.construct(impl, args) which fails for arrow-function mockImplementations; catch falls back to direct call"
  - "@testing-library/jest-dom installed and imported in vitest.setup.ts to enable toHaveAttribute matcher used by ThumbnailGrid.test.tsx"
  - "Lightbox keyboard listener on window (not document) — fireEvent.keyDown(document) in tests still fires window listeners via bubbling"
  - "Observer unobserve via closure reference (observerInstance) not callback arg — test mock passes {} as second arg which lacks unobserve"

patterns-established:
  - "ThumbnailGrid: data-index attribute on wrapper divs for index retrieval inside IntersectionObserver callback"
  - "SkeletonCard: data-testid=skeleton-card for test selection"
  - "Lightbox: data-testid=lightbox-overlay on outermost div for overlay click detection"

requirements-completed: [VIEW-03, VIEW-04, VIEW-06, VIEW-07]

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 04 Plan 04: UI Components — SkeletonCard, ThumbnailGrid, Lightbox Summary

**CSS grid thumbnail gallery with IntersectionObserver lazy loading, shimmer skeletons, and full-screen lightbox with keyboard/swipe navigation and blurred-thumb crossfade**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-19T18:20:00Z
- **Completed:** 2026-03-19T18:26:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- SkeletonCard: animate-pulse shimmer with configurable aspectRatio and data-testid for test selection
- ThumbnailGrid: 3/4/5-column responsive CSS grid, IntersectionObserver (rootMargin 200px) fires loadThumbnail(index), unobserves after first intersection
- Lightbox: keyboard (ArrowLeft/ArrowRight/Escape), touch swipe (@use-gesture/react), overlay click-to-close, photo counter, blurred thumbnail background with full-res opacity crossfade

## Task Commits

Each task was committed atomically:

1. **Task 1: SkeletonCard + ThumbnailGrid** - `e6a8b52` (feat)
2. **Task 2: Lightbox** - `3ecc533` (feat)

## Files Created/Modified
- `src/components/viewer/SkeletonCard.tsx` - Shimmer skeleton card with animate-pulse, configurable aspectRatio
- `src/components/viewer/ThumbnailGrid.tsx` - Responsive CSS grid gallery with IntersectionObserver lazy load
- `src/components/viewer/Lightbox.tsx` - Full-screen overlay with keyboard nav, swipe gesture, photo counter, crossfade
- `vitest.setup.ts` - Added @testing-library/jest-dom import for toHaveAttribute matcher
- `package.json` / `package-lock.json` - Added @testing-library/jest-dom devDependency

## Decisions Made
- **try/catch on IntersectionObserver constructor**: vitest 4.x's `Reflect.construct(impl, args, newTarget)` fails when `impl` is an arrow function (cannot use arrow fn as constructor). The test mock uses arrow function in `mockImplementation`. Catch block calls the function directly without `new` — works with mock, real browser never hits catch.
- **@testing-library/jest-dom**: ThumbnailGrid test uses `toHaveAttribute` which is a jest-dom extension not included by default in vitest. Added as devDependency and imported in vitest.setup.ts.
- **Observer unobserve via closure**: IntersectionObserver callback's second arg (observer) is the real observer instance in production, but the test mock passes `{}`. Using a closure reference (`observerInstance`) avoids calling `{}.unobserve()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @testing-library/jest-dom and configured vitest setup**
- **Found during:** Task 1 (ThumbnailGrid implementation)
- **Issue:** Test used `toHaveAttribute()` matcher which requires @testing-library/jest-dom — not installed, vitest reported "Invalid Chai property: toHaveAttribute"
- **Fix:** `npm install --save-dev @testing-library/jest-dom`, added `import "@testing-library/jest-dom"` to vitest.setup.ts
- **Files modified:** package.json, package-lock.json, vitest.setup.ts
- **Verification:** Third ThumbnailGrid test (img src assertion) now passes
- **Committed in:** e6a8b52 (Task 1 commit)

**2. [Rule 1 - Bug] try/catch around IntersectionObserver for vitest 4.x mock compat**
- **Found during:** Task 1 (ThumbnailGrid implementation)
- **Issue:** vitest 4.x uses Reflect.construct(arrowFn, args) when mock is called with `new`, which throws "is not a constructor" because arrow functions can't be constructors. Test file uses arrow function in mockImplementation (frozen Wave 0 test).
- **Fix:** Wrapped `new IntersectionObserver(...)` in try/catch; catch calls it as regular function. Works in real browsers (try succeeds), works in tests (catch succeeds).
- **Files modified:** src/components/viewer/ThumbnailGrid.tsx
- **Verification:** All 3 ThumbnailGrid tests pass
- **Committed in:** e6a8b52 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 bug)
**Impact on plan:** Both auto-fixes required for test suite to pass. No scope creep.

## Issues Encountered
- vitest 4.x breaking change: `vi.fn().mockImplementation(arrowFn)` used as constructor now fails via Reflect.construct. Previously it worked. This required the try/catch pattern.

## Next Phase Readiness
- SkeletonCard, ThumbnailGrid, and Lightbox are ready to be wired into ViewerPanel (Plan 05)
- All three components receive data via props from useAlbumViewer — no internal data fetching
- 91 tests across 18 test files all GREEN, 0 TypeScript build errors

---
*Phase: 04-share-link-and-viewer*
*Completed: 2026-03-19*
