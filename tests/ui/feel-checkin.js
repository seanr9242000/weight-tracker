// "How did it go?" after a game or lift, saved with what was eaten in
// the 4 hours before; Fuel vs feel card on the Food tab.
const title = item("League game") ? "League game" : item("Lift — 45 min") ? "Lift — 45 min" : null;
const id = title === "League game" ? "game" : "lift";

if (title) {
  // A snack logged into a slot in the window before the game/lift.
  const slot = item("Afternoon snack") ? "snack-pm" : "breakfast";
  await reload({
    "coach-started-at": "0",
    "food-log": [{ id: "f1", date: today, at: Date.now(), slot, name: "PB-banana toast", servings: 1, confidence: "exact",
      n: { kcal: 377, protein: 12, carbs: 0, fat: 0, fiber: 0, sugar: 0, addedSugar: 0, sodium: 0, alcohol: 0 } }],
  });

  click(".check-box", item(title));
  check("check-in opens on done", !!$(".feel-panel", item(title)));
  check("Save disabled until an answer", $$(".feel-panel button", item(title)).find((b) => b.textContent === "Save").disabled);
  const perf = id === "game" ? "Shooting" : "Weights moved";
  check("performance label fits the item", $$(".feel-label", item(title)).map((e) => e.textContent).includes(perf));
  if (slot === "snack-pm") check("pre-game food listed", $(".feel-panel .meal-detail", item(title)).textContent.includes("PB-banana toast"));

  // Energy 4, stomach just right, legs fresh, performance 3.
  const rows = $$(".feel-panel .chip-row", item(title));
  clickText("4", rows[0]);
  clickText("Just right", $$(".feel-panel .chip-row", item(title))[1]);
  clickText("Fresh", $$(".feel-panel .chip-row", item(title))[2]);
  clickText("3", $$(".feel-panel .chip-row", item(title))[3]);
  fill($(".feel-note", item(title)), "Legs good, shot felt flat");
  clickText("Save", item(title));
  const rec = ls("coach-feel-log").at(-1);
  eq("answers saved", [rec.itemId, rec.energy, rec.stomach, rec.legs, rec.performance, rec.note], [id, 4, "right", "fresh", 3, "Legs good, shot felt flat"]);
  if (slot === "snack-pm") eq("food snapshot saved", rec.ate, ["PB-banana toast"]);
  check("card closes after save", !$(".feel-panel", item(title)));
  check("no Rate it once rated", !$(".rate-btn", item(title)));

  // Skipping leaves a "Rate it" link; it reopens the card.
  await reload({ "coach-started-at": "0" });
  click(".check-box", item(title));
  clickText("Skip", item(title));
  check("Rate it link after skip", !!$(".rate-btn", item(title)));
  click(".rate-btn", item(title));
  check("Rate it reopens the card", !!$(".feel-panel", item(title)));
  // Unchecking the item closes the card.
  click(".check-box", item(title));
  check("undo closes the card", !$(".feel-panel", item(title)));
}

// Fuel vs feel card: hidden under 3 ratings, then summarizes.
const rec = (energy, stomach, ate) => ({ id: Math.random(), date: day(-1), itemId: "game", kind: "game", at: 0, energy, stomach, ate });
await reload({ "coach-started-at": "0", "coach-feel-log": [rec(4, "right", ["Pretzels + raisins"]), rec(5, "right", ["Pretzels + raisins"])] }, "food-panel");
check("card hidden under 3 ratings", $("#food-feel").hidden);
await reload({ "coach-started-at": "0", "coach-feel-log": [rec(4, "right", ["Pretzels + raisins"]), rec(5, "right", ["Pretzels + raisins"]), rec(2, "full", ["PB-banana toast"])] }, "food-panel");
check("card shown at 3 ratings", !$("#food-feel").hidden);
eq("rows", $$("#food-feel-list .feel-row").map((r) => r.textContent), ["Pretzels + raisins2× · energy 4.5 · just right 2/2", "PB-banana toast1× · energy 2 · too full 1/1"]);
