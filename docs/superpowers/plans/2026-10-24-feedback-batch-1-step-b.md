# Feedback batch 1, step B: tray (multi-add) and meal sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Picking a food in the food sheet adds it to a tray, and one Log writes the whole meal. The Food log is split into Breakfast / Lunch / Dinner / Snacks with subtotals and a + Add per meal, and an entry can be moved to another meal. The step also picks up the swipe and backup leftovers from steps 0, 0.5 and A. Ships as v35.

**Architecture:** The pure parts go in `food-core.js` and are unit-tested: meal mapping (`mealForTime`, `mealForSlot`, `mealForEntry`) and tray math (`trayKey`, `trayAdd`, `trayStep`, `trayRemove`, `trayTotals`). `food.js` keeps one tray per slot in memory (`trays[slot]`) and renders it into a static `#food-tray` block docked under the sheet body. Every pick path now calls `addToTray(pick)` instead of logging, and `logTray()` writes one entry per row with a shared `mealGroup`. The Food log renders four meal sections from `mealForEntry`. The swipe helper in `ui.js` moves the sheet with the CSS `translate` property, so it never has to touch the open animation, and it accepts several scrollers (the body and the tray list).

**Tech Stack:** Plain HTML/CSS/JS, no build, no Node. Logic tests: `python tests/run.py` (headless Edge runs `tests/*.test.html`). UI tests: `python .claude/skills/phone-preview/preview.py --interact tests/ui/<name>.js` (light, and again with `--dark`).

**Spec:** `docs/superpowers/specs/2026-10-15-feedback-batch-1-design.md`, sections B1, B2, the tray parts of A1 ("The tray survives a close") and A2 ("The tray gets an 'Ate at' time"), "Data changes", "Order and verification", and "Out of scope".

## Global Constraints

- Read `CLAUDE.md` and `.claude/skills/phone-preview/SKILL.md` first.
- **Commits:** ask Sean before every `git commit` and `git push`, unless he has approved per-task commits for this plan. Push always needs his yes. Implementers don't touch the progress logs; Task 6 writes them.
- **Cache:** `sw.js` `CACHE_NAME` and `version.js` `APP_VERSION` move together to **35** in Task 1. Leave them alone after that, because the whole step ships as one deploy. No new app files are added, so `sw.js` `ASSETS` stays the same. `tests/run.py` static checks enforce both.
- **Line endings:** keep each file's own. Git Bash `sed -i` strips CRLF in this repo, so edit with Edit or Python, never `sed -i`. CRLF: `index.html`, `style.css`, `food-core.js`, `food.js`, `backup-core.js`, `backup.js`, `version.js`, `sw.js`, `tests/food-core.test.html`, `tests/backup-core.test.html`, `tests/ui/food-flow.js`, `tests/ui/chick-fil-a.js`, `tests/ui/processing.js`, `tests/ui/timestamps.js`, `tests/ui/restore.js`, `tests/ui/backup-file.js`. LF: `ui.js`, `tests/ui/swipe-close.js`, `tests/ui/snacks-search.js`, `tests/ui/online-search.js`. New test files are LF, like `swipe-close.js`.
- **Style:** short `/* */` why-comments, the `el()`, `loadJSON` and `saveJSON` helpers (coach.js), `showToast`, `haptic`, and no new globals beyond the names listed in each task's Interfaces.
- **Spec B1:** every pick path adds to the tray: search results (including recent and online), My foods, Chains, Takeout S/M/L, Quick add and saved meals. A saved meal is one tray item. The servings stepper moves in **½ steps, minimum ½**. Logging writes one entry per item, sharing `mealGroup`, `meal`, `at` and the slot. The slot is checked off once. The toast reads **"Logged 3 items · 950 kcal"**, and Undo removes the whole group. The Log button is hidden while the tray is empty. Close and swipe keep the tray. Picking the same food twice raises its servings instead of adding a row. The Food tab's quick re-log chips still log one tap = one entry (unchanged).
- **Spec B2:** `meal` is one of `breakfast | lunch | dinner | snack`. Slot mapping: `breakfast` → breakfast; `lunch` → lunch; `dinner`, `treat-meal` → dinner; `snack-am`, `snack-pm`, `snack-eve`, `pregame-snack`, `post-lift`, `postgame` → snack; `extra` → by time of day. Time of day: before 4:00 → snack (Sean, 2026-10-25; decision 10); 4:00–10:00 → breakfast; 10:00–11:30 → snack; 11:30–14:30 → lunch; 14:30–17:00 → snack; 17:00–20:30 → dinner; after 20:30 → snack. The Food log has four sections in meal order, each with kcal and protein subtotals, its entries with times, and **+ Add** (opens the sheet with that meal and slot `extra`). Empty sections show only the header and + Add. The entry editor gets a meal picker.
- **Spec A2:** "Changing the time never changes the entry's date." The tray's "Ate at" defaults to now.
- The browser in tests uses the real date and weekday; never assume a day type.

## Decisions beyond the spec (confirm with Sean when he reviews this plan)

1. **Picking a food that's already in the tray adds 1 serving.** That holds even for a past entry logged as × 2, so the stepper always starts from a predictable number.
2. **One tray per slot.** Every opener of slot `extra` shares one tray: the +, the Food tab buttons and each section's + Add. An empty tray takes the opener's meal every time it opens, and a + Add always sets its own meal. Otherwise a tray with items keeps the meal it already has.
3. **An empty tray shows one hint line** ("Tap foods to add them here, then log them together."). The rows, meal chips and "Ate at" appear with the first pick. That leaves the list as much room as possible, and it explains that a tap no longer logs straight away.
4. **"Ate at" follows the clock until Sean edits it.** A blank field logs "now". Entries always go on the day they're logged, so a tray left open past midnight logs to the new day.
5. **With the keyboard up, the tray shows only its summary and the Log button.** On an iPhone the sheet then has only about 400 px.
6. **Quick add's button becomes "Add to tray".** The form clears for the next one.
7. **Undo puts the slot's check-in back to what it was before.** A skipped lunch stays skipped instead of becoming blank.
8. **The Food log drops the "Other" label.** The section header now says where an entry belongs. A checklist slot's title still shows ("Protein shake").
9. **Chips in the entry editor save straight away and carry the typed values with them.** That covers both the meal chips and the processing chips: a servings or time typed above is saved too, not lost. This also fixes a minor declined in step A.
10. **Each time range includes its start and excludes its end.** So 10:00 is a snack, 11:30 is lunch and 20:30 is a snack. Food from midnight to 3:59 AM counts as **Snacks** (Sean's call on 2026-10-25, overriding the spec's literal "before 10:00 → breakfast"); breakfast starts at 4:00.
11. **Old entries aren't migrated.** `mealForEntry` works out their meal when the log is read. Editing the time of an old "Other" entry can therefore move it to another section. New entries always store `meal`.
12. **Single-tap paths stay direct.** As planned, snack ideas, the + sheet's suggestions and the Food tab chips each log one entry. They get a `meal` (from the slot, or the time of day) but no `mealGroup`.
13. **The tray lives only in memory, as the spec says.** An update reload, or iOS closing the app, empties it.
14. **An online result is saved to My foods when it's added to the tray**, the same moment as today's pick.

## Backlog folded in from steps 0, 0.5 and A

Every carried item, with what this plan does about it. "Carried" items go to the appendix at the end. The plan doesn't fix them.

**Step A ledger, "Final: minor (deferred)" and rulings**
- Spring-back leaves inline `animation: none`, so the sheet's next open has no slide-up → **Task 2** (drag with the `translate` property).
- `settle()` timeouts aren't cancelled; two drags within ~220 ms can make a closing sheet snap visible → **Task 2**.
- Pre-v33 processing retags on the 5 original Chick-fil-A items were reset by rev 1 → **dropped.** It already happened once, on Sean's phone at v33, and `mergeSeed` now keeps tags Sean sets. Nothing is left to fix in code. Sean can re-tag those five items if he had changed any of them.
- `timestamps.js` doesn't edit a time to 00:00 → **Task 4**.
- Mouse only: a drag released outside the window follows a hovering cursor → **Task 2**.
- Ruling: the iOS upward-swipe jitter at the top of a list → **closed.** Phone check 4b passed on v34.

**Steps 0 / 0.5 appendix (from the step A plan)**

Each item was re-checked against the code on main `e1d39ac`.

- `applyBackup` half-write: **mostly fixed already** in 7710227 ("Step 0 final-review fixes"). `backup.js` `applyWithRollback` takes a snapshot and writes it back when a restore throws, and `tests/ui/restore.js` pins that. One gap remains. When the rollback also fails, `restoring` stays true only in memory, and the error message tells Sean to close and reopen the app. After that reopen, the first edit uploads the half-written data over the cloud copy. → **Task 5** (keep the "restore incomplete" state across launches).
- `backupDelay` with a future `lastBackupAt` → **Task 5**.
- `parseBackupFile` admits `data:image/svg+xml` → **Task 5** (only JPEG, PNG and WebP are accepted; the app itself saves JPEG).
- No in-flight guard on Restore (a double tap gives two confirms) → **Task 5**.
- The partial-photo-failure message is wiped by the reload → **Task 5**.
- `noteBackupChange()` at load re-uploads once per launch → **already fixed** (the `backup-dirty` flag, 7710227).
- A stale `backupError` after turning backup off → **already fixed** (`turnBackupOff` clears it). A long raw error message → carried.
- Restoring over a different code silently replaces it → **already fixed** (the confirm names the old code, and `restore.js` pins it).
- Everything else (server-side null and quota handling, `preparedExport` expiry, an update reload dropping typed input, the `.code-form` CSS, import-status routing, test and tooling gaps, and all of the Injury mode items) → **carried** to the appendix. Most of the Injury items belong with step T, which reworks the lift and injury code.

