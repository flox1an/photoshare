
import { useEffect, useRef, useState, useCallback } from "react";
import { useGesture } from "@use-gesture/react";
import type { PhotoEntry } from "@/types/album";
import type { PhotoReactions } from "@/hooks/useReactions";
import ReactionsPanel from "./ReactionsPanel";
import HeartsOverlay from "./HeartsOverlay";

interface LightboxProps {
  photos: PhotoEntry[];
  currentIndex: number;
  thumbUrls: Record<string, string>;
  fullUrls: Record<string, string>;
  albumKey: CryptoKey | null;
  resolvedServer: string;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onDownload: (index: number) => void;
  onImageLoaded?: () => void;
  /** Reactions data for the current photo — undefined when reactions not enabled */
  reactionsByPhoto?: Map<string, PhotoReactions>;
  reactionsLoading?: boolean;
  onReact?: (photoHash: string) => Promise<void>;
  onComment?: (photoHash: string, text: string) => Promise<void>;
  onLoginRequest?: () => void;
  /** Whether the current viewer has already reacted to the current photo */
  hasReacted?: boolean;
}

export default function Lightbox({
  photos,
  currentIndex,
  thumbUrls,
  fullUrls,
  onNext,
  onPrev,
  onClose,
  onDownload,
  onImageLoaded,
  reactionsByPhoto,
  reactionsLoading,
  onReact,
  onComment,
  onLoginRequest,
  hasReacted,
}: LightboxProps) {
  const photo = photos[currentIndex];
  const [reactionsPanelOpen, setReactionsPanelOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
  }, []);

  // Reset zoom and loaded state when changing photos
  useEffect(() => {
    resetZoom();
    setImageLoaded(false);
  }, [currentIndex, resetZoom]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "Escape") onClose();
      if (e.key === "l" && !isTyping && onReact && !hasReacted) void onReact(photo.hash);
      if (e.key === "c" && !isTyping) setReactionsPanelOpen((prev) => !prev);
      if (e.key === "f" && !isTyping) {
        if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
        else void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onClose, onReact, hasReacted, photo]);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const bind = useGesture(
    {
      onDrag: ({ swipe: [swipeX], offset: [ox, oy], memo, first, tap }) => {
        if (tap) return;
        const s = scaleRef.current;
        if (s > 1) {
          const startTranslate = first ? translateRef.current : memo;
          const nx = startTranslate.x + ox;
          const ny = startTranslate.y + oy;
          setTranslate({ x: nx, y: ny });
          translateRef.current = { x: nx, y: ny };
          return startTranslate;
        }
        if (swipeX === 1) onPrev();
        if (swipeX === -1) onNext();
      },
      onPinch: ({ offset: [d], memo, first }) => {
        const startScale = first ? scaleRef.current : memo;
        const newScale = Math.min(Math.max(startScale * d, 1), 5);
        setScale(newScale);
        scaleRef.current = newScale;
        if (newScale === 1) {
          setTranslate({ x: 0, y: 0 });
          translateRef.current = { x: 0, y: 0 };
        }
        return startScale;
      },
    },
    {
      drag: { filterTaps: true },
      pinch: { scaleBounds: { min: 1, max: 5 } },
    },
  );

  // Auto-hide controls after 3s of inactivity
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    const events = ["mousemove", "mousedown", "touchstart", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, resetHideTimer));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetHideTimer));
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [resetHideTimer]);

  const lastTap = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (scaleRef.current > 1) {
        resetZoom();
      } else {
        setScale(2.5);
        scaleRef.current = 2.5;
      }
    }
    lastTap.current = now;
  }, [resetZoom]);

  return (
    <div
      data-testid="lightbox-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top-right controls */}
      <div className={`absolute top-4 right-4 z-10 flex items-center gap-2 transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {reactionsByPhoto && photo && onReact && (
          <HeartsOverlay
            photoHash={photo.hash}
            reactions={reactionsByPhoto.get(photo.hash)}
            onReact={onReact}
            hasReacted={hasReacted}
          />
        )}
        {reactionsByPhoto && photo && onComment && (() => {
          const commentCount = reactionsByPhoto.get(photo.hash)?.comments.length ?? 0;
          return (
            <button
              className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors select-none
                ${reactionsPanelOpen ? 'bg-white/20 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              onClick={() => setReactionsPanelOpen((o) => !o)}
              aria-label="Comments"
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              {commentCount > 0 && <span className="tabular-nums">{commentCount}</span>}
            </button>
          );
        })()}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={() => onDownload(currentIndex)}
          aria-label="Download"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Comments panel — desktop: right side panel; mobile: bottom sheet */}
      {reactionsPanelOpen && photo && onComment && (
        <>
          {/* Desktop side panel */}
          <div className="absolute inset-y-0 right-0 z-20 hidden md:flex w-80 flex-col bg-zinc-950/95 border-l border-zinc-800 backdrop-blur-sm">
            <ReactionsPanel
              photoHash={photo.hash}
              reactions={reactionsByPhoto?.get(photo.hash)}
              loading={reactionsLoading}
              onComment={onComment}
              onLoginRequest={onLoginRequest ?? (() => {})}
              onClose={() => setReactionsPanelOpen(false)}
            />
          </div>
          {/* Mobile bottom sheet */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex md:hidden h-2/3 flex-col bg-zinc-950/98 border-t border-zinc-800 rounded-t-xl">
            <ReactionsPanel
              photoHash={photo.hash}
              reactions={reactionsByPhoto?.get(photo.hash)}
              loading={reactionsLoading}
              onComment={onComment}
              onLoginRequest={onLoginRequest ?? (() => {})}
              onClose={() => setReactionsPanelOpen(false)}
            />
          </div>
        </>
      )}

      {/* Photo counter */}
      {photos.length > 1 && (
        <div className={`absolute bottom-4 left-0 right-0 z-10 text-center pointer-events-none transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-400 font-mono">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
      )}

      {/* Left arrow */}
      {currentIndex > 0 && (
        <button
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-[opacity,colors] duration-500 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={onPrev}
          aria-label="Previous"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      )}

      {/* Right arrow */}
      {currentIndex < photos.length - 1 && (
        <button
          className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-[opacity,colors] duration-500 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={onNext}
          aria-label="Next"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* Image area */}
      <div
        {...bind()}
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        style={{ touchAction: "none" }}
        onClick={handleDoubleTap}
      >
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: scale === 1 ? "transform 0.2s ease-out" : undefined,
          }}
        >
          {/* Blurred thumbnail background */}
          {photo && thumbUrls[photo.thumbHash] && (
            <img
              src={thumbUrls[photo.thumbHash]}
              className="absolute inset-0 w-full h-full object-contain blur-sm opacity-50"
              alt=""
            />
          )}

          {/* Loading spinner — shown while full-res is loading */}
          {photo && !imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            </div>
          )}

          {/* Full-res image (hidden until loaded, then crossfade in) */}
          {photo && (
            <img
              src={fullUrls[photo.hash] || undefined}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={() => { setImageLoaded(true); onImageLoaded?.(); }}
              alt={photo.filename}
            />
          )}
        </div>
      </div>
    </div>
  );
}
