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
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-expanded={isOpen}
      >
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        Settings
      </button>

      {isOpen && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3 space-y-5">
          {/* Blossom Server section */}
          <div>
            <label
              htmlFor="settings-blossom"
              className="mb-1.5 block text-xs font-medium text-zinc-400"
            >
              Blossom Server
            </label>
            <div className="flex items-center gap-2">
              <input
                id="settings-blossom"
                type="text"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
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
                className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isValidating ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-zinc-300" />
                ) : (
                  'Save'
                )}
              </button>
            </div>
            {blossomError && (
              <p className="mt-1.5 text-xs text-red-400">{blossomError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
