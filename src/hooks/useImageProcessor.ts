/**
 * React hook that owns the Web Worker lifecycle and batch processing logic.
 *
 * Worker is created once in useEffect — never in render body (SSR safety).
 * Worker is terminated on component unmount.
 * p-limit(4) gates concurrent processImage() calls to prevent memory exhaustion.
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
import type { ProcessorApi } from '@/types/processing';

export function useImageProcessor() {
  const workerRef = useRef<Worker | null>(null);
  const proxyRef = useRef<Comlink.Remote<ProcessorApi> | null>(null);
  // Concurrency limit: 4 in-flight worker calls max
  // 4 × ~36 MB (12 MP bitmap) = ~144 MB peak GPU memory — safe within Chrome tab limits
  const limitRef = useRef(pLimit(4));

  const { addPhotos, setProcessing, setResult, setError, photos } = useProcessingStore();

  useEffect(() => {
    // Must be inside useEffect — Worker constructor is browser-only (no SSR)
    workerRef.current = new Worker(
      new URL('@/workers/image-processor.worker.ts', import.meta.url),
      { type: 'module' },
    );
    proxyRef.current = Comlink.wrap<ProcessorApi>(workerRef.current);

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      proxyRef.current = null;
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
      if (!proxyRef.current) {
        console.error('useImageProcessor: worker not ready');
        return;
      }
      const ids = addPhotos(files);
      const proxy = proxyRef.current;
      const limit = limitRef.current;

      await Promise.all(
        files.map((file, index) => {
          const id = ids[index];
          return limit(async () => {
            setProcessing(id);
            try {
              const result = await proxy.processImage(file);
              setResult(id, result);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setError(id, message);
            }
          });
        }),
      );
    },
    [addPhotos, setProcessing, setResult, setError],
  );

  const isProcessing = Object.values(photos).some(
    (p) => p.status === 'pending' || p.status === 'processing',
  );

  return { processBatch, photos, isProcessing };
}
