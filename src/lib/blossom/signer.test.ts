import { describe, it, expect } from "vitest";
import { createEphemeralSigner, getSignerPubkey } from "@/lib/blossom/signer";
import { encodeAlbumNaddr, decodeAlbumNaddr } from "@/lib/nostr/naddr";

describe("createEphemeralSigner (UPLD-04)", () => {
  it("returns a PrivateKeySigner instance", () => {
    const signer = createEphemeralSigner();
    expect(signer).toBeDefined();
    expect(typeof signer.getPublicKey).toBe("function");
  });

  it("getSignerPubkey returns a 64-character hex string", async () => {
    const signer = createEphemeralSigner();
    const pubkey = await getSignerPubkey(signer);
    expect(pubkey).toHaveLength(64);
    expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("two signers produce different public keys (ephemeral randomness)", async () => {
    const signer1 = createEphemeralSigner();
    const signer2 = createEphemeralSigner();
    const pk1 = await getSignerPubkey(signer1);
    const pk2 = await getSignerPubkey(signer2);
    expect(pk1).not.toBe(pk2);
  });
});

describe("encodeAlbumNaddr / decodeAlbumNaddr", () => {
  // Use a fixed test pubkey (64 hex chars, valid secp256k1 point)
  const TEST_PUBKEY = "0000000000000000000000000000000000000000000000000000000000000001";
  const TEST_IDENTIFIER = "test-album-uuid-1234";
  const TEST_RELAYS = ["wss://relay.nostu.be"];

  it("encodes to a string starting with naddr1", () => {
    const naddr = encodeAlbumNaddr(TEST_IDENTIFIER, TEST_PUBKEY, TEST_RELAYS);
    expect(naddr).toMatch(/^naddr1/);
  });

  it("round-trip: decoded identifier matches input", () => {
    const naddr = encodeAlbumNaddr(TEST_IDENTIFIER, TEST_PUBKEY, TEST_RELAYS);
    const decoded = decodeAlbumNaddr(naddr);
    expect(decoded.identifier).toBe(TEST_IDENTIFIER);
  });

  it("round-trip: decoded pubkey matches input", () => {
    const naddr = encodeAlbumNaddr(TEST_IDENTIFIER, TEST_PUBKEY, TEST_RELAYS);
    const decoded = decodeAlbumNaddr(naddr);
    expect(decoded.pubkey).toBe(TEST_PUBKEY);
  });

  it("round-trip: decoded kind is 30078", () => {
    const naddr = encodeAlbumNaddr(TEST_IDENTIFIER, TEST_PUBKEY, TEST_RELAYS);
    const decoded = decodeAlbumNaddr(naddr);
    expect(decoded.kind).toBe(30078);
  });

  it("decodeAlbumNaddr throws on invalid input", () => {
    expect(() => decodeAlbumNaddr("not-an-naddr")).toThrow();
  });
});
