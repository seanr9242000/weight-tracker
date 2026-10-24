# Feedback batch 1, steps 0 and 0.5: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship step 0 (updates that always arrive, plus cloud and file backup) and then step 0.5 (Injury mode for Sean's ankle). Sean checks each step on his phone before the next one starts.

**Architecture:** Step 0 adds three small files. `version.js` holds `APP_VERSION`. `updates.js` registers the service worker, checks for updates, and reloads once when a new worker takes over. `backup-core.js` is pure: which keys are backed up, restore codes, file shape and timing. `backup.js` is the UI, and it reuses `reminders.js`'s Supabase client and anonymous sign-in. One new migration adds a `backups` table that only two `security definer` RPCs can reach. Step 0.5 passes an injury object into `itemsForDate` (pure, in `coach-core.js`). `coach.js` gets one `scheduleFor(dateStr)` helper, and every caller switches to it. A new `injury.js` holds the chip, the Injury card, the recheck panel and the Train banner.

**Tech Stack:** Plain HTML/CSS/JS with no build step, localStorage plus IndexedDB (photos), a service worker, Supabase (Postgres RPCs, anonymous auth) and supabase-js 2 from jsDelivr. Tests run in headless Edge through `python tests/run.py` (pure `*.test.html` pages) and `python .claude/skills/phone-preview/preview.py --interact tests/ui/<script>.js` (click-throughs). There is no Node on this machine.

**Spec:** `docs/superpowers/specs/2026-10-15-feedback-batch-1-design.md`, sections "0. Data loss" and "0.5 Injury mode". Read both before starting.

## Global Constraints

- Repo: `C:\Users\seanr\OneDrive\Desktop\ClaudeCodeTest\WeightTracker`. Read `CLAUDE.md` first.
- **Ask Sean before every `git commit` and every `git push`.** No autocommit. After each approved commit, add a row to `docs/progress-log-detailed.md` (time, one-line description, elapsed since the previous commit in the session). After each step (0, then 0.5), add a readable paragraph to `docs/progress-log-summary.md`.
- **Cache:** bump `CACHE_NAME` in `sw.js` on every asset change, and keep it equal to `APP_VERSION` in `version.js` (the run.py static check enforces this). Step 0 ships as **v31** and step 0.5 as **v32**. A version only needs to change once per push, because devices only see pushed versions.
- Every new local `.js`/`.css` file goes in `sw.js` `ASSETS` (the run.py static check enforces this too).
- Spec, verbatim: "Same-origin GETs with `cache: "no-cache"`"; "on load, and every time the app comes back to the foreground (`visibilitychange` → `registration.update()`)"; "on `controllerchange`, the page reloads one time... guarded so it can't loop, and skipped while a run is being tracked".
- Backup keys, verbatim: "Every app localStorage key: `weight-tracker-*`, `coach-*`, `food-*`, `water-log`, `ui-*` and the new savings keys. Excluded: device-specific keys (`coach-reminders-on`, active tab, active run) and Supabase auth keys (`sb-*`)."
- Restore code: `WS-` plus 12 random base32 characters, shown as `WS-XXXX-XXXX-XXXX` (about 60 bits).
- Supabase: table `backups` (`code_hash` = sha256 of the code, primary key; `data jsonb`; `updated_at`). RLS is on with no direct access. The only RPCs are `save_backup(p_code, p_data)` (upsert) and `load_backup(p_code)`, and both require a signed-in (anonymous) session.
- Backup timing: "30 s after any change, at most once a minute, and when the app goes to the background", and only after Sean has turned backup on.
- Injury data: `coach-injury` = `{ part, start, until, note, pt }`. It is on while `start <= today <= until` and is pre-filled with start `2026-10-21` and until `2026-12-07`.
- Code style: match the surrounding files. Comments are short, explain why, and use `/* */` blocks above functions. Use `el()` from `coach.js` for DOM building, `loadJSON`/`saveJSON` for storage, and `showToast` for feedback. Pure modules have no DOM access and end with the `if (typeof module !== "undefined") module.exports = {...}` block.
- Supabase project ref: `inewcgtwhuwjmiyxlrvy`. The CLI is at `~/bin/supabase.exe`. **Changing the remote database is outward-facing, so ask Sean before applying the migration.**

## Decisions beyond the spec (confirm with Sean when he reviews this plan)

1. **"Late-afternoon snack", not "Afternoon snack".** The spec retitles `pregame-snack` (17:30) to "Afternoon snack", but `snack-pm` (15:00) already uses that title on the same days, so two items would share one name. This plan uses "Late-afternoon snack".
2. **"day N of 48", not "of 47".** Oct 21 through Dec 7 is 48 days if both the start day and the recheck day count. Otherwise the recheck day would read "day 48 of 47".
3. **Optional walks ping once.** Walks during Injury mode are "skip if sore", so they get one ping with no 15-minute repeats. They are also left out of the schedule score and never show as Missed.
4. **Export takes two taps.** iOS only allows `navigator.share` straight from a tap. Reading the photos first takes a moment, so tap 1 builds the file and tap 2 ("Share backup file") opens the share sheet.
5. **Rest-day snack ideas** are added for `snack-am`, `pregame-snack` and `postgame`. On former game days during Injury mode the day counts as "rest", and those slots had no rest-day ideas.
6. **There is a "Turn off" for backup.** It keeps the code, so turning backup back on continues under the same code.
7. **Generic names.** The recheck item, chip, banner and pain question use the injury's `part` ("Ankle recheck", "Ankle pain (0–10)"), so the next injury reads correctly. The stored fields are `injuryPain` and `injuryPart`. The ankle-safe lift note stays ankle-specific, as the spec writes it.

## Review Focus

1. **A new worker can precache the old deploy.** `cache.addAll(ASSETS)` goes through the browser's HTTP cache, and GitHub Pages serves files with `max-age=600`, so a v31 worker could store v30 files. Installs must use `new Request(url, { cache: "reload" })`. This is pinned by the run.py static check (Task 1).
2. **Restore codes typed by hand from Notes.** Expect lowercase, spaces, a missing `WS-`, O for 0, I or L for 1, and a code body that itself starts with "WS". Each of these should either restore or say exactly what's wrong. Pinned by the `normalizeCode` tests (Task 3) and the restore UI test (Task 6).
3. **A fresh install must still offer Restore.** On first launch the app seeds `food-library`, `coach-started-at`, `ui-celebrated` and (after 0.5) `coach-injury`, so "has any data" is the wrong test. Pinned by the `hasUserData` tests (Task 3) and the `reload({})` check (Task 6).
4. **The update reload must not lose a run.** That covers a run being tracked and a stopped run waiting on the Save form. Pinned by `tests/ui/updates.js` (Task 2).
5. **Injury date edges.** The start day and the until day are both injured. The day before the start, the day after until, an ended injury, and `null` all leave the normal schedule. The completion streak must use the injured schedule on injured days, or every past game day counts as unfinished. Pinned by `tests/injury.test.html` (Task 9).

---

## Pre-flight

- [ ] `git status` should show `main...origin/main [ahead 3]` and one modified file, `docs/progress-log-detailed.md` (the 22:34 row for "Pull training basics (step T) forward"). Leave that change staged for the first commit below. Don't discard it.
- [ ] `python tests/run.py` should end with every page `N/N passed` and exit code 0 before you start.

---

# Step 0: Reliable updates and backup (ships as v31)

### Task 1: Fresh fetches, version.js, static checks

**Files:**
- Create: `version.js`
- Modify: `sw.js` (CACHE_NAME, ASSETS, install, fetch)
- Modify: `index.html` (script tag)
- Modify: `tests/run.py` (static checks)

**Interfaces:**
- Produces: global `APP_VERSION` (number, `31`), loaded right after `ui.js`. The `static_checks()` function in run.py runs before the browser pages.

- [ ] **Step 1: Write the failing static checks in `tests/run.py`**

Add this below `find_edge()`:

```python
ROOT = pathlib.Path(__file__).resolve().parent.parent


def static_checks():
    """Cross-file rules no browser page can see: the service worker's
    cache version matches version.js, every local file index.html loads
    is precached, and the worker never trusts GitHub Pages' 10-minute
    HTTP cache. Returns (passed, total, failure lines)."""
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    version_file = ROOT / "version.js"
    version = version_file.read_text(encoding="utf-8") if version_file.exists() else ""
    checks = []

    cache = re.search(r'CACHE_NAME = "weight-tracker-v(\d+)"', sw)
    app = re.search(r"APP_VERSION = (\d+);", version)
    checks.append(("CACHE_NAME matches APP_VERSION",
                   bool(cache and app and cache.group(1) == app.group(1)),
                   f"sw.js v{cache and cache.group(1)} vs version.js {app and app.group(1)}"))

    assets = set(re.findall(r'"\./([^"]+)"', sw))
    local = re.findall(r'(?:src|href)="(?!https?:)([^"#]+\.(?:js|css|json|png))"', index)
    missing = [f for f in local if f not in assets]
    checks.append(("every local file index.html loads is precached", not missing,
                   f"missing from sw.js ASSETS: {missing}"))

    checks.append(("install precache bypasses the HTTP cache", 'cache: "reload"' in sw,
                   'sw.js install should add new Request(url, { cache: "reload" })'))
    checks.append(("same-origin fetches revalidate", 'cache: "no-cache"' in sw,
                   'sw.js fetch should pass { cache: "no-cache" } for same-origin GETs'))

    fails = [f"FAIL {name} — {info}" for name, ok, info in checks if not ok]
    return len(checks) - len(fails), len(checks), fails
```

Then replace the start of `main()`, up to and including `ok = True`, with:

```python
def main():
    edge = find_edge()
    passed, total, fails = static_checks()
    print(f"static checks: {passed}/{total} passed" + "".join("\n" + f for f in fails))
    ok = passed == total
    pages = sorted(pathlib.Path(__file__).parent.glob("*.test.html"))
```

Leave the rest of `main()` unchanged. It already does `ok = ok and passed == total` for each page.

- [ ] **Step 2: Run it to verify it fails**

Run: `python tests/run.py`
Expected: `static checks: 1/4 passed`, with FAIL lines for CACHE_NAME (no version.js), install precache and same-origin fetches. Exit code 1.

- [ ] **Step 3: Create `version.js`**

```js
/* The app's version, shown in the Backup & updates card and the
   "Updated to vN" toast. Must equal the number in sw.js's CACHE_NAME
   (tests/run.py checks); bump both together on every asset change. */
const APP_VERSION = 31;
```

- [ ] **Step 4: Update `sw.js`**

Change line 1 to `const CACHE_NAME = "weight-tracker-v31";` and add `"./version.js",` to `ASSETS` right after `"./ui.js",`.

Replace the install handler with:

```js
self.addEventListener("install", (event) => {
  // "reload" skips the browser's HTTP cache. GitHub Pages serves every
  // file with max-age=600, so a plain addAll could precache the
  // previous deploy's files under the new version's name.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })))
    )
  );
  self.skipWaiting();
});
```

In the fetch handler, replace `fetch(event.request)` and the comment above `event.respondWith` so the handler reads:

```js
self.addEventListener("fetch", (event) => {
  // Supabase API calls (and any non-GET) go straight to the network:
  // caching them would serve stale data and can't store POSTs anyway.
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.hostname.endsWith(".supabase.co")) return;
  // Our own files revalidate with the server on every request (a cheap
  // 304 when unchanged) instead of trusting the 10-minute HTTP cache,
  // so a deploy shows up on the next check. CDN files keep the default.
  const init = url.origin === self.location.origin ? { cache: "no-cache" } : undefined;
  event.respondWith(
    fetch(event.request, init)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

(Passing an init to `fetch` with a navigation request is allowed. The spec turns its mode into `same-origin`.)

- [ ] **Step 5: Load version.js in `index.html`**

Right after `<script src="ui.js"></script>`, add `<script src="version.js"></script>`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python tests/run.py`
Expected: `static checks: 4/4 passed`, all pages pass, exit code 0.

- [ ] **Step 7: Commit (ask Sean first)**

```bash
git add version.js sw.js index.html tests/run.py docs/progress-log-detailed.md
git commit -m "Step 0a: revalidate same-origin files, precache past the HTTP cache, add version.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Update check, guarded reload, "Updated to vN" toast

**Files:**
- Create: `updates.js`
- Modify: `app.js:809-813` (remove SW registration), `app.js` run save and discard handlers (call `applyPendingUpdate`)
- Modify: `index.html` (script tag), `sw.js` (ASSETS)
- Test: `tests/ui/updates.js`

**Interfaces:**
- Consumes: `ACTIVE_RUN_KEY` (app.js), `showToast` (ui.js), `APP_VERSION` (version.js)
- Produces: globals `reloadApp()`, `reloadForUpdate()`, `applyPendingUpdate()`, all function declarations so tests can stub them through `app()`. Later tasks call `reloadApp()` after a restore.

- [ ] **Step 1: Write the failing UI test `tests/ui/updates.js`**

```js
// Update handling: the "Updated to vN" toast on the first launch of a new
// version, and the reload that applies an update waiting for a run.
await reload({ "app-version-seen": "1" });
await wait(500);
check("updated toast", /^Updated to v\d+$/.test($("#toast-text").textContent), $("#toast-text").textContent);
const seen = app().localStorage.getItem("app-version-seen");
check("version recorded", Number(seen) > 1, seen);

await reload({ "app-version-seen": seen });
await wait(500);
check("no toast on the same version", $("#toast").hidden);

