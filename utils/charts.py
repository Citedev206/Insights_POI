"""
utils/charts.py — Sistema de diseño en código.

Contiene el tema Plotly, los componentes de interfaz (hero, tarjetas KPI,
encabezados de sección), los gráficos reutilizables, el heatmap semafórico
y la barra lateral de filtros compartida por todas las páginas.

Las firmas públicas (header, kpi_card, donut, gauge, barras_*, layout,
sidebar_filtros, aplicar, …) se mantienen estables: las páginas heredan el
rediseño sin cambios. Helpers nuevos: `section`, `spacer`, `leyenda_semaforo`.
"""
import numpy as np
import plotly.graph_objects as go
import streamlit as st

from utils import config as cfg
from utils import data_loader as dl

C = cfg.C
FONT = "Inter, 'Segoe UI', system-ui, sans-serif"
PLOTLY_CONF = {"displayModeBar": False, "responsive": True}


def cargar_datos_seguro() -> dict:
    """Carga los datos mostrando cualquier error EN PANTALLA (jamás en silencio)."""
    import traceback
    try:
        data = dl.get_data()
        faltan = []
        for nombre, df, cols in [
            ("ejecucion.xlsx", data["ejecucion"], [cfg.X["MES"], cfg.X["ESPECIALISTA"],
                                                    cfg.X["RUC"], cfg.X["CANTIDAD"]]),
            ("metas.xlsx", data["metas"], [cfg.M["MES"], cfg.M["ESPECIALISTA"],
                                            cfg.M["META"]]),
            ("focalizados.xlsx", data["focalizados"], [cfg.F["RUC"], cfg.F["TIPO"]]),
        ]:
            for c in cols:
                if c not in df.columns:
                    faltan.append(f"{nombre} → falta columna '{c}'")
        if faltan:
            st.error("Estructura de datos incompleta:\n\n- " + "\n- ".join(faltan))
            st.stop()
        return data
    except Exception:
        st.error("❌ No se pudieron cargar los Excel de `/data`. Detalle técnico:")
        st.code(traceback.format_exc())
        st.info("Verifica que los 3 archivos existan y no estén abiertos en Excel. "
                "Si el error menciona openpyxl/numpy, ejecuta:  "
                "`pip install --force-reinstall --no-cache-dir numpy pandas openpyxl python-calamine`")
        st.stop()


# ---------------------------------------------------------------------------
# TEMA PLOTLY
# ---------------------------------------------------------------------------
def layout(fig: go.Figure, title: str = "", h: int = 320, *,
           legend: bool = True) -> go.Figure:
    """Aplica el tema institucional. Título a la izquierda, leyenda a la
    derecha (evita que se superpongan), grilla suave y tipografía Inter."""
    show_legend = legend and len(fig.data) > 1
    fig.update_layout(
        title=dict(text=title, x=0, xanchor="left", xref="paper",
                   y=0.97, yanchor="top",
                   font=dict(family=FONT, size=14.5, color=C["navy"])),
        font=dict(family=FONT, size=12.5, color=C["text"]),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        height=h,
        margin=dict(l=12, r=18, t=58 if title else 26, b=14, pad=6),
        showlegend=show_legend,
        legend=dict(orientation="h", yanchor="bottom", y=1.0,
                    xanchor="right", x=1, font=dict(size=11.5, color=C["muted"]),
                    bgcolor="rgba(0,0,0,0)"),
        colorway=cfg.COLORWAY,
        xaxis=dict(gridcolor=C["grid"], zeroline=False, showline=False,
                   tickfont=dict(size=11.5, color=C["muted"]),
                   title_font=dict(size=12, color=C["muted"])),
        yaxis=dict(gridcolor=C["grid"], zeroline=False, showline=False,
                   tickfont=dict(size=11.5, color=C["muted"]),
                   title_font=dict(size=12, color=C["muted"])),
        hoverlabel=dict(bgcolor="white", bordercolor=C["border"],
                        font=dict(family=FONT, size=12, color=C["text"])),
        bargap=0.22, bargroupgap=0.08,
    )
    return fig


# ---------------------------------------------------------------------------
# CSS + COMPONENTES DE INTERFAZ
# ---------------------------------------------------------------------------
def inject_css():
    css = (cfg.ASSETS_DIR / "style.css").read_text(encoding="utf-8")
    st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)


