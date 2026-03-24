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
  const mockEnsureEncryptedContentCachePersistence = vi.fn();
  const mockEventStoreAdd = vi.fn((event: NostrEvent) => event);
  const mockSetCursor = vi.fn(async (_key: string, _cursor: unknown) => {});
  const mockGetCursor = vi.fn(async (_key: string): Promise<{ maxCreatedAt: number; idsAtMaxTs: string[] } | null> => null);
  const mockGetEvents = vi.fn(async (_key: string): Promise<NostrEvent[]> => []);
  const mockPutEvent = vi.fn(async () => {});
  const mockGetReactionWrapCache = vi.fn(() => ({
    getCursor: mockGetCursor,
    setCursor: mockSetCursor,
    getEvents: mockGetEvents,
    putEvent: mockPutEvent,
  }));
  const mockUnwrapGiftWrap = vi.fn();

  return {
    state,
    unsubscribeMock,
    mockSubscribeEvents,
    mockEnsureEncryptedContentCachePersistence,
    mockEventStoreAdd,
    mockSetCursor,
    mockGetCursor,
    mockGetEvents,
    mockPutEvent,
    mockGetReactionWrapCache,
    mockUnwrapGiftWrap,
  };
});

vi.mock('@/lib/crypto', () => ({
  nsecToPubkey: vi.fn(() => 'album-pubkey'),
}));

vi.mock('@/lib/nostr/relay', () => ({
  subscribeEvents: h.mockSubscribeEvents,
  publishMethod: vi.fn(async () => {}),
}));

vi.mock('@/lib/nostr/encryptedContentCache', () => ({
  ensureEncryptedContentCachePersistence: h.mockEnsureEncryptedContentCachePersistence,
}));

vi.mock('@/lib/nostr/reactionWrapCache', () => ({
  getReactionWrapCache: h.mockGetReactionWrapCache,
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
  createGiftWrap: vi.fn(),
  buildReactionRumor: vi.fn(),
  buildCommentRumor: vi.fn(),
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

describe('useReactions cursor + wrap cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state.relayOnevent = null;
    h.state.relayOneose = null;
    h.mockGetReactionWrapCache.mockReturnValue({
      getCursor: h.mockGetCursor,
      setCursor: h.mockSetCursor,
      getEvents: h.mockGetEvents,
      putEvent: h.mockPutEvent,
    });
    h.mockUnwrapGiftWrap.mockImplementation(async (event: NostrEvent) => reactionRumor(event.created_at));
  });

  it('hydrates cached wraps, subscribes with since cursor, and dedupes same-timestamp boundary ids', async () => {
    h.mockGetCursor.mockResolvedValueOnce({ maxCreatedAt: 100, idsAtMaxTs: ['e100'] });
    h.mockGetEvents.mockResolvedValueOnce([wrapEvent('e090', 90)]);

    const { result } = renderHook(() =>
      useReactions(manifest, nsecBytes, 'manifest-1'),
    );

    await waitFor(() => {
      expect(h.mockSubscribeEvents).toHaveBeenCalledTimes(1);
    });

    const [, filter] = h.mockSubscribeEvents.mock.calls[0];
    expect(filter).toMatchObject({
      kinds: [1059],
      '#p': ['album-pubkey'],
      since: 100,
    });

    await waitFor(() => {
      const perPhoto = result.current.reactionsByPhoto.get('photo-hash-1');
      expect(perPhoto?.reactions.length).toBe(1);
    });

    expect(h.mockUnwrapGiftWrap).toHaveBeenCalledTimes(1); // cached event only so far
    expect(h.mockPutEvent).not.toHaveBeenCalled(); // cache hydration must not re-persist

    act(() => {
      h.state.relayOnevent?.(wrapEvent('e100', 100)); // boundary duplicate from cursor
    });

    await waitFor(() => {
      expect(h.mockUnwrapGiftWrap).toHaveBeenCalledTimes(1);
    });

    act(() => {
      h.state.relayOnevent?.(wrapEvent('e101', 100)); // new id at boundary ts
    });

    await waitFor(() => {
      expect(h.mockUnwrapGiftWrap).toHaveBeenCalledTimes(2);
      expect(h.mockPutEvent).toHaveBeenCalledTimes(1);
      expect(h.mockPutEvent).toHaveBeenCalledWith('manifest-1:album-pubkey', expect.objectContaining({ id: 'e101' }));
    });

    act(() => {
      h.state.relayOneose?.();
    });

    await waitFor(() => {
      expect(h.mockSetCursor).toHaveBeenCalled();
    });

    const persistedCursor = h.mockSetCursor.mock.calls.at(-1)![1] as { maxCreatedAt: number; idsAtMaxTs: string[] };
    expect(persistedCursor.maxCreatedAt).toBe(100);
    expect(new Set(persistedCursor.idsAtMaxTs)).toEqual(new Set(['e100', 'e101']));
  });

  it('omits since on first load when no cursor exists', async () => {
    h.mockGetCursor.mockResolvedValueOnce(null);
    h.mockGetEvents.mockResolvedValueOnce([]);

    renderHook(() =>
      useReactions(manifest, nsecBytes, 'manifest-2'),
    );

    await waitFor(() => {
      expect(h.mockSubscribeEvents).toHaveBeenCalledTimes(1);
    });

    const [, filter] = h.mockSubscribeEvents.mock.calls[0];
    expect(filter).toMatchObject({
      kinds: [1059],
      '#p': ['album-pubkey'],
    });
    expect(filter.since).toBeUndefined();
  });
});
