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

import { useState, useEffect, useCallback, useRef } from 'react';
import { nsecToPubkey } from '@/lib/crypto';
import { subscribeEvents, publishMethod } from '@/lib/nostr/relay';
import {
  unwrapGiftWrap,
  createGiftWrap,
  buildReactionRumor,
  buildCommentRumor,
} from '@/lib/nostr/nip59';
import { getAnonKeypair } from '@/lib/nostr/anonIdentity';
import { eventStore } from '@/lib/nostr/eventStore';
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
  /**
   * The display name found in the album's gift wraps for viewerAnonPubkey,
   * or null if no kind 0 was received. Only meaningful after loading = false.
   * Use this to decide whether to publish / re-publish a profile.
   */
  seenAnonProfileName: string | null;
}

interface ReactionsCacheEntry {
  reactionsByPhoto: Map<string, PhotoReactions>;
  seenAnonProfileName: string | null;
  /**
   * Highest gift-wrap event.created_at observed for this album subscription.
   * Used as `since` cursor on subsequent mounts to fetch only new events.
   */
  maxWrapCreatedAt: number;
  idsAtMaxTs: string[];
}

/**
 * Session-local cache keyed by album identity.
 * First visit does a full backfill; remounts reuse cached state and subscribe
 * with a `since` cursor so only new events are fetched.
 */
const reactionsCache = new Map<string, ReactionsCacheEntry>();

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
  /** SHA-256 hash of the encrypted album manifest blob */
  manifestHash: string | null,
  /** Anon pubkey of the current viewer — used to detect own profile in gift wraps */
  viewerAnonPubkey?: string,
): UseReactionsReturn {
  const [reactionsByPhoto, setReactionsByPhoto] = useState<Map<string, PhotoReactions>>(new Map());
  const [loading, setLoading] = useState(false);
  const [seenAnonProfileName, setSeenAnonProfileName] = useState<string | null>(null);
  const reactionsByPhotoRef = useRef(reactionsByPhoto);
  const seenAnonProfileNameRef = useRef(seenAnonProfileName);

  useEffect(() => {
    reactionsByPhotoRef.current = reactionsByPhoto;
  }, [reactionsByPhoto]);

  useEffect(() => {
    seenAnonProfileNameRef.current = seenAnonProfileName;
  }, [seenAnonProfileName]);

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

    const cacheKey = manifestHash ? `${manifestHash}:${albumPubkey}` : null;
    const memoryCached = cacheKey ? reactionsCache.get(cacheKey) : undefined;

    let maxWrapCreatedAt = memoryCached?.maxWrapCreatedAt ?? 0;
    const idsAtMaxTs = new Set<string>(memoryCached?.idsAtMaxTs ?? []);

    if (memoryCached) {
      setReactionsByPhoto(new Map(memoryCached.reactionsByPhoto));
      setSeenAnonProfileName(memoryCached.seenAnonProfileName);
      setLoading(false);
    } else {
      setLoading(true);
      setSeenAnonProfileName(null);
      setReactionsByPhoto(new Map());
    }

    /** Save current state into the session cache so remounts can reuse it. */
    const saveSnapshot = () => {
      if (!cacheKey) return;
      reactionsCache.set(cacheKey, {
        reactionsByPhoto: new Map(reactionsByPhotoRef.current),
        seenAnonProfileName: seenAnonProfileNameRef.current,
        maxWrapCreatedAt,
        idsAtMaxTs: Array.from(idsAtMaxTs),
      });
    };

    const processEvent = (event: NostrEvent): void => {
      // Skip events already seen at the cursor boundary
      if (event.created_at === maxWrapCreatedAt && idsAtMaxTs.has(event.id)) return;

      let rumor: UnwrappedRumor;
      try {
        const canonical = eventStore.add(event) ?? event;
        rumor = unwrapGiftWrap(canonical, nsecBytes);
      } catch {
        return;
      }

      // Advance the since cursor
      if (event.created_at > maxWrapCreatedAt) {
        maxWrapCreatedAt = event.created_at;
        idsAtMaxTs.clear();
        idsAtMaxTs.add(event.id);
      } else if (event.created_at === maxWrapCreatedAt) {
        idsAtMaxTs.add(event.id);
      }

      // Profile events (kind 0) — add to EventStore so useNostrProfile picks them up
      if (rumor.kind === 0) {
        eventStore.add(rumor as unknown as NostrEvent);
        if (viewerAnonPubkey && rumor.pubkey === viewerAnonPubkey) {
          try {
            const meta = JSON.parse(rumor.content) as { name?: string };
            setSeenAnonProfileName(meta.name ?? null);
          } catch {
            setSeenAnonProfileName(null);
          }
        }
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
    };

    const filter = {
      kinds: [1059],
      '#p': [albumPubkey],
      ...(maxWrapCreatedAt > 0 ? { since: maxWrapCreatedAt } : {}),
    };

    const unsubscribe = subscribeEvents(
      relays,
      filter,
      processEvent,
      () => {
        setLoading(false);
        saveSnapshot();
      },
    );

    return () => {
      unsubscribe();
      saveSnapshot();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumPubkey, relays?.join(','), nsecBytes, manifestHash]);

  const accountPubkey = useNostrAccountStore((s) => s.pubkey);

  // Unix timestamp (seconds) from manifest expiresAt, passed as NIP-40 tag on gift wraps
  const expirationTs =
    manifest && manifest.v === 2 && manifest.expiresAt
      ? Math.floor(new Date(manifest.expiresAt).getTime() / 1000)
      : undefined;

  const addOptimistic = useCallback((photoHash: string, rumor: UnwrappedRumor) => {
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
  }, []);

  const react = useCallback(
    async (photoHash: string) => {
      if (!nsecBytes || !albumPubkey || !relays || !manifest || !manifestHash) return;
      const anon = accountPubkey ? null : getAnonKeypair();
      const senderPubkey = accountPubkey ?? anon!.pubkey;
      const senderPrivkey = anon?.privkey ?? null;

      const rumor = buildReactionRumor(photoHash, manifestHash, '+', senderPubkey);
      const giftWrap = createGiftWrap(rumor, senderPrivkey, albumPubkey, expirationTs);
      await publishMethod(relays, giftWrap);
      addOptimistic(photoHash, rumor);
    },
    [nsecBytes, albumPubkey, relays, manifest, manifestHash, accountPubkey, addOptimistic],
  );

  const comment = useCallback(
    async (photoHash: string, text: string) => {
      if (!nsecBytes || !albumPubkey || !relays || !manifest || !manifestHash || !text.trim()) return;
      const anon = accountPubkey ? null : getAnonKeypair();
      const senderPubkey = accountPubkey ?? anon!.pubkey;
      const senderPrivkey = anon?.privkey ?? null;

      const rumor = buildCommentRumor(photoHash, manifestHash, text.trim(), senderPubkey);
      const giftWrap = createGiftWrap(rumor, senderPrivkey, albumPubkey, expirationTs);
      await publishMethod(relays, giftWrap);
      addOptimistic(photoHash, rumor);
    },
    [nsecBytes, albumPubkey, relays, manifest, manifestHash, accountPubkey, addOptimistic],
  );

  // If reactions not enabled, return inert state
  if (!albumPubkey || !relays) {
    return {
      reactionsByPhoto: new Map(),
      react: async () => {},
      comment: async () => {},
      loading: false,
      seenAnonProfileName: null,
    };
  }

  return { reactionsByPhoto, react, comment, loading, seenAnonProfileName };
}
