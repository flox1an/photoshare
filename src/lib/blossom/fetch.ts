/**
 * Blossom blob retrieval — BUD-01 GET /<sha256>
 * Fetches an encrypted blob by SHA-256 hash from a Blossom server.
 * No auth required for GET per BUD-01 spec.
 */
export async function fetchBlob(server: string, sha256: string): Promise<ArrayBuffer> {
  const base = server.replace(/\/$/, '');
  const url = `${base}/${sha256}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Blossom fetch failed: ${res.status} ${url}`);
  return res.arrayBuffer();
}
