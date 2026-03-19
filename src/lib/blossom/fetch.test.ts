import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { fetchBlob } from "@/lib/blossom/fetch";

describe("fetchBlob", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ArrayBuffer on 200 response", async () => {
    const fakeBuffer = new ArrayBuffer(8);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(fakeBuffer),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchBlob("https://blossom.example.com", "abc123sha256");

    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("throws on non-200 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchBlob("https://blossom.example.com", "abc123sha256")).rejects.toThrow("404");
  });

  it("constructs correct BUD-01 URL (server + sha256, no trailing slash)", async () => {
    const fakeBuffer = new ArrayBuffer(4);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(fakeBuffer),
    });
    vi.stubGlobal("fetch", mockFetch);

    // Server with trailing slash — should be stripped
    await fetchBlob("https://example.com/", "abc123");

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/abc123");
  });
});
