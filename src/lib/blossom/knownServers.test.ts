// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatExpiry, getKnownServer } from '@/lib/blossom/knownServers';

describe('getKnownServer', () => {
  it('returns metadata for tempstore', () => {
    const result = getKnownServer('https://tempstore.apps3.slidestr.net');
    expect(result).toEqual({ name: 'Temp Store', maxExpirySeconds: 86_400 });
  });

  it('returns metadata for primal (permanent)', () => {
    const result = getKnownServer('https://blossom.primal.net');
    expect(result).toEqual({ name: 'Primal', maxExpirySeconds: null });
  });

  it('returns null for an unknown server', () => {
    expect(getKnownServer('https://unknown.example.com')).toBeNull();
  });

  it('ignores trailing slashes in the URL', () => {
    expect(getKnownServer('https://tempstore.apps3.slidestr.net/')).not.toBeNull();
  });

  it('ignores paths in the URL', () => {
    expect(getKnownServer('https://tempstore.apps3.slidestr.net/some/path')).not.toBeNull();
  });
});

describe('formatExpiry', () => {
  it('formats common durations', () => {
    expect(formatExpiry(3_600)).toBe('1 hour');
    expect(formatExpiry(86_400)).toBe('1 day');
    expect(formatExpiry(604_800)).toBe('1 week');
  });

  it('pluralizes units', () => {
    expect(formatExpiry(172_800)).toBe('2 days');
    expect(formatExpiry(7_776_000)).toBe('3 months');
  });
});
