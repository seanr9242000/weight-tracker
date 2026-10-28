/* Backup core: which localStorage keys are Sean's data, the backup and
   backup-file shapes, restore codes, and backup timing. Storage is
   passed in (anything shaped like localStorage) so this stays DOM-free
   and testable. backup.js is the UI and the Supabase calls. */

const BACKUP_APP = "weight-and-save";
const BACKUP_FORMAT = 1;
const BACKUP_PREFIXES = ["weight-tracker-", "coach-", "food-", "ui-", "savings-", "lift-"];
const BACKUP_EXACT = ["water-log"];
/* Device-specific: reminders belong to this phone's push subscription;
   the open tab, a run in progress and the Progress segment are screen
   state. Supabase's sb-* auth keys and backup-* keys never match. */
const BACKUP_EXCLUDED = ["coach-reminders-on", "weight-tracker-active-tab", "weight-tracker-active-run", "weight-tracker-progress-seg"];
/* Things a person logged. Seeded libraries and settings don't count,
   so a fresh install still offers Restore. */
const USER_DATA_KEYS = ["weight-tracker-entries", "weight-tracker-runs", "coach-checkins", "coach-habit-log", "food-log", "water-log", "lift-sessions"];
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

/* 30 s after a change, but no sooner than a minute after the last backup.
   A last-backup time in the future (the clock was set back) counts as now. */
function backupDelay(now, lastBackupAt) {
  return Math.max(30000, Math.min(lastBackupAt || 0, now) + 60000 - now);
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

/* A backup file is a backup plus progress photos as data URLs. Only the
   photo types the app makes (JPEG; PNG and WebP to be safe) are kept, so
   nothing else reaches IndexedDB. */
function parseBackupFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_BACKUP_FILE);
  }
  if (!validBackup(data)) throw new Error(NOT_A_BACKUP_FILE);
  const photos = Array.isArray(data.photos)
    ? data.photos.filter((p) => p && typeof p.id === "string" && typeof p.date === "string" && typeof p.dataUrl === "string" && /^data:image\/(jpeg|png|webp);/.test(p.dataUrl))
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
