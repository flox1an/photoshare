/**
 * Blossom upload library — BUD-01 / BUD-02 / BUD-11 implementation.
 *
 * sha256Hex:              Compute SHA-256 of ciphertext using Web Crypto API.
 * buildBlossomUploadAuth: Build BUD-11 kind 24242 Authorization header.
 * uploadBlob:             PUT encrypted blob to Blossom server and verify hash.
 *
 * SECURITY:
 * - SHA-256 is computed on CIPHERTEXT (encrypted bytes), not plaintext.
 * - Authorization header uses standard base64 (btoa), NOT base64url.
 *   The Blossom spec requires standard base64 for the Authorization header.
 * - Hash mismatch between local and server SHA-256 causes an immediate throw.
 */

import type { PrivateKeySigner, ISigner } from "applesauce-signers";
import { build } from "applesauce-factory/event-factory";
import { setExpirationTimestamp, includeSingletonTag } from "applesauce-factory/operations";
import type { BlobDescriptor } from "@/types/blossom";

/**
 * Compute the SHA-256 hash of an ArrayBuffer using the Web Crypto API.
 * Returns a lowercase hex string of exactly 64 characters.
 *
 * CRITICAL: Call this on ENCRYPTED bytes (ciphertext), not plaintext.
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build a BUD-11 kind 24242 Authorization header for a Blossom upload.
 *
 * Creates and signs a kind 24242 event with:
 *   - ["t", "upload"] — action tag
 *   - ["x", blobHashHex] — SHA-256 of the encrypted blob
 *   - ["expiration", ...] — 1-hour TTL
 *
 * Returns: "Nostr " + btoa(JSON.stringify(signedEvent))
 * IMPORTANT: Uses standard base64 (btoa), NOT base64url — Blossom servers
 * decode with atob() which requires standard base64 padding and chars.
 */
export async function buildBlossomUploadAuth(
  signer: ISigner,
  blobHashHex: string,
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000) - 5; // subtract 5s to avoid clock-skew "created_at in the future" errors
  const expirationTimestamp = nowSec + 3600; // 1 hour TTL

  const template = await build(
    {
      kind: 24242,
      content: "Upload blob",
      created_at: nowSec,
      tags: [
        ["t", "upload"],
        ["x", blobHashHex],
      ],
    },
    { signer },
    setExpirationTimestamp(expirationTimestamp),
  );

  const signedEvent = await signer.signEvent(template);

  // Standard base64 (btoa) — NOT base64url. Blossom spec requires standard base64.
  return "Nostr " + btoa(JSON.stringify(signedEvent));
}

/**
 * Per-session cache of whether a server's CORS policy allows X-Expiration.
 * Keyed by server base URL. Populated lazily on first upload to each server.
 */
const expirationSupportCache = new Map<string, boolean>();

/**
 * Check whether a Blossom server allows the X-Expiration request header via CORS.
 *
 * Sends an OPTIONS preflight to /upload and inspects Access-Control-Allow-Headers.
 * Result is cached per server URL for the lifetime of the page.
 */
async function serverSupportsExpiration(serverUrl: string): Promise<boolean> {
  if (expirationSupportCache.has(serverUrl)) {
    return expirationSupportCache.get(serverUrl)!;
  }

  let supported = false;
  try {
    const res = await fetch(`${serverUrl}/upload`, {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "authorization,content-type,x-expiration",
        Origin: window.location.origin,
      },
    });
    const allowedHeaders = res.headers.get("access-control-allow-headers") ?? "";
    supported = allowedHeaders.toLowerCase().includes("x-expiration");
  } catch {
    // Network error or server doesn't respond to OPTIONS — assume not supported
  }

  expirationSupportCache.set(serverUrl, supported);
  return supported;
}

/**
 * Upload an encrypted blob to a Blossom server via PUT /upload.
 *
 * Verifies the server-returned SHA-256 matches the locally provided hash.
 * This guards against server-side tampering or corruption.
 *
 * X-Expiration is only sent when the server's CORS policy allows it
 * (checked via OPTIONS preflight, result cached per server).
 *
 * @param serverUrl   Base URL of the Blossom server (e.g., "https://24242.io")
 * @param ciphertext  Encrypted blob bytes (ArrayBuffer)
 * @param authHeader  Authorization header value from buildBlossomUploadAuth
 * @param localHashHex Pre-computed SHA-256 of ciphertext for verification
 * @param mimeType    Optional MIME type (default: "application/octet-stream")
 * @returns BlobDescriptor from the server
 * @throws Error if server returns non-2xx or if SHA-256 hash mismatch
 */
export async function uploadBlob(
  serverUrl: string,
  ciphertext: ArrayBuffer,
  authHeader: string,
  localHashHex: string,
  mimeType = "application/octet-stream",
  expirationSeconds = 365 * 24 * 60 * 60,
): Promise<BlobDescriptor> {
  const supportsExpiration = await serverSupportsExpiration(serverUrl);
  const uploadHeaders: Record<string, string> = {
    Authorization: authHeader,
    "Content-Type": mimeType,
  };
  if (supportsExpiration) {
    uploadHeaders["X-Expiration"] = String(Math.floor(Date.now() / 1000) + expirationSeconds);
  }

  const response = await fetch(`${serverUrl}/upload`, {
    method: "PUT",
    headers: uploadHeaders,
    body: ciphertext,
  });

  if (!response.ok) {
    throw new Error(`Blossom upload failed with status ${response.status}`);
  }

  const descriptor: BlobDescriptor = await response.json();

  // Verify server SHA-256 matches locally provided hash (UPLD-02)
  if (descriptor.sha256 !== localHashHex) {
    throw new Error(
      `Blossom hash mismatch: expected ${localHashHex}, got ${descriptor.sha256}`,
    );
  }

  return descriptor;
}

// Re-export includeSingletonTag for convenience (used by consumers)
export { includeSingletonTag };
