import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ThumbnailGrid from "@/components/viewer/ThumbnailGrid";
import type { PhotoEntry } from "@/types/album";

// Sample PhotoEntry fixtures
const samplePhotos: PhotoEntry[] = [
  {
    hash: "aabbcc001",
    thumbHash: "ddeeff001",
    width: 1920,
    height: 1080,
    filename: "photo1.jpg",
  },
  {
    hash: "aabbcc002",
    thumbHash: "ddeeff002",
    width: 800,
    height: 600,
    filename: "photo2.jpg",
  },
];

describe("ThumbnailGrid", () => {
  let mockObserverCallback: IntersectionObserverCallback;
  let observedElements: Element[];

  beforeEach(() => {
    observedElements = [];

    // Mock IntersectionObserver — immediately fires callback with isIntersecting: true
    window.IntersectionObserver = vi.fn().mockImplementation((callback: IntersectionObserverCallback) => {
      mockObserverCallback = callback;
      return {
        observe: (el: Element) => {
          observedElements.push(el);
          // Fire immediately with isIntersecting: true
          const entry = { isIntersecting: true, target: el } as unknown as IntersectionObserverEntry;
          callback([entry], {} as IntersectionObserver);
        },
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders N skeleton cards when photos array has N entries and no objectUrls loaded", () => {
    const loadThumbnail = vi.fn();
    const onPhotoClick = vi.fn();

    render(
      <ThumbnailGrid
        photos={samplePhotos}
        objectUrls={{}}
        loadThumbnail={loadThumbnail}
        onPhotoClick={onPhotoClick}
      />,
    );

    // Should render 2 skeleton cards (data-testid="skeleton-card") when no objectUrls
    const skeletons = screen.getAllByTestId("skeleton-card");
    expect(skeletons).toHaveLength(2);
  });

  it("calls loadThumbnail(index) when IntersectionObserver fires for that index", () => {
    const loadThumbnail = vi.fn();
    const onPhotoClick = vi.fn();

    render(
      <ThumbnailGrid
        photos={samplePhotos}
        objectUrls={{}}
        loadThumbnail={loadThumbnail}
        onPhotoClick={onPhotoClick}
      />,
    );

    // IntersectionObserver fires immediately on observe in our mock
    // loadThumbnail should have been called for each photo index
    expect(loadThumbnail).toHaveBeenCalledWith(0);
    expect(loadThumbnail).toHaveBeenCalledWith(1);
  });

  it("renders img elements when objectUrls are provided for photos", () => {
    const loadThumbnail = vi.fn();
    const onPhotoClick = vi.fn();
    const objectUrls: Record<string, string> = {
      "ddeeff001": "blob:http://localhost/thumb-1",
      "ddeeff002": "blob:http://localhost/thumb-2",
    };

    render(
      <ThumbnailGrid
        photos={samplePhotos}
        objectUrls={objectUrls}
        loadThumbnail={loadThumbnail}
        onPhotoClick={onPhotoClick}
      />,
    );

    // Should render 2 img elements with the provided object URLs
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).toHaveAttribute("src", "blob:http://localhost/thumb-1");
    expect(imgs[1]).toHaveAttribute("src", "blob:http://localhost/thumb-2");
  });
});
