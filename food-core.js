/* Food core: nutrient math, calorie targets, the weekly budget with its
   weekend bank, health-signal scoring, and the adaptive maintenance
   estimate. Like coach-core.js it has no DOM access - every function
   takes its data as arguments, so it's testable on its own
   (tests/food-core.test.html). Depends on coach-core.js date helpers.

   Log entries store nutrients PER SERVING in `n` plus a `servings`
   count, so editing servings later never loses the original numbers. */

/* `upf` = calories that came from ultra-processed food. It's carried
   like a nutrient so it sums, scales and snapshots the same way. */
const NUTRIENT_KEYS = ["kcal", "protein", "carbs", "fat", "fiber", "sugar", "addedSugar", "sodium", "alcohol", "upf"];
const UPF_LIMIT_PCT = 20;

const GUIDE_FLOOR = 1800;           // never suggest eating less than this in a day
const DISCOVERY_DAYS = 14;          // first two weeks: measure, don't judge
const ADAPT_WINDOW_DAYS = 21;
const ADAPT_MIN_COMPLETE_DAYS = 10;
const ADAPT_MIN_WEIGH_INS = 8;
const ADAPT_MIN_SPAN_DAYS = 14;
const ADAPT_MAX_STEP = 250;         // kcal a single check-in may move maintenance
const ADAPT_MIN_CHANGE = 100;       // smaller proposals aren't worth interrupting for
const KCAL_PER_LB = 3500;
const LB_PER_KG = 2.20462;

const round1 = (x) => Math.round(x * 10) / 10;
const roundTo = (x, step) => Math.round(x / step) * step;

function emptyNutrients() {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0]));
}

function scaleNutrients(n, factor) {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, round1((n[k] || 0) * factor)]));
}

function sumNutrients(list) {
  const total = emptyNutrients();
  for (const n of list) for (const k of NUTRIENT_KEYS) total[k] += n[k] || 0;
  return scaleNutrients(total, 1);
}

/* One serving of a library food, with `upf` filled in from its
   processing tag (all of its calories, or none). */
function foodNutrients(food) {
  return { ...scaleNutrients(food.n, 1), upf: food.processing === "ultra" ? food.n.kcal : 0 };
}

/* A saved meal's nutrients from the food library, plus any add-ons
   switched on. One estimated ingredient makes the whole meal an
   estimate. Unknown food ids (e.g. a deleted custom food) are skipped. */
function mealNutrients(meal, library, addonIds) {
  const byId = Object.fromEntries(library.map((f) => [f.id, f]));
  const parts = [...meal.items, ...(addonIds || []).map((foodId) => ({ foodId, servings: 1 }))];
  const foods = parts.filter((p) => byId[p.foodId]);
  return {
    n: sumNutrients(foods.map((p) => scaleNutrients(foodNutrients(byId[p.foodId]), p.servings))),
    confidence: foods.every((p) => byId[p.foodId].confidence === "exact") ? "exact" : "estimate",
  };
}

/* S/M/L takeout: every nutrient scales with the size's calories.
   Takeout counts as ultra-processed. */
function takeoutNutrients(preset, size) {
  const n = scaleNutrients(preset.m, preset.sizes[size][0] / preset.m.kcal);
  return { ...n, upf: n.kcal };
}

function entryTotal(entry) {
  return scaleNutrients(entry.n, entry.servings);
}

function dayTotals(log, dateStr) {
  return sumNutrients(log.filter((e) => e.date === dateStr).map(entryTotal));
}

/* Monday-to-Sunday week containing the date, so the weekend bank comes
   at the end and Sunday's check-in closes the week. */
function weekDates(dateStr) {
  const offset = (parseLocalDate(dateStr).getDay() + 6) % 7;
  const monday = shiftDate(dateStr, -offset);
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

function targetCalories(settings) {
  return Math.round(settings.maintenance + (settings.goal.rateLbPerWk || 0) * KCAL_PER_LB / 7);
}

function mifflinStJeor(profile, weightKg) {
  return 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === "female" ? -161 : 5);
}

function startingMaintenance(profile, weightLb) {
  return roundTo(mifflinStJeor(profile, weightLb / LB_PER_KG) * profile.activity, 50);
}

