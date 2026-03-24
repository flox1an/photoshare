'use client'

import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools'
import type { NostrEvent } from 'nostr-tools'

// BUD-03: kind 10063 = user blossom server list
const BLOSSOM_SERVER_LIST_KIND = 10063

const PROFILE_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://nos.lol',
]

// Module-level pool and cache — shared across all fetches in a session
const pool = new SimplePool()
const cache = new Map<string, string[]>()

function extractServers(event: NostrEvent): string[] {
  return event.tags
    .filter((t) => t[0] === 'server' && typeof t[1] === 'string')
    .map((t) => t[1] as string)
}

/**
 * Fetches the logged-in user's Blossom server list (BUD-03, kind 10063).
 * Returns an ordered array of server URLs, or [] if none found or pubkey is null.
 */
export function useUserBlossomServers(pubkey: string | null): string[] {
  const [servers, setServers] = useState<string[]>(() =>
    pubkey ? (cache.get(pubkey) ?? []) : []
  )

  useEffect(() => {
    if (!pubkey) {
      setServers([])
      return
    }
    if (cache.has(pubkey)) {
      setServers(cache.get(pubkey)!)
      return
    }

    pool
      .get(PROFILE_RELAYS, { kinds: [BLOSSOM_SERVER_LIST_KIND], authors: [pubkey], limit: 1 })
      .then((event) => {
        if (!event) return
        const urls = extractServers(event)
        cache.set(pubkey, urls)
        setServers(urls)
      })
      .catch(() => {})
  }, [pubkey])

  return servers
}
