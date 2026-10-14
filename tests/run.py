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
    pages = sorted(pathlib.Path(__file__).parent.glob("*.test.html"))
    ok = True
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
