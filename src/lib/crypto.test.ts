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
  it("returns ciphertext with byteLength equal to input + 16 bytes (GCM auth tag)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const { ciphertext } = await encryptBlob(data, key);
    expect(ciphertext.byteLength).toBe(data.byteLength + 16);
  });

  it("returns a 12-byte IV", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("test").buffer as ArrayBuffer;
    const { iv } = await encryptBlob(data, key);
    expect(iv.byteLength).toBe(12);
  });

  it("produces unique IVs across 200 calls (CRYPT-02: no IV reuse)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("x").buffer as ArrayBuffer;
    const ivSet = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { iv } = await encryptBlob(data, key);
      ivSet.add(uint8ArrayToBase64url(iv));
    }
    expect(ivSet.size).toBe(200);
  });
});

describe("decryptBlob", () => {
  it("round-trips: decrypt(encrypt(data)) recovers original data", async () => {
    const key = await generateAlbumKey();
    const original = new TextEncoder().encode("photoshare test payload").buffer as ArrayBuffer;
    const { ciphertext, iv } = await encryptBlob(original, key);
    const recovered = await decryptBlob(ciphertext, key, iv);
    expect(new Uint8Array(recovered)).toEqual(new Uint8Array(original));
  });

  it("throws when IV is wrong (GCM auth tag mismatch)", async () => {
    const key = await generateAlbumKey();
    const data = new TextEncoder().encode("test").buffer as ArrayBuffer;
    const { ciphertext } = await encryptBlob(data, key);
    const wrongIv = new Uint8Array(12); // all zeros
    await expect(decryptBlob(ciphertext, key, wrongIv)).rejects.toThrow();
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
    const { ciphertext, iv } = await encryptBlob(data, key);
    const recovered = await decryptBlob(ciphertext, imported, iv);
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
