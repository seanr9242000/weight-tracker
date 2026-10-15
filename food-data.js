/* Seed data for the Food tab: the foods behind Sean's planned meals,
   the saved meals mapped to checklist slots, chain-restaurant items,
   and S/M/L takeout estimates. Copied into localStorage on first run
   (food.js merges new seed ids later without overwriting edits).

   Nutrients are per serving:
     kcal, protein/carbs/fat/fiber/sugar/addedSugar (g), sodium (mg),
     alcohol (g, 7 kcal each - already included in kcal).
   Planned-meal foods come from USDA / package labels and count as
   "exact". Chain items are published values but portions vary, so they
   count as "estimate". `verify: true` = check against the real label.
   `rev` = a corrected seed: bump it and installs whose stored copy has
   a lower rev take the new seed fields (see food.js mergeSeed).

   `processing` (NOVA-style) drives the ultra-processed signal:
     whole     - unprocessed / minimally processed (fruit, eggs, oats, milk)
     processed - simple recipes (cheese, plain yogurt, tuna, natural PB)
     ultra     - industrial recipes with additives (bars, pretzels, most
                 bread and jerky, fast food). The whey is tagged
                 "processed" on the assumption of a few-ingredient powder;
                 the Food tab lets Sean flip it if he keeps a sweetened one. */

function nut(kcal, protein, carbs, fat, fiber, sugar, addedSugar, sodium, alcohol = 0) {
  return { kcal, protein, carbs, fat, fiber, sugar, addedSugar, sodium, alcohol };
}

/* How one serving reads in a portion line: qty of unit (units when
   there's more than one) of `of`. 1.5 servings of { 8, "oz", "oz",
   "1% milk" } reads "12 oz 1% milk" (food-core portionText). */
function por(qty, unit, units, of = "") {
  return { qty, unit, units, of };
}

