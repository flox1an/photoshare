'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { decryptBlob, importKeyFromBase64url } from '@/lib/crypto';
import { resolveAndFetch } from '@/lib/blossom/resolve';
import { isLegacyToken, decodePathToken, hashBytesToHex } from '@/lib/shareToken';
import { decryptAndValidateManifest } from '@/lib/blossom/manifest';
import type { AlbumManifest, PhotoEntry } from '@/types/album';

export interface DownloadProgress {
  current: number;
  total: number;
}

export type DownloadMode = 'zip' | 'files';

export interface AlbumViewerState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  manifest: AlbumManifest | null;
  thumbUrls: Record<string, string>;
  fullUrls: Record<string, string>;
  albumKey: CryptoKey | null;
  resolvedServer: string | null;
  downloadProgress: DownloadProgress | null;
  isIOS: boolean;
  downloadAll: (
    photos: PhotoEntry[],
    key: CryptoKey,
    server: string,
    mode: DownloadMode,
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

export function useAlbumViewer(opts?: { hash?: string }): AlbumViewerState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<AlbumManifest | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const [albumKey, setAlbumKey] = useState<CryptoKey | null>(null);
  const [resolvedServer, setResolvedServer] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  const createdUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!opts?.hash) return;
    let cancelled = false;

    async function init() {
      try {
        // 1. Extract key from fragment
        const keyB64url = window.location.hash.slice(1);
        if (!keyB64url) {
          throw new Error('Missing decryption key in URL fragment');
        }

        // 2. Decode path token → manifest hash + server hints
        //    Supports both new opaque tokens and legacy 64-char hex hashes
        let manifestHash: string;
        let serverHints: string[];

        if (isLegacyToken(opts!.hash!)) {
          // Legacy URL: /{hex64}?xs={domain}#{key}
          manifestHash = opts!.hash!;
          const params = new URLSearchParams(window.location.search);
          const xsHint = params.get('xs');
          serverHints = xsHint ? [xsHint] : [];
        } else {
          // New opaque URL: /{pathToken}#{key}
          const { hashBytes, servers } = decodePathToken(opts!.hash!);
          manifestHash = hashBytesToHex(hashBytes);
          serverHints = servers;
        }

        // 3. Import AES key
        const key = await importKeyFromBase64url(keyB64url);

        // 4. Fetch manifest from Blossom
        const { data, server } = await resolveAndFetch(manifestHash, serverHints);

        if (cancelled) return;

        // 5. Decrypt and validate manifest
        const albumManifest = await decryptAndValidateManifest(
          new Uint8Array(data),
          key,
        );

        if (cancelled) return;

        setAlbumKey(key);
        setManifest(albumManifest);
        setResolvedServer(server);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load album');
        setStatus('error');
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [opts?.hash]);

  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

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

  /** Fetch and decrypt a blob, trying resolvedServer first then fallback */
  const fetchAndDecrypt = useCallback(
    async (hash: string, key: CryptoKey): Promise<ArrayBuffer> => {
      const hints = resolvedServer ? [resolvedServer] : [];
      const { data } = await resolveAndFetch(hash, hints);
      return decryptBlob(new Uint8Array(data), key);
    },
    [resolvedServer],
  );

  const downloadSingle = useCallback(
    async (photo: PhotoEntry, key: CryptoKey, _server: string): Promise<void> => {
      const hashToFetch = photo.origHash ?? photo.hash;
      const filename = photo.filename;
      const plaintext = await fetchAndDecrypt(hashToFetch, key);
      triggerDownload(new Blob([plaintext]), filename);
    },
    [fetchAndDecrypt, triggerDownload],
  );

  const downloadAll = useCallback(
    async (
      photos: PhotoEntry[],
      key: CryptoKey,
      _server: string,
      mode: DownloadMode,
      onProgress?: (current: number, total: number) => void,
    ): Promise<void> => {
      const total = photos.length;
      setDownloadProgress({ current: 0, total });

      if (mode === 'zip' || isIOS) {
        const zip = new JSZip();
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const hashToFetch = photo.origHash ?? photo.hash;
          const filename = photo.filename;
          const plaintext = await fetchAndDecrypt(hashToFetch, key);
          zip.file(filename, plaintext);
          const current = i + 1;
          if (onProgress) onProgress(current, total);
          setDownloadProgress({ current, total });
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerDownload(zipBlob, 'album.zip');
      } else {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const hashToFetch = photo.origHash ?? photo.hash;
          const filename = photo.filename;
          const plaintext = await fetchAndDecrypt(hashToFetch, key);
          triggerDownload(new Blob([plaintext]), filename);
          const current = i + 1;
          if (onProgress) onProgress(current, total);
          setDownloadProgress({ current, total });
        }
      }

      setDownloadProgress(null);
    },
    [isIOS, fetchAndDecrypt, triggerDownload],
  );

  const loadThumbnail = useCallback(
    (index: number) => {
      if (!albumKey || !manifest) return;
      const photo = manifest.photos[index];
      if (!photo) return;
      if (thumbUrls[photo.thumbHash]) return;

      void (async () => {
        try {
          const plaintext = await fetchAndDecrypt(photo.thumbHash, albumKey);
          const objectUrl = URL.createObjectURL(
            new Blob([plaintext], { type: 'image/webp' }),
          );
          createdUrlsRef.current.push(objectUrl);
          setThumbUrls(prev => ({ ...prev, [photo.thumbHash]: objectUrl }));
        } catch {
          // Thumbnail load failure is non-fatal
        }
      })();
    },
    [albumKey, manifest, thumbUrls, fetchAndDecrypt],
  );

  const loadFullImage = useCallback(
    (index: number) => {
      if (!albumKey || !manifest) return;
      const photo = manifest.photos[index];
      if (!photo) return;
      if (fullUrls[photo.hash]) return;

      void (async () => {
        try {
          const plaintext = await fetchAndDecrypt(photo.hash, albumKey);
          const objectUrl = URL.createObjectURL(
            new Blob([plaintext], { type: 'image/webp' }),
          );
          createdUrlsRef.current.push(objectUrl);
          setFullUrls(prev => ({ ...prev, [photo.hash]: objectUrl }));
        } catch {
          // Full image load failure is non-fatal
        }
      })();
    },
    [albumKey, manifest, fullUrls, fetchAndDecrypt],
  );

  return {
    status,
    error,
    manifest,
    thumbUrls,
    fullUrls,
    albumKey,
    resolvedServer,
    downloadProgress,
    isIOS,
    downloadAll,
    downloadSingle,
    loadThumbnail,
    loadFullImage,
  };
}
