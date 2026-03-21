'use client'

import { useEffect, useState } from 'react'
import { SimplePool } from 'nostr-tools'

export interface NostrProfile {
  name?: string
  display_name?: string
  picture?: string
  about?: string
}

const PROFILE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

// Module-level pool — reused across all profile fetches
const pool = new SimplePool()

export function useNostrProfile(pubkey: string | null): NostrProfile | null {
  const [profile, setProfile] = useState<NostrProfile | null>(null)

  useEffect(() => {
    if (!pubkey) {
      setProfile(null)
      return
    }

    let cancelled = false

    pool
      .get(PROFILE_RELAYS, { kinds: [0], authors: [pubkey], limit: 1 })
      .then((event) => {
        if (cancelled || !event) return
        try {
          const parsed = JSON.parse(event.content) as NostrProfile
          setProfile(parsed)
        } catch {
          // malformed content — leave profile null
        }
      })
      .catch(() => {
        // network error — leave profile null
      })

    return () => {
      cancelled = true
    }
  }, [pubkey])

  return profile
}

/** Pick the best display name from a profile, falling back to a formatted npub */
export function profileDisplayName(profile: NostrProfile | null, fallback: string): string {
  return profile?.display_name?.trim() || profile?.name?.trim() || fallback
}
