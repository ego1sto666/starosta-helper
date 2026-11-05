/* Помощник старосты — приложение для старост НГТУ в браузере.
   Данные хранятся только в этом браузере (localStorage), формат — тот же data.json,
   что был у программы на ПК, поэтому старый файл можно просто загрузить.
   Правила (семестры, недели, подгруппы, отметки) перенесены из прежней Kivy-версии. */
(() => {
  "use strict";

  /* ---------- иконки (коды из Kivy-версии) ---------- */
  const ICON = {
    home: "F02DE", schedule: "F00F0", journal: "F08A8", group: "F0849", tasks: "F18F9", party: "F1056",
    subgroups: "F160E", event: "F09D3", plus: "F0415", delete: "F0A7A", edit: "F0CB6", copy: "F018F", cog: "F08BB",
    left: "F0141", right: "F0142", back: "F004D", place: "F07D9", door: "F081A", clock: "F0150", alarm: "F0020",
    teacher: "F0CE3", school: "F1180", cake: "F00EB", bullhorn: "F0B23", check: "F05E0", uncheck: "F0130",
    tick: "F012C", excel: "F138F", chart: "F07AF", add_many: "F0010", add_one: "F0014", calendar: "F00EE",
    sun: "F0599", moon: "F0594", coffee: "F06CA", going: "F0008", info: "F02FD", flag: "F023C", star: "F0AE2",
    broom: "F00E2", email: "F01EE", telegram: "F048A", phone: "F03F2", contact: "F05D2", crown: "F01A5",
    deputy: "F0017", translate: "F05CA", search: "F0349", close: "F0156", download: "F01DA", wifioff: "F05AA",
  };
  const ic = (k, cls = "") => `<i class="mdi ${cls}" aria-hidden="true">&#x${ICON[k] || ICON.info};</i>`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- даты ---------- */
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MON_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const WD = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  const WDS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const WD_PY = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]; // day в data.json: 0 = Пн
  const DAY = 864e5;
  let NOW = new Date();
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let TODAY = startOfDay(NOW);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const same = (a, b) => key(a) === key(b);
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
  const monday = d => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
  const pyDay = d => (d.getDay() + 6) % 7;
  const fmtLong = d => `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const fmtShort = d => `${WDS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const fmtDate = d => `${d.getDate()} ${MON_SHORT[d.getMonth()]}`;
  const dmy = d => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const toMin = t => { const [h, m] = (t || "").split(":").map(Number); return h * 60 + m; };
  const nowMin = () => NOW.getHours() * 60 + NOW.getMinutes();
  const plural = (n, f) => { n = Math.abs(n); return f[(n % 100 > 10 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][Math.min(n % 10, 5)]]; };
  const DAYS = ["день", "дня", "дней"];
  const whenText = n => n === 0 ? "сегодня" : n === 1 ? "завтра" : n === -1 ? "вчера" : n < 0 ? `${-n} ${plural(n, DAYS)} назад` : `через ${n} ${plural(n, DAYS)}`;

  /* ---------- цвета ---------- */
  const ACCENT_HEX = ["#22C79B", "#FF7A6B", "#9B8AFB", "#F5A524", "#38BDF8", "#F06C9B", "#5B8DEF", "#14B8A6"];
  function accentIndex(text) { let h = 0; [...(text || "?")].forEach((ch, i) => { h += (i + 1) * ch.codePointAt(0); }); return h % 8; }
  const accent = t => `var(--accent-${accentIndex(t)})`;
  const sgColor = n => `var(--sg-${((n - 1) % 6) + 1})`;
  const pctColor = p => (p >= 85 ? "var(--here)" : p >= 70 ? "var(--warn)" : "var(--absent)");
  const pctInk = p => (p >= 85 ? "var(--ok-ink)" : p >= 70 ? "var(--warn-ink)" : "var(--bad-ink)");
  const initials = n => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  function avatar(name, cls = "") {
    const i = accentIndex(name), hex = ACCENT_HEX[i];
    const [r, g, b] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255);
    const fg = 0.299 * r + 0.587 * g + 0.114 * b > 0.66 ? "#1A1A1A" : "#fff";
    return `<span class="avatar ${cls}" style="--c:var(--accent-${i});--fg:${fg}" aria-hidden="true">${esc(initials(name))}</span>`;
  }
  const shortName = n => { const p = (n || "").split(/\s+/); return p.length >= 2 ? `${p[0]} ${p[1][0]}.` : n; };
  const nameKey = n => (n || "").toLowerCase().replace(/ё/g, "е");
  const byName = (a, b) => nameKey(a.name).localeCompare(nameKey(b.name), "ru");
  const newId = () => [...crypto.getRandomValues(new Uint8Array(5))].map(b => b.toString(16).padStart(2, "0")).join("");

  /* ---------- хранилище браузера (только удобства: тема, локальная копия) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("starosta." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("starosta." + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  /* ================= ДАННЫЕ ================= */
  let DB = null;             // все данные группы (формат data.json)
  const DATA_KEY = "starosta.data";

  // недостающие поля — как Store._load в main.py
  function normalize(d) {
    d = d && typeof d === "object" ? d : {};
    d.version ??= 1;
    d.settings ??= {};
    d.settings.group ??= "";
    if (!Array.isArray(d.settings.bells) || !d.settings.bells.length) d.settings.bells = ["08:00-09:35", "09:45-11:20", "11:35-13:10", "13:40-15:15", "15:25-17:00"];
    if (!Array.isArray(d.settings.semesters)) d.settings.semesters = [];
    for (const k of ["students", "teachers", "lessons", "tasks", "events"]) if (!Array.isArray(d[k])) d[k] = [];
    if (!d.attendance || typeof d.attendance !== "object") d.attendance = {};
    // изменения на конкретные даты: "YYYY-MM-DD|id пары" → { cancel, moved_to, room, teacher, src: manual|nntu }
    if (!d.overrides || typeof d.overrides !== "object" || Array.isArray(d.overrides)) d.overrides = {};
    // разовые пары (перенесённые и добавленные): { id, date, subject, num, kind, room, teacher, from?, src }
    if (!Array.isArray(d.oneoff)) d.oneoff = [];
    const prev = DB; DB = d;
    const cur = semInfo(TODAY).num;
    DB = prev;
    d.lessons.forEach(l => { l.sem ??= cur; });
    return d;
  }

  function loadData() {
    try { const raw = localStorage.getItem(DATA_KEY); DB = raw ? normalize(JSON.parse(raw)) : null; }
    catch (e) { DB = null; }
    return !!DB;
  }

  // каждое изменение данных проходит через persist()
  function persist() {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(DB)); }
    catch (e) { toast("Не удалось сохранить: в браузере нет места или запрещено хранение. Скачайте копию данных в настройках.", "info"); return; }
    // просим браузер не удалять данные при нехватке места (молча, один раз)
    if (!persist.asked && navigator.storage && navigator.storage.persist) { persist.asked = true; navigator.storage.persist().catch(() => {}); }
  }
  function setDB(d) { DB = normalize(d); MK = null; persist(); }

  // давно не скачивали копию — напомнить (данные живут только в этом браузере)
  const BACKUP_DAYS = 14;
  function needBackup() {
    if (!DB || !Object.keys(DB.attendance).length) return false;
    const last = store.get("lastBackup", 0);
    return !last || Date.now() - last > BACKUP_DAYS * DAY;
  }

  /* ---------- звонки, семестры, недели (как Store в main.py) ---------- */
  const bells = () => DB.settings.bells.map(b => { const [a, z] = String(b).split("-"); return [a || "", z || ""]; });
  const lessonSpan = l => (l.start && l.end) ? [l.start, l.end] : (bells()[(l.num || 0) - 1] || ["", ""]);
  const academicYear = d => (d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1);
  function shiftYear(d, k) { const r = new Date(d.getFullYear() + k, d.getMonth(), d.getDate()); return r.getMonth() === d.getMonth() ? r : new Date(d.getFullYear() + k, d.getMonth(), 28); }
  const defaultSems = ay => [[new Date(ay, 8, 1), new Date(ay, 11, 31), true], [new Date(ay + 1, 1, 9), new Date(ay + 1, 5, 30), true]];
  function semesterDates(ay) {
    const dflt = defaultSems(academicYear(TODAY));
    const base = [0, 1].map(i => {
      const sm = DB.settings.semesters[i] || {}, a = parseISO(sm.start), z = parseISO(sm.end);
      return a && z ? [a, z, sm.first_week_odd !== false] : [dflt[i][0], dflt[i][1], sm.first_week_odd !== false];
    });
    if (ay == null) return base;
    const k = ay - academicYear(base[0][0]);
    return base.map(([a, z, o]) => [shiftYear(a, k), shiftYear(z, k), o]);
  }
  function semInfo(d) {
    const s = semesterDates(academicYear(d)), num = d < s[1][0] ? 1 : 2;
    const [start, end, firstOdd] = s[num - 1];
    const active = d >= start && d <= end;
    const week = Math.floor(daysBetween(monday(start), monday(d)) / 7) + 1;
    const odd = ((((week % 2) + 2) % 2) === 1) === firstOdd;
    let label;
    if (active) label = `${num} семестр · ${week}-я неделя · ${odd ? "нечётная" : "чётная"}`;
    else if (num === 1 && d > end) label = "Зимняя сессия и каникулы";
    else if (num === 1) label = `До начала 1 семестра — ${fmtDate(start)}`;
    else label = "Летняя сессия и каникулы";
    return { num, start, end, active, week, parity: odd ? "odd" : "even", label };
  }
  const byTime = (a, b) => (lessonSpan(a)[0] || "99").localeCompare(lessonSpan(b)[0] || "99") || (a.num || 0) - (b.num || 0) || !!a.cancelled - !!b.cancelled;
  // все пары дня с учётом изменений: постоянные (с отменами и заменами) + разовые
  // у отменённых cancelled: true; у постоянных с изменениями — ov (запись из overrides)
  function dayPlan(d) {
    const info = semInfo(d), k = key(d), out = [];
    if (info.active) DB.lessons.forEach(l => {
      if ((l.sem || 1) !== info.num || l.day !== pyDay(d) || !["all", info.parity].includes(l.week || "all")) return;
      const o = DB.overrides[`${k}|${l.id}`];
      if (!o) return out.push(l);
      out.push({ ...l, room: o.room ?? l.room, teacher: o.teacher ?? l.teacher, cancelled: !!o.cancel, ov: o, tpl: l });
    });
    DB.oneoff.forEach(x => { if (x.date === k) out.push({ ...x, one: true }); });
    return out.sort(byTime);
  }
  const lessonsOn = d => dayPlan(d).filter(l => !l.cancelled);
  const attKey = (d, id) => `${key(d)}|${id}`;
  function recordsOn(d) { const p = key(d) + "|"; return Object.entries(DB.attendance).filter(([k]) => k.startsWith(p)); }
  // пары дня для ленты: с отменёнными + отмеченные, которых в расписании уже нет
  function dayLessons(d) {
    const ls = dayPlan(d), seen = new Set(ls.map(l => attKey(d, l.id)));
    recordsOn(d).forEach(([k, r]) => { if (!seen.has(k)) ls.push({ id: k.split("|")[1], subject: r.subject || "—", num: r.num || 0, kind: r.kind || "", extra: true }); });
    return ls.sort(byTime);
  }
  const activeOnly = ls => ls.filter(l => !l.cancelled);
  const lessonById = id => DB.lessons.find(x => x.id === id) || DB.oneoff.find(x => x.id === id);
  // откуда перенесли: «со 2-й пары» (тот же день) или «с Пн 2 ноя (5-я пара)»
  function whereText(k, d) {
    const [ds, id] = k.split("|"), from = parseISO(ds), n = (lessonById(id) || {}).num;
    if (!from) return "";
    if (d && same(from, d)) return n ? `${n === 2 ? "со" : "с"} ${n}-й пары` : "с другого времени";
    return `с ${WDS[from.getDay()]} ${fmtDate(from)}${n ? ` (${n}-я пара)` : ""}`;
  }
  const subjects = () => [...new Set(DB.lessons.map(l => l.subject))].sort((a, b) => a.localeCompare(b, "ru"));

  /* ---------- подгруппы ---------- */
  const SUBGROUP_RE = /\s*\(\s*подгруппа\s*(\d+)\s*\)\s*/i;
  const baseSubject = n => (n || "—").replace(SUBGROUP_RE, " ").trim() || "—";
  const subgroupOf = n => { const m = SUBGROUP_RE.exec(n || ""); return m ? +m[1] : null; };
  function subgroupCounts() { const out = {}; DB.lessons.forEach(l => { const n = subgroupOf(l.subject); if (n) { const b = baseSubject(l.subject); out[b] = Math.max(out[b] || 0, n); } }); return out; }
  function mainCount(counts) {
    const vals = Object.values(counts); if (!vals.length) return 0;
    return [...new Set(vals)].sort((a, b) => (vals.filter(v => v === b).length - vals.filter(v => v === a).length) || b - a)[0];
  }
  function ownSplit() {
    const c = subgroupCounts(), main = mainCount(c), manual = new Set(DB.settings.own_split || []);
    return Object.keys(c).filter(b => c[b] !== main || manual.has(b)).sort((a, b) => nameKey(a).localeCompare(nameKey(b), "ru"));
  }
  function splitSize(base) {
    if (!base) return Math.max(mainCount(subgroupCounts()) || 2, ...DB.students.map(s => s.subgroup || 0));
    return Math.max(subgroupCounts()[base] || 2, ...DB.students.map(s => (s.subgroups || {})[base] || 0));
  }
  function studentSubgroup(st, base, own = ownSplit()) { return base && own.includes(base) ? ((st.subgroups || {})[base] || 0) : (st.subgroup || 0); }
  function setStudentSubgroup(st, n, base) {
    if (!base) { st.subgroup = n; return; }
    st.subgroups ??= {}; if (n) st.subgroups[base] = n; else delete st.subgroups[base];
  }
  const students = () => DB.students.slice().sort(byName);
  // кто должен быть на занятии → [студенты, номер подгруппы или 0 — вся группа]
  function roster(subject) {
    const all = students(), n = subgroupOf(subject);
    if (!n) return [all, 0];
    const base = baseSubject(subject), own = ownSplit(), nums = all.map(s => studentSubgroup(s, base, own));
    if (!nums.some(Boolean)) return [all, 0];
    return [all.filter((s, i) => nums[i] === n), n];
  }

  /* ---------- отметки и проценты ---------- */
  const MARK_NEXT = { undefined: "+", "+": "н", "н": "у", "у": "+" };
  function summarize(rec, list) {
    const m = (rec && rec.marks) || {}, t = { here: 0, absent: [], excused: [], total: list.length };
    list.forEach(s => { const v = m[s.id]; if (v === "+") t.here++; else if (v === "н") t.absent.push(s); else if (v === "у") t.excused.push(s); });
    t.abs = t.absent.length; t.exc = t.excused.length;
    return t;
  }
  function attendancePct(marks) { const counted = marks.length - marks.filter(m => m === "у").length; return counted ? Math.round(100 * marks.filter(m => m === "+").length / counted) : null; }
  function lessonState(l, d) {
    if (l.cancelled) return "cancelled";
    if (d < TODAY) return "past";
    if (d > TODAY) return "future";
    const [b, e] = lessonSpan(l);
    if (!b) return "past";
    if (nowMin() >= toMin(e)) return "past";
    if (nowMin() >= toMin(b)) return "live";
    return "future";
  }
  // записи посещаемости за период: "1" | "2" | "year" (текущий учебный год)
  function periodRecords(period, subject) {
    const ay = academicYear(TODAY);
    return Object.entries(DB.attendance).map(([k, r]) => ({ k, r, d: parseISO(k.split("|")[0]) })).filter(({ d, r }) => {
      if (!d || academicYear(d) !== ay) return false;
      if (period !== "year" && semInfo(d).num !== Number(period)) return false;
      return !subject || baseSubject(r.subject) === subject;
    });
  }
  function collectStats(recs, sid) {
    const all = [], bySubj = {}, byWeek = {}, per = {}, misses = [];
    recs.forEach(({ k, r, d }) => {
      const info = semInfo(d), wk = `${info.num}-${String(info.week).padStart(2, "0")}`;
      Object.entries(r.marks || {}).forEach(([id, m]) => {
        if (!m || (sid && id !== sid)) return;
        all.push(m); (bySubj[baseSubject(r.subject)] ||= []).push(m); (byWeek[wk] ||= []).push(m); (per[id] ||= []).push(m);
        if (sid && m !== "+") misses.push({ k, r, d, m });
      });
    });
    const cnt = v => all.filter(m => m === v).length;
    return { all, here: cnt("+"), abs: cnt("н"), exc: cnt("у"), pct: attendancePct(all), bySubj, byWeek, per, misses };
  }

  /* ---------- состояние экрана ---------- */
  const S = { schedDate: null, journalDate: null, statsPeriod: null, statsSubject: "", studentPeriod: null,
    groupTab: "students", sgTab: "", taskTab: "open", taskKind: "", showPast: false, sgPick: {}, from: "group" };

  /* ---------- общие куски разметки ---------- */
  function donut(parts, size, w, center, label, anim = true) {
    const r = (size - w) / 2, C = 2 * Math.PI * r, c = size / 2;
    const total = parts.reduce((a, p) => a + p.v, 0), live = parts.filter(p => p.v > 0);
    let off = 0;
    const arcs = total ? live.map(p => {
      const len = p.v / total * C, gap = live.length > 1 ? Math.min(2.5, len / 2) : 0;
      const s = `<circle class="${anim ? "seg-arc" : ""}" r="${r}" cx="${c}" cy="${c}" stroke="${p.c}" stroke-width="${w}" stroke-dasharray="${(len - gap).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
      off += len; return s;
    }).join("") : "";
    return `<div class="donut" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(label)}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle r="${r}" cx="${c}" cy="${c}" stroke="var(--track)" stroke-width="${w}"/>${arcs}</svg>
      <div class="donut__center">${center}</div></div>`;
  }
  const bar = (p, c, thin) => `<div class="bar${thin ? " bar--thin" : ""}" role="presentation"><i style="width:${Math.max(0, Math.min(100, p))}%;--c:${c}"></i></div>`;
  const sgChip = n => `<span class="chip" style="--c:${sgColor(n)}">${n}-я подгруппа</span>`;
  // «Пары сегодня. 2 пары, 09:45–15:15» — первое предложение чёрное, остальное серое
  const sectionHead = (icon, title, extra = "", count) => {
    const i = title.indexOf(". "), head = i > 0 ? `${esc(title.slice(0, i + 1))} <span class="sub">${esc(title.slice(i + 2))}</span>` : esc(title);
    return `<div class="section-head">${icon ? ic(icon) : ""}<h2>${head}${count != null ? `<span class="count num">${count}</span>` : ""}</h2>${extra}</div>`;
  };
  const empty = (icon, title, text, action = "") =>
    `<div class="card empty">${ic(icon)}${title ? `<b>${esc(title)}</b>` : ""}<p>${text}</p>${action}</div>`;
  const weekTag = w => w === "even" ? "чётная неделя" : w === "odd" ? "нечётная неделя" : "";

  // пометка об изменении на эту дату: отменена, перенесена, разовая, другая аудитория
  function changeNote(l, d) {
    const src = (l.ov && l.ov.src === "nntu") || (l.one && l.src === "nntu") ? " · по сайту НГТУ" : "";
    if (l.cancelled) {
      const to = l.ov.moved_to && DB.oneoff.find(x => x.id === l.ov.moved_to), td = to && parseISO(to.date);
      return `<div class="lesson__change lesson__change--off">${ic("close")}${to ? `Перенесена на ${same(td, d) ? "" : `${WDS[td.getDay()]} ${fmtDate(td)}, `}${to.num} пару` : "Отменена"}${src}</div>`;
    }
    if (l.one) return `<div class="lesson__change">${ic("calendar")}${l.from ? `Перенос ${esc(whereText(l.from, d))}` : "Разовая пара"}${src}</div>`;
    if (l.ov && (l.ov.room != null || l.ov.teacher != null)) return `<div class="lesson__change">${ic("info")}Замена на этот день: ${[l.ov.room != null && "аудитория", l.ov.teacher != null && "преподаватель"].filter(Boolean).join(" и ")}${src}</div>`;
    return "";
  }
  function lessonCard(l, d, mode, extra = "") {
    const st = lessonState(l, d), [b, e] = lessonSpan(l), sg = subgroupOf(l.subject), title = baseSubject(l.subject);
    const tag = [l.kind, l.one ? "" : weekTag(l.week), l.start ? "своё время" : ""].filter(Boolean).join(" · ");
    const meta = `<div class="meta">${l.room ? `<span>${ic("door")}${esc(l.room)}</span>` : ""}${l.teacher ? `<span>${ic("teacher")}${esc(l.teacher)}</span>` : ""}${sg ? sgChip(sg) : ""}</div>`;
    let status = changeNote(l, d);
    if (mode !== "schedule" && st !== "cancelled") {
      const [list] = roster(l.subject), rec = DB.attendance[attKey(d, l.id)], t = summarize(rec, list);
      if (st === "live") {
        const left = toMin(e) - nowMin(), done = (nowMin() - toMin(b)) / (toMin(e) - toMin(b)) * 100;
        status += `<div class="lesson__status lesson__status--live">${ic("clock")}<b>Идёт сейчас</b> · осталось ${left} мин</div>${bar(done, "var(--primary)", true)}`;
      }
      if (rec) {
        const names = t.absent.map(s => shortName(s.name));
        const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
        status += `<div class="lesson__status lesson__status--ok">${ic("journal")}<b class="num">${t.here} из ${t.total}</b> на паре${names.length ? ` · <span class="lesson__absent">нет: ${esc(shown)}</span>` : ""}${t.exc ? ` · <span style="color:var(--excused-ink)">уваж.: ${t.exc}</span>` : ""}</div>`;
      } else if (st !== "future") {
        status += `<div class="lesson__status lesson__status--todo">${ic("journal")}Не отмечено — нажмите, чтобы отметить</div>`;
      } else if (mode === "journal" && b) {
        status += `<div class="lesson__status lesson__status--ok">${ic("clock")}Начнётся в ${b}</div>`;
      }
    }
    const cls = `card card--tap card--accent lesson${st === "past" && mode !== "schedule" ? " lesson--past" : ""}${st === "live" && mode !== "schedule" ? " lesson--live" : ""}${st === "cancelled" ? " lesson--cancelled" : ""}`;
    // в расписании и у отменённых — меню действий; в журнале и на главной — сразу к отметке
    const menu = mode === "schedule" || st === "cancelled" || l.extra;
    const go = menu && !l.extra ? `data-act="lessonMenu" data-id="${esc(l.id)}" data-d="${key(d)}"` : `data-go="#mark/${esc(l.id)}/${key(d)}"`;
    return `<div class="${cls}" style="--accent:${accent(title)}" ${go} role="${menu && !l.extra ? "button" : "link"}" tabindex="0" aria-label="${esc(l.subject)}${b ? `, ${b}–${e}` : ""}${st === "cancelled" ? ", отменена" : ""}">
      ${tag ? `<div class="lesson__tag">${esc(tag)}</div>` : ""}
      <h3 class="lesson__title">${esc(title)}</h3>${meta}${status}${extra}</div>`;
  }

  function timeline(list, d, mode) {
    const slots = [];
    list.forEach(l => { const [b] = lessonSpan(l), k = (b || "") + "|" + l.num; const s = slots.find(x => x.k === k); s ? s.items.push(l) : slots.push({ k, l, items: [l] }); });
    return `<div class="timeline">${slots.map(s => {
      const [b, e] = lessonSpan(s.l);
      let cards;
      const sameBase = s.items.every(x => baseSubject(x.subject) === baseSubject(s.l.subject) && subgroupOf(x.subject));
      if (mode === "schedule" && s.items.length > 1 && sameBase) {
        // подгруппы одного предмета в одно время — одна карточка с переключателем
        const pk = key(d) + s.k, pick = Math.min(S.sgPick[pk] ?? 0, s.items.length - 1);
        cards = lessonCard(s.items[pick], d, mode, `<div class="sg-switch" role="group" aria-label="Подгруппа">${s.items.map((x, i) =>
          `<button type="button" style="--c:${sgColor(subgroupOf(x.subject))}" aria-pressed="${i === pick}" data-act="sgPick" data-k="${esc(pk)}" data-i="${i}">п/г ${subgroupOf(x.subject)}</button>`).join("")}</div>`);
      } else cards = s.items.map(l => lessonCard(l, d, mode)).join("");
      return `<div class="tl-row"><div class="tl-time"><b>${b || (s.l.num ? s.l.num + " пара" : "—")}</b><span>${e}</span></div><div class="tl-cards">${cards}</div></div>`;
    }).join("")}</div>`;
  }

  /* ---------- дела и события ---------- */
  const TASK_KINDS = { "Дедлайн": { i: "alarm", c: "#EF4444" }, "Объявление": { i: "bullhorn", c: "#0EA5E9" }, "Напоминание": { i: "info", c: "#8B5CF6" } };
  const EVENT_KINDS = { "Учёба": { i: "school", c: "#6366F1" }, "Собрание": { i: "group", c: "#0EA5E9" }, "Культура": { i: "star", c: "#EC4899" }, "Спорт": { i: "flag", c: "#10B981" }, "Праздник": { i: "party", c: "#F59E0B" }, "Другое": { i: "event", c: "#8B5CF6" } };
  const taskKind = t => TASK_KINDS[t.kind] || TASK_KINDS["Напоминание"];
  const eventKind = e => EVENT_KINDS[e.kind] || EVENT_KINDS["Другое"];
  const taskBadge = t => `<span class="badge" style="--c:${taskKind(t).c}">${ic(taskKind(t).i)}</span>`;
  function dueHtml(t) {
    const due = parseISO(t.due); if (!due) return `<div class="due due--ok">без срока</div>`;
    const n = daysBetween(TODAY, due), base = `до ${fmtDate(due)}`;
    if (t.done) return `<div class="due due--ok">${base}</div>`;
    if (n < 0) return `<div class="due due--late">${base} · просрочено на ${-n} ${plural(n, DAYS)}</div>`;
    if (n === 0) return `<div class="due due--late">${base} · сегодня</div>`;
    return `<div class="due ${n <= 3 ? "due--soon" : "due--ok"}">${base} · ${whenText(n)}</div>`;
  }
  function parseBday(s) {
    const m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/.exec((s || "").trim()); if (!m) return null;
    const d = +m[1], mo = +m[2], t = new Date(2000, mo - 1, d);
    return t.getMonth() === mo - 1 && t.getDate() === d ? [d, mo] : null;
  }
  function nextBday([d, m]) { for (const y of [TODAY.getFullYear(), TODAY.getFullYear() + 1]) { const x = new Date(y, m - 1, d); if (x.getMonth() !== m - 1) continue; if (x >= TODAY) return x; } return null; }
  const eventDate = e => parseISO(e.date);
  const tgLabel = v => v ? (v.startsWith("+") ? v : "@" + v) : "";
  function normTelegram(s) {
    s = (s || "").trim(); if (!s) return ["", null];
    s = s.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, "").replace(/^\/+|\/+$/g, "").replace(/^@/, "");
    if (/^\+?\d[\d\s()-]{6,}$/.test(s)) return ["+" + s.replace(/\D/g, ""), null];
    if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(s)) return [s, null];
    return [null, "Telegram — ник вида @username, ссылка t.me/… или номер телефона"];
  }
  function teacherSubjects(t) {
    const out = (t.subjects || "").split(",").map(x => x.trim()).filter(Boolean), keys = new Set(out.map(nameKey));
    DB.lessons.forEach(l => { const b = baseSubject(l.subject); if (nameKey(l.teacher) === nameKey(t.name) && !keys.has(nameKey(b))) { out.push(b); keys.add(nameKey(b)); } });
    return out;
  }
  function ensureTeacher(name) {
    name = (name || "").split(/\s+/).filter(Boolean).join(" "); if (!name) return;
    if (!DB.teachers.some(t => nameKey(t.name) === nameKey(name))) DB.teachers.push({ id: newId(), name, subjects: "", email: "", telegram: "", phone: "", note: "" });
  }

  /* ---------- расписание с сайта НГТУ ---------- */
  // сайт отдаёт текущую и следующую неделю; пара в обеих — «каждую неделю», в одной — по её чётности
  function nntuLessons(res) {
    const map = new Map();
    res.weeks.forEach(w => {
      const info = semInfo(addDays(w.monday, 2));
      w.lessons.forEach(x => {
        const k = `${x.day}|${x.num}|${nameKey(x.subject)}`;
        const e = map.get(k) || { l: x, par: new Set(), sem: info.num };
        e.par.add(info.parity); map.set(k, e);
      });
    });
    const both = res.weeks.length > 1;
    return [...map.values()].map(({ l, par, sem }) => ({ subject: l.subject, day: l.day, num: l.num, week: both && par.size === 1 ? [...par][0] : "all",
      kind: l.kind, room: l.room, teacher: l.teacher, sem, ...(l.start ? { start: l.start, end: l.end } : {}) }));
  }
  const NNTU_FIELDS = ["week", "kind", "room", "teacher", "start", "end"];
  // что изменится: совпавшие пары сохраняют id — к нему привязаны отметки в журнале
  function nntuPlan(res) {
    const fresh = nntuLessons(res), sems = [...new Set(fresh.map(l => l.sem))];
    const old = DB.lessons.filter(l => sems.includes(l.sem || 1));
    const k = l => `${l.sem || 1}|${l.day}|${l.num}|${nameKey(l.subject)}`;
    const used = new Set(), pair = new Map();
    for (const exact of [true, false]) fresh.forEach((n, i) => {
      if (pair.has(i)) return;
      const o = old.find(o => !used.has(o) && k(o) === k(n) && (!exact || (o.week || "all") === n.week));
      if (o) { used.add(o); pair.set(i, o); }
    });
    const plan = { group: res.group, sems, add: [], upd: [], del: old.filter(o => !used.has(o)), same: 0, bells: null };
    fresh.forEach((n, i) => {
      const o = pair.get(i);
      if (!o) return plan.add.push(n);
      // своё время пары, заданное вручную, не трогаем, если сайт время не указал
      const ch = NNTU_FIELDS.filter(f => (f === "start" || f === "end") ? n.start && (o[f] || "") !== n[f] : ((o[f] || (f === "week" ? "all" : "")) !== n[f]));
      ch.length ? plan.upd.push({ o, n, ch }) : plan.same++;
    });
    if (res.bells.length && res.bells.join() !== DB.settings.bells.join()) plan.bells = res.bells;
    plan.empty = !plan.add.length && !plan.upd.length && !plan.del.length && !plan.bells;
    return plan;
  }
  function nntuApply(plan) {
    plan.upd.forEach(({ o, n, ch }) => ch.forEach(f => { o[f] = n[f]; }));
    const gone = new Set(plan.del.map(l => l.id));
    DB.lessons = DB.lessons.filter(l => !gone.has(l.id));
    plan.add.forEach(n => DB.lessons.push({ id: newId(), ...n }));
    if (plan.bells) DB.settings.bells = plan.bells;
    DB.settings.nntu_group = plan.group;
    if (!DB.settings.group) DB.settings.group = plan.group;
    if (DB.settings.teachers_from_lessons !== false) [...plan.add, ...plan.upd.map(x => x.n)].forEach(l => ensureTeacher(l.teacher));
    DB.settings.nntu_synced = key(TODAY);
    persist();
  }
  const lessonLine = l => `${WDS[(l.day + 1) % 7]}, ${l.num} пара · ${baseSubject(l.subject)}${subgroupOf(l.subject) ? ` (п/г ${subgroupOf(l.subject)})` : ""}`;
  const NNTU_ERR = {
    net: "Не удалось связаться с сайтом НГТУ. Проверьте интернет и попробуйте ещё раз.",
    empty: g => `Для группы «${g}» расписание не найдено. Проверьте номер — например, 26-ИВТ-2-1.`,
  };
  let PLAN = null;
  // загрузить расписание группы; onDone(res) — после успешной загрузки
  async function loadNntu(form, group, onDone) {
    const err = form.querySelector(".form-err"), btn = form.querySelector("button:not([type=button])");
    const say = msg => { if (err) { err.textContent = msg; err.hidden = !msg; } };
    group = NNTU.normGroup(group);
    if (!group) return say("Укажите номер группы");
    say(""); const label = btn && btn.innerHTML; if (btn) { btn.disabled = true; btn.textContent = "Загружаем…"; }
    let res = null;
    try { res = await NNTU.schedule(group, TODAY); }
    catch (e) { say(NNTU_ERR.net); }
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
    if (!res) return;
    if (!res.weeks.some(w => w.lessons.length)) return say(NNTU_ERR.empty(group));
    onDone(res);
  }
  /* ---------- автопроверка: ближайшие дни на сайте НГТУ против приложения ---------- */
  let LIVE = null; // { changes, plan, sig }
  // по каждому дню (с сегодняшнего) сравниваем пары сайта с парами приложения
  function liveChanges(res) {
    const out = [];
    res.weeks.forEach(w => {
      for (let i = 0; i < 7; i++) {
        const d = addDays(w.monday, i); if (d < TODAY) continue;
        const plan = dayPlan(d);
        // предметы, которые староста менял вручную в этот день, не трогаем
        const manual = new Set(plan.filter(l => (l.ov && l.ov.src === "manual") || (l.one && l.src !== "nntu")).map(l => nameKey(l.subject)));
        const app = plan.filter(l => !l.cancelled && !manual.has(nameKey(l.subject)));
        const api = w.lessons.filter(x => x.day === i && !manual.has(nameKey(x.subject)));
        const used = new Set(), rest = [];
        const take = pred => { const j = app.findIndex((l, n) => !used.has(n) && pred(l)); if (j < 0) return null; used.add(j); return app[j]; };
        api.forEach(x => {
          const m = take(l => l.num === x.num && nameKey(l.subject) === nameKey(x.subject));
          if (!m) return rest.push(x);
          const diff = {};
          if (x.room && x.room !== (m.room || "")) diff.room = x.room;
          if (x.teacher && x.teacher !== (m.teacher || "")) diff.teacher = x.teacher;
          if (Object.keys(diff).length) out.push({ type: "edit", d, l: m, x, diff });
        });
        rest.forEach(x => {
          const m = take(l => nameKey(l.subject) === nameKey(x.subject));
          if (m) return out.push({ type: "move", d, l: m, x });
          const c = plan.find(l => l.cancelled && l.ov && l.ov.src === "nntu" && !l.ov.moved_to && l.num === x.num && nameKey(l.subject) === nameKey(x.subject));
          out.push(c ? { type: "restore", d, l: c, x } : { type: "add", d, x });
        });
        app.forEach((l, n) => { if (!used.has(n)) out.push({ type: "cancel", d, l }); });
      }
    });
    return out;
  }
  const liveSig = cs => cs.map(c => [c.type, key(c.d), (c.l || c.x).subject, (c.l || c.x).num, c.x ? c.x.num : ""].join(":")).join(";");
  function liveApply(changes) {
    changes.forEach(c => {
      const k = attKey(c.d, c.l ? c.l.id : ""), o = c.l && c.l.one && DB.oneoff.find(x => x.id === c.l.id);
      if (c.type === "edit") { if (o) Object.assign(o, c.diff); else DB.overrides[k] = { ...(DB.overrides[k] || {}), ...c.diff, src: "nntu" }; }
      else if (c.type === "cancel") { if (o) DB.oneoff = DB.oneoff.filter(x => x !== o); else DB.overrides[k] = { cancel: true, src: "nntu" }; }
      else if (c.type === "restore") delete DB.overrides[k];
      else if (c.type === "move") {
        if (o) Object.assign(o, { num: c.x.num, room: c.x.room || o.room, teacher: c.x.teacher || o.teacher, src: "nntu" });
        else {
          const oid = "o" + newId();
          DB.oneoff.push({ id: oid, date: key(c.d), subject: c.l.subject, num: c.x.num, kind: c.x.kind || c.l.kind, room: c.x.room || c.l.room, teacher: c.x.teacher || c.l.teacher, from: k, src: "nntu" });
          DB.overrides[k] = { cancel: true, moved_to: oid, src: "nntu" };
        }
      } else if (c.type === "add") DB.oneoff.push({ id: "o" + newId(), date: key(c.d), subject: c.x.subject, num: c.x.num, kind: c.x.kind, room: c.x.room, teacher: c.x.teacher, src: "nntu" });
    });
    persist();
  }
  // раз в день при открытии (или по кнопке): тихо, без ошибок на экране
  async function autoCheck(force) {
    if (!DB || !DB.settings.nntu_group || (!force && DB.settings.nntu_checked === key(TODAY))) return false;
    if (!force && navigator.onLine === false) return false;
    let res;
    try { res = await NNTU.schedule(DB.settings.nntu_group, TODAY); } catch (e) { if (force) toast(NNTU_ERR.net, "info"); return false; }
    if (!DB || !res.weeks.some(w => w.lessons.length)) return false;
    const changes = liveChanges(res);
    LIVE = { changes, plan: nntuPlan(res), sig: liveSig(changes) };
    DB.settings.nntu_checked = key(TODAY); persist();
    if (sheet.hidden) render(true);
    return true;
  }
  const liveNews = () => LIVE && LIVE.changes.length && LIVE.sig !== DB.settings.nntu_seen;

  function fillGroups() {
    NNTU.groups().then(list => {
      const dl = $("#nntuGroups"); if (dl && !dl.options.length) dl.innerHTML = list.map(g => `<option value="${esc(g)}">`).join("");
    }).catch(() => { /* без подсказок тоже можно */ });
  }

  /* ================= ЭКРАНЫ ================= */
  const SCREENS = {};
  const groupName = () => DB.settings.group || "Группа";

  /* ----- Сегодня ----- */
  SCREENS.home = () => {
    const info = semInfo(TODAY), today = dayLessons(TODAY);
    const live = today.find(l => lessonState(l, TODAY) === "live");
    const next = today.find(l => lessonState(l, TODAY) === "future" && lessonSpan(l)[0]);
    const open = DB.tasks.filter(t => !t.done);
    const late = open.filter(t => { const d = parseISO(t.due); return d && d < TODAY; }).length;
    const soon = DB.events.filter(e => { const d = eventDate(e); return d && d >= TODAY && d < addDays(TODAY, 14); }).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    const tomorrow = lessonsOn(addDays(TODAY, 1));
    const bdays = students().map(s => { const p = parseBday(s.birthday); const d = p && nextBday(p); return d && { s, d, n: daysBetween(TODAY, d) }; }).filter(x => x && x.n <= 30).sort((a, b) => a.n - b.n);

    let nowCard = "";
    const focus = live || next;
    if (focus) {
      const [b, e] = lessonSpan(focus), [list] = roster(focus.subject), rec = DB.attendance[attKey(TODAY, focus.id)], t = summarize(rec, list);
      const isLive = focus === live, left = isLive ? toMin(e) - nowMin() : toMin(b) - nowMin();
      const done = isLive ? (nowMin() - toMin(b)) / (toMin(e) - toMin(b)) : 0, R = 32, C = 2 * Math.PI * R, sg = subgroupOf(focus.subject);
      const leftTxt = left >= 120 ? `${Math.floor(left / 60)}<small>ч</small>` : `${left}<small>мин</small>`;
      nowCard = `<section class="card now${isLive ? "" : " now--next"}" aria-label="${isLive ? "Идёт сейчас" : "Следующая пара"}">
        <div class="now__top"><div class="now__info">
          <div class="now__label">${isLive ? `<span class="pulse"></span>Идёт сейчас · ${b}–${e}` : `${ic("clock")}Следующая · ${b}–${e}`}</div>
          <h2 class="now__title">${esc(baseSubject(focus.subject))}</h2>
          <div class="meta now__meta">${focus.room ? `<span>${ic("door")}${esc(focus.room)}</span>` : ""}${focus.teacher ? `<span>${ic("teacher")}${esc(focus.teacher)}</span>` : ""}${sg ? sgChip(sg) : ""}</div></div>
          <div class="now__ring" role="img" aria-label="${isLive ? `Осталось ${left} минут` : `До начала ${left} минут`}">
            <svg width="74" height="74" viewBox="0 0 74 74"><circle cx="37" cy="37" r="${R}" fill="none" stroke="var(--track)" stroke-width="6"/>
            <circle cx="37" cy="37" r="${R}" fill="none" stroke="var(--primary)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(done * C).toFixed(1)} ${C.toFixed(1)}"/></svg>
            <b class="num">${leftTxt}</b></div></div>
        <div class="now__bottom">${rec
          ? `<a class="btn btn--soft btn--lg" href="#mark/${esc(focus.id)}/${key(TODAY)}">${ic("journal")}<span class="num">Отмечено: ${t.here} из ${t.total}</span></a>`
          : `<a class="btn btn--primary btn--lg" href="#mark/${esc(focus.id)}/${key(TODAY)}">${ic("journal")}Отметить посещаемость</a>`}</div></section>`;
    }

    const side = `
      <section class="card"><div class="card__head">${ic("alarm")}<h3>Сроки</h3><a class="link" href="#tasks">Все дела</a></div>
        ${open.length ? `<div class="mini">${open.slice().sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).slice(0, 3).map(t => `<a class="mini__row" href="#tasks">${taskBadge(t)}<div class="mini__body"><div class="mini__title">${esc(t.title)}</div>${dueHtml(t)}</div></a>`).join("")}</div>`
          : `<p class="muted" style="font-size:14px">Активных дел нет. <button class="link" data-act="form" data-f="task">Добавить</button></p>`}</section>
      <section class="card"><div class="card__head">${ic("party")}<h3>Ближайшие события</h3><a class="link" href="#events">Все</a></div>
        ${soon.length ? `<div class="mini">${soon.slice(0, 3).map(e => `<a class="mini__row" href="#events"><span class="badge" style="--c:${eventKind(e).c}">${ic(eventKind(e).i)}</span><div class="mini__body"><div class="mini__title">${esc(e.title)}</div><div class="mini__sub">${fmtShort(eventDate(e))}${e.time ? " · " + esc(e.time) : ""}</div></div></a>`).join("")}</div>`
          : `<p class="muted" style="font-size:14px">В ближайшие две недели событий нет.</p>`}</section>
      ${bdays.length ? `<section class="card"><div class="card__head">${ic("cake")}<h3>Дни рождения</h3></div>
        <div class="mini">${bdays.map(x => `<a class="mini__row" href="#student/${esc(x.s.id)}">${avatar(x.s.name)}<div class="mini__body"><div class="mini__title">${esc(x.s.name)}</div><div class="mini__sub">${fmtDate(x.d)} · ${whenText(x.n)}</div></div></a>`).join("")}</div></section>` : ""}`;

    const notices = [
      liveNews() && `<div class="card tip tip--live">${ic("calendar")}<div class="tip__body"><b>Изменения в расписании</b><span>На сайте НГТУ: ${LIVE.changes.length} ${plural(LIVE.changes.length, ["изменение", "изменения", "изменений"])} на ближайшие дни</span></div><button class="btn btn--primary btn--sm" data-act="form" data-f="live">Посмотреть</button></div>`,
      !DB.lessons.length && `<div class="card tip">${ic("schedule")}<div class="tip__body"><b>Расписания пока нет</b><span>Загрузите его с сайта НГТУ — это займёт пару секунд.</span></div><button class="btn btn--primary btn--sm" data-act="form" data-f="nntu">Загрузить</button></div>`,
      !DB.students.length && `<div class="card tip">${ic("add_many")}<div class="tip__body"><b>Добавьте студентов</b><span>Без списка группы не получится отмечать посещаемость.</span></div><a class="btn btn--soft btn--sm" href="#group">К группе</a></div>`,
      needBackup() && `<div class="card tip">${ic("download")}<div class="tip__body"><b>Сохраните копию данных</b><span>Отметки хранятся только в этом браузере. Скачайте файл на случай, если браузер очистят.</span></div><button class="btn btn--soft btn--sm" data-act="exportJson">Скачать</button></div>`,
    ].filter(Boolean).join("");

    return {
      home: true, nav: "home", fab: "quick",
      html: `
        <div class="home-top"><section class="hero"><h1>Сегодня.<span> Что по плану?</span></h1>
          <p><b>${fmtLong(TODAY)}</b> · ${esc(info.label)}</p></section>${nowCard}</div>
        ${notices ? `<div class="stack">${notices}</div>` : ""}
        <div class="tiles">
          <a class="card card--tap tile" href="#schedule">${ic("schedule")}<b class="num">${activeOnly(today).length}</b><span>${plural(activeOnly(today).length, ["пара", "пары", "пар"])} сегодня</span></a>
          <a class="card card--tap tile${late ? " tile--alert" : ""}" href="#tasks">${ic(late ? "alarm" : "tasks")}<b class="num">${open.length}</b><span>${late ? `${late} просрочено` : plural(open.length, ["дело", "дела", "дел"])}</span></a>
          <a class="card card--tap tile" href="#events">${ic("party")}<b class="num">${soon.length}</b><span>${plural(soon.length, ["событие", "события", "событий"])}</span></a>
        </div>
        <div class="split">
          <div class="stack">
            ${sectionHead("schedule", (() => { const a = activeOnly(today), s = a.length && lessonSpan(a[0])[0], e = a.length && lessonSpan(a[a.length - 1])[1];
              return a.length ? `Пары сегодня. ${a.length} ${plural(a.length, ["пара", "пары", "пар"])}${s && e ? `, ${s}–${e}` : ""}` : "Пары сегодня"; })(), `<a class="link" href="#schedule">Расписание</a>`)}
            ${today.length ? timeline(today, TODAY, "home") : empty("coffee", info.active ? "Сегодня пар нет" : info.label, "Можно выдохнуть. Расписание на неделю — во вкладке «Пары».")}
            ${tomorrow.length ? `<a class="tomorrow" href="#schedule" data-act="schedTomorrow">${ic("right")}Завтра ${tomorrow.length} ${plural(tomorrow.length, ["пара", "пары", "пар"])}, начало в ${lessonSpan(tomorrow[0])[0]} — ${esc(baseSubject(tomorrow[0].subject))}</a>` : ""}
          </div>
          <aside class="split__side" aria-label="Сводка">${side}</aside>
        </div>`,
    };
  };

  /* ----- Пары ----- */
  SCREENS.schedule = () => {
    const d = S.schedDate ||= TODAY, info = semInfo(d), mon = monday(d);
    const days = [0, 1, 2, 3, 4, 5].map(i => addDays(mon, i)), list = dayPlan(d);
    const slotsOf = x => new Set(lessonsOn(x).map(l => lessonSpan(l)[0] + l.num)).size;
    const strip = `<div class="days" role="tablist" aria-label="Дни недели">
      <button class="icon-btn" data-act="schedWeek" data-n="-7" aria-label="Предыдущая неделя">${ic("left")}</button>
      ${days.map(x => { const n = slotsOf(x); return `<button class="day${same(x, TODAY) ? " day--today" : ""}" role="tab" aria-selected="${same(x, d)}" data-act="schedDay" data-d="${key(x)}" aria-label="${fmtLong(x)}, ${n} ${plural(n, ["пара", "пары", "пар"])}">
          <span>${WDS[x.getDay()]}</span><b>${x.getDate()}</b><span class="day__dots">${"<i></i>".repeat(Math.min(n, 5))}</span></button>`; }).join("")}
      <button class="icon-btn" data-act="schedWeek" data-n="7" aria-label="Следующая неделя">${ic("right")}</button></div>`;
    const b = bells();
    const bellsCard = `<section class="card"><div class="card__head">${ic("clock")}<h3>Звонки</h3></div>
      <div class="mini">${b.map((x, i) => `<div class="mini__row"><b class="num" style="width:22px;color:var(--primary-ink)">${i + 1}</b><div class="mini__body num">${x[0]} – ${x[1]}</div></div>`).join("")}</div>
      <button class="link" style="margin-top:8px" data-act="form" data-f="bells">Изменить звонки</button></section>`;
    const weekCard = `<section class="card"><div class="card__head">${ic("calendar")}<h3>Неделя</h3></div><div class="mini">${days.map(x => {
      const ls = lessonsOn(x);
      return `<button class="mini__row" style="width:100%;text-align:left${same(x, d) ? ";background:var(--field)" : ""}" data-act="schedDay" data-d="${key(x)}"><div class="mini__body"><div class="mini__title">${fmtShort(x)}</div><div class="mini__sub">${ls.length ? `${lessonSpan(ls[0])[0]}–${lessonSpan(ls[ls.length - 1])[1]}` : "нет пар"}</div></div><b class="num">${slotsOf(x) || "—"}</b></button>`;
    }).join("")}</div></section>`;
    const semCount = n => DB.lessons.filter(l => (l.sem || 1) === n).length;
    return {
      title: "Расписание", sub: info.label, nav: "schedule", fab: "schedAdd",
      actions: [["download", "Обновить с сайта НГТУ", "form", "nntu"], ["calendar", "Выбрать дату", "pickDate"]],
      html: `
        <div class="seg seg--fit" role="tablist" aria-label="Семестр">${[1, 2].map(n => `<button role="tab" aria-selected="${info.num === n}" data-act="schedSem" data-n="${n}">${n} семестр</button>`).join("")}</div>
        ${strip}
        <div class="bells only-narrow">${ic("clock")}Звонки: ${b.length} ${plural(b.length, ["пара", "пары", "пар"])}, ${b[0][0]}–${b[b.length - 1][1]}</div>
        <div class="split">
          <div class="stack">
            ${sectionHead("", fmtLong(d), same(d, TODAY) ? `<span class="chip" style="--c:var(--primary)">сегодня</span>` : `<button class="link" data-act="schedToday">К сегодня</button>`)}
            ${!info.active ? empty("coffee", info.label, "Занятий по расписанию в эти дни нет.", `<button class="btn btn--soft" data-act="form" data-f="semesters">${ic("calendar")}Даты семестров</button>`)
              : list.length ? timeline(list, d, "schedule")
              : semCount(info.num) ? empty("coffee", "Пар нет", d.getDay() === 0 ? "Воскресенье — выходной." : "В этот день занятий нет. Нажмите «+», чтобы добавить пару.")
              : empty("schedule", `В ${info.num} семестре пока нет пар`, "Загрузите расписание с сайта НГТУ или добавьте пары кнопкой «+».", `<button class="btn btn--primary" data-act="form" data-f="nntu">${ic("download")}Загрузить с сайта НГТУ</button>`)}
          </div>
          <aside class="split__side only-wide">${bellsCard}${weekCard}</aside>
        </div>`,
    };
  };

  /* ----- Журнал ----- */
  SCREENS.journal = () => {
    const d = S.journalDate ||= TODAY, list = dayLessons(d), isToday = same(d, TODAY), info = semInfo(d);
    const live = activeOnly(list), marked = live.filter(l => DB.attendance[attKey(d, l.id)]).length, mon = monday(d), diff = daysBetween(TODAY, d);
    const weekCard = `<section class="card"><div class="card__head">${ic("journal")}<h3>Неделя в журнале</h3></div><div class="mini">${[0, 1, 2, 3, 4, 5].map(i => {
      const x = addDays(mon, i), ls = activeOnly(dayLessons(x)), mk = ls.filter(l => DB.attendance[attKey(x, l.id)]).length, started = ls.filter(l => lessonState(l, x) !== "future").length;
      const pill = !ls.length ? `<span class="muted">—</span>` : mk >= started && started ? `<span class="pill pill--ok num">${mk}/${ls.length}</span>` : started ? `<span class="pill pill--warn num">${mk}/${ls.length}</span>` : `<span class="muted num">${mk}/${ls.length}</span>`;
      return `<button class="mini__row" style="width:100%;text-align:left${same(x, d) ? ";background:var(--field)" : ""}" data-act="journalDay" data-d="${key(x)}"><div class="mini__body"><div class="mini__title">${fmtShort(x)}${same(x, TODAY) ? " · сегодня" : ""}</div></div>${pill}</button>`;
    }).join("")}</div></section>`;
    return {
      title: "Журнал", sub: `${info.active ? info.week + "-я неделя · " : ""}отмечено ${marked} из ${live.length}`, nav: "journal",
      actions: [["calendar", "Выбрать дату", "pickDate"], ["chart", "Итоги", "go", "#stats"]],
      html: `
        <div class="card datebar">
          <button class="icon-btn" data-act="journalShift" data-n="-1" aria-label="Предыдущий день">${ic("left")}</button>
          <div class="datebar__label"><b>${fmtLong(d)}</b><span>${whenText(diff)}</span></div>
          <button class="icon-btn" data-act="journalShift" data-n="1" aria-label="Следующий день">${ic("right")}</button>
        </div>
        ${isToday ? "" : `<button class="btn btn--soft btn--block" data-act="journalToday">${ic("calendar")}Вернуться к сегодня</button>`}
        <div class="split">
          <div class="stack">
            ${!DB.students.length ? empty("group", "", "В группе нет студентов. Добавьте их во вкладке «Группа».") : ""}
            ${list.length ? timeline(list, d, "journal") : empty("coffee", info.active ? "В этот день пар нет по расписанию" : info.label, "Выберите другой день стрелками или добавьте пару не по расписанию.")}
            <button class="btn btn--neutral btn--block" data-act="form" data-f="extra">${ic("plus")}Пара не по расписанию</button>
          </div>
          <aside class="split__side only-wide">${weekCard}</aside>
        </div>`,
    };
  };

  /* ----- Отметка ----- */
  let MK = null; // { k, l, d, list, sg, rec, saved }
  function findLesson(id, d) {
    const occ = dayPlan(d).find(x => x.id === id); if (occ) return occ;
    const l = lessonById(id); if (l) return l;
    const r = DB.attendance[attKey(d, id)]; if (r) return { id, subject: r.subject || "—", num: r.num || 0, kind: r.kind || "", extra: true };
    return null;
  }
  SCREENS.mark = (id, ds) => {
    const d = parseISO(ds) || TODAY, l = findLesson(id, d);
    if (!l) return { title: "Занятие не найдено", back: "#journal", nav: "journal", html: empty("journal", "Занятие не найдено", "Возможно, его удалили из расписания.", `<a class="btn btn--soft" href="#journal">К журналу</a>`) };
    const k = attKey(d, l.id), [list, sg] = roster(l.subject);
    if (!MK || MK.k !== k) {
      const rec = DB.attendance[k];
      MK = { k, l, d, list, sg, saved: !!rec, rec: rec || { subject: l.subject, num: l.num || 0, kind: l.kind || "", marks: Object.fromEntries(list.map(s => [s.id, "+"])) } };
    } else Object.assign(MK, { list, sg });
    const [b, e] = lessonSpan(l), need = subgroupOf(l.subject);
    let notice = "";
    if (need && !sg && DB.students.length) notice = `<div class="notice">${ic("subgroups")}<span>Распределите студентов по подгруппам — здесь будет только ${need}-я подгруппа</span><a class="link" href="#subgroups/${encodeURIComponent(baseSubject(l.subject))}">Распределить</a></div>`;
    else if (sg) { const base = baseSubject(l.subject), own = ownSplit(), free = DB.students.filter(s => !studentSubgroup(s, base, own)).length; if (free) notice = `<div class="notice">${ic("subgroups")}<span>Без подгруппы: <b>${free}</b></span><a class="link" href="#subgroups/${encodeURIComponent(base)}">Распределить</a></div>`; }
    return {
      title: baseSubject(l.subject), sub: `${fmtShort(d)} · ${l.num || "?"} пара${b ? ` · ${b}–${e}` : ""}${sg ? ` · п/г ${sg}` : ""}`,
      back: "#journal", nav: "journal", focus: true, actions: [["broom", "Удалить отметки занятия", "resetMarks"]],
      actionbar: `<button class="btn btn--ok" data-act="allHere">${ic("tick")}Все были</button><button class="btn btn--primary" data-act="copyAbsent">${ic("copy")}Копировать</button>`,
      html: `
        <div class="card markbar" id="markbar">${markbarHtml()}</div>
        <div class="split">
          <div class="stack">
            ${notice}
            <p class="hint">Нажмите на студента: <kbd>+</kbd> был · <kbd>Н</kbd> не был · <kbd>У</kbd> уважительная причина</p>
            ${list.length ? `<div class="grid mark-list">${list.map(s => markRow(s, MK.rec.marks[s.id])).join("")}</div>`
              : empty("group", "", sg ? "В этой подгруппе пока никого нет." : "В группе пока нет студентов. Добавьте их во вкладке «Группа».")}
          </div>
          <aside class="split__side only-wide"><section class="card stack" id="markSide">${markSideHtml(true)}</section></aside>
        </div>`,
    };
  };
  const MARK_TXT = { "+": ["+", "был"], "н": ["Н", "не был"], "у": ["У", "уважительная причина"] };
  function markRow(s, v) {
    const [ch, word] = MARK_TXT[v] || ["—", "нет отметки"];
    return `<button class="card card--tap person mark" data-act="mark" data-id="${esc(s.id)}" data-s="${v === "н" ? "H" : v === "у" ? "U" : v === "+" ? "+" : "-"}" aria-label="${esc(s.name)}: ${word}">
      ${avatar(s.name)}<div class="person__body"><div class="person__name">${esc(s.name)}</div><div class="person__meta mark__state">${v === "+" ? "" : word}</div></div>
      <span class="mark__chip" aria-hidden="true">${ch}</span></button>`;
  }
  const markTally = () => summarize(MK.rec, MK.list);
  const markParts = t => [{ v: t.here, c: "var(--here)" }, { v: t.abs, c: "var(--absent)" }, { v: t.exc, c: "var(--excused)" }, { v: Math.max(0, t.total - t.here - t.abs - t.exc), c: "var(--track)" }];
  function markbarHtml() {
    const t = markTally();
    return `${donut(markParts(t), 44, 7, "", `${t.here} из ${t.total}`, false)}
      <div class="markbar__count num">${t.here}<small> из ${t.total}</small></div>
      <div class="markbar__chips"><span class="pill pill--bad num">Н ${t.abs}</span><span class="pill pill--exc num">У ${t.exc}</span></div>`;
  }
  function markSideHtml(anim) {
    const t = markTally();
    return `${donut(markParts(t), 132, 18, `<b>${t.here}</b><small>из ${t.total}</small>`, `${t.here} из ${t.total} на паре`, anim)}
      <div class="legend"><div><i style="--c:var(--here)"></i>Были<b>${t.here}</b></div><div><i style="--c:var(--absent)"></i>Не было<b>${t.abs}</b></div><div><i style="--c:var(--excused)"></i>Уважительная<b>${t.exc}</b></div></div>
      ${t.absent.length ? `<p class="muted" style="font-size:13px">Нет: ${esc(t.absent.map(s => shortName(s.name)).join(", "))}</p>` : ""}
      <p style="font-size:13px;color:${MK.saved ? "var(--ok-ink)" : "var(--warn-ink)"}">${MK.saved ? `${ic("tick")} Сохранено` : "Ещё не сохранено — отметьте отсутствующих"}</p>
      <div class="btn-row"><button class="btn btn--ok" data-act="allHere">${ic("tick")}Все были</button><button class="btn btn--primary" data-act="copyAbsent">${ic("copy")}Копировать</button></div>
      <p class="hint" style="text-align:left;padding:0">С клавиатуры: Tab — к студенту, пробел — сменить отметку.</p>`;
  }
  function refreshMarkSummary() { const mb = $("#markbar"); if (mb) mb.innerHTML = markbarHtml(); const sd = $("#markSide"); if (sd) sd.innerHTML = markSideHtml(false); }
  function storeRec() {
    if (MK.sg) { const ids = new Set(MK.list.map(s => s.id)); MK.rec.marks = Object.fromEntries(Object.entries(MK.rec.marks).filter(([k]) => ids.has(k))); }
    DB.attendance[MK.k] = MK.rec; MK.saved = true; persist();
  }

  /* ----- Группа ----- */
  SCREENS.group = (tab) => {
    if (tab) S.groupTab = tab;
    S.from = "group";
    const isT = S.groupTab === "teachers", list = students();
    const order = { head: 0, deputy: 1 }, leaders = list.filter(s => s.role in order).sort((a, b) => order[a.role] - order[b.role]);
    let body;
    if (isT) body = DB.teachers.length ? `<div class="grid grid--cols" id="people">${DB.teachers.slice().sort(byName).map(teacherCard).join("")}</div>` : empty("teacher", "", "Преподавателей пока нет. Они появятся сами из расписания или добавьте их кнопкой «+».");
    else body = list.length ? `<div id="people" class="stack">
        ${sectionHead("crown", "Актив группы", `<button class="link" data-act="form" data-f="deputies">Замы</button>`)}
        ${leaders.length ? `<div class="grid grid--cols">${leaders.map(studentCard).join("")}</div>` : `<p class="hint" style="text-align:left">Старосту выберите в карточке студента, замов — кнопкой «Замы».</p>`}
        ${sectionHead("group", "Студенты", "", list.length)}
        <div class="grid grid--cols">${list.map(studentCard).join("")}</div></div>`
      : empty("group", "В группе нет студентов", "Добавьте их по одному кнопкой «+» или сразу списком.", `<button class="btn btn--soft" data-act="form" data-f="addMany">${ic("add_many")}Добавить списком</button>`);
    return {
      title: "Группа", sub: `${groupName()} · ${list.length} ${plural(list.length, ["студент", "студента", "студентов"])}`, nav: "group", fab: isT ? "teacher" : "student",
      actions: [["subgroups", "Подгруппы", "go", "#subgroups"], ["add_many", "Добавить списком", "form", "addMany"]],
      html: `
        <div class="seg seg--fit" role="tablist" aria-label="Список">
          <button role="tab" aria-selected="${!isT}" data-go="#group/students">Студенты · ${list.length}</button>
          <button role="tab" aria-selected="${isT}" data-go="#group/teachers">Преподаватели · ${DB.teachers.length}</button></div>
        <label class="search">${ic("search")}<span class="sr">Поиск</span><input type="search" id="search" placeholder="${isT ? "Поиск по ФИО или предмету" : "Поиск по ФИО или телефону"}" autocomplete="off"></label>
        ${body}
        <div id="noResults" hidden>${empty("search", "", "Никого не нашли. Проверьте написание или поищите по фамилии.")}</div>`,
      after: bindSearch,
    };
  };
  function studentCard(s) {
    const role = s.role === "head" ? `<span style="color:var(--warn-ink)">${ic("crown")} Староста</span>` : s.role === "deputy" ? `<span>${ic("deputy")} Зам. старосты</span>` : "";
    const p = parseBday(s.birthday);
    return `<a class="card card--tap person${s.subgroup ? " person--sg" : ""}" href="#student/${esc(s.id)}" style="--accent:${s.subgroup ? sgColor(s.subgroup) : "transparent"}" data-search="${esc(nameKey(s.name + " " + (s.phone || "")))}">
      ${avatar(s.name)}<div class="person__body"><div class="person__name">${esc(s.name)}</div>
      <div class="person__meta">${role}${s.subgroup ? sgChip(s.subgroup) : ""}${s.phone ? `<span class="num">${ic("phone")} ${esc(s.phone)}</span>` : ""}${p ? `<span>${ic("cake")} ${p[0]} ${MONTHS[p[1] - 1]}</span>` : ""}${s.note ? `<span class="ellipsis" style="max-width:100%">${esc(s.note)}</span>` : ""}</div></div></a>`;
  }
  function teacherCard(t) {
    const subs = teacherSubjects(t);
    const btns = [
      t.telegram && `<a class="btn btn--soft btn--sm" href="https://t.me/${esc(t.telegram)}" target="_blank" rel="noopener">${ic("telegram")}Telegram</a>`,
      t.email && `<a class="btn btn--soft btn--sm" href="mailto:${esc(t.email)}">${ic("email")}Почта</a>`,
      t.phone && `<a class="btn btn--soft btn--sm" href="tel:${esc(t.phone.replace(/[^+\d]/g, ""))}">${ic("phone")}Позвонить</a>`,
      `<button class="btn btn--neutral btn--sm" data-act="form" data-f="teacher" data-id="${esc(t.id)}">${ic("edit")}Изменить</button>`,
    ].filter(Boolean).join("");
    return `<article class="card stack" data-search="${esc(nameKey(t.name + " " + subs.join(" ")))}">
      <div class="person" style="padding:0;min-height:0">${avatar(t.name)}<div class="person__body"><div class="person__name">${esc(t.name)}</div>
      <div class="person__meta">${subs.map(x => `<span class="chip" style="--c:${accent(x)}">${esc(x)}</span>`).join("")}${t.telegram ? `<span>${esc(tgLabel(t.telegram))}</span>` : ""}${t.email ? `<span>${esc(t.email)}</span>` : ""}</div></div></div>
      ${t.email || t.telegram || t.phone ? "" : `<p class="muted" style="font-size:13px">Контактов пока нет — добавьте почту или Telegram.</p>`}
      <div class="btn-row">${btns}</div></article>`;
  }
  function bindSearch() {
    const inp = $("#search"); if (!inp) return;
    inp.addEventListener("input", () => {
      const q = nameKey(inp.value.trim());
      $$("#people [data-search]").forEach(el => { el.hidden = !!q && !el.dataset.search.includes(q); });
      $$("#people .section-head, #people > .hint").forEach(h => { h.hidden = !!q; });
      // при поиске староста и замы не дублируются: прячем блок «Актив группы»
      const grids = $$("#people > .grid"); if (grids.length > 1) grids[0].hidden = !!q;
      const shown = $$("#people [data-search]").filter(el => !el.hidden && !el.closest("[hidden]")).length;
      $("#noResults").hidden = shown > 0;
    });
  }

  /* ----- Подгруппы ----- */
  SCREENS.subgroups = (base) => {
    const own = ownSplit(), counts = subgroupCounts();
    if (base !== undefined) S.sgTab = base;
    if (S.sgTab && !own.includes(S.sgTab)) S.sgTab = "";
    const b = S.sgTab || null, N = splitSize(b), list = students();
    const num = s => studentSubgroup(s, b, own);
    const cnt = Array.from({ length: N }, (_, i) => list.filter(s => num(s) === i + 1).length), none = list.filter(s => !num(s)).length;
    const manual = new Set(DB.settings.own_split || []), mainN = mainCount(counts);
    const canOwn = Object.keys(counts).filter(x => !own.includes(x));
    const chip = s => { const n = num(s); return `<button class="sgchip${n ? "" : " sgchip--none"}" style="--c:${n ? sgColor(n) : "var(--muted)"}" data-act="sgCycle" data-id="${esc(s.id)}" aria-label="${esc(s.name)}: ${n ? n + "-я подгруппа" : "без подгруппы"}. Нажмите, чтобы сменить">${n || "—"}</button>`; };
    const row = s => { const n = num(s); return `<div class="card person${n ? " person--sg" : ""}" style="--accent:${n ? sgColor(n) : "transparent"}" draggable="true" data-drag="${esc(s.id)}">${avatar(s.name)}<div class="person__body"><div class="person__name">${esc(s.name)}</div></div>${chip(s)}</div>`; };
    const boards = [...Array.from({ length: N }, (_, i) => i + 1), 0].map(n => {
      const ls = list.filter(s => num(s) === n);
      return `<section class="board" style="--c:${n ? sgColor(n) : "var(--muted)"}" data-drop="${n}" aria-label="${n ? n + "-я подгруппа" : "Без подгруппы"}">
        <div class="board__head"><b>${n ? `${n}-я подгруппа` : "Без подгруппы"}</b><span class="pill num" style="background:var(--card)">${ls.length}</span></div>
        ${ls.map(row).join("") || `<p class="hint" style="padding:18px 6px">${n ? "Перетащите сюда студентов" : "Все распределены"}</p>`}</section>`;
    }).join("");
    const usedBy = b ? `Своё деление: ${N} ${plural(N, ["подгруппа", "подгруппы", "подгрупп"])}${counts[b] !== mainN ? " — по расписанию" : ""}.`
      : own.length ? `Для всех предметов, кроме: <b>${own.map(esc).join(", ")}</b>.` : "Для всех предметов с подгруппами.";
    return {
      title: "Подгруппы", sub: b || "Основное деление", back: "#group", nav: "group",
      html: `
        ${own.length ? `<div class="seg" role="tablist" aria-label="Деление"><button role="tab" aria-selected="${!b}" data-act="sgTab" data-t="">Основные</button>${own.map(x => `<button role="tab" aria-selected="${b === x}" data-act="sgTab" data-t="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : ""}
        <section class="card">
          <p style="font-size:14px">${usedBy}</p>
          <div class="counts">${cnt.map((c, i) => `<span class="pill num" style="background:color-mix(in srgb, ${sgColor(i + 1)} 15%, var(--card));color:color-mix(in srgb, ${sgColor(i + 1)} 60%, var(--text))">${i + 1}-я: ${c}</span>`).join("")}<span class="pill ${none ? "pill--warn" : ""} num" style="${none ? "" : "background:var(--field);color:var(--muted-ink)"}">без подгруппы: ${none}</span></div>
          <div class="btn-row"><button class="btn btn--primary" data-act="form" data-f="sgLists">${ic("add_many")}Задать списками</button><button class="btn btn--soft" data-act="sgEven">${ic("subgroups")}Поровну по списку</button>
          ${b ? (manual.has(b) && counts[b] === mainN ? `<button class="btn btn--neutral" data-act="sgUnown" data-t="${esc(b)}">Делить как основные</button>` : "")
              : canOwn.length ? `<button class="btn btn--neutral" data-act="form" data-f="ownSplit">Своё деление для предмета</button>` : ""}</div>
        </section>
        ${list.length ? `<p class="hint only-narrow">Нажмите на номер, чтобы сменить подгруппу: 1 → … → ${N} → —</p>
        <p class="hint only-wide" style="text-align:left">Перетащите студента в нужную колонку или нажмите на номер.</p>
        <div class="stack sg-list">${list.map(row).join("")}</div>
        <div class="boards" style="--n:${N}">${boards}</div>` : empty("group", "", "В группе нет студентов. Добавьте их во вкладке «Группа».")}`,
      after: bindDnD,
    };
  };
  function bindDnD() {
    let dragId = null;
    $$("[data-drag]").forEach(el => {
      el.addEventListener("dragstart", e => { dragId = el.dataset.drag; el.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
      el.addEventListener("dragend", () => el.classList.remove("is-drag"));
    });
    $$("[data-drop]").forEach(bd => {
      bd.addEventListener("dragover", e => { e.preventDefault(); bd.classList.add("is-over"); });
      bd.addEventListener("dragleave", () => bd.classList.remove("is-over"));
      bd.addEventListener("drop", e => {
        e.preventDefault(); bd.classList.remove("is-over");
        const s = DB.students.find(x => x.id === (dragId || e.dataTransfer.getData("text/plain")));
        if (s) { setStudentSubgroup(s, Number(bd.dataset.drop), S.sgTab || null); persist(); render(true); }
      });
    });
  }

  /* ----- Итоги ----- */
  const PERIODS = [["1", "1 семестр"], ["2", "2 семестр"], ["year", "Весь год"]];
  const periodName = p => (PERIODS.find(x => x[0] === p) || PERIODS[2])[1];
  function periodTabs(field) {
    return `<div class="seg seg--fit" role="tablist" aria-label="Период">${PERIODS.map(([v, n]) => `<button role="tab" aria-selected="${S[field] === v}" data-act="period" data-f="${field}" data-v="${v}">${n}</button>`).join("")}</div>`;
  }
  function weeksChart(byWeek) {
    const ws = Object.keys(byWeek).sort().slice(-16);
    if (!ws.length) return `<p class="muted">Нет отмеченных пар.</p>`;
    const ci = semInfo(TODAY), cur = `${ci.num}-${String(ci.week).padStart(2, "0")}`;
    return `<div class="weeks" role="img" aria-label="Посещаемость по неделям">${ws.map(w => {
      const p = attendancePct(byWeek[w]) ?? 0, wk = +w.split("-")[1];
      return `<div class="weeks__col${w === cur ? " weeks__col--now" : ""}"><b>${p}</b><i style="height:${Math.max(4, (p - 40) / 60 * 72)}%;--c:${pctColor(p)}"></i><span>${wk}</span></div>`;
    }).join("")}</div><p class="hint" style="text-align:left;margin-top:8px">Процент по учебным неделям${ws.includes(cur) ? `, ${ci.week}-я — текущая` : ""}. Шкала от 40 %.</p>`;
  }
  SCREENS.stats = () => {
    S.statsPeriod ||= String(semInfo(TODAY).num);
    const recs = periodRecords(S.statsPeriod, S.statsSubject), st = collectStats(recs);
    const subs = [...new Set(periodRecords(S.statsPeriod).map(x => baseSubject(x.r.subject)))].sort((a, b) => a.localeCompare(b, "ru"));
    const filter = subs.length ? `<div class="filter" role="group" aria-label="Предмет"><button aria-pressed="${!S.statsSubject}" data-act="statsSubj" data-s="">Все предметы</button>${subs.map(s => `<button aria-pressed="${S.statsSubject === s}" data-act="statsSubj" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : "";
    const head = { title: "Итоги", sub: `${periodName(S.statsPeriod)} · ${S.statsSubject || "все предметы"}`, back: "#journal", nav: "journal", actions: [["excel", "Выгрузить в Excel", "excel"]] };
    if (!st.all.length) return { ...head, html: `${periodTabs("statsPeriod")}${filter}${empty("chart", "Пока нет отметок", `За период «${periodName(S.statsPeriod)}» ещё нет отмеченных пар. Итоги появятся после первой отметки в журнале.`)}` };
    const P = st.pct ?? 0, list = students().map(s => ({ s, m: st.per[s.id] || [] })).filter(x => x.m.length).map(x => ({ ...x, p: attendancePct(x.m) ?? 100, abs: x.m.filter(m => m === "н").length, exc: x.m.filter(m => m === "у").length })).sort((a, b) => a.p - b.p);
    const low = list.filter(x => x.p < 70).length;
    return { ...head, html: `
      ${periodTabs("statsPeriod")}${filter}
      <div class="grid grid--cols2">
        <section class="card"><div class="card__head">${ic("chart")}<h3>Посещаемость</h3></div>
          <div class="summary">${donut([{ v: st.here, c: "var(--here)" }, { v: st.abs, c: "var(--absent)" }, { v: st.exc, c: "var(--excused)" }], 126, 18, `<b style="color:${pctInk(P)}">${P}%</b><small>посещаемость</small>`, `Посещаемость ${P} процентов`)}
          <div class="legend"><div><i style="--c:var(--here)"></i>Были<b>${st.here}</b></div><div><i style="--c:var(--absent)"></i>Не были<b>${st.abs}</b></div><div><i style="--c:var(--excused)"></i>Уважительная<b>${st.exc}</b></div>
          <p class="muted" style="font-size:12px;margin-top:4px">${recs.length} ${plural(recs.length, ["занятие", "занятия", "занятий"])}. Уважительные пропуски не снижают процент.</p></div></div></section>
        <section class="card"><div class="card__head">${ic("calendar")}<h3>По неделям</h3></div>${weeksChart(st.byWeek)}</section>
        ${S.statsSubject ? "" : `<section class="card" style="grid-column:1/-1"><div class="card__head">${ic("schedule")}<h3>По предметам</h3></div>
          <div class="grid grid--cols2" style="gap:14px 28px">${Object.entries(st.bySubj).map(([k, v]) => [k, attendancePct(v) ?? 100]).sort((a, b) => a[1] - b[1]).map(([k, p]) =>
            `<button class="bar-row" style="text-align:left" data-act="statsSubj" data-s="${esc(k)}"><div class="bar-row__head"><span>${esc(k)}</span><b style="color:${pctInk(p)}">${p}%</b></div>${bar(p, pctColor(p))}</button>`).join("")}</div></section>`}
      </div>
      ${sectionHead("group", "Студенты. Сначала с низкой посещаемостью", low ? `<span class="pill pill--bad">${low} ниже 70%</span>` : "")}
      <p class="hint" style="text-align:left">Нажмите на студента, чтобы открыть его пропуски.</p>
      <div class="grid grid--cols">${list.map(({ s, p, abs, exc }) => `<a class="card card--tap person" href="#student/${esc(s.id)}" data-act="fromStats">
        ${avatar(s.name)}<div class="person__body"><div class="bar-row__head"><span class="person__name">${esc(s.name)}</span><b style="color:${pctInk(p)}">${p}%</b></div>
        <div style="margin-top:6px">${bar(p, pctColor(p), true)}</div><div class="person__meta num">пропусков: ${abs}${exc ? ` · уваж.: ${exc}` : ""}</div></div></a>`).join("")}</div>` };
  };

  /* ----- выгрузка в Excel: «Сводка» + лист-ведомость на каждый предмет ----- */
  const KIND_SHORT = { "Лекция": "лек.", "Практика": "пр.", "Лабораторная": "лаб.", "Семинар": "сем.", "Внеплановое": "внепл." };
  function shortSheetName(n) {
    if (n.length <= 31) return n;
    n = n.replace(/\s*\([^)]*\)/g, "").trim() || n;
    return n.length <= 31 ? n : n.slice(0, 30).replace(/[ ,.-]+$/, "") + "…";
  }
  function attendanceWorkbook(recs, periodTitle) {
    const X = XLSX.S, col = XLSX.col, list = students(), group = DB.settings.group;
    const headTitle = (group ? `Группа ${group} · ` : "") + periodTitle;
    const pctCell = (p, none = X.CENTER) => p != null ? [p, p >= 85 ? X.PCT_OK : p >= 70 ? X.PCT_WARN : X.PCT_BAD] : ["", none];
    const markCell = m => m === "н" ? ["н", X.ABSENT] : m === "у" ? ["у", X.EXCUSED] : m === "+" ? ["+", X.PRESENT] : ["", X.CENTER];
    const count = (ms, v) => ms.filter(m => m === v).length;
    const tail = [["Пропуски", X.HEAD], ["Уважит.", X.HEAD], ["Посещаемость", X.HEAD]];
    const bySubj = {};
    recs.forEach(x => (bySubj[baseSubject(x.r.subject)] ||= []).push(x));
    const subs = Object.keys(bySubj).sort((a, b) => nameKey(a).localeCompare(nameKey(b), "ru"));

    let ncol = 2 + subs.length + 3;
    const rows = [[[`Сводка посещаемости · ${headTitle}`, X.TITLE]],
      [[`Процент посещаемости не учитывает пропуски по уважительной причине. Отмечено занятий: ${recs.length}. Выгружено ${dmy(TODAY)}.`, X.NOTE]],
      [["№", X.HEAD], ["ФИО", X.HEAD_LEFT], ...subs.map(s => [s, X.HEAD]), ...tail]];
    list.forEach((st, i) => {
      const line = [[i + 1, X.CENTER], [st.name, X.TEXT]], all = [];
      subs.forEach(s => { const ms = bySubj[s].map(x => (x.r.marks || {})[st.id]).filter(Boolean); all.push(...ms); line.push(pctCell(attendancePct(ms))); });
      rows.push([...line, [count(all, "н"), X.CENTER], [count(all, "у"), X.CENTER], pctCell(attendancePct(all))]);
    });
    const total = [["", X.TOTAL], ["Вся группа", X.TOTAL]], every = [];
    subs.forEach(s => { const ms = bySubj[s].flatMap(x => Object.values(x.r.marks || {}).filter(Boolean)); every.push(...ms); total.push(pctCell(attendancePct(ms), X.TOTAL)); });
    rows.push([...total, [count(every, "н"), X.TOTAL], [count(every, "у"), X.TOTAL], pctCell(attendancePct(every), X.TOTAL)]);
    const sheets = [{ name: "Сводка", rows, freeze: [3, 2], widths: [5, 32, ...subs.map(() => 14), 11, 10, 14], heights: { 1: 24, 3: 62 }, merges: [`A1:${col(ncol)}1`, `A2:${col(ncol)}2`] }];

    subs.forEach(s => {
      const items = bySubj[s].slice().sort((a, b) => a.k.split("|")[0].localeCompare(b.k.split("|")[0]) || (a.r.num || 0) - (b.r.num || 0));
      ncol = 2 + items.length + 3;
      const head = [["№", X.HEAD], ["ФИО", X.HEAD_LEFT], ...items.map(({ r, d }) => {
        const sg = subgroupOf(r.subject), extra = [KIND_SHORT[r.kind] || "", sg ? `п/г ${sg}` : ""].filter(Boolean).join(" ");
        return [`${dmy(d).slice(0, 5)}\n${r.num || "?"} пара${extra ? "\n" + extra : ""}`, X.HEAD];
      }), ...tail];
      const rs = [[[`${s} · ${headTitle}`, X.TITLE]], [[`н — не был, у — уважительная причина, + — был, п/г — подгруппа. Занятий: ${items.length}.`, X.NOTE]], head];
      list.forEach((st, i) => {
        const ms = items.map(x => (x.r.marks || {})[st.id]), got = ms.filter(Boolean);
        rs.push([[i + 1, X.CENTER], [st.name, X.TEXT], ...ms.map(markCell), [count(got, "н"), X.CENTER], [count(got, "у"), X.CENTER], pctCell(attendancePct(got))]);
      });
      rs.push([["", X.TOTAL], ["Были на занятии", X.TOTAL], ...items.map(x => [`${list.filter(st => (x.r.marks || {})[st.id] === "+").length}/${list.length}`, X.TOTAL]), ["", X.TOTAL], ["", X.TOTAL], ["", X.TOTAL]]);
      sheets.push({ name: shortSheetName(s), rows: rs, freeze: [3, 2], widths: [5, 32, ...items.map(() => 9), 11, 10, 14], heights: { 1: 24, 3: 50 }, merges: [`A1:${col(ncol)}1`, `A2:${col(ncol)}2`] });
    });
    return sheets;
  }
  function exportExcel() {
    S.statsPeriod ||= String(semInfo(TODAY).num);
    const recs = periodRecords(S.statsPeriod, S.statsSubject);
    if (!recs.length) return toast("Нечего выгружать — за этот период отметок нет", "info");
    const ay = academicYear(TODAY), yy = `${ay}/${String(ay + 1).slice(-2)}`;
    const sheets = attendanceWorkbook(recs, S.statsPeriod === "year" ? `учебный год ${yy}` : `${S.statsPeriod} семестр ${yy}`);
    const suffix = S.statsSubject ? "_" + S.statsSubject.replace(/[^\wа-яё]+/gi, "_") : "";
    download(XLSX.blob(sheets), `посещаемость_${S.statsPeriod === "year" ? "год" : S.statsPeriod + "сем"}${suffix}_${key(TODAY)}.xlsx`);
    const n = sheets.length - 1;
    toast(`Ведомость скачана: сводка и ${n} ${plural(n, ["лист", "листа", "листов"])} по предметам`, "excel");
  }

  /* ----- Студент ----- */
  SCREENS.student = (id) => {
    const s = DB.students.find(x => x.id === id);
    const back = S.from === "stats" ? "#stats" : "#group", nav = S.from === "stats" ? "journal" : "group";
    if (!s) return { title: "Студент не найден", back, nav, html: empty("group", "", "Возможно, студента удалили из группы.") };
    S.studentPeriod ||= String(semInfo(TODAY).num);
    const recs = periodRecords(S.studentPeriod), st = collectStats(recs, s.id), all = collectStats(recs);
    const P = st.pct, avg = all.pct, misses = st.misses.sort((a, b) => b.d - a.d), p = parseBday(s.birthday);
    const roleTxt = s.role === "head" ? " · староста" : s.role === "deputy" ? " · зам. старосты" : "";
    return {
      title: s.name, sub: (s.subgroup ? `${s.subgroup}-я подгруппа` : "без подгруппы") + roleTxt, back, nav,
      actions: [["edit", "Редактировать", "form", "student", s.id]],
      html: `
        <section class="card profile">${avatar(s.name, "avatar--lg")}<div style="min-width:0"><h2>${esc(s.name)}</h2>
          <div class="person__meta">${s.subgroup ? sgChip(s.subgroup) : ""}${s.phone ? `<a class="num" href="tel:${esc(s.phone.replace(/[^+\d]/g, ""))}">${ic("phone")} ${esc(s.phone)}</a>` : ""}${p ? `<span>${ic("cake")} ${p[0]} ${MONTHS[p[1] - 1]}</span>` : ""}${s.note ? `<span>${esc(s.note)}</span>` : ""}</div></div></section>
        ${periodTabs("studentPeriod")}
        ${!st.all.length ? empty("chart", "Отметок пока нет", `За период «${periodName(S.studentPeriod)}» у студента нет отметок.`) : `
        <div class="grid grid--cols2">
          <section class="card"><div class="card__head">${ic("chart")}<h3>Посещаемость</h3></div>
            <div class="summary">${donut([{ v: st.here, c: "var(--here)" }, { v: st.abs, c: "var(--absent)" }, { v: st.exc, c: "var(--excused)" }], 120, 17, `<b style="color:${pctInk(P ?? 100)}">${P ?? "—"}${P != null ? "%" : ""}</b><small>посещаемость</small>`, `Посещаемость ${P ?? "—"} процентов`)}
            <div class="legend"><div><i style="--c:var(--here)"></i>Был<b>${st.here}</b></div><div><i style="--c:var(--absent)"></i>Не был<b>${st.abs}</b></div><div><i style="--c:var(--excused)"></i>Уважительная<b>${st.exc}</b></div>
            ${avg != null ? `<div class="compare">В среднем по группе <b style="color:var(--text)">${avg}%</b></div>` : ""}</div></div></section>
          <section class="card"><div class="card__head">${ic("calendar")}<h3>По неделям</h3></div>${weeksChart(st.byWeek)}</section>
          <section class="card"><div class="card__head">${ic("schedule")}<h3>По предметам</h3></div><div class="stack" style="gap:14px">${Object.entries(st.bySubj).map(([k, v]) => [k, attendancePct(v) ?? 100]).sort((a, b) => a[1] - b[1]).map(([k, q]) =>
            `<div class="bar-row"><div class="bar-row__head"><span>${esc(k)}</span><b style="color:${pctInk(q)}">${q}%</b></div>${bar(q, pctColor(q))}</div>`).join("")}</div></section>
          <section class="card"><div class="card__head">${ic("alarm")}<h3>Пропуски</h3><span class="pill pill--bad num">${misses.length}</span></div>
            ${misses.length ? `<div class="mini">${misses.slice(0, 20).map(x => `<a class="mini__row" href="#mark/${esc(x.k.split("|")[1])}/${key(x.d)}"><span class="mark__chip" style="width:36px;height:30px;font-size:14px;background:${x.m === "н" ? "var(--bad)" : "var(--excused)"};color:#fff">${x.m === "н" ? "Н" : "У"}</span><div class="mini__body"><div class="mini__title">${esc(baseSubject(x.r.subject))}</div><div class="mini__sub">${fmtShort(x.d)} · ${x.r.num || "?"} пара</div></div>${ic("right", "muted")}</a>`).join("")}</div>
              ${misses.length > 20 ? `<p class="hint" style="margin-top:8px">и ещё ${misses.length - 20}</p>` : ""}` : `<p class="muted">Пропусков нет — отлично.</p>`}</section>
        </div>`}`,
    };
  };

  /* ----- Дела ----- */
  SCREENS.tasks = () => {
    const done = S.taskTab === "done";
    const items = DB.tasks.filter(t => !!t.done === done && (!S.taskKind || t.kind === S.taskKind))
      .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.created || 0) - (b.created || 0));
    const nOpen = DB.tasks.filter(t => !t.done).length, nDone = DB.tasks.length - nOpen;
    const card = t => `<article class="card task${t.done ? " task--done" : ""}">${taskBadge(t)}
      <button class="task__body" style="text-align:left" data-act="form" data-f="task" data-id="${esc(t.id)}" aria-label="Изменить: ${esc(t.title)}"><div class="task__title">${esc(t.title)}</div>
      ${t.subject ? `<div class="person__meta" style="margin:2px 0">${esc(t.subject)}</div>` : ""}${dueHtml(t)}${t.text ? `<p class="muted" style="font-size:13px;margin-top:4px;white-space:pre-line">${esc(t.text)}</p>` : ""}</button>
      <button class="check" data-act="taskDone" data-id="${esc(t.id)}" aria-label="${t.done ? "Вернуть в работу" : "Отметить выполненным"}">${ic(t.done ? "check" : "uncheck")}</button></article>`;
    return {
      title: "Дела", sub: `${nOpen} ${plural(nOpen, ["активное", "активных", "активных"])}`, nav: "tasks", fab: "task",
      html: `
        <div class="seg seg--fit" role="tablist"><button role="tab" aria-selected="${!done}" data-act="taskTab" data-t="open">Активные · ${nOpen}</button><button role="tab" aria-selected="${done}" data-act="taskTab" data-t="done">Готово · ${nDone}</button></div>
        <div class="filter" role="group" aria-label="Тип">${[["", "Все", ""], ...Object.entries(TASK_KINDS).map(([k, v]) => [k, k, v.i])].map(([k, n, i]) =>
          `<button aria-pressed="${S.taskKind === k}" data-act="taskKind" data-k="${esc(k)}">${i ? ic(i) : ""}${n}</button>`).join("")}</div>
        ${items.length ? `<div class="grid grid--cols">${items.map(card).join("")}</div>`
          : empty("tasks", done ? "Здесь пусто" : "Дел нет", done ? "Выполненные дела появятся здесь." : "Нажмите «+», чтобы добавить дедлайн, объявление или напоминание.")}
        ${done && items.length ? `<button class="btn btn--danger btn--block" data-act="clearDone">${ic("delete")}Удалить выполненные</button>` : ""}`,
    };
  };

  /* ----- События ----- */
  SCREENS.events = () => {
    const past = S.showPast, N = DB.students.length;
    const items = DB.events.filter(e => { const d = eventDate(e); return d && (past ? d < TODAY : d >= TODAY); })
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")) * (past ? -1 : 1));
    const nUp = DB.events.filter(e => { const d = eventDate(e); return d && d >= TODAY; }).length;
    return {
      title: "События", sub: `${nUp} ${plural(nUp, ["событие", "события", "событий"])} впереди`, nav: "events", fab: "event",
      html: `
        <div class="seg seg--fit" role="tablist"><button role="tab" aria-selected="${!past}" data-act="showPast" data-v="0">Предстоящие</button><button role="tab" aria-selected="${past}" data-act="showPast" data-v="1">Прошедшие</button></div>
        ${items.length ? `<div class="grid grid--cols">${items.map(e => {
          const c = eventKind(e), d = eventDate(e), g = new Set(e.going || []), n = daysBetween(TODAY, d);
          const faces = students().filter(s => g.has(s.id)).slice(0, 4).map(s => avatar(s.name)).join("");
          const invite = `${e.title} — ${fmtLong(d)}${e.time ? ", " + e.time : ""}${e.place ? ". Место: " + e.place : ""}.${e.text ? " " + e.text : ""}`;
          return `<article class="card event"><div class="event__date" style="--c:${c.c}"><b>${d.getDate()}</b><span>${MON_SHORT[d.getMonth()]}</span></div>
            <div style="min-width:0"><div class="person__meta" style="margin:0 0 4px"><span class="chip" style="--c:${c.c}">${ic(c.i)}${esc(e.kind || "Другое")}</span><span>${whenText(n)}</span></div>
            <button style="text-align:left;display:block;width:100%" data-act="form" data-f="event" data-id="${esc(e.id)}"><h3 class="event__title">${esc(e.title)}</h3></button>
            <div class="meta" style="margin-top:4px"><span>${ic("clock")}${WDS[d.getDay()]}${e.time ? ", " + esc(e.time) : ""}</span>${e.place ? `<span>${ic("place")}${esc(e.place)}</span>` : ""}</div>
            ${e.text ? `<p class="muted" style="font-size:13px;margin-top:6px;white-space:pre-line">${esc(e.text)}</p>` : ""}
            <div class="going">${faces ? `<span class="faces">${faces}</span>` : ""}${bar(N ? g.size / N * 100 : 0, "var(--primary)", true)}<b>${g.size} из ${N}</b></div>
            <div class="btn-row" style="margin-top:10px"><button class="btn btn--soft btn--sm" data-act="going" data-id="${esc(e.id)}">${ic("going")}Кто идёт</button>
            <button class="btn btn--neutral btn--sm" data-act="copyText" data-t="${esc(invite)}">${ic("copy")}Приглашение</button></div></div></article>`;
        }).join("")}</div>` : empty("party", past ? "Прошедших событий нет" : "Событий пока нет", past ? "Здесь будут события, дата которых уже прошла." : "Добавьте собрание, поход или праздник — ближайшие появятся на главной.")}`,
    };
  };

  /* ----- Настройки ----- */
  const THEMES = [
    { id: "system", n: "Как в системе", bg: "linear-gradient(135deg,#F5F5F7 50%,#000 50%)", fg: "#1D1D1F", dots: ["#22C79B", "#2DD4A7"] },
    { id: "mint", n: "Светлая", bg: "#F5F5F7", fg: "#1D1D1F", dots: ["#22C79B", "#FF6F61", "#9B8AFB"] },
    { id: "violet", n: "Фиолетовая", bg: "#F4F5FB", fg: "#1F2240", dots: ["#5B4CF0", "#DC2626", "#D97706"] },
    { id: "dark", n: "Тёмная", bg: "#000", fg: "#F5F5F7", dots: ["#2DD4A7", "#FF7A6E", "#ADA0FF"] },
  ];
  SCREENS.settings = () => {
    const cur = store.get("theme", "system"), [s1, s2] = semesterDates(), b = bells();
    const row = (title, sub, act = "") => `<div class="setting"><div class="setting__body"><b>${title}</b><span>${sub}</span></div>${act}</div>`;
    const editBtn = f => `<button class="btn btn--soft btn--sm" data-act="form" data-f="${f}">${ic("edit")}Изменить</button>`;
    const lastBackup = store.get("lastBackup", 0), ng = DB.settings.nntu_group, synced = parseISO(DB.settings.nntu_synced);
    return {
      title: "Настройки", back: "#home", nav: "settings",
      html: `
        ${sectionHead("sun", "Оформление. Тема и цвета")}
        <div class="themes" role="radiogroup" aria-label="Тема">${THEMES.map(t => `<button class="theme-card" role="radio" aria-checked="${cur === t.id}" data-act="theme" data-t="${t.id}">
          <span class="theme-card__preview" style="background:${t.bg};color:${t.fg}"><b>Аа</b><span>${t.dots.map(c => `<i style="background:${c}"></i>`).join("")}</span></span>
          <span class="theme-card__name">${t.n}</span></button>`).join("")}</div>
        <div class="grid grid--cols2">
          <div class="stack">
            ${sectionHead("school", "Группа и учебный год")}
            <section class="card" style="padding:4px 14px">
              ${row("Название группы", esc(DB.settings.group || "не указано"), editBtn("groupName"))}
              ${row("Расписание НГТУ", ng ? `Группа ${esc(ng)}${synced ? ` · обновлено ${fmtDate(synced)}` : ""}` : "Не подключено — пары можно загрузить с сайта НГТУ",
                `<button class="btn btn--${ng ? "soft" : "primary"} btn--sm" data-act="form" data-f="nntu">${ic("download")}${ng ? "Обновить" : "Загрузить"}</button>`)}
              ${ng ? row("Автопроверка", `Раз в день при открытии сверяем ближайшие дни с сайтом${DB.settings.nntu_checked ? ` · последняя ${fmtDate(parseISO(DB.settings.nntu_checked))}` : ""}`,
                `<button class="btn btn--neutral btn--sm" data-act="checkNow">Проверить</button>`) : ""}
              ${row("Семестры", `1-й: ${fmtDate(s1[0])} — ${fmtDate(s1[1])} · 2-й: ${fmtDate(s2[0])} — ${fmtDate(s2[1])}`, editBtn("semesters"))}
              ${row("Звонки", `${b.length} ${plural(b.length, ["пара", "пары", "пар"])}, ${b[0][0]}–${b[b.length - 1][1]}`, editBtn("bells"))}
            </section>
          </div>
          <div class="stack">
            ${sectionHead("download", "Данные. Только на этом устройстве")}
            <section class="card" style="padding:4px 14px">
              ${row("Где хранятся", "Только в этом браузере на этом устройстве. Ни сайт, ни НГТУ их не видят.")}
              ${row("Скачать копию", lastBackup ? `Последняя — ${fmtDate(new Date(lastBackup))}` : "Ещё ни разу — стоит сделать", `<button class="btn btn--${needBackup() ? "primary" : "soft"} btn--sm" data-act="exportJson">${ic("download")}Скачать</button>`)}
              ${row("Загрузить из файла", "Заменить данные этого браузера копией или data.json из программы на ПК", `<button class="btn btn--neutral btn--sm" data-act="importJson">Выбрать файл</button>`)}
              ${row("Удалить всё", "Стереть данные группы из этого браузера", `<button class="btn btn--danger btn--sm" data-act="wipe">${ic("delete")}Удалить</button>`)}
            </section>
            ${sectionHead("info", "Приложение")}
            <section class="card" style="padding:4px 14px">
              ${row("Установить", "Иконка на рабочем столе или главном экране, работает без интернета", `<button class="btn btn--primary btn--sm" data-act="install">Установить</button>`)}
              ${row("О приложении", "Неофициальный помощник для старост НГТУ им. Р. Е. Алексеева. Расписание берётся с открытого сайта НГТУ.")}
            </section>
          </div>
        </div>`,
    };
  };

  /* ----- первый запуск ----- */
  function welcomeScreen() {
    return {
      title: "Помощник старосты", nav: "home", welcome: true,
      after: fillGroups,
      html: `<div class="welcome">
        <section class="hero"><h1>Помощник старосты.<span> Вся группа под рукой.</span></h1>
          <p>Расписание, посещаемость и дела группы НГТУ — в браузере на телефоне и компьютере. Данные хранятся только на этом устройстве.</p></section>
        <section class="card welcome__card">
          <div class="card__head">${ic("school")}<h3>Ваша группа</h3></div>
          <form data-form="welcome">
            ${field("Номер группы в НГТУ", `<input name="group" required list="nntuGroups" autocomplete="off" autocapitalize="characters" placeholder="26-ИВТ-2-1"><datalist id="nntuGroups"></datalist>`)}
            ${formErr}<button class="btn btn--primary btn--block btn--lg">${ic("download")}Загрузить расписание</button>
          </form>
          <p class="hint" style="text-align:left;margin-top:10px">Пары, аудитории и преподаватели подтянутся с сайта НГТУ. Студентов добавите потом во вкладке «Группа».</p>
        </section>
        <section class="card welcome__card">
          <div class="card__head">${ic("download")}<h3>Уже вели группу?</h3></div>
          <p class="muted" style="font-size:14px;margin-bottom:12px">Загрузите копию данных (файл .json). Данные программы на ПК лежат в <b class="num">%APPDATA%\\starosta\\data.json</b> — вставьте этот путь в окно выбора файла.</p>
          <button class="btn btn--soft btn--block" data-act="importJson">Выбрать файл</button>
        </section>
        <button class="link welcome__skip" data-act="startEmpty">Начать без расписания</button>
      </div>`,
    };
  }

  /* ================= КАРКАС ================= */
  const NAV = [["home", "Сегодня", "home"], ["schedule", "Пары", "schedule"], ["journal", "Журнал", "journal"], ["group", "Группа", "group"], ["tasks", "Дела", "tasks"], ["events", "События", "party"]];
  const app = $(".app"), view = $("#view"), topbar = $("#topbar"), nav = $("#nav"), fab = $("#fab"), actionbar = $("#actionbar");
  let lastRoute = "", current = null;

  function renderNav(active) {
    nav.innerHTML = `<a class="nav__brand" href="#home"><span class="brand__logo">${ic("school")}</span>Помощник<br>старосты</a>` +
      NAV.map(([id, n, i]) => `<a class="nav__item" href="#${id}"${active === id ? ' aria-current="page"' : ""}>${ic(i)}<span>${n}</span></a>`).join("") +
      `<a class="nav__item nav__item--settings" href="#settings"${active === "settings" ? ' aria-current="page"' : ""}>${ic("cog")}<span>Настройки</span></a>`;
  }
  function renderTopbar(scr) {
    const acts = (scr.actions || []).map(([i, label, act, arg, arg2]) => act === "go"
      ? `<a class="icon-btn" href="${arg}" aria-label="${label}" title="${label}">${ic(i)}</a>`
      : `<button class="icon-btn" data-act="${act}" data-f="${esc(arg || "")}" data-id="${esc(arg2 || "")}" aria-label="${label}" title="${label}">${ic(i)}</button>`).join("");
    if (scr.home) {
      const h = NOW.getHours(), hi = h >= 5 && h < 12 ? "Доброе утро" : h >= 12 && h < 17 ? "Добрый день" : h >= 17 && h < 23 ? "Добрый вечер" : "Доброй ночи";
      topbar.className = "topbar topbar--home";
      topbar.innerHTML = `<div class="brand"><span class="brand__logo">${ic("school")}</span><div class="brand__text"><small>${esc(DB.settings.group || "Помощник старосты")}</small><b>${hi}</b></div></div>
        <div class="topbar__actions"><button class="icon-btn" data-act="themeQuick" aria-label="Сменить тему" title="Светлая / тёмная">${ic(isDark() ? "sun" : "moon")}</button>
        <a class="icon-btn" href="#settings" aria-label="Настройки" title="Настройки">${ic("cog")}</a></div>`;
    } else {
      topbar.className = "topbar";
      topbar.innerHTML = `${scr.back ? `<a class="icon-btn back" href="${scr.back}" aria-label="Назад" title="Назад (Esc)">${ic("back")}</a>` : "<span></span>"}
        <div class="topbar__titles"><h1 class="topbar__title" title="${esc(scr.title)}">${esc(scr.title)}</h1>${scr.sub ? `<div class="topbar__sub">${esc(scr.sub)}</div>` : ""}</div>
        <div class="topbar__actions">${acts}</div>`;
    }
  }
  function render(keepScroll) {
    const [name, ...args] = (location.hash.slice(1) || "home").split("/");
    if (name !== "mark") MK = null;
    current = DB ? (SCREENS[name] || SCREENS.home)(...args.map(a => { try { return decodeURIComponent(a); } catch (e) { return a; } })) : welcomeScreen();
    renderTopbar(current); renderNav(current.nav || name);
    view.innerHTML = current.html;
    app.classList.toggle("is-focus", !!current.focus);
    app.classList.toggle("is-welcome", !!current.welcome);
    fab.hidden = !current.fab; fab.dataset.kind = current.fab || "";
    actionbar.hidden = !current.actionbar; actionbar.innerHTML = current.actionbar || "";
    current.after && current.after();
    const route = location.hash;
    if (!keepScroll && route !== lastRoute) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
    lastRoute = route;
    document.title = (current.home ? "" : (current.title + " — ")) + "Помощник старосты";
  }

  /* ---------- тосты и листы ---------- */
  let toastT;
  function toast(text, icon = "tick") {
    const el = $("#toast"); el.innerHTML = `${ic(icon)}<span>${esc(text)}</span>`; el.classList.add("is-on");
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("is-on"), 2400);
  }
  const sheet = $("#sheet"); let sheetReturn = null;
  function openSheet(html) {
    sheetReturn = document.activeElement;
    sheet.innerHTML = `<div class="sheet__panel" role="dialog" aria-modal="true"><div class="sheet__grip"></div>${html}</div>`;
    sheet.hidden = false;
    if ($("#nntuGroups", sheet)) fillGroups();
    const lf = sheet.querySelector('form[data-form="many"], form[data-form="sgLists"]'); if (lf) listPreview(lf);
    setTimeout(() => { const f = sheet.querySelector("input:not([type=radio]), select, textarea"); f && f.focus(); }, 50);
  }
  function closeSheet() { sheet.hidden = true; sheet.innerHTML = ""; sheetReturn && sheetReturn.focus && sheetReturn.focus(); }
  sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
  const sheetHead = (icon, c, title) => `<div class="sheet__head"><span class="badge" style="--c:${c}">${ic(icon)}</span><h2>${esc(title)}</h2><button type="button" class="icon-btn" style="margin-left:auto" data-act="closeSheet" aria-label="Закрыть">${ic("close")}</button></div>`;
  const field = (label, input) => `<div class="field"><label>${label}</label>${input}</div>`;
  const textarea = (name, value, rows = 3, ph = "") => `<textarea name="${name}" rows="${rows}" placeholder="${esc(ph)}" style="border-radius:14px;border:0;background:var(--field);padding:12px 14px;font-size:15px;resize:vertical">${esc(value)}</textarea>`;
  const formErr = `<p class="form-err" style="color:var(--bad-ink);font-size:13px;margin:-4px 0 10px" role="alert" hidden></p>`;
  const formBtns = (delAct, delId) => `${formErr}<div class="btn-row" style="margin-top:6px">${delAct ? `<button type="button" class="btn btn--danger" style="flex:0 0 48px;padding:0" data-act="${delAct}" data-id="${esc(delId)}" aria-label="Удалить">${ic("delete")}</button>` : ""}<button type="button" class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary">Сохранить</button></div>`;
  const select = (name, opts, val) => `<select name="${name}">${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select>`;
  const toggleRow = (act, attrs, name, on) => `<button type="button" class="card card--tap person mark" data-act="${act}" ${attrs} data-s="${on ? "+" : "-"}" style="min-height:56px">${avatar(name)}<div class="person__body"><div class="person__name">${esc(name)}</div></div><span class="mark__chip">${on ? ic("tick") : "—"}</span></button>`;
  const doneBtn = `<div style="position:sticky;bottom:0;padding-top:12px;background:var(--card)"><button class="btn btn--primary btn--block btn--lg" data-act="closeSheet">Готово</button></div>`;
  const baseSubjects = () => [...new Set(DB.lessons.map(l => baseSubject(l.subject)))].sort((a, b) => a.localeCompare(b, "ru"));
  const numOptions = () => bells().map((x, i) => [i + 1, `${i + 1} пара · ${x[0]}–${x[1]}`]);
  const KINDS = ["Лекция", "Практика", "Лабораторная", "Семинар", "Консультация", "Другое"];

  /* ---------- списки ФИО: вставка из чата/Excel и сопоставление с группой ---------- */
  const NAME_CELL = /^[А-ЯЁа-яёA-Za-z][А-ЯЁа-яёA-Za-z'’-]*(\s+[А-ЯЁа-яёA-Za-z][А-ЯЁа-яёA-Za-z.'’-]*){0,3}$/;
  const titleCase = s => s.toLowerCase().replace(/(^|[\s-])([а-яёa-z])/g, (m, a, b) => a + b.toUpperCase());
  // текст (строки, возможно с табуляцией из таблиц) → список ФИО без номеров, повторов и заголовков
  const HEAD_CELL = /^(фио|ф\.\s*и\.\s*о\.?|фамилия|имя|отчество|студент|студенты|обучающийся|обучающиеся)(?![а-яё])/i;
  function parseNames(text) {
    const out = [], seen = new Set();
    let cols = null; // столбцы с ФИО, если у таблицы есть заголовок
    String(text || "").split(/\r?\n/).forEach(line => {
      const raw = line.split(/\t|;|,/).map(c => c.trim());
      const head = raw.map((c, i) => HEAD_CELL.test(c) ? i : -1).filter(i => i >= 0);
      // один столбец «ФИО» — ждём в нём хотя бы два слова; «Фамилия | Имя | Отчество» — по слову
      if (head.length) { cols = head; cols.full = head.length === 1 && !/^(фамилия|имя|отчество)/i.test(raw[head[0]]); return; }
      const clean = list => list.map(c => c.replace(/^\s*(№\s*)?\d+\s*[.)]?\s*/, "").replace(/[,.;:]+$/, "").trim()).filter(Boolean);
      const all = clean(raw);
      // подписи вроде «1-я подгруппа:», «Староста:» — не люди
      if (!all.length || all.some(c => /^(список|группа|подгруппа|староста|-я\s)/i.test(c))) return;
      // ФИО в одной ячейке («Иванов Иван») или по столбцам («Иванов | Иван | Иванович»)
      const pick = cells => { const w = cells.filter(c => NAME_CELL.test(c)); return (w.find(c => /\s/.test(c)) || w.filter(c => !/\s/.test(c)).slice(0, 3).join(" ")).replace(/\s+/g, " ").trim(); };
      let name = cols && raw.length > 1 ? pick(clean(cols.map(i => raw[i] || ""))) : "";
      if (!name || (cols.full && !/\s/.test(name))) name = pick(all);
      if (!name || !/[а-яёa-z]{2}/i.test(name)) return;
      if (name === name.toUpperCase()) name = titleCase(name);
      const k = nameKey(name); if (seen.has(k)) return;
      seen.add(k); out.push(name);
    });
    return out;
  }
  const nameWords = n => nameKey(n).replace(/[^a-zа-я\s-]/g, " ").split(/\s+/).filter(Boolean);
  const sameWord = (a, b) => a === b || ((a.length === 1 || b.length === 1) && a[0] === b[0]); // «И.» подходит к «Иван»
  // ФИО из списка → студент группы: { s } — найден, { many } — несколько похожих, null — нет
  function matchName(name, pool = DB.students) {
    const w = nameWords(name); if (!w.length) return null;
    const fits = s => {
      const v = nameWords(s.name); if (!v.length) return false;
      const direct = v[0] === w[0] && (!w[1] || !v[1] || sameWord(v[1], w[1]));
      const swapped = w[1] && v[1] && v[0] === w[1] && v[1] === w[0]; // «Иван Иванов»
      return direct || swapped;
    };
    const c = pool.filter(fits);
    if (c.length === 1) return { s: c[0] };
    if (c.length > 1) { const exact = c.filter(s => nameKey(s.name) === nameKey(name)); return exact.length === 1 ? { s: exact[0] } : { many: c }; }
    return null;
  }
  const sgField = (n, val = "") => `<div class="field"><label class="sg-label"><span class="sg-dot" style="--c:${sgColor(n)}"></span>${n}-я подгруппа<span style="margin-left:auto">${fileBtn("g" + n)}</span></label>${textarea("g" + n, val, 5, "Фамилии или ФИО, по строке на человека")}</div>`;
  // списки подгрупп → номер подгруппы каждого студента; ошибки и предупреждения для предпросмотра
  function sgResolve(f) {
    const lists = $$("textarea[name^='g']", f).map(t => ({ n: +t.name.slice(1), names: parseNames(t.value) }));
    const map = new Map(), dup = new Set(), unknown = [], many = [], missing = [], addMissing = !!(f.addMissing && f.addMissing.checked);
    lists.forEach(({ n, names }) => names.forEach(name => {
      const m = matchName(name);
      if (m && m.s) { if (map.has(m.s.id) && map.get(m.s.id) !== n) dup.add(m.s.name); else map.set(m.s.id, n); }
      else if (m && m.many) many.push(name);
      else if (addMissing) { if (!missing.some(x => nameKey(x.name) === nameKey(name))) missing.push({ name, n }); }
      else unknown.push(name);
    }));
    const total = lists.reduce((a, l) => a + l.names.length, 0), none = students().filter(s => !map.has(s.id));
    const error = !total ? "Вставьте хотя бы один список"
      : dup.size ? `В двух подгруппах сразу: ${[...dup].join(", ")}`
      : many.length ? `Уточните имя — в группе несколько похожих: ${many.join(", ")}`
      : unknown.length ? `Нет в группе: ${unknown.join(", ")}. Проверьте написание или отметьте «Добавить в группу».` : "";
    return { lists, map, dup: [...dup], unknown, many, missing, none, total, error };
  }
  function listPreview(f) {
    const box = $("#listPreview", f); if (!box) return;
    const names5 = a => esc(a.slice(0, 5).join(", ")) + (a.length > 5 ? ` и ещё ${a.length - 5}` : "");
    if (f.dataset.form === "many") {
      const names = parseNames(f.list.value), fresh = names.filter(n => !matchName(n)), have = names.length - fresh.length;
      box.innerHTML = names.length ? `<span class="pill pill--ok num">новых: ${fresh.length}</span>${have ? `<span class="pill num" style="background:var(--field)">уже в группе: ${have}</span>` : ""}
        ${fresh.length ? `<p>${names5(fresh)}</p>` : ""}` : "";
      return;
    }
    const r = sgResolve(f);
    if (!r.total) { box.innerHTML = ""; return; }
    const cnt = n => [...r.map.values()].filter(x => x === n).length + r.missing.filter(x => x.n === n).length;
    box.innerHTML = `${r.lists.map(l => `<span class="pill num" style="background:color-mix(in srgb, ${sgColor(l.n)} 15%, var(--card));color:color-mix(in srgb, ${sgColor(l.n)} 60%, var(--text))">${l.n}-я: ${cnt(l.n)}</span>`).join("")}
      <span class="pill num${r.none.length ? " pill--warn" : ""}"${r.none.length ? "" : ' style="background:var(--field)"'}>без подгруппы: ${r.none.length}</span>
      ${r.none.length ? `<p>Без подгруппы останутся: ${names5(r.none.map(s => s.name))}</p>` : ""}
      ${r.missing.length ? `<p>Добавятся в группу: ${names5(r.missing.map(x => x.name))}</p>` : ""}
      ${r.unknown.length ? `<p class="bad">Нет в группе: ${names5(r.unknown)}</p>` : ""}
      ${r.many.length ? `<p class="warn">Несколько похожих — уточните имя: ${names5(r.many)}</p>` : ""}
      ${r.dup.length ? `<p class="bad">В двух подгруппах сразу: ${names5(r.dup)}</p>` : ""}`;
  }
  const fileBtn = target => `<button type="button" class="btn btn--neutral btn--sm" data-act="fileToList" data-t="${target}">${ic("excel")}Из Excel или файла</button>`;

  const FORMS = {
    quick: () => `${sheetHead("plus", "var(--primary)", "Что добавить?")}<div class="quick">
      ${[["task", "tasks", "Дело", "var(--bad)"], ["event", "party", "Событие", "var(--accent-5)"], ["schedAdd", "schedule", "Пару", "var(--accent-6)"], ["student", "add_one", "Студента", "var(--accent-2)"]].map(([k, i, n, c]) =>
        `<button class="card card--tap" data-act="form" data-f="${k}"><span class="badge" style="--c:${c}">${ic(i)}</span><b>${n}</b></button>`).join("")}</div>`,
    task: (id) => { const t = DB.tasks.find(x => x.id === id) || {}; return `${sheetHead("tasks", "var(--bad)", t.id ? "Дело" : "Новое дело")}<form data-form="task" data-id="${esc(t.id || "")}">
      ${field("Заголовок", `<input name="title" required value="${esc(t.title || "")}" placeholder="Например, сдать список в деканат">`)}
      <div class="grid grid--cols2" style="gap:0 12px">${field("Тип", select("kind", Object.keys(TASK_KINDS), t.kind || "Дедлайн"))}
      ${field("Срок (необязательно)", `<input name="due" type="date" value="${esc(t.due || "")}">`)}</div>
      ${field("Предмет (необязательно)", `<input name="subject" value="${esc(t.subject || "")}" list="subjList"><datalist id="subjList">${baseSubjects().map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
      ${field("Подробности", textarea("text", t.text || ""))}${formBtns(t.id && "delTask", t.id)}</form>`; },
    event: (id) => { const e = DB.events.find(x => x.id === id) || {}; return `${sheetHead("party", "var(--accent-5)", e.id ? "Событие" : "Новое событие")}<form data-form="event" data-id="${esc(e.id || "")}">
      ${field("Название", `<input name="title" required value="${esc(e.title || "")}" placeholder="Собрание группы">`)}
      <div class="grid grid--cols2" style="gap:0 12px">${field("Категория", select("kind", Object.keys(EVENT_KINDS), e.kind || "Учёба"))}
      ${field("Дата", `<input name="date" type="date" required value="${esc(e.date || key(TODAY))}">`)}
      ${field("Время", `<input name="time" type="time" value="${esc(e.time || "")}">`)}
      ${field("Место", `<input name="place" value="${esc(e.place || "")}" placeholder="6245, корп. 6">`)}</div>
      ${field("Описание", textarea("text", e.text || ""))}${formBtns(e.id && "delEvent", e.id)}</form>`; },
    lesson: (id) => { const l = DB.lessons.find(x => x.id === id), b = bells(), info = semInfo(S.schedDate || TODAY);
      return `${sheetHead("schedule", "var(--accent-6)", l ? "Пара" : "Новая пара")}<form data-form="lesson" data-id="${esc(l?.id || "")}">
      ${field("Предмет", `<input name="subject" required value="${esc(l?.subject || "")}" list="subjects" placeholder="Информатика (подгруппа 1)"><datalist id="subjects">${subjects().map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
      <p class="hint" style="text-align:left;margin:-6px 0 10px">Для пары подгруппы допишите «(подгруппа N)».</p>
      <div class="grid grid--cols2" style="gap:0 12px">
        ${field("Семестр", select("sem", [[1, "1 семестр"], [2, "2 семестр"]], l?.sem || info.num))}
        ${field("Тип занятия", select("kind", ["Лекция", "Практика", "Лабораторная", "Семинар", "Другое"], l?.kind || "Лекция"))}
        ${field("День недели", select("day", WD_PY.map((n, i) => [i, n]), l?.day ?? Math.min(pyDay(S.schedDate || TODAY), 5)))}
        ${field("Номер пары", select("num", b.map((x, i) => [i + 1, `${i + 1} пара · ${x[0]}–${x[1]}`]), l?.num || 1))}
        ${field("Неделя", select("week", [["all", "Каждую неделю"], ["odd", "Только нечётная"], ["even", "Только чётная"]], l?.week || "all"))}
        ${field("Аудитория", `<input name="room" value="${esc(l?.room || "")}" placeholder="6342, корп. 6">`)}
      </div>
      ${field("Преподаватель", `<input name="teacher" value="${esc(l?.teacher || "")}" list="teacherList" placeholder="Иванов И. И."><datalist id="teacherList">${DB.teachers.map(t => `<option value="${esc(t.name)}">`).join("")}</datalist>`)}
      ${l?.start ? `<p class="hint" style="text-align:left;margin:-4px 0 10px">У пары своё время ${esc(l.start)}–${esc(l.end)} — оно сохранится.</p>` : ""}
      ${formBtns(l && "delLesson", l?.id)}</form>`; },
    // разовая пара на конкретный день (в журнале — сразу к отметке)
    oneoff: (id, toMark) => { const o = DB.oneoff.find(x => x.id === id), d = o ? o.date : key(toMark ? (S.journalDate || TODAY) : (S.schedDate || TODAY));
      return `${sheetHead("calendar", "var(--accent-6)", o ? "Разовая пара" : "Пара не по расписанию")}<form data-form="oneoff" data-id="${esc(o?.id || "")}" data-mark="${toMark ? 1 : ""}">
      ${field("Предмет", `<input name="subject" required value="${esc(o?.subject || "")}" list="subjects" placeholder="Математика"><datalist id="subjects">${subjects().map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
      <div class="grid grid--cols2" style="gap:0 12px">
        ${field("Дата", `<input name="date" type="date" required value="${esc(d)}">`)}
        ${field("Пара", select("num", numOptions(), o?.num || 1))}
        ${field("Тип занятия", select("kind", KINDS, o?.kind || "Практика"))}
        ${field("Аудитория", `<input name="room" value="${esc(o?.room || "")}" placeholder="6342, корп. 6">`)}
      </div>
      ${field("Преподаватель", `<input name="teacher" value="${esc(o?.teacher || "")}" list="teacherList"><datalist id="teacherList">${DB.teachers.map(t => `<option value="${esc(t.name)}">`).join("")}</datalist>`)}
      <p class="hint" style="text-align:left;margin:-4px 0 12px">Только на этот день — постоянное расписание не меняется.</p>
      ${formErr}<div class="btn-row">${o ? `<button type="button" class="btn btn--danger" style="flex:0 0 48px;padding:0" data-act="delOneoff" data-id="${esc(o.id)}" aria-label="Удалить">${ic("delete")}</button>` : ""}<button type="button" class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary">${toMark ? "К отметке" : "Сохранить"}</button></div></form>`; },
    extra: () => FORMS.oneoff("", true),
    // что добавить в расписание: разово или насовсем
    schedAdd: () => `${sheetHead("schedule", "var(--accent-6)", "Добавить пару")}<div class="menu">
      <button class="menu__item" data-act="form" data-f="oneoff">${ic("calendar")}<span><b>Разовая пара</b><small>На конкретный день: доп. занятие, отработка, перенос</small></span></button>
      <button class="menu__item" data-act="form" data-f="lesson">${ic("schedule")}<span><b>Пара в расписание</b><small>Повторяется каждую неделю или через неделю</small></span></button></div>`,
    // действия с парой конкретного дня
    lessonMenu: () => { const { id, d } = S.menu, l = dayPlan(d).find(x => x.id === id); if (!l) return `${sheetHead("info", "var(--muted)", "Пара не найдена")}`;
      const [b, e] = lessonSpan(l), item = (act, icon, title, sub, attrs = "") => `<button class="menu__item${act === "cancelLesson" ? " menu__item--bad" : ""}" data-act="${act}" ${attrs}>${ic(icon)}<span><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span></button>`;
      const items = l.cancelled ? [
        item("restoreLesson", "back", "Вернуть пару", l.ov.moved_to ? "Перенос отменится, пара вернётся на своё место" : "Пара снова пройдёт в этот день"),
      ] : [
        item("goMark", "journal", "Отметить посещаемость", ""),
        item("form", "clock", "Перенести", "На другой день или другую пару", 'data-f="move"'),
        item("cancelLesson", "close", "Отменить в этот день", "В другие недели пара останется"),
        l.one ? item("form", "edit", "Изменить разовую пару", "", `data-f="oneoff" data-id="${esc(l.id)}"`) : item("form", "edit", "Изменить в расписании", "Для всех недель: аудитория, преподаватель, время", `data-f="lesson" data-id="${esc(l.id)}"`),
        l.one ? item("delOneoff", l.from ? "back" : "delete", l.from ? "Вернуть на прежнее место" : "Удалить разовую пару", "", `data-id="${esc(l.id)}"`) : "",
      ];
      return `${sheetHead("schedule", accent(baseSubject(l.subject)), baseSubject(l.subject))}
        <p class="muted" style="margin:-6px 0 12px;font-size:14px">${fmtShort(d)} · ${l.num || "?"} пара${b ? ` · ${b}–${e}` : ""}${subgroupOf(l.subject) ? ` · п/г ${subgroupOf(l.subject)}` : ""}</p>
        <div class="menu">${items.join("")}</div>`; },
    move: () => { const { id, d } = S.menu, l = dayPlan(d).find(x => x.id === id) || {};
      return `${sheetHead("clock", "var(--accent-6)", "Перенос пары")}<form data-form="move">
      <p class="muted" style="margin:-6px 0 12px;font-size:14px">${esc(baseSubject(l.subject))} · ${fmtShort(d)}, ${l.num || "?"} пара</p>
      <div class="grid grid--cols2" style="gap:0 12px">
        ${field("Новая дата", `<input name="date" type="date" required value="${key(d)}">`)}
        ${field("Пара", select("num", numOptions(), l.num || 1))}
      </div>
      ${field("Аудитория", `<input name="room" value="${esc(l.room || "")}">`)}
      <p class="hint" style="text-align:left;margin:-4px 0 12px">Например, преподаватель проводит пару не 5-й, а 1-й: оставьте дату и выберите 1 пару. Постоянное расписание не меняется.</p>
      ${formBtns()}</form>`; },
    // изменения на ближайшие дни по сайту НГТУ
    live: () => { const L = LIVE; if (!L) return "";
      const line = c => { const d = c.d, day = `${WDS[d.getDay()]} ${fmtDate(d)}`;
        if (c.type === "move") return [`${day} · ${baseSubject(c.l.subject)}`, `${c.l.num} пара → ${c.x.num} пара${c.x.room && c.x.room !== c.l.room ? `, ауд. ${c.x.room}` : ""}`, "warn"];
        if (c.type === "cancel") return [`${day} · ${baseSubject(c.l.subject)}, ${c.l.num} пара`, "отменена", "bad"];
        if (c.type === "add") return [`${day} · ${baseSubject(c.x.subject)}, ${c.x.num} пара`, `добавлена${c.x.room ? ` · ${c.x.room}` : ""}`, "ok"];
        if (c.type === "restore") return [`${day} · ${baseSubject(c.l.subject)}, ${c.l.num} пара`, "снова в расписании", "ok"];
        return [`${day} · ${baseSubject(c.l.subject)}, ${c.l.num} пара`, Object.entries(c.diff).map(([f, v]) => `${f === "room" ? "аудитория" : "преподаватель"}: ${c.l[f] || "—"} → ${v}`).join("; "), "warn"]; };
      const perm = L.plan && !L.plan.empty && (L.plan.add.length + L.plan.del.length + L.plan.upd.length);
      return `${sheetHead("download", "var(--primary)", "Изменения на сайте НГТУ")}
        <p class="muted" style="margin:-6px 0 12px;font-size:14px">Группа ${esc(DB.settings.nntu_group)} · ближайшие две недели</p>
        ${L.changes.length ? `<ul class="plan__list">${L.changes.map(c => { const [a, b, t] = line(c); return `<li><span class="dot dot--${t}"></span>${esc(a)}<small>${esc(b)}</small></li>`; }).join("")}</ul>
        <p class="hint" style="text-align:left;margin:10px 0 14px">Изменения применятся только к этим дням. То, что вы меняли вручную, не трогаем.</p>
        <div class="btn-row"><button class="btn btn--neutral" data-act="liveDismiss">Не сейчас</button><button class="btn btn--primary" data-act="liveApply">Применить</button></div>`
        : `<p style="margin-bottom:14px">На ближайшие дни расписание совпадает с сайтом.</p><button class="btn btn--primary btn--block" data-act="closeSheet">Готово</button>`}
        ${perm ? `<p class="hint" style="text-align:left;margin-top:14px">Похоже, на сайте поменялось и постоянное расписание (${perm} ${plural(perm, ["отличие", "отличия", "отличий"])}). <button class="link" data-act="form" data-f="nntu">Обновить постоянное расписание</button></p>` : ""}`; },
    student: (id) => { const s = DB.students.find(x => x.id === id), n = splitSize(null);
      return `${sheetHead("add_one", "var(--accent-2)", s ? "Студент" : "Новый студент")}<form data-form="student" data-id="${esc(s?.id || "")}">
      ${field("Фамилия и имя", `<input name="name" required value="${esc(s?.name || "")}" placeholder="Иванов Иван">`)}
      <div class="grid grid--cols2" style="gap:0 12px">
        ${field("Роль в группе", select("role", [["", "Студент"], ["head", "Староста"], ["deputy", "Зам. старосты"]], s?.role || ""))}
        ${field("Подгруппа", select("subgroup", [[0, "Не указана"], ...Array.from({ length: Math.max(n, 3) }, (_, i) => [i + 1, `${i + 1}-я подгруппа`])], s?.subgroup || 0))}
        ${field("Телефон", `<input name="phone" type="tel" value="${esc(s?.phone || "")}" placeholder="+7 900 000-00-00">`)}
        ${field("День рождения", `<input name="birthday" value="${esc(s?.birthday || "")}" placeholder="05.11 или 05.11.2007">`)}
      </div>${field("Заметка", textarea("note", s?.note || ""))}${formBtns(s && "delStudent", s?.id)}</form>`; },
    addMany: () => `${sheetHead("add_many", "var(--accent-2)", "Добавить списком")}<form data-form="many">
      ${field("Список группы — по человеку на строку", textarea("list", "", 9, "Иванов Иван\nПетрова Анна Сергеевна\n…"))}
      <div class="btn-row" style="margin:-4px 0 10px">${fileBtn("list")}</div>
      <p class="hint" style="text-align:left;margin-bottom:6px">Можно вставить из чата, Word или Excel: номера, лишние столбцы и повторы уберутся сами. Кто уже есть в группе — пропустим, никого не удаляем.</p>
      <div class="list-preview" id="listPreview" aria-live="polite"></div>
      ${formErr}<div class="btn-row"><button type="button" class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary">Добавить</button></div></form>`,
    // подгруппы отдельными списками: основное деление или своё для предмета
    sgLists: (base = S.sgTab || "", extraN = 0) => { const counts = subgroupCounts(), opts = [["", "Основное деление (все предметы)"], ...Object.keys(counts).sort((a, b) => a.localeCompare(b, "ru")).map(x => [x, `${x} · ${counts[x]} ${plural(counts[x], ["подгруппа", "подгруппы", "подгрупп"])}`])];
      const N = Math.max(splitSize(base || null), 2) + extraN, own = ownSplit();
      const cur = n => students().filter(s => studentSubgroup(s, base || null, own) === n).map(s => s.name).join("\n");
      return `${sheetHead("subgroups", "var(--primary)", "Подгруппы списками")}<form data-form="sgLists" data-n="${N}">
      ${field("Для чего деление", select("base", opts, base))}
      ${base && !own.includes(base) ? `<p class="hint" style="text-align:left;margin:-4px 0 10px">У предмета появится своё деление, остальные предметы — по основному.</p>` : ""}
      ${Array.from({ length: N }, (_, i) => sgField(i + 1, cur(i + 1))).join("")}
      <button type="button" class="link" style="margin:-6px 0 8px" data-act="sgMore">${ic("plus")} Ещё подгруппа</button>
      <p class="hint" style="text-align:left;margin-bottom:6px">Хватит фамилии, если она в группе одна. Кого нет ни в одном списке — останется без подгруппы.</p>
      <div class="list-preview" id="listPreview" aria-live="polite"></div>
      <label class="check-row"><input type="checkbox" name="addMissing"> Добавить в группу тех, кого в ней ещё нет</label>
      ${formErr}<div class="btn-row"><button type="button" class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary">Сохранить подгруппы</button></div></form>`; },
    teacher: (id) => { const t = DB.teachers.find(x => x.id === id);
      return `${sheetHead("teacher", "var(--accent-6)", t ? "Преподаватель" : "Новый преподаватель")}<form data-form="teacher" data-id="${esc(t?.id || "")}">
      ${field("ФИО", `<input name="name" required value="${esc(t?.name || "")}" placeholder="Иванова М. П.">`)}
      ${field("Предметы (через запятую, необязательно)", `<input name="subjects" value="${esc(t?.subjects || "")}">`)}
      <div class="grid grid--cols2" style="gap:0 12px">${field("Почта", `<input name="email" type="email" value="${esc(t?.email || "")}">`)}${field("Telegram", `<input name="telegram" value="${esc(tgLabel(t?.telegram || ""))}" placeholder="@username">`)}
      ${field("Телефон", `<input name="phone" type="tel" value="${esc(t?.phone || "")}">`)}</div>
      ${field("Заметка", textarea("note", t?.note || ""))}${formBtns(t && "delTeacher", t?.id)}</form>`; },
    deputies: () => `${sheetHead("crown", "#8B5CF6", "Замы старосты")}<p class="muted" style="margin:-6px 0 12px;font-size:14px">Нажмите, чтобы назначить или снять.</p>
      <div class="stack" style="gap:6px">${students().filter(s => s.role !== "head").map(s => toggleRow("deputyToggle", `data-id="${esc(s.id)}"`, s.name, s.role === "deputy")).join("")}</div>${doneBtn}`,
    going: (id) => { const e = DB.events.find(x => x.id === id), g = new Set(e.going || []);
      return `${sheetHead("going", "var(--primary)", "Кто идёт")}<p class="muted" style="margin:-6px 0 12px;font-size:14px">${esc(e.title)}</p>
      <div class="stack" style="gap:6px">${students().map(s => toggleRow("goingToggle", `data-e="${esc(e.id)}" data-id="${esc(s.id)}"`, s.name, g.has(s.id))).join("")}</div>${doneBtn}`; },
    ownSplit: () => { const c = subgroupCounts(), own = ownSplit();
      return `${sheetHead("subgroups", "var(--primary)", "Своё деление для предмета")}<form data-form="ownSplit">
      ${field("Предмет", select("base", Object.keys(c).filter(x => !own.includes(x)).sort((a, b) => a.localeCompare(b, "ru")).map(x => [x, `${x} · ${c[x]} ${plural(c[x], ["подгруппа", "подгруппы", "подгрупп"])}`]), ""))}
      <p class="hint" style="text-align:left;margin:-4px 0 12px">У предмета будет своё распределение студентов, отдельно от основного.</p>${formBtns()}</form>`; },
    groupName: () => `${sheetHead("school", "var(--primary)", "Группа")}<form data-form="groupName">${field("Название группы", `<input name="group" value="${esc(DB.settings.group || "")}" placeholder="ИВТ 2-1">`)}${formBtns()}</form>`,
    confirm: (text, act, id, btn = "Удалить") => `${sheetHead("delete", "var(--bad)", text)}<p style="margin-bottom:16px">Это нельзя отменить.</p>
      <div class="btn-row"><button class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--danger" data-act="${act}" data-id="${esc(id || "")}" data-confirmed="1">${ic("delete")}${btn}</button></div>`,
    nntu: () => `${sheetHead("download", "var(--primary)", "Расписание НГТУ")}<form data-form="nntu">
      ${field("Номер группы", `<input name="group" required list="nntuGroups" autocomplete="off" autocapitalize="characters" value="${esc(DB.settings.nntu_group || "")}" placeholder="26-ИВТ-2-1"><datalist id="nntuGroups"></datalist>`)}
      <p class="hint" style="text-align:left;margin:-4px 0 12px">Сначала покажем, что изменится, — ничего не заменится без вашего согласия. Отметки в журнале сохранятся.</p>
      ${formErr}<div class="btn-row"><button type="button" class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary">${ic("download")}Загрузить</button></div></form>`,
    nntuPlan: () => {
      const p = PLAN, sems = p.sems.map(n => `${n} семестр`).join(", ");
      const list = (title, items, line, cls) => items.length ? `<h3 class="plan__title">${title} <span class="pill ${cls} num">${items.length}</span></h3>
        <ul class="plan__list">${items.slice(0, 8).map(x => `<li>${line(x)}</li>`).join("")}${items.length > 8 ? `<li class="muted">и ещё ${items.length - 8}</li>` : ""}</ul>` : "";
      const FN = { week: "неделя", kind: "тип", room: "аудитория", teacher: "преподаватель", start: "начало", end: "конец" };
      const val = (f, v) => f === "week" ? ({ all: "каждую", odd: "нечётная", even: "чётная" }[v || "all"]) : (v || "—");
      if (p.empty) return `${sheetHead("tick", "var(--primary)", "Расписание НГТУ")}<p style="margin-bottom:16px">Группа ${esc(p.group)}, ${sems}: расписание совпадает с сайтом НГТУ — менять нечего.</p>
        <button class="btn btn--primary btn--block btn--lg" data-act="nntuApply">Готово</button>`;
      return `${sheetHead("download", "var(--primary)", "Что изменится")}
        <p class="muted" style="margin:-6px 0 12px;font-size:14px">Группа ${esc(p.group)} · ${sems}${p.same ? ` · без изменений: ${p.same}` : ""}</p>
        ${list("Добавятся", p.add, l => `${esc(lessonLine(l))}<small>${esc([l.kind, weekTag(l.week), l.room].filter(Boolean).join(" · "))}</small>`, "pill--ok")}
        ${list("Изменятся", p.upd, x => `${esc(lessonLine(x.o))}<small>${x.ch.map(f => `${FN[f]}: ${esc(val(f, x.o[f]))} → ${esc(val(f, x.n[f]))}`).join("; ")}</small>`, "pill--warn")}
        ${list("Уберутся", p.del, l => `${esc(lessonLine(l))}<small>${esc([l.kind, weekTag(l.week)].filter(Boolean).join(" · "))}</small>`, "pill--bad")}
        ${p.bells ? `<h3 class="plan__title">Звонки</h3><p class="muted" style="font-size:13px;margin-bottom:12px">${p.bells.map(b => b.replace("-", "–")).join(", ")}</p>` : ""}
        <p class="hint" style="text-align:left;margin:4px 0 14px">Отметки в журнале сохранятся. Сайт показывает только две ближайшие недели: разовый перенос пары попадёт в расписание как постоянный — его можно поправить вручную.</p>
        <div class="btn-row"><button class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary" data-act="nntuApply">Применить</button></div>`;
    },
    semesters: () => { const s = semesterDates();
      const sem = i => `<fieldset class="fieldset"><legend>${i + 1} семестр</legend><div class="grid grid--cols2" style="gap:0 12px">
        ${field("Начало", `<input name="start${i}" type="date" required value="${key(s[i][0])}">`)}${field("Конец", `<input name="end${i}" type="date" required value="${key(s[i][1])}">`)}</div>
        <label class="check-row"><input type="checkbox" name="odd${i}"${s[i][2] ? " checked" : ""}> Первая неделя — нечётная</label></fieldset>`;
      return `${sheetHead("calendar", "var(--primary)", "Семестры")}<form data-form="semesters">${sem(0)}${sem(1)}
        <p class="hint" style="text-align:left;margin:0 0 12px">От начала семестра считаются номера недель и чётность. Каждый год даты сдвигаются сами.</p>${formBtns()}</form>`; },
    bells: () => { const b = bells(), n = Math.min(Math.max(b.length + 1, 6), 8);
      return `${sheetHead("clock", "var(--primary)", "Звонки")}<form data-form="bells"><div class="bells-form">${Array.from({ length: n }, (_, i) =>
        `<b class="num">${i + 1}</b><input name="s${i}" type="time" value="${esc(b[i]?.[0] || "")}" aria-label="${i + 1} пара, начало"><span>—</span><input name="e${i}" type="time" value="${esc(b[i]?.[1] || "")}" aria-label="${i + 1} пара, конец">`).join("")}</div>
        <p class="hint" style="text-align:left;margin:4px 0 12px">Пустые строки не сохраняются. При загрузке расписания НГТУ звонки обновятся сами.</p>${formBtns()}</form>`; },
  };

  document.addEventListener("submit", e => {
    const f = e.target.closest("[data-form]"); if (!f) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f)), id = f.dataset.id;
    const err = msg => { const p = f.querySelector(".form-err"); if (p) { p.textContent = msg; p.hidden = false; } };
    const trim = s => (s || "").trim();
    let msg = "Сохранено", go = null;
    switch (f.dataset.form) {
      case "welcome":
        return loadNntu(f, v.group, res => {
          DB = normalize({ settings: { group: res.group } });
          const plan = nntuPlan(res); nntuApply(plan);
          toast(`Загружено пар: ${plan.add.length}. Теперь добавьте студентов`);
          location.hash = "#group"; render();
        });
      case "nntu":
        return loadNntu(f, v.group, res => { PLAN = nntuPlan(res); openSheet(FORMS.nntuPlan()); });
      case "semesters": {
        const sems = [0, 1].map(i => ({ start: v["start" + i], end: v["end" + i], first_week_odd: !!v["odd" + i] }));
        const d = sems.map(s => [parseISO(s.start), parseISO(s.end)]);
        if (d.some(([a, z]) => !a || !z)) return err("Укажите даты начала и конца обоих семестров");
        if (d.some(([a, z]) => a >= z)) return err("Конец семестра должен быть позже начала");
        if (d[1][0] <= d[0][1]) return err("2 семестр должен начинаться после конца 1-го");
        DB.settings.semesters = sems; break;
      }
      case "bells": {
        const out = [];
        for (let i = 0; i < 8; i++) {
          const s = v["s" + i], e = v["e" + i];
          if (!s && !e) continue;
          if (!s || !e) return err(`${i + 1} пара: укажите и начало, и конец`);
          if (toMin(e) <= toMin(s)) return err(`${i + 1} пара: конец должен быть позже начала`);
          if (out.length && toMin(s) < toMin(out[out.length - 1].split("-")[1])) return err(`${i + 1} пара начинается раньше, чем кончается предыдущая`);
          out.push(`${s}-${e}`);
        }
        if (!out.length) return err("Укажите хотя бы одну пару");
        DB.settings.bells = out; break;
      }
      case "task": {
        if (!trim(v.title)) return err("Укажите заголовок");
        const t = DB.tasks.find(x => x.id === id) || { id: newId(), done: false, created: Math.floor(Date.now() / 1000) };
        Object.assign(t, { kind: v.kind, title: trim(v.title), subject: trim(v.subject), due: v.due || "", text: trim(v.text) });
        if (!id) { DB.tasks.push(t); msg = "Дело добавлено"; } break;
      }
      case "event": {
        if (!trim(v.title)) return err("Укажите название");
        if (!parseISO(v.date)) return err("Выберите дату");
        const ev = DB.events.find(x => x.id === id) || { id: newId(), going: [] };
        Object.assign(ev, { title: trim(v.title), kind: v.kind, date: v.date, time: v.time || "", place: trim(v.place), text: trim(v.text) });
        if (!id) { DB.events.push(ev); msg = "Событие добавлено"; S.showPast = parseISO(v.date) < TODAY; } break;
      }
      case "lesson": {
        if (!trim(v.subject)) return err("Укажите предмет");
        const l = DB.lessons.find(x => x.id === id) || { id: newId() };
        Object.assign(l, { subject: trim(v.subject).replace(/\s+/g, " "), day: +v.day, num: +v.num, week: v.week, kind: v.kind, room: trim(v.room), teacher: trim(v.teacher), sem: +v.sem });
        if (!id) { DB.lessons.push(l); msg = "Пара добавлена"; }
        ensureTeacher(l.teacher); break;
      }
      case "oneoff": {
        if (!trim(v.subject)) return err("Укажите предмет");
        if (!parseISO(v.date)) return err("Выберите дату");
        const o = DB.oneoff.find(x => x.id === id) || { id: "o" + newId(), src: "manual" };
        if (o.date && (o.date !== v.date || o.num !== +v.num)) { delete o.start; delete o.end; }
        Object.assign(o, { date: v.date, subject: trim(v.subject).replace(/\s+/g, " "), num: +v.num, kind: v.kind, room: trim(v.room), teacher: trim(v.teacher) });
        if (!id) { DB.oneoff.push(o); msg = "Пара добавлена на " + fmtDate(parseISO(v.date)); }
        ensureTeacher(o.teacher);
        if (f.dataset.mark) { go = `#mark/${o.id}/${o.date}`; msg = ""; }
        else { S.schedDate = parseISO(v.date); }
        break;
      }
      case "move": {
        const { id: lid, d } = S.menu, l = dayPlan(d).find(x => x.id === lid), nd = parseISO(v.date);
        if (!l) return err("Пара не найдена");
        if (!nd) return err("Выберите дату");
        if (same(nd, d) && +v.num === l.num && trim(v.room) === (l.room || "")) return err("Выберите другую дату, пару или аудиторию");
        if (l.one) {
          const o = DB.oneoff.find(x => x.id === l.id);
          if (o.date !== v.date || o.num !== +v.num) { delete o.start; delete o.end; }
          Object.assign(o, { date: v.date, num: +v.num, room: trim(v.room), src: "manual" });
        } else if (same(nd, d) && +v.num === l.num) {
          // та же пара, другая аудитория — замена на этот день
          DB.overrides[attKey(d, l.id)] = { ...(DB.overrides[attKey(d, l.id)] || {}), room: trim(v.room), src: "manual" };
        } else {
          const oid = "o" + newId(), t = l.tpl || l;
          DB.oneoff.push({ id: oid, date: v.date, subject: t.subject, num: +v.num, kind: t.kind, room: trim(v.room), teacher: l.teacher || "", from: attKey(d, l.id), src: "manual" });
          DB.overrides[attKey(d, l.id)] = { cancel: true, moved_to: oid, src: "manual" };
        }
        msg = same(nd, d) ? `Перенесено на ${v.num} пару` : `Перенесено на ${fmtShort(nd)}, ${v.num} пару`;
        S.schedDate = nd; break;
      }
      case "student": {
        if (!trim(v.name)) return err("Укажите фамилию и имя");
        if (trim(v.birthday) && !parseBday(v.birthday)) return err("День рождения — в формате ДД.ММ или ДД.ММ.ГГГГ");
        const s = DB.students.find(x => x.id === id) || { id: newId(), name: "", phone: "", birthday: "", note: "", role: "" };
        if (v.role === "head") DB.students.forEach(o => { if (o !== s && o.role === "head") o.role = ""; }); // староста в группе один
        Object.assign(s, { name: trim(v.name).replace(/\s+/g, " "), role: v.role, subgroup: +v.subgroup, phone: trim(v.phone), birthday: trim(v.birthday), note: trim(v.note) });
        if (!id) { DB.students.push(s); msg = "Студент добавлен"; } break;
      }
      case "many": {
        const names = parseNames(v.list);
        if (!names.length) return err("Вставьте список: по одному человеку на строку");
        const fresh = names.filter(n => !matchName(n));
        if (!fresh.length) return err("Все из списка уже есть в группе");
        fresh.forEach(n => DB.students.push({ id: newId(), name: n, phone: "", birthday: "", note: "", role: "" }));
        const skip = names.length - fresh.length;
        msg = `Добавлено: ${fresh.length}${skip ? ` · уже были: ${skip}` : ""}`; break;
      }
      case "sgLists": {
        const r = sgResolve(f);
        if (r.error) return err(r.error);
        const base = v.base || null;
        if (base && !ownSplit().includes(base)) DB.settings.own_split = [...new Set([...(DB.settings.own_split || []), base])];
        r.missing.forEach(({ name, n }) => { const s = { id: newId(), name, phone: "", birthday: "", note: "", role: "" }; DB.students.push(s); r.map.set(s.id, n); });
        DB.students.forEach(s => setStudentSubgroup(s, r.map.get(s.id) || 0, base));
        S.sgTab = base || "";
        msg = `Подгруппы сохранены${r.missing.length ? ` · добавлено в группу: ${r.missing.length}` : ""}`;
        go = `#subgroups/${encodeURIComponent(base || "")}`; break;
      }
      case "teacher": {
        if (!trim(v.name)) return err("Укажите ФИО");
        const [tg, tgErr] = normTelegram(v.telegram); if (tgErr) return err(tgErr);
        const t = DB.teachers.find(x => x.id === id) || { id: newId() };
        Object.assign(t, { name: trim(v.name).replace(/\s+/g, " "), subjects: trim(v.subjects), email: trim(v.email), telegram: tg, phone: trim(v.phone), note: trim(v.note) });
        if (!id) { DB.teachers.push(t); msg = "Преподаватель добавлен"; } break;
      }
      case "ownSplit": {
        if (!v.base) return err("Выберите предмет");
        DB.settings.own_split = [...new Set([...(DB.settings.own_split || []), v.base])]; S.sgTab = v.base; break;
      }
      case "groupName": DB.settings.group = trim(v.group); break;
    }
    if (f.dataset.form !== "extra") persist();
    closeSheet(); if (msg) toast(msg);
    if (go) location.hash = go; else render(true);
  });

  /* ---------- действия ---------- */
  const confirmed = el => el.dataset.confirmed === "1";
  const ACT = {
    closeSheet: closeSheet,
    form: el => openSheet(FORMS[el.dataset.f](el.dataset.id)),
    pickDate: () => {
      const inp = document.createElement("input"); inp.type = "date"; inp.value = key(S.journalDate || TODAY);
      inp.style.cssText = "position:fixed;opacity:0;pointer-events:none;top:0;left:0"; document.body.append(inp);
      inp.addEventListener("change", () => { const d = parseISO(inp.value); if (d) { S.journalDate = d; S.schedDate = d; render(true); } inp.remove(); });
      inp.addEventListener("blur", () => setTimeout(() => inp.remove(), 300));
      if (inp.showPicker) { try { inp.showPicker(); } catch (e) { inp.click(); } } else inp.click();
    },
    schedDay: el => { S.schedDate = parseISO(el.dataset.d); render(true); },
    schedWeek: el => { S.schedDate = addDays(S.schedDate || TODAY, Number(el.dataset.n)); render(true); },
    schedToday: () => { S.schedDate = TODAY; render(true); },
    schedTomorrow: () => { S.schedDate = addDays(TODAY, 1); },
    schedSem: el => {
      const n = Number(el.dataset.n), ti = semInfo(TODAY);
      S.schedDate = ti.num === n && ti.active ? TODAY : semesterDates(academicYear(TODAY))[n - 1][0];
      render(true);
    },
    sgPick: (el, e) => { e.stopPropagation(); S.sgPick[el.dataset.k] = Number(el.dataset.i); render(true); return true; },
    journalShift: el => { S.journalDate = addDays(S.journalDate || TODAY, Number(el.dataset.n)); render(true); },
    journalDay: el => { S.journalDate = parseISO(el.dataset.d); render(true); },
    journalToday: () => { S.journalDate = TODAY; render(true); },
    mark: el => {
      const sid = el.dataset.id, v = MARK_NEXT[MK.rec.marks[sid]];
      MK.rec.marks[sid] = v; storeRec();
      const s = MK.list.find(x => x.id === sid);
      el.outerHTML = markRow(s, v);
      const nu = $(`[data-act="mark"][data-id="${CSS.escape(sid)}"]`); nu.querySelector(".mark__chip").classList.add("pop"); nu.focus({ preventScroll: true });
      refreshMarkSummary();
    },
    allHere: () => { MK.list.forEach(s => { MK.rec.marks[s.id] = "+"; }); storeRec(); render(true); toast("Все отмечены как присутствующие"); },
    resetMarks: el => {
      if (!confirmed(el)) return openSheet(FORMS.confirm("Удалить все отметки этого занятия?", "resetMarks", "", "Удалить отметки"));
      delete DB.attendance[MK.k]; persist(); MK = null; closeSheet(); render(true); toast("Отметки удалены", "broom");
    },
    copyAbsent: () => {
      const t = markTally(), head = `${MK.l.subject}, ${dmy(MK.d)}`;
      let text;
      if (!t.absent.length && !t.excused.length) text = `${head}: присутствуют все.`;
      else { text = head; if (t.absent.length) text += "\nОтсутствуют: " + t.absent.map(s => s.name).join(", "); if (t.excused.length) text += "\nПо уважительной причине: " + t.excused.map(s => s.name).join(", "); }
      copy(text, "Список скопирован");
    },
    copyText: el => copy(el.dataset.t, "Скопировано"),
    sgTab: el => { S.sgTab = el.dataset.t; render(true); },
    sgUnown: el => { DB.settings.own_split = (DB.settings.own_split || []).filter(x => x !== el.dataset.t); S.sgTab = ""; persist(); render(true); },
    sgCycle: (el, e) => {
      e.stopPropagation();
      const b = S.sgTab || null, N = splitSize(b), s = DB.students.find(x => x.id === el.dataset.id), n = studentSubgroup(s, b);
      setStudentSubgroup(s, n < N ? n + 1 : 0, b); persist(); render(true);
      const nu = $$(`[data-act="sgCycle"][data-id="${CSS.escape(s.id)}"]`).find(x => x.offsetParent); nu && (nu.classList.add("pop"), nu.focus({ preventScroll: true }));
      return true;
    },
    sgEven: () => {
      const b = S.sgTab || null, N = splitSize(b), list = students(), per = Math.ceil(list.length / N);
      list.forEach((s, i) => setStudentSubgroup(s, Math.floor(i / per) + 1, b)); persist(); render(true); toast("Разделено поровну по списку");
    },
    period: el => { S[el.dataset.f] = el.dataset.v; S.statsSubject = ""; render(true); },
    statsSubj: el => { S.statsSubject = el.dataset.s; render(true); },
    fromStats: () => { S.from = "stats"; return false; },
    excel: () => exportExcel(),
    // ----- пара конкретного дня: меню, отмена, возврат, разовые
    lessonMenu: el => { S.menu = { id: el.dataset.id, d: parseISO(el.dataset.d) }; openSheet(FORMS.lessonMenu()); },
    goMark: () => { closeSheet(); location.hash = `#mark/${S.menu.id}/${key(S.menu.d)}`; },
    cancelLesson: () => {
      const { id, d } = S.menu, l = dayPlan(d).find(x => x.id === id); if (!l) return;
      if (l.one) {
        DB.oneoff = DB.oneoff.filter(x => x.id !== l.id);
        if (l.from) DB.overrides[l.from] = { cancel: true, src: "manual" }; // перенесённую отменили совсем
      } else DB.overrides[attKey(d, l.id)] = { cancel: true, src: "manual" };
      persist(); closeSheet(); render(true); toast(`Пара отменена на ${fmtShort(d)}`, "close");
    },
    restoreLesson: () => {
      const { id, d } = S.menu, k = attKey(d, id), o = DB.overrides[k]; if (!o) return closeSheet();
      if (o.moved_to) DB.oneoff = DB.oneoff.filter(x => x.id !== o.moved_to);
      // вернули вручную — автопроверка больше не будет отменять её в этот день
      if (o.src === "nntu") DB.overrides[k] = { src: "manual" }; else delete DB.overrides[k];
      persist(); closeSheet(); render(true); toast("Пара возвращена", "back");
    },
    delOneoff: el => {
      const o = DB.oneoff.find(x => x.id === el.dataset.id); if (!o) return closeSheet();
      if (!confirmed(el)) return openSheet(FORMS.confirm(o.from ? "Отменить перенос и вернуть пару на прежнее место?" : "Удалить разовую пару?", "delOneoff", o.id, o.from ? "Вернуть" : "Удалить"));
      DB.oneoff = DB.oneoff.filter(x => x !== o);
      if (o.from && DB.overrides[o.from] && DB.overrides[o.from].moved_to === o.id) delete DB.overrides[o.from];
      persist(); closeSheet(); render(true); toast(o.from ? "Пара вернулась на своё место" : "Разовая пара удалена", "delete");
    },
    // ----- автопроверка
    liveApply: () => { if (LIVE) { liveApply(LIVE.changes); DB.settings.nntu_seen = ""; LIVE = { ...LIVE, changes: [], sig: "" }; persist(); } closeSheet(); render(true); toast("Изменения с сайта НГТУ применены"); },
    liveDismiss: () => { if (LIVE) { DB.settings.nntu_seen = LIVE.sig; persist(); } closeSheet(); render(true); },
    checkNow: async el => {
      el.disabled = true; el.textContent = "Проверяем…";
      const ok = await autoCheck(true);
      if (ok) openSheet(FORMS.live()); else render(true);
    },
    // ----- списки
    fileToList: el => {
      const f = el.closest("form"), name = el.dataset.t, inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".xlsx,.csv,.txt";
      inp.addEventListener("change", async () => {
        const file = inp.files[0]; if (!file) return;
        if (/\.xls$/i.test(file.name)) return toast("Старый формат .xls не читается — сохраните файл как .xlsx", "info");
        let text;
        try { text = /\.xlsx$/i.test(file.name) ? (await XLSX.readRows(file)).map(r => r.join("\t")).join("\n") : await file.text(); }
        catch (e) { return toast("Не удалось прочитать файл. Подойдут .xlsx, .csv и .txt", "info"); }
        const names = parseNames(text);
        if (!names.length) return toast("В файле не нашлось ФИО", "info");
        const ta = f.querySelector(`[name="${name}"]`); ta.value = names.join("\n"); listPreview(f);
        toast(`Из файла: ${names.length} ${plural(names.length, ["человек", "человека", "человек"])}`, "excel");
      });
      inp.click();
    },
    sgMore: el => {
      const f = el.closest("form"), n = $$("textarea[name^='g']", f).length + 1;
      if (n > 9) return toast("Больше 9 подгрупп не бывает", "info");
      el.insertAdjacentHTML("beforebegin", sgField(n)); f.querySelector(`[name="g${n}"]`).focus();
    },
    taskTab: el => { S.taskTab = el.dataset.t; render(true); },
    taskKind: el => { S.taskKind = el.dataset.k; render(true); },
    taskDone: el => { const t = DB.tasks.find(x => x.id === el.dataset.id); t.done = !t.done; persist(); render(true); toast(t.done ? "Готово" : "Возвращено в работу"); },
    clearDone: el => {
      if (!confirmed(el)) return openSheet(FORMS.confirm("Удалить все выполненные дела?", "clearDone"));
      const n = DB.tasks.filter(t => t.done).length; DB.tasks = DB.tasks.filter(t => !t.done); persist(); closeSheet(); render(true); toast(`Удалено: ${n}`, "delete");
    },
    delTask: el => del(el, "tasks", "Удалить дело?"),
    delEvent: el => del(el, "events", "Удалить событие?"),
    delLesson: el => del(el, "lessons", "Удалить пару из расписания?"),
    delTeacher: el => del(el, "teachers", "Удалить преподавателя?"),
    delStudent: el => del(el, "students", "Удалить студента? Его отметки останутся в журнале."),
    showPast: el => { S.showPast = el.dataset.v === "1"; render(true); },
    going: el => openSheet(FORMS.going(el.dataset.id)),
    goingToggle: el => {
      const e = DB.events.find(x => x.id === el.dataset.e), g = new Set(e.going || []), sid = el.dataset.id;
      g.has(sid) ? g.delete(sid) : g.add(sid); e.going = [...g]; persist();
      const on = g.has(sid); el.dataset.s = on ? "+" : "-"; el.querySelector(".mark__chip").innerHTML = on ? ic("tick") : "—"; render(true);
    },
    deputyToggle: el => {
      const s = DB.students.find(x => x.id === el.dataset.id); s.role = s.role === "deputy" ? "" : "deputy"; persist();
      const on = s.role === "deputy"; el.dataset.s = on ? "+" : "-"; el.querySelector(".mark__chip").innerHTML = on ? ic("tick") : "—"; render(true);
    },
    theme: el => { setTheme(el.dataset.t); render(true); },
    themeQuick: () => { setTheme(isDark() ? "mint" : "dark"); render(true); },
    install: () => { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast("Откройте меню браузера → «Установить приложение» или «Добавить на главный экран»", "info"); },
    exportJson: () => {
      const g = (DB.settings.nntu_group || DB.settings.group || "").replace(/[^\wа-яё-]+/gi, "_");
      download(new Blob([JSON.stringify(DB, null, 1)], { type: "application/json" }), `староста${g ? "_" + g : ""}_${key(TODAY)}.json`);
      store.set("lastBackup", Date.now()); toast("Копия скачана", "download"); render(true);
    },
    importJson: el => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
      inp.addEventListener("change", async () => {
        let d;
        try { d = JSON.parse(await inp.files[0].text()); if (!d || !Array.isArray(d.students) || !d.settings) throw new Error("shape"); }
        catch (e) { toast("Это не похоже на файл с данными приложения", "info"); return; }
        // данные уже есть — сначала спросить
        if (DB && (DB.students.length || Object.keys(DB.attendance).length)) { PENDING = d; openSheet(FORMS.confirm("Заменить данные этого браузера файлом?", "importApply", "", "Заменить")); return; }
        PENDING = d; ACT.importApply();
      });
      inp.click();
    },
    importApply: () => {
      if (!PENDING) return;
      setDB(PENDING); PENDING = null; store.set("lastBackup", Date.now());
      closeSheet(); toast(`Данные загружены: студентов ${DB.students.length}, пар ${DB.lessons.length}`); render();
    },
    startEmpty: () => { setDB({}); render(); toast("Начнём: добавьте студентов и пары"); },
    nntuApply: () => {
      if (PLAN && !PLAN.empty) { nntuApply(PLAN); toast("Расписание обновлено"); }
      else if (PLAN) { DB.settings.nntu_group = PLAN.group; DB.settings.nntu_synced = key(TODAY); persist(); }
      PLAN = null; closeSheet(); render(true);
    },
    wipe: el => {
      if (!confirmed(el)) return openSheet(FORMS.confirm("Удалить все данные группы из этого браузера?", "wipe", "", "Удалить всё"));
      try { localStorage.removeItem(DATA_KEY); store.set("lastBackup", 0); } catch (e) { /* ничего */ }
      DB = null; MK = null; closeSheet(); location.hash = ""; render(); toast("Данные удалены", "delete");
    },
  };
  let PENDING = null;
  function download(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  function del(el, coll, text) {
    if (!confirmed(el)) return openSheet(FORMS.confirm(text, el.dataset.act, el.dataset.id));
    DB[coll] = DB[coll].filter(x => x.id !== el.dataset.id); persist(); closeSheet(); toast("Удалено", "delete");
    if (coll === "students" && location.hash.startsWith("#student/")) location.hash = "#group"; else render(true);
  }
  function copy(text, msg) {
    const done = () => toast(msg, "copy");
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.append(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ничего */ } ta.remove(); done();
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (el && ACT[el.dataset.act]) {
      const r = ACT[el.dataset.act](el, e);
      // у ссылок с действием (например, «Завтра …») переход по href продолжается
      if (!(el.matches("a[href]") && r !== true)) { e.preventDefault(); return; }
    }
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); location.hash = go.dataset.go; }
  });
  fab.addEventListener("click", () => openSheet(FORMS[fab.dataset.kind]()));
  // предпросмотр списков по мере ввода; смена «для чего деление» перестраивает форму
  document.addEventListener("input", e => { const f = e.target.closest && e.target.closest('form[data-form="many"], form[data-form="sgLists"]'); if (f) listPreview(f); });
  document.addEventListener("change", e => {
    const f = e.target.closest && e.target.closest('form[data-form="sgLists"]'); if (!f) return;
    if (e.target.name === "base") openSheet(FORMS.sgLists(e.target.value)); else listPreview(f);
  });
  document.addEventListener("keydown", e => {
    const t = e.target;
    if ((e.key === "Enter" || e.key === " ") && t.matches && t.matches('[role="button"]:not(button), [role="link"]:not(a)')) { e.preventDefault(); t.click(); return; }
    if (e.key === "Escape") { if (!sheet.hidden) closeSheet(); else if (current && current.back && !t.matches("input, textarea")) location.hash = current.back; }
  });
  window.addEventListener("hashchange", () => render());
  window.addEventListener("scroll", () => topbar.classList.toggle("is-stuck", scrollY > 6), { passive: true });

  /* ---------- тема ---------- */
  const mq = matchMedia("(prefers-color-scheme: dark)");
  function isDark() { const t = document.documentElement.dataset.theme; return t === "dark" || (!t && mq.matches); }
  function applyMode() {
    document.documentElement.dataset.mode = isDark() ? "dark" : "light";
    const c = getComputedStyle(document.documentElement).getPropertyValue("--theme-color").trim();
    $('meta[name="theme-color"]').content = c || "#22C79B";
  }
  function setTheme(t) { if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; store.set("theme", t); applyMode(); }
  mq.addEventListener("change", () => { applyMode(); if (DB) render(true); });

  /* ---------- установка, часы, другие вкладки ---------- */
  let deferredInstall = null;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; });
  // раз в минуту обновляем «сейчас»: прогресс пары, переход к следующей
  setInterval(() => {
    NOW = new Date(); const t = startOfDay(NOW);
    if (!same(t, TODAY)) { TODAY = t; S.journalDate = S.schedDate = null; }
    const r = location.hash.slice(1).split("/")[0] || "home";
    if (DB && sheet.hidden && ["home", "journal"].includes(r) && !document.activeElement?.matches("input, textarea")) render(true);
  }, 60000);
  // приложение открыто в двух вкладках — изменения из другой подтягиваются сами
  addEventListener("storage", e => {
    if (e.key !== DATA_KEY) return;
    loadData(); MK = null;
    if (sheet.hidden) render(true);
  });

  // вернулись в приложение на следующий день — проверить расписание
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") autoCheck(); });

  // работа без интернета: файлы приложения кешируются (sw.js)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* без офлайна тоже работает */ }));
  }

  /* ---------- старт ---------- */
  applyMode();
  renderNav("home");
  view.innerHTML = `<div class="stack" aria-busy="true" aria-label="Загрузка">
    <div class="skeleton" style="height:96px;width:70%"></div><div class="skeleton" style="height:150px;border-radius:24px"></div>
    <div class="tiles"><div class="skeleton" style="height:112px;border-radius:20px"></div><div class="skeleton" style="height:112px;border-radius:20px"></div><div class="skeleton" style="height:112px;border-radius:20px"></div></div>
    <div class="skeleton" style="height:120px;border-radius:20px"></div></div>`;
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  loadData();
  fontsReady.then(() => { render(); autoCheck(); });
  addEventListener("online", () => autoCheck());
})();
