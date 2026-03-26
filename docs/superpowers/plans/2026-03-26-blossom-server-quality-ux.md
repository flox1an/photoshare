# Blossom Server Quality UX & Upload Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Blossom server quality information to users before upload, cap the effective album expiry to the server's enforced limit, and refactor the upload page into a clean 4-state progressive-disclosure UI with a dedicated `/settings` route.

**Architecture:** A static `knownServers` map drives both the pre-upload warning strip and effective expiry capping. The upload page becomes a state machine (empty → ready → uploading → done). Settings move to a dedicated `/settings` route reachable via a gear icon in the header.

**Tech Stack:** React 18, React Router v7, Vite, Tailwind CSS, Vitest + @testing-library/react

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/blossom/knownServers.ts` | **Create** | Static known-servers map + `getKnownServer(url)` helper |
| `src/lib/blossom/knownServers.test.ts` | **Create** | Unit tests for `getKnownServer` |
| `src/components/upload/EphemeralServerWarning.tsx` | **Create** | Thin amber warning strip component |
| `src/components/settings/SettingsPage.tsx` | **Create** | Full settings page with server tags |
| `src/App.tsx` | **Modify** | Add `/settings` route before `/:hash` |
| `src/components/upload/UploadPanel.tsx` | **Modify** | 4-state machine, gear icon, warning strip, expiry capping, remove inline SettingsPanel |
| `src/components/upload/SettingsPanel.tsx` | **Delete** | Replaced by SettingsPage |

---

## Task 1: Known Servers Map

**Files:**
- Create: `src/lib/blossom/knownServers.ts`
- Create: `src/lib/blossom/knownServers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/blossom/knownServers.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getKnownServer } from '@/lib/blossom/knownServers';

