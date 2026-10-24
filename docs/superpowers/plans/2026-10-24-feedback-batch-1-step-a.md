# Feedback batch 1, step A: swipe-to-close, timestamps, Chick-fil-A items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every sheet closes with a downward swipe, every logged entry shows the time it happened (food times are editable), and the Chick-fil-A menu Sean orders from is in the food library with official numbers. Ships as v33.

**Architecture:** One `attachSwipeClose(sheet, opts)` helper in `ui.js` (Pointer Events plus a non-passive `touchmove` guard for iOS), attached to the three sheets by the files that own them. Pure clock-time helpers (`clockTime`, `timeOnDate`, `timeInputValue`, `atOnDate`) go in `coach-core.js`, which loads before every UI file and is unit-tested. Every list that shows entries calls `timeOnDate(at, date)`. New weigh-ins store `at` and new runs store `startedAt`. The Chick-fil-A items are seed rows in `food-data.js`. Corrections to existing rows go through the seed `rev` mechanism in `food.js` `mergeSeed`, which now keeps a processing tag Sean set himself.

**Tech Stack:** Plain HTML/CSS/JS, no build, no Node. Logic tests: `python tests/run.py` (headless Edge runs `tests/*.test.html`). UI tests: `python .claude/skills/phone-preview/preview.py --interact tests/ui/<name>.js` (light, and again with `--dark`).

**Spec:** `docs/superpowers/specs/2026-10-15-feedback-batch-1-design.md`, sections A1, A2, A3, "Order and verification", and "Out of scope".

## Global Constraints

- Read `CLAUDE.md` and `.claude/skills/phone-preview/SKILL.md` first.
- **Commits:** ask Sean before every `git commit` and `git push`, unless he has approved per-task commits for this plan. Push always needs his yes. Implementers don't touch the progress logs. Task 6 writes them.
- **Cache:** `sw.js` `CACHE_NAME` and `version.js` `APP_VERSION` move together to **33** in Task 1. Leave them alone after that, because the whole step ships as one deploy. No new files are added to the app, so `sw.js` `ASSETS` stays the same. `tests/run.py` static checks enforce both.
- **Line endings:** keep each file's own. CRLF: `index.html`, `style.css`, `app.js`, `coach-core.js`, `coach.js`, `food-data.js`, `food.js`, `quickadd.js`, `sw.js`, `version.js`. LF: `ui.js`. New test files: match their neighbors.
- **Style:** short `/* */` why-comments, the `el()`, `loadJSON` and `saveJSON` helpers (coach.js), `showToast`, and no new globals beyond the names listed in each task's Interfaces.
- **Time format (spec A2):** "8:42 AM": hour without a leading zero, a regular space, then AM or PM.
- **Spec A2:** "Changing the time never changes the entry's date." Other entry types stay display-only.
- **Spec A1 thresholds:** close past **1/3 of the sheet's height**, or on a flick faster than **0.5 px/ms**. Downward drags only. The backdrop fades with the drag.
- **Spec A3:** `group: "chain"`, `confidence: "exact"` where the numbers come from the official page, and a processing tag of ultra or processed under the existing rules. Existing items are corrected through the seed `rev` field.
- The browser in tests is the real date and weekday; never assume a day type.

## Decisions beyond the spec (confirm with Sean when he reviews this plan)

