// Injury mode: schedule on Today, the chip and Injury card, the Train
// banner, the recheck "Cleared?" flow, and pain after lifts.
const ankle = (start, until, pt) => ({ part: "ankle", start, until, note: "Brace on", pt: pt || [] });
const LIFT = "Lift — 45 min";
const WALK = "Easy walk in brace — skip if sore";

// Seeded once on first launch, for Sean's ankle. Relies on reload() clearing
// storage, so the profile starts without coach-injury.
await reload({ "coach-started-at": "0" });
const seeded = ls("coach-injury");
eq("seeded", seeded && [seeded.part, seeded.start, seeded.until], ["ankle", "2026-10-21", "2026-12-07"]);

await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-3), day(10)) });
check("no games while injured", !item("League game") && !item("Pre-game prep: shot routine + reset cue"));
check("no game-day pill", $("#day-pill").textContent !== "Game day");
check("old walk title gone", !item("After lunch: water + short walk") && !item("After dinner: water + short walk"));
if (item(LIFT)) check("lift note is the ankle-safe plan", $(".check-note", item(LIFT)).textContent.startsWith("Ankle-safe legs"));
if (item(WALK)) check("walks never show as missed", !item(WALK).classList.contains("missed"));

// Unconditional: scan the 14 seeded days through the app's own functions so
// these can't pass vacuously on days with no game, lift or walk.
const range = Array.from({ length: 14 }, (_, i) => day(i - 3));
const plain = (d) => app().itemsForDate(d, {});
const injured = (d) => app().scheduleFor(d);
check("range has a game day", range.some((d) => plain(d).some((i) => i.id === "game")));
check("range has a lift day", range.some((d) => plain(d).some((i) => i.id === "lift")));
check("no game or pregame-prep on any day", range.every((d) => !injured(d).some((i) => i.id === "game" || i.id === "pregame-prep")));
check("lift note is ankle-safe on every lift day", range.every((d) => {
  if (!plain(d).some((i) => i.id === "lift")) return true;
  const lift = injured(d).find((i) => i.id === "lift");
  return !!lift && lift.note.startsWith("Ankle-safe legs");
}));
check("walks retitled and optional on every day", range.every((d) =>
  plain(d).filter((i) => i.id === "post-lunch" || i.id === "post-dinner").every((p) => {
    const w = injured(d).find((i) => i.id === p.id);
    return !!w && w.title === WALK && w.optional === true;
  })));
const todayHasWalk = plain(today).some((i) => i.id === "post-lunch" || i.id === "post-dinner");
check("today's checklist shows the walk", !todayHasWalk || !!item(WALK));

// Turned off (null), the normal plan is back.
await reload({ "coach-started-at": "0", "coach-injury": null });
check("no walk retitle when off", !item(WALK));

