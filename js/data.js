/* ============================================================
   js/data.js — Carga y normalización de los Excel de /data
   Puerto de utils/data_loader.py + utils/config.py al navegador (SheetJS).
   Los datos se leen en el cliente: para actualizar el tablero basta con
   reemplazar los .xlsx de /data y hacer git push (sin tocar el código).
   ============================================================ */
(function (global) {
  "use strict";

  // ---- Configuración: nombres de columna (idénticos a utils/config.py) ----
  const CFG = {
    ANIO_ACTUAL: 2026,
    ANIOS_SIN_SERVICIO: 3,
    // Programa institucional principal: la meta de clientes se muestra por
    // defecto para este programa (CdD-FEST u otros solo al filtrarlos).
    PROGRAMA_PRINCIPAL: "POI",
    FILES: {
      ejecucion:   "data/ejecucion.xlsx",
      metas:       "data/metas.xlsx",
      focalizados: "data/focalizados.xlsx",
      clientes:    "data/clientes.xlsx",
      bd:          "data/bd.xlsx",
      programado:  "data/programado.xlsx",
      results_ice: "data/results_ice.xlsx",
    },
    // Ejecución
    X: {
      ID: "ID_ACTIVIDAD", FECHA: "FECHA", ANIO: "AÑO", MES: "MES",
      PROGRAMA: "PROGRAMA", ESPECIALISTA: "ESPECIALISTA", RUC: "RUC",
      RAZON: "RAZON_SOCIAL", SERVICIO: "TIPO_SERVICIO", TAREA: "TIPO_TAREA",
      COMPLEJIDAD: "COMPLEJIDAD", CANTIDAD: "CANTIDAD", FUENTE: "FUENTE",
      TEMA: "TEMA_ABORDADO", COMPONENTE: "COMPONENTE",
    },
    // Metas
    M: {
      ID: "ID_META", ANIO: "AÑO", MES: "MES", PROGRAMA: "PROGRAMA",
      ESPECIALISTA: "ESPECIALISTA", SERVICIO: "TIPO_SERVICIO", TAREA: "TIPO_TAREA",
      COMPLEJIDAD: "COMPLEJIDAD", META: "META_CANTIDAD", META_FOC: "META_FOCALIZADOS",
    },
    // Focalizados
    F: { RUC: "RUC", RAZON: "RAZON_SOCIAL", TIPO: "TIPO" },

    PESOS_COMPLEJIDAD: { Alta: 3, Media: 2, Baja: 1 },
    COMPLEJIDADES: ["Alta", "Media", "Baja"],
    SEMAFORO_VERDE: 100,
    SEMAFORO_AMARILLO: 80,
    MESES_ES: { 1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
                7: "Jul", 8: "Ago", 9: "Set", 10: "Oct", 11: "Nov", 12: "Dic" },
    MESES_NOMBRE: { 1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo",
                    6: "Junio", 7: "Julio", 8: "Agosto", 9: "Setiembre",
                    10: "Octubre", 11: "Noviembre", 12: "Diciembre" },

    // ---- CdD-FEST: catálogo de componentes -------------------------------
    // El código decimal de ESPECIALISTA/COMPONENTE (1.1, 3.4, 4.2, …) usa
    // como parte entera el grupo de componente (floor(codigo) => 1..5).
    COMPONENTES: {
      1: { id: "C1", nombre: "Índice de Competitividad",
           objetivo: "Establecer la línea base de 100 UP mediante un diagnóstico competitivo integral." },
      2: { id: "C2", nombre: "Gestión Empresarial",
           objetivo: "Fortalecer capacidades empresariales para la implementación de modelos de negocio y gestión financiera." },
      3: { id: "C3", nombre: "Mejora de procesos productivos y estandarización de la calidad",
           objetivo: "Mejorar procesos productivos para el desarrollo de prototipos con estándares de calidad." },
      4: { id: "C4", nombre: "Digitalización y Packaging",
           objetivo: "Posicionar a las UP en canales digitales." },
      5: { id: "C5", nombre: "Comercio Exterior",
           objetivo: "Preparar a las UP para exportar y facilitar operaciones internacionales." },
    },

    // ---- CdD-FEST: catálogo de actividades (código decimal → nombre +
    // especialista de referencia). Un componente puede tener varias
    // actividades (p. ej. C3 agrupa 3.1 a 3.7); el código exacto de cada
    // evento viene de COMPONENTE en ejecucion.xlsx / programado.xlsx.
    ACTIVIDADES: {
      "1.1": { nombre: "Medición del Índice de Competitividad", especialista: "Lita Castillo" },
      "2.1": { nombre: "Gestión tecnológica empresarial", especialista: "Mitzuko Quispe" },
      "3.1": { nombre: "Diseño y desarrollo de productos", especialista: "Willy Arredondo" },
      "3.2": { nombre: "Diseño y desarrollo de productos textiles", especialista: "Eusebio Coanqui" },
      "3.3": { nombre: "Propuestas innovadoras de productos textiles", especialista: "Diseñadora" },
      "3.4": { nombre: "Tinturación y acabados húmedos", especialista: "Erika Turpo" },
      "3.5": { nombre: "Soporte productivo en teñido", especialista: null },
      "3.6": { nombre: "Soporte productivo en acabados", especialista: null },
      "3.7": { nombre: "Ensayos de laboratorio", especialista: "Miriam Pari" },
      "4.1": { nombre: "Marketing digital", especialista: "Luis Valencia" },
      "4.2": { nombre: "Herramientas digitales y tecnología", especialista: "Ruth Arce" },
      "4.3": { nombre: "Diseño de envases y empaques", especialista: "Henry Gutiérrez" },
      "5.1": { nombre: "Comercio internacional", especialista: "Cynthia" },
    },

    // ---- CdD-FEST: dimensiones del ICE (results_ice.xlsx) -----------------
    // `componente` liga la dimensión a un componente C2-C5 para el cálculo de
    // brechas y el orden recomendado (C1 es la línea base: el propio
    // diagnóstico). Sostenibilidad y Ecosistema quedan sin componente: se
    // muestran en el radar como contexto, pero no priorizan por sí solas.
    ICE_DIM: [
      { key: "PRODUCTIVA", label: "Gestión Productiva",
        puntajePatterns: ["gestion productiva puntaje", "gestion productiva (puntaje)"],
        nivelPatterns: ["gestion productiva nivel", "gestion productiva (nivel)"],
        componente: 3, proxy: true },
      { key: "ORGANIZACIONAL", label: "Gestión Organizacional",
        puntajePatterns: ["gestion organizacional puntaje", "gestion organizacional (puntaje)"],
        nivelPatterns: ["gestion organizacional nivel", "gestion organizacional (nivel)"],
        componente: 2 },
      { key: "FINANCIERA", label: "Gestión Financiera y Tributaria",
        puntajePatterns: ["gestion financiera y tributaria puntaje", "gestion financiera y tributaria (puntaje)"],
        nivelPatterns: ["gestion financiera y tributaria nivel", "gestion financiera y tributaria (nivel)"],
        componente: 2 },
      { key: "COMERCIO", label: "Comercio Exterior",
        puntajePatterns: ["comercio exterior puntaje", "comercio exterior (puntaje)"],
        nivelPatterns: ["comercio exterior nivel", "comercio exterior (nivel)"],
        componente: 5 },
      { key: "MARKETING", label: "Marketing",
        puntajePatterns: ["marketing puntaje", "marketing (puntaje)"],
        nivelPatterns: ["marketing nivel", "marketing (nivel)"],
        componente: 4 },
      { key: "TECNOLOGIA", label: "Tecnología e Innovación",
        puntajePatterns: ["tecnologia e innovacion puntaje", "tecnologia e innovacion (puntaje)"],
        nivelPatterns: ["tecnologia e innovacion nivel", "tecnologia e innovacion (nivel)"],
        componente: 4 },
      { key: "SOSTENIBILIDAD", label: "Sostenibilidad",
        puntajePatterns: ["sostenibilidad puntaje", "sostenibilidad (puntaje)"],
        nivelPatterns: ["sostenibilidad nivel", "sostenibilidad (nivel)"],
        componente: null },
      { key: "ECOSISTEMA", label: "Ecosistema de Influencia / Entorno",
        puntajePatterns: ["ecosistema de influencia", "ecosistema de influencia / entorno puntaje", "entorno puntaje"],
        nivelPatterns: ["ecosistema de influencia nivel", "ecosistema de influencia / entorno nivel", "entorno nivel"],
        componente: null },
    ],
    NIVEL_PROXY: { bajo: 25, medio: 55, alto: 85 },
  };

  function semaforo(pct) {
    if (pct >= CFG.SEMAFORO_VERDE) return "verde";
    if (pct >= CFG.SEMAFORO_AMARILLO) return "amarillo";
    return "rojo";
  }

  // -------------------------------------------------------------------------
  // Utilidades de normalización
  // -------------------------------------------------------------------------
  function normRuc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/\.0$/, "").trim();
  }
  function toNum(v) {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const n = parseFloat(String(v).replace(/,/g, "").trim());
    return isFinite(n) ? n : 0;
  }
  function toInt(v) { return Math.trunc(toNum(v)); }

  function normComplejidad(v) {
    const s = String(v == null ? "" : v).trim().toLowerCase();
    if (s.includes("alta")) return "Alta";
    if (s.includes("media")) return "Media";
    if (s.includes("baja")) return "Baja";
    return "Media";
  }

  // Fecha: acepta Date (SheetJS cellDates), serial Excel o string en varios formatos
  function parseFecha(v) {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date && !isNaN(v)) return v;
    if (typeof v === "number") {
      // serial de Excel (base 1899-12-30)
      const ms = Math.round((v - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return isNaN(d) ? null : d;
    }
    const s = String(v).trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))
      return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)))
      return new Date(+m[3], +m[2] - 1, +m[1]); // d/m/Y
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  // Normaliza cabeceras a MAYÚSCULAS sin espacios, respetando la Ñ de "AÑO"
  function normalizeRows(rows) {
    return rows.map((row) => {
      const out = {};
      for (const k in row) out[String(k).trim().toUpperCase()] = row[k];
      return out;
    });
  }

  // Normaliza una clave de columna para comparar sin acentos/paréntesis/caja
  // (p. ej. "Gestión Productiva (Puntaje)" y "gestion productiva puntaje"
  // deben considerarse la misma columna).
  const RE_COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
  function normKey(s) {
    return String(s == null ? "" : s)
      .toUpperCase()
      .normalize("NFD").replace(RE_COMBINING_MARKS, "")
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  }
  // Busca en `row` la clave real que corresponde a alguno de los `patterns`
  // (tolerante a acentos, mayúsculas y paréntesis). Devuelve la clave o null.
  function findCol(row, patterns) {
    const keys = Object.keys(row).map((k) => ({ k, n: normKey(k) }));
    for (const p of patterns) {
      const np = normKey(p);
      const hit = keys.find((x) => x.n === np) || keys.find((x) => x.n.includes(np));
      if (hit) return hit.k;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Lectura de un archivo .xlsx
  // -------------------------------------------------------------------------
  async function readSheet(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`No se pudo leer ${url} (HTTP ${resp.status})`);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
    return normalizeRows(rows);
  }
  async function readSheetOptional(url) {
    try { return await readSheet(url); }
    catch (e) { return null; }
  }

  // -------------------------------------------------------------------------
  // Carga y cruce de todos los orígenes
  // -------------------------------------------------------------------------
  async function loadAll() {
    const { X, M, F } = CFG;

    // Focalizados (opcional)
    let focRows = await readSheetOptional(CFG.FILES.focalizados);
    const focMap = new Map();
    if (focRows) {
      for (const r of focRows) {
        const ruc = normRuc(r[F.RUC]);
        if (!ruc || focMap.has(ruc)) continue;
        focMap.set(ruc, String(r[F.TIPO] == null ? "" : r[F.TIPO]).trim().toUpperCase());
      }
    }

    // Ejecución (obligatorio)
    const eje = (await readSheet(CFG.FILES.ejecucion)).map((r) => {
      const o = Object.assign({}, r);
      o[X.RUC] = normRuc(o[X.RUC]);
      o[X.CANTIDAD] = toNum(o[X.CANTIDAD]);
      o[X.COMPLEJIDAD] = normComplejidad(o[X.COMPLEJIDAD]);
      const f = parseFecha(o[X.FECHA]);
      if (f) { o[X.ANIO] = f.getFullYear(); o[X.MES] = f.getMonth() + 1; o[X.FECHA] = f; }
      o[X.MES] = toInt(o[X.MES]);
      o[X.ANIO] = toInt(o[X.ANIO]);
      o.MES_LABEL = CFG.MESES_ES[o[X.MES]] || o[X.MES];
      const tipoFoc = focMap.get(o[X.RUC]);
      o.TIPO_FOCALIZADO = tipoFoc || null;
      o.ES_FOCALIZADO = !!tipoFoc;
      return o;
    });

    // Derivados por RUC: cliente nuevo-en-mes / recurrente
    const mesesPorRuc = new Map();      // ruc -> Set(mes)
    const primerMes = new Map();        // ruc -> min mes
    for (const r of eje) {
      const ruc = r[X.RUC], mes = r[X.MES];
      if (!mesesPorRuc.has(ruc)) mesesPorRuc.set(ruc, new Set());
      mesesPorRuc.get(ruc).add(mes);
      primerMes.set(ruc, Math.min(primerMes.has(ruc) ? primerMes.get(ruc) : Infinity, mes));
    }
    for (const r of eje) {
      r.ES_NUEVO_EN_MES = r[X.MES] === primerMes.get(r[X.RUC]);
      r.ES_RECURRENTE = mesesPorRuc.get(r[X.RUC]).size > 1;
    }

    // Metas (obligatorio)
    const met = (await readSheet(CFG.FILES.metas)).map((r) => {
      const o = Object.assign({}, r);
      o[M.META] = toNum(o[M.META]);
      o[M.META_FOC] = toNum(o[M.META_FOC]);
      o[M.MES] = toInt(o[M.MES]);
      o.MES_LABEL = CFG.MESES_ES[o[M.MES]] || o[M.MES];
      if (o[M.COMPLEJIDAD] != null) o[M.COMPLEJIDAD] = normComplejidad(o[M.COMPLEJIDAD]);
      return o;
    });

    // Clientes (opcional): metas de clientes por mes/tipo
    let cli = await readSheetOptional(CFG.FILES.clientes);
    cli = (cli || []).map((r) => ({
      MES: toInt(r.MES),
      PROGRAMA: r.PROGRAMA != null ? String(r.PROGRAMA).trim() : null,
      TIPO: String(r.TIPO == null ? "" : r.TIPO).trim().toUpperCase(),
      META: toNum(r.META),
    }));

    // BD histórica (opcional): ANIO, RUC, RAZON_SOCIAL
    let bdRows = await readSheetOptional(CFG.FILES.bd);
    let bd = [];
    if (bdRows) {
      bd = bdRows.map((r) => {
        const keys = Object.keys(r);
        return {
          ANIO: toInt(r.AÑO != null ? r.AÑO : (r.ANIO != null ? r.ANIO : r[keys[0]])),
          RUC: normRuc(r.RUC != null ? r.RUC : r[keys[1]]),
          RAZON_SOCIAL: r.RAZON_SOCIAL != null ? r.RAZON_SOCIAL : r[keys[2]],
        };
      });
    }

    // Programado (opcional): fechas programadas de intervención (CdD-FEST /
    // WORLD-VISION). Columnas: ID_META, AÑO, MES, FECHA_PROGRAMADA, PROGRAMA,
    // ESPECIALISTA, TIPO_SERVICIO, COMPLEJIDAD, TIPO_TAREA, META_CANTIDAD,
    // META_FOCALIZADOS, PUNTO_INTERVENCIÓN.
    let progRows = await readSheetOptional(CFG.FILES.programado);
    let programado = [];
    if (progRows) {
      programado = progRows.map((r) => {
        const f = parseFecha(r.FECHA_PROGRAMADA);
        const punto = r["PUNTO_INTERVENCIÓN"] != null ? r["PUNTO_INTERVENCIÓN"]
          : (r.PUNTO_INTERVENCION != null ? r.PUNTO_INTERVENCION : r.PUNTO);
        const tematica = r["TEMÁTICA"] != null ? r["TEMÁTICA"]
          : (r.TEMATICA != null ? r.TEMATICA : r.TEMA);
        return {
          ID_META: r.ID_META,
          ANIO: f ? f.getFullYear() : toInt(r.AÑO != null ? r.AÑO : r.ANIO),
          MES: f ? f.getMonth() + 1 : toInt(r.MES),
          FECHA: f,
          PROGRAMA: r.PROGRAMA != null ? String(r.PROGRAMA).trim() : null,
          ESPECIALISTA: r.ESPECIALISTA,
          TURNO: r.TURNO != null ? String(r.TURNO).trim() : "",
          TIPO_SERVICIO: r.TIPO_SERVICIO,
          COMPLEJIDAD: r.COMPLEJIDAD != null ? normComplejidad(r.COMPLEJIDAD) : null,
          TEMATICA: tematica != null ? String(tematica).trim() : "",
          TIPO_TAREA: r.TIPO_TAREA,
          META_CANTIDAD: toNum(r.META_CANTIDAD),
          META_FOCALIZADOS: toNum(r.META_FOCALIZADOS),
          PUNTO: punto != null ? String(punto).trim() : "(sin punto)",
          // CdD-FEST (planificador por Unidad Productiva): opcionales, se
          // agregan a programado.xlsx para vincular cada fecha programada
          // con su UP y su componente (mismo código decimal que ejecucion.xlsx).
          RUC: r.RUC != null ? normRuc(r.RUC) : "",
          COMPONENTE: r.COMPONENTE != null && r.COMPONENTE !== "" ? toNum(r.COMPONENTE) : null,
        };
      });
    }

    // Results ICE (opcional): diagnóstico de competitividad por Unidad
    // Productiva (CdD-FEST). Columnas reales: RUC, DNI, Razón Social,
    // ICE Global, y por cada dimensión un par (Puntaje)/(Nivel) — salvo
    // "Gestión Productiva", que en la fuente solo trae (Nivel). Para esa
    // dimensión se estima un puntaje proxy desde el Nivel (marcado luego en
    // la UI con "≈").
    let iceRows = await readSheetOptional(CFG.FILES.results_ice);
    let resultsIce = [];
    if (iceRows && iceRows.length) {
      const sample = iceRows[0];
      const colRuc = findCol(sample, ["ruc"]);
      const colDni = findCol(sample, ["dni"]);
      const colRazon = findCol(sample, ["razon social"]);
      const colGlobal = findCol(sample, ["ice global"]);
      resultsIce = iceRows.map((r) => {
        const dims = {};
        for (const dim of CFG.ICE_DIM) {
          const colP = findCol(r, dim.puntajePatterns);
          const colN = findCol(r, dim.nivelPatterns);
          const nivel = colN ? String(r[colN] == null ? "" : r[colN]).trim() : "";
          let puntaje = colP ? toNum(r[colP]) : null;
          let esProxy = false;
          if (puntaje === null || (colP == null)) {
            puntaje = CFG.NIVEL_PROXY[nivel.toLowerCase()] != null
              ? CFG.NIVEL_PROXY[nivel.toLowerCase()] : null;
            esProxy = true;
          }
          dims[dim.key] = {
            label: dim.label, componente: dim.componente,
            puntaje, nivel: nivel || null, esProxy,
            brecha: puntaje != null ? Math.max(0, 100 - puntaje) : null,
          };
        }
        return {
          RUC: normRuc(colRuc ? r[colRuc] : ""),
          DNI: colDni ? r[colDni] : null,
          RAZON_SOCIAL: colRazon ? r[colRazon] : null,
          ICE_GLOBAL: colGlobal ? toNum(r[colGlobal]) : null,
          DIMS: dims,
        };
      }).filter((r) => r.RUC);
    }

    // Validación mínima de estructura (mensaje claro en pantalla)
    const faltan = [];
    const need = [
      ["ejecucion.xlsx", eje, [X.MES, X.ESPECIALISTA, X.RUC, X.CANTIDAD]],
      ["metas.xlsx", met, [M.MES, M.ESPECIALISTA, M.META]],
    ];
    for (const [name, rows, cols] of need) {
      const present = rows.length ? new Set(Object.keys(rows[0])) : new Set();
      for (const c of cols) if (!present.has(c)) faltan.push(`${name} → falta la columna '${c}'`);
    }
    if (faltan.length) {
      const err = new Error("Estructura de datos incompleta");
      err.detail = faltan;
      throw err;
    }

    return { ejecucion: eje, metas: met, focalizados: focRows || [], clientes: cli, bd, programado, resultsIce };
  }

  // -------------------------------------------------------------------------
  // Filtro global (programa / meses / especialistas) aplicado de forma
  // uniforme a ejecución y metas. Un solo estado de filtro para todo el
  // tablero: elimina el problema de "doble filtro".
  // -------------------------------------------------------------------------
  function filtrar(rows, flt, colProg, colMes, colEsp) {
    if (!rows || !rows.length) return rows || [];
    let out = rows;
    if (flt.programas && flt.programas.length)
      out = out.filter((r) => flt.programas.includes(r[colProg]));
    if (flt.meses && flt.meses.length)
      out = out.filter((r) => flt.meses.includes(r[colMes]));
    if (flt.especialistas && flt.especialistas.length)
      out = out.filter((r) => flt.especialistas.includes(r[colEsp]));
    return out;
  }

  function aplicar(data, flt) {
    const X = CFG.X, M = CFG.M;
    return {
      eje: filtrar(data.ejecucion, flt, X.PROGRAMA, X.MES, X.ESPECIALISTA),
      met: filtrar(data.metas, flt, M.PROGRAMA, M.MES, M.ESPECIALISTA),
    };
  }

  // Metas de clientes (clientes.xlsx sólo tiene MES/TIPO): responde a meses.
  function filtrarClientes(data, flt) {
    let cli = data.clientes || [];
    if (flt.meses && flt.meses.length) cli = cli.filter((r) => flt.meses.includes(r.MES));
    if (flt.programas && flt.programas.length) {
      cli = cli.filter((r) => r.PROGRAMA == null || flt.programas.includes(r.PROGRAMA));
    } else if (CFG.PROGRAMA_PRINCIPAL &&
               cli.some((r) => r.PROGRAMA === CFG.PROGRAMA_PRINCIPAL)) {
      // Sin filtro de programa: por defecto solo el programa principal (POI)
      cli = cli.filter((r) => r.PROGRAMA === CFG.PROGRAMA_PRINCIPAL);
    }
    return cli;
  }

  // Fechas programadas de intervención (programado.xlsx): responde a los
  // filtros globales de programa / mes / especialista.
  function filtrarProgramado(data, flt) {
    let p = data.programado || [];
    if (flt.programas && flt.programas.length) p = p.filter((r) => flt.programas.includes(r.PROGRAMA));
    if (flt.meses && flt.meses.length) p = p.filter((r) => flt.meses.includes(r.MES));
    if (flt.especialistas && flt.especialistas.length) p = p.filter((r) => flt.especialistas.includes(r.ESPECIALISTA));
    return p;
  }

  // Fila de results_ice.xlsx para un RUC dado (o null si no hay diagnóstico).
  function iceByRuc(data, ruc) {
    const rows = data.resultsIce || [];
    return rows.find((r) => r.RUC === ruc) || null;
  }

  // Valores únicos ordenados de una columna sobre uno o más datasets
  function opcionesUnicas(datasets, col) {
    const set = new Set();
    for (const ds of datasets) for (const r of ds) {
      const v = r[col];
      if (v !== null && v !== undefined && v !== "") set.add(v);
    }
    return Array.from(set);
  }

  global.POI = global.POI || {};
  global.POI.CFG = CFG;
  global.POI.semaforo = semaforo;
  global.POI.data = {
    loadAll, aplicar, filtrar, filtrarClientes, filtrarProgramado, opcionesUnicas,
    iceByRuc, normRuc, toNum, toInt, normComplejidad,
  };
})(window);
