import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimplePool } from 'nostr-tools';
import { resolveUserOutboxRelays } from '@/lib/nostr/relayList';

describe('relayList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses write relays from kind 10002 when present', async () => {
    vi.spyOn(SimplePool.prototype as { get: unknown }, 'get' as never)
      .mockResolvedValue({
        kind: 10002,
        pubkey: 'pubkey',
        created_at: 100,
        content: '',
        tags: [
          ['r', 'wss://write-a.example', 'write'],
          ['r', 'wss://read-a.example', 'read'],
          ['r', 'wss://both.example'],
        ],
        id: 'id',
        sig: 'sig',
      });

    const relays = await resolveUserOutboxRelays('pubkey', ['wss://fallback.example']);
    expect(relays).toEqual(['wss://write-a.example', 'wss://both.example']);
  });

  it('falls back when no relay list metadata exists', async () => {
    vi.spyOn(SimplePool.prototype as { get: unknown }, 'get' as never)
      .mockResolvedValue(null);

    const relays = await resolveUserOutboxRelays('pubkey-2', ['wss://fallback.example']);
    expect(relays).toEqual(['wss://fallback.example']);
  });
});
