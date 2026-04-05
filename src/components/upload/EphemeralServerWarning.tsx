import { Link } from 'react-router-dom';
import { formatExpiry } from '@/lib/blossom/knownServers';

interface EphemeralServerWarningProps {
  serverName: string;
  maxExpirySeconds: number;
}

/**
 * Thin high-contrast warning strip shown before upload when the primary Blossom
 * server has a known maximum TTL. Links to /settings.
 */
export function EphemeralServerWarning({
  serverName,
  maxExpirySeconds,
}: EphemeralServerWarningProps) {
  const duration = formatExpiry(maxExpirySeconds);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-rose-500/45 bg-rose-950/45 px-3 py-2 text-xs text-rose-100">
      <svg
        className="h-3.5 w-3.5 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>
        {serverName} · files expire in {duration}
      </span>
      <Link
        to="/settings"
        className="ml-auto whitespace-nowrap text-rose-200 underline hover:text-rose-50 transition-colors"
      >
        Settings →
      </Link>
    </div>
  );
}
