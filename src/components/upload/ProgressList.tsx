'use client';

import { useEffect, useState } from 'react';
import { useProcessingStore } from '@/store/processingStore';
import { useUploadStore } from '@/store/uploadStore';
import type { PhotoProcessingStatus } from '@/types/processing';

export function ProgressList() {
  const photos = useProcessingStore((state) => state.photos);
  const uploadPhotos = useUploadStore((state) => state.photos);
  const entries = Object.values(photos);

  if (entries.length === 0) return null;

  const isUploadPhase = Object.keys(uploadPhotos).length > 0;
  const done = entries.filter((p) => {
    const s = uploadPhotos[p.id]?.status ?? p.status;
    return s === 'done';
  }).length;
  const errors = entries.filter((p) => {
    const s = uploadPhotos[p.id]?.status ?? p.status;
    return s === 'error';
  }).length;
  const total = entries.length;

  const totalBytes = entries.reduce((sum, p) => sum + (p.fileSize ?? 0), 0);
  const totalSize = totalBytes >= 1024 * 1024 * 1024
    ? `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    : `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="mt-5 w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {done}/{total} {isUploadPhase ? 'uploaded' : 'processed'}
          {totalBytes > 0 && <span className="ml-2 text-zinc-600">· {totalSize}</span>}
          {errors > 0 && <span className="ml-2 text-red-400">{errors} failed</span>}
        </span>
        {done === total && total > 0 && (
          <span className="font-medium text-emerald-400">Ready</span>
        )}
      </div>
      <ul className="max-h-72 divide-y divide-zinc-800 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50">
        {entries.map((photo) => {
          // If this photo has an upload state, use the upload status for display
          const uploadState = uploadPhotos[photo.id];
          const displayStatus: PhotoProcessingStatus = uploadState ? uploadState.status : photo.status;
          const displayError = uploadState?.error ?? photo.error;
          return (
            <PhotoRow
              key={photo.id}
              filename={photo.filename}
              status={displayStatus}
              error={displayError}
              thumbData={photo.result?.thumb}
              mimeType={photo.result?.mimeType}
            />
          );
        })}
      </ul>
    </div>
  );
}

interface PhotoRowProps {
  filename: string;
  status: PhotoProcessingStatus;
  error?: string;
  thumbData?: ArrayBuffer;
  mimeType?: string;
}

function PhotoRow({ filename, status, error, thumbData, mimeType }: PhotoRowProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbData) return;
    const blob = new Blob([thumbData], { type: mimeType ?? 'image/webp' });
    const url = URL.createObjectURL(blob);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbData, mimeType]);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm">
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded object-cover"
        />
      ) : (
        <StatusDot status={status} />
      )}
      <span className="flex-1 truncate text-zinc-300 font-mono text-xs">{filename}</span>
      <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">{status}</span>
      {error && (
        <span className="shrink-0 text-[10px] text-red-400" title={error}>
          Error
        </span>
      )}
    </li>
  );
}

function StatusDot({ status }: { status: PhotoProcessingStatus }) {
  const colors: Record<PhotoProcessingStatus, string> = {
    pending: 'bg-zinc-600',
    processing: 'bg-blue-400 animate-pulse',
    encrypting: 'bg-violet-400 animate-pulse',
    uploading: 'bg-amber-400 animate-pulse',
    done: 'bg-emerald-400',
    error: 'bg-red-400',
  };
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colors[status]}`} />;
}
