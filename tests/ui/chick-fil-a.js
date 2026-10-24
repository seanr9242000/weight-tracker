// Chick-fil-A items (step A3): the rev-1 corrections reach an install
// that already has the old copies, without undoing Sean's own retag or
// favorite or touching past log entries, and the new items show up
// under Chains and in search, logging as exact.
const old = { kcal: 420, protein: 29, carbs: 41, fat: 18, fiber: 1, sugar: 6, addedSugar: 5, sodium: 1460, alcohol: 0 };
await reload({
  "coach-started-at": "0", "coach-injury": null,
  "food-library": [
    { id: "cfa-sandwich", group: "chain", name: "Chick-fil-A Chicken Sandwich", serving: "1 sandwich", n: old, confidence: "estimate", processing: "processed", processingSet: true, favorite: true, source: "seed" },
    { id: "cfa-nuggets-8", group: "chain", name: "Chick-fil-A nuggets, 8 ct", serving: "8 nuggets, no sauce", n: { ...old, kcal: 250 }, confidence: "estimate", processing: "processed", source: "seed" },
  ],
  "food-log": [{ id: "e1", date: day(-1), at: Date.now() - 86400000, slot: "extra", name: "Chick-fil-A Chicken Sandwich", servings: 1, n: old, confidence: "estimate", ref: { food: "cfa-sandwich" } }],
}, "food-panel");
const libItem = (id) => (ls("food-library") || []).find((f) => f.id === id);
eq("sandwich takes the official numbers", [libItem("cfa-sandwich").rev, libItem("cfa-sandwich").n.fat, libItem("cfa-sandwich").n.sodium, libItem("cfa-sandwich").confidence], [1, 16, 1470, "exact"]);
eq("Sean's own tag and favorite survive", [libItem("cfa-sandwich").processing, libItem("cfa-sandwich").favorite], ["processed", true]);
eq("an untouched tag takes the seed's", libItem("cfa-nuggets-8").processing, "ultra");
eq("past log entry unchanged", ls("food-log")[0].n.fat, 18);
check("new items seeded", ["cfa-polynesian", "cfa-fries-m", "cfa-sweet-tea-l"].every((id) => libItem(id)), (ls("food-library") || []).map((f) => f.id));

// The new items show under Chains and in search, and log as exact.
click("#food-log-btn");
clickText("Chains", $("#food-sheet-tabs"));
const chainNames = $$("#food-sheet-body .pick-name").map((x) => x.textContent);
check("Chains lists the new items", ["Chick-fil-A Polynesian sauce", "Chick-fil-A waffle fries, medium", "Chick-fil-A Cool Wrap"].every((x) => chainNames.includes(x)), chainNames);
clickText("Search", $("#food-sheet-tabs"));
fill("#food-sheet-body .food-search", "polynesian");
const poly = () => $$("#food-sheet-body .search-results .pick-row").find((r) => r.querySelector(".pick-name").textContent === "Chick-fil-A Polynesian sauce");
check("search finds it", Boolean(poly()), $$("#food-sheet-body .pick-name").map((x) => x.textContent));
click(poly());
eq("logs as exact", [ls("food-log").at(-1).name, ls("food-log").at(-1).confidence], ["Chick-fil-A Polynesian sauce", "exact"]);

// Retagging a food marks it as Sean's choice.
click($$(".food-entry").find((li) => li.textContent.includes("Polynesian")));
clickText("Processed", $("#food-sheet-body .processing-chips"));
eq("retag marks it Sean's", [libItem("cfa-polynesian").processing, libItem("cfa-polynesian").processingSet], ["processed", true]);
