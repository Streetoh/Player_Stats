@echo off
chcp 65001 > nul
echo ===================================================
echo   COMPILANDO APK PARA JUGADORES (JK NOOVA)
echo ===================================================
python android-build\build_players_apk.py
echo.
pause
