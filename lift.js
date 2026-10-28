/* Workout mode (step T): a full-screen view for the day's lifts. The
   workout in progress lives in lift-active and is saved after every
   change, so a reload, an update or iOS closing the app reopens it with
   every set intact. Plan, progression and rest math live in
   lift-core.js; coach.js adds the Start button via liftStartButton(). */

const LIFT_PLAN_KEY = "lift-plan";
const LIFT_SESSIONS_KEY = "lift-sessions";
const LIFT_ACTIVE_KEY = "lift-active";

const workoutEl = document.getElementById("workout");
const workoutBody = document.getElementById("workout-body");
const workoutFinish = document.getElementById("workout-finish");
const workoutDaySelect = document.getElementById("workout-day");
let swapOpenFor = null; // exercise index whose swap list is open
let workoutTicker = null;
let wakeLock = null;
let audioCtx = null;
let restDoneAt = null; // when the current rest hit 0 (for the 3 s flash)

const loadSessions = () => loadJSON(LIFT_SESSIONS_KEY, []);
const loadActive = () => loadJSON(LIFT_ACTIVE_KEY, null);
const saveActive = (active) => saveJSON(LIFT_ACTIVE_KEY, active);
const currentPlan = () => liftPlan(loadJSON(LIFT_PLAN_KEY, null));

