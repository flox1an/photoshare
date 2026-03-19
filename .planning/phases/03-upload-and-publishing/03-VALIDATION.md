---
phase: 3
slug: upload-and-publishing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (configured in Phase 1) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + `next build` exits 0
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | UPLD-01 | unit | `npx vitest run src/lib/blossom` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UPLD-02 | unit | `npx vitest run src/lib/blossom` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UPLD-03 | unit | `npx vitest run src/lib/blossom` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UPLD-05 | unit | `npx vitest run src/lib/nostr` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UPLD-06 | unit | `npx vitest run src/lib/nostr` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UPLD-07 | manual | Browser upload test | N/A | ⬜ pending |
| TBD | TBD | TBD | UPLD-08 | manual | Browser end-to-end | N/A | ⬜ pending |
| TBD | TBD | TBD | CONF-01 | unit | `npx vitest run src/store` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CONF-02 | unit | `npx vitest run src/store` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Blossom upload test helpers (mock fetch for upload responses)
- [ ] Nostr event publishing test helpers

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload progress UI shows states | UPLD-07 | Requires real browser + Blossom server | Drop photos, watch progress through encrypting→uploading→done |
| Share link only after all uploads + relay OK | UPLD-08 | Requires real Blossom + relay | Upload album, verify link appears only after completion |
| Settings panel persists in localStorage | CONF-01/02 | localStorage not in jsdom | Change settings, reload, verify values persist |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
