@echo off
chcp 65001 > nul
title Compilar APK - Player stats (Player)
echo ====================================================
echo   Compilando PlayerStats_Player.apk para Android
echo ====================================================
python "%~dp0android-build\build_players_apk.py"
echo.
pause
