import { DEFAULT_BLOSSOM_SERVERS } from "@/lib/config";

export interface ResolveResult {
  data: ArrayBuffer;
  server: string;
}

/**
 * Fetch a blob by SHA-256 hash, trying xs hint first then fallback servers.
 *
 * @param hash - 64-char lowercase hex SHA-256 of the blob
 * @param xsHint - Optional domain hint (https assumed, no protocol prefix)
 * @returns The blob data and which server it came from
 * @throws Error if blob not found on any server
 */
export async function resolveAndFetch(
  hash: string,
  xsHint?: string,
): Promise<ResolveResult> {
  const servers = xsHint
    ? [`https://${xsHint}`, ...DEFAULT_BLOSSOM_SERVERS.filter((s) => s !== `https://${xsHint}`)]
    : DEFAULT_BLOSSOM_SERVERS;

  for (const server of servers) {
    try {
      const base = server.replace(/\/$/, "");
      const res = await fetch(`${base}/${hash}`);
      if (res.ok) {
        return { data: await res.arrayBuffer(), server: base };
      }
    } catch {
      // Network error — try next server
    }
  }

  throw new Error("Blob not found on any server");
}
