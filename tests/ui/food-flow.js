// Click-through of Phase 2a food logging. Run with:
//   python .claude/skills/phone-preview/preview.py --interact tests/ui/food-flow.js
await reload({ "coach-started-at": "0", "coach-injury": null });

// Breakfast "As planned" from Today
click(".check-box", item("Protein shake"));
check("meal panel opens", !!$(".meal-panel", item("Protein shake")));
clickText("As planned", item("Protein shake"));
eq("1 entry logged", ls("food-log").length, 1);
eq("shake kcal", Math.round(ls("food-log")[0].n.kcal), 330);
check("breakfast done", item("Protein shake").classList.contains("done"));
eq("checkin stored", ls("coach-checkins")[`${today}|breakfast`]?.status, "done");
check("fuel row shows food", $("#today-fuel").textContent.includes("330"), $("#today-fuel").textContent);

// Weekday lunch with the BBQ add-on (weekend lunch has no plan)
if (item("Lunch — meal prep")) {
  click(".check-box", item("Lunch — meal prep"));
  clickText("+ BBQ sauce", item("Lunch — meal prep"));
  check("addon chip active", byText("+ BBQ sauce", item("Lunch — meal prep")).classList.contains("active"));
  clickText("As planned", item("Lunch — meal prep"));
  eq("lunch addon recorded", ls("food-log").at(-1).ref.addons, ["bbq-low"]);
  eq("lunch slot", ls("food-log").at(-1).slot, "lunch");
}

// "Something else" -> Chains
// Whichever snack today's schedule has (a Sunday has no game or lift).
const snack = [["Pre-game snack", "pregame-snack"], ["Recovery snack (not chocolate milk)", "post-lift"], ["Afternoon snack", "snack-pm"],
  ["Mid-morning snack", "snack-am"], ["Evening snack", "snack-eve"]].find(([title]) => item(title));
click(".check-box", item(snack[0]));
// A snack with a planned meal says "Something else"; one without, "Log food".
$(".meal-actions .pill-btn:last-child", item(snack[0])).click();
check("sheet open", !$("#food-sheet").hidden);
clickText("Chains", $("#food-sheet-tabs"));
click("#food-sheet-body .pick-row");
check("sheet closed", $("#food-sheet").hidden);
eq("chain entry slot", ls("food-log").at(-1).slot, snack[1]);
eq("chain entry estimate", ls("food-log").at(-1).confidence, "estimate");
eq("snack item done", ls("coach-checkins")[`${today}|${snack[1]}`]?.status, "done");

// Food tab: drink, quick add, takeout
tab("food-panel");
const n0 = ls("food-log").length;
clickText("+1 White Claw");
eq("drink logged", ls("food-log").length, n0 + 1);
check("alcohol line", $("#food-alcohol").textContent.includes("1 drink"), $("#food-alcohol").textContent);

click("#food-quick-btn");
fill("[name=name]", "Protein bar");
fill("[name=kcal]", "200");
fill("[name=protein]", "20");
$("[name=keep]").checked = true;
$(".quick-form").requestSubmit();
eq("quick add logged", ls("food-log").at(-1).name, "Protein bar");
check("saved to library", ls("food-library").some((x) => x.name === "Protein bar" && x.source === "custom"));

click("#food-takeout-btn");
$$(".size-btn")[1].click();
eq("takeout M pizza", ls("food-log").at(-1).name, "Pizza (regular slice)");
check("estimate share shown", /\d+% estimated/.test($("#food-est").textContent), $("#food-est").textContent);

// Edit servings, then delete
const count = ls("food-log").length;
click(".food-entry");
fill("#food-sheet-body input", "2");
$("#food-sheet-body form").requestSubmit();
eq("servings edited", ls("food-log").find((e) => e.name === "Protein shake").servings, 2);
click(".food-entry");
clickText("Delete entry");
eq("entry deleted", ls("food-log").length, count - 1);

// "I logged everything" <-> "Close food log" checklist item
click("#food-complete");
eq("day complete", ls("food-days")[today]?.complete, true);
check("close item done", item("Close food log").classList.contains("done"));
click(".check-box", item("Close food log"));
eq("day reopened from Today", ls("food-days")[today], undefined);
check("toggle unchecked", !$("#food-complete").checked);

// Recent chip re-logs
const before = ls("food-log").length;
$$("#food-quick-chips .chip").find((c) => !c.textContent.startsWith("+1")).click();
eq("recent relog", ls("food-log").length, before + 1);

// Settings
click("#food-settings-btn");
check("settings open", !$("#food-settings-form").hidden);
fill("#fs-protein", "200");
fill("#fs-goal", "2");
$("#food-settings-form").requestSubmit();
eq("protein saved", ls("food-settings").protein, 200);
eq("goal saved", ls("food-settings").goal, { mode: "cut", rateLbPerWk: -0.5 });
eq("history row", ls("food-target-history").length, 1);
