/** Per-image entry stored in the album manifest (encrypted as kind 30078 event content) */
export interface PhotoEntry {
  /** SHA-256 hash of the encrypted full-size blob — used as Blossom blob address */
  hash: string;
  /** base64url-encoded 12-byte IV used to encrypt the full-size blob */
  iv: string;
  /** SHA-256 hash of the encrypted thumbnail blob */
  thumbHash: string;
  /** base64url-encoded 12-byte IV used to encrypt the thumbnail blob */
  thumbIv: string;
  /** Original image width in pixels (for grid layout and aspect ratio) */
  width: number;
  /** Original image height in pixels */
  height: number;
  /** Original filename (e.g. IMG_2847.jpg) used for download naming */
  filename: string;
}

/** Album manifest — serialized to JSON, then encrypted as kind 30078 event content */
export interface AlbumManifest {
  /** Optional user-provided album title */
  title?: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Ordered list of photo entries */
  photos: PhotoEntry[];
}