describe('getKnownServer', () => {
  it('returns metadata for tempstore', () => {
    const result = getKnownServer('https://tempstore.apps3.slidestr.net');
    expect(result).toEqual({ name: 'Temp Store', maxExpirySeconds: 86400 });
  });

  it('returns metadata for primal (permanent)', () => {
    const result = getKnownServer('https://blossom.primal.net');
    expect(result).toEqual({ name: 'Primal', maxExpirySeconds: null });
  });

  it('returns null for an unknown server', () => {
    expect(getKnownServer('https://unknown.example.com')).toBeNull();
  });

  it('ignores trailing slashes in the URL', () => {
    expect(getKnownServer('https://tempstore.apps3.slidestr.net/')).not.toBeNull();
  });

  it('ignores paths in the URL', () => {
    expect(getKnownServer('https://tempstore.apps3.slidestr.net/some/path')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/blossom/knownServers.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/blossom/knownServers'`

- [ ] **Step 3: Implement `knownServers.ts`**

Create `src/lib/blossom/knownServers.ts`:

```ts
export interface KnownServer {
  name: string;
  /** Max TTL the server enforces, in seconds. null = permanent (no known limit). */
  maxExpirySeconds: number | null;
}

const KNOWN_SERVERS: Record<string, KnownServer> = {
  'tempstore.apps3.slidestr.net': { name: 'Temp Store', maxExpirySeconds: 86400 },
  'blossom.primal.net':           { name: 'Primal',     maxExpirySeconds: null  },
};

/**
 * Returns known-server metadata for the given URL, or null if unrecognised.
 * Matches on hostname only — ignores path, protocol, and trailing slashes.
 */
export function getKnownServer(url: string): KnownServer | null {
  try {
    const { hostname } = new URL(url);
    return KNOWN_SERVERS[hostname] ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns a human-readable duration string for a number of seconds.
 * e.g. 86400 → "1 day", 3600 → "1 hour", 604800 → "1 week"
 */
export function formatExpiry(seconds: number): string {
  if (seconds >= 31536000) return `${Math.round(seconds / 31536000)} year`;
  if (seconds >= 2592000)  return `${Math.round(seconds / 2592000)} month`;
  if (seconds >= 604800)   return `${Math.round(seconds / 604800)} week`;
  if (seconds >= 86400)    return `${Math.round(seconds / 86400)} day`;
  if (seconds >= 3600)     return `${Math.round(seconds / 3600)} hour`;
  return `${Math.round(seconds / 60)} min`;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/blossom/knownServers.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/blossom/knownServers.ts src/lib/blossom/knownServers.test.ts
git commit -m "feat: add known Blossom servers map with getKnownServer helper"
```

---

## Task 2: Ephemeral Server Warning Strip Component

**Files:**
- Create: `src/components/upload/EphemeralServerWarning.tsx`

No unit test needed — pure presentational component with no logic beyond a prop check.

- [ ] **Step 1: Create the component**

Create `src/components/upload/EphemeralServerWarning.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { formatExpiry } from '@/lib/blossom/knownServers';

interface EphemeralServerWarningProps {
  serverName: string;
  maxExpirySeconds: number;
}

/**
 * Thin amber warning strip shown before upload when the primary Blossom
 * server has a known maximum TTL. Links to /settings.
 */
export function EphemeralServerWarning({ serverName, maxExpirySeconds }: EphemeralServerWarningProps) {
  const duration = formatExpiry(maxExpirySeconds);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-900 bg-amber-950/60 px-3 py-2 text-xs text-amber-300">
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
        className="ml-auto whitespace-nowrap text-amber-400 underline hover:text-amber-200 transition-colors"
      >
        Settings →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/upload/EphemeralServerWarning.tsx
git commit -m "feat: add EphemeralServerWarning strip component"
```

---

## Task 3: Effective Expiry Capping in UploadPanel

**Files:**
- Modify: `src/components/upload/UploadPanel.tsx`

The `handleUpload` function currently passes `settings.expiration` directly. We cap it to the primary server's `maxExpirySeconds` when the server is known.

- [ ] **Step 1: Update `handleUpload` in `UploadPanel.tsx`**

At the top of the file, add the import (alongside existing imports):

```tsx
import { getKnownServer } from '@/lib/blossom/knownServers';
```

Replace the existing `handleUpload` function:

```tsx
const handleUpload = () => {
  const primaryServer = settings.blossomServers[0];
  const knownServer = primaryServer ? getKnownServer(primaryServer) : null;
  const effectiveExpiry = (knownServer?.maxExpirySeconds != null)
    ? Math.min(settings.expiration, knownServer.maxExpirySeconds)
    : settings.expiration;

  beginUpload({
    blossomServers: settings.blossomServers,
    title: albumTitle || undefined,
    expirationSeconds: effectiveExpiry,
    reactions: settings.reactionsEnabled
      ? { relays: settings.reactionRelays }
      : undefined,
  });
};
```

- [ ] **Step 2: Run existing upload tests to confirm nothing broken**

```bash
npx vitest run src/hooks/useUpload.test.ts
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/upload/UploadPanel.tsx
git commit -m "feat: cap effective album expiry to known server's max TTL"
```

---

## Task 4: Dedicated Settings Page

**Files:**
- Create: `src/components/settings/SettingsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `SettingsPage.tsx`**

Create `src/components/settings/SettingsPage.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { UseSettingsReturn, ExpirationSeconds } from '@/hooks/useSettings';
import { EXPIRATION_OPTIONS } from '@/hooks/useSettings';
import { getKnownServer } from '@/lib/blossom/knownServers';
import { EditableList } from '@/components/upload/settings/EditableList';
import { SettingsToggleRow } from '@/components/upload/settings/SettingsToggleRow';

interface SettingsPageProps {
  settings: UseSettingsReturn;
}

function ServerTag({ url }: { url: string }) {
  const known = getKnownServer(url);
  if (!known) return null;
  if (known.maxExpirySeconds === null) {
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-900">
        permanent
      </span>
    );
  }
  const days = Math.round(known.maxExpirySeconds / 86400);
  const label = days === 1 ? '1 day' : `${days} days`;
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-950 text-amber-400 border border-amber-900">
      {label}
    </span>
  );
}

export function SettingsPage({ settings }: SettingsPageProps) {
  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <Link
            to="/"
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800">

          {/* Blossom Servers */}
          <div className="px-5 py-4">
            <p className="mb-1 text-xs font-medium text-zinc-400">Blossom Servers</p>
            <p className="mb-3 text-xs text-zinc-600">
              Photos are uploaded to all servers. All servers are embedded in the share link as fallbacks.
            </p>
            <EditableList
              items={settings.blossomServers}
              onRemove={settings.removeBlossomServer}
              onAdd={async (value) => {
                const { error } = await settings.addBlossomServer(value);
                return error;
              }}
              addPlaceholder="https://your-blossom-server.com"
              showPrimaryOnFirst
              renderSuffix={(url) => <ServerTag url={url} />}
            />
          </div>

          {/* Blob expiration */}
          <div className="px-5 py-4">
            <p className="mb-1 text-xs font-medium text-zinc-400">Blob expiration</p>
            <p className="mb-2 text-xs text-zinc-600">
              Requests the server to delete blobs after the chosen duration.
              Only works if the server supports the <span className="font-mono">X-Expiration</span> header.
            </p>
            <select
              value={settings.expiration}
              onChange={(e) => settings.setExpiration(Number(e.target.value) as ExpirationSeconds)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
            >
              {EXPIRATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Keep originals */}
          <div className="px-5 py-4">
            <SettingsToggleRow
              checked={settings.keepOriginals}
              onChange={settings.setKeepOriginals}
              title="Keep originals"
              description="Also upload the original files. Downloads will deliver originals instead of processed WebP."
            />
          </div>

          {/* Reactions */}
          <div className="px-5 py-4">
            <SettingsToggleRow
              checked={settings.reactionsEnabled}
              onChange={settings.setReactionsEnabled}
              title="Enable reactions & comments"
              description="Viewers can like and comment on photos. Interactions are end-to-end encrypted via NIP-59 gift wraps."
            />
            {settings.reactionsEnabled && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-zinc-500">Reaction relays</p>
                <EditableList
                  items={settings.reactionRelays}
                  onRemove={settings.removeReactionRelay}
                  onAdd={(value) => {
                    settings.addReactionRelay(value);
                    return null;
                  }}
                  addPlaceholder="wss://relay.example.com"
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Check if `EditableList` accepts a `renderSuffix` prop**

Read `src/components/upload/settings/EditableList.tsx` and check its props interface. If `renderSuffix` doesn't exist, add it:

```tsx
// In the EditableList props interface, add:
renderSuffix?: (item: string) => React.ReactNode;

// In the list item render, add after the item text:
{renderSuffix?.(item)}
```

- [ ] **Step 3: Add `/settings` route to `App.tsx`**

Open `src/App.tsx`. Add a lazy import for `SettingsPage` alongside the existing lazy imports:

```tsx
const SettingsPage = lazy(() =>
  import('@/components/settings/SettingsPage').then((m) => ({ default: SettingsPageWrapper }))
);
```

Because `SettingsPage` needs `settings` from `useSettings`, create a thin wrapper inside `App.tsx`:

```tsx
import { useSettings } from '@/hooks/useSettings';
import { SettingsPage } from '@/components/settings/SettingsPage';

function SettingsRoute() {
  const settings = useSettings();
  return <SettingsPage settings={settings} />;
}
```

Then add the route in the `<Routes>` block, **before** `/:hash`:

```tsx
<Route
  path="/settings"
  element={
    <Suspense fallback={<LoadingSpinner message="Loading settings..." />}>
      <SettingsRoute />
    </Suspense>
  }
/>
```

- [ ] **Step 4: Verify routing in browser**

```bash
npm run dev
```

Navigate to `http://localhost:5173/settings` — settings page should render with all sections. Navigate back with "← Back".

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SettingsPage.tsx src/App.tsx src/components/upload/settings/EditableList.tsx
git commit -m "feat: add dedicated /settings page with server quality tags"
```

---

## Task 5: Upload Page 4-State Machine & Gear Icon

**Files:**
- Modify: `src/components/upload/UploadPanel.tsx`
- Delete: `src/components/upload/SettingsPanel.tsx`

This task implements the state machine, adds the SVG gear icon using `RoundButton`, wires up the `EphemeralServerWarning`, and removes the inline settings panel.

- [ ] **Step 1: Add imports to `UploadPanel.tsx`**

Add to the existing import block at the top of `src/components/upload/UploadPanel.tsx`:

```tsx
import { Link } from 'react-router-dom';
import RoundButton from '@/components/viewer/RoundButton';
import { EphemeralServerWarning } from './EphemeralServerWarning';
import { getKnownServer } from '@/lib/blossom/knownServers';
```

Remove the `SettingsPanel` import:
```tsx
// DELETE this line:
import { SettingsPanel } from './SettingsPanel';
```

- [ ] **Step 2: Replace the full JSX return in `UploadPanel.tsx`**

Replace everything from `return (` to the closing `</main>` with:

```tsx
  const primaryServer = settings.blossomServers[0];
  const knownServer = primaryServer ? getKnownServer(primaryServer) : null;
  const showWarning = showUploadButton && knownServer?.maxExpirySeconds != null;

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              PhotoShare
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Encrypted photo albums. Nothing leaves your device unencrypted.
            </p>
          </div>
          <div className="flex-shrink-0 self-center flex items-center gap-2 text-sm">
            {pubkey === null ? (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Sign in
              </button>
            ) : (
              <>
                {profile?.picture && (
                  <img
                    src={profile.picture}
                    alt="avatar"
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <span className="text-zinc-400 text-xs max-w-[120px] truncate">
                  {profileDisplayName(profile, formatNpub(pubkey))}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Sign out
                </button>
              </>
            )}
            <Link to="/settings" tabIndex={-1}>
              <RoundButton
                aria-label="Settings"
                colorClass="bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700"
                className="!h-8 !w-8"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </RoundButton>
            </Link>
          </div>
        </div>

        {/* State 1 & 2: Drop zone — hidden during upload and after share link */}
        {!isUploading && !shareLink && (
          <>
            <DropZone onFiles={processBatch} isProcessing={isProcessing} />
            {totalPhotos === 0 && pubkey === null && (
              <p className="mt-3 text-center text-xs text-zinc-600">
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="underline hover:text-zinc-400 transition-colors"
                >
                  Sign in with Nostr
                </button>{' '}
                to use your own Blossom servers
              </p>
            )}
          </>
        )}

        {/* State 2 & 3: Progress list */}
        {!shareLink && (
          <ProgressList
            onRetryPhoto={(photoId) => void retryPhoto(photoId)}
            isRetrying={isUploading}
            keepOriginals={settings.keepOriginals}
            fileMap={fileMap}
          />
        )}

        {/* State 2: Album title + warning + upload button */}
        {showUploadButton && (
          <div className="mt-5 space-y-3">
            <input
              type="text"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Album title (optional)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
            />
            {showWarning && (
              <EphemeralServerWarning
                serverName={knownServer!.name}
                maxExpirySeconds={knownServer!.maxExpirySeconds!}
              />
            )}
            <button
              type="button"
              onClick={handleUpload}
              className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-white active:bg-zinc-200 transition-colors"
            >
              {isProcessing
                ? `Upload · ${processedPhotos.length} / ${totalPhotos} ready`
                : `Upload ${processedPhotos.length} photo${processedPhotos.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* State 3 & 4: ShareCard */}
        {(isUploading || shareLink || publishError) && (
          <ShareCard
            shareLink={shareLink}
            albumExpiresAt={albumExpiresAt}
            isUploading={isUploading}
            publishError={publishError}
          />
        )}

      </div>
      <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
```

- [ ] **Step 3: Update `ShareCard` — inline "shown once" footnote**

Open `src/components/upload/ShareCard.tsx`. Replace the separate `once-warning` box with an inline footnote inside the link box. Find and replace this block:

```tsx
          <p className="mt-2 rounded-lg border border-zinc-700/80 bg-zinc-800/35 px-3 py-2 text-xs text-zinc-400">
              This link is only shown <strong className="text-zinc-300">ONCE</strong>. Make sure to save the share URL to access this album in the future.
            </p>
```

Replace with:

```tsx
          <p className="mt-2 text-xs text-zinc-600">
              Shown <strong className="text-zinc-500">once</strong> — save this link before leaving the page.
            </p>
```

- [ ] **Step 4: Delete `SettingsPanel.tsx`**

```bash
git rm src/components/upload/SettingsPanel.tsx
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Check all four states:
1. Load `http://localhost:5173/` — drop zone visible, gear icon top-right, sign-in nudge if logged out
2. Drop photos — album title + warning strip (if tempstore is primary) + Upload button appear
3. Click Upload — drop zone gone, progress bar appears
4. Upload completes — share card only, inline footnote below URL

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/upload/UploadPanel.tsx src/components/upload/ShareCard.tsx
git commit -m "feat: upload page 4-state machine, gear icon, ephemeral server warning"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| Known servers map + `getKnownServer` | Task 1 |
| `formatExpiry` helper | Task 1 |
| `EphemeralServerWarning` strip | Task 2 |
| Effective expiry capping (min of user/server) | Task 3 |
| Settings page with server tags | Task 4 |
| `/settings` route before `/:hash` | Task 4 |
| Gear icon using `RoundButton` | Task 5 |
| SVG cog icon (not emoji) | Task 5 |
| 4-state machine (empty/ready/uploading/done) | Task 5 |
| "Shown once" as inline footnote | Task 5 |
| Delete inline `SettingsPanel` | Task 5 |
| Sign-in nudge in empty state | Task 5 |

All spec requirements covered. No gaps found.
