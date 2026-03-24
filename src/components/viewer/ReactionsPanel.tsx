'use client';

import { useState, useEffect, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import { useNostrAccountStore } from '@/store/nostrAccountStore';
import { useNostrProfile, profileDisplayName } from '@/hooks/useNostrProfile';
import { anonDisplayName } from '@/lib/anonName';
import { getAnonKeypair } from '@/lib/nostr/anonIdentity';
import { getAnonProfileName } from '@/lib/nostr/anonProfile';
import ProfileAvatar from './ProfileAvatar';
import { HeartIcon } from './icons';
import type { PhotoReactions } from '@/hooks/useReactions';
import type { UnwrappedRumor } from '@/lib/nostr/nip59';

interface ReactionsPanelProps {
  photoHash: string;
  reactions: PhotoReactions | undefined;
  loading?: boolean;
  onComment: (photoHash: string, text: string) => Promise<void>;
  onLoginRequest: () => void;
  onEditName?: () => void;
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

type TimelineEntry = UnwrappedRumor & { _kind: 'comment' | 'reaction' };

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const profile = useNostrProfile(entry.pubkey);
  const name = profileDisplayName(profile, anonDisplayName(entry.pubkey));

  return (
    <li className="flex gap-2.5">
      <ProfileAvatar pubkey={entry.pubkey} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-zinc-300 truncate">{name}</span>
          <span className="text-xs text-zinc-500 shrink-0">{formatRelativeTime(entry.created_at)} ago</span>
        </div>
        {entry._kind === 'reaction' ? (
          <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-1">
            liked this photo
            <HeartIcon className="w-3 h-3 text-rose-400 shrink-0" solid />
          </p>
        ) : (
          <p className="text-sm text-zinc-200 break-words mt-0.5">{entry.content}</p>
        )}
      </div>
    </li>
  );
}

export default function ReactionsPanel({
  photoHash,
  reactions,
  loading,
  onComment,
  onLoginRequest,
  onEditName,
  onClose,
}: ReactionsPanelProps) {
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasFocused = useRef(false);
  const [isSending, setIsSending] = useState(false);

  const pubkey = useNostrAccountStore((s) => s.pubkey);
  const logout = useNostrAccountStore((s) => s.logout);
  const ownProfile = useNostrProfile(pubkey);
  const ownName = pubkey ? profileDisplayName(ownProfile, shortNpub(pubkey)) : null;

  // Merge reactions and comments into a single timeline sorted by created_at
  const timeline: TimelineEntry[] = [
    ...(reactions?.reactions ?? []).map((r) => ({ ...r, _kind: 'reaction' as const })),
    ...(reactions?.comments ?? []).map((c) => ({ ...c, _kind: 'comment' as const })),
  ].sort((a, b) => a.created_at - b.created_at);

  // Auto-focus: always on desktop; on mobile only when there's nothing to read yet
  useEffect(() => {
    if (loading || hasFocused.current) return;
    hasFocused.current = true;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile || timeline.length === 0) {
      inputRef.current?.focus();
    }
  }, [loading, timeline.length]);

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
        <span className="text-base font-medium text-zinc-200">Comments</span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Timeline feed — on mobile, hidden when empty so the input stays close to the header when the keyboard appears;
           on desktop, always rendered as a flex-1 spacer so the input stays at the bottom */}
      {(loading || timeline.length > 0) ? (
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="w-3.5 h-3.5 border border-zinc-600 border-t-zinc-400 rounded-full animate-spin shrink-0" />
              <p className="text-sm text-zinc-600">Loading…</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {timeline.map((entry, i) => (
                <TimelineRow key={i} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="hidden sm:block flex-1" />
      )}

      {/* Comment input */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-3 space-y-2">
        <div className="flex items-start gap-2">
          <textarea
            ref={inputRef}
            rows={2}
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
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            inputMode="text"
            className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-800/20 px-3 py-2 text-lg sm:text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
          />
          <button
            onClick={() => void handleSendComment()}
            disabled={!commentText.trim() || isSending}
            className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-zinc-300" />
            ) : (
              'Send'
            )}
          </button>
        </div>

        {pubkey ? (
          <p className="text-xs text-zinc-600">
            Commenting as <span className="text-zinc-500">{ownName}</span>.{' '}
            <button
              onClick={logout}
              className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
            >
              Sign out
            </button>
          </p>
        ) : (
          <p className="text-xs text-zinc-600 flex items-center gap-1 flex-wrap">
            <span>
              Posting as{' '}
              <span className="text-zinc-400 font-medium">
                {getAnonProfileName() ?? anonDisplayName(getAnonKeypair().pubkey)}
              </span>
            </span>
            {onEditName && (
              <button
                onClick={onEditName}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Change display name"
                title="Change display name"
              >
                <svg className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                </svg>
              </button>
            )}
            <span className="text-zinc-600">·</span>
            <button
              onClick={onLoginRequest}
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
