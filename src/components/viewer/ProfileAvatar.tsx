import { useNostrProfile, profilePictureUrl, profileDisplayName } from '@/hooks/useNostrProfile';
import { anonDisplayName } from '@/lib/anonName';

interface ProfileAvatarProps {
  pubkey: string;
  size?: 'sm' | 'md';
}

/**
 * Small circular avatar that fetches a Nostr profile and shows the picture.
 * Falls back to a deterministic coloured initial placeholder using an
 * adjective-noun name derived from the pubkey (works for anonymous users too).
 */
export default function ProfileAvatar({ pubkey, size = 'sm' }: ProfileAvatarProps) {
  const profile = useNostrProfile(pubkey);
  const picture = profilePictureUrl(profile);
  // Use the fetched profile name, or fall back to a generated "Adjective Noun" name
  const name = profileDisplayName(profile, anonDisplayName(pubkey));

  const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';

  if (picture) {
    return (
      <img
        src={picture}
        alt={name}
        title={name}
        className={`${dim} rounded-full object-cover ring-1 ring-black/30 shrink-0`}
        onError={(e) => {
          // Remove src so the fallback initial shows
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  // Coloured initial fallback — deterministic colour from pubkey
  const hue = parseInt(pubkey.slice(0, 4), 16) % 360;
  const initial = (name[0] ?? '?').toUpperCase();

  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ background: `hsl(${hue},55%,45%)` }}
      title={name}
    >
      {initial}
    </span>
  );
}
