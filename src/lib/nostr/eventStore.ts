import { EventStore } from 'applesauce-core'

/**
 * Singleton EventStore — shared across the whole app.
 * Populated by profile fetches, provided to the component tree via
 * EventStoreProvider in App.tsx.
 */
export const eventStore = new EventStore()
