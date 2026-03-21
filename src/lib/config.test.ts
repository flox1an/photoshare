import { describe, it, expect } from "vitest";
import {
  DEFAULT_BLOSSOM_SERVER,
  DEFAULT_BLOSSOM_SERVERS,
  BLOSSOM_EXPIRY_SECONDS,
} from "@/lib/config";

describe("config", () => {
  it("DEFAULT_BLOSSOM_SERVER is a valid https URL", () => {
    expect(DEFAULT_BLOSSOM_SERVER).toMatch(/^https:\/\//);
  });

  it("DEFAULT_BLOSSOM_SERVERS is a non-empty array of https URLs", () => {
    expect(DEFAULT_BLOSSOM_SERVERS.length).toBeGreaterThan(0);
    for (const url of DEFAULT_BLOSSOM_SERVERS) {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it("BLOSSOM_EXPIRY_SECONDS is 60 days in seconds", () => {
    expect(BLOSSOM_EXPIRY_SECONDS).toBe(5184000);
  });
});
