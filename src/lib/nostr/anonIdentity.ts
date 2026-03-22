/**
 * Persistent anonymous identity for album visitors.
 *
 * Generates a secp256k1 keypair once and stores the private key in localStorage
 * so that a returning anonymous visitor always uses the same pubkey for
 * reactions and comments, making their contributions recognisable across visits.
 *
 * The key is stored as a hex string under 'photoshare:anon-privkey'.
 */

import { generateSecretKey, getPublicKey } from 'nostr-tools';

const STORAGE_KEY = 'photoshare:anon-privkey';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

export interface AnonKeypair {
  privkey: Uint8Array;
  pubkey: string;
}

/**
 * Returns the persistent anon keypair for this browser, generating and
 * storing it on first call.
 */
export function getAnonKeypair(): AnonKeypair {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && /^[0-9a-f]{64}$/.test(stored)) {
      const privkey = hexToBytes(stored);
      return { privkey, pubkey: getPublicKey(privkey) };
    }
  } catch {
    // localStorage unavailable — fall through to generate a session key
  }

  const privkey = generateSecretKey();
  try {
    localStorage.setItem(STORAGE_KEY, bytesToHex(privkey));
  } catch {
    // ignore write errors
  }
  return { privkey, pubkey: getPublicKey(privkey) };
}