const FOOD_SEED_LIBRARY = [
  // Planned-meal building blocks
  { id: "on-whey", name: "ON Gold Standard Whey", serving: "1 scoop (31 g)", n: nut(120, 24, 3, 1.5, 1, 1, 1, 130), confidence: "exact", portion: por(1, "scoop", "scoops", "whey"), processing: "processed" },
  { id: "milk-1pct", name: "1% milk (Kroger)", serving: "1 cup (8 oz)", n: nut(110, 8, 12, 2.5, 0, 12, 0, 130), confidence: "exact", portion: por(8, "oz", "oz", "1% milk"), processing: "whole" },
  { id: "egg", name: "Large egg", serving: "1 egg", n: nut(72, 6.3, 0.4, 4.8, 0, 0.2, 0, 71), confidence: "exact", portion: por(1, "egg", "eggs"), processing: "whole" },
  // Vanilla, USDA label 2755682. Ultra: stevia + natural flavors + starch.
  { id: "oikos-pro", rev: 1, name: "Oikos Pro vanilla yogurt", serving: "¾ cup (170 g)", n: nut(160, 23, 9, 3, 0, 4, 0, 55), confidence: "exact", portion: por(0.75, "cup", "cups", "Oikos Pro vanilla"), processing: "ultra" },
  { id: "chicken-raw", name: "Chicken breast", serving: "4 oz raw", n: nut(120, 26, 0, 1.5, 0, 0, 0, 70), confidence: "exact", portion: por(4, "oz", "oz", "chicken (raw weight)"), processing: "whole" },
  { id: "strawberries", name: "Strawberries", serving: "½ pint (~160 g)", n: nut(51, 1.1, 12.3, 0.5, 3.2, 7.8, 0, 2), confidence: "exact", portion: por(0.5, "pint", "pints", "strawberries"), processing: "whole" },
  { id: "veg-mix", name: "Peas, carrots & corn", serving: "4 oz frozen", n: nut(75, 3, 15, 0.5, 4, 4, 0, 50), confidence: "exact", portion: por(4, "oz", "oz", "peas, carrots & corn"), processing: "whole" },
  { id: "bbq-low", name: "Low-sugar BBQ sauce", serving: "2 tbsp", n: nut(15, 0, 3, 0, 0, 1, 0, 300), confidence: "exact", verify: true, portion: por(2, "tbsp", "tbsp", "BBQ sauce"), processing: "ultra" },
  { id: "banana", name: "Banana", serving: "1 medium", n: nut(105, 1.3, 27, 0.4, 3.1, 14.4, 0, 1), confidence: "exact", portion: por(1, "banana", "bananas"), processing: "whole" },

  // Snack-idea foods (easy grocery buys). Per serving, from USDA
  // FoodData Central SR Legacy / Foundation entries (fdcId noted).
  { id: "string-cheese", name: "String cheese", serving: "1 stick (28 g)", n: nut(82.6, 6.7, 1.6, 5.5, 0, 0.5, 0, 186), confidence: "exact", portion: por(1, "stick", "sticks", "string cheese"), processing: "processed" }, // 171244
  { id: "apple", name: "Apple", serving: "1 medium (182 g)", n: nut(99.9, 0.2, 26.9, 0.3, 3.8, 21.5, 0, 0.5), confidence: "exact", portion: por(1, "apple", "apples"), processing: "whole" }, // 1750341
  { id: "peanut-butter", name: "Peanut butter", serving: "2 tbsp (32 g)", n: nut(191.4, 7.1, 7.1, 16.4, 1.6, 3.4, 2, 136), confidence: "exact", portion: por(2, "tbsp", "tbsp", "peanut butter"), processing: "ultra" }, // 174266
  { id: "almonds", name: "Almonds", serving: "1 oz (~23 nuts)", n: nut(163.5, 6, 5.6, 14.3, 3, 1.2, 0, 0), confidence: "exact", portion: por(1, "oz", "oz", "almonds (~23)"), processing: "whole" }, // 2346393
  { id: "beef-jerky", name: "Beef jerky", serving: "1 oz (28 g)", n: nut(114.8, 9.3, 3.1, 7.2, 0.5, 2.5, 2.5, 498), confidence: "exact", verify: true, portion: por(1, "oz", "oz", "beef jerky"), processing: "ultra" }, // 167536
  { id: "rice-cake", name: "Rice cake", serving: "1 cake (9 g)", n: nut(34.8, 0.7, 7.3, 0.3, 0.4, 0.1, 0, 2.3), confidence: "exact", portion: por(1, "rice cake", "rice cakes"), processing: "processed" }, // 170250
  { id: "honey", name: "Honey", serving: "1 tbsp (21 g)", n: nut(63.8, 0.1, 17.3, 0, 0, 17.2, 17.2, 0.8), confidence: "exact", portion: por(1, "tbsp", "tbsp", "honey"), processing: "whole" }, // 169640
  { id: "pretzels", name: "Pretzels", serving: "1 oz (28 g)", n: nut(107.5, 2.8, 22.5, 0.8, 1, 0.6, 0.6, 347), confidence: "exact", portion: por(1, "oz", "oz", "pretzels"), processing: "ultra" }, // 167555
  { id: "cottage-cheese", name: "Cottage cheese, 2%", serving: "½ cup (113 g)", n: nut(91.5, 11.8, 5.4, 2.6, 0, 4.5, 0, 348), confidence: "exact", portion: por(0.5, "cup", "cups", "2% cottage cheese"), processing: "processed" }, // 172182
  { id: "baby-carrots", name: "Baby carrots", serving: "10 carrots (100 g)", n: nut(35, 0.6, 8.2, 0.1, 2.9, 4.8, 0, 78), confidence: "exact", portion: por(10, "baby carrot", "baby carrots"), processing: "whole" }, // 168568
  { id: "hummus", name: "Hummus", serving: "2 tbsp (30 g)", n: nut(71.1, 2.3, 4.5, 5.3, 1.7, 0.2, 0, 128), confidence: "exact", portion: por(2, "tbsp", "tbsp", "hummus"), processing: "processed" }, // 174289
  { id: "oats", name: "Rolled oats", serving: "½ cup dry (40 g)", n: nut(151.6, 5.3, 27.1, 2.6, 4, 0.4, 0, 2.4), confidence: "exact", portion: por(0.5, "cup", "cups", "rolled oats (dry)"), processing: "whole" }, // 173904
  { id: "raisins", name: "Raisins", serving: "1 small box (43 g)", n: nut(129.4, 1.4, 34.4, 0.1, 1.4, 28.3, 0, 10.3), confidence: "exact", portion: por(1, "small box", "small boxes", "raisins"), processing: "whole" }, // 168164
  { id: "tuna-pouch", name: "Tuna pouch", serving: "1 pouch (2.6 oz)", n: nut(66.6, 14.1, 0.1, 0.7, 0, 0, 0, 162), confidence: "exact", portion: por(1, "pouch", "pouches", "tuna"), processing: "processed" }, // 334194
  { id: "natural-pb", name: "Natural peanut butter", serving: "2 tbsp (32 g)", n: nut(191.4, 7.1, 7.1, 16.4, 1.6, 3.4, 0, 136), confidence: "exact", portion: por(2, "tbsp", "tbsp", "natural peanut butter"), processing: "processed" }, // 174266, peanuts + salt only
  { id: "simple-bread", name: "Whole-grain bread (≤5 ingredients)", serving: "1 slice (34 g)", n: nut(80, 5, 15, 0.5, 3, 0, 0, 75), confidence: "exact", verify: true, portion: por(1, "slice", "slices", "simple whole-grain bread"), processing: "processed" }, // sprouted-grain label (e.g. Ezekiel)
  { id: "dates", name: "Medjool dates", serving: "1 date (24 g)", n: nut(66.5, 0.4, 18, 0, 1.6, 16, 0, 0.2), confidence: "exact", portion: por(1, "Medjool date", "Medjool dates"), processing: "whole" }, // 168191
  { id: "ww-bread", name: "Whole-wheat bread", serving: "1 slice (32 g)", n: nut(80.6, 4, 13.7, 1.1, 1.9, 1.4, 1, 146), confidence: "exact", portion: por(1, "slice", "slices", "whole-wheat bread"), processing: "ultra" }, // 172688

  // Drinks (one-tap buttons on the Food tab)
  { id: "white-claw", name: "White Claw", serving: "12 oz can", n: nut(100, 0, 2, 0, 0, 2, 2, 20, 14), confidence: "exact", drink: true, processing: "ultra" },
  { id: "light-beer", name: "Light beer", serving: "12 oz", n: nut(95, 0.6, 2.6, 0, 0, 0, 0, 10, 11), confidence: "exact", drink: true, processing: "processed" },

  // Chains - published nutrition for a standard order
  // Bowls are processed (cooked in-store from simple ingredients); the
  // burrito stays ultra for its commercial flour tortilla.
  { id: "chipotle-bowl", rev: 1, group: "chain", name: "Chipotle chicken bowl", serving: "white rice, black beans, fajita veg, salsa, cheese, lettuce", n: nut(670, 51, 72, 21, 11, 5, 0, 1810), confidence: "estimate", processing: "processed" },
  // Sean's usual order, summed from Chipotle's US per-ingredient chart
  // (Oct 2024). Pollo asado and chili lime chips are 2026 limited-time
  // items with no official macros: pollo asado uses third-party 4 oz
  // numbers, the chips use the official 550 kcal with regular-chip macros
  // (sodium is probably higher). Cooked in-store from simple ingredients,
  // so "processed", not ultra.
  { id: "chipotle-my-bowl", group: "chain", name: "My Chipotle bowl", serving: "pollo asado, white rice, fajitas, sour cream, cheese, lettuce, green + corn salsa", n: nut(730, 48, 70, 29.5, 6, 10, 0, 1710), confidence: "estimate", processing: "processed" },
  { id: "chipotle-chili-lime-queso", group: "chain", name: "Chipotle chili lime chips & queso", serving: "regular chips + side queso (serves 2)", n: nut(790, 17, 80, 43, 7, 3, 0, 880), confidence: "estimate", processing: "processed" },
  { id: "chipotle-burrito", group: "chain", name: "Chipotle chicken burrito", serving: "same fillings as the bowl + tortilla", n: nut(990, 59, 122, 30, 14, 6, 0, 2410), confidence: "estimate", processing: "ultra" },
  { id: "cfa-sandwich", group: "chain", name: "Chick-fil-A Chicken Sandwich", serving: "1 sandwich", n: nut(420, 29, 41, 18, 1, 6, 5, 1460), confidence: "estimate", processing: "ultra" },
  { id: "cfa-nuggets-8", group: "chain", name: "Chick-fil-A nuggets, 8 ct", serving: "8 nuggets, no sauce", n: nut(250, 27, 11, 11, 0, 1, 1, 1210), confidence: "estimate", processing: "ultra" },
  { id: "cfa-nuggets-12", group: "chain", name: "Chick-fil-A nuggets, 12 ct", serving: "12 nuggets, no sauce", n: nut(380, 40, 16, 17, 0, 1, 1, 1820), confidence: "estimate", processing: "ultra" },
  { id: "cfa-grilled-8", group: "chain", name: "Chick-fil-A grilled nuggets, 8 ct", serving: "8 nuggets", n: nut(130, 25, 1, 3, 0, 1, 0, 440), confidence: "estimate", processing: "ultra" },
  { id: "cfa-grilled-12", group: "chain", name: "Chick-fil-A grilled nuggets, 12 ct", serving: "12 nuggets", n: nut(200, 38, 2, 4.5, 0, 1, 0, 660), confidence: "estimate", processing: "ultra" },
  { id: "dominos-slice", group: "chain", name: "Domino's large cheese slice", serving: "1 of 8, hand tossed", n: nut(290, 12, 36, 11, 2, 3, 2, 590), confidence: "estimate", processing: "ultra" },
  { id: "bww-6", group: "chain", name: "BWW traditional wings, 6", serving: "6 wings, medium sauce", n: nut(480, 51, 2, 29, 0, 0, 0, 1400), confidence: "estimate", processing: "ultra" },
  { id: "bww-10", group: "chain", name: "BWW traditional wings, 10", serving: "10 wings, medium sauce", n: nut(800, 85, 3, 49, 0, 0, 0, 2300), confidence: "estimate", processing: "ultra" },
  { id: "five-guys-burger", group: "chain", name: "Five Guys cheeseburger", serving: "2 patties, regular toppings", n: nut(950, 47, 42, 62, 2, 9, 8, 1200), confidence: "estimate", processing: "ultra" },
  { id: "five-guys-little", group: "chain", name: "Five Guys little cheeseburger", serving: "1 patty, regular toppings", n: nut(610, 27, 40, 36, 2, 8, 8, 890), confidence: "estimate", processing: "ultra" },
  { id: "five-guys-fries", group: "chain", name: "Five Guys fries, little", serving: "little size", n: nut(530, 8, 72, 23, 8, 1, 0, 530), confidence: "estimate", processing: "ultra" },
  { id: "jm-italian", group: "chain", name: "Jersey Mike's #13 Italian, regular", serving: "regular, Mike's Way", n: nut(820, 38, 70, 42, 3, 6, 4, 2600), confidence: "estimate", processing: "ultra" },
];

