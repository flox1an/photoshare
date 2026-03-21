// @vitest-environment jsdom
/**
 * Tests for src/hooks/useSettings.ts
 * Covers: CONF-02
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_BLOSSOM_SERVER } from "@/lib/config";

vi.mock("@/lib/blossom/validate", () => ({
  validateBlossomServer: vi.fn().mockResolvedValue(true),
}));

describe("useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initial blossomServer falls back to DEFAULT_BLOSSOM_SERVER when localStorage is empty (CONF-02)", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.blossomServer).toBe(DEFAULT_BLOSSOM_SERVER);
    expect(result.current.blossomServers).toEqual([DEFAULT_BLOSSOM_SERVER]);
  });

  it("addBlossomServer appends a validated server to the list", async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.addBlossomServer("https://other.server");
    });

    expect(result.current.blossomServers).toContain("https://other.server");
    const stored = JSON.parse(localStorage.getItem("blossom-servers") ?? "[]") as string[];
    expect(stored).toContain("https://other.server");
  });

  it("removeBlossomServer removes a server by index", async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.addBlossomServer("https://other.server");
    });

    act(() => {
      result.current.removeBlossomServer(1);
    });

    expect(result.current.blossomServers).not.toContain("https://other.server");
  });

  it("migrates legacy blossom-server key on first load", () => {
    localStorage.setItem("blossom-server", "https://legacy.server");
    const { result } = renderHook(() => useSettings());
    expect(result.current.blossomServer).toBe("https://legacy.server");
    expect(result.current.blossomServers).toEqual(["https://legacy.server"]);
  });
});
