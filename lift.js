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
}

function minimizeWorkout() {
  workoutEl.hidden = true;
  document.body.classList.remove("workout-open");
  keepAwake(false);
  tickWorkout();
  renderToday();
}

/* Finish and Discard both end here: nothing in progress any more. */
function closeWorkout() {
  saveActive(null);
  workoutEl.hidden = true;
  document.body.classList.remove("workout-open");
  clearInterval(workoutTicker);
  workoutTicker = null;
  keepAwake(false);
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
  actions.appendChild(actionBtn(e.skipped ? "Unskip" : "Skip", () => updateActive((a) => { a.exercises[i].skipped = !a.exercises[i].skipped; })));
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
  renderWorkout();
}

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
  /* The lift on the workout's own day gets checked off (a workout left
     open past midnight counts for the day it started). Only today's
     opens the "how did it go?" card. */
  if (scheduleFor(a.date).some((it) => it.id === "lift")) {
    setCheckin(a.date, "lift", { status: "done", at: Date.now() });
    if (a.date === todayLocalDateString()) feelOpenFor = "lift";
  }
  activateTab("today-panel");
  renderToday();
  showToast(`Workout saved · ${sets} ${sets === 1 ? "set" : "sets"}`);
}

function discardWorkout() {
  if (!confirm("Discard this workout? Its sets won't be saved.")) return;
  closeWorkout();
  renderToday();
}

document.getElementById("workout-min").addEventListener("click", minimizeWorkout);
document.getElementById("workout-stop").addEventListener("click", renderFinish);
document.getElementById("workout-bar").addEventListener("click", openWorkout);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !loadActive()) return;
  if (!workoutEl.hidden) keepAwake(true);
  tickWorkout();
});

// A workout left in progress (reload, update, iOS closing the app) reopens.
if (loadActive()) openWorkout();
// coach.js rendered Today before this file loaded; add the Start button now.
renderToday();
