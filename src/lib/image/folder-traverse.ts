/**
 * Recursive folder traversal via FileSystem Access API (webkitGetAsEntry).
 *
 * Called in the drop handler SYNCHRONOUSLY before awaiting anything — dataTransfer.items
 * is cleared after the microtask boundary. The caller must collect entries synchronously
 * then pass them here:
 *
 *   const entries = Array.from(event.dataTransfer!.items)
 *     .map(item => item.webkitGetAsEntry())
 *     .filter(Boolean) as FileSystemEntry[];
 *   const files = (await Promise.all(entries.map(traverseEntry))).flat();
 *
 * Critical: readEntries() returns at most 100 entries per call (File System API spec).
 * readAllEntries() loops until an empty batch is returned — required for folders > 100 files.
 */

export async function readAllEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  while (true) {
    const batch: FileSystemEntry[] = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

export async function traverseEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    return [file];
  }
  // Directory: recurse
  const dirEntry = entry as FileSystemDirectoryEntry;
  const entries = await readAllEntries(dirEntry.createReader());
  const nested = await Promise.all(entries.map(traverseEntry));
  return nested.flat();
}
