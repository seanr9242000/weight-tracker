"""Phone-width preview + smoke check for the Weight & Save PWA.

Serves the repo on a local port, then drives headless Microsoft Edge to:
  1. load each tab inside a 390px-wide iframe (iPhone width) and report
     any JavaScript errors raised while the app loads, and
  2. screenshot each tab.

Why the iframe: headless Edge on Windows enforces a ~500px minimum
window width, so a plain --window-size=390 screenshot renders at 500px
and crops the right edge. Rendering inside a 390px iframe gives a true
phone-width layout.

Each run uses a fresh browser profile, so the app starts with empty
localStorage (a first-launch view). Use --seed to preload storage.

--interact SCRIPT.js runs a click-through script against the app in the
same 390px frame (helpers: INTERACT_HELPERS below, documented in
SKILL.md), prints its PASS/FAIL checks, and screenshots the state it
ends in. Repeat --interact for several scripts.

Usage:
  python .claude/skills/phone-preview/preview.py [--tabs today-panel,habits-panel]
      [--height 1900] [--out DIR] [--seed seed.json]
      [--interact flow.js ...] [--budget 10000]
"""

import argparse
import functools
import html
import http.server
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading

REPO = pathlib.Path(__file__).resolve().parents[3]
EDGE_PATHS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
PHONE_WIDTH = 390
TAB_KEY = "weight-tracker-active-tab"

# Injected at the top of <head> so errors thrown while the app's own
# scripts load are captured too (a listener added after load misses them).
ERROR_CAPTURE = (
    "<script>window.__previewErrors=[];"
    "addEventListener('error',e=>__previewErrors.push(e.message+' @ '+(e.filename||'').split('/').pop()+':'+e.lineno));"
    "addEventListener('unhandledrejection',e=>__previewErrors.push('unhandled rejection: '+e.reason));"
    "</script>"
)

FRAME_PAGE = """<!DOCTYPE html><html><body style="margin:0;background:#777">
<pre id="out" style="display:none">loading</pre>
<script>
const p = new URLSearchParams(location.search);
localStorage.clear();
const seed = %(seed)s;
for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
localStorage.setItem("%(tab_key)s", p.get("tab"));
const f = document.createElement("iframe");
f.src = "/__preview/app";
f.style.cssText = "width:%(width)spx;height:" + p.get("h") + "px;border:0;display:block";
f.onload = () => setTimeout(() => {
  const w = f.contentWindow;
  const panel = w.document.getElementById(p.get("tab"));
  const report = {
    tab: p.get("tab"),
    visible: Boolean(panel && !panel.hidden),
    errors: w.__previewErrors || ["error capture missing"],
  };
  document.getElementById("out").textContent = "PREVIEW_REPORT" + JSON.stringify(report);
}, 500);
document.body.appendChild(f);
</script></body></html>"""


# Helpers available to --interact scripts. The script body runs inside an
# async function after the app has loaded, so it can `await reload(...)`.
INTERACT_HELPERS = r"""
const doc = () => f.contentDocument;
const app = () => f.contentWindow;
const $ = (sel, root) => (root || doc()).querySelector(sel);
const $$ = (sel, root) => [...(root || doc()).querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const eq = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  results.push(`${pass ? "PASS" : "FAIL"} ${name}` + (pass ? "" : ` - got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
};
const check = (name, cond, info) => results.push(`${cond ? "PASS" : "FAIL"} ${name}` + (cond || info === undefined ? "" : ` - ${info}`));
// Deepest element whose whole text is exactly `text` (buttons, chips, titles).
const byText = (text, root) => $$("*", root).filter((e) => e.textContent.trim() === text).pop() || null;
const need = (el, what) => { if (!el) throw new Error("nothing matches " + what); return el; };
const click = (target, root) => need(typeof target === "string" ? $(target, root) : target, target).click();
const clickText = (text, root) => need(byText(text, root), JSON.stringify(text)).click();
const item = (title) => $$("#checklist li").find((li) => $(".check-title", li)?.textContent === title) || null;
const fill = (target, value) => {
  const el = need(typeof target === "string" ? $(target) : target, target);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
};
const tab = (id) => click(`[data-tab="${id}"]`);
const ls = (key) => JSON.parse(app().localStorage.getItem(key));
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + (offset || 0)); return ymd(d); };
const today = day(0);
// Wipe storage, apply a new seed, reload the app, and wait for it.
// `query` (e.g. "item=lunch") is appended to the app URL.
const reload = (newSeed, tabId, query) => new Promise((resolve) => {
  applySeed(newSeed || {}, tabId || p.get("tab"));
  f.onload = () => setTimeout(resolve, 400);
  f.src = "/__preview/app?r=" + Math.random() + (query ? "&" + query : "");
});
"""

