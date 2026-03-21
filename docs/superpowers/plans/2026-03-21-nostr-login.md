# Nostr Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Nostr login (NIP-07 extension, NIP-46 bunker, NIP-46 QR/NostrConnect) so uploads can be signed by the user's account instead of an ephemeral key.

**Architecture:** A Zustand store (`nostrAccountStore`) holds the active signer and pubkey; when present, `useUpload` uses it instead of the ephemeral one. A `NostrAccountRestorer` client component in the root layout silently reconnects persisted sessions on boot. Three login methods live in a modal dialog with tabs.

**Tech Stack:** Next.js 16 (App Router), Zustand, applesauce-signers (already installed), nostr-tools (already installed), qrcode.react (new dep)

**Spec:** `docs/superpowers/specs/2026-03-21-nostr-login-design.md`

**Run all tests:** `npm test`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/store/nostrAccountStore.ts` | Create | Account state (pubkey, signer, type), localStorage persistence |
| `src/store/nostrAccountStore.test.ts` | Create | Store unit tests |
| `src/lib/nostr/nip05.ts` | Create | `isNip05()` + `resolveNip05ToBunkerUri()` utility |
| `src/lib/nostr/nip05.test.ts` | Create | NIP-05 unit tests |
| `src/lib/nostr/relay.ts` | Create | SimplePool wrapper: `subscriptionMethod` + `publishMethod` |
| `src/types/global.d.ts` | Create | `window.nostr` type declaration |
| `src/hooks/useLoginActions.ts` | Create | `extension()`, `bunker()`, `logout()` actions |
| `src/hooks/useLoginActions.test.ts` | Create | Login action unit tests |
| `src/components/auth/QRCodeLogin.tsx` | Create | NostrConnect QR tab component |
| `src/components/auth/LoginDialog.tsx` | Create | Modal dialog with 3 tabs |
| `src/components/auth/NostrAccountRestorer.tsx` | Create | Session restore on boot (client component) |
| `src/app/layout.tsx` | Modify | Mount `<NostrAccountRestorer />` |
| `src/hooks/useUpload.ts` | Modify | Use account signer when available |
| `src/components/upload/UploadPanel.tsx` | Modify | Sign in/out controls in header |

---

## Task 1: Install dependency + global type

**Files:**
- Modify: `package.json`
- Create: `src/types/global.d.ts`

- [ ] **Step 1: Install qrcode.react**

```bash
cd /Users/flox/dev/nostr/photoshare && npm install qrcode.react
```

Expected: `package.json` now lists `"qrcode.react"` in dependencies.

- [ ] **Step 2: Create window.nostr type declaration**

Create `src/types/global.d.ts`:
```ts
// Type declaration for the NIP-07 Nostr browser extension API
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>
      signEvent(event: object): Promise<object>
    }
  }
}

export {}
```

- [ ] **Step 3: Verify TypeScript sees the declaration**

```bash
cd /Users/flox/dev/nostr/photoshare && npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors from the declaration.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/types/global.d.ts
git commit -m "feat: add qrcode.react dep and window.nostr type declaration"
```

---

## Task 2: Nostr account Zustand store

**Files:**
- Create: `src/store/nostrAccountStore.ts`
- Create: `src/store/nostrAccountStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/store/nostrAccountStore.test.ts`:
```ts
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest'
import { useNostrAccountStore, getPersistedAccount } from '@/store/nostrAccountStore'

const STORAGE_KEY = 'photoshare:account'

