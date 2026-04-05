import {
  buildBlossomDeleteBatchAuth,
  chunkHashesForAuth,
  deleteBlob,
} from '@/lib/blossom/upload';
import {
  deleteAlbumCleanupRecordEvent,
  type AlbumCleanupRecord,
  type Nip44CapableSigner,
} from '@/lib/nostr/albumCleanupRecord';

export interface CleanupRunResult {
  checkedRecords: number;
  expiredRecords: number;
  fullyDeletedRecords: number;
  blobDeleteAttempts: number;
  blobDeleteSuccesses: number;
  blobDeleteFailures: number;
  deletedRecordEventIds: string[];
  failedRecordEventIds: string[];
}

export interface CleanupRunProgress {
  totalExpiredRecords: number;
  processedExpiredRecords: number;
  totalBlobDeletes: number;
  processedBlobDeletes: number;
  currentRecordEventId: string | null;
}

export interface RunCleanupNowParams {
  signer: Nip44CapableSigner;
  relays: string[];
  records: AlbumCleanupRecord[];
  nowUnix?: number;
  onProgress?: (progress: CleanupRunProgress) => void;
}

export async function runCleanupNow({
  signer,
  relays,
  records,
  nowUnix = Math.floor(Date.now() / 1000),
  onProgress,
}: RunCleanupNowParams): Promise<CleanupRunResult> {
  const isNotFoundDeleteError = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    return /\b404\b/.test(err.message);
  };
  const isAuthError = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    return /\b401\b|\b403\b|unauthorized|forbidden|auth/i.test(err.message);
  };

  const expired = records.filter((record) => record.payload.e <= nowUnix);
  const totalBlobDeletes = expired.reduce(
    (sum, record) => sum + (record.payload.s.length * record.payload.x.length),
    0,
  );
  const result: CleanupRunResult = {
    checkedRecords: records.length,
    expiredRecords: expired.length,
    fullyDeletedRecords: 0,
    blobDeleteAttempts: 0,
    blobDeleteSuccesses: 0,
    blobDeleteFailures: 0,
    deletedRecordEventIds: [],
    failedRecordEventIds: [],
  };
  let processedExpiredRecords = 0;
  let processedBlobDeletes = 0;

  const emitProgress = (currentRecordEventId: string | null) => {
    onProgress?.({
      totalExpiredRecords: expired.length,
      processedExpiredRecords,
      totalBlobDeletes,
      processedBlobDeletes,
      currentRecordEventId,
    });
  };

  emitProgress(expired[0]?.event.id ?? null);

  const cleanupRecord = async (record: AlbumCleanupRecord) => {
    let allDeleted = true;

    for (const server of record.payload.s) {
      const hashChunks = chunkHashesForAuth(record.payload.x);
      const chunkAuths = await Promise.all(
        hashChunks.map(async (chunk) => buildBlossomDeleteBatchAuth(signer as never, chunk, server)),
      );

      for (let chunkIndex = 0; chunkIndex < hashChunks.length; chunkIndex += 1) {
        const chunk = hashChunks[chunkIndex];
        const chunkAuth = chunkAuths[chunkIndex];
        for (const hash of chunk) {
          result.blobDeleteAttempts += 1;
          try {
            await deleteBlob(server, hash, chunkAuth);
            result.blobDeleteSuccesses += 1;
            processedBlobDeletes += 1;
            emitProgress(record.event.id);
          } catch (err) {
            if (isNotFoundDeleteError(err)) {
              // Idempotent cleanup: already absent blobs count as success.
              result.blobDeleteSuccesses += 1;
              processedBlobDeletes += 1;
              emitProgress(record.event.id);
              continue;
            }

            if (isAuthError(err) && chunk.length > 1) {
              try {
                const singleAuth = await buildBlossomDeleteBatchAuth(
                  signer as never,
                  [hash],
                  server,
                );
                result.blobDeleteAttempts += 1;
                await deleteBlob(server, hash, singleAuth);
                result.blobDeleteSuccesses += 1;
                processedBlobDeletes += 1;
                emitProgress(record.event.id);
                continue;
              } catch (fallbackErr) {
                if (isNotFoundDeleteError(fallbackErr)) {
                  result.blobDeleteSuccesses += 1;
                  processedBlobDeletes += 1;
                  emitProgress(record.event.id);
                  continue;
                }
              }
            }

            allDeleted = false;
            result.blobDeleteFailures += 1;
            processedBlobDeletes += 1;
            emitProgress(record.event.id);
          }
        }
      }
    }

    if (!allDeleted) {
      result.failedRecordEventIds.push(record.event.id);
      processedExpiredRecords += 1;
      emitProgress(record.event.id);
      return;
    }

    try {
      await deleteAlbumCleanupRecordEvent({
        signer,
        relays,
        recordEventId: record.event.id,
      });
      result.fullyDeletedRecords += 1;
      result.deletedRecordEventIds.push(record.event.id);
    } catch {
      result.failedRecordEventIds.push(record.event.id);
    }
    processedExpiredRecords += 1;
    emitProgress(record.event.id);
  };

  const workerCount = Math.min(3, expired.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= expired.length) return;
      await cleanupRecord(expired[idx]);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  emitProgress(null);

  return result;
}
