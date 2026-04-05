import { SimplePool } from 'nostr-tools';
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import { publishMethod } from '@/lib/nostr/relay';

const APP_DATA_KIND = 30078;
const SETTINGS_D_TAG = 'photoshare-settings';
const pool = new SimplePool();

export interface UserSettingsConfig {
  v: 1;
  blossomServers: string[];
  keepOriginals: boolean;
  expiration: number;
  reactionsEnabled: boolean;
  reactionRelays: string[];
}

export interface AppSettingsSigner {
  getPublicKey: () => Promise<string>;
  signEvent: (template: EventTemplate) => Promise<NostrEvent>;
  nip44?: {
    encrypt: (pubkey: string, plaintext: string) => Promise<string>;
    decrypt: (pubkey: string, ciphertext: string) => Promise<string>;
  };
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function dedupeNonEmpty(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeValue(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function hasDTag(event: NostrEvent, dTag: string): boolean {
  return event.tags.some((tag) => tag[0] === 'd' && tag[1] === dTag);
}

function parseSettings(value: unknown): UserSettingsConfig | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Record<string, unknown>;
  if (parsed.v !== 1) return null;
  if (!Array.isArray(parsed.blossomServers)) return null;
  if (!Array.isArray(parsed.reactionRelays)) return null;
  if (typeof parsed.keepOriginals !== 'boolean') return null;
  if (typeof parsed.reactionsEnabled !== 'boolean') return null;
  if (!Number.isInteger(parsed.expiration)) return null;
  if (!parsed.blossomServers.every((x) => typeof x === 'string')) return null;
  if (!parsed.reactionRelays.every((x) => typeof x === 'string')) return null;

  return {
    v: 1,
    blossomServers: dedupeNonEmpty(parsed.blossomServers as string[]),
    keepOriginals: parsed.keepOriginals,
    expiration: parsed.expiration as number,
    reactionsEnabled: parsed.reactionsEnabled,
    reactionRelays: dedupeNonEmpty(parsed.reactionRelays as string[]),
  };
}

export async function fetchUserSettingsConfig(
  signer: AppSettingsSigner,
  relays: string[],
  authorPubkey?: string,
): Promise<UserSettingsConfig | null> {
  if (!signer.nip44?.decrypt || relays.length === 0) return null;

  const pubkey = authorPubkey ?? await signer.getPublicKey();
  const events = await pool.querySync(relays, {
    kinds: [APP_DATA_KIND],
    authors: [pubkey],
    limit: 200,
  });

  const newest = events
    .filter((event) => hasDTag(event, SETTINGS_D_TAG))
    .sort((a, b) => b.created_at - a.created_at)[0];

  if (!newest) return null;

  try {
    const plaintext = await signer.nip44.decrypt(newest.pubkey, newest.content);
    return parseSettings(JSON.parse(plaintext));
  } catch {
    return null;
  }
}

export async function publishUserSettingsConfig(
  signer: AppSettingsSigner,
  relays: string[],
  config: UserSettingsConfig,
): Promise<boolean> {
  if (!signer.nip44?.encrypt || relays.length === 0) return false;

  const pubkey = await signer.getPublicKey();
  const encrypted = await signer.nip44.encrypt(pubkey, JSON.stringify(config));
  const template: EventTemplate = {
    kind: APP_DATA_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', SETTINGS_D_TAG]],
    content: encrypted,
  };

  const event = await signer.signEvent(template);
  await publishMethod(relays, event);
  return true;
}
