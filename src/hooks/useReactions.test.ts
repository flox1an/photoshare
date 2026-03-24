// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import type { AlbumManifest } from '@/types/album';

const h = vi.hoisted(() => {
  const state: {
    relayOnevent: ((event: NostrEvent) => void) | null;
    relayOneose: (() => void) | null;
  } = {
    relayOnevent: null,
    relayOneose: null,
  };

  const unsubscribeMock = vi.fn();
  const mockSubscribeEvents = vi.fn(
    (
      _relays: string[],
      _filter: Record<string, unknown>,
      onevent: (event: NostrEvent) => void,
      oneose?: () => void,
    ) => {
      state.relayOnevent = onevent;
      state.relayOneose = oneose ?? null;
      return unsubscribeMock;
    },
  );
  const mockEventStoreAdd = vi.fn((event: NostrEvent) => event);
  const mockUnwrapGiftWrap = vi.fn();
  const mockCreateGiftWrap = vi.fn();
  const mockBuildReactionRumor = vi.fn();
  const mockBuildCommentRumor = vi.fn();
  const mockPublishMethod = vi.fn(async () => {});

  return {
    state,
    unsubscribeMock,
    mockSubscribeEvents,
    mockEventStoreAdd,
    mockUnwrapGiftWrap,
    mockCreateGiftWrap,
    mockBuildReactionRumor,
    mockBuildCommentRumor,
    mockPublishMethod,
  };
});

vi.mock('@/lib/crypto', () => ({
  nsecToPubkey: vi.fn(() => 'album-pubkey'),
}));

vi.mock('@/lib/nostr/relay', () => ({
  subscribeEvents: h.mockSubscribeEvents,
  publishMethod: h.mockPublishMethod,
}));

vi.mock('@/lib/nostr/eventStore', () => ({
  eventStore: { add: h.mockEventStoreAdd },
}));

vi.mock('@/store/nostrAccountStore', () => ({
  useNostrAccountStore: vi.fn(() => null),
}));

vi.mock('@/lib/nostr/anonIdentity', () => ({
  getAnonKeypair: vi.fn(() => ({ pubkey: 'anon-pub', privkey: new Uint8Array(32) })),
}));

vi.mock('@/lib/nostr/nip59', () => ({
  unwrapGiftWrap: h.mockUnwrapGiftWrap,
  createGiftWrap: h.mockCreateGiftWrap,
  buildReactionRumor: h.mockBuildReactionRumor,
  buildCommentRumor: h.mockBuildCommentRumor,
}));

import { useReactions } from '@/hooks/useReactions';

const manifest: AlbumManifest = {
  v: 2,
  createdAt: '2026-03-24T00:00:00Z',
  photos: [
    {
      hash: 'photo-hash-1',
      thumbHash: 'thumb-hash-1',
      width: 1200,
      height: 800,
      filename: 'p1.jpg',
    },
  ],
  reactions: { relays: ['wss://relay.example.com'] },
};
const manifestWithExpiration: AlbumManifest = {
  ...manifest,
  expiresAt: '2026-03-25T00:00:00Z',
};
const nsecBytes = new Uint8Array([1, 2, 3]);

function wrapEvent(id: string, createdAt: number): NostrEvent {
  return {
    id,
    pubkey: 'sender-pub',
    created_at: createdAt,
    kind: 1059,
    tags: [['p', 'album-pubkey']],
    content: 'encrypted',
    sig: 'f'.repeat(128),
  };
}

function reactionRumor(createdAt: number) {
  return {
    kind: 7 as const,
    pubkey: 'rumor-pub',
    created_at: createdAt,
    tags: [['img', 'photo-hash-1']],
    content: '+',
  };
}

describe('useReactions cursor + session cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state.relayOnevent = null;
    h.state.relayOneose = null;
    h.mockUnwrapGiftWrap.mockImplementation((event: NostrEvent) => reactionRumor(event.created_at));
    h.mockBuildReactionRumor.mockReturnValue(reactionRumor(123));
    h.mockCreateGiftWrap.mockReturnValue(wrapEvent('gift-1', 124));
  });

  it('subscribes without since on first load', () => {
    renderHook(() => useReactions(manifest, nsecBytes, 'manifest-1'));

    expect(h.mockSubscribeEvents).toHaveBeenCalledTimes(1);
    const [, filter] = h.mockSubscribeEvents.mock.calls[0];
    expect(filter).not.toHaveProperty('since');
    expect(filter).toMatchObject({ kinds: [1059], '#p': ['album-pubkey'] });
  });

  it('processes relay events and updates reactionsByPhoto', async () => {
    const { result } = renderHook(() =>
      useReactions(manifest, nsecBytes, 'manifest-1'),
    );

    act(() => {
      h.state.relayOnevent?.(wrapEvent('e001', 100));
    });

    await waitFor(() => {
      const perPhoto = result.current.reactionsByPhoto.get('photo-hash-1');
      expect(perPhoto?.reactions.length).toBe(1);
    });
  });

  it('deduplicates boundary-timestamp events', async () => {
    const { result } = renderHook(() =>
      useReactions(manifest, nsecBytes, 'manifest-2'),
    );

    act(() => { h.state.relayOnevent?.(wrapEvent('e100', 100)); });
    await waitFor(() => expect(result.current.reactionsByPhoto.get('photo-hash-1')?.reactions.length).toBe(1));

    // Same id at same timestamp — must be ignored
    act(() => { h.state.relayOnevent?.(wrapEvent('e100', 100)); });
    await waitFor(() => expect(h.mockUnwrapGiftWrap).toHaveBeenCalledTimes(1));
  });

  it('sets loading=false on EOSE', async () => {
    const { result } = renderHook(() =>
      useReactions(manifest, nsecBytes, 'manifest-3'),
    );

    expect(result.current.loading).toBe(true);

    act(() => { h.state.relayOneose?.(); });

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('does not publish reaction events when manifest expiration is missing', async () => {
    const { result } = renderHook(() =>
      useReactions(manifest, nsecBytes, 'manifest-4'),
    );

    await act(async () => {
      await result.current.react('photo-hash-1');
    });

    expect(h.mockBuildReactionRumor).not.toHaveBeenCalled();
    expect(h.mockCreateGiftWrap).not.toHaveBeenCalled();
    expect(h.mockPublishMethod).not.toHaveBeenCalled();
  });

  it('publishes reaction events with expiration when manifest expiration exists', async () => {
    const { result } = renderHook(() =>
      useReactions(manifestWithExpiration, nsecBytes, 'manifest-5'),
    );
    const expectedExpiration = Math.floor(new Date(manifestWithExpiration.expiresAt!).getTime() / 1000);

    await act(async () => {
      await result.current.react('photo-hash-1');
    });

    expect(h.mockBuildReactionRumor).toHaveBeenCalledWith(
      'photo-hash-1',
      'manifest-5',
      '+',
      'anon-pub',
      expectedExpiration,
    );
    expect(h.mockCreateGiftWrap).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Uint8Array),
      'album-pubkey',
      expectedExpiration,
    );
    expect(h.mockPublishMethod).toHaveBeenCalledTimes(1);
  });
});
