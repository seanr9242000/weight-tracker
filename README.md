# Weight & Save

An installable PWA that's growing into a personal accountability
coach. Four tabs in a floating glass tab bar, plus a **+** button that
logs anything from any tab (one-tap water and pouches, food, a weigh-in,
a craving, starting a run, a progress photo), with a suggestion row for
the most likely log right now. Every quick log shows an Undo toast.
Follows the iPhone's light/dark setting; each area has its own color
(food green, protein pink, water blue, habits teal, weight purple,
training orange).

- **Today** — a daily checklist built from a weekly schedule (wake,
  weigh-in, meals, lifts, league games, wind-down, lights out). Check
  items off, skip or explain misses with a reason, and edit a single
  day's plan without changing the weekly template. Four rings up top
  (calories, protein, water, pouches vs. the taper limit); tap one for
  its details and actions. Closing the protein or water ring for the
  first time in a day plays a small celebration. Also shows completion,
  streak and last night's sleep. Every meal and
  snack is an item (weekday mid-morning and afternoon snacks, a lift-day
  evening snack), so each one gets a reminder. Meal items log their
  planned meal in one tap ("As planned") or open food search; tapping a
  meal's reminder opens straight to that item. Snack items also list
  ideas with exact portions, picked for the kind of day (game, lift,
  rest). Checking off a game or lift opens a quick "how did it go?"
  check-in (energy, stomach, legs, shooting / weights), saved with what
  you ate in the 4 hours before; the Food tab's "Fuel vs feel" card
  lines the two up once there are 3+ check-ins.
- **Food** — search (past entries first, then saved meals, foods,
  chains, takeout, plus "Search online" against the USDA food
  database; picked results are saved to My foods), calories and protein against a weekly budget with a
  weekend bank, health signals (fiber, added sugar, sodium, alcohol,
  and ultra-processed share of calories: every food is tagged Whole /
  Processed / Ultra, NOVA-style; online results are tagged from their
  ingredient lists),
  quick add, S/M/L takeout estimates, chain items, one-tap drinks, and
  a weekly check-in that proposes a new maintenance estimate from
  logged intake + weight trend (you approve it). The first 14 days are
  "Discovery": numbers show but nothing is judged.
- **Progress** — two views. *Weight*: weight entries, trend line,
  progress photos. *Habits*: a 6-week Zyn taper (fewer pouches, then
  3 mg, then a quit date), a pouch counter against the day's allowance,
  a craving log with triggers and replacement tips (opens in the +
  sheet), and progress stats.
- **Train** — runs and walks: live timer, GPS distance, route map.

Schedule/taper rules live in `coach-core.js` and food math in
`food-core.js` (no DOM, testable on their own); seed foods and meals
are in `food-data.js`; the UI is `coach.js` (Today checklist, Habits),
`food.js` (Food, Today rings), `quickadd.js` (the + sheet) and `ui.js`
(toast, haptics, celebrations). App data is stored on your device
(`localStorage`/IndexedDB). Two things use a server (Supabase, see
`supabase/`): the next 7 days of checklist items sync so `send-pings`
can notify you, and "Search online" goes through the `food-search`
function, which holds the USDA FoodData Central API key as a secret
(`supabase secrets set USDA_API_KEY=...`).

## Installing on iPhone

1. Open the app's URL in **Safari** (must be Safari, not Chrome, for
   iOS install support).
2. Tap the **Share** icon (square with an arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. A "Weight & Save" icon appears on your home screen and
   opens full-screen like a normal app.

## Local development

Serve the folder with any static file server, e.g.:

```
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

### Tests

```
python tests/run.py
```

Runs every `tests/*.test.html` page (schedule, taper, and food math)
in headless Edge and prints `N/M passed` per page. Needs only Python
and Microsoft Edge.

Click-through UI tests (real app at iPhone width, with a screenshot of
where each script ends):

```
python .claude/skills/phone-preview/preview.py --interact tests/ui/food-flow.js --interact tests/ui/food-checkin.js --interact tests/ui/snacks-search.js --interact tests/ui/online-search.js --interact tests/ui/snack-ideas.js --interact tests/ui/feel-checkin.js --interact tests/ui/processing.js --interact tests/ui/water-pouches.js --interact tests/ui/redesign.js
```

Add `--dark` to render in dark mode.

## Notes

- Weight is stored in lbs only for now.
- Data lives in the browser's local storage for this specific
  installed app — clearing Safari/site data will erase it. There is
  no backup/export yet.
- Push reminders repeat every 15 minutes until an item is checked
  off or skipped. Logging a meal checks its item off, so its pings
  stop.
