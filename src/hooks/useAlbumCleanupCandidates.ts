'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAlbumCleanupCandidates, type AlbumCleanupRecord } from '@/lib/nostr/albumCleanupRecord';
import { resolveUserOutboxRelays } from '@/lib/nostr/relayList';
import { useNostrAccountStore } from '@/store/nostrAccountStore';

interface UseAlbumCleanupCandidatesResult {
  records: AlbumCleanupRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_RELAYS = ['wss://nos.lol'];

export function useAlbumCleanupCandidates(relays: string[] = DEFAULT_RELAYS): UseAlbumCleanupCandidatesResult {
  const signer = useNostrAccountStore((state) => state.signer);
  const pubkey = useNostrAccountStore((state) => state.pubkey);
  const [records, setRecords] = useState<AlbumCleanupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!signer || !pubkey) {
      setRecords([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const relayFallback = relays.length > 0 ? relays : DEFAULT_RELAYS;
      const resolvedRelays = await resolveUserOutboxRelays(pubkey, relayFallback);
      const next = await fetchAlbumCleanupCandidates({
        signer: signer as Parameters<typeof fetchAlbumCleanupCandidates>[0]['signer'],
        relays: resolvedRelays,
        authorPubkey: pubkey,
      });
      setRecords(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cleanup candidates');
    } finally {
      setLoading(false);
    }
  }, [signer, pubkey, relays]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { records, loading, error, refresh };
}
