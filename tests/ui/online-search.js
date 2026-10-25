// "Search online" in the food picker, with the network call stubbed out
// (searchOnline is replaced), so this runs offline and creates no
// Supabase users. The live function is checked separately with curl.
await reload({ "coach-started-at": "0" }, "food-panel");
const hits = [
  { fdcId: 1, dataType: "Branded", name: "PROTEIN BAR, COOKIES & CREAM", brand: "QUEST BAR", servingSize: 60, servingSizeUnit: "g",
    household: "1 BAR", per100: { kcal: 316, protein: 35, carbs: 38, fat: 13, fiber: 23, sugar: 1.7, sodium: 383 } },
  { fdcId: 2, dataType: "SR Legacy", name: "McDONALD'S, BIG MAC", brand: null, per100: { kcal: 257, protein: 12, sodium: 467 } },
];
let calls = 0;
app().searchOnline = async (q) => { calls++; return hits.map(app().usdaToFood); };

click("#food-log-btn");
check("no online button for 1 char", (fill(".food-search", "q"), !$(".online-btn")));
fill(".food-search", "quest bar");
check("online button offered", $(".online-btn")?.textContent.includes("quest bar"));
click(".online-btn");
await wait(50);
const names = $$(".online-results .pick-name").map((e) => e.textContent);
eq("online results listed", names, ["Protein Bar, Cookies & Cream (Quest Bar)", "McDONALD'S, BIG MAC"]);
eq("one call", calls, 1);
check("per-serving meta", $(".online-results .pick-meta").textContent.startsWith("1 BAR · 190 kcal"), $(".online-results .pick-meta").textContent);

clickText("Protein Bar, Cookies & Cream (Quest Bar)", $(".online-results"));
click("#food-tray-log");
check("sheet closed", $("#food-sheet").hidden);
const e = ls("food-log").at(-1);
eq("logged with label numbers", [e.name, Math.round(e.n.kcal), Math.round(e.n.protein), e.confidence], ["Protein Bar, Cookies & Cream (Quest Bar)", 190, 21, "exact"]);
check("saved to My foods", ls("food-library").some((f) => f.id === "usda-1" && f.source === "usda"));

// Next time it's found locally, as a past entry.
click("#food-log-btn");
fill(".food-search", "quest");
eq("found locally next time", $("#food-sheet-body .search-results .pick-name").textContent, "Protein Bar, Cookies & Cream (Quest Bar)");

// Enter key searches online too; typing again clears stale results.
const input = $(".food-search");
input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await wait(50);
eq("Enter runs online search", calls, 2);
fill(".food-search", "quest b");
eq("typing resets the online section", $$(".online-results .pick-row").length, 0);

// Failure path: friendly message, nothing logged.
const before = ls("food-log").length;
app().searchOnline = async () => { throw new Error("offline"); };
click(".online-btn");
await wait(50);
check("error message shown", $(".online-results").textContent.includes("Couldn't reach"), $(".online-results").textContent);
eq("nothing logged on failure", ls("food-log").length, before);
