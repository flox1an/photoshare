// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLoginActions } from '@/hooks/useLoginActions'
import { useNostrAccountStore } from '@/store/nostrAccountStore'

// Mock applesauce-signers
vi.mock('applesauce-signers', () => ({
  ExtensionSigner: vi.fn().mockImplementation(function () {
    return { getPublicKey: vi.fn().mockResolvedValue('extpubkey') }
  }),
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
