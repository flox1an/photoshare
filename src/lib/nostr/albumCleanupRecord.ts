import { SimplePool } from 'nostr-tools';
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import type { PhotoEntry } from '@/types/album';
import { publishMethod } from '@/lib/nostr/relay';

const APP_DATA_KIND = 30078;
const APP_DATA_NAMESPACE = 'photoshare';
const D_PREFIX = `${APP_DATA_NAMESPACE}:`;
const pool = new SimplePool();

export interface AlbumCleanupPayloadV1 {
  v: 1;
  e: number;
  s: string[];
  x: string[];
  n?: string;
}

export interface Nip44CapableSigner {
  getPublicKey: () => Promise<string>;
  signEvent: (template: EventTemplate) => Promise<NostrEvent>;
  nip44?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
  };
}

export interface AlbumCleanupRecord {
  manifestHash: string;
  payload: AlbumCleanupPayloadV1;
  event: NostrEvent;
}

export interface CleanupRecordDeleteParams {
  signer: Nip44CapableSigner;
  relays: string[];
  recordEventId: string;
  reason?: string;
}

export interface PublishAlbumCleanupRecordParams {
  signer: Nip44CapableSigner;
  relays: string[];
  manifestHash: string;
  expiresAtUnix: number;
  servers: string[];
  blobHashes: string[];
  albumName?: string;
}

export interface FetchAlbumCleanupCandidatesParams {
  signer: Nip44CapableSigner;
  relays: string[];
  authorPubkey?: string;
  limit?: number;
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function dedupeNonEmpty(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeUrl(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function buildAlbumBlobHashList(entries: PhotoEntry[], manifestHash: string): string[] {
  const hashes = new Set<string>();
  if (manifestHash) hashes.add(manifestHash);

  for (const entry of entries) {
    if (entry.hash) hashes.add(entry.hash);
    if (entry.thumbHash) hashes.add(entry.thumbHash);
    if (entry.origHash) hashes.add(entry.origHash);
  }

  return Array.from(hashes);
}

function getTagValue(event: NostrEvent, tagName: string): string | null {
  const tag = event.tags.find((t) => t[0] === tagName && typeof t[1] === 'string');
  return tag ? (tag[1] as string) : null;
}

function parseManifestHashFromDTag(dTag: string | null): string | null {
  if (!dTag || !dTag.startsWith(D_PREFIX)) return null;
  const manifestHash = dTag.slice(D_PREFIX.length).trim();
  return manifestHash || null;
}

function parseCleanupPayload(value: unknown): AlbumCleanupPayloadV1 | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;
  if (payload.v !== 1) return null;
  if (!Number.isInteger(payload.e) || (payload.e as number) <= 0) return null;
  if (!Array.isArray(payload.s) || !payload.s.every((x) => typeof x === 'string' && x.trim().length > 0)) return null;
  if (!Array.isArray(payload.x) || !payload.x.every((x) => typeof x === 'string' && x.trim().length > 0)) return null;

  return {
    v: 1,
    e: payload.e as number,
    s: dedupeNonEmpty(payload.s as string[]),
    x: dedupeNonEmpty(payload.x as string[]),
  };
}

async function decryptCleanupRecord(
  event: NostrEvent,
  signer: Nip44CapableSigner,
): Promise<AlbumCleanupRecord | null> {
  if (!signer.nip44?.decrypt) return null;
  if (event.kind !== APP_DATA_KIND) return null;

  const manifestHash = parseManifestHashFromDTag(getTagValue(event, 'd'));
  if (!manifestHash) return null;

  try {
    const plaintext = await signer.nip44.decrypt(event.pubkey, event.content);
    const parsed = parseCleanupPayload(JSON.parse(plaintext));
    if (!parsed) return null;
    return { manifestHash, payload: parsed, event };
  } catch {
    return null;
  }
}

export async function publishAlbumCleanupRecord({
  signer,
  relays,
  manifestHash,
  expiresAtUnix,
  servers,
  blobHashes,
  albumName,
}: PublishAlbumCleanupRecordParams): Promise<boolean> {
  if (!signer.nip44?.encrypt) return false;

  const targetRelays = dedupeNonEmpty(relays);
  const targetServers = dedupeNonEmpty(servers);
  const hashes = dedupeNonEmpty(blobHashes);
  if (targetRelays.length === 0 || targetServers.length === 0 || hashes.length === 0) return false;

  const pubkey = await signer.getPublicKey();
  const payload: AlbumCleanupPayloadV1 = {
    v: 1,
    e: expiresAtUnix,
    s: targetServers,
    x: hashes,
    ...(albumName?.trim() ? { n: albumName.trim() } : {}),
  };
  const dTag = `${D_PREFIX}${manifestHash}`;

  // Requested debug visibility: log the plaintext payload before NIP-44 encryption.
  console.info('[photoshare.cleanup] plaintext record', {
    kind: APP_DATA_KIND,
    tags: [['d', dTag]],
    payload,
  });

  const encrypted = await signer.nip44.encrypt(pubkey, JSON.stringify(payload));
  const template: EventTemplate = {
    kind: APP_DATA_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', dTag]],
    content: encrypted,
  };

  const event = await signer.signEvent(template);
  await publishMethod(targetRelays, event);
  return true;
}

export async function fetchAlbumCleanupCandidates({
  signer,
  relays,
  authorPubkey,
  limit = 200,
}: FetchAlbumCleanupCandidatesParams): Promise<AlbumCleanupRecord[]> {
  if (!signer.nip44?.decrypt) return [];

  const targetRelays = dedupeNonEmpty(relays);
  if (targetRelays.length === 0) return [];

  const pubkey = authorPubkey ?? await signer.getPublicKey();
  const events = await pool.querySync(targetRelays, {
    kinds: [APP_DATA_KIND],
    authors: [pubkey],
    limit,
  });

  const newestByManifest = new Map<string, NostrEvent>();
  for (const event of events) {
    const manifestHash = parseManifestHashFromDTag(getTagValue(event, 'd'));
    if (!manifestHash) continue;

    const existing = newestByManifest.get(manifestHash);
    if (!existing || event.created_at > existing.created_at) {
      newestByManifest.set(manifestHash, event);
    }
  }

  const out: AlbumCleanupRecord[] = [];
  for (const event of newestByManifest.values()) {
    const record = await decryptCleanupRecord(event, signer);
    if (record) out.push(record);
  }

  out.sort((a, b) => b.event.created_at - a.event.created_at);
  return out;
}

export async function deleteAlbumCleanupRecordEvent({
  signer,
  relays,
  recordEventId,
  reason = 'photoshare cleanup complete',
}: CleanupRecordDeleteParams): Promise<void> {
  const targetRelays = dedupeNonEmpty(relays);
  if (targetRelays.length === 0) return;

  const template: EventTemplate = {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['e', recordEventId]],
    content: reason,
  };

  const event = await signer.signEvent(template);
  await publishMethod(targetRelays, event);
}
