/* Injury mode UI: the Today chip, the Injury card (dates, note, PT
   exercises, end now, start a new one) and the "Runs paused" banner on
   Train. Schedule rules live in coach-core.js; storage (INJURY_KEY,
   loadInjury) in coach.js. */

let injuryEditing = false;
let recheckExtending = false; // the recheck panel's "Not yet" date picker (Task 12)

const injuryForm = document.getElementById("injury-form");
const injuryStart = document.getElementById("injury-start");
const injuryUntil = document.getElementById("injury-until");

function shortDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function injuryLine(injury, dateStr) {
  const days = injuryDays(injury, dateStr);
  if (!days) return capitalize(injury.part);
  return `${capitalize(injury.part)} · day ${days.day} of ${days.total} · recheck ${shortDate(injury.until)}`;
}

/* Called by coach.js renderTodaySummary; null when no injury is on. */
function injuryChip(dateStr) {
  const injury = loadInjury();
  if (!injuryActive(injury, dateStr)) return null;
  const chip = el("button", "hero-chip injury-chip", `🩹 ${injuryLine(injury, dateStr)}`);
  chip.type = "button";
  chip.addEventListener("click", openInjuryEditor);
  return chip;
}

/* The injury being edited: the active or upcoming one. A past one
   means the form starts a new injury instead. */
function currentInjury() {
  const injury = loadInjury();
  return injury && injury.until >= todayLocalDateString() ? injury : null;
}

/* An injury that ended in the last 14 days: Start pre-fills from it, so an
   accidental End (or a flare-up) isn't a re-type of everything. */
function recentInjury() {
  const injury = loadInjury();
  const today = todayLocalDateString();
  return injury && injury.until < today && injury.until >= shiftDate(today, -14) ? injury : null;
}

/* Saves an ended injury, or, when endInjury dropped it (it never ran a
   full day), brings back the one before it so the card still reads
   "Off. Last one: ...". */
function finishInjury(ended) {
  if (ended) {
    saveJSON(INJURY_KEY, ended);
    return;
  }
  const past = loadJSON(INJURY_PAST_KEY, []);
  saveJSON(INJURY_KEY, past.pop() || null);
  saveJSON(INJURY_PAST_KEY, past);
}

function setDateField(input, value) {
  input.value = value || "";
  document.getElementById(`${input.id}-display`).textContent = value ? formatDate(value) : "";
}

for (const input of [injuryStart, injuryUntil]) {
  input.addEventListener("change", () => setDateField(input, input.value));
}

function fillInjuryForm() {
  const current = currentInjury();
  const base = current || recentInjury();
  document.getElementById("injury-part").value = base ? base.part : "";
  document.getElementById("injury-note").value = base ? base.note || "" : "";
  setDateField(injuryStart, base ? base.start : todayLocalDateString());
  setDateField(injuryUntil, current ? current.until : ""); // a recent one needs a fresh recheck date
  document.getElementById("injury-form-status").textContent = "";
}

function openInjuryEditor() {
  activateTab("today-panel");
  injuryEditing = true;
  fillInjuryForm();
  renderInjury();
  document.getElementById("injury-card").scrollIntoView({ block: "start" });
}

