// @vitest-environment jsdom
/**
 * RED test scaffolds for src/lib/blossom/upload.ts
 * Covers: UPLD-01, UPLD-02, UPLD-03
 *
 * All tests in this file fail because src/lib/blossom/upload.ts does not exist yet.
 * This is the intentional RED state — implementation is in Plan 03-02.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sha256Hex, buildBlossomUploadAuth, uploadBlob } from "@/lib/blossom/upload";

// Mock signer that matches PrivateKeySigner.signEvent signature
const mockSigner = {
  signEvent: vi.fn(async (template: Record<string, unknown>) => ({
    ...template,
    id: "abc123def456abc123def456abc123def456abc123def456abc123def456abc123",
    sig: "def789",
    pubkey: "pubkey123",
  })),
};

describe("sha256Hex", () => {
  it("returns a lowercase hex string of length 64", async () => {
    const input = new TextEncoder().encode("hello world").buffer as ArrayBuffer;
    const result = await sha256Hex(input);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns the correct SHA-256 hash for a known input", async () => {
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const input = new TextEncoder().encode("hello").buffer as ArrayBuffer;
    const result = await sha256Hex(input);
    expect(result).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("buildBlossomUploadAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a string starting with 'Nostr ' (UPLD-01)", async () => {
    const hashHex = "a".repeat(64);
    const result = await buildBlossomUploadAuth(mockSigner as never, hashHex);
    expect(result).toMatch(/^Nostr /);
  });

  it("Authorization header contains a JSON object with kind=24242 (UPLD-01)", async () => {
    const hashHex = "b".repeat(64);
    const authHeader = await buildBlossomUploadAuth(mockSigner as never, hashHex);
    const base64Part = authHeader.slice("Nostr ".length);
    const decoded = JSON.parse(atob(base64Part));
    expect(decoded.kind).toBe(24242);
  });

  it("Authorization header event contains tag ['t', 'upload'] (UPLD-01)", async () => {
    const hashHex = "c".repeat(64);
    const authHeader = await buildBlossomUploadAuth(mockSigner as never, hashHex);
    const base64Part = authHeader.slice("Nostr ".length);
    const decoded = JSON.parse(atob(base64Part));
    const tags: string[][] = decoded.tags;
    const tTag = tags.find((t) => t[0] === "t");
    expect(tTag).toEqual(["t", "upload"]);
  });

  it("Authorization header event contains tag ['x', hashHex] (UPLD-01)", async () => {
    const hashHex = "d".repeat(64);
    const authHeader = await buildBlossomUploadAuth(mockSigner as never, hashHex);
    const base64Part = authHeader.slice("Nostr ".length);
    const decoded = JSON.parse(atob(base64Part));
    const tags: string[][] = decoded.tags;
    const xTag = tags.find((t) => t[0] === "x");
    expect(xTag).toEqual(["x", hashHex]);
  });

  it("kind 24242 event expiration tag is within [now+3500, now+3700] seconds (UPLD-03)", async () => {
    const hashHex = "e".repeat(64);
    const before = Math.floor(Date.now() / 1000);
    const authHeader = await buildBlossomUploadAuth(mockSigner as never, hashHex);
    const after = Math.floor(Date.now() / 1000);
    const base64Part = authHeader.slice("Nostr ".length);
    const decoded = JSON.parse(atob(base64Part));
    const tags: string[][] = decoded.tags;
    const expirationTag = tags.find((t) => t[0] === "expiration");
    expect(expirationTag).toBeDefined();
    const expiration = parseInt(expirationTag![1], 10);
    expect(expiration).toBeGreaterThanOrEqual(before + 3500);
    expect(expiration).toBeLessThanOrEqual(after + 3700);
  });
});

describe("uploadBlob", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns BlobDescriptor when server returns sha256 matching local hash (UPLD-01, UPLD-02)", async () => {
    const ciphertext = new TextEncoder().encode("encrypted-data").buffer as ArrayBuffer;
    const hashHex = "a".repeat(64);
    const mockDescriptor = {
      url: "https://24242.io/blob/aaaa",
      sha256: hashHex,
      size: 14,
      type: "application/octet-stream",
      uploaded: 1700000000,
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDescriptor,
    }));

    const result = await uploadBlob("https://24242.io", ciphertext, "Nostr abc123", hashHex);
    expect(result).toEqual(mockDescriptor);
  });

  it("throws error with 'hash mismatch' when server returns sha256 NOT matching local hash (UPLD-02)", async () => {
    const ciphertext = new TextEncoder().encode("encrypted-data").buffer as ArrayBuffer;
    const localHashHex = "a".repeat(64);
    const serverHashHex = "b".repeat(64); // different from local

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        url: "https://24242.io/blob/bbbb",
        sha256: serverHashHex,
        size: 14,
        type: "application/octet-stream",
        uploaded: 1700000000,
      }),
    }));

    await expect(
      uploadBlob("https://24242.io", ciphertext, "Nostr abc123", localHashHex)
    ).rejects.toThrow("hash mismatch");
  });

  it("throws with status code when server returns non-2xx", async () => {
    const ciphertext = new TextEncoder().encode("encrypted-data").buffer as ArrayBuffer;
    const hashHex = "a".repeat(64);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 413,
      text: async () => "Payload Too Large",
    }));

    await expect(
      uploadBlob("https://24242.io", ciphertext, "Nostr abc123", hashHex)
    ).rejects.toThrow("413");
  });
});
