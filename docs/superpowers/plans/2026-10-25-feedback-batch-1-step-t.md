# Feedback batch 1, step T: training basics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sean lifts 4 days a week (Mon Upper A while Injury mode is on, Wed Lower A, Fri Upper B, Sat Lower B). "Start workout" opens a full-screen workout mode. It shows last session's numbers and a +5 lb / −10% suggestion, logs weight × reps per set, runs a rest timer, survives reloads, and ends with Stop → Finish, which checks off the lift and opens the "how did it go?" card. The Train tab gets a Lifts card and an editable plan. The step also clears the Injury mode backlog carried from step B. Ships as v36.

**Architecture:** Pure logic goes in a new `lift-core.js`: the catalog, the default plan, plan cleaning, day mapping, history, suggestions, workout and session shapes, new bests and rest math. It is unit-tested by `tests/lift-core.test.html`. A new `lift.js` holds all the UI: workout mode, the rest timer, the Lifts card and the plan editor. It saves the workout in progress to `lift-active` after every change. `coach-core.js` gains the injured-Monday lift and reads a list of injuries (current plus past), so past days keep their own injury. `coach.js` adds the Start button to the Today lift item through `liftStartButton()`.

**Tech Stack:** Plain HTML/CSS/JS, no build, no Node. Logic tests: `python tests/run.py` (headless Edge runs `tests/*.test.html`). UI tests: `python .claude/skills/phone-preview/preview.py --interact tests/ui/<name>.js` (light, and again with `--dark`).

**Spec:** `docs/superpowers/specs/2026-10-15-feedback-batch-1-design.md`, section **"T. Training basics (Q&A 2026-10-25)"**, plus section 0.5 (Injury mode), "Data changes" and "Order and verification".

## Global Constraints

- Read `CLAUDE.md` and `.claude/skills/phone-preview/SKILL.md` first.
- **Commits:** ask Sean before every `git commit` and `git push`, unless he has approved per-task commits for this plan. Push always needs his yes. Implementers don't touch the progress logs; Task 6 writes them.
- **Cache:** `sw.js` `CACHE_NAME` and `version.js` `APP_VERSION` move together to **36** in Task 1. Leave them alone after that, because the whole step ships as one deploy. New app files go into `sw.js` `ASSETS` and `index.html` in the task that creates them (`lift-core.js` in Task 1, `lift.js` in Task 3). `tests/run.py` static checks enforce both.
- **Line endings:** keep each file's own. Git Bash `sed -i` strips CRLF in this repo, so edit with Edit or Python, never `sed -i`. CRLF: `index.html`, `style.css`, `coach-core.js`, `coach.js`, `food.js`, `injury.js`, `backup-core.js`, `version.js`, `sw.js`, `tests/injury.test.html`, `tests/backup-core.test.html`, `tests/ui/injury.js`. New files are whatever the Write tool produces (LF), like `tests/ui/swipe-close.js`; don't convert them.
- **Style:** short `/* */` why-comments, the `el()`, `loadJSON` and `saveJSON` helpers (coach.js), `showToast`, `haptic`, `formatDuration`, `formatDate`, `formatTime12`, and no new globals beyond the names listed in each task's Interfaces.
- **Tests reach app code through `app()`.** Only function declarations are `window` properties. Top-level `const`s such as `LIFT_EXERCISES` are not, so UI scripts use `app().exerciseName(id)` and `app().liftDayName(day)` instead.
- **Weights are lb.** In a `weighted` exercise, 0 lb means bodyweight and shows as "BW".
- **Spec T schedule:** Mon 18:30 Upper A (only while Injury mode is on), Wed 17:45 Lower A, Fri 17:15 Upper B, Sat 10:30 Lower B. The injured Monday gets `lift` 18:30 and `post-lift` 19:20.
- **Spec T progression:** if every set of the last session reached the top of the range (and at least the planned number of sets was done), suggest + 5 lb. If the last 2 sessions each had a set below the bottom of the range, suggest × 0.9 rounded to the nearest 5 lb, always lower, never below 5. Otherwise suggest the same weight with "Beat last time's reps." With no history: "First time: pick a weight you could lift for about 2 more reps than the target." `bodyweight` exercises use the same logic on reps with no weight. `timed` exercises show last time only.
- **Spec T rest:** 120 s when the rep range tops out at ≤ 10, otherwise 75 s, and 0 for timed. The bar has −15 s / +15 s / Skip. It's clock-based (`restEndsAt`), and it beeps only while the page is visible.
- The browser in tests uses the real date and weekday, so never assume a day type. Branch on `item(...)` existing, like `tests/ui/injury.js` does.

## Decisions beyond the spec (confirm with Sean when he reviews this plan)

