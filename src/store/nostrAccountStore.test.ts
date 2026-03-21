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
