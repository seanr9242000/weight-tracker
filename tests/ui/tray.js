// Tray (step B1): every pick path adds to the tray, and one Log writes an
// entry per row with a shared meal group, meal, time and slot. The tray
// survives a close; Undo removes the whole group.
await reload({ "coach-started-at": "0", "coach-injury": null }, "food-panel");
const rows = () => $$("#food-tray-items .tray-item").map((li) => [$(".tray-name", li).textContent, $(".tray-servings", li).textContent]);
const row = (i) => $$("#food-tray-items .tray-item")[i];
const mealChip = (m) => $(`#food-tray-meals [data-meal="${m}"]`);
const activeMeal = () => $("#food-tray-meals .chip.active")?.dataset.meal;
const searchPick = (q, name) => {
  clickText("Search", $("#food-sheet-tabs"));
  fill(".food-search", q);
  clickText(name, $("#food-sheet-body .search-results"));
};

click("#food-log-btn");
eq("empty tray: hint only", [$("#food-tray").hidden, $("#food-tray-hint").hidden, $("#food-tray-log").hidden, $("#food-tray-details").hidden], [false, false, true, true]);
eq("opened from the Food tab: meal by the clock", activeMeal(), app().mealForTime(app().minutesNow()));

// Every pick path adds to the tray instead of logging.
searchPick("banana", "Banana");
clickText("Chains", $("#food-sheet-tabs"));
clickText("Chick-fil-A Cool Wrap", $("#food-sheet-body"));
clickText("Takeout", $("#food-sheet-tabs"));
$$("#food-sheet-body .size-btn")[1].click(); // Pizza, M
clickText("My foods", $("#food-sheet-tabs"));
clickText("My Chipotle order", $("#food-sheet-body"));
clickText("Quick add", $("#food-sheet-tabs"));
fill("[name=name]", "Trail mix");
fill("[name=kcal]", "300");
fill("[name=protein]", "8");
$(".quick-form").requestSubmit();
eq("nothing logged yet", ls("food-log") || [], []);
check("sheet still open", !$("#food-sheet").hidden);
eq("one row per pick", rows().map((r) => r[0]), ["Banana", "Chick-fil-A Cool Wrap", "Pizza (regular slice)", "My Chipotle order", "Trail mix"]);
eq("quick add form clears", $("[name=name]").value, "");
check("summary counts the tray", /^5 items · [\d,]+ kcal · [\d,]+ g P$/.test($("#food-tray-summary").textContent), $("#food-tray-summary").textContent);
eq("Log button counts", $("#food-tray-log").textContent, "Log 5 items");

// The same food from another path raises its servings; the stepper moves in halves, never below ½.
clickText("My foods", $("#food-sheet-tabs"));
clickText("Banana", $("#food-sheet-body"));
eq("search + My foods merge", rows()[0], ["Banana", "× 2"]);
for (let i = 0; i < 3; i++) click('[aria-label="Fewer"]', row(0));
eq("stepper stops at ½", rows()[0][1], "× ½");
click('[aria-label="More"]', row(0));
eq("stepper adds ½", rows()[0][1], "× 1");
click('[aria-label="Remove"]', row(4));
eq("remove drops the row", rows().map((r) => r[0]), ["Banana", "Chick-fil-A Cool Wrap", "Pizza (regular slice)", "My Chipotle order"]);

// Close keeps the tray.
click("#food-sheet-cancel");
click("#food-log-btn");
eq("the tray survives a close", rows().length, 4);

// "Ate at" follows the clock until edited.
eq("Ate at follows the clock", $("#food-tray-at").value, app().timeInputValue(Date.now()));
// Coming back to the app with the sheet still open shows the time again.
$("#food-tray-at").value = "00:00"; // what an open sheet showed a while ago
app().document.dispatchEvent(new Event("visibilitychange"));
eq("Ate at catches up on return", $("#food-tray-at").value, app().timeInputValue(Date.now()));
fill("#food-tray-at", "09:00");
app().document.dispatchEvent(new Event("visibilitychange"));
eq("an edited Ate at stays", $("#food-tray-at").value, "09:00");