def header(titulo: str, subtitulo: str = "", icono: str = "🎯",
           badge: str = None, badge_color: str = None):
    """Hero institucional. `badge` muestra una píldora de estado a la derecha."""
    badge_html = ""
    if badge:
        bc = badge_color or C["blue"]
        badge_html = (f'<span class="banner-badge" style="background:{bc}">'
                      f'<span class="dot"></span>{badge}</span>')
    st.markdown(f"""
    <div class="banner">
      <div class="banner-left">
        <div class="banner-ico">{icono}</div>
        <div>
          <div class="banner-t">{titulo}</div>
          <div class="banner-s">{subtitulo}</div>
        </div>
      </div>
      {badge_html}
    </div>""", unsafe_allow_html=True)


def section(titulo: str, sub: str = ""):
    """Encabezado de sección consistente (reemplaza '#### …' + '---')."""
    sub_html = f'<span class="sec-s">{sub}</span>' if sub else ""
    st.markdown(f'<div class="sec"><span class="sec-t">{titulo}</span>{sub_html}</div>',
                unsafe_allow_html=True)


def spacer(px: int = 14):
    st.markdown(f"<div style='height:{px}px'></div>", unsafe_allow_html=True)


def kpi_card(col, titulo: str, valor: str, icono: str = "📊",
             color: str = None, sub: str = "", *, pct: float = None):
    """Tarjeta KPI. `color` codifica el estado (semáforo) en el borde y el icono.
    `pct` dibuja una barra de progreso integrada (0–100)."""
    color = color or C["blue"]
    prog = ""
    if pct is not None:
        p = max(0.0, min(float(pct), 100.0))
        prog = (f'<div class="kpi-bar"><div class="kpi-bar-fill" '
                f'style="width:{p:.0f}%;background:{color}"></div></div>')
    sub_html = f'<div class="kpi-s">{sub}</div>' if sub else ""
    col.markdown(f"""
    <div class="kpi" style="--accent:{color}">
      <div class="kpi-head">
        <span class="kpi-ico" style="background:{color}1A;color:{color}">{icono}</span>
        <span class="kpi-t">{titulo}</span>
      </div>
      <div class="kpi-v">{valor}</div>
      {prog}{sub_html}
    </div>""", unsafe_allow_html=True)


def chip_semaforo(pctv: float) -> str:
    s = cfg.semaforo(pctv)
    return (f'<span class="chip" style="background:{cfg.COLOR_SEMAFORO[s]}">'
            f'{pctv:.0f}%</span>')