1. **Glute bridge is `weighted`, starting at 0 lb (BW).** When every set tops out, the suggestion reads "↑ Add a 5 lb dumbbell", which matches "DB on hips once easy". The single-leg bridge and frog pump are `bodyweight`.
2. **Swap options come from the plan row's original exercise (`baseId`).** After a swap, the list still offers the main lift and its other swaps. Swapping is only possible before the first ✓ on that exercise, so logged sets never change exercise.
3. **The workout's day can be changed from the header** (a select) until the first set is logged. A lift added through Edit day on an unmapped weekday gets the next day in the rotation after the last session (Upper A when there's no history).
4. **Finish needs at least one logged set.** With none, the panel says "No sets logged yet" and only Keep going / Discard work.
5. **Finish checks off the `lift` item on the workout's own date** (a workout started before midnight checks off that day). The "how did it go?" card opens only when that date is today. A workout started from Train on a day with no lift item saves the session and checks nothing off.
6. **The Lifts card lists the last 5 sessions with a Delete button** (with a confirm). A mistaken session would otherwise skew suggestions forever.
7. **The feel check-in record gains `workoutId`** (the day's latest session id). That's the "session link" from the brainstorm, so the future coach can join pain with sets.
8. **A late return to an ended rest is quiet.** If the rest ended more than 2 s before the app looks at it again (phone locked, app switched), the bar just clears with no beep or flash.
9. **Plan editor edits save on each change** (no Save button), and `liftPlan()` cleans every value on read: sets 1–10, reps 1–100 with max ≥ min, rest 0–600 s, and unknown exercises dropped. A timed row's minutes edit both `repMin` and `repMax`.
10. **`lift-active` is in the backup, as the spec says.** A restore onto a new phone reopens a workout that was in progress.
11. **The injury lift note drops "hip thrust"** (Sean: no barbell hip thrusts). It still starts with "Ankle-safe legs", which the UI tests key on, and it now ends with `INJURY_LIFT_AVOID`, which workout mode shows on lower days.
12. **`lift-plan` stores only `days`.** The weekday map (`LIFT_WEEKDAYS`) is fixed in code, not saved, until the post-clearance schedule needs it to change. The spec's data line lists `dayByWeekday` in `lift-plan`; `liftPlan()` still returns it.

## Backlog folded in from step B's appendix

The hand-off listed these Injury mode items for step T. They were re-checked against main `50a60ba`.

- Pain trend mixes body parts → **Task 2** (`injuryPainFlag` takes the part).
- Starting a new injury overwrites the old one's history → **Task 2** (`coach-injury-past` plus a list-aware `itemsForDate`).
- An upcoming injury can't be cancelled → **Task 2** (the End button reads "Cancel this injury" and drops it).
- "End now" on an injury that started today leaves `until < start` → **Task 2** (`endInjury` returns `null`, and the injury before it comes back).
- PT remove handler without a null guard → **Task 2** (guard; unreachable from the UI, so no test).
- `visibilitychange` not re-rendering Today → **already fixed.** `coach.js:679` re-renders Today on `visible` before `injury.js`'s listener runs. Task 2 adds a UI test that pins it.
- `injuryDays` with no `until` → **Task 2** (returns `null`; `injuryLine` copes).

**Deferred step B minors** (fix only if step T touches that code): none of them are in files this plan changes ("Ate at" and the quick add key are in `food.js`'s tray code, the rollback flag is in `backup.js`, and `swipe-close.js` is a test). They stay in the appendix.

## Review Focus

1. **A reload or update mid-workout.** Every logged set and every typed-but-not-✓ number must come back, with workout mode open. Pinned in Task 3 ("reload reopens workout mode", "typed value survives").
2. **A workout that runs past midnight** (or was started yesterday and left open). Finish must check off the lift on the workout's date, not today's. Pinned in Task 3 ("yesterday's workout checks off yesterday").
3. **A swapped exercise.** It must show its own last numbers and suggestion, and never write into the main lift's history. Pinned in Task 1 ("a swap keeps its own history", "swap uses the swap's history") and Task 3 ("swapped").
4. **Coming back to the app after a rest ended.** No stale beep, and the bar clears. A reload keeps the same rest end time. Pinned in Task 4 ("late return: no beep", "rest end kept across reload").
5. **Editing the plan.** An edit must not change a workout already in progress, and an emptied day must not start an empty workout. Pinned in Task 5 ("active workout untouched by edits", "empty day doesn't start").

---

## Pre-flight

- [ ] `git status`: clean, on `main` at `50a60ba` or later. (`main` is 1 commit ahead of `origin/main`: the step T spec.)
- [ ] `python tests/run.py`: expect static 4/4, backup-core 36/36, coach-core 87/87, food-core 194/194 and injury 43/43, exit code 0. Note the counts.
- [ ] `git switch -c batch1-stepT`

---

### Task 1: Lift logic, backup keys and v36

**Files:**
- Create: `lift-core.js`, `tests/lift-core.test.html`
- Modify: `index.html` (script tag after `food-core.js`), `sw.js` (line 1 → `weight-tracker-v36`; `ASSETS` gains `"./lift-core.js"` after `"./food-core.js"`), `version.js` (`APP_VERSION = 36`), `backup-core.js` lines 8 and 16, `tests/backup-core.test.html`

**Interfaces:**
- Consumes: `parseLocalDate` (coach-core.js).
- Produces (all global, pure):
  - `LIFT_EXERCISES: { [id]: { name, type: "weighted"|"bodyweight"|"timed", swaps: id[] } }`, `LIFT_DAYS: { upperA|lowerA|upperB|lowerB: { name, lower: boolean } }`, `LIFT_DAY_ORDER`, `LIFT_WEEKDAYS`, `NEW_WEIGHTED_HINT`
  - `exerciseName(id) -> string`, `liftDayName(day) -> string`
  - `restFor(type, repMax) -> seconds`, `cleanRow(row) -> row`, `newPlanRow(exId) -> row`, `liftPlan(stored) -> { days, dayByWeekday }`
  - A plan row is `{ exId, baseId, sets, repMin, repMax, rest }`. For a timed row, `repMin`/`repMax` are minutes and `sets` is 1.
  - `swapOptions(row) -> id[]`, `liftDayFor(plan, dateStr, sessions) -> day`
  - `exerciseHistory(sessions, exId) -> [{ date, sets }]` (newest first), `suggestNext(row, history) -> { kind: "new"|"up"|"down"|"hold", weight?, reps?, min?, text }`, `formatSets(type, sets) -> string`
  - `workoutExercise(row, sessions)`, `newWorkout(plan, day, dateStr, sessions, now) -> active`, `swapExercise(active, index, exId, sessions) -> active`, `workoutCounts(active) -> { done, total }`, `finishWorkout(active, now) -> session`, `sessionBests(session, priorSessions) -> exId[]`
  - `restLeft(restEndsAt, now) -> seconds`, `adjustRest(restEndsAt, now, deltaSec) -> ms|null`
  - Active workout: `{ id, date, day, start, restEndsAt, exercises: [{ ...row, skipped, log: [{ w, reps, min, done }], suggestion, last }] }`. Session: `{ id, date, day, start, end, exercises: [{ exId, baseId, sets: [{ w, reps, min }] }] }`.

- [ ] **Step 1: Write the failing tests.** Create `tests/lift-core.test.html`:

```html
<!DOCTYPE html>
<html><body><pre id="out"></pre>
<script src="test-utils.js"></script>
<script src="../coach-core.js"></script>
<script src="../lift-core.js"></script>
<script>
run(() => {
  // ---- catalog and default plan ----
  const ids = Object.keys(LIFT_EXERCISES);
  eq("every swap is in the catalog", ids.flatMap((id) => LIFT_EXERCISES[id].swaps).filter((s) => !LIFT_EXERCISES[s]), []);
  eq("timed swaps stay timed", ids.filter((id) => LIFT_EXERCISES[id].swaps.some((s) => (LIFT_EXERCISES[s].type === "timed") !== (LIFT_EXERCISES[id].type === "timed"))), []);
  eq("no hip thrusts", ids.filter((id) => /thrust/i.test(LIFT_EXERCISES[id].name)), []);
  const plan = liftPlan(null);
  eq("four days", Object.keys(plan.days), ["upperA", "lowerA", "upperB", "lowerB"]);
  eq("weekday map", plan.dayByWeekday, { 1: "upperA", 3: "lowerA", 5: "upperB", 6: "lowerB" });
  eq("Upper A lineup", plan.days.upperA.map((r) => [r.exId, r.sets, r.repMin, r.repMax, r.rest]), [
    ["bench-press", 3, 6, 8, 120], ["seated-cable-row", 3, 8, 10, 120], ["seated-db-press", 3, 8, 10, 120],
    ["lat-pulldown", 3, 10, 12, 75], ["triceps-pushdown", 2, 12, 15, 75], ["db-curl", 2, 12, 15, 75]]);
  eq("Lower A lineup", plan.days.lowerA.map((r) => r.exId),
    ["leg-extension", "seated-leg-curl", "glute-bridge", "sl-leg-extension", "hip-abduction", "hip-adduction", "machine-crunch", "arm-bike"]);
  eq("Upper B lineup", plan.days.upperB.map((r) => r.exId),
    ["incline-db-press", "close-grip-pulldown", "machine-row", "machine-shoulder-press", "cable-lateral-raise", "face-pull", "hammer-curl", "overhead-triceps"]);
  eq("Lower B lineup", plan.days.lowerB.map((r) => r.exId),
    ["seated-leg-curl", "leg-extension", "glute-bridge", "sl-leg-curl", "hip-abduction", "hip-adduction", "dead-bug", "arm-bike"]);
  eq("Lower B is the lighter day", plan.days.lowerB.slice(1, 3).map((r) => [r.repMin, r.repMax]), [[12, 15], [12, 15]]);
  eq("arm bike is 1 × 8 min, no rest", ["sets", "repMin", "repMax", "rest"].map((k) => plan.days.lowerA[7][k]), [1, 8, 8, 0]);
  eq("lower days stay off the ankle", [...plan.days.lowerA, ...plan.days.lowerB]
    .flatMap((r) => [r.exId, ...LIFT_EXERCISES[r.baseId].swaps])
    .filter((id) => /squat|lunge|step-up|calf|jump|sled|rower|run|press|standing|kneeling/i.test(exerciseName(id))), []);
  eq("day names", LIFT_DAY_ORDER.map(liftDayName), ["Upper A", "Lower A", "Upper B", "Lower B"]);
  eq("lower flags", LIFT_DAY_ORDER.map((d) => LIFT_DAYS[d].lower), [false, true, false, true]);

  // ---- stored plans ----
  const edited = liftPlan({ days: { upperA: [{ exId: "db-bench-press", baseId: "bench-press", sets: "4", repMin: 8, repMax: 6, rest: 90 }, { exId: "nope", sets: 3 }] } });
  eq("stored day wins, unknown dropped, reps fixed", edited.days.upperA, [{ exId: "db-bench-press", baseId: "bench-press", sets: 4, repMin: 8, repMax: 8, rest: 90 }]);
  eq("missing days fall back to default", edited.days.lowerA.length, 8);
  eq("JSON round trip is stable", liftPlan(JSON.parse(JSON.stringify(edited))), edited);
  eq("an emptied day stays empty", liftPlan({ days: { upperB: [] } }).days.upperB, []);
  eq("clamps", cleanRow({ exId: "leg-extension", sets: 0, repMin: -3, repMax: 500, rest: 9999 }),
    { exId: "leg-extension", baseId: "leg-extension", sets: 1, repMin: 1, repMax: 100, rest: 600 });
  eq("default rest from reps", [cleanRow({ exId: "leg-extension", sets: 3, repMin: 8, repMax: 10 }).rest, cleanRow({ exId: "leg-extension", sets: 3, repMin: 12, repMax: 15 }).rest], [120, 75]);
  eq("new rows", [newPlanRow("push-up"), newPlanRow("arm-bike")], [
    { exId: "push-up", baseId: "push-up", sets: 3, repMin: 10, repMax: 12, rest: 75 },
    { exId: "arm-bike", baseId: "arm-bike", sets: 1, repMin: 8, repMax: 8, rest: 0 }]);
  eq("swap options", swapOptions({ exId: "db-bench-press", baseId: "bench-press" }), ["bench-press", "machine-chest-press", "push-up"]);
  eq("good-leg slot swaps", swapOptions(plan.days.lowerA[3]), ["sl-leg-curl"]);

  // ---- which day ----  2026-10-26 Mon, 27 Tue, 28 Wed, 30 Fri, 31 Sat
  eq("day by weekday", ["2026-10-26", "2026-10-28", "2026-10-30", "2026-10-31"].map((d) => liftDayFor(plan, d, [])), ["upperA", "lowerA", "upperB", "lowerB"]);
  eq("unmapped day, no history: Upper A", liftDayFor(plan, "2026-10-27", []), "upperA");
  eq("unmapped day: next after the last session", liftDayFor(plan, "2026-10-27", [{ day: "upperA", start: 1 }, { day: "upperB", start: 2 }]), "lowerB");
  eq("rotation wraps", liftDayFor(plan, "2026-10-27", [{ day: "lowerB", start: 5 }]), "upperA");

  // ---- history and suggestions ----
  const S = (start, exId, sets) => ({ id: `s${start}`, date: "2026-10-20", day: "upperA", start, end: start + 1, exercises: [{ exId, baseId: exId, sets }] });
  const W = (w, ...reps) => reps.map((r) => ({ w, reps: r, min: null }));
  const B = (...reps) => reps.map((r) => ({ w: null, reps: r, min: null }));
  const bench = plan.days.upperA[0]; // 3 × 6–8
  const sessions = [S(1, "bench-press", W(95, 6, 6, 5)), S(3, "bench-press", W(95, 8, 8, 8)), S(2, "db-bench-press", W(40, 10, 10, 9))];
  eq("history newest first, per exercise", exerciseHistory(sessions, "bench-press").map((h) => h.sets[0].reps), [8, 6]);
  eq("a swap keeps its own history", exerciseHistory(sessions, "db-bench-press").length, 1);
  eq("no history", suggestNext(bench, []), { kind: "new", weight: null, reps: null, text: NEW_WEIGHTED_HINT });
  eq("all top reps: +5", suggestNext(bench, exerciseHistory(sessions, "bench-press")), { kind: "up", weight: 100, reps: 6, text: "↑ Try 100 lb" });
  eq("fewer sets than planned: no increase", suggestNext(bench, [{ sets: W(95, 8, 8) }]).kind, "hold");
  eq("in range: hold", suggestNext(bench, [{ sets: W(95, 8, 7, 6) }]), { kind: "hold", weight: 95, reps: null, text: "Beat last time's reps." });
  eq("one miss: hold", suggestNext(bench, [{ sets: W(95, 6, 5, 5) }, { sets: W(95, 7, 7, 6) }]).kind, "hold");
  eq("two misses: -10%", suggestNext(bench, [{ sets: W(100, 6, 5, 4) }, { sets: W(100, 5, 5, 5) }]),
    { kind: "down", weight: 90, reps: 6, text: "↓ Two tough sessions. Drop to 90 lb." });
  eq("-10% rounds to 5 lb and always drops", [25, 55, 10].map((w) => suggestNext(bench, [{ sets: W(w, 4, 4, 4) }, { sets: W(w, 4, 4, 4) }]).weight), [20, 50, 5]);
  eq("5 lb never drops below 5", suggestNext(bench, [{ sets: W(5, 4, 4, 4) }, { sets: W(5, 4, 4, 4) }]).kind, "hold");
  const bridge = plan.days.lowerA[2]; // 3 × 10–12, 0 lb = bodyweight
  eq("bridge tops out at BW: add a dumbbell", suggestNext(bridge, [{ sets: W(0, 12, 12, 12) }]), { kind: "up", weight: 5, reps: 10, text: "↑ Add a 5 lb dumbbell" });
  const pushRow = { exId: "push-up", baseId: "bench-press", sets: 3, repMin: 6, repMax: 8, rest: 120 };
  eq("bodyweight: all top → one more rep", suggestNext(pushRow, [{ sets: B(8, 9, 8) }]), { kind: "up", reps: 10, text: "↑ All reps hit. Aim for 10." });
  eq("bodyweight: first time", suggestNext(pushRow, []), { kind: "new", reps: null, text: "First time: aim for 6–8 clean reps." });
  eq("bodyweight: hold has no weight", suggestNext(pushRow, [{ sets: B(6, 6, 6) }]), { kind: "hold", reps: null, text: "Beat last time's reps." });
  const bike = plan.days.lowerA[7];
  eq("timed: first time uses the plan", suggestNext(bike, []), { kind: "new", min: 8, text: "" });
  eq("timed: last time", suggestNext(bike, [{ sets: [{ w: null, reps: null, min: 10 }] }]), { kind: "hold", min: 10, text: "" });
  eq("format weighted", formatSets("weighted", W(50, 10, 10, 8)), "50 lb × 10, 10, 8");
  eq("format mixed weights", formatSets("weighted", [...W(50, 10), ...W(55, 8)]), "50 lb × 10, 55 lb × 8");
  eq("format BW bridge", formatSets("weighted", W(0, 12, 12)), "BW × 12, 12");
  eq("format bodyweight", formatSets("bodyweight", B(12, 10)), "12, 10 reps");
  eq("format timed", formatSets("timed", [{ min: 8 }]), "8 min");

  // ---- workouts ----
  const w = newWorkout(plan, "upperA", "2026-10-26", sessions, 1000);
  eq("workout shape", [w.id, w.date, w.day, w.start, w.restEndsAt, w.exercises.length], ["lift-1000", "2026-10-26", "upperA", 1000, null, 6]);
  const blank = { w: null, reps: null, min: null, done: false };
  eq("bench pre-filled from the suggestion", w.exercises[0].log, [0, 1, 2].map(() => ({ w: 100, reps: 6, min: null, done: false })));
  eq("last session kept for display", w.exercises[0].last.sets.length, 3);
  eq("hold pre-fills last time's reps per set", newWorkout(plan, "upperA", "x", [S(1, "bench-press", W(95, 8, 7))], 1).exercises[0].log.map((s) => [s.w, s.reps]), [[95, 8], [95, 7], [95, 7]]);
  eq("new exercise is blank", [w.exercises[1].log[0], w.exercises[1].last], [blank, null]);
  eq("timed row", newWorkout(plan, "lowerA", "x", [], 1).exercises[7].log, [{ ...blank, min: 8 }]);
  const swapped = swapExercise(w, 0, "db-bench-press", sessions);
  eq("swap uses the swap's history", [swapped.exercises[0].exId, swapped.exercises[0].baseId, swapped.exercises[0].suggestion.kind, swapped.exercises[0].log[0].w], ["db-bench-press", "bench-press", "up", 45]);
  eq("swap keeps the slot's sets and reps", [swapped.exercises[0].sets, swapped.exercises[0].repMin, swapped.exercises[0].repMax], [3, 6, 8]);
  eq("swap leaves the rest alone", swapped.exercises.slice(1), w.exercises.slice(1));
  const logged = { ...w, exercises: w.exercises.map((ex, i) => (i === 0 ? { ...ex, log: ex.log.map((s, j) => ({ ...s, done: j < 2 })) } : ex)) };
  eq("no swap after a logged set", swapExercise(logged, 0, "push-up", sessions), logged);
  eq("counts", workoutCounts(logged), { done: 2, total: 16 });
  const skipped = { ...logged, exercises: logged.exercises.map((ex, i) => (i === 5 ? { ...ex, skipped: true } : ex)) };
  eq("skipped exercises don't count", workoutCounts(skipped), { done: 2, total: 14 });
  eq("finish keeps done sets only", finishWorkout(logged, 5000), { id: "lift-1000", date: "2026-10-26", day: "upperA", start: 1000, end: 5000,
    exercises: [{ exId: "bench-press", baseId: "bench-press", sets: [{ w: 100, reps: 6, min: null }, { w: 100, reps: 6, min: null }] }] });

  // ---- new bests ----
  const one = (exId, sets) => ({ exercises: [{ exId, baseId: exId, sets }] });
  eq("best by estimated max", sessionBests(one("bench-press", W(100, 8)), sessions), ["bench-press"]);
  eq("not a best", sessionBests(one("bench-press", W(95, 7)), sessions), []);
  eq("more reps at the same weight is a best", sessionBests(one("bench-press", W(95, 9)), sessions), ["bench-press"]);
  eq("first time is never a best", sessionBests(one("lat-pulldown", W(80, 10)), sessions), []);
  eq("BW reps count", sessionBests(one("glute-bridge", W(0, 15)), [S(1, "glute-bridge", W(0, 12))]), ["glute-bridge"]);
  eq("timed never", sessionBests(one("arm-bike", [{ w: null, reps: null, min: 12 }]), [S(1, "arm-bike", [{ w: null, reps: null, min: 8 }])]), []);

  // ---- rest timer math ----
  eq("rest left", [restLeft(null, 0), restLeft(10500, 0), restLeft(1000, 5000)], [0, 11, 0]);
  eq("rest +15 / -15", [adjustRest(60000, 0, 15), adjustRest(60000, 0, -15), adjustRest(10000, 0, -15), adjustRest(0, 5000, 15)], [75000, 45000, null, 20000]);
});
</script></body></html>
```

- [ ] **Step 2: Add the backup tests.** In `tests/backup-core.test.html`, append inside `run(() => { ... })` before its closing `});`:

```js
  // Step T: workouts are backed up, and a logged one counts as user data.
  eq("lift keys are backed up", ["lift-plan", "lift-sessions", "lift-active"].map(isBackupKey), [true, true, true]);
  eq("a logged workout is user data", hasUserData(fakeStorage({ "lift-sessions": '[{"id":"s1"}]' })), true);
```

- [ ] **Step 3: Run, expect failure.** `python tests/run.py`. Expected: `lift-core.test.html` reports an `ERROR` (no `liftPlan`), and backup-core fails the 2 new checks.

- [ ] **Step 4: Implement.** Create `lift-core.js`:

```js
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
  return { ...hold, weight: w };
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
```

> `W`, `BW`, `TIMED` and `ex` are free as top-level names today (checked on 2026-10-25). The test page's own `W` is local to its `run` callback.

Then:
- In `backup-core.js`, line 8 becomes `const BACKUP_PREFIXES = ["weight-tracker-", "coach-", "food-", "ui-", "savings-", "lift-"];`. Line 16 adds `"lift-sessions"` to the end of `USER_DATA_KEYS`.
- In `index.html`, add `<script src="lift-core.js"></script>` right after `<script src="food-core.js"></script>`.
- In `sw.js`, line 1 becomes `const CACHE_NAME = "weight-tracker-v36";`, and `"./lift-core.js",` goes after `"./food-core.js",`.
- In `version.js`, set `const APP_VERSION = 36;`.

- [ ] **Step 5: Run, expect pass.** `python tests/run.py`. Expected: static 4/4, backup-core 38/38, lift-core N/N passed, and the others unchanged. Exit code 0. Then `python .claude/skills/phone-preview/preview.py`. Expected: no JS errors on any tab.

- [ ] **Step 6: Commit** (with approval):

```bash
git add lift-core.js tests/lift-core.test.html backup-core.js tests/backup-core.test.html index.html sw.js version.js
git commit -m "Step T lift logic: catalog, 4-day plan, progression, workout shapes, rest math; lift keys backed up; v36"
```

---

### Task 2: Injury mode for step T (Monday lift, history, backlog)

**Files:**
- Modify: `coach-core.js` (injury section, lines 142–229), `coach.js` (keys at line 12; `loadInjury`/`scheduleFor` at lines 49–57; `completionStreak` call at line 164), `injury.js`, `food.js` (`injuryPainFlag` call at line 308)
- Test: `tests/injury.test.html`, `tests/ui/injury.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `INJURY_LIFT_AVOID: string` (coach-core.js, global). `INJURY_LIFT_NOTE` now ends with it.
  - `injuryOn(injuries: injury | injury[] | null, dateStr) -> injury | null`
  - `itemsForDate(dateStr, overrides, injuries)`: the third argument may be one injury or a list.
  - `endInjury(injury, todayStr) -> injury | null`. It returns `null` when `injury.start >= todayStr`.
  - `injuryDays(injury, dateStr) -> { day, total } | null`
  - `injuryPainFlag(feelLog, todayStr, pain, part?)`
  - `INJURY_PAST_KEY = "coach-injury-past"` and `loadInjuries() -> injury[]` (coach.js, global; current first, then past newest first)

- [ ] **Step 1: Write the failing logic tests.** In `tests/injury.test.html`, append inside `run(() => { ... })` before its closing `});`:

```js
  // ---- step T ----  2026-10-12 is a Monday inside inj; 10-26 is a Monday after it.
  eq("injured Monday gets a lift", ["lift", "post-lift"].map((id) => find("2026-10-12", id) && find("2026-10-12", id).time), ["18:30", "19:20"]);
  eq("Monday lift reads like the others", [find("2026-10-12", "lift").title, find("2026-10-12", "lift").kind, find("2026-10-12", "lift").note], ["Lift — 45 min", "train", INJURY_LIFT_NOTE]);
  eq("no Monday lift when not injured", has("2026-10-12", "lift", null), false);
  eq("no Monday lift after the injury", has("2026-10-26", "lift"), false);
  eq("Wednesday keeps one lift", itemsForDate("2026-10-14", {}, inj).filter((i) => i.id === "lift").length, 1);
  eq("lift note drops hip thrusts", /thrust/i.test(INJURY_LIFT_NOTE), false);
  eq("lift note still starts the same", INJURY_LIFT_NOTE.startsWith("Ankle-safe legs"), true);
  eq("lift note ends with the avoid list", INJURY_LIFT_NOTE.endsWith(INJURY_LIFT_AVOID), true);

  // History: a list of injuries, each shaping its own days. 09-07 and 09-28 are Mondays.
  const old = { part: "wrist", start: "2026-09-01", until: "2026-09-20", note: "", pt: [] };
  eq("injuryOn picks the active one", [injuryOn([inj, old], "2026-09-07"), injuryOn([inj, old], "2026-09-28"), injuryOn(inj, "2026-10-13"), injuryOn(null, "2026-10-13")], [old, null, inj, null]);
  eq("a past injury still shapes its days", itemsForDate("2026-09-07", {}, [inj, old]).some((x) => x.id === "game"), false);
  eq("between injuries: normal", itemsForDate("2026-09-28", {}, [inj, old]).some((x) => x.id === "game"), true);
  eq("a single injury still works", itemsForDate("2026-10-12", {}, inj).some((x) => x.id === "game"), false);

  // Ending: one that never ran a full day is removed, not left with until < start.
  eq("End on the start day removes it", endInjury({ ...inj, start: "2026-10-15" }, "2026-10-15"), null);
  eq("ending an upcoming one removes it", endInjury({ ...inj, start: "2026-10-20" }, "2026-10-15"), null);
  eq("injuryDays guards", [injuryDays({ part: "ankle", start: "2026-10-12" }, "2026-10-13"), injuryDays(null, "2026-10-13")], [null, null]);

  // Pain trend per body part: wrist pain this week must not raise the ankle's average.
  const mixed = [{ date: "2026-10-05", injuryPain: 3, injuryPart: "ankle" }, { date: "2026-10-12", injuryPain: 9, injuryPart: "wrist" }, { date: "2026-10-14", injuryPain: 2, injuryPart: "ankle" }];
  eq("pain trend ignores other parts", injuryPainFlag(mixed, "2026-10-14", 2, "ankle"), false);
  eq("no part given: every record", injuryPainFlag(mixed, "2026-10-14", 2), true);
