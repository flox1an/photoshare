"use client";

import { useState, useCallback } from "react";
import { useAlbumViewer } from "@/hooks/useAlbumViewer";
import ThumbnailGrid from "./ThumbnailGrid";
import Lightbox from "./Lightbox";
import DownloadProgress from "./DownloadProgress";

interface Props {
  naddr: string;
}

export default function ViewerPanel({ naddr }: Props) {
  const viewer = useAlbumViewer({ naddr });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleOpenLightbox = useCallback(
    (index: number) => {
      setLightboxIndex(index);
      viewer.loadFullImage(index);
    },
    [viewer],
  );

  const handleDownloadAll = useCallback(async () => {
    if (!viewer.manifest || !viewer.albumKey) return;
    try {
      await viewer.downloadAll(
        viewer.manifest.photos,
        viewer.albumKey,
        viewer.blossomServer,
      );
    } catch (err) {
      alert(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [viewer]);

  if (viewer.status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading album...</p>
        </div>
      </main>
    );
  }

  if (viewer.status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load album</h2>
          <p className="text-gray-700 mb-3">{viewer.error}</p>
          <p className="text-gray-500 text-sm">
            This link may be invalid or the album may have expired.
          </p>
        </div>
      </main>
    );
  }

  // status === "ready" and manifest is not null
  const manifest = viewer.manifest!;
  const photoCount = manifest.photos.length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Gallery header */}
      <header className="flex items-center justify-between px-4 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {manifest.title ?? "Photo Album"}
          </h1>
          <p className="text-sm text-gray-500">
            {photoCount} {photoCount === 1 ? "photo" : "photos"}
          </p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={viewer.downloadProgress !== null}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium
            hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Download all
        </button>
      </header>

      {/* Download progress bar */}
      {viewer.downloadProgress !== null && (
        <DownloadProgress
          current={viewer.downloadProgress.current}
          total={viewer.downloadProgress.total}
        />
      )}

      {/* Thumbnail grid */}
      <ThumbnailGrid
        photos={manifest.photos}
        objectUrls={viewer.thumbUrls}
        loadThumbnail={viewer.loadThumbnail}
        onPhotoClick={handleOpenLightbox}
      />

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={manifest.photos}
          currentIndex={lightboxIndex}
          thumbUrls={viewer.thumbUrls}
          fullUrls={viewer.fullUrls}
          albumKey={viewer.albumKey}
          blossomServer={viewer.blossomServer}
          onNext={() =>
            setLightboxIndex((i) => Math.min(i! + 1, manifest.photos.length - 1))
          }
          onPrev={() => setLightboxIndex((i) => Math.max(i! - 1, 0))}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </main>
  );
}
