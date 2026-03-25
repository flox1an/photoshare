import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NostrEvent } from "nostr-tools";
import { useReactions } from "@/hooks/useReactions";
import { getAnonKeypair } from "@/lib/nostr/anonIdentity";
import {
  getAnonProfileName,
  hasBeenPrompted,
  markPrompted,
  setAnonProfileName,
  buildSignedProfileEvent,
} from "@/lib/nostr/anonProfile";
import { eventStore } from "@/lib/nostr/eventStore";
import { createGiftWrap } from "@/lib/nostr/nip59";
import { publishMethod } from "@/lib/nostr/relay";
import { nsecToPubkey } from "@/lib/crypto";
import type { AlbumManifest } from "@/types/album";

function parseExpirationTs(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  const ts = Math.floor(new Date(expiresAt).getTime() / 1000);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return ts;
}

interface UseViewerReactionsArgs {
  manifest: AlbumManifest | null;
  nsecBytes: Uint8Array | null;
  manifestHash: string | null;
  accountPubkey: string | null;
  onAnonFirstReaction?: () => void;
}

export function useViewerReactions({
  manifest,
  nsecBytes,
  manifestHash,
  accountPubkey,
  onAnonFirstReaction,
}: UseViewerReactionsArgs) {
  const anonKeypair = useMemo(() => (accountPubkey ? null : getAnonKeypair()), [accountPubkey]);
  const viewerPubkey = anonKeypair?.pubkey ?? accountPubkey ?? "";

  const { reactionsByPhoto, react, comment, loading: reactionsLoading, seenAnonProfileName } =
    useReactions(manifest, nsecBytes, manifestHash, anonKeypair?.pubkey);

  const [localReactedHashes, setLocalReactedHashes] = useState<Set<string>>(new Set());

  const reactedHashes = useMemo(() => {
    const set = new Set(localReactedHashes);
    reactionsByPhoto.forEach((data, photoHash) => {
      if (data.reactions.some((r) => r.pubkey === viewerPubkey)) {
        set.add(photoHash);
      }
    });
    return set;
  }, [localReactedHashes, reactionsByPhoto, viewerPubkey]);

  const handleReact = useCallback(
    async (photoHash: string) => {
      if (reactedHashes.has(photoHash)) return;
      await react(photoHash);
      setLocalReactedHashes((prev) => new Set(prev).add(photoHash));

      if (!accountPubkey && !hasBeenPrompted()) {
        markPrompted();
        onAnonFirstReaction?.();
      }
    },
    [react, reactedHashes, accountPubkey, onAnonFirstReaction],
  );

  const handleSaveName = useCallback(
    async (name: string) => {
      setAnonProfileName(name);

      if (manifest?.v === 2 && manifest.reactions && nsecBytes) {
        const expirationTs = parseExpirationTs(manifest.expiresAt);
        if (!expirationTs) return;

        const anon = getAnonKeypair();
        const profileEvent = buildSignedProfileEvent(name, anon.privkey, expirationTs);
        eventStore.add(profileEvent as unknown as NostrEvent);

        const albumPubkey = nsecToPubkey(nsecBytes);
        const giftWrap = createGiftWrap(profileEvent, null, albumPubkey, expirationTs);
        await publishMethod(manifest.reactions.relays, giftWrap).catch(() => {});
      }
    },
    [manifest, nsecBytes],
  );

  const profilePublishedRef = useRef(false);
  useEffect(() => {
    if (reactionsLoading) return;
    if (accountPubkey || !anonKeypair) return;

    const savedName = getAnonProfileName();
    if (!savedName) return;
    if (seenAnonProfileName === savedName) return;
    if (profilePublishedRef.current) return;

    if (!manifest || manifest.v !== 2 || !manifest.reactions || !nsecBytes) return;
    const expirationTs = parseExpirationTs(manifest.expiresAt);
    if (!expirationTs) return;

    profilePublishedRef.current = true;

    const profileEvent = buildSignedProfileEvent(savedName, anonKeypair.privkey, expirationTs);
    eventStore.add(profileEvent as unknown as NostrEvent);

    const albumPubkey = nsecToPubkey(nsecBytes);
    const giftWrap = createGiftWrap(profileEvent, null, albumPubkey, expirationTs);
    publishMethod(manifest.reactions.relays, giftWrap).catch(() => {});
  }, [reactionsLoading, accountPubkey, anonKeypair, seenAnonProfileName, manifest, nsecBytes]);

  return {
    anonKeypair,
    reactionsByPhoto,
    reactionsLoading,
    comment,
    reactedHashes,
    handleReact,
    handleSaveName,
  };
}