function defaultSettings(todayStr, weightLb) {
  const profile = { age: 26, sex: "male", heightCm: 194.3, activity: 1.5 };
  return {
    profile,
    goal: { mode: "maintain", rateLbPerWk: 0 },
    maintenance: weightLb ? startingMaintenance(profile, weightLb) : 3000,
    protein: 190,
    limits: { addedSugar: 36, fiber: 38, sodium: 2300, upfPct: UPF_LIMIT_PCT },
    bank: { 6: 1500, 0: 500 },
    startDate: todayStr,
  };
}

/* Today's calorie guide from the weekly budget.
   - Budget = target x active days this week (days before startDate
     don't count, so starting midweek isn't a free-for-all).
   - Bank days (Sat/Sun by default) get extra; weekdays give it up evenly.
   - Past days with nothing logged count as eaten exactly to plan, so
     forgetting to log doesn't inflate today's number.
   - The guide re-spreads whatever is left over the rest of the week,
     but never drops below GUIDE_FLOOR. */
function dailyGuide(settings, log, dateStr) {
  const target = targetCalories(settings);
  const bankFor = (d) => (settings.bank && settings.bank[parseLocalDate(d).getDay()]) || 0;
  const active = weekDates(dateStr).filter((d) => !settings.startDate || d >= settings.startDate || d >= dateStr);
  const budget = target * active.length;
  const totalBank = active.reduce((sum, d) => sum + bankFor(d), 0);
  const plannedFor = (d) => (budget - totalBank) / active.length + bankFor(d);

  let remaining = budget;
  for (const d of active.filter((d) => d < dateStr)) {
    const logged = log.some((e) => e.date === d);
    remaining -= logged ? dayTotals(log, d).kcal : plannedFor(d);
  }
  const left = active.filter((d) => d >= dateStr);
  const bankLeft = left.reduce((sum, d) => sum + bankFor(d), 0);
  const raw = (remaining - bankLeft) / left.length + bankFor(dateStr);
  return {
    target,
    budget,
    guide: Math.max(GUIDE_FLOOR, roundTo(raw, 10)),
    over: raw < GUIDE_FLOOR,
    weekLeft: Math.round(remaining - dayTotals(log, dateStr).kcal),
    daysLeft: left.length,
  };
}

function inDiscovery(settings, dateStr) {
  if (!settings.startDate) return false;
  const day = daysBetween(settings.startDate, dateStr);
  return day >= 0 && day < DISCOVERY_DAYS;
}

/* "good" / "warn" / "bad" for one day's value, or "neutral" during
   Discovery. Limits: warn up to 1.5x. Minimums: warn from 65%. */
function signalStatus(key, value, settings, discovery) {
  if (discovery) return "neutral";
  if (key === "protein" || key === "fiber") {
    const min = key === "protein" ? settings.protein : settings.limits.fiber;
    return value >= min ? "good" : value >= min * 0.65 ? "warn" : "bad";
  }
  // Settings saved before the ultra-processed signal existed lack upfPct.
  const limit = key === "upfPct" ? settings.limits.upfPct ?? UPF_LIMIT_PCT : settings.limits[key];
  return value <= limit ? "good" : value <= limit * 1.5 ? "warn" : "bad";
}

function plannedMealFor(meals, itemId, dateStr) {
  const day = parseLocalDate(dateStr).getDay();
  return meals.find((m) => m.slots.includes(itemId) && m.days.includes(day)) || null;
}

/* Share of the day's calories that came from estimates, 0-100. */
function estimatedShare(log, dateStr) {
  const entries = log.filter((e) => e.date === dateStr);
  const total = entries.reduce((sum, e) => sum + entryTotal(e).kcal, 0);
  if (!total) return 0;
  const est = entries.filter((e) => e.confidence !== "exact").reduce((sum, e) => sum + entryTotal(e).kcal, 0);
  return Math.round((est / total) * 100);
}

/* Share of the day's calories from ultra-processed food, 0-100. */
function upfShare(log, dateStr) {
  const t = dayTotals(log, dateStr);
  return t.kcal ? Math.round((t.upf / t.kcal) * 100) : 0;
}

/* Most recent entry per distinct name, newest first. */
function recentFoods(log, limit) {
  const seen = new Set();
  const out = [];
  for (const e of [...log].sort((a, b) => b.at - a.at)) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    out.push(e);
    if (out.length === limit) break;
  }
  return out;
}

function weekAlcohol(log, dateStr) {
  const week = new Set(weekDates(dateStr));
  let grams = 0;
  let drinks = 0;
  for (const e of log) {
    if (!week.has(e.date) || !(e.n.alcohol > 0)) continue;
    grams += e.n.alcohol * e.servings;
    drinks += e.servings;
  }
  return { kcal: Math.round(grams * 7), drinks: round1(drinks) };
}