let reloads = 0;
app().reloadApp = () => { reloads++; };
app().sessionStorage.removeItem("update-reload-at");
app().localStorage.setItem("weight-tracker-active-run", JSON.stringify({ startedAt: Date.now(), type: "run", path: [] }));
app().reloadForUpdate();
eq("no reload while a run is tracked", reloads, 0);
app().localStorage.removeItem("weight-tracker-active-run");
$("#run-save-form").hidden = false;
app().applyPendingUpdate();
eq("still waits while the run is unsaved", reloads, 0);
$("#run-save-form").hidden = true;
app().applyPendingUpdate();
eq("reloads once the run is saved", reloads, 1);

// The guard survives a reload, so a worker that keeps changing can't loop.
await reload({});
app().reloadApp = () => { reloads++; };
app().reloadForUpdate();
eq("no second reload within 10 s", reloads, 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/updates.js`
Expected: FAIL "updated toast", then an ERROR because `app().reloadForUpdate` is not a function.

- [ ] **Step 3: Create `updates.js`**

```js
/* Updates that always arrive. sw.js revalidates our files on every
   request, so a deploy is picked up as soon as the service worker is
   re-checked: on load, and each time the app comes back to the
   foreground (iOS resumes the app instead of relaunching it). When a
   new worker takes over, the page reloads once, unless a run is being
   tracked or waiting to be saved; then it waits for app.js to call
   applyPendingUpdate(). Before this, reinstalling was the only sure way
   to update, and iOS deletes an install's data with its icon. */

const VERSION_SEEN_KEY = "app-version-seen";
const RELOAD_GUARD_KEY = "update-reload-at";
const RELOAD_GUARD_MS = 10000;

/* Only a page that already had a worker is running old code. On a
   first install the worker claims the page too, and that mustn't reload. */
const hadController = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);
let pendingReload = false;
let reloading = false;

function reloadApp() {
  location.reload();
}

function runInProgress() {
  return Boolean(localStorage.getItem(ACTIVE_RUN_KEY)) || !document.getElementById("run-save-form").hidden;
}

function reloadForUpdate() {
  if (reloading) return;
  if (runInProgress()) {
    pendingReload = true;
    return;
  }
  // sessionStorage outlives the reload, so this can't loop.
  const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
  if (Date.now() - last < RELOAD_GUARD_MS) return;
  sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  reloading = true;
  reloadApp();
}

/* Called by app.js after a run is saved or discarded. */
function applyPendingUpdate() {
  if (!pendingReload) return;
  pendingReload = false;
  reloadForUpdate();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) reloadForUpdate();
  });
  window.addEventListener("load", async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
    } catch {
      return;
    }
    const check = () => registration.update().catch(() => {});
    check();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  });
}

/* "Updated to vN" once, on the first launch of a new version. */
const versionSeen = Number(localStorage.getItem(VERSION_SEEN_KEY) || 0);
if (versionSeen && versionSeen !== APP_VERSION) {
  setTimeout(() => showToast(`Updated to v${APP_VERSION}`), 600);
}
localStorage.setItem(VERSION_SEEN_KEY, String(APP_VERSION));
```

- [ ] **Step 4: Wire it in**

- `app.js`: delete the final block (lines 809–813, `if ("serviceWorker" in navigator) { window.addEventListener("load", ... register("sw.js") ... }`). `updates.js` registers now.
- `app.js`: in the `runSaveForm` submit handler, after `renderRunList();`, add:
  ```js
    // An update that arrived mid-run was held back until now (updates.js).
    if (typeof applyPendingUpdate === "function") applyPendingUpdate();
  ```
- `app.js`: change the discard handler to:
  ```js
  document.getElementById("run-discard-btn").addEventListener("click", () => {
    enterIdleState();
    if (typeof applyPendingUpdate === "function") applyPendingUpdate();
  });
  ```
- `index.html`: after `<script src="quickadd.js"></script>`, add `<script src="updates.js"></script>`.
- `sw.js`: add `"./updates.js",` to `ASSETS` after `"./quickadd.js",`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/updates.js` (expect all PASS, exit 0), then `python tests/run.py` (static checks 4/4).

- [ ] **Step 6: Commit (ask Sean first)**

```bash
git add updates.js app.js index.html sw.js tests/ui/updates.js docs/progress-log-detailed.md
git commit -m "Step 0a: check for updates on load and foreground, reload once (not mid-run), show Updated to vN

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: backup-core.js (pure)

**Files:**
- Create: `backup-core.js`
- Test: `tests/backup-core.test.html`
- Modify: `index.html` (script tag after `food-core.js`), `sw.js` (ASSETS)

**Interfaces:**
- Produces: `isBackupKey(key) → bool`; `collectBackup(storage, now) → { app, format, savedAt, keys: {key: rawString} }`; `validBackup(b) → bool`; `applyBackup(storage, backup) → number` (throws `Error("That isn't a Weight & Save backup.")`); `hasUserData(storage) → bool`; `newRestoreCode(bytes: Uint8Array(12)) → "WS-XXXX-XXXX-XXXX"`; `normalizeCode(input) → code | null`; `backupDelay(now, lastBackupAt) → ms`; `formatAgo(then, now) → string`; `parseBackupFile(text) → { backup, photos: [{id, date, dataUrl}] }` (throws `Error("That file isn't a Weight & Save backup.")`); `backupFileName(dateStr) → string`. `storage` is anything localStorage-shaped (`length`, `key(i)`, `getItem`, `setItem`, `removeItem`).

- [ ] **Step 1: Write the failing test page `tests/backup-core.test.html`**

```html
<!DOCTYPE html>
<html><body><pre id="out"></pre>
<script src="test-utils.js"></script>
<script src="../backup-core.js"></script>
<script>
function fakeStorage(entries) {
  const map = new Map(Object.entries(entries || {}));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

run(() => {
  // ---- which keys ----
  eq("app keys are backed up",
    ["weight-tracker-entries", "weight-tracker-runs", "coach-checkins", "coach-injury", "food-log", "water-log", "ui-celebrated", "savings-settings"].map(isBackupKey),
    Array(8).fill(true));
  eq("device, auth and backup keys are not",
    ["coach-reminders-on", "weight-tracker-active-tab", "weight-tracker-active-run", "weight-tracker-progress-seg",
     "sb-inewcgtwhuwjmiyxlrvy-auth-token", "backup-code", "backup-on", "backup-last", "app-version-seen", "water-log-old"].map(isBackupKey),
    Array(10).fill(false));

  // ---- collect + restore round trip ----
  const src = fakeStorage({
    "weight-tracker-entries": '[{"id":"w","date":"2026-10-20","weight":201}]',
    "coach-reminders-on": "1", "food-log": "[]", "sb-x-auth-token": "secret", "backup-code": "WS-0000-0000-0000",
  });
  const b = collectBackup(src, 1000);
  eq("backup shape", b, { app: "weight-and-save", format: 1, savedAt: 1000,
    keys: { "food-log": "[]", "weight-tracker-entries": '[{"id":"w","date":"2026-10-20","weight":201}]' } });

  const dest = fakeStorage({ "coach-checkins": '{"stale":1}', "coach-reminders-on": "1", "backup-code": "WS-1111-1111-1111" });
  eq("restore writes the backup's keys", applyBackup(dest, b), 2);
  eq("restore round-trips", collectBackup(dest, 1000), b);
  eq("restore removes app keys the backup lacks", dest.getItem("coach-checkins"), null);
  eq("restore leaves device keys alone", [dest.getItem("coach-reminders-on"), dest.getItem("backup-code")], ["1", "WS-1111-1111-1111"]);
  const d2 = fakeStorage();
  applyBackup(d2, { app: "weight-and-save", format: 1, keys: { "sb-x": "t", "food-log": "[]" } });
  eq("restore skips non-app keys inside a backup", d2.dump(), { "food-log": "[]" });
  let err = null;
  const keep = fakeStorage({ "food-log": '[{"id":1}]' });
  try { applyBackup(keep, { app: "other", keys: {} }); } catch (e) { err = e.message; }
  eq("restore rejects a foreign backup", err, "That isn't a Weight & Save backup.");
  eq("a rejected restore changes nothing", keep.getItem("food-log"), '[{"id":1}]');

  // ---- fresh install vs real data ----
  eq("seeds alone aren't user data", hasUserData(fakeStorage({
    "food-library": "[1]", "coach-started-at": "1", "coach-injury": '{"part":"ankle"}', "ui-celebrated": "{}", "weight-tracker-entries": "[]" })), false);
  eq("a weigh-in is", hasUserData(fakeStorage({ "weight-tracker-entries": '[{"id":"w"}]' })), true);
  eq("a check-in is", hasUserData(fakeStorage({ "coach-checkins": '{"2026-10-21|wake":{}}' })), true);
  eq("corrupt JSON isn't", hasUserData(fakeStorage({ "food-log": "{oops" })), false);

  // ---- restore codes ----
  eq("code format", newRestoreCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 31])), "WS-0123-4567-89AZ");
  eq("high bits ignored", newRestoreCode(new Uint8Array(12).fill(255)), "WS-ZZZZ-ZZZZ-ZZZZ");
  eq("normalize: exact", normalizeCode("WS-7K3M-Q9TP-2XHD"), "WS-7K3M-Q9TP-2XHD");
  eq("normalize: lowercase + spaces", normalizeCode(" ws 7k3m q9tp 2xhd "), "WS-7K3M-Q9TP-2XHD");
  eq("normalize: no prefix", normalizeCode("7K3MQ9TP2XHD"), "WS-7K3M-Q9TP-2XHD");
  eq("normalize: O read as 0", normalizeCode("WS-7K3M-Q9TP-2XHO"), "WS-7K3M-Q9TP-2XH0");
  eq("normalize: I and L read as 1", normalizeCode("WS-IL00-0000-0000"), "WS-1100-0000-0000");
  eq("normalize: body starting with WS, no prefix", normalizeCode("WS7KQ9TP2XHD"), "WS-WS7K-Q9TP-2XHD");
  eq("normalize: too short", normalizeCode("WS-7K3M-Q9TP"), null);
  eq("normalize: U isn't a code letter", normalizeCode("WS-UUUU-0000-0000"), null);
  eq("normalize: empty", normalizeCode(""), null);

  // ---- timing ----
  eq("first backup 30 s after a change", backupDelay(100000, 0), 30000);
  eq("at most once a minute", backupDelay(100000, 80000), 40000);
  eq("never sooner than 30 s", backupDelay(100000, 99000), 59000);
  eq("ago", [0, 59e3, 120e3, 3 * 3600e3, 26 * 3600e3, 3 * 86400e3].map((ms) => formatAgo(1e9 - ms, 1e9)),
    ["just now", "just now", "2 min ago", "3 h ago", "yesterday", "3 days ago"]);

  // ---- backup file ----
  const file = JSON.stringify({ ...b, photos: [
    { id: "p1", date: "2026-10-20", dataUrl: "data:image/jpeg;base64,AAAA" },
    { id: "bad", date: "2026-10-20", dataUrl: "javascript:alert(1)" },
  ] });
  const parsed = parseBackupFile(file);
  eq("file: backup part", parsed.backup, b);
  eq("file: only image photos kept", parsed.photos.map((p) => p.id), ["p1"]);
  let ferr = null;
  try { parseBackupFile("not json"); } catch (e) { ferr = e.message; }
  eq("file: not JSON", ferr, "That file isn't a Weight & Save backup.");
  ferr = null;
  try { parseBackupFile('{"app":"other","keys":{}}'); } catch (e) { ferr = e.message; }
  eq("file: someone else's JSON", ferr, "That file isn't a Weight & Save backup.");
  eq("file name", backupFileName("2026-10-21"), "weight-and-save-backup-2026-10-21.json");
});
</script></body></html>
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python tests/run.py`
Expected: `backup-core.test.html: 0/1 passed` with `ERROR ReferenceError: isBackupKey is not defined`.

- [ ] **Step 3: Create `backup-core.js`**

```js
/* Backup core: which localStorage keys are Sean's data, the backup and
   backup-file shapes, restore codes, and backup timing. Storage is
   passed in (anything shaped like localStorage) so this stays DOM-free
   and testable. backup.js is the UI and the Supabase calls. */

const BACKUP_APP = "weight-and-save";
const BACKUP_FORMAT = 1;
const BACKUP_PREFIXES = ["weight-tracker-", "coach-", "food-", "ui-", "savings-"];
const BACKUP_EXACT = ["water-log"];
/* Device-specific: reminders belong to this phone's push subscription;
   the open tab, a run in progress and the Progress segment are screen
   state. Supabase's sb-* auth keys and backup-* keys never match. */
const BACKUP_EXCLUDED = ["coach-reminders-on", "weight-tracker-active-tab", "weight-tracker-active-run", "weight-tracker-progress-seg"];
/* Things a person logged. Seeded libraries and settings don't count,
   so a fresh install still offers Restore. */
const USER_DATA_KEYS = ["weight-tracker-entries", "weight-tracker-runs", "coach-checkins", "coach-habit-log", "food-log", "water-log"];
/* Crockford base32: no I, L, O or U, so a code copied by hand can't mix
   up 1/I/L or 0/O. 12 characters ≈ 60 bits. */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const NOT_A_BACKUP = "That isn't a Weight & Save backup.";
const NOT_A_BACKUP_FILE = "That file isn't a Weight & Save backup.";

function isBackupKey(key) {
  if (BACKUP_EXCLUDED.includes(key)) return false;
  return BACKUP_EXACT.includes(key) || BACKUP_PREFIXES.some((p) => key.startsWith(p));
}

function storageKeys(storage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) keys.push(storage.key(i));
  return keys;
}

/* Values stay as stored strings, so a restore writes back exactly what was there. */
function collectBackup(storage, now) {
  const keys = {};
  for (const key of storageKeys(storage).filter(isBackupKey).sort()) keys[key] = storage.getItem(key);
  return { app: BACKUP_APP, format: BACKUP_FORMAT, savedAt: now, keys };
}

