# Progress Log (Summary)

A readable rollup of [progress-log-detailed.md](progress-log-detailed.md).
Read this first for the big picture; go to the detailed log for exact
timestamps and per-commit elapsed time.

## 2026-08-27 — Built the app
Weight Tracker PWA built from scratch: log a weight entry with a date,
see history, see a trend line. Plain HTML/CSS/JS, no framework, data
in `localStorage`, installable on iPhone via Safari "Add to Home
Screen." Most of the session went into an iOS-specific bug: the
native date input kept overflowing its card no matter what CSS was
tried, eventually fixed by hiding the real input and showing a styled
div on top of it. Also switched the service worker to network-first
fetching so future edits don't need two relaunches to show up.

## 2026-09-09 — Redesign + Runs tab
Restyled the whole app with a Liquid-Glass-inspired look, then flipped
it to a light theme with a black accent (Nike-style). Added a second
tab, Runs: a live start/stop timer, tagged Run or Walk, with GPS-based
distance tracking and a real OpenStreetMap-based route map.

## 2026-09-13 — Bottom nav, rebrand to "Weight & Save"
Fixed a real bug where the route-map popup was rendering permanently
instead of only when opened (a CSS display:flex rule was silently
overriding the hidden attribute). Moved the tab switcher to a fixed
bottom nav bar. Renamed the app to "Weight & Save," added a literal
scale icon, a running-figure icon, and a custom hourglass app icon.

## 2026-10-06 — Progress photos, a real date bug, icon iteration
Added a Progress Photos section to the Weight tab (dated photos,
resized/compressed client-side, stored in IndexedDB, viewed in a
full-screen gallery). While wiring up the date field, found and fixed
a genuine bug affecting every date field in the app: the "default to
today" logic used `valueAsDate`, which interprets its value in UTC —
for anyone west of UTC, that could silently show tomorrow's date
during evening hours. Spent the rest of the session iterating on the
Runs tab icon (three full redesigns) based on screenshots, converging
on a dynamic sprinting-figure silhouette.

## 2026-10-06 (cont.) — Progress log + workflow setup
Set up this logging system itself: a detailed log (timestamped,
per-commit, with elapsed time) and this summary log, plus a
`CLAUDE.md` describing the workflow so it survives a context
clear/compact — any fresh session working in this repo reads the logs
first instead of needing the old conversation. Also established: get
explicit approval before every commit and push to this repo, going
forward (no more autocommitting).

## 2026-10-11 — Turning it into a personal coach (Phase 1, local)
After a long one-question-at-a-time interview (goals, schedule,
nicotine, food, training, basketball role), planned a phased rebuild
of the app into an accountability coach: daily schedule + pings + Zyn
taper first, then food tracking, then a basketball-focused training
program with an AI coach (Claude, $5/month hard cap), then weekly
insights. Shipped the local part of Phase 1: a **Today** tab (daily
checklist from a real weekly template, skip/miss reasons, per-day
edits, weigh-in that writes to the weight log, streak and sleep) and a
**Habits** tab (6-week Zyn taper, pouch counter, craving log with
trigger tips, progress stats). Schedule/taper logic sits in a
DOM-free `coach-core.js` so a server-side ping job can reuse it.
Tested in headless Edge (49 logic checks + a full UI click-through).
Push reminders are next and need a Supabase project.

Same session: added a project skill, `.claude/skills/phone-preview/`,
that serves the app, loads every tab in headless Edge at true iPhone
width (via a 390px iframe — headless Edge won't size a window below
~500px), reports JS errors, and screenshots each tab in one command.
Its first run caught an empty Progress card on the Habits tab before
a taper is started; that card and the "Change start date" link are
now hidden until a start date exists.

## 2026-10-12 — Push reminders go live (Phase 1 complete)
Sean set up a free Supabase project, and the app now sends real iPhone
push notifications. Every checklist item pings at its time and
repeats every 15 minutes for up to an hour (the point it shows as
Missed) until it's checked off or skipped, with nothing after 10:45
PM. The app stays the source of truth: whenever the checklist
changes, it writes the next 7 days of items and their status to
Supabase, and a `send-pings` Edge Function, run by `pg_cron` every
minute, sends whatever is due. Several items due in the same minute
are combined into one notification. Sign-in is anonymous (one hidden
account per installed app), because magic links on iOS open in Safari
instead of the installed app. RLS keeps the rows private. The schema,
function, and cron job live in `supabase/`; secrets are held only in
Supabase (Vault and function secrets) and the Supabase CLI is
installed at `~/bin/supabase.exe` for redeploys. Also fixed a
recurring CSS bug for good: a global `[hidden] { display: none
!important }`, after finding that the previous session's "hide Change
start date" fix had been silently overridden by `.link-btn`'s
`display: block`.

