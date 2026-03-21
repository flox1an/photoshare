'use client';

/**
 * useUpload — orchestration hook for encrypt→upload→share pipeline (Blossom-only v2).
 *
 * Pipeline:
 *   1. Generate album key (AES-256-GCM)
 *   2. Create ephemeral signer (BUD-11 auth)
 *   3. For each photo (p-limit(3) concurrency):
 *      a. encrypt full + thumb (IV-prepend)
 *      b. SHA-256 each blob
 *      c. upload both blobs to Blossom
 *      d. accumulate PhotoEntry
 *   4. Build + encrypt manifest → upload to Blossom
 *   5. Generate share URL: /{manifestHash}?xs={domain}#{key}
 */

import { useCallback, useRef, useState } from 'react';
import pLimit from 'p-limit';
import {
  generateAlbumKey,
  encryptBlob,
  exportKeyToBase64url,
} from '@/lib/crypto';
import { createEphemeralSigner } from '@/lib/blossom/signer';
import { sha256Hex, buildBlossomUploadAuth, uploadBlob } from '@/lib/blossom/upload';
import { encryptManifest } from '@/lib/blossom/manifest';
import { useUploadStore } from '@/store/uploadStore';
import { DEFAULT_BLOSSOM_SERVER } from '@/lib/config';
import type { ProcessedPhoto } from '@/types/processing';
import type { AlbumManifest, PhotoEntry } from '@/types/album';

/** Settings consumed by startUpload */
export interface UploadSettings {
  blossomServer: string;
  title?: string;
}

/** Return type of the useUpload hook */
export interface UseUploadReturn {
  startUpload: (photos: ProcessedPhoto[], settings?: UploadSettings) => Promise<void>;
  shareLink: string | null;
  isUploading: boolean;
  publishError: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useUpload(): UseUploadReturn {
  const limitRef = useRef(pLimit(3));

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { setEncrypting, setUploading, setUploadDone, setUploadError } = useUploadStore();

  const startUpload = useCallback(
    async (
      photos: ProcessedPhoto[],
      settings: UploadSettings = { blossomServer: DEFAULT_BLOSSOM_SERVER },
    ): Promise<void> => {
      setIsUploading(true);
      setShareLink(null);
      setPublishError(null);

      try {
        const albumKey = await generateAlbumKey();
        const signer = createEphemeralSigner();

        const photoEntries: PhotoEntry[] = [];
        let hasUploadError = false;

        await Promise.all(
          photos.map((photo, index) =>
            limitRef.current(async () => {
              const photoId = `photo-${index}`;
              let lastError: unknown;

              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  setEncrypting(photoId);

                  // Encrypt with IV-prepend pattern
                  const fullBlob = await encryptBlob(photo.full, albumKey);
                  const thumbBlob = await encryptBlob(photo.thumb, albumKey);

                  // Hash the complete blob (IV + ciphertext)
                  const fullHash = await sha256Hex(fullBlob.buffer as ArrayBuffer);
                  const thumbHash = await sha256Hex(thumbBlob.buffer as ArrayBuffer);

                  setUploading(photoId);

                  const fullAuthHeader = await buildBlossomUploadAuth(signer, fullHash);
                  const thumbAuthHeader = await buildBlossomUploadAuth(signer, thumbHash);

                  const fullDescriptor = await uploadBlob(
                    settings.blossomServer,
                    fullBlob.buffer as ArrayBuffer,
                    fullAuthHeader,
                    fullHash,
                  );
                  await uploadBlob(
                    settings.blossomServer,
                    thumbBlob.buffer as ArrayBuffer,
                    thumbAuthHeader,
                    thumbHash,
                  );

                  setUploadDone(photoId, fullDescriptor);

                  photoEntries[index] = {
                    hash: fullHash,
                    thumbHash,
                    width: photo.width,
                    height: photo.height,
                    filename: photo.filename,
                  };

                  return;
                } catch (err) {
                  lastError = err;
                  if (attempt < 2) {
                    await sleep(100 * Math.pow(2, attempt));
                  }
                }
              }

              const message = lastError instanceof Error ? lastError.message : String(lastError);
              setUploadError(photoId, message);
              hasUploadError = true;
            }),
          ),
        );

        if (hasUploadError) {
          setPublishError('One or more photos failed to upload after 3 retries');
          return;
        }

        // Build and encrypt manifest
        const manifest: AlbumManifest = {
          v: 1,
          ...(settings.title ? { title: settings.title } : {}),
          createdAt: new Date().toISOString(),
          photos: photoEntries,
        };

        const manifestBlob = await encryptManifest(manifest, albumKey);
        const manifestHash = await sha256Hex(manifestBlob.buffer as ArrayBuffer);
        const manifestAuthHeader = await buildBlossomUploadAuth(signer, manifestHash);
        await uploadBlob(
          settings.blossomServer,
          manifestBlob.buffer as ArrayBuffer,
          manifestAuthHeader,
          manifestHash,
        );

        // Build share URL
        const keyB64url = await exportKeyToBase64url(albumKey);
        const serverDomain = settings.blossomServer.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const link = `/${manifestHash}?xs=${serverDomain}#${keyB64url}`;

        // Auto-copy to clipboard
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(
              (typeof window !== 'undefined' ? window.location.origin : '') + link,
            );
          }
        } catch {
          // Clipboard permission denied — non-fatal
        }

        setShareLink(link);
      } finally {
        setIsUploading(false);
      }
    },
    [setEncrypting, setUploading, setUploadDone, setUploadError],
  );

  return { startUpload, shareLink, isUploading, publishError };
}
