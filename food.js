/* Food tab + the meal panel on Today's checklist. All the math lives in
   food-core.js; this file is storage, seeding, and rendering. Loads
   after coach.js and reuses its helpers (loadJSON, saveJSON, el, newId,
   setCheckin, renderToday). Data stays in localStorage like the rest
   of the app. */

const FOOD_LIBRARY_KEY = "food-library";
const FOOD_MEALS_KEY = "food-meals";
const FOOD_LOG_KEY = "food-log";
const FOOD_DAYS_KEY = "food-days";
const FOOD_SETTINGS_KEY = "food-settings";
const FOOD_HISTORY_KEY = "food-target-history";
const FOOD_CHECKIN_KEY = "food-checkin-seen";
const FOOD_IDEAS_KEY = "food-ideas";
const FEEL_LOG_KEY = "coach-feel-log";
const SHAKE_NOTE_KEY = "food-shake-note-dismissed";
const WATER_LOG_KEY = "water-log";
const PROCESSING_LABELS = { whole: "Whole", processed: "Processed", ultra: "Ultra" };
const CLOSE_FOOD_LOG_ID = "close-food-log";
const GOAL_PROMPT_AFTER_DAYS = 49; // ~7 weeks: the Zyn taper should be done

const GOAL_OPTIONS = [
  { mode: "cut", rate: -1, label: "Cut 1 lb/wk" },
  { mode: "cut", rate: -0.75, label: "Cut 0.75 lb/wk" },
  { mode: "cut", rate: -0.5, label: "Cut 0.5 lb/wk" },
  { mode: "maintain", rate: 0, label: "Maintain / recomp" },
  { mode: "bulk", rate: 0.25, label: "Lean bulk 0.25 lb/wk" },
  { mode: "bulk", rate: 0.5, label: "Lean bulk 0.5 lb/wk" },
];

const fmt = (x) => Math.round(x).toLocaleString();

/* ---- Storage + seeding ---- */

/* Seed items are merged by id on every load, so new seed foods/meals
   show up after an update without touching anything Sean edited.
   Fields added to a seed item later (e.g. `portion`) are filled in on
   stored copies too; stored values win, unless the seed item's `rev`
   is newer (a corrected label), which overwrites the seed's fields and
   keeps the rest (e.g. favorite, and a processing tag Sean set). */
function mergeSeed(key, seed) {
  const copy = (x) => ({ ...JSON.parse(JSON.stringify(x)), source: "seed" });
  const stored = loadJSON(key, null);
  if (!stored) {
    const fresh = seed.map(copy);
    saveJSON(key, fresh);
    return fresh;
  }
  const seedById = Object.fromEntries(seed.map((x) => [x.id, x]));
  let changed = false;
  const merged = stored.map((x) => {
    const s = seedById[x.id];
    if (!s || x.source !== "seed") return x;
    if ((s.rev || 0) > (x.rev || 0)) {
      changed = true;
      // A corrected label replaces the seed's fields, but a processing
      // tag Sean picked himself stays his.
      const next = { ...x, ...copy(s) };
      if (x.processingSet) next.processing = x.processing;
      return next;
    }
    const missing = Object.keys(s).filter((k) => !(k in x));
    if (!missing.length) return x;
    changed = true;
    return { ...copy(s), ...x };
  });
  const ids = new Set(stored.map((x) => x.id));
  const added = seed.filter((x) => !ids.has(x.id)).map(copy);
  if (added.length || changed) saveJSON(key, [...merged, ...added]);
  return [...merged, ...added];
}

function latestWeight() {
  const entries = loadEntries();
  if (!entries.length) return null;
  return [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1).weight;
}

function foodSettings() {
  let s = loadJSON(FOOD_SETTINGS_KEY, null);
  if (!s) {
    s = defaultSettings(todayLocalDateString(), latestWeight());
    saveJSON(FOOD_SETTINGS_KEY, s);
  }
  return s;
}

const foodLibrary = () => loadJSON(FOOD_LIBRARY_KEY, []);
const foodMeals = () => loadJSON(FOOD_MEALS_KEY, []);
const foodLog = () => loadJSON(FOOD_LOG_KEY, []);
const foodDays = () => loadJSON(FOOD_DAYS_KEY, {});
const foodIdeas = () => loadJSON(FOOD_IDEAS_KEY, []);
const feelLog = () => loadJSON(FEEL_LOG_KEY, []);
const waterLog = () => loadJSON(WATER_LOG_KEY, []);

mergeSeed(FOOD_LIBRARY_KEY, FOOD_SEED_LIBRARY);
mergeSeed(FOOD_MEALS_KEY, FOOD_SEED_MEALS);
mergeSeed(FOOD_IDEAS_KEY, SNACK_IDEAS);
foodSettings();

/* Every single-tap log goes through here (the tray writes its own group,
   logTray). Logging into a checklist slot (e.g. "lunch") also checks that
   item off, which stops its pings. */
function logFood({ slot = "extra", name, servings = 1, n, confidence, ref, meal }) {
  const date = todayLocalDateString();
  const log = foodLog();
  log.push({ id: newId(), date, at: Date.now(), slot, name, servings, n, confidence, ref, meal: meal || mealForSlot(slot, minutesNow()) });
  saveJSON(FOOD_LOG_KEY, log);
  if (slot !== "extra") setCheckin(date, slot, { status: "done", at: Date.now() });
  refreshFood();
}

function setDayComplete(dateStr, complete) {
  const days = foodDays();
  if (complete) days[dateStr] = { complete: true, at: Date.now() };
  else delete days[dateStr];
  saveJSON(FOOD_DAYS_KEY, days);
  // The checklist item and the Food tab toggle are the same fact.
  setCheckin(dateStr, CLOSE_FOOD_LOG_ID, complete ? { status: "done", at: Date.now() } : null);
}

/* Called from coach.js when the "Close food log" checkbox is tapped. */
function closeFoodLog(dateStr, complete) {
  setDayComplete(dateStr, complete);
  refreshFood();
}

function refreshFood() {
  renderFood();
  renderToday();
}

function logMeal(meal, slot, addonIds) {
  const { n, confidence } = mealNutrients(meal, foodLibrary(), addonIds);
  logFood({ slot, name: meal.name, n, confidence, ref: { meal: meal.id, addons: addonIds } });
}

function logLibraryFood(food, slot) {
  logFood({ slot, name: food.name, n: foodNutrients(food), confidence: food.confidence, ref: { food: food.id } });
}

/* Whole / Processed / Ultra chip row; `onPick(tag)` gets the new tag. */
function processingChips(current, onPick) {
  const row = el("div", "chip-row processing-chips");
  for (const [tag, label] of Object.entries(PROCESSING_LABELS)) {
    const chip = el("button", `chip small${tag === current ? " active" : ""}`, label);
    chip.type = "button";
    chip.dataset.tag = tag;
    chip.addEventListener("click", () => onPick(tag));
    row.appendChild(chip);
  }
  return row;
}

/* ---- Today: meal panel + fuel row (called from coach.js) ---- */

const mealAddons = {}; // itemId -> Set of add-on food ids switched on

function renderMealPanel(dateStr, item) {
  const panel = el("div", "meal-panel");
  const meal = plannedMealFor(foodMeals(), item.id, dateStr);
  if (meal) {
    const on = mealAddons[item.id] || (mealAddons[item.id] = new Set());
    const { n } = mealNutrients(meal, foodLibrary(), [...on]);
    panel.appendChild(el("div", "meal-name", meal.name));
    panel.appendChild(el("div", "meal-detail", `${meal.detail ? meal.detail + " · " : ""}${fmt(n.kcal)} kcal · ${fmt(n.protein)} g protein`));
    if (meal.addons && meal.addons.length) {
      const row = el("div", "chip-row");
      for (const addon of meal.addons) {
        const chip = el("button", `chip small${on.has(addon.foodId) ? " active" : ""}`, addon.label);
        chip.type = "button";
        chip.addEventListener("click", () => {
          if (on.has(addon.foodId)) on.delete(addon.foodId);
          else on.add(addon.foodId);
          renderToday();
        });
        row.appendChild(chip);
      }
      panel.appendChild(row);
    }
  }
  const actions = el("div", "meal-actions");
  if (meal) {
    const planned = el("button", "pill-btn dark", "As planned");
    planned.type = "button";
    planned.addEventListener("click", () => {
      logMeal(meal, item.id, [...(mealAddons[item.id] || [])]);
      delete mealAddons[item.id];
      closeMealPanel();
    });
    actions.appendChild(planned);
  }
  const other = el("button", "pill-btn", meal ? "Something else" : "Log food");
  other.type = "button";
  other.addEventListener("click", () => openFoodSheet({ slot: item.id, title: item.title, mode: item.id === "treat-meal" ? "takeout" : "search" }));
  actions.appendChild(other);
  panel.appendChild(actions);
  renderSnackIdeas(panel, dateStr, item);
  return panel;
}

