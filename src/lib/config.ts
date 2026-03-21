/**
 * Default Blossom server for uploading encrypted blobs.
 * Can be overridden via settings panel.
 */
export const DEFAULT_BLOSSOM_SERVER = "https://tempstore.apps3.slidestr.net";

/**
 * Fallback Blossom servers for blob resolution.
 * Tried in order when the xs hint is missing or the hinted server is down.
 */
export const DEFAULT_BLOSSOM_SERVERS: string[] = [
  "https://tempstore.apps3.slidestr.net",
];

/**
 * Blossom server expiration hint in seconds.
 * Blossom upload requests include an expiration header requesting this TTL.
 * 60 days = 5,184,000 seconds.
 */
export const BLOSSOM_EXPIRY_SECONDS = 60 * 24 * 60 * 60; // 5184000
