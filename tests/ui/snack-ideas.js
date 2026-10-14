// Snack ideas in the Today meal panel: right ideas for the kind of day,
// exact portions, one tap to log; existing installs get portion info;
// ideas' servings are editable under Targets.
const dow = new Date().getDay();
const kind = [1, 2, 4].includes(dow) ? "game" : [3, 5, 6].includes(dow) ? "lift" : "rest";

// An install from before this change: stored seed foods without `portion`.
const oldLib = FOOD_LIB_WITHOUT_PORTIONS();
await reload({ "coach-started-at": "0", "food-library": oldLib });
check("portion info merged into old installs", ls("food-library").find((f) => f.id === "banana").portion?.unit === "banana");
check("user edits survive the merge", ls("food-library").find((f) => f.id === "oikos-pro").n.kcal === 160);
check("snack ideas seeded", ls("food-ideas").length >= 18);

const slot = "Afternoon snack"; // weekdays 3 PM, Sundays 3:30 PM
if (item(slot)) {
  click(".check-box", item(slot));
  const names = $$(".snack-ideas .pick-name", item(slot)).map((e) => e.textContent);
  const want = { game: ["PB-banana toast", "Pretzels + string cheese", "Oikos Pro + oats + strawberries"],
    lift: ["Oikos Pro + oats + strawberries", "Tuna + rice cakes + apple", "PB-banana toast"],
    rest: ["Carrots + hummus + string cheese", "Apple + peanut butter", "Oikos Pro + strawberries"] }[kind];
  eq(`afternoon ideas for a ${kind} day`, names, want);
  check("tip shown", $(".snack-tip", item(slot))?.textContent.length > 10);
  const meta = $(".snack-ideas .pick-meta", item(slot)).textContent;
  check("portions + numbers shown", /·.*kcal.*g P/.test(meta), meta);
  clickText(want[0], item(slot));
  eq("idea logged into the slot", [ls("food-log").at(-1).name, ls("food-log").at(-1).slot], [want[0], "snack-pm"]);
  check("snack checked off", item(slot).classList.contains("done"));
}

// Mid-morning on a game/lift day: planned Oikos + 3 ideas.
if (item("Mid-morning snack")) {
  click(".check-box", item("Mid-morning snack"));
  check("planned meal still offered", !!byText("As planned", item("Mid-morning snack")));
  eq("three mid-morning ideas", $$(".snack-ideas .pick-row", item("Mid-morning snack")).length, 3);
}

// Editing an idea's servings changes its portion line.
tab("food-panel");
click("#food-settings-btn");
$(".idea-editor").open = true;
const firstIdea = $(".idea-editor .meal-edit");
eq("first idea in editor", $(".meal-name", firstIdea).textContent, "Apple + peanut butter");
fill($$("input", firstIdea)[1], "0.5");
eq("servings saved", ls("food-ideas").find((i) => i.id === "idea-apple-pb").items[1].servings, 0.5);
check("portion text follows servings", app().portionText(ls("food-ideas")[0].items, ls("food-library")).includes("1 tbsp peanut butter"));

// Stored seed foods as an install from before `portion` existed saved
// them (top-level consts like FOOD_SEED_LIBRARY aren't on window).
function FOOD_LIB_WITHOUT_PORTIONS() {
  const n = (kcal, protein) => ({ kcal, protein, carbs: 0, fat: 0, fiber: 0, sugar: 0, addedSugar: 0, sodium: 0, alcohol: 0 });
  return [
    { id: "banana", name: "Banana", serving: "1 medium", n: n(105, 1.3), confidence: "exact", source: "seed" },
    { id: "oikos-pro", name: "Oikos Pro yogurt", serving: "1 cup", n: n(160, 25), confidence: "exact", source: "seed" },
  ];
}
