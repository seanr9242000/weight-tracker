// Water goal on Today (by day type, tumbler-size buttons, editable under
// Targets) and pouch timestamps on Habits (times, gaps, remove one).
const dow = new Date().getDay();
const kind = [1, 2, 4].includes(dow) ? "game" : [3, 5, 6].includes(dow) ? "lift" : "rest";
const extra = { game: 32, lift: 20, rest: 0 }[kind];
const waterValue = () => $(".water-cell .fuel-value").textContent;

// 200 lb -> base 100 oz, plus the day's extra.
await reload({ "coach-started-at": "0", "weight-tracker-entries": [{ id: "w", date: today, weight: 200 }] });
eq(`water goal for a ${kind} day`, waterValue(), `0 / ${100 + extra} oz`);
eq("tumbler buttons", $$(".water-buttons .chip").map((b) => b.textContent), ["+8 oz", "+20 oz", "+40 oz"]);
check("no undo before any water", !$(".water-undo"));

clickText("+40 oz", $(".water-buttons"));
clickText("+8 oz", $(".water-buttons"));
eq("water adds up", waterValue(), `48 / ${100 + extra} oz`);
eq("water saved with time", ls("water-log").map((e) => [e.date, e.oz, typeof e.at]), [[today, 40, "number"], [today, 8, "number"]]);
click(".water-undo");
eq("undo removes the last one", waterValue(), `40 / ${100 + extra} oz`);

// A set base under Targets replaces half-bodyweight.
tab("food-panel");
click("#food-settings-btn");
eq("base field blank = auto", $("#fs-water-base").value, "");
fill("#fs-water-base", "120");
fill("#fs-water-lift", "24");
$("#food-settings-form").requestSubmit();
eq("water settings saved", ls("food-settings").water, { base: 120, lift: 24, game: 32 });
tab("today-panel");
eq("goal follows Targets", waterValue(), `40 / ${120 + { game: 32, lift: 24, rest: 0 }[kind]} oz`);

// Pouches: one last night, two today.
const at = (date, hm) => new Date(`${date}T${hm}`).getTime();
await reload({
  "coach-started-at": "0",
  "coach-habit-log": [
    { id: "p1", type: "pouch", date: day(-1), at: at(day(-1), "22:00") },
    { id: "p2", type: "pouch", date: today, at: at(today, "00:30") },
    { id: "p3", type: "pouch", date: today, at: at(today, "02:10") },
  ],
}, "habits-panel");
const rows = () => $$("#pouch-times li");
eq("today's pouches listed", rows().length, 2);
eq("times + gaps", rows().map((r) => r.querySelector(".pouch-gap").textContent), ["2h 30m after the last", "1h 40m after the last"]);
check("last-pouch timer", /^Last pouch .+ ago$/.test($("#pouch-last").textContent), $("#pouch-last").textContent);
click(".pouch-remove", rows()[0]);
eq("removed the chosen pouch", ls("coach-habit-log").map((l) => l.id), ["p1", "p3"]);
eq("gap recomputed", rows()[0].querySelector(".pouch-gap").textContent, "4h 10m after the last");

await reload({ "coach-started-at": "0" }, "habits-panel");
eq("empty state", $("#pouch-last").textContent, "No pouches logged yet.");
