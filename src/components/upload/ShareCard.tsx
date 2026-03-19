'use client';

import { useState } from 'react';

interface ShareCardProps {
  shareLink: string | null;
  isUploading: boolean;
  publishError: string | null;
  onTitleChange?: (title: string) => void;
}

/**
 * ShareCard — post-upload UI shown after the upload pipeline completes.
 *
 * State machine:
 *   isUploading=true, shareLink=null  → "Publishing to Nostr..." spinner
 *   shareLink non-null                → title field + share link + copy button
 *   publishError non-null             → red error message
 *   all null/false                    → null (nothing to render)
 */
export function ShareCard({ shareLink, isUploading, publishError, onTitleChange }: ShareCardProps) {
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
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* Publishing spinner — shown while relay publish is in-flight */}
      {isUploading && !shareLink && (
        <div className="flex items-center gap-3 text-gray-600">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <span className="text-sm font-medium">Publishing to Nostr...</span>
        </div>
      )}

      {/* Share link UI — shown once relay confirms ok=true */}
      {shareLink && (
        <div className="space-y-4">
          {/* Optional album title field */}
          <div>
            <label htmlFor="album-title" className="mb-1 block text-sm font-medium text-gray-700">
              Album title (optional)
            </label>
            <input
              id="album-title"
              type="text"
              placeholder="Album title (optional)"
              onChange={(e) => onTitleChange?.(e.target.value)}
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Share link display */}
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Share link</p>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="break-all font-mono text-sm text-gray-800">
                {window.location.origin + shareLink}
              </p>
            </div>
          </div>

          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800"
          >
            {copied ? (
              <>
                <span className="text-green-300">&#10003;</span>
                Copied!
              </>
            ) : (
              'Copy link'
            )}
          </button>
        </div>
      )}

      {/* Publish error */}
      {publishError && (
        <p className="text-sm text-red-600">Failed to publish: {publishError}</p>
      )}
    </div>
  );
}