## Review Focus

1. **A tray left open for a while.** "Ate at" must show the current time until Sean edits it, and a blank field must log "now", not midnight. Pinned in Task 3 ("Ate at follows the clock", "blank Ate at logs now").
2. **Undo after a tray log on a checklist slot.** Undo must remove every entry in the group and put the slot back exactly as it was: a skipped item stays skipped, and an open one is open again. Pinned in Task 3 ("undo puts the slot back how it was").
3. **The entry editor shares the sheet.** Opening an entry must hide the tray, and reopening the picker must bring the same tray back intact. Pinned in Task 3 ("editor hides the tray", "tray back after editing").
4. **A long tray.** Dragging inside a scrolled tray list must scroll it, not close the sheet. At the top of the list a drag closes the sheet, and the tray survives. Pinned in Task 3 (`swipe-close.js`: "scrolled tray doesn't close", "tray survives a swipe close").
5. **The same food from two pick paths.** Banana from search and Banana from My foods must become one row × 2, not two rows. Pinned in Task 1 (`trayKey` across paths) and Task 3 ("search + My foods merge").

---

## Pre-flight

- [ ] `git status`: clean, on `main` at `e1d39ac` or later, and up to date with `origin/main`.
- [ ] `python tests/run.py`: every page `N/N passed`, exit code 0. Note the counts; the expected numbers below assume static 4/4, backup-core 34/34, coach-core 87/87, food-core 173/173 and injury 43/43.
- [ ] `git switch -c batch1-stepB`
- [ ] Delete the step A SDD workspace. Everything still open in it is now in this plan: `rm -rf .superpowers/sdd/2026-10-24-feedback-batch-1-step-a`. (Skip this if the controller already deleted it when the plan was written.)

---

### Task 1: Meal and tray logic (and v35)

**Files:**
- Modify: `food-core.js` (new sections after `searchFoods`, before the USDA section at `const USDA_UNITS`; names added to `module.exports`)
- Modify: `version.js` (`APP_VERSION = 35`), `sw.js` line 1 (`weight-tracker-v35`)
- Test: `tests/food-core.test.html`

**Interfaces:**
- Consumes: `sumNutrients`, `entryTotal` (food-core.js).
- Produces (all global, pure):
  - `MEALS: string[]`, which is `["breakfast", "lunch", "dinner", "snack"]`.
  - `MEAL_LABELS: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" }`.
  - `mealForTime(minutes: number) -> meal`. `minutes` counts from midnight.
  - `mealForSlot(slot: string, minutes: number) -> meal`.
  - `mealForEntry(entry) -> meal`, using `entry.meal`, then `entry.slot`, then `entry.at`.
  - `trayKey(ref?: object, name?: string, n?: object) -> string`.
  - `trayAdd(items, pick) -> items`, `trayStep(items, key, delta) -> items` and `trayRemove(items, key) -> items`. All three return a new array and never mutate their input.
  - `trayTotals(items) -> { count, kcal, protein }`.
  - A tray item is `{ key, name, servings, n, confidence, ref? }`, where `n` is per serving.

- [ ] **Step 1: Write the failing tests.** In `tests/food-core.test.html`, append inside `run(() => { ... })` before its closing `});`:

```js
  // ---- meals (step B2) ----
  const hm = (h, m) => h * 60 + m;
  eq("meal by time of day",
    [hm(0, 5), hm(3, 59), hm(4, 0), hm(9, 59), hm(10, 0), hm(11, 29), hm(11, 30), hm(14, 29), hm(14, 30), hm(16, 59), hm(17, 0), hm(20, 29), hm(20, 30), hm(23, 50)].map(mealForTime),
    ["snack", "snack", "breakfast", "breakfast", "snack", "snack", "lunch", "lunch", "snack", "snack", "dinner", "dinner", "snack", "snack"]);
  eq("meal by slot",
    ["breakfast", "lunch", "dinner", "treat-meal", "snack-am", "snack-pm", "snack-eve", "pregame-snack", "post-lift", "postgame"].map((s) => mealForSlot(s, hm(12, 0))),
    ["breakfast", "lunch", "dinner", "dinner", "snack", "snack", "snack", "snack", "snack", "snack"]);
  eq("extra and unknown slots go by the clock", [mealForSlot("extra", hm(8, 0)), mealForSlot("pt-1", hm(18, 0))], ["breakfast", "dinner"]);
  const atHm = (hhmm) => new Date(`2026-10-24T${hhmm}`).getTime();
  eq("an entry's own meal wins", mealForEntry({ slot: "breakfast", meal: "snack", at: atHm("08:00") }), "snack");
  eq("old entry: from its slot", mealForEntry({ slot: "lunch", at: atHm("16:00") }), "lunch");
  eq("old extra entry: from its time", mealForEntry({ slot: "extra", at: atHm("18:30") }), "dinner");
  eq("unknown meal value falls back", mealForEntry({ slot: "dinner", meal: "brunch", at: atHm("08:00") }), "dinner");
  eq("no meal, slot or time: snack", mealForEntry({ slot: "extra" }), "snack");

  // ---- tray (step B1) ----
  const nn = (kcal, protein) => ({ ...emptyNutrients(), kcal, protein });
  eq("tray keys", [trayKey({ food: "banana" }), trayKey({ meal: "m1", addons: ["b", "a"] }), trayKey({ takeout: "pizza", size: "M" }), trayKey(undefined, "Trail mix", nn(300, 8))],
    ["food:banana", "meal:m1+a,b", "takeout:pizza:M", "name:Trail mix|300"]);
  eq("saved meal without add-ons", [trayKey({ meal: "m1" }), trayKey({ meal: "m1", addons: [] })], ["meal:m1", "meal:m1"]);
  eq("a past entry and a library pick of one food share a key", trayKey({ food: "banana" }, "Banana", nn(105, 1.3)), trayKey({ food: "banana" }));
  const banana = { key: "food:banana", name: "Banana", n: nn(105, 1.3), confidence: "exact", ref: { food: "banana" } };
  let tray = trayAdd([], banana);
  eq("first pick: 1 serving", tray.map((i) => [i.name, i.servings]), [["Banana", 1]]);
  const once = tray;
  tray = trayAdd(tray, { ...banana, servings: 2 });
  eq("same food again: +1 serving, no new row", tray.map((i) => i.servings), [2]);
  eq("trayAdd doesn't mutate", once[0].servings, 1);
  tray = trayAdd(tray, { key: "name:Trail mix|300", name: "Trail mix", servings: 1.25, n: nn(300, 8), confidence: "estimate" });
  eq("a past entry's servings carry over", tray[1].servings, 1.25);
  let stepped = tray;
  for (let i = 0; i < 4; i++) stepped = trayStep(stepped, "food:banana", -0.5);
  eq("stepper floors at ½", [stepped[0].servings, tray[0].servings], [0.5, 2]);
  eq("stepper up", trayStep(tray, "food:banana", 0.5)[0].servings, 2.5);
  eq("from 1.25 down: ¾, then ½", [trayStep(tray, "name:Trail mix|300", -0.5)[1].servings,
    trayStep(trayStep(tray, "name:Trail mix|300", -0.5), "name:Trail mix|300", -0.5)[1].servings], [0.75, 0.5]);
  eq("remove", trayRemove(tray, "food:banana").map((i) => i.name), ["Trail mix"]);
  eq("totals", trayTotals(tray), { count: 2, kcal: 585, protein: 12.6 });
  eq("empty totals", trayTotals([]), { count: 0, kcal: 0, protein: 0 });
```

- [ ] **Step 2: Run, expect failures.** `python tests/run.py`. Expected: food-core shows `ERROR ReferenceError: mealForTime is not defined`, and the exit code is 1.

- [ ] **Step 3: Implement.** In `food-core.js`, after the closing `}` of `searchFoods` and before `const USDA_UNITS`:

```js
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
```

Add `MEALS, MEAL_LABELS, mealForTime, mealForSlot, mealForEntry, trayKey, trayAdd, trayStep, trayRemove, trayTotals,` to the `module.exports` object (on the `recentFoods, searchFoods, ...` line).

Then bump the version: in `version.js`, `const APP_VERSION = 35;`; in `sw.js` line 1, `const CACHE_NAME = "weight-tracker-v35";`.

- [ ] **Step 4: Run, expect pass.** `python tests/run.py`. Expected: food-core passes 194/194 (173 plus 21 new), every other page is unchanged, and the exit code is 0.

- [ ] **Step 5: Commit** (with approval):

```bash
git add food-core.js tests/food-core.test.html version.js sw.js
git commit -m "Step B: meal mapping and tray logic in food-core, v35"
```

---

### Task 2: Swipe polish (step A's deferred minors) and several scrollers

**Files:**
- Modify: `ui.js`, `attachSwipeClose` (about lines 157–269)
- Modify: `tests/ui/swipe-close.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `attachSwipeClose(sheet, { close, scroller?: HTMLElement | HTMLElement[], scrim? })`. `scroller` may now be an array. A drag that starts inside any of the scrollers starts only while that one is scrolled to the top. The sheet moves with `style.translate` (`"0px Npx"`), and `style.transform` and `style.animation` are never set. Task 3 passes `[foodSheetBody, trayItems]`.

- [ ] **Step 1: Update the existing assertions and write the failing tests.** In `tests/ui/swipe-close.js`:
  1. Replace every `.style.transform` with `.style.translate` (lines 35, 40, 49, 60, 65, 124 and 161).
  2. Change line 35's regex from `/^translateY\(\d+(\.\d+)?px\)$/` to `/^0px \d+(\.\d+)?px$/`.
  3. Insert this block right after the `eq("short drag springs back", ...)` line (line 40):

```js
eq("spring-back keeps the open animation", qa().style.animation, "");

