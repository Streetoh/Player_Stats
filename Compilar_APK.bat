@echo off
chcp 65001 > nul
title Compilar APK - Player stats (Coach)
echo ====================================================
echo   Compilando PlayerStats_Coach.apk para Android
echo ====================================================
python "%~dp0android-build\build_apk.py"
echo.
pause
