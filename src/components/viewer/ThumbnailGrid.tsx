import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PhotoEntry } from "@/types/album";
import type { PhotoReactions } from "@/hooks/useReactions";
import SkeletonCard from "./SkeletonCard";
import ThumbhashCanvas from "./ThumbhashCanvas";
import ReactionsBadge from "./ReactionsBadge";
import { useColumnCount } from "./grid/useColumnCount";
import { useViewport } from "./grid/useViewport";
import { useElementWidth } from "./grid/useElementWidth";
import { distributeToColumns, buildColumnLayout } from "./grid/masonry";

const GRID_GAP_PX = 6; // tailwind gap-1.5
const VIRTUAL_OVERSCAN_PX = 900;
const VIRTUALIZE_MIN_ITEMS = 400;

interface ThumbnailTileProps {
  photo: PhotoEntry;
  index: number;
  objectUrl: string | undefined;
  onPhotoClick: (index: number) => void;
  hearts: number;
  comments: number;
}

const ThumbnailTile = memo(function ThumbnailTile({
  photo,
  index,
  objectUrl,
  onPhotoClick,
  hearts,
  comments,
}: ThumbnailTileProps) {
  if (objectUrl) {
    return (
      <div className="group relative cursor-pointer h-full leading-none" onClick={() => onPhotoClick(index)}>
        <img
          src={objectUrl}
          style={{ aspectRatio: `${photo.width}/${photo.height}` }}
          className="block w-full object-cover rounded-md group-hover:brightness-110 transition-all"
          alt={photo.filename}
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end rounded-b-md
          bg-gradient-to-t from-black/60 via-black/20 to-transparent
          px-2.5 pb-2 pt-8
          opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="text-[11px] font-mono text-white/90 truncate drop-shadow-sm">
            {photo.filename}
          </span>
        </div>
        <ReactionsBadge hearts={hearts} comments={comments} />
      </div>
    );
  }

  if (photo.thumbhash) {
    return (
      <ThumbhashCanvas
        hash={photo.thumbhash}
        aspectRatio={`${photo.width}/${photo.height}`}
      />
    );
  }

  return <SkeletonCard aspectRatio={`${photo.width}/${photo.height}`} />;
});

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
  const [introVisible, setIntroVisible] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const colCount = useColumnCount();
  const { scrollY, height: viewportHeight } = useViewport();
  const gridWidth = useElementWidth(gridRef);
  const shouldVirtualize = photos.length >= VIRTUALIZE_MIN_ITEMS;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIntroVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const columns = useMemo(() => distributeToColumns(photos, colCount), [photos, colCount]);

  const fallbackWidth =
    typeof window === "undefined" ? 360 : Math.max(320, window.innerWidth - 12);
  const effectiveGridWidth = gridWidth > 0 ? gridWidth : fallbackWidth;
  const columnWidth = Math.max(1, (effectiveGridWidth - GRID_GAP_PX * (colCount - 1)) / colCount);

  const layouts = useMemo(
    () => buildColumnLayout(columns, photos, columnWidth, GRID_GAP_PX),
    [columns, photos, columnWidth],
  );

  const gridTop =
    typeof window !== "undefined" && gridRef.current
      ? gridRef.current.getBoundingClientRect().top + window.scrollY
      : 0;

  const windowStart = scrollY - gridTop - VIRTUAL_OVERSCAN_PX;
  const windowEnd = scrollY - gridTop + viewportHeight + VIRTUAL_OVERSCAN_PX;

  const visibleIndices = useMemo(() => {
    const indices: number[] = [];

    layouts.forEach((col) => {
      col.entries.forEach((entry) => {
        if (entry.top + entry.height >= windowStart && entry.top <= windowEnd) {
          indices.push(entry.index);
        }
      });
    });

    return indices;
  }, [layouts, windowStart, windowEnd]);

  useEffect(() => {
    if (shouldVirtualize) {
      visibleIndices.forEach((index) => loadThumbnail(index));
      return;
    }
    for (let i = 0; i < photos.length; i++) {
      loadThumbnail(i);
    }
  }, [shouldVirtualize, visibleIndices, photos.length, loadThumbnail]);

  return (
    <div
      ref={gridRef}
      className={`grid gap-1.5 px-1 py-3 sm:px-3 transition-opacity duration-300 ${introVisible ? "opacity-100" : "opacity-0"}`}
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {layouts.map((layout, c) => (
        <div key={c} className="flex flex-col gap-1.5">
          {layout.entries.map((entry) => {
            const isVisible =
              entry.top + entry.height >= windowStart && entry.top <= windowEnd;
            const photo = photos[entry.index];
            const objectUrl = objectUrls[photo.thumbHash];
            const hasLoadedThumb = !!objectUrl;

            if (shouldVirtualize && !isVisible && !hasLoadedThumb) {
              return (
                <div
                  key={`spacer-${entry.index}`}
                  style={{ height: `${entry.height}px` }}
                  aria-hidden
                />
              );
            }

            const hearts = reactionsByPhoto?.get(photo.hash)?.reactions.length ?? 0;
            const comments = reactionsByPhoto?.get(photo.hash)?.comments.length ?? 0;

            return (
              <div key={photo.thumbHash} className="overflow-hidden rounded-md">
                <ThumbnailTile
                  photo={photo}
                  index={entry.index}
                  objectUrl={objectUrl}
                  onPhotoClick={onPhotoClick}
                  hearts={hearts}
                  comments={comments}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
