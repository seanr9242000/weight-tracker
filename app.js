const STORAGE_KEY = "weight-tracker-entries";

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

function sortedByDate(entries) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
const dateDisplay = document.getElementById("date-display");

function syncDateDisplay() {
  dateDisplay.textContent = dateInput.value ? formatDate(dateInput.value) : "";
}

dateInput.valueAsDate = new Date();
syncDateDisplay();
dateInput.addEventListener("change", syncDateDisplay);

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

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
