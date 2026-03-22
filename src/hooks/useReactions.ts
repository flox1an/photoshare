'use client';

/**
 * useReactions — subscribe to and send NIP-59 gift-wrapped reactions and comments.
 *
 * Only active when the album manifest includes a `reactions` field (v2 albums with
 * reactions enabled by the uploader) AND nsecBytes is available from the share URL.
 *
 * Subscription:
 *   - Queries reaction relays for kind 1059 events addressed to the album pubkey.
 *   - Decrypts each gift wrap → seal → rumor using the album nsec.
 *   - Groups rumors by photo hash (img tag).
 *
 * Sending:
 *   - Anonymous: generates an ephemeral keypair for both the rumor identity and seal.
 *   - Identified: uses the logged-in account's pubkey in the rumor; seal still ephemeral.
 */

import { useState, useEffect, useCallback } from 'react';
import { nsecToPubkey } from '@/lib/crypto';
import { subscribeEvents, publishMethod } from '@/lib/nostr/relay';
import {
  unwrapGiftWrap,
  createGiftWrap,
  buildReactionRumor,
  buildCommentRumor,
} from '@/lib/nostr/nip59';
import { getAnonKeypair } from '@/lib/nostr/anonIdentity';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import type { AlbumManifest } from '@/types/album';
import type { UnwrappedRumor } from '@/lib/nostr/nip59';
import type { NostrEvent } from 'nostr-tools';

export interface PhotoReactions {
  /** kind 7 reactions, ordered oldest-first */
  reactions: UnwrappedRumor[];
  /** kind 1 comments, ordered oldest-first */
  comments: UnwrappedRumor[];
}

export interface UseReactionsReturn {
  /** Map from photo.hash → aggregated reactions and comments */
  reactionsByPhoto: Map<string, PhotoReactions>;
  /** Send a ❤️ heart reaction (kind 7, content "+") for a specific photo */
  react: (photoHash: string) => Promise<void>;
  /** Send a comment (kind 1) for a specific photo */
  comment: (photoHash: string, text: string) => Promise<void>;
  /** True while the initial relay subscription is establishing */
  loading: boolean;
}

/** Deduplicate rumors by (kind, pubkey, content, created_at within 1s tolerance) */
function isDuplicate(existing: UnwrappedRumor[], rumor: UnwrappedRumor): boolean {
  return existing.some(
    (r) =>
      r.kind === rumor.kind &&
      r.pubkey === rumor.pubkey &&
      r.content === rumor.content &&
      Math.abs(r.created_at - rumor.created_at) <= 1,
  );
}

/** Extract the photo hash from a rumor's img tag */
function photoHashFromRumor(rumor: UnwrappedRumor): string | null {
  const imgTag = rumor.tags.find((t) => t[0] === 'img');
  return imgTag?.[1] ?? null;
}

export function useReactions(
  manifest: AlbumManifest | null,
  nsecBytes: Uint8Array | null,
): UseReactionsReturn {
  const [reactionsByPhoto, setReactionsByPhoto] = useState<Map<string, PhotoReactions>>(new Map());
  const [loading, setLoading] = useState(false);

  // Derive album pubkey for relay query (memoised to a string so deps are stable)
  const albumPubkey =
    nsecBytes && manifest && manifest.v === 2 && manifest.reactions
      ? nsecToPubkey(nsecBytes)
      : null;

  const relays =
    manifest && manifest.v === 2 && manifest.reactions ? manifest.reactions.relays : null;

  // Valid photo hashes for filtering out garbage
  const validPhotoHashes = manifest
    ? new Set(manifest.photos.map((p) => p.hash))
    : new Set<string>();

  useEffect(() => {
    if (!albumPubkey || !relays || relays.length === 0 || !nsecBytes) return;

    setLoading(true);

    const unsubscribe = subscribeEvents(
      relays,
      { kinds: [1059], '#p': [albumPubkey] },
      (event: NostrEvent) => {
        let rumor: UnwrappedRumor;
        try {
          rumor = unwrapGiftWrap(event, nsecBytes);
        } catch {
          // Decryption failed or malformed — silently discard
          return;
        }

        const photoHash = photoHashFromRumor(rumor);
        if (!photoHash || !validPhotoHashes.has(photoHash)) return;

        setReactionsByPhoto((prev) => {
          const existing = prev.get(photoHash) ?? { reactions: [], comments: [] };

          if (rumor.kind === 7) {
            if (isDuplicate(existing.reactions, rumor)) return prev;
            const next = new Map(prev);
            next.set(photoHash, {
              ...existing,
              reactions: [...existing.reactions, rumor].sort((a, b) => a.created_at - b.created_at),
            });
            return next;
          } else {
            if (isDuplicate(existing.comments, rumor)) return prev;
            const next = new Map(prev);
            next.set(photoHash, {
              ...existing,
              comments: [...existing.comments, rumor].sort((a, b) => a.created_at - b.created_at),
            });
            return next;
          }
        });

        setLoading(false);
      },
    );

    // Mark loading done after a short settle time even if no events arrive
    const loadingTimer = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribe();
      clearTimeout(loadingTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumPubkey, relays?.join(','), nsecBytes]);

  const accountPubkey = useNostrAccountStore((s) => s.pubkey);

  const react = useCallback(
    async (photoHash: string) => {
      if (!nsecBytes || !albumPubkey || !relays || !manifest) return;

      const manifestHash = '';
      // Identified users use their real pubkey in the rumor (seal stays ephemeral).
      // Anonymous visitors use their persistent stored keypair so reactions are
      // consistent across page loads.
      const anon = accountPubkey ? null : getAnonKeypair();
      const senderPubkey = accountPubkey ?? anon!.pubkey;
      const senderPrivkey = anon?.privkey ?? null;

      const rumor = buildReactionRumor(photoHash, manifestHash, '+', senderPubkey);
      const giftWrap = createGiftWrap(rumor, senderPrivkey, albumPubkey);
      await publishMethod(relays, giftWrap);
    },
    [nsecBytes, albumPubkey, relays, manifest, accountPubkey],
  );

  const comment = useCallback(
    async (photoHash: string, text: string) => {
      if (!nsecBytes || !albumPubkey || !relays || !manifest || !text.trim()) return;

      const manifestHash = '';
      const anon = accountPubkey ? null : getAnonKeypair();
      const senderPubkey = accountPubkey ?? anon!.pubkey;
      const senderPrivkey = anon?.privkey ?? null;

      const rumor = buildCommentRumor(photoHash, manifestHash, text.trim(), senderPubkey);
      const giftWrap = createGiftWrap(rumor, senderPrivkey, albumPubkey);
      await publishMethod(relays, giftWrap);
    },
    [nsecBytes, albumPubkey, relays, manifest, accountPubkey],
  );

  // If reactions not enabled, return inert state
  if (!albumPubkey || !relays) {
    return {
      reactionsByPhoto: new Map(),
      react: async () => {},
      comment: async () => {},
      loading: false,
    };
  }

  return { reactionsByPhoto, react, comment, loading };
}
