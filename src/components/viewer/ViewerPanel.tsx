import { useState, useCallback, useRef, useEffect } from "react";
import { useAlbumViewer } from "@/hooks/useAlbumViewer";
import type { DownloadMode } from "@/hooks/useAlbumViewer";
import { useUserBlossomServers } from "@/hooks/useUserBlossomServers";
import { useNostrAccountStore } from "@/store/nostrAccountStore";
import { getAnonKeypair } from "@/lib/nostr/anonIdentity";
import { getAnonProfileName } from "@/lib/nostr/anonProfile";
import { anonDisplayName } from "@/lib/anonName";
import ThumbnailGrid from "./ThumbnailGrid";
import Lightbox from "./Lightbox";
import DownloadProgress from "./DownloadProgress";
import AnonNameDialog from "./AnonNameDialog";
import ReactionToast from "./ReactionToast";
import ViewerHeader from "./ViewerHeader";
import { useViewerReactions } from "./hooks/useViewerReactions";
import { useViewerKeyboardShortcuts } from "./hooks/useViewerKeyboardShortcuts";
import { LoginDialog } from "@/components/auth/LoginDialog";

interface Props {
  hash: string;
}

export default function ViewerPanel({ hash }: Props) {
  const accountPubkey = useNostrAccountStore((s) => s.pubkey);
  const userBlossomServers = useUserBlossomServers(accountPubkey);

  const viewer = useAlbumViewer({ hash, userBlossomServers });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const lastScrollY = useRef(0);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const {
    anonKeypair,
    reactionsByPhoto,
    reactionsLoading,
    comment,
    reactedHashes,
    handleReact,
    handleSaveName,
  } = useViewerReactions({
    manifest: viewer.manifest,
    nsecBytes: viewer.nsecBytes,
    manifestHash: viewer.manifestHash,
    accountPubkey,
    onAnonFirstReaction: () => setToastVisible(true),
  });

  const toggleGridFullscreen = useCallback(() => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
    else void document.exitFullscreen();
  }, []);

  const { gridFullscreen } = useViewerKeyboardShortcuts({
    lightboxOpen: lightboxIndex !== null,
    toggleGridFullscreen,
  });

  useEffect(() => {
    const handler = () => {
      const current = window.scrollY;
      if (current > lastScrollY.current + 8) setHeaderVisible(false);
      else if (current < lastScrollY.current - 8) setHeaderVisible(true);
      lastScrollY.current = current;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(target)) {
        setDownloadMenuOpen(false);
      }
    };
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

  const handleDownloadAll = useCallback(
    async (mode: DownloadMode) => {
      if (!viewer.manifest || !viewer.albumKey) return;
      setDownloadMenuOpen(false);
      try {
        await viewer.downloadAll(
          viewer.manifest.photos,
          viewer.albumKey,
          viewer.resolvedServer ?? "",
          mode,
        );
        setActionError(null);
      } catch (err) {
        setActionError(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    },
    [viewer],
  );

  const handleDownloadSingle = useCallback(
    async (index: number) => {
      if (!viewer.manifest || !viewer.albumKey) return;
      const photo = viewer.manifest.photos[index];
      if (!photo) return;
      try {
        await viewer.downloadSingle(photo, viewer.albumKey, viewer.resolvedServer ?? "");
        setActionError(null);
      } catch (err) {
        setActionError(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
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
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Unable to load album</h2>
          <p className="text-sm text-zinc-400 mb-2">{viewer.error}</p>
          <p className="text-xs text-zinc-600">This link may be invalid or the album may have expired.</p>
        </div>
      </main>
    );
  }

  const manifest = viewer.manifest!;
  const photoCount = manifest.photos.length;
  const reactionsEnabled = manifest.v === 2 && Boolean(manifest.reactions);
  const isExpired =
    manifest.v === 2 && manifest.expiresAt
      ? new Date(manifest.expiresAt) < new Date()
      : false;

  return (
    <main className="min-h-screen">
      <ViewerHeader
        title={manifest.title ?? "Photo Album"}
        photoCount={photoCount}
        isExpired={isExpired}
        gridFullscreen={gridFullscreen}
        headerVisible={headerVisible}
        downloadMenuOpen={downloadMenuOpen}
        setDownloadMenuOpen={setDownloadMenuOpen}
        downloadMenuRef={downloadMenuRef}
        isDownloading={viewer.downloadProgress !== null}
        isIOS={viewer.isIOS}
        onToggleFullscreen={toggleGridFullscreen}
        onDownloadAll={(mode) => void handleDownloadAll(mode)}
      />

      {actionError && (
        <div className="mx-5 mt-3 flex items-start justify-between gap-3 rounded-lg border border-red-800/70 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <p>{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="rounded border border-red-800/70 px-2 py-1 text-xs text-red-200 hover:bg-red-900/40 transition-colors"
            aria-label="Dismiss download error"
          >
            Dismiss
          </button>
        </div>
      )}

      {!gridFullscreen && viewer.downloadProgress !== null && (
        <DownloadProgress
          current={viewer.downloadProgress.current}
          total={viewer.downloadProgress.total}
        />
      )}

      <ThumbnailGrid
        photos={manifest.photos}
        objectUrls={viewer.thumbUrls}
        loadThumbnail={viewer.loadThumbnail}
        onPhotoClick={handleOpenLightbox}
        reactionsByPhoto={reactionsEnabled && viewer.nsecBytes ? reactionsByPhoto : undefined}
      />

      {lightboxIndex !== null && (
        <Lightbox
          photos={manifest.photos}
          currentIndex={lightboxIndex}
          thumbUrls={viewer.thumbUrls}
          fullUrls={viewer.fullUrls}
          albumKey={viewer.albumKey}
          resolvedServer={viewer.resolvedServer ?? ""}
          onNext={() => {
            setLightboxIndex((i) => {
              const next = Math.min((i ?? 0) + 1, manifest.photos.length - 1);
              viewer.loadFullImage(next);
              return next;
            });
          }}
          onPrev={() => {
            setLightboxIndex((i) => {
              const prev = Math.max((i ?? 0) - 1, 0);
              viewer.loadFullImage(prev);
              return prev;
            });
          }}
          onImageLoaded={() => preloadAdjacent(lightboxIndex)}
          onClose={() => setLightboxIndex(null)}
          onDownload={handleDownloadSingle}
          reactionsByPhoto={reactionsEnabled && viewer.nsecBytes ? reactionsByPhoto : undefined}
          reactionsLoading={reactionsEnabled ? reactionsLoading : false}
          onReact={reactionsEnabled ? handleReact : undefined}
          onComment={reactionsEnabled ? comment : undefined}
          onLoginRequest={() => setLoginOpen(true)}
          onEditName={reactionsEnabled ? () => setNameDialogOpen(true) : undefined}
          hasReacted={reactedHashes.has(manifest.photos[lightboxIndex]?.hash ?? "")}
          failedHashes={viewer.failedFullHashes}
        />
      )}

      <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />

      <AnonNameDialog
        isOpen={nameDialogOpen}
        generatedName={anonDisplayName(getAnonKeypair().pubkey)}
        savedName={getAnonProfileName()}
        onSave={(name) => {
          void handleSaveName(name);
          setNameDialogOpen(false);
        }}
        onDismiss={() => setNameDialogOpen(false)}
      />

      {toastVisible && !accountPubkey && (
        <ReactionToast
          name={getAnonProfileName() ?? anonDisplayName((anonKeypair ?? getAnonKeypair()).pubkey)}
          onChangeName={() => setNameDialogOpen(true)}
          onDismiss={() => setToastVisible(false)}
        />
      )}
    </main>
  );
}
