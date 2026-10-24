// Restore from a backup code: the fresh-install card on Today and the
// Backup card's Restore form. The server is stubbed.
const code = "WS-7K3M-Q9TP-2XHD";
const backup = { app: "weight-and-save", format: 1, savedAt: Date.now() - 3600000, keys: {
  "weight-tracker-entries": JSON.stringify([{ id: "w1", date: today, weight: 201.4, unit: "lbs" }]),
  "coach-taper-start": "2026-10-12",
} };
let reloads = 0;
let asked = null;
const stub = (answer) => {
  app().backupRemote.load = async (c) => (c === code ? backup : null);
  app().backupRemote.save = async () => {};
  app().confirm = (msg) => { asked = msg; return answer; };
  app().reloadApp = () => { reloads++; };
};
const submit = async (form) => { $(form).requestSubmit(); await wait(50); };

// A fresh install (only seeded data) offers Restore at the top of Today.
await reload({});
stub(true);
check("fresh install shows the restore card", !$("#restore-card").hidden);

fill("#restore-card-input", "WS-7K3M");
await submit("#restore-card-form");
check("short code explained", $("#restore-card-status").textContent.startsWith("That doesn't look like a restore code"));
fill("#restore-card-input", "WS-0000-0000-0000");
await submit("#restore-card-form");
eq("unknown code", $("#restore-card-status").textContent, "No backup found for that code. Check it against your Notes.");

// Declining the confirm changes nothing.
stub(false);
fill("#restore-card-input", "ws 7k3m q9tp 2xhd");
await submit("#restore-card-form");
check("asks before replacing", Boolean(asked) && asked.startsWith("Replace everything on this phone"), asked);
eq("cancel leaves data alone", app().localStorage.getItem("weight-tracker-entries"), null);
eq("cancel says so", $("#restore-card-status").textContent, "Restore cancelled. Nothing changed.");
eq("no reload on cancel", reloads, 0);

// Confirming restores, keeps the code, turns backup on, reloads.
stub(true);
await submit("#restore-card-form");
eq("weights restored", ls("weight-tracker-entries")[0].weight, 201.4);
eq("taper restored", app().localStorage.getItem("coach-taper-start"), "2026-10-12");
eq("code kept", app().localStorage.getItem("backup-code"), code);
eq("backup on", app().localStorage.getItem("backup-on"), "1");
eq("reloads into the restored data", reloads, 1);

// With data on the phone the card stays hidden; Restore lives in the Backup card.
await reload({ "weight-tracker-entries": [{ id: "w", date: today, weight: 200 }] });
stub(true);
check("card hidden when there's data", $("#restore-card").hidden);
fill("#backup-restore-input", code);
await submit("#backup-restore-form");
eq("Backup card restore replaces local data", ls("weight-tracker-entries")[0].weight, 201.4);

// A connection error is explained.
await reload({});
stub(true);
app().backupRemote.load = async () => { throw new Error("no connection"); };
fill("#restore-card-input", code);
await submit("#restore-card-form");
check("connection error explained", $("#restore-card-status").textContent.startsWith("Couldn't reach the backup: no connection"));

// "Start fresh" hides the card for good.
clickText("Start fresh");
check("start fresh hides the card", $("#restore-card").hidden);
