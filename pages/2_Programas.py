"""
pages/2_Programas.py — Dashboard por programa presupuestal:
PP093-Focalizado · PP093-No Focalizado · APNOP.
"""
import plotly.graph_objects as go
import streamlit as st

from utils import charts as ch
from utils import config as cfg
from utils import metrics as mt

st.set_page_config(page_title="Programas · POI", page_icon="📁", layout="wide")
ch.inject_css()

data = ch.cargar_datos_seguro()
flt = ch.sidebar_filtros(data)
eje, met = ch.aplicar(data, flt)

ch.header("Dashboard por Programa",
          "PP093-Focalizado · PP093-No Focalizado · APNOP", "📁")

por_prog = mt.meta_vs_ejec(eje, met, cfg.X["PROGRAMA"], cfg.M["PROGRAMA"],
                           orden=cfg.PROGRAMAS)

# ------------------- KPI por programa -------------------------------------
ch.section("Cumplimiento por programa", "Ejecutado / Meta")
cols = st.columns(max(len(por_prog), 1))
for col, (_, r) in zip(cols, por_prog.iterrows()):
    ch.kpi_card(col, r["Dim"], f"{r['Ejecutado']:,.0f} / {r['Meta']:,.0f}",
                "📁", cfg.COLOR_SEMAFORO[cfg.semaforo(r["Cumplimiento"])],
                f"{r['Cumplimiento']:.0f}% de cumplimiento",
                pct=r["Cumplimiento"])

# ------------------- Comparativos -----------------------------------------
ch.section("Meta vs Ejecución")
col_a, col_b = st.columns([3, 2], gap="large")
with col_a:
    st.plotly_chart(ch.barras_meta_ejec(por_prog, "Dim", "Meta vs Ejecutado", h=330),
                    use_container_width=True, config=ch.PLOTLY_CONF)
with col_b:
    st.plotly_chart(
        ch.barras_semaforo(por_prog, "Dim", "Cumplimiento",
                           "% Cumplimiento", horizontal=False, h=330),
        use_container_width=True, config=ch.PLOTLY_CONF)
ch.leyenda_semaforo()

# ------------------- Evolución mensual por programa -----------------------
ch.section("Ejecución mensual por programa")
fig = go.Figure()
for prog in cfg.PROGRAMAS:
    sub_e = eje[eje[cfg.X["PROGRAMA"]] == prog]
    if sub_e.empty:
        continue
    serie = sub_e.groupby(cfg.X["MES"])[cfg.X["CANTIDAD"]].sum().sort_index()
    fig.add_scatter(x=[cfg.MESES_ES.get(m, m) for m in serie.index], y=serie.values,
                    name=prog, mode="lines+markers",
                    line=dict(width=3, shape="spline",
                              color=cfg.COLOR_PROGRAMA.get(prog)),
                    marker=dict(size=7))
st.plotly_chart(ch.layout(fig, "", 330),
                use_container_width=True, config=ch.PLOTLY_CONF)

# ------------------- Focalización dentro de PP093 -------------------------
ch.section("Atención a empresas focalizadas")
col_c, col_d = st.columns(2, gap="large")
with col_c:
    foc_counts = eje.groupby("ES_FOCALIZADO")[cfg.X["RUC"]].nunique()
    st.plotly_chart(
        ch.donut(["Focalizadas" if i else "No focalizadas" for i in foc_counts.index],
                 foc_counts.values, "Empresas atendidas",
                 colores=[cfg.C["green"] if i else cfg.C["blue_light"]
                          for i in foc_counts.index],
                 centro=f"{int(foc_counts.sum()):,}", h=320),
        use_container_width=True, config=ch.PLOTLY_CONF)
with col_d:
    met_cli = ch.filtrar_clientes(data, flt)
    meta_foc = (float(met_cli.loc[met_cli["TIPO"] == "FOCALIZADO", "META"].sum())
                if not met_cli.empty else 0.0)
    ejec_foc = int(eje.loc[eje["ES_FOCALIZADO"], cfg.X["RUC"]].nunique())
    pct_foc = mt.pct(meta_foc, ejec_foc)
    st.plotly_chart(ch.gauge(pct_foc, f"Focalizados: {ejec_foc}/{meta_foc:.0f}", h=320),
                    use_container_width=True, config=ch.PLOTLY_CONF)