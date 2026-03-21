import { DEFAULT_BLOSSOM_SERVERS } from "@/lib/config";

export interface ResolveResult {
  data: ArrayBuffer;
  server: string;
}

/**
 * Fetch a blob by SHA-256 hash, trying hinted servers first then fallback servers.
 *
 * @param hash - 64-char lowercase hex SHA-256 of the blob
 * @param serverHints - Ordered list of server URLs to try first (full https:// URLs or bare domains)
 * @returns The blob data and which server it came from
 * @throws Error if blob not found on any server
 */
export async function resolveAndFetch(
  hash: string,
  serverHints: string[] = [],
): Promise<ResolveResult> {
  // Normalise hints to full https:// URLs
  const hintUrls = serverHints.map((s) =>
    s.startsWith('http') ? s.replace(/\/$/, '') : `https://${s}`,
  );
  const hintSet = new Set(hintUrls);
  const servers = [
    ...hintUrls,
    ...DEFAULT_BLOSSOM_SERVERS.filter((s) => !hintSet.has(s)),
  ];

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
