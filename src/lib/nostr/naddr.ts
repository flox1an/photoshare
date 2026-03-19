import { nip19 } from "nostr-tools";

/**
 * Encode a kind 30078 album event address as an naddr1... bech32 string.
 * Used to build the share URL path: https://photoshare.app/{naddr}#{key}
 *
 * @param identifier - The album's d-tag value (UUID generated at upload time)
 * @param pubkey - Hex public key of the ephemeral signing keypair
 * @param relays - Array of relay WebSocket URLs the event was published to
 */
export function encodeAlbumNaddr(
  identifier: string,
  pubkey: string,
  relays: string[],
): string {
  return nip19.naddrEncode({
    identifier,
    pubkey,
    kind: 30078,
    relays,
  });
}

/**
 * Decode an naddr1... string back to its AddressPointer components.
 * Used by the viewer to know which relay to query and which event to fetch.
 *
 * @throws Error if the input is not a valid naddr string
 */
export function decodeAlbumNaddr(naddr: string): nip19.AddressPointer {
  const { type, data } = nip19.decode(naddr);
  if (type !== "naddr") {
    throw new Error(`Expected naddr, got ${type}`);
  }
  return data as nip19.AddressPointer;
}
