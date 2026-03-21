import { describe, it, expect } from "vitest";
import {
  generateAlbumKey,
  encryptBlob,
  decryptBlob,
  exportKeyToBase64url,
  importKeyFromBase64url,
  uint8ArrayToBase64url,
  base64urlToUint8Array,
} from "@/lib/crypto";

describe("generateAlbumKey", () => {
  it("returns a CryptoKey with AES-GCM algorithm and 256-bit length", async () => {
    const key = await generateAlbumKey();
    expect(key.algorithm.name).toBe("AES-GCM");
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(key.extractable).toBe(true);
    expect(key.usages).toContain("encrypt");
    expect(key.usages).toContain("decrypt");
  });
});

describe("encryptBlob", () => {
  it("returns Uint8Array with byteLength equal to 12 (IV) + input + 16 (GCM tag)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key);
    expect(blob).toBeInstanceOf(Uint8Array);
    expect(blob.byteLength).toBe(12 + data.byteLength + 16);
  });

  it("first 12 bytes are the IV (non-zero randomness check)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("test").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key);
    const iv = blob.slice(0, 12);
    expect(iv.some((b: number) => b !== 0)).toBe(true);
  });

  it("produces unique IVs across 200 calls (no IV reuse)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("x").buffer as ArrayBuffer;
    const ivSet = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const blob = await encryptBlob(data, key);
      ivSet.add(uint8ArrayToBase64url(blob.slice(0, 12)));
    }
    expect(ivSet.size).toBe(200);
  });
});

describe("decryptBlob", () => {
  it("round-trips: decrypt(encrypt(data)) recovers original data", async () => {
    const key = await generateAlbumKey();
    const original = new TextEncoder().encode("photoshare test payload").buffer as ArrayBuffer;
    const blob = await encryptBlob(original, key);
    const recovered = await decryptBlob(blob, key);
    expect(new Uint8Array(recovered)).toEqual(new Uint8Array(original));
  });

  it("throws when key is wrong (GCM auth tag mismatch)", async () => {
    const key1 = await generateAlbumKey();
    const key2 = await generateAlbumKey();
    const data = new TextEncoder().encode("test").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key1);
    await expect(decryptBlob(blob, key2)).rejects.toThrow();
  });

  it("throws when blob is truncated below 28 bytes", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("test").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key);
    const truncated = blob.slice(0, 20);
    await expect(decryptBlob(truncated, key)).rejects.toThrow("too short");
  });
});

describe("exportKeyToBase64url / importKeyFromBase64url", () => {
  it("exports key to a 43-character base64url string", async () => {
    const key = await generateAlbumKey();
    const b64url = await exportKeyToBase64url(key);
    expect(b64url).toHaveLength(43);
  });

  it("exported string contains only URL-safe chars (no +, /, =)", async () => {
    const key = await generateAlbumKey();
    const b64url = await exportKeyToBase64url(key);
    expect(b64url).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("round-trip: imported key decrypts data encrypted with original key", async () => {
    const key = await generateAlbumKey();
    const b64url = await exportKeyToBase64url(key);
    const imported = await importKeyFromBase64url(b64url);
    const data = new TextEncoder().encode("round-trip test").buffer as ArrayBuffer;
    const blob = await encryptBlob(data, key);
    const recovered = await decryptBlob(blob, imported);
    expect(new Uint8Array(recovered)).toEqual(new Uint8Array(data));
  });
});

describe("uint8ArrayToBase64url / base64urlToUint8Array", () => {
  it("round-trips a 12-byte IV", () => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = uint8ArrayToBase64url(iv);
    const decoded = base64urlToUint8Array(encoded);
    expect(decoded).toEqual(iv);
  });

  it("round-trips a 32-byte key material", () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const encoded = uint8ArrayToBase64url(raw);
    const decoded = base64urlToUint8Array(encoded);
    expect(decoded).toEqual(raw);
  });
});
