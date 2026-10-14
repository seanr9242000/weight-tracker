// Weekly check-in after 3 seeded weeks: proposal, Accept, goal prompt.
// Ends on the Food tab with the check-in card answered.
const days = {}, log = [], weights = [];
for (let i = 20; i >= 0; i--) {
  const date = day(-i);
  days[date] = { complete: true, at: 0 };
  log.push({ id: "s" + i, date, at: i, slot: "extra", name: "Seed", servings: 1, confidence: "exact",
    n: { kcal: 3200, protein: 200, carbs: 0, fat: 0, fiber: 0, sugar: 0, addedSugar: 0, sodium: 0, alcohol: 0 } });
  if (i % 2 === 0) weights.push({ id: "w" + i, date, weight: 205 + (20 - i) * 0.5 / 7, unit: "lbs" });
}
await reload({
  "coach-started-at": "0", "food-days": days, "food-log": log, "weight-tracker-entries": weights,
  "food-settings": { profile: { age: 26, sex: "male", heightCm: 194.3, activity: 1.5 }, goal: { mode: "maintain", rateLbPerWk: 0 },
    maintenance: 2500, protein: 190, limits: { addedSugar: 36, fiber: 38, sodium: 2300 }, bank: { 6: 1500, 0: 500 }, startDate: day(-60) },
}, "food-panel");

check("check-in visible", !$("#food-checkin").hidden);
check("proposal text", $("#food-checkin-body").textContent.includes("2,500 → 2,750"), $("#food-checkin-body").textContent);
check("goal prompt offered", !!byText("Maintain / recomp", $("#food-checkin-body")));
check("Discovery over", !$("#food-badge").textContent.includes("Discovery"), $("#food-badge").textContent);
clickText("Accept", $("#food-checkin-body"));
eq("maintenance accepted", ls("food-settings").maintenance, 2750);
clickText("Maintain / recomp", $("#food-checkin-body"));
eq("goal prompt answered", ls("food-settings").goalPromptAnswered, true);
check("card hidden unless Sunday", new Date().getDay() === 0 || $("#food-checkin").hidden);
eq("history rows", ls("food-target-history").length, 2);
