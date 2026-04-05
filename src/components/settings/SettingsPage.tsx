import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EXPIRATION_OPTIONS,
  type ExpirationSeconds,
  type UseSettingsReturn,
} from '@/hooks/useSettings';
import { formatExpiry, getKnownServer } from '@/lib/blossom/knownServers';
import { EditableList } from '@/components/upload/settings/EditableList';
import { SettingsToggleRow } from '@/components/upload/settings/SettingsToggleRow';
import { MainPageBlobBackground } from '@/components/ui/MainPageBlobBackground';
import { useAlbumCleanupCandidates } from '@/hooks/useAlbumCleanupCandidates';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import {
  runCleanupNow,
  type CleanupRunProgress,
  type CleanupRunResult,
} from '@/lib/nostr/albumCleanupJanitor';
import { resolveUserOutboxRelays } from '@/lib/nostr/relayList';

interface SettingsPageProps {
  settings: UseSettingsReturn;
}

function ServerTag({ url }: { url: string }) {
  const known = getKnownServer(url);
  if (!known) return null;

  if (known.maxExpirySeconds === null) {
    return (
      <span className="rounded border border-emerald-900 bg-emerald-950 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
        permanent
      </span>
    );
  }

  return (
    <span className="rounded border border-rose-500/45 bg-rose-950/45 px-1.5 py-0.5 text-[10px] font-medium text-rose-200">
      expires in {formatExpiry(known.maxExpirySeconds)}
    </span>
  );
}

