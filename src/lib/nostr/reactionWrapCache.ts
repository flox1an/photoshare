import type { NostrEvent } from 'nostr-tools';

const DB_NAME = 'photoshare-nostr-cache';
const DB_VERSION = 2;
const WRAPS_STORE = 'reaction-wrap-events';
const CURSOR_STORE = 'reaction-wrap-cursors';
const IDX_BY_ALBUM_CREATED_AT = 'by-album-created-at';

type WrapRecord = {
  id: string;
  albumKey: string;
  createdAt: number;
  event: NostrEvent;
};

type CursorRecord = {
  albumKey: string;
  maxCreatedAt: number;
  idsAtMaxTs: string[];
};

export interface ReactionWrapCursor {
  maxCreatedAt: number;
  idsAtMaxTs: string[];
}

class ReactionWrapCache {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains(WRAPS_STORE)) {
          const wraps = db.createObjectStore(WRAPS_STORE, { keyPath: 'id' });
          wraps.createIndex(IDX_BY_ALBUM_CREATED_AT, ['albumKey', 'createdAt']);
        } else {
          const wraps = req.transaction?.objectStore(WRAPS_STORE);
          if (wraps && !wraps.indexNames.contains(IDX_BY_ALBUM_CREATED_AT)) {
            wraps.createIndex(IDX_BY_ALBUM_CREATED_AT, ['albumKey', 'createdAt']);
          }
        }

        if (!db.objectStoreNames.contains(CURSOR_STORE)) {
          db.createObjectStore(CURSOR_STORE, { keyPath: 'albumKey' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open reaction cache database'));
    });
    return this.dbPromise;
  }

  async getCursor(albumKey: string): Promise<ReactionWrapCursor | null> {
    try {
      const db = await this.getDb();
      return await new Promise<ReactionWrapCursor | null>((resolve, reject) => {
        const tx = db.transaction(CURSOR_STORE, 'readonly');
        const store = tx.objectStore(CURSOR_STORE);
        const req = store.get(albumKey);
        req.onsuccess = () => {
          const row = req.result as CursorRecord | undefined;
          if (!row) return resolve(null);
          resolve({
            maxCreatedAt: row.maxCreatedAt,
            idsAtMaxTs: Array.isArray(row.idsAtMaxTs) ? row.idsAtMaxTs : [],
          });
        };
        req.onerror = () => reject(req.error ?? new Error('Failed to read reaction cursor'));
      });
    } catch {
      return null;
    }
  }

  async setCursor(albumKey: string, cursor: ReactionWrapCursor): Promise<void> {
    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CURSOR_STORE, 'readwrite');
        const store = tx.objectStore(CURSOR_STORE);
        const req = store.put({
          albumKey,
          maxCreatedAt: cursor.maxCreatedAt,
          idsAtMaxTs: cursor.idsAtMaxTs,
        } as CursorRecord);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('Failed to write reaction cursor'));
      });
    } catch {
      // best effort
    }
  }

  async getEvents(albumKey: string): Promise<NostrEvent[]> {
    try {
      const db = await this.getDb();
      return await new Promise<NostrEvent[]>((resolve, reject) => {
        const tx = db.transaction(WRAPS_STORE, 'readonly');
        const store = tx.objectStore(WRAPS_STORE);
        const index = store.index(IDX_BY_ALBUM_CREATED_AT);
        const range = IDBKeyRange.bound([albumKey, 0], [albumKey, Number.MAX_SAFE_INTEGER]);
        const req = index.getAll(range);
        req.onsuccess = () => {
          const rows = (req.result as WrapRecord[]) ?? [];
          resolve(rows.map((r) => r.event));
        };
        req.onerror = () => reject(req.error ?? new Error('Failed to read cached reaction events'));
      });
    } catch {
      return [];
    }
  }

  async putEvent(albumKey: string, event: NostrEvent): Promise<void> {
    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(WRAPS_STORE, 'readwrite');
        const store = tx.objectStore(WRAPS_STORE);
        const req = store.put({
          id: event.id,
          albumKey,
          createdAt: event.created_at ?? 0,
          event,
        } as WrapRecord);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('Failed to cache reaction event'));
      });
    } catch {
      // best effort
    }
  }
}

let singleton: ReactionWrapCache | null = null;

export function getReactionWrapCache(): ReactionWrapCache | null {
  if (typeof window === 'undefined') return null;
  if (!('indexedDB' in window)) return null;
  if (!singleton) singleton = new ReactionWrapCache();
  return singleton;
}

