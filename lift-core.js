/* Lift core (step T): the exercise catalog, the default Upper / Lower
   plan, and the math behind workout mode: what to lift next, new bests
   and the rest timer. DOM-free like coach-core.js, so
   tests/lift-core.test.html loads it on its own. Weights are lb; in a
   weighted exercise 0 lb means bodyweight. */

const LIFT_STEP_LB = 5;
const NEW_WEIGHTED_HINT = "First time: pick a weight you could lift for about 2 more reps than the target.";

/* `swaps` are offered in workout mode and Edit plan. Lower-body ones are
   all seated or lying, so nothing loads or bends the ankle. */
const W = "weighted";
const BW = "bodyweight";
const TIMED = "timed";
const ex = (name, type, swaps = []) => ({ name, type, swaps });
const LIFT_EXERCISES = {
  // Upper A
  "bench-press": ex("Barbell bench press", W, ["db-bench-press", "machine-chest-press", "push-up"]),
  "db-bench-press": ex("Dumbbell bench press", W),
  "machine-chest-press": ex("Machine chest press", W),
  "push-up": ex("Push-ups", BW),
  "seated-cable-row": ex("Seated cable row", W, ["machine-row", "cs-db-row", "one-arm-db-row"]),
  "cs-db-row": ex("Chest-supported dumbbell row", W),
  "one-arm-db-row": ex("One-arm dumbbell row", W),
  "seated-db-press": ex("Seated dumbbell shoulder press", W, ["machine-shoulder-press", "arnold-press"]),
  "arnold-press": ex("Seated Arnold press", W),
  "lat-pulldown": ex("Lat pulldown", W, ["neutral-pulldown", "single-arm-pulldown"]),
  "neutral-pulldown": ex("Neutral-grip pulldown", W),
  "single-arm-pulldown": ex("Single-arm cable pulldown", W),
  "triceps-pushdown": ex("Cable triceps pushdown", W, ["overhead-triceps", "skull-crusher"]),
  "skull-crusher": ex("Dumbbell skull crusher", W),
  "db-curl": ex("Dumbbell curl", W, ["cable-curl", "incline-curl", "ez-curl"]),
  "cable-curl": ex("Cable curl", W),
  "incline-curl": ex("Incline dumbbell curl", W),
  "ez-curl": ex("EZ-bar curl", W),
  // Lower A / B (ankle-safe)
  "leg-extension": ex("Leg extension", W, ["sl-leg-extension", "paused-leg-extension"]),
  "sl-leg-extension": ex("Single-leg leg extension (good leg)", W, ["sl-leg-curl"]),
  "paused-leg-extension": ex("Paused leg extension", W),
  "seated-leg-curl": ex("Seated leg curl", W, ["lying-leg-curl", "sl-leg-curl"]),
  "lying-leg-curl": ex("Lying leg curl", W),
  "sl-leg-curl": ex("Single-leg leg curl (good leg)", W, ["sl-leg-extension"]),
  "glute-bridge": ex("Glute bridge (brace on)", W, ["sl-glute-bridge", "frog-pump"]),
  "sl-glute-bridge": ex("Single-leg glute bridge (good leg)", BW),
  "frog-pump": ex("Frog pump", BW),
  "hip-abduction": ex("Hip abduction machine", W, ["banded-abduction", "side-lying-abduction"]),
  "banded-abduction": ex("Banded seated abduction", BW),
  "side-lying-abduction": ex("Side-lying abduction", BW),
  "hip-adduction": ex("Hip adduction machine", W, ["side-lying-adduction", "ball-squeeze"]),
  "side-lying-adduction": ex("Side-lying adduction", BW),
  "ball-squeeze": ex("Seated ball squeeze", BW),
  "machine-crunch": ex("Machine ab crunch", W, ["dead-bug", "knee-raise"]),
  "dead-bug": ex("Dead bug", BW, ["machine-crunch", "knee-raise"]),
  "knee-raise": ex("Captain's-chair knee raise", BW),
  "arm-bike": ex("Arm bike", TIMED, ["battle-ropes", "upper-circuit"]),
  "battle-ropes": ex("Seated battle ropes", TIMED),
  "upper-circuit": ex("Seated upper-body circuit", TIMED),
  // Upper B
  "incline-db-press": ex("Incline dumbbell press", W, ["incline-bench-press", "incline-machine-press", "cable-fly"]),
  "incline-bench-press": ex("Incline barbell press", W),
  "incline-machine-press": ex("Incline machine press", W),
  "cable-fly": ex("Low-to-high cable fly", W),
  "close-grip-pulldown": ex("Close-grip lat pulldown", W, ["neutral-pulldown", "single-arm-pulldown"]),
  "machine-row": ex("Machine row", W, ["seated-cable-row", "one-arm-db-row"]),
  "machine-shoulder-press": ex("Machine shoulder press", W, ["seated-db-press", "arnold-press"]),
  "cable-lateral-raise": ex("Cable lateral raise", W, ["db-lateral-raise", "machine-lateral-raise"]),
  "db-lateral-raise": ex("Dumbbell lateral raise", W),
  "machine-lateral-raise": ex("Machine lateral raise", W),
  "face-pull": ex("Cable face pull", W, ["reverse-pec-deck", "rear-delt-fly"]),
  "reverse-pec-deck": ex("Reverse pec deck", W),
  "rear-delt-fly": ex("Seated rear-delt dumbbell fly", W),
  "hammer-curl": ex("Hammer curl", W, ["rope-curl"]),
  "rope-curl": ex("Cable rope curl", W),
  "overhead-triceps": ex("Overhead cable triceps", W, ["db-overhead-extension"]),
  "db-overhead-extension": ex("Dumbbell overhead extension", W),
};

