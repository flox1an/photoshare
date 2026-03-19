'use client';

import { useState } from 'react';
import { useImageProcessor } from '@/hooks/useImageProcessor';
import { useUpload } from '@/hooks/useUpload';
import { useSettings } from '@/hooks/useSettings';
import { useProcessingStore } from '@/store/processingStore';
import { DropZone } from './DropZone';
import { ProgressList } from './ProgressList';
import { SettingsPanel } from './SettingsPanel';
import { ShareCard } from './ShareCard';

export default function UploadPanel() {
  const { processBatch, isProcessing } = useImageProcessor();
  const { startUpload, shareLink, isUploading, publishError } = useUpload();
  const settings = useSettings();
  const photos = useProcessingStore((state) => state.photos);
  const [albumTitle, setAlbumTitle] = useState('');

  // Collect ProcessedPhoto results for photos that finished processing
  const processedPhotos = Object.values(photos).filter((p) => p.status === 'done' && p.result);
  // All photos must be done processing before the Upload button appears
  const allDone = processedPhotos.length > 0 && processedPhotos.length === Object.keys(photos).length;
  const showUploadButton = allDone && !isUploading && !shareLink;

  const handleUpload = () => {
    const photosToUpload = processedPhotos
      .map((p) => p.result!)
      .filter(Boolean);
    void startUpload(photosToUpload, {
      blossomServer: settings.blossomServer,
      relays: settings.relays,
      title: albumTitle || undefined,
    });
  };

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            PhotoShare
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Encrypted photo albums on Nostr. Nothing leaves your device unencrypted.
          </p>
        </div>

        {/* Drop zone — disabled during upload to prevent new additions */}
        <DropZone onFiles={processBatch} isProcessing={isProcessing} disabled={isUploading} />

        {/* Settings panel — always visible below drop zone, collapsed by default */}
        <SettingsPanel settings={settings} />

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
              Upload {processedPhotos.length} photo{processedPhotos.length !== 1 ? 's' : ''} to Nostr
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
    </main>
  );
}
