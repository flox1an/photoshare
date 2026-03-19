'use client';

import { useProcessingStore } from '@/store/processingStore';
import type { PhotoProcessingState } from '@/types/processing';

export function ProgressList() {
  const photos = useProcessingStore((state) => state.photos);
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
      <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {entries.map((photo) => (
          <PhotoRow key={photo.id} photo={photo} />
        ))}
      </ul>
    </div>
  );
}

function PhotoRow({ photo }: { photo: PhotoProcessingState }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm">
      <StatusDot status={photo.status} />
      <span className="flex-1 truncate text-gray-800">{photo.filename}</span>
      <span className="shrink-0 text-xs text-gray-400 capitalize">{photo.status}</span>
      {photo.error && (
        <span className="shrink-0 text-xs text-red-500" title={photo.error}>
          Error
        </span>
      )}
    </li>
  );
}

function StatusDot({ status }: { status: PhotoProcessingState['status'] }) {
  const colors: Record<typeof status, string> = {
    pending: 'bg-gray-300',
    processing: 'bg-blue-400 animate-pulse',
    encrypting: 'bg-purple-400 animate-pulse',
    uploading: 'bg-indigo-400 animate-pulse',
    done: 'bg-green-500',
    error: 'bg-red-500',
  };
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${colors[status]}`} />;
}
