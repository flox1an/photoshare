import { SimpleSigner } from "applesauce-signers";

/**
 * Create an ephemeral signer for a single album upload session.
 * SimpleSigner generates a random secp256k1 keypair internally.
 * The signer is NOT persisted — it lives in memory for one upload session only
 * and is discarded after the kind 30078 event is published.
 *
 * CRITICAL: Never call localStorage.setItem or sessionStorage.setItem with the
 * signer instance or any extracted key material.
 */
export function createEphemeralSigner(): SimpleSigner {
  return new SimpleSigner();
}

/**
 * Get the hex public key from a SimpleSigner.
 * Returns a 64-character lowercase hex string (32 bytes = 256 bits).
 */
export async function getSignerPubkey(signer: SimpleSigner): Promise<string> {
  return signer.getPublicKey();
}