/* Saved meals. `slots` are checklist item ids; `days` are getDay()
   values the meal is the plan for. Add-ons are optional toggles. */
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const SHAKE = [{ foodId: "on-whey", servings: 1.375 }, { foodId: "milk-1pct", servings: 1.5 }];

const FOOD_SEED_MEALS = [
  { id: "meal-shake", name: "Protein shake", detail: "1⅜ scoops ON + 12 oz 1% milk", items: SHAKE, slots: ["breakfast"], days: ALL_DAYS },
  {
    id: "meal-prep-lunch", name: "Meal prep", detail: "8 oz chicken, ½ pint strawberries, 4 oz veg",
    items: [{ foodId: "chicken-raw", servings: 2 }, { foodId: "strawberries", servings: 1 }, { foodId: "veg-mix", servings: 1 }],
    slots: ["lunch"], days: [1, 2, 3, 4, 5], addons: [{ foodId: "bbq-low", label: "+ BBQ sauce" }],
  },
  {
    id: "meal-egg-dinner", name: "Eggs, shake, yogurt", detail: "4 eggs + shake + Oikos Pro",
    items: [{ foodId: "egg", servings: 4 }, ...SHAKE, { foodId: "oikos-pro", servings: 1 }],
    slots: ["dinner"], days: [1, 2, 3, 4, 5],
  },
  { id: "meal-recovery", name: "Shake + banana", detail: "Recovery snack", items: [...SHAKE, { foodId: "banana", servings: 1 }], slots: ["post-lift"], days: ALL_DAYS },
  { id: "meal-pregame", name: "Banana + Oikos Pro", detail: "1–2 hours before tip", items: [{ foodId: "banana", servings: 1 }, { foodId: "oikos-pro", servings: 1 }], slots: ["pregame-snack"], days: ALL_DAYS },
  { id: "meal-oikos", name: "Oikos Pro", detail: "Quick protein between meals", items: [{ foodId: "oikos-pro", servings: 1 }], slots: ["snack-am", "snack-eve"], days: ALL_DAYS },
  { id: "meal-chipotle", name: "My Chipotle order", detail: "Bowl + chili lime chips & queso", items: [{ foodId: "chipotle-my-bowl", servings: 1 }, { foodId: "chipotle-chili-lime-queso", servings: 1 }], slots: [], days: [] },
  { id: "meal-postgame", name: "Oikos Pro + banana", detail: "Protein first, not whatever's around", items: [{ foodId: "oikos-pro", servings: 1 }, { foodId: "banana", servings: 1 }], slots: ["postgame"], days: ALL_DAYS },
];

