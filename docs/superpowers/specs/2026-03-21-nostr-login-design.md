# Nostr Login — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

Add optional Nostr login to PhotoShare to allow Blossom uploads in a user context. Without login the app works exactly as today (ephemeral signer). With login, the user's signer replaces the ephemeral one for BUD-11 auth headers. Login state persists across page reloads via localStorage.

## Login Methods

Three methods, matching the nostube reference implementation:

1. **QR / NostrConnect (NIP-46)** — default tab. Generates a `nostrconnect://` URI, renders it as a QR code. User scans with a mobile Nostr signer app (Amber, Nostrudel, etc.). Uses `NostrConnectSigner` from `applesauce-signers`.
2. **Extension (NIP-07)** — one-click. Uses `ExtensionSigner` from `applesauce-signers`. Requires a browser extension like Alby or nos2x.
3. **Bunker (NIP-46)** — text input accepting `bunker://…` URIs or `user@domain.tld` NIP-05 addresses. NIP-05 is resolved to a `bunker://` URI via `.well-known/nostr.json`. Uses `NostrConnectSigner.fromBunkerURI()`.

No nsec key login (not requested; poor security practice in a browser context).

## New Dependencies

| Package | Purpose |
|---------|---------|
| `applesauce-accounts` | Account type classes (`ExtensionAccount`, `NostrConnectAccount`) |
| `qrcode.react` | QR code SVG rendering for NostrConnect URI |

Relay I/O for `NostrConnectSigner` is implemented via `nostr-tools` `SimplePool` (already installed).

## TypeScript Interfaces

```ts
// nostrAccountStore state shape
type AccountType = 'extension' | 'bunker'

interface NostrAccountState {
  pubkey: string | null
  signer: ExtensionSigner | NostrConnectSigner | null
  type: AccountType | null
  bunkerUri: string | null   // only set for bunker type; used for session restore
  restoring: boolean

  login: (
    type: AccountType,
    signer: ExtensionSigner | NostrConnectSigner,
    pubkey: string,
    bunkerUri?: string
  ) => void
  logout: () => void
  setRestoring: (v: boolean) => void
}

// Persisted to localStorage — signer instance is NOT serialised
interface PersistedAccount {
  type: AccountType
  bunkerUri?: string   // only present for bunker type
}
```

## Files

### New

**`src/store/nostrAccountStore.ts`**
- Zustand store implementing `NostrAccountState`
- `login()` stores `{ type, bunkerUri }` to `localStorage` key `"photoshare:account"` (signer instance is never serialised)
- `logout()` clears store state and removes the localStorage entry
- Initial state: all null, `restoring: false`

**`src/lib/nostr/relay.ts`**
- Module-level `SimplePool` singleton from `nostr-tools`
- Exports two functions matching the `applesauce-signers` `NostrConnectSigner` constructor interface:
  ```ts
  // Subscribes to filters on given relays; returns unsubscribe function
  export function subscriptionMethod(
    relays: string[],
    filters: Filter[],
    handlers: { onevent: (event: NostrEvent) => void; oneose?: () => void }
  ): () => void

  // Publishes event to given relays
  export async function publishMethod(
    relays: string[],
    event: NostrEvent
  ): Promise<void>
  ```
- `SimplePool` is instantiated once at module load; shared across all NostrConnect sessions

**`src/lib/nostr/nip05.ts`**
- Port of nostube's `nip05-bunker.ts`
- `isNip05(value: string): boolean` — returns true for `user@domain` or `domain.tld` (not a `bunker://` URI)
- `resolveNip05ToBunkerUri(nip05: string): Promise<{ pubkey: string; relays: string[]; bunkerUri: string }>` — throws `Error` with a human-readable message on any failure (network, 404, missing pubkey, no relays)

**`src/hooks/useLoginActions.ts`**
```ts
export function useLoginActions() {
  return {
    async extension(): Promise<void>    // creates ExtensionSigner, calls nostrAccountStore.login()
    async bunker(input: string, opts?: { onAuth?: (url: string) => void }): Promise<void>
    logout(): void
  }
}
// QR login is handled inside QRCodeLogin component, not here
```
Input validation for `bunker()`:
- Reject if empty
- Reject if not `bunker://…` and not a valid NIP-05 (using `isNip05()`)
- NIP-05 → resolve to bunkerUri first, then proceed as `bunker://`
- All errors thrown as `Error` instances with human-readable messages

