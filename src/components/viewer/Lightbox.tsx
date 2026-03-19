"use client";

import { useEffect } from "react";
import { useDrag } from "@use-gesture/react";
import type { PhotoEntry } from "@/types/album";

interface LightboxProps {
  photos: PhotoEntry[];
  currentIndex: number;
  thumbUrls: Record<string, string>;
  fullUrls: Record<string, string>;
  albumKey: CryptoKey | null;
  blossomServer: string;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export default function Lightbox({
  photos,
  currentIndex,
  thumbUrls,
  fullUrls,
  onNext,
  onPrev,
  onClose,
}: LightboxProps) {
  const photo = photos[currentIndex];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onClose]);

  const bind = useDrag(({ swipe: [swipeX] }) => {
    if (swipeX === 1) onPrev();
    if (swipeX === -1) onNext();
  });

  return (
    <div
      data-testid="lightbox-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 text-white text-2xl font-bold hover:opacity-70"
        onClick={onClose}
        aria-label="Close"
      >
        X
      </button>

      {/* Photo counter */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Left arrow */}
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl hover:opacity-70"
        onClick={onPrev}
        aria-label="Previous"
      >
        &#8249;
      </button>

      {/* Right arrow */}
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl hover:opacity-70"
        onClick={onNext}
        aria-label="Next"
      >
        &#8250;
      </button>

      {/* Image area */}
      <div
        {...bind()}
        className="relative w-full h-full flex items-center justify-center"
        style={{ touchAction: "none" }}
      >
        {/* Blurred thumbnail background */}
        {photo && thumbUrls[photo.thumbHash] && (
          <img
            src={thumbUrls[photo.thumbHash]}
            className="absolute inset-0 w-full h-full object-contain blur-sm"
            alt=""
          />
        )}

        {/* Full-res image (crossfade when loaded) */}
        {photo && (
          <img
            src={fullUrls[photo.hash] || undefined}
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
            style={{ opacity: fullUrls[photo.hash] ? 1 : 0 }}
            alt={photo.filename}
          />
        )}
      </div>
    </div>
  );
}
