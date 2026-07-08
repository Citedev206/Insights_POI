"""
app.py — Dashboard Ejecutivo (página principal).

Resumen de una mirada: clientes, metas programadas vs ejecutadas, % de
cumplimiento, complejidad de los servicios y rendimiento del equipo.

Ejecutar:  streamlit run app.py
"""
import faulthandler
import sys

faulthandler.enable(file=sys.stderr)

import streamlit as st

from utils import charts as ch
from utils import config as cfg
from utils import metrics as mt

st.set_page_config(page_title="CITE · POI 2026", page_icon="🎯", layout="wide")
ch.inject_css()

data = ch.cargar_datos_seguro()
flt = ch.sidebar_filtros(data)
eje, met = ch.aplicar(data, flt)
met_cli = ch.filtrar_clientes(data, flt)

# --------------------------- Cálculos -------------------------------------
k   = mt.kpis(eje, met)
kc  = mt.kpis_clientes(eje, met_cli)
cx  = mt.complejidad_resumen(eje)
estado_color = cfg.COLOR_SEMAFORO[cfg.semaforo(k["cumplimiento"])]
estado_txt   = {"verde": "En meta", "amarillo": "En riesgo",
                "rojo": "Bajo lo esperado"}[cfg.semaforo(k["cumplimiento"])]

ch.header("Dashboard Ejecutivo",
          "Seguimiento institucional POI 2026 · Meta vs Ejecución",
          "🎯", badge=f"{estado_txt} · {k['cumplimiento']:.0f}%",
          badge_color=estado_color)

if k["meta"] == 0 and k["ejecutado"] == 0:
    st.warning("No hay datos para los filtros seleccionados.")
    st.stop()

# ----------------------- KPIs ejecutivos (2×4) ----------------------------
ch.section("Indicadores clave", "Estado general de la operación")

r1 = st.columns(4)
ch.kpi_card(r1[0], "Clientes atendidos", f"{kc['ejec_clientes']:,}", "🏢",
            cfg.COLOR_SEMAFORO[cfg.semaforo(kc["pct_clientes"])],
            f"Meta {kc['meta_clientes']:,.0f} · {kc['pct_clientes']:.0f}% cumplido",
            pct=kc["pct_clientes"])
ch.kpi_card(r1[1], "Clientes focalizados", f"{kc['ejec_focalizados']:,}", "📌",
            cfg.COLOR_SEMAFORO[cfg.semaforo(kc["pct_focalizados"])],
            f"Meta {kc['meta_focalizados']:,.0f} · {kc['pct_focalizados']:.0f}% cumplido",
            pct=kc["pct_focalizados"])
ch.kpi_card(r1[2], "Metas programadas", f"{k['meta']:,.0f}", "🎯",
            cfg.C["blue_light"], "Total comprometido en el POI")
ch.kpi_card(r1[3], "Metas ejecutadas", f"{k['ejecutado']:,.0f}", "✅",
            cfg.C["blue"], f"{k['cumplimiento']:.0f}% de lo programado")

r2 = st.columns(4)
ch.kpi_card(r2[0], "Cumplimiento global", f"{k['cumplimiento']:.1f}%", "🚦",
            estado_color, estado_txt, pct=k["cumplimiento"])
ch.kpi_card(r2[1], "Servicios ejecutados", f"{k['actividades']:,}", "🧩",
            cfg.C["navy"], "Actividades registradas")
ch.kpi_card(r2[2], "Especialistas activos", f"{k['especialistas']:,}", "👥",
            cfg.C["gold"], "Responsables con ejecución")
ch.kpi_card(r2[3], "Productividad ponderada", f"{cx['ponderado']:,.0f}", "⚖️",
            cfg.C["green"], "Servicios × peso de complejidad")

# ------------------- Cumplimiento y avance mensual ------------------------
ch.section("Cumplimiento y avance", "Brecha entre lo programado y lo ejecutado")
col_a, col_b = st.columns([2, 5], gap="large")
with col_a:
    st.plotly_chart(ch.gauge(k["cumplimiento"], "Cumplimiento global", h=300),
                    use_container_width=True, config=ch.PLOTLY_CONF)
with col_b:
    tm = mt.tendencia_mensual(eje, met)
    st.plotly_chart(
        ch.barras_meta_ejec(tm, "Mes", "Meta vs Ejecutado por mes", h=300),
        use_container_width=True, config=ch.PLOTLY_CONF)

# ------------------- Complejidad y distribución ---------------------------
ch.section("Complejidad y distribución", "Composición de la ejecución")
col_c, col_d = st.columns(2, gap="large")
with col_c:
    comp_labels = cfg.COMPLEJIDADES
    comp_vals = [cx["conteo"][k_] for k_ in comp_labels]
    st.plotly_chart(
        ch.donut(comp_labels, comp_vals, "Servicios por complejidad",
                 colores=[cfg.COLOR_COMPLEJIDAD[k_] for k_ in comp_labels],
                 centro=f"{cx['total']:,.0f}", h=320),
        use_container_width=True, config=ch.PLOTLY_CONF)
with col_d:
    por_prog = mt.meta_vs_ejec(eje, met, cfg.X["PROGRAMA"], cfg.M["PROGRAMA"],
                               orden=cfg.PROGRAMAS)
    st.plotly_chart(
        ch.donut(por_prog["Dim"], por_prog["Ejecutado"], "Ejecutado por programa",
                 colores=[cfg.COLOR_PROGRAMA.get(p, cfg.C["blue"]) for p in por_prog["Dim"]],
                 centro=f"{int(por_prog['Ejecutado'].sum()):,}", h=320),
        use_container_width=True, config=ch.PLOTLY_CONF)

# --------------------- Rendimiento por responsable ------------------------
ch.section("Rendimiento por responsable", "Ranking de especialistas")
rk = mt.ranking_especialistas(eje, met)
col_e, col_f = st.columns([3, 2], gap="large")
with col_e:
    st.plotly_chart(
        ch.barras_semaforo(rk, "Dim", "Cumplimiento",
                           "% de cumplimiento por especialista",
                           h=max(320, 38 * len(rk) + 90)),
        use_container_width=True, config=ch.PLOTLY_CONF)
    ch.leyenda_semaforo()
with col_f:
    st.plotly_chart(
        ch.barras_meta_ejec(rk.head(8), "Dim", "Meta vs Ejecutado (top 8)",
                            h=max(320, 38 * min(len(rk), 8) + 90),
                            horizontal=True),
        use_container_width=True, config=ch.PLOTLY_CONF)

# --------------------------- Tabla resumen --------------------------------
ch.section("Detalle por especialista")
tabla = rk.rename(columns={"Dim": "Especialista"})
tabla["Cumplimiento %"] = tabla["Cumplimiento"]
st.dataframe(
    tabla[["Especialista", "Meta", "Ejecutado", "Cumplimiento %", "Clientes"]],
    use_container_width=True, hide_index=True,
    column_config={
        "Meta": st.column_config.NumberColumn("Meta", format="%.0f"),
        "Ejecutado": st.column_config.NumberColumn("Ejecutado", format="%.0f"),
        "Cumplimiento %": st.column_config.ProgressColumn(
            "Cumplimiento %", format="%.0f%%", min_value=0, max_value=150),
        "Clientes": st.column_config.NumberColumn("Clientes", format="%d"),
    },
)