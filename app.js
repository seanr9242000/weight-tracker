const STORAGE_KEY = "weight-tracker-entries";
const RUNS_STORAGE_KEY = "weight-tracker-runs";
const ACTIVE_RUN_KEY = "weight-tracker-active-run";
const ACTIVE_TAB_KEY = "weight-tracker-active-tab";

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadRuns() {
  try {
    const raw = localStorage.getItem(RUNS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRuns(runs) {
  localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs));
}

function sortedByDate(entries) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatPace(totalSeconds, miles) {
  if (!miles || miles <= 0) return "--";
  const paceSeconds = totalSeconds / miles;
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.round(paceSeconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")} /mi`;
}

/* Binds a hidden native date input to a styled display div (see the
   date-field markup) and keeps the display text in sync. Used for
   both the weight entry date and the run entry date. */
function bindDateField(inputEl, displayEl) {
  function sync() {
    displayEl.textContent = inputEl.value ? formatDate(inputEl.value) : "";
  }
  inputEl.valueAsDate = new Date();
  sync();
  inputEl.addEventListener("change", sync);
  return { reset: () => { inputEl.valueAsDate = new Date(); sync(); } };
}

function render() {
  const entries = loadEntries();
  renderList(entries);
  renderChart(entries);
}

function renderList(entries) {
  const list = document.getElementById("entry-list");
  const empty = document.getElementById("list-empty");
  const newestFirst = sortedByDate(entries).reverse();

  list.innerHTML = "";
  empty.style.display = newestFirst.length === 0 ? "block" : "none";

  for (const entry of newestFirst) {
    const li = document.createElement("li");

    const left = document.createElement("div");
    const weightSpan = document.createElement("div");
    weightSpan.className = "entry-weight";
    weightSpan.textContent = `${entry.weight} ${entry.unit}`;
    const dateSpan = document.createElement("div");
    dateSpan.className = "entry-date";
    dateSpan.textContent = formatDate(entry.date);
    left.appendChild(weightSpan);
    left.appendChild(dateSpan);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      const remaining = loadEntries().filter((e) => e.id !== entry.id);
      saveEntries(remaining);
      render();
    });

    li.appendChild(left);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }
}

