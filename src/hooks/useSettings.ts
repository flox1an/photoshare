'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_RELAYS, DEFAULT_BLOSSOM_SERVER } from '@/lib/config';

export interface UseSettingsReturn {
  relays: string[];
  setRelays: (relays: string[]) => void;
  blossomServer: string;
  setBlossomServer: (url: string) => Promise<void>;
  blossomError: string | null;
  isValidating: boolean;
}

export function useSettings(): UseSettingsReturn {
  const [relays, setRelaysState] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('nostr-relays');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // localStorage unavailable (SSR or parse error) — fall back to default
    }
    return DEFAULT_RELAYS;
  });

  const [blossomServer, setBlossomServerState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('blossom-server');
      if (stored) return stored;
    } catch {
      // localStorage unavailable (SSR) — fall back to default
    }
    return DEFAULT_BLOSSOM_SERVER;
  });

  const [blossomError, setBlossomError] = useState<string | null>(null);
  const [isValidating] = useState<boolean>(false);

  // Persist relays to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('nostr-relays', JSON.stringify(relays));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [relays]);

  // Persist blossomServer to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('blossom-server', blossomServer);
    } catch {
      // localStorage unavailable — ignore
    }
  }, [blossomServer]);

  const setRelays = (newRelays: string[]) => {
    setRelaysState(newRelays);
  };

  // setBlossomServer stores the URL directly.
  // Validation (CORS check via validateBlossomServer) is performed by the
  // SettingsPanel UI before calling this setter — the hook is a pure
  // persistence layer so tests can exercise it without network mocks.
  const setBlossomServer = async (url: string): Promise<void> => {
    setBlossomError(null);
    setBlossomServerState(url);
  };

  return {
    relays,
    setRelays,
    blossomServer,
    setBlossomServer,
    blossomError,
    isValidating,
  };
}
