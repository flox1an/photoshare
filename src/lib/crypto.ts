/**
 * AES-256-GCM crypto module — primary security primitive for photoshare.
 *
 * All encryption/decryption in the app flows through this module.
 * Uses only Web Crypto API (crypto.subtle + crypto.getRandomValues) — no external library.
 *
 * CRITICAL: Never call crypto.subtle at module scope — it runs during Next.js prerender (SSR).
 * All functions are async; callers must use them inside useEffect or event handlers.
 */

/**
 * Generate a new random 256-bit AES-GCM CryptoKey for an album.
 * extractable: true so we can exportKey() → base64url for the share URL.
 */
export async function generateAlbumKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a blob with AES-256-GCM.
 * Generates a fresh 12-byte random IV per call — NEVER reuse IV with same key.
 * Returns { ciphertext: ArrayBuffer, iv: Uint8Array }
 * ciphertext = encrypted bytes + 16-byte GCM authentication tag (appended automatically)
 */
export async function encryptBlob(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // FRESH per call — critical security requirement
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return { ciphertext, iv };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * iv must be the exact 12-byte Uint8Array used during encryptBlob.
 * Throws DOMException if ciphertext is tampered (GCM auth tag mismatch).
 */
export async function decryptBlob(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as Uint8Array<ArrayBuffer> },
    key,
    ciphertext,
  );
}

/**
 * Export CryptoKey → base64url string (no padding, URL-safe).
 * Result goes in the URL #fragment. ~43 chars for a 256-bit key.
 */
export async function exportKeyToBase64url(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return uint8ArrayToBase64url(new Uint8Array(raw));
}

/**
 * Import a base64url string back into a CryptoKey for decryption.
 * extractable: false (viewer only needs to decrypt, not re-export).
 */
export async function importKeyFromBase64url(b64url: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(b64url);
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
}

/**
 * Encode Uint8Array to base64url (no padding, URL-safe chars).
 * Use spread-based btoa for small values (≤32 bytes: keys, IVs).
 * Use chunked approach for large values (ciphertext).
 */
export function uint8ArrayToBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Decode base64url string to Uint8Array.
 */
export function base64urlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Safe base64 encoding for large ArrayBuffers (e.g., ciphertext blobs).
 * Uses chunked approach to avoid stack overflow for buffers > 64KB.
 * Not exported — internal helper for large buffer encoding.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Suppress unused variable warning for arrayBufferToBase64 — it's available for callers that need large buffer encoding
void arrayBufferToBase64;