function renderChart(entries) {
  const canvas = document.getElementById("chart");
  const emptyMsg = document.getElementById("chart-empty");
  const ctx = canvas.getContext("2d");
  const points = sortedByDate(entries);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (points.length < 2) {
    canvas.style.display = "none";
    emptyMsg.style.display = "block";
    return;
  }
  canvas.style.display = "block";
  emptyMsg.style.display = "none";

  const weights = points.map((p) => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const padding = 24;
  const range = maxW - minW || 1;

  const xStep = (canvas.width - padding * 2) / (points.length - 1);
  const yFor = (w) =>
    canvas.height - padding - ((w - minW) / range) * (canvas.height - padding * 2);

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = padding + i * xStep;
    const y = yFor(p.weight);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#111111";
  points.forEach((p, i) => {
    const x = padding + i * xStep;
    const y = yFor(p.weight);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

const dateInput = document.getElementById("date-input");
const dateField = bindDateField(dateInput, document.getElementById("date-display"));

document.getElementById("entry-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const weightInput = document.getElementById("weight-input");

  const weight = parseFloat(weightInput.value);
  const date = dateInput.value;
  if (!Number.isFinite(weight) || !date) return;

  const entries = loadEntries();
  entries.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date,
    weight,
    unit: "lbs",
  });
  saveEntries(entries);

  weightInput.value = "";
  weightInput.focus();
  render();
});

/* ---- Tabs ---- */

const tabButtons = document.querySelectorAll(".tab-btn");

function activateTab(tabId) {
  for (const btn of tabButtons) {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  }
  document.getElementById("weight-panel").hidden = tabId !== "weight-panel";
  document.getElementById("runs-panel").hidden = tabId !== "runs-panel";
  localStorage.setItem(ACTIVE_TAB_KEY, tabId);
}

for (const btn of tabButtons) {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
}

activateTab(localStorage.getItem(ACTIVE_TAB_KEY) === "runs-panel" ? "runs-panel" : "weight-panel");

/* ---- Runs: timer + history ---- */

const runTypeToggle = document.getElementById("run-type-toggle");
const timerDisplay = document.getElementById("timer-display");
const timerBtn = document.getElementById("timer-btn");
const runSaveForm = document.getElementById("run-save-form");
const runDistanceInput = document.getElementById("run-distance-input");
const runDateInput = document.getElementById("run-date-input");
const runDateField = bindDateField(runDateInput, document.getElementById("run-date-display"));

let runType = "run";
let timerInterval = null;
let stoppedDurationSeconds = 0;

function setRunType(type) {
  runType = type;
  for (const btn of runTypeToggle.children) {
    btn.classList.toggle("active", btn.dataset.type === type);
  }
}

for (const btn of runTypeToggle.children) {
  btn.addEventListener("click", () => setRunType(btn.dataset.type));
}

function readActiveRun() {
  try {
    const raw = localStorage.getItem(ACTIVE_RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function tickTimerDisplay(startedAt) {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  timerDisplay.textContent = formatDuration(elapsed);
}

function enterRunningState(startedAt) {
  timerBtn.hidden = false;
  timerBtn.textContent = "Stop";
  timerBtn.classList.add("running");
  runTypeToggle.querySelectorAll("button").forEach((b) => (b.disabled = true));
  runSaveForm.hidden = true;
  tickTimerDisplay(startedAt);
  timerInterval = setInterval(() => tickTimerDisplay(startedAt), 1000);
}

function enterIdleState() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerBtn.hidden = false;
  timerBtn.textContent = "Start";
  timerBtn.classList.remove("running");
  runTypeToggle.querySelectorAll("button").forEach((b) => (b.disabled = false));
  timerDisplay.textContent = "0:00";
  runSaveForm.hidden = true;
}

function enterReviewState(durationSeconds) {
  stoppedDurationSeconds = durationSeconds;
  timerDisplay.textContent = formatDuration(durationSeconds);
  timerBtn.hidden = true;
  runSaveForm.hidden = false;
  runDistanceInput.value = "";
  runDateField.reset();
  runDistanceInput.focus();
}

timerBtn.addEventListener("click", () => {
  if (timerInterval === null && timerBtn.textContent === "Start") {
    const startedAt = Date.now();
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify({ startedAt, type: runType }));
    enterRunningState(startedAt);
  } else {
    const active = readActiveRun();
    localStorage.removeItem(ACTIVE_RUN_KEY);
    clearInterval(timerInterval);
    timerInterval = null;
    timerBtn.textContent = "Start";
    timerBtn.classList.remove("running");
    const durationSeconds = active ? Math.floor((Date.now() - active.startedAt) / 1000) : 0;
    enterReviewState(durationSeconds);
  }
});

document.getElementById("run-discard-btn").addEventListener("click", () => {
  enterIdleState();
});

runSaveForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const distance = parseFloat(runDistanceInput.value);
  const date = runDateInput.value;
  if (!Number.isFinite(distance) || !date) return;

  const runs = loadRuns();
  runs.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date,
    type: runType,
    durationSeconds: stoppedDurationSeconds,
    distanceMiles: distance,
  });
  saveRuns(runs);

  enterIdleState();
  renderRunList();
});

function renderRunList() {
  const runs = loadRuns();
  const list = document.getElementById("run-list");
  const empty = document.getElementById("run-list-empty");
  const newestFirst = sortedByDate(runs).reverse();

  list.innerHTML = "";
  empty.style.display = newestFirst.length === 0 ? "block" : "none";

  for (const run of newestFirst) {
    const li = document.createElement("li");

    const left = document.createElement("div");
    left.className = "entry-main";

    const typeTag = document.createElement("div");
    typeTag.className = "entry-type-tag";
    typeTag.textContent = run.type;
    left.appendChild(typeTag);

    const weightSpan = document.createElement("div");
    weightSpan.className = "entry-weight";
    weightSpan.textContent = `${run.distanceMiles} mi · ${formatDuration(run.durationSeconds)}`;
    left.appendChild(weightSpan);

    const metaSpan = document.createElement("div");
    metaSpan.className = "entry-meta";
    metaSpan.textContent = `${formatDate(run.date)} · ${formatPace(run.durationSeconds, run.distanceMiles)}`;
    left.appendChild(metaSpan);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      const remaining = loadRuns().filter((r) => r.id !== run.id);
      saveRuns(remaining);
      renderRunList();
    });

    li.appendChild(left);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }
}

/* Resume a run that was in progress when the app was last closed or
   backgrounded. The elapsed time is derived from the stored start
   timestamp, not accumulated ticks, so it stays correct across any
   gap while the app was suspended. */
const activeRunOnLoad = readActiveRun();
if (activeRunOnLoad) {
  setRunType(activeRunOnLoad.type);
  enterRunningState(activeRunOnLoad.startedAt);
} else {
  enterIdleState();
}

render();
renderRunList();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
