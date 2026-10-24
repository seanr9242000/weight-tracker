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

tab("train-panel");
eq("runs paused banner", $("#runs-paused").textContent, `Runs paused: ankle (back after ${md(day(10))} recheck)`);
check("Start de-emphasized, not removed", $("#timer-btn").classList.contains("deemphasized") && !$("#timer-btn").hidden);
tab("today-panel");

fill("#injury-until", day(-5));
$("#injury-form").requestSubmit();
eq("recheck before start refused", $("#injury-form-status").textContent, "The recheck date can't be before the start.");

click("#injury-end-btn");
eq("End now ends it as of yesterday", ls("coach-injury").until, day(-1));
check("chip gone", !$(".injury-chip"));
check("banner gone", $("#runs-paused").hidden);

eq("card offers a new one", $("#injury-edit-btn").textContent, "Start");
click("#injury-edit-btn");
eq("blank form for a new injury", $("#injury-part").value, "");
fill("#injury-part", "Knee");
fill("#injury-start", today);
fill("#injury-until", day(20));
$("#injury-form").requestSubmit();
eq("new injury saved", [ls("coach-injury").part, ls("coach-injury").pt], ["knee", []]);
check("chip back", $(".injury-chip").textContent.startsWith("🩹 Knee · day 1 of 21"));