function actionBtn(label, onClick, cls = "pill-btn") {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/* For the "how did it go?" record (food.js): that day's latest session. */
function liftSessionId(dateStr) {
  const s = loadSessions().filter((x) => x.date === dateStr).at(-1);
  return s ? s.id : undefined;
}

/* The Today lift item's button (coach.js). */
function liftStartButton(dateStr) {
  const day = liftDayFor(currentPlan(), dateStr, loadSessions());
  return actionBtn(loadActive() ? "Resume workout" : `Start workout · ${liftDayName(day)}`, () => startWorkout(dateStr), "pill-btn dark lift-start-btn");
}

function startWorkout(dateStr) {
  if (!loadActive()) {
    const plan = currentPlan();
    const day = liftDayFor(plan, dateStr, loadSessions());
    if (!plan.days[day].length) {
      showToast(`${liftDayName(day)} has no exercises. Add some in Edit plan.`);
      return;
    }
    saveActive(newWorkout(plan, day, dateStr, loadSessions(), Date.now()));
  }
  openWorkout();
}

/* Screen Wake Lock is best-effort: home-screen apps on some iOS
   versions ignore it, and it's released whenever the app is hidden. */
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

function openWorkout() {
  swapOpenFor = null;
  workoutFinish.hidden = true;
  workoutEl.hidden = false;
  document.body.classList.add("workout-open");
  renderWorkout();
  if (!workoutTicker) workoutTicker = setInterval(tickWorkout, 1000);
  tickWorkout();
  keepAwake(true);
  renderLifts();
}

function minimizeWorkout() {
  workoutEl.hidden = true;
  document.body.classList.remove("workout-open");
  keepAwake(false);
  tickWorkout();
  renderToday();
  renderLifts();
}

/* Finish and Discard both end here: nothing in progress any more. */
function closeWorkout() {
  saveActive(null);
  workoutEl.hidden = true;
  document.body.classList.remove("workout-open");
  clearInterval(workoutTicker);
  workoutTicker = null;
  keepAwake(false);
  document.getElementById("rest-bar").hidden = true;
  restDoneAt = null;
  renderWorkoutBar("");
}

function renderWorkoutBar(elapsed) {
  const bar = document.getElementById("workout-bar");
  bar.hidden = !loadActive() || !workoutEl.hidden;
  bar.textContent = bar.hidden ? "" : `Workout in progress · ${elapsed}`;
}

function tickWorkout() {
  const active = loadActive();
  if (!active) return;
  const elapsed = formatDuration(Math.max(0, Math.floor((Date.now() - active.start) / 1000)));
  document.getElementById("workout-clock").textContent = elapsed;
  renderWorkoutBar(elapsed);
  tickRest(active);
}

function updateActive(mutate) {
  const a = loadActive();
  if (!a) return;
  mutate(a);
  saveActive(a);
  renderWorkout();
}

function targetLine(e, type) {
  if (type === "timed") return `${e.repMin} min`;
  const reps = e.repMin === e.repMax ? `${e.repMin}` : `${e.repMin}–${e.repMax}`;
  return `${e.sets} × ${reps}${e.rest ? ` · rest ${formatDuration(e.rest)}` : ""}`;
}

function renderWorkout() {
  const active = loadActive();
  if (!active) return;
  const anyDone = active.exercises.some((e) => e.log.some((s) => s.done));
  workoutDaySelect.innerHTML = "";
  for (const day of LIFT_DAY_ORDER) {
    const opt = el("option", null, liftDayName(day));
    opt.value = day;
    opt.selected = day === active.day;
    workoutDaySelect.appendChild(opt);
  }
  workoutDaySelect.disabled = anyDone;
  const note = document.getElementById("workout-note");
  const ankle = LIFT_DAYS[active.day].lower && Boolean(injuryOn(loadInjuries(), active.date));
  note.hidden = !ankle;
  note.textContent = ankle ? INJURY_LIFT_AVOID : "";
  workoutBody.innerHTML = "";
  active.exercises.forEach((e, i) => workoutBody.appendChild(renderExercise(e, i)));
}

function renderExercise(e, i) {
  const type = LIFT_EXERCISES[e.exId].type;
  const card = el("section", `workout-ex${e.skipped ? " skipped" : ""}`);
  const head = el("div", "workout-ex-head");
  head.append(el("div", "workout-ex-name", exerciseName(e.exId)), el("div", "workout-ex-target", targetLine(e, type)));
  card.appendChild(head);
  card.appendChild(el("div", "workout-ex-last", e.last ? `Last: ${formatSets(type, e.last.sets)}` : e.suggestion.text || "First time."));
  if (e.last && e.suggestion.text) card.appendChild(el("div", `workout-ex-suggest ${e.suggestion.kind}`, e.suggestion.text));
  if (!e.skipped) e.log.forEach((set, j) => card.appendChild(renderSetRow(i, set, j, type)));

  const started = e.log.some((s) => s.done);
  const actions = el("div", "workout-ex-actions");
  if (!started && !e.skipped && swapOptions(e).length) {
    actions.appendChild(actionBtn("Swap", () => {
      swapOpenFor = swapOpenFor === i ? null : i;
      renderWorkout();
    }));
  }
  /* Like Swap, Skip goes once a set is logged: it would hide those sets. */
  if (!started || e.skipped) actions.appendChild(actionBtn(e.skipped ? "Unskip" : "Skip", () => updateActive((a) => { a.exercises[i].skipped = !a.exercises[i].skipped; })));
  card.appendChild(actions);

  if (swapOpenFor === i && !started && !e.skipped) {
    const row = el("div", "chip-row workout-swaps");
    for (const id of swapOptions(e)) {
      row.appendChild(actionBtn(exerciseName(id), () => {
        swapOpenFor = null;
        saveActive(swapExercise(loadActive(), i, id, loadSessions()));
        renderWorkout();
      }, "chip small"));
    }
    card.appendChild(row);
  }
  return card;
}

function renderSetRow(i, set, j, type) {
  const row = el("div", `set-row${set.done ? " done" : ""}`);
  row.appendChild(el("span", "set-num", String(j + 1)));
  const field = (cls, key, placeholder, mode) => {
    const input = el("input", cls);
    input.type = "number";
    input.inputMode = mode;
    input.min = "0";
    input.placeholder = placeholder;
    input.value = set[key] ?? "";
    input.disabled = set.done;
    /* Saved as typed, without a re-render (so focus stays), so a reload keeps it. */
    input.addEventListener("input", () => {
      const a = loadActive();
      if (!a) return;
      const n = parseFloat(input.value);
      a.exercises[i].log[j][key] = Number.isFinite(n) ? n : null;
      saveActive(a);
    });
    return input;
  };
  if (type === "timed") {
    row.append(field("set-min", "min", "min", "decimal"), el("span", "set-x", "min"));
  } else {
    if (type === "weighted") row.append(field("set-w", "w", "lb", "decimal"), el("span", "set-x", "×"));
    row.appendChild(field("set-reps", "reps", "reps", "numeric"));
  }
  const check = actionBtn("✓", () => toggleSet(i, j), "set-check");
  check.setAttribute("aria-label", set.done ? `Undo set ${j + 1}` : `Log set ${j + 1}`);
  row.appendChild(check);
  return row;
}

function toggleSet(i, j) {
  const a = loadActive();
  if (!a) return;
  const type = LIFT_EXERCISES[a.exercises[i].exId].type;
  const set = a.exercises[i].log[j];
  if (!set.done) {
    const ok = type === "timed" ? set.min > 0 : set.reps > 0 && (type !== "weighted" || (Number.isFinite(set.w) && set.w >= 0));
    if (!ok) {
      showToast({ timed: "Enter the minutes first.", weighted: "Enter the weight and reps first.", bodyweight: "Enter the reps first." }[type]);
      return;
    }
    haptic();
  }
  set.done = !set.done;
  saveActive(a);
  if (set.done) {
    unlockAudio();
    startRest(a.exercises[i].rest);
  }
  renderWorkout();
}

/* iOS only lets audio start from a tap, so the ✓ tap unlocks it. */
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    /* iOS also reports "interrupted" after an app switch or a call. */
    if (audioCtx.state !== "running") audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

/* Two short tones. iOS mutes Web Audio when the ring switch is on silent. */
function beep() {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    for (const at of [0, 0.3]) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, t + at);
      gain.gain.exponentialRampToValueAtTime(0.001, t + at + 0.2);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + at);
      osc.stop(t + at + 0.2);
    }
  } catch {
    // Sound is a nice-to-have; the flash still shows.
  }
}

