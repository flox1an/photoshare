"use client";

import { useState, useCallback } from "react";
import { useAlbumViewer } from "@/hooks/useAlbumViewer";
import ThumbnailGrid from "./ThumbnailGrid";
import Lightbox from "./Lightbox";
import DownloadProgress from "./DownloadProgress";

interface Props {
  hash: string;
}

export default function ViewerPanel({ hash }: Props) {
  const viewer = useAlbumViewer({ hash });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const preloadAdjacent = useCallback(
    (index: number) => {
      const total = viewer.manifest?.photos.length ?? 0;
      if (index > 0) viewer.loadFullImage(index - 1);
      if (index < total - 1) viewer.loadFullImage(index + 1);
    },
    [viewer],
  );

  const handleOpenLightbox = useCallback(
    (index: number) => {
      setLightboxIndex(index);
      viewer.loadFullImage(index);
      preloadAdjacent(index);
    },
    [viewer, preloadAdjacent],
  );

  const handleDownloadAll = useCallback(async () => {
    if (!viewer.manifest || !viewer.albumKey) return;
    try {
      await viewer.downloadAll(
        viewer.manifest.photos,
        viewer.albumKey,
        viewer.resolvedServer ?? '',
      );
    } catch (err) {
      alert(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [viewer]);

  const handleDownloadSingle = useCallback(
    async (index: number) => {
      if (!viewer.manifest || !viewer.albumKey) return;
      const photo = viewer.manifest.photos[index];
      if (!photo) return;
      try {
        await viewer.downloadSingle(photo, viewer.albumKey, viewer.resolvedServer ?? '');
      } catch (err) {
        alert(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    },
    [viewer],
  );

  if (viewer.status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading album...</p>
        </div>
      </main>
    );
  }

  if (viewer.status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-sm w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Unable to load album</h2>
          <p className="text-sm text-zinc-400 mb-2">{viewer.error}</p>
          <p className="text-xs text-zinc-600">
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
    <main className="min-h-screen">
      {/* Gallery header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            {manifest.title ?? "Photo Album"}
          </h1>
          <p className="text-xs text-zinc-500">
            {photoCount} {photoCount === 1 ? "photo" : "photos"}
          </p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={viewer.downloadProgress !== null}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300
            hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          resolvedServer={viewer.resolvedServer ?? ''}
          onNext={() => {
            setLightboxIndex((i) => {
              const next = Math.min(i! + 1, manifest.photos.length - 1);
              viewer.loadFullImage(next);
              preloadAdjacent(next);
              return next;
            });
          }}
          onPrev={() => {
            setLightboxIndex((i) => {
              const prev = Math.max(i! - 1, 0);
              viewer.loadFullImage(prev);
              preloadAdjacent(prev);
              return prev;
            });
          }}
          onClose={() => setLightboxIndex(null)}
          onDownload={handleDownloadSingle}
        />
      )}
    </main>
  );
}
