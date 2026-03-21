import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveAndFetch } from "@/lib/blossom/resolve";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("resolveAndFetch", () => {
  it("fetches from server hint first when provided", async () => {
    const mockData = new ArrayBuffer(10);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockData),
    });

    const result = await resolveAndFetch("abc123", ["https://myserver.com"]);
    expect(mockFetch).toHaveBeenCalledWith("https://myserver.com/abc123");
    expect(result.data).toBe(mockData);
    expect(result.server).toBe("https://myserver.com");
  });

  it("falls back to DEFAULT_BLOSSOM_SERVERS when hint server fails", async () => {
    const mockData = new ArrayBuffer(10);
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockData),
      });

    const result = await resolveAndFetch("abc123", ["https://down.server.com"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.data).toBe(mockData);
  });

  it("tries DEFAULT_BLOSSOM_SERVERS when no xs hint given", async () => {
    const mockData = new ArrayBuffer(10);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockData),
    });

    const result = await resolveAndFetch("abc123");
    expect(result.data).toBe(mockData);
  });

  it("throws BlobNotFoundError when all servers fail", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(resolveAndFetch("abc123")).rejects.toThrow(
      "Blob not found on any server",
    );
  });

  it("handles fetch network errors gracefully (tries next server)", async () => {
    const mockData = new ArrayBuffer(10);
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockData),
      });

    const result = await resolveAndFetch("abc123");
    expect(result.data).toBe(mockData);
  });
});
