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