// A closing drag right after a spring-back isn't undone by the first
// drag's leftover timer (it used to snap the sheet back into view).
await swipe($(".sheet-handle", qa()), slow(h * 0.2));
await swipe($(".sheet-handle", qa()), [30, 60, 90, 120, 150, 180], 16);
await wait(160);
check("closing sheet stays off-screen", /^0px \d+(\.\d+)?px$/.test(qa().style.translate) && parseFloat(qa().style.translate.split(" ")[1]) > h, qa().style.translate);
await wait(200);
eq("then it closes clean", [qa().hidden, qa().style.translate], [true, ""]);
click("#fab");

// Mouse: a button released outside the window never sends pointerup; a
// move with no button down ends the drag instead of following the cursor.
const ME = (type, target, y, buttons) => target.dispatchEvent(new (app().PointerEvent)(type, {
  bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons, clientX: 120, clientY: y,
}));
const mh = $(".sheet-handle", qa());
const my0 = mh.getBoundingClientRect().top + 3;
ME("pointerdown", mh, my0, 1);
for (const dy of [20, 40, 60]) {
  await wait(100);
  ME("pointermove", mh, my0 + dy, 1);
}
await wait(100);
ME("pointermove", mh, my0 + h * 0.6, 0);
await wait(300);
eq("a hovering mouse doesn't drag", [qa().hidden, qa().style.translate], [false, ""]);
```

  Keep the `long drag closes` test that follows; it starts from an open + sheet, and the block above leaves one open.

- [ ] **Step 2: Run, expect failures.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/swipe-close.js --budget 40000`. Expected: FAIL on "follows the finger" (the sheet still moves with `transform`), on "spring-back keeps the open animation" (`none`), and on "closing sheet stays off-screen". Exit code 1. The mouse check can pass at this point, since nothing sets `translate` yet. It pins the fix once Step 3 moves the sheet with `translate`.

- [ ] **Step 3: Implement.** In `ui.js`, change `attachSwipeClose` as follows. Everything not shown stays as it is.

Update the doc comment's first lines, and add the state at the top of the function:

```js
/* Lets a bottom sheet be dragged down to close. A drag can start on the
   handle or anything outside the scrollers (the header) at any time, but
   inside a scroller only while that one is scrolled to the top. Text
   fields, selects and sliders keep their own drags. The sheet follows the
   finger down (never up) through the `translate` property, which leaves
   the open animation alone; `scrim` fades with it, and on release the
   sheet either closes through `close` or springs back. */
function attachSwipeClose(sheet, { close, scroller = sheet, scrim = null }) {
  const scrollers = [].concat(scroller);
  let drag = null;
  let suppressClicksUntil = 0;
  let settleTimer = null;
  let closing = false; // released past the line; the close is under way
```

Replace `clearStyles` and `settle` with:

```js
  const clearStyles = () => {
    sheet.style.transition = "";
    sheet.style.translate = "";
    if (scrim) {
      scrim.style.transition = "";
      scrim.style.opacity = "";
    }
  };

  /* One timer at a time: a spring-back's cleanup must not land in the
     middle of a later close and snap the sheet back into view. */
  const settle = (toClose) => {
    clearTimeout(settleTimer);
    sheet.style.transition = "translate 0.2s ease";
    if (scrim) scrim.style.transition = "opacity 0.2s ease";
    if (toClose) {
      closing = true;
      sheet.style.translate = `0 ${sheet.offsetHeight + 40}px`;
      if (scrim) scrim.style.opacity = "0";
      settleTimer = setTimeout(() => {
        closing = false;
        close();
        clearStyles();
      }, 200);
    } else {
      sheet.style.translate = "";
      if (scrim) scrim.style.opacity = "";
      settleTimer = setTimeout(clearStyles, 220);
    }
  };
```

In the `pointerdown` handler, after `suppressClicksUntil = 0;`, add `if (closing) return;`. Then replace the two `fromHeader` lines with:

```js
    const inScroller = e.target.closest(".sheet-handle") ? null : scrollers.find((s) => s.contains(e.target));
    if (inScroller && inScroller.scrollTop > 0) return;
```

In the `pointermove` handler, right after `if (!drag || e.pointerId !== drag.id) return;`:

```js
    // A mouse released outside the window never sends pointerup here; a
    // move with no button down means the drag is already over.
    if (e.pointerType === "mouse" && e.buttons === 0) return end(e, false);
```

In the same handler's `if (!drag.moving) { ... }` block, delete the comment `// Inline transforms lose to a running animation; the open one is done.` and the line `sheet.style.animation = "none";`. In their place, put:

```js
      clearTimeout(settleTimer); // a spring-back still running is taken over
```

At the end of the handler, replace `sheet.style.transform = \`translateY(${drag.dy}px)\`;` with:

```js
    sheet.style.translate = `0 ${drag.dy}px`;
```

- [ ] **Step 4: Run, expect pass.** First `python .claude/skills/phone-preview/preview.py --interact tests/ui/swipe-close.js --budget 40000`, then the same with `--dark`. Expected: all PASS, 0 JS errors. Then confirm nothing else that opens a sheet broke: `python .claude/skills/phone-preview/preview.py --interact tests/ui/redesign.js --interact tests/ui/injury.js --interact tests/ui/food-flow.js` (all PASS).

- [ ] **Step 5: Commit** (with approval):

```bash
git add ui.js tests/ui/swipe-close.js
git commit -m "Step B: swipe moves sheets with translate, one settle timer, mouse release; several scrollers"
```

---

### Task 3: The tray (multi-add, meal and "Ate at")

**Files:**
- Modify: `index.html`: the food sheet (about line 581), adding the tray block between `#food-sheet-body` and `#food-sheet-cancel`
- Modify: `food.js`: `logFood` (about line 103), the picker sheet section (`openFoodSheet` about line 990, `logFromSheet`, `runOnlineSearch`, `renderSearchResults`, `renderFoodList`, `renderMine`, `takeoutRow`, `renderQuickAdd`, `openEditEntry`), and the `attachSwipeClose` call (about line 1348)
- Modify: `style.css` (after the `.food-sheet-body .processing-chips` rule, about line 2094)
- Create: `tests/ui/tray.js`
- Modify: `tests/ui/swipe-close.js`, `tests/ui/food-flow.js`, `tests/ui/snacks-search.js`, `tests/ui/online-search.js`, `tests/ui/chick-fil-a.js`, `tests/ui/processing.js`

**Interfaces:**
- Consumes: Task 1's `MEALS`, `MEAL_LABELS`, `mealForSlot`, `trayKey`, `trayAdd`, `trayStep`, `trayRemove`, `trayTotals`, and `fmtQty`, `foodNutrients`, `mealNutrients`, `takeoutNutrients` (food-core). Also `timeInputValue`, `atOnDate` (coach-core); `minutesNow`, `newId`, `setCheckin`, `CHECKINS_KEY`, `loadJSON` (coach.js); `haptic`, `showToast`, and Task 2's array `scroller` (ui.js).
- Produces:
  - `openFoodSheet({ slot?, title?, mode?, meal? })`, where `meal` is new and optional.
  - `logFood({ ..., meal? })`, which now always writes `meal`.
  - The globals `trays`, `sheetTray`, `addToTray(pick)`, `renderTray()` and `logTray()`.
  - Markup read by the tests: `#food-tray`, `#food-tray-hint`, `#food-tray-summary`, `#food-tray-details`, `#food-tray-items > li.tray-item` (containing `.tray-name`, `.tray-servings`, and buttons with aria-labels `Fewer`, `More` and `Remove`), `#food-tray-meals > .chip[data-meal]`, `#food-tray-at` and `#food-tray-log`.
  - Entry fields `meal` and `mealGroup`.

- [ ] **Step 1: Write the failing UI test.** Create `tests/ui/tray.js`:

```js
// Tray (step B1): every pick path adds to the tray, and one Log writes an
// entry per row with a shared meal group, meal, time and slot. The tray
// survives a close; Undo removes the whole group.
await reload({ "coach-started-at": "0", "coach-injury": null }, "food-panel");
const rows = () => $$("#food-tray-items .tray-item").map((li) => [$(".tray-name", li).textContent, $(".tray-servings", li).textContent]);
const row = (i) => $$("#food-tray-items .tray-item")[i];
const mealChip = (m) => $(`#food-tray-meals [data-meal="${m}"]`);
const activeMeal = () => $("#food-tray-meals .chip.active")?.dataset.meal;
const searchPick = (q, name) => {
  clickText("Search", $("#food-sheet-tabs"));
  fill(".food-search", q);
  clickText(name, $("#food-sheet-body .search-results"));
};

click("#food-log-btn");
eq("empty tray: hint only", [$("#food-tray").hidden, $("#food-tray-hint").hidden, $("#food-tray-log").hidden, $("#food-tray-details").hidden], [false, false, true, true]);
eq("opened from the Food tab: meal by the clock", activeMeal(), app().mealForTime(app().minutesNow()));

