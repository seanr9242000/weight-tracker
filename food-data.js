/* Seed data for the Food tab: the foods behind Sean's planned meals,
   the saved meals mapped to checklist slots, chain-restaurant items,
   and S/M/L takeout estimates. Copied into localStorage on first run
   (food.js merges new seed ids later without overwriting edits).

   Nutrients are per serving:
     kcal, protein/carbs/fat/fiber/sugar/addedSugar (g), sodium (mg),
     alcohol (g, 7 kcal each - already included in kcal).
   Planned-meal foods come from USDA / package labels and count as
   "exact". Chain items are published values but portions vary, so they
   count as "estimate". `verify: true` = check against the real label. */

function nut(kcal, protein, carbs, fat, fiber, sugar, addedSugar, sodium, alcohol = 0) {
  return { kcal, protein, carbs, fat, fiber, sugar, addedSugar, sodium, alcohol };
}

const FOOD_SEED_LIBRARY = [
  // Planned-meal building blocks
  { id: "on-whey", name: "ON Gold Standard Whey", serving: "1 scoop (31 g)", n: nut(120, 24, 3, 1.5, 1, 1, 1, 130), confidence: "exact" },
  { id: "milk-1pct", name: "1% milk (Kroger)", serving: "1 cup (8 oz)", n: nut(110, 8, 12, 2.5, 0, 12, 0, 130), confidence: "exact" },
  { id: "egg", name: "Large egg", serving: "1 egg", n: nut(72, 6.3, 0.4, 4.8, 0, 0.2, 0, 71), confidence: "exact" },
  { id: "oikos-pro", name: "Oikos Pro yogurt", serving: "1 cup", n: nut(150, 23, 7, 2.5, 0, 4, 0, 90), confidence: "exact", verify: true },
  { id: "chicken-raw", name: "Chicken breast", serving: "4 oz raw", n: nut(120, 26, 0, 1.5, 0, 0, 0, 70), confidence: "exact" },
  { id: "strawberries", name: "Strawberries", serving: "½ pint (~160 g)", n: nut(51, 1.1, 12.3, 0.5, 3.2, 7.8, 0, 2), confidence: "exact" },
  { id: "veg-mix", name: "Peas, carrots & corn", serving: "4 oz frozen", n: nut(75, 3, 15, 0.5, 4, 4, 0, 50), confidence: "exact" },
  { id: "bbq-low", name: "Low-sugar BBQ sauce", serving: "2 tbsp", n: nut(15, 0, 3, 0, 0, 1, 0, 300), confidence: "exact", verify: true },
  { id: "banana", name: "Banana", serving: "1 medium", n: nut(105, 1.3, 27, 0.4, 3.1, 14.4, 0, 1), confidence: "exact" },

  // Drinks (one-tap buttons on the Food tab)
  { id: "white-claw", name: "White Claw", serving: "12 oz can", n: nut(100, 0, 2, 0, 0, 2, 2, 20, 14), confidence: "exact", drink: true },
  { id: "light-beer", name: "Light beer", serving: "12 oz", n: nut(95, 0.6, 2.6, 0, 0, 0, 0, 10, 11), confidence: "exact", drink: true },

  // Chains - published nutrition for a standard order
  { id: "chipotle-bowl", group: "chain", name: "Chipotle chicken bowl", serving: "white rice, black beans, fajita veg, salsa, cheese, lettuce", n: nut(670, 51, 72, 21, 11, 5, 0, 1810), confidence: "estimate" },
  { id: "chipotle-burrito", group: "chain", name: "Chipotle chicken burrito", serving: "same fillings as the bowl + tortilla", n: nut(990, 59, 122, 30, 14, 6, 0, 2410), confidence: "estimate" },
  { id: "cfa-sandwich", group: "chain", name: "Chick-fil-A Chicken Sandwich", serving: "1 sandwich", n: nut(420, 29, 41, 18, 1, 6, 5, 1460), confidence: "estimate" },
  { id: "cfa-nuggets-8", group: "chain", name: "Chick-fil-A nuggets, 8 ct", serving: "8 nuggets, no sauce", n: nut(250, 27, 11, 11, 0, 1, 1, 1210), confidence: "estimate" },
  { id: "cfa-nuggets-12", group: "chain", name: "Chick-fil-A nuggets, 12 ct", serving: "12 nuggets, no sauce", n: nut(380, 40, 16, 17, 0, 1, 1, 1820), confidence: "estimate" },
  { id: "cfa-grilled-8", group: "chain", name: "Chick-fil-A grilled nuggets, 8 ct", serving: "8 nuggets", n: nut(130, 25, 1, 3, 0, 1, 0, 440), confidence: "estimate" },
  { id: "cfa-grilled-12", group: "chain", name: "Chick-fil-A grilled nuggets, 12 ct", serving: "12 nuggets", n: nut(200, 38, 2, 4.5, 0, 1, 0, 660), confidence: "estimate" },
  { id: "dominos-slice", group: "chain", name: "Domino's large cheese slice", serving: "1 of 8, hand tossed", n: nut(290, 12, 36, 11, 2, 3, 2, 590), confidence: "estimate" },
  { id: "bww-6", group: "chain", name: "BWW traditional wings, 6", serving: "6 wings, medium sauce", n: nut(480, 51, 2, 29, 0, 0, 0, 1400), confidence: "estimate" },
  { id: "bww-10", group: "chain", name: "BWW traditional wings, 10", serving: "10 wings, medium sauce", n: nut(800, 85, 3, 49, 0, 0, 0, 2300), confidence: "estimate" },
  { id: "five-guys-burger", group: "chain", name: "Five Guys cheeseburger", serving: "2 patties, regular toppings", n: nut(950, 47, 42, 62, 2, 9, 8, 1200), confidence: "estimate" },
  { id: "five-guys-little", group: "chain", name: "Five Guys little cheeseburger", serving: "1 patty, regular toppings", n: nut(610, 27, 40, 36, 2, 8, 8, 890), confidence: "estimate" },
  { id: "five-guys-fries", group: "chain", name: "Five Guys fries, little", serving: "little size", n: nut(530, 8, 72, 23, 8, 1, 0, 530), confidence: "estimate" },
  { id: "jm-italian", group: "chain", name: "Jersey Mike's #13 Italian, regular", serving: "regular, Mike's Way", n: nut(820, 38, 70, 42, 3, 6, 4, 2600), confidence: "estimate" },
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
  { id: "meal-postgame", name: "Oikos Pro + banana", detail: "Protein first, not whatever's around", items: [{ foodId: "oikos-pro", servings: 1 }, { foodId: "banana", servings: 1 }], slots: ["postgame"], days: ALL_DAYS },
];

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
  module.exports = { FOOD_SEED_LIBRARY, FOOD_SEED_MEALS, TAKEOUT_PRESETS };
}