/* Snack ideas: one-tap alternatives shown in a snack item's panel on
   Today, alongside (never repeating) the planned meal. Stored in
   localStorage like saved meals so their servings can be edited. */
const SNACK_IDEAS = [
  { id: "idea-apple-npb", name: "Apple + peanut butter", items: [{ foodId: "apple", servings: 1 }, { foodId: "natural-pb", servings: 1 }] },
  { id: "idea-cheese-apple", name: "String cheese + apple", items: [{ foodId: "string-cheese", servings: 2 }, { foodId: "apple", servings: 1 }] },
  { id: "idea-oikos-berries", name: "Oikos Pro + strawberries", items: [{ foodId: "oikos-pro", servings: 1 }, { foodId: "strawberries", servings: 1 }] },
  { id: "idea-oikos-almonds", name: "Oikos Pro + almonds", items: [{ foodId: "oikos-pro", servings: 1 }, { foodId: "almonds", servings: 1 }] },
  { id: "idea-eggs-apple", name: "Hard-boiled eggs + apple", items: [{ foodId: "egg", servings: 2 }, { foodId: "apple", servings: 1 }] },
  { id: "idea-cheese-almonds", name: "String cheese + almonds", items: [{ foodId: "string-cheese", servings: 2 }, { foodId: "almonds", servings: 1 }] },
  { id: "idea-pb-toast-natural", name: "PB-banana toast", items: [{ foodId: "simple-bread", servings: 1 }, { foodId: "natural-pb", servings: 1 }, { foodId: "banana", servings: 1 }] },
  { id: "idea-almonds-raisins", name: "Almonds + raisins", items: [{ foodId: "almonds", servings: 1 }, { foodId: "raisins", servings: 1 }] },
  { id: "idea-oikos-oats", name: "Oikos Pro + oats + strawberries", items: [{ foodId: "oikos-pro", servings: 1 }, { foodId: "oats", servings: 1 }, { foodId: "strawberries", servings: 1 }] },
  { id: "idea-tuna-apple", name: "Tuna + rice cakes + apple", items: [{ foodId: "tuna-pouch", servings: 1 }, { foodId: "rice-cake", servings: 2 }, { foodId: "apple", servings: 1 }] },
  { id: "idea-carrots-hummus", name: "Carrots + hummus + string cheese", items: [{ foodId: "baby-carrots", servings: 1 }, { foodId: "hummus", servings: 2 }, { foodId: "string-cheese", servings: 1 }] },
  { id: "idea-dates-banana", name: "Dates + banana", items: [{ foodId: "dates", servings: 2 }, { foodId: "banana", servings: 1 }] },
  { id: "idea-cakes-honey", name: "Rice cakes + honey + banana", items: [{ foodId: "rice-cake", servings: 2 }, { foodId: "honey", servings: 1 }, { foodId: "banana", servings: 1 }] },
  { id: "idea-shake-banana", name: "Shake + banana", items: [...SHAKE, { foodId: "banana", servings: 1 }] },
  { id: "idea-cottage-berries", name: "Cottage cheese + strawberries", items: [{ foodId: "cottage-cheese", servings: 2 }, { foodId: "strawberries", servings: 1 }] },
  { id: "idea-milk-banana", name: "Milk + banana", items: [{ foodId: "milk-1pct", servings: 2 }, { foodId: "banana", servings: 1 }] },
  { id: "idea-tuna-banana", name: "Tuna + rice cakes + banana", items: [{ foodId: "tuna-pouch", servings: 1 }, { foodId: "rice-cake", servings: 2 }, { foodId: "banana", servings: 1 }] },
  { id: "idea-cheese-2", name: "String cheese ×2", items: [{ foodId: "string-cheese", servings: 2 }] },
];