// Every pick path adds to the tray instead of logging.
searchPick("banana", "Banana");
clickText("Chains", $("#food-sheet-tabs"));
clickText("Chick-fil-A Cool Wrap", $("#food-sheet-body"));
clickText("Takeout", $("#food-sheet-tabs"));
$$("#food-sheet-body .size-btn")[1].click(); // Pizza, M
clickText("My foods", $("#food-sheet-tabs"));
clickText("My Chipotle order", $("#food-sheet-body"));
clickText("Quick add", $("#food-sheet-tabs"));
fill("[name=name]", "Trail mix");
fill("[name=kcal]", "300");
fill("[name=protein]", "8");
$(".quick-form").requestSubmit();
eq("nothing logged yet", ls("food-log") || [], []);
check("sheet still open", !$("#food-sheet").hidden);
eq("one row per pick", rows().map((r) => r[0]), ["Banana", "Chick-fil-A Cool Wrap", "Pizza (regular slice)", "My Chipotle order", "Trail mix"]);
eq("quick add form clears", $("[name=name]").value, "");
check("summary counts the tray", /^5 items · [\d,]+ kcal · [\d,]+ g P$/.test($("#food-tray-summary").textContent), $("#food-tray-summary").textContent);
eq("Log button counts", $("#food-tray-log").textContent, "Log 5 items");

// The same food from another path raises its servings; the stepper moves in halves, never below ½.
clickText("My foods", $("#food-sheet-tabs"));
clickText("Banana", $("#food-sheet-body"));
eq("search + My foods merge", rows()[0], ["Banana", "× 2"]);
for (let i = 0; i < 3; i++) click('[aria-label="Fewer"]', row(0));
eq("stepper stops at ½", rows()[0][1], "× ½");
click('[aria-label="More"]', row(0));
eq("stepper adds ½", rows()[0][1], "× 1");
click('[aria-label="Remove"]', row(4));
eq("remove drops the row", rows().map((r) => r[0]), ["Banana", "Chick-fil-A Cool Wrap", "Pizza (regular slice)", "My Chipotle order"]);

// Close keeps the tray.
click("#food-sheet-cancel");
click("#food-log-btn");
eq("the tray survives a close", rows().length, 4);

// "Ate at" follows the clock until edited.
eq("Ate at follows the clock", $("#food-tray-at").value, app().timeInputValue(Date.now()));

// Keyboard up: only the summary and Log stay.
$("#food-sheet").classList.add("keyboard-up");
eq("keyboard up tucks the details away", [app().getComputedStyle($("#food-tray-details")).display, app().getComputedStyle($("#food-tray-log")).display === "none"], ["none", false]);
$("#food-sheet").classList.remove("keyboard-up");

// Meal and time, then Log: one entry per row, sharing group, meal, time and slot.
click(mealChip("lunch"));
eq("meal chip picks", activeMeal(), "lunch");
fill("#food-tray-at", "12:15");
click("#food-tray-log");
const log = ls("food-log");
const lunchAt = new Date(`${today}T12:15`).getTime();
eq("one entry per row", log.map((e) => [e.name, e.servings]), [["Banana", 1], ["Chick-fil-A Cool Wrap", 1], ["Pizza (regular slice)", 1], ["My Chipotle order", 1]]);
eq("shared group, meal, time, slot and date",
  [new Set(log.map((e) => e.mealGroup)).size, log.every((e) => e.mealGroup && e.meal === "lunch" && e.at === lunchAt && e.slot === "extra" && e.date === today)],
  [1, true]);
eq("refs kept", [log[0].ref, log[2].ref, log[3].ref], [{ food: "banana" }, { takeout: "pizza", size: "M" }, { meal: "meal-chipotle", addons: [] }]);
check("sheet closed", $("#food-sheet").hidden);
check("toast names the count and calories", /^Logged 4 items · [\d,]+ kcal$/.test($("#toast-text").textContent), $("#toast-text").textContent);
click("#toast-undo");
eq("undo removes the whole group", ls("food-log"), []);
click("#food-log-btn");
eq("a logged tray starts empty", [rows().length, $("#food-tray-hint").hidden], [0, false]);

// A blank "Ate at" logs now.
searchPick("banana", "Banana");
fill("#food-tray-at", "");
click("#food-tray-log");
check("blank Ate at logs now", Math.abs(ls("food-log").at(-1).at - Date.now()) < 5000, ls("food-log").at(-1).at);

// A checklist slot: meal from the slot, checked off once, Undo restores the old state.
await reload({ "coach-started-at": "0", "coach-injury": null,
  "coach-checkins": { [`${today}|lunch`]: { status: "skipped", reason: "busy", at: 1 } } });
app().openFoodSheet({ slot: "lunch", title: "Lunch" });
eq("slot sets the meal", activeMeal(), "lunch");
searchPick("banana", "Banana");
clickText("Chains", $("#food-sheet-tabs"));
clickText("Chick-fil-A Cool Wrap", $("#food-sheet-body"));
click("#food-tray-log");
eq("both entries in the slot", ls("food-log").map((e) => [e.slot, e.meal]), [["lunch", "lunch"], ["lunch", "lunch"]]);
eq("slot checked off", ls("coach-checkins")[`${today}|lunch`].status, "done");
click("#toast-undo");
eq("undo puts the slot back how it was", [ls("food-log"), ls("coach-checkins")[`${today}|lunch`]], [[], { status: "skipped", reason: "busy", at: 1 }]);

// The editor shares the sheet: the tray hides there and comes back intact.
await reload({ "coach-started-at": "0", "coach-injury": null,
  "food-log": [{ id: "e1", date: today, at: Date.now(), slot: "extra", name: "Eggs", servings: 1, confidence: "exact",
    n: { kcal: 140, protein: 12, carbs: 1, fat: 10, fiber: 0, sugar: 0, addedSugar: 0, sodium: 140, alcohol: 0, upf: 0 } }] }, "food-panel");
click("#food-log-btn");
searchPick("banana", "Banana");
click("#food-sheet-cancel");
click(".food-entry");
check("editor hides the tray", $("#food-tray").hidden);
click("#food-sheet-cancel");
click("#food-log-btn");
eq("tray back after editing", rows(), [["Banana", "× 1"]]);
```

- [ ] **Step 2: Run, expect failures.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/tray.js`. Expected: FAIL. `#food-tray` doesn't exist, so the first `eq` throws. Exit code 1.

- [ ] **Step 3: Markup.** In `index.html`, between `<div class="food-sheet-body" id="food-sheet-body"></div>` and the `food-sheet-cancel` button:

```html
    <div class="food-tray" id="food-tray" hidden>
      <p class="hint tray-hint" id="food-tray-hint">Tap foods to add them here, then log them together.</p>
      <div class="tray-summary" id="food-tray-summary"></div>
      <div class="tray-details" id="food-tray-details">
        <ul class="tray-items" id="food-tray-items"></ul>
        <div class="chip-row tray-meals" id="food-tray-meals"></div>
        <label class="tray-at"><span>Ate at</span><input type="time" id="food-tray-at"></label>
      </div>
      <button type="button" class="primary-btn" id="food-tray-log"></button>
    </div>
```

- [ ] **Step 4: Every entry gets a meal.** In `food.js`, replace `logFood` with:

```js
/* Every single-tap log goes through here (the tray writes its own group,
   logTray). Logging into a checklist slot (e.g. "lunch") also checks that
   item off, which stops its pings. */
function logFood({ slot = "extra", name, servings = 1, n, confidence, ref, meal }) {
  const date = todayLocalDateString();
  const log = foodLog();
  log.push({ id: newId(), date, at: Date.now(), slot, name, servings, n, confidence, ref, meal: meal || mealForSlot(slot, minutesNow()) });
  saveJSON(FOOD_LOG_KEY, log);
  if (slot !== "extra") setCheckin(date, slot, { status: "done", at: Date.now() });
  refreshFood();
}
```

- [ ] **Step 5: Tray state and opening.** In `food.js`, right after `let sheetSlot = "extra";`:

```js
/* One tray per slot, in memory: closing the sheet (button or swipe) keeps
   it, so reopening the same slot shows the same picks. sheetTray is the
   open picker's tray, and null while the sheet edits an entry. */
const trays = {};
let sheetTray = null;
```

Replace `openFoodSheet` with:

```js
function openFoodSheet({ slot = "extra", title = "Log food", mode = "search", meal } = {}) {
  sheetSlot = slot;
  sheetTray = trays[slot] || (trays[slot] = { items: [], meal: null, at: null });
  // A section's + Add names its meal; an empty tray takes the default.
  if (meal) sheetTray.meal = meal;
  else if (!sheetTray.items.length) sheetTray.meal = mealForSlot(slot, minutesNow());
  document.getElementById("food-sheet-title").textContent = title;
  renderSheet(mode);
  renderTray();
  foodSheet.hidden = false;
  fitSheetToKeyboard();
}
```

Delete `logFromSheet` (nothing calls it after step 6).

- [ ] **Step 6: Pick paths add to the tray.** Put the tray section below right after `pickRow` in `food.js`:

