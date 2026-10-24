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
