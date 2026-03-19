import { describe, it, expect } from 'vitest';
import { traverseEntry, readAllEntries } from '@/lib/image/folder-traverse';

/**
 * Wave 0 test scaffold for folder traversal (PROC-02).
 * These tests are RED — traverseEntry and readAllEntries are not yet implemented.
 * Plans 02-02+ will implement the functions and turn these GREEN.
 */

// Minimal mock of the FileSystem Entry API (no real FileSystem access needed)
function makeMockFile(name = 'photo.jpg'): File {
  return new File([new Uint8Array([0xff, 0xd8])], name, { type: 'image/jpeg' });
}

function makeFileEntry(file: File): FileSystemFileEntry {
  return {
    isFile: true,
    isDirectory: false,
    name: file.name,
    fullPath: `/${file.name}`,
    filesystem: {} as FileSystem,
    file: (ok: (f: File) => void, _err?: (e: DOMException) => void) => ok(file),
    getParent: () => {},
  } as unknown as FileSystemFileEntry;
}

function makeDirectoryEntry(childEntries: FileSystemEntry[]): FileSystemDirectoryEntry {
  let callCount = 0;
  return {
    isFile: false,
    isDirectory: true,
    name: 'photos',
    fullPath: '/photos',
    filesystem: {} as FileSystem,
    createReader: () => ({
      readEntries: (ok: (entries: FileSystemEntry[]) => void) => {
        // First call returns children, second call signals end of iteration
        ok(callCount++ === 0 ? childEntries : []);
      },
    }),
    getParent: () => {},
    getFile: () => {},
    getDirectory: () => {},
  } as unknown as FileSystemDirectoryEntry;
}

describe('traverseEntry', () => {
  it('returns a single File when given a FileSystemFileEntry', async () => {
    const mockFile = makeMockFile('IMG_0001.jpg');
    const entry = makeFileEntry(mockFile);
    const result = await traverseEntry(entry);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(mockFile);
  });

  it('returns all nested Files when given a directory entry', async () => {
    const file1 = makeMockFile('IMG_0001.jpg');
    const file2 = makeMockFile('IMG_0002.jpg');
    const dirEntry = makeDirectoryEntry([makeFileEntry(file1), makeFileEntry(file2)]);
    const result = await traverseEntry(dirEntry);
    expect(result).toHaveLength(2);
    expect(result).toContain(file1);
    expect(result).toContain(file2);
  });
});

describe('readAllEntries', () => {
  it('handles pagination — loops until readEntries returns empty array', async () => {
    const files = [
      makeMockFile('a.jpg'),
      makeMockFile('b.jpg'),
      makeMockFile('c.jpg'),
    ];
    const fileEntries = files.map(makeFileEntry);

    let callCount = 0;
    const reader: FileSystemDirectoryReader = {
      readEntries: (ok: (entries: FileSystemEntry[]) => void) => {
        // First call: 3 entries; second call: empty (signals end)
        ok(callCount++ === 0 ? fileEntries : []);
      },
    } as unknown as FileSystemDirectoryReader;

    const result = await readAllEntries(reader);
    expect(result).toHaveLength(3);
    expect(result).toEqual(fileEntries);
  });
});
