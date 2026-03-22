import { SimplePool } from 'nostr-tools'
import type { Filter, NostrEvent } from 'nostr-tools'
import { Observable } from 'rxjs'

// Module-level singleton — shared across all NostrConnect sessions.
const pool = new SimplePool()

/**
 * Subscribe to events on the given relays.
 * Returns an RxJS Observable that emits NostrEvents.
 * Matches NostrSubscriptionMethod from applesauce-signers.
 */
export function subscriptionMethod(relays: string[], filters: Filter[]): Observable<NostrEvent> {
  return new Observable<NostrEvent>((subscriber) => {
    // subscribeMany takes one Filter at a time; create one sub per filter
    const subs = filters.map((filter) =>
      pool.subscribeMany(relays, filter, {
        onevent: (event) => subscriber.next(event),
        oneose: () => {},
      }),
    )
    return () => subs.forEach((s) => s.close())
  })
}

/**
 * Publish an event to the given relays.
 * Settles all relay promises; individual relay failures are non-fatal.
 * Used by NostrConnectSigner from applesauce-signers.
 */
export async function publishMethod(relays: string[], event: NostrEvent): Promise<void> {
  await Promise.allSettled(pool.publish(relays, event))
}

/**
 * Subscribe to events matching a filter.
 * Returns an unsubscribe function. Used by useReactions.
 */
export function subscribeEvents(
  relays: string[],
  filter: Filter,
  onevent: (event: NostrEvent) => void,
): () => void {
  const sub = pool.subscribeMany(relays, [filter], { onevent })
  return () => sub.close()
}
