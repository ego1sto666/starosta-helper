/* Офлайн-версия устанавливается целиком. До установки следующей версии браузер
   использует файлы из одного комплекта. Запросы к API и НГТУ не кешируются. */
const SCOPE = self.registration.scope;
const CACHE_PREFIX = "starosta:" + new URL(SCOPE).pathname + ":";
const CACHE = CACHE_PREFIX + "v41";
const SHELL = ["./", "index.html", "privacy.html", "css/tokens.css", "css/app.css", "js/nntu.js", "js/xlsx.js", "js/config.js", "js/api.js", "js/routes.js", "js/app.js", "demo/group.json",
  "manifest.webmanifest", "assets/icon.png", "assets/icons.woff2",
  "assets/icons-fill.woff2", "assets/onest-cyrillic.woff2", "assets/onest-latin.woff2"];
const SHELL_URLS = new Set(SHELL.map(path => new URL(path, SCOPE).href));

self.addEventListener("install", e => {
  // Пока комплект файлов не скачан целиком, продолжает работать предыдущая версия.
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path => new Request(new URL(path, SCOPE), { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;

  url.search = "";
  url.hash = "";
  if (!SHELL_URLS.has(url.href)) return;

  e.respondWith((async () => {
    const cached = await caches.open(CACHE).then(cache => cache.match(url.href)).catch(() => null);
    if (cached) return cached;
    return fetch(req, { cache: "no-cache", signal: AbortSignal.timeout?.(8000) }).catch(() => Response.error());
  })());
});

// нажали на напоминание — открываем приложение на нужном экране
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const go = (e.notification.data && e.notification.data.url) || "#home";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const c = list.find(client => client.url.startsWith(SCOPE));
    if (c) { c.postMessage({ go }); return c.focus(); }
    return self.clients.openWindow("./" + go);
  }));
});
