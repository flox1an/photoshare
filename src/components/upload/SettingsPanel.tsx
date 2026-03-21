'use client';

import { useState } from 'react';
import type { UseSettingsReturn } from '@/hooks/useSettings';

interface SettingsPanelProps {
  settings: UseSettingsReturn;
  keepOriginals: boolean;
  onKeepOriginalsChange: (value: boolean) => void;
}

export function SettingsPanel({ settings, keepOriginals, onKeepOriginalsChange }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const url = addInput.trim();
    if (!url) return;
    setIsAdding(true);
    setAddError(null);
    const { error } = await settings.addBlossomServer(url);
    if (error) {
      setAddError(error);
    } else {
      setAddInput('');
    }
    setIsAdding(false);
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
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
          <p className="mb-2 text-xs font-medium text-zinc-400">Blossom Servers</p>
          <p className="mb-3 text-xs text-zinc-600">
            Photos are uploaded to all servers. All servers are embedded in the share link as fallbacks.
          </p>

          {/* Server list */}
          <ul className="mb-3 space-y-1.5">
            {settings.blossomServers.map((server, i) => (
              <li
                key={server}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2"
              >
                {i === 0 && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-700 text-zinc-400">
                    primary
                  </span>
                )}
                <span className="flex-1 truncate font-mono text-xs text-zinc-300">{server}</span>
                <button
                  type="button"
                  onClick={() => settings.removeBlossomServer(i)}
                  className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors"
                  aria-label={`Remove ${server}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {/* Add server */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="https://your-blossom-server.com"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isAdding || !addInput.trim()}
              className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {isAdding ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-zinc-300" />
              ) : (
                'Add'
              )}
            </button>
          </div>
          {addError && (
            <p className="mt-1.5 text-xs text-red-400">{addError}</p>
          )}

          {/* Keep originals toggle */}
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={keepOriginals}
                onChange={(e) => onKeepOriginalsChange(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-zinc-300"
              />
              <div>
                <p className="text-xs font-medium text-zinc-400">Keep originals</p>
                <p className="text-xs text-zinc-600">
                  Also upload the original files. Downloads will deliver originals instead of processed WebP.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
