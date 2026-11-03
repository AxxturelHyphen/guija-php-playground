@echo off
rem Guija PHP Playground - arranca el servidor local y abre el navegador.
rem Solo escucha en 127.0.0.1 (tu propio PC). Para cerrarlo: Ctrl+C o cierra esta ventana.
cd /d "%~dp0"
title Guija PHP Playground
set PORT=8000

where php >nul 2>nul
if errorlevel 1 (
    echo.
    echo  No encuentro php.exe en el PATH.
    echo  Instala PHP o anade su carpeta al PATH ^(por ejemplo la de Herd: %USERPROFILE%\.config\herd\bin^).
    echo.
    pause
    exit /b 1
)

netstat -ano | findstr /R /C:"127.0.0.1:%PORT% .*LISTENING" >nul
if not errorlevel 1 (
    echo.
    echo  El puerto %PORT% ya esta en uso: probablemente el playground ya esta abierto.
    echo  Abro el navegador en la instancia existente.
    echo.
    start "" http://127.0.0.1:%PORT%
    timeout /t 3 >nul
    exit /b 0
)

echo.
echo  Guija PHP Playground  -  http://127.0.0.1:%PORT%
echo  ^(Ctrl+C para parar^)
echo.
start "" http://127.0.0.1:%PORT%
php -S 127.0.0.1:%PORT% index.php