```

- [ ] **Step 2: Run, expect failure.** `python tests/run.py`. Expected: injury.test.html fails the new checks, or reports an `ERROR` for `INJURY_LIFT_AVOID` / `injuryOn`.

- [ ] **Step 3: Implement in `coach-core.js`.**

Replace the `INJURY_LIFT_NOTE` line (149) with:

```js
const INJURY_LIFT_AVOID = "Ask PT first: leg press (feet high), RDLs. Avoid until cleared: squats, lunges, step-ups, calf raises, jumps, sled, rower, running.";
const INJURY_LIFT_NOTE = `Ankle-safe legs: leg extension, seated or lying leg curl, glute bridge (brace on), hip abduction/adduction. Single-leg work on the good leg. Upper body as normal. Finish with the arm bike or an upper-body circuit. ${INJURY_LIFT_AVOID}`;
```

In `injuryItems`, insert this between the `.map(...)` chain's closing `});` and the PT loop:

```js
  /* Step T: lifting takes Monday's league-game slot (Upper A). */
  if (parseLocalDate(dateStr).getDay() === 1 && !out.some((i) => i.id === "lift")) {
    out.push(
      { id: "lift", time: "18:30", title: "Lift — 45 min", kind: "train", note: INJURY_LIFT_NOTE },
      { id: "post-lift", time: "19:20", title: "Recovery snack (not chocolate milk)", kind: "meal", note: "Protein shake + banana." },
    );
  }