/* Which ideas (in order) and what tip show for each snack slot on each
   kind of day (food-core dayType: game / lift / rest). */
const SNACK_PLAN = {
  "snack-am": {
    game: { tip: "Steady energy for the day: protein + fiber.", ideas: ["idea-apple-npb", "idea-cheese-apple", "idea-oikos-berries"] },
    lift: { tip: "Protein-forward — today's lift needs it.", ideas: ["idea-oikos-almonds", "idea-eggs-apple", "idea-cheese-almonds"] },
  },
  "snack-pm": {
    game: { tip: "Carbs now fuel tonight's game; keep it 3–4 hours before tip.", ideas: ["idea-pb-toast-natural", "idea-almonds-raisins", "idea-oikos-oats"] },
    lift: { tip: "Pre-lift fuel, ~2½ hours out: carbs + protein.", ideas: ["idea-oikos-oats", "idea-tuna-apple", "idea-pb-toast-natural"] },
    rest: { tip: "Rest day: fiber + protein, nothing heavy.", ideas: ["idea-carrots-hummus", "idea-apple-npb", "idea-oikos-berries"] },
  },
  "pregame-snack": {
    game: { tip: "Fast natural carbs, low fat, so it sits light on the court.", ideas: ["idea-dates-banana", "idea-cakes-honey"] },
  },
  postgame: {
    game: { tip: "Protein + carbs to recover; lights-out is soon, so keep it moderate.", ideas: ["idea-shake-banana", "idea-cottage-berries"] },
  },
  "post-lift": {
    lift: { tip: "30–45 minutes after: ~20–40 g protein plus carbs.", ideas: ["idea-milk-banana", "idea-tuna-banana"] },
  },
  "snack-eve": {
    lift: { tip: "Light and protein-heavy before sleep.", ideas: ["idea-cottage-berries", "idea-cheese-2"] },
  },
};

