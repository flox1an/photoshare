---
phase: 4
slug: share-link-and-viewer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (configured) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |

## Sampling Rate

- **After every task commit:** `npx vitest run`
- **After every plan wave:** `npx vitest run && npm run build`
- **Before verify-work:** Full suite green + build clean

## Manual-Only Verifications

| Behavior | Requirement | Why Manual |
|----------|-------------|------------|
| Share link opens in fresh tab, shows grid | VIEW-01 | Requires real browser + relay + Blossom |
| Lightbox with keyboard + swipe | VIEW-04 | Touch/keyboard interaction |
| Mobile responsive portrait | VIEW-07 | Device viewport testing |
| Lazy loading (thumbs first, full on demand) | VIEW-06 | Network behavior |
| Download all as ZIP | VIEW-05 | File system interaction |

**Approval:** pending