/* ---- Water ---- */

/* Daily goal in fl oz: a base of about half bodyweight (lb) unless one
   is set under Targets, plus extra on lift and game days for sweat. */
const WATER_DEFAULTS = { base: null, lift: 20, game: 32 };
const WATER_BUTTONS = [8, 20, 40]; // a cup, half the tumbler, the tumbler

function waterSettings(settings) {
  return { ...WATER_DEFAULTS, ...(settings.water || {}) };
}

function waterGoal(settings, weightLb, type) {
  const w = waterSettings(settings);
  const base = w.base || (weightLb ? roundTo(weightLb / 2, 4) : 100);
  return base + (type === "game" ? w.game : type === "lift" ? w.lift : 0);
}

function waterTotal(log, dateStr) {
  return log.filter((e) => e.date === dateStr).reduce((sum, e) => sum + e.oz, 0);
}

/* ---- Snack ideas ---- */

/* What kind of day the schedule says it is, for snack advice. */
function dayType(items) {
  if (items.some((i) => i.id === "game")) return "game";
  if (items.some((i) => i.id === "lift")) return "lift";
  return "rest";
}

/* The ideas for one snack slot on one kind of day, in the plan's order,
   taken from `ideas` (Sean's stored copy, so edited servings apply). */
function snackIdeasFor(ideas, plan, slot, type) {
  const entry = plan[slot] && plan[slot][type];
  if (!entry) return [];
  const byId = Object.fromEntries(ideas.map((i) => [i.id, i]));
  return entry.ideas.map((id) => byId[id]).filter(Boolean);
}

function snackTip(plan, slot, type) {
  return (plan[slot] && plan[slot][type] && plan[slot][type].tip) || null;
}

const FRACTIONS = { 0.125: "⅛", 0.25: "¼", 0.375: "⅜", 0.5: "½", 0.625: "⅝", 0.75: "¾", 0.875: "⅞" };

function fmtQty(x) {
  const whole = Math.floor(x);
  const frac = FRACTIONS[Math.round((x - whole) * 1000) / 1000];
  if (frac) return `${whole || ""}${frac}`;
  return Number.isInteger(x) ? String(x) : String(round1(x));
}

/* "2 sticks string cheese · 1 apple" from a meal's items. Foods without
   portion info fall back to "2 × Chipotle chicken bowl". */
function portionText(items, library) {
  const byId = Object.fromEntries(library.map((f) => [f.id, f]));
  return items.filter((it) => byId[it.foodId]).map((it) => {
    const food = byId[it.foodId];
    const p = food.portion;
    if (!p) return `${fmtQty(it.servings)} × ${food.name}`;
    const qty = p.qty * it.servings;
    return [fmtQty(qty), qty <= 1 ? p.unit : p.units, p.of].filter(Boolean).join(" ");
  }).join(" · ");
}

/* ---- Fuel vs feel (after-game / after-lift check-ins) ---- */

const FEEL_WINDOW_HOURS = 4;

/* Food logged for the hours before an item (a game at 19:00 -> 15:00
   to 19:00), oldest first. Food logged into a checklist slot counts by
   that slot's scheduled time, so a pre-game snack logged late still
   counts; "extra" entries count by when they were logged. */
function foodsBefore(log, items, dateStr, time, hours = FEEL_WINDOW_HOURS) {
  const end = timeOfDay(time);
  const start = end - hours * 60;
  const slotMinutes = Object.fromEntries(items.map((i) => [i.id, timeOfDay(i.time)]));
  return log
    .filter((e) => e.date === dateStr)
    .map((e) => {
      const d = new Date(e.at);
      const when = e.slot in slotMinutes ? slotMinutes[e.slot] : d.getHours() * 60 + d.getMinutes();
      return { e, when };
    })
    .filter(({ when }) => when >= start && when < end)
    .sort((a, b) => a.when - b.when)
    .map(({ e }) => e);
}

