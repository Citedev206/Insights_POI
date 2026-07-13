/* ============================================================
   js/charts.js — Generadores de gráficos SVG (sin dependencias)
   Estética alineada a Dashboard POI 2026.dc.html: morados
   institucionales, trazos limpios y semáforo de cumplimiento.
   ============================================================ */
(function (global) {
  "use strict";

  const COL = {
    purple: "#5C1F5C", accent: "#7A2A7A", mid: "#9B4D9B", soft: "#B79BB7",
    tint: "#F3E9F3", track: "#F0ECF3", grid: "#F0ECF3", axis: "#E8E2EC",
    ink: "#28232E", text: "#3D3645", muted: "#867E90", muted2: "#A39CAB",
    blue: "#2E5FD4",
  };
  const SEM = { verde: "#1F9D6B", amarillo: "#E0A82E", rojo: "#C0392B" };
  const semColor = (s) => SEM[global.POI.semaforo(s)];

  const nf = new Intl.NumberFormat("es-PE");
  const fmt = (n) => nf.format(Math.round(Number(n) || 0));
  const fmt1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString("es-PE");
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function truncate(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  function empty(msg) { return `<div class="empty">${esc(msg || "Sin datos para los filtros aplicados")}</div>`; }

  // -------------------------------------------------------------------------
  // Tendencia mensual: Meta (línea punteada) vs Ejecutado (área + línea)
  // rows: [{Mes, Meta, Ejecutado, MesNum}]
  // -------------------------------------------------------------------------
  function trendMetaEjec(rows) {
    if (!rows || !rows.length) return empty();
    const W = 560, H = 220, padL = 6, padR = 10, padT = 14, padB = 6;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxY = Math.max(1, ...rows.map((r) => Math.max(r.Meta, r.Ejecutado)));
    const n = rows.length;
    const xAt = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yAt = (v) => padT + (1 - v / maxY) * plotH;

    const grid = [0.25, 0.5, 0.75, 1].map((g) => {
      const y = padT + g * plotH;
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${COL.grid}" stroke-width="1"/>`;
    }).join("");

    const ptsE = rows.map((r, i) => `${xAt(i).toFixed(1)},${yAt(r.Ejecutado).toFixed(1)}`);
    const ptsM = rows.map((r, i) => `${xAt(i).toFixed(1)},${yAt(r.Meta).toFixed(1)}`);
    const areaPath = `M${ptsE[0]} L${ptsE.join(" L")} L${xAt(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
    const lineE = `M${ptsE.join(" L")}`;
    const lineM = `M${ptsM.join(" L")}`;

    const dots = rows.map((r, i) =>
      `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(r.Ejecutado).toFixed(1)}" r="3" fill="${COL.accent}">
         <title>${esc(r.Mes)} · Ejecutado ${fmt(r.Ejecutado)} / Meta ${fmt(r.Meta)}</title></circle>`).join("");

    // Etiquetas de valor (ejecutado) sobre cada punto
    const nums = rows.map((r, i) => {
      const y = Math.max(yAt(r.Ejecutado) - 8, 10);
      return `<text x="${xAt(i).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${COL.ink}">${fmt(r.Ejecutado)}</text>`;
    }).join("");

    const svg = `
    <svg viewBox="0 0 ${W} ${H}">
      <defs><linearGradient id="grad-trend" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${COL.accent}" stop-opacity="0.20"/>
        <stop offset="100%" stop-color="${COL.accent}" stop-opacity="0"/></linearGradient></defs>
      ${grid}
      <path d="${areaPath}" fill="url(#grad-trend)"/>
      <path d="${lineM}" fill="none" stroke="${COL.soft}" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>
      <path d="${lineE}" fill="none" stroke="${COL.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${nums}
    </svg>
    <div class="chart-x">${rows.map((r) => `<span>${esc(r.Mes)}</span>`).join("")}</div>`;
    return svg;
  }

  // -------------------------------------------------------------------------
  // Barras horizontales agrupadas: Meta vs Ejecutado
  // rows: [{Dim, Meta, Ejecutado}]
  // -------------------------------------------------------------------------
  function barsMetaEjec(rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return empty();
    const maxV = Math.max(1, ...rows.map((r) => Math.max(r.Meta, r.Ejecutado)));
    const g = opts.gutter || 150;
    const body = rows.map((r) => {
      const wM = (r.Meta / maxV) * 100, wE = (r.Ejecutado / maxV) * 100;
      return `<div class="hbar-row">
        <div class="hbar-lab" title="${esc(r.Dim)}">${esc(r.Dim)}</div>
        <div class="hbar-cluster">
          <div class="hbar-line"><div class="hbar-track"><span class="hbar-fill" style="width:${wM.toFixed(1)}%;background:${COL.soft}"></span></div><span class="hbar-num muted">${fmt(r.Meta)}</span></div>
          <div class="hbar-line"><div class="hbar-track"><span class="hbar-fill" style="width:${wE.toFixed(1)}%;background:${COL.accent}"></span></div><span class="hbar-num">${fmt(r.Ejecutado)}</span></div>
        </div></div>`;
    }).join("");
    return `<div class="hbars" style="--gutter:${g}px">${body}</div>`;
  }

  // -------------------------------------------------------------------------
  // Barras horizontales de cumplimiento (%) coloreadas por semáforo,
  // con guía en 100 %. rows: [{Dim, Cumplimiento}]
  // -------------------------------------------------------------------------
  function barsSemaforo(rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return empty();
    const valKey = opts.valKey || "Cumplimiento";
    const sorted = opts.sort === false ? rows.slice() : rows.slice().sort((a, b) => a[valKey] - b[valKey]);
    const maxV = Math.max(100, ...sorted.map((r) => r[valKey]));
    const g = opts.gutter || 160;
    const guideLeft = (100 / maxV) * 100;
    const body = sorted.map((r) => {
      const v = r[valKey], w = (v / maxV) * 100, c = semColor(v);
      return `<div class="hbar-row">
        <div class="hbar-lab" title="${esc(r.Dim)}">${esc(r.Dim)}</div>
        <div class="hbar-line">
          <div class="hbar-track"><span class="hbar-fill" style="width:${Math.max(w, 0.5).toFixed(1)}%;background:${c}"></span><span class="hbar-guide" style="left:${guideLeft.toFixed(1)}%"></span></div>
          <span class="hbar-num">${Math.round(v)}%</span>
        </div></div>`;
    }).join("");
    return `<div class="hbars" style="--gutter:${g}px">${body}</div>`;
  }

  // -------------------------------------------------------------------------
  // Barras horizontales simples (una serie), coloreables por punto
  // rows: [{label, value, color?}]
  // -------------------------------------------------------------------------
  function barsSimple(rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return empty();
    const maxV = Math.max(1, ...rows.map((r) => r.value));
    const g = opts.gutter || 190;
    const body = rows.map((r) => {
      const w = (r.value / maxV) * 100;
      return `<div class="hbar-row">
        <div class="hbar-lab" title="${esc(r.label)}">${esc(r.label)}</div>
        <div class="hbar-line">
          <div class="hbar-track"><span class="hbar-fill" style="width:${Math.max(w, 0.5).toFixed(1)}%;background:${r.color || COL.accent}"></span></div>
          <span class="hbar-num">${fmt(r.value)}</span>
        </div></div>`;
    }).join("");
    return `<div class="hbars" style="--gutter:${g}px">${body}</div>`;
  }

  // -------------------------------------------------------------------------
  // Barras verticales agrupadas (meses): Meta vs Ejecutado / apiladas
  // rows: [{label, a, b}] ; opts.stacked, opts.colA, colB, nameA, nameB
  // -------------------------------------------------------------------------
  function barsVertical(rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return empty();
    const colA = opts.colA || COL.accent, colB = opts.colB || COL.soft;
    const stacked = !!opts.stacked;
    const maxV = Math.max(1, ...rows.map((r) => stacked ? (r.a + r.b) : Math.max(r.a, r.b)));
    // Con muchas columnas, las etiquetas de valor se ocultan (quedan en el hover)
    const caps = rows.length <= (opts.capLimit || 8);
    const cap = (v) => caps ? `<b class="vcap">${fmt(v)}</b>` : "";
    const cols = rows.map((r) => {
      const hA = (r.a / maxV) * 100, hB = (r.b / maxV) * 100;
      let bars;
      if (stacked) {
        const tot = r.a + r.b;
        bars = `<div class="vstack" title="${esc(r.label)} · ${esc(opts.nameA || "A")} ${fmt(r.a)} · ${esc(opts.nameB || "B")} ${fmt(r.b)}">
          ${cap(tot)}
          <span class="vseg" style="height:${hA.toFixed(1)}%;background:${colA}"></span>
          <span class="vseg" style="height:${hB.toFixed(1)}%;background:${colB}"></span>
        </div>`;
      } else {
        bars = `<div class="vpair">
          <span class="vbar" style="height:${hB.toFixed(1)}%;background:${colB}" title="${esc(opts.nameB || "Meta")} ${fmt(r.b)}">${cap(r.b)}</span>
          <span class="vbar" style="height:${hA.toFixed(1)}%;background:${colA}" title="${esc(opts.nameA || "Ejecutado")} ${fmt(r.a)}">${cap(r.a)}</span>
        </div>`;
      }
      return `<div class="vcol">${bars}<span class="vx">${esc(r.label)}</span></div>`;
    }).join("");
    return `<div class="vbars">${cols}</div>`;
  }

  // -------------------------------------------------------------------------
  // Líneas múltiples (una por serie): rows compartidos por eje X
  // series: [{name, color, values:[{label,value}]}]
  // -------------------------------------------------------------------------
  function multiLine(series, labels) {
    if (!series || !series.length || !labels.length) return empty();
    const W = 560, H = 200, padL = 8, padR = 8, padT = 12, padB = 8;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxV = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v.value)));
    const n = labels.length;
    const xAt = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yAt = (v) => padT + (1 - v / maxV) * plotH;
    const grid = [0.25, 0.5, 0.75, 1].map((gg) => {
      const y = padT + gg * plotH;
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${COL.grid}" stroke-width="1"/>`;
    }).join("");
    let body = grid;
    series.forEach((s) => {
      const pts = s.values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v.value).toFixed(1)}`);
      body += `<path d="M${pts.join(" L")}" fill="none" stroke="${s.color}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"${s.dash ? ' stroke-dasharray="5 4"' : ""}/>`;
      body += s.values.map((v, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v.value).toFixed(1)}" r="2" fill="${s.color}"><title>${esc(s.name)} · ${esc(v.label)}: ${fmt(v.value)}</title></circle>`).join("");
    });
    return `<svg class="ml-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${body}</svg>
      <div class="chart-x">${labels.map((l) => `<span>${esc(l)}</span>`).join("")}</div>`;
  }

  // -------------------------------------------------------------------------
  // Donut (rosco): segments [{label, value, color}]
  // -------------------------------------------------------------------------
  function donut(segments, centerBig, centerLbl) {
    const total = segments.reduce((a, s) => a + (s.value || 0), 0);
    const R = 15.915, C = 100;
    let offset = 25; // arranca arriba
    let arcs = `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${COL.track}" stroke-width="5.5"/>`;
    if (total > 0) {
      segments.forEach((s) => {
        const frac = (s.value || 0) / total, len = frac * C;
        if (len <= 0) return;
        arcs += `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${s.color}" stroke-width="5.5"
                   stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
                   transform="rotate(-90 21 21)"><title>${esc(s.label)}: ${fmt(s.value)} (${Math.round(frac * 100)}%)</title></circle>`;
        offset -= len;
      });
    }
    return `
    <div class="donutwrap">
      <svg width="150" height="150" viewBox="0 0 42 42">${arcs}</svg>
      <div class="center"><div class="big">${esc(centerBig)}</div><div class="lbl">${esc(centerLbl || "total")}</div></div>
    </div>`;
  }

  function legendList(segments, asPct) {
    const total = segments.reduce((a, s) => a + (s.value || 0), 0);
    return `<div class="statlist">${segments.map((s) => {
      const v = asPct && total ? `${Math.round((s.value / total) * 100)}%` : fmt(s.value);
      return `<div class="row"><span class="l"><i style="background:${s.color}"></i>${esc(s.label)}</span><span class="val">${v}</span></div>`;
    }).join("")}</div>`;
  }

  // -------------------------------------------------------------------------
  // Anillo de cumplimiento (gauge): un valor % coloreado por semáforo
  // -------------------------------------------------------------------------
  function gaugeRing(pct, opts) {
    opts = opts || {};
    const R = 15.915, C = 100, color = semColor(pct);
    const shown = Math.max(0, Math.min(pct, 100));
    const len = (shown / 100) * C;
    return `
    <div class="donutwrap">
      <svg width="150" height="150" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="${R}" fill="none" stroke="${COL.track}" stroke-width="5"/>
        <circle cx="21" cy="21" r="${R}" fill="none" stroke="${color}" stroke-width="5"
          stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="25"
          stroke-linecap="round" transform="rotate(-90 21 21)"/>
      </svg>
      <div class="center"><div class="big">${fmt1(pct)}<span style="font-size:.9rem;color:var(--muted)">%</span></div>
        <div class="lbl">${esc(opts.label || "cumplimiento")}</div></div>
    </div>`;
  }

  // -------------------------------------------------------------------------
  // Heatmap tarea × mes (% cumplimiento) — HTML para nitidez del texto
  // hm: { meses:[...], rows:[{label, cells:[pct|null]}] }
  // -------------------------------------------------------------------------
  function heatmap(hm) {
    if (!hm || !hm.rows.length) return empty("Sin metas por tarea para el periodo");
    const cellColor = (v) => v == null ? "transparent" : semColor(typeof v === "object" ? v.pct : v);
    const head = `<div class="hm-row hm-head"><div class="hm-lab"></div>${hm.meses.map((m) => `<div class="hm-cell hm-mes">${esc(m)}</div>`).join("")}</div>`;
    const body = hm.rows.map((r) => `
      <div class="hm-row">
        <div class="hm-lab" title="${esc(r.label)}">${esc(r.label)}</div>
        ${r.cells.map((v) => {
      if (v == null) return `<div class="hm-cell" style="background:transparent"></div>`;
      const cell = typeof v === "object" ? v : { pct: v, meta: null, ejec: null };
      const bg = semColor(cell.pct);
      const pctTxt = Math.round(cell.pct) + "%";
      const detail = cell.meta != null ? `<span class="hm-detail">${fmt(cell.ejec)}/${fmt(cell.meta)}</span>` : "";
      return `<div class="hm-cell" style="background:${bg}" title="${pctTxt}${cell.meta != null ? ` · Ejec ${fmt(cell.ejec)} / Prog ${fmt(cell.meta)}` : ""}"><span class="hm-pct">${pctTxt}</span>${detail}</div>`;
    }).join("")}
      </div>`).join("");
    return `<div class="hm-scroll"><div class="heatmap" style="--hm-cols:${hm.meses.length}">${head}${body}</div></div>`;
  }

  // -------------------------------------------------------------------------
  // Radar ICE: spider chart puro SVG para las dimensiones de diagnóstico de
  // competitividad (CdD-FEST). dims: [{label,puntaje,nivel,esProxy,brecha,
  // componente}]. opts.highlightComponente resalta el eje del componente
  // recomendado (según el orden por brechas).
  // -------------------------------------------------------------------------
  function iceColor(p) {
    if (p >= 70) return SEM.verde;
    if (p >= 40) return SEM.amarillo;
    return SEM.rojo;
  }
  function radar(dims, opts) {
    opts = opts || {};
    if (!dims || !dims.length) return empty("Sin diagnóstico ICE para esta unidad productiva");
    const N = dims.length;
    const W = 340, H = 340, cx = W / 2, cy = H / 2 - 6, R = 104;
    const angleAt = (i) => -Math.PI / 2 + i * (2 * Math.PI / N);
    const pt = (i, frac) => {
      const a = angleAt(i), r = R * frac;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const rings = [0.25, 0.5, 0.75, 1].map((frac) => {
      const p = dims.map((_, i) => pt(i, frac).map((v) => v.toFixed(1)).join(","));
      return `<polygon points="${p.join(" ")}" fill="none" stroke="${COL.grid}" stroke-width="1"/>`;
    }).join("");
    const axes = dims.map((_, i) => {
      const [x, y] = pt(i, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COL.axis}" stroke-width="1"/>`;
    }).join("");
    const dataPts = dims.map((d, i) => pt(i, Math.max(0, Math.min(d.puntaje, 100)) / 100));
    const dataPoly = `<polygon points="${dataPts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"
      fill="${COL.accent}" fill-opacity="0.22" stroke="${COL.accent}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const dots = dataPts.map((p, i) => {
      const d = dims[i];
      const tip = `${d.label}: ${fmt1(d.puntaje)}${d.esProxy ? " (≈ estimado desde nivel)" : ""}` +
        `${d.nivel ? " · " + d.nivel : ""} · brecha ${fmt1(d.brecha)}`;
      return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.6" fill="${iceColor(d.puntaje)}" stroke="#fff" stroke-width="1.2"><title>${esc(tip)}</title></circle>`;
    }).join("");
    const labels = dims.map((d, i) => {
      const [x, y] = pt(i, 1.24);
      const a = angleAt(i);
      const anchor = Math.cos(a) > 0.25 ? "start" : Math.cos(a) < -0.25 ? "end" : "middle";
      const hl = opts.highlightComponente && d.componente === opts.highlightComponente;
      return `
        <text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="10.2"
              font-weight="${hl ? 700 : 500}" fill="${hl ? COL.purple : COL.text}">${esc(truncate(d.label, 15))}${d.esProxy ? " ≈" : ""}</text>
        <text x="${x.toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="${anchor}" font-size="10.5"
              font-weight="700" fill="${iceColor(d.puntaje)}">${Math.round(d.puntaje)}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" style="max-width:340px;margin:0 auto;display:block;overflow:visible;">${rings}${axes}${dataPoly}${dots}${labels}</svg>`;
  }

  global.POI.charts = {
    COL, SEM, semColor, fmt, fmt1, esc, truncate, empty,
    trendMetaEjec, barsMetaEjec, barsSemaforo, barsSimple, barsVertical,
    multiLine, donut, legendList, gaugeRing, heatmap, radar, iceColor,
  };
})(window);
