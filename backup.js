/* Backup & updates card and automatic cloud backup. The rules (which
   keys, code format, timing) live in backup-core.js; the server side is
   the backups table and its two functions
   (supabase/migrations/20261021000000_backups.sql). Loaded after
   reminders.js, whose Supabase client and anonymous sign-in it reuses. */

const BACKUP_CODE_KEY = "backup-code";
const BACKUP_ON_KEY = "backup-on";
const BACKUP_LAST_KEY = "backup-last";
const RESTORE_DISMISSED_KEY = "backup-restore-dismissed";
/* A change that hasn't gone up yet, kept across launches. The backup- prefix
   keeps it out of backups. */
const BACKUP_DIRTY_KEY = "backup-dirty";
/* Set after an import on a phone with no code, since the reload wipes any message. */
const IMPORT_HINT_KEY = "backup-import-hint";
/* Set when a restore failed and so did its rollback. Kept across launches,
   so a reopened app can't upload the half-written data over the cloud copy. */
const RESTORE_INCOMPLETE_KEY = "backup-restore-incomplete";
const RESTORE_INCOMPLETE = "A restore didn't finish, so backup is paused. Enter your code below or import a backup file before logging anything.";
/* A message from an import that must outlive the reload that follows it. */
const IMPORT_NOTE_KEY = "backup-import-note";
const ROLLBACK_FAILED = "Restore failed and this phone's data may be incomplete. Backup is paused until a restore finishes: enter your code again, or import a backup file.";
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
let restoring = localStorage.getItem(RESTORE_INCOMPLETE_KEY) === "1"; // replacing everything; don't back up the half-written state

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

/* Native setItem on purpose: the flag isn't a backed-up key, but this
   can't re-enter the hook either way. */
function markBackupDirty() {
  backupDirty = true;
  nativeSetItem.call(localStorage, BACKUP_DIRTY_KEY, "1");
}

function noteBackupChange() {
  if (restoring || !backupOn()) return;
  markBackupDirty();
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
    // A change made during the upload keeps the flag.
    if (!backupDirty) nativeRemoveItem.call(localStorage, BACKUP_DIRTY_KEY);
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
  localStorage.removeItem(IMPORT_HINT_KEY);
  markBackupDirty();
  runBackup();
  renderBackupCard();
}

function turnBackupOff() {
  localStorage.removeItem(BACKUP_ON_KEY);
  clearTimeout(backupTimer);
  backupTimer = null;
  backupDirty = false;
  localStorage.removeItem(BACKUP_DIRTY_KEY);
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
  const offNote = localStorage.getItem(IMPORT_HINT_KEY) === "1"
    ? "Imported. Turn backup on, or enter your restore code below so backups continue under it."
    : "Off. Turn on to back up to the cloud automatically and get a restore code.";
  document.getElementById("backup-status").textContent = !on
    ? offNote
    : backupError
      ? `Backup failed: ${backupError}. Will retry.`
      : last
        ? `Last backed up ${formatAgo(last, Date.now())}.`
        : "Backing up…";
  if (localStorage.getItem(RESTORE_INCOMPLETE_KEY) === "1") document.getElementById("backup-status").textContent = RESTORE_INCOMPLETE;
  document.getElementById("backup-code-row").hidden = !on;
  document.getElementById("backup-code-note").hidden = !on;
  document.getElementById("backup-code").textContent = backupCode() || "";
  // Offered on a fresh install only: nothing logged, no code yet, not dismissed.
  document.getElementById("restore-card").hidden =
    hasUserData(localStorage) || Boolean(backupCode()) || localStorage.getItem(RESTORE_DISMISSED_KEY) === "1";
}

/* applyBackup can fail partway (it removes keys, then writes). Snapshot
   first and write it back on failure. Returns null on success, else the
   message to show; when the rollback fails too, restoring stays true and
   the paused state is stored, so nothing gets backed up from the
   half-written state, even after the app is reopened. */
function applyWithRollback(backup) {
  const snapshot = collectBackup(localStorage, Date.now());
  restoring = true;
  try {
    applyBackup(localStorage, backup);
    nativeRemoveItem.call(localStorage, RESTORE_INCOMPLETE_KEY);
    return null;
  } catch (err) {
    try {
      applyBackup(localStorage, snapshot);
    } catch {
      nativeSetItem.call(localStorage, RESTORE_INCOMPLETE_KEY, "1");
      return ROLLBACK_FAILED;
    }
    restoring = localStorage.getItem(RESTORE_INCOMPLETE_KEY) === "1";
    return err.message || String(err);
  }
}

let restoreBusy = false;

/* One restore at a time: a second tap while the first is still looking
   up the code would ask to replace everything twice. */
async function restoreFromCode(input, statusEl) {
  if (restoreBusy) return;
  restoreBusy = true;
  try {
    await lookUpAndRestore(input, statusEl);
  } finally {
    restoreBusy = false;
  }
}

