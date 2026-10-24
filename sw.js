const CACHE_NAME = "weight-tracker-v32";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./ui.js",
  "./version.js",
  "./coach-core.js",
  "./food-data.js",
  "./food-core.js",
  "./backup-core.js",
  "./app.js",
  "./coach.js",
  "./food.js",
  "./quickadd.js",
  "./updates.js",
  "./reminders.js",
  "./backup.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  // "reload" skips the browser's HTTP cache. GitHub Pages serves every
  // file with max-age=600, so a plain addAll could precache the
  // previous deploy's files under the new version's name.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Supabase API calls (and any non-GET) go straight to the network:
  // caching them would serve stale data and can't store POSTs anyway.
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.hostname.endsWith(".supabase.co")) return;
  // Our own files revalidate with the server on every request (a cheap
  // 304 when unchanged) instead of trusting the 10-minute HTTP cache,
  // so a deploy shows up on the next check. CDN files keep the default.
  const init = url.origin === self.location.origin ? { cache: "no-cache" } : undefined;
  event.respondWith(
    fetch(event.request, init)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* Push reminders from the send-pings Edge Function. iOS revokes push
   permission if a push arrives without a visible notification, so
   every push shows one. Repeats share the item's tag and replace the
   earlier notification instead of stacking. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Weight & Save", {
      body: data.body || "",
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: { url: data.url || "./" },
    })
  );
});

/* A single-item reminder's tag is its checklist item id, so the tap
   opens that item (a meal opens straight into its log panel). Batched
   reminders ("3 things due") just open the app. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tag = event.notification.tag;
  const itemId = tag && tag !== "batch" ? tag : null;
  const path = itemId ? `./?item=${encodeURIComponent(itemId)}` : event.notification.data?.url || "./";
  const url = new URL(path, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      if (!open) return self.clients.openWindow(url);
      if (itemId) open.postMessage({ type: "open-item", id: itemId });
      return open.focus();
    })
  );
});
