
import { useState, useCallback, useRef, useEffect } from "react";
import { useAlbumViewer } from "@/hooks/useAlbumViewer";
import type { DownloadMode } from "@/hooks/useAlbumViewer";
import { useReactions } from "@/hooks/useReactions";
import ThumbnailGrid from "./ThumbnailGrid";
import Lightbox from "./Lightbox";
import DownloadProgress from "./DownloadProgress";
import { LoginDialog } from "@/components/auth/LoginDialog";

interface Props {
  hash: string;
}

export default function ViewerPanel({ hash }: Props) {
  const viewer = useAlbumViewer({ hash });
  const { reactionsByPhoto, react, comment } = useReactions(viewer.manifest, viewer.nsecBytes);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Optimistic set of photo hashes the current viewer has reacted to this session
  const [reactedHashes, setReactedHashes] = useState<Set<string>>(new Set());

  const handleReact = useCallback(
    async (photoHash: string) => {
      await react(photoHash);
      setReactedHashes((prev) => new Set(prev).add(photoHash));
    },
    [react],
  );
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [downloadMenuOpen]);

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
    },
    [viewer],
  );

  const handleDownloadAll = useCallback(async (mode: DownloadMode) => {
    if (!viewer.manifest || !viewer.albumKey) return;
    setDownloadMenuOpen(false);
    try {
      await viewer.downloadAll(
        viewer.manifest.photos,
        viewer.albumKey,
        viewer.resolvedServer ?? '',
        mode,
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
        {/* Download button with format picker */}
        <div ref={downloadMenuRef} className="relative">
          <div className="flex items-stretch">
            <button
              onClick={() => handleDownloadAll(viewer.isIOS ? 'zip' : 'files')}
              disabled={viewer.downloadProgress !== null}
              className="flex items-center gap-1.5 rounded-l-lg border border-r-0 border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300
                hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download all
            </button>
            <button
              onClick={() => setDownloadMenuOpen(o => !o)}
              disabled={viewer.downloadProgress !== null}
              aria-label="Choose download format"
              className="flex items-center justify-center rounded-r-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-zinc-300
                hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {downloadMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1">
              <button
                onClick={() => handleDownloadAll('zip')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
                Download as ZIP
              </button>
              <button
                onClick={() => handleDownloadAll('files')}
                disabled={viewer.isIOS}
                title={viewer.isIOS ? "Not supported on iOS" : undefined}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                </svg>
                Individual files
                {viewer.isIOS && <span className="ml-auto text-zinc-600">iOS</span>}
              </button>
            </div>
          )}
        </div>
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
        reactionsByPhoto={viewer.nsecBytes ? reactionsByPhoto : undefined}
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
              return next;
            });
          }}
          onPrev={() => {
            setLightboxIndex((i) => {
              const prev = Math.max(i! - 1, 0);
              viewer.loadFullImage(prev);
              return prev;
            });
          }}
          onImageLoaded={() => preloadAdjacent(lightboxIndex!)}
          onClose={() => setLightboxIndex(null)}
          onDownload={handleDownloadSingle}
          reactionsByPhoto={viewer.nsecBytes ? reactionsByPhoto : undefined}
          onReact={handleReact}
          onComment={comment}
          onLoginRequest={() => setLoginOpen(true)}
          hasReacted={lightboxIndex !== null ? reactedHashes.has(manifest.photos[lightboxIndex]?.hash ?? '') : false}
        />
      )}

      <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
