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
 * Returns IV || ciphertext as a single Uint8Array (self-contained for Blossom upload).
 * First 12 bytes = fresh random IV. Remaining bytes = ciphertext + 16-byte GCM auth tag.
 */
export async function encryptBlob(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  const result = new Uint8Array(12 + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), 12);
  return result;
}

/**
 * Decrypt an IV-prepended AES-256-GCM blob.
 * Expects first 12 bytes to be the IV, remainder is ciphertext + GCM tag.
 * Throws if blob is too short, key is wrong, or data is tampered.
 */
export async function decryptBlob(
  blob: Uint8Array,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  if (blob.byteLength < 28) {
    throw new Error("Encrypted blob too short (must be at least 28 bytes: 12 IV + 16 GCM tag)");
  }
  const iv = blob.slice(0, 12);
  const ciphertext = blob.slice(12);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
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
  const keyBuffer = new ArrayBuffer(raw.byteLength);
  new Uint8Array(keyBuffer).set(raw);
  return crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
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

