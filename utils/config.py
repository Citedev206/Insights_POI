"""
utils/config.py — Configuración central.
Todos los nombres de columnas, pesos y umbrales viven aquí.

NOTA DE DISEÑO: la paleta `C` es la ÚNICA fuente de color de la app.
Cambiar un hex aquí repinta tarjetas, gráficos y semáforos en todas las
páginas. Los mismos valores están reflejados como variables CSS en
assets/style.css (mantener ambos en sincronía).
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
ASSETS_DIR = BASE_DIR / "assets"

FILE_EJECUCION   = DATA_DIR / "ejecucion.xlsx"
FILE_METAS       = DATA_DIR / "metas.xlsx"
FILE_FOCALIZADOS = DATA_DIR / "focalizados.xlsx"
FILE_CLIENTES    = DATA_DIR / "clientes.xlsx"
FILE_BD          = DATA_DIR / "bd.xlsx"

ANIO_ACTUAL         = 2026
ANIOS_SIN_SERVICIO  = 3   # reenganchado: sin servicio los últimos 3 años previos

# ---- Columnas EJECUCION ----
X = dict(ID="ID_ACTIVIDAD", FECHA="FECHA", ANIO="AÑO", MES="MES",
         PROGRAMA="PROGRAMA", ESPECIALISTA="ESPECIALISTA", RUC="RUC",
         RAZON="RAZON_SOCIAL", SERVICIO="TIPO_SERVICIO", TAREA="TIPO_TAREA",
         COMPLEJIDAD="COMPLEJIDAD", CANTIDAD="CANTIDAD", FUENTE="FUENTE")

# ---- Columnas METAS ----
M = dict(ID="ID_META", ANIO="AÑO", MES="MES", PROGRAMA="PROGRAMA",
         ESPECIALISTA="ESPECIALISTA", SERVICIO="TIPO_SERVICIO", TAREA="TIPO_TAREA",
         COMPLEJIDAD="COMPLEJIDAD",
         META="META_CANTIDAD", META_FOC="META_FOCALIZADOS")

# ---- Columnas FOCALIZADOS ----
F = dict(RUC="RUC", RAZON="RAZON_SOCIAL", TIPO="TIPO")

# ---- Reglas de negocio ----
PESOS_COMPLEJIDAD = {"Alta": 3, "Media": 2, "Baja": 1}
SEMAFORO_VERDE = 100   # >= 100 % verde
SEMAFORO_AMARILLO = 80  # 80–99 % amarillo, < 80 rojo

PROGRAMAS = ["POI", "WORLD-VISION", "CdD-FEST"]
COMPLEJIDADES = ["Alta", "Media", "Baja"]

MESES_ES = {1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
            7: "Jul", 8: "Ago", 9: "Set", 10: "Oct", 11: "Nov", 12: "Dic"}

# ---------------------------------------------------------------------------
# Paleta ejecutiva (estilo SaaS / Power BI · Stripe · Linear)
# Azul institucional como único acento fuerte; verde/ámbar/rojo solo para
# estados (semáforo). Neutros fríos para fondos y texto.
# ---------------------------------------------------------------------------
C = dict(
    navy="#0B1B33",        # tinta · títulos · texto fuerte
    blue="#2563EB",        # primario / acento institucional
    blue_light="#93B4F5",  # primario claro (metas, comparativos)
    blue_soft="#E8F0FE",   # tinte de fondo primario
    blue_dark="#1E40AF",   # primario intenso (degradados)
    gold="#E0A82E",        # acento ámbar (segunda serie)
    green="#15A06B",       # estado: cumplido
    yellow="#F0B429",      # estado: en riesgo
    red="#E5484D",         # estado: crítico
    bg="#F5F7FB",          # fondo de la app
    surface="#FFFFFF",     # superficie de tarjetas/paneles
    text="#1F2D3D",        # texto de cuerpo
    muted="#647592",       # texto secundario
    grid="#EEF2F8",        # líneas de grilla
    border="#E5EAF2",      # bordes sutiles
)

COLOR_SEMAFORO = {"verde": C["green"], "amarillo": C["yellow"], "rojo": C["red"]}
# Tintes suaves del semáforo (fondos de zonas / chips claros)
COLOR_SEMAFORO_SOFT = {"verde": "#E4F4EC", "amarillo": "#FCF3DB", "rojo": "#FCE8E9"}
COLOR_COMPLEJIDAD = {"Alta": C["red"], "Media": C["yellow"], "Baja": C["green"]}
COLOR_PROGRAMA = {"POI": C["blue"], "WORLD-VISION": C["blue_light"],
                  "CdD-FEST": C["gold"]}

# Secuencia de colores categórica para gráficos (orden de prioridad visual)
COLORWAY = [C["blue"], C["gold"], C["green"], C["blue_light"], C["red"], C["navy"]]


def semaforo(pct: float) -> str:
    """Clasifica un % de cumplimiento en verde / amarillo / rojo."""
    if pct >= SEMAFORO_VERDE:
        return "verde"
    if pct >= SEMAFORO_AMARILLO:
        return "amarillo"
    return "rojo"
