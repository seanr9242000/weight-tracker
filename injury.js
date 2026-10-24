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
  const { day, total } = injuryDays(injury, dateStr);
  return `${capitalize(injury.part)} · day ${day} of ${total} · recheck ${shortDate(injury.until)}`;
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

function setDateField(input, value) {
  input.value = value || "";
  document.getElementById(`${input.id}-display`).textContent = value ? formatDate(value) : "";
}

for (const input of [injuryStart, injuryUntil]) {
  input.addEventListener("change", () => setDateField(input, input.value));
}

function fillInjuryForm() {
  const current = currentInjury();
  document.getElementById("injury-part").value = current ? current.part : "";
  document.getElementById("injury-note").value = current ? current.note || "" : "";
  setDateField(injuryStart, current ? current.start : todayLocalDateString());
  setDateField(injuryUntil, current ? current.until : "");
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
  document.getElementById("injury-end-btn").hidden = !active;
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

document.getElementById("injury-pt-add-btn").addEventListener("click", () => {
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
});

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
  saveJSON(INJURY_KEY, { part, start, until, note: document.getElementById("injury-note").value.trim(), pt: current ? current.pt || [] : [] });
  injuryEditing = false;
  renderInjury();
  renderToday();
  showToast(injuryActive(loadInjury(), todayLocalDateString()) ? "Injury mode on" : "Injury saved");
});

document.getElementById("injury-end-btn").addEventListener("click", () => {
  const injury = loadInjury();
  if (!injury) return;
  saveJSON(INJURY_KEY, endInjury(injury, todayLocalDateString()));
  injuryEditing = false;
  renderInjury();
  renderToday();
  showToast("Injury mode off. Games and runs are back on the schedule.");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderInjury();
});

renderInjury();
// coach.js rendered Today before this file loaded; add the chip now.
renderToday();
