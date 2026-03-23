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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-2xl text-sm animate-in">
      <span className="text-zinc-400">
        Liked as{' '}
        <span className="font-medium text-zinc-200">{name}</span>
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => { onChangeName(); onDismiss(); }}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-300 border border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
          Change name
        </button>
        <button
          onClick={onDismiss}
          className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
