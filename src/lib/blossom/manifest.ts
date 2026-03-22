import { encryptBlob, decryptBlob } from "@/lib/crypto";
import type { AlbumManifest, AlbumReactionConfig, PhotoEntry } from "@/types/album";

/**
 * Encrypt an AlbumManifest to an IV-prepended blob ready for Blossom upload.
 */
export async function encryptManifest(
  manifest: AlbumManifest,
  key: CryptoKey,
): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  return encryptBlob(json.buffer as ArrayBuffer, key);
}

/**
 * Decrypt an IV-prepended blob and validate it as an AlbumManifest.
 *
 * Validation rules:
 * - v must be 1 or 2
 * - createdAt must be a non-empty string
 * - photos must be an array
 * - each photo must have: hash (64-char hex), thumbHash (64-char hex),
 *   width (positive), height (positive), filename (non-empty string)
 * - v2: reactions field (if present) must have a relays string array
 *
 * @throws Error on decryption failure, unsupported version, or invalid structure
 */
export async function decryptAndValidateManifest(
  blob: Uint8Array,
  key: CryptoKey,
): Promise<AlbumManifest> {
  const plaintext = await decryptBlob(blob, key);
  const json = new TextDecoder().decode(plaintext);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid manifest: not valid JSON");
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.v !== 1 && obj.v !== 2) {
    throw new Error(`Unsupported album version: ${obj.v}`);
  }

  if (typeof obj.createdAt !== "string" || obj.createdAt.length === 0) {
    throw new Error("Invalid manifest: missing createdAt");
  }

  if (!Array.isArray(obj.photos)) {
    throw new Error("Invalid manifest: missing photos array");
  }

  const hexPattern = /^[a-f0-9]{64}$/;
  for (let i = 0; i < obj.photos.length; i++) {
    const p = obj.photos[i] as Record<string, unknown>;
    if (
      typeof p.hash !== "string" || !hexPattern.test(p.hash) ||
      typeof p.thumbHash !== "string" || !hexPattern.test(p.thumbHash) ||
      typeof p.width !== "number" || p.width <= 0 ||
      typeof p.height !== "number" || p.height <= 0 ||
      typeof p.filename !== "string" || p.filename.length === 0
    ) {
      throw new Error(`Invalid photo entry at index ${i}`);
    }
  }

  const base = {
    ...(typeof obj.title === "string" ? { title: obj.title } : {}),
    createdAt: String(obj.createdAt),
    photos: obj.photos as PhotoEntry[],
  };

  if (obj.v === 2) {
    let reactions: AlbumReactionConfig | undefined;
    if (obj.reactions !== undefined && obj.reactions !== null) {
      const r = obj.reactions as Record<string, unknown>;
      if (Array.isArray(r.relays) && r.relays.every((x) => typeof x === "string")) {
        reactions = { relays: r.relays as string[] };
      }
    }
    const expiresAt = typeof obj.expiresAt === "string" && obj.expiresAt.length > 0
      ? obj.expiresAt
      : undefined;
    return { v: 2, ...base, ...(expiresAt ? { expiresAt } : {}), ...(reactions ? { reactions } : {}) };
  }

  return { v: 1, ...base };
}