/* Fetches the backup for a typed code and, once confirmed, replaces
   this phone's data with it. Keeps the code (and backup on) so backups
   continue under it, then reloads into the restored data. */
async function lookUpAndRestore(input, statusEl) {
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
  const old = backupCode();
  const replaced = old && old !== code ? ` This phone's current restore code (${old}) will be replaced.` : "";
  if (!confirm(`Replace everything on this phone with the backup from ${when}?${replaced}`)) {
    statusEl.textContent = "Restore cancelled. Nothing changed.";
    return;
  }
  const failure = applyWithRollback(backup);
  if (failure) {
    statusEl.textContent = failure;
    return;
  }
  localStorage.setItem(BACKUP_CODE_KEY, code);
  localStorage.setItem(BACKUP_ON_KEY, "1");
  // The restored data is the cloud copy, so nothing is pending.
  localStorage.removeItem(BACKUP_DIRTY_KEY);
  localStorage.removeItem(IMPORT_HINT_KEY);
  reloadApp();
}

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

/* Reads a backup file, then reloads into it. If this phone already has
   logs and the file has photos, the first offer is photos only, so an
   older export can't overwrite newer logs (and, via backup, the cloud
   copy). Otherwise, once confirmed, it replaces the logs and settings
   and adds the photos. */
async function importBackup(file, statusEl) {
  let parsed;
  const blobs = [];
  try {
    parsed = parseBackupFile(await file.text());
    // Decode every photo first so a corrupt file fails before anything changes.
    for (const p of parsed.photos) blobs.push(await dataUrlToBlob(p.dataUrl));
  } catch (err) {
    statusEl.textContent = parsed ? `Couldn't import the backup: ${err.message || err}` : err.message;
    return;
  }
  const when = parsed.backup.savedAt ? new Date(parsed.backup.savedAt).toLocaleString() : "an unknown date";
  const n = parsed.photos.length;
  if (n && hasUserData(localStorage) && confirm(`Add the file's ${n} photo${n === 1 ? "" : "s"} and keep this phone's logs and settings?`)) {
    try {
      for (let i = 0; i < n; i++) await addPhoto({ id: parsed.photos[i].id, date: parsed.photos[i].date, blob: blobs[i] });
    } catch (err) {
      statusEl.textContent = `Couldn't add the photos: ${err.message || err}`;
      return;
    }
    reloadApp();
    return;
  }
  const photoNote = n ? ` Its ${n} photo${n === 1 ? "" : "s"} will be added to the ones already here.` : "";
  if (!confirm(`Replace your logs and settings on this phone with the backup file from ${when}?${photoNote}`)) {
    statusEl.textContent = "Import cancelled. Nothing changed.";
    return;
  }
  const failure = applyWithRollback(parsed.backup);
  if (failure) {
    statusEl.textContent = `Couldn't import the backup: ${failure}`;
    return;
  }
  // restoring hid the writes from the change hook; with backup on, the cloud copy is now behind.
  if (backupOn()) markBackupDirty();
  else if (!backupCode()) localStorage.setItem(IMPORT_HINT_KEY, "1");
  let failed = 0;
  for (let i = 0; i < n; i++) {
    try {
      await addPhoto({ id: parsed.photos[i].id, date: parsed.photos[i].date, blob: blobs[i] });
    } catch {
      failed++;
    }
  }
  // The reload wipes the status line, so the note waits in storage.
  if (failed) nativeSetItem.call(localStorage, IMPORT_NOTE_KEY, `Logs and settings restored, but ${failed} photo${failed === 1 ? "" : "s"} couldn't be saved.`);
  reloadApp();
}

document.getElementById("backup-toggle").addEventListener("click", () => {
  if (backupOn()) turnBackupOff();
  else turnBackupOn();
});

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

document.getElementById("backup-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(backupCode());
    showToast("Restore code copied. Paste it into Notes.");
  } catch {
    showToast("Couldn't copy. Press and hold the code to copy it.");
  }
});

document.getElementById("backup-export").addEventListener("click", exportBackup);

document.getElementById("backup-import-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const onRestoreCard = !document.getElementById("restore-card").hidden;
  importBackup(file, document.getElementById(onRestoreCard ? "restore-card-status" : "backup-restore-status"));
});

document.addEventListener("visibilitychange", () => {
  // Going to the background is the last sure chance to upload.
  if (document.visibilityState === "hidden" && backupDirty) runBackup();
  if (document.visibilityState === "visible") renderBackupCard();
});
setInterval(renderBackupCard, 60000);

renderBackupCard();
const importNote = localStorage.getItem(IMPORT_NOTE_KEY);
if (importNote) {
  nativeRemoveItem.call(localStorage, IMPORT_NOTE_KEY);
  document.getElementById("backup-restore-status").textContent = importNote;
}
// Changes from the last session may not have gone up before it closed.
// Only a pending change uploads: just opening a copy must not overwrite the cloud one.
if (localStorage.getItem(BACKUP_DIRTY_KEY) === "1") noteBackupChange();
