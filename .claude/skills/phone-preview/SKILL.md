---
name: phone-preview
description: Use when a change to the Weight & Save PWA (index.html, app.js, coach.js, coach-core.js, food.js, style.css) needs to be seen or checked before committing, when asked to run, preview, or screenshot the app, when checking it for JavaScript errors or iPhone-width layout problems, or when a feature needs a click-through test or a screenshot of an open panel, sheet, or other interactive state.
---

# Phone preview

## Overview
One command serves the repo and drives headless Microsoft Edge at true iPhone width (390px). Two modes:
- **Tab smoke test (default):** loads every tab, reports JS errors raised during load, and screenshots each tab.
- **Click-through (`--interact`):** runs a JS script against the live app, reports its PASS/FAIL checks, and screenshots the state the script ends in, such as an open meal panel or sheet.

Exit code 0 = clean; 1 = a JS error, a failed check, or a page that never reported.

## Quick reference

| Goal | Command (from repo root) |
|---|---|
| All tabs, first-launch state | `python .claude/skills/phone-preview/preview.py` |
| Specific tabs | `... --tabs today-panel,food-panel` |
| Screenshots in a known folder | `... --out <scratchpad>/preview` |
| Preloaded app state | `... --seed seed.json` (JSON of localStorage key → value) |
| Taller page | `... --height 2600` |
| Click-through tests | `... --interact tests/ui/food-flow.js --interact tests/ui/food-checkin.js` |
| Long script ran out of time | `... --budget 20000` (virtual ms per page, default 10000) |
| Dark mode | `... --dark` (prefers-color-scheme: dark) |

After it runs, **Read each screenshot** and look at it: clipped text, overflow, empty cards, overlapping elements. A clean exit code only proves no JS errors and passing checks.

## Click-through scripts
A script is the body of an async function, run after the app loads. It starts on `--tabs`' first tab (default `today-panel`) with the `--seed` state. Committed scripts live in `tests/ui/`.

| Helper | Does |
|---|---|
| `await reload(seed, tabId?, query?)` | Wipe storage, apply a seed, reload the app (`query` like `"item=lunch"` is added to its URL). Use at the top to set state. |
| `$(sel, root?)` / `$$(sel, root?)` | Query the app document (`$$` returns an array) |
| `click(selOrEl, root?)` | Click; throws if nothing matches |
| `clickText(text, root?)` / `byText(text, root?)` | Click / find the element whose whole text is `text` |
| `item(title)` | Today checklist `<li>` by its title |
| `fill(selOrEl, value)` | Set a value and fire input + change |
| `tab(panelId)` | Tap a bottom-nav tab (`today-panel`, `food-panel`, `progress-panel`, `train-panel`) |
| `ls(key)` | Parsed app localStorage value |
| `eq(name, got, want)` / `check(name, cond, info?)` | Record PASS/FAIL |
| `today`, `day(offset)` | `YYYY-MM-DD` strings in local time |
| `app()`, `doc()`, `wait(ms)` | App window / document, sleep |

```js
await reload({ "coach-started-at": "0" });
click(".check-box", item("Protein shake"));
clickText("As planned", item("Protein shake"));
eq("logged", ls("food-log").length, 1);
```

Scope `clickText` to a root (`item(...)`, `$("#food-sheet-body")`) whenever the same label appears more than once. Forms: `fill(...)` then `$("form").requestSubmit()`.

## Seeding state
Each run uses a fresh browser profile, so the app opens as a first launch. Seed localStorage with the app's real keys, e.g. `coach-taper-start`, `coach-habit-log`, `coach-checkins`, `coach-overrides`, `coach-started-at`, `weight-tracker-entries`, `food-log`, `food-settings`, `food-days`. Non-string values are JSON-encoded for you:

```json
{"coach-taper-start": "2026-10-05",
 "coach-habit-log": [{"id": "a", "at": 0, "date": "2026-10-11", "type": "pouch"}]}
```

## Common mistakes
- **Hand-writing an iframe harness and server for a click-through.** Use `--interact`. It already handles same-origin serving, UTF-8, error capture, seeding, and the final screenshot.
- **Screenshotting with `--window-size=390` directly.** Headless Edge has a ~500px minimum window, so the page renders at 500px and the right edge is cropped. That's why everything renders inside a 390px iframe; the gray strip on the right is padding.
- **Reading "Missed" tags as a bug.** Items scheduled before the coach's first launch never show as missed, but seeded `coach-started-at` values (like `"0"`) or late-night runs legitimately show them.
- **Assuming a weekday.** Scripts run on the real date, and the schedule differs by day (game vs lift days, weekend lunch has no planned meal). Branch on `item(...)` existing instead of assuming.
- **Relying on Node.** This machine has no Node/npx; the script needs only Python and Edge.