```js
/* ---- Tray (spec B1): picks collect here and log together ---- */

const foodPick = (food) => ({ key: trayKey({ food: food.id }), name: food.name, n: foodNutrients(food), confidence: food.confidence, ref: { food: food.id } });

function mealPick(meal) {
  const { n, confidence } = mealNutrients(meal, foodLibrary(), []);
  const ref = { meal: meal.id, addons: [] };
  return { key: trayKey(ref), name: meal.name, n, confidence, ref };
}

/* A past entry comes back with its own servings and numbers. */
const entryPick = (e) => ({ key: trayKey(e.ref, e.name, e.n), name: e.name, servings: e.servings, n: { ...e.n }, confidence: e.confidence, ref: e.ref });

function takeoutPick(preset, size, desc) {
  const ref = { takeout: preset.id, size };
  return { key: trayKey(ref), name: `${preset.name} (${desc})`, n: takeoutNutrients(preset, size), confidence: "estimate", ref };
}

function addToTray(pick) {
  sheetTray.items = trayAdd(sheetTray.items, pick);
  renderTray();
  haptic();
}

function trayButton(className, text, label, onClick) {
  const btn = el("button", className, text);
  btn.type = "button";
  btn.setAttribute("aria-label", label);
  btn.addEventListener("click", onClick);
  return btn;
}

function renderTray() {
  document.getElementById("food-tray").hidden = !sheetTray;
  if (!sheetTray) return;
  const { items } = sheetTray;
  for (const chip of document.getElementById("food-tray-meals").children) {
    chip.classList.toggle("active", chip.dataset.meal === sheetTray.meal);
  }
  const atInput = document.getElementById("food-tray-at");
  // Follows the clock until Sean edits it.
  if (document.activeElement !== atInput) atInput.value = sheetTray.at || timeInputValue(Date.now());
  const empty = !items.length;
  document.getElementById("food-tray-hint").hidden = !empty;
  for (const id of ["food-tray-summary", "food-tray-details", "food-tray-log"]) document.getElementById(id).hidden = empty;
  if (empty) return;
  const t = trayTotals(items);
  const count = `${t.count} item${t.count === 1 ? "" : "s"}`;
  document.getElementById("food-tray-summary").textContent = `${count} · ${fmt(t.kcal)} kcal · ${fmt(t.protein)} g P`;
  document.getElementById("food-tray-log").textContent = `Log ${count}`;
  const list = document.getElementById("food-tray-items");
  list.innerHTML = "";
  for (const it of items) {
    const row = el("li", "tray-item");
    const step = (delta) => () => {
      sheetTray.items = trayStep(sheetTray.items, it.key, delta);
      renderTray();
    };
    row.append(
      el("span", "tray-name", it.name),
      trayButton("tray-step", "−", "Fewer", step(-0.5)),
      el("span", "tray-servings", `× ${fmtQty(it.servings)}`),
      trayButton("tray-step", "+", "More", step(0.5)),
      trayButton("tray-remove", "✕", "Remove", () => {
        sheetTray.items = trayRemove(sheetTray.items, it.key);
        renderTray();
      }),
    );
    list.appendChild(row);
  }
}

/* One entry per row, sharing a meal group, meal, time and slot. The slot
   is checked off once, and Undo puts back whatever it was before. */
function logTray() {
  const tray = sheetTray;
  const slot = sheetSlot;
  if (!tray || !tray.items.length) return;
  const date = todayLocalDateString();
  const at = atOnDate(date, tray.at) ?? Date.now();
  const group = newId();
  const log = foodLog();
  for (const it of tray.items) {
    log.push({ id: newId(), date, at, slot, name: it.name, servings: it.servings, n: it.n, confidence: it.confidence, ref: it.ref, meal: tray.meal, mealGroup: group });
  }
  saveJSON(FOOD_LOG_KEY, log);
  const prev = loadJSON(CHECKINS_KEY, {})[`${date}|${slot}`] || null;
  if (slot !== "extra") setCheckin(date, slot, { status: "done", at: Date.now() });
  const t = trayTotals(tray.items);
  delete trays[slot];
  sheetTray = null;
  closeFoodSheet();
  closeMealPanel();
  refreshFood();
  haptic();
  showToast(`Logged ${t.count} item${t.count === 1 ? "" : "s"} · ${fmt(t.kcal)} kcal`, () => {
    saveJSON(FOOD_LOG_KEY, foodLog().filter((e) => e.mealGroup !== group));
    if (slot !== "extra") setCheckin(date, slot, prev);
    refreshFood();
  });
}

for (const meal of MEALS) {
  const chip = el("button", "chip small", MEAL_LABELS[meal]);
  chip.type = "button";
  chip.dataset.meal = meal;
  chip.addEventListener("click", () => {
    sheetTray.meal = meal;
    renderTray();
  });
  document.getElementById("food-tray-meals").appendChild(chip);
}
document.getElementById("food-tray-at").addEventListener("input", (e) => {
  if (sheetTray) sheetTray.at = e.target.value || null;
});
document.getElementById("food-tray-log").addEventListener("click", logTray);
```

Then change each pick handler. Only the click callbacks change:
- `runOnlineSearch`: replace `() => logFromSheet(() => { saveToLibrary(food); logLibraryFood(food, sheetSlot); })` with `() => { saveToLibrary(food); addToTray(foodPick(food)); }`.
- `renderSearchResults`, recent: `() => addToTray(entryPick(e))`. Meal: `() => addToTray(mealPick(r.item))`. Food: `() => addToTray(foodPick(f))`.
- `renderFoodList`: `() => addToTray(foodPick(food))`.
- `renderMine`, saved meals: `() => addToTray(mealPick(meal))`.
- `takeoutRow`: `btn.addEventListener("click", () => addToTray(takeoutPick(preset, size, desc)));`
- `renderQuickAdd`: change the submit button text from `"Log it"` to `"Add to tray"`. Replace `logFromSheet(() => logFood({ slot: sheetSlot, name, n, confidence: "estimate" }));` with:

```js
    addToTray({ key: trayKey(undefined, name, n), name, n, confidence: "estimate" });
    renderSheet("quick"); // a clean form for the next one
```

In `openEditEntry`, add as its first two lines:

```js
  sheetTray = null; // the editor shares the sheet; the slot's tray waits in `trays`
  renderTray();
```

Change the swipe attach so the tray list scrolls like the body:

```js
attachSwipeClose(foodSheet, { close: closeFoodSheet, scroller: [document.getElementById("food-sheet-body"), document.getElementById("food-tray-items")] });
```

- [ ] **Step 7: CSS.** In `style.css`, after the `.food-sheet-body .processing-chips { ... }` rule:

```css
/* Tray (B1): docked under the food sheet's body. While the keyboard is
   up only its summary and Log button show, so the results keep the room. */
.food-tray {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--sep);
}

.tray-hint {
  margin: 0;
}

.tray-summary {
  font-size: 15px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.tray-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tray-items {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 28vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tray-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 12px;
  border-radius: 12px;
  background: var(--surface-2);
}

.tray-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.tray-servings {
  min-width: 34px;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tray-step,
.tray-remove {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.tray-remove {
  background: transparent;
  color: var(--text-2);
  font-size: 15px;
}

.tray-at {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 15px;
}

.tray-at input {
  flex: 0 0 128px;
}

.food-sheet.keyboard-up .tray-details,
.food-sheet.keyboard-up .tray-hint {
  display: none;
}
```

- [ ] **Step 8: Run the new test.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/tray.js`. Expected: all PASS, 0 JS errors. Read the screenshot. The tray rows, stepper, meal chips and "Ate at" row must fit at 390 px without clipping.

- [ ] **Step 9: Existing tests that logged with one tap now press Log.** Make these exact edits:
  - `tests/ui/food-flow.js`:
    - After `eq("1 entry logged", ls("food-log").length, 1);` add `eq("As planned gets its slot's meal", ls("food-log")[0].meal, "breakfast");`.
    - Replace the line `check("sheet closed", $("#food-sheet").hidden);` (the one after `click("#food-sheet-body .pick-row");`) with:
      ```js
      check("a pick waits in the tray", !$("#food-sheet").hidden && $$("#food-tray-items .tray-item").length === 1);
      click("#food-tray-log");
      check("sheet closed", $("#food-sheet").hidden);
      ```
    - After `$(".quick-form").requestSubmit();` add `click("#food-tray-log");`.
    - After `$$(".size-btn")[1].click();` add `click("#food-tray-log");`.
  - `tests/ui/snacks-search.js`: after `clickText("Chick-fil-A grilled nuggets, 12 ct", $("#food-sheet-body"));` add `click("#food-tray-log");`. Then after `clickText("White Claw", $("#food-sheet-body"));` add `click("#food-tray-log");`.
  - `tests/ui/online-search.js`: after `clickText("Protein Bar, Cookies & Cream (Quest Bar)", $(".online-results"));` add `click("#food-tray-log");`.
  - `tests/ui/chick-fil-a.js`: after `click(poly());` add `click("#food-tray-log");`.
  - `tests/ui/processing.js`: after `$$(".size-btn")[1].click(); // Pizza M, 290 kcal` add `click("#food-tray-log");`. Then after the next `$(".quick-form").requestSubmit();` add `click("#food-tray-log");`.

- [ ] **Step 10: Swipe and the tray.** Append to `tests/ui/swipe-close.js`:

```js
// The tray list scrolls like the body: a drag inside it closes the sheet
// only when it's at the top, and the tray survives a swipe close.
tab("food-panel");
click("#food-log-btn");
clickText("Chains", $("#food-sheet-tabs"));
$$("#food-sheet-body .pick-row").slice(0, 6).forEach((r) => r.click());
const trayList = $("#food-tray-items");
trayList.style.maxHeight = "60px"; // force a scrollable tray
trayList.scrollTop = 30;
check("tray scrolled", trayList.scrollTop > 0, trayList.scrollTop);
await swipe($(".tray-name", trayList), slow(fs.offsetHeight * 0.5));
await wait(300);
eq("scrolled tray doesn't close", fs.hidden, false);
trayList.scrollTop = 0;
await swipe($(".tray-name", trayList), slow(fs.offsetHeight * 0.5));
await wait(300);
eq("tray at top drags closed", fs.hidden, true);
trayList.style.maxHeight = "";
click("#food-log-btn");
eq("tray survives a swipe close", [$$("#food-tray-items .tray-item").length, (ls("food-log") || []).length], [6, 0]);
```

- [ ] **Step 11: Run, expect pass.** First `python .claude/skills/phone-preview/preview.py --interact tests/ui/tray.js --interact tests/ui/food-flow.js --interact tests/ui/snacks-search.js --interact tests/ui/online-search.js --interact tests/ui/chick-fil-a.js --interact tests/ui/processing.js --interact tests/ui/snack-ideas.js --interact tests/ui/redesign.js --interact tests/ui/swipe-close.js --budget 40000`, then the same with `--dark`. Expected: all PASS, 0 JS errors.

