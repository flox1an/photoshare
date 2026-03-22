'use client';

import ProfileAvatar from './ProfileAvatar';
import type { PhotoReactions } from '@/hooks/useReactions';

interface HeartsOverlayProps {
  photoHash: string;
  reactions: PhotoReactions | undefined;
  onReact: (photoHash: string) => Promise<void>;
  /** Whether the viewer has already reacted (simple optimistic check) */
  hasReacted?: boolean;
}

const MAX_AVATARS = 5;

export default function HeartsOverlay({
  photoHash,
  reactions,
  onReact,
  hasReacted,
}: HeartsOverlayProps) {
  const hearts = reactions?.reactions ?? [];
  const count = hearts.length;

  // Unique pubkeys for avatar display
  const uniquePubkeys = Array.from(new Set(hearts.map((r) => r.pubkey))).slice(0, MAX_AVATARS);
  const overflow = count - uniquePubkeys.length;

  const handleClick = () => {
    void onReact(photoHash);
  };

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Stacked avatars */}
      {uniquePubkeys.length > 0 && (
        <div className="flex items-center">
          {uniquePubkeys.map((pk, i) => (
            <span
              key={pk}
              className="ring-2 ring-black/50 rounded-full"
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: uniquePubkeys.length - i }}
            >
              <ProfileAvatar pubkey={pk} size="sm" />
            </span>
          ))}
          {overflow > 0 && (
            <span className="ml-1 text-[11px] text-white/70">+{overflow}</span>
          )}
        </div>
      )}

      {/* Heart button + count */}
      <button
        onClick={handleClick}
        aria-label={hasReacted ? 'Liked' : 'Like'}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors
          ${hasReacted
            ? 'bg-rose-500/30 text-rose-300 hover:bg-rose-500/40'
            : 'bg-white/10 text-white/80 hover:bg-white/20'
          }`}
      >
        <svg
          className="w-4 h-4"
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
    </div>
  );
}
