"""
pages/1_Especialistas.py — Dashboard por especialista.
Cumplimiento · clientes atendidos · HEATMAP (tarea × mes, % cumplimiento).
"""
import streamlit as st

import io
import pandas as pd

from utils import charts as ch
from utils import config as cfg
from utils import metrics as mt

st.set_page_config(page_title="Especialistas · POI", page_icon="👤", layout="wide")
ch.inject_css()

data = ch.cargar_datos_seguro()
flt = ch.sidebar_filtros(data)
eje_g, met_g = ch.aplicar(data, flt)

ch.header("Dashboard por Especialista",
          "Cumplimiento individual · clientes · tareas por mes", "👤")

todos = sorted(set(eje_g[cfg.X["ESPECIALISTA"]].dropna()) |
               set(met_g[cfg.M["ESPECIALISTA"]].dropna()))
if not todos:
    st.warning("No hay datos con los filtros actuales.")
    st.stop()
esp = st.selectbox("Especialista", todos)

eje = eje_g[eje_g[cfg.X["ESPECIALISTA"]] == esp]
met = met_g[met_g[cfg.M["ESPECIALISTA"]] == esp]

# ------------------------------- KPIs -------------------------------------
k = mt.kpis(eje, met)
cx = mt.complejidad_resumen(eje)
ch.section("Resumen del especialista", esp)
c1, c2, c3, c4 = st.columns(4)
ch.kpi_card(c1, "Meta", f"{k['meta']:,.0f}", "🎯", cfg.C["blue_light"],
            "Total programado")
ch.kpi_card(c2, "Ejecutado", f"{k['ejecutado']:,.0f}", "✅", cfg.C["blue"],
            f"{k['actividades']:,} actividades")
ch.kpi_card(c3, "Cumplimiento", f"{k['cumplimiento']:.1f}%", "🚦",
            cfg.COLOR_SEMAFORO[cfg.semaforo(k["cumplimiento"])],
            "Avance vs meta", pct=k["cumplimiento"])
ch.kpi_card(c4, "Clientes atendidos", f"{k['clientes']:,}", "🏢", cfg.C["gold"],
            f"{k['focalizados']} focalizados · prod. {cx['ponderado']:,.0f}")

# ----------------- HEATMAP tarea × mes ------------------------------------
ch.section("Cumplimiento por tarea y mes", "Semáforo de avance")
piv = mt.heatmap_cumplimiento(eje, met)
st.plotly_chart(
    ch.heatmap_semaforo(piv, "", h=max(280, 56 + 40 * len(piv))),
    use_container_width=True, config=ch.PLOTLY_CONF)
ch.leyenda_semaforo()

# ---------------- Evolución mensual ---------------------------------------
ch.section("Evolución mensual", "Meta vs Ejecutado")
tm = mt.tendencia_mensual(eje, met)
st.plotly_chart(ch.barras_meta_ejec(tm, "Mes", "", h=320),
                use_container_width=True, config=ch.PLOTLY_CONF)

# ---------------- Meta vs Ejecución por programa y complejidad ------------
ch.section("Metas por programa y complejidad")
col_p, col_x = st.columns(2, gap="large")
with col_p:
    por_prog = mt.meta_vs_ejec(eje, met, cfg.X["PROGRAMA"], cfg.M["PROGRAMA"],
                               orden=cfg.PROGRAMAS)
    st.plotly_chart(
        ch.barras_meta_ejec(por_prog, "Dim", "Por programa",
                            h=max(300, 60 * len(por_prog) + 110)),
        use_container_width=True, config=ch.PLOTLY_CONF)
with col_x:
    por_comp = mt.meta_vs_ejec(eje, met, cfg.X["COMPLEJIDAD"], cfg.M["COMPLEJIDAD"],
                               orden=cfg.COMPLEJIDADES)
    st.plotly_chart(
        ch.barras_meta_ejec(por_comp, "Dim", "Por complejidad",
                            h=max(300, 60 * len(por_comp) + 110)),
        use_container_width=True, config=ch.PLOTLY_CONF)

# ---------------- Clientes del especialista -------------------------------
ch.section("Clientes atendidos")
cl = mt.clientes_resumen(eje)

# quita "Tipo focalizado" y el conteo numérico de meses
tabla = cl["tabla"].drop(columns=["TipoFoc", "Meses"], errors="ignore")
tabla = tabla.rename(columns={
    cfg.X["RUC"]: "RUC",
    "Razon": "Razón social",
    "MesesNombres": "Meses",
    "Tema": "Tema abordado",
})
tabla["Focalizado"] = tabla["Focalizado"].map({True: "Sí", False: "No"})
tabla = tabla.sort_values("Servicios", ascending=False)

st.dataframe(tabla, use_container_width=True, hide_index=True)

# ---- Descarga en Excel (.xlsx) ----
buf = io.BytesIO()
with pd.ExcelWriter(buf, engine="openpyxl") as writer:
    tabla.to_excel(writer, index=False, sheet_name="Clientes")
st.download_button(
    "⬇️ Descargar en Excel",
    data=buf.getvalue(),
    file_name=f"clientes_{esp}.xlsx",
    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
)