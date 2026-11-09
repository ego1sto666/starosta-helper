/* Книга Excel (.xlsx) прямо в браузере, без библиотек.
   .xlsx — это zip-архив с XML. Оформление то же, что было в программе на ПК.
   XLSX.blob(sheets) → Blob; XLSX.readRows(file) → строки первого листа; sheet = { name, rows: [[[значение, стиль] | null]], widths, heights, freeze: [строк, столбцов], merges } */
window.XLSX = (() => {
  "use strict";

  // номера стилей соответствуют <cellXfs> ниже
  const S = { TITLE: 1, HEAD: 2, TEXT: 3, CENTER: 4, ABSENT: 5, EXCUSED: 6, PRESENT: 7, PCT_OK: 8, PCT_WARN: 9, PCT_BAD: 10, NOTE: 11, HEAD_LEFT: 12, TOTAL: 13 };

  const font = (x = "") => `<font>${x}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`;
  const fill = rgb => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const C = '<alignment horizontal="center" vertical="center"/>';
  const xf = (num, f, fl, b, al = "") => `<xf numFmtId="${num}" fontId="${f}" fillId="${fl}" borderId="${b}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`;
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0&quot;%&quot;"/></numFmts>
<fonts count="8">${font()}${font("<b/>")}<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>${font('<b/><color rgb="FFC00000"/>')}${font('<b/><color rgb="FF9C5700"/>')}${font('<color rgb="FF00875A"/>')}<font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/><family val="2"/></font>${font('<b/><color rgb="FF00875A"/>')}</fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill("FFE3ECF7")}${fill("FFFDE2E2")}${fill("FFFEF3C7")}${fill("FFF3F4F6")}</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${["left", "right", "top", "bottom"].map(s => `<${s} style="thin"><color rgb="FFBFC5CC"/></${s}>`).join("")}<diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
${xf(0, 2, 0, 0)}
${xf(0, 1, 2, 1, '<alignment horizontal="center" vertical="center" wrapText="1"/>')}
${xf(0, 0, 0, 1, '<alignment vertical="center"/>')}
${xf(0, 0, 0, 1, C)}
${xf(0, 3, 3, 1, C)}
${xf(0, 4, 4, 1, C)}
${xf(0, 5, 0, 1, C)}
${xf(164, 7, 0, 1, C)}
${xf(164, 4, 4, 1, C)}
${xf(164, 3, 3, 1, C)}
${xf(0, 6, 0, 0)}
${xf(0, 1, 2, 1, '<alignment horizontal="left" vertical="center" wrapText="1"/>')}
${xf(0, 1, 5, 1, C)}
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const esc = v => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function col(n) { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

  // имя листа: до 31 символа, без []:*?/\ и без повторов
  function sheetName(name, used) {
    const base = (String(name).replace(/[[\]:*?/\\]/g, " ").trim() || "Лист").slice(0, 31);
    let out = base, i = 2;
    while (used.has(out.toLowerCase())) { const tail = ` (${i++})`; out = base.slice(0, 31 - tail.length) + tail; }
    used.add(out.toLowerCase());
    return out;
  }

  function sheetXml(sh) {
    const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'];
    const [fr, fc] = sh.freeze || [0, 0];
    if (fr || fc) {
      const pane = fr && fc ? "bottomRight" : fr ? "bottomLeft" : "topRight";
      out.push(`<sheetViews><sheetView workbookViewId="0"><pane${fc ? ` xSplit="${fc}"` : ""}${fr ? ` ySplit="${fr}"` : ""} topLeftCell="${col(fc + 1)}${fr + 1}" activePane="${pane}" state="frozen"/></sheetView></sheetViews>`);
    }
    out.push('<sheetFormatPr defaultRowHeight="18"/>');
    if (sh.widths) out.push("<cols>" + sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>");
    out.push("<sheetData>");
    sh.rows.forEach((cells, ri) => {
      const r = ri + 1, ht = (sh.heights || {})[r];
      out.push(`<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>`);
      cells.forEach((c, ci) => {
        if (!c) return;
        const [v, st] = c, ref = col(ci + 1) + r;
        if (v == null || v === "") out.push(`<c r="${ref}" s="${st}"/>`);
        else if (typeof v === "number") out.push(`<c r="${ref}" s="${st}"><v>${v}</v></c>`);
        else out.push(`<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`);
      });
      out.push("</row>");
    });
    out.push("</sheetData>");
    if (sh.merges && sh.merges.length) out.push(`<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`);
    out.push('<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>');
    out.push('<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>');
    return out.join("");
  }

  /* ---------- zip без сжатия ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    let offset = 0;
    for (const [name, text] of Object.entries(files)) {
      const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(h, nm, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true);
      c.setUint32(42, offset, true);
      central.push(c, nm);
      offset += 30 + nm.length + data.length;
    }
    const size = central.reduce((a, x) => a + x.byteLength, 0), n = Object.keys(files).length;
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, e], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function blob(sheets) {
    const used = new Set(), names = sheets.map(s => sheetName(s.name, used)), n = sheets.length;
    const ns = "http://schemas.openxmlformats.org", head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const range = f => Array.from({ length: n }, (_, i) => f(i + 1)).join("");
    const files = {
      "[Content_Types].xml": `${head}<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${range(i => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)}</Types>`,
      "_rels/.rels": `${head}<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `${head}<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${names.map((nm, i) => `<sheet name="${esc(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `${head}<Relationships xmlns="${ns}/package/2006/relationships">${range(i => `<Relationship Id="rId${i}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`)}<Relationship Id="rId${n + 1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": STYLES,
    };
    sheets.forEach((sh, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(sh); });
    return zip(files);
  }

  /* ---------- чтение .xlsx: строки первого листа (для загрузки списков) ---------- */
  const MAX_IMPORT_BYTES = 16 * 1024 * 1024;
  async function inflate(bytes, limit) {
    const ds = new DecompressionStream("deflate-raw");
    const reader = new Blob([bytes]).stream().pipeThrough(ds).getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) {
          await reader.cancel();
          throw new Error("Таблица слишком большая после распаковки");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  }
  async function unzip(buf, want) {
    const b = new Uint8Array(buf), v = new DataView(buf), dec = new TextDecoder(), out = {};
    let remaining = MAX_IMPORT_BYTES;
    let e = b.length - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("not a zip");
    let p = v.getUint32(e + 16, true);
    for (let i = 0, n = v.getUint16(e + 10, true); i < n && v.getUint32(p, true) === 0x02014b50; i++) {
      const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), expanded = v.getUint32(p + 24, true), nl = v.getUint16(p + 28, true);
      const off = v.getUint32(p + 42, true), name = dec.decode(b.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
      if (!want(name)) continue;
      const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = b.subarray(start, start + size);
      if (expanded > remaining || (method === 0 && size > remaining)) throw new Error("Таблица слишком большая");
      if (data.length !== size || (method !== 0 && method !== 8)) throw new Error("Повреждённая таблица");
      const entry = method === 0 ? data : await inflate(data, remaining);
      if (entry.length !== expanded) throw new Error("Повреждённая таблица");
      remaining -= entry.length;
      out[name] = entry;
    }
    return out;
  }
  async function readRows(file) {
    if (file.size > MAX_IMPORT_BYTES) throw new Error("Таблица слишком большая");
    const z = await unzip(await file.arrayBuffer(), n => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n));
    const dec = new TextDecoder(), xml = n => {
      if (!z[n]) return null;
      const doc = new DOMParser().parseFromString(dec.decode(z[n]), "application/xml");
      if (doc.getElementsByTagName("parsererror").length) throw new Error("Повреждённая таблица");
      return doc;
    };
    const tags = (node, t) => node ? [...node.getElementsByTagNameNS("*", t)] : [];
    // первый лист по порядку в книге
    let path = Object.keys(z).filter(n => n.startsWith("xl/worksheets/")).sort()[0];
    const first = tags(xml("xl/workbook.xml"), "sheet")[0], rels = xml("xl/_rels/workbook.xml.rels");
    if (first && rels) {
      const rid = first.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || first.getAttribute("r:id");
      const rel = tags(rels, "Relationship").find(r => r.getAttribute("Id") === rid);
      if (rel) { const t = rel.getAttribute("Target").replace(/^\/?(xl\/)?/, "xl/"); if (z[t]) path = t; }
    }
    if (!path) throw new Error("no sheet");
    const shared = tags(xml("xl/sharedStrings.xml"), "si").map(si => tags(si, "t").map(t => t.textContent).join(""));
    const rows = tags(xml(path), "row");
    if (rows.length > 5000) throw new Error("В таблице больше 5000 строк");
    return rows.map(r => {
      const line = [];
      tags(r, "c").forEach(c => {
        const letters = ((c.getAttribute("r") || "").match(/^[A-Z]+/) || [""])[0];
        let ci = 0; for (const ch of letters) ci = ci * 26 + ch.charCodeAt(0) - 64;
        const t = c.getAttribute("t"), v = tags(c, "v")[0];
        const val = t === "s" ? shared[+(v && v.textContent)] : t === "inlineStr" ? tags(c, "t").map(x => x.textContent).join("") : v ? v.textContent : "";
        const column = ci || line.length + 1;
        if (column > 256) throw new Error("В таблице больше 256 столбцов");
        line[column - 1] = String(val ?? "").trim();
      });
      return Array.from(line, x => x || "");
    });
  }

  return { S, col, blob, readRows };
})();
