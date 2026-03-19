import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock jszip before importing hook
vi.mock("jszip", () => {
  const mockFile = vi.fn();
  const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(["zip-content"], { type: "application/zip" }));
  const MockJSZip = vi.fn().mockImplementation(() => ({
    file: mockFile,
    generateAsync: mockGenerateAsync,
  }));
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

describe("useAlbumViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock after clearAllMocks
    MockJSZip.mockImplementation(() => ({
      file: vi.fn(),
      generateAsync: vi.fn().mockResolvedValue(new Blob(["zip-content"])),
    }));
  });

  it("downloadAll calls JSZip.file() for each photo with photo.filename", async () => {
    // Mock URL.createObjectURL and anchor element for download trigger
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock");
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });

    const mockAppend = vi.fn();
    const mockClick = vi.fn();
    const mockRemove = vi.fn();
    vi.spyOn(document.body, "appendChild").mockImplementation(mockAppend);
    vi.spyOn(document.body, "removeChild").mockImplementation(mockRemove);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: mockClick } as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    // Create a fake CryptoKey-like object for testing
    const fakeKey = {} as CryptoKey;

    const { result } = renderHook(() => useAlbumViewer());

    await act(async () => {
      await result.current.downloadAll(samplePhotos, fakeKey, "https://blossom.example.com");
    });

    // Get the JSZip instance that was created
    const zipInstance = MockJSZip.mock.results[0].value;

    // zip.file() should be called once per photo with the correct filename
    expect(zipInstance.file).toHaveBeenCalledTimes(2);
    expect(zipInstance.file).toHaveBeenCalledWith("IMG_2847.jpg", expect.any(ArrayBuffer));
    expect(zipInstance.file).toHaveBeenCalledWith("IMG_2848.jpg", expect.any(ArrayBuffer));

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloadAll reports progress incrementally", async () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock");
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });

    vi.spyOn(document.body, "appendChild").mockImplementation(vi.fn());
    vi.spyOn(document.body, "removeChild").mockImplementation(vi.fn());
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: vi.fn() } as unknown as HTMLElement;
      }
      return document.createElement(tag);
    });

    const progressCalls: Array<[number, number]> = [];
    const onProgress = vi.fn().mockImplementation((current: number, total: number) => {
      progressCalls.push([current, total]);
    });

    const fakeKey = {} as CryptoKey;
    const { result } = renderHook(() => useAlbumViewer());

    await act(async () => {
      await result.current.downloadAll(samplePhotos, fakeKey, "https://blossom.example.com", onProgress);
    });

    // Should have called onProgress with (1, 2) and (2, 2)
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(progressCalls[0]).toEqual([1, 2]);
    expect(progressCalls[1]).toEqual([2, 2]);

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
