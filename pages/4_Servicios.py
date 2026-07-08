"""
pages/4_Servicios.py — Dashboard de servicios.
Jerarquía PROGRAMA → TIPO_SERVICIO → TIPO_TAREA (sunburst + treemap) y
cumplimiento por servicio y por tarea.
"""
import plotly.express as px
import streamlit as st

from utils import charts as ch
from utils import config as cfg
from utils import metrics as mt

st.set_page_config(page_title="Servicios · POI", page_icon="🧩", layout="wide")
ch.inject_css()

data = ch.cargar_datos_seguro()
flt = ch.sidebar_filtros(data)
eje, met = ch.aplicar(data, flt)

ch.header("Dashboard de Servicios",
          "Jerarquía: PROGRAMA → TIPO_SERVICIO → TIPO_TAREA", "🧩")

# ─── Drill-down jerárquico ───────────────────────────────────────────────────
ch.section("Estructura de la ejecución", "Clic en el sunburst para navegar")
jer = mt.jerarquia_servicios(eje)
col_a, col_b = st.columns(2, gap="large")
with col_a:
    st.plotly_chart(
        ch.sunburst(jer,
                    [cfg.X["PROGRAMA"], cfg.X["SERVICIO"], cfg.X["TAREA"]],
                    cfg.X["CANTIDAD"], "Programa › Servicio › Tarea", h=430),
        use_container_width=True, config=ch.PLOTLY_CONF)
with col_b:
    if not jer.empty:
        fig_tm = px.treemap(
            jer, path=[cfg.X["PROGRAMA"], cfg.X["SERVICIO"]],
            values=cfg.X["CANTIDAD"],
            color_discrete_sequence=[cfg.C["blue"], cfg.C["gold"], cfg.C["green"],
                                     cfg.C["blue_light"], cfg.C["navy"]])
        fig_tm.update_traces(textinfo="label+value+percent root",
                             marker=dict(line=dict(color="#fff", width=1.5)),
                             textfont=dict(size=12, family=ch.FONT))
        st.plotly_chart(
            ch.layout(fig_tm, "Participación por programa y servicio", 430),
            use_container_width=True, config=ch.PLOTLY_CONF)

# ─── Cumplimiento por servicio y tarea ──────────────────────────────────────
ch.section("Cumplimiento por servicio y por tarea")
por_serv = mt.meta_vs_ejec(eje, met, cfg.X["SERVICIO"], cfg.M["SERVICIO"])
por_tarea = mt.meta_vs_ejec(eje, met, cfg.X["TAREA"], cfg.M["TAREA"])
H_SERV = min(max(300, 40 * len(por_serv) + 90), 540)
H_TAREA = min(max(300, 32 * len(por_tarea) + 90), 600)

col_c, col_d = st.columns(2, gap="large")
with col_c:
    st.plotly_chart(
        ch.barras_semaforo(por_serv, "Dim", "Cumplimiento",
                           "% por tipo de servicio", h=H_SERV),
        use_container_width=True, config=ch.PLOTLY_CONF)
with col_d:
    st.plotly_chart(
        ch.barras_semaforo(por_tarea, "Dim", "Cumplimiento",
                           "% por tipo de tarea", h=H_TAREA),
        use_container_width=True, config=ch.PLOTLY_CONF)
ch.leyenda_semaforo()

# ─── Meta vs Ejecutado por servicio ──────────────────────────────────────────
ch.section("Meta vs Ejecutado por servicio")
H_META = min(max(340, 44 * len(por_serv) + 110), 560)
st.plotly_chart(
    ch.barras_meta_ejec(por_serv, "Dim", "", h=H_META, horizontal=True),
    use_container_width=True, config=ch.PLOTLY_CONF)