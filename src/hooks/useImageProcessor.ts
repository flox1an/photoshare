/**
 * React hook that owns the Web Worker lifecycle and batch processing logic.
 *
 * A worker pool is created in useEffect — never in render body (SSR safety).
 * All workers are terminated on component unmount.
 * Pool size is bounded (1..4) based on hardwareConcurrency to avoid memory exhaustion.
 * Each worker processes one image at a time; files are distributed round-robin.
 *
 * Usage:
 *   const { processBatch, photos, isProcessing } = useImageProcessor();
 *   // In drop handler:
 *   await processBatch(files);  // non-blocking — updates store progressively
 */
'use client';

import * as Comlink from 'comlink';
import pLimit from 'p-limit';
import { useEffect, useRef, useCallback } from 'react';
import { useProcessingStore } from '@/store/processingStore';
import type { ProcessedPhoto, ProcessorApi } from '@/types/processing';

interface WorkerSlot {
  worker: Worker;
  proxy: Comlink.Remote<ProcessorApi>;
  run: (file: File) => Promise<ProcessedPhoto>;
}

export function useImageProcessor() {
  const poolRef = useRef<WorkerSlot[]>([]);
  const nextWorkerIndexRef = useRef(0);
  // Maps photo store ID → original File object (lazy — bytes not loaded until upload)
  const fileMapRef = useRef<Map<string, File>>(new Map());

  const { addPhotos, setProcessing, setResult, setError, photos } = useProcessingStore();

  useEffect(() => {
    const hardware = Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : 2;
    // Keep at least one core for the main thread; clamp to prevent OOM on large batches.
    const workerCount = Math.max(1, Math.min(4, hardware - 1));

    poolRef.current = Array.from({ length: workerCount }, () => {
      const worker = new Worker(
        new URL('@/workers/image-processor.worker.ts', import.meta.url),
        { type: 'module' },
      );
      const proxy = Comlink.wrap<ProcessorApi>(worker);
      const limiter = pLimit(1);
      return {
        worker,
        proxy,
        run: (file: File) => limiter(() => proxy.processImage(file)),
      };
    });
    nextWorkerIndexRef.current = 0;

    return () => {
      for (const slot of poolRef.current) {
        slot.worker.terminate();
      }
      poolRef.current = [];
    };
  }, []);

  /**
   * Process a batch of files.
   * Adds all files to the store as 'pending', then processes up to 4 concurrently.
   * Each file transitions: pending → processing → done | error
   * Accumulates — does not reset existing photos from previous drops.
   */
  const processBatch = useCallback(
    async (files: File[]) => {
      if (poolRef.current.length === 0) {
        console.error('useImageProcessor: worker not ready');
        return;
      }
      const ids = addPhotos(files);
      // Track original File objects for optional keepOriginals upload
      files.forEach((file, i) => fileMapRef.current.set(ids[i], file));
      const pool = poolRef.current;

      await Promise.all(
        files.map((file, index) => {
          const id = ids[index];
          const slot = pool[nextWorkerIndexRef.current % pool.length];
          nextWorkerIndexRef.current += 1;

          setProcessing(id);
          return slot.run(file).then((result) => {
            setResult(id, result);
          }).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            setError(id, message);
          });
        }),
      );
    },
    [addPhotos, setProcessing, setResult, setError],
  );

  const isProcessing = Object.values(photos).some(
    (p) => p.status === 'pending' || p.status === 'processing',
  );

  return { processBatch, photos, isProcessing, fileMap: fileMapRef.current };
}
