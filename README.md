# CITE · Dashboard POI 2026

Tablero de **seguimiento y monitoreo de metas** del Plan Operativo Institucional
2026: META vs EJECUCIÓN, cumplimiento por especialista, programa presupuestal,
clientes (nuevos / reenganchados / focalizados) y estructura de servicios.

Es un **sitio estático** (HTML + CSS + JavaScript). Lee los Excel de `data/`
directamente en el navegador, así que **se publica en GitHub Pages** y se
actualiza sólo reemplazando los archivos de `data/` y haciendo `git push`
— sin tocar el código.

---

## 🔗 Publicar en GitHub Pages

1. Sube el repositorio a GitHub (rama `main`).
2. En GitHub: **Settings → Pages → Build and deployment**
   - *Source*: **Deploy from a branch**
   - *Branch*: `main` · carpeta `/ (root)` → **Save**
3. En 1–2 minutos el tablero queda en
   `https://<usuario>.github.io/<repositorio>/`

> El archivo `.nojekyll` (ya incluido) evita que GitHub procese el sitio con
> Jekyll y sirve las carpetas `js/` y `data/` tal cual.

## 🔄 Actualizar los datos (flujo sin código)

```bash
# 1) Reemplaza los Excel en data/ con los nuevos (mismos nombres y columnas)
# 2) Publica
git add data/
git commit -m "Actualiza datos POI"
git push
```

GitHub Pages se regenera solo. El tablero muestra los datos nuevos al recargar.
**No hay que modificar ningún archivo de código.**

## 🖥️ Vista previa local

GitHub Pages usa HTTP; en local también necesitas un servidor (abrir el
`index.html` con `file://` **no** funciona porque el navegador bloquea la
lectura de los Excel).

```bash
# desde la carpeta del proyecto
python -m http.server 8000
# abre http://localhost:8000
```

---

## 📁 Estructura

```
├── index.html            # App (riel de navegación, header, barra de filtros)
├── .nojekyll             # requerido por GitHub Pages
├── css/
│   └── styles.css        # Sistema de diseño institucional (paleta morada)
├── js/
│   ├── lib/xlsx.full.min.js   # SheetJS (lectura de .xlsx en el navegador)
│   ├── data.js           # Carga y normalización de los Excel + filtros
│   ├── metrics.js        # Reglas de negocio (cumplimiento, clientes, etc.)
│   ├── charts.js         # Gráficos SVG (barras, líneas, dona, heatmap)
│   └── app.js            # Routing, filtros globales y las 5 vistas
├── assets/               # Logos institucionales
├── data/                 # ← Excel de origen (reemplazar para actualizar)
│   ├── ejecucion.xlsx
│   ├── metas.xlsx
│   ├── focalizados.xlsx
│   ├── clientes.xlsx     (opcional · metas de clientes por programa/mes/tipo)
│   ├── bd.xlsx           (opcional · histórico para clasificar clientes)
│   ├── programado.xlsx   (opcional · fechas programadas de intervención)
│   └── results_ice.xlsx  (opcional · diagnóstico ICE por Unidad Productiva, CdD-FEST)
└── Dashboard POI 2026.dc.html   # Maqueta de referencia del diseño
```

## 📊 Modelo de datos (columnas exactas)

* **ejecucion.xlsx**: `ID_ACTIVIDAD, FECHA, AÑO, MES, SEMANA, PROGRAMA,
  ESPECIALISTA, RUC, RAZON_SOCIAL, TIPO_SERVICIO, TIPO_TAREA, COMPLEJIDAD
  (Alta/Media/Baja), CANTIDAD, FUENTE` (opcional: `TEMA_ABORDADO`)
* **metas.xlsx**: `ID_META, AÑO, MES, PROGRAMA, ESPECIALISTA, TIPO_SERVICIO,
  TIPO_TAREA, COMPLEJIDAD, META_CANTIDAD, META_FOCALIZADOS`
* **focalizados.xlsx**: `RUC, RAZON_SOCIAL, TIPO`
* **clientes.xlsx**: `MES, PROGRAMA, TIPO (FOCALIZADO / NO FOCALIZADO), META`
* **bd.xlsx**: `AÑO, RUC, RAZON_SOCIAL` (histórico de atención)
* **programado.xlsx** (opcional · calendario de intervención): `ID_META, AÑO,
  MES, FECHA_PROGRAMADA, PROGRAMA, ESPECIALISTA, TURNO (Mañana/Tarde),
  TIPO_SERVICIO, COMPLEJIDAD, TEMÁTICA, TIPO_TAREA, META_CANTIDAD,
  META_FOCALIZADOS, PUNTO_INTERVENCIÓN`. Para el planificador **CdD-FEST**
  agrega además `RUC` (Unidad Productiva) y `COMPONENTE` (mismo código
  decimal que en `ejecucion.xlsx`, p. ej. `3.4`) — sin estas dos columnas, lo
  programado se ve en el calendario pero sin componente/color asignado.
