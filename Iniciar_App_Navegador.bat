@echo off
chcp 65001 > nul
title Estadísticas Jugadores
echo Iniciando servidor local en http://localhost:8080 ...
start "" http://localhost:8080/coach.html
python -m http.server 8080 --directory "%~dp0"
pause
