import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock jszip before importing hook
vi.mock("jszip", () => {
  const mockFile = vi.fn();
  const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(["zip-content"], { type: "application/zip" }));
  const MockJSZip = vi.fn().mockImplementation(function () {
    return {
      file: mockFile,
      generateAsync: mockGenerateAsync,
    };
  });
  return { default: MockJSZip };
});

// Mock crypto
vi.mock("@/lib/crypto", () => ({
  importKeyFromBase64url: vi.fn().mockResolvedValue({} as CryptoKey),
  decryptBlob: vi.fn().mockImplementation(async (buf: Uint8Array) => buf.buffer),
  deriveAlbumAESKey: vi.fn().mockRejectedValue(new Error("not v2")),
  base64urlToUint8Array: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
}));

// Mock resolveAndFetch
vi.mock("@/lib/blossom/resolve", () => ({
  resolveAndFetch: vi.fn().mockResolvedValue({
    data: new ArrayBuffer(16),
    server: "https://blossom.example.com",
  }),
}));

// Mock decryptAndValidateManifest
vi.mock("@/lib/blossom/manifest", () => ({
  decryptAndValidateManifest: vi.fn().mockResolvedValue({
    v: 1,
    createdAt: "2026-01-01T00:00:00Z",
    photos: [],
  }),
}));

import JSZip from "jszip";
import { importKeyFromBase64url, decryptBlob } from "@/lib/crypto";
import { resolveAndFetch } from "@/lib/blossom/resolve";
import { decryptAndValidateManifest } from "@/lib/blossom/manifest";
import { useAlbumViewer } from "@/hooks/useAlbumViewer";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { PhotoEntry } from "@/types/album";

const MockJSZip = vi.mocked(JSZip);
const mockResolveAndFetch = vi.mocked(resolveAndFetch);
const mockDecryptAndValidateManifest = vi.mocked(decryptAndValidateManifest);
const mockImportKeyFromBase64url = vi.mocked(importKeyFromBase64url);

const sampleManifest = {
  v: 1 as const,
  createdAt: "2026-01-01T00:00:00Z",
  photos: [
    {
      hash: "a".repeat(64),
      thumbHash: "b".repeat(64),
      width: 1920,
      height: 1080,
      filename: "IMG_2847.jpg",
    },
    {
      hash: "c".repeat(64),
      thumbHash: "d".repeat(64),
      width: 800,
      height: 600,
      filename: "IMG_2848.jpg",
    },
  ],
};

const samplePhotos: PhotoEntry[] = sampleManifest.photos;

/** Helper: set up DOM mocks for download trigger */
function setupDownloadMocks() {
  const mockClick = vi.fn();
  const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock");
  const mockRevokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });

  vi.spyOn(document.body, "appendChild").mockImplementation(vi.fn());
  vi.spyOn(document.body, "removeChild").mockImplementation(vi.fn());
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      return { href: "", download: "", click: mockClick } as unknown as HTMLElement;
    }
    return originalCreateElement(tag);
  });

  return { mockClick, mockCreateObjectURL, mockRevokeObjectURL };
}

