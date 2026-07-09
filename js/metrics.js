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
      out.push({ Dim: d, Meta: meta, Ejecutado: ejec, Cumplimiento: c,
                 Brecha: Math.max(meta - ejec, 0), Semaforo: semaforo(c) });
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
             .map((r) => Object.assign({}, r, { Mes: CFG.MESES_ES[r.Dim] || r.Dim,
                                                MesNum: r.Dim }));
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
      return { MesNum: mes, Mes: CFG.MESES_ES[mes] || mes, Activos: activos,
               Nuevos: nuevos, Recurrentes: activos - nuevos };
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
    const targetFoc = metaFocTotal / Nesp;
    const targetNoFoc = metaNoFocTotal / Nesp;
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
      return { MesNum: mes, Mes: CFG.MESES_ES[mes] || mes,
               FOCALIZADO: o.FOC, NO_FOCALIZADO: o.NOFOC, META_TOTAL: o.FOC + o.NOFOC };
    });
  }

  global.POI.metrics = {
    pct, kpis, metaVsEjec, tendenciaMensual, rankingEspecialistas,
    complejidadResumen, heatmapCumplimiento, clientesResumen,
    clientesNuevosPorMes, kpisClientes, clientesMetaPorMes,
    clientesMetaEspecialistas,
    sumBy, uniqueCountBy, nunique, sumCol,
  };
})(window);
