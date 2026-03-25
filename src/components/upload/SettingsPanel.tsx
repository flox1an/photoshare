'use client';

import { useState } from 'react';
import type { UseSettingsReturn, ExpirationSeconds } from '@/hooks/useSettings';
import { EXPIRATION_OPTIONS } from '@/hooks/useSettings';
import { EditableList } from './settings/EditableList';
import { SettingsToggleRow } from './settings/SettingsToggleRow';

interface SettingsPanelProps {
  settings: UseSettingsReturn;
  keepOriginals: boolean;
  onKeepOriginalsChange: (value: boolean) => void;
  expiration: ExpirationSeconds;
  onExpirationChange: (value: ExpirationSeconds) => void;
  reactionsEnabled: boolean;
  onReactionsEnabledChange: (value: boolean) => void;
}

export function SettingsPanel({ settings, keepOriginals, onKeepOriginalsChange, expiration, onExpirationChange, reactionsEnabled, onReactionsEnabledChange }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

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

          <EditableList
            items={settings.blossomServers}
            onRemove={settings.removeBlossomServer}
            onAdd={async (value) => {
              const { error } = await settings.addBlossomServer(value);
              return error;
            }}
            addPlaceholder="https://your-blossom-server.com"
            showPrimaryOnFirst
          />

          {/* Keep originals toggle */}
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <SettingsToggleRow
              checked={keepOriginals}
              onChange={onKeepOriginalsChange}
              title="Keep originals"
              description="Also upload the original files. Downloads will deliver originals instead of processed WebP."
            />
          </div>

          {/* Expiration */}
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <p className="mb-1.5 text-xs font-medium text-zinc-400">Blob expiration</p>
            <p className="mb-2 text-xs text-zinc-600">
              Requests the server to delete blobs after the chosen duration.
              Only works if the server supports the <span className="font-mono">X-Expiration</span> header.
            </p>
            <select
              value={expiration}
              onChange={(e) => onExpirationChange(Number(e.target.value) as ExpirationSeconds)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
            >
              {EXPIRATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reactions & comments */}
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <SettingsToggleRow
              checked={reactionsEnabled}
              onChange={onReactionsEnabledChange}
              title="Enable reactions & comments"
              description="Viewers can like and comment on photos. Interactions are end-to-end encrypted via NIP-59 gift wraps."
            />

            {reactionsEnabled && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-zinc-500">Reaction relays</p>
                <EditableList
                  items={settings.reactionRelays}
                  onRemove={settings.removeReactionRelay}
                  onAdd={(value) => {
                    settings.addReactionRelay(value);
                    return null;
                  }}
                  addPlaceholder="wss://relay.example.com"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
