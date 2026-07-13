/* ============================================================
   js/app.js — Aplicación (routing, filtros globales y vistas)
   Un único estado de filtro alimenta TODAS las vistas, indicadores,
   gráficos y tablas: se elimina el "doble filtro".
   ============================================================ */
(function (global) {
  "use strict";
  const { CFG } = global.POI;
  const D = global.POI.data;
  const MT = global.POI.metrics;
  const CH = global.POI.charts;
  const { COL, fmt, fmt1, esc, truncate } = CH;

  // ---- estado global --------------------------------------------------------
  let STORE = null;
  let META = { updated: null };
  const FILTER = { programas: [], meses: [], especialistas: [] };
  let VIEW = "ejecutivo";
  let espSel = null;               // drill-down de la vista Especialistas
  let cliSel = null;               // empresa seleccionada en el Calendario
  let calMode = "empresa";         // modo del calendario: "empresa" | "intervencion"
  let cddSel = null;               // Unidad Productiva seleccionada en CdD-FEST
  let cddMode = "up";              // modo CdD-FEST: "up" (por unidad) | "general" (todas)
  let cddDrillGrupo = null;        // componente (1-5) elegido en la Vista general para ver su detalle
  let cddDrillActividad = null;    // código de actividad (p. ej. "3.4") elegido dentro del detalle del componente
  let lastExport = null;           // datos exportables de la vista activa

  // ---- iconografía ----------------------------------------------------------
  const I = {
    grid: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    user: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    building: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    puzzle: '<path d="M9 3a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 0-1 1v1a2 2 0 0 1-4 0v-1a1 1 0 0 0-1-1H5a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H2a2 2 0 0 1 0-4h1a1 1 0 0 0 1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 0 1-1z"/>',
    target: '<path d="M22 12A10 10 0 1 1 12 2"/><path d="M22 2 12 12"/><path d="M16 2h6v6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    layers: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    scale: '<path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0zM17 7l-3 6a3 3 0 0 0 6 0z"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    spark: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
    repeat: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  };
  const svgIco = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

  const NAV = [
    { id: "ejecutivo", ico: I.grid, label: "Resumen ejecutivo", sub: "Meta vs Ejecución · visión general" },
    { id: "especialistas", ico: I.user, label: "Especialistas", sub: "Cumplimiento individual · tareas por mes" },
    { id: "programas", ico: I.folder, label: "Programas", sub: "Ejecución por programa presupuestal" },
    { id: "clientes", ico: I.building, label: "Clientes", sub: "Nuevos · reenganchados · focalizados" },
    { id: "servicios", ico: I.puzzle, label: "Servicios", sub: "Estructura y cumplimiento de servicios" },
    { id: "calendario", ico: I.calendar, label: "Calendario de atención", sub: "Días de atención por empresa · calendario mensual" },
    { id: "cddfest", ico: I.compass, label: "CdD-FEST", sub: "Radar ICE · orden recomendado · línea de tiempo por componente" },
  ];

  const PROG_COLORS = [COL.accent, COL.blue, COL.mid, COL.purple, COL.soft, "#C77DC7", "#5FA0E0"];
  const colorFor = (i) => PROG_COLORS[i % PROG_COLORS.length];
  // Paleta categórica para los puntos de intervención (calendario programado)
  const PUNTO_COLORS = ["#7A2A7A", "#2E5FD4", "#1F9D6B", "#E0A82E", "#C0392B", "#9B4D9B",
    "#0FA3A3", "#D2691E", "#5FA0E0", "#C77DC7", "#6B8E23", "#B0338A", "#3D7A5C", "#8A5A2B"];
  // Paleta fija por componente C1-C5 (CdD-FEST): C1 línea base, C2 azul,
  // C3 morado institucional, C4 ámbar, C5 verde (crecimiento/exportación).
  const COMPONENTE_COLORS = { 1: "#0B1B33", 2: COL.blue, 3: COL.purple, 4: "#E0A82E", 5: CH.SEM.verde };

  // ---- helpers de estado semáforo ------------------------------------------
  const estadoTxt = { verde: "En meta", amarillo: "En proceso", rojo: "En riesgo" };
  const estadoTone = { verde: "green", amarillo: "amber", rojo: "red" };

  // =========================================================================
  //  COMPONENTES REUTILIZABLES
  // =========================================================================
  function kpiCard(o) {
    const barHtml = o.bar != null
      ? `<div class="kpi-bar"><span style="width:${Math.max(0, Math.min(o.bar, 100))}%;background:${o.barColor || COL.accent}"></span></div>` : "";
    const valCls = o.crit ? "kpi-val crit" : "kpi-val";
    const unit = o.unit ? `<small>${o.unit}</small>` : "";
    return `
      <div class="kpi">
        <div class="kpi-top">
          <span class="kpi-name">${esc(o.name)}</span>
          <span class="kpi-ico ${o.tone || "purple"}">${svgIco(o.icon)}</span>
        </div>
        <div class="${valCls}">${o.value}${unit}</div>
        ${barHtml}
        <div class="kpi-foot">${o.foot || ""}</div>
      </div>`;
  }

  function sectionHead(title, sub) {
    return `<div class="section-head"><h2>${esc(title)}</h2>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</div>`;
  }
  function panel(title, sub, inner, headExtra) {
    return `<div class="card">
      <div class="card-head"><div><h3>${esc(title)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>${headExtra || ""}</div>
      <div class="chartbox">${inner}</div></div>`;
  }
  const legendMetaEjec = `<div class="chart-legend">
     <span><i style="background:${COL.accent}"></i>Ejecutado</span>
     <span><i style="background:${COL.soft}"></i>Meta</span></div>`;
  const legendSemaforo = `<div class="legend-sem">
     <span><i style="background:${CH.SEM.verde}"></i>Cumplido ≥100%</span>
     <span><i style="background:${CH.SEM.amarillo}"></i>En proceso 80–99%</span>
     <span><i style="background:${CH.SEM.rojo}"></i>En riesgo &lt;80%</span></div>`;

  // Tabla con búsqueda + paginación
  function mountTable(el, cfg) {
    let q = "", page = 1;
    const pageSize = cfg.pageSize || 10;
    function filtered() {
      if (!q) return cfg.rows;
      const t = q.toLowerCase();
      return cfg.rows.filter((r) => (cfg.searchKeys || Object.keys(r))
        .some((k) => String(r[k] == null ? "" : r[k]).toLowerCase().includes(t)));
    }
    function render() {
      const rows = filtered();
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      if (page > pages) page = pages;
      const slice = rows.slice((page - 1) * pageSize, page * pageSize);
      const thead = `<tr>${cfg.columns.map((c) => `<th class="${c.cls || ""}">${esc(c.label)}</th>`).join("")}</tr>`;
      const tbody = slice.map((r) => `<tr>${cfg.columns.map((c) =>
        `<td class="${c.cls || ""} ${c.tdcls || ""}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("")
        || `<tr><td colspan="${cfg.columns.length}"><div class="empty">Sin resultados</div></td></tr>`;
      let pager = "";
      if (pages > 1) {
        const btns = [];
        btns.push(`<button data-p="${page - 1}" ${page === 1 ? "disabled" : ""}>‹</button>`);
        for (let p = 1; p <= pages; p++) {
          if (pages > 7 && Math.abs(p - page) > 2 && p !== 1 && p !== pages) {
            if (p === 2 || p === pages - 1) btns.push(`<button disabled>…</button>`);
            continue;
          }
          btns.push(`<button class="${p === page ? "active" : ""}" data-p="${p}">${p}</button>`);
        }
        btns.push(`<button data-p="${page + 1}" ${page === pages ? "disabled" : ""}>›</button>`);
        pager = `<div class="pager">${btns.join("")}</div>`;
      }
      el.innerHTML = `
        <div class="thead">
          <div><h3>${esc(cfg.title)}</h3>${cfg.sub ? `<div class="sub">${esc(cfg.sub)}</div>` : ""}</div>
          ${cfg.search === false ? "" : `<div class="tsearch"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input placeholder="${esc(cfg.searchPlaceholder || "Buscar…")}" value="${esc(q)}"></div>`}
        </div>
        <div class="tablewrap"><table class="dt"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
        <div class="tfoot"><span class="info">Mostrando ${slice.length} de ${rows.length}${cfg.totalLabel || ""}</span>${pager}</div>`;
      const input = el.querySelector(".tsearch input");
      if (input) input.addEventListener("input", (e) => {
        q = e.target.value; page = 1; render();
        const i2 = el.querySelector(".tsearch input"); if (i2) { i2.focus(); i2.setSelectionRange(q.length, q.length); }
      });
      el.querySelectorAll(".pager button[data-p]").forEach((b) =>
        b.addEventListener("click", () => { page = +b.dataset.p; render(); }));
    }
    render();
  }

  // Barra celda de avance (para tablas)
  function cellBar(pct) {
    const c = CH.semColor(pct);
    return `<div class="cellbar"><div class="t"><span style="width:${Math.max(0, Math.min(pct, 100))}%;background:${c}"></span></div><span class="pv">${Math.round(pct)}%</span></div>`;
  }
  function statusBadge(pct) {
    const s = global.POI.semaforo(pct);
    return `<span class="badge ${estadoTone[s]}"><i></i>${estadoTxt[s]}</span>`;
  }

  // Buscador con lista (combobox): un input de texto + menú filtrable, en
  // lugar de un <select> largo. Busca por nombre O por RUC a la vez.
  // items: [{value, label, sub}]. `onPick(value)` se llama al elegir uno.
  function searchSelectHtml(id, items, selectedValue, placeholder) {
    const sel = items.find((it) => it.value === selectedValue);
    return `<div class="searchsel" id="${id}">
      <svg class="searchsel-ico" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" class="searchsel-input" autocomplete="off" placeholder="${esc(placeholder || "Buscar…")}"
             value="${esc(sel ? sel.label : "")}" data-value="${esc(selectedValue || "")}">
      <div class="searchsel-menu"></div>
    </div>`;
  }
  function wireSearchSelect(id, items, onPick) {
    const root = document.getElementById(id);
    if (!root) return;
    const input = root.querySelector(".searchsel-input");
    const menu = root.querySelector(".searchsel-menu");
    function renderMenu(text) {
      const t = (text || "").trim().toLowerCase();
      const filtered = !t ? items : items.filter((it) =>
        it.label.toLowerCase().includes(t) || (it.sub || "").toLowerCase().includes(t));
      const shown = filtered.slice(0, 60);
      menu.innerHTML = shown.length
        ? shown.map((it) => `<div class="searchsel-opt" data-value="${esc(it.value)}">
            <span class="n">${esc(it.label)}</span>${it.sub ? `<span class="s">${esc(it.sub)}</span>` : ""}</div>`).join("")
        : `<div class="searchsel-opt disabled">Sin resultados</div>`;
      menu.querySelectorAll(".searchsel-opt[data-value]").forEach((el) =>
        el.addEventListener("mousedown", (e) => {
          e.preventDefault(); // evita el blur antes del click
          const it = items.find((x) => x.value === el.dataset.value);
          input.value = it ? it.label : ""; input.dataset.value = el.dataset.value;
          menu.classList.remove("open");
          onPick(el.dataset.value);
        }));
    }
    input.addEventListener("focus", () => { renderMenu(""); menu.classList.add("open"); input.select(); });
    input.addEventListener("input", () => { renderMenu(input.value); menu.classList.add("open"); });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.blur(); menu.classList.remove("open"); } });
    input.addEventListener("blur", () => { setTimeout(() => menu.classList.remove("open"), 120); });
  }

  // =========================================================================
  //  VISTAS
  // =========================================================================
  function currentData() { return D.aplicar(STORE, FILTER); }

  // Sin filtro de programa, limita al programa principal (POI). Con filtro,
  // respeta el filtro. Sirve para que clientes (atendidos + meta) usen el
  // mismo alcance POI por defecto.
  function scopeMainPrograma(rows, progCol) {
    if (FILTER.programas && FILTER.programas.length) return rows;
    const P = CFG.PROGRAMA_PRINCIPAL;
    if (P && rows.some((r) => r[progCol] === P)) return rows.filter((r) => r[progCol] === P);
    return rows;
  }

  // Ejecución para el indicador de clientes: sin filtro de programa, se limita
  // al programa principal (POI) para que "atendidos" y su meta usen el mismo
  // alcance. Si hay filtro de programa, respeta ese filtro.
  function clientesScopedEje(eje) {
    if (FILTER.programas && FILTER.programas.length) return eje;
    const P = CFG.PROGRAMA_PRINCIPAL;
    if (P && eje.some((r) => r[CFG.X.PROGRAMA] === P))
      return eje.filter((r) => r[CFG.X.PROGRAMA] === P);
    return eje;
  }

  function noData(msg) {
    return `<div class="empty" style="min-height:280px">${esc(msg || "No hay datos para los filtros seleccionados.")}</div>`;
  }

  // ---- EJECUTIVO ------------------------------------------------------------
  function viewEjecutivo() {
    const { eje, met } = currentData();
    const k = MT.kpis(eje, met);
    if (k.meta === 0 && k.ejecutado === 0) return noData();
    const metCli = D.filtrarClientes(STORE, FILTER);
    const kc = MT.kpisClientes(clientesScopedEje(eje), metCli);
    const cx = MT.complejidadResumen(eje);
    const rk = MT.rankingEspecialistas(eje, met);
    const enRiesgo = rk.filter((r) => r.Meta > 0 && r.Cumplimiento < CFG.SEMAFORO_AMARILLO).length;
    const porProg = MT.metaVsEjec(eje, met, CFG.X.PROGRAMA, CFG.M.PROGRAMA);
    porProg.sort((a, b) => b.Cumplimiento - a.Cumplimiento);
    const tm = MT.tendenciaMensual(eje, met);

    // estado de cumplimiento por especialista (semáforo)
    const conMeta = rk.filter((r) => r.Meta > 0);
    const enMeta = conMeta.filter((r) => r.Cumplimiento >= 100).length;
    const proceso = conMeta.filter((r) => r.Cumplimiento >= 80 && r.Cumplimiento < 100).length;
    const riesgo = conMeta.filter((r) => r.Cumplimiento < 80).length;
    const estadoSegs = [
      { label: "En meta", value: enMeta, color: CH.SEM.verde },
      { label: "En proceso", value: proceso, color: CH.SEM.amarillo },
      { label: "En riesgo", value: riesgo, color: CH.SEM.rojo },
    ];

    // export
    lastExport = {
      filename: "resumen_especialistas.csv",
      columns: ["Especialista", "Programado", "Ejecutado", "Cumplimiento %", "Clientes focalizados", "Clientes no focalizados"],
      rows: rk.map((r) => [r.Dim, Math.round(r.Meta), Math.round(r.Ejecutado), r.Cumplimiento, r.ClientesFoc, r.ClientesNoFoc])
    };

    const metaNoFoc = Math.max(kc.meta_clientes - kc.meta_focalizados, 0);
    const tagCls = (p) => (p >= 100 ? "up" : p >= 80 ? "warn" : "down");
    const kpis = [
      kpiCard({
        name: "Avance global POI", icon: I.target, tone: "purple",
        value: fmt1(k.cumplimiento), unit: "%", bar: k.cumplimiento, barColor: CH.semColor(k.cumplimiento),
        foot: `<span class="tag ${tagCls(k.cumplimiento)}">${estadoTxt[global.POI.semaforo(k.cumplimiento)]}</span><span class="muted">del total programado</span>`
      }),
      kpiCard({
        name: "Metas ejecutadas", icon: I.check, tone: "purple",
        value: fmt(k.ejecutado), bar: k.cumplimiento,
        foot: `<span class="muted">Meta <span class="strong">${fmt(k.meta)}</span> · ${Math.round(k.cumplimiento)}% cumplido</span>`
      }),
      kpiCard({
        name: "Clientes atendidos", icon: I.building, tone: "blue",
        value: fmt(kc.ejec_clientes), bar: kc.pct_clientes, barColor: CH.semColor(kc.pct_clientes),
        foot: kc.meta_clientes
          ? `<span class="tag ${tagCls(kc.pct_clientes)}">${Math.round(kc.pct_clientes)}%</span><span class="muted">Meta <span class="strong">${fmt(kc.meta_clientes)}</span> · foc ${fmt(kc.meta_focalizados)} / no foc ${fmt(metaNoFoc)}</span>`
          : `<span class="muted">empresas únicas atendidas</span>`
      }),
      kpiCard({
        name: "Clientes focalizados", icon: I.pin, tone: "purple",
        value: fmt(kc.ejec_focalizados), bar: kc.pct_focalizados, barColor: CH.semColor(kc.pct_focalizados),
        foot: kc.meta_focalizados
          ? `<span class="tag ${tagCls(kc.pct_focalizados)}">${Math.round(kc.pct_focalizados)}%</span><span class="muted">Meta <span class="strong">${fmt(kc.meta_focalizados)}</span> focalizadas</span>`
          : `<span class="muted">empresas focalizadas atendidas</span>`
      }),
      kpiCard({
        name: "Especialistas cumpliendo", icon: I.check, tone: "green",
        value: fmt(enMeta),
        foot: `<span class="muted">de <span class="strong">${fmt(conMeta.length)}</span> con meta · según lo programado</span>`
      }),
    ].join("");

    return `
      ${sectionHead("Indicadores clave", "Estado general de la ejecución del POI")}
      <section class="grid grid-kpi-5">${kpis}</section>
      <section class="grid g-2-5">
        ${panel("Avance físico mensual", "Meta vs Ejecutado por mes", CH.barsVertical(tm.map((r) => ({ label: r.Mes, a: r.Ejecutado, b: r.Meta })), { nameA: "Ejecutado", nameB: "Meta", capLimit: 12 }), legendMetaEjec)}
        ${panel("Avance por programa", "% de cumplimiento de metas", progList(porProg))}
        ${panel("Estado de cumplimiento", "Especialistas por semáforo",
      CH.donut(estadoSegs, fmt(conMeta.length), "con meta") + CH.legendList(estadoSegs))}
      </section>
      <section class="card tablecard" id="tbl-ejec"></section>`;
  }

  function progList(rows) {
    if (!rows.length) return CH.empty();
    return `<div class="prog-list">${rows.map((r) => {
      const c = CH.semColor(r.Cumplimiento);
      return `<div class="prog-row">
        <div class="lab"><span class="n">${esc(truncate(r.Dim, 34))}</span><span class="p" style="color:${c}">${Math.round(r.Cumplimiento)}%</span></div>
        <div class="prog-track"><span style="width:${Math.max(0, Math.min(r.Cumplimiento, 100))}%;background:${c}"></span></div>
      </div>`;
    }).join("")}</div>`;
  }

  function afterEjecutivo() {
    const { eje, met } = currentData();
    const rk = MT.rankingEspecialistas(eje, met);
    const el = document.getElementById("tbl-ejec");
    if (!el) return;
    mountTable(el, {
      title: "Detalle por especialista", sub: `${rk.length} especialistas · ordenados por ejecución`,
      searchPlaceholder: "Buscar especialista…", searchKeys: ["Dim"],
      rows: rk, pageSize: 10, totalLabel: " especialistas",
      columns: [
        { label: "Especialista", key: "Dim", cls: "name", render: (r) => esc(r.Dim) },
        { label: "Programado", cls: "num", render: (r) => fmt(r.Meta) },
        { label: "Ejecutado", cls: "num strong", render: (r) => fmt(r.Ejecutado) },
        { label: "Cli. focalizados", cls: "num", render: (r) => fmt(r.ClientesFoc) },
        { label: "Cli. no focaliz.", cls: "num", render: (r) => fmt(r.ClientesNoFoc) },
        { label: "Avance", render: (r) => cellBar(r.Cumplimiento) },
        { label: "Estado", cls: "ctr", render: (r) => r.Meta > 0 ? statusBadge(r.Cumplimiento) : `<span class="badge neutral"><i></i>Sin meta</span>` },
      ],
    });
  }

  // ---- ESPECIALISTAS --------------------------------------------------------
  function viewEspecialistas() {
    const { eje: ejeG, met: metG } = currentData();
    const nombres = Array.from(new Set([
      ...ejeG.map((r) => r[CFG.X.ESPECIALISTA]),
      ...metG.map((r) => r[CFG.M.ESPECIALISTA]),
    ].filter((v) => v != null && v !== ""))).sort((a, b) => String(a).localeCompare(b, "es"));
    if (!nombres.length) return noData("No hay especialistas con los filtros actuales.");
    if (!espSel || !nombres.includes(espSel)) espSel = nombres[0];

    const eje = ejeG.filter((r) => r[CFG.X.ESPECIALISTA] === espSel);
    const met = metG.filter((r) => r[CFG.M.ESPECIALISTA] === espSel);
    const k = MT.kpis(eje, met);
    const hm = MT.heatmapCumplimiento(eje, met);
    const tm = MT.tendenciaMensual(eje, met);
    const porProg = MT.metaVsEjec(eje, met, CFG.X.PROGRAMA, CFG.M.PROGRAMA);
    const porComp = MT.metaVsEjec(eje, met, CFG.X.COMPLEJIDAD, CFG.M.COMPLEJIDAD, CFG.COMPLEJIDADES);

    const selector = `<div class="selectrow"><label>Ver especialista</label>
      <select class="pick" id="esp-pick">${nombres.map((n) =>
      `<option ${n === espSel ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>`;

    const kpis = [
      kpiCard({
        name: "Meta programada", icon: I.target, tone: "purple", value: fmt(k.meta),
        foot: `<span class="muted">Total comprometido</span>`
      }),
      kpiCard({
        name: "Ejecutado", icon: I.check, tone: "purple", value: fmt(k.ejecutado),
        bar: k.cumplimiento, foot: `<span class="muted"><span class="strong">${fmt(k.actividades)}</span> actividades</span>`
      }),
      kpiCard({
        name: "Cumplimiento", icon: I.spark, tone: estadoTone[global.POI.semaforo(k.cumplimiento)],
        value: fmt1(k.cumplimiento), unit: "%", bar: k.cumplimiento, barColor: CH.semColor(k.cumplimiento),
        foot: `<span class="tag ${k.cumplimiento >= 100 ? "up" : k.cumplimiento >= 80 ? "warn" : "down"}">${estadoTxt[global.POI.semaforo(k.cumplimiento)]}</span>`
      }),
      kpiCard({
        name: "Clientes atendidos", icon: I.building, tone: "blue", value: fmt(k.clientes),
        foot: `<span class="muted"><span class="strong">${fmt(k.focalizados)}</span> focalizados</span>`
      }),
    ].join("");

    return `
      ${sectionHead("Resumen del especialista", espSel)}
      ${selector}
      <section class="grid grid-kpi">${kpis}</section>
      ${panel("Cumplimiento por tarea y mes", "Semáforo de avance (% ejecutado sobre meta)", CH.heatmap(hm) + legendSemaforo)}
      <section class="grid g-2">
        ${panel("Evolución mensual", "Meta vs Ejecutado", CH.barsVertical(tm.map((r) => ({ label: r.Mes, a: r.Ejecutado, b: r.Meta })), { nameA: "Ejecutado", nameB: "Meta" }), legendMetaEjec)}
        ${panel("Meta vs Ejecutado por complejidad", "", CH.barsMetaEjec(porComp, { gutter: 90 }), legendMetaEjec)}
      </section>
      ${panel("Meta vs Ejecutado por programa", "", CH.barsMetaEjec(porProg, { gutter: 140 }), legendMetaEjec)}
      <section class="card tablecard" id="tbl-esp"></section>
      <section class="card tablecard" id="tbl-cli-meta"></section>`;
  }

  // Celda "atendido / meta" con barra de progreso (meta de clientes)
  function metaCell(aten, meta, tiene) {
    if (!tiene) return `<span class="muted">${fmt(aten)} / —</span>`;
    const p = meta ? (aten / meta) * 100 : 0, c = CH.semColor(p);
    return `<div class="cellbar" style="min-width:140px"><div class="t"><span style="width:${Math.max(0, Math.min(p, 100)).toFixed(0)}%;background:${c}"></span></div><span class="pv" style="width:auto;min-width:52px">${fmt(aten)} / ${fmt1(meta)}</span></div>`;
  }

  function afterEspecialistas() {
    const pick = document.getElementById("esp-pick");
    if (pick) pick.addEventListener("change", (e) => { espSel = e.target.value; renderView(); });
    const { eje: ejeG, met: metG } = currentData();
    if (!espSel) return;

    // --- Meta de clientes atendidos por especialista (todos · alcance POI) ---
    const ejePoi = clientesScopedEje(ejeG);
    const metPoi = scopeMainPrograma(metG, CFG.M.PROGRAMA);
    const espsConMeta = new Set(metPoi.map((r) => r[CFG.M.ESPECIALISTA]).filter((v) => v != null && v !== ""));
    const metCli = D.filtrarClientes(STORE, FILTER);
    const kc = MT.kpisClientes(ejePoi, metCli);
    const metaNoFoc = Math.max(kc.meta_clientes - kc.meta_focalizados, 0);
    const cme = MT.clientesMetaEspecialistas(ejePoi, espsConMeta, kc.meta_focalizados, metaNoFoc);
    const cliMetaEl = document.getElementById("tbl-cli-meta");
    if (cliMetaEl) {
      mountTable(cliMetaEl, {
        title: "Meta de clientes atendidos por especialista",
        sub: `Alcance POI · cada cliente cuenta para quien lo atendió primero · meta repartida entre ${cme.Nesp} especialistas con metas (foc ${fmt1(cme.targetFoc)} · no foc ${fmt1(cme.targetNoFoc)} c/u)`,
        searchPlaceholder: "Buscar especialista…", searchKeys: ["esp"], rows: cme.rows,
        pageSize: 16, totalLabel: " especialistas",
        columns: [
          { label: "Especialista", cls: "name", render: (r) => esc(r.esp) + (r.tieneMeta ? "" : ` <span class="badge neutral"><i></i>sin meta</span>`) },
          { label: "Focalizados (aten / meta)", render: (r) => metaCell(r.foc, r.metaFoc, r.tieneMeta) },
          { label: "No focalizados (aten / meta)", render: (r) => metaCell(r.nofoc, r.metaNoFoc, r.tieneMeta) },
          { label: "Total", cls: "num strong", render: (r) => fmt(r.total) },
        ],
      });
    }

    const eje = ejeG.filter((r) => r[CFG.X.ESPECIALISTA] === espSel);
    const cl = MT.clientesResumen(eje, STORE.bd);
    const rows = cl.tabla.slice().sort((a, b) => b.Servicios - a.Servicios);
    lastExport = {
      filename: `clientes_${espSel}.csv`,
      columns: ["RUC", "Razón social", "Clasificación", "Focalizado", "Meses", "Servicios"],
      rows: rows.map((r) => [r.RUC, r.Razon, r.Tipo, r.Focalizado ? "Sí" : "No", r.Meses, Math.round(r.Servicios)])
    };
    const el = document.getElementById("tbl-esp");
    if (!el) return;
    mountTable(el, {
      title: "Clientes atendidos", sub: `${rows.length} empresas`, searchPlaceholder: "Buscar empresa / RUC…",
      searchKeys: ["RUC", "Razon", "Tema"], rows, pageSize: 8, totalLabel: " empresas",
      columns: [
        { label: "RUC", key: "RUC", cls: "" },
        { label: "Razón social", cls: "name", render: (r) => esc(r.Razon) },
        { label: "Clasificación", render: (r) => esc(r.Tipo) },
        { label: "Focalizado", cls: "ctr", render: (r) => r.Focalizado ? `<span class="badge green"><i></i>Sí</span>` : `<span class="badge neutral"><i></i>No</span>` },
        { label: "Meses", render: (r) => esc(r.Meses) },
        { label: "Servicios", cls: "num strong", render: (r) => fmt(r.Servicios) },
      ],
    });
  }

  // ---- PROGRAMAS ------------------------------------------------------------
  function viewProgramas() {
    const { eje, met } = currentData();
    const porProg = MT.metaVsEjec(eje, met, CFG.X.PROGRAMA, CFG.M.PROGRAMA);
    if (!porProg.length) return noData();
    porProg.sort((a, b) => b.Ejecutado - a.Ejecutado);

    lastExport = {
      filename: "programas.csv",
      columns: ["Programa", "Meta", "Ejecutado", "Cumplimiento %"],
      rows: porProg.map((r) => [r.Dim, Math.round(r.Meta), Math.round(r.Ejecutado), r.Cumplimiento])
    };

    const kpiCols = porProg.map((r, i) => kpiCard({
      name: truncate(r.Dim, 22), icon: I.folder, tone: estadoTone[r.Semaforo],
      value: fmt(r.Ejecutado), unit: ` / ${fmt(r.Meta)}`, bar: r.Cumplimiento, barColor: CH.semColor(r.Cumplimiento),
      foot: `<span class="tag ${r.Cumplimiento >= 100 ? "up" : r.Cumplimiento >= 80 ? "warn" : "down"}">${Math.round(r.Cumplimiento)}%</span><span class="muted">cumplimiento</span>`,
    })).join("");

    // evolución mensual por programa (multilínea)
    const progs = porProg.map((r) => r.Dim);
    const mesesSet = new Set();
    eje.forEach((r) => { if (r[CFG.X.MES] >= 1 && r[CFG.X.MES] <= 12) mesesSet.add(r[CFG.X.MES]); });
    const meses = Array.from(mesesSet).sort((a, b) => a - b);
    const series = progs.map((p, i) => ({
      name: p, color: colorFor(i),
      values: meses.map((mes) => {
        const v = eje.filter((r) => r[CFG.X.PROGRAMA] === p && r[CFG.X.MES] === mes)
          .reduce((a, r) => a + (Number(r[CFG.X.CANTIDAD]) || 0), 0);
        return { label: CFG.MESES_ES[mes], value: v };
      }),
    }));
    const lineLegend = `<div class="chart-legend">${progs.map((p, i) =>
      `<span><i style="background:${colorFor(i)}"></i>${esc(truncate(p, 18))}</span>`).join("")}</div>`;

    // focalización
    const focRucs = new Set(), noFocRucs = new Set();
    eje.forEach((r) => (r.ES_FOCALIZADO ? focRucs : noFocRucs).add(r[CFG.X.RUC]));
    const focSegs = [
      { label: "Focalizadas", value: focRucs.size, color: COL.accent },
      { label: "No focalizadas", value: noFocRucs.size, color: COL.soft },
    ];
    const metCli = D.filtrarClientes(STORE, FILTER);
    const kc = MT.kpisClientes(eje, metCli);

    return `
      ${sectionHead("Cumplimiento por programa", "Ejecutado / Meta")}
      <section class="grid grid-kpi">${kpiCols}</section>
      <section class="grid g-3-2">
        ${panel("Meta vs Ejecutado", "Por programa presupuestal", CH.barsMetaEjec(porProg, { gutter: 150 }), legendMetaEjec)}
        ${panel("% de cumplimiento", "Semáforo por programa", CH.barsSemaforo(porProg, { gutter: 150 }), legendSemaforo)}
      </section>
      ${panel("Ejecución mensual por programa", "Servicios ejecutados por mes", meses.length ? CH.multiLine(series, meses.map((m) => CFG.MESES_ES[m])) : CH.empty(), lineLegend)}
      <section class="grid g-2">
        ${panel("Empresas atendidas", "Focalizadas vs no focalizadas", CH.donut(focSegs, fmt(focRucs.size + noFocRucs.size), "empresas") + CH.legendList(focSegs))}
        ${panel("Atención a empresas focalizadas", kc.meta_focalizados ? `Meta ${fmt(kc.meta_focalizados)} focalizadas` : "Focalizadas atendidas", CH.gaugeRing(kc.pct_focalizados, { label: `${fmt(kc.ejec_focalizados)}${kc.meta_focalizados ? " / " + fmt(kc.meta_focalizados) : ""} focalizadas` }))}
      </section>`;
  }

  // ---- CLIENTES -------------------------------------------------------------
  function viewClientes() {
    const { eje, met } = currentData();
    if (!eje.length) return noData();
    const metCli = D.filtrarClientes(STORE, FILTER);
    const cl = MT.clientesResumen(eje, STORE.bd);
    const kc = MT.kpisClientes(eje, metCli);
    const porMes = MT.clientesNuevosPorMes(eje);
    const metaMes = MT.clientesMetaPorMes(metCli);

    lastExport = {
      filename: "padron_clientes.csv",
      columns: ["RUC", "Razón social", "Clasificación", "Focalizado", "Meses", "Servicios"],
      rows: cl.tabla.slice().sort((a, b) => b.Servicios - a.Servicios)
        .map((r) => [r.RUC, r.Razon, r.Tipo, r.Focalizado ? "Sí" : "No", r.Meses, Math.round(r.Servicios)])
    };

    const kpis = [
      kpiCard({
        name: "Clientes atendidos", icon: I.building, tone: estadoTone[global.POI.semaforo(kc.pct_clientes)],
        value: fmt(cl.total), bar: kc.pct_clientes, barColor: CH.semColor(kc.pct_clientes),
        foot: kc.meta_clientes ? `<span class="muted">Meta <span class="strong">${fmt(kc.meta_clientes)}</span> · ${Math.round(kc.pct_clientes)}%</span>` : `<span class="muted">empresas únicas</span>`
      }),
      kpiCard({
        name: "Focalizados atendidos", icon: I.pin, tone: estadoTone[global.POI.semaforo(kc.pct_focalizados)],
        value: fmt(kc.ejec_focalizados), bar: kc.pct_focalizados, barColor: CH.semColor(kc.pct_focalizados),
        foot: kc.meta_focalizados ? `<span class="muted">Meta <span class="strong">${fmt(kc.meta_focalizados)}</span> · ${Math.round(kc.pct_focalizados)}%</span>` : `<span class="muted">empresas focalizadas</span>`
      }),
      kpiCard({
        name: "Clientes nuevos", icon: I.spark, tone: "green", value: fmt(cl.nuevos),
        foot: `<span class="muted">Sin historial · media/alta</span>`
      }),
      kpiCard({
        name: "Reenganchados", icon: I.repeat, tone: "amber", value: fmt(cl.reenganchados),
        foot: `<span class="muted">Sin servicio 2023–2025</span>`
      }),
    ].join("");

    const resto = Math.max(cl.total - cl.nuevos - cl.reenganchados, 0);
    const tipoSegs = [
      { label: "Nuevos", value: cl.nuevos, color: COL.accent },
      { label: "Reenganchados", value: cl.reenganchados, color: COL.blue },
      { label: "Recurrentes", value: resto, color: COL.soft },
    ];
    const focSegs = [
      { label: "Focalizados", value: cl.focalizados, color: COL.purple },
      { label: "No focalizados", value: cl.no_focalizados, color: COL.soft },
    ];

    // nuevos vs recurrentes por mes (apilado) + meta focalizados (línea)
    const stackRows = porMes.map((r) => ({ label: r.Mes, a: r.Nuevos, b: r.Recurrentes }));

    // ranking empresas
    const rk = cl.tabla.slice().sort((a, b) => b.Servicios - a.Servicios).slice(0, 15)
      .map((r) => ({ label: r.Razon || r.RUC, value: r.Servicios, color: r.Focalizado ? COL.purple : COL.soft }));

    return `
      ${sectionHead("Indicadores de clientes", "Cartera atendida en 2026")}
      <section class="grid grid-kpi">${kpis}</section>
      <section class="grid g-2">
        ${panel("Tipo de cliente", "Composición de la cartera", CH.donut(tipoSegs, fmt(cl.total), "clientes") + CH.legendList(tipoSegs))}
        ${panel("Focalización", "Focalizados vs no focalizados", CH.donut(focSegs, fmt(cl.total), "clientes") + CH.legendList(focSegs))}
      </section>
      <section class="grid g-2">
        ${panel("Clientes atendidos por mes", "Nuevos + recurrentes", CH.barsVertical(stackRows, { stacked: true, colA: COL.accent, colB: COL.soft, nameA: "Nuevos", nameB: "Recurrentes" }),
      `<div class="chart-legend"><span><i style="background:${COL.accent}"></i>Nuevos</span><span><i style="background:${COL.soft}"></i>Recurrentes</span></div>`)}
        ${panel("Ranking de empresas", "Top 15 por servicios · morado = focalizada", CH.barsSimple(rk, { gutter: 200, rowH: 26 }))}
      </section>
      <section class="card tablecard" id="tbl-cli"></section>`;
  }

  function afterClientes() {
    if (!lastExport) return;
    const el = document.getElementById("tbl-cli");
    if (!el) return;
    const rows = lastExport.rows.map((a) => ({ RUC: a[0], Razon: a[1], Tipo: a[2], Foc: a[3], Meses: a[4], Servicios: a[5] }));
    mountTable(el, {
      title: "Padrón de clientes atendidos", sub: `${rows.length} empresas`, searchPlaceholder: "Buscar empresa / RUC…",
      searchKeys: ["RUC", "Razon"], rows, pageSize: 12, totalLabel: " empresas",
      columns: [
        { label: "RUC", key: "RUC" },
        { label: "Razón social", cls: "name", render: (r) => esc(r.Razon) },
        { label: "Clasificación", render: (r) => esc(r.Tipo) },
        { label: "Focalizado", cls: "ctr", render: (r) => r.Foc === "Sí" ? `<span class="badge green"><i></i>Sí</span>` : `<span class="badge neutral"><i></i>No</span>` },
        { label: "Meses", render: (r) => esc(r.Meses) },
        { label: "Servicios", cls: "num strong", render: (r) => fmt(r.Servicios) },
      ],
    });
  }

  // ---- SERVICIOS ------------------------------------------------------------
  function viewServicios() {
    const { eje, met } = currentData();
    if (!eje.length) return noData();
    const porServ = MT.metaVsEjec(eje, met, CFG.X.SERVICIO, CFG.M.SERVICIO);
    const porTarea = MT.metaVsEjec(eje, met, CFG.X.TAREA, CFG.M.TAREA);
    const porComp = MT.metaVsEjec(eje, met, CFG.X.COMPLEJIDAD, CFG.M.COMPLEJIDAD, CFG.COMPLEJIDADES);
    const k = MT.kpis(eje, met);
    const servConMeta = porServ.filter((r) => r.Meta > 0).length;
    const servRiesgo = porServ.filter((r) => r.Meta > 0 && r.Cumplimiento < CFG.SEMAFORO_AMARILLO).length;

    lastExport = {
      filename: "servicios.csv",
      columns: ["Servicio", "Meta", "Ejecutado", "Cumplimiento %", "Brecha"],
      rows: porServ.slice().sort((a, b) => b.Ejecutado - a.Ejecutado)
        .map((r) => [r.Dim, Math.round(r.Meta), Math.round(r.Ejecutado), r.Cumplimiento, Math.round(r.Brecha)])
    };

    const nServ = porServ.length, nTarea = porTarea.length;
    const kpis = [
      kpiCard({
        name: "Servicios ejecutados", icon: I.layers, tone: "purple", value: fmt(k.actividades),
        foot: `<span class="muted"><span class="strong">${fmt(nServ)}</span> tipos de servicio</span>`
      }),
      kpiCard({
        name: "Tipos de tarea", icon: I.puzzle, tone: "blue", value: fmt(nTarea),
        foot: `<span class="muted">líneas de trabajo</span>`
      }),
      kpiCard({
        name: "Cumplimiento", icon: I.spark, tone: estadoTone[global.POI.semaforo(k.cumplimiento)],
        value: fmt1(k.cumplimiento), unit: "%", bar: k.cumplimiento, barColor: CH.semColor(k.cumplimiento),
        foot: `<span class="muted">Ejecutado ${fmt(k.ejecutado)} / ${fmt(k.meta)}</span>`
      }),
      kpiCard({
        name: "Servicios en riesgo", icon: I.alert, tone: servRiesgo ? "red" : "green",
        value: fmt(servRiesgo), crit: servRiesgo > 0,
        foot: `<span class="muted">de <span class="strong">${fmt(servConMeta)}</span> con meta · &lt;80%</span>`
      }),
    ].join("");

    // === "Estructura de la ejecución" — Meta vs Ejecutado por complejidad + brechas ===
    const brecha = porServ.filter((r) => r.Meta > 0).slice()
      .sort((a, b) => b.Brecha - a.Brecha).slice(0, 8)
      .map((r) => ({ label: r.Dim, value: r.Brecha, color: CH.semColor(r.Cumplimiento) }));

    return `
      ${sectionHead("Indicadores de servicios", "Volumen y cumplimiento")}
      <section class="grid grid-kpi">${kpis}</section>
      ${sectionHead("Estructura de la ejecución", "Meta vs ejecución por complejidad y brechas para la toma de decisiones")}
      <section class="grid g-2">
        ${panel("Meta vs Ejecutado por complejidad", "Cantidad programada vs ejecutada · Alta · Media · Baja", CH.barsMetaEjec(porComp, { gutter: 90 }), legendMetaEjec)}
        ${panel("Servicios con mayor brecha", "Meta no ejecutada (Top 8) · prioridad de atención", brecha.length ? CH.barsSimple(brecha, { gutter: 200 }) : CH.empty("Sin brechas: metas cumplidas"))}
      </section>
      ${sectionHead("Cumplimiento por servicio y por tarea")}
      <section class="grid g-2">
        ${panel("% por tipo de servicio", "", CH.barsSemaforo(porServ, { gutter: 170 }), legendSemaforo)}
        ${panel("% por tipo de tarea", "", CH.barsSemaforo(porTarea, { gutter: 170 }), legendSemaforo)}
      </section>
      ${panel("Meta vs Ejecutado por servicio", "", CH.barsMetaEjec(porServ.slice().sort((a, b) => b.Ejecutado - a.Ejecutado), { gutter: 170 }), legendMetaEjec)}`;
  }

  // ---- CALENDARIO: dos modos (empresa atendida / puntos de intervención) ---
  function viewCalendario() {
    const tabs = `<div class="segmented" id="cal-tabs">
      <button class="seg ${calMode === "empresa" ? "active" : ""}" data-mode="empresa">Por empresa</button>
      <button class="seg ${calMode === "intervencion" ? "active" : ""}" data-mode="intervencion">Puntos de intervención</button>
    </div>`;
    const body = calMode === "intervencion" ? viewCalIntervencion() : viewCalEmpresa();
    return `${tabs}${body}`;
  }

  function viewCalEmpresa() {
    const { eje } = currentData();
    if (!eje.length) return noData();
    const byRuc = new Map();
    eje.forEach((r) => {
      const ruc = r[CFG.X.RUC];
      if (!byRuc.has(ruc)) byRuc.set(ruc, { ruc, razon: r[CFG.X.RAZON], servicios: 0, foc: false, dates: [] });
      const o = byRuc.get(ruc);
      o.servicios += Number(r[CFG.X.CANTIDAD]) || 0;
      if (r.ES_FOCALIZADO) o.foc = true;
      const f = r[CFG.X.FECHA];
      if (f instanceof Date && !isNaN(f)) o.dates.push(f);
    });
    const empresas = Array.from(byRuc.values()).sort((a, b) => b.servicios - a.servicios);
    if (!empresas.length) return noData("No hay empresas con los filtros actuales.");
    if (!cliSel || !byRuc.has(cliSel)) cliSel = empresas[0].ruc;
    const emp = byRuc.get(cliSel);

    const selector = `<div class="selectrow"><label>Ver empresa</label>
      ${searchSelectHtml("cli-pick", empresas.map((e) => ({ value: e.ruc, label: e.razon || e.ruc, sub: e.ruc })),
      cliSel, "Buscar por RUC o razón social…")}</div>`;

    if (!emp.dates.length) {
      return `${sectionHead("Calendario de atención", emp.razon || emp.ruc)}${selector}
        <div class="empty" style="min-height:200px">Esta empresa no tiene fechas de atención registradas (columna FECHA vacía) para los filtros actuales.</div>`;
    }

    const monthMap = new Map(); // "Y-M" -> {year, month, days:Map(day->count)}
    const dayset = new Set();
    emp.dates.forEach((d) => {
      const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
      const key = y + "-" + m;
      if (!monthMap.has(key)) monthMap.set(key, { year: y, month: m, days: new Map() });
      const mm = monthMap.get(key);
      mm.days.set(day, (mm.days.get(day) || 0) + 1);
      dayset.add(key + "-" + day);
    });
    const months = Array.from(monthMap.values()).sort((a, b) => a.year - b.year || a.month - b.month);
    const fechasOrden = emp.dates.slice().sort((a, b) => a - b);
    const primero = fechasOrden[0], ultimo = fechasOrden[fechasOrden.length - 1];
    const fmtFecha = (d) => d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });

    lastExport = {
      filename: `calendario_${emp.ruc}.csv`, columns: ["Fecha", "Servicios ese dia"],
      rows: months.flatMap((mm) => Array.from(mm.days.entries()).sort((a, b) => a[0] - b[0])
        .map(([day, c]) => [`${mm.year}-${String(mm.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, c]))
    };

    const kpis = [
      kpiCard({
        name: "Días de atención", icon: I.calendar, tone: "purple", value: fmt(dayset.size),
        foot: `<span class="muted">jornadas con al menos un servicio</span>`
      }),
      kpiCard({
        name: "Servicios recibidos", icon: I.layers, tone: "blue", value: fmt(emp.servicios),
        foot: `<span class="muted">en ${fmt(months.length)} mes(es)</span>`
      }),
      kpiCard({
        name: "Primer contacto", icon: I.spark, tone: "purple", value: fmtFecha(primero),
        foot: `<span class="muted">inicio de atención</span>`
      }),
      kpiCard({
        name: "Último contacto", icon: I.clock, tone: "blue", value: fmtFecha(ultimo),
        foot: `<span class="muted">atención más reciente</span>`
      }),
    ].join("");

    const legend = `<div class="cal-legend"><span>Menos</span>
      <i style="background:var(--track)"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i>
      <span>más servicios/día</span></div>`;

    return `${sectionHead("Calendario de atención", emp.razon || emp.ruc)}
      ${selector}
      <section class="grid grid-kpi">${kpis}</section>
      ${panel("Días atendidos por mes", (emp.foc ? "Empresa focalizada · " : "") + "cada celda es un día; el color indica cuántos servicios se brindaron",
      `<div class="cal-grid">${months.map(renderMonth).join("")}</div>${legend}`)}`;
  }

  function renderMonth(mm) {
    const dows = ["L", "M", "M", "J", "V", "S", "D"];
    const daysInMonth = new Date(mm.year, mm.month, 0).getDate();
    const offset = (new Date(mm.year, mm.month - 1, 1).getDay() + 6) % 7; // lunes primero
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(`<div class="cal-day empty"></div>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const c = mm.days.get(d) || 0;
      if (!c) { cells.push(`<div class="cal-day">${d}</div>`); continue; }
      const lv = c >= 4 ? 4 : c;
      cells.push(`<div class="cal-day on lv${lv}" title="${d}/${mm.month}/${mm.year}: ${c} servicio${c === 1 ? "" : "s"}">${d}</div>`);
    }
    return `<div class="cal-month">
      <h4>${esc(CFG.MESES_NOMBRE[mm.month] || mm.month)} ${mm.year}</h4>
      <div class="cal-week dow">${dows.map((x) => `<div class="cal-dow">${x}</div>`).join("")}</div>
      <div class="cal-week">${cells.join("")}</div>
    </div>`;
  }

  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // ---- Calendario · modo Puntos de intervención (programado.xlsx) ----------
  function viewCalIntervencion() {
    const sub = "Fechas programadas de intervención · data/programado.xlsx";
    if (!STORE.programado || !STORE.programado.length)
      return `${sectionHead("Puntos de intervención", sub)}
        <div class="empty" style="min-height:220px">No se encontró <code>data/programado.xlsx</code> (o está vacío).<br>
        Agrégalo con las fechas programadas (CdD-FEST / WORLD-VISION) para ver este calendario.</div>`;
    const prog = D.filtrarProgramado(STORE, FILTER).filter((r) => r.FECHA instanceof Date && !isNaN(r.FECHA));
    if (!prog.length)
      return `${sectionHead("Puntos de intervención", sub)}
        <div class="empty" style="min-height:220px">No hay fechas programadas para los filtros actuales.</div>`;

    const puntos = Array.from(new Set(prog.map((r) => r.PUNTO))).sort((a, b) => String(a).localeCompare(b, "es"));
    const colorOf = new Map(puntos.map((p, i) => [p, PUNTO_COLORS[i % PUNTO_COLORS.length]]));

    const monthMap = new Map();
    prog.forEach((r) => {
      const d = r.FECHA, key = d.getFullYear() + "-" + (d.getMonth() + 1);
      if (!monthMap.has(key)) monthMap.set(key, { year: d.getFullYear(), month: d.getMonth() + 1, days: new Map() });
      const mm = monthMap.get(key), day = d.getDate();
      if (!mm.days.has(day)) mm.days.set(day, []);
      mm.days.get(day).push(r);
    });
    const months = Array.from(monthMap.values()).sort((a, b) => a.year - b.year || a.month - b.month);

    const esps = new Set(prog.map((r) => r.ESPECIALISTA).filter((v) => v != null && v !== ""));
    const metaCant = prog.reduce((a, r) => a + (r.META_CANTIDAD || 0), 0);
    const kpis = [
      kpiCard({ name: "Intervenciones programadas", icon: I.calendar, tone: "purple", value: fmt(prog.length),
        foot: `<span class="muted">fechas en el calendario</span>` }),
      kpiCard({ name: "Puntos de intervención", icon: I.pin, tone: "blue", value: fmt(puntos.length),
        foot: `<span class="muted">ubicaciones distintas</span>` }),
      kpiCard({ name: "Meta (cantidad)", icon: I.target, tone: "purple", value: fmt(metaCant),
        foot: `<span class="muted">servicios programados</span>` }),
      kpiCard({ name: "Especialistas", icon: I.user, tone: "blue", value: fmt(esps.size),
        foot: `<span class="muted">asignados</span>` }),
    ].join("");

    const legend = `<div class="cal-legend-punto">${puntos.map((p) =>
      `<span><i style="background:${colorOf.get(p)}"></i>${esc(p)}</span>`).join("")}</div>`;

    lastExport = {
      filename: "intervenciones_programadas.csv",
      columns: ["Fecha", "Punto", "Programa", "Especialista", "Turno", "Tipo servicio", "Tipo tarea", "Temática", "Meta cantidad"],
      rows: prog.slice().sort((a, b) => a.FECHA - b.FECHA).map((r) => [
        isoLocal(r.FECHA), r.PUNTO, r.PROGRAMA, r.ESPECIALISTA, r.TURNO, r.TIPO_SERVICIO, r.TIPO_TAREA, r.TEMATICA, Math.round(r.META_CANTIDAD)])
    };

    return `${sectionHead("Puntos de intervención", sub)}
      <section class="grid grid-kpi">${kpis}</section>
      ${panel("Fechas de intervención por mes", "clic en un día para ver el detalle abajo · el color indica el punto de intervención",
        `<div class="cal-grid">${months.map((mm) => renderMonthIntervencion(mm, colorOf)).join("")}</div>${legend}`)}
      <section class="card tablecard" id="cal-detail">
        <div class="thead"><div><h3>Detalle del día</h3><div class="sub">Haz clic en un día con intervención para ver los servicios programados</div></div></div>
      </section>`;
  }

  function renderMonthIntervencion(mm, colorOf) {
    const dows = ["L", "M", "M", "J", "V", "S", "D"];
    const daysInMonth = new Date(mm.year, mm.month, 0).getDate();
    const offset = (new Date(mm.year, mm.month - 1, 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(`<div class="cal-day empty"></div>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const items = mm.days.get(d);
      if (!items) { cells.push(`<div class="cal-day">${d}</div>`); continue; }
      const distinct = Array.from(new Set(items.map((r) => r.PUNTO)));
      const colors = distinct.map((p) => colorOf.get(p) || COL.accent);
      // Varios puntos ese día → franjas verticales, un color por punto
      const bg = colors.length === 1 ? colors[0]
        : `linear-gradient(90deg, ${colors.map((c, i) =>
          `${c} ${(i / colors.length * 100).toFixed(1)}% ${((i + 1) / colors.length * 100).toFixed(1)}%`).join(", ")})`;
      const iso = `${mm.year}-${String(mm.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cnt = items.length > 1 ? `<span class="cal-cnt">${items.length}</span>` : "";
      cells.push(`<div class="cal-day on" data-date="${iso}" style="background:${bg};cursor:pointer" title="${esc(distinct.join(" · "))} — clic para ver el detalle">${d}${cnt}</div>`);
    }
    return `<div class="cal-month">
      <h4>${esc(CFG.MESES_NOMBRE[mm.month] || mm.month)} ${mm.year}</h4>
      <div class="cal-week dow">${dows.map((x) => `<div class="cal-dow">${x}</div>`).join("")}</div>
      <div class="cal-week">${cells.join("")}</div>
    </div>`;
  }

  function renderCalDetail(dateIso, items) {
    const el = document.getElementById("cal-detail");
    if (!el) return;
    const [y, m, d] = dateIso.split("-");
    const titulo = `${+d} de ${CFG.MESES_NOMBRE[+m] || m} ${y}`;
    if (!items.length) {
      el.innerHTML = `<div class="thead"><div><h3>${esc(titulo)}</h3><div class="sub">Sin intervenciones programadas</div></div></div>`;
      return;
    }
    const rows = items.map((r) => `<tr>
      <td class="name">${esc(r.PUNTO)}</td>
      <td>${esc(r.PROGRAMA || "")}</td>
      <td>${esc(r.ESPECIALISTA || "")}</td>
      <td>${r.TURNO ? `<span class="badge neutral"><i></i>${esc(r.TURNO)}</span>` : ""}</td>
      <td>${esc(r.TIPO_SERVICIO || "")}</td>
      <td>${esc(r.TIPO_TAREA || "")}</td>
      <td>${esc(r.TEMATICA || "")}</td>
      <td class="num strong">${fmt(r.META_CANTIDAD)}</td>
    </tr>`).join("");
    const totalMeta = items.reduce((a, r) => a + (r.META_CANTIDAD || 0), 0);
    el.innerHTML = `<div class="thead"><div><h3>Intervenciones del ${esc(titulo)}</h3><div class="sub">${items.length} programada(s) · meta total ${fmt(totalMeta)}</div></div></div>
      <div class="tablewrap"><table class="dt"><thead><tr>
        <th>Punto</th><th>Programa</th><th>Especialista</th><th>Turno</th><th>Tipo de servicio</th><th>Tipo de tarea</th><th>Temática</th><th class="num">Meta</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function afterCalendario() {
    const tabs = document.getElementById("cal-tabs");
    if (tabs) tabs.querySelectorAll(".seg").forEach((b) =>
      b.addEventListener("click", () => { if (calMode !== b.dataset.mode) { calMode = b.dataset.mode; renderView(); } }));

    if (calMode === "empresa" && document.getElementById("cli-pick")) {
      const { eje } = currentData();
      const byRuc = new Map();
      eje.forEach((r) => {
        const ruc = r[CFG.X.RUC];
        if (!byRuc.has(ruc)) byRuc.set(ruc, { ruc, razon: r[CFG.X.RAZON] });
      });
      const items = Array.from(byRuc.values()).map((e) => ({ value: e.ruc, label: e.razon || e.ruc, sub: e.ruc }));
      wireSearchSelect("cli-pick", items, (v) => { cliSel = v; renderView(); });
    }

    if (calMode === "intervencion") {
      const prog = D.filtrarProgramado(STORE, FILTER).filter((r) => r.FECHA instanceof Date && !isNaN(r.FECHA));
      const byDate = new Map();
      prog.forEach((r) => {
        const iso = isoLocal(r.FECHA);
        if (!byDate.has(iso)) byDate.set(iso, []);
        byDate.get(iso).push(r);
      });
      document.querySelectorAll(".cal-day[data-date]").forEach((cell) =>
        cell.addEventListener("click", () => {
          document.querySelectorAll(".cal-day.sel").forEach((c) => c.classList.remove("sel"));
          cell.classList.add("sel");
          renderCalDetail(cell.dataset.date, byDate.get(cell.dataset.date) || []);
        }));
    }
  }

  // ---- CdD-FEST: planificador (dos modos: por UP / vista general) ----------
  // Ignora los filtros globales (programa/mes/especialista): tiene su propio
  // buscador de UP, igual que "Especialistas" tiene su propio picker
  // independiente del filtro global.
  function viewCddFest() {
    const tabs = `<div class="segmented" id="cdd-tabs">
      <button class="seg ${cddMode === "up" ? "active" : ""}" data-mode="up">Por Unidad Productiva</button>
      <button class="seg ${cddMode === "general" ? "active" : ""}" data-mode="general">Vista general</button>
    </div>`;
    const body = cddMode === "general" ? viewCddFestGeneral() : viewCddFestUP();
    return `${tabs}${body}`;
  }

  function viewCddFestUP() {
    const unidades = MT.cddFestUnidades(STORE.ejecucion, STORE.programado, STORE.resultsIce);
    if (!unidades.length)
      return noData("Aún no hay Unidades Productivas atendidas por CdD-FEST (ninguna con el componente 1.1 · Índice de Competitividad ejecutado).");
    if (!cddSel || !unidades.some((u) => u.ruc === cddSel)) cddSel = unidades[0].ruc;
    const up = unidades.find((u) => u.ruc === cddSel);

    const selector = `<div class="selectrow"><label>Ver unidad productiva</label>
      ${searchSelectHtml("cdd-pick", unidades.map((u) => ({ value: u.ruc, label: u.razon || u.ruc, sub: u.ruc })),
      cddSel, "Buscar por RUC o razón social…")}</div>`;

    if (!up.ice) {
      return `${sectionHead("CdD-FEST · Planificador", up.razon || up.ruc)}
        ${selector}
        <div class="empty" style="min-height:220px">Diagnóstico ICE pendiente — realizar C1 (Índice de Competitividad) antes de continuar.</div>`;
    }

    const orden = MT.ordenRecomendado(up.ice, up.estadoComponentes);
    const topPend = orden.find((o) => o.grupo !== 1 && o.estado !== "completado");
    const dims = MT.iceBrechas(up.ice);
    const completados = [1, 2, 3, 4, 5].filter((g) => up.estadoComponentes[g].status === "completado").length;
    const ejecutadas = up.eventos.filter((e) => e.ejecutado).length;
    const programadas = up.eventos.length - ejecutadas;

    lastExport = {
      filename: `cddfest_${up.ruc}.csv`,
      columns: ["Fecha", "Estado", "Componente", "Especialista", "Tema/Servicio", "Tipo de tarea", "Duración esperada"],
      rows: up.eventos.map((e) => [
        e.fecha ? isoLocal(e.fecha) : "", e.ejecutado ? "Ejecutado" : "Programado",
        e.componenteGrupo ? "C" + e.componenteGrupo : "", e.especialista || "",
        e.tema || e.tipoServicio || "", e.tipoTarea || "",
        (MT.reglaDuracion(e.tipoServicio, e.tipoTarea) || {}).label || "",
      ]),
    };

    const kpis = [
      kpiCard({
        name: "ICE Global", icon: I.spark, tone: "purple", value: fmt1(up.ice.ICE_GLOBAL || 0),
        foot: `<span class="muted">línea base de competitividad</span>`
      }),
      kpiCard({
        name: "Componentes completados", icon: I.check, tone: "green", value: fmt(completados), unit: " / 5",
        foot: `<span class="muted">de 5 componentes (C1–C5)</span>`
      }),
      kpiCard({
        name: "Próximo recomendado", icon: I.target, tone: "purple",
        value: topPend ? topPend.id : "—",
        foot: topPend
          ? `<span class="muted">${esc(truncate(CFG.COMPONENTES[topPend.grupo].nombre, 34))} · brecha ${fmt1(topPend.brecha)}</span>`
          : `<span class="muted">Sin componentes pendientes por brecha</span>`
      }),
      kpiCard({
        name: "Intervenciones totales", icon: I.layers, tone: "blue", value: fmt(up.eventos.length),
        foot: `<span class="muted"><span class="strong">${fmt(ejecutadas)}</span> ejecutadas · <span class="strong">${fmt(programadas)}</span> programadas</span>`
      }),
    ].join("");

    const radarPanel = panel("Radar de diagnóstico (ICE)",
      `ICE Global ${fmt1(up.ice.ICE_GLOBAL || 0)} · las dimensiones con "≈" son estimadas desde el Nivel`,
      CH.radar(dims, { highlightComponente: topPend ? topPend.grupo : null }));
    const ordenPanel = panel("Orden recomendado de intervención",
      "C1 es la línea base · entre los pendientes, se prioriza el de MENOR brecha (más cerca de estar listo)",
      ordenRecomendadoList(orden));

    const monthMap = new Map();
    up.eventos.forEach((e) => {
      if (!e.fecha) return;
      const key = e.fecha.getFullYear() + "-" + (e.fecha.getMonth() + 1);
      if (!monthMap.has(key)) monthMap.set(key, { year: e.fecha.getFullYear(), month: e.fecha.getMonth() + 1, days: new Map() });
      const mm = monthMap.get(key), day = e.fecha.getDate();
      if (!mm.days.has(day)) mm.days.set(day, []);
      mm.days.get(day).push(e);
    });
    const months = Array.from(monthMap.values()).sort((a, b) => a.year - b.year || a.month - b.month);
    const compLegend = `<div class="cal-legend-punto">${[1, 2, 3, 4, 5].map((g) =>
      `<span><i style="background:${COMPONENTE_COLORS[g]}"></i>${esc(CFG.COMPONENTES[g].id)}</span>`).join("")}
      <span><i style="background:${COL.muted2}" class="hatch-swatch"></i>Programado (no ejecutado)</span></div>`;

    const timelinePanel = up.eventos.length
      ? `${panel("Días con intervención por mes", "clic en un día para resaltar en la línea de tiempo · sólido = ejecutado, trama = solo programado",
        months.length ? `<div class="cal-grid">${months.map(renderMonthComponente).join("")}</div>${compLegend}` : CH.empty("Sin fechas registradas"))}
      ${panel("Línea de tiempo del proceso de fortalecimiento", "",
        `<div class="tl-list">${up.eventos.map(renderTimelineRow).join("")}</div>`)}`
      : panel("Línea de tiempo del proceso de fortalecimiento", "", CH.empty("Sin intervenciones registradas aún para esta unidad productiva"));

    return `
      ${sectionHead("CdD-FEST · Planificador", up.razon || up.ruc)}
      ${selector}
      <section class="grid grid-kpi">${kpis}</section>
      <section class="grid g-2">${radarPanel}${ordenPanel}</section>
      ${timelinePanel}
      <section class="card tablecard" id="tbl-cdd-comp"></section>`;
  }

  function ordenRecomendadoList(orden) {
    return `<div class="orden-list">${orden.map((o, idx) => {
      const comp = CFG.COMPONENTES[o.grupo];
      const badge = o.estado === "completado" ? `<span class="badge green"><i></i>Completado</span>`
        : o.estado === "programado" ? `<span class="badge amber"><i></i>Programado</span>`
          : `<span class="badge neutral"><i></i>Pendiente</span>`;
      const brechaTxt = o.brecha != null ? `${fmt1(o.brecha)}% brecha promedio` : "Línea base (diagnóstico)";
      return `<div class="orden-row">
        <span class="orden-pos">${idx + 1}</span>
        <span class="orden-dot" style="background:${COMPONENTE_COLORS[o.grupo]}"></span>
        <div class="orden-body">
          <div class="orden-name">${esc(o.id)} · ${esc(truncate(comp.nombre, 40))}</div>
          <div class="orden-sub">${esc(brechaTxt)}</div>
        </div>
        ${badge}
      </div>`;
    }).join("")}</div>`;
  }

  // ---- CdD-FEST · Vista general: todas las UP por componente (sin mezclar) -
  function compBadge(status) {
    if (status === "completado") return `<span class="badge green"><i></i>Completado</span>`;
    if (status === "programado") return `<span class="badge amber"><i></i>Programado</span>`;
    return `<span class="badge neutral"><i></i>Pendiente</span>`;
  }
  function triBand(completado, programado, pendiente) {
    const total = Math.max(completado + programado + pendiente, 1);
    const w = (n) => (n / total * 100).toFixed(1);
    return `<div class="triband">
      <span style="width:${w(completado)}%;background:${CH.SEM.verde}" title="Completado: ${completado}"></span>
      <span style="width:${w(programado)}%;background:${CH.SEM.amarillo}" title="Programado: ${programado}"></span>
      <span style="width:${w(pendiente)}%;background:${COL.track}" title="Pendiente: ${pendiente}"></span>
    </div>`;
  }

  function viewCddFestGeneral() {
    const unidades = MT.cddFestUnidades(STORE.ejecucion, STORE.programado, STORE.resultsIce);
    if (!unidades.length)
      return noData("Aún no hay Unidades Productivas atendidas por CdD-FEST (ninguna con el componente 1.1 · Índice de Competitividad ejecutado).");
    const resumen = MT.cddFestResumenComponentes(unidades);

    lastExport = {
      filename: "cddfest_resumen_componentes.csv",
      columns: ["RUC", "Razón social", "C1", "C2", "C3", "C4", "C5", "Completados"],
      rows: resumen.matriz.map((r) => [r.ruc, r.razon, r.estados[1], r.estados[2], r.estados[3], r.estados[4], r.estados[5], r.completados]),
    };

    const cards = [1, 2, 3, 4, 5].map((g) => {
      const comp = CFG.COMPONENTES[g];
      const s = resumen.porComponente[g];
      const activo = cddDrillGrupo === g;
      return `<div class="card cdd-comp-card${activo ? " active" : ""}" data-grupo="${g}" role="button" tabindex="0">
        <div class="card-head"><div>
          <h3 style="color:${COMPONENTE_COLORS[g]}">${esc(comp.id)}</h3>
          <div class="sub">${esc(truncate(comp.nombre, 38))}</div>
        </div></div>
        <div class="chartbox">
          ${triBand(s.completado, s.programado, s.pendiente)}
          <div class="statlist" style="margin-top:12px">
            <div class="row"><span class="l"><i style="background:${CH.SEM.verde}"></i>Completado</span><span class="val">${fmt(s.completado)}</span></div>
            <div class="row"><span class="l"><i style="background:${CH.SEM.amarillo}"></i>Programado</span><span class="val">${fmt(s.programado)}</span></div>
            <div class="row"><span class="l"><i style="background:${COL.track}"></i>Pendiente</span><span class="val">${fmt(s.pendiente)}</span></div>
          </div>
          <div class="muted" style="margin-top:8px;font-size:.72rem">de ${fmt(unidades.length)} UP atendidas por CdD-FEST</div>
        </div>
      </div>`;
    }).join("");

    const drill = cddDrillGrupo ? renderCddDrilldown(unidades, cddDrillGrupo) : "";

    return `
      ${sectionHead("Vista general por componente", `${unidades.length} Unidades Productivas atendidas por CdD-FEST · sin mezclar estados entre componentes`)}
      <section class="grid grid-kpi-5">${cards}</section>
      ${drill}
      <section class="card tablecard" id="tbl-cdd-general"></section>`;
  }

  // Detalle de un componente al hacer clic en su tarjeta: qué actividades lo
  // componen (código exacto, p. ej. 3.1 vs 3.4) y qué UP pasaron por cada una.
  function renderCddDrilldown(unidades, grupo) {
    const comp = CFG.COMPONENTES[grupo];
    const det = MT.cddFestDetalleComponente(unidades, grupo);
    const actCodes = Array.from(det.porActividad.keys()).sort();
    const actBotones = actCodes.length
      ? `<div class="chipbar" id="cdd-act-chips">${actCodes.map((code) => {
        const act = CFG.ACTIVIDADES[code];
        const label = act ? `${code} · ${act.nombre}` : code;
        const activo = cddDrillActividad === code;
        return `<button type="button" class="chip cdd-act-chip${activo ? " active" : ""}" data-codigo="${esc(code)}">
          ${esc(label)}<span class="chip-count">${fmt(det.porActividad.get(code))}</span>
        </button>`;
      }).join("")}</div>`
      : CH.empty("Sin intervenciones registradas todavía en este componente");

    return panel(`Detalle de ${esc(comp.id)} · ${esc(comp.nombre)}`,
      "Actividades del componente (código exacto) · clic en una para ver solo sus unidades productivas",
      `${actBotones}<div id="tbl-cdd-drill" style="margin-top:14px"></div>`);
  }

  function afterCddFestGeneral() {
    const unidades = MT.cddFestUnidades(STORE.ejecucion, STORE.programado, STORE.resultsIce);
    const resumen = MT.cddFestResumenComponentes(unidades);

    document.querySelectorAll(".cdd-comp-card").forEach((card) => {
      const pick = () => {
        const g = Number(card.dataset.grupo);
        cddDrillGrupo = cddDrillGrupo === g ? null : g;
        cddDrillActividad = null;
        renderView();
      };
      card.addEventListener("click", pick);
      card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });

    if (cddDrillGrupo) {
      const det = MT.cddFestDetalleComponente(unidades, cddDrillGrupo);

      document.querySelectorAll(".cdd-act-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const code = chip.dataset.codigo;
          cddDrillActividad = cddDrillActividad === code ? null : code;
          renderView();
        });
      });

      const filas = cddDrillActividad ? det.filas.filter((r) => r.codigo === cddDrillActividad) : det.filas;
      const drillEl = document.getElementById("tbl-cdd-drill");
      if (drillEl) {
        mountTable(drillEl, {
          title: "Unidades productivas",
          sub: cddDrillActividad
            ? `${filas.length} UP en la actividad ${cddDrillActividad}`
            : `${filas.length} UP · una fila por UP+actividad (varios servicios se consolidan en "Cant. servicios")`,
          searchPlaceholder: "Buscar por RUC o razón social…", searchKeys: ["ruc", "razon"],
          rows: filas, pageSize: 12, totalLabel: " UP",
          columns: [
            { label: "Unidad productiva", cls: "name", render: (r) => esc(r.razon) },
            { label: "RUC", render: (r) => esc(r.ruc) },
            { label: "Actividad", cls: "ctr", render: (r) => r.codigo ? esc(r.codigo) : "—" },
            { label: "Especialista", render: (r) => esc(r.especialista || "—") },
            { label: "Estado", cls: "ctr", render: (r) => r.ejecutado ? `<span class="badge green"><i></i>Ejecutado</span>` : `<span class="badge amber"><i></i>Programado</span>` },
            { label: "Fecha", render: (r) => r.fecha ? r.fecha.toLocaleDateString("es-PE") : "—" },
            { label: "Cant. servicios", cls: "num", render: (r) => fmt(r.cantServicios) },
          ],
        });
      }
    }

    const el = document.getElementById("tbl-cdd-general");
    if (!el) return;
    mountTable(el, {
      title: "Unidades Productivas por componente", sub: `${resumen.matriz.length} UP · C1–C5 · ordenadas por más componentes completados`,
      searchPlaceholder: "Buscar por RUC o razón social…", searchKeys: ["ruc", "razon"],
      rows: resumen.matriz, pageSize: 15, totalLabel: " UP", search: true,
      columns: [
        { label: "Unidad productiva", cls: "name", render: (r) => esc(r.razon) },
        { label: "RUC", render: (r) => esc(r.ruc) },
        { label: "C1", cls: "ctr", render: (r) => compBadge(r.estados[1]) },
        { label: "C2", cls: "ctr", render: (r) => compBadge(r.estados[2]) },
        { label: "C3", cls: "ctr", render: (r) => compBadge(r.estados[3]) },
        { label: "C4", cls: "ctr", render: (r) => compBadge(r.estados[4]) },
        { label: "C5", cls: "ctr", render: (r) => compBadge(r.estados[5]) },
        { label: "Completados", cls: "num strong", render: (r) => fmt(r.completados) + " / 5" },
      ],
    });
  }

  function renderMonthComponente(mm) {
    const dows = ["L", "M", "M", "J", "V", "S", "D"];
    const daysInMonth = new Date(mm.year, mm.month, 0).getDate();
    const offset = (new Date(mm.year, mm.month - 1, 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(`<div class="cal-day empty"></div>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const items = mm.days.get(d);
      if (!items) { cells.push(`<div class="cal-day">${d}</div>`); continue; }
      const grupos = Array.from(new Set(items.map((e) => e.componenteGrupo).filter((g) => g != null)));
      const colors = grupos.length ? grupos.map((g) => COMPONENTE_COLORS[g] || COL.muted2) : [COL.muted2];
      const bg = colors.length === 1 ? colors[0]
        : `linear-gradient(90deg, ${colors.map((c, i) =>
          `${c} ${(i / colors.length * 100).toFixed(1)}% ${((i + 1) / colors.length * 100).toFixed(1)}%`).join(", ")})`;
      const soloProgramado = items.every((e) => !e.ejecutado);
      const iso = `${mm.year}-${String(mm.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cnt = items.length > 1 ? `<span class="cal-cnt">${items.length}</span>` : "";
      const title = items.map((e) => `${e.ejecutado ? "Ejecutado" : "Programado"}` +
        `${e.componenteGrupo ? " · C" + e.componenteGrupo : ""}${e.especialista ? " · " + e.especialista : ""}`).join(" | ");
      cells.push(`<div class="cal-day on${soloProgramado ? " prog" : ""}" data-date="${iso}" style="background:${bg};cursor:pointer" title="${esc(title)}">${d}${cnt}</div>`);
    }
    return `<div class="cal-month">
      <h4>${esc(CFG.MESES_NOMBRE[mm.month] || mm.month)} ${mm.year}</h4>
      <div class="cal-week dow">${dows.map((x) => `<div class="cal-dow">${x}</div>`).join("")}</div>
      <div class="cal-week">${cells.join("")}</div>
    </div>`;
  }

  function renderTimelineRow(e) {
    const dur = MT.reglaDuracion(e.tipoServicio, e.tipoTarea);
    const badgeEstado = e.ejecutado ? `<span class="badge green"><i></i>Ejecutado</span>` : `<span class="badge amber"><i></i>Programado</span>`;
    const compColor = e.componenteGrupo ? COMPONENTE_COLORS[e.componenteGrupo] : COL.muted2;
    const compTxt = e.componenteGrupo
      ? `${esc("C" + e.componenteGrupo)} · ${esc(truncate(CFG.COMPONENTES[e.componenteGrupo].nombre, 44))}`
      : "Sin componente";
    const fechaTxt = e.fecha ? e.fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha";
    const iso = e.fecha ? isoLocal(e.fecha) : "";
    const detalle = [e.especialista, e.tema || e.tipoServicio, e.tipoTarea].filter(Boolean).map(esc).join(" · ");
    return `<div class="tl-row" data-date="${iso}">
      <div class="tl-dot" style="background:${compColor}"></div>
      <div class="tl-body">
        <div class="tl-top"><span class="tl-fecha">${esc(fechaTxt)}</span>${badgeEstado}${dur ? `<span class="badge neutral"><i></i>${esc(dur.label)}</span>` : ""}</div>
        <div class="tl-comp" style="color:${compColor}">${compTxt}</div>
        <div class="tl-meta">${detalle || "Sin especialista/tema registrado"}</div>
      </div>
    </div>`;
  }

  function afterCddFest() {
    const tabs = document.getElementById("cdd-tabs");
    if (tabs) tabs.querySelectorAll(".seg").forEach((b) =>
      b.addEventListener("click", () => { if (cddMode !== b.dataset.mode) { cddMode = b.dataset.mode; cddDrillGrupo = null; cddDrillActividad = null; renderView(); } }));
    if (cddMode === "general") { afterCddFestGeneral(); return; }
    afterCddFestUP();
  }

  function afterCddFestUP() {
    const unidades = MT.cddFestUnidades(STORE.ejecucion, STORE.programado, STORE.resultsIce);
    wireSearchSelect("cdd-pick", unidades.map((u) => ({ value: u.ruc, label: u.razon || u.ruc, sub: u.ruc })),
      (v) => { cddSel = v; renderView(); });

    const up = unidades.find((u) => u.ruc === cddSel);
    if (!up || !up.ice) return;

    const el = document.getElementById("tbl-cdd-comp");
    if (el) {
      const rows = [1, 2, 3, 4, 5].map((g) => {
        const est = up.estadoComponentes[g];
        const comp = CFG.COMPONENTES[g];
        return {
          grupo: g, id: comp.id, nombre: comp.nombre,
          status: est.status, especialistas: est.especialistas.join(", ") || "—",
          ultima: est.ultimaEjecutada, proxima: est.proximaProgramada,
        };
      });
      mountTable(el, {
        title: "Estado de avance por componente", sub: "C1 a C5 · Unidad Productiva seleccionada",
        search: false, rows, pageSize: 5,
        columns: [
          { label: "Componente", cls: "name", render: (r) => `<span style="color:${COMPONENTE_COLORS[r.grupo]};font-weight:700">${esc(r.id)}</span> · ${esc(r.nombre)}` },
          {
            label: "Estado", cls: "ctr", render: (r) => r.status === "completado" ? `<span class="badge green"><i></i>Completado</span>`
              : r.status === "programado" ? `<span class="badge amber"><i></i>Programado</span>` : `<span class="badge neutral"><i></i>Pendiente</span>`
          },
          { label: "Especialista(s)", render: (r) => esc(r.especialistas) },
          { label: "Última ejecutada", render: (r) => r.ultima ? r.ultima.toLocaleDateString("es-PE") : "—" },
          { label: "Próxima programada", render: (r) => r.proxima ? r.proxima.toLocaleDateString("es-PE") : "—" },
        ],
      });
    }

    document.querySelectorAll(".cal-day[data-date]").forEach((cell) =>
      cell.addEventListener("click", () => {
        const iso = cell.dataset.date;
        document.querySelectorAll(".cal-day.sel").forEach((c) => c.classList.remove("sel"));
        cell.classList.add("sel");
        document.querySelectorAll(".tl-row.sel").forEach((r) => r.classList.remove("sel"));
        const rows = document.querySelectorAll(`.tl-row[data-date="${iso}"]`);
        rows.forEach((r) => r.classList.add("sel"));
        if (rows[0]) rows[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }));
  }

  // =========================================================================
  //  RENDER PRINCIPAL
  // =========================================================================
  const VIEWS = {
    ejecutivo: { render: viewEjecutivo, after: afterEjecutivo },
    especialistas: { render: viewEspecialistas, after: afterEspecialistas },
    programas: { render: viewProgramas, after: null },
    clientes: { render: viewClientes, after: afterClientes },
    servicios: { render: viewServicios, after: null },
    calendario: { render: viewCalendario, after: afterCalendario },
    cddfest: { render: viewCddFest, after: afterCddFest },
  };

  function renderView() {
    const nav = NAV.find((n) => n.id === VIEW) || NAV[0];
    document.getElementById("view-sub").textContent = nav.sub;
    document.querySelectorAll(".rail-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === VIEW));
    const host = document.getElementById("view");
    lastExport = null;
    host.className = "view";
    host.innerHTML = VIEWS[VIEW].render();
    if (VIEWS[VIEW].after) VIEWS[VIEW].after();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  // =========================================================================
  //  BARRA DE FILTROS
  // =========================================================================
  function buildFilterBar() {
    const X = CFG.X, M = CFG.M;
    const progs = D.opcionesUnicas([STORE.ejecucion, STORE.metas], X.PROGRAMA)
      .sort((a, b) => String(a).localeCompare(b, "es"));
    const meses = D.opcionesUnicas([STORE.ejecucion, STORE.metas], X.MES)
      .filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
    const esps = D.opcionesUnicas([STORE.ejecucion, STORE.metas], X.ESPECIALISTA)
      .sort((a, b) => String(a).localeCompare(b, "es"));

    const bar = document.getElementById("filterbar");
    bar.innerHTML = `
      <span class="filter-label"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Filtros</span>
      ${dropHtml("programas", "Programa", progs, (v) => v)}
      ${dropHtml("meses", "Mes", meses, (v) => CFG.MESES_NOMBRE[v] || v)}
      ${dropHtml("especialistas", "Especialista", esps, (v) => v)}
      <span class="filter-spring"></span>
      <span id="data-stamp" class="filter-label" style="text-transform:none;letter-spacing:0"></span>
      <button class="btn btn-ghost" id="btn-clear"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Limpiar</button>
      <button class="btn btn-primary" id="btn-export"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Exportar</button>`;

    // interacción de cada dropdown
    ["programas", "meses", "especialistas"].forEach((key) => wireDrop(key,
      key === "meses" ? (v) => CFG.MESES_NOMBRE[v] || v : (v) => v));

    document.getElementById("btn-clear").addEventListener("click", () => {
      FILTER.programas = []; FILTER.meses = []; FILTER.especialistas = [];
      refreshFilterButtons(); renderView();
    });
    document.getElementById("btn-export").addEventListener("click", exportCSV);
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".fdrop")) closeAllDrops();
    });
    stampData();
  }

  function dropHtml(key, label, options, labelFn) {
    const opts = options.map((v) =>
      `<label class="fopt"><input type="checkbox" value="${esc(String(v))}"><span>${esc(labelFn(v))}</span></label>`).join("");
    return `<div class="fdrop" data-key="${key}">
      <button class="fdrop-btn" type="button"><span class="k">${esc(label)}</span><span class="v">Todos</span>
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
      <div class="fdrop-menu">${opts || '<div class="fopt">Sin opciones</div>'}</div></div>`;
  }

  function wireDrop(key, labelFn) {
    const root = document.querySelector(`.fdrop[data-key="${key}"]`);
    const btn = root.querySelector(".fdrop-btn");
    const menu = root.querySelector(".fdrop-menu");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.classList.contains("open");
      closeAllDrops();
      if (!open) menu.classList.add("open");
    });
    menu.addEventListener("change", () => {
      const vals = Array.from(menu.querySelectorAll("input:checked")).map((i) => i.value);
      FILTER[key] = key === "meses" ? vals.map(Number) : vals;
      updateDropBtn(key, labelFn);
      renderView();
    });
  }

  function updateDropBtn(key, labelFn) {
    const root = document.querySelector(`.fdrop[data-key="${key}"]`);
    const btn = root.querySelector(".fdrop-btn");
    const vals = FILTER[key];
    const vspan = btn.querySelector(".v");
    if (!vals.length) { vspan.textContent = "Todos"; btn.classList.remove("on"); }
    else {
      btn.classList.add("on");
      vspan.textContent = vals.length === 1 ? String(labelFn(vals[0])) : `${vals.length} seleccionados`;
    }
  }
  function refreshFilterButtons() {
    updateDropBtn("programas", (v) => v);
    updateDropBtn("meses", (v) => CFG.MESES_NOMBRE[v] || v);
    updateDropBtn("especialistas", (v) => v);
    document.querySelectorAll(".fdrop-menu input").forEach((i) => {
      const key = i.closest(".fdrop").dataset.key;
      const set = FILTER[key].map(String);
      i.checked = set.includes(i.value);
    });
  }
  function closeAllDrops() { document.querySelectorAll(".fdrop-menu.open").forEach((m) => m.classList.remove("open")); }

  function stampData() {
    const el = document.getElementById("data-stamp");
    if (el && META.updated) el.textContent = `🕓 Datos: ${META.updated}`;
  }

  // ---- Exportar CSV de la vista activa -------------------------------------
  function exportCSV() {
    if (!lastExport || !lastExport.rows.length) { alert("No hay datos para exportar en esta vista."); return; }
    const esc = (v) => { const s = String(v == null ? "" : v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [lastExport.columns.map(esc).join(";")];
    lastExport.rows.forEach((r) => lines.push(r.map(esc).join(";")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = lastExport.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // =========================================================================
  //  RIEL DE NAVEGACIÓN
  // =========================================================================
  function buildRail() {
    const rail = document.getElementById("rail-nav");
    rail.innerHTML = NAV.map((n) =>
      `<button class="rail-btn ${n.id === VIEW ? "active" : ""}" data-view="${n.id}">
        ${svgIco(n.ico)}<span class="tip">${esc(n.label)}</span></button>`).join("");
    rail.querySelectorAll(".rail-btn").forEach((b) =>
      b.addEventListener("click", () => {
        VIEW = b.dataset.view;
        if (VIEW !== "especialistas") espSel = null;
        if (VIEW !== "cddfest") { cddSel = null; cddMode = "up"; cddDrillGrupo = null; cddDrillActividad = null; }
        location.hash = VIEW;
        renderView();
      }));
  }

  // =========================================================================
  //  ARRANQUE
  // =========================================================================
  async function boot() {
    const host = document.getElementById("view");
    try {
      // sello de última modificación (best-effort)
      fetch(CFG.FILES.ejecucion, { method: "HEAD", cache: "no-store" })
        .then((r) => {
          const lm = r.headers.get("last-modified");
          if (lm) { META.updated = new Date(lm).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }); stampData(); }
        })
        .catch(() => { });

      STORE = await global.POI.data.loadAll();
      buildRail();
      buildFilterBar();
      const h = (location.hash || "").replace("#", "");
      if (NAV.some((n) => n.id === h)) VIEW = h;
      renderView();
    } catch (err) {
      const detail = err.detail ? `<ul style="text-align:left;margin-top:8px">${err.detail.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`
        : `<p>${esc(err.message || err)}</p>`;
      host.innerHTML = `<div class="state"><div class="box">
        <div class="kpi-ico red" style="width:48px;height:48px">${svgIco(I.alert)}</div>
        <h3>No se pudieron cargar los datos</h3>
        ${detail}
        <p>Verifica que los archivos existan en <code>data/</code> y que el sitio se abra vía servidor web
        (GitHub Pages o <code>python -m http.server</code>), no como <code>file://</code>.</p></div></div>`;
    }
  }

  window.addEventListener("hashchange", () => {
    const h = (location.hash || "").replace("#", "");
    if (NAV.some((n) => n.id === h) && h !== VIEW) {
      VIEW = h;
      if (VIEW !== "especialistas") espSel = null;
      if (VIEW !== "cddfest") { cddSel = null; cddMode = "up"; cddDrillGrupo = null; cddDrillActividad = null; }
      renderView();
    }
  });
  document.addEventListener("DOMContentLoaded", boot);
})(window);
