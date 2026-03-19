/**
 * Nostr event builder for kind 30078 encrypted album manifests.
 *
 * buildAlbumEvent constructs and signs a parameterized replaceable event (kind 30078)
 * that stores an encrypted album manifest per NIP-78 (arbitrary application data).
 *
 * Tag structure:
 *   ["d", dTag]                  — unique identifier (NIP-33 replaceable event key)
 *   ["iv", manifestIvB64url]     — AES-GCM IV for manifest decryption
 *   ["alt", "Encrypted photo album"] — human-readable description (NIP-31)
 *   ["expiration", timestamp]    — NIP-40 expiration (now + 30 days)
 *
 * The event content is the base64url-encoded AES-256-GCM encrypted manifest.
 * The event is signed by an ephemeral signer (caller-provided via createEphemeralSigner).
 */

import type { PrivateKeySigner } from "applesauce-signers";
import type { NostrEvent } from "nostr-tools";
import { build } from "applesauce-factory/event-factory";
import {
  setExpirationTimestamp,
  includeSingletonTag,
} from "applesauce-factory/operations";
import { ALBUM_EXPIRY_SECONDS } from "@/lib/config";

/**
 * Build and sign a kind 30078 album manifest event.
 *
 * @param signer               Ephemeral PrivateKeySigner (from createEphemeralSigner)
 * @param encryptedManifestB64url AES-256-GCM encrypted album manifest, base64url-encoded
 * @param manifestIvB64url     AES-GCM IV used during manifest encryption, base64url-encoded
 * @param dTag                 Unique album identifier (UUID), becomes the "d" tag
 * @returns Signed NostrEvent ready for publishing
 */
export async function buildAlbumEvent(
  signer: InstanceType<typeof PrivateKeySigner>,
  encryptedManifestB64url: string,
  manifestIvB64url: string,
  dTag: string,
): Promise<NostrEvent> {
  const expirationTimestamp = Math.floor(Date.now() / 1000) + ALBUM_EXPIRY_SECONDS;

  const template = await build(
    { kind: 30078, content: encryptedManifestB64url },
    { signer },
    // build() internally calls includeReplaceableIdentifier() with nanoid before our operations.
    // We must override the "d" tag with includeSingletonTag to use our explicit dTag.
    includeSingletonTag(["d", dTag]),
    setExpirationTimestamp(expirationTimestamp),
    includeSingletonTag(["iv", manifestIvB64url]),
    includeSingletonTag(["alt", "Encrypted photo album"]),
  );

  return signer.signEvent(template);
}
