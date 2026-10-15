// Redesign step 1: four-tab dock, legacy tab ids, Today rings + drawers,
// the + quick-add sheet (water, pouch, weight, craving, suggestions),
// toast Undo, and once-a-day goal celebrations.
const visible = (sel) => { const e = $(sel); return Boolean(e && !e.hidden); };
const ringVal = (key) => $(`.ring-tile[data-ring="${key}"] .ring-value`).textContent;
const ringSub = (key) => $(`.ring-tile[data-ring="${key}"] .ring-sub`).textContent;

// Dock: 4 tabs + the + button.
await reload({ "coach-started-at": "0", "weight-tracker-entries": [{ id: "w", date: day(-1), weight: 200 }] });
eq("four tabs", $$(".nav-btn").map((b) => b.dataset.tab), ["today-panel", "food-panel", "progress-panel", "train-panel"]);
check("+ button", Boolean($("#fab")));
eq("four rings", $$(".ring-tile").map((t) => t.dataset.ring), ["kcal", "protein", "water", "pouch"]);
eq("pouch ring without a taper", ringSub("pouch"), "no taper");

// Legacy saved tabs land in the right new place.
await reload({ "coach-started-at": "0" }, "weight-panel");
check("weight-panel -> Progress", visible("#progress-panel") && visible("#weight-view") && !visible("#habits-view"));
await reload({ "coach-started-at": "0" }, "runs-panel");
check("runs-panel -> Train", visible("#train-panel"));
tab("progress-panel");
clickText("Habits", $("#progress-seg"));
check("segment switches", visible("#habits-view") && !visible("#weight-view"));
eq("segment remembered", app().localStorage.getItem("weight-tracker-progress-seg"), "habits-view");

// Ring drawer toggles.
await reload({ "coach-started-at": "0", "weight-tracker-entries": [{ id: "w", date: day(-1), weight: 200 }] });
check("drawer closed at start", !visible(".ring-detail"));
click('.ring-tile[data-ring="kcal"]');
check("calories drawer opens", visible(".ring-detail") && $(".ring-detail").textContent.includes("Left today"));
eq("tile marked open", $('.ring-tile[data-ring="kcal"]').getAttribute("aria-expanded"), "true");
click('.ring-tile[data-ring="kcal"]');
check("tap again closes", !visible(".ring-detail"));

// + sheet opens and closes.
click("#fab");
check("sheet open", visible("#quick-add") && visible("#qa-scrim") && visible("#qa-main"));
eq("water buttons", $$("#qa-water-buttons button").map((b) => b.textContent), ["+8 oz", "+20 oz", "+40 oz"]);
click("#qa-scrim");
check("scrim closes", !visible("#quick-add"));

// Water: one tap logs, closes, toasts; Undo removes it.
click("#fab");
clickText("+20 oz", $("#qa-water-buttons"));
check("closed after water", !visible("#quick-add"));
eq("water logged", ls("water-log").map((e) => e.oz), [20]);
eq("ring shows it", ringVal("water"), "20");
check("toast with undo", visible("#toast") && visible("#toast-undo"), $("#toast-text").textContent);
click("#toast-undo");
eq("undo removed it", ls("water-log"), []);
eq("ring back to 0", ringVal("water"), "0");

// Pouch tile: one tap + Undo.
click("#fab");
click('.qa-tile[data-qa="pouch"]');
eq("pouch logged", (ls("coach-habit-log") || []).filter((l) => l.type === "pouch").length, 1);
eq("pouch ring", ringVal("pouch"), "1");
click("#toast-undo");
eq("pouch undone", (ls("coach-habit-log") || []).filter((l) => l.type === "pouch").length, 0);

// Weight view: prefilled with the last weigh-in, saves today's, checks off Weigh in.
click("#fab");
click('.qa-tile[data-qa="weight"]');
check("weight view", visible("#qa-weight") && !visible("#qa-main"));
eq("prefilled", $("#qa-weight-input").value, "200");
fill("#qa-weight-input", "198.6");
$("#qa-weight").requestSubmit();
const entries = ls("weight-tracker-entries");
eq("entry saved", [entries.at(-1).date, entries.at(-1).weight], [today, 198.6]);
check("weigh checked off", Boolean((ls("coach-checkins") || {})[`${today}|weigh`]));
check("sheet closed", !visible("#quick-add"));

// Craving view: needs a trigger, then logs and closes.
click("#fab");
click('.qa-tile[data-qa="craving"]');
check("craving view", visible("#qa-craving"));
click("#craving-resisted-btn");
eq("asks for a trigger", $("#craving-status").textContent, "Pick what triggered it first.");
click(".chip", $("#trigger-chips"));
click("#craving-resisted-btn");
eq("craving logged", (ls("coach-habit-log") || []).filter((l) => l.type === "craving").map((l) => l.resisted), [true]);
check("closed after craving", !visible("#quick-add"));
// Habits' button opens the same view.
tab("progress-panel");
clickText("Habits", $("#progress-seg"));
click("#open-craving-btn");
check("Habits opens craving sheet", visible("#qa-craving"));
click("#qa-close");

// Celebration: closing the water ring once a day.
await reload({ "coach-started-at": "0", "weight-tracker-entries": [{ id: "w", date: today, weight: 40 }] });
// 40 lb -> base 20 oz; plus the day's extra. Fill to the goal in one go.
const goal = Number(ringSub("water").replace(/\D/g, ""));
app().addWater(today, goal);
check("water ring done", $('.ring-tile[data-ring="water"]').classList.contains("done"));
check("celebrated once", (ls("ui-celebrated") || {})[today]?.includes("water"));
eq("toast says so", $("#toast-text").textContent, "Water goal hit 💧");
check("undo still offered", visible("#toast-undo"));
