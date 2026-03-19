// @vitest-environment jsdom
/**
 * RED test scaffolds for src/lib/blossom/validate.ts
 * Covers: CONF-02
 *
 * All tests in this file fail because src/lib/blossom/validate.ts does not exist yet.
 * This is the intentional RED state — implementation is in Plan 03-02.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateBlossomServer } from "@/lib/blossom/validate";

describe("validateBlossomServer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when fetch returns ok:true with access-control-allow-origin: '*' header (CONF-02)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === "access-control-allow-origin") return "*";
          return null;
        },
      },
    }));

    const result = await validateBlossomServer("https://24242.io");
    expect(result).toBe(true);
  });

  it("returns false when fetch returns ok:true but no CORS header (CONF-02)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (_name: string) => null,
      },
    }));

    const result = await validateBlossomServer("https://no-cors.example.com");
    expect(result).toBe(false);
  });

  it("returns false when fetch throws a network error (CONF-02)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network error")));

    const result = await validateBlossomServer("https://unreachable.example.com");
    expect(result).toBe(false);
  });
});
