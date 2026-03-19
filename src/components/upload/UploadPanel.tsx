'use client';

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
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">PhotoShare</h1>
        <p className="mb-8 text-gray-500">
          Drop photos below. They are processed locally — nothing leaves your device until you upload.
        </p>

        {/* Drop zone — disabled during upload to prevent new additions */}
        <DropZone onFiles={processBatch} isProcessing={isProcessing} disabled={isUploading} />

        {/* Settings panel — always visible below drop zone, collapsed by default */}
        <SettingsPanel settings={settings} />

        {/* Progress list — appears after first photo is added */}
        <ProgressList />

        {/* Upload button — shown only when all photos are processing-done and not yet uploading */}
        {showUploadButton && (
          <button
            type="button"
            onClick={handleUpload}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Upload {processedPhotos.length} photo{processedPhotos.length !== 1 ? 's' : ''} to Nostr
          </button>
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
