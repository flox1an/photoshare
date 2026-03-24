import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PhotoEntry } from "@/types/album";
import type { PhotoReactions } from "@/hooks/useReactions";
import SkeletonCard from "./SkeletonCard";
import ThumbhashCanvas from "./ThumbhashCanvas";
import ReactionsBadge from "./ReactionsBadge";

const GRID_GAP_PX = 6; // tailwind gap-1.5
const VIRTUAL_OVERSCAN_PX = 900;
const DEFERRED_FADE_THRESHOLD_MS = 200;
const SCROLL_QUANTIZE_PX = 96;
const VIRTUALIZE_MIN_ITEMS = 180;

interface LayoutEntry {
  index: number;
  top: number;
  height: number;
}

interface ColumnLayout {
  entries: LayoutEntry[];
  totalHeight: number;
}

function useColumnCount() {
  // Default: 2 columns. Tablet/desktop: 3/4 columns.
  // Mobile landscape gets 3 columns when width is sufficient.
  const getCount = () => {
    if (typeof window === "undefined") return 2;
    const w = window.innerWidth;
    if (w >= 1024) return 4;
    if (w >= 640) return 3;
    const isLandscape = window.matchMedia?.("(orientation: landscape)").matches ?? false;
    if (isLandscape && w >= 560) return 3;
    return 2;
  };

  const [count, setCount] = useState(getCount);

  useEffect(() => {
    const update = () => setCount(getCount());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return count;
}

function useViewport() {
  const [viewport, setViewport] = useState(() => ({
    scrollY: typeof window === "undefined" ? 0 : window.scrollY,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  }));

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const quantizedY = Math.floor(window.scrollY / SCROLL_QUANTIZE_PX) * SCROLL_QUANTIZE_PX;
        const nextHeight = window.innerHeight;
        setViewport((prev) => {
          if (prev.scrollY === quantizedY && prev.height === nextHeight) return prev;
          return { scrollY: quantizedY, height: nextHeight };
        });
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return viewport;
}

function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;

    const measure = () => {
      const w = ref.current?.clientWidth ?? 0;
      if (w > 0) setWidth(w);
    };

    measure();

    const Observer = window.ResizeObserver;
    let observer: ResizeObserver | null = null;
    if (Observer) {
      observer = new Observer(measure);
      observer.observe(ref.current);
    }
    window.addEventListener("resize", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return width;
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

function buildColumnLayout(
  columns: number[][],
  photos: PhotoEntry[],
  columnWidth: number,
): ColumnLayout[] {
  return columns.map((col) => {
    const entries: LayoutEntry[] = [];
    let top = 0;

    col.forEach((index, idx) => {
      const p = photos[index];
      const height = Math.max(1, (columnWidth * p.height) / p.width);
      entries.push({ index, top, height });
      top += height;
      if (idx < col.length - 1) top += GRID_GAP_PX;
    });

    return { entries, totalHeight: top };
  });
}

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
  const placeholderStartedAtRef = useRef<number | null>(objectUrl ? null : Date.now());
  const [shouldFadeImageIn, setShouldFadeImageIn] = useState(false);
  // If a tile mounts with an existing object URL, keep it visible immediately.
  // This avoids a one-frame flash when virtualized tiles remount.
  const [imageVisible, setImageVisible] = useState(!!objectUrl);

  useEffect(() => {
    if (!objectUrl) {
      if (placeholderStartedAtRef.current === null) {
        placeholderStartedAtRef.current = Date.now();
      }
      setImageVisible(false);
      setShouldFadeImageIn(false);
      return;
    }

    const started = placeholderStartedAtRef.current;
    if (started === null) {
      setShouldFadeImageIn(false);
      setImageVisible(true);
      return;
    }

    const deferred = Date.now() - started >= DEFERRED_FADE_THRESHOLD_MS;
    setShouldFadeImageIn(deferred);
    setImageVisible(!deferred || !photo.thumbhash);
    placeholderStartedAtRef.current = null;
  }, [objectUrl, photo.thumbhash]);

  if (objectUrl) {
    return (
      <div className="group relative cursor-pointer h-full" onClick={() => onPhotoClick(index)}>
        {photo.thumbhash && (
          <ThumbhashCanvas
            hash={photo.thumbhash}
            aspectRatio={`${photo.width}/${photo.height}`}
            className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${imageVisible ? "opacity-0" : "opacity-100"}`}
          />
        )}
        <img
          src={objectUrl}
          style={{ aspectRatio: `${photo.width}/${photo.height}` }}
          className={`w-full object-cover rounded-md group-hover:brightness-110 ${shouldFadeImageIn ? "transition-opacity duration-300" : ""} ${imageVisible ? "opacity-100" : "opacity-0"}`}
          alt={photo.filename}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageVisible(true)}
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
  const gridRef = useRef<HTMLDivElement>(null);
  const colCount = useColumnCount();
  const { scrollY, height: viewportHeight } = useViewport();
  const gridWidth = useElementWidth(gridRef);
  const shouldVirtualize = photos.length >= VIRTUALIZE_MIN_ITEMS;

  const columns = useMemo(() => distributeToColumns(photos, colCount), [photos, colCount]);

  const fallbackWidth =
    typeof window === "undefined" ? 360 : Math.max(320, window.innerWidth - 12);
  const effectiveGridWidth = gridWidth > 0 ? gridWidth : fallbackWidth;
  const columnWidth = Math.max(1, (effectiveGridWidth - GRID_GAP_PX * (colCount - 1)) / colCount);

  const layouts = useMemo(
    () => buildColumnLayout(columns, photos, columnWidth),
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
    visibleIndices.forEach((index) => loadThumbnail(index));
  }, [visibleIndices, loadThumbnail]);

  return (
    <div
      ref={gridRef}
      className="grid gap-1.5 px-1 py-3 sm:px-3"
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
