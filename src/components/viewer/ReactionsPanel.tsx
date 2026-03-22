'use client';

import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import { useNostrProfile, profileDisplayName } from '@/hooks/useNostrProfile';
import { anonDisplayName } from '@/lib/anonName';
import ProfileAvatar from './ProfileAvatar';
import type { PhotoReactions } from '@/hooks/useReactions';
import type { UnwrappedRumor } from '@/lib/nostr/nip59';

interface ReactionsPanelProps {
  photoHash: string;
  reactions: PhotoReactions | undefined;
  onComment: (photoHash: string, text: string) => Promise<void>;
  onLoginRequest: () => void;
  onClose: () => void;
}

function formatRelativeTime(unixTs: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function shortNpub(pubkey: string): string {
  try {
    const npub = nip19.npubEncode(pubkey);
    return 'npub1' + npub.slice(5, 9) + '…' + npub.slice(-4);
  } catch {
    return pubkey.slice(0, 8) + '…';
  }
}

function CommentRow({ comment }: { comment: UnwrappedRumor }) {
  const profile = useNostrProfile(comment.pubkey);
  const name = profileDisplayName(profile, anonDisplayName(comment.pubkey));

  return (
    <li className="flex gap-2.5">
      <ProfileAvatar pubkey={comment.pubkey} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-zinc-300 truncate">{name}</span>
          <span className="text-[10px] text-zinc-600 shrink-0">{formatRelativeTime(comment.created_at)}</span>
        </div>
        <p className="text-xs text-zinc-200 break-words mt-0.5">{comment.content}</p>
      </div>
    </li>
  );
}

export default function ReactionsPanel({
  photoHash,
  reactions,
  onComment,
  onLoginRequest,
  onClose,
}: ReactionsPanelProps) {
  const [commentText, setCommentText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const pubkey = useNostrAccountStore((s) => s.pubkey);

  const comments = reactions?.comments ?? [];

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setIsSending(true);
    try {
      await onComment(photoHash, commentText);
      setCommentText('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <span className="text-sm font-medium text-zinc-200">Comments</span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Comment feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {comments.length === 0 ? (
          <p className="text-xs text-zinc-600 py-2">No comments yet. Be the first!</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c, i) => (
              <CommentRow key={i} comment={c} />
            ))}
          </ul>
        )}
      </div>

      {/* Comment input */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSendComment();
              }
            }}
            placeholder="Add a comment…"
            maxLength={500}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
          />
          <button
            onClick={() => void handleSendComment()}
            disabled={!commentText.trim() || isSending}
            className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-zinc-300" />
            ) : (
              'Send'
            )}
          </button>
        </div>

        {pubkey ? (
          <p className="text-[10px] text-zinc-600">
            Commenting as <span className="text-zinc-500">{shortNpub(pubkey)}</span>
          </p>
        ) : (
          <p className="text-[10px] text-zinc-600">
            Commenting anonymously.{' '}
            <button
              onClick={onLoginRequest}
              className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
            >
              Sign in
            </button>{' '}
            to identify yourself.
          </p>
        )}
      </div>
    </div>
  );
}
