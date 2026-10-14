# Weight & Save

An installable PWA that's growing into a personal accountability
coach. Five tabs:

- **Today** — a daily checklist built from a weekly schedule (wake,
  weigh-in, meals, lifts, league games, wind-down, lights out). Check
  items off, skip or explain misses with a reason, and edit a single
  day's plan without changing the weekly template. Shows completion,
  streak, last night's sleep, and today's Zyn count. Meal items log
  their planned meal in one tap ("As planned") or open the food picker.
- **Food** — calories and protein against a weekly budget with a
  weekend bank, health signals (fiber, added sugar, sodium, alcohol),
  quick add, S/M/L takeout estimates, chain items, one-tap drinks, and
  a weekly check-in that proposes a new maintenance estimate from
  logged intake + weight trend (you approve it). The first 14 days are
  "Discovery": numbers show but nothing is judged.
- **Habits** — a 6-week Zyn taper (fewer pouches, then 3 mg, then a
  quit date), a pouch counter against the day's allowance, a craving
  log with triggers and replacement tips, and progress stats.
- **Weight** — weight entries, trend line, progress photos.
- **Runs** — live timer, GPS distance, route map.

Schedule/taper rules live in `coach-core.js` and food math in
`food-core.js` (no DOM, testable on their own); seed foods and meals
are in `food-data.js`; the UI is `coach.js` (Today/Habits) and
`food.js` (Food). App data is stored on your device
(`localStorage`/IndexedDB). Only push reminders use a server: the
next 7 days of checklist items sync to Supabase so `send-pings` can
notify you (see `supabase/`).

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

## Notes

- Weight is stored in lbs only for now.
- Data lives in the browser's local storage for this specific
  installed app — clearing Safari/site data will erase it. There is
  no backup/export yet.
- Push reminders repeat every 15 minutes until an item is checked
  off or skipped. Logging a meal checks its item off, so its pings
  stop.
