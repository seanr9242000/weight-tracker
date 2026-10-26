# Feedback batch 1: design spec (approved 2026-10-15)

## Context
Redesign step 1 shipped in 7fc7b48 (cache v30). After a day of use, Sean
sent seven pieces of feedback:

1. Add several foods at once when logging a meal or snack.
2. The food sheet can't be swiped down; only the Close button works.
3. Split the food log into Breakfast / Lunch / Dinner / Snacks.
4. Show timestamps on all logs and entries.
5. Food data is thin; for example, Chick-fil-A large fries are missing.
6. Bring back the Zyn savings. He then widened this to general savings:
   Zyn, alcohol, eating out, and energy drinks.
7. Water goals as reminders.

Brainstorm decisions:
- **Multi-add:** a tray, then a single Log (chosen over "log instantly
  and keep the sheet open").
- **Restaurant data:** test the free tiers first (FatSecret Basic and
  Spoonacular Free). Pay only if both miss foods Sean actually eats.
  Missing Chick-fil-A items get hand-entered now.
- **Water:** fixed reminders every few hours, not "only if behind."
- **Energy drinks:** switch straight to coffee. The weekly goal is 0
  from now on, and the change is tracked as a habit.
- **Baselines (Sean's numbers):**
  - Drinks: 12–15 a week at $8–10 each. Uses 13.5 at $9.
  - Meals out: 4–5 a week at $13.50. Uses 4.5.
  - Zyn: 8 pouches a day, 15 per can, $5.50 a can.
  - Energy drinks: 7 a week at $2.50.
  - Coffee: $0.50 a cup (assumed, home brew).

This batch comes before redesign step 2 (the Food tab, with finished
schedule items folding into a "N done" dropdown). Steps B and C overlap
with that Food tab work.

## Spec

### 0. Data loss: reliable updates and backup (ships first)
**Root cause (confirmed with Sean on 2026-10-15):** after a deploy, the
new version often didn't show up when he reopened the app. To get it, he
deleted the home-screen icon and re-added it from Safari. iOS gives each
home-screen install its own storage and deletes that storage along with
the icon, so every reinstall wiped everything: weights, runs, photos,
food log and settings. That data is not recoverable.

Updates didn't show up for three reasons:
- **The 10-minute file cache.** GitHub Pages serves every file with
  `Cache-Control: max-age=600`. The service worker's network-first
  `fetch(event.request)` uses the default cache mode, so for up to 10
  minutes after a deploy it can return those cached old files.
- **No reload.** When a new service worker installs, the page doesn't
  reload.
- **No relaunch.** iOS usually resumes a standalone app instead of
  relaunching it.

**0a. Updates always arrive**
- **Fresh fetches:** `sw.js` fetches same-origin GETs with
  `cache: "no-cache"`. The browser revalidates by ETag, so unchanged
  files come back as cheap 304s. The offline fallback to the SW cache is
  unchanged.
- **Check for an update:**
  - on load, and
  - every time the app comes back to the foreground (`visibilitychange`
    → `registration.update()`).
- **Reload once:** on `controllerchange`, the page reloads one time. It
  is guarded so it can't loop, and skipped while a run is being tracked
  (the reload then waits until the run is saved).
- **Version number:**
  - `APP_VERSION` in a small `version.js` that matches `CACHE_NAME`'s
    number. A test checks they match.
  - Shown in the new Backup card ("Weight & Save v31").
  - After an update applies, a toast says "Updated to v31".

**0b. Backup**
- **What's included:**
  - Every app localStorage key: `weight-tracker-*`, `coach-*`, `food-*`,
    `water-log`, `ui-*` and the new savings keys.
  - Excluded: device-specific keys (`coach-reminders-on`, active tab,
    active run) and Supabase auth keys (`sb-*`).
- **Restore code:**
  - Generated once on the device, for example `WS-7K3M-Q9TP-2XHD`
    (12 random base32 characters, about 60 bits).
  - Stored locally and shown in the Backup card with a Copy button and a
    note to save it in Notes.
- **Cloud backup (Supabase):**
  - New table `backups` with `code_hash` (sha256 of the code, primary
    key), `data jsonb` and `updated_at`.
  - RLS is on with no direct access. Two `security definer` RPCs are the
    only way in:
    - `save_backup(p_code, p_data)` (upsert)
    - `load_backup(p_code)`
  - Both require a signed-in (anonymous) session, same as
    `save_push_subscription`.
  - The table is keyed by code, not user, because a reinstall creates a
    new anonymous user.
  - New migration in `supabase/migrations/`.
- **When it backs up:**
  - 30 s after any change, at most once a minute, and when the app goes
    to the background.
  - Only after Sean has turned backup on. The first turn-on shows the
    code.
  - The card shows "Last backed up 2 min ago" or an error.
  - Offline means it just retries later.
- **Restore:**
  - On a fresh install with no data, Today shows a "Restore from backup"
    card (enter code).
  - The Backup card also has Restore.
  - Restore asks for confirmation before replacing local data, then
    reloads. It keeps the code so backups continue under it.
- **File export and import:**
  - "Export backup" builds a JSON file of the same keys plus progress
    photos (IndexedDB, as data URLs) and shares it through
    `navigator.share({ files })`, so it can go to Files or iCloud. If
    sharing isn't available, it downloads instead.
  - "Import backup" reads that file back (with confirmation).
  - Photos are only in the file, which keeps cloud backups small.
- **Where it lives:** a new "Backup & updates" card next to the
  Reminders card.
- **Tests:**
  - `backup-core.js` (pure): key selection, export shape, and that a
    restore round-trips.
  - UI script for the card and the restore flow, with the Supabase calls
    stubbed.

### 0.5 Injury mode (added 2026-10-21)
**Context:** Sean's ankle sprain turned out to be an avulsion fracture.
Doctor's orders:
- Brace for 6 weeks, then PT later.
- No basketball (cuts and pivots).
- Working out is allowed.
- Recheck is **2026-12-07**.

Sean wants to keep training legs without straining the ankle.

**Data:** `coach-injury` = `{ part: "ankle", start, until: "2026-12-07",
note }` in localStorage. It is included in the backup (step 0). Injury
mode is on while `start <= today <= until`.

**Schedule (`coach-core.js`, pure).** The injury is passed into
`itemsForDate` like overrides. For each item:
- **Removed:**
  - `game`
  - `pregame-prep`
  - the game-day "how did it go?" check-in
- **Retitled snacks:**
  - `pregame-snack` stays, retitled "Afternoon snack".
  - `postgame` stays, retitled "Evening snack" (food reminders
    unchanged).
- **`lift`:** title stays. The note becomes the ankle-safe plan:
  - leg extension, seated/lying leg curl, hip thrust or glute bridge
    (brace on), hip abduction/adduction
  - single-leg work on the good leg (cross-education)
  - upper body as normal
  - arm-bike or upper-body finisher
  - "Ask PT first: leg press (feet high), RDLs. Avoid until cleared:
    squats, lunges, step-ups, calf raises, jumps, sled, rower, running."
- **`post-lunch` / `post-dinner` walks:** retitled "Easy walk in brace —
  skip if sore". Skipping is never counted as a miss.
- **New item on `until`:** "Ankle recheck" (`kind: "appointment"`, 9:00).
  Tapping it asks "Cleared?":
  - **Yes** ends Injury mode (sets `until` to yesterday's date and keeps
    the history).
  - **Not yet** asks for a new date and extends `until`.
- **PT exercises:** an "Add PT exercises" action in Injury settings lets
  Sean add daily items (title + time) once PT starts. They live in
  overrides-like storage and only apply while Injury mode is on. No
  exercises are pre-filled.

**Elsewhere:**
- **Water:** the game-day +32 oz bonus is off. There are no games, so
  the day is no longer a game day.
- **Train tab / Runs:** a banner reads "Runs paused: ankle (back after
  Dec 7 recheck)". The Start buttons are still there but de-emphasized,
  not removed.
- **Lift check-in:** adds "Ankle pain (0–10)". If pain is ≥ 4, or this
  week's average is higher than the week before, show "Back off leg
  work and mention it to your PT." Stored with the check-in, so Fuel vs
  feel and the future coach can read it.
- **Food:** no target change. The weekly check-in already re-estimates
  maintenance from logs and weight. Snack ideas use lift/rest-day logic,
  since there are no game days.
- **Today chip:** "🩹 Ankle · day N of 47 · recheck Dec 7". Tapping it
  opens Injury settings (dates, note, PT items, end now).

**Setup:** ships pre-filled for Sean (start 2026-10-21, until
2026-12-07). Settings can edit it, and the next injury can be started
from the same card.

**Tests:**
- `tests/run.py`:
  - game items removed
  - snacks retitled
  - lift note swapped
  - recheck item on `until`
  - nothing changes outside the date range
  - water bonus off
  - pain flag rule
- UI script: injury chip, recheck "Cleared?" flow, lift check-in with
  the pain question.

### A1. Swipe down to close (all sheets)
- Applies to the food sheet, the + quick-add sheet, and the third sheet
  in `index.html`. All three share `.sheet-handle`.
- **Where a drag can start:**
  - the handle, or
  - the sheet header (title and mode chips), or
  - the sheet body, but only when it is scrolled to the top.
- **How it behaves:**
  - The sheet follows the finger downward only; upward drags are ignored.
  - It closes if dragged more than 1/3 of its height, or flicked faster
    than about 0.5 px/ms. Otherwise it springs back.
  - The backdrop fades in proportion to the drag.
- **How it's built:**
  - One shared helper in `ui.js`, attached to each sheet.
  - It uses Pointer Events with `touch-action` set so the body still
    scrolls normally.
  - Closing calls each sheet's existing close function.
- **The tray survives a close.** Food-sheet state is kept per meal slot
  in memory, so reopening the same slot shows the same tray.

### A2. Timestamps
- **Show a time ("8:42 AM") on every entry:**
  - food entries in the Food log
  - water entries (water detail drawer)
  - pouches (already shown)
  - cravings
  - weigh-ins
  - runs (start time)
- **Weigh-ins:** new ones store `at`. Old ones have only a date, so they
  show only the date.
- **Editing the time:**
  - The food entry editor gets a time field.
  - The tray gets an "Ate at" time (A2/B1) that defaults to now.
  - Changing the time never changes the entry's date.
  - Other entry types are display-only for now.

### A3. Chick-fil-A items (hand-entered)
- **Add from Chick-fil-A's official nutrition page:**
  - Waffle fries (S/M/L)
  - Spicy Chicken Sandwich
  - Deluxe
  - Grilled Chicken Sandwich
  - Cool Wrap
  - Mac & cheese
  - Fruit cup
  - Main sauces: Chick-fil-A Sauce, Polynesian, Honey Mustard,
    Garden Herb Ranch, Zesty Buffalo, Barbeque
  - Lemonade and sweet tea (S/M/L)
  - Chick-n-Minis
  - Hash browns
- **Item fields:**
  - `group: "chain"`
  - `confidence: "exact"` where the numbers come from the official page
  - a processing tag of ultra or processed, same rules as the existing
    items
- **Updating existing items:** their numbers get checked and corrected
  using the seed `rev` field. Existing localStorage copies keep any
  servings Sean edited.

### B1. Tray (multi-add)
- **Picking adds to the tray.** Every pick path adds there instead of
  logging:
  - search results, including recent and online results
  - My foods
  - Chains
  - Takeout S/M/L
  - Quick add
  - saved meals
- A saved meal (for example My Chipotle order) is a single tray item.
- **Tray layout:** a docked area at the bottom of the sheet showing:
  - item count, total kcal, and total protein
  - each item with a servings stepper (½ steps, minimum ½) and a remove
    button
  - a meal picker (B2) and an "Ate at" time
  - a **Log N items** button
- **Logging writes one entry per item.** Each entry shares:
  - the same `mealGroup` id (new field)
  - the same `meal` (B2) and `at`
  - the slot
- Logging checks off the checklist slot once.
- The toast is "Logged 3 items · 950 kcal", with Undo removing the whole
  group.
- When the tray is empty, the Log button is hidden. Close/swipe keeps
  the tray (A1).
- Picking the same food twice raises its servings instead of adding a
  duplicate row.
- **Quick re-log chips** on the Food tab still log one tap = one entry
  straight away (unchanged).

### B2. Meal sections
- **New entry field:** `meal`, one of `breakfast | lunch | dinner | snack`.
- **Mapping old entries from their slot:**
  - `breakfast` → breakfast
  - `lunch` → lunch
  - `dinner` and `treat-meal` → dinner
  - `snack-am`, `snack-pm`, `snack-eve`, `pregame-snack`, `post-lift`,
    `postgame` → snack
  - `extra` → by time of day (below)
  - This mapping lives in `food-core.js` as `mealForEntry(entry)` (pure,
    tested).
- **Default from the time of day**, for `extra` and sheets opened from +
  or the Food tab:
  - before 10:00 → breakfast
  - 10:00–11:30 → snack
  - 11:30–14:30 → lunch
  - 14:30–17:00 → snack
  - 17:00–20:30 → dinner
  - after 20:30 → snack
- **Meal picker in the sheet:** four chips.
  - Opened from a schedule item: filled in from that item's slot.
  - Otherwise: the time-of-day default. Sean can always change it.
- **Food tab log:** four sections in meal order. Each section has:
  - its kcal and protein subtotal
  - its entries with times (A2)
  - a **+ Add** button that opens the sheet with that meal selected and
    slot `extra`
  - Empty sections show only the header and + Add.
- **Entry editor:** gets a meal picker so an entry can be moved to
  another meal.

### T. Training basics (Q&A 2026-10-25)
**Context:** lifting is Sean's only training until the ankle recheck
(2026-12-07). He doesn't know his working weights, so first sessions
set the baseline. Gym (community center) has dumbbells up to ~200 lb, a
barbell with bench and rack, cables, selectorized upper-body machines,
and leg machines (extension, curl, hip abduction/adduction, leg press).
No barbell hip thrusts; glute bridges are fine.

**Schedule.** Upper / Lower, 4 days while Injury mode is on:

| Day | Time | Workout |
|---|---|---|
| Mon | 18:30 | Upper A (only while Injury mode is on) |
| Wed | 17:45 | Lower A (ankle-safe) |
| Fri | 17:15 | Upper B |
| Sat | 10:30 | Lower B (ankle-safe) |

- `injuryItems` adds a Monday `lift` item at 18:30 (plus `post-lift` at
  +50 min) in place of the removed game items. Outside Injury mode
  Monday stays a game day and Wed / Fri / Sat keep their lifts. Which
  workouts run after clearance is decided with the basketball work;
  until then Wed / Fri / Sat keep Lower A / Upper B / Lower B (editable).
- The injury `lift` note (`INJURY_LIFT_NOTE`) stays as the "Ask PT
  first / Avoid until cleared" reference, shown in workout mode on
  lower days.

**Default plan** (sets × reps; rest: 120 s when the rep range tops out
at ≤ 10, else 75 s). Swaps are listed after "/".

- **Upper A (Mon):**
  1. Barbell bench press 3 × 6–8 / DB bench press, machine chest press,
     push-ups
  2. Seated cable row 3 × 8–10 / machine row, chest-supported DB row,
     one-arm DB row
  3. Seated DB shoulder press 3 × 8–10 / machine shoulder press, seated
     Arnold press
  4. Lat pulldown 3 × 10–12 / neutral-grip pulldown, single-arm cable
     pulldown
  5. Cable triceps pushdown 2 × 12–15 / overhead cable triceps, DB skull
     crusher
  6. DB curl 2 × 12–15 / cable curl, incline DB curl, EZ-bar curl
- **Lower A (Wed, ankle-safe):**
  1. Leg extension 3 × 10–12 / single-leg leg extension, paused leg
     extension
  2. Seated leg curl 3 × 10–12 / lying leg curl, single-leg seated curl
  3. Glute bridge (brace on, DB on hips once easy) 3 × 10–12 /
     single-leg glute bridge (good leg), frog pump
  4. Single-leg leg extension, good leg 2 × 10–12 / single-leg leg curl
     (good leg)
  5. Hip abduction machine 3 × 12–15 / banded seated abduction,
     side-lying abduction
  6. Hip adduction machine 2 × 12–15 / side-lying adduction, seated ball
     squeeze
  7. Machine ab crunch 3 × 12–15 / dead bug, captain's-chair knee raise
  8. Arm bike 8 min (timed) / seated battle ropes, seated upper-body
     circuit
- **Upper B (Fri):**
  1. Incline DB press 3 × 8–10 / incline barbell press, incline machine
     press, low-to-high cable fly
  2. Close-grip lat pulldown 3 × 8–10 / neutral-grip pulldown,
     single-arm cable pulldown
  3. Machine row 3 × 10–12 / seated cable row, one-arm DB row
  4. Machine shoulder press 3 × 10–12 / seated DB press, seated Arnold
     press
  5. Cable lateral raise 2 × 12–15 / DB lateral raise, machine lateral
     raise
  6. Cable face pull 2 × 12–15 / reverse pec deck, seated rear-delt DB
     fly
  7. Hammer curl 2 × 12–15 / cable rope curl
  8. Overhead cable triceps 2 × 12–15 / DB overhead extension
- **Lower B (Sat, ankle-safe):**
  1. Seated leg curl 3 × 10–12 / lying leg curl, single-leg seated curl
  2. Leg extension 3 × 12–15 / single-leg leg extension, paused leg
     extension
  3. Glute bridge 3 × 12–15 / single-leg glute bridge (good leg), frog
     pump
  4. Single-leg leg curl, good leg 2 × 10–12 / single-leg leg extension
     (good leg)
  5. Hip abduction machine 3 × 12–15 / banded seated abduction,
     side-lying abduction
  6. Hip adduction machine 2 × 12–15 / side-lying adduction, seated ball
     squeeze
  7. Dead bug 3 × 10–12 / machine crunch, captain's-chair knee raise
  8. Arm bike 8 min (timed) / seated battle ropes, seated upper-body
     circuit

Every exercise (main or swap) has a stable id and a `type`:
`weighted` (weight × reps), `bodyweight` (reps only: push-ups, dead bug,
knee raise, frog pump, bodyweight bridge) or `timed` (minutes). History
is keyed by exercise id, so a swap shows its own last numbers.

**Workout mode.**
- **Start:** "Start workout" on the Today `lift` item and on the Train
  tab's Lifts card. It opens a full-screen view that shows:
  - the day name and an elapsed clock
  - each exercise with "Last: 3 × 10 @ 50 lb" and the suggestion
  - set rows with weight and reps pre-filled from the suggestion; ✓
    logs the set, and the numbers can be changed first
  - Swap (this session only) and Skip per exercise
- **No accidental close:** swipe-to-close is off. A "–" button minimizes
  it to a "Workout in progress · mm:ss" bar on Today that reopens it. The
  active workout (`lift-active`) is saved after every change. A reload
  or relaunch reopens workout mode with every set intact.
- **Screen:** request a Screen Wake Lock while the mode is open. It's
  best-effort, and failure is silent.
- **Stop:** "Finish workout?" shows a summary (duration, sets done, new
  bests by e1RM or reps at the same weight). Finish saves the session to
  `lift-sessions`, marks the day's `lift` item done, and opens the
  existing "how did it go?" card (with ankle pain while Injury mode is
  on). Discard drops `lift-active` without saving.
- **One active workout at a time.** Starting from a different day's item
  while one is active offers "Resume" instead.

**Rest timer.**
- Starts on ✓ using the exercise's rest seconds.
- A bottom bar shows the countdown with −15 s / +15 s / Skip.
- It's based on the clock (an end timestamp), so it stays correct after
  locking the phone or switching apps.
- At 0 it plays a short Web Audio beep, but only while the page is
  visible. iOS mutes it on silent. The bar also flashes.

**Progression** (pure, in `lift-core.js`), from the last two sessions
of that exercise id:
- No history: "Pick a weight you could do for ~2 more reps than the
  target." Fields stay blank, and that session is the baseline.
- Every set of the last session reached the top of the range: suggest
  last weight + 5 lb.
- The last 2 sessions each had a set below the bottom of the range:
  suggest last weight × 0.9, rounded to the nearest 5 lb (never below
  5).
- Otherwise: same weight, "beat last time's reps."
- `bodyweight`: same logic on reps, with no weight shown. `timed`: shows
  last time only.

**Plan editor** (Train → Lifts → Edit plan):
- Per day: add (from the catalog), remove, reorder, edit sets / rep
  range / rest.
- "Make default" on a swap replaces the main exercise.
- "Reset to default" restores the shipped plan.
- Stored as `lift-plan`. When it's absent, the shipped plan is used.

**Train tab:** a Lifts card above runs shows the next lift day, Start
workout, the last 5 sessions (date, day, duration, sets) and Edit plan.

**Data:**
- `lift-plan`: `{ days: { upperA|lowerA|upperB|lowerB: [{ exId, sets,
  repMin, repMax, rest }] }, dayByWeekday: { 1: "upperA", 3: "lowerA",
  5: "upperB", 6: "lowerB" } }`
- `lift-sessions`: `[{ id, date, day, start, end, exercises: [{ exId,
  sets: [{ w, reps, min }] }] }]`
- `lift-active`: same shape plus `restEndsAt`
- All three are added to the backup key list.

**Also in step T:** the Injury mode backlog carried in the step B
plan's appendix:
- mixed-part pain trend
- a new injury overwrites history
- an upcoming injury can't be cancelled
- "End now" on a same-day injury
- the PT remove null guard
- `visibilitychange` not re-rendering Today
- the `injuryDays` null-`until` guard

The deferred step B minors are fixed only if step T touches that code.

**Tests:**
- `tests/run.py`:
  - progression (+5, −10% after two misses, hold, no history,
    bodyweight, timed)
  - history by exercise id including swaps
  - Monday lift only inside the injury range
  - plan defaults and editor edits round-trip
  - the backup includes the lift keys
- UI scripts:
  - start → log sets → rest timer → minimize/resume → reload
    mid-workout → stop → check-in
  - swap and skip
  - plan editor
  - Lifts card
- Full suite in light and dark at the end. Version 36: bump `CACHE_NAME`
  and `version.js` together.

### C1. Savings
- **New pure module `savings-core.js`** (DOM-free, tested):
  - `savingsFor(range, data, settings)` returns
    `{ zyn, alcohol, eatingOut, energy, total }` in dollars.
  - It also returns the counts behind each number (avoided units,
    baseline, actual), so the UI can show how each figure is worked out.
- **Settings** (localStorage, editable on a Savings settings card):
  - Zyn: 8 pouches/day, 15 per can, $5.50 a can. Replaces the
    hard-coded `BASELINE_POUCHES_PER_DAY = 7.5`, `POUCHES_PER_CAN` and
    `COST_PER_CAN`.
  - Drinks: 13.5 a week at $9.
  - Meals out: 4.5 a week at $13.50.
  - Energy drinks: 7 a week at $2.50.
  - Coffee: $0.50.
- **Which days count:**
  - **Zyn:** every day from the taper start date (same rule as now):
    max(0, baseline − pouches) / per-can × can price.
  - **Alcohol, eating out, energy drinks:** only days whose food log is
    closed (`food-days[date].complete`). A day Sean forgot to log must
    not count as spending nothing.
  - Counting starts on the savings start date. That date is set the
    first time this ships, and Sean can edit it.
  - Daily baseline = weekly baseline ÷ 7.
- **Alcohol:** drinks = sum of servings of entries with `n.alcohol > 0`.
  Saved = max(0, baseline − drinks) × price.
- **Eating out:** count the number of distinct `mealGroup`s that contain
  a chain or takeout item. An entry without a group counts as its own
  group. Saved = max(0, baseline − meals) × price.
- **Energy drinks:** energy-drink entries and coffee entries come from
  the food log (new library foods, C2).
  Saved = max(0, baseline − energy) × $2.50 − coffees × $0.50.
  This line can be negative on a day, but the total for any range is
  floored at 0.
- **Per-day clamping:** each category is clamped at ≥ 0 per day, except
  energy as noted. Going over the baseline on one day doesn't wipe out
  savings from earlier days. The over-baseline days are shown in the
  breakdown instead.
- **UI:**
  - **Today chip:** "$X saved this month", under the rings. Tapping it
    opens a drawer with:
    - this week / this month / all time
    - a row per category showing $ and the figures it came from (e.g.
      "38 drinks avoided × $9")
    - a short note on which days count
  - **Progress:** the segmented control gets a third view, **Savings**,
    with the same breakdown, a weekly bar for each category, and the
    settings card.
  - **Progress → Habits:** the stats card moves to the top. Its "Saved"
    tile now reads from `savings-core`.

### C2. Energy drinks → coffee
- **New library foods:**
  - "Energy drink (typical 16 oz)", tagged ultra, with
    `habit: "energy"` and editable nutrition.
  - "Coffee (black)", tagged whole, with `habit: "coffee"`.
  - Sean can change either food's nutrition to match his actual brands.
- **+ sheet:** one-tap **Energy drink** and **Coffee** tiles, logged to
  meal "snack" by default.
- **Progress → Habits** gets an "Energy drinks → coffee" card showing:
  - energy drinks this week against a goal of 0
  - coffees this week
  - a streak of energy-drink-free days (counted back from today; today
    counts if none has been logged yet)
  - the last 7 days as small bars, like the pouch week
- No pings for this. It's tracked only.

### D1. Water reminders
- **Generated "Water check" items** (`kind: "water"`):
  - The first is 60 minutes after that day's `wake` item, then one every
    120 minutes.
  - The last one is at or before 20:00.
  - Example: a 6:40 wake gives 7:40, 9:40, 11:40, 13:40, 15:40, 17:40,
    19:40.
  - Interval and end time are editable under Targets, next to the water
    goal.
- Generation lives in `coach-core.js` (pure), so the ping sync and the
  checklist use the same list.
- **Item text:**
  - Title: "Water check".
  - Push body: "Aim for ~X oz by now", where X = goal × (elapsed share
    of the day, from wake to end time), rounded to 4 oz.
- **Tapping the item** opens a panel with oz so far / goal and +8/+20/+40
  buttons.
- **Auto check-off:**
  - Logging any water marks the latest due, unchecked water item as done.
  - When the daily goal is reached, all of the day's remaining water
    items are marked done.
  - Undoing water does not un-check items.
- **Pings:** water rows sync with `stop_at = due_at + 1 min`, so each
  sends once with no 15-minute repeats. No server change is needed
  (`send-pings` already honours `stop_at`).
- **Schedule score:** water items are excluded from the schedule
  progress ("5 of 8 due done", %) and from the 80% streak score. They
  still show in the list with their own droplet color.

### E1. Restaurant database test (after Sean has keys)
- **Sean signs up** for both:
  - FatSecret Platform Basic (free, 5,000 calls/day, US data, credit
    required)
  - Spoonacular Free (50 points/day)
- **Keys** go in as Supabase function secrets.
- **Probe:** a throwaway script runs the same 8 queries against both and
  compares the results with official numbers:
  - CFA large waffle fries
  - CFA Deluxe
  - Chipotle chicken bowl
  - Wendy's Dave's Single
  - McDonald's large fries
  - Subway 6" turkey
  - Starbucks grande latte
  - Panera chicken soup
- **Pick the winner** on coverage and accuracy. Add it to the
  `food-search` function as a third source next to USDA generic/branded.
  Results are tagged with the source and show the required credit.
- **If neither is good enough,** revisit paid options with Sean.
  Nutritionix is about $499/mo; Spoonacular Cook is $29/mo.
- E1 gets its own short design once the probe results are in.

## Data changes (summary)
- Food log entries gain:
  - `meal` (optional on old entries; `mealForEntry` fills it in when
    read)
  - `mealGroup` (optional)
- Weight entries gain an optional `at`.
- New localStorage keys:
  - `savings-settings`
  - `savings-start`
  - water reminder settings (stored with the food settings)
- `BASELINE_POUCHES_PER_DAY`, `POUCHES_PER_CAN` and `COST_PER_CAN` move
  into the savings settings, with defaults of 8 / 15 / 5.5.
- Backup (step 0):
  - local keys: `backup-code`, `backup-on`, `backup-last`
  - Supabase: a `backups` table plus the `save_backup` / `load_backup`
    RPCs
  - new files: `version.js` and `backup-core.js`
- Training (step T):
  - new localStorage keys, all backed up: `lift-plan`, `lift-sessions`,
    `lift-active`
  - new files: `lift-core.js` and `lift.js`

## Order and verification
Sean checks each step on his phone before the next one starts:

1. **0:** reliable updates and backup. Until this ships, Sean should
   not delete the icon. To update, he swipes the app away and reopens it.
2. **0.5:** Injury mode (ankle, through the 2026-12-07 recheck)
3. **A:** swipe-to-close, timestamps, Chick-fil-A items
4. **B:** tray and meal sections
5. **T:** training basics, a slim slice of Phase 3 pulled forward on
   2026-10-21 because lifting is Sean's only training until the ankle
   is cleared:
   - lift-day workouts as an editable plan (ankle-safe legs plus upper
     body)
   - set logging (weight × reps) with last session's numbers shown
   - simple progression (all reps hit → suggest a small increase)
   - ankle pain per session (from 0.5)

   Basketball work (plyos, lateral work, shooting) and the AI coach wait
   until he's cleared. **Needs its own short Q&A first** (training days,
   split, main lifts, gym equipment), then a spec section.
6. **C:** savings and energy drinks
7. **D:** water reminders
8. **E:** restaurant database probe, then its own design

For every step:
- **Logic tests:** `python tests/run.py`, with new checks for
  `mealForEntry`, the time-of-day default, `savingsFor` (including
  closed-day gating, per-day clamping and meal-group counting), water
  item generation, and water auto check-off.
- **UI tests:** a new or extended `tests/ui/` script run with
  `preview.py --interact` (light and `--dark`):
  - swipe close via synthetic pointer events
  - tray add / stepper / remove / log
  - meal sections and + Add
  - savings drawer
  - Water check panel
- **Cache:** bump `CACHE_NAME` in `sw.js` on every asset change.
- **Commits:** ask before every commit and push. Update the progress logs
  after each approved commit.

## Out of scope
- Barcode scanning
- Redesign step 2's "N done" dropdown and the Progress charts and badges
  (next, after this batch)
- Savings badges (they come with gamification)
- Editing times for non-food entries
