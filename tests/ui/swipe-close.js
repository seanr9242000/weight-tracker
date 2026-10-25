// Swipe down to close (step A1). The + sheet, the food sheet and the
// skip-reason sheet follow a downward drag. Past a third of their height,
// or on a flick, they close through their own close function; otherwise
// they spring back. Synthetic touch pointers stand in for a finger.
const PE = (type, target, y, pointerId = 7) => target.dispatchEvent(new (app().PointerEvent)(type, {
  bubbles: true, cancelable: true, pointerId, pointerType: "touch", isPrimary: true, clientX: 120, clientY: y,
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
check("follows the finger", /^0px \d+(\.\d+)?px$/.test(qa().style.translate), qa().style.translate);
const fade = Number(scrim().style.opacity);
check("scrim fades with the drag", fade > 0.5 && fade < 1, scrim().style.opacity);
PE("pointerup", $(".sheet-handle", qa()), 0);
await wait(300);
eq("short drag springs back", [qa().hidden, qa().style.translate, scrim().style.opacity], [false, "", ""]);
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

// Past a third closes, through closeQuickAdd.
await swipe($(".sheet-handle", qa()), slow(h * 0.5));
await wait(300);
eq("long drag closes", [qa().hidden, scrim().hidden, $("#fab").classList.contains("open")], [true, true, false]);

// Reopening looks normal: nothing left over from the drag.
click("#fab");
eq("reopens clean", [qa().hidden, qa().style.translate, qa().style.animation, scrim().style.opacity], [false, "", "", ""]);

// A quick flick closes even though it's short.
await swipe($(".sheet-handle", qa()), [30, 60], 16);
await wait(300);
eq("flick closes", qa().hidden, true);

// Upward drags are ignored.
click("#fab");
await swipe($(".sheet-title", qa()), [-20, -60, -100]);
await wait(300);
eq("upward drag ignored", [qa().hidden, qa().style.translate], [false, ""]);

// iOS cancelling the pointer mid-drag springs back instead of sticking.
await swipe($(".sheet-handle", qa()), slow(h * 0.5), 100, "pointercancel");
await wait(300);
eq("pointercancel springs back", [qa().hidden, qa().style.translate, scrim().style.opacity], [false, "", ""]);

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

// iPhone Safari captures a touch to the element under the finger; when the
// sheet takes capture, Safari fires lostpointercapture on that element,
// which bubbles to the sheet. That handoff must not end the drag (seen on
// an iPhone 2026-10-24: every swipe sprang back at about 11 px).
click("#fab");
check("+ sheet open for the capture-handoff test", !qa().hidden);
{
  const handle = $(".sheet-handle", qa());
  const y0 = handle.getBoundingClientRect().top + 3;
  const path = slow(h * 0.5);
  PE("pointerdown", handle, y0);
  await wait(100);
  PE("pointermove", handle, y0 + path[0]);
  PE("lostpointercapture", handle, y0 + path[0]); // capture moves handle -> sheet
  for (const dy of path.slice(1)) {
    await wait(100);
    PE("pointermove", handle, y0 + dy);
  }
  PE("pointerup", handle, y0 + path.at(-1));
  PE("lostpointercapture", qa(), y0 + path.at(-1)); // the sheet's own release, after pointerup
}
await wait(300);
eq("iOS capture handoff doesn't cancel the drag", qa().hidden, true);

// A touch whose pointerup never reached the sheet (say its target was
// re-rendered away) must not lock swiping until a reload.
click("#fab");
check("+ sheet open for the lost-pointer test", !qa().hidden);
PE("pointerdown", $(".sheet-handle", qa()), 100, 99);
await swipe($(".sheet-handle", qa()), slow(h * 0.5));
await wait(300);
eq("a lost pointerup doesn't lock swiping", qa().hidden, true);
click("#fab");

// Only the header blocks native panning; chips and titles inside a
// scrolling body still scroll (spec A1: "the body still scrolls normally").
const ta = (el) => getComputedStyle(el).touchAction;
eq("+ sheet handle drags", ta($(".sheet-handle", qa())), "none");
eq("+ sheet title scrolls (it's inside the scroller)", ta($("#qa-main .sheet-title")), "auto");
eq("craving chips scroll", ta($("#trigger-chips")), "auto");

// Dragging the urge slider moves the slider, not the sheet.
app().openQuickAdd("craving");
await swipe($("#urge-input"), slow(h * 0.5));
await wait(300);
eq("slider drag leaves the sheet", [qa().hidden, qa().style.translate], [false, ""]);
app().closeQuickAdd();

// Food sheet: closes from its title.
tab("food-panel");
click("#food-log-btn");
const fs = $("#food-sheet");
await swipe($("#food-sheet-title"), slow(fs.offsetHeight * 0.5));
await wait(300);
eq("food sheet closes from its title", fs.hidden, true);

// Header vs body touch-action, and closing with the search keyboard up
// drops focus so the keyboard goes away.
click("#food-log-btn");
eq("food header tabs drag", ta($("#food-sheet-tabs")), "none");
eq("food title drags", ta($("#food-sheet-title")), "none");
const search = $("#food-sheet-body .food-search");
search.focus();
check("search focused", doc().activeElement === search, doc().activeElement && doc().activeElement.className);
await swipe($("#food-sheet-title"), slow(fs.offsetHeight * 0.5));
await wait(300);
eq("swipe close drops the keyboard", [fs.hidden, doc().activeElement === search], [true, false]);
click("#food-log-btn");
clickText("Quick add", $("#food-sheet-tabs"));
eq("chips inside the body scroll", ta($("#food-sheet-body .processing-chips")), "auto");
click("#food-sheet-cancel");

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
eq("scrolled body doesn't drag", [fs.hidden, fs.style.translate, (ls("food-log") || []).length], [false, "", 0]);
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
