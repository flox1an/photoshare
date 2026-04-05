import { SimplePool } from 'nostr-tools';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildAlbumBlobHashList,
  deleteAlbumCleanupRecordEvent,
  fetchAlbumCleanupCandidates,
  publishAlbumCleanupRecord,
} from '@/lib/nostr/albumCleanupRecord';
import { publishMethod } from '@/lib/nostr/relay';

vi.mock('@/lib/nostr/relay', () => ({
  publishMethod: vi.fn().mockResolvedValue(undefined),
}));

const mockPublishMethod = publishMethod as ReturnType<typeof vi.fn>;

describe('albumCleanupRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildAlbumBlobHashList includes manifest + deduped photo hashes', () => {
    const hashes = buildAlbumBlobHashList(
      [
        { hash: 'a', thumbHash: 'b', width: 1, height: 1, filename: '1.jpg' },
        { hash: 'a', thumbHash: 'c', width: 1, height: 1, filename: '2.jpg', origHash: 'd' },
      ],
      'm',
    );

    expect(hashes).toEqual(['m', 'a', 'b', 'c', 'd']);
  });

  it('publishes encrypted kind 30078 cleanup record', async () => {
    const encrypt = vi.fn().mockResolvedValue('nip44-ciphertext');
    const decrypt = vi.fn();
    const signEvent = vi.fn().mockImplementation(async (template) => ({
      ...template,
      id: 'event-id',
      pubkey: 'pubkey',
      sig: 'sig',
    }));
    const signer = {
      getPublicKey: vi.fn().mockResolvedValue('pubkey'),
      signEvent,
      nip44: { encrypt, decrypt },
    };

    const ok = await publishAlbumCleanupRecord({
      signer,
      relays: ['wss://nos.lol'],
      manifestHash: 'f'.repeat(64),
      expiresAtUnix: 1_735_689_600,
      servers: ['https://blossom.example.com/'],
      blobHashes: ['a'.repeat(64), 'b'.repeat(64)],
      albumName: 'Summer 2026',
    });

    expect(ok).toBe(true);
    expect(encrypt).toHaveBeenCalledTimes(1);
    expect(encrypt).toHaveBeenCalledWith(
      'pubkey',
      JSON.stringify({
        v: 1,
        e: 1_735_689_600,
        s: ['https://blossom.example.com'],
        x: ['a'.repeat(64), 'b'.repeat(64)],
        n: 'Summer 2026',
      }),
    );
    expect(signEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishMethod).toHaveBeenCalledTimes(1);
    expect(mockPublishMethod).toHaveBeenCalledWith(
      ['wss://nos.lol'],
      expect.objectContaining({
        kind: 30078,
        tags: [['d', `photoshare:${'f'.repeat(64)}`]],
        content: 'nip44-ciphertext',
      }),
    );
  });

  it('returns false when signer has no nip44 encryption support', async () => {
    const signer = {
      getPublicKey: vi.fn().mockResolvedValue('pubkey'),
      signEvent: vi.fn(),
    };

    const ok = await publishAlbumCleanupRecord({
      signer,
      relays: ['wss://nos.lol'],
      manifestHash: 'f'.repeat(64),
      expiresAtUnix: 1_735_689_600,
      servers: ['https://blossom.example.com'],
      blobHashes: ['a'.repeat(64)],
    });

    expect(ok).toBe(false);
    expect(mockPublishMethod).not.toHaveBeenCalled();
  });

  it('publishes kind 5 event to delete cleanup record event', async () => {
    const signEvent = vi.fn().mockImplementation(async (template) => ({
      ...template,
      id: 'delete-event-id',
      pubkey: 'pubkey',
      sig: 'sig',
    }));
    const signer = {
      getPublicKey: vi.fn().mockResolvedValue('pubkey'),
      signEvent,
      nip44: { encrypt: vi.fn(), decrypt: vi.fn() },
    };

    await deleteAlbumCleanupRecordEvent({
      signer,
      relays: ['wss://nos.lol'],
      recordEventId: 'cleanup-event-id',
    });

    expect(signEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 5,
        tags: [['e', 'cleanup-event-id']],
      }),
    );
    expect(mockPublishMethod).toHaveBeenCalledWith(
      ['wss://nos.lol'],
      expect.objectContaining({ kind: 5 }),
    );
  });

  it('fetches and decrypts latest cleanup candidates by manifest hash', async () => {
    const querySpy = vi.spyOn(SimplePool.prototype as { querySync: unknown }, 'querySync' as never)
      .mockResolvedValue([
        {
          kind: 30078,
          pubkey: 'pubkey',
          created_at: 100,
          content: 'ciphertext-old',
          tags: [['d', 'photoshare:abc']],
          id: '1',
          sig: 'sig1',
        },
        {
          kind: 30078,
          pubkey: 'pubkey',
          created_at: 200,
          content: 'ciphertext-new',
          tags: [['d', 'photoshare:abc']],
          id: '2',
          sig: 'sig2',
        },
      ]);

    const decrypt = vi.fn().mockResolvedValue(
      JSON.stringify({
        v: 1,
        e: 1_735_689_600,
        s: ['https://blossom.example.com'],
        x: ['a'.repeat(64)],
      }),
    );

    const signer = {
      getPublicKey: vi.fn().mockResolvedValue('pubkey'),
      signEvent: vi.fn(),
      nip44: {
        encrypt: vi.fn(),
        decrypt,
      },
    };

    const records = await fetchAlbumCleanupCandidates({
      signer,
      relays: ['wss://nos.lol'],
    });

    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(1);
    expect(records[0].manifestHash).toBe('abc');
    expect(records[0].event.id).toBe('2');
    expect(records[0].payload).toEqual({
      v: 1,
      e: 1_735_689_600,
      s: ['https://blossom.example.com'],
      x: ['a'.repeat(64)],
    });
  });
});
