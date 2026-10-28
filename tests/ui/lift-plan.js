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
