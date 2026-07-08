"""
utils/data_loader.py
====================
Carga de los 3 Excel con caché por fecha de modificación.
(Sin cambios respecto a la versión original — la lógica de datos se conserva.)
"""
import faulthandler
import sys

faulthandler.enable(file=sys.stderr)

import datetime as _dt

import pandas as pd
import streamlit as st

from utils import config as cfg

X, M, F = cfg.X, cfg.M, cfg.F


def _read_excel(path) -> pd.DataFrame:
    last_err = None
    for engine in ("calamine", "openpyxl"):
        try:
            return pd.read_excel(path, engine=engine)
        except ImportError:
            continue
        except Exception as e:
            last_err = e
    raise (last_err or RuntimeError(f"Sin motor de Excel para {path}"))


def _norm_headers(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [str(c).strip().upper() for c in df.columns]
    return df


def _norm_complejidad(v) -> str:
    s = str(v).strip().lower()
    if "alta" in s:  return "Alta"
    if "media" in s: return "Media"
    if "baja"  in s: return "Baja"
    return "Media"


_FMTS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y",
         "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S")


def _parse_fecha_safe(v) -> "_dt.date | None":
    if pd.isna(v):
        return None
    if isinstance(v, (_dt.datetime, _dt.date)):
        return v if isinstance(v, _dt.date) else v.date()
    s = str(v).strip()
    for fmt in _FMTS:
        try:
            return _dt.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _fechas_a_columnas(df: pd.DataFrame, col_fecha: str,
                        col_anio: str, col_mes: str):
    fechas = df[col_fecha].map(_parse_fecha_safe)
    mask = fechas.notna()
    df.loc[mask, col_anio]   = fechas[mask].map(lambda d: d.year)
    df.loc[mask, col_mes]    = fechas[mask].map(lambda d: d.month)
    df[col_fecha] = fechas.map(lambda d: d.strftime("%Y-%m-%d") if d else None)


def _mtimes() -> tuple:
    out = []
    for f in (cfg.FILE_EJECUCION, cfg.FILE_METAS, cfg.FILE_FOCALIZADOS,
              cfg.FILE_CLIENTES, cfg.FILE_BD):
        out.append(f.stat().st_mtime if f.exists() else 0)
    return tuple(out)


@st.cache_data(show_spinner="Cargando datos…")
def load_all(_mtime_key: tuple) -> dict:
    foc = _norm_headers(_read_excel(cfg.FILE_FOCALIZADOS))
    foc[F["RUC"]]  = foc[F["RUC"]].astype(str).str.replace(r"\.0$", "", regex=True).str.strip()
    foc[F["TIPO"]] = foc[F["TIPO"]].astype(str).str.strip().str.upper()
    foc = foc.drop_duplicates(F["RUC"])

    eje = _norm_headers(_read_excel(cfg.FILE_EJECUCION))
    eje[X["RUC"]]      = eje[X["RUC"]].astype(str).str.replace(r"\.0$", "", regex=True).str.strip()
    eje[X["CANTIDAD"]] = pd.to_numeric(eje[X["CANTIDAD"]], errors="coerce").fillna(0)
    eje[X["COMPLEJIDAD"]] = eje[X["COMPLEJIDAD"]].map(_norm_complejidad)

    if X["FECHA"] in eje.columns:
        _fechas_a_columnas(eje, X["FECHA"], X["ANIO"], X["MES"])

    eje[X["MES"]]  = pd.to_numeric(eje[X["MES"]],  errors="coerce").fillna(0).astype(int)
    eje[X["ANIO"]] = pd.to_numeric(eje[X["ANIO"]], errors="coerce").fillna(0).astype(int)

    eje = eje.merge(
        foc[[F["RUC"], F["TIPO"]]].rename(columns={F["TIPO"]: "TIPO_FOCALIZADO"}),
        left_on=X["RUC"], right_on=F["RUC"], how="left", suffixes=("", "_f"))
    eje["ES_FOCALIZADO"] = eje["TIPO_FOCALIZADO"].notna()
    eje["MES_LABEL"]     = eje[X["MES"]].map(cfg.MESES_ES)

    primer_mes         = eje.groupby(X["RUC"])[X["MES"]].transform("min")
    eje["ES_NUEVO_EN_MES"] = eje[X["MES"]] == primer_mes
    meses_por_ruc      = eje.groupby(X["RUC"])[X["MES"]].transform("nunique")
    eje["ES_RECURRENTE"] = meses_por_ruc > 1

    met = _norm_headers(_read_excel(cfg.FILE_METAS))
    met[M["META"]]     = pd.to_numeric(met[M["META"]],     errors="coerce").fillna(0)
    met[M["META_FOC"]] = pd.to_numeric(met.get(M["META_FOC"], 0), errors="coerce").fillna(0)
    met[M["MES"]]      = pd.to_numeric(met[M["MES"]],      errors="coerce").fillna(0).astype(int)
    met["MES_LABEL"]   = met[M["MES"]].map(cfg.MESES_ES)
    if M["COMPLEJIDAD"] in met.columns:
        met[M["COMPLEJIDAD"]] = met[M["COMPLEJIDAD"]].map(_norm_complejidad)

    if cfg.FILE_CLIENTES.exists():
        cli = _norm_headers(_read_excel(cfg.FILE_CLIENTES))
        cli["MES"]  = pd.to_numeric(cli.get("MES", 0), errors="coerce").fillna(0).astype(int)
        cli["META"] = pd.to_numeric(cli.get("META", 0), errors="coerce").fillna(0)
        cli["TIPO"] = cli["TIPO"].astype(str).str.strip().str.upper()
    else:
        cli = pd.DataFrame(columns=["MES", "TIPO", "META"])

    if cfg.FILE_BD.exists():
        bd = _read_excel(cfg.FILE_BD)
        bd.columns = ["ANIO", "RUC", "RAZON_SOCIAL"][: len(bd.columns)]
        bd["RUC"]  = bd["RUC"].astype(str).str.replace(r"\.0$", "", regex=True).str.strip()
        bd["ANIO"] = pd.to_numeric(bd["ANIO"], errors="coerce").fillna(0).astype(int)
    else:
        bd = pd.DataFrame(columns=["ANIO", "RUC", "RAZON_SOCIAL"])

    return {"ejecucion": eje, "metas": met, "focalizados": foc,
            "clientes": cli, "bd": bd}


def get_data() -> dict:
    return load_all(_mtimes())


def filtrar(df: pd.DataFrame,
            programas=None, meses=None, especialistas=None) -> pd.DataFrame:
    out = df
    if programas:
        col = X["PROGRAMA"] if X["PROGRAMA"] in out.columns else M["PROGRAMA"]
        out = out[out[col].isin(programas)]
    if meses:
        col = X["MES"] if X["MES"] in out.columns else M["MES"]
        out = out[out[col].isin(meses)]
    if especialistas:
        col = X["ESPECIALISTA"] if X["ESPECIALISTA"] in out.columns else M["ESPECIALISTA"]
        out = out[out[col].isin(especialistas)]
    return out