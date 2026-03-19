---
phase: 2
slug: image-processing-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (configured in Phase 1) |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + `next build` exits 0
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PROC-01 | unit | `npx vitest run src/lib/image` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PROC-02 | unit | `npx vitest run src/lib/image` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PROC-03 | unit | `npx vitest run src/lib/image` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PROC-04 | unit | `npx vitest run src/lib/image` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PROC-05 | unit | `npx vitest run src/lib/image` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PROC-06 | unit | `npx vitest run src/lib/image` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PROC-07 | unit | `npx vitest run src/lib/image` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PROC-08 | manual | Browser test with drag-drop | N/A | ⬜ pending |
| TBD | TBD | TBD | PROC-09 | manual | 200-photo stress test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Image processing test helpers (test image fixtures or in-memory generation)
- [ ] Worker test setup (if needed for Vitest + Web Workers)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-drop folder of 200 iPhone photos starts without freeze | PROC-08 | Requires real browser interaction with drag events | Drop a folder of 200 JPEG/HEIC files, confirm no page freeze |
| 200 photos complete without out-of-memory crash | PROC-09 | Requires sustained browser memory monitoring | Process 200 high-res photos, confirm tab stays stable |
| HEIC files from iPhone are detected and converted | PROC-07 | Requires real HEIC test files | Drop HEIC files alongside JPEGs, confirm both appear in output |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