/* Snack ideas with exact portions, picked for the kind of day it is
   (food-data SNACK_PLAN). One tap logs the idea into this slot. */
function renderSnackIdeas(panel, dateStr, item) {
  const type = dayType(scheduleFor(dateStr));
  const tip = snackTip(SNACK_PLAN, item.id, type);
  const ideas = snackIdeasFor(foodIdeas(), SNACK_PLAN, item.id, type);
  if (!tip && !ideas.length) return;
  const box = el("div", "snack-ideas");
  box.appendChild(el("div", "pick-section", "Ideas"));
  if (tip) box.appendChild(el("div", "snack-tip", tip));
  const lib = foodLibrary();
  for (const idea of ideas) {
    const { n } = mealNutrients(idea, lib, []);
    box.appendChild(pickRow(idea.name, `${portionText(idea.items, lib)} · ${fmt(n.kcal)} kcal · ${fmt(n.protein)} g P`, () => {
      logMeal(idea, item.id, []);
      closeMealPanel();
      renderToday();
    }));
  }
  panel.appendChild(box);
}

/* ---- Today: "how did it go?" after a game or lift (coach.js) ---- */

const feelDrafts = {}; // item id -> answers picked so far

function feelQuestions(kind, injuredPart) {
  const scale = [1, 2, 3, 4, 5].map((v) => [v, String(v)]);
  const questions = [
    { key: "energy", label: "Energy", options: scale },
    { key: "stomach", label: "Stomach", options: [["full", "Too full"], ["right", "Just right"], ["hungry", "Hungry"]] },
    { key: "legs", label: "Legs / body", options: [["fresh", "Fresh"], ["normal", "Normal"], ["heavy", "Heavy"]] },
    { key: "performance", label: kind === "game" ? "Shooting" : "Weights moved", options: scale },
  ];
  // Injury mode: lifts also track how the injury held up, for Sean's PT.
  if (kind === "lift" && injuredPart) {
    questions.push({ key: "injuryPain", label: `${capitalize(injuredPart)} pain (0–10)`, options: Array.from({ length: 11 }, (_, v) => [v, String(v)]) });
  }
  return questions;
}

function feelRated(dateStr, itemId) {
  return feelLog().some((r) => r.date === dateStr && r.itemId === itemId);
}

/* Each answer is saved with what was eaten in the 4 hours before the
   game/lift, so the Food tab can line fuel up against how it went. */
function renderFeelPanel(dateStr, item) {
  const draft = feelDrafts[item.id] || (feelDrafts[item.id] = {});
  const injury = loadInjury();
  const injuredPart = injuryActive(injury, dateStr) ? injury.part : null;
  // Ending injury mode mid-draft must not leave a pain answer behind.
  if (!injuredPart) delete draft.injuryPain;
  const panel = el("div", "meal-panel feel-panel");
  panel.appendChild(el("div", "meal-name", "How did it go?"));
  for (const q of feelQuestions(item.id, injuredPart)) {
    panel.appendChild(el("div", "feel-label", q.label));
    const row = el("div", "chip-row");
    for (const [value, label] of q.options) {
      const chip = el("button", `chip small${draft[q.key] === value ? " active" : ""}`, label);
      chip.type = "button";
      chip.addEventListener("click", () => {
        draft[q.key] = draft[q.key] === value ? undefined : value;
        renderToday();
      });
      row.appendChild(chip);
    }
    panel.appendChild(row);
  }
  if (draft.injuryPain >= 4) panel.appendChild(el("div", "pain-warning", PAIN_WARNING));
  const note = el("input", "feel-note");
  note.type = "text";
  note.placeholder = "Note (optional)";
  note.value = draft.note || "";
  note.addEventListener("input", () => { draft.note = note.value; });
  panel.appendChild(note);

  const items = scheduleFor(dateStr);
  const ate = [...new Set(foodsBefore(foodLog(), items, dateStr, item.time).map((e) => e.name))];
  panel.appendChild(el("div", "meal-detail", ate.length
    ? `Ate in the 4 hours before: ${ate.join(", ")}`
    : "Nothing logged in the 4 hours before. Log it first so this links up."));

  const actions = el("div", "meal-actions");
  const skip = el("button", "pill-btn", "Skip");
  skip.type = "button";
  skip.addEventListener("click", () => {
    feelOpenFor = null;
    renderToday();
  });
  const save = el("button", "pill-btn dark", "Save");
  save.type = "button";
  save.disabled = !["energy", "stomach", "legs", "performance", "injuryPain"].some((k) => draft[k] !== undefined);
  save.addEventListener("click", () => {
    const log = feelLog();
    const pain = draft.injuryPain;
    log.push({
      id: newId(), date: dateStr, itemId: item.id, kind: item.id, at: Date.now(),
      energy: draft.energy, stomach: draft.stomach, legs: draft.legs, performance: draft.performance,
      injuryPain: pain, injuryPart: pain === undefined ? undefined : injuredPart,
      note: (draft.note || "").trim() || undefined, ate,
      workoutId: item.id === "lift" && typeof liftSessionId === "function" ? liftSessionId(dateStr) : undefined,
    });
    saveJSON(FEEL_LOG_KEY, log);
    delete feelDrafts[item.id];
    feelOpenFor = null;
    refreshFood();
    if (pain !== undefined && injuryPainFlag(log, dateStr, pain, injuredPart)) showToast(PAIN_WARNING);
  });
  actions.append(skip, save);
  panel.appendChild(actions);
  return panel;
}

/* ---- Today: the four rings (calories, protein, water, pouches) ----
   Built once and updated in place so the arcs animate between values.
   Tapping a ring opens its detail drawer underneath. */

const RING_R = 28;
const RING_C = 2 * Math.PI * RING_R;
const RING_KEYS = ["kcal", "protein", "water", "pouch"];
const RING_LABELS = { kcal: "Calories", protein: "Protein", water: "Water", pouch: "Pouches" };
const RING_COLORS = { kcal: "--food", protein: "--protein", water: "--water", pouch: "--habits" };
let openRing = null;
const ringFractions = {}; // last fraction drawn per ring, to spot a goal being hit

function buildRings(row) {
  row.innerHTML = "";
  for (const key of RING_KEYS) {
    const tile = el("button", "ring-tile");
    tile.type = "button";
    tile.dataset.ring = key;
    tile.style.setProperty("--ring", `var(${RING_COLORS[key]})`);
    tile.innerHTML =
      `<div class="ring"><svg viewBox="0 0 66 66">` +
      `<circle class="ring-track" cx="33" cy="33" r="${RING_R}" stroke-width="8"></circle>` +
      `<circle class="ring-fill" cx="33" cy="33" r="${RING_R}" stroke-width="8" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"></circle>` +
      `</svg><div class="ring-center"><span class="ring-value"></span><span class="ring-unit"></span></div></div>` +
      `<div class="ring-label">${RING_LABELS[key]}</div><div class="ring-sub"></div>`;
    tile.addEventListener("click", () => {
      openRing = openRing === key ? null : key;
      haptic();
      renderFuelRow(todayLocalDateString());
    });
    row.appendChild(tile);
  }
  const detail = el("div", "ring-detail");
  detail.style.gridColumn = "1 / -1";
  row.appendChild(detail);
}

function ringData(dateStr) {
  const s = foodSettings();
  const log = foodLog();
  const totals = dayTotals(log, dateStr);
  const g = dailyGuide(s, log, dateStr);
  const discovery = inDiscovery(s, dateStr);
  const drank = waterTotal(waterLog(), dateStr);
  const waterGoalOz = waterGoalFor(dateStr);
  const step = taperStepFor(localStorage.getItem(TAPER_START_KEY), dateStr);
  const used = pouchesByDate()[dateStr] || 0;
  const allowance = step ? step.allowance : null;
  return {
    s, log, totals, g, discovery, drank, waterGoalOz, step, used,
    kcal: {
      value: fmt(totals.kcal), unit: "kcal", sub: `of ${fmt(g.guide)}`,
      fraction: totals.kcal / g.guide,
      color: !discovery && totals.kcal > g.guide ? "--warn" : null,
    },
    protein: {
      value: fmt(totals.protein), unit: "g", sub: `of ${fmt(s.protein)} g`,
      fraction: totals.protein / s.protein, done: totals.protein >= s.protein,
    },
    water: {
      value: fmt(drank), unit: "oz", sub: `of ${fmt(waterGoalOz)}`,
      fraction: drank / waterGoalOz, done: drank >= waterGoalOz,
    },
    pouch: allowance === null
      ? { value: `${used}`, unit: "today", sub: "no taper", fraction: 0 }
      : allowance === 0
        ? { value: `${used}`, unit: "today", sub: "goal 0", fraction: 1, color: used > 0 ? "--danger" : null }
        : {
            value: `${used}`, unit: "today", sub: `of ${allowance}`,
            fraction: used / allowance, color: used > allowance ? "--danger" : null,
          },
  };
}

