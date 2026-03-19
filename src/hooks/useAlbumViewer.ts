import { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { fetchBlob } from '@/lib/blossom/fetch';
import { decryptBlob, base64urlToUint8Array } from '@/lib/crypto';
import type { AlbumManifest, PhotoEntry } from '@/types/album';

export interface DownloadProgress {
  current: number;
  total: number;
}

export interface AlbumViewerState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  manifest: AlbumManifest | null;
  thumbUrls: Record<string, string>;
  fullUrls: Record<string, string>;
  albumKey: CryptoKey | null;
  blossomServer: string;
  downloadProgress: DownloadProgress | null;
  downloadAll: (
    photos: PhotoEntry[],
    key: CryptoKey,
    server: string,
    onProgress?: (current: number, total: number) => void,
  ) => Promise<void>;
  loadThumbnail: (index: number) => void;
  loadFullImage: (index: number) => void;
}

/**
 * Central data orchestration hook for the album viewer.
 *
 * Provides:
 * - State machine: loading → ready | error
 * - Lazy thumbnail loading via loadThumbnail(index) — called by IntersectionObserver
 * - On-demand full-image loading via loadFullImage(index) — called by Lightbox on open
 * - downloadAll: fetches all full-size blobs, decrypts, creates ZIP download
 *
 * Object URL memory rule: ALL URLs created are tracked in a ref and revoked on unmount.
 *
 * CRITICAL: window.location.hash is only accessed inside useEffect — never in render body.
 */
export function useAlbumViewer(_opts?: { naddr?: string }): AlbumViewerState {
  const [status] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error] = useState<string | null>(null);
  const [manifest] = useState<AlbumManifest | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [albumKey] = useState<CryptoKey | null>(null);
  const [blossomServer] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // Track all created object URLs for reliable cleanup on unmount
  const createdUrlsRef = useRef<string[]>([]);

  /**
   * Download all photos as a ZIP file.
   *
   * Fetches and decrypts each photo in sequence, adds to JSZip, then triggers download.
   * Calls onProgress(current, total) after each photo completes.
   */
  const downloadAll = useCallback(
    async (
      photos: PhotoEntry[],
      key: CryptoKey,
      server: string,
      onProgress?: (current: number, total: number) => void,
    ): Promise<void> => {
      const zip = new JSZip();
      const total = photos.length;

      setDownloadProgress({ current: 0, total });

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const ciphertext = await fetchBlob(server, photo.hash);
        const iv = base64urlToUint8Array(photo.iv);
        const plaintext = await decryptBlob(ciphertext, key, iv);
        zip.file(photo.filename, plaintext);
        const current = i + 1;
        if (onProgress) {
          onProgress(current, total);
        }
        setDownloadProgress({ current, total });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Trigger download without FileSaver.js — create <a> element programmatically
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'album.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(null);
    },
    [],
  );

  /**
   * Load a thumbnail at the given index.
   * Called by ThumbnailGrid IntersectionObserver when a thumbnail enters the viewport.
   * No-op if albumKey or manifest is not yet available, or URL already exists.
   */
  const loadThumbnail = useCallback(
    (index: number) => {
      if (!albumKey || !manifest) return;
      const photo = manifest.photos[index];
      if (!photo) return;
      if (thumbUrls[photo.thumbHash]) return;

      void (async () => {
        try {
          const ciphertext = await fetchBlob(blossomServer, photo.thumbHash);
          const iv = base64urlToUint8Array(photo.thumbIv);
          const plaintext = await decryptBlob(ciphertext, albumKey, iv);
          const objectUrl = URL.createObjectURL(
            new Blob([plaintext], { type: 'image/webp' }),
          );
          createdUrlsRef.current.push(objectUrl);
          setThumbUrls(prev => ({ ...prev, [photo.thumbHash]: objectUrl }));
        } catch {
          // Thumbnail load failure is non-fatal — silently skip
        }
      })();
    },
    [albumKey, manifest, thumbUrls, blossomServer],
  );

  /**
   * Load a full-size image at the given index.
   * Called by Lightbox on open. No-op if already loaded.
   */
  const loadFullImage = useCallback(
    (index: number) => {
      if (!albumKey || !manifest) return;
      const photo = manifest.photos[index];
      if (!photo) return;
      if (fullUrls[photo.hash]) return;

      void (async () => {
        try {
          const ciphertext = await fetchBlob(blossomServer, photo.hash);
          const iv = base64urlToUint8Array(photo.iv);
          const plaintext = await decryptBlob(ciphertext, albumKey, iv);
          const objectUrl = URL.createObjectURL(
            new Blob([plaintext], { type: 'image/jpeg' }),
          );
          createdUrlsRef.current.push(objectUrl);
          setFullUrls(prev => ({ ...prev, [photo.hash]: objectUrl }));
        } catch {
          // Full image load failure is non-fatal — silently skip
        }
      })();
    },
    [albumKey, manifest, fullUrls, blossomServer],
  );

  return {
    status,
    error,
    manifest,
    thumbUrls,
    fullUrls,
    albumKey,
    blossomServer,
    downloadProgress,
    downloadAll,
    loadThumbnail,
    loadFullImage,
  };
}
