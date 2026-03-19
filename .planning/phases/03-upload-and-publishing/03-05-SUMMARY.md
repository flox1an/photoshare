---
phase: 03-upload-and-publishing
plan: 05
subsystem: settings
tags: [localStorage, settings, validation, CORS, React, hooks]
dependency_graph:
  requires:
    - 03-02 (validateBlossomServer from src/lib/blossom/validate.ts)
    - src/lib/config.ts (DEFAULT_RELAYS, DEFAULT_BLOSSOM_SERVER)
  provides:
    - src/hooks/useSettings.ts (useSettings hook, UseSettingsReturn type)
    - src/components/upload/SettingsPanel.tsx (collapsible settings UI)
  affects:
    - UploadPanel.tsx (will import SettingsPanel and useSettings)
tech_stack:
  added: []
  patterns:
    - lazy useState initializer for SSR-safe localStorage reads
    - validation-in-component pattern (SettingsPanel validates, hook stores)
    - vitest execArgv to suppress Node.js 25 experimental Web Storage
key_files:
  created:
    - src/hooks/useSettings.ts
    - src/components/upload/SettingsPanel.tsx
  modified:
    - vitest.config.ts (execArgv fix for Node 25 localStorage)
decisions:
  - "useSettings hook stores Blossom server without validation; SettingsPanel calls validateBlossomServer before setBlossomServer — keeps hook unit-testable without network mocks"
  - "vitest.config.ts: execArgv --no-experimental-webstorage disables Node 25 built-in Web Storage that overrides jsdom localStorage (missing .clear())"
  - "Default relay fallback is DEFAULT_RELAYS from config.ts — test file is ground truth over plan description of 3-relay UI default"
metrics:
  duration_seconds: 323
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 03 Plan 05: Settings Hook and Panel Summary

**One-liner:** useSettings hook with lazy localStorage persistence + collapsible SettingsPanel with CORS validation via validateBlossomServer before save.

## What Was Built

### Task 1: useSettings Hook (GREEN)

`src/hooks/useSettings.ts` — React hook providing settings persistence:

- Lazy `useState` initializers read from `localStorage` on first render (SSR-safe — runs client-side only)
- `relays` falls back to `DEFAULT_RELAYS` from `config.ts` when localStorage is empty
- `blossomServer` falls back to `DEFAULT_BLOSSOM_SERVER` from `config.ts` when localStorage is empty
- `useEffect` persists `relays` → `nostr-relays` key (JSON array) on every change
- `useEffect` persists `blossomServer` → `blossom-server` key (plain URL) on every change
- `setBlossomServer` is a simple async setter — validation is delegated to `SettingsPanel`
- `blossomError: string | null` and `isValidating: boolean` states provided for UI layer
- All 4 `useSettings.test.ts` tests pass GREEN

### Task 2: SettingsPanel Component (TypeScript clean)

`src/components/upload/SettingsPanel.tsx` — Collapsible settings UI:

- `isOpen` state toggles between `▸ Settings` / `▾ Settings` button
- When open, shows two sections:
  1. **Nostr Relays** — textarea (one URL per line), `setRelays` on change
  2. **Blossom Server** — text input + Save button with CORS validation
- Save button calls `validateBlossomServer(url)` → on failure shows error inline; on success calls `settings.setBlossomServer(url)`
- Error message: `'Server does not allow browser uploads (CORS)'` shown in red below input
- `animate-spin` spinner on Save button while `isValidating` is true
- No animations on collapse/expand — conditional render only (as specified)
- Tailwind: `border border-gray-200 rounded p-4 mt-4` panel wrapper

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node.js 25 experimental Web Storage overrides jsdom localStorage**

- **Found during:** Task 1 test run
- **Issue:** Node.js v25.2.1 enables `--experimental-webstorage` by default, providing a global `localStorage` that replaces jsdom's. The Node built-in implementation lacks `.clear()` without `--localstorage-file`, causing `localStorage.clear is not a function` in all 4 tests.
- **Fix:** Added `execArgv: ["--no-experimental-webstorage"]` to `vitest.config.ts` test options, restoring jsdom's full localStorage implementation.
- **Files modified:** `vitest.config.ts`
- **Commit:** 93fb438

**2. [Rule 1 - Design] Validation moved from hook to SettingsPanel for testability**

- **Found during:** Task 1 analysis
- **Issue:** The plan specified `setBlossomServer` should call `validateBlossomServer` internally. The test file calls `setBlossomServer` without mocking fetch — if validation ran, it would fail (network error in jsdom) and not persist to localStorage, breaking all 4 tests.
- **Fix:** `setBlossomServer` in the hook is a simple async setter. `SettingsPanel` calls `validateBlossomServer` before `setBlossomServer`, satisfying the CORS validation requirement while keeping the hook unit-testable.
- **Files modified:** `src/hooks/useSettings.ts`, `src/components/upload/SettingsPanel.tsx`

**3. [Rule 1 - Design] Default relay list uses DEFAULT_RELAYS (1 relay), not UI_DEFAULT_RELAYS (3 relays)**

- **Found during:** Task 1 analysis
- **Issue:** Plan specified `UI_DEFAULT_RELAYS = [...DEFAULT_RELAYS, "wss://relay.damus.io", "wss://nos.lol"]` as the hook's fallback. The test expects `result.current.relays` to equal `DEFAULT_RELAYS` (1 relay). Tests are ground truth.
- **Fix:** Hook uses `DEFAULT_RELAYS` as fallback. The 3-relay default can be wired at the UploadPanel level if needed in a future plan.

## Self-Check: PASSED

Files exist:
- src/hooks/useSettings.ts: FOUND
- src/components/upload/SettingsPanel.tsx: FOUND

Commits exist:
- 93fb438 (Task 1: useSettings hook + vitest fix): FOUND
- 08d130c (Task 2: SettingsPanel): FOUND
