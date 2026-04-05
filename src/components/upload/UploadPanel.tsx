'use client';

import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useNavigate } from 'react-router-dom';
import type { useImageProcessor } from '@/hooks/useImageProcessor';
import { useUpload } from '@/hooks/useUpload';
import { type UseSettingsReturn } from '@/hooks/useSettings';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import { useNostrProfile, profileDisplayName } from '@/hooks/useNostrProfile';
import RoundButton from '@/components/viewer/RoundButton';
import { ICON_ACTION_BUTTON_COLOR_CLASS_MAINPAGE, ICON_ACTION_ICON_CLASS } from '@/components/ui/iconActionButton';
import { MainPageBlobBackground } from '@/components/ui/MainPageBlobBackground';
import { getKnownServer } from '@/lib/blossom/knownServers';
import { useUploadQueueBridge } from './hooks/useUploadQueueBridge';
import { DropZone } from './DropZone';
import { ProgressList } from './ProgressList';
import { ShareCard } from './ShareCard';
import { EphemeralServerWarning } from './EphemeralServerWarning';
import { LoginDialog } from '@/components/auth/LoginDialog';

function formatNpub(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return 'npub1' + npub.slice(5, 9) + '…' + npub.slice(-4);
}

interface UploadPanelProps {
  settings: UseSettingsReturn;
  imageProcessor: ReturnType<typeof useImageProcessor>;
}

export default function UploadPanel({ settings, imageProcessor }: UploadPanelProps) {
  const navigate = useNavigate();
  const { processBatch, photos, isProcessing, fileMap } = imageProcessor;
  const { startUpload, retryPhoto, shareLink, albumExpiresAt, isUploading, publishError } = useUpload();
  const [albumTitle, setAlbumTitle] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const pubkey = useNostrAccountStore((state) => state.pubkey);
  const logout = useNostrAccountStore((state) => state.logout);
  const profile = useNostrProfile(pubkey);
  const userLabel = pubkey ? profileDisplayName(profile, formatNpub(pubkey)) : null;
  const { beginUpload } = useUploadQueueBridge({
    photos,
    isUploading,
    keepOriginals: settings.keepOriginals,
    fileMap,
    startUpload,
  });

  const processedPhotos = Object.values(photos).filter((p) => p.status === 'done' && p.result);
  const totalPhotos = Object.keys(photos).length;

  // Show the Upload button as soon as at least one photo is ready.
  const showUploadButton = processedPhotos.length > 0 && !isUploading && !shareLink;

  const primaryServer = settings.blossomServers[0];
  const knownServer = primaryServer ? getKnownServer(primaryServer) : null;
  const showWarning = showUploadButton && knownServer?.maxExpirySeconds != null;
  const warningServer = showWarning && knownServer
    ? { name: knownServer.name, maxExpirySeconds: knownServer.maxExpirySeconds as number }
    : null;

  const handleUpload = () => {
    const effectiveExpiry = knownServer?.maxExpirySeconds != null
      ? Math.min(settings.expiration, knownServer.maxExpirySeconds)
      : settings.expiration;

    beginUpload({
      blossomServers: settings.blossomServers,
      title: albumTitle || undefined,
      expirationSeconds: effectiveExpiry,
      reactions: settings.reactionsEnabled
        ? { relays: settings.reactionRelays }
        : undefined,
    });
  };

  return (
    <main className="mainpage-ambient-tone relative isolate min-h-screen overflow-hidden p-6 md:p-12">
      <MainPageBlobBackground />
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              PhotoShare
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Encrypted photo albums. Nothing leaves your device unencrypted.
            </p>
          </div>
          <div className="flex-shrink-0 self-center flex items-center gap-2 text-sm">
            {pubkey === null ? (
              <RoundButton
                type="button"
                aria-label="Sign in"
                colorClass={ICON_ACTION_BUTTON_COLOR_CLASS_MAINPAGE}
                onClick={() => setLoginOpen(true)}
              >
                <svg
                  className={ICON_ACTION_ICON_CLASS}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </RoundButton>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="h-10 w-10 overflow-hidden rounded-full ring-1 ring-inset ring-indigo-300/28 transition-colors hover:ring-indigo-200/44"
                aria-label={`Sign out ${userLabel ?? ''}`.trim()}
                title={userLabel ? `${userLabel} · Sign out` : 'Sign out'}
              >
                {profile?.picture ? (
                  <img
                    src={profile.picture}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/44 text-zinc-200">
                    <svg
                      className={ICON_ACTION_ICON_CLASS}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="8" r="4" />
                    </svg>
                  </div>
                )}
              </button>
            )}
            <RoundButton
              aria-label="Settings"
              colorClass={ICON_ACTION_BUTTON_COLOR_CLASS_MAINPAGE}
              onClick={() => navigate('/settings')}
            >
              <svg
                className={ICON_ACTION_ICON_CLASS}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </RoundButton>
          </div>
        </div>

        {/* State 1 & 2: Drop zone */}
        {!isUploading && !shareLink && (
          <>
            <DropZone onFiles={processBatch} isProcessing={isProcessing} />
            {totalPhotos === 0 && pubkey === null && (
              <p className="mt-3 text-center text-xs text-zinc-600">
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="underline hover:text-zinc-400 transition-colors"
                >
                  Sign in with Nostr
                </button>{' '}
                to use your own Blossom servers
              </p>
            )}
          </>
        )}

        {/* State 2 & 3: Progress list */}
        {!shareLink && (
          <ProgressList
            onRetryPhoto={(photoId) => void retryPhoto(photoId)}
            isRetrying={isUploading}
            keepOriginals={settings.keepOriginals}
            fileMap={fileMap}
          />
        )}

        {/* State 2: Album title + warning + upload button */}
        {showUploadButton && (
          <div className="mt-5 space-y-3">
            <input
              type="text"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Album title (optional)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
            />
            {warningServer && (
              <EphemeralServerWarning
                serverName={warningServer.name}
                maxExpirySeconds={warningServer.maxExpirySeconds}
              />
            )}
            <button
              type="button"
              onClick={handleUpload}
              className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-white active:bg-zinc-200 transition-colors"
            >
              {isProcessing
                ? `Upload · ${processedPhotos.length} / ${totalPhotos} ready`
                : `Upload ${processedPhotos.length} photo${processedPhotos.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* State 3 & 4: ShareCard */}
        {(isUploading || shareLink || publishError) && (
          <ShareCard
            shareLink={shareLink}
            albumExpiresAt={albumExpiresAt}
            isUploading={isUploading}
            publishError={publishError}
          />
        )}
      </div>
      <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
