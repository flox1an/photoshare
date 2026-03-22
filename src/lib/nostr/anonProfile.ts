/**
 * Anonymous profile management.
 *
 * Stores the user's chosen display name in localStorage and can build a
 * signed kind 0 profile event using the persistent anon private key.
 * The signed event can be put into the EventStore directly and also
 * gift-wrapped to the album pubkey so other viewers see the chosen name.
 */

import { finalizeEvent } from 'nostr-tools';
import type { NostrEvent } from 'nostr-tools';

const PROFILE_NAME_KEY = 'photoshare:anon-name';
const PROFILE_PROMPTED_KEY = 'photoshare:anon-profile-prompted';

/** Returns the user-chosen display name, or null if they haven't set one. */
export function getAnonProfileName(): string | null {
  try {
    return localStorage.getItem(PROFILE_NAME_KEY);
  } catch {
    return null;
  }
}

/** Persists the user's chosen display name to localStorage. */
export function setAnonProfileName(name: string): void {
  try {
    localStorage.setItem(PROFILE_NAME_KEY, name);
  } catch {
    // ignore
  }
}

/** True if the onboarding prompt has already been shown this browser. */
export function hasBeenPrompted(): boolean {
  try {
    return localStorage.getItem(PROFILE_PROMPTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Mark that the onboarding prompt has been shown. */
export function markPrompted(): void {
  try {
    localStorage.setItem(PROFILE_PROMPTED_KEY, '1');
  } catch {
    // ignore
  }
}

/** Returns true if we have already sent our profile gift wrap to this album pubkey. */
export function hasProfileBeenSentToAlbum(albumPubkey: string): boolean {
  try {
    return localStorage.getItem(`photoshare:anon-profile-sent:${albumPubkey}`) === '1';
  } catch {
    return false;
  }
}

/** Mark that our profile has been sent to this album pubkey. */
export function markProfileSentToAlbum(albumPubkey: string): void {
  try {
    localStorage.setItem(`photoshare:anon-profile-sent:${albumPubkey}`, '1');
  } catch {
    // ignore
  }
}

/**
 * Build and sign a kind 0 (profile metadata) event with the given name,
 * signed by the anon private key.
 *
 * Returns a fully signed NostrEvent that can be added to the EventStore
 * and/or gift-wrapped for the album.
 */
export function buildSignedProfileEvent(name: string, privkey: Uint8Array): NostrEvent {
  return finalizeEvent(
    {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify({ name }),
    },
    privkey,
  );
}