function renderPtList(current) {
  document.getElementById("injury-pt").hidden = !current;
  const list = document.getElementById("injury-pt-list");
  list.innerHTML = "";
  for (const pt of (current && current.pt) || []) {
    const row = el("li");
    row.appendChild(el("span", "pouch-time", formatTime12(pt.time)));
    row.appendChild(el("span", "pouch-gap", pt.title));
    const remove = el("button", "pouch-remove", "✕");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${pt.title}`);
    remove.addEventListener("click", () => {
      const injury = loadInjury();
      if (!injury) return;
      injury.pt = (injury.pt || []).filter((p) => p.id !== pt.id);
      saveJSON(INJURY_KEY, injury);
      renderInjury();
      renderToday();
    });
    row.appendChild(remove);
    list.appendChild(row);
  }
}

function renderRunsPaused(injury, today) {
  const active = injuryActive(injury, today);
  const banner = document.getElementById("runs-paused");
  banner.hidden = !active;
  banner.textContent = active ? `Runs paused: ${injury.part} (back after ${shortDate(injury.until)} recheck)` : "";
  document.getElementById("timer-btn").classList.toggle("deemphasized", active);
}

function renderInjury() {
  const today = todayLocalDateString();
  const injury = loadInjury();
  const active = injuryActive(injury, today);
  const summary = document.getElementById("injury-summary");
  if (active) {
    summary.textContent = injuryLine(injury, today) + (injury.note ? `. ${injury.note}` : "");
  } else if (injury && injury.start > today) {
    summary.textContent = `Starts ${shortDate(injury.start)}: ${injury.part}.`;
  } else if (injury) {
    summary.textContent = `Off. Last one: ${injury.part}, ${shortDate(injury.start)} – ${shortDate(injury.until)}.`;
  } else {
    summary.textContent = "Off. Turn it on when an injury changes what you can do: games and runs pause, and lifts get a safe plan.";
  }
  document.getElementById("injury-edit-btn").textContent = injuryEditing ? "Cancel" : currentInjury() ? "Edit" : "Start";
  injuryForm.hidden = !injuryEditing;
  const upcoming = Boolean(injury && injury.start > today);
  const endBtn = document.getElementById("injury-end-btn");
  endBtn.hidden = !active && !upcoming;
  endBtn.textContent = upcoming ? "Cancel this injury" : "End injury mode now";
  renderPtList(currentInjury());
  renderRunsPaused(injury, today);
}

document.getElementById("injury-edit-btn").addEventListener("click", () => {
  if (injuryEditing) {
    injuryEditing = false;
    renderInjury();
  } else {
    openInjuryEditor();
  }
});

function addPtExercise() {
  const time = document.getElementById("injury-pt-time").value;
  const titleInput = document.getElementById("injury-pt-title");
  const title = titleInput.value.trim();
  const injury = currentInjury();
  if (!time || !title || !injury) return;
  injury.pt = [...(injury.pt || []), { id: `pt-${Date.now()}`, time, title }];
  saveJSON(INJURY_KEY, injury);
  titleInput.value = "";
  renderInjury();
  renderToday();
}

document.getElementById("injury-pt-add-btn").addEventListener("click", addPtExercise);

/* The PT fields sit inside the injury form: Enter adds the exercise
   instead of submitting the whole form. */
for (const id of ["injury-pt-title", "injury-pt-time"]) {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addPtExercise();
  });
}

injuryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const status = document.getElementById("injury-form-status");
  const part = document.getElementById("injury-part").value.trim().toLowerCase();
  const start = injuryStart.value;
  const until = injuryUntil.value;
  if (!part || !start || !until) {
    status.textContent = "Add the injury, a start date and a recheck date.";
    return;
  }
  if (until < start) {
    status.textContent = "The recheck date can't be before the start.";
    return;
  }
  const current = currentInjury();
  const recent = recentInjury();
  /* PT carries over when editing, or when restarting the same part. */
  const source = current || (recent && recent.part.toLowerCase() === part ? recent : null);
  /* Starting a new injury keeps the old one, so its days stay injured. */
  const old = loadInjury();
  if (!current && old) saveJSON(INJURY_PAST_KEY, [...loadJSON(INJURY_PAST_KEY, []), old]);
  saveJSON(INJURY_KEY, { part, start, until, note: document.getElementById("injury-note").value.trim(), pt: source ? source.pt || [] : [] });
  injuryEditing = false;
  renderInjury();
  renderToday();
  showToast(injuryActive(loadInjury(), todayLocalDateString()) ? "Injury mode on" : "Injury saved");
});

/* The recheck item asks "Cleared?". Yes ends Injury mode as of
   yesterday (the injury stays, so past days still read as injured);
   Not yet asks for the next recheck date. */
function renderRecheckPanel(dateStr, item) {
  const panel = el("div", "meal-panel recheck-panel");
  panel.appendChild(el("div", "meal-name", "Cleared?"));
  const actions = el("div", "meal-actions");
  const yes = el("button", "pill-btn dark", "Yes");
  yes.type = "button";
  yes.addEventListener("click", () => {
    finishInjury(endInjury(loadInjury(), dateStr));
    setCheckin(dateStr, item.id, { status: "done", at: Date.now() });
    recheckOpenFor = null;
    recheckExtending = false;
    renderInjury();
    renderToday();
    showToast("Injury mode off. Games and runs are back on the schedule.");
  });
  const notYet = el("button", "pill-btn", "Not yet");
  notYet.type = "button";
  notYet.addEventListener("click", () => {
    recheckExtending = true;
    renderToday();
  });
  actions.append(yes, notYet);
  panel.appendChild(actions);

  if (recheckExtending) {
    const form = el("form", "recheck-form");
    const field = el("div", "date-field");
    const display = el("div", "date-display");
    const input = el("input", "date-input-overlay");
    input.type = "date";
    input.required = true;
    input.min = shiftDate(dateStr, 1);
    input.value = shiftDate(dateStr, 14);
    display.textContent = formatDate(input.value);
    input.addEventListener("change", () => { display.textContent = input.value ? formatDate(input.value) : ""; });
    field.append(display, input);
    const save = el("button", "pill-btn dark", "Save");
    save.type = "submit";
    form.append(el("span", "feel-label", "Next recheck"), field, save);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!input.value || input.value <= dateStr) return;
      saveJSON(INJURY_KEY, { ...loadInjury(), until: input.value });
      recheckOpenFor = null;
      recheckExtending = false;
      renderInjury();
      renderToday();
      showToast(`Next recheck ${shortDate(input.value)}`);
    });
    panel.appendChild(form);
  }
  return panel;
}

document.getElementById("injury-end-btn").addEventListener("click", () => {
  const injury = loadInjury();
  if (!injury) return;
  const today = todayLocalDateString();
  const upcoming = injury.start > today;
  if (!confirm(upcoming ? "Cancel this upcoming injury?" : "End injury mode? Games and runs come back on the schedule today.")) return;
  finishInjury(endInjury(injury, today));
  injuryEditing = false;
  renderInjury();
  renderToday();
  showToast(upcoming ? "Injury cancelled" : "Injury mode off. Games and runs are back on the schedule.");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderInjury();
});

renderInjury();
// coach.js rendered Today before this file loaded; add the chip now.
renderToday();