describe('useNostrAccountStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useNostrAccountStore.setState({
      pubkey: null,
      signer: null,
      type: null,
      bunkerUri: null,
      restoring: false,
    })
  })

  it('initial state is all-null', () => {
    const s = useNostrAccountStore.getState()
    expect(s.pubkey).toBeNull()
    expect(s.signer).toBeNull()
    expect(s.type).toBeNull()
    expect(s.bunkerUri).toBeNull()
    expect(s.restoring).toBe(false)
  })

  it('login() sets pubkey, type, and signer in store', () => {
    const fakeSigner = {} as never
    useNostrAccountStore.getState().login('extension', fakeSigner, 'abc123')
    const s = useNostrAccountStore.getState()
    expect(s.pubkey).toBe('abc123')
    expect(s.signer).toBe(fakeSigner)
    expect(s.type).toBe('extension')
    expect(s.bunkerUri).toBeNull()
  })

  it('login() persists {type} to localStorage for extension', () => {
    useNostrAccountStore.getState().login('extension', {} as never, 'abc123')
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.type).toBe('extension')
    expect(parsed.bunkerUri).toBeUndefined()
  })

  it('login() persists {type, bunkerUri} to localStorage for bunker', () => {
    useNostrAccountStore
      .getState()
      .login('bunker', {} as never, 'abc123', 'bunker://pubkey?relay=wss://r.com')
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(parsed.type).toBe('bunker')
    expect(parsed.bunkerUri).toBe('bunker://pubkey?relay=wss://r.com')
  })

  it('logout() clears state and removes localStorage entry', () => {
    useNostrAccountStore.getState().login('extension', {} as never, 'abc123')
    useNostrAccountStore.getState().logout()
    const s = useNostrAccountStore.getState()
    expect(s.pubkey).toBeNull()
    expect(s.signer).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('setRestoring() toggles the restoring flag', () => {
    useNostrAccountStore.getState().setRestoring(true)
    expect(useNostrAccountStore.getState().restoring).toBe(true)
    useNostrAccountStore.getState().setRestoring(false)
    expect(useNostrAccountStore.getState().restoring).toBe(false)
  })
})

describe('getPersistedAccount', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when localStorage is empty', () => {
    expect(getPersistedAccount()).toBeNull()
  })

  it('returns the parsed object when present', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'extension' }))
    expect(getPersistedAccount()).toEqual({ type: 'extension' })
  })

  it('returns null for malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{{')
    expect(getPersistedAccount()).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test -- nostrAccountStore
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

Create `src/store/nostrAccountStore.ts`:
```ts
import { create } from 'zustand'
import type { ExtensionSigner, NostrConnectSigner } from 'applesauce-signers'

export type AccountType = 'extension' | 'bunker'

export interface PersistedAccount {
  type: AccountType
  bunkerUri?: string
}

interface NostrAccountState {
  pubkey: string | null
  signer: ExtensionSigner | NostrConnectSigner | null
  type: AccountType | null
  bunkerUri: string | null
  restoring: boolean
  login: (
    type: AccountType,
    signer: ExtensionSigner | NostrConnectSigner,
    pubkey: string,
    bunkerUri?: string,
  ) => void
  logout: () => void
  setRestoring: (v: boolean) => void
}

const STORAGE_KEY = 'photoshare:account'

export const useNostrAccountStore = create<NostrAccountState>((set) => ({
  pubkey: null,
  signer: null,
  type: null,
  bunkerUri: null,
  restoring: false,

  login: (type, signer, pubkey, bunkerUri) => {
    const persisted: PersistedAccount = {
      type,
      ...(bunkerUri ? { bunkerUri } : {}),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    set({ pubkey, signer, type, bunkerUri: bunkerUri ?? null })
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ pubkey: null, signer: null, type: null, bunkerUri: null })
  },

  setRestoring: (v) => set({ restoring: v }),
}))

export function getPersistedAccount(): PersistedAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedAccount
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test -- nostrAccountStore
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/nostrAccountStore.ts src/store/nostrAccountStore.test.ts
git commit -m "feat: add nostrAccountStore with login/logout and localStorage persistence"
```

---

## Task 3: NIP-05 resolver utility

