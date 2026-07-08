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
│   ├── clientes.xlsx     (opcional)
│   └── bd.xlsx           (opcional · histórico para clasificar clientes)
└── Dashboard POI 2026.dc.html   # Maqueta de referencia del diseño
```

## 📊 Modelo de datos (columnas exactas)

* **ejecucion.xlsx**: `ID_ACTIVIDAD, FECHA, AÑO, MES, SEMANA, PROGRAMA,
  ESPECIALISTA, RUC, RAZON_SOCIAL, TIPO_SERVICIO, TIPO_TAREA, COMPLEJIDAD
  (Alta/Media/Baja), CANTIDAD, FUENTE` (opcional: `TEMA_ABORDADO`)
* **metas.xlsx**: `ID_META, AÑO, MES, PROGRAMA, ESPECIALISTA, TIPO_SERVICIO,
  TIPO_TAREA, COMPLEJIDAD, META_CANTIDAD, META_FOCALIZADOS`
* **focalizados.xlsx**: `RUC, RAZON_SOCIAL, TIPO`
* **clientes.xlsx**: `MES, TIPO (FOCALIZADO / NO FOCALIZADO), META`
* **bd.xlsx**: `AÑO, RUC, RAZON_SOCIAL` (histórico de atención)

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
  indicadores, gráficos y tablas de todas las vistas.

## 🎨 Identidad visual

Paleta institucional morada (`#5C1F5C` / `#7A2A7A`) con azul complementario,
tipografía IBM Plex y semáforo verde/ámbar/rojo. La guía de diseño es
`Dashboard POI 2026.dc.html`.

---

### Versión Streamlit (local, opcional)

El proyecto conserva la app original de Streamlit (`Resume.py`, `pages/`,
`utils/`) para uso local:

```bash
pip install -r requirements.txt
streamlit run Resume.py
```

La versión publicada en la web es la **estática** descrita arriba; Streamlit no
puede alojarse en GitHub Pages porque requiere un servidor Python.
