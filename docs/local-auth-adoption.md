# Per-app local auth — adoption guide

Shared infrastructure for username/password accounts scoped to a single app, plus **Continue with My Space** so one OS identity can open every adopting app without a separate password.

## Architecture

| Piece | Location |
|-------|----------|
| OS identity (My Space account) | `main/myspace-identity.js` |
| Per-user desktop + system services | `main/myspace-profile.js` (`profileScopedPath`) |
| Auth core (scrypt, sessions) | `main/apps/local-auth.js` |
| Generic IPC channels | `main/apps/app-local-auth-ipc.js` |
| Shared login UI | `apps/shared/local-auth/` |
| Launch gate | `main.js` → `resolveMyApp()` |

Storage layout:

```
{userData}/
  myspace-identity/           # INSTALL-WIDE: OS accounts + session
  mail-oauth.json             # INSTALL-WIDE: OAuth client credentials (not user tokens)
  updates-state.json          # INSTALL-WIDE: applied install patches
  profiles/
    MIGRATED.json
    {myspaceUserId}/
      user-config.json
      app-settings.json
      themes-state.json
      …system services (mail, vault, jobs, mind, …)
      {appId}/                # local-auth app trees (notes, tasks, …)
        users.json
        session.json
        users/{userId}/…
```

**Rule:** When signed in, all per-user data must live under `profiles/{userId}/` via `profileScopedPath()`. Only `myspace-identity`, `mail-oauth.json`, and `updates-state.json` stay at the install root.

OS user ids use the `ms_…` prefix so app folders never collide with legacy `u_…` local accounts.

**Migration:** The first My Space account that signs in inherits install-wide service files and app trees once (`profiles/MIGRATED.json` → `servicesMigratedTo`). Later OS accounts start empty and set things up themselves.

**Vault:** Each My Space account creates its own master password on first Vault unlock (no shared install-wide master when signed in).

**Mail / Connect:** Each OS account connects its own OAuth/hub accounts; tokens live under that profile.

## Continue with My Space

App login screens keep local Sign in / Create account, and add a primary **Continue with My Space** action:

1. App calls `auth-continue-myspace` (via `window.appAuth.continueWithMyspace()`).
2. Main checks the OS session under `myspace-identity/`.
3. If missing → `{ needOsLogin: true }` → shared login opens the OS account sheet.
4. If present → bind an app session for that `ms_*` user (no password re-entry), ensure `users/{ms_…}/` exists, navigate to `appEntry`.

- Signing out of an **app** does **not** sign out of My Space OS.
- Sign out / switch of the OS account is only from the desktop account chip (taskbar).
- Old `u_*` app data is not merged into `ms_*` automatically; open via local login (or a future import) to reach it.

Shell API: `window.mySpace.identity.status|current|register|login|logout|onChanged`.

## Quick adoption checklist

### 1. Manifest

Add to `apps/{appId}/manifest.json`:

```json
{
  "auth": {
    "type": "local",
    "entry": "login.html",
    "appEntry": "index.html",
    "sharedAccounts": false
  }
}
```

- **entry** — login page (usually a thin copy of shared markup under the app folder, or `../shared/local-auth/login.html`)
- **appEntry** — main app HTML after sign-in
- **sharedAccounts** — `true` only if the app implements a shared folder (World Maps today)

Continue with My Space works for all `auth.type: "local"` adopters through shared login HTML/JS — no per-app Continue wiring.

Optional: `"icon": "📝"` and `"description"` — shown on the login screen.

### 2. Preload

Expose the auth bridge from the app preload:

```javascript
const { attachLocalAuthBridge } = require("../shared/local-auth/preload-bridge");
attachLocalAuthBridge(contextBridge, ipcRenderer, "your-app-id");
```

Renderer API: `window.appAuth.authStatus()`, `.myspaceStatus()`, `.continueWithMyspace()`, `.login()`, `.register()`, `.logout()`, `.enterApp()`, `.getCurrentUser()`.

### 3. IPC — per-user data

In `main/apps/{appId}-ipc.js`:

```javascript
const { getLocalAuth, setLegacyMigrator } = require("./local-auth");
const { setLocalAuthPrepare } = require("./app-local-auth-ipc");

const APP_ID = "your-app-id";
const auth = getLocalAuth(APP_ID);

setLocalAuthPrepare(APP_ID, (localAuth) => {
  localAuth.setSessionRoot(localAuth.getLocalRoot());
  localAuth.setAccountsRoot(localAuth.getLocalRoot());
});

setLegacyMigrator(APP_ID, async (userId, accountsRoot) => {
  // Copy legacy single-user file into users/{userId}/data.json once
});

function dataFile() {
  return auth.userDataPath("data.json");
}

async function handleYourAppInvoke(channel, args) {
  try {
    auth.requireUser();
  } catch {
    return { ok: false, error: "Not signed in" };
  }
  // ... use dataFile() for load/save
}
```

Auth channels (`auth-status`, `auth-login`, `auth-continue-myspace`, …) are routed automatically in `main/apps/ipc.js` — no extra wiring.

### 4. Legacy migration

When the first **local** account registers or signs in, copy the old flat file (e.g. `{userData}/tasks.json`) into `users/{userId}/data.json`. Use a flag file (see Notes: `.legacy-data-migrated`) so only the **first** account inherits legacy data.

On first My Space create/login, install-wide desktop config may be copied once into `profiles/{userId}/` (see `profiles/MIGRATED.json`).

### 5. Sign out (optional)

Call `window.appAuth.logout()` from settings or a sidebar control — navigates back to the app login page (OS session unchanged).

## Pilot: Notes

Notes is the reference implementation:

- `apps/notes/manifest.json` — local auth enabled
- `main/apps/notes-ipc.js` — `data.json` per user, legacy `notes.json` migration
- `apps/notes/index.html` — Sign out button
- Shared login includes Continue with My Space

## World Maps

World Maps keeps `world-maps/login.html` (so the shared-folder sync UI can stay) but uses the shared `local-auth/login.js` + Continue with My Space / consent sheets. Auth IPC goes through the generic handler; sync channels stay in `world-maps-ipc.js` with `setLocalAuthPrepare("world-maps", …)` pointing accounts at the optional shared folder.

## Rollout status

Local auth login is enabled for all **desktop apps** (visible in `config/apps.json`, not hidden platform services).

**Included (desktop apps with local auth):** Notes, Tasks, Contacts, Today, Study Deck, Studies, Clock, Remote Hub, Docs, Stocks, Translate, Coupons, Geography, Learning Games, Pi Digits, Icon Library, History, Space, Contracts, Builds, Code Lexicon, Drift, World Maps.

**Per My Space OS profile (system services):** Files workspace, Jobs, Scheduler, Mind/Chat, Vault, Mail, Connect Hub, Composio, Notifications history, Permissions prefs.

**Still mostly install-wide (exceptions):** OAuth client credentials (`mail-oauth.json`), install update state, restore staging.

Each adopting app gets `login.html` (Continue + local account), `manifest.auth`, preload `appAuth` bridge, and per-user data under the active My Space profile.

## Success criteria

- Create a My Space account once → Continue works in Notes and Tasks without separate app passwords
- Local app register/login still works beside Continue
- Desktop pins/wallpaper after switch belong to the signed-in My Space user
- App sign-out does not clear the OS session
- Switching My Space accounts isolates Files / Mail / Vault / Mind / Jobs
- New OS accounts create their own Vault master password and connect their own Mail/Hub accounts
- Legacy `notes.json` still migrates to the first local account when that path is used
- World Maps Continue with My Space, shared folder, and per-user map data still work
