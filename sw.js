/* Работа без интернета. Файлы приложения: сначала сеть (чтобы обновления приходили сразу),
   без сети — из кеша. Шрифты Google — из кеша с фоновым обновлением.
   Запросы к сайту НГТУ не кешируются: расписание загружается только по кнопке. */
const CACHE = "starosta-v2";
const SHELL = ["./", "index.html", "css/tokens.css", "css/app.css", "js/nntu.js", "js/xlsx.js", "js/app.js",
  "manifest.webmanifest", "assets/icon.png", "assets/materialdesignicons-webfont.ttf",
  "assets/Roboto-Medium.ttf", "assets/Roboto-Black.ttf"];

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
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
