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
