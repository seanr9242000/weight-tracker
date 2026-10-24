// Injury mode: schedule on Today, the chip and Injury card, the Train
// banner, the recheck "Cleared?" flow, and pain after lifts.
const ankle = (start, until, pt) => ({ part: "ankle", start, until, note: "Brace on", pt: pt || [] });
const LIFT = "Lift — 45 min";
const WALK = "Easy walk in brace — skip if sore";

// Seeded once on first launch, for Sean's ankle.
await reload({ "coach-started-at": "0" });
const seeded = ls("coach-injury");
eq("seeded", seeded && [seeded.part, seeded.start, seeded.until], ["ankle", "2026-10-21", "2026-12-07"]);

await reload({ "coach-started-at": "0", "coach-injury": ankle(day(-3), day(10)) });
check("no games while injured", !item("League game") && !item("Pre-game prep: shot routine + reset cue"));
check("no game-day pill", $("#day-pill").textContent !== "Game day");
check("old walk title gone", !item("After lunch: water + short walk") && !item("After dinner: water + short walk"));
if (item(LIFT)) check("lift note is the ankle-safe plan", $(".check-note", item(LIFT)).textContent.startsWith("Ankle-safe legs"));
if (item(WALK)) check("walks never show as missed", !item(WALK).classList.contains("missed"));

// Turned off (null), the normal plan is back.
await reload({ "coach-started-at": "0", "coach-injury": null });
check("no walk retitle when off", !item(WALK));