function validBackup(backup) {
  return Boolean(backup) && backup.app === BACKUP_APP && Boolean(backup.keys) && typeof backup.keys === "object" &&
    Object.values(backup.keys).every((v) => typeof v === "string");
}

/* Replaces this device's app data with the backup's: app keys the
   backup lacks are removed, so the result matches it exactly.
   Device-only keys are left alone. Returns how many keys were written. */
function applyBackup(storage, backup) {
  if (!validBackup(backup)) throw new Error(NOT_A_BACKUP);
  for (const key of storageKeys(storage).filter(isBackupKey)) storage.removeItem(key);
  let written = 0;
  for (const [key, value] of Object.entries(backup.keys)) {
    if (!isBackupKey(key)) continue;
    storage.setItem(key, value);
    written++;
  }
  return written;
}

function hasUserData(storage) {
  return USER_DATA_KEYS.some((key) => {
    try {
      const value = JSON.parse(storage.getItem(key));
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value) && typeof value === "object" && Object.keys(value).length > 0;
    } catch {
      return false;
    }
  });
}

/* `bytes`: 12 random bytes (crypto.getRandomValues). */
function newRestoreCode(bytes) {
  const chars = Array.from(bytes.slice(0, 12), (b) => CODE_ALPHABET[b & 31]).join("");
  return `WS-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/* Forgiving read of a typed or pasted code: case, spaces, dashes and
   the WS prefix are optional; O reads as 0 and I/L as 1. Null if it
   still isn't 12 code characters. */
function normalizeCode(input) {
  let s = String(input || "").toUpperCase().replace(/[\s-]/g, "");
  if (s.length === 14 && s.startsWith("WS")) s = s.slice(2);
  s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (s.length !== 12 || [...s].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `WS-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/* 30 s after a change, but no sooner than a minute after the last backup. */
function backupDelay(now, lastBackupAt) {
  return Math.max(30000, (lastBackupAt || 0) + 60000 - now);
}

function formatAgo(then, now) {
  const min = Math.floor((now - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/* A backup file is a backup plus progress photos as data URLs. Photos
   that aren't images are dropped rather than written to IndexedDB. */
function parseBackupFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_BACKUP_FILE);
  }
  if (!validBackup(data)) throw new Error(NOT_A_BACKUP_FILE);
  const photos = Array.isArray(data.photos)
    ? data.photos.filter((p) => p && p.id && p.date && typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:image/"))
    : [];
  return { backup: { app: data.app, format: data.format, savedAt: data.savedAt, keys: data.keys }, photos };
}

function backupFileName(dateStr) {
  return `weight-and-save-backup-${dateStr}.json`;
}

if (typeof module !== "undefined") {
  module.exports = {
    isBackupKey, collectBackup, validBackup, applyBackup, hasUserData, newRestoreCode, normalizeCode,
    backupDelay, formatAgo, parseBackupFile, backupFileName,
  };
}
```

- [ ] **Step 4: Load it**

In `index.html`, add `<script src="backup-core.js"></script>` after `<script src="food-core.js"></script>`. In `sw.js` `ASSETS`, add `"./backup-core.js",` after `"./food-core.js",`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python tests/run.py`
Expected: `backup-core.test.html: 34/34 passed` (the exact count may differ by one or two; zero FAIL lines is what matters), static checks 4/4, exit 0.

- [ ] **Step 6: Commit (ask Sean first)**

```bash
git add backup-core.js tests/backup-core.test.html index.html sw.js docs/progress-log-detailed.md
git commit -m "Step 0b: backup-core (backed-up keys, restore codes, backup file, timing)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Supabase backups table and RPCs

**Files:**
- Create: `supabase/migrations/20261021000000_backups.sql`

**Interfaces:**
- Produces: RPC `save_backup(p_code text, p_data jsonb) returns timestamptz` and RPC `load_backup(p_code text) returns jsonb` (null when there's no backup). Both raise `not signed in` without a session. `save_backup` raises `bad restore code` or `backup too large` (over 5 MB).

- [ ] **Step 1: Write the migration**

```sql
-- Cloud backup (feedback batch 1, step 0). The app uploads its
-- localStorage data under a restore code Sean keeps in Notes. Rows are
-- keyed by the code's hash, not by user: reinstalling the app creates a
-- new anonymous user, and the code is how the new install finds the old
-- data. RLS is on with no policies, so these two functions are the only
-- way in, and only for someone who has the code.

create table public.backups (
  code_hash text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;
revoke all on public.backups from anon, authenticated;

create function public.save_backup(p_code text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_code !~ '^WS-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$' then
    raise exception 'bad restore code';
  end if;
  if octet_length(p_data::text) > 5000000 then
    raise exception 'backup too large';
  end if;
  insert into public.backups (code_hash, data, updated_at)
  values (encode(sha256(convert_to(p_code, 'UTF8')), 'hex'), p_data, v_at)
  on conflict (code_hash) do update
    set data = excluded.data, updated_at = excluded.updated_at;
  return v_at;
end;
$$;

create function public.load_backup(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  return (
    select b.data from public.backups b
    where b.code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex')
  );
end;
$$;

revoke execute on function public.save_backup(text, jsonb) from public, anon;
grant execute on function public.save_backup(text, jsonb) to authenticated;
revoke execute on function public.load_backup(text) from public, anon;
grant execute on function public.load_backup(text) to authenticated;
```

(Anonymous users sign in with the `authenticated` role, the same as `save_push_subscription`.)

- [ ] **Step 2: Ask Sean, then apply it**

Ask: "Apply the backups migration to the Supabase project (inewcgtwhuwjmiyxlrvy)?" On yes:

Run: `~/bin/supabase.exe migration list`. If it lists the project's remote migrations, run `~/bin/supabase.exe db push` and confirm that `20261021000000_backups` shows as applied in a second `migration list`. If the CLI isn't linked (it asks for `link` or a database password), don't guess credentials. Give Sean the file and ask him to paste it into the Supabase dashboard's SQL Editor and run it, then confirm it worked.

- [ ] **Step 3: Commit (ask Sean first)**

```bash
git add supabase/migrations/20261021000000_backups.sql docs/progress-log-detailed.md
git commit -m "Step 0b: backups table with save_backup/load_backup RPCs (code-hash keyed, RLS, no direct access)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Backup & updates card, automatic backup

**Files:**
- Create: `backup.js`
- Modify: `index.html` (card after `#reminders-card`, deferred script after `reminders.js`), `style.css` (append), `sw.js` (ASSETS)
- Test: `tests/ui/backup.js`

**Interfaces:**
- Consumes: `remindersDb`, `ensureSession` (reminders.js); `isBackupKey`, `collectBackup`, `newRestoreCode`, `backupDelay`, `formatAgo`, `hasUserData` (backup-core.js); `APP_VERSION`; `showToast`.
- Produces: `window.backupRemote = { save(code, data), load(code) }` (stubbable); function declarations `runBackup()`, `renderBackupCard()`, `backupOn()`; module-level `let restoring` (Tasks 6–7 set it); constants `BACKUP_CODE_KEY`, `BACKUP_ON_KEY`, `RESTORE_DISMISSED_KEY`.

- [ ] **Step 1: Write the failing UI test `tests/ui/backup.js`**

```js
// Backup & updates card: version line, turning backup on (code shown,
// first upload), automatic backup after a change (30 s, at most once a
// minute), turning it off. The server is stubbed. Run with --budget 120000.
const uploads = [];
const stub = () => {
  app().backupRemote.save = async (code, data) => { uploads.push({ code, data }); };
  app().backupRemote.load = async () => null;
};

await reload({ "coach-started-at": "0" });
stub();
check("version shown", /^Weight & Save v\d+$/.test($("#backup-version").textContent), $("#backup-version").textContent);
check("off by default", $("#backup-status").textContent.startsWith("Off."));
check("code hidden while off", $("#backup-code-row").hidden);

click("#backup-toggle");
await wait(50);
const code = app().localStorage.getItem("backup-code");
check("code generated", /^WS-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(code), code);
eq("code shown", $("#backup-code").textContent, code);
check("code note shown", !$("#backup-code-note").hidden);
eq("first upload on turn-on", uploads.length, 1);
eq("uploaded under the code", uploads[0].code, code);
check("upload carries app data, not device keys",
  "coach-started-at" in uploads[0].data.keys && !("backup-code" in uploads[0].data.keys));
eq("status", $("#backup-status").textContent, "Last backed up just now.");

// A change backs up later: not before a minute since the last one.
app().localStorage.setItem("water-log", JSON.stringify([{ id: "x", date: today, at: Date.now(), oz: 8 }]));
await wait(20000);
eq("not before the minute is up", uploads.length, 1);
await wait(45000);
eq("change uploaded", uploads.length, 2);
eq("upload has the change", JSON.parse(uploads[1].data.keys["water-log"])[0].oz, 8);

// A failed upload says so and keeps the change for a retry.
app().backupRemote.save = async () => { throw new Error("offline"); };
app().localStorage.setItem("water-log", "[]");
await app().runBackup();
eq("error shown", $("#backup-status").textContent, "Backup failed: offline. Will retry.");
stub();

// Off: no more uploads; the code is kept for next time.
click("#backup-toggle");
check("off again", $("#backup-status").textContent.startsWith("Off."));
eq("code kept", app().localStorage.getItem("backup-code"), code);
app().localStorage.setItem("water-log", "[]");
await app().runBackup();
eq("no uploads while off", uploads.length, 2);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python .claude/skills/phone-preview/preview.py --budget 120000 --interact tests/ui/backup.js`
Expected: ERROR, because `app().backupRemote` is undefined.

- [ ] **Step 3: Add the card to `index.html`**

Right after the `#reminders-card` section closes, add:

```html
      <section class="card area-neutral" id="backup-card">
        <div class="card-head">
          <h2>Backup &amp; updates</h2>
          <button type="button" id="backup-toggle" class="pill-btn dark">Turn on</button>
        </div>
        <p class="hint" id="backup-version"></p>
        <p class="hint" id="backup-status"></p>
        <div class="backup-code-row" id="backup-code-row" hidden>
          <code class="backup-code" id="backup-code"></code>
          <button type="button" id="backup-copy" class="pill-btn">Copy</button>
        </div>
        <p class="hint" id="backup-code-note" hidden>Save this code in Notes. On a new install it brings everything back.</p>
      </section>
```

At the bottom, after `<script defer src="reminders.js"></script>`, add `<script defer src="backup.js"></script>`. In `sw.js` `ASSETS`, add `"./backup.js",` after `"./reminders.js",`.

- [ ] **Step 4: Create `backup.js`**

```js
/* Backup & updates card and automatic cloud backup. The rules (which
   keys, code format, timing) live in backup-core.js; the server side is
   the backups table and its two functions
   (supabase/migrations/20261021000000_backups.sql). Loaded after
   reminders.js, whose Supabase client and anonymous sign-in it reuses. */

const BACKUP_CODE_KEY = "backup-code";
const BACKUP_ON_KEY = "backup-on";
const BACKUP_LAST_KEY = "backup-last";
const RESTORE_DISMISSED_KEY = "backup-restore-dismissed";
const BACKUP_RETRY_MS = 5 * 60000;

/* The only two server calls. On window so UI tests can stub them. */
window.backupRemote = {
  async save(code, data) {
    if (!remindersDb) throw new Error("no connection");
    await ensureSession();
    const { error } = await remindersDb.rpc("save_backup", { p_code: code, p_data: data });
    if (error) throw error;
  },
  async load(code) {
    if (!remindersDb) throw new Error("no connection");
    await ensureSession();
    const { data, error } = await remindersDb.rpc("load_backup", { p_code: code });
    if (error) throw error;
    return data;
  },
};

let backupTimer = null;
let backupDirty = false;
let backupInFlight = false;
let backupError = null;
let restoring = false; // a restore is replacing everything; don't back up the half-written state

function backupCode() {
  return localStorage.getItem(BACKUP_CODE_KEY);
}

function backupOn() {
  return localStorage.getItem(BACKUP_ON_KEY) === "1" && Boolean(backupCode());
}

/* App data is written from many files, always through localStorage.
   Hooking setItem/removeItem catches every change without touching
   each caller. Only backed-up keys count. */
const nativeSetItem = Storage.prototype.setItem;
const nativeRemoveItem = Storage.prototype.removeItem;
Storage.prototype.setItem = function (key, value) {
  nativeSetItem.call(this, key, value);
  if (this === localStorage && isBackupKey(String(key))) noteBackupChange();
};
Storage.prototype.removeItem = function (key) {
  nativeRemoveItem.call(this, key);
  if (this === localStorage && isBackupKey(String(key))) noteBackupChange();
};

function noteBackupChange() {
  if (restoring || !backupOn()) return;
  backupDirty = true;
  if (!backupTimer) {
    backupTimer = setTimeout(runBackup, backupDelay(Date.now(), Number(localStorage.getItem(BACKUP_LAST_KEY) || 0)));
  }
}

async function runBackup() {
  clearTimeout(backupTimer);
  backupTimer = null;
  if (!backupOn() || !backupDirty) return;
  if (backupInFlight) {
    backupTimer = setTimeout(runBackup, 5000);
    return;
  }
  backupDirty = false;
  backupInFlight = true;
  try {
    await backupRemote.save(backupCode(), collectBackup(localStorage, Date.now()));
    localStorage.setItem(BACKUP_LAST_KEY, String(Date.now()));
    backupError = null;
  } catch (err) {
    // Offline or a server hiccup: keep the change and try again later.
    backupDirty = true;
    backupError = err.message || String(err);
    backupTimer = setTimeout(runBackup, BACKUP_RETRY_MS);
  } finally {
    backupInFlight = false;
    renderBackupCard();
  }
}

/* Turning on reuses an earlier code, so backups continue under it. */
function turnBackupOn() {
  if (!backupCode()) {
    localStorage.setItem(BACKUP_CODE_KEY, newRestoreCode(crypto.getRandomValues(new Uint8Array(12))));
  }
  localStorage.setItem(BACKUP_ON_KEY, "1");
  backupDirty = true;
  runBackup();
  renderBackupCard();
}

function turnBackupOff() {
  localStorage.removeItem(BACKUP_ON_KEY);
  clearTimeout(backupTimer);
  backupTimer = null;
  backupDirty = false;
  backupError = null;
  renderBackupCard();
}

function renderBackupCard() {
  const on = backupOn();
  const last = Number(localStorage.getItem(BACKUP_LAST_KEY) || 0);
  document.getElementById("backup-version").textContent = `Weight & Save v${APP_VERSION}`;
  const toggle = document.getElementById("backup-toggle");
  toggle.textContent = on ? "Turn off" : "Turn on";
  toggle.classList.toggle("dark", !on);
  document.getElementById("backup-status").textContent = !on
    ? "Off. Turn on to back up to the cloud automatically and get a restore code."
    : backupError
      ? `Backup failed: ${backupError}. Will retry.`
      : last
        ? `Last backed up ${formatAgo(last, Date.now())}.`
        : "Backing up…";
  document.getElementById("backup-code-row").hidden = !on;
  document.getElementById("backup-code-note").hidden = !on;
  document.getElementById("backup-code").textContent = backupCode() || "";
}

document.getElementById("backup-toggle").addEventListener("click", () => {
  if (backupOn()) turnBackupOff();
  else turnBackupOn();
});

document.getElementById("backup-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(backupCode());
    showToast("Restore code copied. Paste it into Notes.");
  } catch {
    showToast("Couldn't copy. Press and hold the code to copy it.");
  }
});

document.addEventListener("visibilitychange", () => {
  // Going to the background is the last sure chance to upload.
  if (document.visibilityState === "hidden" && backupDirty) runBackup();
  if (document.visibilityState === "visible") renderBackupCard();
});
setInterval(renderBackupCard, 60000);

renderBackupCard();
// Changes from the last session may not have gone up before it closed.
noteBackupChange();
```

- [ ] **Step 5: Append the CSS to `style.css`**

```css
/* ---- Backup & updates ---- */

.backup-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.backup-code {
  font: 700 17px/1.2 ui-monospace, "SF Mono", Menlo, monospace;
  letter-spacing: 0.04em;
  -webkit-user-select: all;
  user-select: all;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python .claude/skills/phone-preview/preview.py --budget 120000 --interact tests/ui/backup.js` (all PASS), then `python tests/run.py` (exit 0).

- [ ] **Step 7: Commit (ask Sean first)**

```bash
git add backup.js index.html style.css sw.js tests/ui/backup.js docs/progress-log-detailed.md
git commit -m "Step 0b: Backup & updates card with restore code and automatic cloud backup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Restore by code (Backup card and fresh-install card)

**Files:**
- Modify: `backup.js` (append restore), `index.html` (restore card at top of Today; restore form in the Backup card), `style.css` (append)
- Test: `tests/ui/restore.js`

**Interfaces:**
- Consumes: `normalizeCode`, `applyBackup`, `hasUserData` (backup-core.js); `reloadApp()` (updates.js); `window.confirm`; `restoring`, `backupRemote`, `BACKUP_CODE_KEY`, `BACKUP_ON_KEY`, `RESTORE_DISMISSED_KEY` (Task 5).
- Produces: `restoreFromCode(input, statusEl)`. `renderBackupCard()` now also shows or hides `#restore-card`.

- [ ] **Step 1: Write the failing UI test `tests/ui/restore.js`**

```js
// Restore from a backup code: the fresh-install card on Today and the
// Backup card's Restore form. The server is stubbed.
const code = "WS-7K3M-Q9TP-2XHD";
const backup = { app: "weight-and-save", format: 1, savedAt: Date.now() - 3600000, keys: {
  "weight-tracker-entries": JSON.stringify([{ id: "w1", date: today, weight: 201.4, unit: "lbs" }]),
  "coach-taper-start": "2026-10-12",
} };
let reloads = 0;
let asked = null;
const stub = (answer) => {
  app().backupRemote.load = async (c) => (c === code ? backup : null);
  app().backupRemote.save = async () => {};
  app().confirm = (msg) => { asked = msg; return answer; };
  app().reloadApp = () => { reloads++; };
};
const submit = async (form) => { $(form).requestSubmit(); await wait(50); };

// A fresh install (only seeded data) offers Restore at the top of Today.
await reload({});
stub(true);
check("fresh install shows the restore card", !$("#restore-card").hidden);

fill("#restore-card-input", "WS-7K3M");
await submit("#restore-card-form");
check("short code explained", $("#restore-card-status").textContent.startsWith("That doesn't look like a restore code"));
fill("#restore-card-input", "WS-0000-0000-0000");
await submit("#restore-card-form");
eq("unknown code", $("#restore-card-status").textContent, "No backup found for that code. Check it against your Notes.");

// Declining the confirm changes nothing.
stub(false);
fill("#restore-card-input", "ws 7k3m q9tp 2xhd");
await submit("#restore-card-form");
check("asks before replacing", Boolean(asked) && asked.startsWith("Replace everything on this phone"), asked);
eq("cancel leaves data alone", app().localStorage.getItem("weight-tracker-entries"), null);
eq("cancel says so", $("#restore-card-status").textContent, "Restore cancelled. Nothing changed.");
eq("no reload on cancel", reloads, 0);

// Confirming restores, keeps the code, turns backup on, reloads.
stub(true);
await submit("#restore-card-form");
eq("weights restored", ls("weight-tracker-entries")[0].weight, 201.4);
eq("taper restored", app().localStorage.getItem("coach-taper-start"), "2026-10-12");
eq("code kept", app().localStorage.getItem("backup-code"), code);
eq("backup on", app().localStorage.getItem("backup-on"), "1");
eq("reloads into the restored data", reloads, 1);

// With data on the phone the card stays hidden; Restore lives in the Backup card.
await reload({ "weight-tracker-entries": [{ id: "w", date: today, weight: 200 }] });
stub(true);
check("card hidden when there's data", $("#restore-card").hidden);
fill("#backup-restore-input", code);
await submit("#backup-restore-form");
eq("Backup card restore replaces local data", ls("weight-tracker-entries")[0].weight, 201.4);

// A connection error is explained.
await reload({});
stub(true);
app().backupRemote.load = async () => { throw new Error("no connection"); };
fill("#restore-card-input", code);
await submit("#restore-card-form");
check("connection error explained", $("#restore-card-status").textContent.startsWith("Couldn't reach the backup: no connection"));

// "Start fresh" hides the card for good.
clickText("Start fresh");
check("start fresh hides the card", $("#restore-card").hidden);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/restore.js`
Expected: FAIL/ERROR, because `#restore-card` doesn't exist.

- [ ] **Step 3: Add the markup to `index.html`**

Inside `#today-panel`, right after `</header>` (before the hero section):

```html
      <section class="card area-neutral" id="restore-card" hidden>
        <h2>Restore from backup</h2>
        <p class="hint">New install? Enter your restore code (it's in Notes and starts with WS-) or import a backup file.</p>
        <form id="restore-card-form" class="code-form">
          <input id="restore-card-input" type="text" placeholder="WS-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false">
          <button type="submit" class="pill-btn dark">Restore</button>
        </form>
        <p class="hint" id="restore-card-status"></p>
        <button type="button" id="restore-card-dismiss" class="link-btn">Start fresh</button>
      </section>
```

In `#backup-card`, after the `#backup-code-note` paragraph:

```html
        <form id="backup-restore-form" class="code-form">
          <input id="backup-restore-input" type="text" placeholder="Restore code" autocomplete="off" autocapitalize="characters" spellcheck="false">
          <button type="submit" class="pill-btn">Restore</button>
        </form>
        <p class="hint" id="backup-restore-status"></p>
```

- [ ] **Step 4: Append the restore code to `backup.js`**

Put this above the `document.getElementById("backup-toggle")` listener:

```js
/* Fetches the backup for a typed code and, once confirmed, replaces
   this phone's data with it. Keeps the code (and backup on) so backups
   continue under it, then reloads into the restored data. */
async function restoreFromCode(input, statusEl) {
  const code = normalizeCode(input);
  if (!code) {
    statusEl.textContent = "That doesn't look like a restore code. It starts with WS- and has 12 letters and numbers.";
    return;
  }
  statusEl.textContent = "Looking up your backup…";
  let backup;
  try {
    backup = await backupRemote.load(code);
  } catch (err) {
    statusEl.textContent = `Couldn't reach the backup: ${err.message || err}. Check your connection and try again.`;
    return;
  }
  if (!backup) {
    statusEl.textContent = "No backup found for that code. Check it against your Notes.";
    return;
  }
  const when = backup.savedAt ? new Date(backup.savedAt).toLocaleString() : "an unknown date";
  if (!confirm(`Replace everything on this phone with the backup from ${when}?`)) {
    statusEl.textContent = "Restore cancelled. Nothing changed.";
    return;
  }
  restoring = true;
  try {
    applyBackup(localStorage, backup);
  } catch (err) {
    restoring = false;
    statusEl.textContent = err.message;
    return;
  }
  localStorage.setItem(BACKUP_CODE_KEY, code);
  localStorage.setItem(BACKUP_ON_KEY, "1");
  reloadApp();
}
```

At the end of `renderBackupCard()`, add:

```js
  // Offered on a fresh install only: nothing logged, no code yet, not dismissed.
  document.getElementById("restore-card").hidden =
    hasUserData(localStorage) || Boolean(backupCode()) || localStorage.getItem(RESTORE_DISMISSED_KEY) === "1";
```

With the other listeners:

```js
document.getElementById("backup-restore-form").addEventListener("submit", (e) => {
  e.preventDefault();
  restoreFromCode(document.getElementById("backup-restore-input").value, document.getElementById("backup-restore-status"));
});

document.getElementById("restore-card-form").addEventListener("submit", (e) => {
  e.preventDefault();
  restoreFromCode(document.getElementById("restore-card-input").value, document.getElementById("restore-card-status"));
});

document.getElementById("restore-card-dismiss").addEventListener("click", () => {
  localStorage.setItem(RESTORE_DISMISSED_KEY, "1");
  renderBackupCard();
});
```

- [ ] **Step 5: Append the CSS**

```css
.code-form {
  display: flex;
  gap: 8px;
  margin: 0 0 8px;
}

.code-form input {
  flex: 1;
  min-width: 0;
  text-transform: uppercase;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/restore.js` (all PASS), then `python tests/run.py` (exit 0).

- [ ] **Step 7: Commit (ask Sean first)**

```bash
git add backup.js index.html style.css tests/ui/restore.js docs/progress-log-detailed.md
git commit -m "Step 0b: restore from a backup code (fresh-install card + Backup card), with confirmation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Export and import a backup file (with photos)

**Files:**
- Modify: `backup.js` (append), `index.html` (buttons in the Backup card, import link on the restore card), `style.css` (append)
- Test: `tests/ui/backup-file.js`

**Interfaces:**
- Consumes: `getAllPhotos()`, `addPhoto(record)` (app.js; records are `{ id, date, blob }`); `collectBackup`, `parseBackupFile`, `applyBackup`, `backupFileName` (backup-core.js); `todayLocalDateString`; `reloadApp`; `restoring`.
- Produces: `exportBackup()`, `importBackup(file, statusEl)`.

- [ ] **Step 1: Write the failing UI test `tests/ui/backup-file.js`**

```js
// Export a backup file (two taps: build, then share) and import it into
// a fresh install, progress photos included.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let shared = null;
let reloads = 0;
const stub = () => {
  app().navigator.canShare = () => true;
  app().navigator.share = async (data) => { shared = data; };
  app().confirm = () => true;
  app().reloadApp = () => { reloads++; };
};

await reload({ "coach-started-at": "0", "weight-tracker-entries": [{ id: "w", date: today, weight: 199.2, unit: "lbs" }] });
stub();
await app().addPhoto({ id: "p1", date: today, blob: await (await fetch(PNG)).blob() });

click("#backup-export");
await wait(300);
eq("tap 1 builds the file", $("#backup-export").textContent, "Share backup file");
click("#backup-export");
await wait(50);
const file = shared && shared.files[0];
check("tap 2 shares a file", Boolean(file));
eq("file name", file.name, `weight-and-save-backup-${today}.json`);
const json = JSON.parse(await file.text());
eq("file has the weights", JSON.parse(json.keys["weight-tracker-entries"])[0].weight, 199.2);
eq("file has the photo", json.photos.map((p) => [p.id, p.date, p.dataUrl.startsWith("data:image/png")]), [["p1", today, true]]);
eq("button resets", $("#backup-export").textContent, "Export backup");

// Import into a fresh install (photos live in IndexedDB, which reload() doesn't wipe).
await reload({});
stub();
await app().deletePhotoRecord("p1");
eq("no photos before import", (await app().getAllPhotos()).length, 0);
const pick = async (text) => {
  const dt = new (app().DataTransfer)();
  dt.items.add(new (app().File)([text], "backup.json", { type: "application/json" }));
  $("#backup-import-input").files = dt.files;
  $("#backup-import-input").dispatchEvent(new (app().Event)("change", { bubbles: true }));
  await wait(500);
};
await pick("not a backup");
eq("bad file explained", $("#restore-card-status").textContent, "That file isn't a Weight & Save backup.");
await pick(JSON.stringify(json));
eq("weights imported", ls("weight-tracker-entries")[0].weight, 199.2);
eq("photo imported", (await app().getAllPhotos()).map((p) => p.id), ["p1"]);
eq("reloaded after import", reloads, 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/backup-file.js`
Expected: ERROR, "nothing matches #backup-export".

- [ ] **Step 3: Add the markup**

In `#backup-card`, before the `#backup-restore-form`:

```html
        <div class="backup-actions">
          <button type="button" id="backup-export" class="secondary-btn">Export backup</button>
          <label for="backup-import-input" class="secondary-btn">Import backup</label>
        </div>
        <input id="backup-import-input" type="file" accept="application/json,.json" hidden>
```

In `#restore-card`, before the `Start fresh` button:

```html
        <label for="backup-import-input" class="link-btn">Import a backup file</label>
```

- [ ] **Step 4: Append export and import to `backup.js`**

Put this above the listeners:

```js
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

let preparedExport = null;

/* Tap 1 builds the file (reading photos from IndexedDB takes a moment).
   Tap 2 shares it: iOS only allows navigator.share straight from a tap.
   Photos travel only in the file, which keeps cloud backups small. */
async function exportBackup() {
  const btn = document.getElementById("backup-export");
  if (preparedExport) {
    const file = preparedExport;
    preparedExport = null;
    btn.textContent = "Export backup";
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Weight & Save backup" });
      } catch (err) {
        if (err.name !== "AbortError") showToast("Couldn't share the backup file");
      }
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    return;
  }
  btn.textContent = "Preparing…";
  btn.disabled = true;
  try {
    const photos = await Promise.all((await getAllPhotos()).map(async (p) => ({
      id: p.id, date: p.date, dataUrl: await blobToDataUrl(p.blob),
    })));
    const json = JSON.stringify({ ...collectBackup(localStorage, Date.now()), photos });
    preparedExport = new File([json], backupFileName(todayLocalDateString()), { type: "application/json" });
    btn.textContent = "Share backup file";
  } catch (err) {
    btn.textContent = "Export backup";
    showToast(`Couldn't build the backup: ${err.message || err}`);
  } finally {
    btn.disabled = false;
  }
}

async function importBackup(file, statusEl) {
  let parsed;
  try {
    parsed = parseBackupFile(await file.text());
  } catch (err) {
    statusEl.textContent = err.message;
    return;
  }
  const when = parsed.backup.savedAt ? new Date(parsed.backup.savedAt).toLocaleString() : "an unknown date";
  const n = parsed.photos.length;
  const photos = n ? ` and ${n} photo${n === 1 ? "" : "s"}` : "";
  if (!confirm(`Replace everything on this phone with the backup file from ${when}${photos}?`)) {
    statusEl.textContent = "Import cancelled. Nothing changed.";
    return;
  }
  restoring = true;
  applyBackup(localStorage, parsed.backup);
  for (const p of parsed.photos) await addPhoto({ id: p.id, date: p.date, blob: await dataUrlToBlob(p.dataUrl) });
  reloadApp();
}
```

With the listeners:

```js
document.getElementById("backup-export").addEventListener("click", exportBackup);

document.getElementById("backup-import-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const onRestoreCard = !document.getElementById("restore-card").hidden;
  importBackup(file, document.getElementById(onRestoreCard ? "restore-card-status" : "backup-restore-status"));
});
```

- [ ] **Step 5: Append the CSS**

```css
.backup-actions {
  display: flex;
  gap: 10px;
  margin: 4px 0 12px;
}

.backup-actions > * {
  flex: 1;
  text-align: center;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/backup-file.js` (all PASS), then `python tests/run.py` (exit 0).

- [ ] **Step 7: Commit (ask Sean first)**

```bash
git add backup.js index.html style.css tests/ui/backup-file.js docs/progress-log-detailed.md
git commit -m "Step 0b: export/import a backup file with progress photos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Ship step 0 (v31)

- [ ] **Step 1: Full verification**

- `python tests/run.py`: exit 0, static checks 4/4.
- Every UI script, light mode: `python .claude/skills/phone-preview/preview.py --out "<scratchpad>/preview" $(printf -- '--interact %s ' tests/ui/*.js)` (Git Bash). If `backup.js` reports "never reported", rerun it alone with `--budget 120000`.
- Dark mode: rerun the same command with `--dark`.
- Tab smoke test: `python .claude/skills/phone-preview/preview.py --tabs today-panel --height 2600 --out "<scratchpad>/preview"` and again with `--dark`. **Read the screenshots.** Check the Backup card (version line, Turn on, no overflow from the code row at 390 px) and that the restore card shows on first launch without crowding the rings.
- `grep -n "weight-tracker-v31" sw.js` and `grep -n "APP_VERSION = 31" version.js` should each match once.
- Apply superpowers:verification-before-completion. Report the actual outputs.

- [ ] **Step 2: Progress logs.** Add the summary paragraph to `docs/progress-log-summary.md` ("Step 0 shipped: updates always arrive, cloud backup with restore code, file export"). Commit it with the last row of the detailed log (ask Sean).

- [ ] **Step 3: Push (ask Sean first).** `git push`. This also pushes the earlier spec commits.

- [ ] **Step 4: Phone check with Sean** (he does it; the next step waits on his OK)
  1. **Don't delete the home-screen icon.** Swipe the app away and reopen it. The first launch after this push may still show v30, because the old service worker serves it; reopen once more. The Backup card should read "Weight & Save v31". The first launch on v31 won't show an "Updated to" toast, because the app has never recorded a version before. The card's version line is the check.
  2. Backup → **Turn on**. A code appears. Tap **Copy** and paste it into Notes.
  3. Log something, wait a minute, and check that the card says "Last backed up … ago".
  4. **Export backup** → **Share backup file** → Save to Files.
  5. In Safari (or the app), tap **Import backup**, pick the file you just saved to Files, check that the confirm appears, then tap **Cancel**. The status should read "Import cancelled. Nothing changed." If the file is greyed out in the picker, tell Claude.
  6. Optional, safe restore test: open the site in **Safari** (not the installed app; it has separate storage). The restore card should appear. Enter the code. Data appears after the reload. Then, still in Safari, tap Backup → **Turn off** before closing the tab, so that copy never uploads again.
  7. The real update test happens with step 0.5: after that push, reopening the app should show "Updated to v32" with no reinstall.

---

# Step 0.5: Injury mode (ships as v32)

### Task 9: Injury schedule rules (pure)

**Files:**
- Modify: `coach-core.js` (injury constants and functions, `itemsForDate`, `dayCompletion`, `completionStreak`, exports)
- Modify: `food-data.js` (`SNACK_PLAN` rest entries)
- Test: `tests/injury.test.html`

**Interfaces:**
- Produces: `itemsForDate(dateStr, overrides, injury)` (third argument optional); `completionStreak(checkins, overrides, todayStr, nowMinutes, injury)`; `injuryActive(injury, dateStr) → bool`; `injuryDays(injury, dateStr) → { day, total }`; `endInjury(injury, todayStr) → injury`; `injuryPainFlag(feelLog, todayStr, pain) → bool`; `capitalize(s)`; constants `INJURY_LIFT_NOTE`, `INJURY_WALK_TITLE`, `PAIN_WARNING`. Injured items can carry `optional: true`. The recheck item is `{ id: "injury-recheck", time: "09:00", title: "<Part> recheck", kind: "appointment" }`. PT items are `{ id, time, title, kind: "pt" }`.

- [ ] **Step 1: Write the failing test page `tests/injury.test.html`**

```html
<!DOCTYPE html>
<html><body><pre id="out"></pre>
<script src="test-utils.js"></script>
<script src="../coach-core.js"></script>
<script src="../food-data.js"></script>
<script src="../food-core.js"></script>
<script>
run(() => {
  // 2026-10-12 Mon (game day), 10-14 Wed (lift day), 10-19 Mon.
  const inj = { part: "ankle", start: "2026-10-12", until: "2026-10-19", note: "", pt: [] };
  const has = (d, id, i) => itemsForDate(d, {}, i === undefined ? inj : i).some((x) => x.id === id);
  const find = (d, id) => itemsForDate(d, {}, inj).find((x) => x.id === id);

  eq("active on start", injuryActive(inj, "2026-10-12"), true);
  eq("active on until", injuryActive(inj, "2026-10-19"), true);
  eq("off the day before", injuryActive(inj, "2026-10-11"), false);
  eq("off the day after", injuryActive(inj, "2026-10-20"), false);
  eq("null injury is off", injuryActive(null, "2026-10-12"), false);

  eq("game removed", has("2026-10-12", "game"), false);
  eq("pregame prep removed", has("2026-10-12", "pregame-prep"), false);
  eq("snacks retitled", ["pregame-snack", "postgame"].map((id) => find("2026-10-12", id).title), ["Late-afternoon snack", "Evening snack"]);
  eq("game-day notes dropped", ["pregame-snack", "postgame"].map((id) => find("2026-10-12", id).note), [undefined, undefined]);
  eq("lunch walk retitled + optional", [find("2026-10-12", "post-lunch").title, find("2026-10-12", "post-lunch").optional], [INJURY_WALK_TITLE, true]);
  eq("lift title kept", find("2026-10-14", "lift").title, "Lift — 45 min");
  eq("lift note swapped", find("2026-10-14", "lift").note, INJURY_LIFT_NOTE);
  eq("dinner walk retitled", find("2026-10-14", "post-dinner").title, INJURY_WALK_TITLE);
  eq("recheck on until", find("2026-10-19", "injury-recheck"), { id: "injury-recheck", time: "09:00", title: "Ankle recheck", kind: "appointment" });
  eq("no recheck before until", has("2026-10-15", "injury-recheck"), false);
  eq("games still off on the recheck day", has("2026-10-19", "game"), false);
  eq("day after until unchanged", itemsForDate("2026-10-20", {}, inj), itemsForDate("2026-10-20", {}));
  eq("day before start unchanged", itemsForDate("2026-10-11", {}, inj), itemsForDate("2026-10-11", {}));
  eq("no injury = plain template", itemsForDate("2026-10-12", {}, null), itemsForDate("2026-10-12", {}));
  eq("template not mutated", itemsForDate("2026-10-12", {}).find((i) => i.id === "pregame-snack").title, "Pre-game snack");

  const withPt = { ...inj, pt: [{ id: "pt-1", time: "07:30", title: "Ankle alphabet" }] };
  const tue = itemsForDate("2026-10-13", {}, withPt);
  eq("PT item added daily", tue.find((i) => i.id === "pt-1"), { id: "pt-1", time: "07:30", title: "Ankle alphabet", kind: "pt" });
  eq("PT keeps the day sorted", tue.map((i) => i.time), [...tue.map((i) => i.time)].sort());
  eq("no PT outside the range", has("2026-10-20", "pt-1", withPt), false);
  eq("Edit day can remove the recheck", itemsForDate("2026-10-19", { "2026-10-19": { removed: ["injury-recheck"] } }, inj).some((i) => i.id === "injury-recheck"), false);
  eq("Edit day can move a PT item", itemsForDate("2026-10-13", { "2026-10-13": { moved: { "pt-1": "08:00" } } }, withPt).find((i) => i.id === "pt-1").time, "08:00");

  // Optional walks never count against the score.
  const day = [{ id: "a", time: "08:00" }, { id: "w", time: "09:00", optional: true }];
  eq("optional items left out of the score", dayCompletion(day, {}, "2026-10-12"), { due: 1, done: 0, pct: 0 });
  eq("score with the real item done", dayCompletion(day, { "2026-10-12|a": { status: "done" } }, "2026-10-12").pct, 100);

  // The streak judges injured days by the injured schedule. Edit day strips
  // both days down to the evening game block, so the plain schedule (game,
  // prep, walk not done) scores 2/5 = 40%, while the injured one scores 100%.
  const strip = { removed: ["wake", "weigh", "brush-am", "breakfast", "snack-am", "snack-pm", "close-food-log", "wind-down", "brush-pm", "lights-out", "lunch"], moved: {}, added: [] };
  const ov = { "2026-10-12": strip, "2026-10-13": strip };
  const full = {};
  for (const d of ["2026-10-12", "2026-10-13"]) for (const i of itemsForDate(d, ov, inj)) if (!i.optional) full[`${d}|${i.id}`] = { status: "done", at: 0 };
  eq("streak uses the injured schedule", completionStreak(full, ov, "2026-10-14", 0, inj), 2);
  eq("without it, the missing games break it", completionStreak(full, ov, "2026-10-14", 0), 0);

  // Water and snacks follow from the day type.
  eq("game-day water bonus off", waterGoal({}, 200, dayType(itemsForDate("2026-10-12", {}, inj))), 100);
  eq("bonus still on normally", waterGoal({}, 200, dayType(itemsForDate("2026-10-12", {}))), 132);
  eq("rest-day ideas for former game-day snacks",
    ["snack-am", "pregame-snack", "postgame"].map((s) => snackIdeasFor(SNACK_IDEAS, SNACK_PLAN, s, "rest").length > 0), [true, true, true]);

  // Day counter, ending.
  const sean = { part: "ankle", start: "2026-10-21", until: "2026-12-07" };
  eq("day 1", injuryDays(sean, "2026-10-21"), { day: 1, total: 48 });
  eq("recheck day", injuryDays(sean, "2026-12-07"), { day: 48, total: 48 });
  const ended = endInjury(inj, "2026-10-15");
  eq("end sets until to yesterday", ended.until, "2026-10-14");
  eq("ended: off today", injuryActive(ended, "2026-10-15"), false);
  eq("ended: history kept", injuryActive(ended, "2026-10-13"), true);

  // Pain flag: 4+ now, or this week's average above last week's.
  const rec = (date, injuryPain) => ({ date, injuryPain });
  eq("pain 4 flags", injuryPainFlag([], "2026-10-14", 4), true);
  eq("pain 3, no history", injuryPainFlag([rec("2026-10-14", 3)], "2026-10-14", 3), false);
  eq("rising week flags", injuryPainFlag([rec("2026-10-05", 1), rec("2026-10-06", 1), rec("2026-10-12", 3), rec("2026-10-14", 3)], "2026-10-14", 3), true);
  eq("falling week doesn't", injuryPainFlag([rec("2026-10-05", 3), rec("2026-10-12", 2), rec("2026-10-14", 2)], "2026-10-14", 2), false);
  eq("records without pain ignored", injuryPainFlag([{ date: "2026-10-05" }, rec("2026-10-14", 2)], "2026-10-14", 2), false);
});
</script></body></html>
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python tests/run.py`
Expected: `injury.test.html: 0/1 passed` with `ERROR ReferenceError: injuryActive is not defined`.

- [ ] **Step 3: Add the injury rules to `coach-core.js`**

Put this after `daysBetween()` and before `itemsForDate()`:

```js
/* ---- Injury mode ----
   While an injury is on (start <= date <= until), the schedule swaps
   basketball for recovery: games and game prep go, the game-day snacks
   stay under new names, lifts get an ankle-safe plan, walks become
   optional, PT exercises are added daily, and a recheck sits on the
   until date. An injury is { part, start, until, note, pt: [{ id, time, title }] }. */

const INJURY_LIFT_NOTE = "Ankle-safe legs: leg extension, seated or lying leg curl, hip thrust or glute bridge (brace on), hip abduction/adduction. Single-leg work on the good leg. Upper body as normal. Finish with the arm bike or an upper-body circuit. Ask PT first: leg press (feet high), RDLs. Avoid until cleared: squats, lunges, step-ups, calf raises, jumps, sled, rower, running.";
const INJURY_WALK_TITLE = "Easy walk in brace — skip if sore";
const INJURY_REMOVED = ["game", "pregame-prep"];
const INJURY_TITLES = {
  "pregame-snack": "Late-afternoon snack",
  postgame: "Evening snack",
  "post-lunch": INJURY_WALK_TITLE,
  "post-dinner": INJURY_WALK_TITLE,
};
const INJURY_OPTIONAL = ["post-lunch", "post-dinner"];
const PAIN_WARNING = "Back off leg work and mention it to your PT.";

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function injuryActive(injury, dateStr) {
  return Boolean(injury && injury.start && injury.until && injury.start <= dateStr && dateStr <= injury.until);
}

function injuryItems(items, injury, dateStr) {
  const out = items
    .filter((item) => !INJURY_REMOVED.includes(item.id))
    .map((item) => {
      if (item.id === "lift") return { ...item, note: INJURY_LIFT_NOTE };
      if (!INJURY_TITLES[item.id]) return item;
      const changed = { ...item, title: INJURY_TITLES[item.id] };
      delete changed.note; // "before tip", "note shots" no longer fit
      if (INJURY_OPTIONAL.includes(item.id)) changed.optional = true;
      return changed;
    });
  for (const pt of injury.pt || []) out.push({ id: pt.id, time: pt.time, title: pt.title, kind: "pt" });
  if (dateStr === injury.until) {
    out.push({ id: "injury-recheck", time: "09:00", title: `${capitalize(injury.part)} recheck`, kind: "appointment" });
  }
  return out;
}

/* Day N of M, counting both the start day and the recheck day. */
function injuryDays(injury, dateStr) {
  return { day: daysBetween(injury.start, dateStr) + 1, total: daysBetween(injury.start, injury.until) + 1 };
}

/* Ending keeps the injury (and its start) so past days still read as injured. */
function endInjury(injury, todayStr) {
  return { ...injury, until: shiftDate(todayStr, -1) };
}

/* After a lift: flag pain of 4+, or a 7-day average above the 7 days
   before. `feelLog` already includes the check-in just saved. */
function injuryPainFlag(feelLog, todayStr, pain) {
  if (pain >= 4) return true;
  const avg = (from, to) => {
    const xs = feelLog.filter((r) => typeof r.injuryPain === "number" && r.date >= from && r.date <= to).map((r) => r.injuryPain);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const thisWeek = avg(shiftDate(todayStr, -6), todayStr);
  const lastWeek = avg(shiftDate(todayStr, -13), shiftDate(todayStr, -7));
  return thisWeek !== null && lastWeek !== null && thisWeek > lastWeek;
}
```

Replace `itemsForDate`'s comment and first line:

```js
/* Applies Injury mode (if on that date) and then one day's override
   ({ removed: [id], moved: {id: time}, added: [item] }) on top of that
   weekday's template, and returns the day's items sorted by time.
   Overrides apply last, so Edit day can still move or remove a PT item
   or the recheck. */
function itemsForDate(dateStr, overrides, injury) {
  let base = WEEK_TEMPLATE[parseLocalDate(dateStr).getDay()];
  if (injuryActive(injury, dateStr)) base = injuryItems(base, injury, dateStr);
```

(The rest of the function is unchanged.)

In `dayCompletion`, change the filter to skip optional items, and add a line to its comment:

```js
/* An item is "due" once its time has passed. A day's score is the share
   of due items checked off as done; skips with a reason still count
   against the score, so the number stays honest. Optional items (Injury
   mode walks) never count either way. */
function dayCompletion(items, checkins, dateStr, nowMinutes) {
  const due = items.filter((item) => {
    if (item.optional) return false;
    if (nowMinutes === undefined) return true;
```

Change `completionStreak` to take and pass the injury:

```js
function completionStreak(checkins, overrides, todayStr, nowMinutes, injury) {
```

Its two `itemsForDate(d, overrides)` / `itemsForDate(todayStr, overrides)` calls become `itemsForDate(d, overrides, injury)` and `itemsForDate(todayStr, overrides, injury)`.

Add these to `module.exports`: `INJURY_LIFT_NOTE, INJURY_WALK_TITLE, PAIN_WARNING, capitalize, injuryActive, injuryDays, endInjury, injuryPainFlag`.

- [ ] **Step 4: Add rest-day snack ideas to `food-data.js` `SNACK_PLAN`**

```js
  "snack-am": {
    game: { ... unchanged ... },
    lift: { ... unchanged ... },
    rest: { tip: "Steady energy for the day: protein + fiber.", ideas: ["idea-apple-npb", "idea-cheese-apple", "idea-oikos-berries"] },
  },
  ...
  "pregame-snack": {
    game: { ... unchanged ... },
    rest: { tip: "Something light that holds you to dinner.", ideas: ["idea-carrots-hummus", "idea-almonds-raisins", "idea-oikos-berries"] },
  },
  postgame: {
    game: { ... unchanged ... },
    rest: { tip: "Protein, nothing heavy before bed.", ideas: ["idea-cottage-berries", "idea-cheese-2", "idea-milk-banana"] },
  },
```

(Only add the `rest:` lines; don't retype the existing entries.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python tests/run.py`
Expected: `injury.test.html` all passed. `coach-core.test.html` and `food-core.test.html` still all pass: the snack-plan tests ("every plan entry has a tip and real ideas", "no other ultra-processed food") now also cover the new entries. Exit 0.

- [ ] **Step 6: Commit (ask Sean first)**

No asset change reaches devices without Task 10, but `coach-core.js` and `food-data.js` are cached assets, so bump now: `sw.js` → `weight-tracker-v32`, `version.js` → `APP_VERSION = 32`. Rerun `python tests/run.py` (static checks 4/4).

```bash
git add coach-core.js food-data.js tests/injury.test.html sw.js version.js docs/progress-log-detailed.md
git commit -m "Step 0.5: Injury mode schedule rules (games off, snacks retitled, ankle-safe lift, optional walks, PT, recheck)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Use the injured schedule everywhere

**Files:**
- Modify: `coach.js` (INJURY_KEY, seed, `loadInjury`, `scheduleFor`, callers, Missed rule, streak)
- Modify: `food.js` (lines 200, 264, 474, 614: `itemsForDate(..., loadJSON(OVERRIDES_KEY, {}))` → `scheduleFor(...)`)
- Modify: `quickadd.js:87`, `reminders.js` (`pingRows`)
- Modify: `tests/ui/feel-checkin.js`, `tests/ui/food-flow.js`, `tests/ui/processing.js`, `tests/ui/snack-ideas.js`, `tests/ui/water-pouches.js` (seed `"coach-injury": null`)
- Test: `tests/ui/injury.js` (new, first section)

**Interfaces:**
- Consumes: Task 9's `itemsForDate(dateStr, overrides, injury)`, `completionStreak(..., injury)`, `item.optional`.
- Produces: in coach.js, `INJURY_KEY = "coach-injury"`, `loadInjury() → injury | null` and `scheduleFor(dateStr) → items`. Every later file uses `scheduleFor`, never `itemsForDate` with storage directly.

- [ ] **Step 1: Write the failing UI test `tests/ui/injury.js`**

```js
// Injury mode: schedule on Today, the chip and Injury card, the Train
// banner, the recheck "Cleared?" flow, and pain after lifts.
const ankle = (start, until, pt) => ({ part: "ankle", start, until, note: "Brace on", pt: pt || [] });
const LIFT = "Lift — 45 min";
const WALK = "Easy walk in brace — skip if sore";

// Seeded once on first launch, for Sean's ankle.
await reload({ "coach-started-at": "0" });
const seeded = ls("coach-injury");
eq("seeded", seeded && [seeded.part, seeded.start, seeded.until], ["ankle", "2026-10-21", "2026-12-07"]);

await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-3), day(10)) });
check("no games while injured", !item("League game") && !item("Pre-game prep: shot routine + reset cue"));
check("no game-day pill", $("#day-pill").textContent !== "Game day");
check("old walk title gone", !item("After lunch: water + short walk") && !item("After dinner: water + short walk"));
if (item(LIFT)) check("lift note is the ankle-safe plan", $(".check-note", item(LIFT)).textContent.startsWith("Ankle-safe legs"));
if (item(WALK)) check("walks never show as missed", !item(WALK).classList.contains("missed"));

