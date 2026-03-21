import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Lightbox from "@/components/viewer/Lightbox";
import type { PhotoEntry } from "@/types/album";

const samplePhotos: PhotoEntry[] = [
  {
    hash: "aabbcc001",
    iv: "aaaaaaaaaaaa",
    thumbHash: "ddeeff001",
    thumbIv: "bbbbbbbbbbbb",
    width: 1920,
    height: 1080,
    filename: "photo1.jpg",
  },
  {
    hash: "aabbcc002",
    iv: "cccccccccccc",
    thumbHash: "ddeeff002",
    thumbIv: "dddddddddddd",
    width: 800,
    height: 600,
    filename: "photo2.jpg",
  },
  {
    hash: "aabbcc003",
    iv: "eeeeeeeeeeee",
    thumbHash: "ddeeff003",
    thumbIv: "ffffffffffff",
    width: 1024,
    height: 768,
    filename: "photo3.jpg",
  },
];

// Default props for Lightbox — null CryptoKey is fine for navigation tests
const defaultProps = {
  photos: samplePhotos,
  currentIndex: 1,
  thumbUrls: {},
  fullUrls: {},
  albumKey: null,
  resolvedServer: "https://blossom.example.com",
  onNext: vi.fn(),
  onPrev: vi.fn(),
  onClose: vi.fn(),
  onDownload: vi.fn(),
};

describe("Lightbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pressing ArrowRight calls onNext", () => {
    const onNext = vi.fn();
    render(<Lightbox {...defaultProps} onNext={onNext} />);

    fireEvent.keyDown(document, { key: "ArrowRight" });

    expect(onNext).toHaveBeenCalledOnce();
  });

  it("pressing ArrowLeft calls onPrev", () => {
    const onPrev = vi.fn();
    render(<Lightbox {...defaultProps} onPrev={onPrev} />);

    fireEvent.keyDown(document, { key: "ArrowLeft" });

    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("pressing Escape calls onClose", () => {
    const onClose = vi.fn();
    render(<Lightbox {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows photo counter as '{current+1} / {total}'", () => {
    // currentIndex=1, total=3 → should show "2 / 3"
    render(<Lightbox {...defaultProps} currentIndex={1} />);

    expect(screen.getByText("2 / 3")).toBeDefined();
  });

  it("clicking overlay background calls onClose", () => {
    const onClose = vi.fn();
    render(<Lightbox {...defaultProps} onClose={onClose} />);

    const overlay = screen.getByTestId("lightbox-overlay");
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
