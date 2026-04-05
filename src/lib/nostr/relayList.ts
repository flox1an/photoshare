import { SimplePool } from 'nostr-tools';
import type { NostrEvent } from 'nostr-tools';

const RELAY_LIST_KIND = 10002;
const DEFAULT_DISCOVERY_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://nos.lol',
];

const pool = new SimplePool();
const writeRelayCache = new Map<string, string[]>();

function normalizeRelay(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function dedupe(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeRelay(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

interface ParsedRelayList {
  read: string[];
  write: string[];
}

function parseRelayList(event: NostrEvent): ParsedRelayList {
  const read: string[] = [];
  const write: string[] = [];

  for (const tag of event.tags) {
    if (tag[0] !== 'r' || typeof tag[1] !== 'string') continue;
    const relay = tag[1];
    const marker = (tag[2] ?? '').toLowerCase();

    if (!marker || marker === 'write') write.push(relay);
    if (!marker || marker === 'read') read.push(relay);
  }

  return {
    read: dedupe(read),
    write: dedupe(write),
  };
}

export async function resolveUserOutboxRelays(
  pubkey: string,
  fallbackRelays: string[],
  discoveryRelays: string[] = DEFAULT_DISCOVERY_RELAYS,
): Promise<string[]> {
  const cached = writeRelayCache.get(pubkey);
  if (cached && cached.length > 0) return cached;

  const fallback = dedupe(fallbackRelays);
  const discovery = dedupe(discoveryRelays);
  if (discovery.length === 0) return fallback;

  try {
    const event = await pool.get(discovery, {
      kinds: [RELAY_LIST_KIND],
      authors: [pubkey],
      limit: 1,
    });
    if (!event) return fallback;

    const parsed = parseRelayList(event);
    const outbox = parsed.write.length > 0 ? parsed.write : fallback;
    writeRelayCache.set(pubkey, outbox);
    return outbox;
  } catch {
    return fallback;
  }
}
