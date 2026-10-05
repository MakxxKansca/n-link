@echo off
chcp 65001 >nul
title Servidor Local n-Link (WebUSB en Chromium)
echo ======================================================================
echo                      n-Link Web (WebUSB)
echo ======================================================================
echo.
echo  [+] Iniciando servidor local con cabeceras COOP/COEP (WebAssembly)...
echo  [+] URL: http://localhost:5173
echo.
echo  NOTA PARA WINDOWS:
echo   - Si usas TI-Nspire CX II: Funciona de inmediato sin drivers adicionales.
echo   - Si usas TI-Nspire CX Clasica: Requiere cambiar el driver a 'WinUSB'
echo     usando Zadig (https://zadig.akeo.ie/).
echo.
echo  Presiona Ctrl+C en esta ventana para detener el servidor.
echo ======================================================================
echo.

cd /d "%~dp0\web"
python serve.py
pause
