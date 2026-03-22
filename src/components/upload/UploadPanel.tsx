'use client';

import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useImageProcessor } from '@/hooks/useImageProcessor';
import { useUpload } from '@/hooks/useUpload';
import { useSettings } from '@/hooks/useSettings';
import { useProcessingStore } from '@/store/processingStore';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import { useNostrProfile, profileDisplayName } from '@/hooks/useNostrProfile';
import { DropZone } from './DropZone';
import { ProgressList } from './ProgressList';
import { SettingsPanel } from './SettingsPanel';
import { ShareCard } from './ShareCard';
import { LoginDialog } from '@/components/auth/LoginDialog';

function formatNpub(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return 'npub1' + npub.slice(5, 9) + '…' + npub.slice(-4);
}

export default function UploadPanel() {
  const { processBatch, isProcessing, fileMap } = useImageProcessor();
  const { startUpload, shareLink, isUploading, publishError } = useUpload();
  const settings = useSettings();
  const photos = useProcessingStore((state) => state.photos);
  const [albumTitle, setAlbumTitle] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const pubkey = useNostrAccountStore((state) => state.pubkey);
  const logout = useNostrAccountStore((state) => state.logout);
  const profile = useNostrProfile(pubkey);

  // Collect ProcessedPhoto results for photos that finished processing
  const processedPhotos = Object.values(photos).filter((p) => p.status === 'done' && p.result);
  // All photos must be done processing before the Upload button appears
  const allDone = processedPhotos.length > 0 && processedPhotos.length === Object.keys(photos).length;
  const showUploadButton = allDone && !isUploading && !shareLink;

  const handleUpload = () => {
    const photosToUpload = processedPhotos
      .map((p) => p.result!)
      .filter(Boolean);
    const photoIds = processedPhotos.map((p) => p.id);
    const originalFiles = settings.keepOriginals
      ? processedPhotos.map((p) => fileMap.get(p.id) ?? null)
      : undefined;
    void startUpload(photosToUpload, {
      blossomServers: settings.blossomServers,
      title: albumTitle || undefined,
      keepOriginals: settings.keepOriginals,
      originalFiles,
    }, photoIds);
  };

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-2xl">
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
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Sign in
              </button>
            ) : (
              <>
                {profile?.picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.picture}
                    alt="avatar"
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <span className="text-zinc-400 text-xs max-w-[120px] truncate">
                  {profileDisplayName(profile, formatNpub(pubkey))}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>

        {/* Drop zone — hidden during upload to prevent new additions */}
        {!isUploading && !shareLink && (
          <DropZone onFiles={processBatch} isProcessing={isProcessing} />
        )}

        {/* Settings panel — hidden during upload and after share link appears */}
        {!isUploading && !shareLink && <SettingsPanel
          settings={settings}
          keepOriginals={settings.keepOriginals}
          onKeepOriginalsChange={settings.setKeepOriginals}
        />}

        {/* Progress list — appears after first photo is added */}
        <ProgressList />

        {/* Album title + Upload button */}
        {showUploadButton && (
          <div className="mt-5 space-y-3">
            <input
              type="text"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Album title (optional)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleUpload}
              className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-white active:bg-zinc-200 transition-colors"
            >
              Upload {processedPhotos.length} photo{processedPhotos.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* ShareCard — shown during upload (spinner) and after publish (share link) */}
        {(isUploading || shareLink || publishError) && (
          <ShareCard
            shareLink={shareLink}
            isUploading={isUploading}
            publishError={publishError}
          />
        )}
      </div>
      <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