function renderFuelRow(dateStr) {
  const row = document.getElementById("today-fuel");
  if (!row) return;
  if (!row.querySelector(".ring-tile")) buildRings(row);
  const d = ringData(dateStr);

  for (const key of RING_KEYS) {
    const r = d[key];
    const tile = row.querySelector(`.ring-tile[data-ring="${key}"]`);
    tile.style.setProperty("--ring", `var(${r.color || RING_COLORS[key]})`);
    tile.querySelector(".ring-value").textContent = r.value;
    tile.querySelector(".ring-unit").textContent = r.unit;
    tile.querySelector(".ring-sub").textContent = r.sub;
    const fraction = Math.max(0, Math.min(1, r.fraction || 0));
    tile.querySelector(".ring-fill").setAttribute("stroke-dashoffset", String(RING_C * (1 - fraction)));
    tile.classList.toggle("done", Boolean(r.done));
    tile.setAttribute("aria-expanded", String(openRing === key));
    tile.setAttribute("aria-label", `${RING_LABELS[key]}: ${r.value} ${r.unit}, ${r.sub}`);

    // First time today a goal ring closes while the app is open.
    const prev = ringFractions[key];
    ringFractions[key] = r.fraction || 0;
    if (r.done && prev !== undefined && prev < 1 && claimCelebration(dateStr, key)) {
      tile.classList.remove("celebrate");
      void tile.offsetWidth;
      tile.classList.add("celebrate");
      celebrate(key === "protein" ? "Protein goal hit 💪" : "Water goal hit 💧", cssVar(RING_COLORS[key]));
    }
  }

  const detail = row.querySelector(".ring-detail");
  detail.hidden = !openRing;
  detail.innerHTML = "";
  if (openRing) {
    detail.style.setProperty("--ring", `var(${RING_COLORS[openRing]})`);
    ringDetail(openRing, dateStr, d, detail);
  }
}

function detailStat(wrap, num, unit, cap) {
  const cell = el("div");
  const n = el("div", "detail-num", num);
  if (unit) n.appendChild(el("small", "", unit));
  cell.append(n, el("div", "detail-cap", cap));
  wrap.appendChild(cell);
}

function detailButton(actions, label, dark, onClick) {
  const b = el("button", dark ? "pill-btn dark" : "pill-btn", label);
  b.type = "button";
  b.addEventListener("click", onClick);
  actions.appendChild(b);
}

function ringDetail(key, dateStr, d, detail) {
  const stats = el("div", "detail-stats");
  const actions = el("div", "detail-actions");
  const line = (text) => detail.appendChild(el("p", "detail-line", text));

  if (key === "kcal") {
    const left = d.g.guide - d.totals.kcal;
    detailStat(stats, fmt(d.totals.kcal), "kcal", "Eaten");
    detailStat(stats, fmt(Math.abs(left)), "kcal", left >= 0 ? "Left today" : "Over today");
    detail.appendChild(stats);
    line(`This week: ${fmt(Math.max(0, d.g.weekLeft))} kcal left over ${d.g.daysLeft} day${d.g.daysLeft === 1 ? "" : "s"}.` +
      (d.discovery ? " Discovery phase: log honestly, no judging yet." : ""));
    detailButton(actions, "Log food", true, () => openFoodSheet({}));
    detailButton(actions, "Food diary", false, () => activateTab("food-panel"));
  } else if (key === "protein") {
    detailStat(stats, fmt(d.totals.protein), "g", "Eaten");
    detailStat(stats, fmt(Math.max(0, d.s.protein - d.totals.protein)), "g", "To go");
    detail.appendChild(stats);
    line(d.protein.done
      ? "Target hit for today."
      : "Protein builds through the day; it's judged at 8 PM.");
    detailButton(actions, "Log food", true, () => openFoodSheet({}));
  } else if (key === "water") {
    detail.appendChild(waterCell(dateStr));
    return;
  } else {
    if (!d.step) {
      detailStat(stats, `${d.used}`, "", "Pouches today");
      detail.appendChild(stats);
      line(localStorage.getItem(TAPER_START_KEY) ? "Your taper hasn't started yet. Log now to see your baseline." : "No taper set up yet.");
    } else {
      const left = d.step.allowance - d.used;
      detailStat(stats, `${d.used}`, "", "Used today");
      detailStat(stats, `${Math.abs(left)}`, "", left >= 0 ? "Left today" : "Over limit");
      detail.appendChild(stats);
      const last = lastPouchAt(loadJSON(HABIT_LOG_KEY, []));
      line((d.step.allowance === 0 ? "Quit phase." : `Week ${d.step.week} · ${d.step.mg} mg.`) +
        (last === null ? "" : ` Last pouch ${formatGap(Math.max(0, Math.floor((Date.now() - last) / 60000)))} ago.`));
    }
    detailButton(actions, "Log a pouch", true, logPouch);
    detailButton(actions, "Craving", false, () => openQuickAdd("craving"));
    detailButton(actions, "Details", false, () => activateTab("habits-panel"));
  }
  detail.appendChild(actions);
}

/* ---- Water (Today fuel row) ---- */

function waterGoalFor(dateStr) {
  const type = dayType(scheduleFor(dateStr));
  return waterGoal(foodSettings(), latestWeight(), type);
}

function waterCell(dateStr) {
  const drank = waterTotal(waterLog(), dateStr);
  const goal = waterGoalFor(dateStr);
  const cell = el("div", "fuel-cell water-cell");
  const head = el("div", "fuel-head");
  head.appendChild(el("span", "fuel-label", "Water"));
  head.appendChild(el("span", "fuel-value", `${fmt(drank)} / ${fmt(goal)} oz`));
  cell.append(head, bar(drank / goal, drank >= goal ? "good" : "neutral"));
  const buttons = el("div", "water-buttons");
  for (const oz of WATER_BUTTONS) {
    const btn = el("button", "chip small", `+${oz} oz`);
    btn.type = "button";
    btn.addEventListener("click", () => addWater(dateStr, oz));
    buttons.appendChild(btn);
  }
  if (drank > 0) {
    const undo = el("button", "link-btn water-undo", "Undo");
    undo.type = "button";
    undo.addEventListener("click", () => undoWater(dateStr));
    buttons.appendChild(undo);
  }
  cell.appendChild(buttons);
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
  return cell;
}

function addWater(dateStr, oz) {
  const log = waterLog();
  const id = newId();
  log.push({ id, at: Date.now(), date: dateStr, oz });
  saveJSON(WATER_LOG_KEY, log);
  haptic();
  showToast(`+${oz} oz water · ${fmt(waterTotal(log, dateStr))} of ${fmt(waterGoalFor(dateStr))}`, () => {
    saveJSON(WATER_LOG_KEY, waterLog().filter((e) => e.id !== id));
    renderToday();
  });
  renderToday();
}

function undoWater(dateStr) {
  const log = waterLog();
  const i = log.map((e) => e.date).lastIndexOf(dateStr);
  if (i < 0) return;
  log.splice(i, 1);
  saveJSON(WATER_LOG_KEY, log);
  renderToday();
}

function bar(fraction, status) {
  const track = el("div", "mini-bar");
  const fill = el("div", `mini-bar-fill ${status}`);
  fill.style.width = `${Math.min(100, Math.max(0, fraction * 100))}%`;
  track.appendChild(fill);
  return track;
}

/* ---- Food tab ---- */

const MIN_SIGNALS_JUDGED_AT = 20 * 60; // 8 PM

/* Protein and fiber build up over the day, so a low number at 9 AM
   isn't a miss: they stay neutral until 8 PM or until the day is
   closed. Limits (sugar, sodium) are judged right away. */
function dayStatus(key, value, s, discovery, dateStr, days) {
  const status = signalStatus(key, value, s, discovery);
  const isMin = key === "protein" || key === "fiber";
  const judged = dateStr < todayLocalDateString() || (days[dateStr] && days[dateStr].complete) || minutesNow() >= MIN_SIGNALS_JUDGED_AT;
  return isMin && status !== "good" && !judged ? "neutral" : status;
}

