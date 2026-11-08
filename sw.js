/* Работа без интернета. Файлы приложения: сначала сеть (чтобы обновления приходили сразу),
   без сети — из кеша.
   Запросы к сайту НГТУ не кешируются: расписание загружается только по кнопке. */
const CACHE = "starosta-v28";
const SHELL = ["./", "index.html", "privacy.html", "css/tokens.css", "css/app.css", "js/nntu.js", "js/xlsx.js", "js/config.js", "js/api.js", "js/app.js", "demo/group.json",
  "manifest.webmanifest", "assets/icon.png", "assets/icons.woff2",
  "assets/icons-fill.woff2", "assets/onest-cyrillic.woff2", "assets/onest-latin.woff2",
  "assets/unbounded-cyrillic.woff2", "assets/unbounded-latin.woff2"];

self.addEventListener("install", e => {
  // по одному файлу: если какой-то не скачался, остальные всё равно закешируются
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;

  if (url.origin === location.origin) {
    // у запроса страницы (navigate) нельзя менять параметры — запрашиваем по адресу
    const net = req.mode === "navigate" ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req, { cache: "no-cache" });
    e.respondWith(net.then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
  }
});

// нажали на напоминание — открываем приложение на нужном экране
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const go = (e.notification.data && e.notification.data.url) || "#home";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { c.postMessage({ go }); return c.focus(); }
    return self.clients.openWindow("./" + go);
  }));
});
