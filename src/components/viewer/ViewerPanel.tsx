
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useAlbumViewer } from "@/hooks/useAlbumViewer";
import type { DownloadMode } from "@/hooks/useAlbumViewer";
import { useReactions } from "@/hooks/useReactions";
import { useNostrAccountStore } from "@/store/nostrAccountStore";
import { getAnonKeypair } from "@/lib/nostr/anonIdentity";
import {
  getAnonProfileName,
  setAnonProfileName,
  hasBeenPrompted,
  markPrompted,
  buildSignedProfileEvent,
} from "@/lib/nostr/anonProfile";
import { eventStore } from "@/lib/nostr/eventStore";
import { createGiftWrap } from "@/lib/nostr/nip59";
import { publishMethod } from "@/lib/nostr/relay";
import { nsecToPubkey } from "@/lib/crypto";
import { anonDisplayName } from "@/lib/anonName";
import ThumbnailGrid from "./ThumbnailGrid";
import Lightbox from "./Lightbox";
import DownloadProgress from "./DownloadProgress";
import AnonNameDialog from "./AnonNameDialog";
import ReactionToast from "./ReactionToast";
import { LoginDialog } from "@/components/auth/LoginDialog";
import type { NostrEvent } from "nostr-tools";

interface Props {
  hash: string;
}

