# Weight Tracker

A minimal, installable weight-tracking PWA. Log a weight entry with a
date, see your history, and see a simple trend line. All data is
stored locally on your device (`localStorage`) — nothing is sent to a
server, and it works offline once installed.

## Installing on iPhone

1. Open the app's URL in **Safari** (must be Safari, not Chrome, for
   iOS install support).
2. Tap the **Share** icon (square with an arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. A "Weight" icon appears on your home screen and opens
   full-screen like a normal app.

## Local development

Serve the folder with any static file server, e.g.:

```
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Notes

- Weight is stored in lbs only for now.
- Data lives in the browser's local storage for this specific
  installed app — clearing Safari/site data will erase it. There is
  no backup/export yet.
- A daily reminder notification was considered but deferred (see the
  project plan) — revisit if wanted later.
