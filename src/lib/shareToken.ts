/**
 * Opaque share token encoding/decoding.
 *
 * URL format:  /{pathToken}#{keyB64url}
 *
 * pathToken = base64url(hashBytes[32] + NUL-separated server URLs)
 *
 * The AES key stays in the URL fragment so it never appears in server logs.
 * The manifest hash and server list are encoded together in the path segment,
 * making URLs opaque (no readable hex hash or server domain visible).
 *
 * Backward compat: legacy URLs use a 64-char lowercase hex path segment.
 * isLegacyToken() detects these so the viewer can fall back to the old parser.
 */

// Self-contained base64url helpers — no import from crypto to avoid mock bleed in tests
function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export interface PathTokenData {
  /** Raw 32-byte manifest hash (SHA-256 of the encrypted manifest blob) */
  hashBytes: Uint8Array;
  /** Blossom server URLs to embed as content-server hints */
  servers: string[];
}

/** Returns true if the path segment is a legacy 64-char hex manifest hash */
export function isLegacyToken(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

/** Encode manifest hash + server list into an opaque base64url path segment */
export function encodePathToken(data: PathTokenData): string {
  const serverBytes = new TextEncoder().encode(data.servers.join('\0'));
  const buf = new Uint8Array(32 + serverBytes.length);
  buf.set(data.hashBytes, 0);
  buf.set(serverBytes, 32);
  return toBase64url(buf);
}

/** Decode an opaque base64url path segment back into hash + servers */
export function decodePathToken(token: string): PathTokenData {
  const bytes = fromBase64url(token);
  if (bytes.length < 32) throw new Error('Invalid share token (too short)');
  const hashBytes = bytes.slice(0, 32);
  const serverStr = bytes.length > 32
    ? new TextDecoder().decode(bytes.slice(32))
    : '';
  const servers = serverStr ? serverStr.split('\0').filter(Boolean) : [];
  return { hashBytes, servers };
}

/** Convert raw 32-byte hash to lowercase hex string */
export function hashBytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Convert 64-char hex string to raw 32-byte Uint8Array */
export function hexToHashBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
