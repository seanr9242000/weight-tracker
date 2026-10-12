/* Today checklist + Habits (Zyn taper) tabs. Schedule/taper rules live
   in coach-core.js; this file is storage + rendering. Data stays in
   localStorage for now, like weights and runs - a cloud sync for push
   reminders gets layered on later. */

const CHECKINS_KEY = "coach-checkins";
const OVERRIDES_KEY = "coach-overrides";
const HABIT_LOG_KEY = "coach-habit-log";
const TAPER_START_KEY = "coach-taper-start";
const DOCTOR_NOTE_KEY = "coach-doctor-note-dismissed";
const COACH_START_KEY = "coach-started-at";

/* Items scheduled before the coach was first opened never show as
   missed - otherwise the first launch mid-afternoon would greet you
   with a wall of red for things you couldn't have checked off. */
if (!localStorage.getItem(COACH_START_KEY)) {
  localStorage.setItem(COACH_START_KEY, String(Date.now()));
}
const coachStartedAt = Number(localStorage.getItem(COACH_START_KEY));

const MISSED_AFTER_MINUTES = 60;
const COST_PER_CAN = 5.5;
const POUCHES_PER_CAN = 15;

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(time) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pouchesByDate() {
  const counts = {};
  for (const log of loadJSON(HABIT_LOG_KEY, [])) {
    if (log.type === "pouch") counts[log.date] = (counts[log.date] || 0) + 1;
  }
  return counts;
}

/* ---- Today tab ---- */

let editingDay = false;
let weighOpenFor = null;

function setCheckin(dateStr, itemId, value) {
  const checkins = loadJSON(CHECKINS_KEY, {});
  const key = `${dateStr}|${itemId}`;
  if (value) checkins[key] = value;
  else delete checkins[key];
  saveJSON(CHECKINS_KEY, checkins);
}

function updateOverride(dateStr, mutate) {
  const overrides = loadJSON(OVERRIDES_KEY, {});
  const o = overrides[dateStr] || { removed: [], moved: {}, added: [] };
  mutate(o);
  overrides[dateStr] = o;
  saveJSON(OVERRIDES_KEY, overrides);
}

/* A weight entry for today (from either tab) counts as the weigh-in. */
function syncWeighInFromEntries(dateStr) {
  const checkins = loadJSON(CHECKINS_KEY, {});
  const key = `${dateStr}|weigh`;
  if (!checkins[key] && loadEntries().some((e) => e.date === dateStr)) {
    setCheckin(dateStr, "weigh", { status: "done", at: Date.now() });
  }
}

