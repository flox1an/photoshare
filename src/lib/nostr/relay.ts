import { RelayPool } from 'applesauce-relay'
import type { Filter, NostrEvent } from 'nostr-tools'
import { Observable } from 'rxjs'

// Module-level singleton with auto-reconnect on subscription errors
const pool = new RelayPool()

/**
 * Subscribe to events on the given relays.
 * Returns an RxJS Observable that emits NostrEvents.
 * Matches NostrSubscriptionMethod from applesauce-signers.
 */
export function subscriptionMethod(relays: string[], filters: Filter[]): Observable<NostrEvent> {
  return new Observable<NostrEvent>((subscriber) => {
    const sub = pool.subscription(relays, filters as Filter[])
    const inner = sub.subscribe({
      next: (response) => { if (response !== 'EOSE') subscriber.next(response as NostrEvent) },
      error: (err) => subscriber.error(err),
      complete: () => subscriber.complete(),
    })
    return () => inner.unsubscribe()
  })
}

/**
 * Publish an event to the given relays.
 * Settles all relay promises; individual relay failures are non-fatal.
 */
export async function publishMethod(relays: string[], event: NostrEvent): Promise<void> {
  await pool.publish(event, relays)
}

/**
 * Open a live subscription that keeps reconnecting.
 * Calls `onevent` for each received event and `oneose` once the relay signals
 * end-of-stored-events.
 * Returns an unsubscribe function.
 */
export function subscribeEvents(
  relays: string[],
  filter: Filter,
  onevent: (event: NostrEvent) => void,
  oneose?: () => void,
): () => void {
  const sub = pool.subscription(relays, filter as Filter)
  let eoseFired = false
  const inner = sub.subscribe({
    next: (response) => {
      if (response === 'EOSE') {
        if (!eoseFired) { eoseFired = true; oneose?.() }
      } else {
        onevent(response as NostrEvent)
      }
    },
  })
  return () => inner.unsubscribe()
}
