// @vitest-environment jsdom
/**
 * Tests for src/hooks/useUpload.ts — Blossom-only manifest upload flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUpload } from '@/hooks/useUpload';
import type { BlobDescriptor } from '@/store/uploadStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUploadPhotos: Record<string, { status: string }> = {};

vi.mock('@/lib/crypto', () => ({
  generateAlbumNsec: vi.fn().mockReturnValue(new Uint8Array(32)),
  deriveAlbumAESKey: vi.fn().mockResolvedValue({} as CryptoKey),
  encryptBlob: vi.fn(),
  uint8ArrayToBase64url: vi.fn().mockReturnValue('mock-key-b64url'),
}));

vi.mock('@/lib/blossom/signer', () => ({
  createEphemeralSigner: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/blossom/upload', () => ({
  sha256Hex: vi.fn(),
  buildBlossomUploadAuth: vi.fn().mockResolvedValue('Nostr mock-auth'),
  uploadBlob: vi.fn(),
}));

vi.mock('@/lib/blossom/manifest', () => ({
  encryptManifest: vi.fn(),
}));

vi.mock('@/store/uploadStore', () => ({
  useUploadStore: Object.assign(
    vi.fn().mockImplementation(() => ({
      addPhoto: (id: string) => { mockUploadPhotos[id] = { status: 'pending' }; },
      setEncrypting: (id: string) => { mockUploadPhotos[id] = { status: 'encrypting' }; },
      setUploading: (id: string) => { mockUploadPhotos[id] = { status: 'uploading' }; },
      setUploadDone: (id: string, _descriptor: BlobDescriptor) => { mockUploadPhotos[id] = { status: 'done' }; },
      setUploadError: (id: string, _error: string) => { mockUploadPhotos[id] = { status: 'error' }; },
    })),
    {
      getState: () => ({ photos: mockUploadPhotos }),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { encryptBlob, uint8ArrayToBase64url } from '@/lib/crypto';
import { sha256Hex, uploadBlob } from '@/lib/blossom/upload';
import { encryptManifest } from '@/lib/blossom/manifest';

const mockEncryptBlob = encryptBlob as ReturnType<typeof vi.fn>;
const mockSha256Hex = sha256Hex as ReturnType<typeof vi.fn>;
const mockUploadBlob = uploadBlob as ReturnType<typeof vi.fn>;
const mockEncryptManifest = encryptManifest as ReturnType<typeof vi.fn>;
const mockUint8ArrayToBase64url = uint8ArrayToBase64url as ReturnType<typeof vi.fn>;

import type { UploadItem } from '@/hooks/useUpload';

/** A minimal ProcessedPhoto for testing */
function makePhoto(index = 0) {
  return {
    full: new ArrayBuffer(8),
    thumb: new ArrayBuffer(4),
    width: 1920,
    height: 1080,
    filename: `photo-${index}.jpg`,
    mimeType: 'image/webp',
    thumbhash: 'abc123thumbhashbase64==',
  };
}

/** Wrap photos as UploadItems in an AsyncIterable */
async function* asItems(photos: ReturnType<typeof makePhoto>[]): AsyncIterable<UploadItem> {
  for (let i = 0; i < photos.length; i++) {
    yield { photo: photos[i], photoId: `photo-${i}`, originalFile: null };
  }
}

/** A minimal BlobDescriptor */
function makeBlobDescriptor(hash: string) {
  return { sha256: hash, url: `https://blossom.example/${hash}`, size: 0, type: '', uploaded: 0 };
}

const FULL_HASH = 'a'.repeat(64);
const THUMB_HASH = 'b'.repeat(64);
const MANIFEST_HASH = 'c'.repeat(64);

const FULL_BLOB = new Uint8Array([1, 2, 3, 4]);
const THUMB_BLOB = new Uint8Array([5, 6, 7, 8]);
const MANIFEST_BLOB = new Uint8Array([9, 10, 11, 12]);

const BLOSSOM_SERVER = 'https://blossom.example.com';

