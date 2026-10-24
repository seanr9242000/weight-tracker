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
