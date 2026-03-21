import { describe, it, expect } from "vitest";
import { createEphemeralSigner, getSignerPubkey } from "@/lib/blossom/signer";

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
