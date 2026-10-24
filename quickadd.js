/* The + button: one sheet for logging anything from any tab. Water and
   pouches log in one tap; food opens the food picker; weight and
   cravings open small views inside the sheet; Start run jumps to Train.
   A suggestion row on top offers the most likely log right now. */

const qaSheet = document.getElementById("quick-add");
const qaScrim = document.getElementById("qa-scrim");
const fab = document.getElementById("fab");
const QA_VIEWS = { main: "qa-main", weight: "qa-weight", craving: "qa-craving" };

function showQaView(view) {
  for (const [name, id] of Object.entries(QA_VIEWS)) {
    document.getElementById(id).hidden = name !== view;
  }
  if (view === "weight") prepareWeighIn();
  fitQaToKeyboard();
}

function openQuickAdd(view = "main") {
  renderQaSheet();
  showQaView(view);
  qaSheet.hidden = false;
  qaScrim.hidden = false;
  fab.classList.add("open");
  fab.setAttribute("aria-expanded", "true");
}

function closeQuickAdd() {
  qaSheet.hidden = true;
  qaScrim.hidden = true;
  qaSheet.classList.remove("keyboard-up");
  fab.classList.remove("open");
  fab.setAttribute("aria-expanded", "false");
  const input = document.getElementById("qa-weight-input");
  if (document.activeElement === input) input.blur();
}

fab.addEventListener("click", () => {
  haptic();
  if (qaSheet.hidden) openQuickAdd();
  else closeQuickAdd();
});
qaScrim.addEventListener("click", closeQuickAdd);
document.getElementById("qa-close").addEventListener("click", closeQuickAdd);

/* ---- Main view ---- */

function renderQaSheet() {
  const today = todayLocalDateString();
  document.getElementById("qa-water-value").textContent =
    `${fmt(waterTotal(waterLog(), today))} of ${fmt(waterGoalFor(today))} oz`;

  const buttons = document.getElementById("qa-water-buttons");
  buttons.innerHTML = "";
  for (const oz of WATER_BUTTONS) {
    const b = el("button", "", `+${oz} oz`);
    b.type = "button";
    b.addEventListener("click", () => {
      closeQuickAdd();
      addWater(today, oz);
    });
    buttons.appendChild(b);
  }

  document.getElementById("qa-run-label").textContent = readActiveRun() ? "Run going" : "Start run";

  const wrap = document.getElementById("qa-suggest");
  wrap.innerHTML = "";
  for (const s of quickSuggestions()) {
    const b = el("button", `qa-sugg ${s.area}`);
    b.type = "button";
    const text = el("span", "qa-sugg-text");
    text.append(el("span", "qa-sugg-title", s.title), el("span", "qa-sugg-meta", s.meta));
    b.append(text, el("span", "qa-sugg-go", s.go));
    b.addEventListener("click", () => {
      if (!s.keepOpen) closeQuickAdd();
      s.run();
    });
    wrap.appendChild(b);
  }
}

/* Up to two guesses at what to log right now: the nearest unlogged
   meal on today's schedule, water when behind pace, a due weigh-in. */
function quickSuggestions() {
  const today = todayLocalDateString();
  const items = scheduleFor(today);
  const checkins = loadJSON(CHECKINS_KEY, {});
  const now = minutesNow();
  const open = (i) => !checkins[`${today}|${i.id}`];
  const out = [];

  const meal = items
    .filter((i) => hasMealPanel(i) && open(i))
    .filter((i) => timeToMinutes(i.time) - now <= 60 && now - timeToMinutes(i.time) <= 120)
    .sort((a, b) => Math.abs(timeToMinutes(a.time) - now) - Math.abs(timeToMinutes(b.time) - now))[0];
  if (meal) {
    const planned = plannedMealFor(foodMeals(), meal.id, today);
    if (planned) {
      const { n } = mealNutrients(planned, foodLibrary(), []);
      out.push({
        area: "area-food", title: meal.title, go: "Log",
        meta: `${planned.name} · ${fmt(n.kcal)} kcal · ${fmt(n.protein)} g P`,
        run: () => logPlannedWithUndo(planned, meal),
      });
    } else {
      out.push({
        area: "area-food", title: meal.title, meta: "Pick what you ate", go: "Open",
        run: () => openFoodSheet({ slot: meal.id, title: meal.title, mode: meal.id === "treat-meal" ? "takeout" : "search" }),
      });
    }
  }

  // Pace: the goal spread evenly from 7 AM to 9 PM.
  const goal = waterGoalFor(today);
  const drank = waterTotal(waterLog(), today);
  const pace = goal * Math.min(1, Math.max(0, (now - 7 * 60) / (14 * 60)));
  if (drank < goal && pace - drank >= 16) {
    out.push({
      area: "area-water", title: "+20 oz water", go: "Log",
      meta: `Behind pace: ${fmt(drank)} of ${fmt(goal)} oz`,
      run: () => addWater(today, 20),
    });
  }

  const weigh = items.find((i) => i.id === "weigh");
  if (weigh && open(weigh) && now >= timeToMinutes(weigh.time)) {
    out.push({
      area: "area-weight", title: "Weigh in", meta: weigh.note || "Log today's weight", go: "Open",
      keepOpen: true, run: () => showQaView("weight"),
    });
  }
  return out.slice(0, 2);
}

