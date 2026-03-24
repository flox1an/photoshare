import { describe, expect, it } from 'vitest';
import { buildSignedProfileEvent } from '@/lib/nostr/anonProfile';

describe('buildSignedProfileEvent', () => {
  it('throws when expiration is missing or invalid', () => {
    const privkey = new Uint8Array(32).fill(1);
    expect(() => buildSignedProfileEvent('alice', privkey, 0)).toThrow('Missing or invalid expiration timestamp');
  });

  it('adds expiration tag', () => {
    const privkey = new Uint8Array(32).fill(2);
    const expirationTs = Math.floor(Date.now() / 1000) + 3600;
    const event = buildSignedProfileEvent('alice', privkey, expirationTs);
    expect(event.tags).toContainEqual(['expiration', String(expirationTs)]);
  });
});