INTERACT_PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#777">
<pre id="out" style="display:none">loading</pre>
<script>
const p = new URLSearchParams(location.search);
function applySeed(seed, tabId) {
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  localStorage.setItem("%(tab_key)s", tabId);
}
applySeed(%(seed)s, p.get("tab"));
const f = document.createElement("iframe");
f.src = "/__preview/app";
f.style.cssText = "width:%(width)spx;height:" + p.get("h") + "px;border:0;display:block";
%(helpers)s
f.onload = () => setTimeout(async () => {
  f.onload = null;
  try {
%(script)s
  } catch (e) {
    results.push("ERROR " + (e && e.stack ? e.stack.split("\\n").slice(0, 3).join(" | ") : e));
  }
  document.getElementById("out").textContent = "PREVIEW_REPORT" + JSON.stringify({
    results, errors: app().__previewErrors || ["error capture missing"],
  });
}, 400);
document.body.appendChild(f);
</script></body></html>"""


def find_edge():
    for path in EDGE_PATHS:
        if os.path.exists(path):
            return path
    sys.exit("Microsoft Edge not found; checked: " + ", ".join(EDGE_PATHS))


def make_handler(seed_json, scripts):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _send(self, body, ctype="text/html; charset=utf-8"):
            data = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/__preview/frame":
                self._send(FRAME_PAGE % {"seed": seed_json, "tab_key": TAB_KEY, "width": PHONE_WIDTH})
            elif path == "/__preview/interact":
                name = self.path.split("script=", 1)[1].split("&")[0]
                self._send(INTERACT_PAGE % {"seed": seed_json, "tab_key": TAB_KEY, "width": PHONE_WIDTH,
                                            "helpers": INTERACT_HELPERS, "script": scripts[name]})
            elif path == "/__preview/app":
                html = (REPO / "index.html").read_text(encoding="utf-8")
                html = re.sub(r"<head>", "<head><base href=\"/\">" + ERROR_CAPTURE, html, count=1)
                self._send(html)
            else:
                super().do_GET()

    return functools.partial(Handler, directory=str(REPO))


EXTRA_FLAGS = []  # e.g. dark mode, set from --dark


def run_edge(edge, profile, args):
    cmd = [edge, "--headless=new", "--disable-gpu", "--hide-scrollbars",
           "--no-first-run", f"--user-data-dir={profile}", *EXTRA_FLAGS, *args]
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tabs", help="comma-separated tab panel ids (default: every tab in the bottom nav)")
    parser.add_argument("--height", type=int, default=1900, help="screenshot height in px (default 1900)")
    parser.add_argument("--dark", action="store_true", help="render with prefers-color-scheme: dark")
    parser.add_argument("--out", default=None, help="screenshot folder (default: a temp folder)")
    parser.add_argument("--seed", default=None, help="JSON file of localStorage key/values to preload")
    parser.add_argument("--interact", action="append", default=[], metavar="SCRIPT.js",
                        help="click-through script to run (repeatable); screenshots its final state")
    parser.add_argument("--budget", type=int, default=10000, help="virtual ms each page gets (default 10000)")
    opts = parser.parse_args()
    if opts.dark:
        EXTRA_FLAGS.extend(["--force-dark-mode", "--blink-settings=preferredColorScheme=0"])
    if opts.interact:
        return run_interact(opts)

    tabs = opts.tabs.split(",") if opts.tabs else re.findall(
        r'data-tab="([^"]+)"', (REPO / "index.html").read_text(encoding="utf-8"))
    seed_json = json.dumps(json.load(open(opts.seed, encoding="utf-8"))) if opts.seed else "{}"
    out_dir = pathlib.Path(opts.out or tempfile.mkdtemp(prefix="phone-preview-"))
    out_dir.mkdir(parents=True, exist_ok=True)

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), make_handler(seed_json, {}))
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    edge = find_edge()

    failed = False
    try:
        for tab in tabs:
            url = f"http://127.0.0.1:{port}/__preview/frame?tab={tab}&h={opts.height}"
            profile = tempfile.mkdtemp(prefix="phone-preview-profile-")
            try:
                dom = run_edge(edge, profile, ["--virtual-time-budget=6000", "--dump-dom", url]).stdout
                match = re.search(r"PREVIEW_REPORT(\{.*?\})</pre>", dom, re.S)
                report = json.loads(match.group(1).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")) if match else None

                shot = out_dir / f"{tab}.png"
                run_edge(edge, profile, [f"--window-size={PHONE_WIDTH + 20},{opts.height}",
                                         "--virtual-time-budget=6000", f"--screenshot={shot}", url])
            finally:
                shutil.rmtree(profile, ignore_errors=True)

            if report is None:
                failed = True
                print(f"FAIL {tab}: page never reported (app crashed or hung before load)")
            elif report["errors"] or not report["visible"]:
                failed = True
                problems = report["errors"] + ([] if report["visible"] else ["tab panel not visible"])
                print(f"FAIL {tab}: " + "; ".join(problems))
            else:
                print(f"OK   {tab}: no JS errors")
            print(f"     screenshot: {shot if shot.exists() else 'NOT CREATED'}")
    finally:
        server.shutdown()

    print(f"\nScreenshots are {PHONE_WIDTH}px app width (gray strip on the right is padding, not the app).")
    sys.exit(1 if failed else 0)


def run_interact(opts):
    scripts = {pathlib.Path(path).stem: pathlib.Path(path).read_text(encoding="utf-8") for path in opts.interact}
    seed_json = json.dumps(json.load(open(opts.seed, encoding="utf-8"))) if opts.seed else "{}"
    start_tab = opts.tabs.split(",")[0] if opts.tabs else "today-panel"
    out_dir = pathlib.Path(opts.out or tempfile.mkdtemp(prefix="phone-preview-"))
    out_dir.mkdir(parents=True, exist_ok=True)

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), make_handler(seed_json, scripts))
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    edge = find_edge()

    failed = False
    try:
        for name in scripts:
            url = f"http://127.0.0.1:{port}/__preview/interact?script={name}&tab={start_tab}&h={opts.height}"
            shot = out_dir / f"{name}.png"
            # Two fresh profiles: one run reads the report, one takes the
            # screenshot (Edge can't do both in a single headless run).
            for mode in ("report", "screenshot"):
                profile = tempfile.mkdtemp(prefix="phone-preview-profile-")
                try:
                    if mode == "report":
                        dom = run_edge(edge, profile, [f"--virtual-time-budget={opts.budget}", "--dump-dom", url]).stdout
                        match = re.search(r"PREVIEW_REPORT(\{.*?\})</pre>", dom, re.S)
                        report = json.loads(html.unescape(match.group(1))) if match else None
                    else:
                        run_edge(edge, profile, [f"--window-size={PHONE_WIDTH + 20},{opts.height}",
                                                 f"--virtual-time-budget={opts.budget}", f"--screenshot={shot}", url])
                finally:
                    shutil.rmtree(profile, ignore_errors=True)

            if report is None:
                failed = True
                print(f"FAIL {name}: script never reported (crashed, hung, or --budget too small)")
                continue
            fails = [r for r in report["results"] if not r.startswith("PASS")]
            bad = bool(fails or report["errors"])
            failed = failed or bad
            total = len(report["results"])
            print(f"{'FAIL' if bad else 'OK  '} {name}: {total - len(fails)}/{total} checks passed, "
                  f"{len(report['errors'])} JS errors")
            for line in fails + [f"JS ERROR {e}" for e in report["errors"]]:
                print(f"     {line}")
            print(f"     final-state screenshot: {shot if shot.exists() else 'NOT CREATED'}")
    finally:
        server.shutdown()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
