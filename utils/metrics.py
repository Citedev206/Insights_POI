"""
utils/metrics.py — Cálculos de negocio: cumplimiento, productividad ponderada,
clientes (nuevos / recurrentes / focalizados), complejidad y matriz del heatmap.
"""
import pandas as pd

from utils import config as cfg

X, M = cfg.X, cfg.M


def pct(meta: float, ejec: float) -> float:
    return round(ejec / meta * 100, 1) if meta else 0.0


# ---------------------------------------------------------------------------
# KPIs globales
# ---------------------------------------------------------------------------
def kpis(eje: pd.DataFrame, met: pd.DataFrame) -> dict:
    meta = float(met[M["META"]].sum())
    ejec = float(eje[X["CANTIDAD"]].sum())
    return {
        "meta": meta,
        "ejecutado": ejec,
        "cumplimiento": pct(meta, ejec),
        "clientes": int(eje[X["RUC"]].nunique()),
        "focalizados": int(eje.loc[eje["ES_FOCALIZADO"], X["RUC"]].nunique()),
        "especialistas": int(eje[X["ESPECIALISTA"]].nunique()),
        "actividades": int(len(eje)),
    }


# ---------------------------------------------------------------------------
# META vs EJECUCIÓN por una dimensión (o por mes)
# ---------------------------------------------------------------------------
def meta_vs_ejec(eje: pd.DataFrame, met: pd.DataFrame, dim_x: str, dim_m: str,
                 orden=None) -> pd.DataFrame:
    m = met.groupby(dim_m)[M["META"]].sum() if not met.empty else pd.Series(dtype=float)
    e = eje.groupby(dim_x)[X["CANTIDAD"]].sum() if not eje.empty else pd.Series(dtype=float)
    df = pd.DataFrame({"Meta": m, "Ejecutado": e}).fillna(0)
    df.index.name = "Dim"
    df = df.reset_index()
    df["Cumplimiento"] = df.apply(lambda r: pct(r["Meta"], r["Ejecutado"]), axis=1)
    df["Semaforo"] = df["Cumplimiento"].map(cfg.semaforo)
    if orden:
        df["__o"] = df["Dim"].map({v: i for i, v in enumerate(orden)})
        df = df.sort_values("__o").drop(columns="__o")
    return df


def tendencia_mensual(eje, met) -> pd.DataFrame:
    df = meta_vs_ejec(eje, met, X["MES"], M["MES"], orden=list(range(1, 13)))
    df["Mes"] = df["Dim"].map(cfg.MESES_ES)
    return df


def ranking_especialistas(eje, met) -> pd.DataFrame:
    df = meta_vs_ejec(eje, met, X["ESPECIALISTA"], M["ESPECIALISTA"])
    cli = eje.groupby(X["ESPECIALISTA"])[X["RUC"]].nunique()
    df = df.merge(cli.rename("Clientes"), left_on="Dim", right_index=True, how="left")
    return df.fillna(0).sort_values("Ejecutado", ascending=False).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Complejidad de los servicios (conteo + productividad ponderada)
# ---------------------------------------------------------------------------
def complejidad_resumen(eje: pd.DataFrame) -> dict:
    """Distribución de servicios ejecutados por complejidad y productividad
    ponderada (Alta×3, Media×2, Baja×1)."""
    conteo = {k: 0.0 for k in cfg.COMPLEJIDADES}
    if eje is not None and not eje.empty:
        g = eje.groupby(eje[X["COMPLEJIDAD"]])[X["CANTIDAD"]].sum()
        for k in cfg.COMPLEJIDADES:
            conteo[k] = float(g.get(k, 0.0))
    total = sum(conteo.values())
    ponderado = sum(conteo[k] * cfg.PESOS_COMPLEJIDAD.get(k, 1) for k in conteo)
    return {"conteo": conteo, "total": total, "ponderado": round(ponderado, 0)}


# ---------------------------------------------------------------------------
# HEATMAP: filas = TIPO_TAREA, columnas = MES, valores = % cumplimiento
# ---------------------------------------------------------------------------
def heatmap_cumplimiento(eje: pd.DataFrame, met: pd.DataFrame) -> pd.DataFrame:
    m = met.groupby([M["TAREA"], M["MES"]])[M["META"]].sum()
    e = eje.groupby([X["TAREA"], X["MES"]])[X["CANTIDAD"]].sum()
    df = pd.DataFrame({"Meta": m, "Ejec": e}).fillna(0).reset_index()
    df.columns = ["Tarea", "Mes", "Meta", "Ejec"]
    df = df[df["Meta"] > 0]
    df["Pct"] = (df["Ejec"] / df["Meta"] * 100).round(1)
    total_meta = df.groupby("Tarea")["Meta"].sum()
    piv = df.pivot_table(index="Tarea", columns="Mes", values="Pct")
    piv = piv.reindex(sorted(piv.columns), axis=1)
    piv.columns = [cfg.MESES_ES.get(c, c) for c in piv.columns]
    piv.index = [f"{t} ({total_meta[t]:,.0f})" for t in piv.index]
    return piv


