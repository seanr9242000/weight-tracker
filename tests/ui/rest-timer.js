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

// iOS reports "interrupted" (not "suspended") after an app switch, and a
// reload starts with no audio at all: any tap in workout mode unlocks it.
await reload({ "coach-started-at": "0", "coach-injury": null,
  "lift-active": app().newWorkout(app().liftPlan(null), "upperA", today, [], Date.now()) });
let made = 0;
let resumes = 0;
app().AudioContext = function () { made++; this.state = "interrupted"; this.resume = () => { resumes++; }; };
click("#workout-clock");
eq("a tap in workout mode makes the audio", made, 1);
eq("interrupted audio resumes", resumes, 1);
