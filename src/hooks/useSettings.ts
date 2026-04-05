'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_BLOSSOM_SERVER } from '@/lib/config';
import { validateBlossomServer } from '@/lib/blossom/validate';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import { resolveUserOutboxRelays } from '@/lib/nostr/relayList';
import {
  fetchUserSettingsConfig,
  publishUserSettingsConfig,
  type AppSettingsSigner,
  type UserSettingsConfig,
} from '@/lib/nostr/appSettings';

export const EXPIRATION_OPTIONS = [
  { label: '1 hour',  value: 3_600 },
  { label: '1 day',   value: 86_400 },
  { label: '1 week',  value: 604_800 },
  { label: '1 month', value: 2_592_000 },
  { label: '1 year',  value: 31_536_000 },
] as const;

export type ExpirationSeconds = typeof EXPIRATION_OPTIONS[number]['value'];

export const DEFAULT_REACTION_RELAYS = [
  'wss://nos.lol',
];
const REMOTE_PERSIST_DEBOUNCE_MS = 600;

export interface UseSettingsReturn {
  blossomServers: string[];
  addBlossomServer: (url: string) => Promise<{ error: string | null }>;
  removeBlossomServer: (index: number) => void;
  /** Primary server (first in list) — for backward compat */
  blossomServer: string;
  /** Whether to also upload and deliver original files on download */
  keepOriginals: boolean;
  setKeepOriginals: (value: boolean) => void;
  /** Blob expiration offset in seconds (sent via X-Expiration when server supports it) */
  expiration: ExpirationSeconds;
  setExpiration: (value: ExpirationSeconds) => void;
  /** Whether reactions and comments are enabled for new albums */
  reactionsEnabled: boolean;
  setReactionsEnabled: (value: boolean) => void;
  /** Nostr relay URLs for publishing and querying gift-wrapped reactions */
  reactionRelays: string[];
  addReactionRelay: (url: string) => void;
  removeReactionRelay: (index: number) => void;
}

interface SettingsSnapshot {
  blossomServers: string[];
  keepOriginals: boolean;
  expiration: ExpirationSeconds;
  reactionsEnabled: boolean;
  reactionRelays: string[];
}

const loggedInSettingsCache = new Map<string, SettingsSnapshot>();

function defaultSnapshot(): SettingsSnapshot {
  return {
    blossomServers: [DEFAULT_BLOSSOM_SERVER],
    keepOriginals: false,
    expiration: 604_800,
    reactionsEnabled: false,
    reactionRelays: [...DEFAULT_REACTION_RELAYS],
  };
}

function loadExpiration(): ExpirationSeconds {
  try {
    const stored = localStorage.getItem('blob-expiration');
    if (stored) {
      const parsed = Number(stored);
      if (EXPIRATION_OPTIONS.some((o) => o.value === parsed)) return parsed as ExpirationSeconds;
    }
  } catch {
    // localStorage unavailable
  }
  return 604_800;
}

function loadKeepOriginals(): boolean {
  try {
    return localStorage.getItem('keep-originals') === 'true';
  } catch {
    return false;
  }
}

function loadReactionsEnabled(): boolean {
  try {
    return localStorage.getItem('reactions-enabled') === 'true';
  } catch {
    return false;
  }
}

function loadReactionRelays(): string[] {
  try {
    const stored = localStorage.getItem('reaction-relays');
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    }
  } catch {
    // localStorage unavailable
  }
  return [...DEFAULT_REACTION_RELAYS];
}

function loadServers(): string[] {
  try {
    const stored = localStorage.getItem('blossom-servers');
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    }
    // Migrate legacy single-server key
    const legacy = localStorage.getItem('blossom-server');
    if (legacy) return [legacy];
  } catch {
    // localStorage unavailable (SSR)
  }
  return [DEFAULT_BLOSSOM_SERVER];
}

function loadAnonSnapshot(): SettingsSnapshot {
  return {
    blossomServers: loadServers(),
    keepOriginals: loadKeepOriginals(),
    expiration: loadExpiration(),
    reactionsEnabled: loadReactionsEnabled(),
    reactionRelays: loadReactionRelays(),
  };
}

function sanitizeRemoteSnapshot(config: UserSettingsConfig): SettingsSnapshot {
  const expiration = EXPIRATION_OPTIONS.some((o) => o.value === config.expiration)
    ? (config.expiration as ExpirationSeconds)
    : 604_800;

  return {
    blossomServers: config.blossomServers.length > 0 ? config.blossomServers : [DEFAULT_BLOSSOM_SERVER],
    keepOriginals: config.keepOriginals,
    expiration,
    reactionsEnabled: config.reactionsEnabled,
    reactionRelays: config.reactionRelays.length > 0 ? config.reactionRelays : [...DEFAULT_REACTION_RELAYS],
  };
}

