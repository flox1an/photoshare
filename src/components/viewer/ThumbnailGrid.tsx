
import { useEffect, useMemo, useRef } from "react";
import type { PhotoEntry } from "@/types/album";
import type { PhotoReactions } from "@/hooks/useReactions";
import SkeletonCard from "./SkeletonCard";
import ThumbhashCanvas from "./ThumbhashCanvas";
import ReactionsBadge from "./ReactionsBadge";

function useColumnCount() {
  // Match the breakpoints: default 2, sm(640) 3, lg(1024) 4
  const getCount = () => {
    if (typeof window === "undefined") return 2;
    if (window.innerWidth >= 1024) return 4;
    if (window.innerWidth >= 640) return 3;
    return 2;
  };
  const ref = useRef(getCount());
  useEffect(() => {
    const handler = () => { ref.current = getCount(); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return ref;
}

/** Distribute photos into columns by always picking the shortest column (preserves visual order). */
function distributeToColumns(photos: PhotoEntry[], colCount: number): number[][] {
  const columns: number[][] = Array.from({ length: colCount }, () => []);
  const heights = new Float64Array(colCount);
  for (let i = 0; i < photos.length; i++) {
    let shortest = 0;
    for (let c = 1; c < colCount; c++) {
      if (heights[c] < heights[shortest]) shortest = c;
    }
    columns[shortest].push(i);
    heights[shortest] += photos[i].height / photos[i].width;
  }
  return columns;
}

interface ThumbnailGridProps {
  photos: PhotoEntry[];
  objectUrls: Record<string, string>;
  loadThumbnail: (index: number) => void;
  onPhotoClick: (index: number) => void;
  /** Reactions/comments data keyed by photo.hash — only present when reactions enabled */
  reactionsByPhoto?: Map<string, PhotoReactions>;
}

export default function ThumbnailGrid({
  photos,
  objectUrls,
  loadThumbnail,
  onPhotoClick,
  reactionsByPhoto,
}: ThumbnailGridProps) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let observerInstance: IntersectionObserver;

    const callback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const indexStr = (entry.target as HTMLElement).dataset.index;
          if (indexStr !== undefined) {
            const index = parseInt(indexStr, 10);
            loadThumbnail(index);
            if (observerInstance) observerInstance.unobserve(entry.target);
          }
        }
      });
    };

    try {
      observerInstance = new IntersectionObserver(callback, { rootMargin: "200px" });
    } catch {
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

  const colCountRef = useColumnCount();
  const columns = useMemo(
    () => distributeToColumns(photos, colCountRef.current),
    [photos, colCountRef],
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 p-3">
      {columns.map((col, c) => (
        <div key={c} className="flex flex-col gap-1.5">
          {col.map((i) => {
            const photo = photos[i];
            return (
              <div
                key={photo.thumbHash}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                data-index={i}
                className="overflow-hidden rounded-md"
              >
                {objectUrls[photo.thumbHash] ? (
                  <div
                    className="group relative cursor-pointer"
                    onClick={() => onPhotoClick(i)}
                  >
                    <img
                      src={objectUrls[photo.thumbHash]}
                      style={{ aspectRatio: `${photo.width}/${photo.height}` }}
                      className="w-full object-cover rounded-md group-hover:brightness-110 transition-all"
                      alt={photo.filename}
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-end rounded-b-md
                      bg-gradient-to-t from-black/60 via-black/20 to-transparent
                      px-2.5 pb-2 pt-8
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-[11px] font-mono text-white/90 truncate drop-shadow-sm">
                        {photo.filename}
                      </span>
                    </div>
                    {reactionsByPhoto && (
                      <ReactionsBadge
                        hearts={reactionsByPhoto.get(photo.hash)?.reactions.length ?? 0}
                        comments={reactionsByPhoto.get(photo.hash)?.comments.length ?? 0}
                      />
                    )}
                  </div>
                ) : photo.thumbhash ? (
                  <ThumbhashCanvas
                    hash={photo.thumbhash}
                    aspectRatio={`${photo.width}/${photo.height}`}
                  />
                ) : (
                  <SkeletonCard aspectRatio={`${photo.width}/${photo.height}`} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
