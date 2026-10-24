// Timestamps (step A2): times on food, water, pouches, cravings, weigh-ins
// and runs. Food times are editable and never move an entry's date.
const at = (date, hm) => new Date(`${date}T${hm}`).getTime();
const n = { kcal: 200, protein: 20, carbs: 10, fat: 5, fiber: 0, sugar: 0, addedSugar: 0, sodium: 0, alcohol: 0, upf: 0 };

await reload({
  "coach-started-at": "0", "coach-injury": null,
  "food-log": [
    { id: "f1", date: today, at: at(today, "08:42"), slot: "extra", name: "Eggs", servings: 1, n, confidence: "exact" },
    { id: "f2", date: today, at: at(today, "12:30"), slot: "extra", name: "Wrap", servings: 1, n, confidence: "estimate" },
  ],
  "water-log": [
    { id: "w1", date: today, at: at(today, "13:30"), oz: 20 },
    { id: "w2", date: today, at: at(today, "07:05"), oz: 8 },
    { id: "w0", date: day(-1), at: at(day(-1), "22:00"), oz: 40 },
  ],
}, "food-panel");

// Food log
const metas = () => $$("#food-log-list .food-entry-main .food-entry-meta").map((m) => m.textContent);
const names = () => $$("#food-log-list .food-entry-name").map((m) => m.textContent);
eq("food times", metas(), ["8:42 AM · Other", "12:30 PM · Other · estimate"]);

// Edit the time: same date, new time, and the log re-sorts.
const f1 = () => ls("food-log").find((e) => e.id === "f1");
const timeField = () => $("#food-sheet-body input[type=time]");
click(".food-entry");
eq("editor shows the time", timeField().value, "08:42");
fill(timeField(), "13:05");
$("#food-sheet-body form").requestSubmit();
eq("time saved, date and servings kept", [f1().at, f1().date, f1().servings], [at(today, "13:05"), today, 1]);
eq("log re-sorts by time", names(), ["Wrap", "Eggs"]);

// A late-night edit stays on the same day.
click($$(".food-entry")[1]);
fill(timeField(), "23:59");
$("#food-sheet-body form").requestSubmit();
eq("23:59 keeps the date", [f1().at, f1().date], [at(today, "23:59"), today]);

// A cleared time field keeps the old time; servings still save.
click($$(".food-entry")[1]);
fill(timeField(), "");
fill("#food-sheet-body input", "2");
$("#food-sheet-body form").requestSubmit();
eq("blank time keeps it", [f1().at, f1().servings], [at(today, "23:59"), 2]);

// Water drawer: today's water with times, oldest first.
tab("today-panel");
click('.ring-tile[data-ring="water"]');
const waterRows = () => $$(".water-times li").map((li) => [...li.children].map((c) => c.textContent));
eq("water times, today only", waterRows(), [["7:05 AM", "8 oz"], ["1:30 PM", "20 oz"]]);
clickText("+8 oz", $(".water-buttons"));
eq("new water gets a row", waterRows().length, 3);
check("new row has a clock time", waterRows().every((r) => /^\d{1,2}:\d{2} [AP]M$/.test(r[0])), waterRows());

// Pouches and cravings (Progress > Habits)
const cravingRows = () => $$("#craving-times li").map((li) => [...li.children].map((c) => c.textContent));
await reload({ "coach-started-at": "0", "coach-injury": null }, "habits-panel");
eq("no cravings today, no list", $("#craving-times").hidden, true);

await reload({
  "coach-started-at": "0", "coach-injury": null,
  "coach-habit-log": [
    { id: "p1", type: "pouch", date: today, at: at(today, "00:30") },
    { id: "c1", type: "craving", date: today, at: at(today, "20:15"), trigger: "stress", urge: 4, resisted: true },
    { id: "c2", type: "craving", date: today, at: at(today, "09:10"), trigger: "meal", urge: 2, resisted: false },
    { id: "c0", type: "craving", date: day(-1), at: at(day(-1), "21:00"), trigger: "boredom", urge: 3, resisted: true },
  ],
}, "habits-panel");
eq("pouch time format", $("#pouch-times .pouch-time").textContent, "12:30 AM");
eq("today's cravings, oldest first", cravingRows(),
  [["9:10 AM", "Meal · urge 2/5 · used a pouch"], ["8:15 PM", "Stress · urge 4/5 · resisted"]]);
app().openQuickAdd("craving");
click('#trigger-chips [data-trigger="boredom"]');
click("#craving-resisted-btn");
const fresh = cravingRows().find((r) => r[1] === "Boredom · urge 3/5 · resisted");
check("a new craving lists with a time", fresh && /^\d{1,2}:\d{2} [AP]M$/.test(fresh[0]), cravingRows());

// Weigh-ins: a time only when it was logged on that day; old ones date only.
const fd = (d) => app().formatDate(d);
await reload({
  "coach-started-at": "0", "coach-injury": null,
  "weight-tracker-entries": [
    { id: "e1", date: today, weight: 180, unit: "lbs", at: at(today, "07:05") },
    { id: "e2", date: day(-1), weight: 181, unit: "lbs" },
    { id: "e3", date: day(-2), weight: 182, unit: "lbs", at: at(today, "09:00") },
  ],
});
eq("weigh-in times", $$("#entry-list .entry-date").map((d) => d.textContent), [`${fd(today)} · 7:05 AM`, fd(day(-1)), fd(day(-2))]);

// All three weigh-in paths store a time.
const lastEntry = () => (ls("weight-tracker-entries") || []).at(-1);
app().openQuickAdd("weight");
fill("#qa-weight-input", "179.4");
$("#qa-weight").requestSubmit();
eq("quick-add weigh-in stores a time", typeof lastEntry().at, "number");
fill("#weight-input", "179.2");
$("#entry-form").requestSubmit();
eq("Weight form stores a time", [lastEntry().weight, typeof lastEntry().at], [179.2, "number"]);
await reload({ "coach-started-at": "0", "coach-injury": null });
click(".check-box", item("Weigh in"));
fill(".weigh-inline input", "178.8");
$(".weigh-inline").requestSubmit();
eq("checklist weigh-in stores a time", [lastEntry().weight, typeof lastEntry().at], [178.8, "number"]);

// Runs: start time on new runs; old runs show the date only.
await reload({
  "coach-started-at": "0", "coach-injury": null,
  "weight-tracker-runs": [
    { id: "r1", date: today, type: "run", durationSeconds: 1800, distanceMiles: 3, startedAt: at(today, "18:10") },
    { id: "r2", date: day(-3), type: "walk", durationSeconds: 1200, distanceMiles: 1 },
  ],
}, "train-panel");
const runMeta = () => $$("#run-list .entry-meta").map((m) => m.textContent);
check("run shows its start time", runMeta()[0].startsWith(`${fd(today)} · 6:10 PM · `), runMeta()[0]);
check("old run shows the date only", runMeta()[1].startsWith(`${fd(day(-3))} · `) && runMeta()[1].split(" · ").length === 2, runMeta()[1]);

// A resumed run keeps its real start through Stop and Save.
const started = Date.now() - 20 * 60000;
await reload({ "coach-started-at": "0", "coach-injury": null, "weight-tracker-active-run": { startedAt: started, type: "run", path: [] } }, "train-panel");
click("#timer-btn"); // Stop
fill("#run-distance-input", "2");
$("#run-save-form").requestSubmit();
eq("saved run keeps its start", (ls("weight-tracker-runs") || []).at(-1).startedAt, started);
