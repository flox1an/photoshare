'use client';

import type { PhotoReactions } from '@/hooks/useReactions';

interface HeartsOverlayProps {
  photoHash: string;
  reactions: PhotoReactions | undefined;
  onReact: (photoHash: string) => Promise<void>;
  /** Whether the viewer has already reacted (optimistic local state) */
  hasReacted?: boolean;
}

export default function HeartsOverlay({
  photoHash,
  reactions,
  onReact,
  hasReacted,
}: HeartsOverlayProps) {
  const count = reactions?.reactions.length ?? 0;

  return (
    <button
      onClick={() => void onReact(photoHash)}
      aria-label={hasReacted ? 'Liked' : 'Like'}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors select-none
        ${hasReacted
          ? 'bg-rose-500/30 text-rose-300 hover:bg-rose-500/40'
          : 'bg-black/40 text-white/80 hover:bg-black/60'
        }`}
    >
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill={hasReacted ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
