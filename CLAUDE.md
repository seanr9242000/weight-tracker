# Working in this repo

Weight & Save — a weight/run-tracking PWA. Plain HTML/CSS/JS, no
build step, no framework. See `README.md` for what the app does and
how to run it locally.

## Start here on a fresh/resumed session

Before doing anything else, read `docs/progress-log-summary.md` for
the big picture, and `docs/progress-log-detailed.md` if you need exact
timestamps or elapsed time on a specific change. These exist so a
session that starts with no memory of prior conversations (e.g. after
`/clear` or a context compact) can re-orient from the repo itself
instead of needing the old conversation.

## Commit/push approval

**Always ask for explicit approval before running `git commit` or
`git push` in this repo.** Do not auto-commit, even for small fixes.
This is the opposite convention from some other repos (e.g. the EASE
case-study repo allows autocommit) — this one does not.

## Keeping the progress logs current

After any approved commit:

1. Append a row to `docs/progress-log-detailed.md` under the current
   session's table (same calendar date + continuous work = same
   session; a gap of hours/days starts a new session table). Include
   the time, a one-line description (the commit message's summary
   line is usually enough), and elapsed time since the previous commit
   in that session (omit/mark "—" for a session's first entry).
2. After finishing a logical chunk of work (not necessarily every
   single commit), add or update a entry in
   `docs/progress-log-summary.md` — a short paragraph a human would
   actually want to read, not a restatement of the detailed log.

## Before a context clear/compact

If a `/compact` or `/clear` is about to happen (user-initiated or the
session is getting long), make sure any outstanding work is committed
and pushed first (with approval, per above) and the progress logs are
up to date — so nothing is lost and a fresh session can pick up
cleanly from the logs.

## Service worker cache

`sw.js` caches static assets under `CACHE_NAME`. Bump it
(`weight-tracker-vN` → `vN+1`) in the same change any time
`index.html`, `app.js`, `style.css`, `manifest.json`, or an icon file
changes — otherwise installed devices keep serving stale files.
