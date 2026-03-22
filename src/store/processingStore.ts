/**
 * Zustand store for per-photo processing state.
 * Each photo in the upload queue has a PhotoProcessingState entry.
 * useImageProcessor writes to this store; ProgressList reads from it.
 */
import { create } from 'zustand';
import type { PhotoProcessingState, ProcessedPhoto } from '@/types/processing';

interface ProcessingStoreState {
  /** Map from photo ID to its current processing state */
  photos: Record<string, PhotoProcessingState>;

  /** Add new photos to the queue with status 'pending'. Accumulates — does not reset existing. */
  addPhotos: (files: File[]) => string[];  // returns array of assigned IDs

  /** Transition a photo to 'processing' state */
  setProcessing: (id: string) => void;

  /** Transition a photo to 'done' state with the processing result */
  setResult: (id: string, result: ProcessedPhoto) => void;

  /** Transition a photo to 'error' state with an error message */
  setError: (id: string, error: string) => void;

  /** Reset the entire queue (called when user starts a fresh upload session) */
  reset: () => void;
}

export const useProcessingStore = create<ProcessingStoreState>((set) => ({
  photos: {},

  addPhotos: (files: File[]) => {
    const newEntries: Record<string, PhotoProcessingState> = {};
    const ids: string[] = [];
    files.forEach((file) => {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      ids.push(id);
      newEntries[id] = {
        id,
        filename: file.name,
        fileSize: file.size,
        status: 'pending',
      };
    });
    set((state) => ({ photos: { ...state.photos, ...newEntries } }));
    return ids;
  },

  setProcessing: (id: string) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [id]: { ...state.photos[id], status: 'processing' },
      },
    })),

  setResult: (id: string, result: ProcessedPhoto) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [id]: { ...state.photos[id], status: 'done', result },
      },
    })),

  setError: (id: string, error: string) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [id]: { ...state.photos[id], status: 'error', error },
      },
    })),

  reset: () => set({ photos: {} }),
}));
