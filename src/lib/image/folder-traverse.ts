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

async function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject));
}

/**
 * Stream files from a file/directory entry without building a full in-memory file list.
 * Uses iterative DFS to avoid deep recursion and allows callers to start processing early.
 */
export async function forEachFileEntry(
  root: FileSystemEntry,
  onFile: (file: File) => void | Promise<void>,
): Promise<void> {
  const stack: FileSystemEntry[] = [root];

  while (stack.length > 0) {
    const entry = stack.pop()!;
    if (entry.isFile) {
      const file = await readFileEntry(entry as FileSystemFileEntry);
      await onFile(file);
      continue;
    }

    const dirEntry = entry as FileSystemDirectoryEntry;
    const entries = await readAllEntries(dirEntry.createReader());
    for (let i = entries.length - 1; i >= 0; i--) {
      stack.push(entries[i]);
    }
  }
}

export async function traverseEntry(entry: FileSystemEntry): Promise<File[]> {
  const files: File[] = [];
  await forEachFileEntry(entry, (file) => {
    files.push(file);
  });
  return files;
}