function logPlannedWithUndo(planned, item) {
  logMeal(planned, item.id, []);
  const id = foodLog().at(-1).id;
  haptic();
  showToast(`${item.title} logged`, () => {
    saveJSON(FOOD_LOG_KEY, foodLog().filter((e) => e.id !== id));
    setCheckin(todayLocalDateString(), item.id, null);
    refreshFood();
  });
}

for (const tile of document.querySelectorAll(".qa-tile")) {
  tile.addEventListener("click", () => {
    const what = tile.dataset.qa;
    if (what === "weight") return showQaView("weight");
    if (what === "craving") return showQaView("craving");
    if (what === "photo") {
      // The label opens the photo picker itself; date it today.
      photoDateField.reset();
      setTimeout(closeQuickAdd, 0);
      return;
    }
    closeQuickAdd();
    if (what === "food") openFoodSheet({ title: "Log food" });
    else if (what === "pouch") logPouch();
    else if (what === "run") {
      activateTab("train-panel");
      if (!readActiveRun() && !timerBtn.hidden && timerBtn.textContent === "Start") timerBtn.click();
    }
  });
}

/* ---- Weigh-in view ---- */

function prepareWeighIn() {
  const entries = sortedByDate(loadEntries());
  const last = entries.at(-1);
  const input = document.getElementById("qa-weight-input");
  input.value = last ? last.weight : "";
  document.getElementById("qa-weight-hint").textContent = last
    ? `Last: ${last.weight} lb on ${formatDate(last.date)}. Adjust and save.`
    : "Bathroom first, before food or water.";
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
}

document.getElementById("qa-weight").addEventListener("submit", (e) => {
  e.preventDefault();
  const weight = parseFloat(document.getElementById("qa-weight-input").value);
  if (!Number.isFinite(weight) || weight <= 0) return;
  const today = todayLocalDateString();
  const id = newId();
  const entries = loadEntries();
  entries.push({ id, date: today, weight, unit: "lbs" });
  saveEntries(entries);
  const hadCheckin = Boolean(loadJSON(CHECKINS_KEY, {})[`${today}|weigh`]);
  if (!hadCheckin) setCheckin(today, "weigh", { status: "done", at: Date.now() });
  render();
  renderToday();
  closeQuickAdd();
  haptic();
  showToast(`Weight logged · ${weight} lb`, () => {
    saveEntries(loadEntries().filter((x) => x.id !== id));
    if (!hadCheckin) setCheckin(today, "weigh", null);
    render();
    renderToday();
  });
});

/* Keep the sheet above the iOS keyboard while typing a weight (same
   approach as the food sheet). */
function fitQaToKeyboard() {
  const vv = window.visualViewport;
  if (!vv || qaSheet.hidden) return;
  const keyboardUp = document.documentElement.clientHeight - vv.height > 120;
  qaSheet.classList.toggle("keyboard-up", keyboardUp);
  qaSheet.style.setProperty("--vv-top", `${vv.offsetTop}px`);
  qaSheet.style.setProperty("--vv-height", `${vv.height}px`);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", fitQaToKeyboard);
  window.visualViewport.addEventListener("scroll", fitQaToKeyboard);
}
