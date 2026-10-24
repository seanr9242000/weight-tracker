/* Coach core: the daily schedule template, per-day overrides, the Zyn
   taper plan, and the stats math behind the Today and Habits tabs.
   Deliberately free of DOM access so it can be tested on its own and
   reused later by the server-side ping function. */

/* Day templates, keyed by the item list each weekday shares. Times are
   local "HH:MM". Each item's `id` is stable across days so check-ins,
   overrides, and (later) pings can refer to it. Wake times follow the
   real schedule: 6:40 on office days (Tue-Thu), 7:40 on remote days
   (Mon/Fri). Lifts sit on non-game days after work. */

const TRIGGER_TIPS = {
  brushing: "Right after brushing: mint gum or a mint instead of a pouch.",
  meal: "After eating: water and a 5-minute walk before anything else.",
  alcohol: "Drinking: keep gum in your pocket and alternate drinks with water.",
  stress: "Stressed: 10 slow breaths, then decide. Urges peak and pass in ~10 minutes.",
  boredom: "Bored: stand up, refill water, change rooms. Break the loop.",
  other: "Delay 10 minutes. Most urges fade if you wait them out.",
};

const MISS_REASONS = ["Busy", "Forgot", "Low energy", "Craving", "Social", "Other"];

function morning(wake) {
  const [h, m] = wake.split(":").map(Number);
  const at = (mins) => {
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  return [
    { id: "wake", time: wake, title: "Up — no snooze", kind: "sleep" },
    { id: "weigh", time: at(5), title: "Weigh in", kind: "weigh", note: "Bathroom first, before food or water." },
    { id: "brush-am", time: at(15), title: "Brush teeth → gum, not a pouch", kind: "habit", trigger: "brushing" },
    { id: "breakfast", time: at(25), title: "Protein shake", kind: "meal" },
  ];
}

/* Closing the food log marks the day complete, which is what lets it
   count toward the adaptive calorie estimate (see food-core.js). */
const CLOSE_FOOD_LOG = { id: "close-food-log", time: "21:30", title: "Close food log", kind: "food", note: "Anything not logged yet? Add it, then close the day." };

/* Between-meal snacks, so every time Sean is meant to eat there's an
   item (and a ping). Game days already have pre/post-game snacks in
   the evening; lift days get an evening snack after dinner instead. */
const SNACK_AM = { id: "snack-am", time: "10:00", title: "Mid-morning snack", kind: "meal" };
const SNACK_PM = { id: "snack-pm", time: "15:00", title: "Afternoon snack", kind: "meal" };
const SNACK_EVE = { id: "snack-eve", time: "21:00", title: "Evening snack", kind: "meal" };

const EVENING = [
  CLOSE_FOOD_LOG,
  { id: "wind-down", time: "22:15", title: "Wind down — screens away", kind: "sleep" },
  { id: "brush-pm", time: "22:25", title: "Brush teeth → gum, not a pouch", kind: "habit", trigger: "brushing" },
  { id: "lights-out", time: "22:45", title: "Lights out", kind: "sleep" },
];

const GAME_DAY = [
  { id: "lunch", time: "12:00", title: "Lunch — meal prep", kind: "meal" },
  { id: "post-lunch", time: "12:30", title: "After lunch: water + short walk", kind: "habit", trigger: "meal" },
  { id: "pregame-snack", time: "17:30", title: "Pre-game snack", kind: "meal", note: "Banana + yogurt, 1–2 hours before tip." },
  { id: "pregame-prep", time: "18:30", title: "Pre-game prep: shot routine + reset cue", kind: "train", note: "Visualize 5 makes. Same routine every shot." },
  { id: "game", time: "19:00", title: "League game", kind: "game", note: "Set today's tip-off time with Edit day." },
  { id: "postgame", time: "21:00", title: "Post-game snack + reflection", kind: "meal", note: "Protein first. Note shots, mindset, one thing to carry forward." },
];

function liftDay(liftTime, dinnerTime) {
  return [
    { id: "lunch", time: "12:00", title: "Lunch — meal prep", kind: "meal" },
    { id: "post-lunch", time: "12:30", title: "After lunch: water + short walk", kind: "habit", trigger: "meal" },
    { id: "lift", time: liftTime, title: "Lift — 45 min", kind: "train", note: "Community center. Full body + conditioning finisher." },
    { id: "post-lift", time: addMinutes(liftTime, 50), title: "Recovery snack (not chocolate milk)", kind: "meal", note: "Protein shake + banana." },
    { id: "dinner", time: dinnerTime, title: "Dinner — eggs, shake, yogurt", kind: "meal" },
    { id: "post-dinner", time: addMinutes(dinnerTime, 20), title: "After dinner: water + short walk", kind: "habit", trigger: "meal" },
    SNACK_EVE,
  ];
}

/* Index = Date#getDay() (0 = Sunday). */
const WEEK_TEMPLATE = [
  // Sunday: meal prep + weekly check-in
  [
    { id: "wake", time: "08:30", title: "Up", kind: "sleep" },
    { id: "weigh", time: "08:35", title: "Weigh in", kind: "weigh", note: "Bathroom first, before food or water." },
    { id: "brush-am", time: "08:45", title: "Brush teeth → gum, not a pouch", kind: "habit", trigger: "brushing" },
    { id: "breakfast", time: "09:00", title: "Protein shake", kind: "meal" },
    { id: "waist", time: "09:05", title: "Weekly waist measurement", kind: "weigh" },
    { id: "lunch", time: "12:30", title: "Lunch", kind: "meal" },
    { id: "meal-prep", time: "14:00", title: "Meal prep: chicken, strawberries, veg × 4", kind: "meal" },
    { ...SNACK_PM, time: "15:30" },
    { id: "dinner", time: "18:30", title: "Dinner", kind: "meal" },
    { id: "plan-week", time: "20:00", title: "Plan the week: game times + lift days", kind: "routine" },
    ...EVENING,
  ],
  // Monday: remote, league game
  [...morning("07:40"), ...GAME_DAY, SNACK_AM, SNACK_PM, ...EVENING],
  // Tuesday: office, league game
  [...morning("06:40"), ...GAME_DAY, SNACK_AM, SNACK_PM, ...EVENING],
  // Wednesday: office, lift
  [...morning("06:40"), ...liftDay("17:45", "19:15"), SNACK_AM, SNACK_PM, ...EVENING],
  // Thursday: office, league game
  [...morning("06:40"), ...GAME_DAY, SNACK_AM, SNACK_PM, ...EVENING],
  // Friday: remote, lift
  [...morning("07:40"), ...liftDay("17:15", "18:45"), SNACK_AM, SNACK_PM, ...EVENING],
  // Saturday: lift, treat meal, drinking pre-plan. No lights-out target.
  [
    { id: "wake", time: "09:00", title: "Up", kind: "sleep" },
    { id: "weigh", time: "09:05", title: "Weigh in", kind: "weigh", note: "Bathroom first, before food or water." },
    { id: "brush-am", time: "09:15", title: "Brush teeth → gum, not a pouch", kind: "habit", trigger: "brushing" },
    { id: "breakfast", time: "09:30", title: "Protein shake", kind: "meal" },
    { id: "lift", time: "10:30", title: "Lift — 45 min", kind: "train", note: "Full body + conditioning finisher." },
    { id: "post-lift", time: "11:20", title: "Recovery snack (not chocolate milk)", kind: "meal", note: "Protein shake + banana." },
    { id: "lunch", time: "13:00", title: "Lunch", kind: "meal" },
    { id: "treat-meal", time: "18:00", title: "Planned treat meal — enjoy it, log it", kind: "meal" },
    { id: "drink-plan", time: "18:00", title: "Tonight's plan: gum in pocket, water between drinks", kind: "habit", trigger: "alcohol" },
    CLOSE_FOOD_LOG,
  ],
];

function addMinutes(time, mins) {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + mins + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDate(dateStr, days) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function daysBetween(fromStr, toStr) {
  return Math.round((parseLocalDate(toStr) - parseLocalDate(fromStr)) / 86400000);
}

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
      delete changed.trigger; // else "After eating: ..." shows under the retitled walk
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

/* Applies Injury mode (if on that date) and then one day's override
   ({ removed: [id], moved: {id: time}, added: [item] }) on top of that
   weekday's template, and returns the day's items sorted by time.
   Overrides apply last, so Edit day can still move or remove a PT item
   or the recheck. */
function itemsForDate(dateStr, overrides, injury) {
  let base = WEEK_TEMPLATE[parseLocalDate(dateStr).getDay()];
  if (injuryActive(injury, dateStr)) base = injuryItems(base, injury, dateStr);
  const o = (overrides && overrides[dateStr]) || {};
  const removed = new Set(o.removed || []);
  const moved = o.moved || {};
  const items = base
    .filter((item) => !removed.has(item.id))
    .map((item) => (moved[item.id] ? { ...item, time: moved[item.id] } : { ...item }));
  for (const extra of o.added || []) {
    if (!removed.has(extra.id)) items.push({ ...extra, time: moved[extra.id] || extra.time });
  }
  return items.sort((a, b) => a.time.localeCompare(b.time));
}

/* ---- Zyn taper ---- */

const TAPER_WEEKS = [
  { week: 1, allowance: 6, mg: 6 },
  { week: 2, allowance: 4, mg: 6 },
  { week: 3, allowance: 6, mg: 3 },
  { week: 4, allowance: 4, mg: 3 },
  { week: 5, allowance: 2, mg: 3 },
  { week: 6, allowance: 0, mg: 0 },
];

const BASELINE_POUCHES_PER_DAY = 7.5;

/* Next Monday on or after the given date (the taper starts on a Monday
   so each week lines up with a calendar week). */
function nextMonday(dateStr) {
  const d = parseLocalDate(dateStr);
  const offset = (8 - d.getDay()) % 7;
  d.setDate(d.getDate() + offset);
  return toDateString(d);
}

/* Returns the taper step for a date, or null before the start date.
   Everything from week 6 on is the quit phase: allowance 0. */
function taperStepFor(startStr, dateStr) {
  if (!startStr) return null;
  const day = daysBetween(startStr, dateStr);
  if (day < 0) return null;
  const index = Math.min(Math.floor(day / 7), TAPER_WEEKS.length - 1);
  return { ...TAPER_WEEKS[index], dayOfTaper: day + 1 };
}

function quitDate(startStr) {
  return shiftDate(startStr, (TAPER_WEEKS.length - 1) * 7);
}

/* Consecutive pouch-free days counted back from `todayStr`, starting
   no earlier than the quit date. Today counts if nothing's logged yet,
   since the day isn't a slip until a pouch is logged. */
function nicotineFreeStreak(startStr, pouchesByDate, todayStr) {
  if (!startStr) return 0;
  const quit = quitDate(startStr);
  let streak = 0;
  let d = todayStr;
  while (d >= quit && !(pouchesByDate[d] > 0)) {
    streak++;
    d = shiftDate(d, -1);
  }
  return streak;
}

function pouchesAvoided(startStr, pouchesByDate, todayStr) {
  if (!startStr || todayStr < startStr) return 0;
  let total = 0;
  for (let d = startStr; d <= todayStr; d = shiftDate(d, 1)) {
    total += Math.max(0, BASELINE_POUCHES_PER_DAY - (pouchesByDate[d] || 0));
  }
  return total;
}

/* One day's pouches in time order, each with the minutes since the
   pouch before it (any day, so the first one of the morning shows the
   overnight stretch; null for the first pouch ever logged). */
function pouchTimeline(logs, dateStr) {
  const pouches = logs.filter((l) => l.type === "pouch").sort((a, b) => a.at - b.at);
  const day = [];
  pouches.forEach((p, i) => {
    if (p.date !== dateStr) return;
    day.push({ id: p.id, at: p.at, gapMin: i ? Math.round((p.at - pouches[i - 1].at) / 60000) : null });
  });
  return day;
}

function lastPouchAt(logs) {
  const times = logs.filter((l) => l.type === "pouch").map((l) => l.at);
  return times.length ? Math.max(...times) : null;
}

/* 45 -> "45m", 100 -> "1h 40m", 1500 -> "1d 1h". */
function formatGap(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return minutes % 60 ? `${h}h ${minutes % 60}m` : `${h}h`;
}

/* ---- Check-in stats ---- */

/* An item is "due" once its time has passed. A day's score is the share
   of due items checked off as done; skips with a reason still count
   against the score, so the number stays honest. Optional items (Injury
   mode walks) never count either way. */
function dayCompletion(items, checkins, dateStr, nowMinutes) {
  const due = items.filter((item) => {
    if (item.optional) return false;
    if (nowMinutes === undefined) return true;
    const [h, m] = item.time.split(":").map(Number);
    return h * 60 + m <= nowMinutes;
  });
  const done = due.filter((item) => {
    const c = checkins[`${dateStr}|${item.id}`];
    return c && c.status === "done";
  }).length;
  return { due: due.length, done, pct: due.length ? Math.round((done / due.length) * 100) : 0 };
}

/* Consecutive past days (ending yesterday) where at least 80% of the
   day's items were done, plus today if today has already reached 80%.
   Days before the first-ever check-in don't break or extend it. */
function completionStreak(checkins, overrides, todayStr, nowMinutes, injury) {
  const STREAK_PCT = 80;
  const dates = Object.keys(checkins).map((k) => k.split("|")[0]).sort();
  if (dates.length === 0) return 0;
  const first = dates[0];
  let streak = 0;
  let d = shiftDate(todayStr, -1);
  while (d >= first) {
    if (dayCompletion(itemsForDate(d, overrides, injury), checkins, d).pct < STREAK_PCT) break;
    streak++;
    d = shiftDate(d, -1);
  }
  const today = dayCompletion(itemsForDate(todayStr, overrides, injury), checkins, todayStr, nowMinutes);
  if (today.due > 0 && today.pct >= STREAK_PCT) streak++;
  return streak;
}

/* Hours between last night's lights-out check-in and this morning's
   wake check-in, or null if either is missing. */
function sleepHours(checkins, todayStr) {
  const out = checkins[`${shiftDate(todayStr, -1)}|lights-out`];
  const up = checkins[`${todayStr}|wake`];
  if (!out || !up || out.status !== "done" || up.status !== "done") return null;
  const hours = (up.at - out.at) / 3600000;
  return hours > 0 && hours < 16 ? hours : null;
}

if (typeof module !== "undefined") {
  module.exports = {
    WEEK_TEMPLATE, TAPER_WEEKS, TRIGGER_TIPS, MISS_REASONS,
    addMinutes, shiftDate, daysBetween, itemsForDate, nextMonday, taperStepFor,
    quitDate, nicotineFreeStreak, pouchesAvoided, pouchTimeline, lastPouchAt, formatGap, dayCompletion, completionStreak, sleepHours,
    INJURY_LIFT_NOTE, INJURY_WALK_TITLE, PAIN_WARNING, capitalize, injuryActive, injuryDays, endInjury, injuryPainFlag,
  };
}
