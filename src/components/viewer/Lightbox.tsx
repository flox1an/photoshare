import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import type { PhotoEntry } from "@/types/album";
import type { PhotoReactions } from "@/hooks/useReactions";
import { useLightboxGestures } from "./lightbox/useLightboxGestures";
import { LightboxControls } from "./lightbox/LightboxControls";
import { LightboxImageStrip } from "./lightbox/LightboxImageStrip";
import { ReactionsDrawer } from "./lightbox/ReactionsDrawer";

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
  reactionsByPhoto?: Map<string, PhotoReactions>;
  reactionsLoading?: boolean;
  onReact?: (photoHash: string) => Promise<void>;
  onComment?: (photoHash: string, text: string) => Promise<void>;
  onLoginRequest?: () => void;
  onEditName?: () => void;
  hasReacted?: boolean;
  failedHashes?: Record<string, true>;
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
  failedHashes,
}: LightboxProps) {
  const photo = photos[currentIndex];
  const prevPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null;
  const nextPhoto = currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null;

  const [reactionsPanelOpen, setReactionsPanelOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hidePlaceholder, setHidePlaceholder] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [slideTransition, setSlideTransition] = useState<string | undefined>(undefined);
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);

  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const isPinchingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null);
  const loadedHashesRef = useRef<Set<string>>(new Set());
  const mobileNavHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);

  const hideMobileNav = useCallback(() => {
    if (mobileNavHideTimer.current) clearTimeout(mobileNavHideTimer.current);
    setMobileNavVisible(false);
  }, []);

  const showMobileNav = useCallback(() => {
    setMobileNavVisible(true);
    if (mobileNavHideTimer.current) clearTimeout(mobileNavHideTimer.current);
    mobileNavHideTimer.current = setTimeout(() => setMobileNavVisible(false), 3000);
  }, []);

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

  const clampTranslate = useCallback(
    (x: number, y: number, s: number) => {
      const { maxX, maxY } = computeBounds(s);
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [computeBounds],
  );

  const resetZoom = useCallback(() => {
    const reset = { x: 0, y: 0 };
    setScale(1);
    setTranslate(reset);
    scaleRef.current = 1;
    translateRef.current = reset;
  }, []);

  useEffect(() => {
    resetZoom();
    const hasFullUrl = !!fullUrls[photo.hash];
    setImageLoaded(hasFullUrl || loadedHashesRef.current.has(photo.hash));
    setHidePlaceholder(hasFullUrl);
    naturalSizeRef.current = null;
    setSlideTransition(undefined);
    setSlideX(0);
  }, [currentIndex, resetZoom, photo, fullUrls]);

  useEffect(() => {
    if (!imageLoaded) {
      setHidePlaceholder(false);
      return;
    }
    const t = setTimeout(() => setHidePlaceholder(true), 180);
    return () => clearTimeout(t);
  }, [imageLoaded]);

  const navigateWithSlide = useCallback(
    (direction: "next" | "prev") => {
      hideMobileNav();
      const w = containerRef.current?.clientWidth ?? window.innerWidth;
      const toX = direction === "next" ? -w : w;
      setSlideTransition("transform 0.15s cubic-bezier(0.4, 0, 1, 1)");
      setSlideX(toX);
      setTimeout(() => {
        setSlideTransition(undefined);
        setSlideX(0);
        if (direction === "next") onNext();
        else onPrev();
      }, 150);
    },
    [onNext, onPrev, hideMobileNav],
  );

  const navigateDirect = useCallback(
    (direction: "next" | "prev") => {
      if (direction === "next") onNext();
      else onPrev();
    },
    [onNext, onPrev],
  );

  const bind = useLightboxGestures({
    currentIndex,
    photosLength: photos.length,
    containerRef,
    scaleRef,
    translateRef,
    isPinchingRef,
    setScale,
    setTranslate,
    clampTranslate,
    setSlideTransition,
    setSlideX,
    navigateWithSlide,
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
      if (e.key === "l" && !isTyping && onReact && !hasReacted) {
        void onReact(photo.hash);
        resetHideTimer();
      }
      if (e.key === "c" && !isTyping) {
        e.preventDefault();
        setReactionsPanelOpen((prev) => !prev);
      }
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
    pointerEvents.forEach((eventName) => window.addEventListener(eventName, resetHideTimer));
    return () => {
      pointerEvents.forEach((eventName) => window.removeEventListener(eventName, resetHideTimer));
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (mobileNavHideTimer.current) clearTimeout(mobileNavHideTimer.current);
    };
  }, [resetHideTimer]);

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
      style={{ WebkitTouchCallout: "none" } as CSSProperties}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <LightboxControls
        photo={photo}
        photosLength={photos.length}
        currentIndex={currentIndex}
        controlsVisible={controlsVisible}
        reactionsPanelOpen={reactionsPanelOpen}
        setReactionsPanelOpen={setReactionsPanelOpen}
        reactionsByPhoto={reactionsByPhoto}
        onReact={onReact}
        onComment={onComment}
        onDownload={onDownload}
        onClose={onClose}
        onPrev={() => navigateDirect("prev")}
        onNext={() => navigateDirect("next")}
        hasReacted={hasReacted}
        mobileNavVisible={mobileNavVisible}
      />

      {onComment && (
        <ReactionsDrawer
          open={reactionsPanelOpen}
          photoHash={photo.hash}
          reactions={reactionsByPhoto?.get(photo.hash)}
          loading={reactionsLoading}
          onComment={onComment}
          onLoginRequest={onLoginRequest ?? (() => {})}
          onEditName={onEditName}
          onClose={() => setReactionsPanelOpen(false)}
        />
      )}

      <LightboxImageStrip
        containerRef={containerRef}
        bind={bind}
        handleDoubleTap={handleDoubleTap}
        prevPhoto={prevPhoto}
        photo={photo}
        nextPhoto={nextPhoto}
        thumbUrls={thumbUrls}
        fullUrls={fullUrls}
        scale={scale}
        translate={translate}
        slideX={slideX}
        slideTransition={slideTransition}
        hidePlaceholder={hidePlaceholder}
        imageLoaded={imageLoaded}
        setImageLoaded={setImageLoaded}
        failedHashes={failedHashes}
        onImageLoaded={onImageLoaded}
        loadedHashesRef={loadedHashesRef}
        naturalSizeRef={naturalSizeRef}
      />
    </div>
  );
}
