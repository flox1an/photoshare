/**
 * BlobDescriptor — BUD-02 Blossom upload response.
 * Returned by the Blossom server after a successful blob upload.
 * See: https://github.com/hzrd149/blossom/blob/master/BUD-02.md
 */
export interface BlobDescriptor {
  url: string;
  sha256: string; // lowercase hex, 64 chars
  size: number;
  type: string;
  uploaded: number; // Unix timestamp
}
