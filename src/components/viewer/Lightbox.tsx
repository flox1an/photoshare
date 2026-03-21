"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGesture } from "@use-gesture/react";
import type { PhotoEntry } from "@/types/album";

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
}: LightboxProps) {
  const photo = photos[currentIndex];
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
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onClose]);

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

  // Double-tap to zoom in/out
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
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
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

      {/* Photo counter */}
      <div className="absolute bottom-4 left-0 right-0 z-10 text-center pointer-events-none">
        <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-400 font-mono">
          {currentIndex + 1} / {photos.length}
        </span>
      </div>

      {/* Left arrow */}
      <button
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        onClick={onPrev}
        aria-label="Previous"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>

      {/* Right arrow */}
      <button
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        onClick={onNext}
        aria-label="Next"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

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
              onLoad={() => setImageLoaded(true)}
              alt={photo.filename}
            />
          )}
        </div>
      </div>
    </div>
  );
}
