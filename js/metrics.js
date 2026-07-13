/* ============================================================
   js/metrics.js — Reglas de negocio (puerto de utils/metrics.py)
   Cumplimiento, productividad ponderada, clientes (nuevos /
   reenganchados / focalizados), complejidad y matriz del heatmap.
   ============================================================ */
(function (global) {
  "use strict";
  const { CFG, semaforo } = global.POI;
  const X = CFG.X, M = CFG.M;

  const round1 = (n) => Math.round(n * 10) / 10;
  function pct(meta, ejec) { return meta ? round1((ejec / meta) * 100) : 0; }

  // ---- helpers de agregación ------------------------------------------------
  function sumBy(rows, keyCol, valCol) {
    const m = new Map();
    for (const r of rows) {
      const k = r[keyCol];
      m.set(k, (m.get(k) || 0) + (Number(r[valCol]) || 0));
    }
    return m; // Map(key -> suma)
  }
  function uniqueCountBy(rows, keyCol, distinctCol) {
    const m = new Map();
    for (const r of rows) {
      const k = r[keyCol];
      if (!m.has(k)) m.set(k, new Set());
      m.get(k).add(r[distinctCol]);
    }
    const out = new Map();
    for (const [k, s] of m) out.set(k, s.size);
    return out;
  }
  function nunique(rows, col, filterFn) {
    const s = new Set();
    for (const r of rows) { if (filterFn && !filterFn(r)) continue; s.add(r[col]); }
    return s.size;
  }
  const sumCol = (rows, col) => rows.reduce((a, r) => a + (Number(r[col]) || 0), 0);

  // ---- KPIs globales --------------------------------------------------------
  function kpis(eje, met) {
    const meta = sumCol(met, M.META);
    const ejec = sumCol(eje, X.CANTIDAD);
    return {
      meta, ejecutado: ejec, cumplimiento: pct(meta, ejec),
      clientes: nunique(eje, X.RUC),
      focalizados: nunique(eje, X.RUC, (r) => r.ES_FOCALIZADO),
      especialistas: nunique(eje, X.ESPECIALISTA),
      actividades: eje.length,
    };
  }

  // ---- META vs EJECUCIÓN por dimensión --------------------------------------
  function metaVsEjec(eje, met, dimX, dimM, orden) {
    const m = sumBy(met, dimM, M.META);
    const e = sumBy(eje, dimX, X.CANTIDAD);
    const dims = new Set([...m.keys(), ...e.keys()]);
    let out = [];
    for (const d of dims) {
      if (d === null || d === undefined || String(d).trim() === "") continue;
      const meta = m.get(d) || 0, ejec = e.get(d) || 0;
      if (meta === 0 && ejec === 0) continue;   // omite filas vacías (0/0)
      const c = pct(meta, ejec);
      out.push({
        Dim: d, Meta: meta, Ejecutado: ejec, Cumplimiento: c,
        Brecha: Math.max(meta - ejec, 0), Semaforo: semaforo(c)
      });
    }
    if (orden) {
      const idx = new Map(orden.map((v, i) => [v, i]));
      out.sort((a, b) => (idx.has(a.Dim) ? idx.get(a.Dim) : 999) -
        (idx.has(b.Dim) ? idx.get(b.Dim) : 999));
    }
    return out;
  }

  function tendenciaMensual(eje, met) {
    const df = metaVsEjec(eje, met, X.MES, M.MES, Array.from({ length: 12 }, (_, i) => i + 1));
    return df.filter((r) => r.Dim >= 1 && r.Dim <= 12)
      .map((r) => Object.assign({}, r, {
        Mes: CFG.MESES_ES[r.Dim] || r.Dim,
        MesNum: r.Dim
      }));
  }

  function rankingEspecialistas(eje, met) {
    const df = metaVsEjec(eje, met, X.ESPECIALISTA, M.ESPECIALISTA);
    const cli = uniqueCountBy(eje, X.ESPECIALISTA, X.RUC);
    const cliFoc = uniqueCountBy(eje.filter((r) => r.ES_FOCALIZADO), X.ESPECIALISTA, X.RUC);
    const cliNoFoc = uniqueCountBy(eje.filter((r) => !r.ES_FOCALIZADO), X.ESPECIALISTA, X.RUC);
    df.forEach((r) => {
      r.Clientes = cli.get(r.Dim) || 0;
      r.ClientesFoc = cliFoc.get(r.Dim) || 0;
      r.ClientesNoFoc = cliNoFoc.get(r.Dim) || 0;
    });
    df.sort((a, b) => b.Ejecutado - a.Ejecutado);
    return df;
  }

  // ---- Complejidad: conteo + productividad ponderada ------------------------
  function complejidadResumen(eje) {
    const conteo = { Alta: 0, Media: 0, Baja: 0 };
    for (const r of eje) {
      const k = r[X.COMPLEJIDAD];
      if (k in conteo) conteo[k] += Number(r[X.CANTIDAD]) || 0;
    }
    const total = conteo.Alta + conteo.Media + conteo.Baja;
    const ponderado = CFG.COMPLEJIDADES.reduce(
      (a, k) => a + conteo[k] * (CFG.PESOS_COMPLEJIDAD[k] || 1), 0);
    return { conteo, total, ponderado: Math.round(ponderado) };
  }

  // ---- HEATMAP: tarea × mes = % cumplimiento --------------------------------
  function heatmapCumplimiento(eje, met) {
    const metaKey = (t, mes) => t + "||" + mes;
    const mMeta = new Map(), mEjec = new Map();
    for (const r of met) {
      const k = metaKey(r[M.TAREA], r[M.MES]);
      mMeta.set(k, (mMeta.get(k) || 0) + (Number(r[M.META]) || 0));
    }
    for (const r of eje) {
      const k = metaKey(r[X.TAREA], r[X.MES]);
      mEjec.set(k, (mEjec.get(k) || 0) + (Number(r[X.CANTIDAD]) || 0));
    }
    const tareaMetaTotal = new Map(), tareas = new Set(), mesesSet = new Set();
    for (const [k, meta] of mMeta) {
      if (meta <= 0) continue;
      const [t, mes] = k.split("||");
      tareas.add(t); mesesSet.add(+mes);
      tareaMetaTotal.set(t, (tareaMetaTotal.get(t) || 0) + meta);
    }
    const meses = Array.from(mesesSet).sort((a, b) => a - b);
    const tareaList = Array.from(tareas).sort((a, b) =>
      (tareaMetaTotal.get(b) || 0) - (tareaMetaTotal.get(a) || 0));
    const rows = tareaList.map((t) => {
      const cells = meses.map((mes) => {
        const meta = mMeta.get(metaKey(t, mes)) || 0;
        if (meta <= 0) return null;
        const ejec = mEjec.get(metaKey(t, mes)) || 0;
        return { pct: pct(meta, ejec), meta, ejec };
      });
      const total = tareaMetaTotal.get(t) || 0;
      return { label: `${t} (${total.toLocaleString("es-PE")})`, cells };
    });
    return { meses: meses.map((m) => CFG.MESES_ES[m] || m), rows };
  }

  // ---- Clientes -------------------------------------------------------------
  function clientesResumen(eje, bd) {
    // agrega por RUC
    const porRuc = new Map();
    for (const r of eje) {
      const ruc = r[X.RUC];
      if (!porRuc.has(ruc)) porRuc.set(ruc, {
        RUC: ruc, Razon: r[X.RAZON], mesesSet: new Set(), Servicios: 0,
        Focalizado: false, temas: new Set(),
      });
      const o = porRuc.get(ruc);
      o.mesesSet.add(r[X.MES]);
      o.Servicios += Number(r[X.CANTIDAD]) || 0;
      if (r.ES_FOCALIZADO) o.Focalizado = true;
      const tema = r[X.TEMA];
      if (tema != null && String(tema).trim()) o.temas.add(String(tema).trim());
    }

    // RUCs con complejidad Media/Alta en 2026
    const rucsMediaAlta = new Set();
    for (const r of eje)
      if (r[X.COMPLEJIDAD] === "Media" || r[X.COMPLEJIDAD] === "Alta")
        rucsMediaAlta.add(r[X.RUC]);

    let rucsNuevos = new Set(), rucsReeng = new Set();
    if (bd && bd.length) {
      const ANIO_LIMITE = CFG.ANIO_ACTUAL - CFG.ANIOS_SIN_SERVICIO; // 2023
      const historicos = new Set(bd.map((b) => b.RUC));
      const recientes = new Set(bd.filter((b) => b.ANIO >= ANIO_LIMITE).map((b) => b.RUC));
      for (const ruc of rucsMediaAlta) {
        if (!historicos.has(ruc)) rucsNuevos.add(ruc);
        else if (!recientes.has(ruc)) rucsReeng.add(ruc);
      }
    }

    const tabla = [];
    for (const o of porRuc.values()) {
      const mesesArr = Array.from(o.mesesSet).filter((m) => m >= 1 && m <= 12)
        .sort((a, b) => a - b);
      let tipo = "Recurrente";
      if (rucsNuevos.has(o.RUC)) tipo = "Nuevo";
      else if (rucsReeng.has(o.RUC)) tipo = "Reenganchado";
      tabla.push({
        RUC: o.RUC, Razon: o.Razon,
        Meses: mesesArr.map((m) => CFG.MESES_NOMBRE[m] || m).join(", "),
        NMeses: mesesArr.length,
        Servicios: o.Servicios,
        Focalizado: o.Focalizado,
        Tema: Array.from(o.temas).join("; "),
        Tipo: tipo,
      });
    }

    const nuevos = bd && bd.length ? rucsNuevos.size
      : tabla.filter((t) => t.NMeses === 1).length;
    const reenganchados = bd && bd.length ? rucsReeng.size : 0;
    const focalizados = tabla.filter((t) => t.Focalizado).length;
    return {
      tabla, total: tabla.length, nuevos, reenganchados, focalizados,
      no_focalizados: tabla.length - focalizados,
    };
  }

  function clientesNuevosPorMes(eje) {
    const primer = new Map();     // ruc -> primer mes
    for (const r of eje) {
      const ruc = r[X.RUC], mes = r[X.MES];
      primer.set(ruc, Math.min(primer.has(ruc) ? primer.get(ruc) : Infinity, mes));
    }
    const nuevosMes = new Map(), activosMes = new Map();
    for (const [ruc, mes] of primer)
      nuevosMes.set(mes, (nuevosMes.get(mes) || new Set()).add(ruc));
    const activosSet = new Map();
    for (const r of eje) {
      const mes = r[X.MES];
      if (!activosSet.has(mes)) activosSet.set(mes, new Set());
      activosSet.get(mes).add(r[X.RUC]);
    }
    const meses = Array.from(activosSet.keys()).filter((m) => m >= 1 && m <= 12)
      .sort((a, b) => a - b);
    return meses.map((mes) => {
      const activos = activosSet.get(mes).size;
      const nuevos = nuevosMes.has(mes) ? nuevosMes.get(mes).size : 0;
      return {
        MesNum: mes, Mes: CFG.MESES_ES[mes] || mes, Activos: activos,
        Nuevos: nuevos, Recurrentes: activos - nuevos
      };
    });
  }

  function kpisClientes(eje, metCli) {
    const metaFoc = metCli.filter((r) => r.TIPO === "FOCALIZADO")
      .reduce((a, r) => a + r.META, 0);
    const metaNoFoc = metCli.filter((r) => r.TIPO === "NO FOCALIZADO")
      .reduce((a, r) => a + r.META, 0);
    const metaTotal = metaFoc + metaNoFoc;
    const ejecFoc = nunique(eje, X.RUC, (r) => r.ES_FOCALIZADO);
    const ejecTotal = nunique(eje, X.RUC);
    return {
      meta_clientes: metaTotal, ejec_clientes: ejecTotal, pct_clientes: pct(metaTotal, ejecTotal),
      meta_focalizados: metaFoc, ejec_focalizados: ejecFoc, pct_focalizados: pct(metaFoc, ejecFoc),
    };
  }

  // Meta de clientes atendidos POR ESPECIALISTA.
  // - Cada cliente (RUC) se atribuye al especialista que lo atendió PRIMERO (por
  //   fecha) — cuenta una sola vez y para ese especialista.
  // - La meta total (focalizados / no focalizados) se reparte por igual entre
  //   los especialistas que tienen metas programadas (Nesp).
  function clientesMetaEspecialistas(eje, espsConMeta, metaFocTotal, metaNoFocTotal) {
    const firstByRuc = new Map(); // ruc -> {esp, t, foc}
    for (const r of eje) {
      const ruc = r[X.RUC];
      if (ruc == null || ruc === "") continue;
      const f = r[X.FECHA];
      const t = (f instanceof Date && !isNaN(f)) ? f.getTime()
        : ((Number(r[X.ANIO]) || 0) * 10000 + (Number(r[X.MES]) || 0) * 100);
      const prev = firstByRuc.get(ruc);
      if (!prev || t < prev.t) firstByRuc.set(ruc, { esp: r[X.ESPECIALISTA], t, foc: !!r.ES_FOCALIZADO });
    }
    const tally = new Map(); // esp -> {foc, nofoc}
    for (const { esp, foc } of firstByRuc.values()) {
      if (esp == null || esp === "") continue;
      if (!tally.has(esp)) tally.set(esp, { foc: 0, nofoc: 0 });
      const o = tally.get(esp); if (foc) o.foc++; else o.nofoc++;
    }
    const espsMeta = espsConMeta instanceof Set ? espsConMeta : new Set(espsConMeta || []);
    const Nesp = Math.max(espsMeta.size, 1);
    const targetFoc = Math.ceil(metaFocTotal / Nesp);
    const targetNoFoc = Math.ceil(metaNoFocTotal / Nesp);
    const allEsps = new Set([...tally.keys(), ...espsMeta]);
    const rows = [];
    for (const esp of allEsps) {
      if (esp == null || esp === "") continue;
      const o = tally.get(esp) || { foc: 0, nofoc: 0 };
      const tiene = espsMeta.has(esp);
      rows.push({
        esp, foc: o.foc, nofoc: o.nofoc, total: o.foc + o.nofoc,
        tieneMeta: tiene,
        metaFoc: tiene ? targetFoc : 0,
        metaNoFoc: tiene ? targetNoFoc : 0,
        pctFoc: tiene ? pct(targetFoc, o.foc) : 0,
        pctNoFoc: tiene ? pct(targetNoFoc, o.nofoc) : 0,
      });
    }
    rows.sort((a, b) => b.total - a.total);
    return { rows, Nesp, targetFoc, targetNoFoc };
  }

  function clientesMetaPorMes(metCli) {
    const byMes = new Map();
    for (const r of metCli) {
      if (!byMes.has(r.MES)) byMes.set(r.MES, { FOC: 0, NOFOC: 0 });
      const o = byMes.get(r.MES);
      if (r.TIPO === "FOCALIZADO") o.FOC += r.META;
      else if (r.TIPO === "NO FOCALIZADO") o.NOFOC += r.META;
    }
    const meses = Array.from(byMes.keys()).filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
    return meses.map((mes) => {
      const o = byMes.get(mes);
      return {
        MesNum: mes, Mes: CFG.MESES_ES[mes] || mes,
        FOCALIZADO: o.FOC, NO_FOCALIZADO: o.NOFOC, META_TOTAL: o.FOC + o.NOFOC
      };
    });
  }

  // ---------------------------------------------------------------------------
  // CdD-FEST: planificador por Unidad Productiva (UP)
  // Componente = floor(código decimal), p. ej. 3.4 -> grupo 3 (C3).
  // ---------------------------------------------------------------------------
  function componenteGrupo(codigoDecimal) {
    const n = Number(codigoDecimal);
    return codigoDecimal == null || isNaN(n) ? null : Math.floor(n);
  }

  // Catálogo de actividades (código decimal, p. ej. "3.4") agrupadas por
  // componente (1-5), a partir de CFG.ACTIVIDADES. Un componente solo se
  // considera "completado" para una UP cuando TODAS sus actividades están
  // ejecutadas — no basta con una sola (p. ej. C3 exige 3.1 a 3.7).
  const ACT_POR_GRUPO = {};
  Object.keys(CFG.ACTIVIDADES || {}).forEach((code) => {
    const g = componenteGrupo(code);
    if (g == null) return;
    if (!ACT_POR_GRUPO[g]) ACT_POR_GRUPO[g] = [];
    ACT_POR_GRUPO[g].push(code);
  });
  Object.keys(ACT_POR_GRUPO).forEach((g) => ACT_POR_GRUPO[g].sort());

  // "Mínimo" institucional de un componente: la meta de su actividad de
  // entrada (código más bajo, p. ej. 3.1 para C3) — las actividades
  // siguientes del mismo componente son subconjuntos más específicos con
  // metas menores (p. ej. 3.7 Ensayos de laboratorio = 5), no la meta
  // "real" del componente completo.
  function metaMinimaComponente(g) {
    const codigos = ACT_POR_GRUPO[g] || [];
    if (!codigos.length) return null;
    const primero = CFG.ACTIVIDADES[codigos[0]];
    return primero && primero.meta != null ? primero.meta : null;
  }

  // Brechas por dimensión ICE para una fila de results_ice.xlsx (o [] si no
  // hay diagnóstico). Adapta el shape guardado en data.js a un arreglo
  // estable en el orden de CFG.ICE_DIM (útil para el radar).
  function iceBrechas(iceRow) {
    if (!iceRow || !iceRow.DIMS) return [];
    return CFG.ICE_DIM.map((dim) => {
      const d = iceRow.DIMS[dim.key] || {};
      return {
        key: dim.key, label: dim.label, componente: dim.componente,
        puntaje: d.puntaje != null ? d.puntaje : 0,
        nivel: d.nivel || null, esProxy: !!d.esProxy,
        brecha: d.brecha != null ? d.brecha : 100,
      };
    });
  }

  // Orden recomendado de intervención: C1 siempre primero (es la línea base:
  // el propio diagnóstico). Entre C2-C5 TODAVÍA PENDIENTES, se recomienda
  // avanzar primero al que tiene MENOR brecha promedio (el más cerca de
  // estar listo) — no al de mayor brecha. Esto evita saltar a un componente
  // avanzado (p. ej. C5 Comercio Exterior, que suele partir con brechas muy
  // altas en casi todas las UP) mientras uno anterior (p. ej. C4
  // Digitalización) todavía tiene una brecha grande sin resolver; y sí deja
  // en primer lugar a un componente avanzado cuando una UP puntual ya está
  // bien encaminada ahí (brecha pequeña). Los componentes ya completados o
  // programados no compiten por prioridad: se muestran después, en su orden
  // natural C2→C5, porque ya fueron atendidos o ya tienen fecha.
  function ordenRecomendado(iceRow, estadoComponentes) {
    const dims = iceBrechas(iceRow);
    const porComponente = new Map();
    for (const d of dims) {
      if (d.componente == null) continue;
      if (!porComponente.has(d.componente)) porComponente.set(d.componente, []);
      porComponente.get(d.componente).push(d.brecha);
    }
    const estadoDe = (g) => (estadoComponentes && estadoComponentes[g] && estadoComponentes[g].status) || "pendiente";
    const actividadesDe = (g) => estadoComponentes && estadoComponentes[g]
      ? { totalActividades: estadoComponentes[g].totalActividades, completadasActividades: estadoComponentes[g].completadasActividades }
      : { totalActividades: undefined, completadasActividades: undefined };
    const c1 = {
      grupo: 1, id: "C1", brecha: null,
      estado: estadoComponentes ? estadoDe(1) : (iceRow ? "completado" : "pendiente"),
      ...actividadesDe(1),
    };
    const resto = [2, 3, 4, 5].map((g) => {
      const brechas = porComponente.get(g) || [];
      const brechaProm = brechas.length ? brechas.reduce((a, b) => a + b, 0) / brechas.length : 0;
      return { grupo: g, id: "C" + g, brecha: round1(brechaProm), estado: estadoDe(g), ...actividadesDe(g) };
    });
    // "parcial" (algunas actividades del componente hechas, faltan otras)
    // compite por prioridad igual que "pendiente": todavía requiere trabajo.
    const pendientes = resto.filter((r) => r.estado === "pendiente" || r.estado === "parcial")
      .sort((a, b) => a.brecha - b.brecha);
    const atendidos = resto.filter((r) => r.estado === "completado" || r.estado === "programado")
      .sort((a, b) => a.grupo - b.grupo);
    return [c1, ...pendientes, ...atendidos];
  }

  // Agrupa ejecución + programado de CdD-FEST por Unidad Productiva (RUC),
  // cruzando con el diagnóstico ICE cuando exista. Cada UP trae su lista de
  // eventos (ejecutados y programados) y el estado (completado / programado
  // / pendiente) de cada componente C1-C5.
  //
  // Solo se consideran "atendidas por CdD-FEST" las UP que tienen el
  // componente C1 (1.1 · Medición del Índice de Competitividad) REALMENTE
  // EJECUTADO en ejecucion.xlsx. Tener una fila en results_ice.xlsx no basta
  // por sí sola (puede existir un diagnóstico externo sin visita real del
  // programa) — por eso ya no se incluyen UP solo por aparecer en el ICE.
  function cddFestUnidades(eje, programado, iceRows) {
    const ejeCdd = (eje || []).filter((r) => r[X.PROGRAMA] === "CdD-FEST");
    const progCdd = (programado || []).filter((r) => r.PROGRAMA === "CdD-FEST");
    const iceByRuc = new Map((iceRows || []).map((r) => [r.RUC, r]));

    const porRuc = new Map();
    function ensure(ruc, razon) {
      if (!porRuc.has(ruc)) porRuc.set(ruc, {
        ruc, razon: razon || null, ice: iceByRuc.get(ruc) || null, eventos: [],
      });
      const o = porRuc.get(ruc);
      if (!o.razon && razon) o.razon = razon;
      return o;
    }

    for (const r of ejeCdd) {
      const ruc = r[X.RUC];
      if (!ruc) continue;
      const o = ensure(ruc, r[X.RAZON]);
      o.eventos.push({
        fecha: r[X.FECHA] instanceof Date && !isNaN(r[X.FECHA]) ? r[X.FECHA] : null,
        ejecutado: true,
        componenteCodigo: r[X.COMPONENTE] != null ? r[X.COMPONENTE] : null,
        componenteGrupo: componenteGrupo(r[X.COMPONENTE]),
        especialista: r[X.ESPECIALISTA] || null,
        tema: r[X.TEMA] || null,
        tipoServicio: r[X.SERVICIO] || null,
        tipoTarea: r[X.TAREA] || null,
        cantidad: Number(r[X.CANTIDAD]) || 0,
      });
    }
    for (const r of progCdd) {
      const ruc = r.RUC;
      if (!ruc) continue;
      const o = ensure(ruc, null);
      o.eventos.push({
        fecha: r.FECHA instanceof Date && !isNaN(r.FECHA) ? r.FECHA : null,
        ejecutado: false,
        componenteCodigo: r.COMPONENTE != null ? r.COMPONENTE : null,
        componenteGrupo: componenteGrupo(r.COMPONENTE),
        especialista: r.ESPECIALISTA || null,
        tema: null,
        tipoServicio: r.TIPO_SERVICIO || null,
        tipoTarea: r.TIPO_TAREA || null,
        cantidad: Number(r.META_CANTIDAD) || 0,
      });
    }
    for (const o of porRuc.values()) {
      o.eventos.sort((a, b) => (a.fecha ? a.fecha.getTime() : 0) - (b.fecha ? b.fecha.getTime() : 0));
      const estado = {};
      for (let g = 1; g <= 5; g++) {
        const ejEvts = o.eventos.filter((e) => e.ejecutado && e.componenteGrupo === g);
        const prEvts = o.eventos.filter((e) => !e.ejecutado && e.componenteGrupo === g);
        const codigos = ACT_POR_GRUPO[g] || [];
        // Desglose por actividad exacta (p. ej. 3.1..3.7 dentro de C3): una UP
        // debe pasar por TODAS las actividades del componente para darlo por
        // completado, no solo por una.
        const actividades = codigos.map((codigo) => {
          const ejAct = ejEvts.filter((e) => e.componenteCodigo != null && e.componenteCodigo.toFixed(1) === codigo);
          const prAct = prEvts.filter((e) => e.componenteCodigo != null && e.componenteCodigo.toFixed(1) === codigo);
          const fechasAct = ejAct.map((e) => e.fecha).filter(Boolean);
          return {
            codigo, nombre: (CFG.ACTIVIDADES[codigo] || {}).nombre || codigo,
            especialista: (CFG.ACTIVIDADES[codigo] || {}).especialista || null,
            meta: (CFG.ACTIVIDADES[codigo] || {}).meta != null ? CFG.ACTIVIDADES[codigo].meta : null,
            ejecutado: ejAct.length > 0, programado: ejAct.length === 0 && prAct.length > 0,
            fecha: fechasAct.length ? new Date(Math.max(...fechasAct.map((d) => d.getTime()))) : null,
          };
        });
        const totalActividades = codigos.length;
        const completadasActividades = actividades.filter((a) => a.ejecutado).length;
        let status;
        if (!totalActividades) {
          // Sin catálogo de actividades para este grupo: se mantiene la regla
          // anterior (cualquier evento ejecutado basta).
          status = ejEvts.length ? "completado" : (prEvts.length ? "programado" : "pendiente");
        } else if (completadasActividades === totalActividades) {
          status = "completado";
        } else if (completadasActividades > 0) {
          status = "parcial"; // algunas actividades ejecutadas, faltan otras
        } else if (actividades.some((a) => a.programado) || prEvts.length) {
          status = "programado";
        } else {
          status = "pendiente";
        }
        const especialistas = Array.from(new Set([...ejEvts, ...prEvts]
          .map((e) => e.especialista).filter(Boolean)));
        const fechasEj = ejEvts.map((e) => e.fecha).filter(Boolean);
        const fechasPr = prEvts.map((e) => e.fecha).filter(Boolean);
        estado[g] = {
          grupo: g, status, especialistas, actividades, totalActividades, completadasActividades,
          ultimaEjecutada: fechasEj.length ? new Date(Math.max(...fechasEj.map((d) => d.getTime()))) : null,
          proximaProgramada: fechasPr.length ? new Date(Math.min(...fechasPr.map((d) => d.getTime()))) : null,
        };
      }
      o.estadoComponentes = estado;
    }
    return Array.from(porRuc.values())
      .filter((o) => o.estadoComponentes[1].status === "completado")
      .sort((a, b) => String(a.razon || a.ruc).localeCompare(String(b.razon || b.ruc), "es"));
  }

  // Vista agregada (todas las UP a la vez) por componente: cuántas UP están
  // completadas / programadas / pendientes en cada componente C1-C5, y la
  // matriz UP × componente para la tabla de la "Vista general" — sin mezclar
  // los estados de cada componente entre sí (cada columna es independiente).
  function cddFestResumenComponentes(unidades) {
    const porComponente = {};
    for (let g = 1; g <= 5; g++) porComponente[g] = { completado: 0, parcial: 0, programado: 0, pendiente: 0 };
    const matriz = (unidades || []).map((u) => {
      const estados = {};
      let completados = 0;
      for (let g = 1; g <= 5; g++) {
        const st = (u.estadoComponentes && u.estadoComponentes[g] && u.estadoComponentes[g].status) || "pendiente";
        estados[g] = st;
        porComponente[g][st]++;
        if (st === "completado") completados++;
      }
      // Se conserva el detalle por actividad de cada componente (estadoComponentes)
      // para poder expandir la fila y ver qué actividad exacta falta.
      return { ruc: u.ruc, razon: u.razon || u.ruc, estados, completados, estadoComponentes: u.estadoComponentes };
    });
    // Por defecto: las UP más avanzadas (más componentes completados)
    // primero, para identificar de un vistazo quién va más adelante.
    matriz.sort((a, b) => b.completados - a.completados ||
      String(a.razon || a.ruc).localeCompare(String(b.razon || b.ruc), "es"));
    return { porComponente, matriz };
  }

  // Detalle de un componente (grupo 1-5) a nivel de ACTIVIDAD (código
  // decimal exacto, p. ej. 3.1 vs 3.4 dentro de C3): qué UP pasaron por cada
  // actividad, con especialista y estado (ejecutado/programado). Sirve para
  // el "clic en la tarjeta del componente" de la Vista general.
  //
  // Una misma UP puede tomar más de un servicio dentro de la MISMA
  // actividad (p. ej. dos visitas de asistencia técnica en 3.4): se
  // consolida en **una sola fila por UP+actividad** (`cantServicios` cuenta
  // cuántos servicios/eventos hay detrás) para no duplicar la UP en la
  // tabla ni en el conteo de `porActividad` (que cuenta UP únicas, no
  // servicios).
  function cddFestDetalleComponente(unidades, grupo) {
    const grupos = new Map(); // "ruc|codigo" -> { ruc, razon, codigo, eventos:[] }
    (unidades || []).forEach((u) => {
      u.eventos.filter((e) => e.componenteGrupo === grupo).forEach((e) => {
        const codigo = e.componenteCodigo != null ? e.componenteCodigo.toFixed(1) : null;
        const key = u.ruc + "|" + codigo;
        if (!grupos.has(key)) grupos.set(key, { ruc: u.ruc, razon: u.razon || u.ruc, codigo, eventos: [] });
        grupos.get(key).eventos.push(e);
      });
    });
    const filas = Array.from(grupos.values()).map((g) => {
      const eventos = g.eventos.slice().sort((a, b) =>
        (a.fecha ? a.fecha.getTime() : 0) - (b.fecha ? b.fecha.getTime() : 0));
      const especialistas = Array.from(new Set(eventos.map((e) => e.especialista).filter(Boolean)));
      const ultima = eventos[eventos.length - 1];
      return {
        ruc: g.ruc, razon: g.razon, codigo: g.codigo,
        especialista: especialistas.join(", ") || null,
        ejecutado: eventos.some((e) => e.ejecutado),
        fecha: ultima ? ultima.fecha : null,
        cantServicios: eventos.length,
      };
    });
    filas.sort((a, b) => (a.fecha ? a.fecha.getTime() : 0) - (b.fecha ? b.fecha.getTime() : 0));
    const porActividad = new Map(); // código -> conteo de UP únicas (no de servicios)
    filas.forEach((f) => { if (f.codigo) porActividad.set(f.codigo, (porActividad.get(f.codigo) || 0) + 1); });
    return { filas, porActividad };
  }

  // Regla informativa de duración esperada por tipo de actividad (no
  // reprograma fechas, solo etiqueta): asistencia técnica ≥ 7h, diseño 3-4h.
  const RE_MARCAS_COMBINANTES = new RegExp("[\\u0300-\\u036f]", "g");
  function normTexto(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(RE_MARCAS_COMBINANTES, "");
  }
  function reglaDuracion(tipoServicio, tipoTarea) {
    const t = normTexto(tipoServicio) + " " + normTexto(tipoTarea);
    if (t.includes("asistencia tecnica")) return { min: 7, max: null, label: "≥ 7 h (asistencia técnica)" };
    if (t.includes("diseno")) return { min: 3, max: 4, label: "3–4 h (diseño y desarrollo)" };
    return null;
  }

  global.POI.metrics = {
    pct, kpis, metaVsEjec, tendenciaMensual, rankingEspecialistas,
    complejidadResumen, heatmapCumplimiento, clientesResumen,
    clientesNuevosPorMes, kpisClientes, clientesMetaPorMes,
    clientesMetaEspecialistas,
    componenteGrupo, iceBrechas, ordenRecomendado, cddFestUnidades,
    cddFestResumenComponentes, cddFestDetalleComponente, reglaDuracion,
    metaMinimaComponente,
    sumBy, uniqueCountBy, nunique, sumCol,
  };
})(window);
