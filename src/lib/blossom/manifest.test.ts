import { describe, it, expect } from "vitest";
import { generateAlbumKey, encryptBlob } from "@/lib/crypto";
import {
  encryptManifest,
  decryptAndValidateManifest,
} from "@/lib/blossom/manifest";
import type { AlbumManifest } from "@/types/album";

describe("encryptManifest", () => {
  it("returns a Uint8Array with IV-prepended ciphertext", async () => {
    const key = await generateAlbumKey();
    const manifest: AlbumManifest = {
      v: 1,
      createdAt: new Date().toISOString(),
      photos: [],
    };
    const blob = await encryptManifest(manifest, key);
    expect(blob).toBeInstanceOf(Uint8Array);
    expect(blob.byteLength).toBeGreaterThan(12);
  });
});

describe("decryptAndValidateManifest", () => {
  it("round-trips a valid manifest", async () => {
    const key = await generateAlbumKey();
    const manifest: AlbumManifest = {
      v: 1,
      title: "Test Album",
      createdAt: "2026-03-21T00:00:00.000Z",
      photos: [
        { hash: "a".repeat(64), thumbHash: "b".repeat(64), width: 1920, height: 1080, filename: "test.jpg" },
      ],
    };
    const blob = await encryptManifest(manifest, key);
    const result = await decryptAndValidateManifest(blob, key);
    expect(result).toEqual(manifest);
  });

  it("rejects manifest with unsupported version", async () => {
    const key = await generateAlbumKey();
    const badManifest = { v: 99, createdAt: "2026-01-01", photos: [] };
    const json = new TextEncoder().encode(JSON.stringify(badManifest));
    const blob = await encryptBlob(json.buffer as ArrayBuffer, key);
    await expect(decryptAndValidateManifest(blob, key)).rejects.toThrow(
      "Unsupported album version",
    );
  });

  it("rejects manifest with missing photos array", async () => {
    const key = await generateAlbumKey();
    const badManifest = { v: 1, createdAt: "2026-01-01" };
    const json = new TextEncoder().encode(JSON.stringify(badManifest));
    const blob = await encryptBlob(json.buffer as ArrayBuffer, key);
    await expect(decryptAndValidateManifest(blob, key)).rejects.toThrow(
      "Invalid manifest",
    );
  });

  it("rejects manifest with invalid photo entry (missing hash)", async () => {
    const key = await generateAlbumKey();
    const badManifest = {
      v: 1,
      createdAt: "2026-01-01",
      photos: [{ thumbHash: "b".repeat(64), width: 100, height: 100, filename: "x.jpg" }],
    };
    const json = new TextEncoder().encode(JSON.stringify(badManifest));
    const blob = await encryptBlob(json.buffer as ArrayBuffer, key);
    await expect(decryptAndValidateManifest(blob, key)).rejects.toThrow(
      "Invalid photo entry",
    );
  });

  it("throws on wrong key", async () => {
    const key1 = await generateAlbumKey();
    const key2 = await generateAlbumKey();
    const manifest: AlbumManifest = { v: 1, createdAt: "2026-01-01", photos: [] };
    const blob = await encryptManifest(manifest, key1);
    await expect(decryptAndValidateManifest(blob, key2)).rejects.toThrow();
  });

  it("accepts manifest without title", async () => {
    const key = await generateAlbumKey();
    const manifest: AlbumManifest = { v: 1, createdAt: "2026-01-01", photos: [] };
    const blob = await encryptManifest(manifest, key);
    const result = await decryptAndValidateManifest(blob, key);
    expect(result.title).toBeUndefined();
  });
});
