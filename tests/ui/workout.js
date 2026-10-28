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
// On an unmapped weekday the rotation moves on, so pick the same day again.
fill("#workout-day", sessions[0].day);
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
