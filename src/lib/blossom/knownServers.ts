export interface KnownServer {
  name: string;
  /** Max TTL the server enforces, in seconds. null = permanent (no known limit). */
  maxExpirySeconds: number | null;
}

const KNOWN_SERVERS: Record<string, KnownServer> = {
  'tempstore.apps3.slidestr.net': { name: 'Temp Store', maxExpirySeconds: 86_400 },
  'blossom.primal.net': { name: 'Primal', maxExpirySeconds: null },
};

/**
 * Returns known-server metadata for the given URL, or null if unrecognised.
 * Matches on hostname only and ignores path/trailing slashes.
 */
export function getKnownServer(url: string): KnownServer | null {
  try {
    const { hostname } = new URL(url);
    return KNOWN_SERVERS[hostname] ?? null;
  } catch {
    return null;
  }
}

function formatUnit(value: number, unit: string): string {
  const rounded = Math.round(value);
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

/**
 * Returns a human-readable duration string for a number of seconds.
 * e.g. 86400 -> "1 day", 3600 -> "1 hour", 604800 -> "1 week"
 */
export function formatExpiry(seconds: number): string {
  if (seconds >= 31_536_000) return formatUnit(seconds / 31_536_000, 'year');
  if (seconds >= 2_592_000) return formatUnit(seconds / 2_592_000, 'month');
  if (seconds >= 604_800) return formatUnit(seconds / 604_800, 'week');
  if (seconds >= 86_400) return formatUnit(seconds / 86_400, 'day');
  if (seconds >= 3_600) return formatUnit(seconds / 3_600, 'hour');
  return formatUnit(Math.max(1, seconds / 60), 'min');
}
