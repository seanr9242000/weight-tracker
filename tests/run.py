"""Runs every tests/*.test.html page in headless Edge and prints each
page's "N/M passed" summary plus any failures.

Usage (from the repo root):  python tests/run.py
Exit code 0 = all pages passed; 1 = a failure, error, or missing output.
Needs only Python and Microsoft Edge (no Node on this machine)."""

import html
import os
import pathlib
import re
import subprocess
import sys
import tempfile

EDGE_PATHS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_edge():
    for path in EDGE_PATHS:
        if os.path.exists(path):
            return path
    sys.exit("Microsoft Edge not found; checked: " + ", ".join(EDGE_PATHS))


ROOT = pathlib.Path(__file__).resolve().parent.parent


def static_checks():
    """Cross-file rules no browser page can see: the service worker's
    cache version matches version.js, every local file index.html loads
    is precached, and the worker never trusts GitHub Pages' 10-minute
    HTTP cache. Returns (passed, total, failure lines)."""
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    version_file = ROOT / "version.js"
    version = version_file.read_text(encoding="utf-8") if version_file.exists() else ""
    checks = []

    cache = re.search(r'CACHE_NAME = "weight-tracker-v(\d+)"', sw)
    app = re.search(r"APP_VERSION = (\d+);", version)
    checks.append(("CACHE_NAME matches APP_VERSION",
                   bool(cache and app and cache.group(1) == app.group(1)),
                   f"sw.js v{cache and cache.group(1)} vs version.js {app and app.group(1)}"))

    assets = set(re.findall(r'"\./([^"]+)"', sw))
    local = re.findall(r'(?:src|href)="(?!https?:)([^"#]+\.(?:js|css|json|png))"', index)
    missing = [f for f in local if f not in assets]
    checks.append(("every local file index.html loads is precached", not missing,
                   f"missing from sw.js ASSETS: {missing}"))

    checks.append(("install precache bypasses the HTTP cache", 'cache: "reload"' in sw,
                   'sw.js install should add new Request(url, { cache: "reload" })'))
    checks.append(("same-origin fetches revalidate", 'cache: "no-cache"' in sw,
                   'sw.js fetch should pass { cache: "no-cache" } for same-origin GETs'))

    fails = [f"FAIL {name} — {info}" for name, ok, info in checks if not ok]
    return len(checks) - len(fails), len(checks), fails


def run_page(edge, page):
    with tempfile.TemporaryDirectory() as profile:
        dom = subprocess.run(
            [edge, "--headless=new", "--disable-gpu", f"--user-data-dir={profile}",
             "--allow-file-access-from-files", "--virtual-time-budget=3000",
             "--dump-dom", page.as_uri()],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60,
        ).stdout
    match = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    return html.unescape(match.group(1)).strip() if match else None


def main():
    edge = find_edge()
    passed, total, fails = static_checks()
    print(f"static checks: {passed}/{total} passed" + "".join("\n" + f for f in fails))
    ok = passed == total
    pages = sorted(pathlib.Path(__file__).parent.glob("*.test.html"))
    for page in pages:
        out = run_page(edge, page.resolve())
        if not out:
            print(f"{page.name}: no output (page failed to load?)")
            ok = False
            continue
        print(f"{page.name}: {out}")
        passed, total = map(int, out.split(" ", 1)[0].split("/"))
        ok = ok and passed == total
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