**`src/components/auth/LoginDialog.tsx`**
- Props: `{ isOpen: boolean; onClose: () => void }`
- 3 tabs: QR (default), Extension, Bunker
- Shared error `Alert` at top (cleared on tab change)
- Loading state per-tab; disables buttons during async ops
- No i18n; no shadcn Dialog — raw Tailwind `<dialog>`-style overlay matching zinc dark theme
- On successful login: calls `onClose()`

**`src/components/auth/QRCodeLogin.tsx`**
- Generates `NostrConnectSigner` on mount using `subscriptionMethod`/`publishMethod` from `relay.ts` and the fixed relay list
- Calls `signer.getNostrConnectURI({ name: 'photoshare', url: window.location.origin })`
- Renders `<QRCodeSVG>` once URI is available (loading spinner until then)
- Copy URI button, Refresh button (aborts current signer, generates new one)
- Awaits `signer.waitForSigner(abortController.signal)`
- On success: calls `nostrAccountStore.login('bunker', signer, pubkey, buildBunkerUri(...))`
- On abort (unmount/refresh): silently swallowed
- On other error: surfaces message via `onError` prop
- Fixed relay list: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.nostr.band`

### Modified

**`src/components/upload/UploadPanel.tsx`**
- Import `useNostrAccountStore` (Zustand subscription — triggers re-render on pubkey change)
- Import `LoginDialog` and manage `loginOpen` boolean state
- Header becomes a flex row: title+subtitle on left, auth controls on right
  - Logged out: `<button onClick={() => setLoginOpen(true)}>Sign in</button>`
  - Logged in: `<span>{formatNpub(pubkey)}</span>` + `<button onClick={logout}>Sign out</button>`
- `formatNpub(pubkey)`: encodes to npub via `nip19.npubEncode`, then truncates to `npub1` + first 4 + `…` + last 4 chars

**`src/hooks/useUpload.ts`**
- Import `useNostrAccountStore` (using `getState()` — not reactive subscription — to avoid coupling)
- Capture signer once at the start of `startUpload`:
  ```ts
  const signer = useNostrAccountStore.getState().signer ?? createEphemeralSigner()
  ```
- Pass this single signer instance to all `buildBlossomUploadAuth` calls (both photo and manifest uploads)
- No other logic changes

## Session Restore

A client component `NostrAccountRestorer` (no rendered output, just a `useEffect`) is added to `src/app/layout.tsx`:

```tsx
// src/components/auth/NostrAccountRestorer.tsx
'use client'
export function NostrAccountRestorer() {
  useEffect(() => {
    void restoreAccount()
  }, [])
  return null
}
```

`restoreAccount()` logic:
1. Parse `localStorage.getItem('photoshare:account')` → `PersistedAccount`; return if missing/malformed
2. Set `restoring: true`
3. If `type === 'extension'`:
   - Create `ExtensionSigner`; call `getPublicKey()`; call `nostrAccountStore.login(...)`
4. If `type === 'bunker'` and `bunkerUri` is present:
   - Call `NostrConnectSigner.fromBunkerURI(bunkerUri)`; call `getPublicKey()`; call `login(...)`
5. On any error: `localStorage.removeItem('photoshare:account')` (silent)
6. Set `restoring: false`

**No upload race condition:** `startUpload` reads the signer via `getState()` at call time. Restore typically completes in <500ms (extension) or a few seconds (bunker). The user must process photos and click Upload before restore matters. `restoring` is exposed in the store if the UI ever needs to gate on it.

## UI Details

**Header — logged out:**
```
PhotoShare                                    [Sign in]
Encrypted photo albums. Nothing leaves...
```

**Header — logged in:**
```
PhotoShare                    npub1abc…xyz  [Sign out]
Encrypted photo albums. Nothing leaves...
```

The npub display is truncated: `nip19.npubEncode(pubkey)` → `npub1` + first 4 chars + `…` + last 4 chars (18 chars total).

**Login dialog:** raw Tailwind modal overlay (fixed inset-0 backdrop), zinc-900 panel, tabs as a button strip. Consistent with existing component style (no external component library).

## Relay List (QR / NostrConnect)

```ts
const NOSTRCONNECT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]
```

Bunker URIs include their own relay list (extracted from the URI) — these fixed relays are only used for the client-initiated QR flow.

## Out of Scope

- nsec key login
- Multi-account switching
- Profile display (avatar, display name)
- Publishing Nostr events (kind 30078 or otherwise) — photoshare remains Blossom-only
- Signup / key generation
