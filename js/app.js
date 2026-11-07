/* Помощник старосты — приложение для старост НГТУ в браузере.
   Данные хранятся только в этом браузере (localStorage), формат — тот же data.json,
   что был у программы на ПК, поэтому старый файл можно просто загрузить.
   Правила (недели, подгруппы, отметки) перенесены из прежней Kivy-версии. */
(() => {
  "use strict";

  /* ---------- иконки: Phosphor Icons (обычные линии; залитые — у активного пункта меню).
     Коды из tools/fonts/phosphor-names.json; добавили значок — пересоберите шрифт: python tools/subset_fonts.py */
  const ICON = {
    home: "E2C2", schedule: "E7B4", journal: "E34E", group: "E68E", tasks: "EADC", party: "E81A", subgroups: "E68C", event: "E8B2",
    plus: "E3D4", delete: "E4A6", edit: "E3B4", copy: "E1CA", cog: "E272", left: "E138", right: "E13A", back: "E058", place: "E316",
    door: "E7E6", clock: "E19A", alarm: "E006", teacher: "E600", school: "E62C", cake: "E780", bullhorn: "E642", check: "E184",
    uncheck: "E18A", tick: "E182", excel: "EB22", chart: "E156", add_many: "E2F8", add_one: "E4D0", calendar: "E10A", sun: "E472",
    moon: "E330", coffee: "E1C2", going: "EAFA", info: "E2CE", flag: "E244", star: "E46A", broom: "EC54", email: "E218",
    telegram: "E5BC", phone: "E3B8", contact: "E6F8", crown: "E616", deputy: "E320", translate: "E4A2", search: "E30C",
    close: "E4F6", download: "E20C", wifioff: "E4F2", cash: "E78E", lock: "E308", sick: "E5C6", exam: "E742", works: "E198",
    risk: "E4E0", chat: "E16E", help: "E3E8", backspace: "E0AE", camera: "E10E", attach: "E39A", more: "E1FE", doc: "E23A",
    poll: "E152", bell: "E0D0",
  };
  const ic = (k, cls = "") => `<i class="ic ${cls}" aria-hidden="true">&#x${ICON[k] || ICON.info};</i>`;
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
  // p — студент (с фото в p.ava) или просто имя
  function avatar(p, cls = "") {
    const name = typeof p === "string" ? p : (p && p.name) || "";
    if (p && p.ava) return `<span class="avatar avatar--img ${cls}" aria-hidden="true"><img src="${esc(p.ava)}" alt="" decoding="async"></span>`;
    const i = accentIndex(name), hex = ACCENT_HEX[i];
    const [r, g, b] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255);
    const fg = 0.299 * r + 0.587 * g + 0.114 * b > 0.66 ? "#1A1A1A" : "#fff";
    return `<span class="avatar ${cls}" style="--c:var(--accent-${i});--fg:${fg}" aria-hidden="true">${esc(initials(name))}</span>`;
  }
  // список для чата: каждый с новой строки и с номером — так удобнее читать и считать
  const nameList = names => names.map((n, i) => `${i + 1}. ${n}`).join("\n");
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
  // пример для гостей сайта: список и расписание группы 26-ИВТ-2-1, отметки расставляются случайно
  const DEMO_URL = "demo/group.json";
  // ссылка на Google Форму с отзывами; если пусто — кнопки «Оценить» не показываются
  const FEEDBACK_URL = "https://forms.gle/VsF3DQgE2heuuHsg7";
  const isDemo = () => !!(DB && DB.settings.demo);

  // недостающие поля — как Store._load в main.py
  function normalize(d) {
    d = d && typeof d === "object" ? d : {};
    d.version ??= 1;
    d.settings ??= {};
    d.settings.group ??= "";
    if (!Array.isArray(d.settings.bells) || !d.settings.bells.length) d.settings.bells = ["08:00-09:35", "09:45-11:20", "11:35-13:10", "13:40-15:15", "15:25-17:00"];
    // works — сдачи работ, funds — сборы денег, docs — документы, exams — сессия, sick — больничные
    for (const k of ["students", "teachers", "lessons", "tasks", "events", "works", "funds", "exams", "sick", "docs", "polls", "templates"]) if (!Array.isArray(d[k])) d[k] = [];
    if (!d.attendance || typeof d.attendance !== "object") d.attendance = {};
    // изменения на конкретные даты: "YYYY-MM-DD|id пары" → { cancel, moved_to, room, teacher, src: manual|nntu }
    if (!d.overrides || typeof d.overrides !== "object" || Array.isArray(d.overrides)) d.overrides = {};
    // разовые пары (перенесённые и добавленные): { id, date, subject, num, kind, room, teacher, from?, src }
    if (!Array.isArray(d.oneoff)) d.oneoff = [];
    // раньше было два семестра: берём тот, что идёт сейчас или начнётся следующим, и только его пары
    if (Array.isArray(d.settings.semesters)) {
      const old = d.settings.semesters.map((x, i) => ({ n: i + 1, a: parseISO(x.start), z: parseISO(x.end), odd: x.first_week_odd !== false })).filter(x => x.a && x.z);
      const pick = old.find(x => x.a <= TODAY && TODAY <= x.z) || old.filter(x => x.a > TODAY).sort((x, y) => x.a - y.a)[0];
      if (pick && !d.settings.term) d.settings.term = { start: key(pick.a), end: key(pick.z), first_week_odd: pick.odd };
      const n = pick ? pick.n : (TODAY.getMonth() >= 7 || TODAY.getMonth() === 0 ? 1 : 2);
      if (new Set(d.lessons.map(l => l.sem || 1)).size > 1) d.lessons = d.lessons.filter(l => (l.sem || 1) === n);
      delete d.settings.semesters;
    }
    d.lessons.forEach(l => { delete l.sem; });
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
    if (!DB || isDemo() || !Object.keys(DB.attendance).length) return false;
    const last = store.get("lastBackup", 0);
    return !last || Date.now() - last > BACKUP_DAYS * DAY;
  }

  /* ---------- звонки, период занятий, недели ---------- */
  const bells = () => DB.settings.bells.map(b => { const [a, z] = String(b).split("-"); return [a || "", z || ""]; });
  const lessonSpan = l => (l.start && l.end) ? [l.start, l.end] : (bells()[(l.num || 0) - 1] || ["", ""]);
  // период занятий: расписание в вузе известно на один семестр — его первый и последний день и чётность недель
  function defaultTerm(d) {
    const y = d.getFullYear(), m = d.getMonth();
    if (m >= 7) return [new Date(y, 8, 1), new Date(y, 11, 31)];
    if (m === 0) return [new Date(y - 1, 8, 1), new Date(y - 1, 11, 31)];
    return [new Date(y, 1, 9), new Date(y, 5, 30)];
  }
  function term() {
    const t = DB.settings.term || {}, [da, dz] = defaultTerm(TODAY);
    return { start: parseISO(t.start) || da, end: parseISO(t.end) || dz, firstOdd: t.first_week_odd !== false };
  }
  function weekInfo(d) {
    const { start, end, firstOdd } = term(), active = d >= start && d <= end;
    const week = Math.floor(daysBetween(monday(start), monday(d)) / 7) + 1;
    const odd = ((((week % 2) + 2) % 2) === 1) === firstOdd;
    const label = active ? `${week}-я неделя · ${odd ? "нечётная" : "чётная"}` : d < start ? `Занятия начнутся ${fmtDate(start)}` : `Занятия закончились ${fmtDate(end)}`;
    return { start, end, active, week, parity: odd ? "odd" : "even", label };
  }
  const byTime = (a, b) => (lessonSpan(a)[0] || "99").localeCompare(lessonSpan(b)[0] || "99") || (a.num || 0) - (b.num || 0) || !!a.cancelled - !!b.cancelled;
  // все пары дня с учётом изменений: постоянные (с отменами и заменами) + разовые
  // у отменённых cancelled: true; у постоянных с изменениями — ov (запись из overrides)
  function dayPlan(d) {
    const info = weekInfo(d), k = key(d), out = [];
    if (info.active) DB.lessons.forEach(l => {
      if (l.day !== pyDay(d) || !["all", info.parity].includes(l.week || "all")) return;
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
  // в группе ли студент в этот день: отчисленные и ушедшие в академический отпуск выпадают из списков
  // status: "" | "academ" | "expelled", status_from, status_to (академ: плановый выход), history — прошлые академы
  function inGroup(s, d = TODAY) {
    const k = typeof d === "string" ? d : key(d);
    if ((s.history || []).some(h => h.from <= k && (!h.to || k < h.to))) return false;
    if (!s.status || k < (s.status_from || "")) return true;
    return s.status === "academ" && !!s.status_to && k > s.status_to;
  }
  const students = (d = TODAY) => DB.students.filter(s => inGroup(s, d)).sort(byName);
  const allStudents = () => DB.students.slice().sort(byName);
  const statusText = s => !s.status ? "" : s.status === "expelled" ? `отчислен${s.status_from ? ` с ${fmtDate(parseISO(s.status_from))}` : ""}`
    : `академ. отпуск${s.status_from ? ` с ${fmtDate(parseISO(s.status_from))}` : ""}${s.status_to ? ` до ${fmtDate(parseISO(s.status_to))}` : ""}`;
  // кто должен быть на занятии в этот день → [студенты, номер подгруппы или 0 — вся группа]
  function roster(subject, d = TODAY) {
    const all = students(d), n = subgroupOf(subject);
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
  // записи посещаемости за период: "term" — весь период занятий, "ГГГГ-ММ" — месяц
  function periodRecords(period, subject) {
    const { start, end } = term();
    return Object.entries(DB.attendance).map(([k, r]) => ({ k, r, d: parseISO(k.split("|")[0]) })).filter(({ k, d, r }) => {
      if (!d) return false;
      if (period === "term" ? d < start || d > end : k.slice(0, 7) !== period) return false;
      return !subject || baseSubject(r.subject) === subject;
    });
  }
  function collectStats(recs, sid) {
    const all = [], bySubj = {}, byWeek = {}, bySlot = {}, per = {}, misses = [];
    recs.forEach(({ k, r, d }) => {
      const wk = key(monday(d)), slot = `${d.getDay()}|${r.num || 0}`;
      Object.entries(r.marks || {}).forEach(([id, m]) => {
        if (!m || (sid && id !== sid)) return;
        all.push(m); (bySubj[baseSubject(r.subject)] ||= []).push(m); (byWeek[wk] ||= []).push(m); (bySlot[slot] ||= []).push(m); (per[id] ||= []).push(m);
        if (sid && m !== "+") misses.push({ k, r, d, m });
      });
    });
    const cnt = v => all.filter(m => m === v).length;
    return { all, here: cnt("+"), abs: cnt("н"), exc: cnt("у"), pct: attendancePct(all), bySubj, byWeek, bySlot, per, misses };
  }

  /* ---------- состояние экрана ---------- */
  const S = { journalDate: null, statsPeriod: null, statsSubject: "", studentPeriod: null,
    groupTab: "students", sgTab: "", taskTab: "open", taskKind: "", showPast: false, sgPick: {}, from: "group",
    tasksView: "tasks", studyView: "works", worksDone: false, examsPast: false, pollsClosed: false, gradesFilter: "" };

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
      const [list] = roster(l.subject, d), rec = DB.attendance[attKey(d, l.id)], t = summarize(rec, list);
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
    // прошедшая пара бледнеет, только когда отмечена: неотмеченная ждёт действия старосты
    const marked = mode !== "schedule" && DB.attendance[attKey(d, l.id)];
    const cls = `card card--tap card--accent lesson${st === "past" && marked ? " lesson--past" : ""}${st === "past" && mode !== "schedule" && !marked ? " lesson--todo" : ""}${st === "live" && mode !== "schedule" ? " lesson--live" : ""}${st === "cancelled" ? " lesson--cancelled" : ""}`;
    // в расписании и у отменённых — меню действий; в журнале и на главной — сразу к отметке
    const menu = mode === "schedule" || st === "cancelled" || l.extra;
    const go = menu && !l.extra ? `data-act="lessonMenu" data-id="${esc(l.id)}" data-d="${key(d)}"` : `data-go="#mark/${esc(l.id)}/${key(d)}"`;
    // в журнале у пары есть кнопка «⋯»: перенести, отменить, изменить в расписании
    const more = mode === "journal" && !menu ? `<button class="icon-btn lesson__more" data-act="lessonMenu" data-id="${esc(l.id)}" data-d="${key(d)}" aria-label="Действия с парой: перенести, отменить, изменить" title="Перенести, отменить, изменить">${ic("more")}</button>` : "";
    return `<div class="${cls}${more ? " lesson--more" : ""}" style="--accent:${accent(title)}" ${go} role="${menu && !l.extra ? "button" : "link"}" tabindex="0" aria-label="${esc(l.subject)}${b ? `, ${b}–${e}` : ""}${st === "cancelled" ? ", отменена" : ""}">
      ${more}${tag ? `<div class="lesson__tag">${esc(tag)}</div>` : ""}
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

  /* ---------- дни рождения: напоминание за неделю и в сам день ---------- */
  const BDAY_AHEAD = 7;
  // сколько исполнится (если в дате есть год; «07» → 2007)
  function bdayAge(str, d) {
    const m = /\.(\d{2}|\d{4})$/.exec((str || "").trim()); if (!m) return null;
    let y = +m[1]; if (m[1].length === 2) y += y <= TODAY.getFullYear() % 100 ? 2000 : 1900;
    const age = d.getFullYear() - y; return age > 0 && age < 100 ? age : null;
  }
  function upcomingBdays(days) {
    return students().map(s => { const p = parseBday(s.birthday), d = p && nextBday(p); return d && { s, d, n: daysBetween(TODAY, d), age: bdayAge(s.birthday, d) }; })
      .filter(x => x && x.n <= days).sort((a, b) => a.n - b.n || byName(a.s, b.s));
  }
  // напоминание по каждому человеку дважды в год: за неделю («week») и в сам день («day»)
  const bdayStage = x => `${x.s.id}:${x.d.getFullYear()}:${x.n === 0 ? "day" : "week"}`;
  const bdayPending = () => { const seen = new Set(DB.settings.bday_seen || []); return upcomingBdays(BDAY_AHEAD).filter(x => !seen.has(bdayStage(x))); };
  const firstName = n => (n || "").trim().split(/\s+/)[1] || n;
  const greeting = s => `С днём рождения, ${firstName(s.name)}! 🎉 Желаем здоровья, удачи и лёгкой учёбы!`;
  const bdayWhen = x => x.n === 0 ? "сегодня" : `${fmtDate(x.d)}, ${whenText(x.n)}`;
  function bdayReminder() {
    if (!DB || !sheet.hidden || LOCKED || DB.settings.bday_snooze === key(TODAY)) return;
    if (bdayPending().length) openSheet(FORMS.bdays());
  }

  /* ---------- больничные: на эти даты отметка по умолчанию — «у» ---------- */
  const sickOn = (sid, d) => { const k = typeof d === "string" ? d : key(d); return DB.sick.find(x => x.sid === sid && x.from <= k && k <= x.to); };
  const sickRange = x => { const a = parseISO(x.from), z = parseISO(x.to); return same(a, z) ? fmtDate(a) : `${fmtDate(a)} — ${fmtDate(z)}`; };
  // проставить «у» вместо «н» в уже отмеченных парах больничного
  function applySick(x) {
    let n = 0;
    Object.entries(DB.attendance).forEach(([k, r]) => { const ds = k.split("|")[0]; if (ds >= x.from && ds <= x.to && r.marks && r.marks[x.sid] === "н") { r.marks[x.sid] = "у"; n++; } });
    return n;
  }

  /* ---------- фото справок: IndexedDB (в localStorage фото не поместятся) ---------- */
  const PHOTOS = {
    db: null,
    open() { return this.db ||= new Promise((res, rej) => { const r = indexedDB.open("starosta-photos", 1); r.onupgradeneeded = () => r.result.createObjectStore("p"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async run(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("p", mode), q = fn(t.objectStore("p")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); },
    put(id, blob) { return this.run("readwrite", s => s.put(blob, id)); },
    get(id) { return this.run("readonly", s => s.get(id)); },
    del(id) { return this.run("readwrite", s => s.delete(id)).catch(() => {}); },
  };
  // уменьшить фото до 1600 px и сжать в JPEG — около 200 КБ вместо нескольких МБ
  async function shrinkImage(file, max = 1600) {
    const img = await createImageBitmap(file), k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, "image/jpeg", 0.82));
  }

  async function avatarImage(file, px = 160) {
    const img = await createImageBitmap(file), side = Math.min(img.width, img.height);
    const x = (img.width - side) / 2, y = (img.height - side) * 0.3;
    const c = document.createElement("canvas"); c.width = c.height = px;
    c.getContext("2d").drawImage(img, x, y, side, side, 0, 0, px, px);
    return c.toDataURL("image/jpeg", 0.82);
  }

  /* ---------- риск недопуска: процент по предмету ниже порога ---------- */
  const riskPct = () => +(DB.settings.risk_pct ?? 70);
  function riskList() {
    const recs = periodRecords("term"), by = {};
    recs.forEach(({ r }) => Object.entries(r.marks || {}).forEach(([sid, m]) => { if (m) ((by[sid] ||= {})[baseSubject(r.subject)] ||= []).push(m); }));
    return students().map(s => {
      const subs = Object.entries(by[s.id] || {}).map(([subj, ms]) => ({ subj, pct: attendancePct(ms), abs: ms.filter(m => m === "н").length, n: ms.length }))
        .filter(x => x.n >= 3 && x.pct != null && x.pct < riskPct()).sort((a, b) => a.pct - b.pct);
      return subs.length ? { s, subs } : null;
    }).filter(Boolean).sort((a, b) => a.subs[0].pct - b.subs[0].pct);
  }

  /* ---------- тексты для чата группы ---------- */
  const WD_ACC = ["воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу"];
  function dayText(d) {
    const ls = dayPlan(d), head = `Расписание на ${WD_ACC[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    if (!ls.length) return `${head}: пар нет.`;
    return `${head}:\n` + ls.map(l => {
      const [s, e] = lessonSpan(l), sg = subgroupOf(l.subject), name = baseSubject(l.subject) + (sg ? ` (п/г ${sg})` : "");
      const when = `${l.num} пара${s ? `, ${s}–${e}` : ""}`;
      if (l.cancelled) { const to = l.ov.moved_to && DB.oneoff.find(x => x.id === l.ov.moved_to); return `${when} — ${name}: ${to ? `перенесена на ${to.num} пару` : "отменена"}`; }
      return `${when} — ${name}${l.kind ? `, ${(KIND_SHORT[l.kind] || l.kind).toLowerCase()}` : ""}${l.room ? `, ${l.room}` : ""}${l.one ? (l.from ? " (перенос)" : " (дополнительно)") : ""}`;
    }).join("\n");
  }
  const copyBtn = (text, label, cls = "btn btn--soft btn--sm") => `<button type="button" class="${cls}" data-act="copyText" data-t="${esc(text)}">${ic("copy")}${label}</button>`;
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
      const info = weekInfo(addDays(w.monday, 2));
      w.lessons.forEach(x => {
        const k = `${x.day}|${x.num}|${nameKey(x.subject)}`;
        const e = map.get(k) || { l: x, par: new Set() };
        e.par.add(info.parity); map.set(k, e);
      });
    });
    const both = res.weeks.length > 1;
    return [...map.values()].map(({ l, par }) => ({ subject: l.subject, day: l.day, num: l.num, week: both && par.size === 1 ? [...par][0] : "all",
      kind: l.kind, room: l.room, teacher: l.teacher, ...(l.start ? { start: l.start, end: l.end } : {}) }));
  }
  const NNTU_FIELDS = ["week", "kind", "room", "teacher", "start", "end"];
  // что изменится: совпавшие пары сохраняют id — к нему привязаны отметки в журнале
  function nntuPlan(res) {
    const fresh = nntuLessons(res), old = DB.lessons;
    const k = l => `${l.day}|${l.num}|${nameKey(l.subject)}`;
    const used = new Set(), pair = new Map();
    for (const exact of [true, false]) fresh.forEach((n, i) => {
      if (pair.has(i)) return;
      const o = old.find(o => !used.has(o) && k(o) === k(n) && (!exact || (o.week || "all") === n.week));
      if (o) { used.add(o); pair.set(i, o); }
    });
    const plan = { group: res.group, add: [], upd: [], del: old.filter(o => !used.has(o)), same: 0, bells: null };
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
    const info = weekInfo(TODAY), today = dayLessons(TODAY);
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
        <div class="mini">${bdays.map(x => `<a class="mini__row" href="#student/${esc(x.s.id)}">${avatar(x.s)}<div class="mini__body"><div class="mini__title">${esc(x.s.name)}</div><div class="mini__sub">${fmtDate(x.d)} · ${whenText(x.n)}</div></div></a>`).join("")}</div></section>` : ""}`;

    const bToday = upcomingBdays(0), risk = riskList();
    const exam = DB.exams.filter(x => parseISO(x.date) >= TODAY).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))[0];
    const examN = exam && daysBetween(TODAY, parseISO(exam.date));
    const notices = [
      exam && examN <= 21 && `<a class="card card--tap tip tip--link tip--exam" href="#study/exams">${ic("exam")}<div class="tip__body"><b>${esc(exam.kind || "Экзамен")}: ${esc(baseSubject(exam.subject))} — ${whenText(examN)}</b><span>${fmtShort(parseISO(exam.date))}${exam.time ? `, ${esc(exam.time)}` : ""}${exam.room ? ` · ${esc(exam.room)}` : ""}</span></div>${ic("right", "tip__arrow")}</a>`,
      risk.length && `<a class="card card--tap tip tip--link tip--risk" href="#stats" data-act="riskView">${ic("risk")}<div class="tip__body"><b>Риск недопуска: ${risk.length} ${plural(risk.length, ["студент", "студента", "студентов"])}</b><span>${esc(risk.slice(0, 3).map(x => shortName(x.s.name)).join(", "))}${risk.length > 3 ? ` и ещё ${risk.length - 3}` : ""} — посещаемость по предмету ниже ${riskPct()}%</span></div>${ic("right", "tip__arrow")}</a>`,
      bToday.length && `<div class="card tip tip--bday">${ic("cake")}<div class="tip__body"><b>Сегодня день рождения</b><span>${esc(bToday.map(x => x.s.name + (x.age ? ` (${x.age})` : "")).join(", "))}</span></div><button class="btn btn--primary btn--sm" data-act="copyText" data-t="${esc(bToday.map(x => greeting(x.s)).join("\n"))}">${ic("copy")}Поздравление</button></div>`,
      liveNews() && `<div class="card tip tip--live">${ic("calendar")}<div class="tip__body"><b>Изменения в расписании</b><span>На сайте НГТУ: ${LIVE.changes.length} ${plural(LIVE.changes.length, ["изменение", "изменения", "изменений"])} на ближайшие дни</span></div><button class="btn btn--primary btn--sm" data-act="form" data-f="live">Посмотреть</button></div>`,
      !DB.lessons.length && `<div class="card tip">${ic("schedule")}<div class="tip__body"><b>Расписания пока нет</b><span>Загрузите его с сайта НГТУ — это займёт пару секунд.</span></div><button class="btn btn--primary btn--sm" data-act="form" data-f="nntu">Загрузить</button></div>`,
      !DB.students.length && `<div class="card tip">${ic("add_many")}<div class="tip__body"><b>Добавьте студентов</b><span>Без списка группы не получится отмечать посещаемость.</span></div><a class="btn btn--soft btn--sm" href="#group">К группе</a></div>`,
    ].filter(Boolean).join("");
    // напоминание о копии — не срочное, поэтому в боковой колонке (на телефоне — после пар)
    const backupTip = needBackup() ? `<div class="card tip">${ic("download")}<div class="tip__body"><b>Сохраните копию данных</b><span>Отметки хранятся только в этом браузере. Скачайте файл на случай, если браузер очистят.</span></div><button class="btn btn--soft btn--sm" data-act="exportJson">Скачать</button></div>` : "";
    // плитки — только когда есть что показать: дела и события на ближайшие две недели
    const tiles = [
      open.length && `<a class="card card--tap tile${late ? " tile--alert" : ""}" href="#tasks">${ic(late ? "alarm" : "tasks")}<b class="num">${open.length}</b><span>${late ? `${plural(open.length, ["дело", "дела", "дел"])}, ${late} просрочено` : plural(open.length, ["дело", "дела", "дел"])}</span></a>`,
      soon.length && `<a class="card card--tap tile" href="#events">${ic("party")}<b class="num">${soon.length}</b><span>${plural(soon.length, ["событие", "события", "событий"])} скоро</span></a>`,
    ].filter(Boolean).join("");

    return {
      home: true, nav: "home", fab: "quick",
      html: `
        <div class="home-top"><section class="hero"><h1>Сегодня</h1>
          <p><b>${fmtLong(TODAY)}</b> · ${esc(info.label)}</p></section>${nowCard}</div>
        ${notices ? `<div class="stack">${notices}</div>` : ""}
        ${tiles ? `<div class="tiles">${tiles}</div>` : ""}
        <div class="split">
          <div class="stack">
            ${sectionHead("schedule", (() => { const a = activeOnly(today), s = a.length && lessonSpan(a[0])[0], e = a.length && lessonSpan(a[a.length - 1])[1];
              return a.length ? `Пары сегодня. ${a.length} ${plural(a.length, ["пара", "пары", "пар"])}${s && e ? `, ${s}–${e}` : ""}` : "Пары сегодня"; })(), `<a class="link" href="#journal">Журнал</a>`)}
            ${today.length ? timeline(today, TODAY, "home") : empty("coffee", info.active ? "Сегодня пар нет" : info.label, "Можно выдохнуть. Расписание на неделю — во вкладке «Пары».")}
            ${tomorrow.length ? `<div class="tomorrow-row"><a class="tomorrow" href="#journal" data-act="schedTomorrow">${ic("right")}Завтра ${tomorrow.length} ${plural(tomorrow.length, ["пара", "пары", "пар"])}, начало в ${lessonSpan(tomorrow[0])[0]} — ${esc(baseSubject(tomorrow[0].subject))}</a>
              <button type="button" class="icon-btn" data-act="copyText" data-t="${esc(dayText(addDays(TODAY, 1)))}" aria-label="Скопировать расписание на завтра для чата" title="Скопировать расписание на завтра для чата">${ic("chat")}</button></div>` : ""}
          </div>
          <aside class="split__side" aria-label="Сводка">${backupTip}${side}</aside>
        </div>`,
    };
  };

  /* ----- Журнал: расписание и отметки на одном экране ----- */
  // старые ссылки #schedule ведут в журнал
  SCREENS.schedule = () => { history.replaceState(null, "", "#journal"); return SCREENS.journal(); };
  SCREENS.journal = () => {
    const d = S.journalDate ||= TODAY, list = dayLessons(d), isToday = same(d, TODAY), info = weekInfo(d), mon = monday(d);
    const live = activeOnly(list), marked = live.filter(l => DB.attendance[attKey(d, l.id)]).length;
    const days = [0, 1, 2, 3, 4, 5].map(i => addDays(mon, i));
    const slotsOf = x => new Set(lessonsOn(x).map(l => lessonSpan(l)[0] + l.num)).size;
    const strip = `<div class="days" role="tablist" aria-label="Дни недели">
      <button class="icon-btn" data-act="journalShift" data-n="-7" aria-label="Предыдущая неделя">${ic("left")}</button>
      ${days.map(x => { const n = slotsOf(x); return `<button class="day${same(x, TODAY) ? " day--today" : ""}" role="tab" aria-selected="${same(x, d)}" data-act="journalDay" data-d="${key(x)}" aria-label="${fmtLong(x)}, ${n} ${plural(n, ["пара", "пары", "пар"])}">
          <span>${WDS[x.getDay()]}</span><b>${x.getDate()}</b><span class="day__dots">${"<i></i>".repeat(Math.min(n, 5))}</span></button>`; }).join("")}
      <button class="icon-btn" data-act="journalShift" data-n="7" aria-label="Следующая неделя">${ic("right")}</button></div>`;
    const weekCard = `<section class="card"><div class="card__head">${ic("journal")}<h3>Неделя в журнале</h3></div><div class="mini">${days.map(x => {
      const ls = activeOnly(dayLessons(x)), mk = ls.filter(l => DB.attendance[attKey(x, l.id)]).length, started = ls.filter(l => lessonState(l, x) !== "future").length;
      const pill = !ls.length ? `<span class="muted">—</span>` : mk >= started && started ? `<span class="pill pill--ok num">${mk}/${ls.length}</span>` : started ? `<span class="pill pill--warn num">${mk}/${ls.length}</span>` : `<span class="muted num">${mk}/${ls.length}</span>`;
      return `<button class="mini__row" style="width:100%;text-align:left${same(x, d) ? ";background:var(--field)" : ""}" data-act="journalDay" data-d="${key(x)}"><div class="mini__body"><div class="mini__title">${fmtShort(x)}${same(x, TODAY) ? " · сегодня" : ""}</div></div>${pill}</button>`;
    }).join("")}</div></section>`;
    const bl = bells();
    const bellsCard = `<section class="card"><div class="card__head">${ic("clock")}<h3>Звонки</h3></div>
      <div class="mini">${bl.map((x, i) => `<div class="mini__row"><b class="num" style="width:22px;color:var(--primary-ink)">${i + 1}</b><div class="mini__body num">${x[0]} – ${x[1]}</div></div>`).join("")}</div>
      <button class="link" style="margin-top:8px" data-act="form" data-f="bells">Изменить звонки</button></section>`;
    const semCount = DB.lessons.length;
    const body = !info.active && !list.length ? empty("coffee", info.label, "Занятий по расписанию в эти дни нет.", `<button class="btn btn--soft" data-act="form" data-f="term">${ic("calendar")}Период занятий</button>`)
      : list.length ? timeline(list, d, "journal")
      : semCount ? empty("coffee", "Пар нет", d.getDay() === 0 ? "Воскресенье — выходной." : "В этот день занятий нет. Нажмите «+», чтобы добавить пару.")
      : empty("schedule", "В расписании пока нет пар", "Загрузите расписание с сайта НГТУ или добавьте пары кнопкой «+».", `<button class="btn btn--primary" data-act="form" data-f="nntu">${ic("download")}Загрузить с сайта НГТУ</button>`);
    return {
      title: "Журнал", sub: `${info.active ? info.week + "-я неделя · " : ""}отмечено ${marked} из ${live.length}`, nav: "journal", fab: "schedAdd",
      actions: [["chat", "Скопировать расписание дня для чата", "copyDay"], ["download", "Обновить расписание с сайта НГТУ", "form", "nntu"], ["calendar", "Выбрать дату", "pickDate"]],
      html: `${strip}
        <div class="bells only-narrow">${ic("clock")}Звонки: ${bl.length} ${plural(bl.length, ["пара", "пары", "пар"])}, ${bl[0][0]}–${bl[bl.length - 1][1]}</div>
        <div class="split">
          <div class="stack">
            ${sectionHead("", fmtLong(d), isToday ? `<span class="chip" style="--c:var(--primary)">сегодня</span>` : `<button class="link" data-act="journalToday">К сегодня</button>`)}
            ${!DB.students.length ? empty("group", "", "В группе нет студентов. Добавьте их во вкладке «Группа».") : ""}
            ${body}
            <button class="btn btn--neutral btn--block" data-act="form" data-f="extra">${ic("plus")}Пара не по расписанию</button>
            <a class="card card--tap tip tip--link" href="#stats">${ic("chart")}<div class="tip__body"><b>Итоги посещаемости</b><span>Проценты по студентам и предметам, выгрузка в Excel</span></div>${ic("right", "tip__arrow")}</a>
          </div>
          <aside class="split__side only-wide">${weekCard}${bellsCard}</aside>
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
    const k = attKey(d, l.id), [list, sg] = roster(l.subject, d);
    if (!MK || MK.k !== k) {
      const rec = DB.attendance[k];
      // по умолчанию все «+», а у тех, кто на больничном, — «у»
      MK = { k, l, d, list, sg, saved: !!rec, rec: rec || { subject: l.subject, num: l.num || 0, kind: l.kind || "", marks: Object.fromEntries(list.map(s => [s.id, sickOn(s.id, d) ? "у" : "+"])) } };
    } else Object.assign(MK, { list, sg });
    const [b, e] = lessonSpan(l), need = subgroupOf(l.subject);
    const ill = list.filter(s => sickOn(s.id, d));
    let notice = ill.length ? `<div class="notice notice--sick">${ic("sick")}<span>На больничном: <b>${esc(ill.map(s => shortName(s.name)).join(", "))}</b> — отмечены «У»</span></div>` : "";
    if (need && !sg && DB.students.length) notice += `<div class="notice">${ic("subgroups")}<span>Распределите студентов по подгруппам — здесь будет только ${need}-я подгруппа</span><a class="link" href="#subgroups/${encodeURIComponent(baseSubject(l.subject))}">Распределить</a></div>`;
    else if (sg) { const base = baseSubject(l.subject), own = ownSplit(), free = DB.students.filter(s => !studentSubgroup(s, base, own)).length; if (free) notice += `<div class="notice">${ic("subgroups")}<span>Без подгруппы: <b>${free}</b></span><a class="link" href="#subgroups/${encodeURIComponent(base)}">Распределить</a></div>`; }
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
      ${avatar(s)}<div class="person__body"><div class="person__name">${esc(s.name)}</div><div class="person__meta mark__state">${v === "+" ? "" : word}</div></div>
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
    const isT = S.groupTab === "teachers", list = students(), away = allStudents().filter(s => !inGroup(s));
    const order = { head: 0, deputy: 1 }, leaders = list.filter(s => s.role in order).sort((a, b) => order[a.role] - order[b.role]);
    let body;
    if (isT) body = DB.teachers.length ? `<div class="grid grid--cols" id="people">${DB.teachers.slice().sort(byName).map(teacherCard).join("")}</div>` : empty("teacher", "", "Преподавателей пока нет. Они появятся сами из расписания или добавьте их кнопкой «+».");
    else body = list.length ? `<div id="people" class="stack">
        ${sectionHead("crown", "Актив группы", `<button class="link" data-act="form" data-f="deputies">Замы</button>`)}
        ${leaders.length ? `<div class="card list">${leaders.map(studentCard).join("")}</div>` : `<p class="hint" style="text-align:left">Старосту выберите в карточке студента, замов — кнопкой «Замы».</p>`}
        ${sectionHead("group", "Студенты", "", list.length)}
        <div class="card list list--cols">${list.map(studentCard).join("")}</div>
        ${away.filter(s => s.status === "academ").length ? `${sectionHead("calendar", "Академический отпуск", "", away.filter(s => s.status === "academ").length)}<div class="card list list--cols list--away">${away.filter(s => s.status === "academ").map(studentCard).join("")}</div>` : ""}
        ${away.filter(s => s.status === "expelled").length ? `${sectionHead("close", "Отчислены", "", away.filter(s => s.status === "expelled").length)}<div class="card list list--cols list--away">${away.filter(s => s.status === "expelled").map(studentCard).join("")}</div>` : ""}</div>`
      : empty("group", "В группе нет студентов", "Добавьте их по одному кнопкой «+» или сразу списком.", `<button class="btn btn--soft" data-act="form" data-f="addMany">${ic("add_many")}Добавить списком</button>`);
    return {
      title: "Группа", sub: `${groupName()} · ${list.length} ${plural(list.length, ["студент", "студента", "студентов"])}`, nav: "group", fab: isT ? "teacher" : "student",
      actions: [["subgroups", "Подгруппы", "go", "#subgroups"], ["contact", "Контакты из таблицы или телефона", "form", "contacts"], ["add_many", "Добавить списком", "form", "addMany"]],
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
    const ill = sickOn(s.id, TODAY);
    const meta = [!inGroup(s) ? `<span style="color:var(--${s.status === "expelled" ? "bad" : "warn"}-ink);font-weight:var(--fw-bold)">${statusText(s)}</span>` : "", role, ill ? `<span style="color:var(--excused-ink)">${ic("sick")} на больничном до ${fmtDate(parseISO(ill.to))}</span>` : "", s.subgroup ? sgChip(s.subgroup) : "", s.phone ? `<span class="num">${ic("phone")} ${esc(s.phone)}</span>` : "", p ? `<span>${ic("cake")} ${p[0]} ${MONTHS[p[1] - 1]}</span>` : "", s.note ? `<span class="ellipsis" style="max-width:100%">${esc(s.note)}</span>` : ""].join("");
    return `<a class="list__row" href="#student/${esc(s.id)}" data-search="${esc(nameKey(s.name + " " + (s.phone || "")))}">
      ${avatar(s)}<div class="person__body"><div class="person__name">${esc(s.name)}</div>${meta ? `<div class="person__meta">${meta}</div>` : ""}</div>${ic("right", "list__chev")}</a>`;
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
      const grids = $$("#people > .list, #people > .grid"); if (grids.length > 1) grids[0].hidden = !!q;
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
    const row = s => { const n = num(s); return `<div class="card person${n ? " person--sg" : ""}" style="--accent:${n ? sgColor(n) : "transparent"}" draggable="true" data-drag="${esc(s.id)}">${avatar(s)}<div class="person__body"><div class="person__name">${esc(s.name)}</div></div>${chip(s)}</div>`; };
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
  // период — весь период занятий или конкретный месяц
  const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const monthTitle = m => { const [y, mo] = m.split("-").map(Number); return MONTHS_NOM[mo - 1] + (y !== TODAY.getFullYear() ? ` ${y}` : ""); };
  const periodTitle = p => p === "term" ? "Весь период" : monthTitle(p);
  const termRange = () => { const t = term(); return `${fmtDate(t.start)} — ${fmtDate(t.end)}`; };
  function periodOptions() {
    const ms = [...new Set(Object.keys(DB.attendance).map(k => k.slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort().reverse().slice(0, 12);
    return [["term", "Весь период"], ...ms.map(m => [m, monthTitle(m)])];
  }
  function periodTabs(field) {
    const opts = periodOptions();
    if (!opts.some(([v]) => v === S[field])) opts.push([S[field], periodTitle(S[field])]);
    return `<div class="filter" role="group" aria-label="Период">${opts.map(([v, n]) => `<button aria-pressed="${S[field] === v}" data-act="period" data-f="${field}" data-v="${esc(v)}"${v === "term" ? ` title="Период занятий: ${esc(termRange())}"` : ""}>${n}</button>`).join("")}</div>`;
  }

  /* ----- графики ----- */
  const clamp = p => Math.max(0, Math.min(100, p));
  // полоса процента с засечкой (порог риска или среднее по группе)
  const barMark = (p, c, mark, markTitle) => `<div class="bar bar--mark" role="presentation"><i style="width:${clamp(p)}%;--c:${c}"></i>${mark != null ? `<b class="bar__mark" style="left:${clamp(mark)}%" title="${esc(markTitle || "")}"></b>` : ""}</div>`;
  // состав отметок одной полосой: был / не был / уважительная
  function stackBar(ms) {
    const n = ms.length || 1, part = (v, c) => v ? `<i style="width:${v / n * 100}%;--c:${c}"></i>` : "";
    const cnt = v => ms.filter(m => m === v).length;
    return `<div class="stack-bar" role="presentation">${part(cnt("+"), "var(--here)")}${part(cnt("н"), "var(--absent)")}${part(cnt("у"), "var(--excused)")}</div>`;
  }
  const marksKeys = `<div class="keys"><span><i style="--c:var(--here)"></i>был</span><span><i style="--c:var(--absent)"></i>не был</span><span><i style="--c:var(--excused)"></i>уважительная</span></div>`;
  // строки «по предметам»: у группы — состав отметок, у студента — процент и засечка «в среднем по группе»
  function subjRows(bySubj, cmp, clickable) {
    return Object.entries(bySubj).map(([k, v]) => ({ k, v, p: attendancePct(v) ?? 100 })).sort((a, b) => a.p - b.p).map(({ k, v, p }) => {
      const a = v.filter(m => m === "н").length, e = v.filter(m => m === "у").length, g = cmp && cmp[k] ? attendancePct(cmp[k]) : null;
      const meta = [`${v.length} ${plural(v.length, ["отметка", "отметки", "отметок"])}`, a && `пропусков ${a}`, e && `уваж. ${e}`, g != null && `в группе ${g}%`].filter(Boolean).join(" · ");
      const tag = clickable ? "button" : "div";
      return `<${tag} class="bar-row"${clickable ? ` style="text-align:left" data-act="statsSubj" data-s="${esc(k)}"` : ""}><div class="bar-row__head"><span title="${esc(k)}">${esc(k)}</span><b style="color:${pctInk(p)}">${p}%</b></div>
        ${cmp ? barMark(p, pctColor(p), g, `в среднем по группе ${g}%`) : stackBar(v)}<div class="bar-row__meta num">${meta}</div></${tag}>`;
    }).join("");
  }
  // динамика по неделям: линия с заливкой, пороги 85 и 70 %, у студента — пунктир «в среднем по группе»
  let trendId = 0;
  function trendChart(byWeek, cmp) {
    const ws = Object.keys(byWeek).sort().filter(w => attendancePct(byWeek[w]) != null).slice(-16);
    if (ws.length < 2) return `<p class="muted">Нужно хотя бы две недели с отметками.</p>`;
    const ps = ws.map(w => attendancePct(byWeek[w])), cs = cmp ? ws.map(w => cmp[w] ? attendancePct(cmp[w]) : null) : [];
    const lo = Math.max(0, Math.min(60, Math.floor((Math.min(...ps, ...cs.filter(v => v != null)) - 5) / 10) * 10));
    const X = i => 3 + i / (ws.length - 1) * 94, Y = p => (p - lo) / (100 - lo) * 100;
    const path = vals => vals.map((p, i) => p == null ? "" : `${i && vals[i - 1] != null ? "L" : "M"}${X(i).toFixed(2)},${(100 - Y(p)).toFixed(2)}`).join(" ");
    const line = path(ps), id = `trend${++trendId}`;
    const area = `${line} L${X(ws.length - 1).toFixed(2)},100 L${X(0).toFixed(2)},100 Z`;
    const now = key(monday(TODAY)), last = ps.length - 1, dlt = ps[last] - ps[last - 1];
    const wd = w => { const d = parseISO(w); return `${d.getDate()} ${MON_SHORT[d.getMonth()]}`; };
    // подписи дат: не больше шести, последняя — всегда, соседние не налезают
    const step = Math.ceil(ws.length / 6), labels = ws.map((w, i) => i === last || (i % step === 0 && last - i >= step)
      ? `<span class="${i === 0 ? "is-first" : i === last ? "is-last" : ""}${w === now ? " is-now" : ""}" style="left:${X(i)}%"${w === now ? ' title="Эта неделя"' : ""}>${wd(w)}</span>` : "").join("");
    const rules = [85, 70].filter(p => p > lo).map(p => `<i class="trend__rule" style="bottom:${Y(p)}%;--c:${pctColor(p)};--k:${pctInk(p)}"><span>${p}%</span></i>`).join("")
      + `<i class="trend__rule trend__rule--base" style="bottom:0;--k:var(--muted-ink)"><span>${lo}%</span></i>`;
    const pts = ps.map((p, i) => `<span class="trend__pt${i === last ? " trend__pt--last" : ""}" style="left:${X(i)}%;bottom:${Y(p)}%;--c:${pctColor(p)}" title="Неделя с ${wd(ws[i])}: ${p}%${cs[i] != null ? ` (в группе ${cs[i]}%)` : ""}"></span>`).join("");
    const bubble = `<b class="trend__val${X(last) > 80 ? " is-end" : ""}" style="left:${X(last)}%;bottom:${Y(ps[last])}%;--c:${pctColor(ps[last])};--k:${pctInk(ps[last])}">${ps[last]}%</b>`;
    const lo2 = Math.min(...ps), hi2 = Math.max(...ps);
    return `<div class="trend" role="img" aria-label="Посещаемость по неделям: от ${lo2} до ${hi2} процентов, последняя неделя ${ps[last]} процентов">
      <div class="trend__plot">${rules}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--primary);stop-opacity:.26"/><stop offset="1" style="stop-color:var(--primary);stop-opacity:0"/></linearGradient></defs>
          <path d="${area}" fill="url(#${id})"/>${cmp ? `<path class="trend__cmp" d="${path(cs)}"/>` : ""}<path class="trend__line" d="${line}"/></svg>
        ${pts}${bubble}</div>
      <div class="trend__x" aria-hidden="true">${labels}</div></div>
      <p class="hint trend__hint">Последняя неделя — <b style="color:${pctInk(ps[last])}">${ps[last]}%</b>${dlt ? `, ${dlt > 0 ? "↑" : "↓"} ${Math.abs(dlt)} п.п. к предыдущей` : ", как на предыдущей"}.${cmp ? ` <span class="trend__cmp-key"></span> — в среднем по группе.` : ""}</p>`;
  }
  // когда пропускают: дни недели × номер пары
  function slotHeat(bySlot) {
    const ks = Object.keys(bySlot).filter(k => +k.split("|")[1] > 0 && +k.split("|")[0] > 0);
    if (ks.length < 3) return "";
    const days = [1, 2, 3, 4, 5, 6].filter(dw => ks.some(k => +k.split("|")[0] === dw));
    const nums = [...new Set(ks.map(k => +k.split("|")[1]))].sort((a, b) => a - b);
    const of = f => ks.filter(f).flatMap(k => bySlot[k]);
    const cell = (ms, cls = "") => { const p = ms && ms.length ? attendancePct(ms) : null;
      return p == null ? `<td class="heat__none${cls}">—</td>` : `<td class="${cls.trim()}" style="--c:${pctColor(p)};--k:${pctInk(p)}" title="${p}% · ${ms.length} ${plural(ms.length, ["отметка", "отметки", "отметок"])}">${p}</td>`; };
    let worst = null;
    ks.forEach(k => { const ms = bySlot[k], p = attendancePct(ms); if (p != null && ms.length >= 5 && (!worst || p < worst.p)) worst = { k, p }; });
    const wn = worst && worst.p < 85 ? `Ниже всего — ${WD[+worst.k.split("|")[0]].toLowerCase()}, ${worst.k.split("|")[1]} пара: <b style="color:${pctInk(worst.p)}">${worst.p}%</b>.` : "Провалов нет — по всем дням и парам от 85 %.";
    return `<div class="heat-wrap"><table class="heat"><caption class="sr-only">Посещаемость по дням недели и номерам пар, в процентах</caption>
      <thead><tr><th></th>${nums.map(n => `<th scope="col">${n}<small> пара</small></th>`).join("")}<th scope="col" class="heat__sumh">день</th></tr></thead>
      <tbody>${days.map(dw => `<tr><th scope="row">${WDS[dw]}</th>${nums.map(n => cell(bySlot[`${dw}|${n}`])).join("")}${cell(of(k => +k.split("|")[0] === dw), " heat__sum")}</tr>`).join("")}</tbody>
      <tfoot><tr><th scope="row">все</th>${nums.map(n => cell(of(k => +k.split("|")[1] === n), " heat__sum")).join("")}<td class="heat__blank"></td></tr></tfoot></table></div>
      <p class="hint" style="text-align:left;margin-top:8px">${wn} Цифры — процент посещаемости.</p>`;
  }

  SCREENS.stats = () => {
    S.statsPeriod ||= "term";
    const recs = periodRecords(S.statsPeriod, S.statsSubject), st = collectStats(recs);
    const subs = [...new Set(periodRecords(S.statsPeriod).map(x => baseSubject(x.r.subject)))].sort((a, b) => a.localeCompare(b, "ru"));
    const filter = subs.length ? `<div class="filter" role="group" aria-label="Предмет"><button aria-pressed="${!S.statsSubject}" data-act="statsSubj" data-s="">Все предметы</button>${subs.map(s => `<button aria-pressed="${S.statsSubject === s}" data-act="statsSubj" data-s="${esc(s)}" title="${esc(s)}"><span>${esc(s)}</span></button>`).join("")}</div>` : "";
    const head = { title: "Итоги", sub: `${periodTitle(S.statsPeriod)} · ${S.statsSubject || "все предметы"}`, back: "#journal", nav: "journal", actions: [["excel", "Выгрузить в Excel", "excel"]] };
    if (!st.all.length) return { ...head, html: `${periodTabs("statsPeriod")}${filter}${empty("chart", "Пока нет отметок", `За период «${periodTitle(S.statsPeriod)}» ещё нет отмеченных пар. Итоги появятся после первой отметки в журнале.`)}` };
    const P = st.pct ?? 0, risk = riskPct(), list = allStudents().map(s => ({ s, m: st.per[s.id] || [] })).filter(x => x.m.length).map(x => ({ ...x, p: attendancePct(x.m) ?? 100, abs: x.m.filter(m => m === "н").length, exc: x.m.filter(m => m === "у").length })).sort((a, b) => a.p - b.p);
    const low = list.filter(x => x.p < risk).length;
    const avgOf = f => Math.round(recs.reduce((a, x) => a + Object.values(x.r.marks || {}).filter(f).length, 0) / recs.length);
    const heat = slotHeat(st.bySlot), weeks = Object.keys(st.byWeek).length >= 2;
    return { ...head, html: `
      ${periodTabs("statsPeriod")}${filter}
      <div class="grid grid--cols2">
        <section class="card"><div class="card__head">${ic("chart")}<h3>Посещаемость</h3></div>
          <div class="summary">${donut([{ v: st.here, c: "var(--here)" }, { v: st.abs, c: "var(--absent)" }, { v: st.exc, c: "var(--excused)" }], 126, 18, `<b style="color:${pctInk(P)}">${P}%</b><small>посещаемость</small>`, `Посещаемость ${P} процентов`)}
          <div class="legend"><div><i style="--c:var(--here)"></i>Были<b>${st.here}</b></div><div><i style="--c:var(--absent)"></i>Не были<b>${st.abs}</b></div><div><i style="--c:var(--excused)"></i>Уважительная<b>${st.exc}</b></div>
          <div class="compare">В среднем на паре <b style="color:var(--text)">${avgOf(m => m === "+")} из ${avgOf(Boolean)}</b> · ${recs.length} ${plural(recs.length, ["занятие", "занятия", "занятий"])}</div>
          <p class="muted" style="font-size:12px">Уважительные пропуски не снижают процент.</p></div></div></section>
        ${weeks ? `<section class="card"><div class="card__head">${ic("calendar")}<h3>По неделям</h3></div>${trendChart(st.byWeek)}</section>` : ""}
        ${heat ? `<section class="card"><div class="card__head">${ic("clock")}<h3>Дни и пары</h3></div>${heat}</section>` : ""}
        ${S.statsSubject ? "" : `<section class="card"${heat && weeks ? "" : ' style="grid-column:1/-1"'}><div class="card__head">${ic("schedule")}<h3>По предметам</h3></div>${marksKeys}
          <div class="stack" style="gap:16px">${subjRows(st.bySubj, null, true)}</div></section>`}
      </div>
      ${(() => { // риск недопуска — только за весь период занятий
        if (S.statsPeriod !== "term" || S.statsSubject) return "";
        const rl = riskList();
        return `${sectionHead("risk", `Риск недопуска. Ниже ${risk}% по предмету`, `<button class="link" data-act="form" data-f="risk">Порог</button>`)}
          ${rl.length ? `<div class="card list list--cols">${rl.map(({ s, subs }) => `<a class="list__row" href="#student/${esc(s.id)}" data-act="fromStats">${avatar(s)}<div class="person__body"><div class="person__name">${esc(s.name)}</div>
            <div class="person__meta">${subs.map(x => `<span class="chip chip--clip" style="--c:var(--bad)" title="${esc(x.subj)} · ${x.pct}%">${esc(x.subj)} · ${x.pct}%</span>`).join("")}</div></div>${ic("right", "list__chev")}</a>`).join("")}</div>`
            : `<p class="muted" style="font-size:14px">Никого — у всех посещаемость по предметам не ниже ${risk}%.</p>`}`; })()}
      ${sectionHead("group", "Студенты. Сначала отстающие", low ? `<span class="pill pill--bad">${low} ниже ${risk}%</span>` : "")}
      <p class="hint" style="text-align:left">Засечка на полосе — порог ${risk}%. Нажмите на студента, чтобы открыть его пропуски.</p>
      <div class="card list list--cols">${list.map(({ s, p, abs, exc }) => `<a class="list__row" href="#student/${esc(s.id)}" data-act="fromStats">
        ${avatar(s)}<div class="person__body"><div class="bar-row__head"><span class="person__name">${esc(s.name)}</span><b class="num" style="color:${pctInk(p)}">${p}%</b></div>
        <div style="margin:6px 0 4px">${barMark(p, pctColor(p), risk, `порог ${risk}%`)}</div><div class="person__meta num">пропусков: ${abs}${exc ? ` · уваж.: ${exc}` : ""}${!inGroup(s) ? ` · ${statusText(s)}` : ""}</div></div>${ic("right", "list__chev")}</a>`).join("")}</div>` };
  };

  /* ----- выгрузка в Excel: «Сводка» + лист-ведомость на каждый предмет ----- */
  const KIND_SHORT = { "Лекция": "лек.", "Практика": "пр.", "Лабораторная": "лаб.", "Семинар": "сем.", "Внеплановое": "внепл." };
  function shortSheetName(n) {
    if (n.length <= 31) return n;
    n = n.replace(/\s*\([^)]*\)/g, "").trim() || n;
    return n.length <= 31 ? n : n.slice(0, 30).replace(/[ ,.-]+$/, "") + "…";
  }
  function attendanceWorkbook(recs, periodTitle) {
    const X = XLSX.S, col = XLSX.col, group = DB.settings.group;
    const list = allStudents().filter(s => inGroup(s) || recs.some(x => (x.r.marks || {})[s.id]));
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
    S.statsPeriod ||= "term";
    const recs = periodRecords(S.statsPeriod, S.statsSubject);
    if (!recs.length) return toast("Нечего выгружать — за этот период отметок нет", "info");
    const t = term(), [y, mo] = S.statsPeriod.split("-").map(Number);
    const sheets = attendanceWorkbook(recs, S.statsPeriod === "term" ? `период занятий ${dmy(t.start)}–${dmy(t.end)}` : `${MONTHS_NOM[mo - 1].toLowerCase()} ${y}`);
    const suffix = S.statsSubject ? "_" + S.statsSubject.replace(/[^\wа-яё]+/gi, "_") : "";
    download(XLSX.blob(sheets), `посещаемость_${S.statsPeriod === "term" ? "период" : S.statsPeriod}${suffix}_${key(TODAY)}.xlsx`);
    const n = sheets.length - 1;
    toast(`Ведомость скачана: сводка и ${n} ${plural(n, ["лист", "листа", "листов"])} по предметам`, "excel");
  }

  /* ----- Студент ----- */
  // учится ли в группе: академический отпуск и отчисление — с датой; прошлые отметки остаются в журнале
  function statusCard(s) {
    const hist = (s.history || []).map(h => `<div class="mini__row"><div class="mini__body"><div class="mini__title">${h.kind === "expelled" ? "Был отчислен" : "Академ. отпуск"}: ${fmtDate(parseISO(h.from))} — ${fmtDate(parseISO(h.to))}</div>${h.note ? `<div class="mini__sub">${esc(h.note)}</div>` : ""}</div></div>`).join("");
    if (!s.status) return `<section class="card"><div class="card__head">${ic("school")}<h3>Учёба в группе</h3></div>
      <p class="muted" style="font-size:14px;margin-bottom:12px">Учится в группе. Если студент уходит в академ или его отчисляют — укажите дату: с неё он пропадёт из отметок, сдач и сборов, а прошлые отметки останутся.</p>
      <div class="btn-row"><button class="btn btn--soft" data-act="form" data-f="academ" data-id="${esc(s.id)}">${ic("calendar")}Академ. отпуск</button><button class="btn btn--danger" data-act="form" data-f="expel" data-id="${esc(s.id)}">${ic("close")}Отчислить</button></div>
      ${hist ? `<div class="mini" style="margin-top:12px">${hist}</div>` : ""}</section>`;
    const ex = s.status === "expelled", soon = s.status_from > key(TODAY);
    return `<section class="card status-card status-card--${ex ? "bad" : "warn"}"><div class="card__head">${ic(ex ? "close" : "calendar")}<h3>${ex ? "Отчислен" : "Академический отпуск"}${soon ? " — с " + fmtDate(parseISO(s.status_from)) : ""}</h3></div>
      <p style="font-size:14px;margin-bottom:4px">${esc(statusText(s))}${s.status_note ? ` · ${esc(s.status_note)}` : ""}</p>
      <p class="muted" style="font-size:13px;margin-bottom:12px">${ex ? "В отметках, сдачах и сборах его нет. Прошлые отметки остались в журнале и итогах." : `В отметках его нет${s.status_to ? ` до ${fmtDate(parseISO(s.status_to))} — потом вернётся в списки сам` : ""}. Прошлые отметки остались.`}</p>
      <div class="btn-row"><button class="btn btn--soft" data-act="studentReturn" data-id="${esc(s.id)}">${ic("back")}${ex ? "Восстановить в группе" : "Вышел из академа"}</button>
        <button class="btn btn--neutral" data-act="form" data-f="${ex ? "expel" : "academ"}" data-id="${esc(s.id)}">${ic("edit")}Изменить</button></div>
      ${hist ? `<div class="mini" style="margin-top:12px">${hist}</div>` : ""}</section>`;
  }
  SCREENS.student = (id) => {
    const s = DB.students.find(x => x.id === id);
    const back = S.from === "stats" ? "#stats" : "#group", nav = S.from === "stats" ? "journal" : "group";
    if (!s) return { title: "Студент не найден", back, nav, html: empty("group", "", "Возможно, студента удалили из группы.") };
    S.studentPeriod ||= "term";
    const recs = periodRecords(S.studentPeriod), st = collectStats(recs, s.id), all = collectStats(recs);
    const P = st.pct, avg = all.pct, misses = st.misses.sort((a, b) => b.d - a.d), p = parseBday(s.birthday);
    const roleTxt = s.role === "head" ? " · староста" : s.role === "deputy" ? " · зам. старосты" : "";
    const nb = p && nextBday(p), nn = nb && daysBetween(TODAY, nb), age = nb && bdayAge(s.birthday, nb);
    const bday = p ? `<span${nn <= BDAY_AHEAD ? ' style="color:var(--primary-ink);font-weight:var(--fw-bold)"' : ""}>${ic("cake")} ${p[0]} ${MONTHS[p[1] - 1]}${nn === 0 ? " — сегодня!" : nn <= 30 ? `, ${whenText(nn)}` : ""}${age ? ` · исполнится ${age}` : ""}</span>`
      : `<button class="link" style="padding:4px 0" data-act="form" data-f="student" data-id="${esc(s.id)}">${ic("cake")} Указать день рождения</button>`;
    const weeks = Object.keys(st.byWeek).length >= 2, heat = slotHeat(st.bySlot);
    const ill = DB.sick.filter(x => x.sid === s.id).sort((a, b) => b.from.localeCompare(a.from)), illNow = sickOn(s.id, TODAY);
    const sickCard = `<section class="card"><div class="card__head">${ic("sick")}<h3>Больничные</h3><button class="link" data-act="sickAdd" data-sid="${esc(s.id)}">Добавить</button></div>
      ${ill.length ? `<div class="mini">${ill.map(x => `<div class="mini__row"><div class="mini__body"><div class="mini__title">${sickRange(x)}${x === illNow ? ` <span class="pill pill--exc" style="height:22px;font-size:11px">сейчас</span>` : ""}</div>${x.note ? `<div class="mini__sub">${esc(x.note)}</div>` : ""}</div>
        ${x.photo ? `<button class="icon-btn" data-act="sickPhoto" data-id="${esc(x.id)}" aria-label="Фото справки" title="Фото справки">${ic("camera")}</button>` : ""}
        <button class="icon-btn" data-act="form" data-f="sick" data-id="${esc(x.id)}" aria-label="Изменить" title="Изменить">${ic("edit")}</button></div>`).join("")}</div>`
        : `<p class="muted" style="font-size:14px">Укажите даты больничного — пары в эти дни отметятся «У» сами.</p>`}</section>`;
    return {
      title: "Студент", sub: !inGroup(s) ? statusText(s) : (s.subgroup ? `${s.subgroup}-я подгруппа` : "без подгруппы") + roleTxt, back, nav,
      actions: [["edit", "Редактировать", "form", "student", s.id]],
      html: `
        <section class="card profile"><button class="ava-pick" data-act="avaMenu" data-id="${esc(s.id)}" aria-label="${s.ava ? "Фото студента" : "Добавить фото"}" title="${s.ava ? "Сменить или убрать фото" : "Добавить фото"}">${avatar(s, "avatar--lg")}<span class="ava-pick__badge">${ic("camera")}</span></button><div style="min-width:0"><h2>${esc(s.name)}</h2>
          <div class="person__meta">${s.subgroup ? sgChip(s.subgroup) : ""}${illNow ? `<span style="color:var(--excused-ink);font-weight:var(--fw-bold)">${ic("sick")} на больничном до ${fmtDate(parseISO(illNow.to))}</span>` : ""}${s.phone ? `<a class="num" href="tel:${esc(s.phone.replace(/[^+\d]/g, ""))}">${ic("phone")} ${esc(s.phone)}</a>` : ""}${s.email ? `<a href="mailto:${esc(s.email)}">${ic("email")} ${esc(s.email)}</a>` : ""}${s.telegram ? `<a href="https://t.me/${esc(s.telegram.replace(/^\+/, "+"))}" target="_blank" rel="noopener">${ic("telegram")} ${esc(tgLabel(s.telegram))}</a>` : ""}${bday}${s.note ? `<span>${esc(s.note)}</span>` : ""}</div></div></section>
        ${statusCard(s)}
        ${gradesCard(s)}
        ${sickCard}
        ${periodTabs("studentPeriod")}
        ${!st.all.length ? empty("chart", "Отметок пока нет", `За период «${periodTitle(S.studentPeriod)}» у студента нет отметок.`) : `
        <div class="grid grid--cols2">
          <section class="card"><div class="card__head">${ic("chart")}<h3>Посещаемость</h3></div>
            <div class="summary">${donut([{ v: st.here, c: "var(--here)" }, { v: st.abs, c: "var(--absent)" }, { v: st.exc, c: "var(--excused)" }], 120, 17, `<b style="color:${pctInk(P ?? 100)}">${P ?? "—"}${P != null ? "%" : ""}</b><small>посещаемость</small>`, `Посещаемость ${P ?? "—"} процентов`)}
            <div class="legend"><div><i style="--c:var(--here)"></i>Был<b>${st.here}</b></div><div><i style="--c:var(--absent)"></i>Не был<b>${st.abs}</b></div><div><i style="--c:var(--excused)"></i>Уважительная<b>${st.exc}</b></div>
            ${avg != null ? `<div class="compare">В среднем по группе <b style="color:var(--text)">${avg}%</b>${P != null ? (P === avg ? " · на уровне группы" : ` · <span style="color:${P > avg ? "var(--ok-ink)" : "var(--bad-ink)"}">${P > avg ? "выше" : "ниже"} на ${Math.abs(P - avg)} п.п.</span>`) : ""}</div>` : ""}</div></div></section>
          ${weeks ? `<section class="card"><div class="card__head">${ic("calendar")}<h3>По неделям</h3></div>${trendChart(st.byWeek, all.byWeek)}</section>` : ""}
          <section class="card"><div class="card__head">${ic("schedule")}<h3>По предметам</h3></div><p class="hint" style="text-align:left;margin:-4px 0 12px">Засечка — средняя посещаемость группы по предмету.</p><div class="stack" style="gap:16px">${subjRows(st.bySubj, all.bySubj)}</div></section>
          ${heat ? `<section class="card"><div class="card__head">${ic("clock")}<h3>Дни и пары</h3></div>${heat}</section>` : ""}
          <section class="card"><div class="card__head">${ic("alarm")}<h3>Пропуски</h3><span class="pill pill--bad num">${misses.length}</span></div>
            ${misses.length ? `<div class="mini">${misses.slice(0, 20).map(x => `<a class="mini__row" href="#mark/${esc(x.k.split("|")[1])}/${key(x.d)}"><span class="mark__chip" style="width:36px;height:30px;font-size:14px;background:${x.m === "н" ? "var(--bad)" : "var(--excused)"};color:#fff">${x.m === "н" ? "Н" : "У"}</span><div class="mini__body"><div class="mini__title">${esc(baseSubject(x.r.subject))}</div><div class="mini__sub">${fmtShort(x.d)} · ${x.r.num || "?"} пара</div></div>${ic("right", "muted")}</a>`).join("")}</div>
              ${misses.length > 20 ? `<p class="hint" style="margin-top:8px">и ещё ${misses.length - 20}</p>` : ""}` : `<p class="muted">Пропусков нет — отлично.</p>`}</section>
        </div>`}`,
    };
  };

  /* ----- Учёба (сдачи работ, сессия) и внеучебка (дела, сборы, события, опросы) ----- */
  const STUDY_VIEWS = [["works", "Сдачи", "#study/works"], ["exams", "Сессия", "#study/exams"], ["grades", "Оценки", "#study/grades"]];
  const EXTRA_VIEWS = [["tasks", "Дела", "#tasks"], ["funds", "Сборы", "#tasks/funds"], ["events", "События", "#events"], ["polls", "Опросы", "#tasks/polls"]];
  const viewTabs = (views, cur) => `<div class="seg seg--fit${views.length > 4 ? " seg--many" : ""}" role="tablist" aria-label="Раздел">${views.map(([v, n, h]) => `<button role="tab" aria-selected="${cur === v}" data-go="${h}">${n}</button>`).join("")}</div>`;
  const studyTabs = () => viewTabs(STUDY_VIEWS, S.studyView), extraTabs = () => viewTabs(EXTRA_VIEWS, S.tasksView === "docs" ? "funds" : S.tasksView);
  const rub = n => `${(+n || 0).toLocaleString("ru-RU")} ₽`;
  // кто должен сдать работу (с учётом подгруппы предмета) и кто — деньги (вся группа)
  const checkList = (kind, it) => kind === "works" && it.subject ? roster(it.subject)[0] : students();
  const checkMap = (kind, it) => kind === "funds" ? (it.paid ||= {}) : (it.done ||= {});
  const CHECK = {
    works: { arr: () => DB.works, back: "#study/works", nav: "study", form: "work", icon: "works", verb: "сдали", one: "сдал" },
    funds: { arr: () => DB.funds, back: "#tasks/funds", nav: "tasks", form: "fund", icon: "cash", verb: "сдали деньги", one: "сдал деньги" },
    docs: { arr: () => DB.docs, back: "#tasks/docs", nav: "tasks", form: "doc", icon: "doc", verb: "сдали", one: "сдал документ" },
  };
  function checkStats(kind, it) { const list = checkList(kind, it), m = checkMap(kind, it), ok = list.filter(s => m[s.id]); return { list, ok: ok.length, left: list.filter(s => !m[s.id]) }; }

  SCREENS.study = (view) => {
    if (STUDY_VIEWS.some(([v]) => v === view)) S.studyView = view;
    return S.studyView === "exams" ? examsScreen() : S.studyView === "grades" ? gradesScreen() : worksScreen();
  };
  SCREENS.tasks = (view) => {
    // старые ссылки #tasks/works и #tasks/exams (ярлыки, закладки) ведут в «Учёбу»
    if (view === "works" || view === "exams") { history.replaceState(null, "", `#study/${view}`); return SCREENS.study(view); }
    S.tasksView = ["funds", "docs", "polls"].includes(view) ? view : "tasks";
    if (S.tasksView === "funds") return fundsScreen();
    if (S.tasksView === "docs") return docsScreen();
    if (S.tasksView === "polls") return pollsScreen();
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
      html: `${extraTabs()}
        <div class="filter" role="tablist"><button aria-pressed="${!done}" data-act="taskTab" data-t="open">Активные · ${nOpen}</button><button aria-pressed="${done}" data-act="taskTab" data-t="done">Готово · ${nDone}</button></div>
        <div class="filter" role="group" aria-label="Тип">${[["", "Все", ""], ...Object.entries(TASK_KINDS).map(([k, v]) => [k, k, v.i])].map(([k, n, i]) =>
          `<button aria-pressed="${S.taskKind === k}" data-act="taskKind" data-k="${esc(k)}">${i ? ic(i) : ""}${n}</button>`).join("")}</div>
        ${items.length ? `<div class="grid grid--cols">${items.map(card).join("")}</div>`
          : empty("tasks", done ? "Здесь пусто" : "Дел нет", done ? "Выполненные дела появятся здесь." : "Нажмите «+», чтобы добавить дедлайн, объявление или напоминание. Лабораторные и рефераты — в разделе «Учёба».")}
        ${done && items.length ? `<button class="btn btn--danger btn--block" data-act="clearDone">${ic("delete")}Удалить выполненные</button>` : ""}`,
    };
  };

  /* ----- Сдачи работ: кто сдал лабораторную, реферат, домашку ----- */
  function worksScreen() {
    const all = DB.works.map(w => ({ w, ...checkStats("works", w) })), done = S.worksDone;
    const items = all.filter(x => (x.left.length === 0 && x.list.length > 0) === done).sort((a, b) => (a.w.due || "9999").localeCompare(b.w.due || "9999") || (b.w.created || 0) - (a.w.created || 0));
    const nOpen = all.filter(x => x.left.length || !x.list.length).length;
    const card = ({ w, list, ok, left }) => `<a class="card card--tap work" href="#check/works/${esc(w.id)}">
      <div class="work__head"><div style="min-width:0"><div class="task__title">${esc(w.title)}</div>${w.subject ? `<div class="person__meta" style="margin:2px 0">${esc(w.subject)}</div>` : ""}</div>
        <b class="num work__count" style="color:${left.length ? "var(--text)" : "var(--ok-ink)"}">${ok}<small>/${list.length}</small></b></div>
      ${bar(list.length ? ok / list.length * 100 : 0, left.length ? "var(--primary)" : "var(--ok)", true)}
      <div class="work__foot">${w.due ? dueHtml({ due: w.due, done: !left.length }) : `<div class="due due--ok">без срока</div>`}${left.length ? `<span class="muted">не сдали: ${left.length}</span>` : `<span style="color:var(--ok-ink)">${ic("tick")} сдали все</span>`}</div></a>`;
    return {
      title: "Сдачи", sub: `${nOpen} ${plural(nOpen, ["работа собирается", "работы собираются", "работ собираются"])}`, nav: "study", fab: "work",
      html: `${studyTabs()}
        <div class="filter"><button aria-pressed="${!done}" data-act="worksDone" data-v="0">Собираю · ${nOpen}</button><button aria-pressed="${done}" data-act="worksDone" data-v="1">Сдали все · ${all.length - nOpen}</button></div>
        ${items.length ? `<div class="grid grid--cols">${items.map(card).join("")}</div>`
          : empty("works", done ? "Пока ничего" : "Работ нет", done ? "Работы, которые сдали все, появятся здесь." : "Нажмите «+» и добавьте лабораторную, реферат или домашку — дальше отмечайте, кто сдал, одним нажатием.")}`,
    };
  }

  /* ----- Сборы: деньги и документы в деканат — кто сдал ----- */
  const collectOpen = (kind, arr) => arr.filter(x => { const st = checkStats(kind, x); return st.left.length || !st.list.length; }).length;
  const collectKinds = () => `<div class="filter" role="tablist" aria-label="Что собираем">${[["funds", "cash", "Деньги", DB.funds], ["docs", "doc", "Документы", DB.docs]].map(([k, i, n, arr]) => {
    const open = collectOpen(k, arr); return `<button role="tab" aria-pressed="${S.tasksView === k}" data-go="#tasks/${k}">${ic(i)}${n}${open ? ` · ${open}` : ""}</button>`; }).join("")}</div>`;
  function fundsScreen() {
    const all = DB.funds.map(f => ({ f, ...checkStats("funds", f) })).sort((a, b) => (b.f.created || 0) - (a.f.created || 0));
    const card = ({ f, list, ok, left }) => `<a class="card card--tap work" href="#check/funds/${esc(f.id)}">
      <div class="work__head"><div style="min-width:0"><div class="task__title">${esc(f.title)}</div><div class="person__meta" style="margin:2px 0">по ${rub(f.amount)} с человека${f.due ? ` · до ${fmtDate(parseISO(f.due))}` : ""}</div></div>
        <b class="num work__count">${rub(ok * (+f.amount || 0))}<small> из ${rub(list.length * (+f.amount || 0))}</small></b></div>
      ${bar(list.length ? ok / list.length * 100 : 0, left.length ? "var(--primary)" : "var(--ok)", true)}
      <div class="work__foot"><span class="muted">сдали ${ok} из ${list.length}</span>${left.length ? `<span class="muted">ждём: ${left.length}</span>` : `<span style="color:var(--ok-ink)">${ic("tick")} собрано</span>`}</div></a>`;
    const total = all.reduce((a, x) => a + x.ok * (+x.f.amount || 0), 0);
    return {
      title: "Сборы", sub: all.length ? `деньги · собрано всего ${rub(total)}` : "деньги и документы", nav: "tasks", fab: "fund",
      html: `${extraTabs()}${collectKinds()}
        ${all.length ? `<div class="grid grid--cols">${all.map(card).join("")}</div>`
          : empty("cash", "Сборов пока нет", "Нажмите «+», чтобы начать сбор: на подарок, распечатки, мероприятие. Отмечайте, кто сдал, — сумма посчитается сама.")}`,
    };
  }

  /* ----- Сессия: экзамены, зачёты, консультации ----- */
  const EXAM_KINDS = ["Экзамен", "Зачёт", "Дифзачёт", "Консультация", "Курсовая"];
  function examsScreen() {
    const past = S.examsPast, list = DB.exams.filter(x => { const d = parseISO(x.date); return d && (past ? d < TODAY : d >= TODAY); })
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")) * (past ? -1 : 1));
    const nUp = DB.exams.filter(x => parseISO(x.date) >= TODAY).length;
    const card = x => { const d = parseISO(x.date), n = daysBetween(TODAY, d), c = x.kind === "Консультация" ? "var(--accent-4)" : x.kind === "Зачёт" || x.kind === "Дифзачёт" ? "var(--accent-6)" : "var(--accent-1)";
      return `<button class="card card--tap event" style="text-align:left" data-act="form" data-f="exam" data-id="${esc(x.id)}"><div class="event__date" style="--c:${c}"><b>${d.getDate()}</b><span>${MON_SHORT[d.getMonth()]}</span></div>
        <div style="min-width:0"><div class="person__meta" style="margin:0 0 4px"><span class="chip" style="--c:${c}">${esc(x.kind || "Экзамен")}</span><span>${whenText(n)}</span></div>
        <h3 class="event__title">${esc(baseSubject(x.subject))}</h3>
        <div class="meta" style="margin-top:4px"><span>${ic("clock")}${WDS[d.getDay()]}${x.time ? ", " + esc(x.time) : ""}</span>${x.room ? `<span>${ic("door")}${esc(x.room)}</span>` : ""}${x.teacher ? `<span>${ic("teacher")}${esc(x.teacher)}</span>` : ""}</div>
        ${x.note ? `<p class="muted" style="font-size:13px;margin-top:6px;white-space:pre-line">${esc(x.note)}</p>` : ""}</div></button>`; };
    const text = DB.exams.filter(x => parseISO(x.date) >= TODAY).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
      .map(x => `${fmtDate(parseISO(x.date))}${x.time ? " " + x.time : ""} — ${x.kind || "Экзамен"}: ${baseSubject(x.subject)}${x.room ? ", " + x.room : ""}`).join("\n");
    return {
      title: "Сессия", sub: nUp ? `впереди: ${nUp}` : "экзамены и зачёты", nav: "study", fab: "exam",
      actions: nUp ? [["chat", "Скопировать расписание сессии для чата", "copyText", "", ""]] : [],
      after: () => { const b = $('#topbar [data-act="copyText"]'); if (b) b.dataset.t = "Расписание сессии:\n" + text; },
      html: `${studyTabs()}
        <div class="filter"><button aria-pressed="${!past}" data-act="examsPast" data-v="0">Впереди · ${nUp}</button><button aria-pressed="${past}" data-act="examsPast" data-v="1">Прошли</button></div>
        ${list.length ? `<div class="grid grid--cols">${list.map(card).join("")}</div>`
          : empty("exam", past ? "Здесь пусто" : "Сессия не запланирована", past ? "Прошедшие экзамены и зачёты появятся здесь." : "Нажмите «+», чтобы добавить экзамен, зачёт или консультацию. На главной появится обратный отсчёт.")}`,
    };
  }

  /* ----- Отметки «сдал / не сдал» по работе или сбору ----- */
  SCREENS.check = (kind, id) => {
    const C = CHECK[kind] || CHECK.works, isW = kind === "works", isF = kind === "funds", it = C.arr().find(x => x.id === id), back = C.back, navId = C.nav;
    if (!it) return { title: "Не найдено", back, nav: navId, html: empty(C.icon, "", "Возможно, запись удалили.") };
    const { list, ok, left } = checkStats(kind, it), m = checkMap(kind, it);
    const verb = C.verb;
    const text = left.length ? `${it.title}${isW && it.subject ? ` (${baseSubject(it.subject)})` : ""}${isF ? ` — по ${rub(it.amount)}` : ""}${kind === "docs" && it.note ? ` (${it.note})` : ""}${it.due ? `, срок ${fmtDate(parseISO(it.due))}` : ""}.\nЕщё не ${verb}:\n${nameList(left.map(s => s.name))}`
      : `${it.title}: ${isF ? "все сдали, спасибо" : "сдали все"}!`;
    return {
      title: it.title, sub: `${isW ? (it.subject || "работа") : isF ? `по ${rub(it.amount)} с человека` : (it.note || "документ")} · ${verb} ${ok} из ${list.length}`, back, nav: navId, focus: true,
      actions: [["edit", "Изменить", "form", C.form, it.id]],
      actionbar: `<button class="btn btn--ok" data-act="checkAll" data-k="${kind}" data-id="${esc(it.id)}">${ic("tick")}Все сдали</button>${copyBtn(text, "Должники", "btn btn--primary")}`,
      html: `
        <div class="card markbar" style="display:flex">${donut([{ v: ok, c: "var(--here)" }, { v: list.length - ok, c: "var(--track)" }], 44, 7, "", `${ok} из ${list.length}`, false)}
          <div class="markbar__count num">${isF ? rub(ok * (+it.amount || 0)) : ok}<small> ${isF ? `из ${rub(list.length * (+it.amount || 0))}` : `из ${list.length}`}</small></div></div>
        <p class="hint">Нажмите на студента: ${ic("tick")} — ${C.one}, ещё раз — снять отметку</p>
        ${list.length ? `<div class="grid mark-list">${list.map(s => toggleRow("checkToggle", `data-k="${kind}" data-i="${esc(it.id)}" data-id="${esc(s.id)}"`, s, !!m[s.id])).join("")}</div>`
          : empty("group", "", "В группе пока нет студентов. Добавьте их во вкладке «Группа».")}
        <div class="btn-row only-wide" style="margin-top:12px"><button class="btn btn--ok" data-act="checkAll" data-k="${kind}" data-id="${esc(it.id)}">${ic("tick")}Отметить всех</button>${copyBtn(text, "Скопировать должников", "btn btn--primary")}</div>`,
    };
  };

  /* ----- События ----- */
  SCREENS.events = () => {
    S.tasksView = "events";
    const past = S.showPast, N = DB.students.length;
    const items = DB.events.filter(e => { const d = eventDate(e); return d && (past ? d < TODAY : d >= TODAY); })
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")) * (past ? -1 : 1));
    const nUp = DB.events.filter(e => { const d = eventDate(e); return d && d >= TODAY; }).length;
    return {
      title: "События", sub: `${nUp} ${plural(nUp, ["событие", "события", "событий"])} впереди`, nav: "tasks", fab: "event",
      html: `${extraTabs()}
        <div class="filter"><button aria-pressed="${!past}" data-act="showPast" data-v="0">Предстоящие · ${nUp}</button><button aria-pressed="${past}" data-act="showPast" data-v="1">Прошедшие</button></div>
        ${items.length ? `<div class="grid grid--cols">${items.map(e => {
          const c = eventKind(e), d = eventDate(e), g = new Set(e.going || []), n = daysBetween(TODAY, d);
          const faces = students().filter(s => g.has(s.id)).slice(0, 4).map(s => avatar(s)).join("");
          const invite = `${e.title} — ${fmtLong(d)}${e.time ? ", " + e.time : ""}${e.place ? ". Место: " + e.place : ""}.${e.text ? " " + e.text : ""}`;
          return `<article class="card event"><div class="event__date" style="--c:${c.c}"><b>${d.getDate()}</b><span>${MON_SHORT[d.getMonth()]}</span></div>
            <div style="min-width:0"><div class="person__meta" style="margin:0 0 4px"><span class="chip" style="--c:${c.c}">${ic(c.i)}${esc(e.kind || "Другое")}</span><span>${whenText(n)}</span></div>
            <button style="text-align:left;display:block;width:100%" data-act="form" data-f="event" data-id="${esc(e.id)}"><h3 class="event__title">${esc(e.title)}</h3></button>
            <div class="meta" style="margin-top:4px"><span>${ic("clock")}${WDS[d.getDay()]}${e.time ? ", " + esc(e.time) : ""}</span>${e.place ? `<span>${ic("place")}${esc(e.place)}</span>` : ""}</div>
            ${e.text ? `<p class="muted" style="font-size:13px;margin-top:6px;white-space:pre-line">${esc(e.text)}</p>` : ""}
            <div class="going">${faces ? `<span class="faces">${faces}</span>` : ""}${bar(N ? g.size / N * 100 : 0, "var(--primary)", true)}<b>${g.size} из ${N}</b></div>
            <div class="btn-row" style="margin-top:10px"><button class="btn btn--soft btn--sm" data-act="going" data-id="${esc(e.id)}">${ic("going")}Кто идёт</button>
            <button class="btn btn--neutral btn--sm" data-act="copyText" data-t="${esc(invite)}">${ic("copy")}Пригласить</button></div></div></article>`;
        }).join("")}</div>` : empty("party", past ? "Прошедших событий нет" : "Событий пока нет", past ? "Здесь будут события, дата которых уже прошла." : "Добавьте собрание, поход или праздник — ближайшие появятся на главной.")}`,
    };
  };

  /* ----- Настройки ----- */
  const THEMES = [
    { id: "mint", n: "Светлая", bg: "#F1F4F2", fg: "#14211C", dots: ["#1FBF8F", "#FF6F61", "#9B8AFB"] },
    { id: "violet", n: "Фиолетовая", bg: "#F4F5FB", fg: "#1F2240", dots: ["#5B4CF0", "#DC2626", "#D97706"] },
    { id: "dark", n: "Тёмная", bg: "#0A0F0D", fg: "#EDF3F0", dots: ["#2DD4A7", "#FF7A6E", "#ADA0FF"] },
  ];
  SCREENS.settings = () => {
    // пока тему не выбрали вручную, она следует за системой — выделяем ту, что сейчас на экране
    const st = store.get("theme", "system"), cur = st === "system" ? (isDark() ? "dark" : "mint") : st, tm = term(), b = bells();
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
              ${row("Период занятий", `${fmtDate(tm.start)} — ${fmtDate(tm.end)} · ${weekInfo(TODAY).label}`, editBtn("term"))}
              ${row("Звонки", `${b.length} ${plural(b.length, ["пара", "пары", "пар"])}, ${b[0][0]}–${b[b.length - 1][1]}`, editBtn("bells"))}
              ${row("Риск недопуска", `Предупреждать, если посещаемость по предмету ниже ${riskPct()}%`, editBtn("risk"))}
              ${(() => { const sup = "Notification" in window, perm = sup ? Notification.permission : "denied", on = sup && perm === "granted" && DB.settings.notify;
                return row("Напоминания на этом компьютере", !sup ? "Этот браузер не умеет показывать уведомления"
                  : perm === "denied" ? "Уведомления запрещены для этого сайта в настройках браузера"
                  : on ? "Включены: за 10 минут до пары, «отметьте посещаемость», утром — сроки, сессия и дни рождения. Работают, пока приложение открыто в браузере" : "Выключены. Подскажут о парах и сроках, пока приложение открыто",
                  sup && perm !== "denied" ? (on ? `<button class="btn btn--neutral btn--sm" data-act="notifyOff">Выключить</button>` : `<button class="btn btn--primary btn--sm" data-act="notifyOn">${ic("bell")}Включить</button>`) : ""); })()}
              ${row("Шаблоны сообщений", "Свои заготовки для чата и преподавателей — с подстановкой отсутствующих, должников, расписания", `<a class="btn btn--neutral btn--sm" href="#templates">${ic("chat")}Открыть</a>`)}
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
              ${row("Код-пароль", pinSet() ? "Включён — спросим код при открытии и после 5 минут в фоне" : "Выключен. Защитит телефоны и дни рождения одногруппников, если телефон возьмут в руки",
                pinSet() ? `<div class="btn-row" style="flex-wrap:nowrap"><button class="btn btn--soft btn--sm" data-act="form" data-f="pin">Сменить</button><button class="btn btn--neutral btn--sm" data-act="pinOff">Выключить</button></div>`
                  : `<button class="btn btn--soft btn--sm" data-act="form" data-f="pin">${ic("lock")}Включить</button>`)}
              ${row("Установить", "Иконка на рабочем столе или главном экране, работает без интернета. Долгое нажатие на иконку — быстрые действия", `<button class="btn btn--primary btn--sm" data-act="install">Установить</button>`)}
              ${row("Как пользоваться", "Короткая инструкция: с чего начать и что умеет приложение", `<a class="btn btn--neutral btn--sm" href="#help">${ic("help")}Открыть</a>`)}
              ${FEEDBACK_URL ? row("Оценить приложение", "Короткая анкета: что нравится, что неудобно, чего не хватает", feedbackBtn("btn btn--soft btn--sm")) : ""}
              ${isDemo() ? row("Пример", "Сейчас открыт пример со случайными отметками", `<button class="btn btn--neutral btn--sm" data-act="demoExit">Выйти</button>`) : ""}
              ${row("О приложении", "Неофициальный помощник для старост НГТУ им. Р. Е. Алексеева. Расписание берётся с открытого сайта НГТУ.")}
            </section>
          </div>
        </div>`,
    };
  };

  /* ----- пример для гостей ----- */
  // отметки с начала периода занятий по сегодня, а ещё дела, сдачи, сборы, сессия и событие — даты от сегодняшнего дня
  function demoFill() {
    const R = Math.random, day = n => key(addDays(TODAY, n));
    const ids = students().map(s => s.id), some = share => ids.filter(() => R() < share);
    // у каждого своя привычка: большинство ходит почти всегда, несколько человек — с пропусками
    const habit = Object.fromEntries(ids.map(id => [id, R() < 0.1 ? 0.6 + R() * 0.15 : 0.86 + R() * 0.13]));
    const { start, end } = term();
    for (let d = start; d <= TODAY && d <= end; d = addDays(d, 1))
      lessonsOn(d).forEach(l => {
        if (lessonState(l, d) !== "past") return;
        const marks = {};
        roster(l.subject, d)[0].forEach(s => { marks[s.id] = R() < habit[s.id] ? "+" : R() < 0.3 ? "у" : "н"; });
        DB.attendance[attKey(d, l.id)] = { subject: l.subject, num: l.num || 0, kind: l.kind || "", marks };
      });
    const created = Math.floor(Date.now() / 1000), map = list => Object.fromEntries(list.map(id => [id, 1]));
    DB.tasks = [
      { id: newId(), kind: "Дедлайн", title: "Анкеты на заселение в общежитие — в профком", subject: "", due: day(4), text: "", done: false, created },
      { id: newId(), kind: "Объявление", title: "Собрание группы после 3-й пары", subject: "", due: day(1), text: "Обсудим посвящение и сбор денег", done: false, created },
    ];
    DB.works = [
      { id: newId(), title: "Лабораторная №2", subject: "Информатика", due: day(-2), created: Date.now(), done: map(some(0.8)) },
      { id: newId(), title: "Реферат", subject: "История России", due: day(6), created: Date.now(), done: map(some(0.3)) },
    ];
    DB.funds = [{ id: newId(), title: "Подарок куратору", amount: 200, due: day(5), created: Date.now(), paid: map(some(0.6)) }];
    DB.exams = [
      { id: newId(), subject: "Информатика", kind: "Зачёт", date: key(addDays(end, -6)), time: "09:45", room: "", teacher: "", note: "" },
      { id: newId(), subject: "Математика", kind: "Консультация", date: key(addDays(end, 12)), time: "11:35", room: "", teacher: "", note: "" },
      { id: newId(), subject: "Математика", kind: "Экзамен", date: key(addDays(end, 13)), time: "09:00", room: "", teacher: "", note: "Взять зачётку" },
    ];
    DB.events = [{ id: newId(), title: "Посвящение в студенты", kind: "Праздник", date: day(7), time: "18:00", place: "Актовый зал", text: "", going: some(0.45) }];
  }
  const feedbackBtn = (cls = "btn btn--primary btn--sm") => FEEDBACK_URL ? `<a class="${cls}" href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener">${ic("star")}Оценить</a>` : "";
  const demoStrip = () => `<div class="demo-strip" role="note">${ic("info")}<span><b>Пример.</b> Список и расписание группы 26-ИВТ-2-1 настоящие, отметки посещаемости расставлены случайно.</span>
    <div class="btn-row">${feedbackBtn()}<button class="btn btn--soft btn--sm" data-act="demoExit">Своя группа</button></div></div>`;

  /* ----- первый запуск ----- */
  function welcomeScreen() {
    return {
      title: "Помощник старосты", nav: "home", welcome: true,
      after: fillGroups,
      html: `<div class="welcome">
        <section class="hero"><h1>Помощник старосты.<span> Вся группа под рукой.</span></h1>
          <p>Расписание, посещаемость и дела группы НГТУ — в браузере на телефоне и компьютере. Данные хранятся только на этом устройстве.</p></section>
        <section class="card welcome__card">
          <div class="card__head">${ic("chart")}<h3>Просто посмотреть</h3></div>
          <p class="muted" style="font-size:14px;margin-bottom:12px">Пример с группой 26-ИВТ-2-1: настоящее расписание и список, посещаемость с начала занятий расставлена случайно.</p>
          <button class="btn btn--primary btn--block btn--lg" data-act="demo">Открыть пример</button>
          ${FEEDBACK_URL ? `<p class="hint" style="margin-top:10px">Понравилось или нет — <a href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener">оцените сайт</a></p>` : ""}
        </section>
        <section class="card welcome__card">
          <div class="card__head">${ic("school")}<h3>Ваша группа</h3></div>
          <form data-form="welcome">
            ${field("Номер группы в НГТУ", `<input name="group" required list="nntuGroups" autocomplete="off" autocapitalize="characters" placeholder="26-ИВТ-2-1"><datalist id="nntuGroups"></datalist>`)}
            ${formErr}<button class="btn btn--soft btn--block btn--lg">${ic("download")}Загрузить расписание</button>
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

  /* ----- Документы в деканат (справки, заявления) — часть «Сборов» ----- */
  const DOC_HINTS = ["Справка 086/у", "Флюорография", "Согласие на обработку персональных данных", "Копия паспорта", "Копия СНИЛС", "Копия ИНН",
    "Заявление на стипендию", "Заявление на материальную помощь", "Справка с места работы родителей", "Фото 3×4", "Медицинский полис"];
  function docsScreen() {
    const closed = a => a.left.length === 0 && a.list.length > 0;
    const items = DB.docs.map(x => ({ x, ...checkStats("docs", x) })).sort((a, b) => closed(a) - closed(b) || (a.x.due || "9999").localeCompare(b.x.due || "9999") || (b.x.created || 0) - (a.x.created || 0));
    const nOpen = items.filter(a => !closed(a)).length;
    const card = ({ x, list, ok, left }) => `<a class="card card--tap work" href="#check/docs/${esc(x.id)}">
      <div class="work__head"><div style="min-width:0"><div class="task__title">${esc(x.title)}</div>${x.note ? `<div class="person__meta" style="margin:2px 0">${esc(x.note)}</div>` : ""}</div>
        <b class="num work__count" style="color:${left.length ? "var(--text)" : "var(--ok-ink)"}">${ok}<small>/${list.length}</small></b></div>
      ${bar(list.length ? ok / list.length * 100 : 0, left.length ? "var(--primary)" : "var(--ok)", true)}
      <div class="work__foot">${x.due ? dueHtml({ due: x.due, done: !left.length }) : `<div class="due due--ok">без срока</div>`}${left.length ? `<span class="muted">не сдали: ${left.length}</span>` : `<span style="color:var(--ok-ink)">${ic("tick")} сдали все</span>`}</div></a>`;
    return {
      title: "Сборы", sub: `документы · ${nOpen ? `${nOpen} ${plural(nOpen, ["собирается", "собираются", "собираются"])}` : items.length ? "всё собрано" : "в деканат"}`, nav: "tasks", fab: "doc",
      html: `${extraTabs()}${collectKinds()}
        ${items.length ? `<div class="grid grid--cols">${items.map(card).join("")}</div>`
          : empty("doc", "Документов нет", "Нажмите «+»: справка 086/у, флюорография, согласие на обработку данных, заявление — и отмечайте, кто сдал в деканат.")}`,
    };
  }

  /* ----- Опросы: вопрос группе, ответы отмечает староста ----- */
  const pollAns = (p, sid) => [].concat((p.answers || {})[sid] ?? []);
  function pollStats(p) {
    const list = students(), counts = p.options.map((_, i) => list.filter(s => pollAns(p, s.id).includes(i)).length);
    const left = list.filter(s => !pollAns(p, s.id).length);
    return { list, counts, left, answered: list.length - left.length };
  }
  const pollText = p => `📊 ${p.title}\n${p.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n${p.multi ? "Можно несколько вариантов — ответьте цифрами через запятую." : "Ответьте цифрой."}${p.due ? ` До ${fmtDate(parseISO(p.due))}.` : ""}`;
  const pollBars = (p, st) => { const max = Math.max(1, ...st.counts);
    return p.options.map((o, i) => { const pc = st.list.length ? Math.round(st.counts[i] / st.list.length * 100) : 0;
      return `<div class="bar-row"><div class="bar-row__head"><span title="${esc(o)}">${i + 1}. ${esc(o)}</span><b class="num">${st.counts[i]}<small class="muted"> · ${pc}%</small></b></div>${bar(pc, st.counts[i] === max && st.counts[i] ? "var(--primary)" : "var(--line)", true)}</div>`; }).join(""); };
  function pollsScreen() {
    const closed = S.pollsClosed, all = DB.polls.slice().sort((a, b) => (b.created || 0) - (a.created || 0)), items = all.filter(p => !!p.closed === closed);
    const nOpen = all.filter(p => !p.closed).length;
    const card = p => { const st = pollStats(p);
      return `<a class="card card--tap work" href="#poll/${esc(p.id)}"><div class="work__head"><div class="task__title" style="min-width:0">${esc(p.title)}</div><b class="num work__count">${st.answered}<small>/${st.list.length}</small></b></div>
        <div class="stack" style="gap:8px;margin:10px 0 4px">${pollBars(p, st)}</div>
        <div class="work__foot">${p.due ? dueHtml({ due: p.due, done: p.closed }) : `<div class="due due--ok">${p.multi ? "несколько ответов" : "один ответ"}</div>`}<span class="muted">${st.left.length ? `не ответили: ${st.left.length}` : "ответили все"}</span></div></a>`; };
    return {
      title: "Опросы", sub: nOpen ? `${nOpen} ${plural(nOpen, ["идёт", "идут", "идут"])}` : "голосования группы", nav: "tasks", fab: "poll",
      html: `${extraTabs()}
        <div class="filter"><button aria-pressed="${!closed}" data-act="pollsClosed" data-v="0">Идут · ${nOpen}</button><button aria-pressed="${closed}" data-act="pollsClosed" data-v="1">Завершены · ${all.length - nOpen}</button></div>
        ${items.length ? `<div class="grid grid--cols">${items.map(card).join("")}</div>`
          : empty("poll", closed ? "Пока ничего" : "Опросов нет", closed ? "Завершённые опросы появятся здесь." : "Нажмите «+»: вопрос и варианты. Текст опроса скопируется для чата группы, а ответы отмечайте здесь — сразу видно, кто не ответил.")}`,
    };
  }
  SCREENS.poll = (id) => {
    const p = DB.polls.find(x => x.id === id);
    if (!p) return { title: "Не найдено", back: "#tasks/polls", nav: "tasks", html: empty("poll", "", "Возможно, опрос удалили.") };
    const st = pollStats(p);
    // длинные варианты — в строке студента только номера, выбранное подписываем текстом
    const short = p.options.every(o => o.length <= 12);
    const row = s => { const a = pollAns(p, s.id);
      return `<div class="card poll-row">${avatar(s)}<div class="person__body"><div class="person__name">${esc(s.name)}</div>
        ${!short && a.length ? `<div class="person__meta">${a.map(i => esc(p.options[i])).join(", ")}</div>` : ""}
        <div class="poll-row__opts" role="group" aria-label="Ответ: ${esc(s.name)}">${p.options.map((o, i) => `<button type="button" class="chip-btn${short ? "" : " chip-btn--num"}" aria-pressed="${a.includes(i)}" data-act="pollAnswer" data-p="${esc(p.id)}" data-id="${esc(s.id)}" data-i="${i}" title="${esc(o)}" aria-label="${i + 1}. ${esc(o)}">${short ? `${i + 1}. ${esc(o)}` : i + 1}</button>`).join("")}</div></div></div>`; };
    const leftText = st.left.length ? `${p.title}\nЕщё не ответили:\n${nameList(st.left.map(s => s.name))}` : `${p.title}: ответили все, спасибо!`;
    const results = `Итоги опроса «${p.title}»:\n` + p.options.map((o, i) => `${o} — ${st.counts[i]}`).join("\n");
    return {
      title: p.title, sub: `ответили ${st.answered} из ${st.list.length}${p.closed ? " · завершён" : ""}`, back: "#tasks/polls", nav: "tasks", focus: true,
      actions: [["edit", "Изменить", "form", "poll", p.id]],
      actionbar: `${copyBtn(pollText(p), "Опрос в чат", "btn btn--primary")}${copyBtn(leftText, "Не ответили", "btn btn--soft")}`,
      html: `<section class="card"><div class="stack" style="gap:10px">${pollBars(p, st)}</div>
          <div class="btn-row" style="margin-top:14px">${copyBtn(results, "Итоги в чат")}<button class="btn btn--neutral btn--sm" data-act="pollClose" data-id="${esc(p.id)}">${p.closed ? "Открыть снова" : "Завершить"}</button></div></section>
        <p class="hint" style="text-align:left">Отправьте опрос в чат группы кнопкой «Опрос в чат», а ответы отмечайте здесь — нажмите на вариант напротив студента${p.multi ? " (можно несколько)" : ""}.</p>
        <div class="stack" style="gap:8px">${st.list.map(row).join("")}</div>`,
    };
  };

  /* ----- Шаблоны сообщений: свои заготовки с подстановкой из журнала ----- */
  const TPL_DEFAULT = [
    { title: "Отсутствующие — преподавателю", text: "Здравствуйте, {преподаватель}! На паре «{пара}» {дата} отсутствовали: {отсутствующие}\n\nСтароста группы {группа}, {староста}" },
    { title: "Расписание на завтра", text: "{расписание_завтра}" },
    { title: "Напоминание о сдаче работы", text: "Напоминаю: «{работа}» — срок {срок_работы}.\nЕщё не сдали: {не_сдали_работу}" },
    { title: "Сбор денег", text: "Собираем на «{сбор}» — по {сумма}.\nЕщё не сдали: {не_сдали_деньги}" },
    { title: "Документы в деканат", text: "Нужно сдать: {справка}.\nЕщё не сдали: {не_сдали_справку}" },
    { title: "Поздравление", text: "Ребята, сегодня день рождения у {дни_рождения}! Поздравляем 🎉" },
  ];
  // что можно подставить: [имя, пояснение, значение сейчас]
  function tplValues() {
    const ls = activeOnly(dayLessons(TODAY)), live = ls.find(l => lessonState(l, TODAY) === "live"), past = [...ls].reverse().find(l => lessonState(l, TODAY) === "past");
    const l = live || past || ls.find(x => lessonState(x, TODAY) === "future"), rec = l && DB.attendance[attKey(TODAY, l.id)];
    const absent = l && rec ? summarize(rec, roster(l.subject)[0]).absent.map(s => s.name) : null;
    const openOf = (kind, arr) => arr.map(x => ({ x, ...checkStats(kind, x) })).filter(a => a.left.length).sort((a, b) => (a.x.due || "9999").localeCompare(b.x.due || "9999"))[0];
    const w = openOf("works", DB.works), f = DB.funds.map(x => ({ x, ...checkStats("funds", x) })).filter(a => a.left.length).sort((a, b) => (b.x.created || 0) - (a.x.created || 0))[0], d = openOf("docs", DB.docs);
    const head = DB.students.find(s => s.role === "head"), bd = students().filter(s => { const p = parseBday(s.birthday); return p && p[0] === TODAY.getDate() && p[1] === TODAY.getMonth() + 1; });
    const names = a => a.length ? "\n" + nameList(a.map(s => s.name)) : "";
    return [
      ["группа", "название группы", groupName()], ["староста", "староста из списка группы", head ? head.name : ""],
      ["дата", "сегодня", `${TODAY.getDate()} ${MONTHS[TODAY.getMonth()]}`], ["завтра", "завтрашняя дата", `${addDays(TODAY, 1).getDate()} ${MONTHS[addDays(TODAY, 1).getMonth()]}`],
      ["пара", "пара, которая идёт или была последней", l ? baseSubject(l.subject) : ""], ["преподаватель", "её преподаватель", l ? l.teacher || "" : ""], ["аудитория", "её аудитория", l ? l.room || "" : ""],
      ["отсутствующие", "кого не было на этой паре", absent ? (absent.length ? "\n" + nameList(absent) : "все были") : "[пара ещё не отмечена]"],
      ["расписание_сегодня", "пары на сегодня", dayText(TODAY)], ["расписание_завтра", "пары на завтра", dayText(addDays(TODAY, 1))],
      ["работа", "ближайшая несданная работа", w ? w.x.title : ""], ["срок_работы", "её срок", w && w.x.due ? fmtDate(parseISO(w.x.due)) : "без срока"], ["не_сдали_работу", "кто её не сдал", w ? names(w.left) : ""],
      ["сбор", "последний незакрытый сбор", f ? f.x.title : ""], ["сумма", "сумма с человека", f ? rub(f.x.amount) : ""], ["не_сдали_деньги", "кто не сдал деньги", f ? names(f.left) : ""],
      ["справка", "ближайший документ в деканат", d ? d.x.title : ""], ["не_сдали_справку", "кто его не сдал", d ? names(d.left) : ""],
      ["дни_рождения", "у кого сегодня день рождения", bd.map(s => s.name).join(", ")],
    ];
  }
  const TPL_OLD = { "Здравствуйте, {преподаватель}! На паре «{пара}» {дата} отсутствовали: {отсутствующие}.\nСтароста группы {группа}, {староста}": "Здравствуйте, {преподаватель}! На паре «{пара}» {дата} отсутствовали: {отсутствующие}\n\nСтароста группы {группа}, {староста}", "Напоминаю: «{работа}» — срок {срок_работы}. Ещё не сдали: {не_сдали_работу}.": "Напоминаю: «{работа}» — срок {срок_работы}.\nЕщё не сдали: {не_сдали_работу}", "Собираем на «{сбор}» — по {сумма}. Ещё не сдали: {не_сдали_деньги}.": "Собираем на «{сбор}» — по {сумма}.\nЕщё не сдали: {не_сдали_деньги}", "Нужно сдать: {справка}. Ещё не сдали: {не_сдали_справку}.": "Нужно сдать: {справка}.\nЕщё не сдали: {не_сдали_справку}" };
  const tplFill = (text, vals = tplValues()) => { const m = Object.fromEntries(vals.map(([k, , v]) => [k, v])); return String(text || "").replace(/\{([а-яё_]+)\}/gi, (all, k) => k.toLowerCase() in m ? (m[k.toLowerCase()] || "—") : all).replace(/ +\n/g, "\n"); };
  SCREENS.templates = () => {
    DB.templates.forEach(t => { if (TPL_OLD[t.text]) t.text = TPL_OLD[t.text]; });
    if (!DB.settings.tpl_seeded) { DB.templates.push(...TPL_DEFAULT.map(t => ({ id: newId(), ...t }))); DB.settings.tpl_seeded = true; persist(); }
    const vals = tplValues();
    const card = t => { const txt = tplFill(t.text, vals);
      return `<article class="card tpl"><div class="work__head"><div class="task__title">${esc(t.title)}</div><button class="icon-btn" data-act="form" data-f="tpl" data-id="${esc(t.id)}" aria-label="Изменить шаблон" title="Изменить">${ic("edit")}</button></div>
        <p class="tpl__text">${esc(txt)}</p><div class="btn-row">${copyBtn(txt, "Скопировать", "btn btn--primary btn--sm")}</div></article>`; };
    return {
      title: "Шаблоны сообщений", sub: "для чата группы и преподавателей", back: "#home", nav: "home", fab: "tpl",
      html: `<p class="hint" style="text-align:left">Слова в фигурных скобках подставляются сами — из журнала, сдач, сборов и расписания на сегодня. Нажмите «Скопировать» и вставьте в чат.</p>
        ${DB.templates.length ? `<div class="grid grid--cols">${DB.templates.map(card).join("")}</div>` : empty("chat", "Шаблонов нет", "Нажмите «+», чтобы добавить свою заготовку сообщения.")}
        <details class="card tpl-keys"><summary><b>Что можно подставить</b><span class="muted"> · ${vals.length} слов</span></summary>
          <div class="mini" style="margin-top:8px">${vals.map(([k, hint, v]) => `<div class="mini__row"><div class="mini__body"><div class="mini__title"><code>{${k}}</code> — ${esc(hint)}</div><div class="mini__sub">${esc(String(v || "—").split("\n")[0].slice(0, 90))}</div></div></div>`).join("")}</div></details>`,
    };
  };

  /* ----- Успеваемость: оценки за сессию, долги, пересдачи, стипендия ----- */
  const GRADED = x => x.kind !== "Консультация";
  const gradeSet = x => x.kind === "Зачёт" ? ["зач", "незач", "н/я"] : ["5", "4", "3", "2", "н/я"];
  const BAD_GRADES = new Set(["2", "незач", "н/я"]);
  const finalGrade = r => r ? (r.r || r.g || "") : "";
  const gradeColor = g => BAD_GRADES.has(g) ? "var(--bad)" : g === "3" ? "var(--warn)" : g ? "var(--here)" : "var(--line)";
  // стипендия: сессия без долгов, троек и пересдач
  function gradeSummary(s) {
    const res = DB.exams.filter(GRADED).map(x => ({ x, r: (x.results || {})[s.id] })).filter(e => e.r && e.r.g);
    const debts = res.filter(e => BAD_GRADES.has(finalGrade(e.r))), threes = res.filter(e => finalGrade(e.r) === "3"), retakes = res.filter(e => e.r.r);
    const nums = res.map(e => +finalGrade(e.r)).filter(n => n >= 2), avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    const status = !res.length ? "none" : debts.length ? "debt" : threes.length || retakes.length ? "nostip" : "stip";
    return { res, debts, threes, retakes, avg, status };
  }
  const STATUS_CHIP = { stip: ["стипендия", "var(--ok)"], nostip: ["без стипендии", "var(--warn)"], debt: ["долги", "var(--bad)"], none: ["нет оценок", "var(--muted)"] };
  function gradesScreen() {
    const exams = DB.exams.filter(GRADED).sort((a, b) => a.date.localeCompare(b.date));
    const sum = students().map(s => ({ s, g: gradeSummary(s) })), cnt = k => sum.filter(x => x.g.status === k).length;
    const order = { debt: 0, nostip: 1, stip: 2, none: 3 }, flt = S.gradesFilter || "";
    const list = sum.filter(x => !flt || x.g.status === flt).sort((a, b) => order[a.g.status] - order[b.g.status] || b.g.debts.length - a.g.debts.length || byName(a.s, b.s));
    const examRow = x => { const graded = Object.values(x.results || {}).filter(r => r.g).length, n = students().length, bad = students().filter(s => BAD_GRADES.has(finalGrade((x.results || {})[s.id]))).length;
      return `<a class="mini__row" href="#grades/${esc(x.id)}"><span class="badge" style="--c:${x.kind === "Экзамен" ? "var(--accent-1)" : "var(--accent-6)"}">${ic("exam")}</span><div class="mini__body"><div class="mini__title">${esc(x.kind)}: ${esc(baseSubject(x.subject))}</div><div class="mini__sub">${fmtDate(parseISO(x.date))} · оценки ${graded} из ${n}${bad ? ` · <span style="color:var(--bad-ink)">долгов ${bad}</span>` : ""}</div></div>${ic("right", "list__chev")}</a>`; };
    const debtText = sum.filter(x => x.g.debts.length).map(x => `${x.s.name}: ${x.g.debts.map(e => baseSubject(e.x.subject)).join(", ")}`).join("\n");
    const studentRow = ({ s, g }) => { const [t, c] = STATUS_CHIP[g.status];
      return `<a class="list__row" href="#student/${esc(s.id)}" data-act="fromStats">${avatar(s)}<div class="person__body"><div class="person__name">${esc(s.name)}</div>
        <div class="person__meta"><span class="chip" style="--c:${c}">${t}</span>${g.avg ? `<span class="num">ср. ${g.avg.toFixed(1).replace(".", ",")}</span>` : ""}${g.debts.length ? `<span style="color:var(--bad-ink)">${g.debts.map(e => esc(baseSubject(e.x.subject))).join(", ")}</span>` : ""}${g.threes.length ? `<span>троек: ${g.threes.length}</span>` : ""}${g.retakes.length ? `<span>пересдач: ${g.retakes.length}</span>` : ""}</div></div>${ic("right", "list__chev")}</a>`; };
    return {
      title: "Оценки", sub: exams.length ? `${cnt("stip")} на стипендию · долги у ${cnt("debt")}` : "успеваемость за сессию", nav: "study", fab: "exam",
      actions: debtText ? [["chat", "Скопировать должников для чата", "copyText"]] : [],
      after: () => { const b = $('#topbar [data-act="copyText"]'); if (b) b.dataset.t = "Долги по сессии:\n" + debtText; },
      html: `${studyTabs()}
        ${!exams.length ? empty("exam", "Сессии пока нет", "Добавьте экзамены и зачёты во вкладке «Сессия», потом ставьте оценки здесь — увидите долги и кто остаётся без стипендии.") : `
        <div class="tiles"><button class="card card--tap tile tile--stack" data-act="gradesFilter" data-v="stip">${ic("star")}<b class="num">${cnt("stip")}</b><span>на стипендию</span></button>
          <button class="card card--tap tile tile--stack" data-act="gradesFilter" data-v="nostip">${ic("info")}<b class="num">${cnt("nostip")}</b><span>без стипендии</span></button>
          <button class="card card--tap tile tile--stack${cnt("debt") ? " tile--alert" : ""}" data-act="gradesFilter" data-v="debt">${ic("alarm")}<b class="num">${cnt("debt")}</b><span>с долгами</span></button></div>
        <div class="grid grid--cols2">
          <section class="card"><div class="card__head">${ic("exam")}<h3>Ведомости</h3></div><p class="hint" style="text-align:left;margin:-4px 0 8px">Откройте экзамен или зачёт и поставьте оценки.</p><div class="mini">${exams.map(examRow).join("")}</div></section>
          <section class="card"><div class="card__head">${ic("info")}<h3>Как считаем</h3></div><p class="muted" style="font-size:14px">Долг — «2», «незачёт» или неявка без пересдачи. Стипендия — сессия без долгов, троек и пересдач. Правила вуза могут отличаться — это подсказка, а не решение деканата.</p></section>
        </div>
        <div class="filter" role="group" aria-label="Кого показать">${[["", "Все"], ["debt", "С долгами"], ["nostip", "Без стипендии"], ["stip", "На стипендию"], ["none", "Нет оценок"]].map(([v, n]) => `<button aria-pressed="${flt === v}" data-act="gradesFilter" data-v="${v}">${n}</button>`).join("")}</div>
        ${list.length ? `<div class="card list list--cols">${list.map(studentRow).join("")}</div>` : `<p class="muted">Никого.</p>`}`}`,
    };
  }
  SCREENS.grades = (id) => {
    const x = DB.exams.find(e => e.id === id);
    if (!x) return { title: "Не найдено", back: "#study/grades", nav: "study", html: empty("exam", "", "Возможно, экзамен удалили.") };
    const set = gradeSet(x), res = x.results ||= {}, list = students();
    const chips = (s, field, opts) => opts.map(g => `<button type="button" class="chip-btn chip-btn--grade" style="--c:${gradeColor(g)}" aria-pressed="${(res[s.id] || {})[field] === g}" data-act="gradeSet" data-x="${esc(x.id)}" data-id="${esc(s.id)}" data-f="${field}" data-g="${esc(g)}">${g}</button>`).join("");
    const row = s => { const r = res[s.id] || {}, bad = BAD_GRADES.has(r.g);
      return `<div class="card poll-row">${avatar(s)}<div class="person__body"><div class="person__name">${esc(s.name)}</div>
        <div class="poll-row__opts" role="group" aria-label="Оценка: ${esc(s.name)}">${chips(s, "g", set)}</div>
        ${bad ? `<div class="poll-row__opts" role="group" aria-label="Пересдача"><span class="muted" style="font-size:12px;align-self:center">Пересдача:</span>${chips(s, "r", set.filter(g => g !== "н/я"))}</div>` : ""}</div></div>`; };
    const debt = list.filter(s => BAD_GRADES.has(finalGrade(res[s.id]))), graded = list.filter(s => (res[s.id] || {}).g).length;
    const text = debt.length ? `${x.kind} «${baseSubject(x.subject)}»\nНе сдали:\n${nameList(debt.map(s => s.name))}` : `${x.kind} «${baseSubject(x.subject)}»: сдали все!`;
    const dist = set.map(g => [g, list.filter(s => finalGrade(res[s.id]) === g).length]).filter(([, n]) => n);
    return {
      title: `${x.kind}: ${baseSubject(x.subject)}`, sub: `${fmtDate(parseISO(x.date))} · оценки ${graded} из ${list.length}${debt.length ? ` · долгов ${debt.length}` : ""}`, back: "#study/grades", nav: "study", focus: true,
      actionbar: copyBtn(text, "Должники в чат", "btn btn--primary"),
      html: `${dist.length ? `<div class="card"><div class="stack-bar" style="height:12px">${dist.map(([g, n]) => `<i style="width:${n / list.length * 100}%;--c:${gradeColor(g)}" title="${g}: ${n}"></i>`).join("")}</div>
          <div class="keys" style="margin:10px 0 0">${dist.map(([g, n]) => `<span><i style="--c:${gradeColor(g)}"></i>${g} — ${n}</span>`).join("")}</div></div>` : ""}
        <p class="hint" style="text-align:left">Нажмите оценку напротив студента, ещё раз — снять. Для «${set.includes("2") ? "2" : "незач"}» и неявки появится строка пересдачи.</p>
        <div class="stack" style="gap:8px">${list.map(row).join("")}</div>`,
    };
  };
  function gradesCard(s) {
    const g = gradeSummary(s); if (!g.res.length) return "";
    const [t, c] = STATUS_CHIP[g.status];
    return `<section class="card"><div class="card__head">${ic("exam")}<h3>Сессия</h3><span class="chip" style="--c:${c}">${t}</span></div><div class="mini">${g.res.map(({ x, r }) =>
      `<a class="mini__row" href="#grades/${esc(x.id)}"><div class="mini__body"><div class="mini__title">${esc(x.kind)}: ${esc(baseSubject(x.subject))}</div><div class="mini__sub">${fmtDate(parseISO(x.date))}${r.r ? ` · пересдача, сначала «${esc(r.g)}»` : ""}</div></div><b class="grade-pill" style="--c:${gradeColor(finalGrade(r))}">${esc(finalGrade(r))}</b></a>`).join("")}</div>
      ${g.avg ? `<p class="muted" style="font-size:13px;margin-top:8px">Средний балл ${g.avg.toFixed(2).replace(".", ",")}</p>` : ""}</section>`;
  }

  /* ---------- контакты списком: таблица, ответы Google Формы, контакты телефона .vcf ---------- */
  const C_HEAD = { name: /^(фио|ф\.?и\.?о\.?|фамилия.*имя|студент|name|full ?name)/i, fam: /^фамилия$/i, first: /^имя$/i, mid: /^отчество$/i,
    phone: /(телефон|номер|phone|тел\.?$|mobile)/i, email: /(почт|e-?mail|mail)/i, telegram: /(telegram|телеграм|тг\b|tg\b|ник)/i, birthday: /(рожден|birthday|^др$|^д\.р\.)/i };
  const isEmail = c => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c), isTg = c => /^@[A-Za-z][A-Za-z0-9_]{3,31}$/.test(c) || /t\.me\//i.test(c);
  const isPhone = c => (c.replace(/\D/g, "").length >= 10 && c.replace(/\D/g, "").length <= 12) && /^[+\d][\d\s()-]+$/.test(c);
  const isDate = c => /^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?$/.test(c) || /^\d{4}-\d{2}-\d{2}$/.test(c);
  function normPhone(c) {
    let d = c.replace(/\D/g, ""); if (d.length === 10) d = "7" + d; if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
    return d.length === 11 && d[0] === "7" ? `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` : c.trim();
  }
  function normBday(c) {
    let m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(c.trim()); if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    m = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/.exec(c.trim()); if (!m) return "";
    const y = m[3] ? (m[3].length === 2 ? (+m[3] > 30 ? "19" : "20") + m[3] : m[3]) : "";
    return `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}${y ? "." + y : ""}`;
  }
  function csvRows(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true; else if (ch === "," || ch === ";") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch; }
    row.push(cell); rows.push(row); return rows;
  }
  function parseVcf(text) {
    return String(text).replace(/\r?\n[ \t]/g, "").split(/BEGIN:VCARD/i).slice(1).map(card => {
      const get = re => card.split(/\r?\n/).filter(l => re.test(l)).map(l => l.slice(l.indexOf(":") + 1).trim());
      const n = (get(/^N[;:]/i)[0] || "").split(";"), fn = get(/^FN[;:]/i)[0] || "";
      const name = n[0] && n[1] ? `${n[0]} ${n[1]}${n[2] ? " " + n[2] : ""}` : fn;
      return { name: name.replace(/\\,/g, ",").trim(), phone: get(/^TEL[;:]/i)[0] || "", email: get(/^EMAIL[;:]/i)[0] || "", telegram: "", birthday: get(/^BDAY[;:]/i)[0] || "" };
    }).filter(r => r.name);
  }
  function parseContacts(text) {
    text = String(text || "");
    if (/BEGIN:VCARD/i.test(text)) return parseVcf(text);
    const rows = (/\t/.test(text) ? text.split(/\r?\n/).map(l => l.split("\t")) : csvRows(text)).map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
    let cols = null; const out = [];
    rows.forEach(r => {
      const head = {}; r.forEach((c, i) => { for (const [k, re] of Object.entries(C_HEAD)) if (head[k] == null && re.test(c) && !(k === "name" && C_HEAD.fam.test(c))) { head[k] = i; break; } });
      if (Object.keys(head).length >= 2 || (head.name != null && r.length > 1)) { cols = head; return; }
      const x = { name: "", phone: "", email: "", telegram: "", birthday: "" };
      if (cols) {
        x.name = cols.name != null ? r[cols.name] : [cols.fam, cols.first, cols.mid].filter(i => i != null).map(i => r[i] || "").join(" ").trim();
        ["phone", "email", "telegram", "birthday"].forEach(k => { if (cols[k] != null) x[k] = r[cols[k]] || ""; });
      } else r.forEach(c => {
        const v = c.replace(/^\s*(№\s*)?\d+\s*[.)]\s+/, "");
        if (!x.email && isEmail(v)) x.email = v; else if (!x.telegram && isTg(v)) x.telegram = v; else if (!x.birthday && isDate(v)) x.birthday = v;
        else if (!x.phone && isPhone(v)) x.phone = v; else if (!x.name && NAME_CELL.test(v) && /\s/.test(v)) x.name = v;
      });
      x.name = x.name.replace(/\s+/g, " ").trim(); if (x.name === x.name.toUpperCase()) x.name = titleCase(x.name);
      if (x.name && /[а-яёa-z]{2}/i.test(x.name)) out.push(x);
    });
    return out;
  }
  const C_FIELDS = [["phone", "телефон"], ["email", "почта"], ["telegram", "Telegram"], ["birthday", "день рождения"]];
  // что поменяется: по каждому найденному студенту — какие поля заполним
  function contactsPlan(f) {
    const rows = parseContacts(f.list.value), over = f.overwrite.checked, add = f.addMissing.checked;
    const plan = { rows, upd: [], fresh: [], unknown: [], many: [], fill: Object.fromEntries(C_FIELDS.map(([k]) => [k, 0])) };
    rows.forEach(r => {
      const val = { phone: r.phone ? normPhone(r.phone) : "", email: isEmail(r.email) ? r.email.trim() : "", telegram: normTelegram(r.telegram)[0] || "", birthday: r.birthday ? normBday(r.birthday) : "" };
      if (val.birthday && !parseBday(val.birthday)) val.birthday = "";
      const m = matchName(r.name);
      if (m && m.s) { const ch = C_FIELDS.map(([k]) => k).filter(k => val[k] && val[k] !== (m.s[k] || "") && (over || !m.s[k])); if (ch.length) { plan.upd.push({ s: m.s, val, ch }); ch.forEach(k => plan.fill[k]++); } }
      else if (m && m.many) plan.many.push(r.name);
      else if (add) plan.fresh.push({ name: r.name, ...val }); else plan.unknown.push(r.name);
    });
    return plan;
  }
  function contactsPreview(f) {
    const box = $("#listPreview", f); if (!box) return;
    const p = contactsPlan(f), names5 = a => esc(a.slice(0, 5).join(", ")) + (a.length > 5 ? ` и ещё ${a.length - 5}` : "");
    if (!p.rows.length) { box.innerHTML = f.list.value.trim() ? `<p class="warn">Не нашли ни одного ФИО. Нужен столбец с фамилией и именем.</p>` : ""; return; }
    box.innerHTML = `<span class="pill pill--ok num">строк: ${p.rows.length}</span><span class="pill num" style="background:var(--field)">обновим: ${p.upd.length}</span>
      ${C_FIELDS.filter(([k]) => p.fill[k]).map(([k, n]) => `<span class="pill num" style="background:var(--field)">${n}: ${p.fill[k]}</span>`).join("")}
      ${p.fresh.length ? `<p>Добавятся в группу: ${names5(p.fresh.map(x => x.name))}</p>` : ""}
      ${p.unknown.length ? `<p class="bad">Нет в группе: ${names5(p.unknown)}</p>` : ""}
      ${p.many.length ? `<p class="warn">Несколько похожих — уточните имя: ${names5(p.many)}</p>` : ""}
      ${!p.upd.length && !p.fresh.length ? `<p class="muted">Нового нечего заполнить${f.overwrite.checked ? "" : " — отметьте «Заменять уже заполненные», если нужно обновить"}.</p>` : ""}`;
  }

  /* ---------- напоминания на этом компьютере ---------- */
  const NOTIFIED_KEY = "starosta.notified";
  const notifyOk = () => "Notification" in window && Notification.permission === "granted" && DB && DB.settings.notify;
  function showNote(title, body, url = "#home") {
    if (pinSet()) { title = "Помощник старосты"; body = "Есть напоминание — откройте приложение"; } // под код-паролем — без подробностей
    const opts = { body, icon: "assets/icon.png", badge: "assets/icon.png", tag: url + "|" + title, data: { url } };
    const plain = () => { try { const n = new Notification(title, opts); n.onclick = () => { focus(); location.hash = url; n.close(); }; } catch (e) { /* нет уведомлений */ } };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(plain); else plain();
  }
  function notifyOnce(id, title, body, url) {
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}"); } catch (e) { /* пусто */ }
    if (seen[id]) return;
    const old = key(addDays(TODAY, -7)); seen[id] = key(TODAY); Object.keys(seen).forEach(k => { if (seen[k] < old) delete seen[k]; });
    try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(seen)); } catch (e) { /* пусть повторится */ }
    showNote(title, body, url);
  }
  // утренняя сводка: сроки сегодня и завтра, сессия на днях, дни рождения
  function reminderDigest() {
    const k0 = key(TODAY), k1 = key(addDays(TODAY, 1)), soon = d => d === k0 || d === k1, when = d => d === k0 ? "сегодня" : "завтра", out = [];
    DB.tasks.filter(t => !t.done && soon(t.due)).forEach(t => out.push(`${t.title} — ${when(t.due)}`));
    [["works", DB.works, "Сдача"], ["funds", DB.funds, "Сбор"], ["docs", DB.docs, "В деканат"]].forEach(([kind, arr, w]) =>
      arr.filter(x => soon(x.due) && checkStats(kind, x).left.length).forEach(x => out.push(`${w}: ${x.title} — ${when(x.due)}`)));
    DB.exams.forEach(x => { const n = daysBetween(TODAY, parseISO(x.date)); if (n >= 0 && n <= 2) out.push(`${x.kind}: ${baseSubject(x.subject)} — ${whenText(n)}`); });
    const bd = students().filter(s => { const p = parseBday(s.birthday); return p && p[0] === TODAY.getDate() && p[1] === TODAY.getMonth() + 1; });
    if (bd.length) out.push(`День рождения: ${bd.map(s => s.name).join(", ")}`);
    return out.slice(0, 6).join("\n");
  }
  function checkReminders() {
    if (!notifyOk() || !DB.students) return;
    const k = key(TODAY), m = nowMin();
    activeOnly(dayLessons(TODAY)).forEach(l => {
      if (l.extra) return;
      const [b, e] = lessonSpan(l); if (!b) return; const sb = toMin(b), url = `#mark/${l.id}/${k}`, place = [l.room, l.teacher].filter(Boolean).join(" · ");
      if (m >= sb - 10 && m < sb) notifyOnce(`soon|${k}|${l.id}`, `Через ${sb - m} мин — ${baseSubject(l.subject)}`, place || `${b}–${e}`, url);
      if (m >= sb + 5 && m < toMin(e) && !DB.attendance[attKey(TODAY, l.id)]) notifyOnce(`mark|${k}|${l.id}`, "Отметьте посещаемость", `${baseSubject(l.subject)} · ${b}–${e}`, url);
    });
    if (m >= 8 * 60) { const t = reminderDigest(); if (t) notifyOnce(`digest|${k}`, "Сегодня у группы", t, "#home"); }
  }

  /* ================= КАРКАС ================= */
  const NAV = [["home", "Сегодня", "home"], ["journal", "Журнал", "journal"], ["group", "Группа", "group"], ["study", "Учёба", "exam"], ["tasks", "Внеучебка", "party"]];
  const app = $(".app"), view = $("#view"), topbar = $("#topbar"), nav = $("#nav"), fab = $("#fab"), actionbar = $("#actionbar");
  let lastRoute = "", current = null;

  // «Учёба» и «Внеучебка» открываются на той вкладке, где были в прошлый раз
  const navHref = id => id === "study" ? `#study/${S.studyView}` : id === "tasks" ? (S.tasksView === "docs" ? "#tasks/docs" : (EXTRA_VIEWS.find(v => v[0] === S.tasksView) || EXTRA_VIEWS[0])[2]) : `#${id}`;
  // счётчики у пунктов меню: неотмеченные пары сегодня, просроченные и сегодняшние дела
  function navBadges() {
    if (!DB || LOCKED) return {};
    const todo = activeOnly(dayLessons(TODAY)).filter(l => lessonState(l, TODAY) !== "future" && !DB.attendance[attKey(TODAY, l.id)]).length;
    const urgent = DB.tasks.filter(t => { const d = !t.done && parseISO(t.due); return d && d <= TODAY; }).length;
    return { journal: [todo, `Не отмечено пар сегодня: ${todo}`], tasks: [urgent, `Дел на сегодня и просроченных: ${urgent}`] };
  }
  // карточка «Идёт сейчас / Дальше» в боковой панели (только на ПК)
  function navNow() {
    if (!DB || LOCKED) return "";
    const ls = activeOnly(dayLessons(TODAY)), live = ls.find(l => lessonState(l, TODAY) === "live"), next = ls.find(l => lessonState(l, TODAY) === "future" && lessonSpan(l)[0]);
    const l = live || next; if (!l) return "";
    const [b, e] = lessonSpan(l), p = live ? Math.round((nowMin() - toMin(b)) / (toMin(e) - toMin(b)) * 100) : 0;
    return `<a class="nav__now${live ? " is-live" : ""}" href="#mark/${esc(l.id)}/${key(TODAY)}" title="Открыть отметку">
      <span class="nav__now-label">${live ? `<span class="pulse"></span>Идёт · до ${e}` : `${ic("clock")}Дальше · ${b}`}</span>
      <b>${esc(baseSubject(l.subject))}</b>${l.room ? `<small>${ic("door")}${esc(l.room)}</small>` : ""}
      ${live ? `<span class="nav__now-bar" role="img" aria-label="Прошло ${p}%"><i style="width:${p}%"></i></span>` : ""}</a>`;
  }
  function renderNav(active) {
    const badges = navBadges(), head = DB && !LOCKED && DB.students.find(s => s.role === "head");
    nav.innerHTML = `<a class="nav__brand" href="#home" title="Помощник старосты"><span class="brand__logo">${ic("school")}</span>
        <span class="nav__brand-text"><b>Помощник старосты</b><small>${esc(DB && !LOCKED ? groupName() : "НГТУ")}</small></span></a>
      <div class="nav__items">` +
      NAV.map(([id, n, i]) => { const [cnt, hint] = badges[id] || [];
        return `<a class="nav__item" href="${navHref(id)}"${active === id ? ' aria-current="page"' : ""} title="${n}${cnt ? ` — ${hint}` : ""}">${ic(i)}<span>${n}</span>${cnt ? `<em class="nav__badge" aria-label="${hint}">${cnt > 9 ? "9+" : cnt}</em>` : ""}</a>`; }).join("") +
      `</div>${navNow()}
      <div class="nav__foot">${head ? `<a class="nav__me" href="#student/${esc(head.id)}" title="${esc(head.name)}">${avatar(head)}<span class="nav__me-text"><b>${esc(shortName(head.name))}</b><small>Староста</small></span></a>` : ""}
        <button class="nav__item nav__item--theme" type="button" data-act="themeQuick" aria-label="Сменить тему" title="Светлая / тёмная">${ic(isDark() ? "sun" : "moon")}<span>Тема</span></button>
        <a class="nav__item nav__item--settings" href="#settings"${active === "settings" ? ' aria-current="page"' : ""} title="Настройки">${ic("cog")}<span>Настройки</span></a></div>`;
  }
  function renderTopbar(scr) {
    const acts = (scr.actions || []).map(([i, label, act, arg, arg2]) => act === "go"
      ? `<a class="icon-btn" href="${arg}" aria-label="${label}" title="${label}">${ic(i)}</a>`
      : `<button class="icon-btn" data-act="${act}" data-f="${esc(arg || "")}" data-id="${esc(arg2 || "")}" aria-label="${label}" title="${label}">${ic(i)}</button>`).join("");
    if (scr.home) {
      topbar.className = "topbar topbar--home";
      topbar.innerHTML = `<div class="topbar__context"><span>Группа</span><b class="ellipsis">${esc(DB.settings.group || "Новая группа")}</b></div>
        <div class="topbar__actions"><button class="icon-btn" data-act="themeQuick" aria-label="Сменить тему" title="Светлая / тёмная">${ic(isDark() ? "sun" : "moon")}</button>
        <a class="icon-btn" href="#settings" aria-label="Настройки" title="Настройки">${ic("cog")}</a></div>`;
    } else {
      topbar.className = "topbar";
      topbar.innerHTML = `${scr.back ? `<a class="icon-btn back" href="${scr.back}" aria-label="Назад" title="Назад (Esc)">${ic("back")}</a>` : "<span></span>"}
        <div class="topbar__titles"><h1 class="topbar__title" title="${esc(scr.title)}">${esc(scr.title)}</h1>${scr.sub ? `<div class="topbar__sub">${esc(scr.sub)}</div>` : ""}</div>
        <div class="topbar__actions">${acts}</div>`;
    }
    syncTopbar();
  }
  function syncTopbar() { topbar.classList.toggle("is-stuck", !topbar.classList.contains("topbar--home") && window.scrollY > 6); }
  // #now — быстрое действие с иконки: отметка пары, которая идёт или будет следующей
  function nowRoute() {
    const ls = activeOnly(dayLessons(TODAY)), l = ls.find(x => lessonState(x, TODAY) === "live") || ls.find(x => lessonState(x, TODAY) === "future") || [...ls].reverse().find(x => !DB.attendance[attKey(TODAY, x.id)]);
    return l ? `#mark/${l.id}/${key(TODAY)}` : "#journal";
  }
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function render(keepScroll) {
    // новый экран мягко сменяет старый; перерисовка того же экрана (отметка, фильтр) — мгновенно
    if (!keepScroll && lastRoute && location.hash !== lastRoute && document.startViewTransition && !calm() && document.visibilityState === "visible") {
      const t = document.startViewTransition(() => draw(false)); [t.ready, t.finished, t.updateCallbackDone].forEach(p => p && p.catch(() => {})); return;
    }
    draw(keepScroll);
  }
  function draw(keepScroll) {
    // #demo — прямая ссылка на пример для гостей
    if (location.hash === "#demo") { history.replaceState(null, "", "#home"); if (!isDemo()) { ACT.demo(); if (!DB) return; } }
    if (DB && location.hash === "#now") history.replaceState(null, "", nowRoute());
    const [name, ...args] = (location.hash.slice(1) || "home").split("/");
    if (name !== "mark") MK = null;
    current = LOCKED ? lockScreen() : DB ? (SCREENS[name] || SCREENS.home)(...args.map(a => { try { return decodeURIComponent(a); } catch (e) { return a; } })) : welcomeScreen();
    renderTopbar(current); renderNav(current.nav || name);
    view.innerHTML = (isDemo() && !LOCKED && !current.focus ? demoStrip() : "") + current.html;
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
  let sheetT;
  function openSheet(html) {
    clearTimeout(sheetT); sheet.classList.remove("is-closing");
    if (sheet.hidden) sheetReturn = document.activeElement;
    sheet.innerHTML = `<div class="sheet__panel" role="dialog" aria-modal="true"><div class="sheet__grip"></div>${html}</div>`;
    sheet.hidden = false;
    if ($("#nntuGroups", sheet)) fillGroups();
    const lf = sheet.querySelector('form[data-form="many"], form[data-form="sgLists"]'); if (lf) listPreview(lf);
    setTimeout(() => { const f = sheet.querySelector("input:not([type=radio]), select, textarea"); f && f.focus(); }, 50);
  }
  function closeSheet() {
    if (sheet.hidden || sheet.classList.contains("is-closing")) return;
    const done = () => { sheet.hidden = true; sheet.innerHTML = ""; sheet.classList.remove("is-closing"); };
    if (calm()) done(); else { sheet.classList.add("is-closing"); sheetT = setTimeout(done, 200); }
    sheetReturn && sheetReturn.isConnected && sheetReturn.focus && sheetReturn.focus({ preventScroll: true });
  }
  sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
  const sheetHead = (icon, c, title) => `<div class="sheet__head"><span class="badge" style="--c:${c}">${ic(icon)}</span><h2>${esc(title)}</h2><button type="button" class="icon-btn" style="margin-left:auto" data-act="closeSheet" aria-label="Закрыть">${ic("close")}</button></div>`;
  // фото в форме студента: val — новое фото (data:…), «-» — убрать, пусто — оставить как есть
  const avaField = (p, val = "") => { const cur = val === "-" ? "" : val || p.ava || "";
    return `<div class="ava-field" id="avaField">${avatar({ name: p.name || "?", ava: cur }, "avatar--lg")}<div class="btn-row">
      <button type="button" class="btn btn--neutral btn--sm" data-act="avaForm">${ic("camera")}${cur ? "Другое фото" : "Добавить фото"}</button>
      ${cur ? `<button type="button" class="btn btn--ghost btn--sm" data-act="avaFormDel">Убрать</button>` : ""}</div><input type="hidden" name="ava" value="${esc(val)}"></div>`; };
  const setAvaField = (f, val) => { const s = DB.students.find(x => x.id === f.dataset.id) || {}; $("#avaField", f).outerHTML = avaField({ ...s, name: f.name.value.trim() || s.name }, val); };
  const field = (label, input) => `<div class="field"><label>${label}</label>${input}</div>`;
  const textarea = (name, value, rows = 3, ph = "") => `<textarea name="${name}" rows="${rows}" placeholder="${esc(ph)}" style="border-radius:14px;border:0;background:var(--field);padding:12px 14px;font-size:15px;resize:vertical">${esc(value)}</textarea>`;
  const formErr = `<p class="form-err" style="color:var(--bad-ink);font-size:13px;margin:-4px 0 10px" role="alert" hidden></p>`;
  const formBtns = (delAct, delId) => `${formErr}<div class="btn-row" style="margin-top:6px">${delAct ? `<button type="button" class="btn btn--danger" style="flex:0 0 48px;padding:0" data-act="${delAct}" data-id="${esc(delId)}" aria-label="Удалить">${ic("delete")}</button>` : ""}<button type="button" class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary">Сохранить</button></div>`;
  const select = (name, opts, val) => `<select name="${name}">${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(t)}</option>`; }).join("")}</select>`;
  const toggleRow = (act, attrs, p, on) => `<button type="button" class="card card--tap person mark" data-act="${act}" ${attrs} data-s="${on ? "+" : "-"}" style="min-height:56px">${avatar(p)}<div class="person__body"><div class="person__name">${esc(p.name)}</div></div><span class="mark__chip">${on ? ic("tick") : "—"}</span></button>`;
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
      ${[["task", "tasks", "Дело", "var(--bad)"], ["event", "party", "Событие", "var(--accent-5)"], ["schedAdd", "schedule", "Пару", "var(--accent-6)"], ["student", "add_one", "Студента", "var(--accent-2)"],
        ["work", "works", "Сдачу работы", "var(--accent-6)"], ["fund", "cash", "Сбор денег", "var(--accent-3)"], ["exam", "exam", "Экзамен", "var(--accent-1)"],
        ["doc", "doc", "Документ в деканат", "var(--accent-4)"], ["poll", "poll", "Опрос", "var(--accent-5)"]].map(([k, i, n, c]) =>
        `<button class="card card--tap" data-act="form" data-f="${k}"><span class="badge" style="--c:${c}">${ic(i)}</span><b>${n}</b></button>`).join("")}
        <button class="card card--tap" data-act="goTemplates"><span class="badge" style="--c:var(--accent-2)">${ic("chat")}</span><b>Сообщение по шаблону</b></button></div>`,
    task: (id) => { const t = DB.tasks.find(x => x.id === id) || {}; return `${sheetHead("tasks", "var(--bad)", t.id ? "Дело" : "Новое дело")}<form data-form="task" data-id="${esc(t.id || "")}">
      ${field("Заголовок", `<input name="title" required value="${esc(t.title || "")}" placeholder="Например, сдать список в деканат">`)}
      <div class="grid grid--cols2" style="gap:0 12px">${field("Тип", select("kind", Object.keys(TASK_KINDS), t.kind || "Дедлайн"))}
      ${field("Срок (необязательно)", `<input name="due" type="date" value="${esc(t.due || "")}">`)}</div>
      ${field("Предмет (необязательно)", `<input name="subject" value="${esc(t.subject || "")}" list="subjList"><datalist id="subjList">${baseSubjects().map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
      ${field("Подробности", textarea("text", t.text || ""))}${formBtns(t.id && "delTask", t.id)}</form>`; },
    work: (id) => { const w = DB.works.find(x => x.id === id) || {};
      return `${sheetHead("works", "var(--accent-6)", w.id ? "Работа" : "Новая работа")}<form data-form="work" data-id="${esc(w.id || "")}">
      ${field("Что сдаём", `<input name="title" required value="${esc(w.title || "")}" placeholder="Лабораторная №3">`)}
      ${field("Предмет (для подгруппы выберите «… (подгруппа N)»)", `<input name="subject" value="${esc(w.subject || "")}" list="subjects"><datalist id="subjects">${subjects().map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
      ${field("Срок (необязательно)", `<input name="due" type="date" value="${esc(w.due || "")}">`)}
      ${formBtns(w.id && "delWork", w.id)}</form>`; },
    fund: (id) => { const f = DB.funds.find(x => x.id === id) || {};
      return `${sheetHead("cash", "var(--accent-3)", f.id ? "Сбор" : "Новый сбор")}<form data-form="fund" data-id="${esc(f.id || "")}">
      ${field("На что собираем", `<input name="title" required value="${esc(f.title || "")}" placeholder="Подарок куратору">`)}
      <div class="grid grid--cols2" style="gap:0 12px">${field("С человека, ₽", `<input name="amount" type="number" min="0" step="10" inputmode="numeric" required value="${esc(f.amount ?? "")}" placeholder="200">`)}
      ${field("Собрать до (необязательно)", `<input name="due" type="date" value="${esc(f.due || "")}">`)}</div>
      ${formBtns(f.id && "delFund", f.id)}</form>`; },
    exam: (id) => { const x = DB.exams.find(e => e.id === id) || {};
      return `${sheetHead("exam", "var(--accent-1)", x.id ? "Сессия" : "Экзамен или зачёт")}<form data-form="exam" data-id="${esc(x.id || "")}">
      ${field("Предмет", `<input name="subject" required value="${esc(x.subject || "")}" list="subjList2" placeholder="Математика"><datalist id="subjList2">${baseSubjects().map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
      <div class="grid grid--cols2" style="gap:0 12px">${field("Что", select("kind", EXAM_KINDS, x.kind || "Экзамен"))}
      ${field("Дата", `<input name="date" type="date" required value="${esc(x.date || "")}">`)}
      ${field("Время", `<input name="time" type="time" value="${esc(x.time || "")}">`)}
      ${field("Аудитория", `<input name="room" value="${esc(x.room || "")}" placeholder="6125, корп. 6">`)}</div>
      ${field("Преподаватель", `<input name="teacher" value="${esc(x.teacher || "")}" list="teacherList"><datalist id="teacherList">${DB.teachers.map(t => `<option value="${esc(t.name)}">`).join("")}</datalist>`)}
      ${field("Заметка (билеты, что взять с собой)", textarea("note", x.note || "", 2))}
      ${x.id && x.kind !== "Консультация" ? `<a class="btn btn--soft btn--block" style="margin-bottom:8px" href="#grades/${esc(x.id)}" data-act="closeSheetGo">${ic("star")}Ведомость: оценки и долги</a>` : ""}
      ${formBtns(x.id && "delExam", x.id)}</form>`; },
    doc: (id) => { const x = DB.docs.find(e => e.id === id) || {};
      return `${sheetHead("doc", "var(--accent-4)", x.id ? "Документ" : "Справка или заявление")}<form data-form="doc" data-id="${esc(x.id || "")}">
      ${field("Что сдаём", `<input name="title" required value="${esc(x.title || "")}" list="docHints" placeholder="Справка 086/у"><datalist id="docHints">${DOC_HINTS.map(h => `<option value="${esc(h)}">`).join("")}</datalist>`)}
      <div class="grid grid--cols2" style="gap:0 12px">${field("Срок (необязательно)", `<input name="due" type="date" value="${esc(x.due || "")}">`)}
      ${field("Куда сдавать", `<input name="note" value="${esc(x.note || "")}" placeholder="Деканат, каб. 6-215">`)}</div>
      ${formBtns(x.id && "delDoc", x.id)}</form>`; },
    poll: (id) => { const p = DB.polls.find(e => e.id === id) || {};
      return `${sheetHead("poll", "var(--accent-5)", p.id ? "Опрос" : "Новый опрос")}<form data-form="poll" data-id="${esc(p.id || "")}">
      ${field("Вопрос", `<input name="title" required value="${esc(p.title || "")}" placeholder="Когда удобно собрание?">`)}
      ${field("Варианты — по одному на строку", textarea("options", (p.options || []).join("\n"), 5, "Вторник после 3-й пары\nЧетверг после 4-й пары\nПятница онлайн"))}
      <div class="grid grid--cols2" style="gap:0 12px">${field("Ответить до (необязательно)", `<input name="due" type="date" value="${esc(p.due || "")}">`)}
      <label class="check-row" style="align-self:center"><input type="checkbox" name="multi"${p.multi ? " checked" : ""}> Можно несколько ответов</label></div>
      ${p.id ? `<p class="hint" style="text-align:left;margin:0 0 10px">Если убрать вариант, ответы за него пропадут.</p>` : ""}${formBtns(p.id && "delPoll", p.id)}</form>`; },
    tpl: (id) => { const t = DB.templates.find(e => e.id === id) || {};
      return `${sheetHead("chat", "var(--accent-2)", t.id ? "Шаблон" : "Новый шаблон")}<form data-form="tpl" data-id="${esc(t.id || "")}">
      ${field("Название", `<input name="title" required value="${esc(t.title || "")}" placeholder="Отсутствующие — преподавателю">`)}
      ${field("Текст", textarea("text", t.text || "", 6, "Здравствуйте! На паре {пара} {дата} отсутствовали: {отсутствующие}."))}
      <p class="hint" style="text-align:left;margin:-4px 0 6px">Нажмите, чтобы вставить:</p>
      <div class="tpl-insert">${tplValues().map(([k, hint]) => `<button type="button" class="chip-btn" data-act="tplInsert" data-v="{${k}}" title="${esc(hint)}">{${k}}</button>`).join("")}</div>
      ${formBtns(t.id && "delTpl", t.id)}</form>`; },
    contacts: () => `${sheetHead("contact", "var(--accent-2)", "Контакты списком")}<form data-form="contacts">
      <p class="muted" style="margin:-6px 0 12px;font-size:14px">Вставьте таблицу из Excel, Google Таблиц или ответов Google Формы — или загрузите файл (.xlsx, .csv, контакты телефона .vcf). Каждого найдём по ФИО и заполним телефон, почту, Telegram и день рождения.</p>
      ${field("Таблица или контакты", textarea("list", "", 8, "ФИО\tТелефон\tПочта\tTelegram\tДень рождения\nИванов Иван\t89001234567\tivanov@mail.ru\t@ivanov\t05.11.2007"))}
      <div class="btn-row" style="margin:-4px 0 10px"><button type="button" class="btn btn--neutral btn--sm" data-act="contactsFile">${ic("excel")}Из файла: .xlsx, .csv, .vcf</button><button type="button" class="btn btn--neutral btn--sm" data-act="avaMany">${ic("camera")}Фото группы</button></div>
      <p class="hint" style="text-align:left;margin:-2px 0 10px">«Фото группы»: выберите сразу несколько фото, названных по фамилии — «Иванов.jpg», «Петрова Анна.png».</p>
      <label class="check-row"><input type="checkbox" name="overwrite"> Заменять уже заполненные поля</label>
      <label class="check-row"><input type="checkbox" name="addMissing"> Добавить в группу тех, кого в ней нет</label>
      <div class="list-preview" id="listPreview" aria-live="polite"></div>
      ${formErr}<div class="btn-row"><button type="button" class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary">Заполнить</button></div></form>`,
    sick: (id, sid) => { const x = DB.sick.find(e => e.id === id) || { sid: sid || S.sickFor, from: key(TODAY), to: key(TODAY) }, s = DB.students.find(e => e.id === x.sid);
      return `${sheetHead("sick", "var(--accent-5)", x.id ? "Больничный" : "Новый больничный")}<form data-form="sick" data-id="${esc(x.id || "")}" data-sid="${esc(x.sid || "")}">
      <p class="muted" style="margin:-6px 0 12px;font-size:14px">${esc(s ? s.name : "")}</p>
      <div class="grid grid--cols2" style="gap:0 12px">${field("С", `<input name="from" type="date" required value="${esc(x.from)}">`)}${field("По", `<input name="to" type="date" required value="${esc(x.to)}">`)}</div>
      ${field("Заметка (необязательно)", `<input name="note" value="${esc(x.note || "")}" placeholder="Справка № …">`)}
      <label class="file-row">${ic("camera")}<span>${x.photo ? "Фото справки сохранено — выбрать другое" : "Фото справки (необязательно)"}</span><input type="file" name="photo" accept="image/*" capture="environment"></label>
      <p class="hint" style="text-align:left;margin:4px 0 12px">Все пары в эти дни отметятся как «У» — уважительная причина. Фото хранится только на этом устройстве и не попадает в копию данных.</p>
      ${formBtns(x.id && "delSick", x.id)}</form>`; },
    pin: () => `${sheetHead("lock", "var(--primary)", pinSet() ? "Новый код-пароль" : "Код-пароль")}<form data-form="pin">
      <div class="grid grid--cols2" style="gap:0 12px">${field("Код из 4 цифр", `<input name="p1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" required>`)}
      ${field("Ещё раз", `<input name="p2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" required>`)}</div>
      <p class="hint" style="text-align:left;margin:-4px 0 12px">Код спросим при открытии приложения и после 5 минут в фоне. Восстановить его нельзя — запомните или сохраните копию данных.</p>${formBtns()}</form>`,
    risk: () => `${sheetHead("risk", "var(--warn)", "Риск недопуска")}<form data-form="risk">
      ${field("Порог посещаемости по предмету, %", `<input name="pct" type="number" min="10" max="100" step="5" inputmode="numeric" value="${riskPct()}">`)}
      <p class="hint" style="text-align:left;margin:-4px 0 12px">Студент попадает в список, если по какому-то предмету посещаемость ниже порога (считаем, когда отмечено хотя бы 3 занятия). Уважительные пропуски не учитываются.</p>${formBtns()}</form>`,
    event: (id) => { const e = DB.events.find(x => x.id === id) || {}; return `${sheetHead("party", "var(--accent-5)", e.id ? "Событие" : "Новое событие")}<form data-form="event" data-id="${esc(e.id || "")}">
      ${field("Название", `<input name="title" required value="${esc(e.title || "")}" placeholder="Собрание группы">`)}
      <div class="grid grid--cols2" style="gap:0 12px">${field("Категория", select("kind", Object.keys(EVENT_KINDS), e.kind || "Учёба"))}
      ${field("Дата", `<input name="date" type="date" required value="${esc(e.date || key(TODAY))}">`)}
      ${field("Время", `<input name="time" type="time" value="${esc(e.time || "")}">`)}
      ${field("Место", `<input name="place" value="${esc(e.place || "")}" placeholder="6245, корп. 6">`)}</div>
      ${field("Описание", textarea("text", e.text || ""))}${formBtns(e.id && "delEvent", e.id)}</form>`; },
    lesson: (id) => { const l = DB.lessons.find(x => x.id === id), b = bells();
      return `${sheetHead("schedule", "var(--accent-6)", l ? "Пара" : "Новая пара")}<form data-form="lesson" data-id="${esc(l?.id || "")}">
      ${field("Предмет", `<input name="subject" required value="${esc(l?.subject || "")}" list="subjects" placeholder="Информатика (подгруппа 1)"><datalist id="subjects">${subjects().map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
      <p class="hint" style="text-align:left;margin:-6px 0 10px">Для пары подгруппы допишите «(подгруппа N)».</p>
      <div class="grid grid--cols2" style="gap:0 12px">
        ${field("Тип занятия", select("kind", ["Лекция", "Практика", "Лабораторная", "Семинар", "Другое"], l?.kind || "Лекция"))}
        ${field("День недели", select("day", WD_PY.map((n, i) => [i, n]), l?.day ?? Math.min(pyDay(S.journalDate || TODAY), 5)))}
        ${field("Номер пары", select("num", b.map((x, i) => [i + 1, `${i + 1} пара · ${x[0]}–${x[1]}`]), l?.num || 1))}
        ${field("Неделя", select("week", [["all", "Каждую неделю"], ["odd", "Только нечётная"], ["even", "Только чётная"]], l?.week || "all"))}
        ${field("Аудитория", `<input name="room" value="${esc(l?.room || "")}" placeholder="6342, корп. 6">`)}
      </div>
      ${field("Преподаватель", `<input name="teacher" value="${esc(l?.teacher || "")}" list="teacherList" placeholder="Иванов И. И."><datalist id="teacherList">${DB.teachers.map(t => `<option value="${esc(t.name)}">`).join("")}</datalist>`)}
      ${l?.start ? `<p class="hint" style="text-align:left;margin:-4px 0 10px">У пары своё время ${esc(l.start)}–${esc(l.end)} — оно сохранится.</p>` : ""}
      ${formBtns(l && "delLesson", l?.id)}</form>`; },
    // разовая пара на конкретный день (в журнале — сразу к отметке)
    oneoff: (id, toMark) => { const o = DB.oneoff.find(x => x.id === id), d = o ? o.date : key(toMark ? (S.journalDate || TODAY) : (S.journalDate || TODAY));
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
    // напоминание о днях рождения (за неделю и в сам день)
    // в окне — только те, по кому напоминание ещё не видели
    bdays: () => { const list = bdayPending().length ? bdayPending() : upcomingBdays(BDAY_AHEAD), today = list.some(x => x.n === 0);
      return `${sheetHead("cake", "var(--accent-5)", today && list.length === 1 ? "День рождения сегодня" : "Скоро дни рождения")}
        <div class="list list--sheet">${list.map(x => `<div class="list__row">${avatar(x.s)}<div class="person__body"><div class="person__name">${esc(x.s.name)}</div>
          <div class="person__meta">${x.n === 0 ? `<b style="color:var(--primary-ink)">сегодня</b>` : esc(bdayWhen(x))}${x.age ? ` · исполнится ${x.age}` : ""}</div></div>
          <button type="button" class="icon-btn" data-act="copyText" data-t="${esc(greeting(x.s))}" aria-label="Скопировать поздравление для ${esc(x.s.name)}" title="Скопировать поздравление">${ic("copy")}</button></div>`).join("")}</div>
        <p class="hint" style="text-align:left;margin:10px 0 14px">Кнопка ${ic("copy")} копирует поздравление для чата группы. Напоминаем за неделю и в сам день.</p>
        <div class="btn-row"><button class="btn btn--neutral" data-act="bdaySnooze">Напомнить завтра</button><button class="btn btn--primary" data-act="bdaySeen">Понятно</button></div>`; },
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
        <div class="btn-row" style="margin-bottom:8px">${copyBtn("Изменения в расписании (по сайту НГТУ):\n" + L.changes.map(c => { const [a, b] = line(c); return `• ${a}: ${b}`; }).join("\n"), "Скопировать для чата группы", "btn btn--soft btn--block")}</div>
        <div class="btn-row"><button class="btn btn--neutral" data-act="liveDismiss">Не сейчас</button><button class="btn btn--primary" data-act="liveApply">Применить</button></div>`
        : `<p style="margin-bottom:14px">На ближайшие дни расписание совпадает с сайтом.</p><button class="btn btn--primary btn--block" data-act="closeSheet">Готово</button>`}
        ${perm ? `<p class="hint" style="text-align:left;margin-top:14px">Похоже, на сайте поменялось и постоянное расписание (${perm} ${plural(perm, ["отличие", "отличия", "отличий"])}). <button class="link" data-act="form" data-f="nntu">Обновить постоянное расписание</button></p>` : ""}`; },
    student: (id) => { const s = DB.students.find(x => x.id === id), n = splitSize(null);
      return `${sheetHead("add_one", "var(--accent-2)", s ? "Студент" : "Новый студент")}<form data-form="student" data-id="${esc(s?.id || "")}">
      ${avaField(s || { name: "" })}
      ${field("Фамилия и имя", `<input name="name" required value="${esc(s?.name || "")}" placeholder="Иванов Иван">`)}
      <div class="grid grid--cols2" style="gap:0 12px">
        ${field("Роль в группе", select("role", [["", "Студент"], ["head", "Староста"], ["deputy", "Зам. старосты"]], s?.role || ""))}
        ${field("Подгруппа", select("subgroup", [[0, "Не указана"], ...Array.from({ length: Math.max(n, 3) }, (_, i) => [i + 1, `${i + 1}-я подгруппа`])], s?.subgroup || 0))}
        ${field("Телефон", `<input name="phone" type="tel" value="${esc(s?.phone || "")}" placeholder="+7 900 000-00-00">`)}
        ${field("День рождения", `<input name="birthday" inputmode="decimal" autocomplete="off" value="${esc(s?.birthday || "")}" placeholder="05.11 или 05.11.2007">`)}
        ${field("Почта", `<input name="email" type="email" value="${esc(s?.email || "")}" placeholder="ivanov@mail.ru">`)}
        ${field("Telegram", `<input name="telegram" value="${esc(s?.telegram ? tgLabel(s.telegram) : "")}" placeholder="@username">`)}
      </div><p class="hint" style="text-align:left;margin:-4px 0 12px">${ic("cake")} За неделю до дня рождения и в сам день приложение напомнит. С годом рождения покажем, сколько исполнится.</p>
      ${field("Заметка", textarea("note", s?.note || ""))}${formBtns(s && "delStudent", s?.id)}</form>`; },
    // академический отпуск и отчисление
    academ: (id) => { const s = DB.students.find(x => x.id === id) || {}, cur = s.status === "academ";
      return `${sheetHead("calendar", "var(--warn)", "Академический отпуск")}<form data-form="academ" data-id="${esc(id)}">
      <p class="muted" style="margin:-6px 0 12px;font-size:14px">${esc(s.name || "")}</p>
      <div class="grid grid--cols2" style="gap:0 12px">${field("С какого числа", `<input name="from" type="date" required value="${esc(cur ? s.status_from : key(TODAY))}">`)}${field("До (если известно)", `<input name="to" type="date" value="${esc(cur ? s.status_to || "" : "")}">`)}</div>
      ${field("Приказ или причина", `<input name="note" value="${esc(cur ? s.status_note || "" : "")}" placeholder="Приказ № 123 от 01.10, по здоровью">`)}
      <p class="hint" style="text-align:left;margin:0 0 12px">С этой даты студента не будет в отметках, сдачах и сборах. С датой выхода он вернётся в списки сам.</p>${formBtns()}</form>`; },
    expel: (id) => { const s = DB.students.find(x => x.id === id) || {}, cur = s.status === "expelled";
      return `${sheetHead("close", "var(--bad)", "Отчисление")}<form data-form="expel" data-id="${esc(id)}">
      <p class="muted" style="margin:-6px 0 12px;font-size:14px">${esc(s.name || "")}</p>
      ${field("Дата отчисления", `<input name="from" type="date" required value="${esc(cur ? s.status_from : key(TODAY))}">`)}
      ${field("Приказ или причина", `<input name="note" value="${esc(cur ? s.status_note || "" : "")}" placeholder="Приказ № 123 от 01.10, по собственному желанию">`)}
      <p class="hint" style="text-align:left;margin:0 0 12px">Студент перейдёт в раздел «Отчислены». Прошлые отметки останутся в журнале, итогах и выгрузке. Если ошиблись — «Восстановить в группе» в его карточке.</p>${formBtns()}</form>`; },
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
      <div class="stack" style="gap:6px">${students().filter(s => s.role !== "head").map(s => toggleRow("deputyToggle", `data-id="${esc(s.id)}"`, s, s.role === "deputy")).join("")}</div>${doneBtn}`,
    going: (id) => { const e = DB.events.find(x => x.id === id), g = new Set(e.going || []);
      return `${sheetHead("going", "var(--primary)", "Кто идёт")}<p class="muted" style="margin:-6px 0 12px;font-size:14px">${esc(e.title)}</p>
      <div class="stack" style="gap:6px">${students().map(s => toggleRow("goingToggle", `data-e="${esc(e.id)}" data-id="${esc(s.id)}"`, s, g.has(s.id))).join("")}</div>${doneBtn}`; },
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
      const p = PLAN;
      const list = (title, items, line, cls) => items.length ? `<h3 class="plan__title">${title} <span class="pill ${cls} num">${items.length}</span></h3>
        <ul class="plan__list">${items.slice(0, 8).map(x => `<li>${line(x)}</li>`).join("")}${items.length > 8 ? `<li class="muted">и ещё ${items.length - 8}</li>` : ""}</ul>` : "";
      const FN = { week: "неделя", kind: "тип", room: "аудитория", teacher: "преподаватель", start: "начало", end: "конец" };
      const val = (f, v) => f === "week" ? ({ all: "каждую", odd: "нечётная", even: "чётная" }[v || "all"]) : (v || "—");
      if (p.empty) return `${sheetHead("tick", "var(--primary)", "Расписание НГТУ")}<p style="margin-bottom:16px">Группа ${esc(p.group)}: расписание совпадает с сайтом НГТУ — менять нечего.</p>
        <button class="btn btn--primary btn--block btn--lg" data-act="nntuApply">Готово</button>`;
      return `${sheetHead("download", "var(--primary)", "Что изменится")}
        <p class="muted" style="margin:-6px 0 12px;font-size:14px">Группа ${esc(p.group)}${p.same ? ` · без изменений: ${p.same}` : ""}</p>
        ${list("Добавятся", p.add, l => `${esc(lessonLine(l))}<small>${esc([l.kind, weekTag(l.week), l.room].filter(Boolean).join(" · "))}</small>`, "pill--ok")}
        ${list("Изменятся", p.upd, x => `${esc(lessonLine(x.o))}<small>${x.ch.map(f => `${FN[f]}: ${esc(val(f, x.o[f]))} → ${esc(val(f, x.n[f]))}`).join("; ")}</small>`, "pill--warn")}
        ${list("Уберутся", p.del, l => `${esc(lessonLine(l))}<small>${esc([l.kind, weekTag(l.week)].filter(Boolean).join(" · "))}</small>`, "pill--bad")}
        ${p.bells ? `<h3 class="plan__title">Звонки</h3><p class="muted" style="font-size:13px;margin-bottom:12px">${p.bells.map(b => b.replace("-", "–")).join(", ")}</p>` : ""}
        <p class="hint" style="text-align:left;margin:4px 0 14px">Отметки в журнале сохранятся. Сайт показывает только две ближайшие недели: разовый перенос пары попадёт в расписание как постоянный — его можно поправить вручную.</p>
        <div class="btn-row"><button class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--primary" data-act="nntuApply">Применить</button></div>`;
    },
    term: () => { const t = term();
      return `${sheetHead("calendar", "var(--primary)", "Период занятий")}<form data-form="term">
        <div class="grid grid--cols2" style="gap:0 12px">${field("Первый день занятий", `<input name="start" type="date" required value="${key(t.start)}">`)}${field("Последний день", `<input name="end" type="date" required value="${key(t.end)}">`)}</div>
        ${field(`Эта неделя (с ${fmtDate(monday(TODAY))})`, select("parity", [["odd", "Нечётная"], ["even", "Чётная"]], weekInfo(TODAY).parity))}
        <p class="hint" style="text-align:left;margin:0 0 12px">Расписание вуза известно на один семестр: в эти дни пары идут по неделям, с учётом чётности. Начался новый семестр — поменяйте даты и загрузите расписание с сайта НГТУ заново.</p>${formBtns()}</form>`; },
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
      case "term": {
        const a = parseISO(v.start), z = parseISO(v.end);
        if (!a || !z) return err("Укажите первый и последний день занятий");
        if (a >= z) return err("Последний день должен быть позже первого");
        // номер этой недели от начала и её чётность, которую указал староста → чётность первой недели
        const wk = Math.floor(daysBetween(monday(a), monday(TODAY)) / 7) + 1, wkOdd = (((wk % 2) + 2) % 2) === 1;
        DB.settings.term = { start: v.start, end: v.end, first_week_odd: wkOdd === (v.parity === "odd") }; break;
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
        Object.assign(l, { subject: trim(v.subject).replace(/\s+/g, " "), day: +v.day, num: +v.num, week: v.week, kind: v.kind, room: trim(v.room), teacher: trim(v.teacher) });
        if (!id) { DB.lessons.push(l); msg = "Пара добавлена"; }
        ensureTeacher(l.teacher); break;
      }
      case "work": {
        if (!trim(v.title)) return err("Укажите, что сдаём");
        const w = DB.works.find(x => x.id === id) || { id: newId(), created: Date.now(), done: {} };
        Object.assign(w, { title: trim(v.title), subject: trim(v.subject).replace(/\s+/g, " "), due: v.due || "" });
        if (!id) { DB.works.push(w); msg = "Работа добавлена — отмечайте, кто сдал"; go = `#check/works/${w.id}`; S.studyView = "works"; }
        break;
      }
      case "fund": {
        if (!trim(v.title)) return err("Укажите, на что собираем");
        if (!(+v.amount > 0)) return err("Укажите сумму с человека");
        const fu = DB.funds.find(x => x.id === id) || { id: newId(), created: Date.now(), paid: {} };
        Object.assign(fu, { title: trim(v.title), amount: Math.round(+v.amount), due: v.due || "" });
        if (!id) { DB.funds.push(fu); msg = "Сбор создан — отмечайте, кто сдал"; go = `#check/funds/${fu.id}`; S.tasksView = "funds"; }
        break;
      }
      case "exam": {
        if (!trim(v.subject)) return err("Укажите предмет");
        if (!parseISO(v.date)) return err("Выберите дату");
        const x = DB.exams.find(e => e.id === id) || { id: newId() };
        Object.assign(x, { subject: trim(v.subject), kind: v.kind, date: v.date, time: v.time || "", room: trim(v.room), teacher: trim(v.teacher), note: trim(v.note) });
        if (!id) { DB.exams.push(x); msg = "Добавлено в сессию"; S.studyView = "exams"; S.examsPast = parseISO(v.date) < TODAY; }
        break;
      }
      case "doc": {
        if (!trim(v.title)) return err("Укажите, что сдаём");
        const x = DB.docs.find(e => e.id === id) || { id: newId(), created: Date.now(), done: {} };
        Object.assign(x, { title: trim(v.title), due: v.due || "", note: trim(v.note) });
        if (!id) { DB.docs.push(x); msg = "Документ добавлен — отмечайте, кто сдал"; go = `#check/docs/${x.id}`; S.tasksView = "docs"; }
        break;
      }
      case "poll": {
        const opts = String(v.options || "").split(/\r?\n/).map(trim).filter(Boolean);
        if (!trim(v.title)) return err("Напишите вопрос");
        if (opts.length < 2) return err("Нужно хотя бы два варианта — по одному на строку");
        const p = DB.polls.find(e => e.id === id) || { id: newId(), created: Date.now(), answers: {} };
        Object.assign(p, { title: trim(v.title), options: opts, multi: !!v.multi, due: v.due || "" });
        // ответы за удалённые варианты убираем, при смене на «один ответ» оставляем первый
        Object.keys(p.answers || {}).forEach(sid => { let a = [].concat(p.answers[sid]).filter(i => i < opts.length); if (!p.multi) a = a.slice(0, 1); if (a.length) p.answers[sid] = p.multi ? a : a[0]; else delete p.answers[sid]; });
        if (!id) { DB.polls.push(p); msg = "Опрос создан — скопируйте его в чат"; go = `#poll/${p.id}`; S.tasksView = "polls"; }
        break;
      }
      case "tpl": {
        if (!trim(v.title) || !trim(v.text)) return err("Нужны название и текст");
        const t = DB.templates.find(e => e.id === id) || { id: newId() };
        Object.assign(t, { title: trim(v.title), text: String(v.text).trim() });
        if (!id) { DB.templates.push(t); msg = "Шаблон добавлен"; }
        break;
      }
      case "contacts": {
        const pl = contactsPlan(f);
        if (!pl.rows.length) return err("Не нашли ни одного ФИО — нужен столбец с фамилией и именем");
        if (pl.many.length) return err(`Уточните имя — в группе несколько похожих: ${pl.many.join(", ")}`);
        if (!pl.upd.length && !pl.fresh.length) return err("Нового нечего заполнить");
        pl.upd.forEach(({ s, val, ch }) => ch.forEach(k => { s[k] = val[k]; }));
        pl.fresh.forEach(x => DB.students.push({ id: newId(), name: x.name, phone: x.phone, email: x.email, telegram: x.telegram, birthday: x.birthday, note: "", role: "" }));
        msg = `Контакты заполнены: ${pl.upd.length}${pl.fresh.length ? ` · добавлено в группу: ${pl.fresh.length}` : ""}${pl.unknown.length ? ` · не нашли: ${pl.unknown.length}` : ""}`; break;
      }
      case "sick": {
        const a = parseISO(v.from), z = parseISO(v.to);
        if (!a || !z) return err("Укажите даты");
        if (z < a) return err("Дата «по» раньше, чем «с»");
        const x = DB.sick.find(e => e.id === id) || { id: newId(), sid: f.dataset.sid };
        Object.assign(x, { from: v.from, to: v.to, note: trim(v.note) });
        if (!id) DB.sick.push(x);
        const n = applySick(x);
        msg = n ? `Больничный сохранён · «Н» → «У»: ${n}` : "Больничный сохранён";
        const file = f.photo && f.photo.files[0];
        if (file) shrinkImage(file).then(b => PHOTOS.put(x.id, b)).then(() => { x.photo = true; persist(); render(true); toast("Фото справки сохранено", "camera"); })
          .catch(() => toast("Не удалось сохранить фото", "info"));
        break;
      }
      case "pin": {
        if (!/^\d{4}$/.test(v.p1 || "")) return err("Код — ровно 4 цифры");
        if (v.p1 !== v.p2) return err("Коды не совпадают");
        const salt = newId();
        return pinHash(v.p1, salt).then(hash => { store.set("pin", { salt, hash }); closeSheet(); render(true); toast("Код-пароль включён", "lock"); })
          .catch(() => err("Не удалось сохранить код: браузер не поддерживает шифрование на этом адресе"));
      }
      case "risk": {
        const p = Math.round(+v.pct);
        if (!(p >= 10 && p <= 100)) return err("Порог — от 10 до 100 %");
        DB.settings.risk_pct = p; break;
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
        else { S.journalDate = parseISO(v.date); }
        break;
      }
      case "move": {
        const { id: lid, d } = S.menu, l = dayPlan(d).find(x => x.id === lid), nd = parseISO(v.date);
        if (!l) return err("Пара не найдена");
        if (!nd) return err("Выберите дату");
        if (!(+v.num > 0)) return err("Выберите, на какую пару перенести");
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
        S.journalDate = nd; break;
      }
      case "student": {
        if (!trim(v.name)) return err("Укажите фамилию и имя");
        if (trim(v.birthday) && !parseBday(v.birthday)) return err("День рождения — в формате ДД.ММ или ДД.ММ.ГГГГ");
        const [tg, tgErr] = normTelegram(v.telegram); if (tgErr) return err(tgErr);
        if (trim(v.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(v.email))) return err("Почта — в виде name@mail.ru");
        const s = DB.students.find(x => x.id === id) || { id: newId(), name: "", phone: "", birthday: "", note: "", role: "" };
        if (v.role === "head") DB.students.forEach(o => { if (o !== s && o.role === "head") o.role = ""; }); // староста в группе один
        Object.assign(s, { name: trim(v.name).replace(/\s+/g, " "), role: v.role, subgroup: +v.subgroup, phone: trim(v.phone), birthday: trim(v.birthday), note: trim(v.note), email: trim(v.email), telegram: tg || "" });
        if (v.ava === "-") delete s.ava; else if (v.ava) s.ava = v.ava;
        if (!id) { DB.students.push(s); msg = "Студент добавлен"; } break;
      }
      case "academ": case "expel": {
        const s = DB.students.find(x => x.id === id); if (!s) break;
        if (!parseISO(v.from)) return err("Укажите дату");
        if (v.to && v.to <= v.from) return err("Дата выхода должна быть позже начала");
        Object.assign(s, { status: f.dataset.form === "expel" ? "expelled" : "academ", status_from: v.from, status_to: f.dataset.form === "expel" ? "" : (v.to || ""), status_note: trim(v.note) });
        msg = f.dataset.form === "expel" ? "Студент отчислен — прошлые отметки сохранены" : "Академический отпуск оформлен"; break;
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
      inp.addEventListener("change", () => { const d = parseISO(inp.value); if (d) { S.journalDate = d; render(true); } inp.remove(); });
      inp.addEventListener("blur", () => setTimeout(() => inp.remove(), 300));
      if (inp.showPicker) { try { inp.showPicker(); } catch (e) { inp.click(); } } else inp.click();
    },
    schedTomorrow: () => { S.journalDate = addDays(TODAY, 1); },
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
      else { text = head; if (t.absent.length) text += "\n\nОтсутствуют:\n" + nameList(t.absent.map(s => s.name)); if (t.excused.length) text += "\n\nПо уважительной причине:\n" + nameList(t.excused.map(s => s.name)); }
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
    // ----- код-пароль
    pinKey: el => pinKey(el.dataset.k),
    pinOff: el => {
      if (!confirmed(el)) return openSheet(`${sheetHead("lock", "var(--primary)", "Выключить код-пароль?")}<p style="margin-bottom:16px">Приложение будет открываться без кода.</p>
        <div class="btn-row"><button class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--danger" data-act="pinOff" data-confirmed="1">Выключить</button></div>`);
      store.set("pin", null); closeSheet(); render(true); toast("Код-пароль выключен", "lock");
    },
    pinForgot: () => openSheet(`${sheetHead("lock", "var(--warn)", "Забыли код?")}
      <p style="margin-bottom:10px">Код нельзя восстановить: он нигде не хранится в открытом виде.</p>
      <p class="muted" style="font-size:14px;margin-bottom:16px">Можно стереть данные этого браузера и загрузить сохранённую копию (файл .json). Без копии отметки пропадут.</p>
      <div class="btn-row"><button class="btn btn--neutral" data-act="closeSheet">Отмена</button><button class="btn btn--danger" data-act="pinReset">Стереть данные</button></div>`),
    pinReset: el => {
      if (!confirmed(el)) return openSheet(FORMS.confirm("Стереть все данные группы в этом браузере?", "pinReset", "", "Стереть"));
      try { localStorage.removeItem(DATA_KEY); store.set("pin", null); } catch (e) { /* ничего */ }
      DB = null; LOCKED = false; PIN_IN = ""; closeSheet(); location.hash = ""; render(); toast("Данные стёрты", "delete");
    },
    // ----- сдачи, сборы, сессия
    worksDone: el => { S.worksDone = el.dataset.v === "1"; render(true); },
    examsPast: el => { S.examsPast = el.dataset.v === "1"; render(true); },
    checkToggle: el => {
      const kind = el.dataset.k, it = CHECK[kind].arr().find(x => x.id === el.dataset.i), m = checkMap(kind, it), sid = el.dataset.id;
      if (m[sid]) delete m[sid]; else m[sid] = 1;
      persist(); render(true);
      const nu = $(`[data-act="checkToggle"][data-id="${CSS.escape(sid)}"]`); if (nu) { nu.querySelector(".mark__chip").classList.add("pop"); nu.focus({ preventScroll: true }); }
    },
    checkAll: el => {
      const kind = el.dataset.k, it = CHECK[kind].arr().find(x => x.id === el.dataset.id), m = checkMap(kind, it);
      checkList(kind, it).forEach(s => { m[s.id] = 1; }); persist(); render(true); toast(kind === "funds" ? "Все сдали деньги" : "Все сдали");
    },
    pollsClosed: el => { S.pollsClosed = el.dataset.v === "1"; render(true); },
    gradesFilter: el => { S.gradesFilter = S.gradesFilter === el.dataset.v ? "" : el.dataset.v; render(true); },
    pollAnswer: el => {
      const p = DB.polls.find(x => x.id === el.dataset.p), sid = el.dataset.id, i = +el.dataset.i; if (!p) return;
      p.answers ||= {}; const a = pollAns(p, sid);
      const next = p.multi ? (a.includes(i) ? a.filter(x => x !== i) : [...a, i].sort()) : (a.includes(i) ? [] : [i]);
      if (next.length) p.answers[sid] = p.multi ? next : next[0]; else delete p.answers[sid];
      persist(); render(true);
      const nu = $(`[data-act="pollAnswer"][data-id="${CSS.escape(sid)}"][data-i="${i}"]`); if (nu) nu.focus({ preventScroll: true });
    },
    pollClose: el => { const p = DB.polls.find(x => x.id === el.dataset.id); if (!p) return; p.closed = !p.closed; persist(); render(true); toast(p.closed ? "Опрос завершён" : "Опрос снова идёт"); },
    gradeSet: el => {
      const x = DB.exams.find(e => e.id === el.dataset.x), sid = el.dataset.id, fld = el.dataset.f, g = el.dataset.g; if (!x) return;
      const res = x.results ||= {}, r = res[sid] ||= {};
      if (r[fld] === g) delete r[fld]; else r[fld] = g;
      if (fld === "g" && !BAD_GRADES.has(r.g)) delete r.r; // пересдача нужна только после долга
      if (!r.g) delete res[sid];
      persist(); render(true);
      const nu = $(`[data-act="gradeSet"][data-id="${CSS.escape(sid)}"][data-f="${fld}"][data-g="${CSS.escape(g)}"]`); if (nu) nu.focus({ preventScroll: true });
    },
    closeSheetGo: () => { closeSheet(); return true; },
    goTemplates: () => { closeSheet(); location.hash = "#templates"; },
    tplInsert: el => {
      const ta = el.closest("form").text, v = el.dataset.v, a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
      ta.value = ta.value.slice(0, a) + v + ta.value.slice(b); ta.focus(); ta.selectionStart = ta.selectionEnd = a + v.length;
    },
    avaMenu: el => { const s = DB.students.find(x => x.id === el.dataset.id); if (!s) return;
      if (!s.ava) return ACT.avaPick(el);
      openSheet(`${sheetHead("camera", "var(--accent-2)", "Фото")}<div class="ava-big">${avatar(s, "avatar--xl")}</div>
        <p class="muted" style="text-align:center;margin:0 0 14px;font-size:14px">${esc(s.name)}</p>
        <div class="menu"><button class="menu__item" data-act="avaPick" data-id="${esc(s.id)}">${ic("camera")}<span><b>Выбрать другое фото</b></span></button>
        <button class="menu__item menu__item--bad" data-act="avaDel" data-id="${esc(s.id)}">${ic("delete")}<span><b>Убрать фото</b><small>Вместо фото снова будут инициалы</small></span></button></div>`); },
    avaPick: el => { const id = el.dataset.id, inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.addEventListener("change", async () => { const file = inp.files[0], s = DB.students.find(x => x.id === id); if (!file || !s) return;
        try { s.ava = await avatarImage(file); } catch (e) { return toast("Не удалось открыть фото — подойдут JPG и PNG", "info"); }
        persist(); closeSheet(); render(true); toast("Фото добавлено", "camera"); });
      inp.click(); },
    avaForm: el => { const f = el.closest("form"), inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.addEventListener("change", async () => { const file = inp.files[0]; if (!file) return;
        try { setAvaField(f, await avatarImage(file)); } catch (e) { toast("Не удалось открыть фото — подойдут JPG и PNG", "info"); } });
      inp.click(); },
    avaFormDel: el => setAvaField(el.closest("form"), "-"),
    avaDel: el => { const s = DB.students.find(x => x.id === el.dataset.id); if (s) delete s.ava; persist(); closeSheet(); render(true); toast("Фото убрано", "camera"); },
    // фото всей группы разом: файл называется по фамилии или ФИО — «Иванов.jpg», «Петрова Анна.png»
    avaMany: () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
      inp.addEventListener("change", async () => { let ok = 0; const miss = [];
        for (const file of inp.files) {
          const m = matchName(file.name.replace(/\.[^.]+$/, "").replace(/[_.\-]+/g, " ").replace(/\d+/g, " ").trim());
          if (!m || !m.s) { miss.push(file.name); continue; }
          try { m.s.ava = await avatarImage(file); ok++; } catch (e) { miss.push(file.name); }
        }
        if (ok) { persist(); closeSheet(); render(true); }
        toast(ok ? `Фото добавлены: ${ok}${miss.length ? ` · не узнали: ${miss.length}` : ""}` : "Не нашли, чьи это фото: назовите файлы по фамилии — «Иванов.jpg»", ok ? "camera" : "info");
      });
      inp.click(); },
    contactsFile: el => {
      const f = el.closest("form"), inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".xlsx,.csv,.txt,.vcf";
      inp.addEventListener("change", async () => {
        const file = inp.files[0]; if (!file) return;
        if (/\.xls$/i.test(file.name)) return toast("Старый формат .xls не читается — сохраните файл как .xlsx", "info");
        try { f.list.value = /\.xlsx$/i.test(file.name) ? (await XLSX.readRows(file)).map(r => r.join("\t")).join("\n") : await file.text(); }
        catch (e) { return toast("Не удалось прочитать файл. Подойдут .xlsx, .csv и .vcf", "info"); }
        contactsPreview(f);
        const n = parseContacts(f.list.value).length; toast(n ? `Из файла: ${n} ${plural(n, ["человек", "человека", "человек"])}` : "В файле не нашлось ФИО", n ? "excel" : "info");
      });
      inp.click();
    },
    notifyOn: async () => {
      if (!("Notification" in window)) return toast("Этот браузер не умеет показывать уведомления", "info");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { render(true); return toast("Уведомления не разрешены — их можно включить в настройках сайта в браузере", "info"); }
      DB.settings.notify = true; persist(); render(true);
      showNote("Напоминания включены", "Так будут выглядеть подсказки о парах, сроках и днях рождения", "#settings");
    },
    notifyOff: () => { DB.settings.notify = false; persist(); render(true); toast("Напоминания выключены"); },
    delDoc: el => delAndBack(el, "docs", "Удалить документ и все отметки по нему?", "#tasks/docs"),
    delPoll: el => delAndBack(el, "polls", "Удалить опрос и все ответы?", "#tasks/polls"),
    delTpl: el => del(el, "templates", "Удалить шаблон?"),
    delWork: el => delAndBack(el, "works", "Удалить работу и все отметки по ней?", "#study/works"),
    delFund: el => delAndBack(el, "funds", "Удалить сбор и все отметки по нему?", "#tasks/funds"),
    delExam: el => delAndBack(el, "exams", "Удалить из сессии?", "#study/exams"),
    delSick: el => { if (confirmed(el)) PHOTOS.del(el.dataset.id); delAndBack(el, "sick", "Удалить больничный? Отметки «У» в журнале останутся.", null); },
    sickAdd: el => { S.sickFor = el.dataset.sid; openSheet(FORMS.sick()); },
    sickPhoto: async el => {
      try {
        const blob = await PHOTOS.get(el.dataset.id); if (!blob) return toast("Фото не найдено на этом устройстве", "info");
        const url = URL.createObjectURL(blob);
        openSheet(`${sheetHead("camera", "var(--accent-5)", "Справка")}<img class="photo" src="${url}" alt="Фото справки"><div class="btn-row" style="margin-top:12px"><button class="btn btn--neutral" data-act="closeSheet">Закрыть</button></div>`);
      } catch (e) { toast("Не удалось открыть фото", "info"); }
    },
    riskView: () => { S.statsPeriod = "term"; S.statsSubject = ""; S.from = "stats"; return false; },
    copyDay: () => copy(dayText(S.journalDate || TODAY), "Расписание скопировано для чата"),
    // ----- дни рождения
    bdaySeen: () => {
      const y = TODAY.getFullYear(), keep = (DB.settings.bday_seen || []).filter(k => +k.split(":")[1] >= y); // старые годы не храним
      DB.settings.bday_seen = [...new Set([...keep, ...upcomingBdays(BDAY_AHEAD).map(bdayStage)])];
      persist(); closeSheet(); render(true);
    },
    bdaySnooze: () => { DB.settings.bday_snooze = key(TODAY); persist(); closeSheet(); toast("Напомним завтра", "cake"); },
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
    delStudent: el => del(el, "students", "Удалить студента совсем? Если он ушёл в академ или отчислен — лучше отметьте это в его карточке."),
    // вышел из академа / восстановлен: прошлый период уходит в историю
    studentReturn: el => {
      const s = DB.students.find(x => x.id === el.dataset.id); if (!s) return;
      const k = key(TODAY), to = s.status === "academ" && s.status_to && s.status_to < k ? s.status_to : k;
      if (s.status_from && s.status_from < k) (s.history ||= []).push({ kind: s.status, from: s.status_from, to, note: s.status_note || "" });
      ["status", "status_from", "status_to", "status_note"].forEach(f => delete s[f]);
      persist(); render(true); toast("Студент снова в группе");
    },
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
    demo: () => {
      // свои данные в этом браузере молча не заменяем
      if (DB && !isDemo() && (DB.students.length || Object.keys(DB.attendance).length)) return openSheet(FORMS.confirm("Открыть пример вместо ваших данных?", "demoApply", "", "Открыть пример"));
      ACT.demoApply();
    },
    demoApply: async () => {
      closeSheet();
      let d;
      try { const r = await fetch(DEMO_URL, { cache: "no-cache" }); if (!r.ok) throw new Error(r.status); d = await r.json(); }
      catch (e) { toast("Не удалось загрузить пример. Проверьте интернет", "wifioff"); render(); return; }
      DB = normalize(d); demoFill(); setDB(DB);
      if (location.hash !== "#home") location.hash = "#home"; else render();
      toast(`Пример открыт: ${DB.students.length} студентов, отметки случайные`);
    },
    demoExit: () => {
      try { localStorage.removeItem(DATA_KEY); } catch (e) { /* ничего */ }
      DB = null; MK = null; location.hash = ""; render();
    },
    nntuApply: () => {
      if (PLAN && !PLAN.empty) { nntuApply(PLAN); toast("Расписание обновлено"); }
      else if (PLAN) { DB.settings.nntu_group = PLAN.group; DB.settings.nntu_synced = key(TODAY); persist(); }
      PLAN = null; closeSheet(); render(true);
    },
    wipe: el => {
      if (!confirmed(el)) return openSheet(FORMS.confirm("Удалить все данные группы из этого браузера?", "wipe", "", "Удалить всё"));
      try { localStorage.removeItem(DATA_KEY); store.set("lastBackup", 0); store.set("pin", null); } catch (e) { /* ничего */ }
      DB = null; MK = null; closeSheet(); location.hash = ""; render(); toast("Данные удалены", "delete");
    },
  };
  let PENDING = null;
  function download(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  // удалить и вернуться к списку (если были на экране этой записи)
  function delAndBack(el, coll, text, back) {
    if (!confirmed(el)) return openSheet(FORMS.confirm(text, el.dataset.act, el.dataset.id));
    DB[coll] = DB[coll].filter(x => x.id !== el.dataset.id); persist(); closeSheet(); toast("Удалено", "delete");
    if (back && /^#(check|poll)\//.test(location.hash)) location.hash = back; else render(true);
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
  document.addEventListener("input", e => { const f = e.target.closest && e.target.closest('form[data-form="contacts"]'); if (f) contactsPreview(f); });
  document.addEventListener("change", e => { const f = e.target.closest && e.target.closest('form[data-form="contacts"]'); if (f) contactsPreview(f); });
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
  window.addEventListener("scroll", syncTopbar, { passive: true });

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
    if (!same(t, TODAY)) { TODAY = t; S.journalDate = null; }
    const r = location.hash.slice(1).split("/")[0] || "home";
    if (DB && sheet.hidden && ["home", "journal"].includes(r) && !document.activeElement?.matches("input, textarea")) render(true);
    if (DB && !LOCKED) checkReminders();
  }, 60000);
  setTimeout(() => { if (DB && !LOCKED) checkReminders(); }, 4000);
  // нажали на уведомление — переходим к нужному экрану
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.go) location.hash = e.data.go; });
  // приложение открыто в двух вкладках — изменения из другой подтягиваются сами
  addEventListener("storage", e => {
    if (e.key !== DATA_KEY) return;
    loadData(); MK = null;
    if (sheet.hidden) render(true);
  });

  // вернулись в приложение на следующий день — проверить расписание
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { autoCheck(); bdayReminder(); } });

  // работа без интернета: файлы приложения кешируются (sw.js)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* без офлайна тоже работает */ }));
  }

  /* ---------- код-пароль: экран блокировки ----------
     Защищает от посторонних глаз, но не шифрует данные: хранится только отпечаток кода (SHA-256 с солью). */
  const LOCK_AFTER = 5 * 60 * 1000;
  let LOCKED = false, PIN_IN = "", hiddenAt = 0;
  function pinSet() { return !!store.get("pin", null); }
  async function pinHash(pin, salt) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  function lockScreen() {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
    return { title: "Код-пароль", welcome: true, html: `<div class="lock">
      <span class="brand__logo lock__logo">${ic("lock")}</span><h1>Введите код</h1>
      <div class="lock__dots" aria-live="polite" aria-label="Введено цифр: ${PIN_IN.length} из 4">${[0, 1, 2, 3].map(i => `<i class="${i < PIN_IN.length ? "on" : ""}"></i>`).join("")}</div>
      <div class="lock__pad">${keys.map(k => !k ? "<span></span>" : `<button type="button" class="lock__key${k === "back" ? " lock__key--back" : ""}" data-act="pinKey" data-k="${k}" aria-label="${k === "back" ? "Стереть" : k}">${k === "back" ? ic("backspace") : k}</button>`).join("")}</div>
      <button class="link" data-act="pinForgot">Забыли код?</button></div>` };
  }
  function lockDots() { $$(".lock__dots i").forEach((d, i) => d.classList.toggle("on", i < PIN_IN.length)); }
  async function pinCheck() {
    const p = store.get("pin", null);
    if (!p || await pinHash(PIN_IN, p.salt) === p.hash) { LOCKED = false; PIN_IN = ""; render(); autoCheck(); setTimeout(bdayReminder, 300); return; }
    PIN_IN = ""; const d = $(".lock__dots"); if (d) { d.classList.add("shake"); setTimeout(() => { d.classList.remove("shake"); lockDots(); }, 420); }
  }
  function pinKey(k) {
    if (k === "back") PIN_IN = PIN_IN.slice(0, -1); else if (PIN_IN.length < 4) PIN_IN += k;
    lockDots(); if (PIN_IN.length === 4) pinCheck();
  }
  document.addEventListener("keydown", e => {
    if (!LOCKED) return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); pinKey(e.key); } else if (e.key === "Backspace") { e.preventDefault(); pinKey("back"); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (pinSet() && !LOCKED && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER) { LOCKED = true; PIN_IN = ""; closeSheet(); render(); }
  });

  /* ----- Как пользоваться ----- */
  SCREENS.help = () => {
    const step = (n, title, text) => `<div class="help-step"><b class="help-step__n num">${n}</b><div><h3>${title}</h3><p>${text}</p></div></div>`;
    return {
      title: "Как пользоваться", back: "#settings", nav: "settings",
      html: `<section class="hero"><h1>Помощник старосты.<span> Как начать.</span></h1></section>
        <section class="card stack">
          ${step(1, "Загрузите расписание", "«Настройки» → «Расписание НГТУ» → номер группы, например 26-ИВТ-2-1. Пары, аудитории, преподаватели и звонки подтянутся с сайта НГТУ, а дальше приложение само раз в день проверяет изменения.")}
          ${step(2, "Добавьте группу", "«Группа» → «Добавить списком»: вставьте список из чата или выберите файл Excel. Подгруппы — «Подгруппы» → «Задать списками».")}
          ${step(3, "Отмечайте на паре", "На главной — кнопка «Отметить посещаемость». Нажатие на студента: + был → Н не был → У уважительная. «Копировать» — список отсутствующих для чата.")}
          ${step(4, "Ведите остальное", "«Дела»: дедлайны, сдачи работ (кто сдал лабораторную), сборы денег и документов, сессия. В карточке студента — день рождения и больничные.")}
          ${step(5, "Сохраняйте копию", "Данные хранятся только в этом браузере. «Настройки» → «Скачать копию» — раз в пару недель, на случай если браузер очистят.")}
        </section>
        ${sectionHead("", "Полезно знать")}
        <section class="card stack" style="font-size:14px">
          <p>${ic("chat")} <b>Тексты для чата:</b> расписание дня («Пары» → ${ic("chat")}), изменения с сайта НГТУ, должники по сдачам и сборам, поздравления с днём рождения.</p>
          <p>${ic("download")} <b>Установка:</b> «Настройки» → «Установить». С иконки работает без интернета, долгое нажатие — быстрые действия: «Отметить пару», «Расписание», «Сдачи».</p>
          <p>${ic("lock")} <b>Код-пароль:</b> в настройках можно включить, чтобы чужой не увидел телефоны и дни рождения одногруппников.</p>
          <p>${ic("info")} Приложение неофициальное. Расписание берётся с открытого сайта НГТУ, данные группы никуда не отправляются.</p>
        </section>`,
    };
  };

  /* ---------- старт ---------- */
  applyMode();
  renderNav("home");
  view.innerHTML = `<div class="stack" aria-busy="true" aria-label="Загрузка">
    <div class="skeleton" style="height:96px;width:70%"></div><div class="skeleton" style="height:150px;border-radius:24px"></div>
    <div class="tiles"><div class="skeleton" style="height:112px;border-radius:20px"></div><div class="skeleton" style="height:112px;border-radius:20px"></div><div class="skeleton" style="height:112px;border-radius:20px"></div></div>
    <div class="skeleton" style="height:120px;border-radius:20px"></div></div>`;
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  loadData();
  if (DB && pinSet()) LOCKED = true;
  fontsReady.then(() => { render(); if (!LOCKED) { autoCheck(); setTimeout(bdayReminder, 400); } });
  addEventListener("online", () => autoCheck());
})();