/* Takeout with no official numbers: a typical "M" order, scaled by
   calories for S and L (all nutrients scale together). */
const TAKEOUT_PRESETS = [
  { id: "pizza", name: "Pizza", m: nut(290, 12, 35, 11, 2, 4, 2, 640), sizes: { S: [230, "thin-crust slice"], M: [290, "regular slice"], L: [450, "big NY / deep-dish slice"] } },
  { id: "burger", name: "Burger", m: nut(550, 30, 40, 30, 2, 9, 6, 1100), sizes: { S: [350, "single fast-food"], M: [550, "quarter-pound + cheese"], L: [900, "double / restaurant"] } },
  { id: "wings", name: "Wings", m: nut(830, 70, 5, 58, 0, 2, 2, 2600), sizes: { S: [500, "6 wings"], M: [830, "10 wings"], L: [1250, "15 wings"] } },
  { id: "burrito", name: "Burrito / bowl", m: nut(900, 45, 100, 32, 14, 6, 1, 2000), sizes: { S: [550, "bowl"], M: [900, "burrito"], L: [1200, "loaded burrito"] } },
  { id: "sub", name: "Sub", m: nut(650, 35, 65, 26, 4, 8, 4, 1800), sizes: { S: [450, "6-inch"], M: [650, "regular"], L: [1000, "12-inch"] } },
  { id: "chicken-sandwich", name: "Chicken sandwich", m: nut(500, 30, 45, 22, 2, 7, 5, 1400), sizes: { S: [380, "grilled"], M: [500, "fried"], L: [700, "deluxe / spicy"] } },
  { id: "chinese", name: "Chinese plate", m: nut(1000, 40, 120, 38, 5, 25, 20, 2200), sizes: { S: [600, "1 entrée + side"], M: [1000, "2 entrées + rice"], L: [1400, "3 entrées"] } },
  { id: "tacos", name: "Tacos", m: nut(600, 30, 50, 30, 7, 4, 1, 1200), sizes: { S: [400, "2 tacos"], M: [600, "3 tacos"], L: [1000, "5 tacos"] } },
  { id: "fries", name: "Fries", m: nut(350, 4, 45, 17, 4, 0, 0, 260), sizes: { S: [230, "small"], M: [350, "medium"], L: [500, "large"] } },
];

if (typeof module !== "undefined") {
  module.exports = { FOOD_SEED_LIBRARY, FOOD_SEED_MEALS, SNACK_IDEAS, SNACK_PLAN, TAKEOUT_PRESETS };
}
