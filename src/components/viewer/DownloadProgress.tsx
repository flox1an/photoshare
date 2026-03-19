"use client";

interface DownloadProgressProps {
  current: number;
  total: number;
}

export default function DownloadProgress({ current, total }: DownloadProgressProps) {
  const percent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full px-4 py-2">
      <p className="text-sm text-gray-600 mb-1">Downloading {current}/{total}...</p>
      <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
        <div
          className="h-2 bg-blue-500 rounded transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
