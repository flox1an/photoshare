import { describe, it, expect } from "vitest";
import {
  DEFAULT_RELAYS,
  DEFAULT_BLOSSOM_SERVER,
  ALBUM_EXPIRY_SECONDS,
  BLOSSOM_EXPIRY_SECONDS,
} from "@/lib/config";

describe("DEFAULT_RELAYS (CONF-04)", () => {
  it("contains at least one relay URL", () => {
    expect(DEFAULT_RELAYS.length).toBeGreaterThan(0);
  });

  it("all relay URLs start with wss://", () => {
    for (const relay of DEFAULT_RELAYS) {
      expect(relay).toMatch(/^wss:\/\//);
    }
  });

  it("includes relay.nostu.be", () => {
    expect(DEFAULT_RELAYS).toContain("wss://relay.nostu.be");
  });
});

describe("DEFAULT_BLOSSOM_SERVER (CONF-04)", () => {
  it("starts with https://", () => {
    expect(DEFAULT_BLOSSOM_SERVER).toMatch(/^https:\/\//);
  });

  it("is 24242.io", () => {
    expect(DEFAULT_BLOSSOM_SERVER).toBe("https://24242.io");
  });
});

describe("expiry constants", () => {
  it("ALBUM_EXPIRY_SECONDS is 30 days in seconds", () => {
    expect(ALBUM_EXPIRY_SECONDS).toBe(2592000);
  });

  it("BLOSSOM_EXPIRY_SECONDS is 60 days in seconds", () => {
    expect(BLOSSOM_EXPIRY_SECONDS).toBe(5184000);
  });
});
