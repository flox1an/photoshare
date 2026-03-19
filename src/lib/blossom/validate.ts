/**
 * Blossom server validation — checks a server URL for reachability and CORS support.
 *
 * validateBlossomServer performs a HEAD request with a 5-second timeout.
 * Returns true ONLY when:
 *   1. The response status is ok (2xx)
 *   2. The response includes the "access-control-allow-origin" header
 *
 * The CORS check is mandatory — without CORS, browser uploads will be blocked
 * by the same-origin policy and the upload flow will fail silently.
 *
 * Returns false on any error (network timeout, DNS failure, non-2xx, missing CORS).
 */

/**
 * Validate that a Blossom server is reachable and CORS-enabled.
 *
 * @param url Full URL of the Blossom server (e.g., "https://24242.io")
 * @returns true if server is reachable and responds with CORS headers; false otherwise
 */
export async function validateBlossomServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return false;
    }

    // CORS check — required for browser-based uploads (CONF-02)
    const corsHeader = response.headers.get("access-control-allow-origin");
    return corsHeader !== null;
  } catch {
    return false;
  }
}
