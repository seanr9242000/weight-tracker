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

/* ---- Swipe down to close ---- */

/* True when a downward drag of `dy` px, released at `velocity` px/ms,
   should close a sheet `height` px tall: past a third of it, or a flick
   that also travelled at least 24 px (so a twitch doesn't close it). */
function swipeShouldClose(dy, height, velocity) {
  return dy > height / 3 || (velocity > 0.5 && dy >= 24);
}

/* Lets a bottom sheet be dragged down to close. A drag can start on the
   handle or anything outside `scroller` (the header) at any time, but
   inside `scroller` only while it's scrolled to the top. Text fields,
   selects and sliders keep their own drags. The sheet follows the finger
   down (never up), `scrim` fades with it, and on release the sheet
   either closes through `close` or springs back. */
function attachSwipeClose(sheet, { close, scroller = sheet, scrim = null }) {
  let drag = null;
  let suppressClicksUntil = 0;

  const clearStyles = () => {
    sheet.style.transition = "";
    sheet.style.transform = "";
    if (scrim) {
      scrim.style.transition = "";
      scrim.style.opacity = "";
    }
  };

  const settle = (closing) => {
    sheet.style.transition = "transform 0.2s ease";
    if (scrim) scrim.style.transition = "opacity 0.2s ease";
    if (closing) {
      sheet.style.transform = `translateY(${sheet.offsetHeight + 40}px)`;
      if (scrim) scrim.style.opacity = "0";
      setTimeout(() => {
        close();
        clearStyles();
        sheet.style.animation = ""; // the next open plays its slide-up again
      }, 200);
    } else {
      sheet.style.transform = "";
      if (scrim) scrim.style.opacity = "";
      setTimeout(clearStyles, 220);
    }
  };

  sheet.addEventListener("pointerdown", (e) => {
    suppressClicksUntil = 0; // a new touch is a new tap, never the drag's
    if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (e.target.closest("input, textarea, select")) return;
    const fromHeader = e.target.closest(".sheet-handle") || !scroller.contains(e.target);
    if (!fromHeader && scroller.scrollTop > 0) return;
    drag = { id: e.pointerId, y0: e.clientY, dy: 0, moving: false, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
  });

  sheet.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moving) {
      if (dy < -6) {
        drag = null; // upward: that's a scroll, not a close
        return;
      }
      if (dy < 6) return;
      drag.moving = true;
      // Inline transforms lose to a running animation; the open one is done.
      sheet.style.animation = "none";
      sheet.style.transition = "none";
      if (scrim) scrim.style.transition = "none";
      try {
        sheet.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-ended pointer; the sheet still gets events.
      }
    }
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.v = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;
    drag.dy = Math.max(0, dy);
    sheet.style.transform = `translateY(${drag.dy}px)`;
    if (scrim) scrim.style.opacity = String(Math.max(0, 1 - drag.dy / sheet.offsetHeight));
  });

  const end = (e, cancelled) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moving) return;
    // The release fires a click on whatever the drag started on; eat it.
    suppressClicksUntil = performance.now() + 100;
    // A finger that stopped before lifting isn't a flick.
    const v = e.timeStamp - d.lastT > 100 ? 0 : d.v;
    settle(!cancelled && swipeShouldClose(d.dy, sheet.offsetHeight, v));
  };
  sheet.addEventListener("pointerup", (e) => end(e, false));
  sheet.addEventListener("pointercancel", (e) => end(e, true));

  sheet.addEventListener("click", (e) => {
    if (performance.now() < suppressClicksUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* iOS hands a downward touch on a scroller at its top to native
     overscroll and cancels the pointer, unless the touchmove is
     cancelled. A drag only exists where closing is allowed, so cancel
     downward moves while one is live; upward ones still scroll. */
  sheet.addEventListener("touchmove", (e) => {
    if (drag && e.touches[0] && e.touches[0].clientY > drag.y0) e.preventDefault();
  }, { passive: false });
}
