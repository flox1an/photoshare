---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (native ESM, no transform needed for applesauce/nostr-tools ESM exports) |
| **Config file** | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + `next build` exits 0
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | CRYPT-01 | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CRYPT-02 | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CRYPT-03 | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CRYPT-04 | unit | `npx vitest run src/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | CONF-04 | unit | `npx vitest run src/lib/config.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | Build | smoke | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework setup (environment: "jsdom" for Web Crypto API in tests)
- [ ] `npm install -D vitest @vitest/ui jsdom` — test framework install
- [ ] `src/lib/crypto.test.ts` — stubs for CRYPT-01, CRYPT-02, CRYPT-03, CRYPT-04
- [ ] `src/lib/config.test.ts` — stubs for CONF-04
- [ ] `src/lib/nostr/signer.test.ts` — stubs for UPLD-04 (ephemeral signer correctness)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSR safety — no window/crypto errors in `next build` | Build | Build output inspection | Run `npm run build` and verify no "window is not defined" errors |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