function updateRest(end) {
  const a = loadActive();
  if (!a) return;
  a.restEndsAt = end;
  saveActive(a);
  restDoneAt = null;
  document.getElementById("rest-bar").classList.remove("rest-done");
  tickRest(a);
}

function startRest(seconds) {
  if (seconds > 0) updateRest(Date.now() + seconds * 1000);
}

function tickRest(active) {
  const bar = document.getElementById("rest-bar");
  if (!active.restEndsAt) {
    bar.hidden = true;
    return;
  }
  const now = Date.now();
  const left = restLeft(active.restEndsAt, now);
  bar.hidden = false;
  document.getElementById("rest-time").textContent = formatDuration(left);
  if (left > 0) return;
  if (restDoneAt === null) {
    /* Back long after it ended (phone locked, app switched): nothing to announce. */
    if (now - active.restEndsAt >= 2000) {
      updateRest(null);
      return;
    }
    restDoneAt = now;
    bar.classList.add("rest-done");
    if (document.visibilityState === "visible") beep();
  } else if (now - restDoneAt >= 3000) {
    updateRest(null);
  }
}

document.getElementById("rest-minus").addEventListener("click", () => {
  const a = loadActive();
  if (a) updateRest(adjustRest(a.restEndsAt, Date.now(), -15));
});
document.getElementById("rest-plus").addEventListener("click", () => {
  const a = loadActive();
  if (a) updateRest(adjustRest(a.restEndsAt, Date.now(), 15));
});
document.getElementById("rest-skip").addEventListener("click", () => updateRest(null));
/* Any tap counts, so a rest restored by a reload can still beep. */
workoutEl.addEventListener("click", unlockAudio);

workoutDaySelect.addEventListener("change", () => {
  const a = loadActive();
  if (!a || a.exercises.some((e) => e.log.some((s) => s.done))) return;
  saveActive({ ...newWorkout(currentPlan(), workoutDaySelect.value, a.date, loadSessions(), a.start), id: a.id });
  swapOpenFor = null;
  renderWorkout();
});

function renderFinish() {
  const a = loadActive();
  if (!a) return;
  const { done } = workoutCounts(a);
  const bests = sessionBests(finishWorkout(a, Date.now()), loadSessions()).map(exerciseName);
  workoutFinish.innerHTML = "";
  workoutFinish.appendChild(el("div", "meal-name", "Finish workout?"));
  workoutFinish.appendChild(el("div", "meal-detail", `${formatDuration(Math.max(0, Math.floor((Date.now() - a.start) / 1000)))} · ${done} ${done === 1 ? "set" : "sets"}`));
  if (bests.length) workoutFinish.appendChild(el("div", "meal-detail workout-bests", `New best: ${bests.join(", ")}`));
  if (!done) workoutFinish.appendChild(el("div", "hint", "No sets logged yet."));
  const finish = actionBtn("Finish", finishActive, "pill-btn dark");
  finish.disabled = !done;
  const actions = el("div", "meal-actions");
  actions.append(actionBtn("Keep going", () => { workoutFinish.hidden = true; }), actionBtn("Discard", discardWorkout, "pill-btn danger"), finish);
  workoutFinish.appendChild(actions);
  workoutFinish.hidden = false;
}

