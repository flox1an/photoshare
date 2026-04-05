// @vitest-environment jsdom
/**
 * Tests for src/hooks/useSettings.ts
 * Covers: CONF-02
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_BLOSSOM_SERVER } from "@/lib/config";
import { useNostrAccountStore } from "@/store/nostrAccountStore";
import { fetchUserSettingsConfig, publishUserSettingsConfig } from "@/lib/nostr/appSettings";
import { resolveUserOutboxRelays } from "@/lib/nostr/relayList";

vi.mock("@/lib/blossom/validate", () => ({
  validateBlossomServer: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/nostr/appSettings", () => ({
  fetchUserSettingsConfig: vi.fn().mockResolvedValue(null),
  publishUserSettingsConfig: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/nostr/relayList", () => ({
  resolveUserOutboxRelays: vi.fn().mockResolvedValue(["wss://nos.lol"]),
}));

describe("useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useNostrAccountStore.setState({
      pubkey: null,
      signer: null,
      type: null,
      bunkerUri: null,
      restoring: false,
    });
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

  it("uses encrypted user config for logged-in users and keeps anon local config separate", async () => {
    localStorage.setItem("keep-originals", "true");
    localStorage.setItem("blossom-servers", JSON.stringify(["https://anon.server"]));

    vi.mocked(fetchUserSettingsConfig).mockResolvedValue({
      v: 1,
      blossomServers: ["https://user.server"],
      keepOriginals: false,
      expiration: 86_400,
      reactionsEnabled: true,
      reactionRelays: ["wss://relay.user"],
    });

    const { result } = renderHook(() => useSettings());
    expect(result.current.keepOriginals).toBe(true);
    expect(result.current.blossomServers).toEqual(["https://anon.server"]);

    const fakeSigner = {
      getPublicKey: vi.fn().mockResolvedValue("pubkey1"),
      signEvent: vi.fn(),
      nip44: {
        encrypt: vi.fn(),
        decrypt: vi.fn(),
      },
    } as never;

    act(() => {
      useNostrAccountStore.getState().login("extension", fakeSigner, "pubkey1");
    });

    await waitFor(() => {
      expect(result.current.blossomServers).toEqual(["https://user.server"]);
      expect(result.current.keepOriginals).toBe(false);
    });

    act(() => {
      result.current.setKeepOriginals(true);
    });

    await waitFor(() => {
      expect(publishUserSettingsConfig).toHaveBeenCalled();
    });
    expect(resolveUserOutboxRelays).toHaveBeenCalledWith("pubkey1", ["wss://relay.user"]);

    act(() => {
      useNostrAccountStore.getState().logout();
    });

    await waitFor(() => {
      expect(result.current.keepOriginals).toBe(true);
      expect(result.current.blossomServers).toEqual(["https://anon.server"]);
    });
  });
});
