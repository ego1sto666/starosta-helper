/* Клиент сервера «Помощника старосты» — ЧЕРНОВИК. Подключён к странице, но без STAROSTA_API запросы не выполняются.

   Как будет работать (server/design/sync.md):
   • без аккаунта — всё как сейчас: данные только в этом браузере (StarostaAPI.enabled() === false);
   • с аккаунтом — те же данные (data.json) хранятся ещё и на сервере, приложение синхронизирует их
     с другими устройствами и замом; письма преподавателей приходят на экран «Почта».

   Подключение сервера (шаг 3–4 в ROADMAP.md): до этого файла задать window.STAROSTA_API = "/api".
   Вход хранится в cookie (httpOnly), токенов в localStorage нет. */
(() => {
  "use strict";
  const BASE = window.STAROSTA_API || "";

  class ApiError extends Error {
    constructor(status, detail) { super(typeof detail === "string" ? detail : (detail && detail.message) || `Ошибка ${status}`); this.status = status; this.detail = detail; }
  }

  async function call(method, path, body) {
    if (!BASE) throw new ApiError(0, "Сервер не подключён — данные хранятся только на этом устройстве");
    let r;
    try {
      r = await fetch(BASE + path, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json", "X-Starosta": "1" }, // без этого заголовка сервер не примет изменения
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) { throw new ApiError(0, "Нет связи с сервером — изменения сохранятся, когда она появится"); }
    if (r.status === 204) return null;
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, data && data.detail);
    return data;
  }
  const get = p => call("GET", p), post = (p, b = {}) => call("POST", p, b), put = (p, b) => call("PUT", p, b), del = p => call("DELETE", p);
  const g = id => `/groups/${encodeURIComponent(id)}`;

  const API = {
    enabled: () => !!BASE,
    ApiError,
    auth: {
      register: ({ login, email, name, password, consent }) => post("/auth/register", { login, email, name, password, consent }),
      login: (login, password) => post("/auth/login", { login, password }),
      logout: () => post("/auth/logout"),
      me: () => get("/auth/me"),
      forgot: email => post("/auth/password/forgot", { email }),
      reset: (token, password) => post("/auth/password/reset", { token, password }),
    },
    groups: {
      list: () => get("/groups"),
      create: (title, data) => post("/groups", { title, nntu_group: (data && data.settings && data.settings.nntu_group) || "", data }),
      pull: id => get(`${g(id)}/data`),
      push: (id, rev, data) => put(`${g(id)}/data`, { rev, data }),
      invite: (id, role = "deputy") => post(`${g(id)}/invites`, { role }),
      join: code => post("/invites/accept", { code }),
    },
    mail: {
      sources: id => get(`${g(id)}/mail/sources`),
      addImap: (id, { provider, login, password, host = "" }) => post(`${g(id)}/mail/sources`, { provider, login, password, host }),
      remove: (id, sourceId) => del(`${g(id)}/mail/sources/${encodeURIComponent(sourceId)}`),
      inbox: (id, status = "new") => get(`${g(id)}/inbox?status=${encodeURIComponent(status)}`),
      accept: (id, itemId, type, entityId) => post(`${g(id)}/inbox/${encodeURIComponent(itemId)}/accept`, { type, id: entityId }),
      dismiss: (id, itemId) => post(`${g(id)}/inbox/${encodeURIComponent(itemId)}/dismiss`),
    },
  };

  /* ---------- слияние изменений с двух устройств (трёхстороннее: общая основа, моё, с сервера) ----------
     По каждой записи с id (студент, пара, дело…) и по каждому ключу журнала/переносов:
       изменили только у меня → берём моё; только на сервере → берём серверное;
       изменили оба → побеждает моё (я сейчас за экраном), удалили у одного и не трогали у другого → удаляем. */
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function pick(b, l, r) {
    if (same(l, r)) return l;
    if (same(l, b)) return r;   // у меня без изменений — берём с сервера (в том числе удаление)
    if (same(r, b)) return l;   // на сервере без изменений — берём моё
    return l === undefined ? r : l; // изменили оба: моё, но удаление не перебивает чужую правку
  }
  function mergeList(base = [], local = [], remote = []) {
    const byId = a => new Map(a.filter(x => x && x.id).map(x => [x.id, x]));
    const B = byId(base), L = byId(local), R = byId(remote), out = [];
    const ids = [...R.keys(), ...[...L.keys()].filter(id => !R.has(id))]; // порядок сервера, новые мои — в конец
    for (const id of ids) { const v = pick(B.get(id), L.get(id), R.get(id)); if (v !== undefined) out.push(v); }
    return out;
  }
  function mergeMap(base = {}, local = {}, remote = {}) {
    const out = {};
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) { const v = pick(base[k], local[k], remote[k]); if (v !== undefined) out[k] = v; }
    return out;
  }
  function mergeData(base, local, remote) {
    base = base || {}; const out = { ...remote };
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const b = base[k], l = local[k], r = remote[k];
      if (Array.isArray(l) || Array.isArray(r)) out[k] = mergeList(b, l, r);
      else if ((l && typeof l === "object") || (r && typeof r === "object")) out[k] = mergeMap(b, l, r); // attendance, overrides, settings
      else out[k] = pick(b, l, r);
    }
    return out;
  }

  /* ---------- синхронизация: отправить через 3 с после последнего изменения, при 409 — слить и повторить ---------- */
  function createSync({ groupId, getData, setData, onState = () => {} }) {
    let rev = 0, base = null, timer = 0, busy = false;
    async function pull() {
      const r = await API.groups.pull(groupId); rev = r.rev; base = r.data; setData(r.data); onState("ok");
    }
    async function push() {
      if (busy) return schedule(); busy = true; onState("saving");
      try {
        for (let i = 0; i < 3; i++) {
          const mine = getData();
          try { rev = (await API.groups.push(groupId, rev, mine)).rev; base = mine; onState("ok"); return; }
          catch (e) {
            if (e.status !== 409) throw e;
            const merged = mergeData(base, mine, e.detail.data); rev = e.detail.rev; base = e.detail.data; setData(merged);
          }
        }
        onState("conflict");
      } catch (e) { onState(e.status === 0 ? "offline" : "error", e); }
      finally { busy = false; }
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(push, 3000); }
    return { pull, push, changed: schedule };
  }

  window.StarostaAPI = Object.assign(API, { mergeData, createSync });
})();
