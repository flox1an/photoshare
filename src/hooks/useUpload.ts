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
  retryPhoto: (photoId: string) => Promise<void>;
  shareLink: string | null;
  albumExpiresAt: string | null;
  isUploading: boolean;
  publishError: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

interface UploadSession {
  nsecBytes: Uint8Array;
  albumKey: CryptoKey;
  signer: unknown;
  servers: string[];
  expSec: number;
  title?: string;
  reactions?: { relays: string[] };
  photoEntries: PhotoEntry[];
  entryIndexByPhotoId: Map<string, number>;
  uploadItemsByPhotoId: Map<string, UploadItem>;
}

function buildUploadErrorMessage(failedCount: number): string {
  return failedCount === 1
    ? '1 photo failed to upload after 3 retries'
    : `${failedCount} photos failed to upload after 3 retries`;
}

export function useUpload(): UseUploadReturn {
  const limitRef = useRef(pLimit(3));
  const sessionRef = useRef<UploadSession | null>(null);

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [albumExpiresAt, setAlbumExpiresAt] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { addPhoto, setEncrypting, setUploading, setUploadDone, setUploadError } = useUploadStore();

  const uploadSinglePhoto = useCallback(
    async (photoId: string, photo: ProcessedPhoto, originalFile: File | null | undefined, session: UploadSession): Promise<void> => {
      let lastError: unknown;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          setEncrypting(photoId);

          const fullBlob = await encryptBlob(photo.full, session.albumKey);
          const thumbBlob = await encryptBlob(photo.thumb, session.albumKey);

          const fullHash = await sha256Hex(fullBlob.buffer as ArrayBuffer);
          const thumbHash = await sha256Hex(thumbBlob.buffer as ArrayBuffer);

          setUploading(photoId);

          const fullAuthHeader = await buildBlossomUploadAuth(session.signer, fullHash);
          const thumbAuthHeader = await buildBlossomUploadAuth(session.signer, thumbHash);

          const fullDescriptor = await uploadBlob(
            session.servers[0],
            fullBlob.buffer as ArrayBuffer,
            fullAuthHeader,
            fullHash,
            undefined,
            session.expSec,
          );
          await uploadBlob(
            session.servers[0],
            thumbBlob.buffer as ArrayBuffer,
            thumbAuthHeader,
            thumbHash,
            undefined,
            session.expSec,
          );

          for (const mirror of session.servers.slice(1)) {
            try {
              const mFullAuth = await buildBlossomUploadAuth(session.signer, fullHash);
              const mThumbAuth = await buildBlossomUploadAuth(session.signer, thumbHash);
              await uploadBlob(mirror, fullBlob.buffer as ArrayBuffer, mFullAuth, fullHash, undefined, session.expSec);
              await uploadBlob(mirror, thumbBlob.buffer as ArrayBuffer, mThumbAuth, thumbHash, undefined, session.expSec);
            } catch {
              // Mirror failure is non-fatal
            }
          }

          let origHash: string | undefined;
          if (originalFile) {
            const origBuffer = await originalFile.arrayBuffer();
            const origBlob = await encryptBlob(origBuffer, session.albumKey);
            origHash = await sha256Hex(origBlob.buffer as ArrayBuffer);
            const origAuthHeader = await buildBlossomUploadAuth(session.signer, origHash);
            await uploadBlob(
              session.servers[0],
              origBlob.buffer as ArrayBuffer,
              origAuthHeader,
              origHash,
              undefined,
              session.expSec,
            );
            for (const mirror of session.servers.slice(1)) {
              try {
                const mOrigAuth = await buildBlossomUploadAuth(session.signer, origHash);
                await uploadBlob(mirror, origBlob.buffer as ArrayBuffer, mOrigAuth, origHash, undefined, session.expSec);
              } catch {
                // Mirror failure is non-fatal
              }
            }
          }

          setUploadDone(photoId, fullDescriptor);

          const entryIndex = session.entryIndexByPhotoId.get(photoId);
          if (entryIndex === undefined) throw new Error(`Missing upload slot for photo: ${photoId}`);

          session.photoEntries[entryIndex] = {
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
      throw lastError;
    },
    [setEncrypting, setUploading, setUploadDone, setUploadError],
  );

  const publishManifest = useCallback(
    async (session: UploadSession): Promise<void> => {
      if (session.photoEntries.some((entry) => !entry)) {
        throw new Error('Cannot publish manifest before all photos are uploaded');
      }

      const expiresAt = session.expSec ? new Date(Date.now() + session.expSec * 1000).toISOString() : undefined;
      const manifest: AlbumManifest = {
        v: 2,
        ...(session.title ? { title: session.title } : {}),
        createdAt: new Date().toISOString(),
        ...(expiresAt ? { expiresAt } : {}),
        photos: session.photoEntries,
        ...(session.reactions ? { reactions: { relays: session.reactions.relays } } : {}),
      };

      const manifestBlob = await encryptManifest(manifest, session.albumKey);
      const manifestHash = await sha256Hex(manifestBlob.buffer as ArrayBuffer);

      const manifestAuthHeader = await buildBlossomUploadAuth(session.signer, manifestHash);
      await uploadBlob(
        session.servers[0],
        manifestBlob.buffer as ArrayBuffer,
        manifestAuthHeader,
        manifestHash,
        undefined,
        session.expSec,
      );
      for (const mirror of session.servers.slice(1)) {
        try {
          const mAuth = await buildBlossomUploadAuth(session.signer, manifestHash);
          await uploadBlob(mirror, manifestBlob.buffer as ArrayBuffer, mAuth, manifestHash, undefined, session.expSec);
        } catch {
          // Mirror failure is non-fatal
        }
      }

      const nsecB64url = uint8ArrayToBase64url(session.nsecBytes);
      const pathToken = encodePathToken({
        hashBytes: hexToHashBytes(manifestHash),
        servers: session.servers,
      });
      const link = `/${pathToken}#${nsecB64url}`;

      setAlbumExpiresAt(expiresAt ?? null);
      setPublishError(null);
      setShareLink(link);
      sessionRef.current = null;
    },
    [],
  );

  const startUpload = useCallback(
    async (
      source: AsyncIterable<UploadItem>,
      settings: UploadSettings = { blossomServers: [DEFAULT_BLOSSOM_SERVER] },
    ): Promise<void> => {
      setIsUploading(true);
      setShareLink(null);
      setAlbumExpiresAt(null);
      setPublishError(null);

      const servers = settings.blossomServers.length > 0
        ? settings.blossomServers
        : [DEFAULT_BLOSSOM_SERVER];

      try {
        const nsecBytes = generateAlbumNsec();
        const albumKey = await deriveAlbumAESKey(nsecBytes);
        const accountSigner = useNostrAccountStore.getState().signer;
        const signer = accountSigner ?? createEphemeralSigner();
        const expSec = settings.expirationSeconds ?? DEFAULT_EXPIRATION_SECONDS;
        const session: UploadSession = {
          nsecBytes,
          albumKey,
          signer,
          servers,
          expSec,
          title: settings.title,
          reactions: settings.reactions,
          photoEntries: [],
          entryIndexByPhotoId: new Map<string, number>(),
          uploadItemsByPhotoId: new Map<string, UploadItem>(),
        };
        sessionRef.current = session;

        const pendingTasks: Promise<void>[] = [];

        for await (const { photo, photoId, originalFile } of source) {
          session.uploadItemsByPhotoId.set(photoId, { photo, photoId, originalFile });
          addPhoto(photoId, photo.filename);

          const entryIndex = session.photoEntries.length;
          session.entryIndexByPhotoId.set(photoId, entryIndex);
          session.photoEntries.push(null as unknown as PhotoEntry);

          const task = limitRef.current(async () => {
            try {
              await uploadSinglePhoto(photoId, photo, originalFile, session);
            } catch {
              // Error state is stored per-photo for targeted retry
            }
          });

          pendingTasks.push(task);
        }

        await Promise.all(pendingTasks);

        const failedCount = Object.values(useUploadStore.getState().photos)
          .filter((p) => p.status === 'error').length;
        if (failedCount > 0) {
          setPublishError(buildUploadErrorMessage(failedCount));
          return;
        }

        await publishManifest(session);
      } finally {
        setIsUploading(false);
      }
    },
    [addPhoto, publishManifest, uploadSinglePhoto],
  );

  const retryPhoto = useCallback(
    async (photoId: string): Promise<void> => {
      const session = sessionRef.current;
      if (!session) return;

      const uploadItem = session.uploadItemsByPhotoId.get(photoId);
      if (!uploadItem) return;

      setIsUploading(true);
      setPublishError(null);

      try {
        await uploadSinglePhoto(uploadItem.photoId, uploadItem.photo, uploadItem.originalFile, session);

        const failedCount = Object.values(useUploadStore.getState().photos)
          .filter((p) => p.status === 'error').length;
        if (failedCount > 0) {
          setPublishError(buildUploadErrorMessage(failedCount));
          return;
        }

        await publishManifest(session);
      } catch {
        const failedCount = Object.values(useUploadStore.getState().photos)
          .filter((p) => p.status === 'error').length;
        setPublishError(buildUploadErrorMessage(Math.max(failedCount, 1)));
      } finally {
        setIsUploading(false);
      }
    },
    [publishManifest, uploadSinglePhoto],
  );

  return { startUpload, retryPhoto, shareLink, albumExpiresAt, isUploading, publishError };
}
