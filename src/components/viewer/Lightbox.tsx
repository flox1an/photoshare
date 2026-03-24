
import { useEffect, useRef, useState, useCallback } from "react";
import { useGesture } from "@use-gesture/react";
import type { PhotoEntry } from "@/types/album";
import type { PhotoReactions } from "@/hooks/useReactions";
import ReactionsPanel from "./ReactionsPanel";
import HeartsOverlay from "./HeartsOverlay";
import { CommentIcon } from "./icons";
import RoundButton from "./RoundButton";

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
  onEditName?: () => void;
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
  onEditName,
  hasReacted,
}: LightboxProps) {
  const photo = photos[currentIndex];
  const prevPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null;
  const nextPhoto = currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null;
  const [reactionsPanelOpen, setReactionsPanelOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const isPinchingRef = useRef(false);

  // Slide animation state
  const [slideX, setSlideX] = useState(0);
  const [slideTransition, setSlideTransition] = useState<string | undefined>(undefined);
  const navDirectionRef = useRef<"next" | "prev" | null>(null);

  // Mobile-only: hide left/right nav buttons after swipe, reveal on tap
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const mobileNavHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideMobileNav = useCallback(() => {
    if (mobileNavHideTimer.current) clearTimeout(mobileNavHideTimer.current);
    setMobileNavVisible(false);
  }, []);

  const showMobileNav = useCallback(() => {
    setMobileNavVisible(true);
    if (mobileNavHideTimer.current) clearTimeout(mobileNavHideTimer.current);
    mobileNavHideTimer.current = setTimeout(() => setMobileNavVisible(false), 3000);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null);
  const loadedHashesRef = useRef<Set<string>>(new Set());

  const computeBounds = useCallback((s: number) => {
    const container = containerRef.current;
    if (!container) return { maxX: 0, maxY: 0 };
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    let displayedW = cw;
    let displayedH = ch;
    const nat = naturalSizeRef.current;
    if (nat && nat.w > 0 && nat.h > 0) {
      const containerAspect = cw / ch;
      const imageAspect = nat.w / nat.h;
      if (imageAspect > containerAspect) {
        displayedW = cw;
        displayedH = cw / imageAspect;
      } else {
        displayedH = ch;
        displayedW = ch * imageAspect;
      }
    }
    return {
      maxX: Math.max(0, (displayedW * s - cw) / 2),
      maxY: Math.max(0, (displayedH * s - ch) / 2),
    };
  }, []);

  const clampTranslate = useCallback((x: number, y: number, s: number) => {
    const { maxX, maxY } = computeBounds(s);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, [computeBounds]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
  }, []);

  // Reset state when photo changes — strip already positioned adjacent images, just snap to 0
  useEffect(() => {
    resetZoom();
    // If this photo's full image was already loaded (e.g. preloaded in adjacent slot), skip blur/spinner
    setImageLoaded(photo ? loadedHashesRef.current.has(photo.hash) : false);
    naturalSizeRef.current = null;
    navDirectionRef.current = null;
    setSlideTransition(undefined);
    setSlideX(0);
  }, [currentIndex, resetZoom]);

  const navigateWithSlide = useCallback((direction: "next" | "prev") => {
    hideMobileNav();
    const w = containerRef.current?.clientWidth ?? window.innerWidth;
    const toX = direction === "next" ? -w : w;
    navDirectionRef.current = direction;
    setSlideTransition("transform 0.15s cubic-bezier(0.4, 0, 1, 1)");
    setSlideX(toX);
    setTimeout(() => {
      // Reset position synchronously before the index change so React 18 batches
      // all updates into one render — prevents a flash of the wrong adjacent photo.
      setSlideTransition(undefined);
      setSlideX(0);
      if (direction === "next") onNext();
      else onPrev();
    }, 150);
  }, [onNext, onPrev, hideMobileNav]);

  const navigateDirect = useCallback((direction: "next" | "prev") => {
    if (direction === "next") onNext();
    else onPrev();
  }, [onNext, onPrev]);


  // Lock body scroll while lightbox is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);


  const bind = useGesture(
    {
      onDrag: ({ swipe: [swipeX], movement: [mx, my], direction: [dirX], memo, first, last, tap }) => {
        if (tap) return;
        if (isPinchingRef.current) return;
        const s = scaleRef.current;
        if (s > 1) {
          // Pan the zoomed image — use movement (resets each gesture) + captured start translate
          const startTranslate = (first ? translateRef.current : memo) as { x: number; y: number };
          const clamped = clampTranslate(startTranslate.x + mx, startTranslate.y + my, s);
          setTranslate(clamped);
          translateRef.current = clamped;
          return startTranslate;
        }
        if (last) {
          const w = containerRef.current?.clientWidth ?? window.innerWidth;
          const hasSufficientDisplacement = Math.abs(mx) > w * 0.33;
          const goNext = (swipeX === -1 || (hasSufficientDisplacement && dirX < 0)) && currentIndex < photos.length - 1;
          const goPrev = (swipeX === 1 || (hasSufficientDisplacement && dirX > 0)) && currentIndex > 0;
          if (goNext) {
            navigateWithSlide("next");
          } else if (goPrev) {
            navigateWithSlide("prev");
          } else {
            // Spring back to center
            setSlideTransition("transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)");
            setSlideX(0);
          }
        } else {
          // Live drag follow finger
          setSlideTransition(undefined);
          setSlideX(mx);
        }
      },
      onPinch: ({ da: [distance], origin, memo, first, last }) => {
        isPinchingRef.current = !last;
        type PinchMemo = { scale: number; translate: { x: number; y: number }; distance: number; origin: [number, number] };
        const startState = (first
          ? { scale: scaleRef.current, translate: { ...translateRef.current }, distance, origin }
          : memo) as PinchMemo;

        if (!startState || startState.distance === 0) return startState;

        const rawScale = startState.scale * (distance / startState.distance);
        const newScale = Math.min(Math.max(rawScale, 1), 5);

        if (newScale <= 1) {
          setScale(1);
          setTranslate({ x: 0, y: 0 });
          scaleRef.current = 1;
          translateRef.current = { x: 0, y: 0 };
        } else {
          // Zoom toward pinch origin — keep the point under fingers stationary
          let newTranslate = startState.translate;
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            // Pinch origin relative to container center (since transform-origin is center)
            const ox = startState.origin[0] - rect.left - rect.width / 2;
            const oy = startState.origin[1] - rect.top - rect.height / 2;
            const ratio = newScale / startState.scale;
            newTranslate = {
              x: ox + (startState.translate.x - ox) * ratio,
              y: oy + (startState.translate.y - oy) * ratio,
            };
          }
          const clamped = clampTranslate(newTranslate.x, newTranslate.y, newScale);
          setScale(newScale);
          setTranslate(clamped);
          scaleRef.current = newScale;
          translateRef.current = clamped;
        }
        return startState;
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
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "ArrowRight" && currentIndex < photos.length - 1) navigateDirect("next");
      if (e.key === "ArrowLeft" && currentIndex > 0) navigateDirect("prev");
      if (e.key === "Escape") onClose();
      if (e.key === "l" && !isTyping && onReact && !hasReacted) { void onReact(photo.hash); resetHideTimer(); }
      if (e.key === "c" && !isTyping) { e.preventDefault(); setReactionsPanelOpen((prev) => !prev); }
      if (e.key === "f" && !isTyping) {
        if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
        else void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigateDirect, currentIndex, photos.length, onClose, onReact, hasReacted, photo, resetHideTimer]);

  useEffect(() => {
    resetHideTimer();
    const pointerEvents = ["mousemove", "mousedown", "touchstart"] as const;
    pointerEvents.forEach((e) => window.addEventListener(e, resetHideTimer));
    return () => {
      pointerEvents.forEach((e) => window.removeEventListener(e, resetHideTimer));
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (mobileNavHideTimer.current) clearTimeout(mobileNavHideTimer.current);
    };
  }, [resetHideTimer]);

  const lastTap = useRef(0);
  const handleDoubleTap = useCallback(() => {
    showMobileNav();
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
  }, [resetZoom, showMobileNav]);

  return (
    <div
      data-testid="lightbox-overlay"
      className="fixed top-0 left-0 right-0 h-[100dvh] z-50 flex items-center justify-center bg-black select-none"
      style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Heart button — bottom-right, all devices */}
      {reactionsByPhoto && photo && onReact && (
        <div className={`absolute bottom-4 right-4 z-10 transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"} ${reactionsPanelOpen ? "max-md:hidden" : ""}`}>
          <HeartsOverlay
            photoHash={photo.hash}
            reactions={reactionsByPhoto.get(photo.hash)}
            onReact={onReact}
            hasReacted={hasReacted}
          />
        </div>
      )}

      {/* Top-right controls */}
      <div className={`absolute top-4 right-4 z-10 flex items-center gap-2 transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"} ${reactionsPanelOpen ? "max-md:hidden" : ""}`}>
        {reactionsByPhoto && photo && onComment && (() => {
          const commentCount = reactionsByPhoto.get(photo.hash)?.comments.length ?? 0;
          return (
            <RoundButton
              pill
              active={reactionsPanelOpen}
              onClick={() => setReactionsPanelOpen((o) => !o)}
              aria-label="Comments"
            >
              <CommentIcon className="h-5 w-5 shrink-0" />
              {commentCount > 0 && <span className="tabular-nums">{commentCount}</span>}
            </RoundButton>
          );
        })()}
        <RoundButton onClick={() => onDownload(currentIndex)} aria-label="Download">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </RoundButton>
        <RoundButton onClick={onClose} aria-label="Close">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </RoundButton>
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
              onEditName={onEditName}
              onClose={() => setReactionsPanelOpen(false)}
            />
          </div>
          {/* Mobile full-screen overlay */}
          <div className="absolute inset-0 z-20 flex md:hidden flex-col bg-black/75 backdrop-blur-sm">
            <ReactionsPanel
              photoHash={photo.hash}
              reactions={reactionsByPhoto?.get(photo.hash)}
              loading={reactionsLoading}
              onComment={onComment}
              onLoginRequest={onLoginRequest ?? (() => {})}
              onEditName={onEditName}
              onClose={() => setReactionsPanelOpen(false)}
            />
          </div>
        </>
      )}

      {/* Photo counter */}
      {photos.length > 1 && (
        <div className={`absolute bottom-4 left-0 right-0 z-10 text-center pointer-events-none transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0"} ${reactionsPanelOpen ? "max-md:hidden" : ""}`}>
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-400 font-mono">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
      )}

      {/* Left arrow */}
      {currentIndex > 0 && (
        <RoundButton
          className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 transition-[opacity,colors] duration-500 ${controlsVisible ? "md:opacity-100" : "md:opacity-0 md:pointer-events-none"} ${mobileNavVisible && !reactionsPanelOpen ? "max-md:opacity-100" : "max-md:opacity-0 max-md:pointer-events-none"}`}
          onClick={() => navigateDirect("prev")}
          aria-label="Previous"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </RoundButton>
      )}

      {/* Right arrow */}
      {currentIndex < photos.length - 1 && (
        <RoundButton
          className={`absolute right-3 top-1/2 -translate-y-1/2 z-10 transition-[opacity,colors] duration-500 ${controlsVisible ? "md:opacity-100" : "md:opacity-0 md:pointer-events-none"} ${mobileNavVisible && !reactionsPanelOpen ? "max-md:opacity-100" : "max-md:opacity-0 max-md:pointer-events-none"}`}
          onClick={() => navigateDirect("next")}
          aria-label="Next"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </RoundButton>
      )}

      {/* Image area */}
      <div
        ref={containerRef}
        {...bind()}
        className="relative w-full h-full overflow-hidden"
        style={{ touchAction: "none" }}
        onClick={handleDoubleTap}
      >
        {/* Image strip — prev / current / next slots side-by-side so dragging reveals adjacent image directly */}
        <div
          className="absolute flex h-full"
          style={{
            width: "300%",
            left: "-100%",
            transform: `translateX(${slideX}px)`,
            transition: slideTransition,
          }}
        >
          {/* Prev slot */}
          <div className="w-1/3 h-full flex items-center justify-center">
            {prevPhoto && (fullUrls[prevPhoto.hash] || thumbUrls[prevPhoto.thumbHash]) && (
              <img
                src={fullUrls[prevPhoto.hash] || thumbUrls[prevPhoto.thumbHash]}
                className="w-full h-full object-contain"
                alt={prevPhoto.filename}
                draggable={false}
                onLoad={() => { if (fullUrls[prevPhoto.hash]) loadedHashesRef.current.add(prevPhoto.hash); }}
              />
            )}
          </div>

          {/* Current slot — zoom/pan transforms live here */}
          <div className="relative w-1/3 h-full flex items-center justify-center">
            <div
              className="relative w-full h-full flex items-center justify-center"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transition: scale === 1 ? "transform 0.2s ease-out" : undefined,
              }}
            >
              {/* Blurred thumbnail background — visible while full image loads, then fades out */}
              {photo && thumbUrls[photo.thumbHash] && (
                <img
                  src={thumbUrls[photo.thumbHash]}
                  className="absolute inset-0 w-full h-full object-contain blur-sm brightness-75 transition-opacity duration-300"
                  style={{ opacity: imageLoaded ? 0 : 1 }}
                  alt=""
                  draggable={false}
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
                  onLoad={(e) => {
                    if (photo) loadedHashesRef.current.add(photo.hash);
                    setImageLoaded(true);
                    onImageLoaded?.();
                    naturalSizeRef.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
                  }}
                  alt={photo.filename}
                  draggable={false}
                />
              )}
            </div>
          </div>

          {/* Next slot */}
          <div className="w-1/3 h-full flex items-center justify-center">
            {nextPhoto && (fullUrls[nextPhoto.hash] || thumbUrls[nextPhoto.thumbHash]) && (
              <img
                src={fullUrls[nextPhoto.hash] || thumbUrls[nextPhoto.thumbHash]}
                className="w-full h-full object-contain"
                alt={nextPhoto.filename}
                draggable={false}
                onLoad={() => { if (fullUrls[nextPhoto.hash]) loadedHashesRef.current.add(nextPhoto.hash); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