function renderFood() {
  const today = todayLocalDateString();
  const s = foodSettings();
  const log = foodLog();
  const days = foodDays();
  const discovery = inDiscovery(s, today);
  const totals = dayTotals(log, today);
  const g = dailyGuide(s, log, today);

  // Hero
  document.getElementById("food-kcal").textContent = fmt(totals.kcal);
  document.getElementById("food-sub").textContent =
    `of ${fmt(g.guide)} kcal today · ${fmt(Math.max(0, g.weekLeft))} left this week (${g.daysLeft} day${g.daysLeft === 1 ? "" : "s"})`;
  const kcalBar = document.getElementById("food-kcal-bar");
  kcalBar.style.width = `${Math.min(100, (totals.kcal / g.guide) * 100)}%`;
  kcalBar.classList.toggle("warn", !discovery && totals.kcal > g.guide);
  const protein = document.getElementById("food-protein");
  protein.innerHTML = "";
  const ph = el("div", "fuel-head");
  ph.appendChild(el("span", "fuel-label", "Protein"));
  ph.appendChild(el("span", "fuel-value", `${fmt(totals.protein)} / ${s.protein} g`));
  protein.append(ph, bar(totals.protein / s.protein, dayStatus("protein", totals.protein, s, discovery, today, days)));

  const badge = document.getElementById("food-badge");
  if (discovery) {
    const day = daysBetween(s.startDate, today) + 1;
    badge.textContent = `Discovery · day ${day} of 14. Log honestly — no judging yet. This measures what you really eat.`;
  } else if (g.over) {
    badge.textContent = `This week is over budget by ${fmt(-g.weekLeft)} kcal. Don't crash — eat normal meals, protein first.`;
  } else {
    badge.textContent = "";
  }
  const est = estimatedShare(log, today);
  document.getElementById("food-est").textContent = totals.kcal ? `${est}% estimated` : "";

  renderQuickChips(log);
  renderFoodLog(today, log, days);
  renderSignals(today, totals, s, discovery, log, days);
  renderFuelVsFeel();
  renderWeek(today, s, log, days, discovery);
  renderCheckin(today, s, log, days);
  renderTargets(s);
}

function renderQuickChips(log) {
  const row = document.getElementById("food-quick-chips");
  row.innerHTML = "";
  for (const food of foodLibrary().filter((f) => f.drink)) {
    const chip = el("button", "chip drink", `+1 ${food.name}`);
    chip.type = "button";
    chip.addEventListener("click", () => logLibraryFood(food, "extra"));
    row.appendChild(chip);
  }
  for (const e of recentFoods(log.filter((x) => !(x.n.alcohol > 0)), 6)) {
    const chip = el("button", "chip", e.name);
    chip.type = "button";
    chip.addEventListener("click", () => relog(e));
    row.appendChild(chip);
  }
}

function relog(e) {
  logFood({ slot: "extra", name: e.name, servings: e.servings, n: { ...e.n }, confidence: e.confidence, ref: e.ref });
}

function slotTitles(dateStr) {
  const titles = { extra: "Other" };
  for (const item of scheduleFor(dateStr)) titles[item.id] = item.title;
  return titles;
}

/* Four sections in meal order (spec B2). Each shows its subtotal and a
   + Add that opens the sheet on that meal; empty ones show just the header. */
function renderFoodLog(today, log, days) {
  const list = document.getElementById("food-log-list");
  list.innerHTML = "";
  const entries = log.filter((e) => e.date === today).sort((a, b) => a.at - b.at);
  const titles = slotTitles(today);
  for (const meal of MEALS) {
    const mine = entries.filter((e) => mealForEntry(e) === meal);
    const section = el("section", "meal-section");
    section.dataset.meal = meal;
    const head = el("div", "meal-head");
    head.appendChild(el("span", "meal-title", MEAL_LABELS[meal]));
    if (mine.length) {
      const t = sumNutrients(mine.map(entryTotal));
      head.appendChild(el("span", "meal-sub", `${fmt(t.kcal)} kcal · ${fmt(t.protein)} g P`));
    }
    const add = el("button", "chip small meal-add", "+ Add");
    add.type = "button";
    add.addEventListener("click", () => openFoodSheet({ meal, title: `Add to ${MEAL_LABELS[meal].toLowerCase()}` }));
    head.appendChild(add);
    section.appendChild(head);
    if (mine.length) {
      const ul = el("ul", "food-log");
      for (const e of mine) ul.appendChild(foodEntryRow(e, titles));
      section.appendChild(ul);
    }
    list.appendChild(section);
  }
  document.getElementById("food-complete").checked = Boolean(days[today] && days[today].complete);
}

function foodEntryRow(e, titles) {
  const li = el("li", "food-entry");
  li.tabIndex = 0;
  const main = el("div", "food-entry-main");
  main.appendChild(el("div", "food-entry-name", `${e.name}${e.servings !== 1 ? ` × ${e.servings}` : ""}`));
  // The section says which meal; a checklist slot's title still shows.
  const meta = [timeOnDate(e.at, e.date), e.slot !== "extra" && titles[e.slot], e.confidence !== "exact" && "estimate"];
  main.appendChild(el("div", "food-entry-meta", meta.filter(Boolean).join(" · ")));
  const t = entryTotal(e);
  const nums = el("div", "food-entry-nums");
  nums.appendChild(el("div", "food-entry-kcal", fmt(t.kcal)));
  nums.appendChild(el("div", "food-entry-meta", `${fmt(t.protein)} g P`));
  li.append(main, nums);
  li.addEventListener("click", () => openEditEntry(e));
  return li;
}

const SIGNALS = [
  { key: "fiber", label: "Fiber", unit: "g", goal: (s) => s.limits.fiber, kind: "min" },
  { key: "addedSugar", label: "Added sugar", unit: "g", goal: (s) => s.limits.addedSugar, kind: "max" },
  { key: "sodium", label: "Sodium", unit: "mg", goal: (s) => s.limits.sodium, kind: "max" },
  { key: "upfPct", label: "Ultra-processed", unit: "% of kcal", goal: (s) => s.limits.upfPct ?? UPF_LIMIT_PCT, kind: "max",
    value: (log, today) => upfShare(log, today) },
];

function renderSignals(today, totals, s, discovery, log, days) {
  const list = document.getElementById("food-signals");
  list.innerHTML = "";
  for (const sig of SIGNALS) {
    const goal = sig.goal(s);
    const value = sig.value ? sig.value(log, today) : totals[sig.key];
    const status = dayStatus(sig.key, value, s, discovery, today, days);
    const li = el("li", `signal ${status}`);
    const head = el("div", "fuel-head");
    head.appendChild(el("span", "fuel-label", sig.label));
    head.appendChild(el("span", "fuel-value", sig.key === "upfPct"
      ? `${value}% of kcal / ${goal}% max`
      : `${fmt(value)} ${sig.kind === "min" ? "of" : "/"} ${fmt(goal)} ${sig.unit}${sig.kind === "max" ? " max" : ""}`));
    li.append(head, bar(value / (sig.kind === "max" ? goal * 1.5 : goal), status));
    list.appendChild(li);
  }
  renderShakeNote();
  const alcohol = weekAlcohol(log, today);
  document.getElementById("food-alcohol").textContent = alcohol.drinks
    ? `This week: ${alcohol.drinks} drink${alcohol.drinks === 1 ? "" : "s"} · ${fmt(alcohol.kcal)} kcal from alcohol`
    : "No drinks logged this week.";
}

/* The shake is tagged "processed" assuming a few-ingredient whey. One
   note explains that and lets Sean count it as ultra instead. */
function renderShakeNote() {
  const note = document.getElementById("shake-note");
  const whey = foodLibrary().find((f) => f.id === "on-whey");
  note.hidden = !whey || localStorage.getItem(SHAKE_NOTE_KEY) === "1";
}

document.getElementById("shake-note-ok").addEventListener("click", () => {
  localStorage.setItem(SHAKE_NOTE_KEY, "1");
  renderFood();
});

document.getElementById("shake-note-ultra").addEventListener("click", () => {
  setFoodProcessing("on-whey", "ultra");
  localStorage.setItem(SHAKE_NOTE_KEY, "1");
  refreshFood();
});

function setFoodProcessing(foodId, tag) {
  const lib = foodLibrary();
  const food = lib.find((f) => f.id === foodId);
  if (!food) return;
  food.processing = tag;
  food.processingSet = true; // survives a seed correction (mergeSeed)
  saveJSON(FOOD_LIBRARY_KEY, lib);
}

const FUEL_FEEL_MIN_RATINGS = 3;
const STOMACH_LABELS = { right: "just right", full: "too full", hungry: "hungry" };

