'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { traverseEntry } from '@/lib/image/folder-traverse';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  isProcessing: boolean;
}

export function DropZone({ onFiles, isProcessing }: DropZoneProps) {
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
      if (acceptedFiles.length > 0) onFiles(acceptedFiles);
    },
  });

  // Native drop handler intercepts folder drops using webkitGetAsEntry()
  // Must collect entries synchronously (dataTransfer.items cleared after microtask boundary)
  // Streams files to onFiles in chunks for instant UI feedback
  const handleNativeDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const items = Array.from(e.dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry())
        .filter(Boolean) as FileSystemEntry[];

      if (entries.length === 0) return;

      // Resolve entries and stream files to the UI as they become available
      // This gives instant feedback — files appear in ProgressList immediately
      const CHUNK_SIZE = 10;
      let buffer: File[] = [];

      const flush = () => {
        if (buffer.length > 0) {
          onFiles(buffer);
          buffer = [];
        }
      };

      const resolveEntry = async (entry: FileSystemEntry) => {
        const files = await traverseEntry(entry);
        for (const file of files) {
          if (isImageFile(file)) {
            buffer.push(file);
            if (buffer.length >= CHUNK_SIZE) flush();
          }
        }
      };

      await Promise.all(entries.map(resolveEntry));
      flush(); // flush remaining files
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
        'rounded-xl border-2 border-dashed p-12 text-center',
        'cursor-pointer transition-colors',
        isDragActive
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400',
        isProcessing ? 'opacity-75 pointer-events-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input {...getInputProps()} />
      <p className="text-lg font-medium">
        {isDragActive ? 'Drop photos here' : 'Drag photos or a folder here'}
      </p>
      <p className="mt-1 text-sm">or click to select files</p>
      <p className="mt-2 text-xs text-gray-400">JPEG, PNG, HEIC, WebP — up to 200 photos</p>
    </div>
  );
}

/** Filter helper — accept common image extensions + unknown (potential HEIC with no extension) */
function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'bmp', 'avif'].includes(ext);
}