- [ ] **Step 12: Commit** (with approval):

```bash
git add index.html food.js style.css tests/ui/tray.js tests/ui/swipe-close.js tests/ui/food-flow.js tests/ui/snacks-search.js tests/ui/online-search.js tests/ui/chick-fil-a.js tests/ui/processing.js
git commit -m "Step B1: tray in the food sheet — picks collect, one Log writes the meal group"
```

---

### Task 4: Meal sections on the Food tab, and the editor's meal picker

**Files:**
- Modify: `index.html`: the "Today's log" card (about line 179)
- Modify: `food.js`: `renderFoodLog` (about line 647) and `openEditEntry`
- Modify: `style.css` (after the `.food-entry-kcal` rule, about line 1864)
- Create: `tests/ui/meal-sections.js`
- Modify: `tests/ui/timestamps.js`

**Interfaces:**
- Consumes: `MEALS`, `MEAL_LABELS`, `mealForEntry` (Task 1); `openFoodSheet({ meal, title })` (Task 3); `sumNutrients`, `entryTotal` (food-core); `timeOnDate`, `atOnDate` (coach-core).
- Produces:
  - Markup: `#food-log-list > section.meal-section[data-meal]`, each with `.meal-head` (containing `.meal-title`, an optional `.meal-sub` and `button.meal-add`) and an optional `ul.food-log > li.food-entry`.
  - `#food-sheet-body .meal-chips > .chip[data-meal]` in the editor.
  - `foodEntryRow(e, titles) -> HTMLLIElement`.

- [ ] **Step 1: Write the failing tests.** Create `tests/ui/meal-sections.js`:

```js
// Meal sections (step B2): the Food log in Breakfast / Lunch / Dinner /
// Snacks, old entries placed by their slot or time, + Add per meal, and
// moving an entry to another meal from its editor.
const at = (date, hm) => new Date(`${date}T${hm}`).getTime();
const n = { kcal: 200, protein: 20, carbs: 10, fat: 5, fiber: 0, sugar: 0, addedSugar: 0, sodium: 0, alcohol: 0, upf: 0 };
const entry = (id, slot, hm, extra = {}) => ({ id, date: today, at: at(today, hm), slot, name: id, servings: 1, n, confidence: "exact", ...extra });
const section = (m) => $(`#food-log-list .meal-section[data-meal="${m}"]`);
const namesIn = (m) => $$(".food-entry-name", section(m)).map((x) => x.textContent);

await reload({
  "coach-started-at": "0", "coach-injury": null,
  "food-log": [
    entry("Shake", "breakfast", "07:00"),
    entry("Bowl", "lunch", "16:00"), // the slot wins over the clock
    entry("Late eggs", "extra", "09:15"), // old extra entry: by its time
    entry("Pizza", "extra", "18:40"),
    entry("Oikos", "snack-am", "10:15"),
    entry("Chips", "breakfast", "08:00", { meal: "snack" }), // its own meal wins
    entry("Yesterday", "dinner", "19:00", { date: day(-1) }),
  ],
}, "food-panel");
eq("sections in meal order", $$("#food-log-list .meal-section").map((s) => s.dataset.meal), ["breakfast", "lunch", "dinner", "snack"]);
eq("headers", $$("#food-log-list .meal-title").map((s) => s.textContent), ["Breakfast", "Lunch", "Dinner", "Snacks"]);
eq("breakfast", namesIn("breakfast"), ["Shake", "Late eggs"]);
eq("lunch", namesIn("lunch"), ["Bowl"]);
eq("dinner", namesIn("dinner"), ["Pizza"]);
eq("snacks, by time", namesIn("snack"), ["Chips", "Oikos"]);
eq("subtotal", $(".meal-sub", section("breakfast")).textContent, "400 kcal · 40 g P");
eq("no Other label", $(".food-entry-meta", section("dinner")).textContent, "6:40 PM");

// + Add opens the sheet on that meal (slot extra) and logs there.
click(".meal-add", section("lunch"));
eq("+ Add opens on its meal", [$("#food-sheet").hidden, $("#food-tray-meals .chip.active").dataset.meal], [false, "lunch"]);
clickText("Chains", $("#food-sheet-tabs"));
click("#food-sheet-body .pick-row");
click("#food-tray-log");
eq("+ Add logs into that meal", [ls("food-log").at(-1).meal, ls("food-log").at(-1).slot], ["lunch", "extra"]);
eq("…and it shows there", namesIn("lunch").length, 2);

// One-tap chips get a meal by the clock.
clickText("+1 White Claw");
eq("quick chips get a meal", ls("food-log").at(-1).meal, app().mealForTime(app().minutesNow()));

// The editor's meal picker moves an entry and keeps a typed servings edit.
const byId = (id) => ls("food-log").find((x) => x.id === id);
const rowNamed = (m, name) => $$(".food-entry", section(m)).find((li) => $(".food-entry-name", li).textContent.startsWith(name));
click(rowNamed("dinner", "Pizza")); // found by name: a clock-timed White Claw can sort ahead of it
eq("editor marks its meal", $("#food-sheet-body .meal-chips .chip.active").dataset.meal, "dinner");
fill("#food-sheet-body input", "3");
click('#food-sheet-body .meal-chips [data-meal="snack"]');
eq("moved, typed servings kept, same day", [byId("Pizza").meal, byId("Pizza").servings, byId("Pizza").date], ["snack", 3, today]);
check("shows under Snacks", namesIn("snack").includes("Pizza × 3"), namesIn("snack"));

// The processing chips carry a typed edit too.
click(rowNamed("breakfast", "Shake"));
fill("#food-sheet-body input", "2");
clickText("Ultra", $("#food-sheet-body .processing-chips"));
eq("processing chip keeps typed servings", [byId("Shake").servings, byId("Shake").n.upf > 0], [2, true]);

// Empty sections: header and + Add only.
await reload({ "coach-started-at": "0", "coach-injury": null, "food-log": [entry("Shake", "breakfast", "07:00")] }, "food-panel");
eq("empty section", [!!$(".food-entry", section("lunch")), !!$(".meal-sub", section("lunch")), !!$(".meal-add", section("lunch"))], [false, false, true]);
```

In `tests/ui/timestamps.js`, change the expectation on the `eq("food times", ...)` line to `["8:42 AM", "12:30 PM · estimate"]`. Then insert this right after the `eq("blank time keeps it", ...)` line:

```js
// Midnight stays on the same day (and moves an old "Other" entry to Snacks by its time).
click($$(".food-entry")[1]);
fill(timeField(), "00:00");
$("#food-sheet-body form").requestSubmit();
eq("00:00 keeps the date", [f1().at, f1().date], [at(today, "00:00"), today]);
eq("00:00 lands in Snacks", $('#food-log-list .meal-section[data-meal="snack"] .food-entry-name').textContent, "Eggs × 2");
```

- [ ] **Step 2: Run, expect failures.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/meal-sections.js --interact tests/ui/timestamps.js`. Expected: FAIL on "sections in meal order", the editor checks and "food times". Exit code 1.

- [ ] **Step 3: Markup.** In `index.html`, replace these two lines:

```html
        <ul id="food-log-list" class="food-log"></ul>
        <p id="food-log-empty" class="empty-message">Nothing logged yet. Planned meals log from the Today tab.</p>
```

with:

```html
        <div id="food-log-list" class="food-log-sections"></div>
```

- [ ] **Step 4: Sections.** In `food.js`, replace `renderFoodLog` with:

```js
/* Four sections in meal order (spec B2). Each shows its subtotal and a
   + Add that opens the sheet on that meal; empty ones show just the header. */
function renderFoodLog(today, log, days) {
  const list = document.getElementById("food-log-list");
  list.innerHTML = "";
  const entries = log.filter((e) => e.date === today).sort((a, b) => a.at - b.at);
  const titles = slotTitles(today);
  for (const meal of MEALS) {
    const mine = entries.filter((e) => mealForEntry(e) === meal);
    const section = el("section", "meal-section");
    section.dataset.meal = meal;
    const head = el("div", "meal-head");
    head.appendChild(el("span", "meal-title", MEAL_LABELS[meal]));
    if (mine.length) {
      const t = sumNutrients(mine.map(entryTotal));
      head.appendChild(el("span", "meal-sub", `${fmt(t.kcal)} kcal · ${fmt(t.protein)} g P`));
    }
    const add = el("button", "chip small meal-add", "+ Add");
    add.type = "button";
    add.addEventListener("click", () => openFoodSheet({ meal, title: `Add to ${MEAL_LABELS[meal].toLowerCase()}` }));
    head.appendChild(add);
    section.appendChild(head);
    if (mine.length) {
      const ul = el("ul", "food-log");
      for (const e of mine) ul.appendChild(foodEntryRow(e, titles));
      section.appendChild(ul);
    }
    list.appendChild(section);
  }
  document.getElementById("food-complete").checked = Boolean(days[today] && days[today].complete);
}

function foodEntryRow(e, titles) {
  const li = el("li", "food-entry");
  li.tabIndex = 0;
  const main = el("div", "food-entry-main");
  main.appendChild(el("div", "food-entry-name", `${e.name}${e.servings !== 1 ? ` × ${e.servings}` : ""}`));
  // The section says which meal; a checklist slot's title still shows.
  const meta = [timeOnDate(e.at, e.date), e.slot !== "extra" && titles[e.slot], e.confidence !== "exact" && "estimate"];
  main.appendChild(el("div", "food-entry-meta", meta.filter(Boolean).join(" · ")));
  const t = entryTotal(e);
  const nums = el("div", "food-entry-nums");
  nums.appendChild(el("div", "food-entry-kcal", fmt(t.kcal)));
  nums.appendChild(el("div", "food-entry-meta", `${fmt(t.protein)} g P`));
  li.append(main, nums);
  li.addEventListener("click", () => openEditEntry(e));
  return li;
}
```