const LIFT_DAYS = {
  upperA: { name: "Upper A", lower: false },
  lowerA: { name: "Lower A", lower: true },
  upperB: { name: "Upper B", lower: false },
  lowerB: { name: "Lower B", lower: true },
};
const LIFT_DAY_ORDER = ["upperA", "lowerA", "upperB", "lowerB"];
/* Date#getDay() → day. Monday only has a lift while Injury mode is on
   (coach-core.js injuryItems); the mapping itself doesn't care. */
const LIFT_WEEKDAYS = { 1: "upperA", 3: "lowerA", 5: "upperB", 6: "lowerB" };

function exerciseName(id) {
  return LIFT_EXERCISES[id] ? LIFT_EXERCISES[id].name : id;
}

function liftDayName(day) {
  return LIFT_DAYS[day] ? LIFT_DAYS[day].name : "Workout";
}

/* Heavier, lower-rep work gets the longer rest. */
function restFor(type, repMax) {
  if (type === TIMED) return 0;
  return repMax <= 10 ? 120 : 75;
}

/* Timed rows keep minutes in repMin/repMax and always have one set. */
function planRow(exId, sets, repMin, repMax) {
  return { exId, baseId: exId, sets, repMin, repMax, rest: restFor(LIFT_EXERCISES[exId].type, repMax) };
}

function newPlanRow(exId) {
  return LIFT_EXERCISES[exId].type === TIMED ? planRow(exId, 1, 8, 8) : planRow(exId, 3, 10, 12);
}

const DEFAULT_LIFT_DAYS = {
  upperA: [planRow("bench-press", 3, 6, 8), planRow("seated-cable-row", 3, 8, 10), planRow("seated-db-press", 3, 8, 10),
    planRow("lat-pulldown", 3, 10, 12), planRow("triceps-pushdown", 2, 12, 15), planRow("db-curl", 2, 12, 15)],
  lowerA: [planRow("leg-extension", 3, 10, 12), planRow("seated-leg-curl", 3, 10, 12), planRow("glute-bridge", 3, 10, 12),
    planRow("sl-leg-extension", 2, 10, 12), planRow("hip-abduction", 3, 12, 15), planRow("hip-adduction", 2, 12, 15),
    planRow("machine-crunch", 3, 12, 15), planRow("arm-bike", 1, 8, 8)],
  upperB: [planRow("incline-db-press", 3, 8, 10), planRow("close-grip-pulldown", 3, 8, 10), planRow("machine-row", 3, 10, 12),
    planRow("machine-shoulder-press", 3, 10, 12), planRow("cable-lateral-raise", 2, 12, 15), planRow("face-pull", 2, 12, 15),
    planRow("hammer-curl", 2, 12, 15), planRow("overhead-triceps", 2, 12, 15)],
  lowerB: [planRow("seated-leg-curl", 3, 10, 12), planRow("leg-extension", 3, 12, 15), planRow("glute-bridge", 3, 12, 15),
    planRow("sl-leg-curl", 2, 10, 12), planRow("hip-abduction", 3, 12, 15), planRow("hip-adduction", 2, 12, 15),
    planRow("dead-bug", 3, 10, 12), planRow("arm-bike", 1, 8, 8)],
};