// Turned off (null), the normal plan is back.
await reload({ "coach-started-at": "0", "coach-injury": null });
check("no walk retitle when off", !item(WALK));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js`
Expected: FAIL "seeded" (got null), and on game/lift days FAIL on the item checks.

- [ ] **Step 3: Storage and the helper in `coach.js`**

After `const COACH_START_KEY = "coach-started-at";`, add `const INJURY_KEY = "coach-injury";`. After the `coachStartedAt` line, add:

```js
/* Sean's ankle (avulsion fracture, 2026-10-21): brace 6 weeks, no
   basketball, lifting OK, recheck Dec 7. Seeded once; after that the
   Injury card owns it, so ending or editing it sticks. */
if (localStorage.getItem(INJURY_KEY) === null) {
  localStorage.setItem(INJURY_KEY, JSON.stringify({
    part: "ankle", start: "2026-10-21", until: "2026-12-07",
    note: "Avulsion fracture. Brace on; no basketball. Lifting OK, PT later.", pt: [],
  }));
}
```

After `saveJSON()`, add:

```js
function loadInjury() {
  return loadJSON(INJURY_KEY, null);
}

/* A day's checklist: the weekly plan, Injury mode, then that day's edits.
   Everything that reads the schedule goes through here. */
function scheduleFor(dateStr) {
  return itemsForDate(dateStr, loadJSON(OVERRIDES_KEY, {}), loadInjury());
}
```

- [ ] **Step 4: Switch every caller**

- `coach.js` `renderToday`: `const items = itemsForDate(dateStr, overrides);` → `const items = scheduleFor(dateStr);` (keep `overrides`, which `renderTodaySummary` still receives).
- `coach.js` `renderTodaySummary`: `completionStreak(checkins, overrides, dateStr, now)` → `completionStreak(checkins, overrides, dateStr, now, loadInjury())`.
- `coach.js` `openChecklistItem`: `itemsForDate(todayLocalDateString(), loadJSON(OVERRIDES_KEY, {}))` → `scheduleFor(todayLocalDateString())`.
- `coach.js` `renderChecklistItem`: the `isMissed` line becomes
  ```js
  const isMissed = !checkin && !item.optional && timeToMinutes(item.time) + MISSED_AFTER_MINUTES <= now && scheduledAt >= coachStartedAt;
  ```
- `food.js` lines 200, 264, 474, 614: `itemsForDate(dateStr, loadJSON(OVERRIDES_KEY, {}))` → `scheduleFor(dateStr)`.
- `quickadd.js:87`: `itemsForDate(today, loadJSON(OVERRIDES_KEY, {}))` → `scheduleFor(today)`.
- `reminders.js` `pingRows`: delete `const overrides = loadJSON(OVERRIDES_KEY, {});`, change the loop to `for (const item of scheduleFor(day)) {`, and change the stop computation to:
  ```js
      // Optional items (Injury mode walks) ping once; no repeats.
      const stop = due < quiet && !item.optional
        ? Math.min(due + REPEAT_WINDOW_MINUTES * 60000, quiet)
        : due + LATE_ITEM_WINDOW_MINUTES * 60000;
  ```
- Check: `grep -n "itemsForDate(" *.js` should list only `coach-core.js` and the one call inside `scheduleFor`.

- [ ] **Step 5: Keep the existing UI scripts testing the normal plan**

The seed makes Injury mode active in every fresh test profile until 2026-12-07. Scripts that test game-day behavior should opt out. In each of `tests/ui/feel-checkin.js`, `tests/ui/food-flow.js`, `tests/ui/processing.js`, `tests/ui/snack-ideas.js` and `tests/ui/water-pouches.js`, add `"coach-injury": null` to **every** `reload({...})` seed object, for example `await reload({ "coach-started-at": "0", "coach-injury": null });`. In `tests/ui/feel-checkin.js`, which reads `item("League game")` before its first reload, insert this as the first line after the header comment:

```js
await reload({ "coach-started-at": "0", "coach-injury": null });
```

- [ ] **Step 6: Run everything**

- `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js`: all PASS.
- All UI scripts (`$(printf -- '--interact %s ' tests/ui/*.js)`; `backup.js` alone with `--budget 120000`): all PASS. If a script outside the five above fails because of a game or lift-day assumption, give it the same `"coach-injury": null` seed. **Don't change app code to satisfy an old test.**
- `python tests/run.py`: exit 0.

- [ ] **Step 7: Commit (ask Sean first)**

```bash
git add coach.js food.js quickadd.js reminders.js tests/ui/*.js docs/progress-log-detailed.md
git commit -m "Step 0.5: seed Sean's ankle injury and use the injured schedule on Today, food, water and pings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Injury chip, Injury card, Runs paused banner

**Files:**
- Create: `injury.js`
- Modify: `coach.js` (`renderTodaySummary` appends the chip), `index.html` (card, banner, script), `style.css` (append), `sw.js` (ASSETS)
- Test: `tests/ui/injury.js` (append)

**Interfaces:**
- Consumes: `INJURY_KEY`, `loadInjury`, `saveJSON`, `el`, `renderToday`, `formatTime12` (coach.js); `injuryActive`, `injuryDays`, `endInjury`, `capitalize`, `parseLocalDate`, `shiftDate` (coach-core.js); `formatDate`, `todayLocalDateString`, `activateTab` (app.js); `showToast`.
- Produces: `injuryChip(dateStr) → HTMLElement | null` (called by coach.js), `renderInjury()`, `openInjuryEditor()`, `shortDate(dateStr)`, and `let recheckExtending` (Task 12).

- [ ] **Step 1: Append the failing tests to `tests/ui/injury.js`**

```js
// Chip, Injury card, PT exercises, Train banner, end now, start a new one.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-3), day(10)) });
const md = (d) => new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
eq("chip", $(".injury-chip").textContent, `🩹 Ankle · day 4 of 14 · recheck ${md(day(10))}`);
click(".injury-chip");
check("chip opens the editor", !$("#injury-form").hidden);
eq("form filled", [$("#injury-part").value, $("#injury-start").value, $("#injury-until").value, $("#injury-note").value], ["ankle", day(-3), day(10), "Brace on"]);

fill("#injury-pt-time", "07:15");
fill("#injury-pt-title", "Ankle alphabet");
click("#injury-pt-add-btn");
eq("PT exercise stored", ls("coach-injury").pt.map((p) => [p.time, p.title]), [["07:15", "Ankle alphabet"]]);
check("PT exercise on today's schedule", Boolean(item("Ankle alphabet")));
click(".pouch-remove", $("#injury-pt-list"));
eq("PT exercise removed", ls("coach-injury").pt, []);

tab("train-panel");
eq("runs paused banner", $("#runs-paused").textContent, `Runs paused: ankle (back after ${md(day(10))} recheck)`);
check("Start de-emphasized, not removed", $("#timer-btn").classList.contains("deemphasized") && !$("#timer-btn").hidden);
tab("today-panel");

fill("#injury-until", day(-5));
$("#injury-form").requestSubmit();
eq("recheck before start refused", $("#injury-form-status").textContent, "The recheck date can't be before the start.");

click("#injury-end-btn");
eq("End now ends it as of yesterday", ls("coach-injury").until, day(-1));
check("chip gone", !$(".injury-chip"));
check("banner gone", $("#runs-paused").hidden);

eq("card offers a new one", $("#injury-edit-btn").textContent, "Start");
click("#injury-edit-btn");
eq("blank form for a new injury", $("#injury-part").value, "");
fill("#injury-part", "Knee");
fill("#injury-start", today);
fill("#injury-until", day(20));
$("#injury-form").requestSubmit();
eq("new injury saved", [ls("coach-injury").part, ls("coach-injury").pt], ["knee", []]);
check("chip back", $(".injury-chip").textContent.startsWith("🩹 Knee · day 1 of 21"));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js`
Expected: ERROR, "Cannot read properties of null" at the chip check.

- [ ] **Step 3: Markup in `index.html`**

In `#today-panel`, after the `#backup-card` section:

```html
      <section class="card area-train" id="injury-card">
        <div class="card-head">
          <h2>Injury mode</h2>
          <button type="button" id="injury-edit-btn" class="pill-btn">Edit</button>
        </div>
        <p class="hint" id="injury-summary"></p>
        <form id="injury-form" class="food-settings" hidden>
          <div class="field-row"><label for="injury-part">Injury</label><input id="injury-part" type="text" placeholder="ankle" autocomplete="off"></div>
          <div class="field-grid">
            <div class="field-row">
              <label for="injury-start">Started</label>
              <div class="date-field">
                <div class="date-display" id="injury-start-display"></div>
                <input id="injury-start" type="date" class="date-input-overlay">
              </div>
            </div>
            <div class="field-row">
              <label for="injury-until">Recheck</label>
              <div class="date-field">
                <div class="date-display" id="injury-until-display"></div>
                <input id="injury-until" type="date" class="date-input-overlay">
              </div>
            </div>
          </div>
          <div class="field-row"><label for="injury-note">Note</label><input id="injury-note" type="text" autocomplete="off"></div>
          <div id="injury-pt">
            <h3 class="sub-head">PT exercises (daily)</h3>
            <ul id="injury-pt-list" class="pouch-times"></ul>
            <div class="pt-add">
              <input id="injury-pt-time" type="time">
              <input id="injury-pt-title" type="text" placeholder="Add a PT exercise" autocomplete="off">
              <button type="button" id="injury-pt-add-btn" class="pill-btn dark">Add</button>
            </div>
          </div>
          <p class="hint" id="injury-form-status"></p>
          <button type="submit" class="primary-btn">Save</button>
          <button type="button" id="injury-end-btn" class="link-btn">End injury mode now</button>
        </form>
      </section>
```

In `#train-panel`'s hero section, as its first child (before `#run-type-toggle`):

```html
        <p class="runs-paused" id="runs-paused" hidden></p>
```

Script: after `<script src="quickadd.js"></script>`, add `<script src="injury.js"></script>` (before `updates.js`). In `sw.js` `ASSETS`, add `"./injury.js",` after `"./quickadd.js",`.

- [ ] **Step 4: Create `injury.js`**

```js
/* Injury mode UI: the Today chip, the Injury card (dates, note, PT
   exercises, end now, start a new one) and the "Runs paused" banner on
   Train. Schedule rules live in coach-core.js; storage (INJURY_KEY,
   loadInjury) in coach.js. */

let injuryEditing = false;
let recheckExtending = false; // the recheck panel's "Not yet" date picker (Task 12)

const injuryForm = document.getElementById("injury-form");
const injuryStart = document.getElementById("injury-start");
const injuryUntil = document.getElementById("injury-until");

function shortDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function injuryLine(injury, dateStr) {
  const { day, total } = injuryDays(injury, dateStr);
  return `${capitalize(injury.part)} · day ${day} of ${total} · recheck ${shortDate(injury.until)}`;
}

/* Called by coach.js renderTodaySummary; null when no injury is on. */
function injuryChip(dateStr) {
  const injury = loadInjury();
  if (!injuryActive(injury, dateStr)) return null;
  const chip = el("button", "hero-chip injury-chip", `🩹 ${injuryLine(injury, dateStr)}`);
  chip.type = "button";
  chip.addEventListener("click", openInjuryEditor);
  return chip;
}

/* The injury being edited: the active or upcoming one. A past one
   means the form starts a new injury instead. */
function currentInjury() {
  const injury = loadInjury();
  return injury && injury.until >= todayLocalDateString() ? injury : null;
}

function setDateField(input, value) {
  input.value = value || "";
  document.getElementById(`${input.id}-display`).textContent = value ? formatDate(value) : "";
}

for (const input of [injuryStart, injuryUntil]) {
  input.addEventListener("change", () => setDateField(input, input.value));
}

function fillInjuryForm() {
  const current = currentInjury();
  document.getElementById("injury-part").value = current ? current.part : "";
  document.getElementById("injury-note").value = current ? current.note || "" : "";
  setDateField(injuryStart, current ? current.start : todayLocalDateString());
  setDateField(injuryUntil, current ? current.until : "");
  document.getElementById("injury-form-status").textContent = "";
}

function openInjuryEditor() {
  activateTab("today-panel");
  injuryEditing = true;
  fillInjuryForm();
  renderInjury();
  document.getElementById("injury-card").scrollIntoView({ block: "start" });
}

function renderPtList(current) {
  document.getElementById("injury-pt").hidden = !current;
  const list = document.getElementById("injury-pt-list");
  list.innerHTML = "";
  for (const pt of (current && current.pt) || []) {
    const row = el("li");
    row.appendChild(el("span", "pouch-time", formatTime12(pt.time)));
    row.appendChild(el("span", "pouch-gap", pt.title));
    const remove = el("button", "pouch-remove", "✕");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${pt.title}`);
    remove.addEventListener("click", () => {
      const injury = loadInjury();
      injury.pt = (injury.pt || []).filter((p) => p.id !== pt.id);
      saveJSON(INJURY_KEY, injury);
      renderInjury();
      renderToday();
    });
    row.appendChild(remove);
    list.appendChild(row);
  }
}

function renderRunsPaused(injury, today) {
  const active = injuryActive(injury, today);
  const banner = document.getElementById("runs-paused");
  banner.hidden = !active;
  banner.textContent = active ? `Runs paused: ${injury.part} (back after ${shortDate(injury.until)} recheck)` : "";
  document.getElementById("timer-btn").classList.toggle("deemphasized", active);
}

function renderInjury() {
  const today = todayLocalDateString();
  const injury = loadInjury();
  const active = injuryActive(injury, today);
  const summary = document.getElementById("injury-summary");
  if (active) {
    summary.textContent = injuryLine(injury, today) + (injury.note ? `. ${injury.note}` : "");
  } else if (injury && injury.start > today) {
    summary.textContent = `Starts ${shortDate(injury.start)}: ${injury.part}.`;
  } else if (injury) {
    summary.textContent = `Off. Last one: ${injury.part}, ${shortDate(injury.start)} – ${shortDate(injury.until)}.`;
  } else {
    summary.textContent = "Off. Turn it on when an injury changes what you can do: games and runs pause, and lifts get a safe plan.";
  }
  document.getElementById("injury-edit-btn").textContent = injuryEditing ? "Cancel" : currentInjury() ? "Edit" : "Start";
  injuryForm.hidden = !injuryEditing;
  document.getElementById("injury-end-btn").hidden = !active;
  renderPtList(currentInjury());
  renderRunsPaused(injury, today);
}

document.getElementById("injury-edit-btn").addEventListener("click", () => {
  if (injuryEditing) {
    injuryEditing = false;
    renderInjury();
  } else {
    openInjuryEditor();
  }
});

document.getElementById("injury-pt-add-btn").addEventListener("click", () => {
  const time = document.getElementById("injury-pt-time").value;
  const titleInput = document.getElementById("injury-pt-title");
  const title = titleInput.value.trim();
  const injury = currentInjury();
  if (!time || !title || !injury) return;
  injury.pt = [...(injury.pt || []), { id: `pt-${Date.now()}`, time, title }];
  saveJSON(INJURY_KEY, injury);
  titleInput.value = "";
  renderInjury();
  renderToday();
});

injuryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const status = document.getElementById("injury-form-status");
  const part = document.getElementById("injury-part").value.trim().toLowerCase();
  const start = injuryStart.value;
  const until = injuryUntil.value;
  if (!part || !start || !until) {
    status.textContent = "Add the injury, a start date and a recheck date.";
    return;
  }
  if (until < start) {
    status.textContent = "The recheck date can't be before the start.";
    return;
  }
  const current = currentInjury();
  saveJSON(INJURY_KEY, { part, start, until, note: document.getElementById("injury-note").value.trim(), pt: current ? current.pt || [] : [] });
  injuryEditing = false;
  renderInjury();
  renderToday();
  showToast(injuryActive(loadInjury(), todayLocalDateString()) ? "Injury mode on" : "Injury saved");
});

document.getElementById("injury-end-btn").addEventListener("click", () => {
  const injury = loadInjury();
  if (!injury) return;
  saveJSON(INJURY_KEY, endInjury(injury, todayLocalDateString()));
  injuryEditing = false;
  renderInjury();
  renderToday();
  showToast("Injury mode off. Games and runs are back on the schedule.");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderInjury();
});

renderInjury();
// coach.js rendered Today before this file loaded; add the chip now.
renderToday();
```

- [ ] **Step 5: Show the chip from `coach.js`**

In `renderTodaySummary`, after the sleep chip line:

```js
  // injury.js loads after this file; the first render happens without it.
  const injuryTag = typeof injuryChip === "function" ? injuryChip(dateStr) : null;
  if (injuryTag) stats.appendChild(injuryTag);
```

- [ ] **Step 6: Append the CSS**

```css
/* ---- Injury mode ---- */

button.hero-chip {
  border: 0;
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.injury-chip {
  background: color-mix(in srgb, var(--train) 16%, transparent);
}

.check-item[data-kind="pt"],
.check-item[data-kind="appointment"] { --kind: var(--train); }

.runs-paused {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--train) 14%, transparent);
  font-size: 14px;
  font-weight: 650;
}

.timer-btn.deemphasized:not(.running) {
  opacity: 0.45;
}

.pt-add {
  display: flex;
  gap: 8px;
  margin: 0 0 12px;
}

.pt-add input[type="text"] {
  flex: 1;
  min-width: 0;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js` (all PASS), then `python tests/run.py` (static checks 4/4, exit 0). Take screenshots of `today-panel` and `train-panel` at `--height 2600`, light and `--dark`, and **read them**. Check that the chip fits on one line or wraps cleanly at 390 px, the form fields don't overflow, and the banner sits above Run/Walk.

- [ ] **Step 8: Commit (ask Sean first)**

```bash
git add injury.js coach.js index.html style.css sw.js tests/ui/injury.js docs/progress-log-detailed.md
git commit -m "Step 0.5: injury chip, Injury card (dates, note, PT, end, start new), runs paused banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Recheck "Cleared?" panel

**Files:**
- Modify: `coach.js` (`recheckOpenFor`, `hasRecheckPanel`, box-click branch, panel render)
- Modify: `injury.js` (append `renderRecheckPanel`), `style.css` (append)
- Test: `tests/ui/injury.js` (append)

**Interfaces:**
- Consumes: `setCheckin` (coach.js), `endInjury`, `shiftDate` (coach-core.js), `shortDate`, `renderInjury`, `recheckExtending` (injury.js).
- Produces: `renderRecheckPanel(dateStr, item) → HTMLElement`; coach.js `let recheckOpenFor`.

- [ ] **Step 1: Append the failing tests to `tests/ui/injury.js`**

```js
// Recheck day: "Cleared?" -> Not yet moves the recheck; Yes ends Injury mode.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-30), today) });
check("recheck on the until day", Boolean(item("Ankle recheck")));
click(".check-box", item("Ankle recheck"));
eq("asks Cleared?", $(".recheck-panel .meal-name", item("Ankle recheck"))?.textContent, "Cleared?");
check("not checked off by the tap", !item("Ankle recheck").classList.contains("done"));
clickText("Not yet", item("Ankle recheck"));
fill($(".recheck-panel input[type=date]", item("Ankle recheck")), day(14));
$(".recheck-panel form", item("Ankle recheck")).requestSubmit();
eq("Not yet moves the recheck", ls("coach-injury").until, day(14));
check("recheck leaves today", !item("Ankle recheck"));
check("still injured", Boolean($(".injury-chip")));

await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-30), today) });
click(".check-box", item("Ankle recheck"));
clickText("Yes", item("Ankle recheck"));
eq("Yes ends it as of yesterday, keeping the start", [ls("coach-injury").start, ls("coach-injury").until], [day(-30), day(-1)]);
check("chip gone after clearing", !$(".injury-chip"));
eq("toast", $("#toast-text").textContent, "Injury mode off. Games and runs are back on the schedule.");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js`
Expected: FAIL "asks Cleared?" (got undefined; the tap checked the item off instead).

- [ ] **Step 3: Hook the panel into `coach.js`**

Next to `let feelOpenFor = null;`, add:

```js
let recheckOpenFor = null; // injury recheck item whose "Cleared?" panel (injury.js) is open
```

After `hasFeelPanel()`, add:

```js
/* The injury recheck asks "Cleared?" instead of a bare checkbox. */
function hasRecheckPanel(item) {
  return item.kind === "appointment" && typeof renderRecheckPanel === "function";
}
```

In the `box` click handler, add this branch right after the `hasMealPanel(item)` branch:

```js
    } else if (hasRecheckPanel(item)) {
      recheckOpenFor = recheckOpenFor === item.id ? null : item.id;
```

After the `feelOpenFor` panel block at the end of `renderChecklistItem`, add:

```js
  if (recheckOpenFor === item.id && !checkin && hasRecheckPanel(item)) {
    li.classList.add("has-panel");
    li.appendChild(renderRecheckPanel(dateStr, item));
  }
```

- [ ] **Step 4: Append `renderRecheckPanel` to `injury.js`**

Put it above the listeners:

```js
/* The recheck item asks "Cleared?". Yes ends Injury mode as of
   yesterday (the injury stays, so past days still read as injured);
   Not yet asks for the next recheck date. */
function renderRecheckPanel(dateStr, item) {
  const panel = el("div", "meal-panel recheck-panel");
  panel.appendChild(el("div", "meal-name", "Cleared?"));
  const actions = el("div", "meal-actions");
  const yes = el("button", "pill-btn dark", "Yes");
  yes.type = "button";
  yes.addEventListener("click", () => {
    saveJSON(INJURY_KEY, endInjury(loadInjury(), dateStr));
    setCheckin(dateStr, item.id, { status: "done", at: Date.now() });
    recheckOpenFor = null;
    recheckExtending = false;
    renderInjury();
    renderToday();
    showToast("Injury mode off. Games and runs are back on the schedule.");
  });
  const notYet = el("button", "pill-btn", "Not yet");
  notYet.type = "button";
  notYet.addEventListener("click", () => {
    recheckExtending = true;
    renderToday();
  });
  actions.append(yes, notYet);
  panel.appendChild(actions);

  if (recheckExtending) {
    const form = el("form", "recheck-form");
    const field = el("div", "date-field");
    const display = el("div", "date-display");
    const input = el("input", "date-input-overlay");
    input.type = "date";
    input.required = true;
    input.min = shiftDate(dateStr, 1);
    input.value = shiftDate(dateStr, 14);
    display.textContent = formatDate(input.value);
    input.addEventListener("change", () => { display.textContent = input.value ? formatDate(input.value) : ""; });
    field.append(display, input);
    const save = el("button", "pill-btn dark", "Save");
    save.type = "submit";
    form.append(el("span", "feel-label", "Next recheck"), field, save);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!input.value || input.value <= dateStr) return;
      saveJSON(INJURY_KEY, { ...loadInjury(), until: input.value });
      recheckOpenFor = null;
      recheckExtending = false;
      renderInjury();
      renderToday();
      showToast(`Next recheck ${shortDate(input.value)}`);
    });
    panel.appendChild(form);
  }
  return panel;
}
```

- [ ] **Step 5: Append the CSS**

```css
.recheck-form {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.recheck-form .date-field {
  flex: 1;
  min-width: 0;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js` (all PASS) and `python tests/run.py` (exit 0). Screenshot the open recheck panel (the script's final state shows it closed, so add a temporary `click(".check-box", item("Ankle recheck")); clickText("Not yet", item("Ankle recheck"));` at the end of a scratch copy in the scratchpad, not in the repo). Read it to confirm the date field fits.

- [ ] **Step 7: Commit (ask Sean first)**

```bash
git add coach.js injury.js style.css tests/ui/injury.js docs/progress-log-detailed.md
git commit -m "Step 0.5: recheck item asks Cleared? (Yes ends Injury mode, Not yet moves the recheck)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Pain question after lifts

**Files:**
- Modify: `food.js` (`feelQuestions`, `renderFeelPanel`), `style.css` (append)
- Test: `tests/ui/injury.js` (append)

**Interfaces:**
- Consumes: `loadInjury` (coach.js), `injuryActive`, `injuryPainFlag`, `capitalize`, `PAIN_WARNING` (coach-core.js).
- Produces: feel-log records gain `injuryPain` (0–10) and `injuryPart` when answered.

- [ ] **Step 1: Append the failing tests to `tests/ui/injury.js`**

```js
// Lift check-in asks about pain while injured and warns at 4+.
const liftDay = async (injury) => {
  await reload({ "coach-started-at": "0", "coach-injury": injury });
  if (!item(LIFT)) {
    await reload({ "coach-started-at": "0", "coach-injury": injury,
      "coach-overrides": { [today]: { removed: [], moved: {}, added: [{ id: "lift", time: "06:00", title: LIFT, kind: "train" }] } } });
  }
};
await liftDay(ankle(day(-3), day(10)));
click(".check-box", item(LIFT));
const labels = $$(".feel-panel .feel-label", item(LIFT)).map((e) => e.textContent);
const painIdx = labels.indexOf("Ankle pain (0–10)");
check("pain question asked", painIdx >= 0, JSON.stringify(labels));
clickText("5", $$(".feel-panel .chip-row", item(LIFT))[painIdx]);
eq("warning at 4+", $(".pain-warning", item(LIFT))?.textContent, "Back off leg work and mention it to your PT.");
check("pain alone enables Save", !$$(".feel-panel button", item(LIFT)).find((b) => b.textContent === "Save").disabled);
clickText("Save", item(LIFT));
const painRec = ls("coach-feel-log").at(-1);
eq("pain saved with the check-in", [painRec.itemId, painRec.injuryPain, painRec.injuryPart], ["lift", 5, "ankle"]);
eq("warning toast", $("#toast-text").textContent, "Back off leg work and mention it to your PT.");

await liftDay(null);
click(".check-box", item(LIFT));
check("no pain question when not injured", !$$(".feel-panel .feel-label", item(LIFT)).some((e) => e.textContent.includes("pain")));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js`
Expected: FAIL "pain question asked", then an ERROR on the chip click.

- [ ] **Step 3: Change `food.js`**

Replace `feelQuestions`:

```js
function feelQuestions(kind, injuredPart) {
  const scale = [1, 2, 3, 4, 5].map((v) => [v, String(v)]);
  const questions = [
    { key: "energy", label: "Energy", options: scale },
    { key: "stomach", label: "Stomach", options: [["full", "Too full"], ["right", "Just right"], ["hungry", "Hungry"]] },
    { key: "legs", label: "Legs / body", options: [["fresh", "Fresh"], ["normal", "Normal"], ["heavy", "Heavy"]] },
    { key: "performance", label: kind === "game" ? "Shooting" : "Weights moved", options: scale },
  ];
  // Injury mode: lifts also track how the injury held up, for Sean's PT.
  if (kind === "lift" && injuredPart) {
    questions.push({ key: "injuryPain", label: `${capitalize(injuredPart)} pain (0–10)`, options: Array.from({ length: 11 }, (_, v) => [v, String(v)]) });
  }
  return questions;
}
```

In `renderFeelPanel`:
- At the top, after the `draft` line:
  ```js
  const injury = loadInjury();
  const injuredPart = injuryActive(injury, dateStr) ? injury.part : null;
  ```
- `for (const q of feelQuestions(item.id)) {` → `for (const q of feelQuestions(item.id, injuredPart)) {`
- After that loop closes:
  ```js
  if (draft.injuryPain >= 4) panel.appendChild(el("div", "pain-warning", PAIN_WARNING));
  ```
- `save.disabled` list → `["energy", "stomach", "legs", "performance", "injuryPain"]`.
- In the save handler, replace the body with:
  ```js
    const log = feelLog();
    const pain = draft.injuryPain;
    log.push({
      id: newId(), date: dateStr, itemId: item.id, kind: item.id, at: Date.now(),
      energy: draft.energy, stomach: draft.stomach, legs: draft.legs, performance: draft.performance,
      injuryPain: pain, injuryPart: pain === undefined ? undefined : injuredPart,
      note: (draft.note || "").trim() || undefined, ate,
    });
    saveJSON(FEEL_LOG_KEY, log);
    delete feelDrafts[item.id];
    feelOpenFor = null;
    refreshFood();
    if (pain !== undefined && injuryPainFlag(log, dateStr, pain)) showToast(PAIN_WARNING);
  ```

- [ ] **Step 4: Append the CSS**

```css
.pain-warning {
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 650;
  color: var(--danger);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js --interact tests/ui/feel-checkin.js` (all PASS; `feel-checkin.js` proves the normal check-in is unchanged), then `python tests/run.py` (exit 0).

- [ ] **Step 6: Commit (ask Sean first)**

```bash
git add food.js style.css tests/ui/injury.js docs/progress-log-detailed.md
git commit -m "Step 0.5: ankle pain (0-10) on lift check-ins with a back-off warning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Ship step 0.5 (v32)

- [ ] **Step 1: Full verification.** Same as Task 8 step 1: `python tests/run.py`, every UI script in light and `--dark`, and screenshots of `today-panel`, `food-panel` and `train-panel` at `--height 2600` in light and dark, **read**. Check `weight-tracker-v32` in sw.js and `APP_VERSION = 32`. Apply superpowers:verification-before-completion and report the real outputs.

- [ ] **Step 2: Progress logs.** Add the summary paragraph ("Step 0.5 shipped: Injury mode …"), and commit it with the detailed-log row (ask Sean).

- [ ] **Step 3: Push (ask Sean first).** `git push`.

- [ ] **Step 4: Phone check with Sean**
  1. Reopen the app (don't reinstall). It should reload by itself and show **"Updated to v32"**. This confirms step 0's update fix on a real deploy.
  2. Today shows "🩹 Ankle · day N of 48 · recheck Dec 7". Tapping it opens the Injury card.
  3. No League game. The 5:30 snack reads "Late-afternoon snack" and the 9:00 PM one "Evening snack". Walks read "Easy walk in brace — skip if sore".
  4. On a lift day, the lift note is the ankle-safe plan, and checking it off asks "Ankle pain (0–10)".
  5. Train shows "Runs paused: ankle (back after Dec 7 recheck)".
  6. The Backup card still says "Last backed up …", so the injury is in the cloud backup too.
  7. Ask Sean about the "Decisions beyond the spec" list if he hasn't confirmed it yet.
- [ ] **Step 5: Hand-off.** Next is step A (swipe-to-close, timestamps, Chick-fil-A items). It gets its own plan via superpowers:writing-plans.