// Chip, Injury card, PT exercises, Train banner, end now, start a new one.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-3), day(10)) });
const md = (d) => new Date(d + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
eq("chip", $(".injury-chip").textContent, `🩹 Ankle · day 4 of 14 · recheck ${md(day(10))}`);
click(".injury-chip");
check("chip opens the editor", !$("#injury-form").hidden);
eq("form filled", [$("#injury-part").value, $("#injury-start").value, $("#injury-until").value, $("#injury-note").value], ["ankle", day(-3), day(10), "Brace on"]);

fill("#injury-pt-time", "07:15");
fill("#injury-pt-title", "Ankle alphabet");
click("#injury-pt-add-btn");
eq("PT exercise stored", ls("coach-injury").pt.map((p) => [p.time, p.title]), [["07:15", "Ankle alphabet"]]);
check("PT exercise on today's schedule", Boolean(item("Ankle alphabet")));
click(".pouch-remove", $("#injury-pt-list"));
eq("PT exercise removed", ls("coach-injury").pt, []);

// Enter in the PT fields adds the exercise; it must not submit the form.
fill("#injury-pt-time", "08:00");
fill("#injury-pt-title", "Calf raises");
$("#injury-pt-title").dispatchEvent(new (app().KeyboardEvent)("keydown", { key: "Enter", bubbles: true, cancelable: true }));
eq("Enter adds the PT exercise", ls("coach-injury").pt.map((p) => [p.time, p.title]), [["08:00", "Calf raises"]]);
check("form stays open after Enter", !$("#injury-form").hidden);
click(".pouch-remove", $("#injury-pt-list"));

tab("train-panel");
eq("runs paused banner", $("#runs-paused").textContent, `Runs paused: ankle (back after ${md(day(10))} recheck)`);
check("Start de-emphasized, not removed", $("#timer-btn").classList.contains("deemphasized") && !$("#timer-btn").hidden);
tab("today-panel");

fill("#injury-until", day(-5));
$("#injury-form").requestSubmit();
eq("recheck before start refused", $("#injury-form-status").textContent, "The recheck date can't be before the start.");

let endAsked = null;
app().confirm = (msg) => { endAsked = msg; return false; };
click("#injury-end-btn");
eq("End now asks first", endAsked, "End injury mode? Games and runs come back on the schedule today.");
eq("declining End now changes nothing", ls("coach-injury").until, day(10));
app().confirm = () => true;
click("#injury-end-btn");
eq("End now ends it as of yesterday", ls("coach-injury").until, day(-1));
check("chip gone", !$(".injury-chip"));
check("banner gone", $("#runs-paused").hidden);

eq("card offers a new one", $("#injury-edit-btn").textContent, "Start");
click("#injury-edit-btn");
/* Just ended, so Start pre-fills (part, start, note) and wants a new recheck. */
eq("recently ended injury pre-fills", [$("#injury-part").value, $("#injury-start").value, $("#injury-until").value], ["ankle", day(-3), ""]);
fill("#injury-part", "Knee");
fill("#injury-start", today);
fill("#injury-until", day(20));
$("#injury-form").requestSubmit();
eq("new injury saved", [ls("coach-injury").part, ls("coach-injury").pt], ["knee", []]);
check("chip back", $(".injury-chip").textContent.startsWith("🩹 Knee · day 1 of 21"));

// Recheck day: "Cleared?" -> Not yet moves the recheck; Yes ends Injury mode.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-30), today) });
check("recheck on the until day", Boolean(item("Ankle recheck")));
click(".check-box", item("Ankle recheck"));
eq("asks Cleared?", $(".recheck-panel .meal-name", item("Ankle recheck"))?.textContent, "Cleared?");
check("not checked off by the tap", !item("Ankle recheck").classList.contains("done"));
clickText("Not yet", item("Ankle recheck"));
fill($(".recheck-panel input[type=date]", item("Ankle recheck")), day(14));
$(".recheck-panel form", item("Ankle recheck")).requestSubmit();
eq("Not yet moves the recheck", ls("coach-injury").until, day(14));
check("recheck leaves today", !item("Ankle recheck"));
check("still injured", Boolean($(".injury-chip")));

await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-30), today) });
click(".check-box", item("Ankle recheck"));
clickText("Yes", item("Ankle recheck"));
eq("Yes ends it as of yesterday, keeping the start", [ls("coach-injury").start, ls("coach-injury").until], [day(-30), day(-1)]);
check("chip gone after clearing", !$(".injury-chip"));
eq("toast", $("#toast-text").textContent, "Injury mode off. Games and runs are back on the schedule.");

// Lift check-in asks about pain while injured and warns at 4+.
const liftDay = async (injury) => {
  await reload({ "coach-started-at": "0", "coach-injury": injury });
  if (!item(LIFT)) {
    await reload({ "coach-started-at": "0", "coach-injury": injury,
      "coach-overrides": { [today]: { removed: [], moved: {}, added: [{ id: "lift", time: "06:00", title: LIFT, kind: "train" }] } } });
  }
};
await liftDay(ankle(day(-3), day(10)));
click(".check-box", item(LIFT));
const labels = $$(".feel-panel .feel-label", item(LIFT)).map((e) => e.textContent);
const painIdx = labels.indexOf("Ankle pain (0–10)");
check("pain question asked", painIdx >= 0, JSON.stringify(labels));
clickText("5", $$(".feel-panel .chip-row", item(LIFT))[painIdx]);
eq("warning at 4+", $(".pain-warning", item(LIFT))?.textContent, "Back off leg work and mention it to your PT.");
check("pain alone enables Save", !$$(".feel-panel button", item(LIFT)).find((b) => b.textContent === "Save").disabled);
clickText("Save", item(LIFT));
const painRec = ls("coach-feel-log").at(-1);
eq("pain saved with the check-in", [painRec.itemId, painRec.injuryPain, painRec.injuryPart], ["lift", 5, "ankle"]);
eq("warning toast", $("#toast-text").textContent, "Back off leg work and mention it to your PT.");

