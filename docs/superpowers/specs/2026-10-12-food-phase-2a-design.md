# Phase 2a: Food — design spec (approved 2026-10-12)

## Context
Phase 1 (Today checklist, Zyn taper, push pings) is live and confirmed on Sean's iPhone (2026-10-12). Phase 2 adds food tracking. Brainstorm decisions:

- **Goal:** Claude recommends one, and it adapts over time based on progress and app input. Target changes are **suggested, then Sean approves**.
- **Effort:** easy and roughly accurate now, with a path to exact tracking later.
- **Targets:**
  - Calories and protein are the main targets.
  - Added sugar (limit), fiber (minimum), sodium (limit) and alcohol calories are scored as health signals.
  - All macros are stored from day one.
- **Food sources:** chains, packaged, local takeout and home-cooked, so breadth is needed. Split into two releases:
  - **2a (this plan):** targets, one-tap planned meals, quick-add, takeout and chain estimates, drinks, Today integration, adaptive weekly check-in.
  - **2b (later):** barcode scan (needs an iOS camera-library spike) and USDA plus Open Food Facts search.
- **Weekly calorie budget** with a weekend bank. Saturday drinks are White Claw and light beer.
- **Profile:** 26, male, ~205 lb, 6'4.5". Weekday intake beyond the plan is unknown, so it gets measured.

Key finding: planned meals on a lift day add up to only **~1,900 kcal** (and ~240 g protein), against an estimated **~3,000 kcal** maintenance. Either off-plan eating fills the gap or Sean under-eats on weekdays. The 2-week Discovery period will show which.

## Spec

### Targets & goal
- **Starting maintenance:** Mifflin-St Jeor BMR (93 kg, 194 cm, 26, male) ≈ 2,019 × 1.5 activity ≈ **3,000 kcal**.
- **Goal mode:** **recomp/maintain** through the Zyn quit (quitting nicotine raises appetite, and dieting at the same time raises relapse risk).
  - About 7 weeks in, the check-in offers a choice: cut (−0.5/−0.75/−1 lb/wk), maintain, or lean bulk (+0.25/+0.5).
  - Target calories = maintenance + rate × 500.
  - The mode can be changed in Settings at any time.
- **Daily targets:**
  - protein **190 g**
  - added sugar **≤36 g**
  - fiber **≥38 g**
  - sodium **≤2,300 mg**
  - alcohol: informational only; weekly alcohol kcal and drink count are shown
- **Signal colors:**
  - green: within the target
  - amber: within 150% of a limit, or at least 65% of a minimum (fiber ≥ 25 g)
  - red: beyond that
- **Weekly budget (Mon–Sun):**
  - Weekly budget = target × 7. Weekend bank defaults to {Sat +1,500, Sun +500} and is adjustable.
  - For day *d*: remaining = budget − intake from earlier days of the week.
  - guide(d) = (remaining − bank for remaining days) / days remaining + bank[d].
  - The guide never drops below 1,800. If the week is over budget, show "over by X, eat protein first" and don't suggest crash dieting.
  - Protein is scored per day.
- **Discovery (first 14 days from the start date):** totals show neutral colors with no red or amber. A badge explains that this period is for measuring real intake.
- **Adaptive maintenance:**
  - Uses only days marked complete.
  - Window: last 21 days. Requires ≥10 complete days and ≥8 weigh-ins spanning ≥14 days, taken from `weight-tracker-entries`.
  - slope = least-squares lb/day. observed = avg intake − slope × 3,500.
  - proposal = round to the nearest 50 of (0.5 × current + 0.5 × observed), moving at most ±250 from the current value. Shown only if |Δ| ≥ 100.
  - The Sunday check-in card explains the reasoning with **Accept** or **Keep** buttons, and every change goes into `food-target-history`.

### Logging UX
**Today tab:**
- Tapping a `meal` item opens an inline panel, using the same pattern as the weigh-in at `coach.js:171` and `:189-215`. It has three buttons:
  - **As planned:** logs the saved meal and marks the item done.
  - **Something else:** opens the food picker sheet.
  - **Skip:** opens the existing reason sheet.
- The Sunday `meal-prep` item (cooking, not eating) keeps its normal checkbox.
- Planned meals:

| Slot (item id) | Days | Planned meal | ~kcal / protein |
|---|---|---|---|
| breakfast | all | Shake: 1.375 scoop ON Gold Standard + 12 oz 1% milk | 320 / 45 g |
| lunch | Mon–Fri | Meal prep: 8 oz raw chicken breast, ½ pint strawberries, 4 oz peas/carrots/corn (+ toggle: low-sugar BBQ sauce) | 400 / 55 g |
| dinner | Wed, Fri | 4 large eggs + shake + Oikos Pro | 760 / 93 g |
| post-lift | lift days, Sat | Shake + banana | 425 / 47 g |
| pregame-snack | game days | Banana + Oikos Pro | 255 / 24 g |
| postgame | game days | Suggested: Oikos Pro + banana (replaces "whatever's around") | 255 / 24 g |
| treat-meal | Sat | No default; opens takeout and chain estimates | — |
| weekend lunch/dinner | Sat/Sun | No default; opens the picker | — |

- **New checklist item `close-food-log`, "Close food log", 21:30.** It goes in the `EVENING` block and Saturday. Tapping it marks the day complete in `food-days` and checks off the item. It is pinged like any other item.
- **Today summary** gets a slim fuel row: calories today against the guide, and protein against 190.

**Food tab** (new 5th nav button with a fork-and-knife icon, order: Today, Food, Habits, Weight, Runs), cards top to bottom:
1. **Hero** (glass-card): calories against the guide, a protein bar, "N kcal left · D days" for the week, a Discovery badge, and "x% estimated".
2. **Log:**
   - chips for recent items (last 10 distinct) and favorites
   - **Quick add**: name, kcal and protein are required; the rest sit under "more". Saved as an estimate, with an optional "save as favorite"
   - **Takeout estimates**: pizza slice, burger, wings, burrito/bowl, sub, chicken sandwich, Chinese plate, tacos, fries, each in S/M/L
   - **Chain items** from published nutrition: Chipotle chicken bowl/burrito, Chick-fil-A sandwich, 8-ct and 12-ct nuggets (fried and grilled), Domino's slice, BWW 6/10 traditional wings, Five Guys burger, Jersey Mike's regular sub
   - **+1 White Claw / +1 light beer** buttons
3. **Today's log:** entries grouped by slot, with tap to edit servings and delete, plus the **"I logged everything today"** toggle.
4. **Health signals:** sugar, fiber and sodium bars; alcohol kcal and drinks for the week.
5. **Week:** 7 bars of kcal against the guide, a protein-hit dot per day, and complete or incomplete markers. Past days can be marked complete here.
6. **Sunday check-in:** shown on Sundays, or whenever a proposal exists.
7. **Settings** (collapsed): goal mode and rate, targets, weekend bank, profile (age, sex, height, activity), saved-meal editor, target history.

Every log entry carries `confidence: "exact" | "estimate"`. Seeded label-based foods count as exact; quick-add, takeout and chain items count as estimates.

### Data (localStorage, all via `loadJSON`/`saveJSON` in `coach.js:25,34`)
| Key | Shape |
|---|---|
| `food-library` | `[{id, name, brand?, serving, n:{kcal,protein,carbs,fat,fiber,sugar,addedSugar,sodium,alcohol}, confidence, favorite?, source:"seed"\|"custom"}]` |
| `food-meals` | `[{id, name, items:[{foodId, servings}], slots:[itemId], days:[0-6], addons?:[{foodId, label}]}]` |
| `food-log` | `[{id, date, at, slot, name, servings, n:{…snapshot…}, confidence, ref?}]` |
| `food-days` | `{ "YYYY-MM-DD": {complete:true, at} }` |
| `food-settings` | `{profile:{age,sex,heightCm,activity}, goal:{mode,rateLbPerWk}, maintenance, protein, limits:{addedSugar,fiber,sodium}, bank:{6:1500,0:500}, discoveryStart}` |
| `food-target-history` | `[{date, maintenance, target, reason, accepted}]` |

The library and meals are seeded from `food-data.js` on first run. If seed data changes later, new seeds are merged by id and user edits are never overwritten.

**Supabase:** no changes. The new checklist item flows into `ping_queue` through the existing `syncPings()`.

## Build plan
Execution: inline, in this session. TDD for `food-core.js`. **Ask Sean before every commit and push** (`WeightTracker/CLAUDE.md`).

