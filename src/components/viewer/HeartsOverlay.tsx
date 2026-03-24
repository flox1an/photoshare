'use client';

import type { PhotoReactions } from '@/hooks/useReactions';
import { HeartIcon } from './icons';
import RoundButton from './RoundButton';

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
    <RoundButton
      pill
      onClick={() => void onReact(photoHash)}
      disabled={hasReacted}
      aria-label={hasReacted ? 'Liked' : 'Like'}
      colorClass={hasReacted ? 'bg-rose-500/30 text-rose-300' : undefined}
    >
      <HeartIcon className="w-5 h-5 shrink-0" solid={hasReacted} />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </RoundButton>
  );
}
