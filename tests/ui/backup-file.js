// Export a backup file (two taps: build, then share) and import it into
// a fresh install, progress photos included.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let shared = null;
let reloads = 0;
/* IndexedDB finishes in real time, which the headless virtual-time clock
   doesn't wait for, so wait on it by spinning event-loop tasks (no timers). */
const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
const done = async (p) => { let d = false, v; p.then((x) => { d = true; v = x; }); for (let n = 0; !d && n < 2e6; n++) await tick(); return v; };
const until = async (cond) => { for (let n = 0; !cond() && n < 2e6; n++) await tick(); };
const stub = () => {
  app().navigator.canShare = () => true;
  app().navigator.share = async (data) => { shared = data; };
  app().confirm = () => true;
  app().reloadApp = () => { reloads++; };
};

await reload({ "coach-started-at": "0", "weight-tracker-entries": [{ id: "w", date: today, weight: 199.2, unit: "lbs" }] });
stub();
await done(app().addPhoto({ id: "p1", date: today, blob: await (await fetch(PNG)).blob() }));

click("#backup-export");
await until(() => $("#backup-export").textContent === "Share backup file");
eq("tap 1 builds the file", $("#backup-export").textContent, "Share backup file");
click("#backup-export");
await wait(50);
const file = shared && shared.files[0];
check("tap 2 shares a file", Boolean(file));
eq("file name", file.name, `weight-and-save-backup-${today}.json`);
const json = JSON.parse(await file.text());
eq("file has the weights", JSON.parse(json.keys["weight-tracker-entries"])[0].weight, 199.2);
eq("file has the photo", json.photos.map((p) => [p.id, p.date, p.dataUrl.startsWith("data:image/png")]), [["p1", today, true]]);
eq("button resets", $("#backup-export").textContent, "Export backup");

// Import into a fresh install (photos live in IndexedDB, which reload() doesn't wipe).
await reload({});
stub();
await done(app().deletePhotoRecord("p1"));
eq("no photos before import", (await done(app().getAllPhotos())).length, 0);
const pick = async (text) => {
  const dt = new (app().DataTransfer)();
  dt.items.add(new (app().File)([text], "backup.json", { type: "application/json" }));
  $("#backup-import-input").files = dt.files;
  $("#backup-import-input").dispatchEvent(new (app().Event)("change", { bubbles: true }));
  await wait(500);
};
await pick("not a backup");
await until(() => $("#restore-card-status").textContent !== "");
eq("bad file explained", $("#restore-card-status").textContent, "That file isn't a Weight & Save backup.");
// A corrupt photo fails before anything is replaced: error shown, no reload, storage untouched.
const bad = JSON.parse(JSON.stringify(json));
bad.photos[0].dataUrl = "data:image/png;base64,@@@not-base64@@@";
await pick(JSON.stringify(bad));
await until(() => $("#restore-card-status").textContent.startsWith("Couldn't import"));
check("corrupt photo reports an error", $("#restore-card-status").textContent.startsWith("Couldn't import the backup:"));
eq("no reload after failed import", reloads, 0);
eq("storage unchanged after failed import", ls("weight-tracker-entries"), null);
let asked = "";
app().confirm = (m) => { asked = m; return true; };
await pick(JSON.stringify(json));
await until(() => reloads > 0);
eq("weights imported", ls("weight-tracker-entries")[0].weight, 199.2);
eq("photo imported", (await done(app().getAllPhotos())).map((p) => p.id), ["p1"]);
eq("reloaded after import", reloads, 1);
check("confirm wording", asked.startsWith("Replace your logs and settings on this phone with the backup file from ") && asked.endsWith("Its 1 photo will be added to the ones already here."));

// A phone that already has logs: the first offer is photos only, so an older file can't overwrite newer logs.
const newer = [{ id: "n", date: today, weight: 185.5, unit: "lbs" }];
const asks = [];
const answers = (...a) => { asks.length = 0; app().confirm = (m) => { asks.push(m); return a[asks.length - 1]; }; };
await reload({ "weight-tracker-entries": newer });
stub();
await done(app().deletePhotoRecord("p1"));
answers(true);
reloads = 0;
await pick(JSON.stringify(json));
await until(() => reloads > 0);
eq("photos-only: one confirm", asks.length, 1);
eq("photos-only: wording", asks[0], "Add the file's 1 photo and keep this phone's logs and settings?");
eq("photos-only: logs untouched", ls("weight-tracker-entries")[0].weight, 185.5);
eq("photos-only: photo added", (await done(app().getAllPhotos())).map((p) => p.id), ["p1"]);
eq("photos-only: reloads once", reloads, 1);

// Cancel on that offer falls through to the full replace.
await reload({ "weight-tracker-entries": newer });
stub();
await done(app().deletePhotoRecord("p1"));
answers(false, true);
reloads = 0;
await pick(JSON.stringify(json));
await until(() => reloads > 0);
eq("full replace: two confirms", asks.length, 2);
check("full replace: second is the replace confirm", asks[1].startsWith("Replace your logs and settings on this phone with the backup file from "));
eq("full replace: logs replaced", ls("weight-tracker-entries")[0].weight, 199.2);
eq("full replace: photo added", (await done(app().getAllPhotos())).map((p) => p.id), ["p1"]);
eq("full replace: no code, so a hint is left for after the reload", app().localStorage.getItem("backup-import-hint"), "1");
await reload({ "backup-import-hint": "1" });
eq("hint shown while backup is off", $("#backup-status").textContent, "Imported. Turn backup on, or enter your restore code below so backups continue under it.");
