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
  /** Display filename — original filename (e.g. IMG_2847.HEIC) when origHash is set, otherwise the webp filename (e.g. IMG_2847.webp) */
  filename: string;
  /** ThumbHash string (base64) for blurred placeholder preview before thumbnail loads */
  thumbhash?: string;
  /** SHA-256 hash of the encrypted original file blob — present when album was created with keepOriginals */
  origHash?: string;
}

/**
 * Reactions & comments configuration stored in the manifest.
 * Only present when the uploader enabled the feature.
 * The album pubkey and privkey are NOT stored here — they are derived at runtime
 * from the nsec in the share URL fragment.
 */
export interface AlbumReactionConfig {
  /** Nostr relay URLs where gift-wrapped reactions and comments are published and queried */
  relays: string[];
}

/** Album manifest v1 — AES key is stored directly in the URL fragment */
export interface AlbumManifestV1 {
  v: 1;
  title?: string;
  createdAt: string;
  photos: PhotoEntry[];
}

/** Album manifest v2 — URL fragment holds a Nostr nsec; AES key is derived via HKDF */
export interface AlbumManifestV2 {
  v: 2;
  title?: string;
  createdAt: string;
  photos: PhotoEntry[];
  /** Present only when the uploader enabled reactions and comments */
  reactions?: AlbumReactionConfig;
}

/** Union type covering both manifest versions */
export type AlbumManifest = AlbumManifestV1 | AlbumManifestV2;
