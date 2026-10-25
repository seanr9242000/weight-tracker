// Meal sections (step B2): the Food log in Breakfast / Lunch / Dinner /
// Snacks, old entries placed by their slot or time, + Add per meal, and
// moving an entry to another meal from its editor.
const at = (date, hm) => new Date(`${date}T${hm}`).getTime();
const n = { kcal: 200, protein: 20, carbs: 10, fat: 5, fiber: 0, sugar: 0, addedSugar: 0, sodium: 0, alcohol: 0, upf: 0 };
const entry = (id, slot, hm, extra = {}) => ({ id, date: today, at: at(today, hm), slot, name: id, servings: 1, n, confidence: "exact", ...extra });
const section = (m) => $(`#food-log-list .meal-section[data-meal="${m}"]`);
const namesIn = (m) => $$(".food-entry-name", section(m)).map((x) => x.textContent);

await reload({
  "coach-started-at": "0", "coach-injury": null,
  "food-log": [
    entry("Shake", "breakfast", "07:00"),
    entry("Bowl", "lunch", "16:00"), // the slot wins over the clock
    entry("Late eggs", "extra", "09:15"), // old extra entry: by its time
    entry("Pizza", "extra", "18:40"),
    entry("Oikos", "snack-am", "10:15"),
    entry("Chips", "breakfast", "08:00", { meal: "snack" }), // its own meal wins
    entry("Yesterday", "dinner", "19:00", { date: day(-1) }),
  ],
}, "food-panel");
eq("sections in meal order", $$("#food-log-list .meal-section").map((s) => s.dataset.meal), ["breakfast", "lunch", "dinner", "snack"]);
eq("headers", $$("#food-log-list .meal-title").map((s) => s.textContent), ["Breakfast", "Lunch", "Dinner", "Snacks"]);
eq("breakfast", namesIn("breakfast"), ["Shake", "Late eggs"]);
eq("lunch", namesIn("lunch"), ["Bowl"]);
eq("dinner", namesIn("dinner"), ["Pizza"]);
eq("snacks, by time", namesIn("snack"), ["Chips", "Oikos"]);
eq("subtotal", $(".meal-sub", section("breakfast")).textContent, "400 kcal · 40 g P");
eq("no Other label", $(".food-entry-meta", section("dinner")).textContent, "6:40 PM");

// + Add opens the sheet on that meal (slot extra) and logs there.
click(".meal-add", section("lunch"));
eq("+ Add opens on its meal", [$("#food-sheet").hidden, $("#food-tray-meals .chip.active").dataset.meal], [false, "lunch"]);
clickText("Chains", $("#food-sheet-tabs"));
click("#food-sheet-body .pick-row");
click("#food-tray-log");
eq("+ Add logs into that meal", [ls("food-log").at(-1).meal, ls("food-log").at(-1).slot], ["lunch", "extra"]);
eq("…and it shows there", namesIn("lunch").length, 2);

// One-tap chips get a meal by the clock.
clickText("+1 White Claw");
eq("quick chips get a meal", ls("food-log").at(-1).meal, app().mealForTime(app().minutesNow()));

// The editor's meal picker moves an entry and keeps a typed servings edit.
const byId = (id) => ls("food-log").find((x) => x.id === id);
const rowNamed = (m, name) => $$(".food-entry", section(m)).find((li) => $(".food-entry-name", li).textContent.startsWith(name));
click(rowNamed("dinner", "Pizza")); // found by name: a clock-timed White Claw can sort ahead of it
eq("editor marks its meal", $("#food-sheet-body .meal-chips .chip.active").dataset.meal, "dinner");
fill("#food-sheet-body input", "3");
click('#food-sheet-body .meal-chips [data-meal="snack"]');
eq("moved, typed servings kept, same day", [byId("Pizza").meal, byId("Pizza").servings, byId("Pizza").date], ["snack", 3, today]);
check("shows under Snacks", namesIn("snack").includes("Pizza × 3"), namesIn("snack"));

// The processing chips carry a typed edit too.
click(rowNamed("breakfast", "Shake"));
fill("#food-sheet-body input", "2");
clickText("Ultra", $("#food-sheet-body .processing-chips"));
eq("processing chip keeps typed servings", [byId("Shake").servings, byId("Shake").n.upf > 0], [2, true]);

// Empty sections: header and + Add only.
await reload({ "coach-started-at": "0", "coach-injury": null, "food-log": [entry("Shake", "breakfast", "07:00")] }, "food-panel");
eq("empty section", [!!$(".food-entry", section("lunch")), !!$(".meal-sub", section("lunch")), !!$(".meal-add", section("lunch"))], [false, false, true]);
