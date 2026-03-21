
interface DownloadProgressProps {
  current: number;
  total: number;
}

export default function DownloadProgress({ current, total }: DownloadProgressProps) {
  const percent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full px-5 py-3">
      <p className="text-xs text-zinc-500 mb-1.5">Downloading {current}/{total}...</p>
      <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
        <div
          className="h-1 bg-zinc-400 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
