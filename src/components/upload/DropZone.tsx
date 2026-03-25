'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { forEachFileEntry } from '@/lib/image/folder-traverse';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  isProcessing: boolean;
  /** Prevent new drops during upload phase — shows opacity-50 and blocks interaction */
  disabled?: boolean;
}

function compareEntryNames(a: FileSystemEntry, b: FileSystemEntry): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function DropZone({ onFiles, isProcessing, disabled = false }: DropZoneProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);

  // react-dropzone handles file picker (click) and basic drag-drop for individual files
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: false,
    noKeyboard: false,
    // Accept all image types including HEIC (detected by magic bytes, not MIME)
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.tiff', '.bmp'],
    },
    onDrop: (acceptedFiles) => {
      // react-dropzone resolves individual files; folders handled by native onDrop below
      if (acceptedFiles.length > 0) {
        setScannedCount(acceptedFiles.length);
        onFiles(acceptedFiles);
      }
    },
  });

  // Native drop handler intercepts folder drops using webkitGetAsEntry()
  // Must collect entries synchronously (dataTransfer.items cleared after microtask boundary)
  // Streams files to onFiles in chunks for instant UI feedback
  const handleNativeDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsScanning(true);
      setScannedCount(0);

      const items = Array.from(e.dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry())
        .filter(Boolean)
        .sort(compareEntryNames) as FileSystemEntry[];

      if (entries.length === 0) {
        setIsScanning(false);
        return;
      }

      // Resolve entries and stream files to the UI as they become available
      // This gives instant feedback — files appear in ProgressList immediately
      const CHUNK_SIZE = 24;
      let buffer: File[] = [];
      let discovered = 0;

      const flush = () => {
        if (buffer.length > 0) {
          onFiles(buffer);
          buffer = [];
        }
      };

      try {
        for (const entry of entries) {
          await forEachFileEntry(entry, (file) => {
            if (!isImageFile(file)) return;
            discovered += 1;
            buffer.push(file);
            if (discovered % CHUNK_SIZE === 0) setScannedCount(discovered);
            if (buffer.length >= CHUNK_SIZE) flush();
          });
        }
        flush(); // flush remaining files
        setScannedCount(discovered);
      } finally {
        setIsScanning(false);
      }
    },
    [onFiles],
  );

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const rootProps = getRootProps({
    onDrop: handleNativeDrop,
    onDragOver: handleDragOver,
  });

  return (
    <div
      {...rootProps}
      className={[
        'flex flex-col items-center justify-center',
        'rounded-xl border border-dashed p-12 text-center',
        'cursor-pointer transition-all duration-200',
        isDragActive
          ? 'border-zinc-400 bg-zinc-800/60 text-zinc-300'
          : 'border-zinc-700 bg-zinc-900/50 text-zinc-500 hover:border-zinc-500 hover:bg-zinc-800/40',
        (isProcessing || isScanning) ? 'opacity-75 pointer-events-none' : '',
        disabled ? 'opacity-50 pointer-events-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input {...getInputProps()} />
      <div className="mb-3 text-zinc-600">
        <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-zinc-300">
        {isScanning
          ? `Scanning dropped files${scannedCount > 0 ? ` (${scannedCount})` : '...'}`
          : isDragActive
            ? 'Drop photos here'
            : 'Drag photos or a folder here'}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {isScanning ? 'Preparing upload queue...' : 'or click to select files'}
      </p>
      <p className="mt-3 text-xs text-zinc-600">JPEG, PNG, HEIC, WebP</p>
    </div>
  );
}

/** Filter helper — accept common image extensions + unknown (potential HEIC with no extension) */
function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'bmp', 'avif'].includes(ext);
}