0. **Spec into the repo:** write this spec to `docs/superpowers/specs/2026-10-12-food-phase-2a-design.md`.
1. **Test harness:** create `tests/` with a tiny `eq()` runner page that is run through headless Edge `--dump-dom`.
   - Move the old `coach-core` checks into `tests/coach-core.test.html` if the old scratchpad file still exists; otherwise rewrite the key ones.
   - Add a `README` line on how to run the tests.
2. **`food-data.js`:** seed foods (ON whey per scoop, 1% milk per cup, large egg, Oikos Pro using Sean's 23 g protein and 4 g sugar, raw chicken breast, strawberries, frozen peas/carrots/corn, low-sugar BBQ sauce, banana, White Claw 12 oz, light beer 12 oz), saved meals mapped to slots, takeout S/M/L presets and chain items.
   - Values come from USDA and the published labels or restaurant nutrition data. Oikos Pro and the BBQ sauce are flagged "verify from label".
3. **`food-core.js`** (DOM-free, written tests-first). It exports:
   - `sumNutrients`
   - `dayTotals(log, date)`
   - `weekDates(date)` (Mon–Sun)
   - `dailyGuide(settings, log, date)`
   - `mifflinStJeor(profile, weightKg)`
   - `weightSlope(entries, endDate, days)`
   - `proposeMaintenance(settings, log, days, entries, today)`
   - `signalStatus(key, value, settings, inDiscovery)`
   - `plannedMealFor(meals, itemId, date)`
   - `estimatedShare(log, date)`

   Pure functions that take data as arguments, mirroring `coach-core.js`.
4. **`coach-core.js`:** add `close-food-log` 21:30 to `EVENING` (`:37`) and to Saturday's template. Update the coach-core tests.
5. **`index.html`:**
   - add the `#food-panel` cards, the nav button and a `#food-sheet` picker (reusing the `.sheet` pattern)
   - script order: `coach-core.js`, `food-data.js`, `food-core.js`, `app.js`, `coach.js`, `food.js`, then the deferred supabase and reminders scripts
6. **`food.js`:**
   - `renderFood()` does an idempotent full re-render, like `renderHabits()` at `coach.js:328`
   - `logFood(entry)`, the picker sheet, quick-add, drink buttons, the edit/delete sheet, settings, the check-in Accept/Keep, and the seeding and migration
   - every action calls both `renderFood()` and `renderToday()`
7. **`coach.js`:**
   - add a meal-panel branch to `renderChecklistItem` (`:135`) for items with `kind === "meal"` and an id other than `meal-prep`. It calls into `food.js` behind a `typeof` guard.
   - add a `close-food-log` handler
   - add the fuel row to `renderTodaySummary` (`:103`)
8. **`style.css`:** food card styles, progress bars and signal colors, reusing `.card`, `.glass-card`, `.stat-tile`, `.chip-row` and `.sheet`. Check that the 5-button nav fits at 390 px.
9. **`sw.js`:** add `food-data.js`, `food-core.js` and `food.js` to `ASSETS`, and bump `CACHE_NAME` from v21 to **v22**.
10. **Docs:** update `README.md` (Food tab and tests) and the progress logs (detailed and summary) after the approved commit, plus the memory note.

## Verification
- **Logic:** both test pages print `N/N passed` through headless Edge. They cover:
  - guide math, including the weekend bank and the over-budget floor
  - Discovery suppression
  - the slope and proposal (clamp, threshold, minimum-data guard)
  - planned-meal lookup by day
  - nutrient snapshots
  - the new checklist item on every weekday
- **UI:** the `phone-preview` skill, run with a `--seed` JSON (a week of logs, weights, a Sunday proposal), produces Today and Food screenshots at 390 px with zero JS errors. Click through: As planned → item done and totals updated; quick-add; drinks; delete; mark complete; Accept proposal → history row.
- **Phone:** after the push (with approval), Sean opens the installed app, sees v22 and the Food tab, logs a breakfast "As planned" from Today, and the item's pings stop.

## Out of scope (2b and later)
Barcode scanning (iOS camera and ZXing spike first), USDA FoodData Central and Open Food Facts search, photo logging (Phase 3, AI coach), and Supabase backup of food data.