function finishActive() {
  const a = loadActive();
  if (!a) return;
  const session = finishWorkout(a, Date.now());
  if (!session.exercises.length) return;
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  saveJSON(LIFT_SESSIONS_KEY, [...loadSessions(), session]);
  closeWorkout();
  /* A make-up workout (Monday's done on Tuesday, or a lift removed with
     Edit day) puts a Lift item on its day at the time it started, so it
     still gets checked off and asked about. */
  if (!scheduleFor(a.date).some((it) => it.id === "lift")) {
    updateOverride(a.date, (o) => {
      o.removed = o.removed.filter((id) => id !== "lift");
      o.added = o.added.filter((it) => it.id !== "lift");
      o.added.push({ id: "lift", time: timeInputValue(a.start), title: "Lift — 45 min", kind: "train" });
    });
  }
  /* The lift on the workout's own day gets checked off (a workout left
     open past midnight counts for the day it started). Only today's
     opens the "how did it go?" card. */
  setCheckin(a.date, "lift", { status: "done", at: Date.now() });
  if (a.date === todayLocalDateString()) feelOpenFor = "lift";
  activateTab("today-panel");
  renderToday();
  showToast(`Workout saved · ${sets} ${sets === 1 ? "set" : "sets"}`);
  renderLifts();
}

function discardWorkout() {
  if (!confirm("Discard this workout? Its sets won't be saved.")) return;
  closeWorkout();
  renderToday();
  renderLifts();
}

/* ---- Train tab: Lifts card and Edit plan ---- */

let planEditing = false;
let planDay = "upperA";

function nextLiftLine(plan, sessions) {
  const today = todayLocalDateString();
  const checkins = loadJSON(CHECKINS_KEY, {});
  for (let i = 0; i < 8; i++) {
    const d = shiftDate(today, i);
    const lift = scheduleFor(d).find((it) => it.id === "lift");
    if (!lift || (i === 0 && checkins[`${d}|lift`])) continue;
    const when = i === 0 ? "Today" : parseLocalDate(d).toLocaleDateString(undefined, { weekday: "short" });
    return `Next: ${liftDayName(liftDayFor(plan, d, sessions))} · ${when} ${formatTime12(lift.time)}`;
  }
  return "No lift on the schedule this week.";
}

function renderLifts() {
  const sessions = loadSessions();
  document.getElementById("lift-next").textContent = nextLiftLine(currentPlan(), sessions);
  document.getElementById("lift-start-btn").textContent = loadActive() ? "Resume workout" : "Start workout";
  const list = document.getElementById("lift-history");
  list.innerHTML = "";
  const recent = [...sessions].sort((a, b) => b.start - a.start).slice(0, 5);
  document.getElementById("lift-history-empty").style.display = recent.length ? "none" : "block";
  for (const s of recent) {
    const li = el("li");
    const main = el("div", "entry-main");
    const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0);
    main.appendChild(el("div", "entry-weight", `${liftDayName(s.day)} · ${Math.max(1, Math.round((s.end - s.start) / 60000))} min`));
    main.appendChild(el("div", "entry-meta", `${formatDate(s.date)} · ${sets} ${sets === 1 ? "set" : "sets"}`));
    li.append(main, actionBtn("Delete", () => {
      if (!confirm("Delete this workout? Its numbers stop counting toward suggestions.")) return;
      saveJSON(LIFT_SESSIONS_KEY, loadSessions().filter((x) => x.id !== s.id));
      renderLifts();
    }, "delete-btn"));
    list.appendChild(li);
  }
  renderPlanEditor();
}

/* Each edit saves at once; liftPlan() cleans the values on read. The
   workout in progress is a snapshot, so edits never change it. */
function savePlan(mutate) {
  const plan = currentPlan();
  mutate(plan.days[planDay]);
  saveJSON(LIFT_PLAN_KEY, { days: plan.days });
  renderLifts();
}

