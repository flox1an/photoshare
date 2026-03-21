// @vitest-environment jsdom
/**
 * Tests for src/hooks/useSettings.ts
 * Covers: CONF-02
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_BLOSSOM_SERVER } from "@/lib/config";

describe("useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initial blossomServer falls back to DEFAULT_BLOSSOM_SERVER when localStorage is empty (CONF-02)", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.blossomServer).toBe(DEFAULT_BLOSSOM_SERVER);
  });

  it("after setBlossomServer('https://other.server'), localStorage equals 'https://other.server' (CONF-02)", async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      result.current.setBlossomServer("https://other.server");
    });

    expect(localStorage.getItem("blossom-server")).toBe("https://other.server");
  });
});