* **results_ice.xlsx** (opcional · diagnóstico ICE, CdD-FEST): `RUC, DNI,
  Razón Social, ICE Global`, y por cada dimensión un par `(Puntaje)/(Nivel)`:
  Gestión Productiva, Gestión Organizacional, Gestión Financiera y
  Tributaria, Comercio Exterior, Marketing, Tecnología e Innovación,
  Sostenibilidad, Ecosistema de Influencia/Entorno. Si a alguna dimensión le
  falta el `(Puntaje)`, el tablero estima uno desde el `(Nivel)`
  (Bajo=25, Medio=55, Alto=85) y lo marca con "≈" en el radar.

> Las cabeceras se normalizan a MAYÚSCULAS y sin espacios al cargar, así que
> pequeñas variaciones de formato no rompen el tablero. Los programas, meses y
> especialistas de los filtros se derivan automáticamente de los datos.

## 🧮 Reglas implementadas

* Focalizados se cruzan **automáticamente por RUC** al cargar.
* Productividad ponderada: Alta×3, Media×2, Baja×1.
* Semáforo de cumplimiento: 🟩 ≥100 % · 🟨 80–99 % · 🟥 <80 %.
* Clientes: **nuevo** = sin historial + complejidad media/alta; **reenganchado**
  = atendido antes pero sin servicio 2023–2025 + media/alta; **recurrente** = resto.
* AÑO/MES se re-derivan de FECHA cuando está disponible.
* Un **único filtro global** (Programa · Mes · Especialista) alimenta todos los
  indicadores, gráficos y tablas de todas las vistas — **excepto CdD-FEST**,
  que tiene su propio selector de Unidad Productiva y oculta la barra de
  filtros globales por no aplicarle.
* **Especialistas**: por defecto muestra **"Todos"** (agregado de todo el
  equipo); el desplegable "Ver especialista" permite acotar a uno solo. La
  tabla "Meta de clientes atendidos por especialista" respeta esa elección
  (si se filtra a uno, solo muestra su fila), pero el reparto de metas
  (`Nesp`, meta focalizados/no focalizados) siempre se calcula sobre el
  programa completo.
* **Cumplimiento por tarea y mes** (heatmap): además del semáforo normal
  (verde/ámbar/rojo por % de cumplimiento), una tarea/mes **ejecutada sin
  tener meta programada** se muestra en una celda **gris neutra** con la
  cantidad ejecutada ("N s/meta") en vez de desaparecer — antes esos
  registros quedaban invisibles porque los ejes del heatmap solo se armaban
  con las tareas que tenían meta.
* **Servicios**: el panel "Meta vs Ejecutado por tarea" tiene un selector de
  tipo de servicio ("Todos" o uno específico) y muestra las cantidades reales
  (no solo %) ordenadas de mayor a menor por meta programada.

## 🧭 Planificador CdD-FEST

Pestaña dedicada (independiente de los filtros globales, con su propio
buscador de Unidad Productiva por RUC o razón social). Solo aparecen las UP
**realmente atendidas por CdD-FEST**: aquellas con el componente **1.1**
(Medición del Índice de Competitividad) **ejecutado** en `ejecucion.xlsx`.
Tener una fila en `results_ice.xlsx` no basta por sí sola para aparecer en
la lista (puede ser un diagnóstico externo sin visita real); si una UP fue
atendida (1.1 ejecutado) pero aún no tiene fila en `results_ice.xlsx`,
aparece en el buscador con el estado "Diagnóstico ICE pendiente". Tiene dos
modos (pestañas):

### Por Unidad Productiva

* **Radar ICE** (8 dimensiones) con el diagnóstico de `results_ice.xlsx`.
* **Orden recomendado de intervención**: C1 es la línea base (el propio
  diagnóstico, siempre primero). Entre los componentes C2–C5 **todavía
  pendientes**, se prioriza el de **MENOR brecha promedio** (el más cerca de
  estar listo) — no el de mayor brecha. Así se evita recomendar saltar a un
  componente avanzado (p. ej. C5 Comercio Exterior, que suele partir con
  brechas muy altas en casi todas las UP) mientras uno anterior (p. ej. C4
  Digitalización) todavía tiene una brecha grande sin resolver; y si una UP
  puntual ya está bien encaminada en un componente avanzado, ese sí sube de
  prioridad. Los componentes ya completados o programados no compiten por
  prioridad: se muestran después, en su orden natural C2→C5. Mapeo componente
  → dimensión ICE: C2 Gestión Empresarial → Gestión Organizacional +
  Financiera y Tributaria · C3 Mejora de procesos → Gestión Productiva ·
  C4 Digitalización y Packaging → Tecnología e Innovación + Marketing ·
  C5 Comercio Exterior → Comercio Exterior. Sostenibilidad y Ecosistema de
  Influencia se ven en el radar como contexto, sin priorizar un componente.