1. **Tray-related parts of A wait for B1.** The tray (multi-add) doesn't exist yet, so "the tray survives a close" and the tray's "Ate at" field land with B1. A1's helper only calls each sheet's existing close function and clears no state.
2. **Only the + sheet has a backdrop to fade.** The food sheet and the skip-reason sheet have no scrim today, and step A doesn't add one, since a scrim would change what taps behind them do.
3. **A flick must also travel at least 24 px.** A fast 5 px twitch shouldn't close a sheet.
4. **Times show only when the timestamp falls on the entry's own date.** A weigh-in or run logged later for an earlier day shows only its date, never a misleading time.
5. **Cravings get a "today" list** in the Craving card on Habits ("8:15 PM · Stress · urge 4/5 · resisted"). No craving list existed before.
6. **The water drawer gets a list of today's water** with times ("7:05 AM · 8 oz"), using the same row style as Today's pouches.
7. **Runs store `startedAt`** (new field, taken from the timer's start). Old runs show their date only.
8. **Chick-fil-A sizes.** Fries S/M/L, lemonade S/M/L, sweet tea S/M/L, mac & cheese S/M (there is no large), a medium fruit cup, regular hash browns, 4-ct Chick-n-Minis, and the six sauces at 1 packet each. The official page has no added-sugar column, so `addedSugar` is estimated with one rule: all of the sugar for sauces and drinks; none for fruit, potato and mac & cheese; and sugar minus 1 g for breaded or bun items.
9. **The five existing Chick-fil-A items get `rev: 1`** and become "exact". Only the Chicken Sandwich's numbers change (fat 18 → 16 g, sodium 1460 → 1470 mg). The nuggets' added sugar follows the rule above (1 → 0 g). Past log entries keep their own copy and don't change.
10. **A `rev` bump keeps a processing tag Sean set himself.** The retag chips now mark the food `processingSet: true`, and `mergeSeed` keeps that tag through a correction. Before this change, a correction would quietly reset his choice.
11. **Times are formatted by hand, not with `toLocaleTimeString`.** Newer Edge and Safari put a narrow no-break space before AM. Today's pouches switch to the same helper so every list matches.
12. **A cleared time field keeps the old time.** The servings still save.
13. **The fruit cup is tagged "whole".** The spec says Chick-fil-A items get "ultra or processed", but it also says "same rules as the existing items", and under those rules plain cut fruit is whole (like the seeded apple and strawberries). Lemonade and sweet tea are "processed"; everything else is "ultra".

## Review Focus

1. **iOS takes over a drag.** If Safari starts a native scroll it fires `pointercancel`. The sheet must spring back, with no leftover offset or half-faded scrim. Pinned in Task 2 ("pointercancel springs back").
2. **A drag that starts on a button.** Dragging a sheet closed from a water button, a chip, or a food row must not also press it, because the release fires a click. A normal tap afterward still works. Pinned in Task 2 ("drag on a button doesn't log it", "a tap after a drag still works").
3. **Drags that start on a control.** Dragging the urge slider or a text field must move that control, not the sheet. Pinned in Task 2 ("slider drag leaves the sheet").
4. **Food time edits at the edges.** A blank field, 23:59 and 00:00 must all keep the entry on its own date, and the log must re-sort by the new time. Pinned in Task 1 (`atOnDate` edges) and Task 3 (UI).
5. **A sheet reopened after a swipe close.** It must look normal: no inline transform, opacity or animation left behind, and the scrim back at full strength. Pinned in Task 2 ("reopens clean").

---

## Pre-flight

- [ ] `git status`: clean, on `main` at `50175e4` or later, and up to date with `origin/main`.
- [ ] `python tests/run.py`: every page `N/N passed`, exit code 0.
- [ ] `git switch -c batch1-stepA`

---

### Task 1: Clock-time helpers (and v33)

**Files:**
- Modify: `coach-core.js` (add helpers after `formatGap`, about line 316; add names to `module.exports` at the end)
- Modify: `version.js` (`APP_VERSION = 33`), `sw.js` line 1 (`weight-tracker-v33`)
- Test: `tests/coach-core.test.html`

**Interfaces:**
- Consumes: `toDateString(date)` and `parseLocalDate(dateStr)` (coach-core.js:123-130).
- Produces (all global, pure):
  - `clockTime(at: number) -> string`: "8:42 AM".
  - `timeOnDate(at: number|undefined|null, dateStr: string) -> string`: `clockTime(at)` when `at` is a finite number on local day `dateStr`, else `""`.
  - `timeInputValue(at: number) -> string`: "08:42" (an `<input type="time">` value).
  - `atOnDate(dateStr: string, hhmm: string) -> number|null`: a timestamp at that time on that local day; `null` for a blank or invalid time.

- [ ] **Step 1: Write the failing tests.** Append inside `run(() => { ... })` in `tests/coach-core.test.html`, before its closing `});`:

```js
  // Clock times (step A2)
  const tAt = (date, hm) => new Date(`${date}T${hm}`).getTime();
  eq("clockTime morning", clockTime(tAt("2026-10-24", "08:42")), "8:42 AM");
  eq("clockTime noon", clockTime(tAt("2026-10-24", "12:05")), "12:05 PM");
  eq("clockTime after midnight", clockTime(tAt("2026-10-24", "00:07")), "12:07 AM");
  eq("clockTime evening", clockTime(tAt("2026-10-24", "21:30")), "9:30 PM");
  eq("timeOnDate same day", timeOnDate(tAt("2026-10-24", "07:05"), "2026-10-24"), "7:05 AM");
  eq("timeOnDate logged on a later day", timeOnDate(tAt("2026-10-24", "07:05"), "2026-10-22"), "");
  eq("timeOnDate missing at", timeOnDate(undefined, "2026-10-24"), "");
  eq("timeOnDate null at", timeOnDate(null, "2026-10-24"), "");
  eq("timeOnDate NaN at", timeOnDate(NaN, "2026-10-24"), "");
  eq("timeInputValue pads", timeInputValue(tAt("2026-10-24", "08:04")), "08:04");
  eq("atOnDate", atOnDate("2026-10-24", "12:05"), tAt("2026-10-24", "12:05"));
  eq("atOnDate 23:59 keeps the date", toDateString(new Date(atOnDate("2026-10-24", "23:59"))), "2026-10-24");
  eq("atOnDate 00:00 keeps the date", toDateString(new Date(atOnDate("2026-10-24", "00:00"))), "2026-10-24");
  eq("atOnDate accepts seconds", atOnDate("2026-10-24", "08:42:00"), tAt("2026-10-24", "08:42"));
  eq("atOnDate blank", atOnDate("2026-10-24", ""), null);
  eq("atOnDate undefined", atOnDate("2026-10-24", undefined), null);
  eq("atOnDate out of range", atOnDate("2026-10-24", "25:00"), null);
  eq("time round trip", atOnDate("2026-10-24", timeInputValue(tAt("2026-10-24", "17:45"))), tAt("2026-10-24", "17:45"));
```

- [ ] **Step 2: Run, expect failures.** `python tests/run.py`. Expected: coach-core shows `ERROR ReferenceError: clockTime is not defined`, and the exit code is 1.

- [ ] **Step 3: Implement.** In `coach-core.js`, after `formatGap` and before `/* ---- Check-in stats ---- */`:

```js
/* ---- Clock times ---- */

/* A timestamp as "8:42 AM" in local time. Built by hand because newer
   toLocaleTimeString output puts a narrow no-break space before AM. */
function clockTime(at) {
  const d = new Date(at);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/* The clock time of `at`, but only when it falls on `dateStr`. An entry
   logged later for an earlier day, or one with no `at`, shows just its
   date rather than a misleading time. */
function timeOnDate(at, dateStr) {
  if (typeof at !== "number" || !Number.isFinite(at)) return "";
  return toDateString(new Date(at)) === dateStr ? clockTime(at) : "";
}

/* A timestamp as an <input type="time"> value, "08:42". */
function timeInputValue(at) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* "08:42" on `dateStr` -> a timestamp on that same local day, so editing
   a time never moves an entry to another date. null for a blank or
   invalid time; callers keep the old timestamp. */
function atOnDate(dateStr, hhmm) {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hhmm || "");
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const d = parseLocalDate(dateStr);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}
```

Add `clockTime, timeOnDate, timeInputValue, atOnDate,` to the `module.exports` object at the end of the file (on the `formatGap` line).

Then bump the version: in `version.js`, `const APP_VERSION = 33;`; in `sw.js` line 1, `const CACHE_NAME = "weight-tracker-v33";`.

- [ ] **Step 4: Run, expect pass.** `python tests/run.py`. Expected: static 4/4, coach-core all passed (69 + 18 = 87/87), every other page unchanged, exit code 0.

- [ ] **Step 5: Commit** (with approval):

```bash
git add coach-core.js tests/coach-core.test.html version.js sw.js
git commit -m "Step A: clock-time helpers (clockTime, timeOnDate, atOnDate), v33"
```

---

### Task 2: Swipe down to close (all three sheets)

**Files:**
- Modify: `ui.js` (append a "Swipe down to close" section)
- Modify: `quickadd.js` (attach after line 44's `qa-close` listener)
- Modify: `food.js` (attach after the `food-sheet-cancel` listener, about line 1317)
- Modify: `coach.js` (add `closeReasonSheet`, use it in both places that set `reasonSheet.hidden = true`, and attach)
- Modify: `style.css` (the "Sheets" section, about line 1382)
- Create: `tests/ui/swipe-close.js`

**Interfaces:**
- Consumes: `closeQuickAdd()` and `qaSheet`/`qaScrim` (quickadd.js), `closeFoodSheet()` and `foodSheet` (food.js), `reasonSheet` (coach.js:390).
- Produces:
  - `swipeShouldClose(dy: number, height: number, velocity: number) -> boolean` (ui.js, pure).
  - `attachSwipeClose(sheet: HTMLElement, { close: () => void, scroller?: HTMLElement, scrim?: HTMLElement|null }) -> void` (ui.js).
  - `closeReasonSheet() -> void` (coach.js).

- [ ] **Step 1: Write the failing UI test.** Create `tests/ui/swipe-close.js`:

```js
// Swipe down to close (step A1). The + sheet, the food sheet and the
// skip-reason sheet follow a downward drag. Past a third of their height,
// or on a flick, they close through their own close function; otherwise
// they spring back. Synthetic touch pointers stand in for a finger.
const PE = (type, target, y) => target.dispatchEvent(new (app().PointerEvent)(type, {
  bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: 120, clientY: y,
}));
/* Drags `target` through the dy offsets, one move every stepMs, then ends
   with `end` ("pointerup", "pointercancel", or null to keep holding). */
async function swipe(target, dys, stepMs = 100, end = "pointerup") {
  const y0 = target.getBoundingClientRect().top + 3;
  PE("pointerdown", target, y0);
  for (const dy of dys) {
    await wait(stepMs);
    PE("pointermove", target, y0 + dy);
  }
  if (end) PE(end, target, y0 + dys.at(-1));
}
/* 20 px every 100 ms = 0.2 px/ms, so only the distance decides. */
const slow = (to) => Array.from({ length: Math.ceil(to / 20) }, (_, i) => Math.min(to, (i + 1) * 20));
const qa = () => $("#quick-add");
const scrim = () => $("#qa-scrim");

const should = app().swipeShouldClose;
eq("rule: past a third", [should(101, 300, 0), should(99, 300, 0)], [true, false]);
eq("rule: flick", [should(30, 300, 0.6), should(30, 300, 0.4), should(10, 300, 2)], [true, false, false]);

await reload({ "coach-started-at": "0", "coach-injury": null });

// + sheet: a short slow drag follows the finger, then springs back.
click("#fab");
const h = qa().offsetHeight;
check("+ sheet has height", h > 200, h);
await swipe($(".sheet-handle", qa()), slow(h * 0.2), 100, null);
check("follows the finger", /^translateY\(\d+(\.\d+)?px\)$/.test(qa().style.transform), qa().style.transform);
const fade = Number(scrim().style.opacity);
check("scrim fades with the drag", fade > 0.5 && fade < 1, scrim().style.opacity);
PE("pointerup", $(".sheet-handle", qa()), 0);
await wait(300);
eq("short drag springs back", [qa().hidden, qa().style.transform, scrim().style.opacity], [false, "", ""]);

// Past a third closes, through closeQuickAdd.
await swipe($(".sheet-handle", qa()), slow(h * 0.5));
await wait(300);
eq("long drag closes", [qa().hidden, scrim().hidden, $("#fab").classList.contains("open")], [true, true, false]);

// Reopening looks normal: nothing left over from the drag.
click("#fab");
eq("reopens clean", [qa().hidden, qa().style.transform, qa().style.animation, scrim().style.opacity], [false, "", "", ""]);

// A quick flick closes even though it's short.
await swipe($(".sheet-handle", qa()), [30, 60], 16);
await wait(300);
eq("flick closes", qa().hidden, true);

// Upward drags are ignored.
click("#fab");
await swipe($(".sheet-title", qa()), [-20, -60, -100]);
await wait(300);
eq("upward drag ignored", [qa().hidden, qa().style.transform], [false, ""]);

// iOS cancelling the pointer mid-drag springs back instead of sticking.
await swipe($(".sheet-handle", qa()), slow(h * 0.5), 100, "pointercancel");
await wait(300);
eq("pointercancel springs back", [qa().hidden, qa().style.transform, scrim().style.opacity], [false, "", ""]);

// A drag that starts on a button closes the sheet without pressing it
// (the release fires a click right after pointerup).
const waterBtn = $(".qa-water-buttons button", qa());
await swipe(waterBtn, slow(h * 0.5));
waterBtn.click();
await wait(300);
eq("drag on a button doesn't log it", [qa().hidden, (ls("water-log") || []).length], [true, 0]);
click("#fab");
await wait(500);
$(".qa-water-buttons button", qa()).click();
eq("a tap after a drag still works", (ls("water-log") || []).length, 1);

// Dragging the urge slider moves the slider, not the sheet.
app().openQuickAdd("craving");
await swipe($("#urge-input"), slow(h * 0.5));
await wait(300);
eq("slider drag leaves the sheet", [qa().hidden, qa().style.transform], [false, ""]);
app().closeQuickAdd();

// Food sheet: closes from its title.
tab("food-panel");
click("#food-log-btn");
const fs = $("#food-sheet");
await swipe($("#food-sheet-title"), slow(fs.offsetHeight * 0.5));
await wait(300);
eq("food sheet closes from its title", fs.hidden, true);

// Inside the body a drag starts only when the body is scrolled to the top.
click("#food-log-btn");
clickText("Chains", $("#food-sheet-tabs"));
const body = $("#food-sheet-body");
body.style.flex = "none";
body.style.height = "60px"; // force a scrollable body
body.scrollTop = 40;
check("body scrolled", body.scrollTop > 0, body.scrollTop);
await swipe($(".pick-row", body), slow(fs.offsetHeight * 0.5));
await wait(300);
eq("scrolled body doesn't drag", [fs.hidden, fs.style.transform, (ls("food-log") || []).length], [false, "", 0]);
body.scrollTop = 0;
await swipe($(".pick-row", body), slow(fs.offsetHeight * 0.5));
await wait(300);
eq("body at top drags closed, logs nothing", [fs.hidden, (ls("food-log") || []).length], [true, 0]);
body.style.flex = "";
body.style.height = "";

// Skip-reason sheet.
tab("today-panel");
app().openReasonSheet(today, { id: "test-item", title: "Test item" }, false);
const rs = $("#reason-sheet");
await swipe($("#reason-sheet-title"), slow(rs.offsetHeight * 0.5));
await wait(300);
eq("reason sheet closes", rs.hidden, true);
eq("closing it records nothing", (ls("coach-checkins") || {})[`${today}|test-item`], undefined);
```

- [ ] **Step 2: Run, expect failure.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/swipe-close.js`. Expected: FAIL, because `should` is not a function (`swipeShouldClose` isn't defined yet), and exit code 1.

- [ ] **Step 3: Implement the helper.** Append to `ui.js` (LF line endings):

```js
/* ---- Swipe down to close ---- */

/* True when a downward drag of `dy` px, released at `velocity` px/ms,
   should close a sheet `height` px tall: past a third of it, or a flick
   that also travelled at least 24 px (so a twitch doesn't close it). */
function swipeShouldClose(dy, height, velocity) {
  return dy > height / 3 || (velocity > 0.5 && dy >= 24);
}

/* Lets a bottom sheet be dragged down to close. A drag can start on the
   handle or anything outside `scroller` (the header) at any time, but
   inside `scroller` only while it's scrolled to the top. Text fields,
   selects and sliders keep their own drags. The sheet follows the finger
   down (never up), `scrim` fades with it, and on release the sheet
   either closes through `close` or springs back. */
function attachSwipeClose(sheet, { close, scroller = sheet, scrim = null }) {
  let drag = null;
  let suppressClicksUntil = 0;

  const clearStyles = () => {
    sheet.style.transition = "";
    sheet.style.transform = "";
    if (scrim) {
      scrim.style.transition = "";
      scrim.style.opacity = "";
    }
  };

  const settle = (closing) => {
    sheet.style.transition = "transform 0.2s ease";
    if (scrim) scrim.style.transition = "opacity 0.2s ease";
    if (closing) {
      sheet.style.transform = `translateY(${sheet.offsetHeight + 40}px)`;
      if (scrim) scrim.style.opacity = "0";
      setTimeout(() => {
        close();
        clearStyles();
        sheet.style.animation = ""; // the next open plays its slide-up again
      }, 200);
    } else {
      sheet.style.transform = "";
      if (scrim) scrim.style.opacity = "";
      setTimeout(clearStyles, 220);
    }
  };

  sheet.addEventListener("pointerdown", (e) => {
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (e.target.closest("input, textarea, select")) return;
    const fromHeader = e.target.closest(".sheet-handle") || !scroller.contains(e.target);
    if (!fromHeader && scroller.scrollTop > 0) return;
    drag = { id: e.pointerId, y0: e.clientY, dy: 0, moving: false, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
  });

  sheet.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moving) {
      if (dy < -6) {
        drag = null; // upward: that's a scroll, not a close
        return;
      }
      if (dy < 6) return;
      drag.moving = true;
      // Inline transforms lose to a running animation; the open one is done.
      sheet.style.animation = "none";
      sheet.style.transition = "none";
      if (scrim) scrim.style.transition = "none";
      try {
        sheet.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-ended pointer; the sheet still gets events.
      }
    }
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.v = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;
    drag.dy = Math.max(0, dy);
    sheet.style.transform = `translateY(${drag.dy}px)`;
    if (scrim) scrim.style.opacity = String(Math.max(0, 1 - drag.dy / sheet.offsetHeight));
  });

  const end = (e, cancelled) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moving) return;
    // The release fires a click on whatever the drag started on; eat it.
    suppressClicksUntil = performance.now() + 400;
    // A finger that stopped before lifting isn't a flick.
    const v = e.timeStamp - d.lastT > 100 ? 0 : d.v;
    settle(!cancelled && swipeShouldClose(d.dy, sheet.offsetHeight, v));
  };
  sheet.addEventListener("pointerup", (e) => end(e, false));
  sheet.addEventListener("pointercancel", (e) => end(e, true));

  sheet.addEventListener("click", (e) => {
    if (performance.now() < suppressClicksUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* iOS hands a downward touch on a scroller at its top to native
     overscroll and cancels the pointer, unless the touchmove is
     cancelled. A drag only exists where closing is allowed, so cancel
     downward moves while one is live; upward ones still scroll. */
  sheet.addEventListener("touchmove", (e) => {
    if (drag && e.touches[0] && e.touches[0].clientY > drag.y0) e.preventDefault();
  }, { passive: false });
}
```

- [ ] **Step 4: Attach to the three sheets.**

`quickadd.js`, right after `document.getElementById("qa-close").addEventListener("click", closeQuickAdd);`:

```js
attachSwipeClose(qaSheet, { close: closeQuickAdd, scrim: qaScrim });
```

`food.js`, right after `document.getElementById("food-sheet-cancel").addEventListener("click", closeFoodSheet);`:

```js
attachSwipeClose(foodSheet, { close: closeFoodSheet, scroller: document.getElementById("food-sheet-body") });
```

`coach.js`: add `closeReasonSheet` after `openReasonSheet`. Use it in the reason-chip click handler (replace `reasonSheet.hidden = true;` there) and in the `reason-cancel` listener, then attach:

```js
function closeReasonSheet() {
  reasonSheet.hidden = true;
}

document.getElementById("reason-cancel").addEventListener("click", closeReasonSheet);
attachSwipeClose(reasonSheet, { close: closeReasonSheet });
```

- [ ] **Step 5: CSS.** In `style.css`, after the `.sheet-handle { ... }` rule:

```css
/* Drags on the handle and title move the sheet (attachSwipeClose), never
   the page; a sheet's chip row still scrolls sideways. */
.sheet-handle,
.sheet-title {
  touch-action: none;
}

.sheet .chip-row {
  touch-action: pan-x;
}

/* The handle is 5px tall; give the finger a bigger target. */
.sheet-handle {
  position: relative;
}

.sheet-handle::before {
  content: "";
  position: absolute;
  inset: -12px -60px;
}

.sheet,
.food-sheet-body {
  overscroll-behavior: contain;
}
```

- [ ] **Step 6: Run, expect pass.** First `python .claude/skills/phone-preview/preview.py --interact tests/ui/swipe-close.js`, then the same with `--dark`. Expected: all PASS, 0 JS errors. Then make sure the existing sheet flows still pass: `python .claude/skills/phone-preview/preview.py --interact tests/ui/food-flow.js --interact tests/ui/redesign.js --interact tests/ui/snacks-search.js --interact tests/ui/injury.js` (all PASS). Read the final screenshot.

- [ ] **Step 7: Commit** (with approval):

```bash
git add ui.js quickadd.js food.js coach.js style.css tests/ui/swipe-close.js
git commit -m "Step A1: swipe down to close the +, food and skip-reason sheets"
```

---

### Task 3: Food and water times (food times editable)

**Files:**
- Modify: `food.js`: `renderFoodLog` (about line 631), `openEditEntry` (about line 1263), `waterCell` (about line 491)
- Modify: `style.css` (after the `.weigh-inline input { ... }` rule, about line 1137; near the other water rules)
- Create: `tests/ui/timestamps.js`

**Interfaces:**
- Consumes: `timeOnDate`, `timeInputValue`, `atOnDate` (Task 1); `updateEntry(id, mutate)`, `waterLog()`, `fmt()` (food.js).
- Produces: `.water-times` list markup (`li > span.pouch-time + span.pouch-gap`) and the `input[type=time]` in the entry editor, both read by `tests/ui/timestamps.js`.

- [ ] **Step 1: Write the failing UI test.** Create `tests/ui/timestamps.js`:

```js
// Timestamps (step A2): times on food, water, pouches, cravings, weigh-ins
// and runs. Food times are editable and never move an entry's date.
const at = (date, hm) => new Date(`${date}T${hm}`).getTime();
const n = { kcal: 200, protein: 20, carbs: 10, fat: 5, fiber: 0, sugar: 0, addedSugar: 0, sodium: 0, alcohol: 0, upf: 0 };

await reload({
  "coach-started-at": "0", "coach-injury": null,
  "food-log": [
    { id: "f1", date: today, at: at(today, "08:42"), slot: "extra", name: "Eggs", servings: 1, n, confidence: "exact" },
    { id: "f2", date: today, at: at(today, "12:30"), slot: "extra", name: "Wrap", servings: 1, n, confidence: "estimate" },
  ],
  "water-log": [
    { id: "w1", date: today, at: at(today, "13:30"), oz: 20 },
    { id: "w2", date: today, at: at(today, "07:05"), oz: 8 },
    { id: "w0", date: day(-1), at: at(day(-1), "22:00"), oz: 40 },
  ],
}, "food-panel");

// Food log
const metas = () => $$("#food-log-list .food-entry-main .food-entry-meta").map((m) => m.textContent);
const names = () => $$("#food-log-list .food-entry-name").map((m) => m.textContent);
eq("food times", metas(), ["8:42 AM · Other", "12:30 PM · Other · estimate"]);

// Edit the time: same date, new time, and the log re-sorts.
const f1 = () => ls("food-log").find((e) => e.id === "f1");
const timeField = () => $("#food-sheet-body input[type=time]");
click(".food-entry");
eq("editor shows the time", timeField().value, "08:42");
fill(timeField(), "13:05");
$("#food-sheet-body form").requestSubmit();
eq("time saved, date and servings kept", [f1().at, f1().date, f1().servings], [at(today, "13:05"), today, 1]);
eq("log re-sorts by time", names(), ["Wrap", "Eggs"]);

// A late-night edit stays on the same day.
click($$(".food-entry")[1]);
fill(timeField(), "23:59");
$("#food-sheet-body form").requestSubmit();
eq("23:59 keeps the date", [f1().at, f1().date], [at(today, "23:59"), today]);

// A cleared time field keeps the old time; servings still save.
click($$(".food-entry")[1]);
fill(timeField(), "");
fill("#food-sheet-body input", "2");
$("#food-sheet-body form").requestSubmit();
eq("blank time keeps it", [f1().at, f1().servings], [at(today, "23:59"), 2]);

// Water drawer: today's water with times, oldest first.
tab("today-panel");
click('.ring-tile[data-ring="water"]');
const waterRows = () => $$(".water-times li").map((li) => [...li.children].map((c) => c.textContent));
eq("water times, today only", waterRows(), [["7:05 AM", "8 oz"], ["1:30 PM", "20 oz"]]);
clickText("+8 oz", $(".water-buttons"));
eq("new water gets a row", waterRows().length, 3);
check("new row has a clock time", waterRows().every((r) => /^\d{1,2}:\d{2} [AP]M$/.test(r[0])), waterRows());
```

- [ ] **Step 2: Run, expect failures.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/timestamps.js`. Expected: FAIL on "food times" (no time in the meta yet), on "editor shows the time" (`timeField()` is null, so the script throws), and so on. Exit code 1.

- [ ] **Step 3: Food log times.** In `renderFoodLog`, replace the `food-entry-meta` line with:

```js
    const when = timeOnDate(e.at, e.date);
    main.appendChild(el("div", "food-entry-meta", `${when ? `${when} · ` : ""}${titles[e.slot] || "Other"}${e.confidence !== "exact" ? " · estimate" : ""}`));
```

- [ ] **Step 4: Time field in the entry editor.** In `openEditEntry`, replace everything from `const form = el("form", "weigh-inline");` through `body.appendChild(form);` with the block below. The servings input stays first in the form, since `tests/ui/food-flow.js` fills `#food-sheet-body input`.

```js
  body.appendChild(el("div", "feel-label", "Servings · time eaten"));
  const form = el("form", "weigh-inline");
  const input = el("input");
  input.type = "number";
  input.inputMode = "decimal";
  input.step = "0.25";
  input.min = "0.25";
  input.value = entry.servings;
  input.setAttribute("aria-label", "Servings");
  const time = el("input");
  time.type = "time";
  time.value = typeof entry.at === "number" ? timeInputValue(entry.at) : "";
  time.setAttribute("aria-label", "Time eaten");
  const save = el("button", "pill-btn dark", "Save");
  save.type = "submit";
  form.append(input, time, save);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = parseFloat(input.value);
    if (!Number.isFinite(v) || v <= 0) return;
    // The time moves within the entry's own day; a blank field keeps it.
    const at = atOnDate(entry.date, time.value);
    updateEntry(entry.id, (x) => {
      x.servings = v;
      if (at !== null) x.at = at;
    });
  });
  body.appendChild(form);
```

- [ ] **Step 5: Water times.** In `waterCell`, after `cell.appendChild(buttons);` and before `return cell;`:

```js
  // Today's water with times, in the same row style as Today's pouches.
  const entries = waterLog().filter((e) => e.date === dateStr).sort((a, b) => a.at - b.at);
  if (entries.length) {
    const list = el("ul", "pouch-times water-times");
    for (const e of entries) {
      const row = el("li");
      row.appendChild(el("span", "pouch-time", timeOnDate(e.at, e.date) || "—"));
      row.appendChild(el("span", "pouch-gap", `${fmt(e.oz)} oz`));
      list.appendChild(row);
    }
    cell.appendChild(list);
  }
```

- [ ] **Step 6: CSS.** After the `.weigh-inline input { ... }` rule:

```css
.weigh-inline input[type="time"] {
  flex: 0 0 112px;
}
```

Next to the other water rules (search `.water-buttons`), add:

```css
.water-times {
  margin-top: 10px;
}
```

- [ ] **Step 7: Run, expect pass.** First `python .claude/skills/phone-preview/preview.py --interact tests/ui/timestamps.js --interact tests/ui/food-flow.js --interact tests/ui/water-pouches.js`, then the same with `--dark`. Expected: all PASS, 0 JS errors. Read the screenshots: the editor row (servings, time, Save) must fit at 390 px without clipping.

- [ ] **Step 8: Commit** (with approval):

```bash
git add food.js style.css tests/ui/timestamps.js
git commit -m "Step A2: times on food and water entries, editable food time"
```

---

### Task 4: Pouch, craving, weigh-in and run times

**Files:**
- Modify: `coach.js`: `renderPouchTimes` (about line 450), add `renderCravingTimes` and call it from `renderHabits`, plus the checklist weigh-in `entries.push` (about line 263)
- Modify: `index.html`: the Craving card (about line 346)
- Modify: `app.js`: the `#entry-form` submit (about line 285), `renderList` (about line 199), the run timer, save and list (about lines 446, 646, 665, 737)
- Modify: `quickadd.js`: the `#qa-weight` submit (about line 188)
- Modify: `style.css` (next to `.pouch-times`, about line 1231)
- Modify: `tests/ui/timestamps.js` (append)

**Interfaces:**
- Consumes: `clockTime`, `timeOnDate`, `capitalize` (coach-core.js); `HABIT_LOG_KEY`, `el`, `loadJSON` (coach.js).
- Produces: `renderCravingTimes() -> void` (coach.js); the `#craving-times` list; the weight entry field `at: number` (optional; new entries only); the run field `startedAt: number` (optional; new runs only).

- [ ] **Step 1: Write the failing tests.** Append to `tests/ui/timestamps.js`:

```js
// Pouches and cravings (Progress > Habits)
const cravingRows = () => $$("#craving-times li").map((li) => [...li.children].map((c) => c.textContent));
await reload({ "coach-started-at": "0", "coach-injury": null }, "habits-panel");
eq("no cravings today, no list", $("#craving-times").hidden, true);

await reload({
  "coach-started-at": "0", "coach-injury": null,
  "coach-habit-log": [
    { id: "p1", type: "pouch", date: today, at: at(today, "00:30") },
    { id: "c1", type: "craving", date: today, at: at(today, "20:15"), trigger: "stress", urge: 4, resisted: true },
    { id: "c2", type: "craving", date: today, at: at(today, "09:10"), trigger: "meal", urge: 2, resisted: false },
    { id: "c0", type: "craving", date: day(-1), at: at(day(-1), "21:00"), trigger: "boredom", urge: 3, resisted: true },
  ],
}, "habits-panel");
eq("pouch time format", $("#pouch-times .pouch-time").textContent, "12:30 AM");
eq("today's cravings, oldest first", cravingRows(),
  [["9:10 AM", "Meal · urge 2/5 · used a pouch"], ["8:15 PM", "Stress · urge 4/5 · resisted"]]);
app().openQuickAdd("craving");
click('#trigger-chips [data-trigger="boredom"]');
click("#craving-resisted-btn");
const fresh = cravingRows().find((r) => r[1] === "Boredom · urge 3/5 · resisted");
check("a new craving lists with a time", fresh && /^\d{1,2}:\d{2} [AP]M$/.test(fresh[0]), cravingRows());

// Weigh-ins: a time only when it was logged on that day; old ones date only.
const fd = (d) => app().formatDate(d);
await reload({
  "coach-started-at": "0", "coach-injury": null,
  "weight-tracker-entries": [
    { id: "e1", date: today, weight: 180, unit: "lbs", at: at(today, "07:05") },
    { id: "e2", date: day(-1), weight: 181, unit: "lbs" },
    { id: "e3", date: day(-2), weight: 182, unit: "lbs", at: at(today, "09:00") },
  ],
});
eq("weigh-in times", $$("#entry-list .entry-date").map((d) => d.textContent), [`${fd(today)} · 7:05 AM`, fd(day(-1)), fd(day(-2))]);

// All three weigh-in paths store a time.
const lastEntry = () => (ls("weight-tracker-entries") || []).at(-1);
app().openQuickAdd("weight");
fill("#qa-weight-input", "179.4");
$("#qa-weight").requestSubmit();
eq("quick-add weigh-in stores a time", typeof lastEntry().at, "number");
fill("#weight-input", "179.2");
$("#entry-form").requestSubmit();
eq("Weight form stores a time", [lastEntry().weight, typeof lastEntry().at], [179.2, "number"]);
await reload({ "coach-started-at": "0", "coach-injury": null });
click(".check-box", item("Weigh in"));
fill(".weigh-inline input", "178.8");
$(".weigh-inline").requestSubmit();
eq("checklist weigh-in stores a time", [lastEntry().weight, typeof lastEntry().at], [178.8, "number"]);

// Runs: start time on new runs; old runs show the date only.
await reload({
  "coach-started-at": "0", "coach-injury": null,
  "weight-tracker-runs": [
    { id: "r1", date: today, type: "run", durationSeconds: 1800, distanceMiles: 3, startedAt: at(today, "18:10") },
    { id: "r2", date: day(-3), type: "walk", durationSeconds: 1200, distanceMiles: 1 },
  ],
}, "train-panel");
const runMeta = () => $$("#run-list .entry-meta").map((m) => m.textContent);
check("run shows its start time", runMeta()[0].startsWith(`${fd(today)} · 6:10 PM · `), runMeta()[0]);
check("old run shows the date only", runMeta()[1].startsWith(`${fd(day(-3))} · `) && runMeta()[1].split(" · ").length === 2, runMeta()[1]);

// A resumed run keeps its real start through Stop and Save.
const started = Date.now() - 20 * 60000;
await reload({ "coach-started-at": "0", "coach-injury": null, "weight-tracker-active-run": { startedAt: started, type: "run", path: [] } }, "train-panel");
click("#timer-btn"); // Stop
fill("#run-distance-input", "2");
$("#run-save-form").requestSubmit();
eq("saved run keeps its start", (ls("weight-tracker-runs") || []).at(-1).startedAt, started);
```

- [ ] **Step 2: Run, expect failures.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/timestamps.js`. Expected: Task 3's checks still pass, and the new ones fail (`#craving-times` missing, so `.hidden` throws). Exit code 1.

- [ ] **Step 3: Pouches use `clockTime`.** In `renderPouchTimes`, replace the `toLocaleTimeString` line with:

```js
    const time = clockTime(p.at);
```

- [ ] **Step 4: Craving list.** In `index.html`, in the Craving card, after the `open-craving-btn` button:

```html
          <ul class="pouch-times craving-times" id="craving-times" hidden></ul>
```

In `coach.js`, after `renderPouchTimes`:

```js
/* Today's cravings with their times, oldest first. */
function renderCravingTimes() {
  const list = document.getElementById("craving-times");
  const today = todayLocalDateString();
  const cravings = loadJSON(HABIT_LOG_KEY, [])
    .filter((l) => l.type === "craving" && l.date === today)
    .sort((a, b) => a.at - b.at);
  list.innerHTML = "";
  list.hidden = !cravings.length;
  for (const c of cravings) {
    const row = el("li");
    row.appendChild(el("span", "pouch-time", clockTime(c.at)));
    row.appendChild(el("span", "pouch-gap",
      `${c.trigger ? capitalize(c.trigger) : "Craving"} · urge ${c.urge}/5 · ${c.resisted ? "resisted" : "used a pouch"}`));
    list.appendChild(row);
  }
}
```

In `renderHabits`, call it right after `renderPouchTimes();`, before the `if (!start) return;`, so it shows without a taper too:

```js
  renderCravingTimes();
```

In `style.css`, after the `.pouch-gap` rule:

```css
.craving-times {
  margin-top: 10px;
}
```

- [ ] **Step 5: Weigh-ins store and show `at`.**
  - `app.js` `#entry-form` submit: add `at: Date.now(),` to the pushed object, after `unit: "lbs",`.
  - `quickadd.js` `#qa-weight` submit: `entries.push({ id, date: today, weight, unit: "lbs", at: Date.now() });`
  - `coach.js` checklist weigh-in: `entries.push({ id: newId(), date: dateStr, weight, unit: "lbs", at: Date.now() });`
  - `app.js` `renderList`: replace `dateSpan.textContent = formatDate(entry.date);` with:

```js
    // Only weigh-ins logged on their own day have a time worth showing.
    const time = timeOnDate(entry.at, entry.date);
    dateSpan.textContent = time ? `${formatDate(entry.date)} · ${time}` : formatDate(entry.date);
```

- [ ] **Step 6: Runs store and show `startedAt`.** In `app.js`:
  - After `let stoppedDurationSeconds = 0;`, add `let stoppedStartedAt = null;`.
  - In the timer button's Stop branch, after `const active = readActiveRun();`, add `stoppedStartedAt = active ? active.startedAt : null;`.
  - In `enterIdleState`, add `stoppedStartedAt = null;` next to `currentPath = [];`.
  - In the `runSaveForm` submit, after the `run` object is built (before `if (currentPath.length > 1)`), add `if (stoppedStartedAt) run.startedAt = stoppedStartedAt;`.
  - In `renderRunList`, replace the `metaSpan.textContent` line with:

```js
    const time = timeOnDate(run.startedAt, run.date);
    metaSpan.textContent = `${formatDate(run.date)}${time ? ` · ${time}` : ""} · ${formatPace(run.durationSeconds, run.distanceMiles)}`;
```

- [ ] **Step 7: Run, expect pass.** First `python .claude/skills/phone-preview/preview.py --interact tests/ui/timestamps.js --interact tests/ui/water-pouches.js --interact tests/ui/updates.js --interact tests/ui/injury.js`, then the same with `--dark`. Expected: all PASS, 0 JS errors. The run checks need Leaflet from cdnjs (the network), the same as the live app. Then `python .claude/skills/phone-preview/preview.py --tabs progress-panel,train-panel` and read both screenshots.

- [ ] **Step 8: Commit** (with approval):

```bash
git add coach.js index.html app.js quickadd.js style.css tests/ui/timestamps.js
git commit -m "Step A2: times on pouches, cravings, weigh-ins and runs"
```

---

### Task 5: Chick-fil-A items (official numbers)

**Files:**
- Modify: `food-data.js`: replace the five `cfa-*` rows (about lines 85-89) with the block below
- Modify: `food.js`: `mergeSeed` (about line 54) and `setFoodProcessing` (about line 704)
- Test: `tests/food-core.test.html` (append), and create `tests/ui/chick-fil-a.js`

**Interfaces:**
- Consumes: `nut(...)` (food-data.js: kcal, protein, carbs, fat, fiber, sugar, addedSugar, sodium), `mergeSeed`, `setFoodProcessing`.
- Produces: 29 `cfa-*` library ids (listed in the test), the library field `processingSet: true` (set by `setFoodProcessing`, honored by `mergeSeed` on a rev bump).

Source: https://www.chick-fil-a.com/nutrition-allergens, read 2026-10-24 from the page's embedded nutrition JSON (not a summarizer). Rows used: "Chick-fil-A® Chicken Sandwich 183g 420/16/3.5/1470/41/1/6/29" (cal, fat, sat fat, sodium, carbs, fiber, sugar, protein), and so on, as transcribed below.

- [ ] **Step 1: Write the failing logic tests.** Append inside `run(() => { ... })` in `tests/food-core.test.html` (`lib` is `FOOD_SEED_LIBRARY` there):

```js
  // Chick-fil-A (step A3): official numbers, so "exact"
  const CFA_IDS = ["cfa-sandwich", "cfa-spicy-sandwich", "cfa-deluxe", "cfa-grilled-sandwich", "cfa-cool-wrap",
    "cfa-nuggets-8", "cfa-nuggets-12", "cfa-grilled-8", "cfa-grilled-12", "cfa-minis-4",
    "cfa-fries-s", "cfa-fries-m", "cfa-fries-l", "cfa-mac-s", "cfa-mac-m", "cfa-fruit-cup", "cfa-hash-browns",
    "cfa-sauce", "cfa-polynesian", "cfa-honey-mustard", "cfa-ranch", "cfa-buffalo", "cfa-bbq",
    "cfa-lemonade-s", "cfa-lemonade-m", "cfa-lemonade-l", "cfa-sweet-tea-s", "cfa-sweet-tea-m", "cfa-sweet-tea-l"];
  const cfa = lib.filter((f) => f.id.startsWith("cfa-"));
  eq("every Chick-fil-A item present", CFA_IDS.filter((id) => !cfa.some((f) => f.id === id)), []);
  eq("no stray Chick-fil-A ids", cfa.map((f) => f.id).filter((id) => !CFA_IDS.includes(id)), []);
  eq("library ids unique", lib.length, new Set(lib.map((f) => f.id)).size);
  eq("chain + exact", cfa.filter((f) => f.group !== "chain" || f.confidence !== "exact").map((f) => f.id), []);
  eq("processing tagged", cfa.filter((f) => !["whole", "processed", "ultra"].includes(f.processing)).map((f) => f.id), []);
  eq("no one-tap drink buttons", cfa.filter((f) => f.drink).map((f) => f.id), []);
  eq("all 8 nutrients set", cfa.filter((f) => ["kcal", "protein", "carbs", "fat", "fiber", "sugar", "addedSugar", "sodium"]
    .some((k) => typeof f.n[k] !== "number")).map((f) => f.id), []);
  // A typo in one number shows up as kcal far from 4/4/9.
  eq("kcal matches macros", cfa.filter((f) =>
    Math.abs(4 * f.n.protein + 4 * f.n.carbs + 9 * f.n.fat - f.n.kcal) > Math.max(15, 0.12 * f.n.kcal)).map((f) => f.id), []);
  eq("added sugar within sugar", cfa.filter((f) => f.n.addedSugar > f.n.sugar).map((f) => f.id), []);
  const cfaItem = (id) => lib.find((f) => f.id === id);
  eq("sandwich corrected", [cfaItem("cfa-sandwich").n.fat, cfaItem("cfa-sandwich").n.sodium], [16, 1470]);
  eq("existing five get rev 1", ["cfa-sandwich", "cfa-nuggets-8", "cfa-nuggets-12", "cfa-grilled-8", "cfa-grilled-12"]
    .map((id) => cfaItem(id).rev), [1, 1, 1, 1, 1]);
  eq("tags", ["cfa-fruit-cup", "cfa-lemonade-m", "cfa-sweet-tea-m", "cfa-fries-m", "cfa-sauce"].map((id) => cfaItem(id).processing),
    ["whole", "processed", "processed", "ultra", "ultra"]);
```

- [ ] **Step 2: Run, expect failures.** `python tests/run.py`. Expected: food-core fails "every Chick-fil-A item present" (24 missing ids), "chain + exact", "sandwich corrected", and "existing five get rev 1". Exit code 1.

- [ ] **Step 3: Seed rows.** In `food-data.js`, replace the five existing `cfa-sandwich` … `cfa-grilled-12` lines with:

```js
  // Chick-fil-A, from the official nutrition page (chick-fil-a.com/
  // nutrition-allergens, read 2026-10-24), so "exact". The page has no
  // added-sugar column, so addedSugar is estimated by one rule: all of
  // the sugar for sauces and drinks; none for fruit, potato and mac &
  // cheese; sugar minus 1 g for breaded or bun items. rev 1 = the
  // original five corrected to the official page.
  { id: "cfa-sandwich", rev: 1, group: "chain", name: "Chick-fil-A Chicken Sandwich", serving: "1 sandwich (183 g)", n: nut(420, 29, 41, 16, 1, 6, 5, 1470), confidence: "exact", processing: "ultra" },
  { id: "cfa-spicy-sandwich", group: "chain", name: "Chick-fil-A Spicy Chicken Sandwich", serving: "1 sandwich (188 g)", n: nut(450, 28, 44, 18, 1, 6, 5, 1740), confidence: "exact", processing: "ultra" },
  { id: "cfa-deluxe", group: "chain", name: "Chick-fil-A Deluxe Sandwich", serving: "1 sandwich, American cheese (247 g)", n: nut(490, 32, 43, 21, 1, 7, 6, 1710), confidence: "exact", processing: "ultra" },
  { id: "cfa-grilled-sandwich", group: "chain", name: "Chick-fil-A Grilled Chicken Sandwich", serving: "1 sandwich (206 g)", n: nut(390, 28, 45, 11, 3, 11, 10, 765), confidence: "exact", processing: "ultra" },
  { id: "cfa-cool-wrap", group: "chain", name: "Chick-fil-A Cool Wrap", serving: "1 wrap (231 g)", n: nut(660, 43, 32, 45, 14, 5, 4, 1420), confidence: "exact", processing: "ultra" },
  { id: "cfa-nuggets-8", rev: 1, group: "chain", name: "Chick-fil-A nuggets, 8 ct", serving: "8 nuggets (113 g), no sauce", n: nut(250, 27, 11, 11, 0, 1, 0, 1210), confidence: "exact", processing: "ultra" },
  { id: "cfa-nuggets-12", rev: 1, group: "chain", name: "Chick-fil-A nuggets, 12 ct", serving: "12 nuggets (170 g), no sauce", n: nut(380, 40, 16, 17, 0, 1, 0, 1820), confidence: "exact", processing: "ultra" },
  { id: "cfa-grilled-8", rev: 1, group: "chain", name: "Chick-fil-A grilled nuggets, 8 ct", serving: "8 nuggets (95 g), no sauce", n: nut(130, 25, 1, 3, 0, 1, 0, 440), confidence: "exact", processing: "ultra" },
  { id: "cfa-grilled-12", rev: 1, group: "chain", name: "Chick-fil-A grilled nuggets, 12 ct", serving: "12 nuggets (142 g), no sauce", n: nut(200, 38, 2, 4.5, 0, 1, 0, 660), confidence: "exact", processing: "ultra" },
  { id: "cfa-minis-4", group: "chain", name: "Chick-fil-A Chick-n-Minis, 4 ct", serving: "4 minis (127 g)", n: nut(360, 20, 41, 13, 2, 8, 7, 1060), confidence: "exact", processing: "ultra" },
  { id: "cfa-fries-s", group: "chain", name: "Chick-fil-A waffle fries, small", serving: "small (96 g)", n: nut(320, 4, 35, 19, 4, 1, 0, 190), confidence: "exact", processing: "ultra" },
  { id: "cfa-fries-m", group: "chain", name: "Chick-fil-A waffle fries, medium", serving: "medium (125 g)", n: nut(420, 5, 45, 24, 5, 1, 0, 240), confidence: "exact", processing: "ultra" },
  { id: "cfa-fries-l", group: "chain", name: "Chick-fil-A waffle fries, large", serving: "large (179 g)", n: nut(600, 7, 65, 35, 7, 1, 0, 340), confidence: "exact", processing: "ultra" },
  { id: "cfa-mac-s", group: "chain", name: "Chick-fil-A mac & cheese, small", serving: "small (136 g)", n: nut(270, 12, 17, 17, 2, 2, 0, 710), confidence: "exact", processing: "ultra" },
  { id: "cfa-mac-m", group: "chain", name: "Chick-fil-A mac & cheese, medium", serving: "medium (227 g)", n: nut(450, 20, 28, 29, 3, 3, 0, 1190), confidence: "exact", processing: "ultra" },
  { id: "cfa-fruit-cup", group: "chain", name: "Chick-fil-A fruit cup", serving: "medium (125 g)", n: nut(70, 1, 16, 0, 2, 12, 0, 0), confidence: "exact", processing: "whole" },
  { id: "cfa-hash-browns", group: "chain", name: "Chick-fil-A hash browns", serving: "regular (77 g)", n: nut(270, 3, 23, 18, 3, 0, 0, 440), confidence: "exact", processing: "ultra" },
  { id: "cfa-sauce", group: "chain", name: "Chick-fil-A Sauce", serving: "1 packet (28 g)", n: nut(140, 0, 6, 13, 0, 6, 6, 170), confidence: "exact", processing: "ultra" },
  { id: "cfa-polynesian", group: "chain", name: "Chick-fil-A Polynesian sauce", serving: "1 packet (28 g)", n: nut(110, 0, 14, 6, 0, 13, 13, 210), confidence: "exact", processing: "ultra" },
  { id: "cfa-honey-mustard", group: "chain", name: "Chick-fil-A Honey Mustard sauce", serving: "1 packet (28 g)", n: nut(50, 0, 11, 0, 0, 10, 10, 160), confidence: "exact", processing: "ultra" },
  { id: "cfa-ranch", group: "chain", name: "Chick-fil-A Garden Herb Ranch sauce", serving: "1 packet (21 g)", n: nut(100, 0, 1, 11, 0, 0, 0, 170), confidence: "exact", processing: "ultra" },
  { id: "cfa-buffalo", group: "chain", name: "Chick-fil-A Zesty Buffalo sauce", serving: "1 packet (21 g)", n: nut(25, 0, 1, 2.5, 0, 0, 0, 570), confidence: "exact", processing: "ultra" },
  { id: "cfa-bbq", group: "chain", name: "Chick-fil-A Barbeque sauce", serving: "1 packet (28 g)", n: nut(45, 0, 11, 0, 0, 9, 9, 200), confidence: "exact", processing: "ultra" },
  // Lemonade (lemon juice, sugar, water) and brewed sweet tea are simple
  // recipes, so "processed".
  { id: "cfa-lemonade-s", group: "chain", name: "Chick-fil-A lemonade, small", serving: "small (465 g)", n: nut(190, 0, 49, 0, 0, 45, 45, 0), confidence: "exact", processing: "processed" },
  { id: "cfa-lemonade-m", group: "chain", name: "Chick-fil-A lemonade, medium", serving: "medium (612 g)", n: nut(260, 0, 66, 0, 0, 60, 60, 0), confidence: "exact", processing: "processed" },
  { id: "cfa-lemonade-l", group: "chain", name: "Chick-fil-A lemonade, large", serving: "large (916 g)", n: nut(380, 1, 98, 0, 1, 90, 90, 0), confidence: "exact", processing: "processed" },
  { id: "cfa-sweet-tea-s", group: "chain", name: "Chick-fil-A sweet tea, small", serving: "small (451 g)", n: nut(90, 0, 22, 0, 0, 22, 22, 0), confidence: "exact", processing: "processed" },
  { id: "cfa-sweet-tea-m", group: "chain", name: "Chick-fil-A sweet tea, medium", serving: "medium (604 g)", n: nut(120, 0, 31, 0, 0, 30, 30, 0), confidence: "exact", processing: "processed" },
  { id: "cfa-sweet-tea-l", group: "chain", name: "Chick-fil-A sweet tea, large", serving: "large (893 g)", n: nut(170, 0, 44, 0, 0, 44, 44, 0), confidence: "exact", processing: "processed" },
```

Also update the "Chains" comment block above the chain rows if it says chain items are always "estimate": the file header (food-data.js:10-12) says chain items "count as 'estimate'". Change that sentence to: `Chain items are published values but portions vary, so they count as "estimate", except where noted (Chick-fil-A's are copied from the official page, so "exact").`

- [ ] **Step 4: Run the logic tests, expect pass.** `python tests/run.py`. Expected: food-core all passed (161 + 12 = 173/173), exit code 0.

- [ ] **Step 5: Write the failing UI test.** Create `tests/ui/chick-fil-a.js`:

```js
// Chick-fil-A items (step A3): the rev-1 corrections reach an install
// that already has the old copies, without undoing Sean's own retag or
// favorite or touching past log entries, and the new items show up
// under Chains and in search, logging as exact.
const old = { kcal: 420, protein: 29, carbs: 41, fat: 18, fiber: 1, sugar: 6, addedSugar: 5, sodium: 1460, alcohol: 0 };
await reload({
  "coach-started-at": "0", "coach-injury": null,
  "food-library": [
    { id: "cfa-sandwich", group: "chain", name: "Chick-fil-A Chicken Sandwich", serving: "1 sandwich", n: old, confidence: "estimate", processing: "processed", processingSet: true, favorite: true, source: "seed" },
    { id: "cfa-nuggets-8", group: "chain", name: "Chick-fil-A nuggets, 8 ct", serving: "8 nuggets, no sauce", n: { ...old, kcal: 250 }, confidence: "estimate", processing: "processed", source: "seed" },
  ],
  "food-log": [{ id: "e1", date: day(-1), at: Date.now() - 86400000, slot: "extra", name: "Chick-fil-A Chicken Sandwich", servings: 1, n: old, confidence: "estimate", ref: { food: "cfa-sandwich" } }],
}, "food-panel");
const libItem = (id) => (ls("food-library") || []).find((f) => f.id === id);
eq("sandwich takes the official numbers", [libItem("cfa-sandwich").rev, libItem("cfa-sandwich").n.fat, libItem("cfa-sandwich").n.sodium, libItem("cfa-sandwich").confidence], [1, 16, 1470, "exact"]);
eq("Sean's own tag and favorite survive", [libItem("cfa-sandwich").processing, libItem("cfa-sandwich").favorite], ["processed", true]);
eq("an untouched tag takes the seed's", libItem("cfa-nuggets-8").processing, "ultra");
eq("past log entry unchanged", ls("food-log")[0].n.fat, 18);
check("new items seeded", ["cfa-polynesian", "cfa-fries-m", "cfa-sweet-tea-l"].every((id) => libItem(id)), (ls("food-library") || []).map((f) => f.id));

// Retagging a food marks it as Sean's choice.
click("#food-log-btn");
clickText("Chains", $("#food-sheet-tabs"));
const chainNames = $$("#food-sheet-body .pick-name").map((x) => x.textContent);
check("Chains lists the new items", ["Chick-fil-A Polynesian sauce", "Chick-fil-A waffle fries, medium", "Chick-fil-A Cool Wrap"].every((x) => chainNames.includes(x)), chainNames);
clickText("Search", $("#food-sheet-tabs"));
fill("#food-sheet-body .food-search", "polynesian");
const poly = () => $$("#food-sheet-body .search-results .pick-row").find((r) => r.querySelector(".pick-name").textContent === "Chick-fil-A Polynesian sauce");
check("search finds it", Boolean(poly()), $$("#food-sheet-body .pick-name").map((x) => x.textContent));
click(poly());
eq("logs as exact", [ls("food-log").at(-1).name, ls("food-log").at(-1).confidence], ["Chick-fil-A Polynesian sauce", "exact"]);
click($$(".food-entry").find((li) => li.textContent.includes("Polynesian")));
clickText("Processed", $("#food-sheet-body .processing-chips"));
eq("retag marks it Sean's", [libItem("cfa-polynesian").processing, libItem("cfa-polynesian").processingSet], ["processed", true]);
```

Check `PROCESSING_LABELS` (food.js) for the chip's exact label. If it isn't "Processed", use the real label in the last `clickText`.

- [ ] **Step 6: Run, expect failure.** `python .claude/skills/phone-preview/preview.py --interact tests/ui/chick-fil-a.js`. Expected: FAIL on "Sean's own tag and favorite survive" (processing becomes "ultra") and on "retag marks it Sean's" (`processingSet` is undefined).

- [ ] **Step 7: Implement.** In `food.js` `mergeSeed`, replace the rev branch:

```js
    if ((s.rev || 0) > (x.rev || 0)) {
      changed = true;
      // A corrected label replaces the seed's fields, but a processing
      // tag Sean picked himself stays his.
      const next = { ...x, ...copy(s) };
      if (x.processingSet) next.processing = x.processing;
      return next;
    }
```

Update the comment above `mergeSeed` so it ends `... keeps the rest (e.g. favorite, and a processing tag Sean set).`

In `setFoodProcessing`, after `food.processing = tag;`:

```js
  food.processingSet = true; // survives a seed correction (mergeSeed)
```

- [ ] **Step 8: Run, expect pass.** First `python tests/run.py` (exit 0). Then `python .claude/skills/phone-preview/preview.py --interact tests/ui/chick-fil-a.js --interact tests/ui/processing.js --interact tests/ui/snacks-search.js --interact tests/ui/food-flow.js`, and the same with `--dark`. Expected: all PASS, 0 JS errors. Read the final screenshot.

- [ ] **Step 9: Commit** (with approval):

```bash
git add food-data.js food.js tests/food-core.test.html tests/ui/chick-fil-a.js
git commit -m "Step A3: Chick-fil-A items from the official page; rev keeps Sean's processing tag"
```

---

### Task 6: Ship step A (v33)

**Files:** `docs/progress-log-detailed.md`, `docs/progress-log-summary.md` (controller only)

- [ ] **Step 1: Full verification.**
  - `python tests/run.py`: exit 0, with static 4/4, backup-core 34/34, coach-core 87/87, food-core 173/173, and injury 43/43.
  - Run every UI script, light and dark: `python .claude/skills/phone-preview/preview.py --interact tests/ui/backup-file.js --interact tests/ui/backup.js --interact tests/ui/chick-fil-a.js --interact tests/ui/feel-checkin.js --interact tests/ui/food-checkin.js --interact tests/ui/food-flow.js --interact tests/ui/injury.js --interact tests/ui/online-search.js --interact tests/ui/processing.js --interact tests/ui/redesign.js --interact tests/ui/restore.js --interact tests/ui/snack-ideas.js --interact tests/ui/snacks-search.js --interact tests/ui/swipe-close.js --interact tests/ui/timestamps.js --interact tests/ui/updates.js --interact tests/ui/water-pouches.js --budget 20000`, then the same with `--dark`. Expected: all 17 PASS, 0 JS errors.
  - Tab screenshots, light and dark: `python .claude/skills/phone-preview/preview.py --out <scratchpad>/preview-a`. Read each one and look for clipped text or overlap in the food log, the water drawer, Habits, the Weight list and the Train list.
  - Check that `sw.js` says v33, `version.js` says 33, and `git diff main --stat` touches only the files this plan lists.
- [ ] **Step 2: Progress logs.** Add detailed-log rows for each step A commit (from `git log`), and one summary paragraph for "2026-10-2x — Step A: swipe-to-close, timestamps, Chick-fil-A items". Commit them with approval.
- [ ] **Step 3: Push (Sean's yes required).** Fast-forward `main` to `batch1-stepA`, then `git push`. Verify the live site: `curl -s https://seanr9242000.github.io/weight-tracker/version.js` shows `APP_VERSION = 33` (it can take a minute or two).
- [ ] **Step 4: Phone check with Sean.**
  1. Reopen the app without reinstalling. It shows "Updated to v33".
  2. Open the + sheet and drag it down by the handle: it follows the finger, and the backdrop fades. A short drag springs back; a longer one or a flick closes it.
  3. Open Food → Log food. Swipe down from the title: it closes. Open it again, scroll the list a bit, and drag down inside the list: it scrolls instead of closing. At the top of the list, a drag down closes it.
  4. Drag the urge slider in Craving: the slider moves and the sheet stays put.
  4b. (Final review #1) With Chains open and the list at the top, swipe **up** to scroll, several times in a row: it should scroll every time, with no dead swipes. Also swipe the food sheet away while the search keyboard is up: the keyboard goes away.
  5. The Food log shows a time on each entry. Tap one, change the time, and save: the entry moves to its new place and stays on today.
  6. The water drawer lists today's water with times. Habits lists today's cravings with times. Weight shows today's weigh-in time. A new run shows its start time.
  7. Chains lists the new Chick-fil-A items, and searching "polynesian" finds the sauce.
- [ ] **Step 5: Hand-off.** Next is step B (tray and meal sections) via superpowers:writing-plans. The tray parts deferred from A (survives a close, "Ate at") go into B1. Carry the backlog below into step B's plan.

---

## Appendix: batch-2 backlog (deferred minors carried from steps 0 and 0.5)

These come from the step 0 / 0.5 SDD ledger (deleted after this plan was saved). Each was triaged "can wait": rare, cosmetic, or test-only for Sean's single-user, single-injury use. They aren't part of step A's tasks. Pick them up when a later step touches the same file, or in a batch-2 cleanup.

**Injury mode (step 0.5)**
- A PT exercise added late in the day shows as Missed once its time has passed.
- The pain trend (rising-week warning) mixes body parts when a second injury has a different `part`.
- Starting a new injury overwrites the old one's history (only one `coach-injury` record is kept).
- An upcoming injury (start date in the future) can't be cancelled: End is hidden until it's active, and `until < start` is refused.
- "End now" on an injury that started today leaves `until < start` (harmless, reads "Off. Last one").
- The PT remove handler dereferences `loadInjury()` without a null guard (unreachable from the UI today).
- `visibilitychange` re-renders the Injury card and banner but not Today, so the chip can be stale past midnight until the next `renderToday`.
- The summary's `. ${note}` reads oddly if the note already ends in punctuation.
- `injuryDays` has no guard for a null or missing `until` (callers gate on `injuryActive`).
- `snack-am`'s rest-day entry duplicates its game-day entry.
- `hasRecheckPanel` matches any item of kind "appointment" (only the recheck is one today).
- Answering Yes on the recheck writes a done check-in for an item that then vanishes (harmless).
- `feelDrafts` are keyed by item id only (moot while the feel panel renders today's items only).
- Test gaps: the reminders.js ping-once rule for optional items; the null-injury "Start" summary, upcoming injury, Cancel and PT add no-op; closing the recheck panel, the `<= dateStr` rejection and the recheck leaving today after Yes; pain 0 and pain ≤ 3 (no warning, no toast) and the rising-week toast branch; and the `liftDay` test helper only reloading when the lift is absent. The "seeded" check relies on a fresh profile having no `coach-injury` (add a comment).

**Backup and updates (step 0)**
- Data-loss path: `applyBackup` removes all app keys before writing, so a quota error mid-write leaves data half-wiped. If backup is on, the next edit can upload that half-restored state over the cloud copy. This is the one to fix first in batch 2: write to a staging copy, or roll back on throw.
- `backupDelay` with a future `lastBackupAt` (clock change) returns more than 60 s.
- `parseBackupFile` admits `data:image/svg+xml` photos.
- `save_backup` with a null `p_code` or `p_data` hits a NOT NULL error instead of a friendly message. There's no write quota per anonymous user, and `load_backup` doesn't normalize the code (the client always sends normalized codes).
- `noteBackupChange()` at load re-uploads once per launch even when nothing changed.
- An upload failure after turning backup off leaves a stale `backupError` that shows on the next turn-on. A raw Postgrest `err.message` can be long in the status line.
- Restoring over a phone with a different code silently replaces the code (the confirm doesn't say so). There's no in-flight guard on Restore (a double tap gives two confirms). The import status routes to the restore card whenever it's visible.
- `preparedExport` has no expiry (a stale snapshot if data changes between the two taps).
- An update reload can drop half-typed input on deploy days.
- The partial-photo-failure message is wiped by `reloadApp`, so Sean never sees it.
- `.code-form` submit styling duplicates `.pill-btn` (needed to beat the global `button[type=submit]`).
- Test and tooling gaps: run.py prints em dashes in FAIL lines as replacement characters in Git Bash; run.py's index regex only matches double-quoted `src`/`href`; the sw.js static checks are substring checks; run.py `main()` reuses the passed/total names. `tests/ui/updates.js` calls `applyPendingUpdate` directly, so the save/discard wiring isn't exercised by a click. `tests/ui/backup.js` doesn't probe the 30-60 s window, the visibility-hidden upload or the retry timer, and its 61 s minute-rule check has about 1 s of margin. `restore.js` doesn't assert the code is kept or the reload happens on the Backup-card path. There are no tests for import cancel, the download fallback or the Preparing… state, or for `validBackup` with non-string values, empty keys or a photo missing its id.