function timeOfDay(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/* Per food eaten before a rated game/lift: how often, average energy
   (null if never rated), and how the stomach felt. Most-eaten first. */
function fuelVsFeel(feelLog) {
  const byName = {};
  for (const rec of feelLog) {
    for (const name of new Set(rec.ate || [])) {
      const row = byName[name] || (byName[name] = { name, count: 0, energySum: 0, energyN: 0, stomach: { right: 0, full: 0, hungry: 0 } });
      row.count++;
      if (typeof rec.energy === "number") {
        row.energySum += rec.energy;
        row.energyN++;
      }
      if (rec.stomach in row.stomach) row.stomach[rec.stomach]++;
    }
  }
  return Object.values(byName)
    .map(({ name, count, energySum, energyN, stomach }) => ({ name, count, energy: energyN ? round1(energySum / energyN) : null, stomach }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* Local search for the food picker. Every query word must appear in
   the name (or brand), case-insensitive. Results come in the order
   Sean is most likely to want them: things he's logged before (newest
   first), saved meals, foods (favorites first), then takeout presets.
   A food already shown as a past entry isn't repeated. An empty query
   lists recent entries. Each result: { type, name, item }. */
function searchFoods(query, { log, library, meals, presets }, limit = 30) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text) => words.every((w) => text.toLowerCase().includes(w));
  const recents = recentFoods(log, words.length ? 200 : 12)
    .filter((e) => !words.length || matches(e.name))
    .map((item) => ({ type: "recent", name: item.name, item }));
  if (!words.length) return recents;

  const seen = new Set(recents.map((r) => r.name.toLowerCase()));
  const fresh = (r) => !seen.has(r.name.toLowerCase());
  const foods = [...library]
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0))
    .filter((f) => matches(`${f.name} ${f.brand || ""}`))
    .map((item) => ({ type: "food", name: item.name, item }));
  // The cap trims foods, never the handful of takeout presets: a word
  // like "chick" matches dozens of chain items and would hide them.
  const takeout = presets.filter((p) => matches(p.name)).map((item) => ({ type: "takeout", name: item.name, item }));
  return [
    ...recents,
    ...meals.filter((m) => matches(m.name)).map((item) => ({ type: "meal", name: item.name, item })).filter(fresh),
    ...foods.filter(fresh),
  ].slice(0, Math.max(0, limit - takeout.length)).concat(takeout);
}

/* ---- Meals (feedback batch 1, B2) ---- */

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
const MEAL_BY_SLOT = {
  breakfast: "breakfast", lunch: "lunch", dinner: "dinner", "treat-meal": "dinner",
  "snack-am": "snack", "snack-pm": "snack", "snack-eve": "snack", "pregame-snack": "snack", "post-lift": "snack", postgame: "snack",
};

/* The meal a time of day (minutes after midnight) most likely is. Each
   range includes its start: 10:00 is a snack, 11:30 is lunch. Late-night
   food (before 4:00) is a snack, not breakfast. */
function mealForTime(minutes) {
  if (minutes < 240) return "snack";
  if (minutes < 600) return "breakfast";
  if (minutes < 690) return "snack";
  if (minutes < 870) return "lunch";
  if (minutes < 1020) return "snack";
  if (minutes < 1230) return "dinner";
  return "snack";
}

/* A checklist slot's meal; "extra" and slots that aren't meals (PT items,
   one-off additions) go by the clock. */
function mealForSlot(slot, minutes) {
  return MEAL_BY_SLOT[slot] || mealForTime(minutes);
}

/* The section an entry belongs in. Entries from before meals existed have
   no `meal`, so it comes from their slot, then from when they were eaten. */
function mealForEntry(entry) {
  if (MEALS.includes(entry.meal)) return entry.meal;
  if (MEAL_BY_SLOT[entry.slot]) return MEAL_BY_SLOT[entry.slot];
  if (typeof entry.at !== "number" || !Number.isFinite(entry.at)) return "snack";
  const d = new Date(entry.at);
  return mealForTime(d.getHours() * 60 + d.getMinutes());
}

/* ---- Tray (feedback batch 1, B1): picks waiting to be logged together ---- */

const TRAY_MIN_SERVINGS = 0.5;

/* One key per food however it was picked (search, My foods, Chains, a past
   entry), so picking it twice raises its servings instead of adding a row. */
function trayKey(ref, name, n) {
  if (ref && ref.food) return `food:${ref.food}`;
  if (ref && ref.meal) return `meal:${ref.meal}${ref.addons && ref.addons.length ? `+${[...ref.addons].sort().join(",")}` : ""}`;
  if (ref && ref.takeout) return `takeout:${ref.takeout}:${ref.size}`;
  return `name:${name}|${n.kcal}`;
}

