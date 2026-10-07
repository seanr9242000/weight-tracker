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
