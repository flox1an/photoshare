import { SimplePool, mergeFilters } from 'nostr-tools'
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
  const mergedFilter = mergeFilters(...filters)
  const sub = pool.subscribe(relays, mergedFilter, handlers)
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
