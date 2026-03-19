'use client';

import { useState } from 'react';

interface ShareCardProps {
  shareLink: string | null;
  isUploading: boolean;
  publishError: string | null;
}

/**
 * ShareCard — post-upload UI shown after the upload pipeline completes.
 *
 * State machine:
 *   isUploading=true, shareLink=null  → "Publishing to Nostr..." spinner
 *   shareLink non-null                → share link + copy button
 *   publishError non-null             → red error message
 *   all null/false                    → null (nothing to render)
 */
export function ShareCard({ shareLink, isUploading, publishError }: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  // Nothing to show yet — return null so the card doesn't appear prematurely
  if (!isUploading && !shareLink && !publishError) return null;

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(window.location.origin + shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — non-fatal
    }
  };

  return (
    <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
      {/* Publishing spinner — shown while relay publish is in-flight */}
      {isUploading && !shareLink && (
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          <span className="text-sm text-zinc-400">Publishing to Nostr...</span>
        </div>
      )}

      {/* Share link UI — shown once relay confirms ok=true */}
      {shareLink && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Share link</p>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3">
              <p className="break-all font-mono text-xs text-zinc-300">
                {window.location.origin + shareLink}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white active:bg-zinc-200 transition-colors"
          >
            {copied ? (
              <>
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                </svg>
                Copy link
              </>
            )}
          </button>
        </div>
      )}

      {/* Publish error */}
      {publishError && (
        <p className="text-sm text-red-400">Failed to publish: {publishError}</p>
      )}
    </div>
  );
}