function renderTodaySummary(dateStr, items, checkins, overrides) {
  const now = minutesNow();
  const { due, done, pct } = dayCompletion(items, checkins, dateStr, now);

  document.getElementById("today-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
  document.getElementById("today-sub").textContent =
    due === 0 ? `${items.length} items today` : `${done} of ${due} due items done · ${items.length} total`;
  document.getElementById("today-score").textContent = `${pct}%`;
  document.getElementById("today-progress").style.width = `${pct}%`;

  const stats = document.getElementById("today-stats");
  stats.innerHTML = "";
  const streak = completionStreak(checkins, overrides, dateStr, now);
  const sleep = sleepHours(checkins, dateStr);
  const step = taperStepFor(localStorage.getItem(TAPER_START_KEY), dateStr);
  const pouches = pouchesByDate()[dateStr] || 0;

  const tiles = [
    { label: "Streak", value: `${streak} day${streak === 1 ? "" : "s"}` },
    { label: "Sleep", value: sleep === null ? "--" : `${Math.floor(sleep)}h ${Math.round((sleep % 1) * 60)}m` },
    { label: "Zyn", value: step ? `${pouches} / ${step.allowance}` : `${pouches}` },
  ];
  for (const tile of tiles) {
    const t = el("div", "stat-tile");
    t.appendChild(el("div", "stat-value", tile.value));
    t.appendChild(el("div", "stat-label", tile.label));
    stats.appendChild(t);
  }
}

function renderChecklistItem(dateStr, item, checkin, now) {
  const li = el("li", "check-item");
  const isDue = timeToMinutes(item.time) <= now;
  const scheduledAt = new Date(`${dateStr}T${item.time}`).getTime();
  const isMissed = !checkin && timeToMinutes(item.time) + MISSED_AFTER_MINUTES <= now && scheduledAt >= coachStartedAt;
  if (checkin) li.classList.add(checkin.status);
  else if (isMissed) li.classList.add("missed");
  else if (isDue) li.classList.add("due");

  if (editingDay) {
    const time = el("input", "check-time-input");
    time.type = "time";
    time.value = item.time;
    time.addEventListener("change", () => {
      if (!time.value) return;
      updateOverride(dateStr, (o) => { o.moved[item.id] = time.value; });
      renderToday();
    });
    const title = el("div", "check-title", item.title);
    const remove = el("button", "delete-btn", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => {
      updateOverride(dateStr, (o) => { o.removed.push(item.id); });
      renderToday();
    });
    li.classList.add("editing");
    li.append(time, title, remove);
    return li;
  }

  const box = el("button", "check-box");
  box.type = "button";
  box.setAttribute("aria-label", checkin ? `Undo ${item.title}` : `Mark ${item.title} done`);
  box.addEventListener("click", () => {
    if (checkin) {
      setCheckin(dateStr, item.id, null);
    } else if (item.id === "weigh") {
      weighOpenFor = weighOpenFor === dateStr ? null : dateStr;
    } else {
      setCheckin(dateStr, item.id, { status: "done", at: Date.now() });
    }
    renderToday();
  });

  const body = el("div", "check-body");
  const head = el("div", "check-head");
  head.appendChild(el("span", "check-time", formatTime12(item.time)));
  if (isMissed) head.appendChild(el("span", "check-tag missed-tag", "Missed"));
  if (checkin && checkin.status === "skipped") head.appendChild(el("span", "check-tag", `Skipped · ${checkin.reason}`));
  body.appendChild(head);
  body.appendChild(el("div", "check-title", item.title));
  const note = item.trigger ? TRIGGER_TIPS[item.trigger] : item.note;
  if (note && !checkin) body.appendChild(el("div", "check-note", note));

  if (item.id === "weigh" && weighOpenFor === dateStr && !checkin) {
    const form = el("form", "weigh-inline");
    const input = el("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.step = "0.1";
    input.min = "0";
    input.placeholder = "lbs";
    input.required = true;
    const save = el("button", "pill-btn dark", "Save");
    save.type = "submit";
    form.append(input, save);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const weight = parseFloat(input.value);
      if (!Number.isFinite(weight)) return;
      const entries = loadEntries();
      entries.push({ id: newId(), date: dateStr, weight, unit: "lbs" });
      saveEntries(entries);
      render();
      setCheckin(dateStr, "weigh", { status: "done", at: Date.now() });
      weighOpenFor = null;
      renderToday();
    });
    body.appendChild(form);
    setTimeout(() => input.focus(), 0);
  }

  li.append(box, body);

  if (!checkin) {
    const skip = el("button", isMissed ? "pill-btn danger" : "pill-btn", isMissed ? "Why?" : "Skip");
    skip.type = "button";
    skip.addEventListener("click", () => openReasonSheet(dateStr, item, isMissed));
    li.appendChild(skip);
  }
  return li;
}

function renderToday() {
  const dateStr = todayLocalDateString();
  syncWeighInFromEntries(dateStr);
  const overrides = loadJSON(OVERRIDES_KEY, {});
  const checkins = loadJSON(CHECKINS_KEY, {});
  const items = itemsForDate(dateStr, overrides);
  const now = minutesNow();

  renderTodaySummary(dateStr, items, checkins, overrides);

  const list = document.getElementById("checklist");
  list.innerHTML = "";
  for (const item of items) {
    list.appendChild(renderChecklistItem(dateStr, item, checkins[`${dateStr}|${item.id}`], now));
  }
  document.getElementById("checklist-empty").style.display = items.length ? "none" : "block";

  document.getElementById("edit-day-btn").textContent = editingDay ? "Done" : "Edit day";
  document.getElementById("edit-day-tools").hidden = !editingDay;
}

document.getElementById("edit-day-btn").addEventListener("click", () => {
  editingDay = !editingDay;
  renderToday();
});

document.getElementById("reset-day-btn").addEventListener("click", () => {
  const overrides = loadJSON(OVERRIDES_KEY, {});
  delete overrides[todayLocalDateString()];
  saveJSON(OVERRIDES_KEY, overrides);
  renderToday();
});

document.getElementById("add-item-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const time = document.getElementById("add-item-time").value;
  const titleInput = document.getElementById("add-item-title");
  const title = titleInput.value.trim();
  if (!time || !title) return;
  updateOverride(todayLocalDateString(), (o) => {
    o.added.push({ id: `custom-${Date.now()}`, time, title, kind: "routine" });
  });
  titleInput.value = "";
  renderToday();
});

