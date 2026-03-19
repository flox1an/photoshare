'use client';

import { useImageProcessor } from '@/hooks/useImageProcessor';
import { DropZone } from './DropZone';
import { ProgressList } from './ProgressList';

export default function UploadPanel() {
  const { processBatch, isProcessing } = useImageProcessor();

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">PhotoShare</h1>
        <p className="mb-8 text-gray-500">
          Drop photos below. They are processed locally — nothing leaves your device until you upload.
        </p>
        <DropZone onFiles={processBatch} isProcessing={isProcessing} />
        <ProgressList />
      </div>
    </main>
  );
}
