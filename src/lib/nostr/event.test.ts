// @vitest-environment jsdom
/**
 * RED test scaffolds for src/lib/nostr/event.ts
 * Covers: UPLD-05, UPLD-06
 *
 * All tests in this file fail because src/lib/nostr/event.ts does not exist yet.
 * This is the intentional RED state — implementation is in Plan 03-03.
 */

import { describe, it, expect, vi } from "vitest";
import { buildAlbumEvent } from "@/lib/nostr/event";
import { ALBUM_EXPIRY_SECONDS } from "@/lib/config";

// Mock signer that matches PrivateKeySigner.signEvent signature
const mockSigner = {
  signEvent: vi.fn(async (template: Record<string, unknown>) => ({
    ...template,
    id: "fakeid",
    sig: "fakesig",
    pubkey: "fakepub",
  })),
};

describe("buildAlbumEvent", () => {
  it("returns event with kind=30078 (UPLD-05)", async () => {
    const event = await buildAlbumEvent(
      mockSigner as never,
      "encryptedManifestBase64url",
      "ivBase64url",
      "test-d-tag-uuid",
    );
    expect(event.kind).toBe(30078);
  });

  it("returned event has tag ['d', dTag] (UPLD-05)", async () => {
    const dTag = "album-uuid-123";
    const event = await buildAlbumEvent(
      mockSigner as never,
      "encryptedManifestBase64url",
      "ivBase64url",
      dTag,
    );
    const tags: string[][] = event.tags;
    const dTagEntry = tags.find((t) => t[0] === "d");
    expect(dTagEntry).toEqual(["d", dTag]);
  });

  it("returned event has tag ['iv', manifestIvB64url] (UPLD-05)", async () => {
    const ivB64url = "someIvBase64urlValue";
    const event = await buildAlbumEvent(
      mockSigner as never,
      "encryptedManifestBase64url",
      ivB64url,
      "test-d-tag-uuid",
    );
    const tags: string[][] = event.tags;
    const ivTag = tags.find((t) => t[0] === "iv");
    expect(ivTag).toEqual(["iv", ivB64url]);
  });

  it("returned event has tag ['alt', 'Encrypted photo album'] (UPLD-05)", async () => {
    const event = await buildAlbumEvent(
      mockSigner as never,
      "encryptedManifestBase64url",
      "ivBase64url",
      "test-d-tag-uuid",
    );
    const tags: string[][] = event.tags;
    const altTag = tags.find((t) => t[0] === "alt");
    expect(altTag).toEqual(["alt", "Encrypted photo album"]);
  });

  it("returned event expiration tag is within [now + ALBUM_EXPIRY_SECONDS - 60, now + ALBUM_EXPIRY_SECONDS + 60] (UPLD-06)", async () => {
    const before = Math.floor(Date.now() / 1000);
    const event = await buildAlbumEvent(
      mockSigner as never,
      "encryptedManifestBase64url",
      "ivBase64url",
      "test-d-tag-uuid",
    );
    const after = Math.floor(Date.now() / 1000);
    const tags: string[][] = event.tags;
    const expirationTag = tags.find((t) => t[0] === "expiration");
    expect(expirationTag).toBeDefined();
    const expiration = parseInt(expirationTag![1], 10);
    expect(expiration).toBeGreaterThanOrEqual(before + ALBUM_EXPIRY_SECONDS - 60);
    expect(expiration).toBeLessThanOrEqual(after + ALBUM_EXPIRY_SECONDS + 60);
  });

  it("returned event content equals encryptedManifestB64url (UPLD-05)", async () => {
    const encryptedManifestB64url = "someBase64urlEncodedEncryptedManifest";
    const event = await buildAlbumEvent(
      mockSigner as never,
      encryptedManifestB64url,
      "ivBase64url",
      "test-d-tag-uuid",
    );
    expect(event.content).toBe(encryptedManifestB64url);
  });
});
