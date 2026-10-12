---
name: phone-preview
description: Use when a change to the Weight & Save PWA (index.html, app.js, coach.js, coach-core.js, style.css) needs to be seen or checked before committing, when asked to run, preview, or screenshot the app, or when checking it for JavaScript errors or iPhone-width layout problems.
---

# Phone preview

## Overview
One command serves the repo, loads every tab in headless Microsoft Edge at true iPhone width (390px), reports JavaScript errors raised during load, and saves a screenshot per tab. Exit code 0 = every tab loaded clean; 1 = something failed.

## Quick reference

| Goal | Command (from repo root) |
|---|---|
| All tabs, first-launch state | `python .claude/skills/phone-preview/preview.py` |
| Specific tabs | `... --tabs today-panel,habits-panel` |
| Screenshots in a known folder | `... --out <scratchpad>/preview` |
| Preloaded app state | `... --seed seed.json` (JSON of localStorage key → value) |
| Taller page | `... --height 2600` |

After it runs, **Read each screenshot** and look at it: clipped text, overflow, empty cards, overlapping elements. A clean exit code only proves no JS errors.

## Seeding state
Each run uses a fresh browser profile, so the app opens as a first launch. To preview a populated screen, seed localStorage with the app's real keys (`coach-taper-start`, `coach-habit-log`, `coach-checkins`, `coach-overrides`, `weight-tracker-entries`, `weight-tracker-runs`). Non-string values are JSON-encoded for you:

```json
{"coach-taper-start": "2026-10-05",
 "coach-habit-log": [{"id": "a", "at": 0, "date": "2026-10-11", "type": "pouch"}]}
```

## Common mistakes
- **Screenshotting with `--window-size=390` directly.** Headless Edge has a ~500px minimum window, so the page renders at 500px and the right edge is cropped. That's why the script renders inside a 390px iframe. The gray strip on the right of each screenshot is padding, not the app.
- **Reading "Missed" tags as a bug.** Items scheduled before the coach's first launch never show as missed, but seeded `coach-started-at` values or late-night runs can legitimately show them.
- **Relying on Node.** This machine has no Node/npx; the script needs only Python and Edge.
- **Interaction testing.** The script checks load + layout only. For click-through tests, write a same-origin harness page that drives the app in an iframe (pattern: serve repo, iframe `index.html`, click via `contentDocument`, print results into a `<pre>`, read with `--dump-dom`).
