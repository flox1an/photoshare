# Blossom Server Quality UX — Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Problem

The default Blossom server (`tempstore.apps3.slidestr.net`) deletes files after 1 day. Users have no indication of this before uploading. Two concrete harms result:

1. Users share album links that stop working the next day without realising.
2. The manifest's `expiresAt` field is computed from the user's expiration *setting* (defaulting to 1 week), not from the server's actual enforced limit — so the ShareCard shows a wrong expiry date.

Additionally, all settings are buried inside a collapsible panel inline on the upload page, making them hard to reach and cluttering the interface.

---

## Solution Overview

Three coordinated changes:

1. **Known servers map** — a small static file mapping server hostnames to metadata.
2. **Pre-upload warning strip** — shown when the primary server is a known ephemeral server; disappears once Upload is pressed.
3. **Dedicated `/settings` page** — settings moved out of the inline panel; gear icon in the upload header navigates there; warning strip links there too.

---

## 1. Known Servers Map

**File:** `src/lib/blossom/knownServers.ts`

A static JS object — no network calls, no database. Maps server hostname to metadata.

```ts
interface KnownServer {
  name: string;
  /** Max TTL the server enforces, in seconds. null = permanent (no known limit). */
  maxExpirySeconds: number | null;
}
```

Initial entries:
- `tempstore.apps3.slidestr.net` → `{ name: 'Temp Store', maxExpirySeconds: 86400 }` (1 day)
- `blossom.primal.net` → `{ name: 'Primal', maxExpirySeconds: null }` (permanent)

Unknown servers (not in the map) are treated as having no known constraint — no warning shown, no expiry capping.

A helper function `getKnownServer(url: string): KnownServer | null` extracts the hostname and looks it up.

---

## 2. Effective Expiry Capping

In `UploadPanel` (or `useUploadQueueBridge`), before calling `beginUpload`, compute:

```
effectiveExpiry = min(settings.expiration, server.maxExpirySeconds)
```

where `server` is the result of `getKnownServer(settings.blossomServers[0])`. If the primary server is unknown, use `settings.expiration` unchanged.

This is passed as `expirationSeconds` to the upload pipeline, so the manifest's `expiresAt` reflects what the server will actually enforce — not a lie.

---

## 3. Pre-Upload Warning Strip

**Shown:** In `UploadPanel`, between the album title input and the Upload button, when:
- At least one photo is ready (i.e. the Upload button is visible), AND
- The primary server is a known server with `maxExpirySeconds !== null`

**Hidden:** As soon as the Upload button is pressed (the warning disappears with the button).

**Content (example for Temp Store):**
```
⚠ Temp Store · files expire in 1 day   [Settings →]
```

The text is composed dynamically from `knownServer.name` and a human-readable duration from `maxExpirySeconds`. The "Settings →" link is a React Router `<Link to="/settings">`.

**Style:** Thin amber strip (`bg-amber-950/60`, `border-amber-900`, `text-amber-300`), same border-radius as other cards.

---

## 4. Settings Page

**Route:** `/settings` — added to `App.tsx` *before* `/:hash` to prevent the catch-all from matching.

**Navigation to settings:**
- Gear icon (`⚙`) button in the `UploadPanel` header, top-right, next to the account area.
- "Settings →" link in the warning strip.

**Navigation back:**
- Back arrow / "← Back" link at the top of the settings page navigates to `/`.

**Settings page contents** (same controls as the existing `SettingsPanel`, now laid out as a full page):

1. **Blossom Servers** — editable list. Each server entry shows an inline tag if it's a known server:
   - Amber `1 day` tag for servers with `maxExpirySeconds` set.
   - Green `permanent` tag for known servers with `maxExpirySeconds: null`.
   - No tag for unknown servers.
2. **Blob expiration** — dropdown (1h / 1d / 1w / 1mo / 1yr). Note: the effective expiry may be capped by the server.
3. **Keep originals** — toggle.
4. **Enable reactions & comments** — toggle; when on, shows reaction relays editable list.

**Component:** `src/components/settings/SettingsPage.tsx` (new file). Reuses `EditableList` and `SettingsToggleRow`. Takes `settings: UseSettingsReturn` as a prop passed from a wrapper in `App.tsx` or via the route element.

The existing `SettingsPanel` component is removed from `UploadPanel` and can be deleted once the settings page is live.

---

## 5. Routing Change

`App.tsx` route order becomes:
```
/          → UploadPanel
/settings  → SettingsPage
/:hash     → ViewerPanel  (catch-all, must stay last)
```

---

## Out of Scope

- Querying servers at runtime for their actual expiry policy (BUD-01 or similar). The static map is sufficient for now and avoids network calls on page load.
- A community-maintained or remote database of Blossom servers.
- Auto-populating the server list from the user's NIP-10063 Nostr event (the `useUserBlossomServers` hook already exists but is not wired up — a separate task).

---

## Files Affected

| File | Change |
|------|--------|
| `src/lib/blossom/knownServers.ts` | **New** — static known-servers map + helper |
| `src/components/upload/UploadPanel.tsx` | Add warning strip, gear icon, remove inline SettingsPanel |
| `src/components/settings/SettingsPage.tsx` | **New** — dedicated settings page |
| `src/App.tsx` | Add `/settings` route before `/:hash` |
| `src/components/upload/SettingsPanel.tsx` | **Delete** once settings page is live |
| `src/hooks/useUpload.ts` or `useUploadQueueBridge.ts` | Pass effective (capped) expiry to upload pipeline |
