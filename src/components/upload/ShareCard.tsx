'use client';

import { useState } from 'react';
import { useUploadStore } from '@/store/uploadStore';

interface ShareCardProps {
  shareLink: string | null;
  albumExpiresAt: string | null;
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
function formatExpiration(expiresAt: string): string {
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return expiresAt;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ShareCard({ shareLink, albumExpiresAt, isUploading, publishError }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const uploadPhotos = useUploadStore((state) => state.photos);
  const uploadEntries = Object.values(uploadPhotos);
  const total = uploadEntries.length;
  const done = uploadEntries.filter((p) => p.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

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
      {/* Upload progress bar — shown while upload is in-flight */}
      {isUploading && !shareLink && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Uploading…</span>
            <span>{done}/{total}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-300 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Share link UI — shown once relay confirms ok=true */}
      {shareLink && (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-800/70 bg-red-950/30 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-red-300">Important</p>
            <p className="mt-1 text-sm text-red-200">
              This link is only shown <strong>ONCE</strong>. Save the full URL including everything after
              {' '}
              <span className="font-mono">#</span>
              {' '}
              before leaving this page.
            </p>
          </div>
          {albumExpiresAt && (
            <div className="rounded-lg border border-amber-800/70 bg-amber-950/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-amber-300">Album expires</p>
              <p className="mt-1 text-sm text-amber-200">{formatExpiration(albumExpiresAt)}</p>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Share link</p>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3">
              <p className="break-all font-mono text-xs text-zinc-300">
                {window.location.origin + shareLink}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={window.location.origin + shareLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white active:bg-zinc-200 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Open album
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
        </div>
      )}

      {/* Publish error */}
      {publishError && (
        <p className="text-sm text-red-400">Failed to publish: {publishError}</p>
      )}
    </div>
  );
}
