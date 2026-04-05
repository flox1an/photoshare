import type { PhotoEntry } from "@/types/album";
import type { MutableRefObject, RefObject } from "react";

interface Point {
  x: number;
  y: number;
}

interface LightboxImageStripProps {
  containerRef: RefObject<HTMLDivElement | null>;
  bind: () => Record<string, unknown>;
  handleDoubleTap: () => void;
  prevPhoto: PhotoEntry | null;
  photo: PhotoEntry;
  nextPhoto: PhotoEntry | null;
  thumbUrls: Record<string, string>;
  fullUrls: Record<string, string>;
  scale: number;
  translate: Point;
  slideX: number;
  slideTransition: string | undefined;
  hidePlaceholder: boolean;
  imageLoaded: boolean;
  setImageLoaded: (next: boolean) => void;
  failedHashes?: Record<string, true>;
  onImageLoaded?: () => void;
  loadedHashesRef: MutableRefObject<Set<string>>;
  naturalSizeRef: MutableRefObject<{ w: number; h: number } | null>;
}

export function LightboxImageStrip({
  containerRef,
  bind,
  handleDoubleTap,
  prevPhoto,
  photo,
  nextPhoto,
  thumbUrls,
  fullUrls,
  scale,
  translate,
  slideX,
  slideTransition,
  hidePlaceholder,
  imageLoaded,
  setImageLoaded,
  failedHashes,
  onImageLoaded,
  loadedHashesRef,
  naturalSizeRef,
}: LightboxImageStripProps) {
  return (
    <div
      ref={containerRef}
      {...bind()}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: "none" }}
      onClick={handleDoubleTap}
    >
      <div
        className="absolute flex h-full"
        style={{
          width: "300%",
          left: "-100%",
          transform: `translateX(${slideX}px)`,
          transition: slideTransition,
        }}
      >
        <div className="w-1/3 h-full flex items-center justify-center">
          {prevPhoto && (fullUrls[prevPhoto.hash] || thumbUrls[prevPhoto.thumbHash]) && (
            <img
              src={fullUrls[prevPhoto.hash] || thumbUrls[prevPhoto.thumbHash]}
              className="w-full h-full object-contain"
              alt={prevPhoto.filename}
              draggable={false}
              onLoad={() => {
                if (fullUrls[prevPhoto.hash]) loadedHashesRef.current.add(prevPhoto.hash);
              }}
            />
          )}
        </div>

        <div className="relative w-1/3 h-full flex items-center justify-center">
          <div
            className="relative w-full h-full flex items-center justify-center"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transition: scale === 1 ? "transform 0.2s ease-out" : undefined,
            }}
          >
            {thumbUrls[photo.thumbHash] && (
              <img
                src={thumbUrls[photo.thumbHash]}
                className="absolute inset-0 w-full h-full object-contain blur-sm transition-opacity duration-300"
                style={{ opacity: hidePlaceholder ? 0 : 1 }}
                alt=""
                draggable={false}
              />
            )}

            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {failedHashes?.[photo.hash] && !fullUrls[photo.hash] ? (
                  <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-white">
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                    <span className="text-sm font-medium">Image not available</span>
                  </div>
                ) : (
                  <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                )}
              </div>
            )}

            <img
              src={fullUrls[photo.hash] || undefined}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={(e) => {
                loadedHashesRef.current.add(photo.hash);
                setImageLoaded(true);
                naturalSizeRef.current = {
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                };
                onImageLoaded?.();
              }}
              alt={photo.filename}
              draggable={false}
            />
          </div>
        </div>

        <div className="w-1/3 h-full flex items-center justify-center">
          {nextPhoto && (fullUrls[nextPhoto.hash] || thumbUrls[nextPhoto.thumbHash]) && (
            <img
              src={fullUrls[nextPhoto.hash] || thumbUrls[nextPhoto.thumbHash]}
              className="w-full h-full object-contain"
              alt={nextPhoto.filename}
              draggable={false}
              onLoad={() => {
                if (fullUrls[nextPhoto.hash]) loadedHashesRef.current.add(nextPhoto.hash);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
