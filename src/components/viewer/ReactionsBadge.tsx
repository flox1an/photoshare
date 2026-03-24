import type { ReactNode } from 'react';
import { HeartIcon, CommentIcon } from './icons';

interface ReactionsBadgeProps {
  hearts: number;
  comments: number;
}

interface BadgeChipProps {
  count: number;
  icon: ReactNode;
}

function BadgeChip({ count, icon }: BadgeChipProps) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm backdrop-blur-sm"
    >
      {icon}
      <span className="tabular-nums">{count}</span>
    </span>
  );
}

/**
 * Small overlay badge in the bottom-right corner of masonry thumbnails.
 * Positioned on the right to avoid clashing with the filename overlay on the left.
 * Returns null when all counts are zero.
 */
export default function ReactionsBadge({ hearts, comments }: ReactionsBadgeProps) {
  if (hearts === 0 && comments === 0) return null;

  return (
    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 pointer-events-none">
      {hearts > 0 && (
        <BadgeChip
          count={hearts}
          icon={<HeartIcon className="h-3.5 w-3.5 shrink-0" />}
        />
      )}
      {comments > 0 && (
        <BadgeChip
          count={comments}
          icon={<CommentIcon className="h-3.5 w-3.5 shrink-0" />}
        />
      )}
    </div>
  );
}
