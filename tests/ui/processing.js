// "Mostly natural": processing tags, the ultra-processed signal, the
// shake note, retagging, and whole-food snack swaps.
await reload({ "coach-started-at": "0", "coach-injury": null }, "food-panel");
const upfRow = () => $$("#food-signals .signal").find((li) => li.textContent.startsWith("Ultra-processed"));
check("ultra-processed signal listed", !!upfRow());
eq("starts at 0%", upfRow().querySelector(".fuel-value").textContent, "0% of kcal / 20% max");
check("shake note shown", !$("#shake-note").hidden);

// Takeout (ultra) + an equal-size whole quick add = 50%.
click("#food-takeout-btn");
$$(".size-btn")[1].click(); // Pizza M, 290 kcal
click("#food-tray-log");
click("#food-quick-btn");
fill("[name=name]", "Home-made rice bowl");
fill("[name=kcal]", "290");
fill("[name=protein]", "20");
clickText("Whole", $(".quick-form"));
$(".quick-form").requestSubmit();
click("#food-tray-log");
eq("quick add saved with its tag", ls("food-log").at(-1).n.upf, 0);
eq("half the calories are ultra", upfRow().querySelector(".fuel-value").textContent, "50% of kcal / 20% max");

// Retag the quick-add entry as ultra from its edit sheet.
clickText("Home-made rice bowl");
check("processing chips in edit sheet", !!$("#food-sheet-body .processing-chips"));
clickText("Ultra", $("#food-sheet-body"));
eq("retag updates the day", upfRow().querySelector(".fuel-value").textContent, "100% of kcal / 20% max");

// Search marks ultra-processed foods.
click("#food-log-btn");
fill(".food-search", "pretzels");
check("ultra marked in results", $("#food-sheet-body .pick-meta").textContent.includes("ultra-processed"), $("#food-sheet-body .pick-meta").textContent);
click("#food-sheet-cancel");

// Shake note: keeping a flavored powder flips the whey to ultra.
clickText("I'm keeping a flavored one");
check("note dismissed", $("#shake-note").hidden);
eq("whey retagged", ls("food-library").find((f) => f.id === "on-whey").processing, "ultra");

// Old installs: seed foods saved before tagging get their tag back-filled.
await reload({ "coach-started-at": "0", "coach-injury": null, "food-library": [
  { id: "banana", name: "Banana", serving: "1 medium", source: "seed", confidence: "exact",
    n: { kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14.4, addedSugar: 0, sodium: 1, alcohol: 0 } }] });
eq("back-filled tag", ls("food-library").find((f) => f.id === "banana").processing, "whole");
check("new foods added", ls("food-library").some((f) => f.id === "dates"));

// Whole-food snack swap shows on game days.
if (item("Pre-game snack")) {
  click(".check-box", item("Pre-game snack"));
  eq("pre-game ideas", $$(".snack-ideas .pick-name", item("Pre-game snack")).map((e) => e.textContent), ["Dates + banana", "Rice cakes + honey + banana"]);
  check("dates portion", $(".snack-ideas .pick-meta", item("Pre-game snack")).textContent.startsWith("2 Medjool dates · 1 banana"));
}
