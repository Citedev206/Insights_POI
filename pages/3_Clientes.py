"""
pages/3_Clientes.py — Dashboard de clientes (por RUC).

  - Nuevo        : sin atención previa + media/alta complejidad en 2026.
  - Reenganchado : atendido antes pero sin servicio en los últimos 3 años
                   (2023-2025) + media/alta complejidad en 2026.
  - Recurrente   : el resto de clientes atendidos en 2026.
"""
import plotly.graph_objects as go
import streamlit as st

from utils import charts as ch
from utils import config as cfg
from utils import metrics as mt

st.set_page_config(page_title="Clientes · POI", page_icon="🏢", layout="wide")
ch.inject_css()

data = ch.cargar_datos_seguro()
flt  = ch.sidebar_filtros(data)
eje, _met = ch.aplicar(data, flt)
met_cli   = ch.filtrar_clientes(data, flt)
bd        = data.get("bd", None)

ch.header("Dashboard de Clientes",
          "Nuevos · Reenganchados · Focalizados · Meta vs Ejecución", "🏢")

cl = mt.clientes_resumen(eje, bd)
kc = mt.kpis_clientes(eje, met_cli)

# ─── KPIs ──────────────────────────────────────────────────────────────────
ch.section("Indicadores de clientes")
c1, c2, c3, c4 = st.columns(4)
ch.kpi_card(c1, "Clientes atendidos", f"{cl['total']:,}", "🏢",
            cfg.COLOR_SEMAFORO[cfg.semaforo(kc["pct_clientes"])],
            f"Meta {kc['meta_clientes']:,.0f} · {kc['pct_clientes']:.0f}% cumplido",
            pct=kc["pct_clientes"])
ch.kpi_card(c2, "Focalizados atendidos", f"{kc['ejec_focalizados']:,}", "📌",
            cfg.COLOR_SEMAFORO[cfg.semaforo(kc["pct_focalizados"])],
            f"Meta {kc['meta_focalizados']:,.0f} · {kc['pct_focalizados']:.0f}% cumplido",
            pct=kc["pct_focalizados"])
ch.kpi_card(c3, "Clientes nuevos", f"{cl['nuevos']:,}", "✨", cfg.C["green"],
            "Sin historial · media/alta complejidad")
ch.kpi_card(c4, "Reenganchados", f"{cl['reenganchados']:,}", "🔁", cfg.C["gold"],
            "Sin servicio 2023-2025 · media/alta")

# ─── Composición ────────────────────────────────────────────────────────────
ch.section("Composición de la cartera")
col_a, col_b = st.columns(2, gap="large")
with col_a:
    total_tipo = cl["nuevos"] + cl["reenganchados"]
    resto = max(cl["total"] - total_tipo, 0)
    st.plotly_chart(
        ch.donut(["Nuevos", "Reenganchados", "Recurrentes"],
                 [cl["nuevos"], cl["reenganchados"], resto],
                 "Tipo de cliente 2026",
                 colores=[cfg.C["green"], cfg.C["gold"], cfg.C["blue_light"]],
                 centro=f"{cl['total']:,}", h=310),
        use_container_width=True, config=ch.PLOTLY_CONF)
with col_b:
    st.plotly_chart(
        ch.donut(["Focalizados", "No focalizados"],
                 [cl["focalizados"], cl["no_focalizados"]],
                 "Focalizados vs no focalizados",
                 colores=[cfg.C["navy"], cfg.C["blue_light"]],
                 centro=f"{cl['total']:,}", h=310),
        use_container_width=True, config=ch.PLOTLY_CONF)

# ─── Meta vs Ejecución por mes ───────────────────────────────────────────────
ch.section("Meta vs clientes atendidos por mes")
meta_mes  = mt.clientes_meta_por_mes(met_cli)
activos_m = mt.clientes_nuevos_por_mes(eje)

fig_mv = go.Figure()
if not activos_m.empty:
    fig_mv.add_bar(x=activos_m["Mes"], y=activos_m["Activos"],
                   name="Atendidos", marker_color=cfg.C["blue"], marker_line_width=0,
                   text=[f"{v:,.0f}" for v in activos_m["Activos"]],
                   textposition="outside", cliponaxis=False,
                   textfont=dict(size=10.5, color=cfg.C["navy"]))
if not meta_mes.empty:
    fig_mv.add_scatter(x=meta_mes["Mes"], y=meta_mes["META_TOTAL"],
                       mode="lines+markers", name="Meta clientes",
                       line=dict(color=cfg.C["gold"], width=2.5, dash="dot"),
                       marker=dict(size=7))
st.plotly_chart(ch.layout(fig_mv, "", 320),
                use_container_width=True, config=ch.PLOTLY_CONF)

# ─── Nuevos + Recurrentes por mes ────────────────────────────────────────────
ch.section("Clientes por mes", "Nuevos vs recurrentes · meta focalizados")
nm = activos_m
fig_nm = go.Figure()
if not nm.empty:
    fig_nm.add_bar(x=nm["Mes"], y=nm["Nuevos"], name="Nuevos",
                   marker_color=cfg.C["green"], marker_line_width=0)
    fig_nm.add_bar(x=nm["Mes"], y=nm["Recurrentes"], name="Recurrentes/Reenganchados",
                   marker_color=cfg.C["blue_light"], marker_line_width=0)
    fig_nm.update_layout(barmode="stack")
if not meta_mes.empty:
    fig_nm.add_scatter(x=meta_mes["Mes"], y=meta_mes["FOCALIZADO"],
                       mode="lines+markers", name="Meta focalizados",
                       line=dict(color=cfg.C["navy"], width=2.5, dash="dot"),
                       marker=dict(size=6))
st.plotly_chart(ch.layout(fig_nm, "", 300),
                use_container_width=True, config=ch.PLOTLY_CONF)

# ─── Ranking de empresas ─────────────────────────────────────────────────────
ch.section("Ranking de empresas", "Top 15 por servicios recibidos · azul oscuro = focalizada")
rk = cl["tabla"].sort_values("Servicios", ascending=False).head(15)
rk = rk.rename(columns={"Razon": "Empresa"})
figr = go.Figure()
d = rk.sort_values("Servicios")
figr.add_bar(y=d["Empresa"], x=d["Servicios"], orientation="h",
             marker_color=[cfg.C["navy"] if f else cfg.C["blue_light"]
                           for f in d["Focalizado"]], marker_line_width=0,
             text=d["Servicios"], textposition="outside", cliponaxis=False,
             textfont=dict(size=10.5, color=cfg.C["navy"]))
st.plotly_chart(ch.layout(figr, "", h=max(320, 30 * len(d) + 80)),
                use_container_width=True, config=ch.PLOTLY_CONF)

# ─── Padrón ──────────────────────────────────────────────────────────────────
ch.section("Padrón de clientes atendidos")
tabla = cl["tabla"].rename(columns={
    cfg.X["RUC"]: "RUC", "Razon": "Razón social",
    "Tipo_cliente": "Clasificación"})
tabla["Focalizado"] = tabla["Focalizado"].map({True: "Sí", False: "No"})
cols = ["RUC", "Razón social", "Clasificación", "Focalizado",
        "Meses", "Servicios"]
cols_exist = [c for c in cols if c in tabla.columns]
st.dataframe(tabla[cols_exist].sort_values("Servicios", ascending=False),
             use_container_width=True, hide_index=True)