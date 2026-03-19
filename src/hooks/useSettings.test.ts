// @vitest-environment jsdom
/**
 * RED test scaffolds for src/hooks/useSettings.ts
 * Covers: CONF-01, CONF-02
 *
 * All tests in this file fail because src/hooks/useSettings.ts does not exist yet.
 * This is the intentional RED state — implementation is in Plan 03-04.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_RELAYS, DEFAULT_BLOSSOM_SERVER } from "@/lib/config";

describe("useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initial relays falls back to DEFAULT_RELAYS when localStorage is empty (CONF-01)", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.relays).toEqual(DEFAULT_RELAYS);
  });

  it("after setRelays(['wss://custom.relay']), localStorage contains the value (CONF-01)", async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      result.current.setRelays(["wss://custom.relay"]);
    });

    const stored = localStorage.getItem("nostr-relays");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(["wss://custom.relay"]);
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