// Keyboard up: only the summary and Log stay.
$("#food-sheet").classList.add("keyboard-up");
eq("keyboard up tucks the details away", [app().getComputedStyle($("#food-tray-details")).display, app().getComputedStyle($("#food-tray-log")).display === "none"], ["none", false]);
// iOS may count the time wheel as a keyboard: the field being edited stays.
// (Focus comes first on the phone; keyboard-up follows the resize.)
$("#food-sheet").classList.remove("keyboard-up");
$("#food-tray-at").focus();
$("#food-sheet").classList.add("keyboard-up");
eq("editing Ate at keeps the details", app().getComputedStyle($("#food-tray-details")).display, "flex");
$("#food-tray-at").blur();
$("#food-sheet").classList.remove("keyboard-up");

// Meal and time, then Log: one entry per row, sharing group, meal, time and slot.
click(mealChip("lunch"));
eq("meal chip picks", activeMeal(), "lunch");
fill("#food-tray-at", "12:15");
click("#food-tray-log");
const log = ls("food-log");
const lunchAt = new Date(`${today}T12:15`).getTime();
eq("one entry per row", log.map((e) => [e.name, e.servings]), [["Banana", 1], ["Chick-fil-A Cool Wrap", 1], ["Pizza (regular slice)", 1], ["My Chipotle order", 1]]);
eq("shared group, meal, time, slot and date",
  [new Set(log.map((e) => e.mealGroup)).size, log.every((e) => e.mealGroup && e.meal === "lunch" && e.at === lunchAt && e.slot === "extra" && e.date === today)],
  [1, true]);
eq("refs kept", [log[0].ref, log[2].ref, log[3].ref], [{ food: "banana" }, { takeout: "pizza", size: "M" }, { meal: "meal-chipotle", addons: [] }]);
check("sheet closed", $("#food-sheet").hidden);
check("toast names the count and calories", /^Logged 4 items · [\d,]+ kcal$/.test($("#toast-text").textContent), $("#toast-text").textContent);
click("#toast-undo");
eq("undo removes the whole group", ls("food-log"), []);
click("#food-log-btn");
eq("a logged tray starts empty", [rows().length, $("#food-tray-hint").hidden], [0, false]);

// A blank "Ate at" logs now.
searchPick("banana", "Banana");
fill("#food-tray-at", "");
click("#food-tray-log");
check("blank Ate at logs now", Math.abs(ls("food-log").at(-1).at - Date.now()) < 5000, ls("food-log").at(-1).at);

// Some iOS versions send only "change" from a time field.
click("#food-log-btn");
searchPick("banana", "Banana");
$("#food-tray-at").value = "07:30";
$("#food-tray-at").dispatchEvent(new Event("change", { bubbles: true }));
click("#food-tray-log");
eq("a change-only edit is kept", ls("food-log").at(-1).at, new Date(`${today}T07:30`).getTime());

// A checklist slot: meal from the slot, checked off once, Undo restores the old state.
await reload({ "coach-started-at": "0", "coach-injury": null,
  "coach-checkins": { [`${today}|lunch`]: { status: "skipped", reason: "busy", at: 1 } } });
app().openFoodSheet({ slot: "lunch", title: "Lunch" });
eq("slot sets the meal", activeMeal(), "lunch");
searchPick("banana", "Banana");
clickText("Chains", $("#food-sheet-tabs"));
clickText("Chick-fil-A Cool Wrap", $("#food-sheet-body"));
click("#food-tray-log");
eq("both entries in the slot", ls("food-log").map((e) => [e.slot, e.meal]), [["lunch", "lunch"], ["lunch", "lunch"]]);
eq("slot checked off", ls("coach-checkins")[`${today}|lunch`].status, "done");
click("#toast-undo");
eq("undo puts the slot back how it was", [ls("food-log"), ls("coach-checkins")[`${today}|lunch`]], [[], { status: "skipped", reason: "busy", at: 1 }]);

// The editor shares the sheet: the tray hides there and comes back intact.
await reload({ "coach-started-at": "0", "coach-injury": null,
  "food-log": [{ id: "e1", date: today, at: Date.now(), slot: "extra", name: "Eggs", servings: 1, confidence: "exact",
    n: { kcal: 140, protein: 12, carbs: 1, fat: 10, fiber: 0, sugar: 0, addedSugar: 0, sodium: 140, alcohol: 0, upf: 0 } }] }, "food-panel");
click("#food-log-btn");
searchPick("banana", "Banana");
click("#food-sheet-cancel");
click(".food-entry");
check("editor hides the tray", $("#food-tray").hidden);
click("#food-sheet-cancel");
click("#food-log-btn");
eq("tray back after editing", rows(), [["Banana", "× 1"]]);
