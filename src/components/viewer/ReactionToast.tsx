'use client';

import { useEffect } from 'react';

interface ReactionToastProps {
  name: string;
  onChangeName: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 6000;

export default function ReactionToast({ name, onChangeName, onDismiss }: ReactionToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1rem)] max-w-md -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 shadow-2xl backdrop-blur-sm animate-in sm:bottom-6 sm:w-auto sm:min-w-[24rem]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="text-sm text-zinc-300">
          Liked as{' '}
          <span className="font-medium text-zinc-100">{name}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => { onChangeName(); onDismiss(); }}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            Change name
          </button>
          <button
            onClick={onDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
