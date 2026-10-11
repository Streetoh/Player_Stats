@echo off
chcp 65001 > nul
title Compilar APK - Estadísticas Jugadores
echo ====================================================
echo   Compilando EstadisticasJugadores.apk para Android
echo ====================================================
python "%~dp0android-build\build_apk.py"
echo.
pause
