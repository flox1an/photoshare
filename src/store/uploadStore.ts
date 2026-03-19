/**
 * Zustand store for per-photo upload state.
 * Tracks the upload phase: encrypting → uploading → done | error.
 * Photos are added here when they are ready to be uploaded (after Phase 2 processing).
 * useUploadBlob writes to this store; ProgressList reads from it.
 */
import { create } from 'zustand';
import type { PhotoProcessingStatus } from '@/types/processing';

/**
 * Blossom BlobDescriptor — the result returned after a successful upload.
 * Mirrors the blossom-client-sdk BlobDescriptor shape.
 */
export interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

/** Per-photo upload state tracked in the Zustand store */
export interface PhotoUploadState {
  id: string;
  filename: string;
  status: PhotoProcessingStatus;
  /** Set when status === 'done' — the Blossom upload result */
  result?: BlobDescriptor;
  /** Set when status === 'error' */
  error?: string;
}

interface UploadStoreState {
  /** Map from photo ID to its current upload state */
  photos: Record<string, PhotoUploadState>;

  /** Add a new photo to the upload queue with status 'pending' */
  addPhoto: (id: string, filename: string) => void;

  /** Transition a photo to 'encrypting' state */
  setEncrypting: (id: string) => void;

  /** Transition a photo to 'uploading' state */
  setUploading: (id: string) => void;

  /** Transition a photo to 'done' state with the BlobDescriptor result */
  setUploadDone: (id: string, descriptor: BlobDescriptor) => void;

  /** Transition a photo to 'error' state with an error message */
  setUploadError: (id: string, error: string) => void;

  /** Reset the entire upload queue */
  reset: () => void;
}

export const useUploadStore = create<UploadStoreState>((set) => ({
  photos: {},

  addPhoto: (id: string, filename: string) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [id]: { id, filename, status: 'pending' },
      },
    })),

  setEncrypting: (id: string) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [id]: { ...state.photos[id], status: 'encrypting' },
      },
    })),

  setUploading: (id: string) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [id]: { ...state.photos[id], status: 'uploading' },
      },
    })),

  setUploadDone: (id: string, descriptor: BlobDescriptor) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [id]: { ...state.photos[id], status: 'done', result: descriptor },
      },
    })),

  setUploadError: (id: string, error: string) =>
    set((state) => ({
      photos: {
        ...state.photos,
        [id]: { ...state.photos[id], status: 'error', error },
      },
    })),

  reset: () => set({ photos: {} }),
}));
