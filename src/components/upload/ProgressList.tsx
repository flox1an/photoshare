'use client';

import { useProcessingStore } from '@/store/processingStore';
import { useUploadStore } from '@/store/uploadStore';
import type { PhotoProcessingStatus } from '@/types/processing';

export function ProgressList() {
  const photos = useProcessingStore((state) => state.photos);
  const uploadPhotos = useUploadStore((state) => state.photos);
  const entries = Object.values(photos);

  if (entries.length === 0) return null;

  const done = entries.filter((p) => p.status === 'done').length;
  const errors = entries.filter((p) => p.status === 'error').length;
  const total = entries.length;

  return (
    <div className="mt-6 w-full">
      <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
        <span>
          {done} / {total} processed
          {errors > 0 && <span className="ml-2 text-red-500">{errors} failed</span>}
        </span>
        {done === total && total > 0 && (
          <span className="font-medium text-green-600">All done</span>
        )}
      </div>
      <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white">
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
}

function PhotoRow({ filename, status, error }: PhotoRowProps) {
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm">
      <StatusDot status={status} />
      <span className="flex-1 truncate text-gray-800">{filename}</span>
      <span className="shrink-0 capitalize text-xs text-gray-400">{status}</span>
      {error && (
        <span className="shrink-0 text-xs text-red-500" title={error}>
          Error
        </span>
      )}
    </li>
  );
}

function StatusDot({ status }: { status: PhotoProcessingStatus }) {
  const colors: Record<PhotoProcessingStatus, string> = {
    pending: 'bg-gray-300',
    processing: 'bg-blue-400 animate-pulse',
    encrypting: 'bg-purple-400 animate-pulse',
    uploading: 'bg-yellow-400 animate-pulse',
    done: 'bg-green-500',
    error: 'bg-red-500',
  };
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${colors[status]}`} />;
}
