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
