// Update handling: the "Updated to vN" toast on the first launch of a new
// version, and the reload that applies an update waiting for a run.
await reload({ "app-version-seen": "1" });
await wait(500);
check("updated toast", /^Updated to v\d+$/.test($("#toast-text").textContent), $("#toast-text").textContent);
const seen = app().localStorage.getItem("app-version-seen");
check("version recorded", Number(seen) > 1, seen);

await reload({ "app-version-seen": seen });
await wait(500);
check("no toast on the same version", $("#toast").hidden);

let reloads = 0;
app().reloadApp = () => { reloads++; };
app().sessionStorage.removeItem("update-reload-at");
app().localStorage.setItem("weight-tracker-active-run", JSON.stringify({ startedAt: Date.now(), type: "run", path: [] }));
app().reloadForUpdate();
eq("no reload while a run is tracked", reloads, 0);
app().localStorage.removeItem("weight-tracker-active-run");
$("#run-save-form").hidden = false;
app().applyPendingUpdate();
eq("still waits while the run is unsaved", reloads, 0);
$("#run-save-form").hidden = true;
app().applyPendingUpdate();
eq("reloads once the run is saved", reloads, 1);

// The guard survives a reload, so a worker that keeps changing can't loop.
await reload({});
app().reloadApp = () => { reloads++; };
app().reloadForUpdate();
eq("no second reload within 10 s", reloads, 1);
