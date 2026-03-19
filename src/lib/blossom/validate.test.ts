// @vitest-environment jsdom
/**
 * Tests for src/lib/blossom/validate.ts
 * Covers: CONF-02
 *
 * In real browsers, fetch() throws TypeError on CORS failure —
 * the response never reaches JavaScript. Tests simulate this behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateBlossomServer } from "@/lib/blossom/validate";

describe("validateBlossomServer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when fetch returns ok:true (CORS passed — browser let response through)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === "access-control-allow-origin") return "*";
          return null;
        },
      },
    }));

    const result = await validateBlossomServer("https://tempstore.apps3.slidestr.net");
    expect(result).toBe(true);
  });

  it("returns true when server returns 404 (server reachable, CORS OK, just no root handler)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
    }));

    const result = await validateBlossomServer("https://some-blossom.example.com");
    expect(result).toBe(true);
  });

  it("returns false when fetch throws (CORS blocked or network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")));

    const result = await validateBlossomServer("https://no-cors.example.com");
    expect(result).toBe(false);
  });

  it("returns false when fetch throws a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network error")));

    const result = await validateBlossomServer("https://unreachable.example.com");
    expect(result).toBe(false);
  });
});
