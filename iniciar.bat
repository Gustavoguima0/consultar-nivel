@echo off
title Monitor de Impressoras
cd /d "%~dp0"
:loop
node servidor.js
echo.
echo O servidor parou. Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
goto loop