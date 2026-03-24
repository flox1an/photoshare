'use client';

/**
 * useUpload — orchestration hook for encrypt→upload→share pipeline (Blossom-only v2).
 *
 * Pipeline:
 *   1. Generate album nsec (secp256k1 private key, 32 bytes)
 *   2. Derive AES-256-GCM key from nsec via HKDF
 *   3. Create ephemeral signer (BUD-11 auth)
 *   4. For each UploadItem from the async iterable (p-limit(3) concurrency):
 *      a. encrypt full + thumb (IV-prepend)
 *      b. SHA-256 each blob
 *      c. upload both blobs to ALL configured Blossom servers
 *      d. accumulate PhotoEntry (with thumbhash)
 *   5. Build + encrypt manifest (v:2) → upload to ALL servers
 *   6. Generate opaque share URL: /{pathToken}#{nsecB64url}
 *      pathToken = base64url(hashBytes[32] + NUL-separated server URLs)
 *
 * Photos are fed via an AsyncIterable so uploads begin as soon as the first
 * photo finishes processing — the caller doesn't need to wait for all.
 */

import { useCallback, useRef, useState } from 'react';
import pLimit from 'p-limit';
import {
  generateAlbumNsec,
  deriveAlbumAESKey,
  encryptBlob,
  uint8ArrayToBase64url,
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

/** A single photo ready to be encrypted and uploaded */
export interface UploadItem {
  photo: ProcessedPhoto;
  photoId: string;
  /** Original file to also encrypt+upload when keepOriginals is enabled */
  originalFile?: File | null;
}

/** Settings consumed by startUpload */
export interface UploadSettings {
  /** Ordered list of Blossom servers — primary first. All receive uploads. */
  blossomServers: string[];
  title?: string;
  /** X-Expiration offset in seconds (only sent when server supports it). Default: 1 week. */
  expirationSeconds?: number;
  /** When set, reactions and comments are enabled in the manifest with the given relay list */
  reactions?: { relays: string[] };
}

/** Return type of the useUpload hook */
export interface UseUploadReturn {
  startUpload: (source: AsyncIterable<UploadItem>, settings?: UploadSettings) => Promise<void>;
  shareLink: string | null;
  isUploading: boolean;
  publishError: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

export function useUpload(): UseUploadReturn {
  const limitRef = useRef(pLimit(3));

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { addPhoto, setEncrypting, setUploading, setUploadDone, setUploadError } = useUploadStore();

  const startUpload = useCallback(
    async (
      source: AsyncIterable<UploadItem>,
      settings: UploadSettings = { blossomServers: [DEFAULT_BLOSSOM_SERVER] },
    ): Promise<void> => {
      setIsUploading(true);
      setShareLink(null);
      setPublishError(null);

      const servers = settings.blossomServers.length > 0
        ? settings.blossomServers
        : [DEFAULT_BLOSSOM_SERVER];

      try {
        const nsecBytes = generateAlbumNsec();
        const albumKey = await deriveAlbumAESKey(nsecBytes);
        const accountSigner = useNostrAccountStore.getState().signer;
        const signer = accountSigner ?? createEphemeralSigner();

        // photoEntries slots are reserved in arrival order as the for-await loop runs.
        // Each p-limited task fills its reserved slot asynchronously.
        const photoEntries: PhotoEntry[] = [];
        const pendingTasks: Promise<void>[] = [];
        let hasUploadError = false;
        const expSec = settings.expirationSeconds ?? DEFAULT_EXPIRATION_SECONDS;

        for await (const { photo, photoId, originalFile } of source) {
          // Register in uploadStore so ProgressList can show upload status
          addPhoto(photoId, photo.filename);

          // Reserve a slot immediately (before spawning the concurrent task)
          // so manifest order matches arrival order from the iterable.
          const entryIndex = photoEntries.length;
          photoEntries.push(null as unknown as PhotoEntry);

          const task = limitRef.current(async () => {
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
                  undefined,
                  expSec,
                );
                await uploadBlob(
                  servers[0],
                  thumbBlob.buffer as ArrayBuffer,
                  thumbAuthHeader,
                  thumbHash,
                  undefined,
                  expSec,
                );

                // Mirror to additional servers (best-effort)
                for (const mirror of servers.slice(1)) {
                  try {
                    const mFullAuth = await buildBlossomUploadAuth(signer, fullHash);
                    const mThumbAuth = await buildBlossomUploadAuth(signer, thumbHash);
                    await uploadBlob(mirror, fullBlob.buffer as ArrayBuffer, mFullAuth, fullHash, undefined, expSec);
                    await uploadBlob(mirror, thumbBlob.buffer as ArrayBuffer, mThumbAuth, thumbHash, undefined, expSec);
                  } catch {
                    // Mirror failure is non-fatal
                  }
                }

                // Upload original file if provided
                let origHash: string | undefined;
                if (originalFile) {
                  const origBuffer = await originalFile.arrayBuffer();
                  const origBlob = await encryptBlob(origBuffer, albumKey);
                  origHash = await sha256Hex(origBlob.buffer as ArrayBuffer);
                  const origAuthHeader = await buildBlossomUploadAuth(signer, origHash);
                  await uploadBlob(servers[0], origBlob.buffer as ArrayBuffer, origAuthHeader, origHash, undefined, expSec);
                  for (const mirror of servers.slice(1)) {
                    try {
                      const mOrigAuth = await buildBlossomUploadAuth(signer, origHash);
                      await uploadBlob(mirror, origBlob.buffer as ArrayBuffer, mOrigAuth, origHash, undefined, expSec);
                    } catch {
                      // Mirror failure is non-fatal
                    }
                  }
                }

                setUploadDone(photoId, fullDescriptor);

                photoEntries[entryIndex] = {
                  hash: fullHash,
                  thumbHash,
                  width: photo.width,
                  height: photo.height,
                  filename: originalFile?.name ?? photo.filename,
                  ...(photo.thumbhash ? { thumbhash: photo.thumbhash } : {}),
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
          });

          pendingTasks.push(task);
        }

        // Wait for all concurrent upload tasks to finish
        await Promise.all(pendingTasks);

        if (hasUploadError) {
          setPublishError('One or more photos failed to upload after 3 retries');
          return;
        }

        // Build and encrypt manifest
        const expiresAt = expSec ? new Date(Date.now() + expSec * 1000).toISOString() : undefined;
        const manifest: AlbumManifest = {
          v: 2,
          ...(settings.title ? { title: settings.title } : {}),
          createdAt: new Date().toISOString(),
          ...(expiresAt ? { expiresAt } : {}),
          photos: photoEntries.filter(Boolean),
          ...(settings.reactions ? { reactions: { relays: settings.reactions.relays } } : {}),
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
          undefined,
          expSec,
        );
        for (const mirror of servers.slice(1)) {
          try {
            const mAuth = await buildBlossomUploadAuth(signer, manifestHash);
            await uploadBlob(mirror, manifestBlob.buffer as ArrayBuffer, mAuth, manifestHash, undefined, expSec);
          } catch {
            // Mirror failure is non-fatal
          }
        }

        // Build opaque share URL: /{pathToken}#{nsecB64url}
        const nsecB64url = uint8ArrayToBase64url(nsecBytes);
        const pathToken = encodePathToken({
          hashBytes: hexToHashBytes(manifestHash),
          servers,
        });
        const link = `/${pathToken}#${nsecB64url}`;

        setShareLink(link);
      } finally {
        setIsUploading(false);
      }
    },
    [addPhoto, setEncrypting, setUploading, setUploadDone, setUploadError],
  );

  return { startUpload, shareLink, isUploading, publishError };
}