# ---------------------------------------------------------------------------
# Clientes
# ---------------------------------------------------------------------------
def clientes_resumen(eje: pd.DataFrame, bd: pd.DataFrame = None) -> dict:
    """
    Clasifica los clientes 2026 usando bd.xlsx como histórico:
    - nuevos        : nunca atendidos antes del 2026 + complejidad Media/Alta en 2026
    - reenganchados : en bd pero sin servicio en los últimos 3 años + Media/Alta en 2026
    """
    agg_kwargs = dict(
        Razon=(X["RAZON"], "first"),
        Meses=(X["MES"], "nunique"),
        Servicios=(X["CANTIDAD"], "sum"),
        Focalizado=("ES_FOCALIZADO", "max"),
        TipoFoc=("TIPO_FOCALIZADO", "first"),
    )
    # Nombres de los meses en que se atendió al cliente (Enero, Marzo, ...)
    agg_kwargs["MesesNombres"] = (X["MES"], lambda s: ", ".join(
        cfg.MESES_ES.get(int(m), str(m)) for m in sorted({int(x) for x in s.dropna()})))
    # Tema abordado: junta los temas únicos del cliente (sin repetir, en orden)
    col_tema = X.get("TEMA", "TEMA_ABORDADO")   # usa el de config si existe, si no el literal
    if col_tema in eje.columns:
        agg_kwargs["Tema"] = (col_tema, lambda s: "; ".join(
            dict.fromkeys(s.dropna().astype(str).str.strip())))

    por_ruc = eje.groupby(X["RUC"]).agg(**agg_kwargs).reset_index()

    media_alta = eje[eje[X["COMPLEJIDAD"]].isin(["Media", "Alta"])]
    rucs_media_alta = set(media_alta[X["RUC"]].astype(str))

    if bd is not None and not bd.empty:
        ANIO_LIMITE = cfg.ANIO_ACTUAL - cfg.ANIOS_SIN_SERVICIO  # 2023
        rucs_historicos  = set(bd["RUC"].astype(str))
        rucs_recientes   = set(bd.loc[bd["ANIO"] >= ANIO_LIMITE, "RUC"].astype(str))
        rucs_nuevos        = rucs_media_alta - rucs_historicos
        rucs_reenganchados = (rucs_media_alta & rucs_historicos) - rucs_recientes
        nuevos        = len(rucs_nuevos)
        reenganchados = len(rucs_reenganchados)
    else:
        nuevos        = int((por_ruc["Meses"] == 1).sum())
        reenganchados = 0
        rucs_nuevos        = set()
        rucs_reenganchados = set()

    rucs_str = por_ruc[X["RUC"]].astype(str)
    por_ruc["Tipo_cliente"] = "Recurrente"
    por_ruc.loc[rucs_str.isin(rucs_nuevos),        "Tipo_cliente"] = "Nuevo"
    por_ruc.loc[rucs_str.isin(rucs_reenganchados),  "Tipo_cliente"] = "Reenganchado"

    focalizados = int(por_ruc["Focalizado"].sum())
    return {
        "tabla": por_ruc,
        "total": len(por_ruc),
        "nuevos": nuevos,
        "reenganchados": reenganchados,
        "focalizados": focalizados,
        "no_focalizados": len(por_ruc) - focalizados,
    }


def clientes_nuevos_por_mes(eje: pd.DataFrame) -> pd.DataFrame:
    primer = eje.groupby(X["RUC"])[X["MES"]].min().reset_index()
    nuevos = primer.groupby(X["MES"])[X["RUC"]].nunique().rename("Nuevos")
    activos = eje.groupby(X["MES"])[X["RUC"]].nunique().rename("Activos")
    df = pd.DataFrame({"Nuevos": nuevos, "Activos": activos}).fillna(0).reset_index()
    df["Recurrentes"] = df["Activos"] - df["Nuevos"]
    df["Mes"] = df[X["MES"]].map(cfg.MESES_ES)
    return df


# ---------------------------------------------------------------------------
# KPIs de clientes (vs metas de clientes.xlsx)
# ---------------------------------------------------------------------------
def kpis_clientes(eje: pd.DataFrame, met_cli: pd.DataFrame) -> dict:
    meta_foc  = float(met_cli.loc[met_cli["TIPO"] == "FOCALIZADO",    "META"].sum())
    meta_nofoc = float(met_cli.loc[met_cli["TIPO"] == "NO FOCALIZADO", "META"].sum())
    meta_total = meta_foc + meta_nofoc

    ejec_foc   = int(eje.loc[eje["ES_FOCALIZADO"], X["RUC"]].nunique())
    ejec_total = int(eje[X["RUC"]].nunique())

    return {
        "meta_clientes":    meta_total,
        "ejec_clientes":    ejec_total,
        "pct_clientes":     pct(meta_total, ejec_total),
        "meta_focalizados": meta_foc,
        "ejec_focalizados": ejec_foc,
        "pct_focalizados":  pct(meta_foc, ejec_foc),
    }


def clientes_meta_por_mes(met_cli: pd.DataFrame) -> pd.DataFrame:
    if met_cli.empty:
        return pd.DataFrame()
    piv = met_cli.pivot_table(index="MES", columns="TIPO", values="META",
                              aggfunc="sum").fillna(0).reset_index()
    piv.columns.name = None
    if "FOCALIZADO" not in piv.columns:
        piv["FOCALIZADO"] = 0
    if "NO FOCALIZADO" not in piv.columns:
        piv["NO FOCALIZADO"] = 0
    piv["META_TOTAL"] = piv["FOCALIZADO"] + piv["NO FOCALIZADO"]
    piv["Mes"] = piv["MES"].map(cfg.MESES_ES)
    return piv


# ---------------------------------------------------------------------------
# Jerarquía PROGRAMA → SERVICIO → TAREA (sunburst / treemap)
# ---------------------------------------------------------------------------
def jerarquia_servicios(eje: pd.DataFrame) -> pd.DataFrame:
    return (eje.groupby([X["PROGRAMA"], X["SERVICIO"], X["TAREA"]])[X["CANTIDAD"]]
            .sum().reset_index())