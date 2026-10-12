const CACHE_NAME = "weight-tracker-v21";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./coach-core.js",
  "./app.js",
  "./coach.js",
  "./reminders.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
  event.respondWith(
    fetch(event.request)
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "./", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
