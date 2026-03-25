import { useState } from "react";
import type { RefObject } from "react";
import { anonDisplayName } from "@/lib/anonName";
import { getAnonKeypair } from "@/lib/nostr/anonIdentity";
import { getAnonProfileName } from "@/lib/nostr/anonProfile";

interface CommentComposerProps {
  photoHash: string;
  onComment: (photoHash: string, text: string) => Promise<void>;
  pubkey: string | null;
  ownName: string | null;
  onLogout: () => void;
  onLoginRequest: () => void;
  onEditName?: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

export function CommentComposer({
  photoHash,
  onComment,
  pubkey,
  ownName,
  onLogout,
  onLoginRequest,
  onEditName,
  inputRef,
}: CommentComposerProps) {
  const [commentText, setCommentText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setIsSending(true);
    try {
      await onComment(photoHash, commentText);
      setCommentText("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-zinc-800 px-4 py-3 space-y-2">
      <div className="flex items-start gap-2">
        <textarea
          ref={inputRef}
          rows={2}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
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
            "Send"
          )}
        </button>
      </div>

      {pubkey ? (
        <p className="text-xs text-zinc-600">
          Commenting as <span className="text-zinc-500">{ownName}</span>.{" "}
          <button
            onClick={onLogout}
            className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
          >
            Sign out
          </button>
        </p>
      ) : (
        <p className="text-xs text-zinc-600 flex items-center gap-1 flex-wrap">
          <span>
            Posting as{" "}
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
  );
}