function renderFuelVsFeel() {
  const records = feelLog();
  const card = document.getElementById("food-feel");
  card.hidden = records.length < FUEL_FEEL_MIN_RATINGS;
  if (card.hidden) return;
  const list = document.getElementById("food-feel-list");
  list.innerHTML = "";
  for (const row of fuelVsFeel(records).slice(0, 8)) {
    const parts = [`${row.count}×`];
    if (row.energy !== null) parts.push(`energy ${row.energy}`);
    const answered = row.stomach.right + row.stomach.full + row.stomach.hungry;
    if (answered) {
      const [top, n] = Object.entries(row.stomach).sort((a, b) => b[1] - a[1])[0];
      parts.push(`${STOMACH_LABELS[top]} ${n}/${answered}`);
    }
    const li = el("li", "feel-row");
    li.appendChild(el("span", "pick-name", row.name));
    li.appendChild(el("span", "pick-meta", parts.join(" · ")));
    list.appendChild(li);
  }
}

function renderWeek(today, s, log, days, discovery) {
  const list = document.getElementById("food-week");
  list.innerHTML = "";
  // Future days show today's base guide plus their own bank. Asking
  // dailyGuide about a future date would treat today's half-eaten
  // total as final and inflate everything after it.
  const bankFor = (d) => (s.bank && s.bank[parseLocalDate(d).getDay()]) || 0;
  const todayGuide = dailyGuide(s, log, today);
  const base = todayGuide.guide - bankFor(today);
  for (const d of weekDates(today)) {
    const future = d > today;
    const before = s.startDate && d < s.startDate;
    const t = dayTotals(log, d);
    const guide = future ? Math.max(GUIDE_FLOOR, base + bankFor(d)) : dailyGuide(s, log, d).guide;
    const li = el("li", `week-row${future ? " future" : ""}${d === today ? " today" : ""}`);
    li.appendChild(el("span", "week-day", parseLocalDate(d).toLocaleDateString(undefined, { weekday: "short" })));
    const status = !discovery && t.kcal > guide * 1.1 ? "warn" : "neutral";
    li.appendChild(bar(future || before ? 0 : t.kcal / guide, status));
    li.appendChild(el("span", "week-kcal", future ? fmt(guide) : before ? "—" : fmt(t.kcal)));
    const hit = !future && !before && t.protein >= s.protein;
    li.appendChild(el("span", `week-protein${hit ? " hit" : ""}`, ""));
    const done = Boolean(days[d] && days[d].complete);
    const mark = el("button", `week-complete${done ? " done" : ""}`, done ? "✓" : "");
    mark.type = "button";
    mark.disabled = future || before;
    mark.setAttribute("aria-label", done ? "Mark day not fully logged" : "Mark day fully logged");
    mark.addEventListener("click", () => closeFoodLog(d, !done));
    li.appendChild(mark);
    list.appendChild(li);
  }
}

/* ---- Weekly check-in ---- */

function renderCheckin(today, s, log, days) {
  const card = document.getElementById("food-checkin");
  const body = document.getElementById("food-checkin-body");
  const week = weekDates(today)[0];
  const seen = loadJSON(FOOD_CHECKIN_KEY, {});
  const isSunday = parseLocalDate(today).getDay() === 0;
  const p = proposeMaintenance(s, log, days, loadEntries(), today);
  const goalPrompt = s.goal.mode === "maintain" && !s.goalPromptAnswered && s.startDate &&
    daysBetween(s.startDate, today) >= GOAL_PROMPT_AFTER_DAYS;
  const proposal = p.ready && p.worth && !seen[week];

  body.innerHTML = "";
  card.hidden = !(isSunday || proposal || goalPrompt);
  if (card.hidden) return;

  if (goalPrompt) {
    body.appendChild(el("p", "lead", "About 7 weeks in — the Zyn taper should be wrapping up. Time to pick the next goal?"));
    const row = el("div", "chip-row");
    for (const opt of [GOAL_OPTIONS[2], GOAL_OPTIONS[3], GOAL_OPTIONS[4]]) {
      const chip = el("button", "chip", opt.label);
      chip.type = "button";
      chip.addEventListener("click", () => {
        saveSettings({ ...s, goal: { mode: opt.mode, rateLbPerWk: opt.rate }, goalPromptAnswered: true }, `Goal set to ${opt.label}`);
      });
      row.appendChild(chip);
    }
    body.appendChild(row);
  }

  if (!p.ready) {
    const needDays = Math.max(0, 10 - p.completeDays);
    const needWeighs = Math.max(0, 8 - p.weighIns);
    body.appendChild(el("p", "hint",
      `Learning your real maintenance: ${p.completeDays}/10 fully-logged days and ${p.weighIns}/8 weigh-ins over the last 3 weeks.` +
      (needDays || needWeighs ? ` Need ${[needDays && `${needDays} more logged days`, needWeighs && `${needWeighs} more weigh-ins`].filter(Boolean).join(" and ")}.` : " Weigh-ins need to span at least 2 weeks.")));
    return;
  }

  const trend = p.lbPerWeek === 0 ? "holding steady" : `${p.lbPerWeek > 0 ? "up" : "down"} ${Math.abs(p.lbPerWeek)} lb/week`;
  const explain = `You averaged ${fmt(p.avgIntake)} kcal on ${p.completeDays} fully-logged days while your weight trended ${trend}. That puts real maintenance near ${fmt(p.observed)}.`;
  if (!proposal) {
    body.appendChild(el("p", "hint", `${explain} ${seen[week] ? "Already reviewed this week." : `Current estimate (${fmt(s.maintenance)}) is close enough — no change.`}`));
    return;
  }
  body.appendChild(el("p", "lead", `${explain} Suggest moving maintenance ${fmt(s.maintenance)} → ${fmt(p.proposed)} (${p.delta > 0 ? "+" : ""}${p.delta}).`));
  const pair = el("div", "button-pair");
  const keep = el("button", "secondary-btn", "Keep");
  keep.type = "button";
  const accept = el("button", "primary-btn", "Accept");
  accept.type = "button";
  const decide = (accepted) => {
    seen[week] = accepted ? "accepted" : "kept";
    saveJSON(FOOD_CHECKIN_KEY, seen);
    const reason = `Check-in: intake ${fmt(p.avgIntake)}, trend ${trend}`;
    if (accepted) saveSettings({ ...s, maintenance: p.proposed }, reason);
    else recordHistory(s, `${reason} (kept ${fmt(s.maintenance)})`, false);
    refreshFood();
  };
  keep.addEventListener("click", () => decide(false));
  accept.addEventListener("click", () => decide(true));
  pair.append(keep, accept);
  body.appendChild(pair);
}

function recordHistory(s, reason, accepted) {
  const history = loadJSON(FOOD_HISTORY_KEY, []);
  history.push({ date: todayLocalDateString(), maintenance: s.maintenance, target: targetCalories(s), reason, accepted });
  saveJSON(FOOD_HISTORY_KEY, history);
}

function saveSettings(next, reason) {
  saveJSON(FOOD_SETTINGS_KEY, next);
  recordHistory(next, reason, true);
  refreshFood();
}

/* ---- Targets / settings ---- */

let settingsOpen = false;

function renderTargets(s) {
  const goal = GOAL_OPTIONS.find((o) => o.rate === s.goal.rateLbPerWk) || GOAL_OPTIONS[3];
  document.getElementById("food-targets-summary").textContent =
    `${goal.label} · ${fmt(targetCalories(s))} kcal/day (maintenance ${fmt(s.maintenance)}) · ${s.protein} g protein · water ${fmt(waterGoalFor(todayLocalDateString()))} oz today`;
  document.getElementById("food-settings-btn").textContent = settingsOpen ? "Close" : "Edit";
  const form = document.getElementById("food-settings-form");
  form.hidden = !settingsOpen;
  if (!settingsOpen) return;

  const select = document.getElementById("fs-goal");
  if (!select.options.length) {
    GOAL_OPTIONS.forEach((o, i) => select.appendChild(new Option(o.label, String(i))));
  }
  select.value = String(GOAL_OPTIONS.indexOf(goal));
  const fields = {
    "fs-maintenance": s.maintenance, "fs-protein": s.protein, "fs-fiber": s.limits.fiber,
    "fs-sugar": s.limits.addedSugar, "fs-sodium": s.limits.sodium, "fs-bank-sat": s.bank[6] || 0,
    "fs-bank-sun": s.bank[0] || 0, "fs-upf": s.limits.upfPct ?? UPF_LIMIT_PCT, "fs-age": s.profile.age, "fs-height": s.profile.heightCm,
    "fs-activity": s.profile.activity, "fs-water-base": waterSettings(s).base ?? "",
    "fs-water-lift": waterSettings(s).lift, "fs-water-game": waterSettings(s).game,
  };
  for (const [id, value] of Object.entries(fields)) document.getElementById(id).value = value;

  renderMealEditor("food-meal-editor", FOOD_MEALS_KEY);
  renderMealEditor("food-idea-editor", FOOD_IDEAS_KEY);
  const history = document.getElementById("food-history");
  history.innerHTML = "";
  for (const h of loadJSON(FOOD_HISTORY_KEY, []).slice(-8).reverse()) {
    history.appendChild(el("li", "", `${formatDate(h.date)} · ${fmt(h.target)} kcal · ${h.reason}`));
  }
}