```

Replace `injuryDays`, `endInjury` and `injuryPainFlag` with:

```js
/* Day N of M, counting both the start day and the recheck day. */
function injuryDays(injury, dateStr) {
  if (!injury || !injury.start || !injury.until) return null;
  return { day: daysBetween(injury.start, dateStr) + 1, total: daysBetween(injury.start, injury.until) + 1 };
}

/* Ending keeps the injury (and its start) so past days still read as
   injured. One that hasn't run a full day yet (it starts today or
   later) has no history to keep, so it's removed instead (null). */
function endInjury(injury, todayStr) {
  if (injury.start >= todayStr) return null;
  return { ...injury, until: shiftDate(todayStr, -1) };
}

/* After a lift: flag pain of 4+, or a 7-day average above the 7 days
   before. `feelLog` already includes the check-in just saved. With
   `part`, only that body part's records count. */
function injuryPainFlag(feelLog, todayStr, pain, part) {
  if (pain >= 4) return true;
  const avg = (from, to) => {
    const xs = feelLog
      .filter((r) => typeof r.injuryPain === "number" && (!part || r.injuryPart === part) && r.date >= from && r.date <= to)
      .map((r) => r.injuryPain);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const thisWeek = avg(shiftDate(todayStr, -6), todayStr);
  const lastWeek = avg(shiftDate(todayStr, -13), shiftDate(todayStr, -7));
  return thisWeek !== null && lastWeek !== null && thisWeek > lastWeek;
}

/* The injury that was on that date, from one injury or a list (the
   current one first, then past ones). */
function injuryOn(injuries, dateStr) {
  const list = Array.isArray(injuries) ? injuries : [injuries];
  return list.find((i) => injuryActive(i, dateStr)) || null;
}
```

In `itemsForDate`, rename the parameter to `injuries` and replace the `if (injuryActive(...))` line:

```js
function itemsForDate(dateStr, overrides, injuries) {
  let base = WEEK_TEMPLATE[parseLocalDate(dateStr).getDay()];
  const injury = injuryOn(injuries, dateStr);
  if (injury) base = injuryItems(base, injury, dateStr);
```

Update its comment's first line to say "Applies Injury mode (whichever injury was on that date)". `completionStreak` passes its `injury` argument straight to `itemsForDate`, so a list works there unchanged. Add `INJURY_LIFT_AVOID` and `injuryOn` to `module.exports`.

- [ ] **Step 4: Implement in `coach.js`.** After line 12 add `const INJURY_PAST_KEY = "coach-injury-past";`. After `loadInjury()` add:

```js
/* The current injury first, then older ones newest first, so each past
   day is read with the injury that was on then. */
function loadInjuries() {
  return [loadInjury(), ...loadJSON(INJURY_PAST_KEY, []).slice().reverse()].filter(Boolean);
}
```

In `scheduleFor`, pass `loadInjuries()` instead of `loadInjury()`. In `renderTodaySummary` (line 164), pass `loadInjuries()` to `completionStreak`.

- [ ] **Step 5: Implement in `injury.js`.**

`injuryLine`:

```js
function injuryLine(injury, dateStr) {
  const days = injuryDays(injury, dateStr);
  if (!days) return capitalize(injury.part);
  return `${capitalize(injury.part)} · day ${days.day} of ${days.total} · recheck ${shortDate(injury.until)}`;
}
```

PT remove handler: after `const injury = loadInjury();` add `if (!injury) return;`.

After `recentInjury()`, add:

```js
/* Saves an ended injury, or, when endInjury dropped it (it never ran a
   full day), brings back the one before it so the card still reads
   "Off. Last one: ...". */
function finishInjury(ended) {
  if (ended) {
    saveJSON(INJURY_KEY, ended);
    return;
  }
  const past = loadJSON(INJURY_PAST_KEY, []);
  saveJSON(INJURY_KEY, past.pop() || null);
  saveJSON(INJURY_PAST_KEY, past);
}
```

In `renderInjury`, replace `document.getElementById("injury-end-btn").hidden = !active;` with:

```js
  const upcoming = Boolean(injury && injury.start > today);
  const endBtn = document.getElementById("injury-end-btn");
  endBtn.hidden = !active && !upcoming;
  endBtn.textContent = upcoming ? "Cancel this injury" : "End injury mode now";
```

In the form submit handler, just before `saveJSON(INJURY_KEY, { part, start, ... })`, keep the old record's history:

```js
  /* Starting a new injury keeps the old one, so its days stay injured. */
  const old = loadInjury();
  if (!current && old) saveJSON(INJURY_PAST_KEY, [...loadJSON(INJURY_PAST_KEY, []), old]);
```

Recheck Yes: replace `saveJSON(INJURY_KEY, endInjury(loadInjury(), dateStr));` with `finishInjury(endInjury(loadInjury(), dateStr));`.

Replace the End button handler:

```js
document.getElementById("injury-end-btn").addEventListener("click", () => {
  const injury = loadInjury();
  if (!injury) return;
  const today = todayLocalDateString();
  const upcoming = injury.start > today;
  if (!confirm(upcoming ? "Cancel this upcoming injury?" : "End injury mode? Games and runs come back on the schedule today.")) return;
  finishInjury(endInjury(injury, today));
  injuryEditing = false;
  renderInjury();
  renderToday();
  showToast(upcoming ? "Injury cancelled" : "Injury mode off. Games and runs are back on the schedule.");
});
```

- [ ] **Step 6: Implement in `food.js`.** Line 308: `if (pain !== undefined && injuryPainFlag(log, dateStr, pain, injuredPart)) showToast(PAIN_WARNING);`

- [ ] **Step 7: Write the UI tests.** In `tests/ui/injury.js`, append at the end:

```js
// ---- step T ----
// An upcoming injury can be cancelled.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(2), day(10)) });
app().confirm = () => true;
eq("upcoming: Cancel shown", [$("#injury-end-btn").hidden, $("#injury-end-btn").textContent], [false, "Cancel this injury"]);
click("#injury-end-btn");
eq("cancel removes it", ls("coach-injury"), null);
eq("cancel toast", $("#toast-text").textContent, "Injury cancelled");

// End on the start day drops it and the one before comes back.
const wrist = { part: "wrist", start: day(-60), until: day(-40), note: "", pt: [] };
await reload({ "coach-started-at": "0", "coach-injury": ankle(today, day(10)), "coach-injury-past": [wrist] });
app().confirm = () => true;
click("#injury-end-btn");
eq("same-day End brings back the last one", [ls("coach-injury"), ls("coach-injury-past")], [wrist, []]);
check("no chip after same-day End", !$(".injury-chip"));

// A new injury keeps the old one's history.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-30), day(-20)) });
click("#injury-edit-btn");
fill("#injury-part", "wrist");
fill("#injury-start", today);
fill("#injury-until", day(10));
$("#injury-form").requestSubmit();
eq("old injury moved to history", ls("coach-injury-past").map((i) => [i.part, i.start]), [["ankle", day(-30)]]);
eq("new one is current", ls("coach-injury").part, "wrist");
eq("past days read the old injury", app().injuryOn(app().loadInjuries(), day(-25)).part, "ankle");

// Coming back to the app re-renders Today (coach.js), so the chip appears.
await reload({ "coach-started-at": "0", "coach-injury": null });
check("no chip before", !$(".injury-chip"));
app().saveJSON("coach-injury", ankle(day(-3), day(10)));
app().document.dispatchEvent(new Event("visibilitychange"));
check("chip after visibilitychange", Boolean($(".injury-chip")));

// Injured Monday: the lift shows on Today only on a Monday.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-3), day(10)) });
const isMonday = new Date(`${today}T12:00`).getDay() === 1;
if (isMonday) check("injured Monday shows the lift", Boolean(item(LIFT)));
check("every injured Monday in range has a lift", Array.from({ length: 14 }, (_, i) => day(i - 3))
  .filter((d) => new Date(`${d}T12:00`).getDay() === 1)
  .every((d) => app().scheduleFor(d).some((i) => i.id === "lift")));
```

- [ ] **Step 8: Run, expect pass.** `python tests/run.py`: injury passes 43 + 17 = 60/60, and everything else is unchanged. Then `python .claude/skills/phone-preview/preview.py --interact tests/ui/injury.js --interact tests/ui/feel-checkin.js --interact tests/ui/snack-ideas.js --interact tests/ui/water-pouches.js`, and the same with `--dark`. Expected: all PASS, 0 JS errors.

- [ ] **Step 9: Commit** (with approval):

```bash
git add coach-core.js coach.js injury.js food.js tests/injury.test.html tests/ui/injury.js
git commit -m "Injury mode for step T: injured-Monday lift, injury history, cancel upcoming, same-day End, pain trend per part, guards"
```

---

### Task 3: Workout mode

**Files:**
- Create: `lift.js`, `tests/ui/workout.js`
- Modify: `index.html` (workout markup, the Today bar, a `lift.js` script tag after `injury.js`), `sw.js` (`ASSETS` gains `"./lift.js"` after `"./injury.js"`), `coach.js` (`renderChecklistItem`, after the note line 244), `food.js` (feel save, line 298–303), `style.css` (append)

**Interfaces:**
- Consumes: everything Task 1 produces; `loadInjuries`, `injuryOn`, `INJURY_LIFT_AVOID` (Task 2); `loadJSON`, `saveJSON`, `el`, `setCheckin`, `scheduleFor`, `renderToday`, `feelOpenFor` (coach.js); `activateTab`, `formatDuration`, `todayLocalDateString` (app.js); `showToast`, `haptic` (ui.js).
- Produces (global): `LIFT_PLAN_KEY`, `LIFT_SESSIONS_KEY`, `LIFT_ACTIVE_KEY`; `liftStartButton(dateStr) -> HTMLButtonElement`; `startWorkout(dateStr)`; `openWorkout()`; `tickWorkout()`; `liftSessionId(dateStr) -> string|undefined`; `actionBtn(label, onClick, cls?)`; `finishActive()`; `discardWorkout()`; `loadSessions`, `loadActive`, `saveActive`, `currentPlan` (const arrows: shared with later scripts, but not reachable from `app()`).

- [ ] **Step 1: Write the failing UI test.** Create `tests/ui/workout.js`:

```js
// Workout mode (step T): start from Today, log sets, swap and skip,
// minimize and resume, reload mid-workout, then Stop → Finish / Discard.
const LIFT = "Lift — 45 min";
const keepAll = () => Object.fromEntries(Object.keys(app().localStorage).map((k) => [k, app().localStorage.getItem(k)]));
const liftToday = async (extra = {}) => {
  await reload({ "coach-started-at": "0", "coach-injury": null, ...extra });
  if (!item(LIFT)) {
    // Keep any other day's overrides from `extra` (the yesterday case below).
    await reload({ "coach-started-at": "0", "coach-injury": null, ...extra,
      "coach-overrides": { ...(extra["coach-overrides"] || {}), [today]: { removed: [], moved: {}, added: [{ id: "lift", time: "06:00", title: LIFT, kind: "train" }] } } });
  }
};
const exs = () => $$(".workout-ex");

await liftToday();
const start = $(".lift-start-btn", item(LIFT));
check("lift item has Start workout", Boolean(start) && start.textContent.startsWith("Start workout"));
click(start);
check("workout mode open", !$("#workout").hidden);
const active = ls("lift-active");
eq("active workout saved on start", [active.date, active.day], [today, app().liftDayFor(app().liftPlan(null), today, [])]);
eq("first exercise shown", $(".workout-ex-name", exs()[0]).textContent, app().exerciseName(active.exercises[0].exId));
check("first-time hint", $(".workout-ex-last", exs()[0]).textContent.startsWith("First time"));
check("bar hidden while open", $("#workout-bar").hidden);

// Log a set; a blank one can't be logged.
fill($(".set-w", exs()[0]), "45");
fill($(".set-reps", exs()[0]), "8");
eq("typed numbers saved before ✓", [ls("lift-active").exercises[0].log[0].w, ls("lift-active").exercises[0].log[0].reps], [45, 8]);
click(".set-check", exs()[0]);
eq("set logged", ls("lift-active").exercises[0].log[0].done, true);
check("row marked done", $$(".set-row", exs()[0])[0].classList.contains("done"));
check("no Swap after a logged set", !byText("Swap", exs()[0]));
check("day locked after a set", $("#workout-day").disabled);
click(".set-check", $$(".set-row", exs()[0])[1]);
eq("blank set not logged", ls("lift-active").exercises[0].log[1].done, false);

// Swap and skip the second exercise.
clickText("Swap", exs()[1]);
const opt = app().swapOptions(ls("lift-active").exercises[1])[0];
clickText(app().exerciseName(opt), exs()[1]);
eq("swapped", ls("lift-active").exercises[1].exId, opt);
eq("swap shown", $(".workout-ex-name", exs()[1]).textContent, app().exerciseName(opt));
clickText("Skip", exs()[1]);
eq("skipped", ls("lift-active").exercises[1].skipped, true);
check("skipped looks skipped", exs()[1].classList.contains("skipped") && !$(".set-row", exs()[1]));
clickText("Unskip", exs()[1]);
eq("unskipped", ls("lift-active").exercises[1].skipped, false);

// Minimize and resume.
click("#workout-min");
check("minimized", $("#workout").hidden);
check("bar on Today", !$("#workout-bar").hidden && $("#workout-bar").textContent.startsWith("Workout in progress"));
eq("lift item says Resume", $(".lift-start-btn", item(LIFT)).textContent, "Resume workout");
click("#workout-bar");
check("bar reopens it", !$("#workout").hidden);

// Reload mid-workout: logged and typed-only numbers both come back.
fill($(".set-reps", $$(".set-row", exs()[0])[1]), "7");
await reload(keepAll());
check("reload reopens workout mode", !$("#workout").hidden);
eq("logged set survives", ls("lift-active").exercises[0].log[0].done, true);
eq("typed value survives", $(".set-reps", $$(".set-row", exs()[0])[1]).value, "7");

// Stop → Finish.
click("#workout-stop");
check("finish panel", !$("#workout-finish").hidden && $("#workout-finish").textContent.includes("1 set"));
clickText("Finish", $("#workout-finish"));
check("closed", $("#workout").hidden);
const sessions = ls("lift-sessions");
eq("session saved", sessions.map((s) => [s.date, s.exercises.length, s.exercises[0].sets[0].w, s.exercises[0].sets[0].reps]), [[today, 1, 45, 8]]);
eq("active cleared", ls("lift-active"), null);
eq("lift checked off", ls("coach-checkins")[`${today}|lift`].status, "done");
check("no bar after finishing", $("#workout-bar").hidden);
check("how did it go opens", Boolean($(".feel-panel", item(LIFT))));
clickText("3", $$(".feel-panel .chip-row", item(LIFT))[0]);
clickText("Save", item(LIFT));
eq("check-in links the session", ls("coach-feel-log").at(-1).workoutId, sessions[0].id);

// Next time: last numbers shown and pre-filled.
click(".check-box", item(LIFT)); // undo the check-off so Start shows again
click($(".lift-start-btn", item(LIFT)));
eq("last time shown", $(".workout-ex-last", exs()[0]).textContent, "Last: 45 lb × 8");
eq("pre-filled from last time", [$(".set-w", exs()[0]).value, $(".set-reps", exs()[0]).value], ["45", "8"]);

// Finish needs a set; Discard throws the workout away.
click("#workout-stop");
check("Finish needs a set", byText("Finish", $("#workout-finish")).disabled);
clickText("Keep going", $("#workout-finish"));
check("Keep going hides the panel", $("#workout-finish").hidden && !$("#workout").hidden);
app().confirm = () => true;
click("#workout-stop");
clickText("Discard", $("#workout-finish"));
eq("discard drops the workout", [ls("lift-active"), ls("lift-sessions").length], [null, 1]);
check("discard closes", $("#workout").hidden);

// A workout from yesterday (left open past midnight) checks off yesterday.
const yesterdays = app().newWorkout(app().liftPlan(null), "upperA", day(-1), [], Date.now() - 3600e3);
await liftToday({ "lift-active": yesterdays,
  "coach-overrides": { [day(-1)]: { removed: [], moved: {}, added: [{ id: "lift", time: "06:00", title: LIFT, kind: "train" }] } } });
check("yesterday's workout reopens", !$("#workout").hidden);
fill($(".set-w", exs()[0]), "50");
fill($(".set-reps", exs()[0]), "8");
click(".set-check", exs()[0]);
click("#workout-stop");
clickText("Finish", $("#workout-finish"));
check("yesterday's workout checks off yesterday", Boolean(ls("coach-checkins")[`${day(-1)}|lift`]) && !ls("coach-checkins")[`${today}|lift`]);
```

- [ ] **Step 2: Run, expect failure.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/workout.js`. Expected: FAIL at "lift item has Start workout".

- [ ] **Step 3: Add the markup.** In `index.html`:

In `#today-panel`, right before `<section class="card glass-card hero">`:

```html
      <button type="button" id="workout-bar" class="workout-bar" hidden></button>
```

After the `#photo-modal` block's closing `</div>` (before the sheets), add:

```html
  <!-- Workout mode (step T, lift.js): full screen, no swipe-to-close. -->
  <div id="workout" class="workout-mode" role="dialog" aria-label="Workout" hidden>
    <header class="workout-head">
      <button type="button" id="workout-min" class="pill-btn" aria-label="Minimize workout">–</button>
      <div class="workout-title">
        <select id="workout-day" aria-label="Workout day"></select>
        <span id="workout-clock" class="workout-clock">0:00</span>
      </div>
      <button type="button" id="workout-stop" class="pill-btn danger">Stop</button>
    </header>
    <p class="hint workout-note" id="workout-note" hidden></p>
    <div class="workout-body" id="workout-body"></div>
    <div class="workout-finish" id="workout-finish" hidden></div>
  </div>
```

Add `<script src="lift.js"></script>` right after `<script src="injury.js"></script>`. In `sw.js` add `"./lift.js",` after `"./injury.js",`.

- [ ] **Step 4: Create `lift.js`:**

```js
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
```

- [ ] **Step 5: Hook up Today and the check-in.**

In `coach.js` `renderChecklistItem`, right after `if (note && !checkin) body.appendChild(el("div", "check-note", note));`:

```js
  // Step T: today's lift opens workout mode (lift.js).
  if (item.id === "lift" && !checkin && dateStr === todayLocalDateString() && typeof liftStartButton === "function") {
    body.appendChild(liftStartButton(dateStr));
  }
```

In `food.js` `renderFeelPanel`'s save handler, add `workoutId` to the pushed record, after `note: ..., ate,`:

```js
      workoutId: item.id === "lift" && typeof liftSessionId === "function" ? liftSessionId(dateStr) : undefined,
```

- [ ] **Step 6: Styles.** Append to `style.css`:

```css
/* ---- Workout mode (step T) ---- */
body.workout-open {
  overflow: hidden;
}

.workout-bar {
  display: block;
  width: 100%;
  margin: 0 0 12px;
  padding: 12px 16px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--train);
  color: #fff;
  font: inherit;
  font-weight: 600;
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.workout-mode {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  padding: calc(env(safe-area-inset-top) + 8px) 16px calc(env(safe-area-inset-bottom) + 8px);
}

.workout-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.workout-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.workout-title select {
  font: inherit;
  font-size: 17px;
  font-weight: 700;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: center;
}

.workout-clock {
  font-size: 14px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.workout-note {
  margin: 8px 0 0;
}

.workout-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0 112px;
}

.workout-ex {
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--card-shadow);
}

.workout-ex.skipped {
  opacity: 0.5;
}

.workout-ex-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.workout-ex-name {
  font-weight: 600;
  min-width: 0;
}

.workout-ex-target,
.workout-ex-last {
  font-size: 13px;
  color: var(--text-2);
}

.workout-ex-target {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.workout-ex-suggest {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--train);
}

.workout-ex-suggest.down {
  color: var(--warn);
}

.set-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.set-num {
  width: 18px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.set-x {
  color: var(--text-2);
  font-size: 14px;
}

/* 17px keeps iOS from zooming in on focus. */
.set-row input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--sep);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}

.set-row.done input {
  opacity: 0.6;
}

.set-check {
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid var(--sep);
  border-radius: 50%;
  background: transparent;
  color: var(--text-3);
  font-size: 18px;
}

.set-row.done .set-check {
  border-color: var(--good);
  background: var(--good);
  color: #fff;
}

.workout-ex-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.workout-swaps {
  margin-top: 8px;
}

.workout-finish {
  position: absolute;
  z-index: 2;
  left: 16px;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom) + 16px);
  padding: 16px;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--glass-shadow);
}

.workout-bests {
  color: var(--good);
  font-weight: 600;
}
```

- [ ] **Step 7: Run, expect pass.** `python tests/run.py` (exit 0). Then `python .claude/skills/phone-preview/preview.py --interact tests/ui/workout.js --interact tests/ui/feel-checkin.js --interact tests/ui/injury.js --interact tests/ui/redesign.js --budget 40000`, and the same with `--dark`. Expected: all PASS, 0 JS errors. Read the final screenshot (workout mode open with one done set) in both themes, looking for clipped names, wrapped targets and overlap with the header.

- [ ] **Step 8: Commit** (with approval):

```bash
git add lift.js tests/ui/workout.js index.html sw.js coach.js food.js style.css
git commit -m "Workout mode: Start from the lift item, log sets, swap/skip, minimize/resume, survives reloads, Stop → Finish/Discard"
```

---

### Task 4: Rest timer

**Files:**
- Modify: `lift.js`, `index.html` (rest bar inside `#workout`), `style.css` (append)
- Create: `tests/ui/rest-timer.js`

**Interfaces:**
- Consumes: `restLeft`, `adjustRest` (Task 1); `loadActive`, `saveActive`, `tickWorkout`, `toggleSet`, `closeWorkout` (Task 3).
- Produces (global): `beep()` (a function declaration, so tests can replace `app().beep`), `startRest(seconds)`, `updateRest(endMs|null)`, `tickRest(active)`, `unlockAudio()`.

- [ ] **Step 1: Write the failing UI test.** Create `tests/ui/rest-timer.js`:

```js
// Rest timer (step T): starts on ✓, −15 / +15 / Skip, beeps once when a
// rest just ended, stays quiet on a late return, and survives a reload.
const keepAll = () => Object.fromEntries(Object.keys(app().localStorage).map((k) => [k, app().localStorage.getItem(k)]));
await reload({ "coach-started-at": "0", "coach-injury": null,
  "lift-active": app().newWorkout(app().liftPlan(null), "upperA", today, [], Date.now()) });
const ex0 = () => $$(".workout-ex")[0];
check("workout reopened", !$("#workout").hidden);
check("no rest bar yet", $("#rest-bar").hidden);

fill($(".set-w", ex0()), "95");
fill($(".set-reps", ex0()), "8");
click(".set-check", ex0());
const end1 = ls("lift-active").restEndsAt;
const left = end1 - Date.now();
check("bench rests 2:00", left > 118000 && left <= 120000, String(left));
check("rest bar shows", !$("#rest-bar").hidden && /^[12]:\d\d$/.test($("#rest-time").textContent), $("#rest-time").textContent);
click("#rest-plus");
check("+15 s", Math.abs(ls("lift-active").restEndsAt - end1 - 15000) < 100);
click("#rest-minus");
click("#rest-minus");
check("−15 s twice", Math.abs(ls("lift-active").restEndsAt - end1 + 15000) < 100);
click("#rest-skip");
check("Skip hides the bar", $("#rest-bar").hidden && ls("lift-active").restEndsAt === null);

// A rest that just ended: one beep and a flash.
let beeps = 0;
app().beep = () => { beeps++; };
const a2 = ls("lift-active");
a2.restEndsAt = Date.now() - 500;
app().saveJSON("lift-active", a2);
app().tickWorkout();
check("flash at 0", $("#rest-bar").classList.contains("rest-done"));
eq("beeped once", beeps, 1);
app().tickWorkout();
eq("no second beep", beeps, 1);

// Coming back long after the rest ended: no beep, the bar just clears.
click("#rest-skip");
const a3 = ls("lift-active");
a3.restEndsAt = Date.now() - 60000;
app().saveJSON("lift-active", a3);
app().tickWorkout();
eq("late return: no beep", beeps, 1);
check("late return: bar cleared", $("#rest-bar").hidden && ls("lift-active").restEndsAt === null);

// The end time survives a reload.
const r2 = $$(".set-row", ex0())[1];
fill($(".set-w", r2), "95");
fill($(".set-reps", r2), "8");
click($(".set-check", r2));
const end2 = ls("lift-active").restEndsAt;
await reload(keepAll());
eq("rest end kept across reload", ls("lift-active").restEndsAt, end2);
check("bar back after reload", !$("#rest-bar").hidden);

// Undoing a set leaves the timer alone; timed rows have no rest.
click(".set-check", $$(".set-row", $$(".workout-ex")[0])[1]);
eq("undo keeps the timer", ls("lift-active").restEndsAt, end2);
```

- [ ] **Step 2: Run, expect failure.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/rest-timer.js`. Expected: FAIL at "no rest bar yet" (nothing matches `#rest-bar`).

- [ ] **Step 3: Markup.** In `index.html`, inside `#workout`, right before `<div class="workout-finish" ...>`:

```html
    <div class="rest-bar glass" id="rest-bar" hidden>
      <span class="rest-label">Rest</span>
      <span class="rest-time" id="rest-time">0:00</span>
      <button type="button" class="pill-btn" id="rest-minus">−15 s</button>
      <button type="button" class="pill-btn" id="rest-plus">+15 s</button>
      <button type="button" class="pill-btn dark" id="rest-skip">Skip</button>
    </div>
```

- [ ] **Step 4: Implement in `lift.js`.** Add after the `let wakeLock = null;` line:

```js
let audioCtx = null;
let restDoneAt = null; // when the current rest hit 0 (for the 3 s flash)
```

Add before `workoutDaySelect.addEventListener(...)`:

```js
/* iOS only lets audio start from a tap, so the ✓ tap unlocks it. */
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
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
```

In `tickWorkout`, add `tickRest(active);` as its last line.

In `toggleSet`, replace the tail (`set.done = !set.done; saveActive(a); renderWorkout();`) with:

```js
  set.done = !set.done;
  saveActive(a);
  if (set.done) {
    unlockAudio();
    startRest(a.exercises[i].rest);
  }
  renderWorkout();
```

In `closeWorkout`, add `document.getElementById("rest-bar").hidden = true;` and `restDoneAt = null;`.

- [ ] **Step 5: Styles.** Append to `style.css`:

```css
.rest-bar {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom) + 16px);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
}

.rest-label {
  font-size: 13px;
  color: var(--text-2);
}

.rest-time {
  flex: 1;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.rest-bar.rest-done {
  animation: rest-flash 0.5s 3;
}

@keyframes rest-flash {
  50% {
    background: var(--good);
    color: #fff;
  }
}
```

- [ ] **Step 6: Run, expect pass.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/rest-timer.js --interact tests/ui/workout.js --budget 40000`, and the same with `--dark`. Expected: all PASS, 0 JS errors. Read the final screenshot: the rest bar sits above the bottom safe area, and its five parts fit on one line at 390 px.

- [ ] **Step 7: Commit** (with approval):

```bash
git add lift.js index.html style.css tests/ui/rest-timer.js
git commit -m "Rest timer: starts on each logged set, ±15 s / Skip, beeps once when it just ended, survives reloads"
```

---

### Task 5: Lifts card and Edit plan (Train tab)

**Files:**
- Modify: `index.html` (Train panel), `lift.js`, `style.css` (append)
- Create: `tests/ui/lift-plan.js`

**Interfaces:**
- Consumes: `liftPlan`, `newPlanRow`, `swapOptions`, `liftDayFor`, `liftDayName`, `exerciseName`, `LIFT_EXERCISES`, `LIFT_DAY_ORDER` (Task 1); `loadSessions`, `loadActive`, `currentPlan`, `actionBtn`, `startWorkout`, `finishActive`, `discardWorkout`, `openWorkout` (Task 3); `scheduleFor`, `CHECKINS_KEY`, `formatTime12` (coach.js); `shiftDate`, `parseLocalDate` (coach-core.js); `formatDate` (app.js).
- Produces (global): `renderLifts()`, `renderPlanEditor()`, `nextLiftLine(plan, sessions) -> string`.

- [ ] **Step 1: Write the failing UI test.** Create `tests/ui/lift-plan.js`:

```js
// Train tab Lifts card and Edit plan (step T).
await reload({ "coach-started-at": "0", "coach-injury": null }, "train-panel");
check("Lifts card on Train", Boolean($("#lifts-card")));
check("next lift line", $("#lift-next").textContent.startsWith("Next: "), $("#lift-next").textContent);
check("no workouts yet", $("#lift-history-empty").style.display === "block");

click("#lift-plan-btn");
check("editor open", !$("#lift-plan-editor").hidden);
eq("button says Done", $("#lift-plan-btn").textContent, "Done");
const rows = () => $$(".plan-row", $("#lift-plan-editor"));
eq("Upper A first", $(".plan-ex", rows()[0]).value, "bench-press");
fill($(".plan-sets", rows()[0]), "4");
eq("sets saved", ls("lift-plan").days.upperA[0].sets, 4);
fill($(".plan-ex", rows()[0]), "db-bench-press");
eq("swap made default", [ls("lift-plan").days.upperA[0].exId, ls("lift-plan").days.upperA[0].baseId], ["db-bench-press", "bench-press"]);
click(".plan-down", rows()[0]);
eq("moved down", ls("lift-plan").days.upperA.slice(0, 2).map((r) => r.exId), ["seated-cable-row", "db-bench-press"]);
check("first row can't move up", $(".plan-up", rows()[0]).disabled);
click(".plan-remove", rows()[1]);
check("removed", !ls("lift-plan").days.upperA.some((r) => r.exId === "db-bench-press"));
fill(".plan-add-select", "push-up");
clickText("Add", $("#lift-plan-editor"));
eq("added at the end", ls("lift-plan").days.upperA.at(-1), { exId: "push-up", baseId: "push-up", sets: 3, repMin: 10, repMax: 12, rest: 75 });
fill($(".plan-rep-max", rows()[0]), "2");
eq("reps can't cross", [ls("lift-plan").days.upperA[0].repMin, app().liftPlan(ls("lift-plan")).days.upperA[0].repMax], [8, 8]);
clickText("Lower A", $("#lift-plan-editor"));
eq("other day", $(".plan-ex", rows()[0]).value, "leg-extension");
const bike = rows().at(-1);
check("timed row edits minutes only", Boolean($(".plan-min", bike)) && !$(".plan-sets", bike));
fill($(".plan-min", bike), "10");
eq("minutes saved", [ls("lift-plan").days.lowerA.at(-1).repMin, ls("lift-plan").days.lowerA.at(-1).repMax], [10, 10]);

// An edit doesn't change a workout already in progress.
click("#lift-start-btn");
check("Train starts a workout", !$("#workout").hidden);
const startedIds = ls("lift-active").exercises.map((e) => e.exId);
click("#workout-min");
tab("train-panel");
eq("Train says Resume", $("#lift-start-btn").textContent, "Resume workout");
clickText(app().liftDayName(ls("lift-active").day), $("#lift-plan-editor"));
click(".plan-remove", rows()[0]);
eq("active workout untouched by edits", ls("lift-active").exercises.map((e) => e.exId), startedIds);

// Reset to default.
app().confirm = () => true;
clickText("Reset to default", $("#lift-plan-editor"));
eq("reset", [ls("lift-plan"), app().liftPlan(ls("lift-plan")).days.upperA.length], [null, 6]);

// An emptied day can't start an empty workout.
await reload({ "coach-started-at": "0", "coach-injury": null, "lift-plan": { days: { upperA: [], lowerA: [], upperB: [], lowerB: [] } } }, "train-panel");
click("#lift-start-btn");
check("empty day doesn't start", ls("lift-active") === null && $("#workout").hidden);
check("says why", $("#toast-text").textContent.includes("has no exercises"));

// History: newest first, with Delete.
await reload({ "coach-started-at": "0", "coach-injury": null, "lift-sessions": [{
  id: "s1", date: today, day: "lowerA", start: Date.now() - 50 * 60000, end: Date.now(),
  exercises: [{ exId: "leg-extension", baseId: "leg-extension", sets: [{ w: 50, reps: 12, min: null }, { w: 50, reps: 12, min: null }] }] }] }, "train-panel");
eq("history row", $("#lift-history li .entry-weight").textContent, "Lower A · 50 min");
check("history meta", $("#lift-history li .entry-meta").textContent.endsWith("2 sets"));
app().confirm = () => true;
clickText("Delete", $("#lift-history"));
eq("deleted", ls("lift-sessions"), []);
check("empty again", $("#lift-history-empty").style.display === "block");
```

- [ ] **Step 2: Run, expect failure.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/lift-plan.js --tabs train-panel`. Expected: FAIL at "Lifts card on Train".

- [ ] **Step 3: Markup.** In `index.html`'s `#train-panel`, change the eyebrow to `<div class="page-eyebrow">Lifts, runs &amp; walks</div>`. Right after the `</header>`, add:

```html
      <section class="card area-train" id="lifts-card">
        <div class="card-head">
          <h2>Lifts</h2>
          <button type="button" id="lift-plan-btn" class="pill-btn">Edit plan</button>
        </div>
        <p class="hint" id="lift-next"></p>
        <button type="button" id="lift-start-btn" class="pill-btn dark">Start workout</button>
        <div id="lift-plan-editor" class="lift-plan-editor" hidden></div>
        <ul id="lift-history" class="entry-list"></ul>
        <p id="lift-history-empty" class="empty-message">No workouts yet.</p>
      </section>
```

- [ ] **Step 4: Implement in `lift.js`.** Add before the `document.getElementById("workout-min")...` listeners:

```js
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
```

Keep the Lifts card in step with workout mode:
- Add `renderLifts();` as the last line of `openWorkout()`, `minimizeWorkout()`, `finishActive()` and `discardWorkout()`.
- At the end of the file, before the final `renderToday();`, add `renderLifts();`.
- The `visibilitychange` listener also calls `renderLifts()` (after the `loadActive()` guard, and also when nothing is active: move the guard so `renderLifts()` runs on every `visible`).

The final listener:

```js
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  renderLifts();
  if (!loadActive()) return;
  if (!workoutEl.hidden) keepAwake(true);
  tickWorkout();
});
```

- [ ] **Step 5: Styles.** Append to `style.css`:

```css
#lift-start-btn {
  margin: 4px 0 12px;
}

.lift-plan-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.plan-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.plan-row select,
.plan-add select {
  font: inherit;
  font-size: 16px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--sep);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
}

.plan-nums,
.plan-tools,
.plan-add {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.plan-add select {
  flex: 1;
}

.plan-num {
  width: 52px;
  padding: 6px;
  border: 1px solid var(--sep);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: Run, expect pass.** `python .claude/skills/phone-preview/preview.py --tabs train-panel --interact tests/ui/lift-plan.js --interact tests/ui/workout.js --interact tests/ui/rest-timer.js --budget 40000`, and the same with `--dark`. Expected: all PASS, 0 JS errors. Then `python .claude/skills/phone-preview/preview.py --tabs train-panel --interact tests/ui/lift-plan.js --out <scratchpad>/preview-t` and read the screenshot. Also take one with the editor open on Upper A (stop the script after `click("#lift-plan-btn")` in a scratch copy). Check that a plan row's numbers wrap cleanly at 390 px with nothing clipped.

- [ ] **Step 7: Commit** (with approval):

```bash
git add index.html lift.js style.css tests/ui/lift-plan.js
git commit -m "Train tab Lifts card: next lift, Start/Resume, recent workouts with Delete, and Edit plan (swap default, sets/reps/rest, reorder, add, reset)"
```

---

### Task 6: Ship step T (v36)

**Files:** `docs/progress-log-detailed.md`, `docs/progress-log-summary.md` (controller only)

- [ ] **Step 1: Full verification.**
  - `python tests/run.py`: exit 0. Expect static 4/4, backup-core 38/38, coach-core 87/87, food-core 194/194, injury 60/60 and lift-core all passing (or the pre-flight counts plus this plan's additions).
  - Run every UI script, light and dark: `python .claude/skills/phone-preview/preview.py --interact tests/ui/backup-file.js --interact tests/ui/backup.js --interact tests/ui/chick-fil-a.js --interact tests/ui/feel-checkin.js --interact tests/ui/food-checkin.js --interact tests/ui/food-flow.js --interact tests/ui/injury.js --interact tests/ui/lift-plan.js --interact tests/ui/meal-sections.js --interact tests/ui/online-search.js --interact tests/ui/processing.js --interact tests/ui/redesign.js --interact tests/ui/rest-timer.js --interact tests/ui/restore.js --interact tests/ui/snack-ideas.js --interact tests/ui/snacks-search.js --interact tests/ui/swipe-close.js --interact tests/ui/timestamps.js --interact tests/ui/tray.js --interact tests/ui/updates.js --interact tests/ui/water-pouches.js --interact tests/ui/workout.js --budget 120000`, then the same with `--dark`. Expected: all 22 PASS, 0 JS errors. (`lift-plan.js` starts on Today; its `reload(..., "train-panel")` switches tabs itself.)
  - Tab screenshots, light and dark: `python .claude/skills/phone-preview/preview.py --out <scratchpad>/preview-t`. Read each one, looking for clipped text or overlap on Train's Lifts card and on Today's lift item with its Start button.
  - Check that `sw.js` says v36, `version.js` says 36, `ASSETS` lists `lift-core.js` and `lift.js`, and `git diff main --stat` touches only the files this plan lists.
- [ ] **Step 2: Progress logs.** Add detailed-log rows for each step T commit (from `git log`), including the spec commit `50a60ba`. Add one summary paragraph for "2026-10-2x — Step T: training basics (4-day Upper/Lower, workout mode, rest timer)". Commit them with approval.
- [ ] **Step 3: Push (Sean's yes required).** Fast-forward `main` to `batch1-stepT`, then `git push`. Verify the live site: `curl -s https://seanr9242000.github.io/weight-tracker/version.js` shows `APP_VERSION = 36` (this can take a minute or two).
- [ ] **Step 4: Phone check with Sean.** If a touch problem shows only on the iPhone, use the on-device event-log probe (https://claude.ai/artifact/7wjC1tJ1WdUq6kia3hUUFw).
  1. Reopen the app without reinstalling. It shows "Updated to v36".
  2. On a lift day, the Today lift item shows "Start workout · <day>". On Monday, the lift is at 6:30 PM. Tap it: workout mode fills the screen, and the clock runs.
  3. Type a weight and reps, then tap ✓. The row turns green, the rest bar counts down from 2:00, and −15 s / +15 s / Skip work. With the ring switch on, a beep plays at 0.
  4. Swap one exercise and skip another. Tap – : the "Workout in progress" bar shows on Today, and tapping it brings the workout back.
  5. Swipe the app away and reopen it: workout mode comes back with the logged set.
  6. Lock the phone during a rest and unlock it after: the time is right, and there's no stale beep.
  7. Stop → Finish: the summary shows, the lift is checked off, and "How did it go?" asks about ankle pain.
  8. Next lift day: "Last: …" and the suggestion show, and the numbers are pre-filled.
  9. Train → Lifts: the next lift, recent workouts and Edit plan (change sets, swap a default, reorder, reset).
  10. Does the screen stay on during the workout? (Best-effort. Note the answer for later.)
- [ ] **Step 5: Hand-off.** Next is step C (savings and energy drinks), then D (water reminders) and E (restaurant database probe). Carry the appendix below into step C's plan.

---

## Appendix: backlog carried forward

These items were re-checked on 2026-10-25 and are still open. Each was triaged "can wait". Pick them up when a later step touches the same file.

**Step B minors (deferred, not touched by step T)**
- "Ate at" edited before midnight and logged after it lands about 23 h in the future (`food.js` tray).
- Quick add with "Save to My foods" uses a separate tray key, so the same food shows as two rows instead of × 2 (`food.js` / `food-core.js` `trayKey`).
- The rollback's paused-flag write can throw when the phone's storage is full (`backup.js`).
- `swipe-close.js` needs `--budget 40000` or more.

**Injury mode (step 0.5), still open**
- A PT exercise added late in the day shows as Missed once its time has passed.
- The summary's `. ${note}` reads oddly if the note already ends in punctuation.
- `snack-am`'s rest-day entry duplicates its game-day entry.
- `hasRecheckPanel` matches any item of kind "appointment" (only the recheck is one today).
- Answering Yes on the recheck writes a done check-in for an item that then vanishes (harmless).
- `feelDrafts` are keyed by item id only (moot while the feel panel renders only today's items).
- Test gaps:
  - the reminders.js ping-once rule for optional items
  - the null-injury "Start" summary and the PT add no-op
  - closing the recheck panel, the `<= dateStr` rejection, and the recheck leaving today after Yes
  - pain 0 and pain ≤ 3 (no warning, no toast), and the rising-week toast branch
  - the `liftDay` test helper only reloads when the lift is absent
  - the "seeded" check relies on a fresh profile having no `coach-injury` (add a comment)

**Step T (new)**
- Screen Wake Lock in a home-screen app is unverified on Sean's iOS version (phone check 10).
- The beep needs the ring switch on; there's no vibration on iOS web.
- The plan editor can't change which weekday runs which day (`LIFT_WEEKDAYS` is fixed). That waits for the post-clearance schedule with basketball.

**Backup and updates (step 0)**
- `save_backup` with a null `p_code` or `p_data` hits a NOT NULL error instead of a friendly message. There's no write quota per anonymous user, and `load_backup` doesn't normalize the code (the client always sends normalized codes). These need a migration and `~/bin/supabase.exe db push` (dry-run first).
- A raw Postgrest `err.message` can be long in the status line.
- The import status goes to the restore card whenever that card is visible.
- `preparedExport` has no expiry (a stale snapshot if data changes between the two taps).
- An update reload can drop half-typed input on deploy days. (Workout mode is immune: it saves on every keystroke.)
- The `.code-form` submit styling duplicates `.pill-btn` (needed to beat the global `button[type=submit]`).
- Test and tooling gaps:
  - run.py prints the em dashes in FAIL lines as replacement characters in Git Bash.
  - run.py's index regex only matches double-quoted `src`/`href`.
  - The sw.js static checks are substring checks.
  - run.py's `main()` reuses the passed/total names.
  - `tests/ui/updates.js` calls `applyPendingUpdate` directly, so the save/discard wiring isn't exercised by a click.
  - `tests/ui/backup.js` doesn't probe the 30–60 s window, the visibility-hidden upload or the retry timer, and its 61 s minute-rule check has about 1 s of margin.
  - `restore.js` doesn't assert that the code is kept or that the reload happens on the Backup-card path.
  - There are no tests for import cancel, the download fallback or the Preparing… state, or for `validBackup` with non-string values, empty keys or a photo missing its id.