function cleanupDownloadMocks() {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

describe("useAlbumViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup JSZip mock after clearAllMocks
    MockJSZip.mockImplementation(function () {
      return {
        file: vi.fn(),
        generateAsync: vi.fn().mockResolvedValue(new Blob(["zip-content"])),
      };
    });

    // Re-setup default mocks
    mockResolveAndFetch.mockResolvedValue({
      data: new ArrayBuffer(16),
      server: "https://blossom.example.com",
    });
    mockDecryptAndValidateManifest.mockResolvedValue(sampleManifest);
    mockImportKeyFromBase64url.mockResolvedValue({} as CryptoKey);
    vi.mocked(decryptBlob).mockImplementation(async (buf: Uint8Array) => buf.buffer as ArrayBuffer);

    // Reset location
    Object.defineProperty(window, "location", {
      value: {
        hash: "",
        search: "",
        href: "http://localhost/",
      },
      writable: true,
      configurable: true,
    });
  });

  describe("init — manifest loading", () => {
    it("sets status to error when key is missing from fragment", async () => {
      window.location.hash = "";

      const { result } = renderHook(() => useAlbumViewer({ hash: "a".repeat(64) }));

      await waitFor(() => {
        expect(result.current.status).toBe("error");
      });

      expect(result.current.error).toMatch(/Missing decryption key/i);
      expect(mockResolveAndFetch).not.toHaveBeenCalled();
    });

    it("fetches manifest and transitions to ready", async () => {
      window.location.hash = "#dGVzdGtleQ"; // base64url for "testkey"
      window.location.search = "";

      mockDecryptAndValidateManifest.mockResolvedValue(sampleManifest);

      const { result } = renderHook(() => useAlbumViewer({ hash: "a".repeat(64) }));

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(mockImportKeyFromBase64url).toHaveBeenCalledWith("dGVzdGtleQ");
      expect(mockResolveAndFetch).toHaveBeenCalledWith("a".repeat(64), []);
      expect(result.current.manifest).toEqual(sampleManifest);
      expect(result.current.manifestHash).toBe("a".repeat(64));
      expect(result.current.resolvedServer).toBe("https://blossom.example.com");
      expect(result.current.albumKey).not.toBeNull();
    });

    it("sets status to error when manifest fetch fails", async () => {
      window.location.hash = "#dGVzdGtleQ";
      window.location.search = "";

      mockResolveAndFetch.mockRejectedValue(new Error("Blob not found on any server"));

      const { result } = renderHook(() => useAlbumViewer({ hash: "a".repeat(64) }));

      await waitFor(() => {
        expect(result.current.status).toBe("error");
      });

      expect(result.current.error).toBe("Blob not found on any server");
    });

    it("passes xs hint from URL search params to resolveAndFetch", async () => {
      window.location.hash = "#dGVzdGtleQ";
      window.location.search = "?xs=myblossom.example.com";

      const { result } = renderHook(() => useAlbumViewer({ hash: "a".repeat(64) }));

      await waitFor(() => {
        expect(result.current.status).toBe("ready");
      });

      expect(mockResolveAndFetch).toHaveBeenCalledWith("a".repeat(64), ["myblossom.example.com"]);
    });
  });

  describe("downloadAll (desktop — individual files)", () => {
    it("triggers one download per photo with correct filenames", async () => {
      const fakeKey = {} as CryptoKey;
      const { result } = renderHook(() => useAlbumViewer());

      const { mockClick } = setupDownloadMocks();

      await act(async () => {
        await result.current.downloadAll(samplePhotos, fakeKey, "https://blossom.example.com", "files");
      });

      // On desktop with mode="files", should trigger individual downloads — one click per photo
      expect(mockClick).toHaveBeenCalledTimes(2);
      // JSZip should NOT be used for files mode on desktop
      expect(MockJSZip).not.toHaveBeenCalled();

      cleanupDownloadMocks();
    });

    it("reports progress incrementally", async () => {
      const progressCalls: Array<[number, number]> = [];
      const onProgress = vi.fn().mockImplementation((current: number, total: number) => {
        progressCalls.push([current, total]);
      });

      const fakeKey = {} as CryptoKey;
      const { result } = renderHook(() => useAlbumViewer());

      setupDownloadMocks();

      await act(async () => {
        await result.current.downloadAll(samplePhotos, fakeKey, "https://blossom.example.com", "files", onProgress);
      });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(progressCalls[0]).toEqual([1, 2]);
      expect(progressCalls[1]).toEqual([2, 2]);

      cleanupDownloadMocks();
    });
  });

  describe("downloadSingle", () => {
    it("fetches, decrypts, and triggers download for a single photo", async () => {
      const fakeKey = {} as CryptoKey;
      const { result } = renderHook(() => useAlbumViewer());

      const { mockClick } = setupDownloadMocks();

      await act(async () => {
        await result.current.downloadSingle(samplePhotos[0], fakeKey, "https://blossom.example.com");
      });

      expect(mockResolveAndFetch).toHaveBeenCalledWith("a".repeat(64), []);
      expect(mockClick).toHaveBeenCalledOnce();

      cleanupDownloadMocks();
    });
  });
});