/* ---- Skip / miss reason sheet ---- */

const reasonSheet = document.getElementById("reason-sheet");

function openReasonSheet(dateStr, item, wasMissed) {
  document.getElementById("reason-sheet-title").textContent = wasMissed
    ? `Missed: ${item.title}`
    : `Skipping: ${item.title}`;
  const options = document.getElementById("reason-options");
  options.innerHTML = "";
  for (const reason of MISS_REASONS) {
    const btn = el("button", "chip", reason);
    btn.type = "button";
    btn.addEventListener("click", () => {
      setCheckin(dateStr, item.id, { status: "skipped", reason, missed: wasMissed, at: Date.now() });
      reasonSheet.hidden = true;
      renderToday();
    });
    options.appendChild(btn);
  }
  reasonSheet.hidden = false;
}

document.getElementById("reason-cancel").addEventListener("click", () => {
  reasonSheet.hidden = true;
});

/* ---- Habits tab: Zyn taper ---- */

let cravingTrigger = null;

function addHabitLog(entry) {
  const logs = loadJSON(HABIT_LOG_KEY, []);
  logs.push({ id: newId(), at: Date.now(), date: todayLocalDateString(), ...entry });
  saveJSON(HABIT_LOG_KEY, logs);
}

function renderTaperPlan(start, today) {
  const table = document.getElementById("taper-plan");
  table.innerHTML = "";
  const current = taperStepFor(start, today);
  for (const step of TAPER_WEEKS) {
    const row = el("li", current && current.week === step.week ? "current" : "");
    const weekStart = start ? formatDate(shiftDate(start, (step.week - 1) * 7)) : "";
    row.appendChild(el("span", "plan-week", `Week ${step.week}`));
    row.appendChild(el("span", "plan-date", weekStart));
    row.appendChild(el("span", "plan-dose", step.allowance === 0 ? "Quit — zero" : `${step.allowance}/day · ${step.mg} mg`));
    table.appendChild(row);
  }
}

