'use client';

import { useState } from 'react';
import type { UseSettingsReturn } from '@/hooks/useSettings';
import { validateBlossomServer } from '@/lib/blossom/validate';

interface SettingsPanelProps {
  settings: UseSettingsReturn;
}

export function SettingsPanel({ settings }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [blossomInput, setBlossomInput] = useState(settings.blossomServer);
  const [blossomError, setBlossomError] = useState<string | null>(settings.blossomError);
  const [isValidating, setIsValidating] = useState(settings.isValidating);

  const handleSaveBlossomServer = async (url?: string) => {
    const target = url ?? blossomInput;
    setIsValidating(true);
    setBlossomError(null);

    const isValid = await validateBlossomServer(target);

    if (!isValid) {
      setBlossomError('Server does not allow browser uploads (CORS)');
      setIsValidating(false);
      return;
    }

    await settings.setBlossomServer(target);
    setBlossomError(null);
    setIsValidating(false);
  };

  return (
    <div className="mt-4 rounded border border-gray-200 p-4">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
        aria-expanded={isOpen}
      >
        {isOpen ? '▾ Settings' : '▸ Settings'}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-6">
          {/* Relays section */}
          <div>
            <label
              htmlFor="settings-relays"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Nostr Relays
            </label>
            <textarea
              id="settings-relays"
              className="w-full rounded border border-gray-200 p-2 text-sm font-mono"
              rows={4}
              value={settings.relays.join('\n')}
              onChange={(e) => {
                const lines = e.target.value
                  .split('\n')
                  .filter((line) => line.trim().length > 0);
                settings.setRelays(lines);
              }}
              placeholder="One relay URL per line"
            />
          </div>

          {/* Blossom Server section */}
          <div>
            <label
              htmlFor="settings-blossom"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Blossom Server
            </label>
            <div className="flex items-center gap-2">
              <input
                id="settings-blossom"
                type="text"
                className="flex-1 rounded border border-gray-200 p-2 text-sm font-mono"
                value={blossomInput}
                onChange={(e) => setBlossomInput(e.target.value)}
                onBlur={() => {
                  if (blossomInput !== settings.blossomServer) {
                    void handleSaveBlossomServer(blossomInput);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSaveBlossomServer(blossomInput);
                  }
                }}
                placeholder="https://your-blossom-server.com"
              />
              <button
                type="button"
                onClick={() => void handleSaveBlossomServer()}
                disabled={isValidating}
                className="shrink-0 rounded bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isValidating ? (
                  <span className="inline-block animate-spin">⟳</span>
                ) : (
                  'Save'
                )}
              </button>
            </div>
            {blossomError && (
              <p className="mt-1 text-xs text-red-600">{blossomError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