/* Edit plan saves raw input, so every value is made sane on read. */
function cleanRow(r) {
  const int = (v, lo, hi, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  const type = LIFT_EXERCISES[r.exId].type;
  const repMin = int(r.repMin, 1, 100, 10);
  const repMax = Math.max(repMin, int(r.repMax, 1, 100, repMin));
  return {
    exId: r.exId,
    baseId: LIFT_EXERCISES[r.baseId] ? r.baseId : r.exId,
    sets: type === TIMED ? 1 : int(r.sets, 1, 10, 3),
    repMin,
    repMax,
    rest: int(r.rest, 0, 600, restFor(type, repMax)),
  };
}

/* The stored plan (lift-plan) day by day, falling back to the default
   for any day it doesn't have. */
function liftPlan(stored) {
  const days = {};
  for (const day of LIFT_DAY_ORDER) {
    const rows = stored && stored.days && Array.isArray(stored.days[day]) ? stored.days[day] : DEFAULT_LIFT_DAYS[day];
    days[day] = rows.filter((r) => r && LIFT_EXERCISES[r.exId]).map(cleanRow);
  }
  return { days, dayByWeekday: { ...LIFT_WEEKDAYS } };
}

/* The slot's main exercise and its swaps, minus the one in use. */
function swapOptions(row) {
  return [row.baseId, ...LIFT_EXERCISES[row.baseId].swaps].filter((id) => id !== row.exId);
}

/* A lift on an unmapped weekday (added with Edit day) takes the next
   day in the rotation after the last session. */
function liftDayFor(plan, dateStr, sessions) {
  const mapped = plan.dayByWeekday[parseLocalDate(dateStr).getDay()];
  if (mapped) return mapped;
  const last = [...sessions].sort((a, b) => b.start - a.start)[0];
  const i = last ? LIFT_DAY_ORDER.indexOf(last.day) : -1;
  return LIFT_DAY_ORDER[(i + 1) % LIFT_DAY_ORDER.length];
}

/* Newest first: each past session's sets for one exercise. A swap has
   its own id, so it keeps its own history. */
function exerciseHistory(sessions, exId) {
  return [...sessions]
    .sort((a, b) => b.start - a.start)
    .map((s) => {
      const e = s.exercises.find((x) => x.exId === exId);
      return e && e.sets.length ? { date: s.date, sets: e.sets } : null;
    })
    .filter(Boolean);
}

/* Double progression: top of the range on every set → +5 lb; below the
   bottom in two sessions running → −10%; otherwise beat the reps. */
function suggestNext(row, history) {
  const type = LIFT_EXERCISES[row.exId].type;
  const [last, before] = history;
  if (type === TIMED) return last ? { kind: "hold", min: last.sets[0].min, text: "" } : { kind: "new", min: row.repMin, text: "" };
  const hold = { kind: "hold", reps: null, text: "Beat last time's reps." };
  if (!last) {
    return type === W
      ? { kind: "new", weight: null, reps: null, text: NEW_WEIGHTED_HINT }
      : { kind: "new", reps: null, text: `First time: aim for ${row.repMin}–${row.repMax} clean reps.` };
  }
  const topHit = (s) => s.sets.length >= row.sets && s.sets.every((x) => x.reps >= row.repMax);
  const missed = (s) => s.sets.some((x) => x.reps < row.repMin);
  if (type === BW) {
    const best = Math.max(...last.sets.map((x) => x.reps));
    return topHit(last) ? { kind: "up", reps: best + 1, text: `↑ All reps hit. Aim for ${best + 1}.` } : hold;
  }
  const w = Math.max(...last.sets.map((x) => x.w || 0));
  if (topHit(last)) {
    return { kind: "up", weight: w + LIFT_STEP_LB, reps: row.repMin, text: w ? `↑ Try ${w + LIFT_STEP_LB} lb` : `↑ Add a ${LIFT_STEP_LB} lb dumbbell` };
  }
  if (before && missed(last) && missed(before) && w > LIFT_STEP_LB) {
    const nearest = Math.round((w * 0.9) / LIFT_STEP_LB) * LIFT_STEP_LB;
    const down = Math.max(LIFT_STEP_LB, Math.min(w - LIFT_STEP_LB, nearest));
    return { kind: "down", weight: down, reps: row.repMin, text: `↓ Two tough sessions. Drop to ${down} lb.` };
  }
  return { kind: "hold", weight: w, reps: null, text: hold.text };
}

function formatSets(type, sets) {
  if (!sets || !sets.length) return "";
  if (type === TIMED) return `${sets[0].min} min`;
  const reps = sets.map((s) => s.reps).join(", ");
  if (type === BW) return `${reps} reps`;
  const lb = (w) => (w ? `${w} lb` : "BW");
  const weights = new Set(sets.map((s) => s.w || 0));
  if (weights.size === 1) return `${lb(sets[0].w || 0)} × ${reps}`;
  return sets.map((s) => `${lb(s.w || 0)} × ${s.reps}`).join(", ");
}

/* One exercise of a workout, pre-filled from its suggestion: the new
   weight, else last time's reps set by set, else blank. */
function workoutExercise(row, sessions) {
  const history = exerciseHistory(sessions, row.exId);
  const suggestion = suggestNext(row, history);
  const last = history[0] || null;
  const timed = LIFT_EXERCISES[row.exId].type === TIMED;
  const log = Array.from({ length: timed ? 1 : row.sets }, (_, i) => {
    const prev = last ? last.sets[Math.min(i, last.sets.length - 1)] : null;
    return {
      w: suggestion.weight ?? null,
      reps: timed ? null : suggestion.reps ?? (prev ? prev.reps : null),
      min: timed ? suggestion.min : null,
      done: false,
    };
  });
  return { ...row, skipped: false, log, suggestion, last };
}

function newWorkout(plan, day, dateStr, sessions, now) {
  return {
    id: `lift-${now}`, date: dateStr, day, start: now, restEndsAt: null,
    exercises: plan.days[day].map((row) => workoutExercise(row, sessions)),
  };
}

/* Logged sets stay with their exercise, so a started one can't swap. */
function swapExercise(active, index, exId, sessions) {
  const cur = active.exercises[index];
  if (cur.log.some((s) => s.done)) return active;
  const exercises = active.exercises.slice();
  const { baseId, sets, repMin, repMax, rest } = cur;
  exercises[index] = workoutExercise({ exId, baseId, sets, repMin, repMax, rest }, sessions);
  return { ...active, exercises };
}

function workoutCounts(active) {
  const live = active.exercises.filter((e) => !e.skipped);
  return {
    done: live.reduce((n, e) => n + e.log.filter((s) => s.done).length, 0),
    total: live.reduce((n, e) => n + e.log.length, 0),
  };
}

function finishWorkout(active, now) {
  const exercises = active.exercises
    .map((e) => ({ exId: e.exId, baseId: e.baseId, sets: e.log.filter((s) => s.done).map(({ w, reps, min }) => ({ w, reps, min })) }))
    .filter((e) => e.sets.length);
  return { id: active.id, date: active.date, day: active.day, start: active.start, end: now, exercises };
}

/* Estimated 1-rep max (Epley); the tiny reps term breaks ties, so more
   reps at the same weight (and at bodyweight, where w is 0) count. */
function setScore(type, s) {
  return type === BW ? s.reps : (s.w || 0) * (1 + s.reps / 30) + s.reps / 1000;
}

function sessionBests(session, priorSessions) {
  return session.exercises
    .filter((e) => {
      const type = LIFT_EXERCISES[e.exId].type;
      if (type === TIMED) return false;
      const before = exerciseHistory(priorSessions, e.exId).flatMap((h) => h.sets);
      if (!before.length) return false;
      const best = (sets) => Math.max(...sets.map((s) => setScore(type, s)));
      return best(e.sets) > best(before);
    })
    .map((e) => e.exId);
}

/* The rest timer is an end time, not a countdown, so it stays right
   while iOS has the app frozen. */
function restLeft(restEndsAt, now) {
  return restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
}

function adjustRest(restEndsAt, now, deltaSec) {
  const end = Math.max(now, restEndsAt || 0) + deltaSec * 1000;
  return end > now ? end : null;
}

if (typeof module !== "undefined") {
  module.exports = {
    LIFT_EXERCISES, LIFT_DAYS, LIFT_DAY_ORDER, LIFT_WEEKDAYS, NEW_WEIGHTED_HINT,
    exerciseName, liftDayName, restFor, cleanRow, newPlanRow, liftPlan, swapOptions, liftDayFor,
    exerciseHistory, suggestNext, formatSets, workoutExercise, newWorkout, swapExercise, workoutCounts,
    finishWorkout, sessionBests, restLeft, adjustRest,
  };
}