* **Línea de tiempo**: cruza lo ejecutado (`ejecucion.xlsx` → `COMPONENTE`)
  con lo programado (`programado.xlsx` → `RUC`+`COMPONENTE`), coloreado por
  componente (sólido = ejecutado, trama diagonal = solo programado). Cada
  intervención muestra especialista, tema/servicio y una etiqueta de
  **duración esperada** (informativa): "asistencia técnica" ≥ 7 h, "diseño"
  3–4 h — no reprograma fechas ni asigna horarios automáticamente.
* **Estado por componente** (C1–C5): completado / parcial / programado /
  pendiente (ver regla de "completado" abajo), con el **desglose por
  actividad exacta** (columna "Actividades": ✓ ejecutada, ◐ solo programada,
  ○ pendiente, junto al **especialista responsable** y la **meta
  institucional** de esa actividad entre paréntesis — p. ej. "✓ 3.4 · Erika
  Turpo (27)" — según `CFG.ACTIVIDADES` en `js/data.js`), especialista(s)
  asignado(s) al componente, última fecha ejecutada y próxima programada.

**Regla de "completado":** un componente con varias actividades (p. ej. C3
agrupa 3.1 a 3.7, C4 agrupa 4.1 a 4.3) solo cuenta como **Completado** cuando
**TODAS** sus actividades están ejecutadas para esa UP — no basta con una
sola. Si hay al menos una ejecutada pero no todas, el estado es **Parcial**
(se muestra como "Parcial x/y"); si ninguna está ejecutada pero hay alguna
programada, es "Programado"; si no hay ningún evento, "Pendiente". Los
componentes de una sola actividad (C1, C2, C5 en el catálogo actual) se
comportan igual que antes (ejecutar su única actividad ya los completa). El
**orden recomendado** trata "Parcial" igual que "Pendiente" (compite por
prioridad según brecha): un componente a medio hacer sigue necesitando
trabajo, no se da por atendido.

### Vista general

Todas las UP a la vez, **sin mezclar** el estado de un componente con otro:
una tarjeta por componente (C1–C5) con el conteo de UP completadas /
parciales / pendientes (misma regla de "completado" que arriba: todas las
actividades del componente) y una tabla-matriz (UP × C1–C5, buscable por
RUC o razón social, **ordenada por defecto por más componentes completados
primero**) para ver de un vistazo qué unidades productivas van más
adelantadas y cuáles fueron atendidas en cada componente.

Junto al título de cada tarjeta (p. ej. "C3") se muestra **`(completadas /
mínimo)`** — UP que ya completaron el componente frente a la **meta mínima
institucional** de su actividad de entrada (`MT.metaMinimaComponente` en
`js/metrics.js`, tomada de la meta de la actividad de código más bajo del
componente, p. ej. 3.1 para C3 — las siguientes actividades del mismo
componente son subconjuntos más específicos con metas menores). El estado
**"Programado" no se muestra por ahora** en estas tarjetas (se pliega dentro
de "Pendiente") porque el programa todavía no agenda por fechas; el dato
sigue calculándose internamente (`resumen.porComponente[g].programado`) y
solo está comentado en `viewCddFestGeneral()` de `js/app.js` — se puede
reactivar fácilmente cuando se retome la programación por fechas. El badge
"Programado" de la tabla-matriz (columnas C1–C5 por UP) no se tocó.

**Clic en cualquier fila de la tabla-matriz** expande, debajo, el desglose
de **actividad exacta por componente** para esa UP (mismo checklist ✓/◐/○
+ especialista responsable que en "Por Unidad Productiva"), para ver de un
vistazo qué actividad puntual falta y quién es el responsable dentro de un
componente marcado "Parcial". Un segundo clic en la misma fila lo cierra.

**Clic en cualquier tarjeta de componente** (p. ej. C3) abre su detalle a
nivel de **actividad exacta** (código decimal, p. ej. 3.1 vs 3.4 — un
componente puede agrupar varias actividades con especialistas distintos:
`CFG.ACTIVIDADES` en `js/data.js`), con un **botón por actividad** (con su
conteo de UP) — clic en uno filtra la tabla a solo esa actividad para verla
más limpia; un segundo clic la quita. Un segundo clic en la tarjeta del
componente cierra todo el detalle.

Una misma UP puede tomar **más de un servicio dentro de la misma
actividad** (p. ej. dos visitas de asistencia técnica en 3.4): la tabla y
el conteo de cada botón cuentan **UP únicas, no servicios** — cada UP
aparece una sola vez por actividad, con una columna **"Cant. servicios"**
indicando cuántos servicios se consolidaron en esa fila.

## 🎨 Identidad visual

Paleta institucional morada (`#5C1F5C` / `#7A2A7A`) con azul complementario,
tipografía IBM Plex y semáforo verde/ámbar/rojo. La guía de diseño es
`Dashboard POI 2026.dc.html`.
