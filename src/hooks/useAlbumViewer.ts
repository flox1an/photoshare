import { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { fetchBlob } from '@/lib/blossom/fetch';
import { decryptBlob, base64urlToUint8Array, importKeyFromBase64url } from '@/lib/crypto';
import { decodeAlbumNaddr } from '@/lib/nostr/naddr';
import { loadAlbumEvent, decryptManifest } from '@/lib/nostr/viewer';
import { DEFAULT_BLOSSOM_SERVER } from '@/lib/config';
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
  downloadSingle: (
    photo: PhotoEntry,
    key: CryptoKey,
    server: string,
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
export function useAlbumViewer(opts?: { naddr?: string }): AlbumViewerState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<AlbumManifest | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [albumKey, setAlbumKey] = useState<CryptoKey | null>(null);
  const [blossomServer, setBlossomServer] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // Track all created object URLs for reliable cleanup on unmount
  const createdUrlsRef = useRef<string[]>([]);

  // Decode naddr → fetch event from relays → decrypt manifest
  useEffect(() => {
    if (!opts?.naddr) return;
    let cancelled = false;

    async function init() {
      try {
        // 1. Extract key from URL fragment (never sent to server)
        const hash = window.location.hash.slice(1); // remove leading '#'
        if (!hash) {
          throw new Error('Missing decryption key in URL fragment');
        }

        // 2. Decode naddr to get relay hints + event coordinates
        const pointer = decodeAlbumNaddr(opts!.naddr!);

        // 3. Import the AES-256-GCM key from base64url
        const key = await importKeyFromBase64url(hash);

        // 4. Fetch the kind 30078 event from relays (WebSocket connection happens here)
        const event = await loadAlbumEvent(pointer);

        if (cancelled) return;

        // 5. Decrypt the album manifest
        const albumManifest = await decryptManifest(event, key);

        if (cancelled) return;

        // 6. Set all state — transition to ready
        setAlbumKey(key);
        setManifest(albumManifest);
        setBlossomServer(DEFAULT_BLOSSOM_SERVER);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load album');
        setStatus('error');
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [opts?.naddr]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  /** Detect iOS (Safari on iPhone/iPad) where multi-file download is not supported. */
  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  /** Trigger a single-file browser download via a temporary <a> element. */
  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Download a single photo: fetch, decrypt, and trigger browser download.
   */
  const downloadSingle = useCallback(
    async (photo: PhotoEntry, key: CryptoKey, server: string): Promise<void> => {
      const ciphertext = await fetchBlob(server, photo.hash);
      const iv = base64urlToUint8Array(photo.iv);
      const plaintext = await decryptBlob(ciphertext, key, iv);
      triggerDownload(new Blob([plaintext]), photo.filename);
    },
    [triggerDownload],
  );

  /**
   * Download all photos.
   *
   * On iOS: falls back to ZIP (single file download) since multi-file is unsupported.
   * On desktop: downloads each file individually.
   * Calls onProgress(current, total) after each photo completes.
   */
  const downloadAll = useCallback(
    async (
      photos: PhotoEntry[],
      key: CryptoKey,
      server: string,
      onProgress?: (current: number, total: number) => void,
    ): Promise<void> => {
      const total = photos.length;
      setDownloadProgress({ current: 0, total });

      if (isIOS) {
        // iOS: ZIP fallback — single file download is the only reliable path
        const zip = new JSZip();
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const ciphertext = await fetchBlob(server, photo.hash);
          const iv = base64urlToUint8Array(photo.iv);
          const plaintext = await decryptBlob(ciphertext, key, iv);
          zip.file(photo.filename, plaintext);
          const current = i + 1;
          if (onProgress) onProgress(current, total);
          setDownloadProgress({ current, total });
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerDownload(zipBlob, 'album.zip');
      } else {
        // Desktop: download individual files
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const ciphertext = await fetchBlob(server, photo.hash);
          const iv = base64urlToUint8Array(photo.iv);
          const plaintext = await decryptBlob(ciphertext, key, iv);
          triggerDownload(new Blob([plaintext]), photo.filename);
          const current = i + 1;
          if (onProgress) onProgress(current, total);
          setDownloadProgress({ current, total });
        }
      }

      setDownloadProgress(null);
    },
    [isIOS, triggerDownload],
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
            new Blob([plaintext], { type: 'image/webp' }),
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
    downloadSingle,
    loadThumbnail,
    loadFullImage,
  };
}