- [ ] **Step 5: The editor's meal picker; chips carry typed edits.** In `openEditEntry`, replace everything from `form.addEventListener("submit", (e) => {` through the end of the processing block (the closing `}` of `else if (entry.n.upf > 0) { ... }`) with:

```js
  /* Saves what's typed above plus `extra`. The chips below save at once,
     so they carry a typed servings or time edit instead of dropping it. */
  const saveEdits = (extra) => {
    const v = parseFloat(input.value);
    // The time moves within the entry's own day; a blank field keeps it.
    const at = atOnDate(entry.date, time.value);
    updateEntry(entry.id, (x) => {
      if (Number.isFinite(v) && v > 0) x.servings = v;
      if (at !== null) x.at = at;
      if (extra) extra(x);
    });
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = parseFloat(input.value);
    if (!Number.isFinite(v) || v <= 0) return;
    saveEdits();
  });
  body.appendChild(form);
  body.appendChild(el("div", "feel-label", "Meal"));
  const meals = el("div", "chip-row meal-chips");
  const currentMeal = mealForEntry(entry);
  for (const meal of MEALS) {
    const chip = el("button", `chip small${meal === currentMeal ? " active" : ""}`, MEAL_LABELS[meal]);
    chip.type = "button";
    chip.dataset.meal = meal;
    chip.addEventListener("click", () => saveEdits((x) => { x.meal = meal; }));
    meals.appendChild(chip);
  }
  body.appendChild(meals);
  // A single food can be retagged; the tag sticks for future logs too.
  const foodId = entry.ref && entry.ref.food;
  if (foodId || !entry.ref) {
    const current = entry.n.upf > 0 ? "ultra" : (foodLibrary().find((f) => f.id === foodId) || {}).processing || "processed";
    body.appendChild(el("div", "feel-label", "Processing"));
    body.appendChild(processingChips(current, (tag) => {
      if (foodId) setFoodProcessing(foodId, tag);
      saveEdits((x) => { x.n.upf = tag === "ultra" ? x.n.kcal : 0; });
    }));
  } else if (entry.n.upf > 0) {
    body.appendChild(el("p", "hint", `${fmt(entry.n.upf)} of ${fmt(entry.n.kcal)} kcal per serving are from ultra-processed ingredients.`));
  }
```

- [ ] **Step 6: CSS.** In `style.css`, after the `.food-entry-kcal { ... }` rule:

```css
/* Food log meal sections (B2) */
.meal-section + .meal-section {
  margin-top: 14px;
}

.meal-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.meal-title {
  font-size: 16px;
  font-weight: 750;
}

.meal-sub {
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.meal-add {
  margin-left: auto;
}
```

- [ ] **Step 7: Run, expect pass.** First `python .claude/skills/phone-preview/preview.py --interact tests/ui/meal-sections.js --interact tests/ui/timestamps.js --interact tests/ui/food-flow.js --interact tests/ui/processing.js --interact tests/ui/chick-fil-a.js`, then the same with `--dark`. Expected: all PASS, 0 JS errors. Then take tab screenshots, `python .claude/skills/phone-preview/preview.py --out <scratchpad>/preview-b4`, and read the Food tab: the four headers, the subtotals and + Add must sit on one line each at 390 px.

- [ ] **Step 8: Commit** (with approval):

```bash
git add index.html food.js style.css tests/ui/meal-sections.js tests/ui/timestamps.js
git commit -m "Step B2: Food log in meal sections with + Add; editor moves entries between meals"
```

---

### Task 5: Backup safety leftovers (from step 0)

**Files:**
- Modify: `backup-core.js`: `backupDelay` and `parseBackupFile`
- Modify: `backup.js`: constants (about line 7–17), `restoring` (line 40), `applyWithRollback` (about line 157), `restoreFromCode` (about line 177), `renderBackupCard` (about line 128), `importBackup` (about line 320), and the load-time code at the end
- Test: `tests/backup-core.test.html`, `tests/ui/restore.js`, `tests/ui/backup-file.js`

**Interfaces:**
- Consumes: `nativeSetItem`, `nativeRemoveItem` and `IMPORT_HINT_KEY`'s pattern (backup.js).
- Produces:
  - New device-only localStorage keys `backup-restore-incomplete` and `backup-import-note`. The `backup-` prefix keeps both out of backups, so `isBackupKey` doesn't change.
  - Constants `RESTORE_INCOMPLETE_KEY`, `IMPORT_NOTE_KEY` and `RESTORE_INCOMPLETE`, and a changed `ROLLBACK_FAILED` text.

- [ ] **Step 1: Write the failing tests.**

In `tests/backup-core.test.html`, after `eq("never sooner than 30 s", ...)`:

```js
  eq("a clock set back can't stretch the wait", backupDelay(100000, 500000), 60000);
```

and after the last `parseBackupFile` check:

```js
  const mixed = JSON.stringify({ app: "weight-and-save", format: 1, savedAt: 1, keys: {}, photos: [
    { id: "a", date: "2026-10-20", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" },
    { id: "b", date: "2026-10-20", dataUrl: "data:image/jpeg;base64,/9j/" },
    { id: "c", date: "2026-10-20", dataUrl: "data:image/png;base64,iVBO" },
  ] });
  eq("only photo types the app makes", parseBackupFile(mixed).photos.map((p) => p.id), ["b", "c"]);
```

In `tests/ui/restore.js`:
1. Change the expectation of `eq("double failure explained", ...)` to `"Restore failed and this phone's data may be incomplete. Backup is paused until a restore finishes: enter your code again, or import a backup file."`.
2. Right after the `app().applyBackup = realApply;` line that follows it, insert:

```js
// The paused state survives closing the app: no upload from the half-written data.
let saves = 0;
await reload({ "weight-tracker-entries": mine, "backup-code": code, "backup-on": "1", "backup-dirty": "1", "backup-restore-incomplete": "1" });
stub(true);
app().backupRemote.save = async () => { saves++; };
app().localStorage.setItem("food-log", "[]");
await wait(50);
eq("reopened: still paused", [app().eval("restoring"), app().eval("backupTimer"), saves], [true, null, 0]);
eq("reopened: says why", $("#backup-status").textContent, "A restore didn't finish, so backup is paused. Enter your code below or import a backup file before logging anything.");
fill("#backup-restore-input", code);
await submit("#backup-restore-form");
eq("a finished restore clears it", app().localStorage.getItem("backup-restore-incomplete"), null);

// A second tap while the first restore is still looking up doesn't ask twice.
await reload({ "weight-tracker-entries": mine });
stub(false);
let confirms = 0;
app().confirm = () => { confirms++; return false; };
app().backupRemote.load = (c) => new Promise((r) => setTimeout(() => r(c === code ? backup : null), 100));
fill("#backup-restore-input", code);
$("#backup-restore-form").requestSubmit();
$("#backup-restore-form").requestSubmit();
await wait(250);
eq("double tap: one confirm", confirms, 1);
```

In `tests/ui/backup-file.js`, append:

```js
// A partial-photo message written before the reload shows after it, once.
await reload({ "backup-import-note": "Logs and settings restored, but 1 photo couldn't be saved." });
eq("import note shown after the reload", $("#backup-restore-status").textContent, "Logs and settings restored, but 1 photo couldn't be saved.");
eq("…and only once", app().localStorage.getItem("backup-import-note"), null);
```

- [ ] **Step 2: Run, expect failures.** First `python tests/run.py`. Expected: backup-core FAILs on "a clock set back" (it gets 460000) and on "only photo types" (it gets `["a","b","c"]`), and the exit code is 1. Then `python .claude/skills/phone-preview/preview.py --interact tests/ui/restore.js --interact tests/ui/backup-file.js --budget 120000`. Expected: FAIL on the new checks.

- [ ] **Step 3: backup-core.js.**

```js
/* 30 s after a change, but no sooner than a minute after the last backup.
   A last-backup time in the future (the clock was set back) counts as now. */
function backupDelay(now, lastBackupAt) {
  return Math.max(30000, Math.min(lastBackupAt || 0, now) + 60000 - now);
}
```

In `parseBackupFile`, replace `p.dataUrl.startsWith("data:image/")` with `/^data:image\/(jpeg|png|webp);/.test(p.dataUrl)`. Also update the function's comment: `/* A backup file is a backup plus progress photos as data URLs. Only the photo types the app makes (JPEG; PNG and WebP to be safe) are kept, so nothing else reaches IndexedDB. */`.

- [ ] **Step 4: backup.js.**

After the `IMPORT_HINT_KEY` constant:

```js
/* Set when a restore failed and so did its rollback. Kept across launches,
   so a reopened app can't upload the half-written data over the cloud copy. */
const RESTORE_INCOMPLETE_KEY = "backup-restore-incomplete";
const RESTORE_INCOMPLETE = "A restore didn't finish, so backup is paused. Enter your code below or import a backup file before logging anything.";
/* A message from an import that must outlive the reload that follows it. */
const IMPORT_NOTE_KEY = "backup-import-note";
```

Change `ROLLBACK_FAILED` to:

```js
const ROLLBACK_FAILED = "Restore failed and this phone's data may be incomplete. Backup is paused until a restore finishes: enter your code again, or import a backup file.";
```

Replace `let restoring = false; // ...` with:

```js
let restoring = localStorage.getItem(RESTORE_INCOMPLETE_KEY) === "1"; // replacing everything; don't back up the half-written state
```