/* Servings editor for saved meals or snack ideas (same shape). */
function renderMealEditor(wrapId, key) {
  const wrap = document.getElementById(wrapId);
  wrap.innerHTML = "";
  const lib = Object.fromEntries(foodLibrary().map((f) => [f.id, f]));
  const meals = loadJSON(key, []);
  meals.forEach((meal, mi) => {
    const box = el("div", "meal-edit");
    box.appendChild(el("div", "meal-name", meal.name));
    meal.items.forEach((item, ii) => {
      const food = lib[item.foodId];
      if (!food) return;
      const row = el("label", "meal-edit-row");
      row.appendChild(el("span", "", `${food.name} (${food.serving})`));
      const input = el("input");
      input.type = "number";
      input.inputMode = "decimal";
      input.step = "0.125";
      input.min = "0";
      input.value = item.servings;
      input.addEventListener("change", () => {
        const v = parseFloat(input.value);
        if (!Number.isFinite(v) || v < 0) return;
        const all = loadJSON(key, []);
        all[mi].items[ii].servings = v;
        saveJSON(key, all);
        renderToday();
      });
      row.appendChild(input);
      box.appendChild(row);
    });
    wrap.appendChild(box);
  });
}

document.getElementById("food-settings-btn").addEventListener("click", () => {
  settingsOpen = !settingsOpen;
  renderFood();
});

document.getElementById("fs-recalc").addEventListener("click", () => {
  const weight = latestWeight();
  if (!weight) return;
  const profile = readProfile(foodSettings().profile);
  document.getElementById("fs-maintenance").value = startingMaintenance(profile, weight);
});

function readProfile(fallback) {
  const num = (id, f) => { const v = parseFloat(document.getElementById(id).value); return Number.isFinite(v) ? v : f; };
  return { ...fallback, age: num("fs-age", fallback.age), heightCm: num("fs-height", fallback.heightCm), activity: num("fs-activity", fallback.activity) };
}

document.getElementById("food-settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const s = foodSettings();
  const num = (id, f) => { const v = parseFloat(document.getElementById(id).value); return Number.isFinite(v) ? v : f; };
  const goal = GOAL_OPTIONS[Number(document.getElementById("fs-goal").value)] || GOAL_OPTIONS[3];
  const next = {
    ...s,
    profile: readProfile(s.profile),
    goal: { mode: goal.mode, rateLbPerWk: goal.rate },
    goalPromptAnswered: s.goalPromptAnswered || goal.mode !== "maintain",
    maintenance: num("fs-maintenance", s.maintenance),
    protein: num("fs-protein", s.protein),
    limits: {
      fiber: num("fs-fiber", s.limits.fiber), addedSugar: num("fs-sugar", s.limits.addedSugar),
      sodium: num("fs-sodium", s.limits.sodium), upfPct: num("fs-upf", s.limits.upfPct ?? UPF_LIMIT_PCT),
    },
    bank: { 6: num("fs-bank-sat", s.bank[6] || 0), 0: num("fs-bank-sun", s.bank[0] || 0) },
    // Blank base = half bodyweight (waterGoal).
    water: { base: num("fs-water-base", null), lift: num("fs-water-lift", waterSettings(s).lift), game: num("fs-water-game", waterSettings(s).game) },
  };
  settingsOpen = false;
  saveSettings(next, "Edited in settings");
});

document.getElementById("food-complete").addEventListener("change", (e) => {
  closeFoodLog(todayLocalDateString(), e.target.checked);
});

/* ---- Picker sheet (quick add / takeout / chains / my foods) ---- */

const foodSheet = document.getElementById("food-sheet");
let sheetSlot = "extra";
/* One tray per slot, in memory: closing the sheet (button or swipe) keeps
   it, so reopening the same slot shows the same picks. sheetTray is the
   open picker's tray, and null while the sheet edits an entry. */
const trays = {};
let sheetTray = null;

const SHEET_MODES = [
  ["search", "Search"], ["quick", "Quick add"], ["takeout", "Takeout"], ["chains", "Chains"], ["mine", "My foods"],
];

function openFoodSheet({ slot = "extra", title = "Log food", mode = "search", meal } = {}) {
  sheetSlot = slot;
  sheetTray = trays[slot] || (trays[slot] = { items: [], meal: null, at: null });
  // A section's + Add names its meal; an empty tray takes the default.
  if (meal) sheetTray.meal = meal;
  else if (!sheetTray.items.length) sheetTray.meal = mealForSlot(slot, minutesNow());
  document.getElementById("food-sheet-title").textContent = title;
  renderSheet(mode);
  renderTray();
  foodSheet.hidden = false;
  fitSheetToKeyboard();
}

function closeFoodSheet() {
  // Hiding a focused search box doesn't always drop the iOS keyboard.
  if (foodSheet.contains(document.activeElement)) document.activeElement.blur();
  foodSheet.hidden = true;
  foodSheet.classList.remove("keyboard-up");
}

/* iOS doesn't shrink the layout viewport for the keyboard, so a sheet
   pinned to the bottom slides under it and jumps around as the results
   change height. While the keyboard is up, the sheet fills the visible
   area above it at a fixed height instead, and its body scrolls. */
function fitSheetToKeyboard() {
  const vv = window.visualViewport;
  if (!vv || foodSheet.hidden) return;
  const keyboardUp = document.documentElement.clientHeight - vv.height > 120;
  foodSheet.classList.toggle("keyboard-up", keyboardUp);
  foodSheet.style.setProperty("--vv-top", `${vv.offsetTop}px`);
  foodSheet.style.setProperty("--vv-height", `${vv.height}px`);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitSheetToKeyboard);
  window.visualViewport.addEventListener("scroll", fitSheetToKeyboard);
}

function closeMealPanel() {
  if (typeof mealOpenFor !== "undefined") mealOpenFor = null;
}

function renderSheet(mode) {
  const tabs = document.getElementById("food-sheet-tabs");
  tabs.innerHTML = "";
  for (const [id, label] of SHEET_MODES) {
    const chip = el("button", `chip small${id === mode ? " active" : ""}`, label);
    chip.type = "button";
    chip.addEventListener("click", () => renderSheet(id));
    tabs.appendChild(chip);
  }
  const body = document.getElementById("food-sheet-body");
  body.innerHTML = "";
  if (mode === "search") renderSearch(body);
  else if (mode === "quick") renderQuickAdd(body);
  else if (mode === "takeout") renderTakeout(body);
  else if (mode === "chains") renderFoodList(body, foodLibrary().filter((f) => f.group === "chain"));
  else renderMine(body);
}

function pickRow(name, meta, onPick) {
  const row = el("button", "pick-row");
  row.type = "button";
  row.appendChild(el("span", "pick-name", name));
  row.appendChild(el("span", "pick-meta", meta));
  row.addEventListener("click", onPick);
  return row;
}

/* ---- Tray (spec B1): picks collect here and log together ---- */

const foodPick = (food) => ({ key: trayKey({ food: food.id }), name: food.name, n: foodNutrients(food), confidence: food.confidence, ref: { food: food.id } });

function mealPick(meal) {
  const { n, confidence } = mealNutrients(meal, foodLibrary(), []);
  const ref = { meal: meal.id, addons: [] };
  return { key: trayKey(ref), name: meal.name, n, confidence, ref };
}

/* A past entry comes back with its own servings and numbers. */
const entryPick = (e) => ({ key: trayKey(e.ref, e.name, e.n), name: e.name, servings: e.servings, n: { ...e.n }, confidence: e.confidence, ref: e.ref });

function takeoutPick(preset, size, desc) {
  const ref = { takeout: preset.id, size };
  return { key: trayKey(ref), name: `${preset.name} (${desc})`, n: takeoutNutrients(preset, size), confidence: "estimate", ref };
}

function addToTray(pick) {
  sheetTray.items = trayAdd(sheetTray.items, pick);
  renderTray();
  haptic();
}

