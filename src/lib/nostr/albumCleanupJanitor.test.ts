import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCleanupNow } from '@/lib/nostr/albumCleanupJanitor';
import {
  buildBlossomDeleteBatchAuth,
  chunkHashesForAuth,
  deleteBlob,
} from '@/lib/blossom/upload';
import { deleteAlbumCleanupRecordEvent } from '@/lib/nostr/albumCleanupRecord';

vi.mock('@/lib/blossom/upload', () => ({
  buildBlossomDeleteBatchAuth: vi.fn().mockResolvedValue('Nostr auth'),
  chunkHashesForAuth: vi.fn((hashes: string[]) => [hashes]),
  deleteBlob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/nostr/albumCleanupRecord', async () => {
  const actual = await vi.importActual('@/lib/nostr/albumCleanupRecord');
  return {
    ...(actual as Record<string, unknown>),
    deleteAlbumCleanupRecordEvent: vi.fn().mockResolvedValue(undefined),
  };
});

const mockBuildDeleteBatchAuth = buildBlossomDeleteBatchAuth as ReturnType<typeof vi.fn>;
const mockChunkHashesForAuth = chunkHashesForAuth as ReturnType<typeof vi.fn>;
const mockDeleteBlob = deleteBlob as ReturnType<typeof vi.fn>;
const mockDeleteRecordEvent = deleteAlbumCleanupRecordEvent as ReturnType<typeof vi.fn>;

describe('albumCleanupJanitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes expired blobs and then deletes the cleanup record event', async () => {
    const result = await runCleanupNow({
      signer: {
        getPublicKey: vi.fn(),
        signEvent: vi.fn(),
        nip44: { encrypt: vi.fn(), decrypt: vi.fn() },
      },
      relays: ['wss://nos.lol'],
      nowUnix: 200,
      records: [
        {
          manifestHash: 'a'.repeat(64),
          payload: {
            v: 1,
            e: 100,
            s: ['https://blossom.example.com'],
            x: ['1'.repeat(64), '2'.repeat(64)],
          },
          event: {
            id: 'event-1',
            kind: 30078,
            pubkey: 'pubkey',
            created_at: 1,
            tags: [['d', `photoshare:${'a'.repeat(64)}`]],
            content: 'cipher',
            sig: 'sig',
          },
        },
      ],
    });

    expect(mockChunkHashesForAuth).toHaveBeenCalledTimes(1);
    expect(mockBuildDeleteBatchAuth).toHaveBeenCalledTimes(1);
    expect(mockDeleteBlob).toHaveBeenCalledTimes(2);
    expect(mockDeleteRecordEvent).toHaveBeenCalledTimes(1);
    expect(result.fullyDeletedRecords).toBe(1);
    expect(result.blobDeleteFailures).toBe(0);
  });

  it('keeps cleanup record when any blob delete fails', async () => {
    mockDeleteBlob
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('delete failed'));

    const result = await runCleanupNow({
      signer: {
        getPublicKey: vi.fn(),
        signEvent: vi.fn(),
        nip44: { encrypt: vi.fn(), decrypt: vi.fn() },
      },
      relays: ['wss://nos.lol'],
      nowUnix: 200,
      records: [
        {
          manifestHash: 'a'.repeat(64),
          payload: {
            v: 1,
            e: 100,
            s: ['https://blossom.example.com'],
            x: ['1'.repeat(64), '2'.repeat(64)],
          },
          event: {
            id: 'event-1',
            kind: 30078,
            pubkey: 'pubkey',
            created_at: 1,
            tags: [['d', `photoshare:${'a'.repeat(64)}`]],
            content: 'cipher',
            sig: 'sig',
          },
        },
      ],
    });

    expect(mockDeleteRecordEvent).not.toHaveBeenCalled();
    expect(result.fullyDeletedRecords).toBe(0);
    expect(result.failedRecordEventIds).toEqual(['event-1']);
  });

  it('treats 404 delete errors as successful cleanup', async () => {
    mockDeleteBlob
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Blossom delete failed with status 404'));

    const result = await runCleanupNow({
      signer: {
        getPublicKey: vi.fn(),
        signEvent: vi.fn(),
        nip44: { encrypt: vi.fn(), decrypt: vi.fn() },
      },
      relays: ['wss://nos.lol'],
      nowUnix: 200,
      records: [
        {
          manifestHash: 'a'.repeat(64),
          payload: {
            v: 1,
            e: 100,
            s: ['https://blossom.example.com'],
            x: ['1'.repeat(64), '2'.repeat(64)],
          },
          event: {
            id: 'event-1',
            kind: 30078,
            pubkey: 'pubkey',
            created_at: 1,
            tags: [['d', `photoshare:${'a'.repeat(64)}`]],
            content: 'cipher',
            sig: 'sig',
          },
        },
      ],
    });

    expect(result.blobDeleteFailures).toBe(0);
    expect(result.fullyDeletedRecords).toBe(1);
    expect(mockDeleteRecordEvent).toHaveBeenCalledTimes(1);
  });

  it('falls back to single-hash auth when multi-hash auth is rejected', async () => {
    mockDeleteBlob
      .mockRejectedValueOnce(new Error('Blossom delete failed with status 403'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const result = await runCleanupNow({
      signer: {
        getPublicKey: vi.fn(),
        signEvent: vi.fn(),
        nip44: { encrypt: vi.fn(), decrypt: vi.fn() },
      },
      relays: ['wss://nos.lol'],
      nowUnix: 200,
      records: [
        {
          manifestHash: 'a'.repeat(64),
          payload: {
            v: 1,
            e: 100,
            s: ['https://blossom.example.com'],
            x: ['1'.repeat(64), '2'.repeat(64)],
          },
          event: {
            id: 'event-1',
            kind: 30078,
            pubkey: 'pubkey',
            created_at: 1,
            tags: [['d', `photoshare:${'a'.repeat(64)}`]],
            content: 'cipher',
            sig: 'sig',
          },
        },
      ],
    });

    expect(result.blobDeleteFailures).toBe(0);
    expect(result.fullyDeletedRecords).toBe(1);
    expect(mockBuildDeleteBatchAuth).toHaveBeenCalledTimes(2);
    expect(mockDeleteBlob).toHaveBeenCalledTimes(3);
  });

  it('runs cleanup with at most 3 records in parallel', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockDeleteBlob.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
    });

    const records = Array.from({ length: 6 }, (_, idx) => ({
      manifestHash: `${String(idx + 1).repeat(64)}`,
      payload: {
        v: 1 as const,
        e: 100,
        s: ['https://blossom.example.com'],
        x: [`${String(idx + 1).repeat(64)}`],
      },
      event: {
        id: `event-${idx + 1}`,
        kind: 30078 as const,
        pubkey: 'pubkey',
        created_at: 1,
        tags: [['d', `photoshare:${String(idx + 1).repeat(64)}`]],
        content: 'cipher',
        sig: 'sig',
      },
    }));

    const result = await runCleanupNow({
      signer: {
        getPublicKey: vi.fn(),
        signEvent: vi.fn(),
        nip44: { encrypt: vi.fn(), decrypt: vi.fn() },
      },
      relays: ['wss://nos.lol'],
      nowUnix: 200,
      records,
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(result.fullyDeletedRecords).toBe(6);
    expect(mockDeleteRecordEvent).toHaveBeenCalledTimes(6);
  });
});
