/** Per-image entry stored in the album manifest */
export interface PhotoEntry {
  /** SHA-256 hash of the encrypted full-size blob (IV || ciphertext) */
  hash: string;
  /** SHA-256 hash of the encrypted thumbnail blob (IV || ciphertext) */
  thumbHash: string;
  /** Original image width in pixels */
  width: number;
  /** Original image height in pixels */
  height: number;
  /** Original filename (e.g. IMG_2847.jpg) used for download naming */
  filename: string;
}

/** Album manifest — serialized to JSON, encrypted, uploaded to Blossom as a blob */
export interface AlbumManifest {
  /** Manifest format version */
  v: 1;
  /** Optional user-provided album title */
  title?: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Ordered list of photo entries */
  photos: PhotoEntry[];
}
