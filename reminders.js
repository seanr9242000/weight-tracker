/* Push reminders. The app owns the schedule, so whenever the Today data
   changes it writes the next week of checklist items (with done/skipped
   status) to Supabase; a cron-run Edge Function (supabase/functions/
   send-pings) sends the pushes. Sign-in is anonymous - one hidden
   account per installed app - which is enough to keep the rows private.
   localStorage stays the source of truth; Supabase only holds what the
   pinger needs. */

const SUPABASE_URL = "https://inewcgtwhuwjmiyxlrvy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5zmI6PZrXlkeHWNQYVXsrA_ckZfw2Og";
const VAPID_PUBLIC_KEY = "BGqrXbBSxMYYuNmuBtyxh4O_f56dXpt-68xJMFPSDSaJ7F6Ew4TdXKHGD9buVBUfJbpe51ASa0I8QMPzkvwJlzg";

const REMINDERS_KEY = "coach-reminders-on";
const SYNC_DAYS = 7;
/* Repeats run for an hour - the same point an item shows as Missed. */
const REPEAT_WINDOW_MINUTES = MISSED_AFTER_MINUTES;
/* No repeats after lights-out; an item scheduled later still gets one ping. */
const QUIET_START = "22:45";
const LATE_ITEM_WINDOW_MINUTES = 5;

const remindersDb = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
let lastSyncedRows = null;
let syncTimer = null;

function remindersOn() {
  return localStorage.getItem(REMINDERS_KEY) === "1";
}

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function ensureSession() {
  const { data } = await remindersDb.auth.getSession();
  if (data.session) return;
  const { error } = await remindersDb.auth.signInAnonymously();
  if (error) throw error;
}

/* One row per checklist item for the next SYNC_DAYS days. Times are
   turned into absolute instants here, in the phone's timezone, so the
   server never has to know it. */
function pingRows(fromStr) {
  const overrides = loadJSON(OVERRIDES_KEY, {});
  const checkins = loadJSON(CHECKINS_KEY, {});
  const rows = [];
  for (let i = 0; i < SYNC_DAYS; i++) {
    const day = shiftDate(fromStr, i);
    const quiet = new Date(`${day}T${QUIET_START}`).getTime();
    for (const item of itemsForDate(day, overrides)) {
      const due = new Date(`${day}T${item.time}`).getTime();
      const stop = due < quiet
        ? Math.min(due + REPEAT_WINDOW_MINUTES * 60000, quiet)
        : due + LATE_ITEM_WINDOW_MINUTES * 60000;
      const checkin = checkins[`${day}|${item.id}`];
      rows.push({
        day,
        item_id: item.id,
        title: item.title,
        body: (item.trigger ? TRIGGER_TIPS[item.trigger] : item.note) || null,
        due_at: new Date(due).toISOString(),
        stop_at: new Date(stop).toISOString(),
        status: checkin ? checkin.status : "pending",
      });
    }
  }
  return rows;
}

async function syncPings() {
  if (!remindersDb || !remindersOn()) return;
  const from = todayLocalDateString();
  const rows = pingRows(from);
  const signature = JSON.stringify(rows);
  if (signature === lastSyncedRows) return;
  try {
    await ensureSession();
    const { error } = await remindersDb.rpc("sync_ping_queue", {
      p_from: from,
      p_to: shiftDate(from, SYNC_DAYS - 1),
      p_rows: rows,
    });
    if (error) throw error;
    lastSyncedRows = signature;
  } catch (err) {
    console.warn("Reminder sync failed", err);
  }
}

/* Called by renderToday (coach.js) after any checklist change; debounced
   so a burst of taps is one sync. Unchanged data is skipped in syncPings. */
function schedulePingSync() {
  if (!remindersOn()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncPings, 1500);
}

async function saveSubscription(subscription) {
  const { endpoint, keys } = subscription.toJSON();
  const { error } = await remindersDb.rpc("save_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
  });
  if (error) throw error;
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function enableReminders() {
  setReminderStatus("Turning on…");
  try {
    // Must be the first await: iOS only shows the prompt inside the tap.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setReminderStatus("Notifications are blocked. Allow them in Settings → Notifications → Weight & Save, then try again.");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const subscription =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));
    await ensureSession();
    await saveSubscription(subscription);
    localStorage.setItem(REMINDERS_KEY, "1");
    lastSyncedRows = null;
    await syncPings();
    renderReminders();
  } catch (err) {
    console.warn("Enabling reminders failed", err);
    setReminderStatus(`Couldn't turn reminders on: ${err.message || err}`);
  }
}

async function disableReminders() {
  try {
    const subscription = await currentSubscription();
    if (subscription) {
      await remindersDb.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.warn("Turning reminders off failed", err);
  }
  localStorage.removeItem(REMINDERS_KEY);
  renderReminders();
}

async function sendTestPing() {
  setReminderStatus("Sending a test…");
  try {
    await ensureSession();
    const now = Date.now();
    const { error } = await remindersDb.from("ping_queue").insert({
      day: todayLocalDateString(),
      item_id: `test-${now}`,
      title: "Test ping",
      body: "Reminders are working.",
      due_at: new Date(now).toISOString(),
      stop_at: new Date(now + 5 * 60000).toISOString(),
    });
    if (error) throw error;
    setReminderStatus("Test queued. It should arrive within a minute - lock your phone to see it.");
  } catch (err) {
    setReminderStatus(`Test failed: ${err.message || err}`);
  }
}

function setReminderStatus(text) {
  document.getElementById("reminders-status").textContent = text;
}

function renderReminders() {
  const toggle = document.getElementById("reminders-btn");
  const test = document.getElementById("reminders-test-btn");
  const on = remindersOn();
  toggle.hidden = !pushSupported || !remindersDb;
  toggle.textContent = on ? "Turn off" : "Turn on";
  toggle.classList.toggle("dark", !on);
  test.hidden = !on;

  if (!remindersDb) {
    setReminderStatus("Reminders need a connection. Reopen the app when you're online.");
  } else if (!pushSupported) {
    setReminderStatus("To get reminders on iPhone, open this site in Safari, tap Share → Add to Home Screen, then turn them on from the installed app.");
  } else if (on && Notification.permission !== "granted") {
    setReminderStatus("Notifications were turned off in Settings. Allow them again, or turn reminders off here.");
  } else if (on) {
    setReminderStatus("On. Each item pings at its time and repeats every 15 min for up to an hour until you check it off or skip it. Nothing after 10:45 PM.");
  } else {
    setReminderStatus("Get a push for each item at its time, repeating until you check it off.");
  }
}

document.getElementById("reminders-btn").addEventListener("click", () => {
  if (remindersOn()) disableReminders();
  else enableReminders();
});
document.getElementById("reminders-test-btn").addEventListener("click", sendTestPing);

renderReminders();

/* Re-save the subscription on launch (push services can rotate the
   endpoint), then push the current week. */
if (remindersOn() && remindersDb && pushSupported) {
  (async () => {
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await ensureSession();
        await saveSubscription(subscription);
      }
    } catch (err) {
      console.warn("Refreshing push subscription failed", err);
    }
    syncPings();
  })();
}