def leyenda_semaforo():
    st.markdown(
        f'<div class="legend-semaforo">'
        f'<span><i style="background:{C["green"]}"></i>Cumplido ≥100%</span>'
        f'<span><i style="background:{C["yellow"]}"></i>En riesgo 80–99%</span>'
        f'<span><i style="background:{C["red"]}"></i>Crítico &lt;80%</span>'
        f'<span><i style="background:{C["border"]}"></i>Sin meta programada</span>'
        f'</div>', unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# FILTROS GLOBALES (sidebar)
# ---------------------------------------------------------------------------
def sidebar_filtros(data: dict) -> dict:
    eje, met = data["ejecucion"], data["metas"]
    with st.sidebar:
        logo = cfg.ASSETS_DIR / "logo.png"
        if logo.exists():
            col_l, col_t = st.columns([1, 2])
            col_l.image(str(logo), width=58)
            col_t.markdown("### CITE\n**POI 2026**")
        else:
            st.markdown("### CITE · POI 2026")
        st.markdown("---")
        progs = sorted(set(eje[cfg.X["PROGRAMA"]].dropna()) |
                       set(met[cfg.M["PROGRAMA"]].dropna()))
        meses_n = sorted(set(eje[cfg.X["MES"]].dropna()) |
                         set(met[cfg.M["MES"]].dropna()))
        esps = sorted(set(eje[cfg.X["ESPECIALISTA"]].dropna()) |
                      set(met[cfg.M["ESPECIALISTA"]].dropna()))

        f_prog = st.multiselect("📁 Programa", progs, placeholder="Todos")
        f_mes = st.multiselect("📅 Mes", meses_n, placeholder="Todos",
                               format_func=lambda m: cfg.MESES_ES.get(m, m))
        f_esp = st.multiselect("👤 Especialista", esps, placeholder="Todos")
        st.markdown("---")
        if st.button("↻  Recargar datos", use_container_width=True):
            st.cache_data.clear()
            st.rerun()
        import datetime as _dt
        mt_max = max(dl._mtimes())
        if mt_max:
            sello = _dt.datetime.fromtimestamp(mt_max).strftime("%d/%m/%Y %H:%M")
            st.caption(f"🕓 Datos actualizados: {sello}")
        st.caption("Se recargan al cambiar los Excel en /data.")
    return {"programas": f_prog or None, "meses": f_mes or None,
            "especialistas": f_esp or None}


def aplicar(data: dict, flt: dict) -> tuple:
    eje = dl.filtrar(data["ejecucion"], **flt)
    met = dl.filtrar(data["metas"], **flt)
    return eje, met


def filtrar_clientes(data: dict, flt: dict):
    import pandas as pd
    cli = data.get("clientes", pd.DataFrame())
    if cli.empty:
        return cli
    if flt.get("meses"):
        cli = cli[cli["MES"].isin(flt["meses"])]
    return cli


# ---------------------------------------------------------------------------
# GRÁFICOS
# ---------------------------------------------------------------------------
def barras_meta_ejec(df, x_col: str, title: str, h: int = 320,
                     horizontal: bool = False) -> go.Figure:
    """Meta (claro) vs Ejecutado (sólido). En vertical añade línea de tendencia."""
    fig = go.Figure()
    if df is not None and not df.empty:
        fmt = lambda s: [f"{v:,.0f}" for v in s]
        txt = dict(textfont=dict(size=10.5, color=C["navy"]), cliponaxis=False)
        if horizontal:
            fig.add_bar(y=df[x_col], x=df["Meta"], name="Meta", orientation="h",
                        marker_color=C["blue_light"], marker_line_width=0,
                        text=fmt(df["Meta"]), textposition="outside", **txt)
            fig.add_bar(y=df[x_col], x=df["Ejecutado"], name="Ejecutado",
                        orientation="h", marker_color=C["blue"], marker_line_width=0,
                        text=fmt(df["Ejecutado"]), textposition="outside", **txt)
        else:
            fig.add_bar(x=df[x_col], y=df["Meta"], name="Meta",
                        marker_color=C["blue_light"], marker_line_width=0,
                        text=fmt(df["Meta"]), textposition="outside", **txt)
            fig.add_bar(x=df[x_col], y=df["Ejecutado"], name="Ejecutado",
                        marker_color=C["blue"], marker_line_width=0,
                        text=fmt(df["Ejecutado"]), textposition="outside", **txt)
            fig.add_scatter(x=df[x_col], y=df["Ejecutado"], name="Tendencia",
                            mode="lines", line=dict(color=C["gold"], width=2.5,
                                                    shape="spline"),
                            hoverinfo="skip")
        fig.update_layout(barmode="group", uniformtext_minsize=8,
                          uniformtext_mode="hide")
        fig.update_yaxes(rangemode="tozero")
    return layout(fig, title, h)


def barras_semaforo(df, x_col: str, val_col: str, title: str, h: int = 320,
                    horizontal: bool = True, suffix: str = "%") -> go.Figure:
    """Barras coloreadas por estado (verde/amarillo/rojo). Incluye guía de 100%."""
    fig = go.Figure()
    if df is not None and not df.empty:
        if horizontal:
            d = df.sort_values(val_col)
            colors = [cfg.COLOR_SEMAFORO[cfg.semaforo(v)] for v in d[val_col]]
            fig.add_bar(y=d[x_col], x=d[val_col], orientation="h",
                        marker_color=colors, marker_line_width=0,
                        text=[f"{v:.0f}{suffix}" for v in d[val_col]],
                        textposition="outside", cliponaxis=False,
                        textfont=dict(size=11, color=C["navy"]),
                        hovertemplate="%{y}: %{x:.0f}" + suffix + "<extra></extra>")
            if suffix == "%":
                fig.add_vline(x=100, line=dict(color=C["navy"], width=1.2, dash="dot"),
                              opacity=.45)
        else:
            colors = [cfg.COLOR_SEMAFORO[cfg.semaforo(v)] for v in df[val_col]]
            fig.add_bar(x=df[x_col], y=df[val_col], marker_color=colors,
                        marker_line_width=0,
                        text=[f"{v:.0f}{suffix}" for v in df[val_col]],
                        textposition="outside", cliponaxis=False,
                        textfont=dict(size=11, color=C["navy"]),
                        hovertemplate="%{x}: %{y:.0f}" + suffix + "<extra></extra>")
            if suffix == "%":
                fig.add_hline(y=100, line=dict(color=C["navy"], width=1.2, dash="dot"),
                              opacity=.45)
    return layout(fig, title, h)


def donut(labels, values, title: str, colores=None, h: int = 300,
          centro: str = "") -> go.Figure:
    fig = go.Figure(go.Pie(
        labels=list(labels), values=list(values), hole=0.66,
        marker=dict(colors=colores, line=dict(color="#fff", width=2)) if colores
        else dict(line=dict(color="#fff", width=2)),
        textinfo="percent", textfont=dict(size=12, color="#fff"),
        insidetextorientation="horizontal", sort=False,
        hovertemplate="%{label}: %{value:,.0f}  (%{percent})<extra></extra>"))
    if centro:
        fig.add_annotation(text=centro, x=0.5, y=0.52, showarrow=False,
                           font=dict(size=26, color=C["navy"], family=FONT))
        fig.add_annotation(text="total", x=0.5, y=0.4, showarrow=False,
                           font=dict(size=10.5, color=C["muted"]))
    fig.update_layout(legend=dict(orientation="h", yanchor="top", y=-0.02,
                                  xanchor="center", x=0.5,
                                  font=dict(size=11, color=C["muted"])))
    out = layout(fig, title, h, legend=True)
    out.update_layout(showlegend=True)
    return out


def gauge(pctv: float, title: str = "Cumplimiento", h: int = 260) -> go.Figure:
    estado = cfg.semaforo(pctv)
    color = cfg.COLOR_SEMAFORO[estado]
    top = max(120, pctv + 10)
    fig = go.Figure(go.Indicator(
        mode="gauge+number", value=pctv,
        number={"suffix": " %", "font": {"size": 34, "color": C["navy"], "family": FONT}},
        gauge={
            "axis": {"range": [0, top], "tickwidth": 1, "tickcolor": C["border"],
                     "tickfont": {"size": 10, "color": C["muted"]}},
            "bar": {"color": color, "thickness": 0.32},
            "bgcolor": "rgba(0,0,0,0)", "borderwidth": 0,
            "steps": [
                {"range": [0, cfg.SEMAFORO_AMARILLO], "color": cfg.COLOR_SEMAFORO_SOFT["rojo"]},
                {"range": [cfg.SEMAFORO_AMARILLO, cfg.SEMAFORO_VERDE], "color": cfg.COLOR_SEMAFORO_SOFT["amarillo"]},
                {"range": [cfg.SEMAFORO_VERDE, top], "color": cfg.COLOR_SEMAFORO_SOFT["verde"]}],
            "threshold": {"line": {"color": C["navy"], "width": 3}, "value": 100}}))
    return layout(fig, title, h)


def heatmap_semaforo(piv, title: str, h: int = 360) -> go.Figure:
    """Heatmap tarea × mes con colores discretos del semáforo."""
    fig = go.Figure()
    if piv is None or piv.empty:
        return layout(fig, title, h)
    vals = piv.values.astype(float)
    z = np.full_like(vals, np.nan)
    z[vals < cfg.SEMAFORO_AMARILLO] = 0
    z[(vals >= cfg.SEMAFORO_AMARILLO) & (vals < cfg.SEMAFORO_VERDE)] = 1
    z[vals >= cfg.SEMAFORO_VERDE] = 2
    scale = [[0.0, C["red"]], [0.33, C["red"]],
             [0.34, C["yellow"]], [0.66, C["yellow"]],
             [0.67, C["green"]], [1.0, C["green"]]]
    text = np.where(np.isnan(vals), "",
                    np.vectorize(lambda v: f"{v:.0f}%")(np.nan_to_num(vals)))
    fig.add_heatmap(z=z, x=list(piv.columns), y=list(piv.index),
                    zmin=0, zmax=2, colorscale=scale, showscale=False,
                    text=text, texttemplate="%{text}",
                    textfont=dict(size=11, color="#fff", family=FONT),
                    hovertemplate="%{y}<br>%{x}: %{text}<extra></extra>",
                    xgap=4, ygap=4)
    fig.update_yaxes(autorange="reversed", tickfont=dict(size=11.5, color=C["text"]))
    fig.update_xaxes(side="top", tickfont=dict(size=11.5, color=C["text"]))
    return layout(fig, title, h)


def sunburst(df, path_cols: list, val_col: str, title: str, h: int = 420) -> go.Figure:
    import plotly.express as px
    if df is None or df.empty:
        return layout(go.Figure(), title, h)
    fig = px.sunburst(df, path=path_cols, values=val_col,
                      color_discrete_sequence=[C["blue"], C["gold"], C["green"],
                                               C["blue_light"], C["red"], C["navy"]])
    fig.update_traces(textinfo="label+percent entry",
                      insidetextfont=dict(size=12, family=FONT),
                      marker=dict(line=dict(color="#fff", width=1.5)))
    return layout(fig, title, h)