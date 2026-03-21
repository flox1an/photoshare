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
 *      c. upload both blobs to ALL configured Blossom servers
 *      d. accumulate PhotoEntry (with blurhash)
 *   4. Build + encrypt manifest → upload to ALL servers
 *   5. Generate opaque share URL: /{pathToken}#{keyB64url}
 *      pathToken = base64url(hashBytes[32] + NUL-separated server URLs)
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
import { encodePathToken, hexToHashBytes } from '@/lib/shareToken';
import { useUploadStore } from '@/store/uploadStore';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import { DEFAULT_BLOSSOM_SERVER } from '@/lib/config';
import type { ProcessedPhoto } from '@/types/processing';
import type { AlbumManifest, PhotoEntry } from '@/types/album';

/** Settings consumed by startUpload */
export interface UploadSettings {
  /** Ordered list of Blossom servers — primary first. All receive uploads. */
  blossomServers: string[];
  title?: string;
  /** When true, also encrypt and upload the original file for each photo */
  keepOriginals?: boolean;
  /** Original File objects parallel to the photos array — used when keepOriginals is true */
  originalFiles?: (File | null | undefined)[];
}

/** Return type of the useUpload hook */
export interface UseUploadReturn {
  startUpload: (photos: ProcessedPhoto[], settings?: UploadSettings, photoIds?: string[]) => Promise<void>;
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
      settings: UploadSettings = { blossomServers: [DEFAULT_BLOSSOM_SERVER] },
      photoIds?: string[],
    ): Promise<void> => {
      setIsUploading(true);
      setShareLink(null);
      setPublishError(null);

      const servers = settings.blossomServers.length > 0
        ? settings.blossomServers
        : [DEFAULT_BLOSSOM_SERVER];

      try {
        const albumKey = await generateAlbumKey();
        // Use the logged-in user's signer when available; fall back to ephemeral.
        // Read via getState() (not a hook) so we capture the value at call time,
        // not at render time — avoids stale closure and doesn't cause re-renders.
        const accountSigner = useNostrAccountStore.getState().signer;
        const signer = accountSigner ?? createEphemeralSigner();

        const photoEntries: PhotoEntry[] = [];
        let hasUploadError = false;

        await Promise.all(
          photos.map((photo, index) =>
            limitRef.current(async () => {
              const photoId = photoIds?.[index] ?? `photo-${index}`;
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

                  // Upload to primary server (must succeed)
                  const fullDescriptor = await uploadBlob(
                    servers[0],
                    fullBlob.buffer as ArrayBuffer,
                    fullAuthHeader,
                    fullHash,
                  );
                  await uploadBlob(
                    servers[0],
                    thumbBlob.buffer as ArrayBuffer,
                    thumbAuthHeader,
                    thumbHash,
                  );

                  // Mirror to additional servers (best-effort)
                  for (const mirror of servers.slice(1)) {
                    try {
                      const mFullAuth = await buildBlossomUploadAuth(signer, fullHash);
                      const mThumbAuth = await buildBlossomUploadAuth(signer, thumbHash);
                      await uploadBlob(mirror, fullBlob.buffer as ArrayBuffer, mFullAuth, fullHash);
                      await uploadBlob(mirror, thumbBlob.buffer as ArrayBuffer, mThumbAuth, thumbHash);
                    } catch {
                      // Mirror failure is non-fatal
                    }
                  }

                  // Upload original file if keepOriginals is set
                  let origHash: string | undefined;
                  const origFile = settings.keepOriginals ? settings.originalFiles?.[index] : undefined;
                  if (origFile) {
                    const origBuffer = await origFile.arrayBuffer();
                    const origBlob = await encryptBlob(origBuffer, albumKey);
                    origHash = await sha256Hex(origBlob.buffer as ArrayBuffer);
                    const origAuthHeader = await buildBlossomUploadAuth(signer, origHash);
                    await uploadBlob(servers[0], origBlob.buffer as ArrayBuffer, origAuthHeader, origHash);
                    for (const mirror of servers.slice(1)) {
                      try {
                        const mOrigAuth = await buildBlossomUploadAuth(signer, origHash);
                        await uploadBlob(mirror, origBlob.buffer as ArrayBuffer, mOrigAuth, origHash);
                      } catch {
                        // Mirror failure is non-fatal
                      }
                    }
                  }

                  setUploadDone(photoId, fullDescriptor);

                  photoEntries[index] = {
                    hash: fullHash,
                    thumbHash,
                    width: photo.width,
                    height: photo.height,
                    filename: origFile?.name ?? photo.filename,
                    ...(photo.blurhash ? { blurhash: photo.blurhash } : {}),
                    ...(origHash ? { origHash } : {}),
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

        // Upload manifest to all servers (primary must succeed)
        const manifestAuthHeader = await buildBlossomUploadAuth(signer, manifestHash);
        await uploadBlob(
          servers[0],
          manifestBlob.buffer as ArrayBuffer,
          manifestAuthHeader,
          manifestHash,
        );
        for (const mirror of servers.slice(1)) {
          try {
            const mAuth = await buildBlossomUploadAuth(signer, manifestHash);
            await uploadBlob(mirror, manifestBlob.buffer as ArrayBuffer, mAuth, manifestHash);
          } catch {
            // Mirror failure is non-fatal
          }
        }

        // Build opaque share URL: /{pathToken}#{keyB64url}
        const keyB64url = await exportKeyToBase64url(albumKey);
        const pathToken = encodePathToken({
          hashBytes: hexToHashBytes(manifestHash),
          servers,
        });
        const link = `/${pathToken}#${keyB64url}`;

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
