'use client';

import { useState, useEffect, useRef } from 'react';

interface AnonNameDialogProps {
  isOpen: boolean;
  generatedName: string;
  /** Current saved name if the user already set one (pre-fills the input). */
  savedName?: string | null;
  onSave: (name: string) => void;
  onDismiss: () => void;
}

export default function AnonNameDialog({
  isOpen,
  generatedName,
  savedName,
  onSave,
  onDismiss,
}: AnonNameDialogProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hasProfile = !!savedName;

  // Pre-fill when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(savedName ?? '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, savedName]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-4 sm:p-6 space-y-5">
        <div>
          {hasProfile ? (
            <>
              <h2 className="text-base font-semibold text-zinc-100">Change your name</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Your current name is{' '}
                <span className="font-medium text-zinc-200">{savedName}</span>.
                Enter a new name below.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-zinc-100">Hello!</h2>
              <p className="mt-1 text-sm text-zinc-400">
                You are currently known as{' '}
                <span className="font-medium text-zinc-200">{generatedName}</span>.
                Want to use a different name?
              </p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onDismiss();
          }}
          placeholder={hasProfile ? savedName! : generatedName}
          maxLength={64}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-base sm:text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
        />

        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors truncate"
          >
            {hasProfile ? 'Cancel' : `Keep ${generatedName.split(' ')[0]}`}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save name
          </button>
        </div>
      </div>
    </div>
  );
}
