interface ReactionsBadgeProps {
  hearts: number;
  comments: number;
}

/**
 * Small overlay badge in the bottom-right corner of masonry thumbnails.
 * Positioned on the right to avoid clashing with the filename overlay on the left.
 * Returns null when all counts are zero.
 */
export default function ReactionsBadge({ hearts, comments }: ReactionsBadgeProps) {
  if (hearts === 0 && comments === 0) return null;

  return (
    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur-sm pointer-events-none">
      {hearts > 0 && (
        <span className="flex items-center gap-0.5">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
          </svg>
          {hearts}
        </span>
      )}
      {comments > 0 && (
        <span className="flex items-center gap-0.5">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
          </svg>
          {comments}
        </span>
      )}
    </div>
  );
}