function trayAdd(items, pick) {
  if (items.some((i) => i.key === pick.key)) {
    return items.map((i) => (i.key === pick.key ? { ...i, servings: i.servings + 1 } : i));
  }
  return [...items, { ...pick, servings: pick.servings || 1 }];
}

function trayStep(items, key, delta) {
  return items.map((i) => (i.key === key ? { ...i, servings: Math.max(TRAY_MIN_SERVINGS, i.servings + delta) } : i));
}

function trayRemove(items, key) {
  return items.filter((i) => i.key !== key);
}

function trayTotals(items) {
  const t = sumNutrients(items.map(entryTotal));
  return { count: items.length, kcal: t.kcal, protein: t.protein };
}

/* A USDA FoodData Central result (as slimmed by the food-search Edge
   Function: nutrients per 100 g) -> a library food. Branded foods use
   their label serving; generic foods (Foundation, SR Legacy, FNDDS)
   have no serving size, so one serving = 100 g. USDA rarely reports
   added sugar for branded foods; when it's missing, total sugar counts
   as added (most sugar in packaged food is), and as 0 for whole foods.
   Measured/label data, so "exact" rather than an estimate. */
const USDA_UNITS = { g: "g", grm: "g", ml: "ml", mlt: "ml" };

/* NOVA-style tag for a USDA result. Branded foods are judged by their
   ingredient list: industrial additives or a long list = ultra, a
   single ingredient = whole, anything else = processed. Generic foods
   have no ingredient list, so their USDA description decides. */
const UPF_MARKERS = [
  "corn syrup", "maltodextrin", "dextrose", "invert sugar", "natural flavor", "artificial flavor", "flavoring",
  "sucralose", "acesulfame", "aspartame", "saccharin", "stevia", "rebaudioside", "sugar alcohol", "erythritol",
  "hydrogenated", "interesterified", "modified starch", "modified food starch", "protein isolate", "isolate",
  "hydrolyzed", "mono- and diglycerides", "monoglycerides", "polysorbate", "carrageenan", "xanthan", "guar gum",
  "cellulose gum", "gellan", "lecithin", "emulsifier", "sodium nitrite", "caramel color", "red 40", "yellow 5",
  "yellow 6", "blue 1", "soluble corn fiber", "polydextrose",
];
const UPF_GENERIC = /\b(snacks?|candies|candy|cookies?|cakes?|doughnuts?|crackers?|chips|soda|soft drinks?|beverages?, carbonated|cereals? ready-to-eat|fast foods?|mcdonald|burger king|wendy|taco bell|kfc|subway|pizza hut|domino|frankfurters?|hot dogs?|bologna|salami|pepperoni|nuggets?|frozen dinner|pastries|pop-tarts|ice cream)\b/i;
const PROCESSED_GENERIC = /\b(cheese|bread|canned|smoked|cured|bacon|ham|sausage|yogurt|tofu|pasta|noodles|tortillas?|butter|syrup|jam|juice)\b/i;
const UPF_MAX_INGREDIENTS = 10;

function classifyProcessing(hit) {
  const name = hit.name || "";
  if (hit.dataType !== "Branded") {
    if (UPF_GENERIC.test(name)) return "ultra";
    return PROCESSED_GENERIC.test(name) ? "processed" : "whole";
  }
  const ingredients = String(hit.ingredients || "").toLowerCase();
  if (!ingredients.trim()) return "processed";
  if (UPF_MARKERS.some((m) => ingredients.includes(m))) return "ultra";
  // Top-level ingredients only: commas inside parentheses are sub-lists.
  const count = ingredients.replace(/\([^)]*\)/g, "").split(/[,;]/).filter((x) => x.trim()).length;
  if (count > UPF_MAX_INGREDIENTS) return "ultra";
  return count <= 1 ? "whole" : "processed";
}

function tidyName(text) {
  if (!text || text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase());
}

