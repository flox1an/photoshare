'use client';

import { useEffect, useRef, useState } from 'react';
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
import type { UploadItem } from '@/hooks/useUpload';

// ---------------------------------------------------------------------------
// Deferred async queue — buffers items until the async consumer is ready.
// Push photos as they finish processing; close when all are done.
// ---------------------------------------------------------------------------
interface DeferredQueue<T> {
  push: (item: T) => void;
  close: () => void;
  [Symbol.asyncIterator]: () => AsyncIterator<T>;
}

function createDeferredQueue<T>(): DeferredQueue<T> {
  const buffer: T[] = [];
  const resolvers: Array<(result: IteratorResult<T>) => void> = [];
  let closed = false;

  const push = (item: T) => {
    if (resolvers.length > 0) {
      resolvers.shift()!({ value: item, done: false });
    } else {
      buffer.push(item);
    }
  };

  const close = () => {
    closed = true;
    while (resolvers.length > 0) {
      resolvers.shift()!({ value: undefined as unknown as T, done: true });
    }
  };

  return {
    push,
    close,
    [Symbol.asyncIterator]: () => ({
      next(): Promise<IteratorResult<T>> {
        if (buffer.length > 0) {
          return Promise.resolve({ value: buffer.shift()!, done: false });
        }
        if (closed) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }
        return new Promise((resolve) => resolvers.push(resolve));
      },
    }),
  };
}

// ---------------------------------------------------------------------------

function formatNpub(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return 'npub1' + npub.slice(5, 9) + '…' + npub.slice(-4);
}

export default function UploadPanel() {
  const { processBatch, isProcessing, fileMap } = useImageProcessor();
  const { startUpload, retryPhoto, shareLink, albumExpiresAt, isUploading, publishError } = useUpload();
  const settings = useSettings();
  const photos = useProcessingStore((state) => state.photos);
  const [albumTitle, setAlbumTitle] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const pubkey = useNostrAccountStore((state) => state.pubkey);
  const logout = useNostrAccountStore((state) => state.logout);
  const profile = useNostrProfile(pubkey);

  // Ref to the active upload queue — created on Upload click, fed by the effect below.
  const queueRef = useRef<DeferredQueue<UploadItem> | null>(null);
  // Tracks which photo IDs have already been pushed into the queue.
  const sentIdsRef = useRef<Set<string>>(new Set());

  // As photos finish processing during an active upload, push them into the queue.
  useEffect(() => {
    if (!isUploading || !queueRef.current) return;

    const allPhotosArray = Object.values(photos);

    for (const p of allPhotosArray) {
      if (p.status === 'done' && p.result && !sentIdsRef.current.has(p.id)) {
        sentIdsRef.current.add(p.id);
        queueRef.current.push({
          photo: p.result,
          photoId: p.id,
          originalFile: settings.keepOriginals ? (fileMap.get(p.id) ?? null) : null,
        });
      }
    }

    // Close the queue once all photos have reached a terminal state.
    const allTerminal = allPhotosArray.every(
      (p) => p.status === 'done' || p.status === 'error',
    );
    if (allTerminal) {
      queueRef.current.close();
    }
  }, [photos, isUploading, settings.keepOriginals, fileMap]);

  const processedPhotos = Object.values(photos).filter((p) => p.status === 'done' && p.result);
  const totalPhotos = Object.keys(photos).length;

  // Show the Upload button as soon as at least one photo is ready.
  const showUploadButton = processedPhotos.length > 0 && !isUploading && !shareLink;

  const handleUpload = () => {
    const queue = createDeferredQueue<UploadItem>();
    queueRef.current = queue;
    sentIdsRef.current = new Set();

    // Push all currently-done photos into the queue right away.
    for (const p of Object.values(photos)) {
      if (p.status === 'done' && p.result) {
        sentIdsRef.current.add(p.id);
        queue.push({
          photo: p.result,
          photoId: p.id,
          originalFile: settings.keepOriginals ? (fileMap.get(p.id) ?? null) : null,
        });
      }
    }

    // If nothing is still processing, close the queue immediately.
    const allTerminal = Object.values(photos).every(
      (p) => p.status === 'done' || p.status === 'error',
    );
    if (allTerminal) {
      queue.close();
    }

    void startUpload(queue, {
      blossomServers: settings.blossomServers,
      title: albumTitle || undefined,
      expirationSeconds: settings.expiration,
      reactions: settings.reactionsEnabled
        ? { relays: settings.reactionRelays }
        : undefined,
    });
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
          expiration={settings.expiration}
          onExpirationChange={settings.setExpiration}
          reactionsEnabled={settings.reactionsEnabled}
          onReactionsEnabledChange={settings.setReactionsEnabled}
        />}

        {/* Progress list — appears after first photo is added */}
        <ProgressList
          onRetryPhoto={(photoId) => void retryPhoto(photoId)}
          isRetrying={isUploading}
        />

        {/* Album title + Upload button — visible as soon as the first photo is ready */}
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
              {isProcessing
                ? `Upload · ${processedPhotos.length} / ${totalPhotos} ready`
                : `Upload ${processedPhotos.length} photo${processedPhotos.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* ShareCard — shown during upload (spinner) and after publish (share link) */}
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
