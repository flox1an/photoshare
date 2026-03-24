import { persistEncryptedContent } from 'applesauce-common/helpers/encrypted-content-cache';
import { eventStore } from '@/lib/nostr/eventStore';

const DB_NAME = 'photoshare-encrypted-content';
const STORE_NAME = 'encrypted-content';
const DB_VERSION = 1;

type CacheRecord = {
  id: string;
  value: string;
};

class IndexedDbEncryptedContentCache {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    });
    return this.dbPromise;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDb();
      return await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const row = req.result as CacheRecord | undefined;
          resolve(row?.value ?? null);
        };
        req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
      });
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ id: key, value } as CacheRecord);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('IndexedDB write failed'));
      });
    } catch {
      // Best-effort cache only; write failures must not affect reaction flow.
    }
  }
}

let stopEncryptedContentPersistence: (() => void) | null = null;

/**
 * Starts applesauce encrypted-content persistence once per page session.
 * Safe to call repeatedly.
 */
export function ensureEncryptedContentCachePersistence(): void {
  if (typeof window === 'undefined') return;
  if (!('indexedDB' in window)) return;
  if (stopEncryptedContentPersistence) return;

  const storage = new IndexedDbEncryptedContentCache();
  stopEncryptedContentPersistence = persistEncryptedContent(eventStore, storage);
}