In `applyWithRollback`, right after `applyBackup(localStorage, backup);` in the `try` block, add `nativeRemoveItem.call(localStorage, RESTORE_INCOMPLETE_KEY);`. In the inner `catch`, before `return ROLLBACK_FAILED;`, add `nativeSetItem.call(localStorage, RESTORE_INCOMPLETE_KEY, "1");`. Replace `restoring = false;` with:

```js
    restoring = localStorage.getItem(RESTORE_INCOMPLETE_KEY) === "1";
```

Then update the function's comment to say the paused state is stored.

Rename the existing `async function restoreFromCode(input, statusEl)` to `async function lookUpAndRestore(input, statusEl)`, and add above it:

```js
let restoreBusy = false;

/* One restore at a time: a second tap while the first is still looking
   up the code would ask to replace everything twice. */
async function restoreFromCode(input, statusEl) {
  if (restoreBusy) return;
  restoreBusy = true;
  try {
    await lookUpAndRestore(input, statusEl);
  } finally {
    restoreBusy = false;
  }
}
```

In `renderBackupCard`, right after the statement that sets `document.getElementById("backup-status").textContent`:

```js
  if (localStorage.getItem(RESTORE_INCOMPLETE_KEY) === "1") document.getElementById("backup-status").textContent = RESTORE_INCOMPLETE;
```

In `importBackup`, replace the line `if (failed) statusEl.textContent = ...;` with:

```js
  // The reload wipes the status line, so the note waits in storage.
  if (failed) nativeSetItem.call(localStorage, IMPORT_NOTE_KEY, `Logs and settings restored, but ${failed} photo${failed === 1 ? "" : "s"} couldn't be saved.`);
```

At the end of the file, after `renderBackupCard();`:

```js
const importNote = localStorage.getItem(IMPORT_NOTE_KEY);
if (importNote) {
  nativeRemoveItem.call(localStorage, IMPORT_NOTE_KEY);
  document.getElementById("backup-restore-status").textContent = importNote;
}
```

- [ ] **Step 5: Run, expect pass.** `python tests/run.py`. Expected: backup-core passes 36/36 and the exit code is 0. Then `python .claude/skills/phone-preview/preview.py --interact tests/ui/restore.js --interact tests/ui/backup-file.js --interact tests/ui/backup.js --budget 120000`, and the same with `--dark`. Expected: all PASS.

- [ ] **Step 6: Commit** (with approval):

```bash
git add backup-core.js backup.js tests/backup-core.test.html tests/ui/restore.js tests/ui/backup-file.js
git commit -m "Backup leftovers: paused state survives a reopen, one restore at a time, clock-safe delay, photo types, import note"
```

---

### Task 6: Ship step B (v35)

**Files:** `docs/progress-log-detailed.md`, `docs/progress-log-summary.md` (controller only)

- [ ] **Step 1: Full verification.**
  - `python tests/run.py`: exit 0, with static 4/4, backup-core 36/36, coach-core 87/87, food-core 194/194 and injury 43/43 (or the pre-flight counts plus this plan's additions).
  - Run every UI script, light and dark: `python .claude/skills/phone-preview/preview.py --interact tests/ui/backup-file.js --interact tests/ui/backup.js --interact tests/ui/chick-fil-a.js --interact tests/ui/feel-checkin.js --interact tests/ui/food-checkin.js --interact tests/ui/food-flow.js --interact tests/ui/injury.js --interact tests/ui/meal-sections.js --interact tests/ui/online-search.js --interact tests/ui/processing.js --interact tests/ui/redesign.js --interact tests/ui/restore.js --interact tests/ui/snack-ideas.js --interact tests/ui/snacks-search.js --interact tests/ui/swipe-close.js --interact tests/ui/timestamps.js --interact tests/ui/tray.js --interact tests/ui/updates.js --interact tests/ui/water-pouches.js --budget 120000`, then the same with `--dark`. Expected: all 19 PASS, 0 JS errors.
  - Tab screenshots, light and dark: `python .claude/skills/phone-preview/preview.py --out <scratchpad>/preview-b`. Read each one. Look for clipped text or overlap in the Food log sections, and add a `--interact` screenshot of the open food sheet with three tray rows.
  - Check that `sw.js` says v35, `version.js` says 35, and `git diff main --stat` touches only the files this plan lists.
- [ ] **Step 2: Progress logs.** Add detailed-log rows for each step B commit (from `git log`), and one summary paragraph for "2026-10-2x — Step B: tray and meal sections". Commit them with approval.
- [ ] **Step 3: Push (Sean's yes required).** Fast-forward `main` to `batch1-stepB`, then `git push`. Verify the live site: `curl -s https://seanr9242000.github.io/weight-tracker/version.js` shows `APP_VERSION = 35` (this can take a minute or two).
- [ ] **Step 4: Phone check with Sean.** If a touch problem shows only on the iPhone, use the on-device event-log probe (https://claude.ai/artifact/7wjC1tJ1WdUq6kia3hUUFw), since synthetic tests can't see Safari's touch capture.
  1. Reopen the app without reinstalling. It shows "Updated to v35".
  2. Today → a meal or snack → Something else. Pick three things from different tabs (Search, Chains, Takeout). Nothing logs yet, and the tray at the bottom shows the count, kcal and protein. Use − and + on one row (½ steps, never below ½), then remove one row.
  3. Swipe the sheet away, then open the same item again: the tray is still there. With four or more rows, scroll the tray list; it scrolls without closing the sheet.
  4. Tap in Search so the keyboard comes up: the tray shrinks to its summary and the Log button.
  5. Change "Ate at" and the meal, then Log. The toast reads "Logged N items · X kcal" and the item is checked. Undo removes all of them and un-checks the item.
  6. Food tab: four sections with subtotals. + Add on Dinner opens with Dinner picked, and the food lands under Dinner.
  7. Tap an entry and type a new servings number, then tap another meal chip: the entry moves and the new servings stick.
  8. Drag the + sheet a little and let go so it springs back, then close it with Close and open it again: it slides up like normal.
- [ ] **Step 5: Hand-off.** Next is step T (training basics). The spec says it **needs its own short Q&A first** (training days, split, main lifts, gym equipment), then a spec section, and only then writing-plans. Carry the appendix below into step T's plan; its Injury mode items fit there.

---

## Appendix: backlog carried forward

These items were re-checked on 2026-10-24 and are still open. Each was triaged "can wait": rare, cosmetic, or test-only for Sean's single-user, single-injury use. Pick them up when a later step touches the same file.

**Injury mode (step 0.5). These fit step T, which reworks the lift and injury code.**
- A PT exercise added late in the day shows as Missed once its time has passed.
- The pain trend (rising-week warning) mixes body parts when a second injury has a different `part`.
- Starting a new injury overwrites the old one's history (only one `coach-injury` record is kept).
- An upcoming injury (start date in the future) can't be cancelled: End is hidden until it's active, and `until < start` is refused.
- "End now" on an injury that started today leaves `until < start` (harmless; it reads "Off. Last one").
- The PT remove handler dereferences `loadInjury()` without a null guard (unreachable from the UI today).
- `visibilitychange` re-renders the Injury card and banner but not Today, so the chip can be stale past midnight until the next `renderToday`.
- The summary's `. ${note}` reads oddly if the note already ends in punctuation.
- `injuryDays` has no guard for a null or missing `until` (callers gate on `injuryActive`).
- `snack-am`'s rest-day entry duplicates its game-day entry.
- `hasRecheckPanel` matches any item of kind "appointment" (only the recheck is one today).
- Answering Yes on the recheck writes a done check-in for an item that then vanishes (harmless).
- `feelDrafts` are keyed by item id only (moot while the feel panel renders only today's items).
- Test gaps:
  - the reminders.js ping-once rule for optional items
  - the null-injury "Start" summary, an upcoming injury, Cancel, and the PT add no-op
  - closing the recheck panel, the `<= dateStr` rejection, and the recheck leaving today after Yes
  - pain 0 and pain ≤ 3 (no warning, no toast), and the rising-week toast branch
  - the `liftDay` test helper only reloads when the lift is absent
  - the "seeded" check relies on a fresh profile having no `coach-injury` (add a comment)

**Backup and updates (step 0)**
- `save_backup` with a null `p_code` or `p_data` hits a NOT NULL error instead of a friendly message. There's no write quota per anonymous user, and `load_backup` doesn't normalize the code (the client always sends normalized codes). These need a migration and `~/bin/supabase.exe db push` (dry-run first).
- A raw Postgrest `err.message` can be long in the status line.
- The import status goes to the restore card whenever that card is visible.
- `preparedExport` has no expiry (a stale snapshot if data changes between the two taps).
- An update reload can drop half-typed input on deploy days.
- The `.code-form` submit styling duplicates `.pill-btn` (needed to beat the global `button[type=submit]`).
- Test and tooling gaps:
  - run.py prints the em dashes in FAIL lines as replacement characters in Git Bash.
  - run.py's index regex only matches double-quoted `src`/`href`.
  - The sw.js static checks are substring checks.
  - run.py's `main()` reuses the passed/total names.
  - `tests/ui/updates.js` calls `applyPendingUpdate` directly, so the save/discard wiring isn't exercised by a click.
  - `tests/ui/backup.js` doesn't probe the 30–60 s window, the visibility-hidden upload or the retry timer, and its 61 s minute-rule check has about 1 s of margin.
  - `restore.js` doesn't assert that the code is kept or that the reload happens on the Backup-card path.
  - There are no tests for import cancel, the download fallback or the Preparing… state, or for `validBackup` with non-string values, empty keys or a photo missing its id.
