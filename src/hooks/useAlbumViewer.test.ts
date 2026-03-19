import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock jszip before importing hook
vi.mock("jszip", () => {
  const mockFile = vi.fn();
  const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(["zip-content"], { type: "application/zip" }));
  // vitest 4.x requires function() (not arrow) for constructor mocks
  const MockJSZip = vi.fn().mockImplementation(function () {
    return {
      file: mockFile,
      generateAsync: mockGenerateAsync,
    };
  });
  return { default: MockJSZip };
});

// Mock fetchBlob
vi.mock("@/lib/blossom/fetch", () => ({
  fetchBlob: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
}));

// Mock crypto decryptBlob — returns input as-is
vi.mock("@/lib/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto")>();
  return {
    ...actual,
    decryptBlob: vi.fn().mockImplementation(async (buf: ArrayBuffer) => buf),
  };
});

import JSZip from "jszip";
import { fetchBlob } from "@/lib/blossom/fetch";
import { useAlbumViewer } from "@/hooks/useAlbumViewer";
import { renderHook, act } from "@testing-library/react";
import type { PhotoEntry } from "@/types/album";

const MockJSZip = vi.mocked(JSZip);

const samplePhotos: PhotoEntry[] = [
  {
    hash: "aabbcc001",
    iv: "aaaaaaaaaaaa",
    thumbHash: "ddeeff001",
    thumbIv: "bbbbbbbbbbbb",
    width: 1920,
    height: 1080,
    filename: "IMG_2847.jpg",
  },
  {
    hash: "aabbcc002",
    iv: "cccccccccccc",
    thumbHash: "ddeeff002",
    thumbIv: "dddddddddddd",
    width: 800,
    height: 600,
    filename: "IMG_2848.jpg",
  },
];

/** Helper: set up DOM mocks for download trigger (createElement('a'), URL API) */
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
    // Re-setup mock after clearAllMocks
    // vitest 4.x requires function() (not arrow) for constructor mocks
    MockJSZip.mockImplementation(function () {
      return {
        file: vi.fn(),
        generateAsync: vi.fn().mockResolvedValue(new Blob(["zip-content"])),
      };
    });
  });

  describe("downloadAll (desktop — individual files)", () => {
    it("triggers one download per photo with correct filenames", async () => {
      const fakeKey = {} as CryptoKey;
      const { result } = renderHook(() => useAlbumViewer());

      const { mockClick } = setupDownloadMocks();

      await act(async () => {
        await result.current.downloadAll(samplePhotos, fakeKey, "https://blossom.example.com");
      });

      // On desktop (no iOS UA), should trigger individual downloads — one click per photo
      expect(mockClick).toHaveBeenCalledTimes(2);
      // JSZip should NOT be used on desktop
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
        await result.current.downloadAll(samplePhotos, fakeKey, "https://blossom.example.com", onProgress);
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

      expect(fetchBlob).toHaveBeenCalledWith("https://blossom.example.com", "aabbcc001");
      expect(mockClick).toHaveBeenCalledOnce();

      cleanupDownloadMocks();
    });
  });
});
