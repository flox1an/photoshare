'use client'

import { useEffect } from 'react'
import { SimplePool } from 'nostr-tools'
import { Models, Helpers } from 'applesauce-core'
import { Hooks } from 'applesauce-react'
import { eventStore } from '@/lib/nostr/eventStore'

const { ProfileModel } = Models
const { getDisplayName, getProfilePicture } = Helpers
const { useEventModel } = Hooks

const PROFILE_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://nos.lol',
]

// Module-level pool — reused across all profile fetches
const pool = new SimplePool()

// Tracks in-flight fetches so we don't double-fetch the same pubkey
const pendingFetches = new Set<string>()

/**
 * Fetch and reactively subscribe to a Nostr profile (kind 0).
 * Uses the applesauce EventStore as the local cache:
 *   - If the profile is already in the store, returns it immediately.
 *   - Otherwise fetches from PROFILE_RELAYS, adds to the store, and re-renders.
 */
export function useNostrProfile(pubkey: string | null) {
  const profile = useEventModel(ProfileModel, pubkey ? [pubkey] : null)

  useEffect(() => {
    if (!pubkey) return
    if (eventStore.hasReplaceable(0, pubkey)) return
    if (pendingFetches.has(pubkey)) return

    pendingFetches.add(pubkey)
    pool
      .get(PROFILE_RELAYS, { kinds: [0], authors: [pubkey], limit: 1 })
      .then((event) => { if (event) eventStore.add(event) })
      .catch(() => {})
      .finally(() => { pendingFetches.delete(pubkey) })
  }, [pubkey])

  return profile
}

/** Pick the best display name, falling back to a provided string (e.g. truncated npub) */
export function profileDisplayName(
  profile: ReturnType<typeof useNostrProfile>,
  fallback: string,
): string {
  if (!profile) return fallback
  return getDisplayName(profile, fallback)
}

/** Get profile picture URL, with optional fallback */
export function profilePictureUrl(
  profile: ReturnType<typeof useNostrProfile>,
): string | undefined {
  if (!profile) return undefined
  return getProfilePicture(profile)
}

export { getDisplayName, getProfilePicture }