export function useSettings(): UseSettingsReturn {
  const pubkey = useNostrAccountStore((s) => s.pubkey);
  const signer = useNostrAccountStore((s) => s.signer);
  const restoring = useNostrAccountStore((s) => s.restoring);
  const isLoggedIn = Boolean(pubkey && signer);

  const [blossomServers, setBlossomServers] = useState<string[]>(() => loadAnonSnapshot().blossomServers);
  const [keepOriginals, setKeepOriginalsState] = useState(() => loadAnonSnapshot().keepOriginals);
  const [expiration, setExpirationState] = useState<ExpirationSeconds>(() => loadAnonSnapshot().expiration);
  const [reactionsEnabled, setReactionsEnabledState] = useState(() => loadAnonSnapshot().reactionsEnabled);
  const [reactionRelays, setReactionRelays] = useState<string[]>(() => loadAnonSnapshot().reactionRelays);
  const [settingsReady, setSettingsReady] = useState(false);
  const [skipRemotePersist, setSkipRemotePersist] = useState(true);

  useEffect(() => {
    if (restoring) return;
    let active = true;

    const applySnapshot = (snapshot: SettingsSnapshot) => {
      setBlossomServers(snapshot.blossomServers);
      setKeepOriginalsState(snapshot.keepOriginals);
      setExpirationState(snapshot.expiration);
      setReactionsEnabledState(snapshot.reactionsEnabled);
      setReactionRelays(snapshot.reactionRelays);
    };

    if (!isLoggedIn || !pubkey || !signer) {
      applySnapshot(loadAnonSnapshot());
      setSkipRemotePersist(true);
      setSettingsReady(true);
      return () => { active = false; };
    }

    setSettingsReady(false);
    const cached = loggedInSettingsCache.get(pubkey) ?? defaultSnapshot();
    applySnapshot(cached);
    setSkipRemotePersist(true);

    void (async () => {
      try {
        const fallbackRelays = cached.reactionRelays.length > 0 ? cached.reactionRelays : [...DEFAULT_REACTION_RELAYS];
        const outboxRelays = await resolveUserOutboxRelays(pubkey, fallbackRelays);
        const remote = await fetchUserSettingsConfig(signer as AppSettingsSigner, outboxRelays, pubkey);
        const next = remote ? sanitizeRemoteSnapshot(remote) : cached;
        loggedInSettingsCache.set(pubkey, next);
        if (!active) return;
        applySnapshot(next);
      } catch {
        if (!active) return;
        applySnapshot(cached);
      } finally {
        if (active) setSettingsReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [isLoggedIn, pubkey, restoring, signer]);

  useEffect(() => {
    if (!settingsReady || isLoggedIn) return;
    try {
      localStorage.setItem('blossom-servers', JSON.stringify(blossomServers));
      localStorage.setItem('keep-originals', String(keepOriginals));
      localStorage.setItem('blob-expiration', String(expiration));
      localStorage.setItem('reactions-enabled', String(reactionsEnabled));
      localStorage.setItem('reaction-relays', JSON.stringify(reactionRelays));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [settingsReady, isLoggedIn, blossomServers, keepOriginals, expiration, reactionsEnabled, reactionRelays]);

  useEffect(() => {
    if (!settingsReady || !isLoggedIn || !pubkey || !signer) return;
    if (skipRemotePersist) {
      setSkipRemotePersist(false);
      return;
    }

    const snapshot: SettingsSnapshot = {
      blossomServers,
      keepOriginals,
      expiration,
      reactionsEnabled,
      reactionRelays,
    };
    loggedInSettingsCache.set(pubkey, snapshot);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const fallbackRelays = reactionRelays.length > 0 ? reactionRelays : [...DEFAULT_REACTION_RELAYS];
          const outboxRelays = await resolveUserOutboxRelays(pubkey, fallbackRelays);
          const payload: UserSettingsConfig = {
            v: 1,
            blossomServers,
            keepOriginals,
            expiration,
            reactionsEnabled,
            reactionRelays,
          };
          await publishUserSettingsConfig(signer as AppSettingsSigner, outboxRelays, payload);
        } catch {
          // best-effort publish
        }
      })();
    }, REMOTE_PERSIST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    settingsReady,
    isLoggedIn,
    pubkey,
    signer,
    skipRemotePersist,
    blossomServers,
    keepOriginals,
    expiration,
    reactionsEnabled,
    reactionRelays,
  ]);

  const addBlossomServer = async (url: string): Promise<{ error: string | null }> => {
    const normalized = url.trim().replace(/\/$/, '');
    if (!normalized) return { error: 'URL cannot be empty' };
    if (blossomServers.includes(normalized)) return { error: 'Server already in list' };

    const isValid = await validateBlossomServer(normalized);
    if (!isValid) return { error: 'Server does not allow browser uploads (CORS)' };

    setBlossomServers((prev) => [...prev, normalized]);
    return { error: null };
  };

  const removeBlossomServer = (index: number) => {
    setBlossomServers((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [DEFAULT_BLOSSOM_SERVER];
    });
  };

  const addReactionRelay = (url: string) => {
    const normalized = url.trim().replace(/\/$/, '');
    if (!normalized) return;
    setReactionRelays((prev) => {
      if (prev.includes(normalized)) return prev;
      return [...prev, normalized];
    });
  };

  const removeReactionRelay = (index: number) => {
    setReactionRelays((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [...DEFAULT_REACTION_RELAYS];
    });
  };

  return {
    blossomServers,
    addBlossomServer,
    removeBlossomServer,
    blossomServer: blossomServers[0] ?? DEFAULT_BLOSSOM_SERVER,
    keepOriginals,
    setKeepOriginals: setKeepOriginalsState,
    expiration,
    setExpiration: setExpirationState,
    reactionsEnabled,
    setReactionsEnabled: setReactionsEnabledState,
    reactionRelays,
    addReactionRelay,
    removeReactionRelay,
  };
}