export default function ViewerPanel({ hash }: Props) {
  const viewer = useAlbumViewer({ hash });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // The pubkey that represents the current viewer (logged-in or persistent anon)
  const accountPubkey = useNostrAccountStore((s) => s.pubkey);
  const anonKeypair = useMemo(() => accountPubkey ? null : getAnonKeypair(), [accountPubkey]);
  const viewerPubkey = anonKeypair?.pubkey ?? accountPubkey ?? '';

  const { reactionsByPhoto, react, comment, loading: reactionsLoading, seenAnonProfileName } =
    useReactions(viewer.manifest, viewer.nsecBytes, anonKeypair?.pubkey);

  // Build the set of photo hashes this viewer has already reacted to from relay data.
  // Falls back to an optimistic local-only set for reactions sent this session.
  const [localReactedHashes, setLocalReactedHashes] = useState<Set<string>>(new Set());

  const reactedHashes = useMemo(() => {
    const set = new Set(localReactedHashes);
    reactionsByPhoto.forEach((data, photoHash) => {
      if (data.reactions.some((r) => r.pubkey === viewerPubkey)) {
        set.add(photoHash);
      }
    });
    return set;
  }, [reactionsByPhoto, viewerPubkey, localReactedHashes]);

  const handleSaveName = useCallback(
    async (name: string) => {
      const anon = getAnonKeypair();
      const profileEvent = buildSignedProfileEvent(name, anon.privkey);

      // Persist name locally
      setAnonProfileName(name);

      // Add to local EventStore so useNostrProfile immediately resolves
      eventStore.add(profileEvent as unknown as NostrEvent);

      // Gift-wrap and publish to the album if reactions are enabled
      const manifest = viewer.manifest;
      const nsecBytes = viewer.nsecBytes;
      if (manifest?.v === 2 && manifest.reactions && nsecBytes) {
        const albumPubkey = nsecToPubkey(nsecBytes);
        const expirationTs = manifest.expiresAt
          ? Math.floor(new Date(manifest.expiresAt).getTime() / 1000)
          : undefined;
        const giftWrap = createGiftWrap(profileEvent, null, albumPubkey, expirationTs);
        await publishMethod(manifest.reactions.relays, giftWrap).catch(() => {});
      }

      setNameDialogOpen(false);
    },
    [viewer.manifest, viewer.nsecBytes],
  );

  const handleReact = useCallback(
    async (photoHash: string) => {
      await react(photoHash);
      setLocalReactedHashes((prev) => new Set(prev).add(photoHash));

      // Show onboarding toast once for anonymous users who haven't been prompted
      if (!accountPubkey && !hasBeenPrompted()) {
        markPrompted();
        setToastVisible(true);
      }
    },
    [react, accountPubkey],
  );
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [gridFullscreen, setGridFullscreen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // After EOSE: if the album doesn't have our profile yet, or has a stale name, publish.
  // Uses the relay data as source of truth — no separate localStorage tracking needed.
  const profilePublishedRef = useRef(false);
  useEffect(() => {
    if (reactionsLoading) return; // wait for EOSE
    if (accountPubkey || !anonKeypair) return; // logged-in users have real Nostr profiles

    const savedName = getAnonProfileName();
    if (!savedName) return; // user hasn't set a name yet

    // seenAnonProfileName is null if no kind 0 was found, or the name string if found
    if (seenAnonProfileName === savedName) return; // relay already has the current name

    if (profilePublishedRef.current) return; // already published this session

    const manifest = viewer.manifest;
    const nsecBytes = viewer.nsecBytes;
    if (!manifest || manifest.v !== 2 || !manifest.reactions || !nsecBytes) return;

    profilePublishedRef.current = true; // only lock after we know we can actually publish

    const profileEvent = buildSignedProfileEvent(savedName, anonKeypair.privkey);
    eventStore.add(profileEvent as unknown as NostrEvent);

    const albumPubkey = nsecToPubkey(nsecBytes);
    const expirationTs = manifest.expiresAt
      ? Math.floor(new Date(manifest.expiresAt).getTime() / 1000)
      : undefined;
    const giftWrap = createGiftWrap(profileEvent, null, albumPubkey, expirationTs);
    publishMethod(manifest.reactions.relays, giftWrap).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactionsLoading, seenAnonProfileName, accountPubkey]);

  // Sync gridFullscreen with the browser's actual fullscreen state so Escape works
  useEffect(() => {
    const handler = () => setGridFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleGridFullscreen = useCallback(() => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
    else void document.exitFullscreen();
  }, []);

  // F key toggles grid fullscreen when the lightbox is not open
  useEffect(() => {
    if (lightboxIndex !== null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "f") toggleGridFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, toggleGridFullscreen]);

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
  const reactionsEnabled = manifest.v === 2 && !!manifest.reactions;

  return (
    <main className="min-h-screen">
      {/* Gallery header — hidden in fullscreen */}
      <header className={`flex items-center justify-between px-5 py-4 border-b border-zinc-800${gridFullscreen ? " hidden" : ""}`}>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            {manifest.title ?? "Photo Album"}
          </h1>
          <p className="text-xs text-zinc-500">
            {photoCount} {photoCount === 1 ? "photo" : "photos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
        {/* Fullscreen toggle button */}
        <button
          onClick={toggleGridFullscreen}
          aria-label="Toggle fullscreen"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>
        {/* Download icon button */}
        <div ref={downloadMenuRef} className="relative">
          <button
            onClick={() => setDownloadMenuOpen(o => !o)}
            disabled={viewer.downloadProgress !== null}
            aria-label="Download"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${downloadMenuOpen ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>

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
        </div>
      </header>

      {/* Download progress bar — hidden in fullscreen */}
      {!gridFullscreen && viewer.downloadProgress !== null && (
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
        reactionsByPhoto={reactionsEnabled && viewer.nsecBytes ? reactionsByPhoto : undefined}
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
          reactionsByPhoto={reactionsEnabled && viewer.nsecBytes ? reactionsByPhoto : undefined}
          reactionsLoading={reactionsEnabled ? reactionsLoading : false}
          onReact={reactionsEnabled ? handleReact : undefined}
          onComment={reactionsEnabled ? comment : undefined}
          onLoginRequest={() => setLoginOpen(true)}
          onEditName={reactionsEnabled ? () => setNameDialogOpen(true) : undefined}
          hasReacted={lightboxIndex !== null ? reactedHashes.has(manifest.photos[lightboxIndex]?.hash ?? '') : false}
        />
      )}

      <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />

      <AnonNameDialog
        isOpen={nameDialogOpen}
        generatedName={anonDisplayName(getAnonKeypair().pubkey)}
        savedName={getAnonProfileName()}
        onSave={(name) => void handleSaveName(name)}
        onDismiss={() => setNameDialogOpen(false)}
      />

      {toastVisible && !accountPubkey && (
        <ReactionToast
          name={getAnonProfileName() ?? anonDisplayName(getAnonKeypair().pubkey)}
          onChangeName={() => setNameDialogOpen(true)}
          onDismiss={() => setToastVisible(false)}
        />
      )}
    </main>
  );
}