function trayButton(className, text, label, onClick) {
  const btn = el("button", className, text);
  btn.type = "button";
  btn.setAttribute("aria-label", label);
  btn.addEventListener("click", onClick);
  return btn;
}

function renderTray() {
  document.getElementById("food-tray").hidden = !sheetTray;
  const list = document.getElementById("food-tray-items");
  list.innerHTML = ""; // no stale rows, even hidden ones, once a tray is gone
  if (!sheetTray) return;
  const { items } = sheetTray;
  for (const chip of document.getElementById("food-tray-meals").children) {
    chip.classList.toggle("active", chip.dataset.meal === sheetTray.meal);
  }
  const atInput = document.getElementById("food-tray-at");
  // Follows the clock until Sean edits it.
  if (document.activeElement !== atInput) atInput.value = sheetTray.at || timeInputValue(Date.now());
  const empty = !items.length;
  document.getElementById("food-tray-hint").hidden = !empty;
  for (const id of ["food-tray-summary", "food-tray-details", "food-tray-log"]) document.getElementById(id).hidden = empty;
  if (empty) return;
  const t = trayTotals(items);
  const count = `${t.count} item${t.count === 1 ? "" : "s"}`;
  document.getElementById("food-tray-summary").textContent = `${count} · ${fmt(t.kcal)} kcal · ${fmt(t.protein)} g P`;
  document.getElementById("food-tray-log").textContent = `Log ${count}`;
  for (const it of items) {
    const row = el("li", "tray-item");
    const step = (delta) => () => {
      sheetTray.items = trayStep(sheetTray.items, it.key, delta);
      renderTray();
    };
    row.append(
      el("span", "tray-name", it.name),
      trayButton("tray-step", "−", "Fewer", step(-0.5)),
      el("span", "tray-servings", `× ${fmtQty(it.servings)}`),
      trayButton("tray-step", "+", "More", step(0.5)),
      trayButton("tray-remove", "✕", "Remove", () => {
        sheetTray.items = trayRemove(sheetTray.items, it.key);
        renderTray();
      }),
    );
    list.appendChild(row);
  }
}

/* One entry per row, sharing a meal group, meal, time and slot. The slot
   is checked off once, and Undo puts back whatever it was before. */
function logTray() {
  const tray = sheetTray;
  const slot = sheetSlot;
  if (!tray || !tray.items.length) return;
  const date = todayLocalDateString();
  const at = atOnDate(date, tray.at) ?? Date.now();
  const group = newId();
  const log = foodLog();
  for (const it of tray.items) {
    log.push({ id: newId(), date, at, slot, name: it.name, servings: it.servings, n: it.n, confidence: it.confidence, ref: it.ref, meal: tray.meal, mealGroup: group });
  }
  saveJSON(FOOD_LOG_KEY, log);
  const prev = loadJSON(CHECKINS_KEY, {})[`${date}|${slot}`] || null;
  if (slot !== "extra") setCheckin(date, slot, { status: "done", at: Date.now() });
  const t = trayTotals(tray.items);
  delete trays[slot];
  sheetTray = null;
  renderTray();
  closeFoodSheet();
  closeMealPanel();
  refreshFood();
  haptic();
  showToast(`Logged ${t.count} item${t.count === 1 ? "" : "s"} · ${fmt(t.kcal)} kcal`, () => {
    saveJSON(FOOD_LOG_KEY, foodLog().filter((e) => e.mealGroup !== group));
    if (slot !== "extra") setCheckin(date, slot, prev);
    refreshFood();
  });
}

for (const meal of MEALS) {
  const chip = el("button", "chip small", MEAL_LABELS[meal]);
  chip.type = "button";
  chip.dataset.meal = meal;
  chip.addEventListener("click", () => {
    sheetTray.meal = meal;
    renderTray();
  });
  document.getElementById("food-tray-meals").appendChild(chip);
}
/* Some iOS versions send only "change" from a time field. */
for (const type of ["input", "change"]) {
  document.getElementById("food-tray-at").addEventListener(type, (e) => {
    if (sheetTray) sheetTray.at = e.target.value || null;
  });
}

/* "Ate at" shows the clock until edited; this keeps it current while the
   sheet stays open, and after a trip to another app. Only the field
   changes, so a scrolled tray list stays put. */
function syncTrayClock() {
  const atInput = document.getElementById("food-tray-at");
  if (foodSheet.hidden || !sheetTray || sheetTray.at || document.activeElement === atInput) return;
  atInput.value = timeInputValue(Date.now());
}
setInterval(syncTrayClock, 60000);
document.getElementById("food-tray-log").addEventListener("click", logTray);

/* Search box over past entries, saved meals, foods, chains, and
   takeout (food-core searchFoods). Only the results list re-renders on
   each keystroke, so the input keeps focus and the keyboard stays up. */
function renderSearch(body) {
  const input = el("input", "food-search");
  input.type = "search";
  input.placeholder = "Search foods, meals, past entries";
  input.autocomplete = "off";
  input.enterKeyHint = "search";
  const results = el("div", "search-results");
  const online = el("div", "search-results online-results");
  const refresh = () => {
    renderSearchResults(results, input.value);
    renderOnlineButton(online, input.value);
  };
  input.addEventListener("input", refresh);
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || input.value.trim().length < 2) return;
    e.preventDefault();
    input.blur();
    runOnlineSearch(online, input.value.trim());
  });
  body.append(input, results, online);
  refresh();
  setTimeout(() => input.focus(), 0);
}

/* ---- Online search (USDA FoodData Central via the food-search Edge
   Function; see supabase/functions/food-search) ---- */

const ONLINE_MIN_CHARS = 2;
let onlineSearchSeq = 0; // bumps on every keystroke so stale results are dropped

function renderOnlineButton(wrap, query) {
  onlineSearchSeq++;
  wrap.innerHTML = "";
  const q = query.trim();
  if (q.length < ONLINE_MIN_CHARS) return;
  const btn = el("button", "secondary-btn online-btn", `Search online for “${q}”`);
  btn.type = "button";
  btn.addEventListener("click", () => runOnlineSearch(wrap, q));
  wrap.appendChild(btn);
}

/* Uses the reminders Supabase client (reminders.js, loaded deferred)
   and its anonymous session; the function rejects calls without one. */
