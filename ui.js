/* Shared UI feedback: toast with undo, haptic tap, confetti, and
   once-a-day goal celebrations. Loaded first so every other file can
   use these. No app data lives here except the celebrated-goals log. */

const CELEBRATED_KEY = "ui-celebrated";

/* ---- Toast ---- */

let toastTimer = null;

/* Shows `text` above the tab bar for a few seconds. With `onUndo`, an
   Undo button runs it once and hides the toast. */
function showToast(text, onUndo) {
  const toast = document.getElementById("toast");
  const undo = document.getElementById("toast-undo");
  if (!toast) return;
  document.getElementById("toast-text").textContent = text;
  undo.hidden = !onUndo;
  undo.onclick = onUndo
    ? () => {
        hideToast();
        onUndo();
      }
    : null;
  // Restart the entrance animation when a toast replaces another.
  toast.hidden = true;
  void toast.offsetWidth;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, onUndo ? 5000 : 2600);
}

function hideToast() {
  clearTimeout(toastTimer);
  const toast = document.getElementById("toast");
  if (toast) toast.hidden = true;
}

/* ---- Haptics ---- */

/* iOS Safari has no Vibration API, but toggling an <input switch>
   through its label plays the system haptic (iOS 18+). Elsewhere this
   falls back to navigator.vibrate, or does nothing. */
let hapticLabel = null;

function haptic() {
  try {
    if (navigator.vibrate && navigator.vibrate(12)) return;
    if (!hapticLabel) {
      hapticLabel = document.createElement("label");
      hapticLabel.setAttribute("aria-hidden", "true");
      hapticLabel.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      hapticLabel.appendChild(input);
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  } catch {
    // Feedback is a nicety; never let it break a log.
  }
}

/* ---- Confetti ---- */

function confetti(colors) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.32,
    vx: (Math.random() - 0.5) * 11,
    vy: -Math.random() * 11 - 4,
    size: 5 + Math.random() * 6,
    spin: Math.random() * Math.PI,
    vspin: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  const start = performance.now();
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pieces) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.vspin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---- Goal celebrations ---- */

/* True the first time `key` is claimed on `dateStr`; false after. */
function claimCelebration(dateStr, key) {
  let log;
  try {
    log = JSON.parse(localStorage.getItem(CELEBRATED_KEY)) || {};
  } catch {
    log = {};
  }
  const today = log[dateStr] || [];
  if (today.includes(key)) return false;
  // Only today's entry is worth keeping.
  localStorage.setItem(CELEBRATED_KEY, JSON.stringify({ [dateStr]: [...today, key] }));
  return true;
}

function celebrate(message, color) {
  haptic();
  confetti([color, cssVar("--food"), cssVar("--water"), cssVar("--protein"), cssVar("--train")].filter(Boolean));
  // Keep a just-shown Undo usable: swap the text, not the toast.
  const toast = document.getElementById("toast");
  const undo = document.getElementById("toast-undo");
  if (toast && !toast.hidden && undo && !undo.hidden) {
    document.getElementById("toast-text").textContent = message;
    return;
  }
  showToast(message);
}
