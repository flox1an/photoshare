// @vitest-environment jsdom
/**
 * RED test scaffolds for src/hooks/useUpload.ts
 * Covers: UPLD-08
 *
 * All tests in this file fail because src/hooks/useUpload.ts does not exist yet.
 * This is the intentional RED state — implementation is in Plan 03-04.
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUpload } from "@/hooks/useUpload";

// Mock RelayPool — simulated via vi.mock
vi.mock("applesauce-relay/pool", () => ({
  RelayPool: vi.fn().mockImplementation(() => ({
    publish: vi.fn(),
  })),
}));

describe("useUpload — share link gate (UPLD-08)", () => {
  it("shareLink remains null when RelayPool returns [{ ok: false }]", async () => {
    const { RelayPool } = await import("applesauce-relay/pool");
    (RelayPool as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      publish: vi.fn().mockResolvedValue([{ ok: false, from: "wss://relay.nostu.be", message: "error" }]),
    }));

    const { result } = renderHook(() => useUpload());
    expect(result.current.shareLink).toBeNull();

    await act(async () => {
      await result.current.startUpload([]);
    });

    expect(result.current.shareLink).toBeNull();
  });

  it("shareLink is non-null string when RelayPool returns [{ ok: true }] and all blobs uploaded (UPLD-08)", async () => {
    const { RelayPool } = await import("applesauce-relay/pool");
    (RelayPool as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      publish: vi.fn().mockResolvedValue([{ ok: true, from: "wss://relay.nostu.be" }]),
    }));

    const { result } = renderHook(() => useUpload());
    expect(result.current.shareLink).toBeNull();

    await act(async () => {
      await result.current.startUpload([]);
    });

    expect(result.current.shareLink).not.toBeNull();
    expect(typeof result.current.shareLink).toBe("string");
  });
});
