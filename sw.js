// Service worker Duitku: simpan tampilan agar cepat dibuka & bisa diinstal.
// Data keuangan TIDAK pernah disimpan di cache.
const VERSI = "duitku-v3-11";
const SHELL = ["/", "/index.html", "/app.js", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSI).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return; // API & font: langsung ke jaringan
  e.respondWith(
    fetch(e.request)
      .then((res) => { const salin = res.clone(); caches.open(VERSI).then((c) => c.put(e.request, salin)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/index.html")))
  );
});
