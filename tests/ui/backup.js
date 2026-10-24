// Backup & updates card: version line, turning backup on (code shown,
// first upload), automatic backup after a change (30 s, at most once a
// minute), turning it off. The server is stubbed. Run with --budget 120000.
const uploads = [];
const stub = () => {
  app().backupRemote.save = async (code, data) => { uploads.push({ code, data }); };
  app().backupRemote.load = async () => null;
};

await reload({ "coach-started-at": "0" });
stub();
check("version shown", /^Weight & Save v\d+$/.test($("#backup-version").textContent), $("#backup-version").textContent);
check("off by default", $("#backup-status").textContent.startsWith("Off."));
check("code hidden while off", $("#backup-code-row").hidden);

click("#backup-toggle");
await wait(50);
const code = app().localStorage.getItem("backup-code");
check("code generated", /^WS-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(code), code);
eq("code shown", $("#backup-code").textContent, code);
check("code note shown", !$("#backup-code-note").hidden);
eq("first upload on turn-on", uploads.length, 1);
eq("uploaded under the code", uploads[0].code, code);
check("upload carries app data, not device keys",
  "coach-started-at" in uploads[0].data.keys && !("backup-code" in uploads[0].data.keys));
eq("status", $("#backup-status").textContent, "Last backed up just now.");

// A change backs up later: not before a minute since the last one.
app().localStorage.setItem("water-log", JSON.stringify([{ id: "x", date: today, at: Date.now(), oz: 8 }]));
await wait(31000);
eq("not before the minute is up", uploads.length, 1);
await wait(30000);
eq("change uploaded", uploads.length, 2);
eq("upload has the change", JSON.parse(uploads[1].data.keys["water-log"])[0].oz, 8);

// A failed upload says so and keeps the change for a retry.
app().backupRemote.save = async () => { throw new Error("offline"); };
app().localStorage.setItem("water-log", "[]");
await app().runBackup();
eq("error shown", $("#backup-status").textContent, "Backup failed: offline. Will retry.");
stub();

// Off: no more uploads; the code is kept for next time.
click("#backup-toggle");
check("off again", $("#backup-status").textContent.startsWith("Off."));
eq("code kept", app().localStorage.getItem("backup-code"), code);
app().localStorage.setItem("water-log", "[]");
await app().runBackup();
eq("no uploads while off", uploads.length, 2);

// Opening a copy with nothing changed must not upload its snapshot over the cloud copy.
const ON = { "coach-started-at": "0", "backup-on": "1", "backup-code": code, "backup-last": "1" };
uploads.length = 0;
await reload(ON);
stub();
// Nothing is scheduled, so nothing can upload (waiting out the 30 s would blow the 120 s budget).
eq("no backup scheduled when opened with nothing changed", app().eval("backupTimer"), null);
await wait(2000);
eq("no upload when opened with nothing changed", uploads.length, 0);

// A change that never went up before the app closed is still sent on the next launch.
await reload({ ...ON, "backup-dirty": "1" });
stub();
await wait(31000);
eq("pending change uploaded on next launch", uploads.length, 1);
eq("dirty flag cleared after upload", app().localStorage.getItem("backup-dirty"), null);

// A change marks it dirty (and the flag itself is never backed up); turning off clears it.
app().localStorage.setItem("water-log", "[]");
eq("change sets the dirty flag", app().localStorage.getItem("backup-dirty"), "1");
click("#backup-toggle");
eq("turning off clears the dirty flag", app().localStorage.getItem("backup-dirty"), null);
