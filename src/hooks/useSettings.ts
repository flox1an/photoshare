'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_BLOSSOM_SERVER } from '@/lib/config';
import { validateBlossomServer } from '@/lib/blossom/validate';

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
  return 31_536_000;
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

export function useSettings(): UseSettingsReturn {
  const [blossomServers, setBlossomServers] = useState<string[]>(loadServers);
  const [keepOriginals, setKeepOriginalsState] = useState(loadKeepOriginals);
  const [expiration, setExpirationState] = useState<ExpirationSeconds>(loadExpiration);
  const [reactionsEnabled, setReactionsEnabledState] = useState(loadReactionsEnabled);
  const [reactionRelays, setReactionRelays] = useState<string[]>(loadReactionRelays);

  useEffect(() => {
    try {
      localStorage.setItem('blossom-servers', JSON.stringify(blossomServers));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [blossomServers]);

  useEffect(() => {
    try {
      localStorage.setItem('keep-originals', String(keepOriginals));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [keepOriginals]);

  useEffect(() => {
    try {
      localStorage.setItem('blob-expiration', String(expiration));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [expiration]);

  useEffect(() => {
    try {
      localStorage.setItem('reactions-enabled', String(reactionsEnabled));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [reactionsEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('reaction-relays', JSON.stringify(reactionRelays));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [reactionRelays]);

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
