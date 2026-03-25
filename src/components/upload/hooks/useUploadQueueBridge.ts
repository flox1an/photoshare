import { useCallback, useEffect, useRef } from "react";
import type { PhotoProcessingState } from "@/types/processing";
import type { UploadItem, UploadSettings } from "@/hooks/useUpload";
import { createDeferredQueue, type DeferredQueue } from "@/lib/async/deferredQueue";

interface UseUploadQueueBridgeArgs {
  photos: Record<string, PhotoProcessingState>;
  isUploading: boolean;
  keepOriginals: boolean;
  fileMap: Map<string, File>;
  startUpload: (source: AsyncIterable<UploadItem>, settings?: UploadSettings) => Promise<void>;
}

export function useUploadQueueBridge({
  photos,
  isUploading,
  keepOriginals,
  fileMap,
  startUpload,
}: UseUploadQueueBridgeArgs) {
  const queueRef = useRef<DeferredQueue<UploadItem> | null>(null);
  const sentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isUploading || !queueRef.current) return;

    const allPhotosArray = Object.values(photos);

    for (const p of allPhotosArray) {
      if (p.status === "done" && p.result && !sentIdsRef.current.has(p.id)) {
        sentIdsRef.current.add(p.id);
        queueRef.current.push({
          photo: p.result,
          photoId: p.id,
          originalFile: keepOriginals ? fileMap.get(p.id) ?? null : null,
        });
      }
    }

    const allTerminal = allPhotosArray.every(
      (p) => p.status === "done" || p.status === "error",
    );
    if (allTerminal) queueRef.current.close();
  }, [photos, isUploading, keepOriginals, fileMap]);

  const beginUpload = useCallback(
    (settings: UploadSettings) => {
      const queue = createDeferredQueue<UploadItem>();
      queueRef.current = queue;
      sentIdsRef.current = new Set();

      for (const p of Object.values(photos)) {
        if (p.status === "done" && p.result) {
          sentIdsRef.current.add(p.id);
          queue.push({
            photo: p.result,
            photoId: p.id,
            originalFile: keepOriginals ? fileMap.get(p.id) ?? null : null,
          });
        }
      }

      const allTerminal = Object.values(photos).every(
        (p) => p.status === "done" || p.status === "error",
      );
      if (allTerminal) queue.close();

      void startUpload(queue, settings);
    },
    [photos, keepOriginals, fileMap, startUpload],
  );

  return { beginUpload };
}