function renderHabits() {
  const today = todayLocalDateString();
  const start = localStorage.getItem(TAPER_START_KEY);
  const counts = pouchesByDate();
  const logs = loadJSON(HABIT_LOG_KEY, []);

  document.getElementById("taper-setup").hidden = Boolean(start);
  document.getElementById("taper-today").hidden = !start;
  document.getElementById("doctor-note").hidden = localStorage.getItem(DOCTOR_NOTE_KEY) === "1";
  renderTaperPlan(start, today);

  if (!start) return;

  const step = taperStepFor(start, today);
  const used = counts[today] || 0;
  const headline = document.getElementById("taper-week");
  const counter = document.getElementById("pouch-count");
  const sub = document.getElementById("pouch-sub");

  if (!step) {
    headline.textContent = `Taper starts ${formatDate(start)}`;
    counter.textContent = `${used}`;
    sub.textContent = "Log pouches now to see your baseline.";
  } else if (step.allowance === 0) {
    headline.textContent = `Quit phase · day ${step.dayOfTaper - (TAPER_WEEKS.length - 1) * 7}`;
    counter.textContent = `${used}`;
    sub.textContent = used === 0 ? "Zero today. Keep it there." : "Slip logged. Reset now — the next one is the one that matters.";
  } else {
    headline.textContent = `Week ${step.week} of ${TAPER_WEEKS.length} · ${step.mg} mg`;
    counter.textContent = `${used} / ${step.allowance}`;
    const left = step.allowance - used;
    sub.textContent = left > 0 ? `${left} left today` : left === 0 ? "That's today's limit." : `${-left} over today's limit`;
  }
  counter.classList.toggle("over", Boolean(step) && used > step.allowance);

  const streak = nicotineFreeStreak(start, counts, today);
  const avoided = pouchesAvoided(start, counts, today);
  const resisted = logs.filter((l) => l.type === "craving" && l.resisted).length;
  const saved = (avoided / POUCHES_PER_CAN) * COST_PER_CAN;
  const grid = document.getElementById("habit-stats");
  grid.innerHTML = "";
  for (const tile of [
    { label: "Nicotine-free days", value: `${streak}` },
    { label: "Pouches avoided", value: `${Math.round(avoided)}` },
    { label: "Saved", value: `$${saved.toFixed(0)}` },
    { label: "Cravings resisted", value: `${resisted}` },
  ]) {
    const t = el("div", "stat-tile");
    t.appendChild(el("div", "stat-value", tile.value));
    t.appendChild(el("div", "stat-label", tile.label));
    grid.appendChild(t);
  }

  const week = document.getElementById("pouch-week");
  week.innerHTML = "";
  for (let i = 6; i >= 0; i--) {
    const d = shiftDate(today, -i);
    const s = taperStepFor(start, d);
    const n = counts[d] || 0;
    const row = el("li", s && n > s.allowance ? "over" : "");
    row.appendChild(el("span", "", new Date(d + "T12:00").toLocaleDateString(undefined, { weekday: "short" })));
    const bar = el("span", "pouch-bar");
    const fill = el("span", "pouch-bar-fill");
    fill.style.width = `${Math.min(100, (n / 8) * 100)}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el("span", "pouch-num", s ? `${n}/${s.allowance}` : `${n}`));
    week.appendChild(row);
  }
}

const taperStartInput = document.getElementById("taper-start-input");
taperStartInput.value = nextMonday(todayLocalDateString());
const taperStartDisplay = document.getElementById("taper-start-display");
function syncTaperStartDisplay() {
  taperStartDisplay.textContent = taperStartInput.value ? formatDate(taperStartInput.value) : "";
}
syncTaperStartDisplay();
taperStartInput.addEventListener("change", syncTaperStartDisplay);

document.getElementById("taper-start-btn").addEventListener("click", () => {
  if (!taperStartInput.value) return;
  localStorage.setItem(TAPER_START_KEY, taperStartInput.value);
  renderHabits();
  renderToday();
});

document.getElementById("taper-restart-btn").addEventListener("click", () => {
  localStorage.removeItem(TAPER_START_KEY);
  renderHabits();
  renderToday();
});

document.getElementById("log-pouch-btn").addEventListener("click", () => {
  addHabitLog({ type: "pouch" });
  renderHabits();
  renderToday();
});

document.getElementById("undo-pouch-btn").addEventListener("click", () => {
  const logs = loadJSON(HABIT_LOG_KEY, []);
  const today = todayLocalDateString();
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].type === "pouch" && logs[i].date === today) {
      logs.splice(i, 1);
      break;
    }
  }
  saveJSON(HABIT_LOG_KEY, logs);
  renderHabits();
  renderToday();
});

const triggerChips = document.getElementById("trigger-chips");
for (const trigger of Object.keys(TRIGGER_TIPS)) {
  const chip = el("button", "chip", trigger[0].toUpperCase() + trigger.slice(1));
  chip.type = "button";
  chip.dataset.trigger = trigger;
  chip.addEventListener("click", () => {
    cravingTrigger = trigger;
    for (const c of triggerChips.children) c.classList.toggle("active", c.dataset.trigger === trigger);
    document.getElementById("craving-tip").textContent = TRIGGER_TIPS[trigger];
  });
  triggerChips.appendChild(chip);
}

const urgeInput = document.getElementById("urge-input");
urgeInput.addEventListener("input", () => {
  document.getElementById("urge-value").textContent = urgeInput.value;
});

function logCraving(resisted) {
  const status = document.getElementById("craving-status");
  if (!cravingTrigger) {
    status.textContent = "Pick what triggered it first.";
    return;
  }
  addHabitLog({ type: "craving", trigger: cravingTrigger, urge: Number(urgeInput.value), resisted });
  if (!resisted) addHabitLog({ type: "pouch", trigger: cravingTrigger });
  status.textContent = resisted ? "Logged. That's one rep stronger." : "Logged honestly. That counts too.";
  cravingTrigger = null;
  for (const c of triggerChips.children) c.classList.remove("active");
  document.getElementById("craving-tip").textContent = "";
  renderHabits();
  renderToday();
}

document.getElementById("craving-resisted-btn").addEventListener("click", () => logCraving(true));
document.getElementById("craving-used-btn").addEventListener("click", () => logCraving(false));

document.getElementById("doctor-note-dismiss").addEventListener("click", () => {
  localStorage.setItem(DOCTOR_NOTE_KEY, "1");
  renderHabits();
});

renderToday();
renderHabits();

/* Re-render each minute so items flip to due/missed on time, and when
   the app comes back to the foreground (iOS freezes timers while it's
   backgrounded, and the date may have rolled over). */
setInterval(renderToday, 60000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    renderToday();
    renderHabits();
  }
});
