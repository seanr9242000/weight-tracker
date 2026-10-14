// Snack reminders, food search, and opening an item from a reminder tap.
await reload({ "coach-started-at": "0" });
const dow = new Date().getDay();
const results = () => $$("#food-sheet-body .pick-name").map((e) => e.textContent);

if (dow >= 1 && dow <= 5) {
  check("mid-morning snack on Today", !!item("Mid-morning snack"));
  check("afternoon snack on Today", !!item("Afternoon snack"));
  click(".check-box", item("Mid-morning snack"));
  clickText("As planned", item("Mid-morning snack"));
  eq("Oikos logged for the snack", ls("food-log").at(-1).name, "Oikos Pro");
  eq("snack slot", ls("food-log").at(-1).slot, "snack-am");

  // Afternoon snack has no fixed default: "Log food" opens search.
  click(".check-box", item("Afternoon snack"));
  check("no As planned for afternoon", !byText("As planned", item("Afternoon snack")));
  clickText("Log food", item("Afternoon snack"));
  check("search sheet open", !$("#food-sheet").hidden && !!$(".food-search"));
  eq("empty search lists past entries", results(), ["Oikos Pro"]);
  fill(".food-search", "chick 12");
  eq("multi-word search", results(), ["Chick-fil-A nuggets, 12 ct", "Chick-fil-A grilled nuggets, 12 ct"]);
  clickText("Chick-fil-A grilled nuggets, 12 ct", $("#food-sheet-body"));
  check("sheet closed after pick", $("#food-sheet").hidden);
  eq("logged into the afternoon slot", ls("food-log").at(-1).slot, "snack-pm");
  check("afternoon snack done", item("Afternoon snack").classList.contains("done"));
}

// Search from the Food tab
tab("food-panel");
click("#food-log-btn");
fill(".food-search", "OIK");
if (ls("food-log")?.length) check("past entry ranks first", $("#food-sheet-body .pick-meta").textContent.startsWith("Logged before"));
check("saved meals found", results().includes("Banana + Oikos Pro"));
fill(".food-search", "pizza");
eq("takeout preset found", $$("#food-sheet-body .takeout-row .size-btn").length, 3);
fill(".food-search", "zzzz");
check("no-match message", $("#food-sheet-body").textContent.includes("No match"));
fill(".food-search", "white claw");
clickText("White Claw", $("#food-sheet-body"));
eq("search result logs", ls("food-log").at(-1).name, "White Claw");

// Reminder tap on a closed app: ?item=<id> opens Today on that item.
await reload({ "coach-started-at": "0" }, "food-panel", "item=breakfast");
check("Today tab active", !$("#today-panel").hidden);
check("breakfast log panel open", !!$(".meal-panel", item("Protein shake")));
check("URL cleaned up", !app().location.search.includes("item="));

// Reminder tap on an open app: the service worker's message handler.
tab("food-panel");
app().openChecklistItem("breakfast");
check("message path opens Today", !$("#today-panel").hidden);
check("unknown id is harmless", (app().openChecklistItem("test"), !$("#today-panel").hidden));
