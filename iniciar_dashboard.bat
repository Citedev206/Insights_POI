@echo off
REM ============================================================
REM  CITE - POI 2026  |  Lanzador del dashboard (sitio estatico)
REM  Doble clic para iniciar. Cierra esta ventana para apagarlo.
REM ============================================================
title CITE POI 2026 - Dashboard
cd /d "%~dp0"

echo.
echo ===========================================================
echo   DASHBOARD CITE - POI 2026
echo ===========================================================
echo.
echo   Abriendo el tablero en tu navegador:
echo        http://localhost:8000
echo.
echo   Para compartir en tu red local, tus colegas (misma red)
echo   pueden abrir  http://TU_IP:8000  con esta IPv4:
echo.
ipconfig | findstr /i "IPv4"
echo.
echo   Para apagar el dashboard: cierra esta ventana.
echo ===========================================================
echo.

REM Abre el navegador y arranca el servidor web (no requiere internet)
start "" http://localhost:8000
python -m http.server 8000 || py -m http.server 8000
pause
