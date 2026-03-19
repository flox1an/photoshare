import { vi, describe, it, expect, beforeEach } from "vitest";
import { EMPTY } from "rxjs";

// Mock applesauce-loaders/loaders/address-loader before importing viewer
vi.mock("applesauce-loaders/loaders/address-loader", () => ({
  createAddressLoader: vi.fn(),
}));

// Mock applesauce-relay/pool — no-op constructor
// vitest 4.x requires 'function' (not arrow) when mock is used as a constructor via 'new'
vi.mock("applesauce-relay/pool", () => ({
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  RelayPool: vi.fn().mockImplementation(function () { return {}; }),
}));

import { createAddressLoader } from "applesauce-loaders/loaders/address-loader";
import { decryptManifest, loadAlbumEvent } from "@/lib/nostr/viewer";
import { generateAlbumKey, encryptBlob, uint8ArrayToBase64url } from "@/lib/crypto";
import type { AlbumManifest } from "@/types/album";
import { of } from "rxjs";

const mockCreateAddressLoader = vi.mocked(createAddressLoader);

describe("decryptManifest", () => {
  it("returns AlbumManifest given encrypted event content, IV tag, and CryptoKey", async () => {
    // Build a real manifest, encrypt it with a real Web Crypto key
    const manifest: AlbumManifest = {
      title: "Test Album",
      createdAt: "2026-03-19T00:00:00.000Z",
      photos: [
        {
          hash: "aabbcc",
          iv: "aaaaaaaaaaaa",
          thumbHash: "ddeeff",
          thumbIv: "bbbbbbbbbbbb",
          width: 1920,
          height: 1080,
          filename: "photo1.jpg",
        },
        {
          hash: "112233",
          iv: "cccccccccccc",
          thumbHash: "445566",
          thumbIv: "dddddddddddd",
          width: 800,
          height: 600,
          filename: "photo2.jpg",
        },
      ],
    };

    const key = await generateAlbumKey();
    const plaintext = new TextEncoder().encode(JSON.stringify(manifest));
    const { ciphertext, iv } = await encryptBlob(plaintext.buffer as ArrayBuffer, key);
    const contentB64 = uint8ArrayToBase64url(new Uint8Array(ciphertext));
    const ivB64 = uint8ArrayToBase64url(iv);

    const fakeEvent = {
      id: "fakeid",
      pubkey: "fakepubkey",
      kind: 30078,
      created_at: 1710000000,
      content: contentB64,
      tags: [["iv", ivB64]],
      sig: "fakesig",
    };

    const result = await decryptManifest(fakeEvent, key);

    expect(result.photos).toHaveLength(2);
    expect(result.title).toBe("Test Album");
    expect(result.photos[0].filename).toBe("photo1.jpg");
    expect(result.photos[1].filename).toBe("photo2.jpg");
  });
});

describe("loadAlbumEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls createAddressLoader with followRelayHints: true", async () => {
    const fakeEvent = {
      id: "fakeid",
      pubkey: "fakepubkey",
      kind: 30078,
      created_at: 1710000000,
      content: "fakecontent",
      tags: [],
      sig: "fakesig",
    };

    const mockLoadFn = vi.fn().mockReturnValue(of(fakeEvent));
    mockCreateAddressLoader.mockReturnValue(mockLoadFn);

    const pointer = {
      kind: 30078 as const,
      pubkey: "abcdef",
      identifier: "test-album-id",
      relays: ["wss://relay.example.com"],
    };

    await loadAlbumEvent(pointer);

    expect(mockCreateAddressLoader).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ followRelayHints: true }),
    );
  });

  it("throws on EmptyError (expired album)", async () => {
    const mockLoadFn = vi.fn().mockReturnValue(EMPTY);
    mockCreateAddressLoader.mockReturnValue(mockLoadFn);

    const pointer = {
      kind: 30078 as const,
      pubkey: "abcdef",
      identifier: "expired-album-id",
      relays: ["wss://relay.example.com"],
    };

    await expect(loadAlbumEvent(pointer)).rejects.toThrow(/not found|expired/i);
  });
});
