const CACHE_NAME = "docpro-shell-v1";
const ASSETS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Cache-first for app shell; network for API
  if (request.url.includes("/api/")) return;
  event.respondWith(caches.match(request).then((r) => r || fetch(request)));
});
