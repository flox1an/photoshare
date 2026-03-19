/**
 * Default Nostr relay for publishing album manifests.
 * Used as the primary relay for kind 30078 events in dev/default configuration.
 * Can be overridden via settings panel (Phase 3, CONF-01).
 */
export const DEFAULT_RELAYS: string[] = [
  "wss://relay.nostu.be",
];

/**
 * Default Blossom server for encrypted blob storage.
 * Used for uploading full-size images and thumbnails in default configuration.
 * Can be overridden via settings panel (Phase 3, CONF-02).
 */
export const DEFAULT_BLOSSOM_SERVER = "https://24242.io";

/**
 * Nostr event expiration offset in seconds.
 * kind 30078 events are published with NIP-40 expiration = now + ALBUM_EXPIRY_SECONDS.
 * 30 days = 2,592,000 seconds.
 */
export const ALBUM_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 2592000

/**
 * Blossom server expiration hint in seconds.
 * Blossom upload requests include an expiration header requesting this TTL.
 * 60 days to provide buffer after the Nostr event expires.
 */
export const BLOSSOM_EXPIRY_SECONDS = 60 * 24 * 60 * 60; // 5184000