Confirmed on Sean's iPhone the same day: turning reminders on and
sending a test ping delivered a real notification to the installed
app.

## 2026-10-13 — Food tab (Phase 2a)
Planned Phase 2 through a detailed Q&A (goal, logging effort, which
numbers matter, where Sean actually eats, exact shake/meal-prep
recipes, weekend drinking) and split it in two: 2a ships now, barcode
scanning and food search come in 2b. The Q&A surfaced the key fact
the tab is built to test: planned meals only add up to about 1,900
kcal on a lift day against roughly 3,050 maintenance, so either
off-plan eating fills a 1,000+ kcal gap or Sean under-eats on
weekdays. Meal items on Today now log their planned meal in one tap
(which also stops their pings), and a new 9:30 PM "Close food log"
item marks the day as fully logged. The new **Food** tab tracks
calories against a weekly budget that banks extra for Saturday and
Sunday, scores protein, fiber, added sugar, sodium and alcohol, and
offers quick add, S/M/L takeout estimates, chain items and one-tap
drinks. The first 14 days are "Discovery" (measure, don't judge).
After that, a weekly check-in estimates real maintenance from
fully-logged days plus the weight trend and proposes a capped change
for Sean to accept or keep. The math is in a DOM-free `food-core.js`.
The repo now has a `tests/` folder (`python tests/run.py`, 124 checks,
including the old schedule tests rescued from a scratchpad). The
approved design spec is in `docs/superpowers/specs/`.

Same session: extended the `phone-preview` skill with `--interact`
click-through scripts (committed in `tests/ui/`), then acted on Sean's
ask that every time he's supposed to eat he gets a reminder he can log
from. Added weekday mid-morning and afternoon snacks, a lift-day
evening snack, and a Sunday afternoon snack. Tapping a meal or snack
reminder now opens the app straight into that item's log panel. The
food picker opens on a search box that ranks foods Sean has logged
before ahead of saved meals, foods, chains, and takeout. Online search
(USDA FoodData Central, via a Supabase function so the API key stays
secret) is next, waiting on Sean's free api.data.gov key. Open Food
Facts was checked and ruled out for now: its search API doesn't allow
browser requests (no CORS) and many entries lack serving sizes.

Online search followed the same night: Sean got a free api.data.gov
key, which lives only as a Supabase secret behind a new `food-search`
Edge Function (the repo is public). "Search online" in the food picker
queries USDA FoodData Central: generic foods and branded products are
searched separately, because mixed together brand searches drowned in
generic results. Picked results log with label per-serving numbers and
are saved to My foods. The gateway's `verify_jwt` turned out to let the
public publishable key through, so the function checks for a real
session itself.

Then snack ideas: every snack item's panel lists 2–3 alternatives with
exact portions ("1 slice whole-wheat bread · 2 tbsp peanut butter · 1
banana · 377 kcal · 12 g P"), chosen by the kind of day the schedule
says it is (game, lift, rest) with a one-line fueling tip. The 15 new
foods behind them come from USDA entries looked up with Sean's key.
Portion text is generated from each idea's servings, so editing an
idea under Targets keeps it accurate. Then, at Sean's request, a
quick "how did it go?" check-in that opens when a game or lift is
checked off (energy, stomach, legs, shooting / weights moved, note).
Each one is saved with what he ate in the 4 hours before, and a "Fuel
vs feel" card on the Food tab lines foods up against how the sessions
went once there are 3+ check-ins: the data for adjusting snacks (and
later for the AI coach).

## 2026-10-14 — Mostly natural: ultra-processed tracking
After Sean said he wants food as natural as possible (processed food
reduced, not banned), every food is now tagged
Whole / Processed / Ultra (NOVA-style) and Health signals show the
ultra-processed share of the day's calories against a 20% target.
Online results are tagged from their USDA ingredient lists (additives
like isolates, corn syrup, sweeteners, gums, or a long list = ultra).
The whey shake counts as processed on the assumption of a cleaner
powder, with a one-tap option to count it as ultra. Snack ideas were
swapped to whole-food versions (dates + banana, almonds + raisins,
eggs + apple, milk + banana, natural PB on simple bread), and a test
keeps ultra-processed foods out of them.

Later the same night, a batch of quick fixes. Water tracking landed on
the Today tab: one-tap +8 / +20 / +40 oz buttons (sized for Sean's
40 oz tumbler) against a goal of half his bodyweight in ounces, plus 20
oz on lift days and 32 on game days, all editable under Targets. The
Habits tab got a "Today's pouches" card: when each pouch happened, the
gap since the one before it (the first of the day counts from last
night's), a live "last pouch X ago" line, and a remove button per
entry. Oikos Pro was corrected to the vanilla label Sean actually buys
(¾ cup, 160 kcal, 23 g protein), and because vanilla contains stevia
and flavors it now counts as ultra-processed. Sean chose to keep it in
his plans anyway. A new seed `rev` field lets a corrected label reach
installed copies, since stored values normally win. The food search
sheet now sits above the iPhone keyboard instead of behind it; that
fix couldn't be tested headless and needs an on-phone check. Also
deleted four leftover anonymous test users in Supabase Auth.

Then Sean's usual Chipotle order became a one-tap saved meal, "My
Chipotle order": a pollo asado bowl (white rice, fajitas, sour cream,
cheese, lettuce, green and corn salsa) plus chili lime chips and queso,
about 1,520 kcal and 65 g protein. The numbers come from Chipotle's
official US per-ingredient chart. Pollo asado and the chips are 2026
limited-time items without published macros, so they are estimates.
Chipotle bowls now count as processed (cooked in-store from simple
ingredients), while the burrito stays ultra for its commercial tortilla.

Last, the start of a full redesign. Sean wanted the app to look and
work like modern food, weight and habit trackers while keeping the
Liquid Glass look, and answered a one-at-a-time Q&A. The approach mixes
what research supports: logging often matters most, so logging is made
fast; progress toward goals is shown as rings; weight trends will be
smoothed. Step 1 shipped: a new design with white cards on a gray page
(black in dark mode, following the iPhone setting), one color per area,
and glass on the floating chrome. The five tabs became four in a
floating glass bar (Today, Food, Progress, Train), with Weight and
Habits under Progress and Runs under Train, plus a separate + button
that logs anything from any tab (one-tap water and pouches, food,
weigh-in, craving, start a run, progress photo) and suggests the most
likely log right now. Today opens on four rings (calories, protein,
water, pouches) that open detail drawers when tapped. Quick logs show
an Undo toast, and closing the protein or water ring plays a small
celebration once a day. Next: Food, then Progress (charts, badges,
streak freeze for the taper), then Train, each checked on Sean's phone
in turn. Sean also asked for full gamification (streaks, badges,
milestones), which comes with Progress.

## 2026-10-15 / 10-21 — Feedback batch 1 planned; data loss explained
After a day of using the redesign, Sean sent feedback: log several
foods at once, swipe sheets closed, split the food log into
Breakfast/Lunch/Dinner/Snacks, timestamps on everything, more
restaurant foods (Chick-fil-A large fries were missing), bring back
Zyn savings (widened to general savings: Zyn, alcohol, eating out,
energy drinks, with Sean's real baselines), and water reminders. He
also reported that all his data kept disappearing. The cause: updates
often didn't show up on reopen (GitHub Pages' 10-minute file cache,
no reload when a new version installs, and iOS resuming rather than
relaunching the app), so he deleted and re-added the home-screen icon,
and iOS deletes an installed web app's storage along with its icon.
The lost data isn't recoverable. The approved spec
(`docs/superpowers/specs/2026-10-15-feedback-batch-1-design.md`) puts
the fix first: updates that always arrive, plus automatic cloud backup
with a restore code and a file export. On 10-21 Sean's sprained ankle
turned out to be an avulsion fracture (brace 6 weeks, no basketball,
lifting allowed, recheck Dec 7), so an Injury mode was added as step
0.5: games and runs paused, an ankle-safe leg day, and an ankle pain
question after lifts. Restaurant data will come from testing two free
databases (FatSecret Basic, Spoonacular Free) once Sean has keys.
Nothing is built yet; the implementation plan is next.
