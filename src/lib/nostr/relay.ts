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
  // subscribeMany takes one Filter at a time; create one sub per filter
  const subs = filters.map((filter) => pool.subscribeMany(relays, filter, handlers))
  return () => subs.forEach((s) => s.close())
}

/**
 * Publish an event to the given relays.
 * Settles all relay promises; individual relay failures are non-fatal.
 * Used by NostrConnectSigner from applesauce-signers.
 */
export async function publishMethod(relays: string[], event: NostrEvent): Promise<void> {
  await Promise.allSettled(pool.publish(relays, event))
}