function usdaToFood(hit) {
  const unit = USDA_UNITS[String(hit.servingSizeUnit || "").toLowerCase()];
  const labelServing = hit.dataType === "Branded" && unit && hit.servingSize > 0;
  const factor = labelServing ? hit.servingSize / 100 : 1;
  const per100 = hit.per100 || {};
  const n = scaleNutrients(per100, factor);
  if (per100.addedSugar === undefined) n.addedSugar = hit.dataType === "Branded" ? n.sugar : 0;
  const processing = classifyProcessing(hit);
  n.upf = processing === "ultra" ? n.kcal : 0;
  const name = tidyName(hit.name);
  const brand = tidyName(hit.brand) || undefined;
  // Branded entries often name only the product ("Protein Bar, Cookies
  // & Cream"), which is useless in the log without the brand.
  const brandWord = brand ? brand.split(/\s+/)[0].toLowerCase() : "";
  return {
    id: `usda-${hit.fdcId}`,
    name: brand && !name.toLowerCase().includes(brandWord) ? `${name} (${brand})` : name,
    brand,
    serving: labelServing ? hit.household || `${hit.servingSize} ${unit}` : "100 g",
    n,
    confidence: "exact",
    source: "usda",
    processing,
  };
}

/* Least-squares weight trend (lb/day) over the `days` ending endDate.
   Same-day weigh-ins are averaged first. Null with fewer than 2 days. */
function weightSlope(entries, endDate, days) {
  const from = shiftDate(endDate, -(days - 1));
  const byDay = {};
  for (const e of entries) {
    if (e.date < from || e.date > endDate) continue;
    (byDay[e.date] = byDay[e.date] || []).push(e.weight);
  }
  const points = Object.entries(byDay).map(([d, ws]) => [daysBetween(from, d), ws.reduce((a, b) => a + b, 0) / ws.length]);
  if (points.length < 2) return null;
  const mx = points.reduce((s, [x]) => s + x, 0) / points.length;
  const my = points.reduce((s, [, y]) => s + y, 0) / points.length;
  const sxy = points.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
  const sxx = points.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  const xs = points.map(([x]) => x);
  return { slope: sxx ? sxy / sxx : 0, count: points.length, span: Math.max(...xs) - Math.min(...xs) };
}

/* The Sunday check-in's proposal. Real maintenance = average intake on
   fully-logged days minus whatever the weight trend says went into (or
   came out of) storage. Blended 50/50 with the current estimate and
   capped at +/-250 a week so one noisy stretch can't swing targets. */
function proposeMaintenance(settings, log, foodDays, entries, todayStr) {
  const from = shiftDate(todayStr, -(ADAPT_WINDOW_DAYS - 1));
  const complete = Object.keys(foodDays || {}).filter((d) => d >= from && d <= todayStr && foodDays[d].complete);
  const trend = weightSlope(entries, todayStr, ADAPT_WINDOW_DAYS);
  const status = {
    completeDays: complete.length,
    weighIns: trend ? trend.count : 0,
    span: trend ? trend.span : 0,
    current: settings.maintenance,
  };
  const ready = complete.length >= ADAPT_MIN_COMPLETE_DAYS && status.weighIns >= ADAPT_MIN_WEIGH_INS && status.span >= ADAPT_MIN_SPAN_DAYS;
  if (!ready) return { ready: false, ...status };

  const avgIntake = complete.reduce((s, d) => s + dayTotals(log, d).kcal, 0) / complete.length;
  const observed = Math.round(avgIntake - trend.slope * KCAL_PER_LB);
  const blended = roundTo(0.5 * settings.maintenance + 0.5 * observed, 50);
  const proposed = Math.min(settings.maintenance + ADAPT_MAX_STEP, Math.max(settings.maintenance - ADAPT_MAX_STEP, blended));
  return {
    ready: true,
    ...status,
    avgIntake: Math.round(avgIntake),
    lbPerWeek: round1(trend.slope * 7),
    observed,
    proposed,
    delta: proposed - settings.maintenance,
    worth: Math.abs(proposed - settings.maintenance) >= ADAPT_MIN_CHANGE,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    NUTRIENT_KEYS, emptyNutrients, scaleNutrients, sumNutrients, foodNutrients, mealNutrients, takeoutNutrients, upfShare, classifyProcessing,
    entryTotal, dayTotals, weekDates, targetCalories, mifflinStJeor, startingMaintenance,
    defaultSettings, dailyGuide, inDiscovery, signalStatus, plannedMealFor, estimatedShare,
    MEALS, MEAL_LABELS, mealForTime, mealForSlot, mealForEntry, trayKey, trayAdd, trayStep, trayRemove, trayTotals,
    recentFoods, searchFoods, usdaToFood, WATER_DEFAULTS, WATER_BUTTONS, waterSettings, waterGoal, waterTotal, dayType, snackIdeasFor, snackTip, fmtQty, portionText, foodsBefore, fuelVsFeel, weekAlcohol, weightSlope, proposeMaintenance,
  };
}