**Files:**
- Create: `src/lib/nostr/nip05.ts`
- Create: `src/lib/nostr/nip05.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/nostr/nip05.test.ts`:
```ts
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isNip05, resolveNip05ToBunkerUri } from '@/lib/nostr/nip05'

describe('isNip05', () => {
  it('returns true for user@domain.com', () => {
    expect(isNip05('user@domain.com')).toBe(true)
  })

  it('returns true for _@domain.com (root user)', () => {
    expect(isNip05('_@domain.com')).toBe(true)
  })

  it('returns true for domain.tld without @', () => {
    expect(isNip05('domain.tld')).toBe(true)
  })

  it('returns false for bunker:// URIs', () => {
    expect(isNip05('bunker://abc123?relay=wss://r.com')).toBe(false)
  })

  it('returns false for plain word with no dot', () => {
    expect(isNip05('justword')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isNip05('')).toBe(false)
  })
})

describe('resolveNip05ToBunkerUri', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves user@domain to a bunker URI using nip46.relays', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        names: { alice: 'pubkey123' },
        nip46: { relays: ['wss://relay.example.com'] },
      }),
    } as Response)

    const result = await resolveNip05ToBunkerUri('alice@example.com')
    expect(result.pubkey).toBe('pubkey123')
    expect(result.relays).toEqual(['wss://relay.example.com'])
    expect(result.bunkerUri).toBe(
      `bunker://pubkey123?relay=${encodeURIComponent('wss://relay.example.com')}`,
    )
  })

  it('falls back to relays[pubkey] when nip46 is absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        names: { alice: 'pk1' },
        relays: { pk1: ['wss://fallback.relay'] },
      }),
    } as Response)

    const result = await resolveNip05ToBunkerUri('alice@example.com')
    expect(result.relays).toEqual(['wss://fallback.relay'])
  })

  it('throws when user is not found in names', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ names: {} }),
    } as Response)

    await expect(resolveNip05ToBunkerUri('nobody@example.com')).rejects.toThrow(
      '"nobody" not found',
    )
  })

  it('throws when HTTP response is not OK', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    await expect(resolveNip05ToBunkerUri('user@example.com')).rejects.toThrow('404')
  })

  it('throws when no relays are found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ names: { user: 'pk1' } }),
    } as Response)

    await expect(resolveNip05ToBunkerUri('user@example.com')).rejects.toThrow('No relays')
  })

  it('throws when fetch itself fails (network error)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    await expect(resolveNip05ToBunkerUri('user@example.com')).rejects.toThrow(
      'Failed to reach',
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test -- nip05
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/nostr/nip05.ts`:
```ts
const NIP05_REGEX = /^(?:([^@]+)@)?([^\s]+)$/

export interface Nip05BunkerResult {
  pubkey: string
  relays: string[]
  bunkerUri: string
}

interface NostrJsonResponse {
  names?: Record<string, string>
  relays?: Record<string, string[]>
  nip46?: { relays?: string[]; nostrconnect_url?: string }
}

export function isNip05(value: string): boolean {
  if (!value) return false
  if (value.startsWith('bunker://')) return false
  if (value.includes('@')) return NIP05_REGEX.test(value)
  return value.includes('.') && NIP05_REGEX.test(value)
}

export async function resolveNip05ToBunkerUri(nip05: string): Promise<Nip05BunkerResult> {
  const match = nip05.match(NIP05_REGEX)
  if (!match) throw new Error('Invalid NIP-05 address format')

  const name = match[1] || '_'
  const domain = match[2]
  const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`

  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error(`Failed to reach ${domain} for NIP-05 lookup`)
  }

  if (!response.ok) {
    throw new Error(`NIP-05 lookup failed: ${response.status} from ${domain}`)
  }

  let data: NostrJsonResponse
  try {
    data = await response.json()
  } catch {
    throw new Error(`Invalid JSON response from ${domain}`)
  }

  const pubkey = data.names?.[name]
  if (!pubkey) throw new Error(`User "${name}" not found on ${domain}`)

  let relays: string[] = []
  if (data.nip46?.relays?.length) {
    relays = data.nip46.relays
  } else if (data.relays?.[pubkey]?.length) {
    relays = data.relays[pubkey]
  }

  if (relays.length === 0) throw new Error(`No relays found for bunker connection on ${domain}`)

  const params = relays.map((r) => `relay=${encodeURIComponent(r)}`).join('&')
  const bunkerUri = `bunker://${pubkey}?${params}`

  return { pubkey, relays, bunkerUri }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test -- nip05
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nostr/nip05.ts src/lib/nostr/nip05.test.ts
git commit -m "feat: add NIP-05 resolver utility for bunker URI lookup"
```

---

## Task 4: Relay wrapper for NostrConnect

**Files:**
- Create: `src/lib/nostr/relay.ts`

No unit tests — this wraps WebSocket I/O, covered by integration.

- [ ] **Step 1: Create relay.ts**

Create `src/lib/nostr/relay.ts`:
```ts
import { SimplePool } from 'nostr-tools'
import type { Filter, NostrEvent } from 'nostr-tools'

// Module-level singleton — shared across all NostrConnect sessions.
const pool = new SimplePool()

/**
 * Subscribe to events on the given relays.
 * Returns a cleanup function that closes the subscription.
 * Used by NostrConnectSigner from applesauce-signers.
 */
export function subscriptionMethod(
  relays: string[],
  filters: Filter[],
  handlers: { onevent: (event: NostrEvent) => void; oneose?: () => void },
): () => void {
  const sub = pool.subscribeMany(relays, filters, handlers)
  return () => sub.close()
}

/**
 * Publish an event to the given relays.
 * Settles all relay promises; individual relay failures are non-fatal.
 * Used by NostrConnectSigner from applesauce-signers.
 */
export async function publishMethod(relays: string[], event: NostrEvent): Promise<void> {
  await Promise.allSettled(pool.publish(relays, event))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/flox/dev/nostr/photoshare && npx tsc --noEmit 2>&1 | grep relay
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/nostr/relay.ts
git commit -m "feat: add relay.ts SimplePool wrapper for NostrConnect signer I/O"
```

---

## Task 5: Login actions hook

**Files:**
- Create: `src/hooks/useLoginActions.ts`
- Create: `src/hooks/useLoginActions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useLoginActions.test.ts`:
```ts
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLoginActions } from '@/hooks/useLoginActions'
import { useNostrAccountStore } from '@/store/nostrAccountStore'

// Mock applesauce-signers
vi.mock('applesauce-signers', () => ({
  ExtensionSigner: vi.fn().mockImplementation(() => ({
    getPublicKey: vi.fn().mockResolvedValue('extpubkey'),
  })),
  NostrConnectSigner: {
    fromBunkerURI: vi.fn().mockResolvedValue({
      getPublicKey: vi.fn().mockResolvedValue('bunkerpubkey'),
    }),
  },
}))

// Mock nip05 resolver
vi.mock('@/lib/nostr/nip05', () => ({
  isNip05: vi.fn((v: string) => v.includes('@')),
  resolveNip05ToBunkerUri: vi.fn().mockResolvedValue({
    bunkerUri: 'bunker://resolvedpk?relay=wss://r.com',
  }),
}))

describe('useLoginActions', () => {
  beforeEach(() => {
    localStorage.clear()
    useNostrAccountStore.setState({
      pubkey: null, signer: null, type: null, bunkerUri: null, restoring: false,
    })
    // Simulate extension present
    Object.defineProperty(window, 'nostr', {
      value: { getPublicKey: vi.fn(), signEvent: vi.fn() },
      configurable: true,
      writable: true,
    })
  })

  it('extension() sets pubkey and type in store', async () => {
    const { result } = renderHook(() => useLoginActions())
    await act(async () => {
      await result.current.extension()
    })
    expect(useNostrAccountStore.getState().pubkey).toBe('extpubkey')
    expect(useNostrAccountStore.getState().type).toBe('extension')
  })

  it('extension() throws when window.nostr is absent', async () => {
    Object.defineProperty(window, 'nostr', { value: undefined, configurable: true })
    const { result } = renderHook(() => useLoginActions())
    await expect(
      act(async () => { await result.current.extension() })
    ).rejects.toThrow('extension not found')
  })

  it('bunker() accepts bunker:// URI and sets store', async () => {
    const { result } = renderHook(() => useLoginActions())
    await act(async () => {
      await result.current.bunker('bunker://pk?relay=wss://r.com')
    })
    expect(useNostrAccountStore.getState().pubkey).toBe('bunkerpubkey')
    expect(useNostrAccountStore.getState().type).toBe('bunker')
  })

  it('bunker() resolves NIP-05 address before connecting', async () => {
    const { resolveNip05ToBunkerUri } = await import('@/lib/nostr/nip05')
    const { result } = renderHook(() => useLoginActions())
    await act(async () => {
      await result.current.bunker('user@example.com')
    })
    expect(resolveNip05ToBunkerUri).toHaveBeenCalledWith('user@example.com')
    expect(useNostrAccountStore.getState().pubkey).toBe('bunkerpubkey')
  })

  it('bunker() throws on empty input', async () => {
    const { result } = renderHook(() => useLoginActions())
    await expect(
      act(async () => { await result.current.bunker('') })
    ).rejects.toThrow('cannot be empty')
  })

  it('bunker() throws on invalid input (not bunker:// or NIP-05)', async () => {
    const { result } = renderHook(() => useLoginActions())
    await expect(
      act(async () => { await result.current.bunker('notvalid') })
    ).rejects.toThrow('bunker://')
  })

  it('logout() clears store', async () => {
    useNostrAccountStore.getState().login('extension', {} as never, 'abc')
    const { result } = renderHook(() => useLoginActions())
    act(() => { result.current.logout() })
    expect(useNostrAccountStore.getState().pubkey).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test -- useLoginActions
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/hooks/useLoginActions.ts`:
```ts
'use client'

import { ExtensionSigner, NostrConnectSigner } from 'applesauce-signers'
import { useNostrAccountStore } from '@/store/nostrAccountStore'
import { isNip05, resolveNip05ToBunkerUri } from '@/lib/nostr/nip05'

export function useLoginActions() {
  const { login, logout } = useNostrAccountStore()

  return {
    async extension(): Promise<void> {
      if (typeof window === 'undefined' || !('nostr' in window) || !window.nostr) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension.')
      }
      const signer = new ExtensionSigner()
      const pubkey = await signer.getPublicKey()
      login('extension', signer, pubkey)
    },

    async bunker(
      input: string,
      opts?: { onAuth?: (url: string) => void },
    ): Promise<void> {
      const trimmed = input.trim()
      if (!trimmed) throw new Error('Bunker URI cannot be empty')
      if (!trimmed.startsWith('bunker://') && !isNip05(trimmed)) {
        throw new Error('Enter a bunker:// URI or NIP-05 address (user@domain)')
      }

      let bunkerUri = trimmed
      if (isNip05(trimmed)) {
        const result = await resolveNip05ToBunkerUri(trimmed)
        bunkerUri = result.bunkerUri
      }

      const signer = await NostrConnectSigner.fromBunkerURI(bunkerUri, {
        onAuth: opts?.onAuth,
      })
      const pubkey = await signer.getPublicKey()
      login('bunker', signer, pubkey, bunkerUri)
    },

    logout,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test -- useLoginActions
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLoginActions.ts src/hooks/useLoginActions.test.ts
git commit -m "feat: add useLoginActions hook (extension, bunker, logout)"
```

---

## Task 6: QRCodeLogin component

**Files:**
- Create: `src/components/auth/QRCodeLogin.tsx`

No unit tests — depends on WebSocket relay handshake; covered by manual QA.

- [ ] **Step 1: Create QRCodeLogin.tsx**

Create `src/components/auth/QRCodeLogin.tsx`:
```tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { NostrConnectSigner } from 'applesauce-signers'
import { useNostrAccountStore } from '@/store/nostrAccountStore'
import { subscriptionMethod, publishMethod } from '@/lib/nostr/relay'

const NOSTRCONNECT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

function buildBunkerUri(remotePubkey: string, relays: string[], secret?: string): string {
  const params = new URLSearchParams()
  relays.forEach((relay) => params.append('relay', relay))
  if (secret) params.append('secret', secret)
  return `bunker://${remotePubkey}?${params.toString()}`
}

interface QRCodeLoginProps {
  onLogin: () => void
  onError: (msg: string) => void
}

export function QRCodeLogin({ onLogin, onError }: QRCodeLoginProps) {
  const [uri, setUri] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const { login } = useNostrAccountStore()

  const generate = useCallback(async () => {
    abortRef.current?.abort()
    setUri(null)
    setCopied(false)

    try {
      const signer = new NostrConnectSigner({
        relays: NOSTRCONNECT_RELAYS,
        subscriptionMethod,
        publishMethod,
      })

      const nostrConnectUri = signer.getNostrConnectURI({
        name: 'photoshare',
        url: typeof window !== 'undefined' ? window.location.origin : '',
      })
      setUri(nostrConnectUri)

      const controller = new AbortController()
      abortRef.current = controller

      await signer.waitForSigner(controller.signal)

      const pubkey = await signer.getPublicKey()
      const remote = signer.remote
      if (!remote) throw new Error('Failed to get remote signer pubkey')

      const bunkerUri = buildBunkerUri(remote, NOSTRCONNECT_RELAYS, signer.secret)
      login('bunker', signer, pubkey, bunkerUri)
      onLogin()
    } catch (err) {
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))
      if (isAbort) return
      onError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [login, onLogin, onError])

  useEffect(() => {
    void generate()
    return () => {
      abortRef.current?.abort()
    }
  }, [generate])

  const handleCopy = async () => {
    if (!uri) return
    try {
      await navigator.clipboard.writeText(uri)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm text-zinc-400">Scan with your Nostr signer app</p>
        <p className="text-xs text-zinc-600 mt-1">Amber, Nostrudel, or any NIP-46 signer</p>
      </div>

      <div className="p-4 bg-white rounded-xl">
        {uri ? (
          <QRCodeSVG value={uri} size={200} level="M" includeMargin={false} />
        ) : (
          <div className="w-[200px] h-[200px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-600 border-t-zinc-300 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          disabled={!uri}
          className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy URI'}
        </button>
        <button
          onClick={() => void generate()}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/flox/dev/nostr/photoshare && npx tsc --noEmit 2>&1 | grep -i "QRCode\|qrcode\|auth"
```

Expected: No errors from auth components.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/QRCodeLogin.tsx
git commit -m "feat: add QRCodeLogin component for NIP-46 NostrConnect flow"
```

---

## Task 7: Login dialog

**Files:**
- Create: `src/components/auth/LoginDialog.tsx`

- [ ] **Step 1: Create LoginDialog.tsx**

Create `src/components/auth/LoginDialog.tsx`:
```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { useLoginActions } from '@/hooks/useLoginActions'
import { isNip05 } from '@/lib/nostr/nip05'
import { QRCodeLogin } from './QRCodeLogin'

type Tab = 'qr' | 'extension' | 'bunker'

interface LoginDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function LoginDialog({ isOpen, onClose }: LoginDialogProps) {
  const [tab, setTab] = useState<Tab>('qr')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [bunkerInput, setBunkerInput] = useState('')
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const login = useLoginActions()

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setError(null)
    setAuthUrl(null)
  }

  const handleExtension = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await login.extension()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extension login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBunkerAuth = useCallback(async (url: string) => {
    setAuthUrl(url)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (!isIOS) window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const isBunkerValid = (v: string) =>
    v.trim().startsWith('bunker://') || isNip05(v.trim())

  const handleBunker = async () => {
    if (!bunkerInput.trim()) {
      setError('Please enter a bunker URI or NIP-05 address')
      return
    }
    setIsLoading(true)
    setError(null)
    setAuthUrl(null)
    try {
      await login.bunker(bunkerInput, { onAuth: handleBunkerAuth })
      setAuthUrl(null)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bunker login failed')
      setAuthUrl(null)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <h2 className="text-lg font-semibold text-zinc-100">Sign in with Nostr</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Upload photos under your Nostr identity
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mx-6 mb-6">
          <div className="mb-5 flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            {(['qr', 'extension', 'bunker'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'qr' ? 'QR' : t === 'extension' ? 'Extension' : 'Bunker'}
              </button>
            ))}
          </div>

          {/* QR tab */}
          {tab === 'qr' && (
            <QRCodeLogin
              onLogin={onClose}
              onError={(msg) => setError(msg)}
            />
          )}

          {/* Extension tab */}
          {tab === 'extension' && (
            <div className="flex flex-col items-center gap-4 py-2">
              <p className="text-center text-sm text-zinc-400">
                Connect with a NIP-07 browser extension (Alby, nos2x, etc.)
              </p>
              <button
                onClick={() => void handleExtension()}
                disabled={isLoading}
                className="w-full rounded-full border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Connecting…' : 'Connect Extension'}
              </button>
            </div>
          )}

          {/* Bunker tab */}
          {tab === 'bunker' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Bunker URI or NIP-05 address
                </label>
                <input
                  type="text"
                  value={bunkerInput}
                  onChange={(e) => setBunkerInput(e.target.value)}
                  placeholder="bunker://… or user@domain.com"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
                />
                {bunkerInput && !isBunkerValid(bunkerInput) && (
                  <p className="mt-1 text-xs text-red-400">
                    Enter a bunker:// URI or user@domain NIP-05 address
                  </p>
                )}
              </div>

              {authUrl && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
                  <p className="mb-2">Authorization required:</p>
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full rounded border border-zinc-700 bg-zinc-800 py-1.5 text-center text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Open Authorization ↗
                  </a>
                </div>
              )}

              <button
                onClick={() => void handleBunker()}
                disabled={isLoading || !bunkerInput.trim() || !isBunkerValid(bunkerInput)}
                className="w-full rounded-full border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Connecting…' : 'Connect Bunker'}
              </button>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/flox/dev/nostr/photoshare && npx tsc --noEmit 2>&1 | grep -i "LoginDialog\|login"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/LoginDialog.tsx
git commit -m "feat: add LoginDialog with QR, Extension, and Bunker tabs"
```

---

## Task 8: Session restore + layout integration

**Files:**
- Create: `src/components/auth/NostrAccountRestorer.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create NostrAccountRestorer.tsx**

Create `src/components/auth/NostrAccountRestorer.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { ExtensionSigner, NostrConnectSigner } from 'applesauce-signers'
import { useNostrAccountStore, getPersistedAccount } from '@/store/nostrAccountStore'

export function NostrAccountRestorer() {
  const { login, setRestoring } = useNostrAccountStore()

  useEffect(() => {
    void (async () => {
      const persisted = getPersistedAccount()
      if (!persisted) return

      setRestoring(true)
      try {
        if (persisted.type === 'extension') {
          if (typeof window === 'undefined' || !('nostr' in window)) {
            throw new Error('Extension not available')
          }
          const signer = new ExtensionSigner()
          const pubkey = await signer.getPublicKey()
          login('extension', signer, pubkey)
        } else if (persisted.type === 'bunker' && persisted.bunkerUri) {
          const signer = await NostrConnectSigner.fromBunkerURI(persisted.bunkerUri)
          const pubkey = await signer.getPublicKey()
          login('bunker', signer, pubkey, persisted.bunkerUri)
        }
      } catch {
        // Silent failure — bad credentials; clear and stay anonymous
        localStorage.removeItem('photoshare:account')
      } finally {
        setRestoring(false)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
```

- [ ] **Step 2: Add NostrAccountRestorer to layout.tsx**

Edit `src/app/layout.tsx` — add the import and mount the component inside `<body>`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NostrAccountRestorer } from "@/components/auth/NostrAccountRestorer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PhotoShare — Encrypted Photo Albums on Nostr",
  description: "Share encrypted photo albums via Nostr. Nothing leaves your device unencrypted.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NostrAccountRestorer />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/flox/dev/nostr/photoshare && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/NostrAccountRestorer.tsx src/app/layout.tsx
git commit -m "feat: add NostrAccountRestorer for silent session restore on boot"
```

---

## Task 9: Use account signer in useUpload

**Files:**
- Modify: `src/hooks/useUpload.ts`

- [ ] **Step 1: Modify useUpload.ts**

In `src/hooks/useUpload.ts`:

1. Add import at top (after existing imports):
```ts
import { useNostrAccountStore } from '@/store/nostrAccountStore';
```

2. Replace line 83 (`const signer = createEphemeralSigner();`) with:
```ts
// Use the logged-in user's signer when available; fall back to ephemeral.
// Read via getState() (not a hook) so we capture the value at call time,
// not at render time — avoids stale closure and doesn't cause re-renders.
const accountSigner = useNostrAccountStore.getState().signer;
const signer = accountSigner ?? createEphemeralSigner();
```

- [ ] **Step 2: Run existing useUpload tests**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test -- useUpload
```

Expected: All existing tests still PASS (the ephemeral path is unchanged when no account is set).

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useUpload.ts
git commit -m "feat: use account signer in useUpload, fall back to ephemeral when not logged in"
```

---

## Task 10: Sign in/out controls in UploadPanel header

**Files:**
- Modify: `src/components/upload/UploadPanel.tsx`

- [ ] **Step 1: Modify UploadPanel.tsx**

Read the full file first (`src/components/upload/UploadPanel.tsx`), then apply these changes:

1. Add imports after the existing ones:
```ts
import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import { LoginDialog } from '@/components/auth/LoginDialog';
```

Note: `useState` is likely already imported; add the others.

2. Add inside `UploadPanel` component body (after the existing hooks):
```ts
const { pubkey, logout } = useNostrAccountStore();
const [loginOpen, setLoginOpen] = useState(false);
```

3. Add a `formatNpub` helper (outside the component, at module level):
```ts
function formatNpub(hex: string): string {
  const npub = nip19.npubEncode(hex);
  return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
}
```

4. Replace the existing header `<div className="mb-8">` block with:
```tsx
<div className="mb-8 flex items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
      PhotoShare
    </h1>
    <p className="mt-1 text-sm text-zinc-500">
      Encrypted photo albums. Nothing leaves your device unencrypted.
    </p>
  </div>
  <div className="flex shrink-0 items-center gap-2 pt-1">
    {pubkey ? (
      <>
        <span className="font-mono text-xs text-zinc-500">{formatNpub(pubkey)}</span>
        <button
          onClick={logout}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Sign out
        </button>
      </>
    ) : (
      <button
        onClick={() => setLoginOpen(true)}
        className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
      >
        Sign in
      </button>
    )}
  </div>
</div>

{loginOpen && (
  <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/flox/dev/nostr/photoshare && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/flox/dev/nostr/photoshare && npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/upload/UploadPanel.tsx
git commit -m "feat: add Nostr sign in/out controls to UploadPanel header"
```

---

## Final verification

- [ ] **Manual smoke test checklist**
  - [ ] Page loads without console errors
  - [ ] "Sign in" button visible in top-right of header
  - [ ] Clicking "Sign in" opens dialog with QR, Extension, Bunker tabs
  - [ ] QR tab shows a QR code (after brief spinner)
  - [ ] Refresh and Copy URI buttons work
  - [ ] Extension tab shows "Connect Extension" button; clicking without extension shows error
  - [ ] Bunker tab validates input and shows inline error for garbage input
  - [ ] After login: npub shown in header, "Sign out" button appears
  - [ ] After sign out: "Sign in" button returns; npub is gone
  - [ ] Page reload with extension login: user is restored silently
  - [ ] Upload without login: works as before (ephemeral signer, no regression)

- [ ] **Final commit tag**

```bash
git log --oneline -8
```

All 8 feature commits should be visible.