function renderPlanRow(row, i, count) {
  const type = LIFT_EXERCISES[row.exId].type;
  const li = el("li", "plan-row");
  const pick = el("select", "plan-ex");
  for (const id of [row.exId, ...swapOptions(row)]) {
    const o = el("option", null, exerciseName(id));
    o.value = id;
    o.selected = id === row.exId;
    pick.appendChild(o);
  }
  pick.disabled = pick.options.length < 2;
  pick.setAttribute("aria-label", "Exercise");
  /* Picking a swap here makes it this day's default. */
  pick.addEventListener("change", () => savePlan((r) => { r[i].exId = pick.value; }));
  li.appendChild(pick);

  const nums = el("div", "plan-nums");
  const num = (key, label, cls) => {
    const input = el("input", `plan-num ${cls}`);
    input.type = "number";
    input.inputMode = "numeric";
    input.value = row[key];
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => savePlan((r) => {
      r[i][key] = Number(input.value);
      if (type === "timed") r[i].repMax = r[i].repMin;
    }));
    return input;
  };
  if (type === "timed") {
    nums.append(num("repMin", "Minutes", "plan-min"), el("span", "set-x", "min"));
  } else {
    nums.append(num("sets", "Sets", "plan-sets"), el("span", "set-x", "×"), num("repMin", "Fewest reps", "plan-rep-min"),
      el("span", "set-x", "–"), num("repMax", "Most reps", "plan-rep-max"), el("span", "set-x", "rest"),
      num("rest", "Rest seconds", "plan-rest"), el("span", "set-x", "s"));
  }
  li.appendChild(nums);

  const tools = el("div", "plan-tools");
  const up = actionBtn("↑", () => savePlan((r) => { [r[i - 1], r[i]] = [r[i], r[i - 1]]; }), "pill-btn plan-up");
  up.disabled = i === 0;
  up.setAttribute("aria-label", "Move up");
  const down = actionBtn("↓", () => savePlan((r) => { [r[i + 1], r[i]] = [r[i], r[i + 1]]; }), "pill-btn plan-down");
  down.disabled = i === count - 1;
  down.setAttribute("aria-label", "Move down");
  const remove = actionBtn("✕", () => savePlan((r) => { r.splice(i, 1); }), "pill-btn danger plan-remove");
  remove.setAttribute("aria-label", `Remove ${exerciseName(row.exId)}`);
  tools.append(up, down, remove);
  li.appendChild(tools);
  return li;
}

function renderPlanEditor() {
  const box = document.getElementById("lift-plan-editor");
  document.getElementById("lift-plan-btn").textContent = planEditing ? "Done" : "Edit plan";
  box.hidden = !planEditing;
  if (!planEditing) return;
  box.innerHTML = "";
  const seg = el("div", "segmented plan-days");
  for (const day of LIFT_DAY_ORDER) {
    seg.appendChild(actionBtn(liftDayName(day), () => {
      planDay = day;
      renderPlanEditor();
    }, `seg-btn${day === planDay ? " active" : ""}`));
  }
  box.appendChild(seg);
  const rows = currentPlan().days[planDay];
  const list = el("ul", "plan-list");
  rows.forEach((row, i) => list.appendChild(renderPlanRow(row, i, rows.length)));
  box.appendChild(list);
  if (!rows.length) box.appendChild(el("p", "hint", "No exercises. Add one below."));
  const add = el("div", "plan-add");
  const pick = el("select", "plan-add-select");
  pick.setAttribute("aria-label", "Exercise to add");
  for (const id of Object.keys(LIFT_EXERCISES).sort((a, b) => exerciseName(a).localeCompare(exerciseName(b)))) {
    const o = el("option", null, exerciseName(id));
    o.value = id;
    pick.appendChild(o);
  }
  add.append(pick, actionBtn("Add", () => savePlan((r) => { r.push(newPlanRow(pick.value)); })));
  box.appendChild(add);
  box.appendChild(actionBtn("Reset to default", () => {
    if (!confirm("Reset all four days to the default plan?")) return;
    saveJSON(LIFT_PLAN_KEY, null);
    renderLifts();
  }, "link-btn"));
}

document.getElementById("lift-plan-btn").addEventListener("click", () => {
  planEditing = !planEditing;
  renderPlanEditor();
});
document.getElementById("lift-start-btn").addEventListener("click", () => startWorkout(todayLocalDateString()));

document.getElementById("workout-min").addEventListener("click", minimizeWorkout);
document.getElementById("workout-stop").addEventListener("click", renderFinish);
document.getElementById("workout-bar").addEventListener("click", openWorkout);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  renderLifts();
  if (!loadActive()) return;
  if (!workoutEl.hidden) keepAwake(true);
  tickWorkout();
});

// A workout left in progress (reload, update, iOS closing the app) reopens.
if (loadActive()) openWorkout();
// coach.js rendered Today before this file loaded; add the Start button now.
renderLifts();
renderToday();