async function searchOnline(query) {
  if (typeof remindersDb === "undefined" || !remindersDb) throw new Error("Supabase client not loaded");
  await ensureSession();
  const { data, error } = await remindersDb.functions.invoke("food-search", { body: { q: query } });
  if (error) throw error;
  const seen = new Set();
  return (data.foods || []).map(usdaToFood).filter((f) => {
    const key = `${f.name}|${f.serving}|${f.n.kcal}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function runOnlineSearch(wrap, query) {
  const seq = ++onlineSearchSeq;
  wrap.innerHTML = "";
  wrap.appendChild(el("div", "pick-section", "USDA food database"));
  const status = el("p", "hint", "Searching…");
  wrap.appendChild(status);
  let foods;
  try {
    foods = await searchOnline(query);
  } catch {
    if (seq === onlineSearchSeq) status.textContent = "Couldn't reach the food database. Check your signal, or use Quick add.";
    return;
  }
  if (seq !== onlineSearchSeq) return;
  status.textContent = foods.length
    ? "Picking one also saves it to My foods."
    : `Nothing online for “${query}”. Try fewer or different words, or Quick add.`;
  for (const food of foods) {
    wrap.appendChild(pickRow(food.name, `${food.serving} · ${fmt(food.n.kcal)} kcal · ${fmt(food.n.protein)} g P${food.processing === "ultra" ? " · ultra-processed" : ""}`, () => {
      saveToLibrary(food);
      addToTray(foodPick(food));
    }));
  }
}

function saveToLibrary(food) {
  const lib = foodLibrary();
  if (lib.some((f) => f.id === food.id)) return;
  lib.push({ ...food, favorite: true });
  saveJSON(FOOD_LIBRARY_KEY, lib);
}

function renderSearchResults(wrap, query) {
  wrap.innerHTML = "";
  const found = searchFoods(query, { log: foodLog(), library: foodLibrary(), meals: foodMeals(), presets: TAKEOUT_PRESETS });
  if (!found.length) {
    wrap.appendChild(el("p", "empty-message", query.trim()
      ? `No match for "${query.trim()}". Try Quick add or Takeout.`
      : "Nothing logged yet. Search above, or try Takeout."));
    return;
  }
  if (!query.trim()) wrap.appendChild(el("div", "pick-section", "Recent"));
  for (const r of found) {
    if (r.type === "recent") {
      const e = r.item;
      const t = entryTotal(e);
      wrap.appendChild(pickRow(e.name, `Logged before · ${fmt(t.kcal)} kcal · ${fmt(t.protein)} g P`, () => addToTray(entryPick(e))));
    } else if (r.type === "meal") {
      const { n } = mealNutrients(r.item, foodLibrary(), []);
      wrap.appendChild(pickRow(r.name, `Saved meal · ${fmt(n.kcal)} kcal · ${fmt(n.protein)} g P`, () => addToTray(mealPick(r.item))));
    } else if (r.type === "food") {
      const f = r.item;
      wrap.appendChild(pickRow(f.name, `${f.serving} · ${fmt(f.n.kcal)} kcal · ${fmt(f.n.protein)} g P${f.processing === "ultra" ? " · ultra-processed" : ""}`, () => addToTray(foodPick(f))));
    } else {
      wrap.appendChild(takeoutRow(r.item));
    }
  }
}

function renderFoodList(body, foods) {
  for (const food of foods) {
    body.appendChild(pickRow(food.name, `${food.serving} · ${fmt(food.n.kcal)} kcal · ${fmt(food.n.protein)} g P`, () => addToTray(foodPick(food))));
  }
}

function renderMine(body) {
  body.appendChild(el("div", "pick-section", "Saved meals"));
  for (const meal of foodMeals()) {
    const { n } = mealNutrients(meal, foodLibrary(), []);
    body.appendChild(pickRow(meal.name, `${fmt(n.kcal)} kcal · ${fmt(n.protein)} g P`, () => addToTray(mealPick(meal))));
  }
  body.appendChild(el("div", "pick-section", "Foods"));
  const foods = foodLibrary().filter((f) => f.group !== "chain").sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
  renderFoodList(body, foods);
}

function renderTakeout(body) {
  body.appendChild(el("p", "hint", "No official numbers? Pick the closest size — it's saved as an estimate."));
  for (const preset of TAKEOUT_PRESETS) body.appendChild(takeoutRow(preset));
}

function takeoutRow(preset) {
  const row = el("div", "takeout-row");
  row.appendChild(el("span", "pick-name", preset.name));
  const sizes = el("div", "takeout-sizes");
  for (const size of ["S", "M", "L"]) {
    const [kcal, desc] = preset.sizes[size];
    const btn = el("button", "size-btn");
    btn.type = "button";
    btn.appendChild(el("span", "size-letter", size));
    btn.appendChild(el("span", "size-desc", `${desc} · ${kcal}`));
    btn.addEventListener("click", () => addToTray(takeoutPick(preset, size, desc)));
    sizes.appendChild(btn);
  }
  row.appendChild(sizes);
  return row;
}

const QUICK_FIELDS = [
  ["name", "Name", "text", true], ["kcal", "Calories", "number", true], ["protein", "Protein (g)", "number", true],
  ["carbs", "Carbs (g)", "number"], ["fat", "Fat (g)", "number"], ["fiber", "Fiber (g)", "number"],
  ["addedSugar", "Added sugar (g)", "number"], ["sodium", "Sodium (mg)", "number"],
];

function renderQuickAdd(body) {
  const form = el("form", "quick-form");
  for (const [key, label, type, required] of QUICK_FIELDS) {
    const row = el("label", `quick-field${required ? "" : " optional"}`);
    row.appendChild(el("span", "", label));
    const input = el("input");
    input.name = key;
    input.type = type;
    if (type === "number") { input.inputMode = "decimal"; input.min = "0"; input.step = "any"; }
    input.required = Boolean(required);
    row.appendChild(input);
    form.appendChild(row);
  }
  let processing = "processed";
  const procLabel = el("div", "feel-label", "Processing");
  const procRow = processingChips(processing, (tag) => {
    processing = tag;
    for (const c of procRow.children) c.classList.toggle("active", c.dataset.tag === tag);
  });
  form.append(procLabel, procRow);
  const save = el("label", "quick-save");
  const box = el("input");
  box.type = "checkbox";
  box.name = "keep";
  save.append(box, el("span", "", "Save to My foods"));
  form.appendChild(save);
  const submit = el("button", "primary-btn", "Add to tray");
  submit.type = "submit";
  form.appendChild(submit);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const n = emptyNutrients();
    for (const [key] of QUICK_FIELDS.slice(1)) n[key] = parseFloat(data.get(key)) || 0;
    n.sugar = n.addedSugar;
    n.upf = processing === "ultra" ? n.kcal : 0;
    const name = String(data.get("name")).trim();
    if (!name) return;
    if (data.get("keep")) {
      const lib = foodLibrary();
      lib.push({ id: `custom-${Date.now()}`, name, serving: "1 serving", n, confidence: "estimate", source: "custom", favorite: true, processing });
      saveJSON(FOOD_LIBRARY_KEY, lib);
    }
    addToTray({ key: trayKey(undefined, name, n), name, n, confidence: "estimate" });
    renderSheet("quick"); // a clean form for the next one
  });
  body.appendChild(form);
}

/* ---- Edit / delete a logged entry ---- */

function openEditEntry(entry) {
  sheetTray = null; // the editor shares the sheet; the slot's tray waits in `trays`
  renderTray();
  sheetSlot = entry.slot;
  document.getElementById("food-sheet-title").textContent = entry.name;
  document.getElementById("food-sheet-tabs").innerHTML = "";
  const body = document.getElementById("food-sheet-body");
  body.innerHTML = "";
  const per = entry.n;
  body.appendChild(el("p", "hint", `Per serving: ${fmt(per.kcal)} kcal · ${fmt(per.protein)} g protein${entry.confidence !== "exact" ? " · estimate" : ""}`));
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
  /* Saves what's typed above plus `extra`. The chips below save at once,
     so they carry a typed servings or time edit instead of dropping it. */
  const saveEdits = (extra) => {
    const v = parseFloat(input.value);
    // The time moves within the entry's own day; a blank field keeps it.
    const at = atOnDate(entry.date, time.value);
    updateEntry(entry.id, (x) => {
      if (Number.isFinite(v) && v > 0) x.servings = v;
      if (at !== null) x.at = at;
      if (extra) extra(x);
    });
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = parseFloat(input.value);
    if (!Number.isFinite(v) || v <= 0) return;
    saveEdits();
  });
  body.appendChild(form);
  body.appendChild(el("div", "feel-label", "Meal"));
  const meals = el("div", "chip-row meal-chips");
  const currentMeal = mealForEntry(entry);
  for (const meal of MEALS) {
    const chip = el("button", `chip small${meal === currentMeal ? " active" : ""}`, MEAL_LABELS[meal]);
    chip.type = "button";
    chip.dataset.meal = meal;
    chip.addEventListener("click", () => saveEdits((x) => { x.meal = meal; }));
    meals.appendChild(chip);
  }
  body.appendChild(meals);
  // A single food can be retagged; the tag sticks for future logs too.
  const foodId = entry.ref && entry.ref.food;
  if (foodId || !entry.ref) {
    const current = entry.n.upf > 0 ? "ultra" : (foodLibrary().find((f) => f.id === foodId) || {}).processing || "processed";
    body.appendChild(el("div", "feel-label", "Processing"));
    body.appendChild(processingChips(current, (tag) => {
      if (foodId) setFoodProcessing(foodId, tag);
      saveEdits((x) => { x.n.upf = tag === "ultra" ? x.n.kcal : 0; });
    }));
  } else if (entry.n.upf > 0) {
    body.appendChild(el("p", "hint", `${fmt(entry.n.upf)} of ${fmt(entry.n.kcal)} kcal per serving are from ultra-processed ingredients.`));
  }
  const del = el("button", "pill-btn danger", "Delete entry");
  del.type = "button";
  del.addEventListener("click", () => updateEntry(entry.id, null));
  body.append(del);
  foodSheet.hidden = false;
}

function updateEntry(id, mutate) {
  let log = foodLog();
  if (mutate) log.forEach((x) => { if (x.id === id) mutate(x); });
  else log = log.filter((x) => x.id !== id);
  saveJSON(FOOD_LOG_KEY, log);
  closeFoodSheet();
  refreshFood();
}

document.getElementById("food-sheet-cancel").addEventListener("click", closeFoodSheet);
attachSwipeClose(foodSheet, { close: closeFoodSheet, scroller: [document.getElementById("food-sheet-body"), document.getElementById("food-tray-items")] });
document.getElementById("food-log-btn").addEventListener("click", () => openFoodSheet({ mode: "search" }));
document.getElementById("food-takeout-btn").addEventListener("click", () => openFoodSheet({ mode: "takeout", title: "Takeout estimate" }));
document.getElementById("food-quick-btn").addEventListener("click", () => openFoodSheet({ mode: "quick", title: "Quick add" }));

refreshFood();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  renderFood();
  syncTrayClock();
});
