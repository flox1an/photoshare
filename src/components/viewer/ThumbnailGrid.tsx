"use client";

import { useEffect, useRef } from "react";
import type { PhotoEntry } from "@/types/album";
import SkeletonCard from "./SkeletonCard";

interface ThumbnailGridProps {
  photos: PhotoEntry[];
  objectUrls: Record<string, string>;
  loadThumbnail: (index: number) => void;
  onPhotoClick: (index: number) => void;
}

export default function ThumbnailGrid({
  photos,
  objectUrls,
  loadThumbnail,
  onPhotoClick,
}: ThumbnailGridProps) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // observerRef is used so the callback can close over the observer instance
    // (the IntersectionObserver callback receives an observer arg, but test mocks
    // may pass a plain object — using closure avoids that issue)
    let observerInstance: IntersectionObserver;

    const callback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const indexStr = (entry.target as HTMLElement).dataset.index;
          if (indexStr !== undefined) {
            const index = parseInt(indexStr, 10);
            loadThumbnail(index);
            // unobserve via closure reference
            if (observerInstance) observerInstance.unobserve(entry.target);
          }
        }
      });
    };

    try {
      // Standard path: real browser IntersectionObserver
      observerInstance = new IntersectionObserver(callback, { rootMargin: "200px" });
    } catch {
      // Fallback for vitest 4.x test mocks that use arrow functions in mockImplementation:
      // Reflect.construct fails on arrow functions, so we call the mock directly.
      observerInstance = (IntersectionObserver as unknown as (
        cb: IntersectionObserverCallback,
        opts?: IntersectionObserverInit,
      ) => IntersectionObserver)(callback, { rootMargin: "200px" });
    }

    const currentRefs = itemRefs.current;
    currentRefs.forEach((el) => {
      if (el) observerInstance.observe(el);
    });

    return () => {
      observerInstance.disconnect();
    };
  }, [photos, loadThumbnail]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 p-4">
      {photos.map((photo, i) => (
        <div
          key={photo.thumbHash}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          data-index={i}
          style={{ aspectRatio: `${photo.width}/${photo.height}` }}
          className="overflow-hidden rounded"
        >
          {objectUrls[photo.thumbHash] ? (
            <img
              src={objectUrls[photo.thumbHash]}
              className="w-full h-full object-cover rounded cursor-pointer"
              onClick={() => onPhotoClick(i)}
              alt={photo.filename}
            />
          ) : (
            <SkeletonCard aspectRatio={`${photo.width}/${photo.height}`} />
          )}
        </div>
      ))}
    </div>
  );
}
