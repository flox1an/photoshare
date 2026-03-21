'use client';

/**
 * useUpload — orchestration hook for the full encrypt→upload→publish pipeline.
 *
 * Pipeline:
 *   1. Generate album key (AES-256-GCM)
 *   2. Create ephemeral Nostr signer
 *   3. For each photo (p-limit(3) concurrency):
 *      a. encrypt full + thumb
 *      b. SHA-256 each ciphertext
 *      c. upload both blobs to Blossom
 *      d. accumulate PhotoEntry
 *   4. Encrypt album manifest
 *   5. Build + sign kind 30078 event
 *   6. Publish via RelayPool
 *   7. Gate shareLink on relay ok=true (UPLD-08)
 *   8. Auto-copy to clipboard
 *
 * Concurrency: p-limit(3) caps simultaneous encrypt+upload pairs to prevent
 * memory exhaustion (3 × ~5 MB ciphertext = ~15 MB peak, safe within tab limits).
 *
 * Retry: each photo's encrypt+upload block retries up to 3 times with exponential
 * backoff (100ms, 200ms, 400ms) before calling setUploadError.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import pLimit from 'p-limit';
import { RelayPool } from 'applesauce-relay/pool';
import {
  generateAlbumKey,
  encryptBlob,
  exportKeyToBase64url,
  uint8ArrayToBase64url,
} from '@/lib/crypto';
import { createEphemeralSigner, getSignerPubkey } from '@/lib/blossom/signer';
import { sha256Hex, buildBlossomUploadAuth, uploadBlob } from '@/lib/blossom/upload';
import { buildAlbumEvent } from '@/lib/nostr/event';
import { encodeAlbumNaddr } from '@/lib/nostr/naddr';
import { useUploadStore } from '@/store/uploadStore';
import { DEFAULT_RELAYS, DEFAULT_BLOSSOM_SERVER } from '@/lib/config';
import type { ProcessedPhoto } from '@/types/processing';
import type { AlbumManifest, PhotoEntry } from '@/types/album';

/** Settings consumed by startUpload — can be provided by SettingsPanel */
export interface UploadSettings {
  blossomServer: string;
  relays: string[];
  title?: string;
}

/** Return type of the useUpload hook */
export interface UseUploadReturn {
  startUpload: (photos: ProcessedPhoto[], settings?: UploadSettings) => Promise<void>;
  shareLink: string | null;
  isUploading: boolean;
  publishError: string | null;
}

/**
 * Safe base64url encoding for large ArrayBuffers.
 * Uses chunked approach to avoid stack overflow for buffers > 64 KB.
 * (Manifest ciphertext for 200-photo albums can exceed that limit.)
 */
function arrayBufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Sleep helper for exponential backoff retry.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useUpload(): UseUploadReturn {
  const poolRef = useRef<RelayPool | null>(null);
  // Concurrency cap: 3 simultaneous encrypt+upload pairs (UPLD-06 memory safety)
  const limitRef = useRef(pLimit(3));

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { setEncrypting, setUploading, setUploadDone, setUploadError } = useUploadStore();

  useEffect(() => {
    // RelayPool lifecycle marker — pool is lazily created on first publish
    // to allow test mocks to fully configure RelayPool before use.
    return () => {
      // Cleanup: clear the ref on unmount so any in-flight publishes can't update state
      poolRef.current = null;
    };
  }, []);

  /**
   * Lazily initialise RelayPool — deferred until first publish so:
   * 1. SSR safe: never runs during Next.js prerender
   * 2. Test-friendly: vi.mock() has fully replaced RelayPool by the time it's used
   *
   * Note on construction: In production, `new RelayPool()` is the correct call.
   * In vitest 4.x test environments, vi.fn() with arrow function mockImplementation
   * cannot be called with `new` (vitest 4.x changed this behaviour). We try `new`
   * first and fall back to a plain call for arrow-function mocks. The fallback is
   * unreachable in production because real classes always support `new`.
   */
  const getPool = useCallback((): RelayPool => {
    if (!poolRef.current) {
      try {
        poolRef.current = new RelayPool();
      } catch (e) {
        // Vitest 4.x: vi.fn() with arrow function implementation cannot be called
        // with `new`. Fall back to a plain call — works for mocks; dead code in prod.
        if (e instanceof TypeError && e.message.includes("not a constructor")) {
          poolRef.current = (RelayPool as unknown as () => RelayPool)();
        } else {
          throw e;
        }
      }
    }
    return poolRef.current!;
  }, []);

  const startUpload = useCallback(
    async (
      photos: ProcessedPhoto[],
      settings: UploadSettings = {
        blossomServer: DEFAULT_BLOSSOM_SERVER,
        relays: DEFAULT_RELAYS,
      },
    ): Promise<void> => {
      setIsUploading(true);
      setShareLink(null);
      setPublishError(null);

      try {
        // Step 1: Generate fresh album key
        const albumKey = await generateAlbumKey();

        // Step 2: Create ephemeral signer (no login required — UPLD-04)
        const signer = createEphemeralSigner();

        // Step 3: Encrypt + upload all photos with p-limit(3) concurrency
        const photoEntries: PhotoEntry[] = [];
        let hasUploadError = false;

        await Promise.all(
          photos.map((photo, index) =>
            limitRef.current(async () => {
              // Use index as stable identifier when no photo.id exists
              const photoId = `photo-${index}`;
              let lastError: unknown;

              // Retry up to 3 times with exponential backoff
              for (let attempt = 0; attempt < 3; attempt++) {
                try {
                  // Step 3a: set encrypting state
                  setEncrypting(photoId);

                  // Step 3b: encrypt full image
                  const { ciphertext: fullCipher, iv: fullIv } = await encryptBlob(photo.full, albumKey);
                  // Step 3c: encrypt thumbnail
                  const { ciphertext: thumbCipher, iv: thumbIv } = await encryptBlob(photo.thumb, albumKey);

                  // Step 3d: SHA-256 of ciphertexts (MUST be on encrypted bytes — Pitfall 3)
                  const fullHash = await sha256Hex(fullCipher);
                  const thumbHash = await sha256Hex(thumbCipher);

                  // Step 3f: transition to uploading state
                  setUploading(photoId);

                  // Step 3g-h: build BUD-11 auth headers
                  const fullAuthHeader = await buildBlossomUploadAuth(signer, fullHash);
                  const thumbAuthHeader = await buildBlossomUploadAuth(signer, thumbHash);

                  // Step 3i-j: upload both blobs to Blossom
                  const fullDescriptor = await uploadBlob(
                    settings.blossomServer,
                    fullCipher,
                    fullAuthHeader,
                    fullHash,
                  );
                  const thumbDescriptor = await uploadBlob(
                    settings.blossomServer,
                    thumbCipher,
                    thumbAuthHeader,
                    thumbHash,
                  );

                  // Step 3k: mark as done in store
                  setUploadDone(photoId, fullDescriptor);

                  // Step 3l: accumulate PhotoEntry for manifest
                  photoEntries[index] = {
                    hash: fullHash,
                    iv: uint8ArrayToBase64url(fullIv),
                    thumbHash,
                    thumbIv: uint8ArrayToBase64url(thumbIv),
                    width: photo.width,
                    height: photo.height,
                    filename: photo.filename,
                  };

                  // Suppress unused variable warning for thumbDescriptor — url logged if needed
                  void thumbDescriptor;

                  return; // success — exit retry loop
                } catch (err) {
                  lastError = err;
                  if (attempt < 2) {
                    // exponential backoff: 100ms, 200ms (attempt 0→1, 1→2)
                    await sleep(100 * Math.pow(2, attempt));
                  }
                }
              }

              // All 3 retries failed
              const message = lastError instanceof Error ? lastError.message : String(lastError);
              setUploadError(photoId, message);
              hasUploadError = true;
            }),
          ),
        );

        // Step 4: If any upload failed, abort — don't publish (UPLD-08 pre-condition)
        if (hasUploadError) {
          setPublishError('One or more photos failed to upload after 3 retries');
          return;
        }

        // Step 5: Build AlbumManifest
        const manifest: AlbumManifest = {
          ...(settings.title ? { title: settings.title } : {}),
          createdAt: new Date().toISOString(),
          photos: photoEntries,
        };

        // Step 6: Encrypt manifest
        const manifestJson = JSON.stringify(manifest);
        const manifestData = new TextEncoder().encode(manifestJson).buffer as ArrayBuffer;
        const { ciphertext: manifestCipher, iv: manifestIv } = await encryptBlob(manifestData, albumKey);

        // Step 7: Encode manifest ciphertext as base64url (chunked — safe for large manifests)
        const encryptedManifestB64url = arrayBufferToBase64url(manifestCipher);

        // Step 8: Encode manifest IV (12 bytes — spread-btoa is safe at this size)
        const ivB64url = uint8ArrayToBase64url(manifestIv);

        // Step 9: Generate album d-tag
        const dTag = crypto.randomUUID();

        // Step 10: Build + sign kind 30078 event
        const event = await buildAlbumEvent(signer, encryptedManifestB64url, ivB64url, dTag);

        // Step 11: Publish to relays via RelayPool (UPLD-05)
        // getPool() lazily initialises on first call — SSR-safe and test-friendly
        const pool = getPool();

        const responses = await pool.publish(settings.relays, event);

        // Step 12: Gate on relay OK (UPLD-08) — shareLink remains null if any relay fails
        const failures = responses.filter((r) => !r.ok);
        if (failures.length > 0) {
          const messages = failures.map((r) => `${r.from}: ${r.message ?? 'rejected'}`).join('; ');
          setPublishError(`Relay publish failed: ${messages}`);
          return;
        }

        // Step 13-16: Build share link — only reachable when all relays returned ok=true
        const keyB64url = await exportKeyToBase64url(albumKey);
        const pubkey = await getSignerPubkey(signer);
        const naddr = encodeAlbumNaddr(dTag, pubkey, settings.relays);
        const link = `/${naddr}#${keyB64url}`;

        // Step 17: Auto-copy to clipboard (user decision — locked in CONTEXT.md)
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(
              (typeof window !== 'undefined' ? window.location.origin : '') + link,
            );
          }
        } catch {
          // Clipboard permission denied — non-fatal; user can copy manually
        }

        setShareLink(link);
      } finally {
        setIsUploading(false);
      }
    },
    [setEncrypting, setUploading, setUploadDone, setUploadError, getPool],
  );

  return { startUpload, shareLink, isUploading, publishError };
}
