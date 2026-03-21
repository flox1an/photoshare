'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_BLOSSOM_SERVER } from '@/lib/config';

export interface UseSettingsReturn {
  blossomServer: string;
  setBlossomServer: (url: string) => Promise<void>;
  blossomError: string | null;
  isValidating: boolean;
}

export function useSettings(): UseSettingsReturn {
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

  useEffect(() => {
    try {
      localStorage.setItem('blossom-server', blossomServer);
    } catch {
      // localStorage unavailable — ignore
    }
  }, [blossomServer]);

  const setBlossomServer = async (url: string): Promise<void> => {
    setBlossomError(null);
    setBlossomServerState(url);
  };

  return {
    blossomServer,
    setBlossomServer,
    blossomError,
    isValidating,
  };
}
