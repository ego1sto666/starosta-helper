/* Клиент сервера «Помощника старосты». Без STAROSTA_API запросы не выполняются.

   Режимы (server/design/sync.md):
   • без аккаунта — всё как сейчас: данные только в этом браузере (StarostaAPI.enabled() === false);
   • с аккаунтом — те же данные (data.json) хранятся ещё и на сервере, приложение синхронизирует их
     с другими устройствами и замом; письма преподавателей приходят на экран «Почта».

   Адрес локального сервера задаёт js/config.js. В публикации его задаёт конфигурация развёртывания.
   Вход хранится в cookie (httpOnly), токенов в localStorage нет. */
(() => {
  "use strict";
  const BASE = window.STAROSTA_API || "";

  class ApiError extends Error {
    constructor(status, detail) { super(typeof detail === "string" ? detail : (detail && detail.message) || `Ошибка ${status}`); this.status = status; this.detail = detail; }
  }

  async function call(method, path, body) {
    if (!BASE) throw new ApiError(0, "Сервер не подключён — данные хранятся только на этом устройстве");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(BASE + path, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json", "X-Starosta": "1" }, // без этого заголовка сервер не примет изменения
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 204) return null;
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted) throw new ApiError(0, "Сервер слишком долго отвечает");
      if (!response.ok) throw new ApiError(response.status, data?.detail);
      if (data === null) throw new ApiError(502, "Сервер вернул неожиданный ответ");
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, "Не удалось связаться с сервером. Попробуйте позже.");
    } finally { clearTimeout(timeout); }
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
      create: (title, data, university = "") => post("/groups", { title, university, nntu_group: (data && data.settings && data.settings.nntu_group) || "", data }),
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
    push: {
      config: () => get("/push/config"),
      status: endpoint => post("/push/device/status", { endpoint }),
      save: subscription => put("/push/device", subscription),
      remove: endpoint => post("/push/device/remove", { endpoint }),
      test: endpoint => post("/push/test", { endpoint }),
    },
    telegram: {
      polls: id => get(`${g(id)}/telegram/polls`),
    },
  };

  /* ---------- слияние изменений с двух устройств ----------
     По каждому полю записи и каждой отметке отдельного студента:
       изменили только у меня → берём моё; только на сервере → берём серверное;
       изменили оба → побеждает моё (я сейчас за экраном), удалили у одного и не трогали у другого → удаляем. */
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const isRecord = v => v !== null && typeof v === "object" && !Array.isArray(v);
  function pick(b, l, r) {
    if (same(l, r)) return l;
    if (same(l, b)) return r;   // у меня без изменений — берём с сервера (в том числе удаление)
    if (same(r, b)) return l;   // на сервере без изменений — берём моё
    return l === undefined ? r : l; // изменили оба: моё, но удаление не перебивает чужую правку
  }
  function mergeList(base = [], local = [], remote = []) {
    const byId = a => new Map((Array.isArray(a) ? a : []).filter(x => x && x.id).map(x => [x.id, x]));
    const B = byId(base), L = byId(local), R = byId(remote), out = [];
    const ids = [...R.keys(), ...[...L.keys()].filter(id => !R.has(id))]; // порядок сервера, новые мои — в конец
    for (const id of ids) { const v = mergeValue(B.get(id), L.get(id), R.get(id)); if (v !== undefined) out.push(v); }
    return out;
  }
  function mergeValue(base, local, remote) {
    if (!isRecord(local) || !isRecord(remote)) return pick(base, local, remote);
    return mergeMap(isRecord(base) ? base : {}, local, remote, mergeValue);
  }
  function mergeMap(base, local, remote, merge) {
    const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
    const entries = [];
    for (const key of keys) {
      const read = obj => Object.hasOwn(obj, key) ? obj[key] : undefined;
      const value = merge(read(base), read(local), read(remote));
      if (value !== undefined) entries.push([key, value]);
    }
    return Object.fromEntries(entries);
  }
  function mergeData(base, local, remote) {
    return mergeMap(base || {}, local, remote, (b, l, r) => {
      const list = l ?? r;
      if (Array.isArray(list) && list.every(x => isRecord(x) && x.id)) return mergeList(b, l, r);
      return mergeValue(b, l, r);
    });
  }

  /* ---------- синхронизация: отправить через 3 с после последнего изменения, при 409 — слить и повторить ---------- */
  function createSync({ groupId, getData, setData, validateData = () => {}, snapshot = null, onSnapshot = () => {}, onState = () => {} }) {
    let rev = snapshot?.rev ?? 0, base = snapshot?.base ?? null, timer = 0, stopped = false;
    let pendingPull = null, pendingPush = null, retryDelay = 3000;
    const copy = value => JSON.parse(JSON.stringify(value));
    function record(revision, data) {
      rev = revision;
      base = copy(data);
      onSnapshot({ rev, base });
    }
    function applyRemote(response) {
      if (!Number.isSafeInteger(response?.rev) || response.rev < 0 || !isRecord(response.data))
        throw new ApiError(502, "Сервер вернул неверную версию данных группы");
      validateData(response.data);
      const local = getData();
      const merged = local ? mergeData(base, local, response.data) : copy(response.data);
      if (!same(local, merged)) setData(merged);
      record(response.rev, response.data);
      return !same(merged, response.data);
    }
    async function pullNow() {
      if (pendingPush) await pendingPush;
      if (stopped) return;
      const response = await API.groups.pull(groupId);
      if (stopped) return;
      if (applyRemote(response)) schedule(); else onState("ok");
    }
    function pull() {
      if (!pendingPull) pendingPull = pullNow().finally(() => { pendingPull = null; });
      return pendingPull;
    }
    async function pushNow() {
      if (stopped || !getData()) return;
      onState("saving");
      try {
        for (let i = 0; i < 3; i++) {
          const mine = copy(getData());
          try {
            const response = await API.groups.push(groupId, rev, mine);
            if (stopped) return;
            if (!Number.isSafeInteger(response?.rev) || response.rev <= rev) throw new ApiError(502, "Сервер вернул неверную версию данных группы");
            record(response.rev, mine);
            retryDelay = 3000;
            onState("ok");
            if (!same(getData(), mine)) schedule();
            return;
          } catch (e) {
            if (stopped) return;
            if (e.status !== 409) throw e;
            applyRemote(e.detail);
          }
        }
        onState("conflict");
      } catch (e) {
        if (stopped) return;
        onState(e.status === 0 ? "offline" : "error", e);
        if (e.status === 0 || e.status >= 500) {
          retryDelay = Math.min(60000, retryDelay * 2);
          schedule(retryDelay);
        }
      }
    }
    function push() {
      if (pendingPush) return pendingPush;
      if (pendingPull) return pendingPull.then(push, push);
      clearTimeout(timer);
      pendingPush = pushNow().finally(() => { pendingPush = null; });
      return pendingPush;
    }
    function schedule(delay = 3000) { if (!stopped) { clearTimeout(timer); timer = setTimeout(push, delay); } }
    function stop() { stopped = true; clearTimeout(timer); }
    return { pull, push, changed: () => schedule(), stop };
  }

  window.StarostaAPI = Object.assign(API, { mergeData, createSync });
})();
