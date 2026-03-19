import { RelayPool } from 'applesauce-relay/pool';
import { createAddressLoader } from 'applesauce-loaders/loaders/address-loader';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import type { NostrEvent } from 'nostr-tools';
import type { AddressPointer } from 'nostr-tools/nip19';
import { decryptBlob, base64urlToUint8Array } from '@/lib/crypto';
import type { AlbumManifest } from '@/types/album';

/**
 * Fetch a kind 30078 album event from Nostr relays.
 *
 * Accepts an AddressPointer directly (from decodeAlbumNaddr or constructed inline).
 * Creates RelayPool inside the function — NOT at module scope — for SSR safety.
 * Uses followRelayHints: true per CONF-03 to use relay hints from the naddr.
 * Times out after 15 seconds if no event is received.
 */
export async function loadAlbumEvent(pointer: AddressPointer): Promise<NostrEvent> {
  try {
    const pool = new RelayPool();
    const loadAddress = createAddressLoader(pool, { followRelayHints: true });
    return await firstValueFrom(loadAddress(pointer).pipe(timeout(15000)));
  } catch (_err) {
    throw new Error('Album not found or expired. The share link may be invalid.');
  }
}

/**
 * Decrypt the album manifest from a kind 30078 event.
 *
 * Extracts the IV from the event's ["iv", ...] tag, decrypts the event content
 * (base64url-encoded ciphertext) using AES-256-GCM, and returns the parsed AlbumManifest.
 *
 * @throws Error if the IV tag is missing
 * @throws Error if decryption fails (wrong key, corrupted data)
 */
export async function decryptManifest(event: NostrEvent, key: CryptoKey): Promise<AlbumManifest> {
  const ivTag = event.tags.find(t => t[0] === 'iv');
  if (!ivTag) throw new Error('Missing IV tag in album event');
  const iv = base64urlToUint8Array(ivTag[1]);
  const ciphertext = base64urlToUint8Array(event.content);
  try {
    const plaintext = await decryptBlob(ciphertext.buffer as ArrayBuffer, key, iv);
    return JSON.parse(new TextDecoder().decode(plaintext)) as AlbumManifest;
  } catch (_err) {
    throw new Error('Decryption failed — invalid share link or corrupted data');
  }
}
