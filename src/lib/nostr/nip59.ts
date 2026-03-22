/**
 * NIP-59 Gift Wrap implementation for photoshare reactions and comments.
 *
 * Three-layer structure:
 *   Rumor (unsigned event)  →  Seal (kind 13, NIP-44 encrypted)  →  Gift Wrap (kind 1059, published)
 *
 * Privacy model:
 *   - The relay only sees the gift wrap: a kind 1059 event signed by a throwaway ephemeral key,
 *     addressed via `p` tag to the album's reaction pubkey.
 *   - Sender identity is either ephemeral (anonymous) or the real user's pubkey in the rumor.
 *   - All seals are signed by ephemeral keys — no real identity is revealed to the relay.
 *   - NIP-44 provides authenticated encryption; the recipient (album nsec) can decrypt both layers.
 */

import { generateSecretKey, getPublicKey, finalizeEvent, nip44 } from 'nostr-tools';
import type { NostrEvent } from 'nostr-tools';

/** An unsigned event (rumor) — no id, no sig */
export interface Rumor {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
}

/** Reaction rumor — kind 7 */
export interface ReactionRumor extends Rumor {
  kind: 7;
}

/** Comment rumor — kind 1 */
export interface CommentRumor extends Rumor {
  kind: 1;
}

/**
 * Profile rumor — kind 0, signed by the anon key.
 * Has id + sig unlike regular rumors, so it can be added to the EventStore.
 */
export interface ProfileRumor extends Rumor {
  kind: 0;
  id: string;
  sig: string;
}

/** Unwrapped payload returned from unwrapGiftWrap */
export type UnwrappedRumor = ReactionRumor | CommentRumor | ProfileRumor;

/** Jitter timestamp ±2 days per NIP-59 to prevent timing correlation */
function jitteredTime(): number {
  const jitter = Math.floor(Math.random() * 172_800) - 86_400; // ±86400 seconds = ±1 day
  return Math.floor(Date.now() / 1000) + jitter;
}

/**
 * Build a NIP-44 conversation key between two parties.
 * senderPrivkey × recipientPubkey → shared secret.
 */
function conversationKey(senderPrivkey: Uint8Array, recipientPubkey: string): Uint8Array {
  return nip44.v2.utils.getConversationKey(senderPrivkey, recipientPubkey);
}

/**
 * Create a NIP-59 gift wrap containing a reaction or comment rumor.
 *
 * @param rumor - The unsigned event to wrap (kind 7 reaction or kind 1 comment)
 * @param senderPrivkey - Private key for signing the seal. Pass null for anonymous (generates ephemeral).
 * @param recipientPubkey - Album reaction pubkey (hex). Gift wrap is addressed to this key.
 * @param expirationTs - Optional Unix timestamp (seconds) for NIP-40 expiration tag on the gift wrap.
 * @returns Signed kind 1059 event ready to publish.
 */
export function createGiftWrap(
  rumor: Rumor,
  senderPrivkey: Uint8Array | null,
  recipientPubkey: string,
  expirationTs?: number,
): NostrEvent {
  // For the seal, use the sender's key if provided, otherwise generate ephemeral
  const sealPrivkey = senderPrivkey ?? generateSecretKey();

  // --- Build and encrypt the seal (kind 13) ---
  const rumorJson = JSON.stringify(rumor);
  const sealConvKey = conversationKey(sealPrivkey, recipientPubkey);
  const encryptedRumor = nip44.v2.encrypt(rumorJson, sealConvKey);

  const sealTemplate = {
    kind: 13,
    content: encryptedRumor,
    tags: [] as string[][],
    created_at: jitteredTime(),
  };
  const seal = finalizeEvent(sealTemplate, sealPrivkey);

  // --- Build and encrypt the gift wrap (kind 1059) ---
  const wrapPrivkey = generateSecretKey(); // always fresh ephemeral key
  const wrapConvKey = conversationKey(wrapPrivkey, recipientPubkey);
  const encryptedSeal = nip44.v2.encrypt(JSON.stringify(seal), wrapConvKey);

  const wrapTags: string[][] = [['p', recipientPubkey]];
  if (expirationTs !== undefined) wrapTags.push(['expiration', String(expirationTs)]);

  const wrapTemplate = {
    kind: 1059,
    content: encryptedSeal,
    tags: wrapTags,
    created_at: jitteredTime(),
  };
  return finalizeEvent(wrapTemplate, wrapPrivkey);
}

/**
 * Unwrap a NIP-59 gift wrap (kind 1059).
 * Decrypts the outer gift wrap using recipientPrivkey, then decrypts the inner seal.
 * Returns the inner rumor, or throws if decryption fails or the event is malformed.
 *
 * @param giftWrap - The kind 1059 event from the relay
 * @param recipientPrivkey - Album nsec bytes (from URL fragment)
 */
export function unwrapGiftWrap(
  giftWrap: NostrEvent,
  recipientPrivkey: Uint8Array,
): UnwrappedRumor {
  if (giftWrap.kind !== 1059) {
    throw new Error(`Expected kind 1059, got ${giftWrap.kind}`);
  }

  // Decrypt outer layer: gift wrap → seal
  const wrapConvKey = conversationKey(recipientPrivkey, giftWrap.pubkey);
  const sealJson = nip44.v2.decrypt(giftWrap.content, wrapConvKey);
  const seal = JSON.parse(sealJson) as NostrEvent;

  if (seal.kind !== 13) {
    throw new Error(`Expected seal kind 13, got ${seal.kind}`);
  }

  // Decrypt inner layer: seal → rumor
  const sealConvKey = conversationKey(recipientPrivkey, seal.pubkey);
  const rumorJson = nip44.v2.decrypt(seal.content, sealConvKey);
  const rumor = JSON.parse(rumorJson) as Rumor;

  if (rumor.kind !== 7 && rumor.kind !== 1 && rumor.kind !== 0) {
    throw new Error(`Unexpected rumor kind ${rumor.kind}`);
  }

  return rumor as UnwrappedRumor;
}

/**
 * Build a reaction rumor (kind 7) for a specific photo.
 *
 * @param photoHash - Encrypted blob hash of the photo being reacted to
 * @param manifestHash - SHA-256 hash of the album manifest (for album attribution)
 * @param content - Reaction emoji/string, e.g. "+" for like or "🔥"
 * @param senderPubkey - Hex pubkey (real or ephemeral)
 */
export function buildReactionRumor(
  photoHash: string,
  manifestHash: string,
  content: string,
  senderPubkey: string,
): ReactionRumor {
  return {
    kind: 7,
    pubkey: senderPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['img', photoHash],
      ['album', manifestHash],
    ],
    content,
  };
}

/**
 * Build a comment rumor (kind 1) for a specific photo.
 *
 * @param photoHash - Encrypted blob hash of the photo being commented on
 * @param manifestHash - SHA-256 hash of the album manifest
 * @param text - Comment text
 * @param senderPubkey - Hex pubkey (real or ephemeral)
 */
export function buildCommentRumor(
  photoHash: string,
  manifestHash: string,
  text: string,
  senderPubkey: string,
): CommentRumor {
  return {
    kind: 1,
    pubkey: senderPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['img', photoHash],
      ['album', manifestHash],
    ],
    content: text,
  };
}

/** Generate a fresh ephemeral keypair. Returns { privkey, pubkey }. */
export function generateEphemeralKeypair(): { privkey: Uint8Array; pubkey: string } {
  const privkey = generateSecretKey();
  return { privkey, pubkey: getPublicKey(privkey) };
}
