/* Расписание с сайта НГТУ им. Р. Е. Алексеева.
   Открытый адрес без входа: my-api.nntu.ru/lesson-schedule/public (его же использует NNTU-Map).
   Официальной документации нет — если НГТУ поменяет формат, здесь придётся поправить разбор. */
window.NNTU = (() => {
  "use strict";
  const API = "https://my-api.nntu.ru/lesson-schedule/public";
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const DAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
  const KINDS = { "лек.": "Лекция", "практ.": "Практика", "лаб. раб.": "Лабораторная", "лаб.": "Лабораторная", "сем.": "Семинар" };

  async function get(url) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(url, { cache: "no-store", signal: ctl.signal });
      if (!r.ok) throw new Error("http " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  let groupsCache = null;
  async function groups() {
    if (!groupsCache) groupsCache = get(`${API}/groups`).then(g => (Array.isArray(g) ? g : []).map(String)).catch(e => { groupsCache = null; throw e; });
    return groupsCache;
  }
  const normGroup = s => String(s || "").trim().replace(/\s+/g, "").toUpperCase();

  // «6414 (Уч. корп. №6)» → «6414, корп. 6»; «Спорткомплекс 6 уч. корп.» → «Спорткомплекс, корп. 6»
  function room(s) {
    s = String(s || "").trim().replace(/\s+/g, " ");
    let m = /^(.+?)\s*\(\s*уч\.?\s*корп\.?\s*№?\s*([\wа-я-]+)\s*\)$/i.exec(s);
    if (m) return `${m[1]}, корп. ${m[2]}`;
    m = /^(.+?)\s+([\dа-я-]+)\s*уч\.?\s*корп\.?$/i.exec(s);
    if (m) return `${m[1]}, корп. ${m[2]}`;
    return s;
  }
  // «Седаев Павел Валерьевич» → «Седаев П. В.»
  const teacher = s => String(s || "").split(/\s*[,;]\s*/).filter(Boolean).map(p => {
    const w = p.trim().split(/\s+/);
    return w.length === 3 && w.every(x => /^[А-ЯЁ][а-яё-]+$/.test(x)) ? `${w[0]} ${w[1][0]}. ${w[2][0]}.` : p.trim();
  }).join(", ");
  const kind = s => KINDS[String(s || "").trim().toLowerCase()] || (s ? s[0].toUpperCase() + s.slice(1) : "Другое");

  // «Понедельник, 2 ноября» → дата (год — ближайший к сегодня)
  function dayDate(s, today) {
    const m = /(\d{1,2})\s+([а-яё]+)/i.exec(s || ""), mo = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
    if (mo < 0) return null;
    let best = null;
    for (const y of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
      const d = new Date(y, mo, +m[1]);
      if (!best || Math.abs(d - today) < Math.abs(best - today)) best = d;
    }
    return best;
  }

  /* Расписание группы → { bells: ["08:00-09:35", …], weeks: [{ monday: Date, lessons: [...] }] }
     lessons — в формате приложения, но без id, недели и семестра (их назначает приложение). */
  async function schedule(group, today = new Date()) {
    const raw = await get(`${API}/group-schedule?groupName=${encodeURIComponent(normGroup(group))}`);
    const bells = (raw.times || []).map(t => String(t).replace(/\s*[—–-]\s*/, "-")).filter(t => /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(t));
    const weeks = [];
    for (const wk of [raw.currentWeek, raw.nextWeek]) {
      if (!Array.isArray(wk) || !wk.length) continue;
      const lessons = [];
      let monday = null;
      wk.forEach(d => {
        const name = String(d.dayOfTheWeek || ""), day = DAYS.indexOf(name.split(",")[0].trim().toLowerCase()), date = dayDate(name, today);
        if (day < 0) return;
        if (date && !monday) monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
        (d.lessonElements || []).forEach(e => {
          const subject = String(e.subject || "").trim().replace(/\s+/g, " ");
          if (!subject || !e.timeIndex) return;
          const l = { subject, day, num: +e.timeIndex, kind: kind(e.studyType), room: room(e.room), teacher: teacher(e.teacher) };
          if (e.startTime && e.endTime) { l.start = String(e.startTime).slice(0, 5); l.end = String(e.endTime).slice(0, 5); }
          lessons.push(l);
        });
      });
      if (monday) weeks.push({ monday, lessons });
    }
    return { group: normGroup(group), bells, weeks };
  }

  return { groups, schedule, normGroup };
})();