function setupHappyPath() {
  mockEncryptBlob
    .mockResolvedValueOnce(FULL_BLOB)   // full
    .mockResolvedValueOnce(THUMB_BLOB); // thumb

  mockSha256Hex
    .mockResolvedValueOnce(FULL_HASH)     // full hash
    .mockResolvedValueOnce(THUMB_HASH)    // thumb hash
    .mockResolvedValueOnce(MANIFEST_HASH); // manifest hash

  mockUploadBlob
    .mockResolvedValueOnce(makeBlobDescriptor(FULL_HASH))   // full upload
    .mockResolvedValueOnce(makeBlobDescriptor(THUMB_HASH))  // thumb upload
    .mockResolvedValueOnce(makeBlobDescriptor(MANIFEST_HASH)); // manifest upload

  mockEncryptManifest.mockResolvedValue(MANIFEST_BLOB);
  mockUint8ArrayToBase64url.mockReturnValue('mock-key-b64url');
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockUploadPhotos).forEach((key) => delete mockUploadPhotos[key]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUpload — Blossom-only manifest upload', () => {
  it('calls encryptBlob for each photo (full + thumb)', async () => {
    setupHappyPath();

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.startUpload(asItems([makePhoto(0)]), { blossomServers: [BLOSSOM_SERVER] });
    });

    // 2 calls per photo: full + thumb
    expect(mockEncryptBlob).toHaveBeenCalledTimes(2);
  });

  it('calls sha256Hex on encrypted blobs', async () => {
    setupHappyPath();

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.startUpload(asItems([makePhoto(0)]), { blossomServers: [BLOSSOM_SERVER] });
    });

    // 3 calls: full hash, thumb hash, manifest hash
    expect(mockSha256Hex).toHaveBeenCalledTimes(3);
    // First call with full blob's buffer
    expect(mockSha256Hex).toHaveBeenNthCalledWith(1, FULL_BLOB.buffer);
    // Second call with thumb blob's buffer
    expect(mockSha256Hex).toHaveBeenNthCalledWith(2, THUMB_BLOB.buffer);
  });

  it('uploads photos and manifest to Blossom (2N+1 calls)', async () => {
    // Two photos
    mockEncryptBlob
      .mockResolvedValueOnce(FULL_BLOB)
      .mockResolvedValueOnce(THUMB_BLOB)
      .mockResolvedValueOnce(FULL_BLOB)
      .mockResolvedValueOnce(THUMB_BLOB);

    mockSha256Hex
      .mockResolvedValueOnce(FULL_HASH)
      .mockResolvedValueOnce(THUMB_HASH)
      .mockResolvedValueOnce(FULL_HASH)
      .mockResolvedValueOnce(THUMB_HASH)
      .mockResolvedValueOnce(MANIFEST_HASH);

    mockUploadBlob
      .mockResolvedValueOnce(makeBlobDescriptor(FULL_HASH))
      .mockResolvedValueOnce(makeBlobDescriptor(THUMB_HASH))
      .mockResolvedValueOnce(makeBlobDescriptor(FULL_HASH))
      .mockResolvedValueOnce(makeBlobDescriptor(THUMB_HASH))
      .mockResolvedValueOnce(makeBlobDescriptor(MANIFEST_HASH));

    mockEncryptManifest.mockResolvedValue(MANIFEST_BLOB);
    mockUint8ArrayToBase64url.mockReturnValue('mock-key-b64url');

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.startUpload(asItems([makePhoto(0), makePhoto(1)]), { blossomServers: [BLOSSOM_SERVER] });
    });

    // 2 photos × 2 blobs each + 1 manifest = 5 upload calls
    expect(mockUploadBlob).toHaveBeenCalledTimes(5);
    expect(result.current.shareLink).not.toBeNull();
  });

  it('generates an opaque share URL (pathToken + key fragment)', async () => {
    setupHappyPath();

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.startUpload(asItems([makePhoto(0)]), { blossomServers: [BLOSSOM_SERVER] });
    });

    const link = result.current.shareLink;
    expect(link).not.toBeNull();
    // New format: /{pathToken}#{keyB64url} — no hex hash or xs param visible
    expect(link).toMatch(/^\/[A-Za-z0-9_-]+#mock-key-b64url$/);
    // Must not contain the raw manifest hash or server domain
    expect(link).not.toContain(MANIFEST_HASH);
    expect(link).not.toContain('blossom.example.com');
  });

  it('sets publishError when a photo upload fails after 3 retries', async () => {
    // encryptBlob succeeds, sha256Hex succeeds, uploadBlob always fails
    mockEncryptBlob.mockResolvedValue(FULL_BLOB);
    mockSha256Hex.mockResolvedValue(FULL_HASH);
    mockUploadBlob.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.startUpload(asItems([makePhoto(0)]), { blossomServers: [BLOSSOM_SERVER] });
    });

    expect(result.current.publishError).toBe(
      '1 photo failed to upload after 3 retries',
    );
  });

  it('does not upload manifest when a photo upload fails', async () => {
    mockEncryptBlob.mockResolvedValue(FULL_BLOB);
    mockSha256Hex.mockResolvedValue(FULL_HASH);
    mockUploadBlob.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.startUpload(asItems([makePhoto(0)]), { blossomServers: [BLOSSOM_SERVER] });
    });

    // manifest should never be encrypted or uploaded
    expect(mockEncryptManifest).not.toHaveBeenCalled();
    // uploadBlob is retried 3× for the photo but manifest upload never happens
    // (3 retries: full upload attempt each time; thumb may or may not be called depending on order)
    const calls = mockUploadBlob.mock.calls;
    // All calls should be photo uploads (full), not manifest
    // manifest hash is MANIFEST_HASH — none of the calls should use it
    for (const [, , , hash] of calls) {
      expect(hash).not.toBe(MANIFEST_HASH);
    }
  });
});