export function SettingsPage({ settings }: SettingsPageProps) {
  const cleanup = useAlbumCleanupCandidates(settings.reactionRelays);
  const signer = useNostrAccountStore((state) => state.signer);
  const pubkey = useNostrAccountStore((state) => state.pubkey);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupRunResult | null>(null);
  const [cleanupProgress, setCleanupProgress] = useState<CleanupRunProgress | null>(null);

  const expiredCount = cleanup.records.filter((record) => record.payload.e <= Math.floor(Date.now() / 1000)).length;
  const progressPct = cleanupProgress && cleanupProgress.totalExpiredRecords > 0
    ? Math.round((cleanupProgress.processedExpiredRecords / cleanupProgress.totalExpiredRecords) * 100)
    : 0;

  const handleDeleteExpiredNow = async () => {
    if (!signer || !pubkey || cleanupRunning) return;
    setCleanupRunning(true);
    setCleanupResult(null);
    setCleanupProgress(null);
    try {
      const relayFallback = settings.reactionRelays.length > 0 ? settings.reactionRelays : ['wss://nos.lol'];
      const outboxRelays = await resolveUserOutboxRelays(pubkey, relayFallback);
      const result = await runCleanupNow({
        signer: signer as Parameters<typeof runCleanupNow>[0]['signer'],
        relays: outboxRelays,
        records: cleanup.records,
        onProgress: setCleanupProgress,
      });
      setCleanupResult(result);
      await cleanup.refresh();
    } finally {
      setCleanupRunning(false);
      setCleanupProgress(null);
    }
  };

  return (
    <main className="mainpage-ambient-tone relative isolate min-h-screen overflow-hidden p-6 md:p-12">
      <MainPageBlobBackground />
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <Link
            to="/"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
        </div>

        <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-black/48 backdrop-blur-sm">
          <div className="px-5 py-4">
            <p className="mb-1 text-xs font-medium text-zinc-400">Blossom Servers</p>
            <p className="mb-3 text-xs text-zinc-600">
              Photos are uploaded to all servers. All servers are embedded in the
              share link as fallbacks.
            </p>
            <EditableList
              items={settings.blossomServers}
              onRemove={settings.removeBlossomServer}
              onAdd={async (value) => {
                const { error } = await settings.addBlossomServer(value);
                return error;
              }}
              addPlaceholder="https://your-blossom-server.com"
              showPrimaryOnFirst
              renderSuffix={(url) => <ServerTag url={url} />}
            />
          </div>

          <div className="px-5 py-4">
            <p className="mb-1 text-xs font-medium text-zinc-400">Blob expiration</p>
            <p className="mb-2 text-xs text-zinc-600">
              Requests the server to delete blobs after the chosen duration. The
              effective expiry may be capped by the selected server.
            </p>
            <div className="relative">
              <select
                value={settings.expiration}
                onChange={(e) =>
                  settings.setExpiration(Number(e.target.value) as ExpirationSeconds)
                }
                className="w-full appearance-none rounded-lg border border-zinc-700 bg-black/36 px-3 py-2 pr-9 text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                <path d="m5 7 5 6 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="px-5 py-4">
            <SettingsToggleRow
              checked={settings.keepOriginals}
              onChange={settings.setKeepOriginals}
              title="Keep originals"
              description="Also upload the original files. Downloads will deliver originals instead of processed WebP."
            />
          </div>

          <div className="px-5 py-4">
            <SettingsToggleRow
              checked={settings.reactionsEnabled}
              onChange={settings.setReactionsEnabled}
              title="Enable reactions & comments"
              description="Viewers can like and comment on photos. Interactions are end-to-end encrypted via NIP-59 gift wraps."
            />
            {settings.reactionsEnabled && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-zinc-500">
                  Reaction relays
                </p>
                <EditableList
                  items={settings.reactionRelays}
                  onRemove={settings.removeReactionRelay}
                  onAdd={(value) => {
                    settings.addReactionRelay(value);
                    return null;
                  }}
                  addPlaceholder="wss://relay.example.com"
                />
              </div>
            )}
          </div>
        </div>

        {pubkey && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-black/44 backdrop-blur-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-xs font-medium text-zinc-300">Cleanup candidates (NIP-78)</p>
              <p className="mt-1 text-xs text-zinc-500">
                {cleanup.loading ? 'Loading…' : `${cleanup.records.length} album record${cleanup.records.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cleanup.refresh()}
              className="rounded-lg border border-zinc-700 bg-black/38 px-3 py-1.5 text-xs text-zinc-300 hover:bg-black/54 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="border-t border-zinc-800 px-5 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDeleteExpiredNow()}
                disabled={!signer || !pubkey || cleanupRunning || expiredCount === 0}
                className="rounded-lg border border-zinc-700 bg-black/46 px-3 py-1.5 text-xs text-zinc-300 hover:bg-black/58 disabled:opacity-50 transition-colors"
              >
                {cleanupRunning ? 'Deleting…' : 'Delete expired now'}
              </button>
              <p className="text-xs text-zinc-500">
                {expiredCount} expired album record{expiredCount === 1 ? '' : 's'}
              </p>
            </div>
            {cleanupResult && (
              <p className="mt-2 text-xs text-zinc-500">
                Deleted {cleanupResult.fullyDeletedRecords}/{cleanupResult.expiredRecords} records · blob deletes {cleanupResult.blobDeleteSuccesses}/{cleanupResult.blobDeleteAttempts}
              </p>
            )}
            {cleanupRunning && cleanupProgress && cleanupProgress.totalExpiredRecords > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    Deleting album IDs {cleanupProgress.processedExpiredRecords}/{cleanupProgress.totalExpiredRecords}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-300 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={cleanupProgress.totalExpiredRecords}
                    aria-valuenow={cleanupProgress.processedExpiredRecords}
                    aria-label="Cleanup progress"
                  />
                </div>
                <p className="text-[11px] text-zinc-600">
                  Blob deletes {cleanupProgress.processedBlobDeletes}/{cleanupProgress.totalBlobDeletes}
                </p>
              </div>
            )}
          </div>

          {cleanup.error && (
            <div className="border-t border-zinc-800 px-5 py-3 text-xs text-red-400">
              {cleanup.error}
            </div>
          )}

          {!cleanup.error && cleanup.records.length > 0 && (
            <ul className="border-t border-zinc-800 divide-y divide-zinc-800">
              {cleanup.records.slice(0, 12).map((record) => (
                <li key={record.event.id} className="px-5 py-3 text-xs">
                  <p className="text-zinc-300">
                    {record.payload.n?.trim() || (
                      <span className="font-mono">
                        {record.manifestHash.slice(0, 12)}…{record.manifestHash.slice(-8)}
                      </span>
                    )}
                  </p>
                  <p
                    className="mt-1 text-zinc-500"
                    title={`Expires at ${new Date(record.payload.e * 1000).toISOString()}`}
                  >
                    expires {new Date(record.payload.e * 1000).toLocaleString()} · {record.payload.x.length} hashes · {record.payload.s.length} server{record.payload.s.length === 1 ? '' : 's'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </div>
    </main>
  );
}
