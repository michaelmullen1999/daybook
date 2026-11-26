// Keeps Daybook opening when the internet is down. The data itself is cached by Firebase.
const CACHE = "daybook-shell-v2";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "./style.css", "./fonts.css", "./manifest.webmanifest", "./icons/icon-192.png"]).catch(() => {}))); });
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.includes("/me/")) return;
  // network first, so updates show straight away; fall back to the saved copy offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./"))));
});

// Reminders sent by the family's reminder sender
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { data: { body: e.data && e.data.text() } }; }
  const m = d.data || d.notification || d;
  e.waitUntil(self.registration.showNotification(m.title || "Daybook", { body: m.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: m.tag || undefined, data: { url: m.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { for (const c of cs) if ("focus" in c) return c.focus(); return self.clients.openWindow(url); }));
});