await liftDay(null);
click(".check-box", item(LIFT));
check("no pain question when not injured", !$$(".feel-panel .feel-label", item(LIFT)).some((e) => e.textContent.includes("pain")));

// A pain answer picked before the injury ends must not outlive it: the
// draft lives in memory, so end the injury in place and re-render.
await liftDay(ankle(day(-3), day(10)));
click(".check-box", item(LIFT));
const draftLabels = $$(".feel-panel .feel-label", item(LIFT)).map((e) => e.textContent);
clickText("5", $$(".feel-panel .chip-row", item(LIFT))[draftLabels.indexOf("Ankle pain (0–10)")]);
check("pain warning shows before ending", Boolean($(".pain-warning", item(LIFT))));
app().saveJSON("coach-injury", app().endInjury(ls("coach-injury"), today));
app().renderToday();
check("feel panel still open after re-render", Boolean(item(LIFT) && $(".feel-panel", item(LIFT))));
check("no stale pain warning after ending", !$(".pain-warning", item(LIFT)));
check("no pain question after ending", !$$(".feel-panel .feel-label", item(LIFT)).some((e) => e.textContent.includes("pain")));
check("Save stays disabled on the invisible answer", $$(".feel-panel button", item(LIFT)).find((b) => b.textContent === "Save").disabled);

// Restarting a recently ended injury pre-fills and carries the PT list over.
const pt = [{ id: "pt-1", time: "07:00", title: "Ankle alphabet" }];
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-20), day(-3), pt) });
eq("card offers Start", $("#injury-edit-btn").textContent, "Start");
click("#injury-edit-btn");
eq("form pre-filled from the recent one", [$("#injury-part").value, $("#injury-start").value, $("#injury-until").value, $("#injury-note").value], ["ankle", day(-20), "", "Brace on"]);
fill("#injury-until", day(10));
$("#injury-form").requestSubmit();
eq("PT carried over", ls("coach-injury").pt, pt);
check("chip back with the original start's day count", $(".injury-chip").textContent.startsWith("🩹 Ankle · day 21 of 31"), $(".injury-chip")?.textContent);

// A different part does not inherit the PT list.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-20), day(-3), pt) });
click("#injury-edit-btn");
fill("#injury-part", "Knee");
fill("#injury-until", day(10));
$("#injury-form").requestSubmit();
eq("different part drops PT", ls("coach-injury").pt, []);

// Ended more than 14 days ago: blank form.
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-40), day(-20), pt) });
click("#injury-edit-btn");
eq("old injury gives a blank form", [$("#injury-part").value, $("#injury-start").value, $("#injury-until").value, $("#injury-note").value], ["", today, "", ""]);

// Closing the recheck panel resets "Not yet" so it reopens at "Cleared?".
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-30), today) });
click(".check-box", item("Ankle recheck"));
clickText("Not yet", item("Ankle recheck"));
check("date picker shown", Boolean($(".recheck-panel input[type=date]", item("Ankle recheck"))));
click(".check-box", item("Ankle recheck"));
check("panel closed", !$(".recheck-panel", item("Ankle recheck")));
click(".check-box", item("Ankle recheck"));
check("reopened without the date picker", Boolean($(".recheck-panel", item("Ankle recheck"))) && !$(".recheck-panel input[type=date]", item("Ankle recheck")));

// Tapping the recheck push opens "Cleared?".
await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-30), today) }, "food-panel", "item=injury-recheck");
check("push tap opens the Cleared? panel", Boolean($(".recheck-panel", item("Ankle recheck"))));
