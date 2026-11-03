@echo off
rem Guija Playground (PHP, Python, Java) - arranca el servidor local y abre el navegador.
rem Solo escucha en 127.0.0.1 (tu propio PC). Para cerrarlo: Ctrl+C o cierra esta ventana.
rem
rem   - PHP es obligatorio (sirve la aplicacion).
rem   - Python es opcional: la primera vez se crea .venv e instala numpy y matplotlib (requirements.txt).
rem     Para la leccion de audio: .venv\Scripts\python -m pip install -r requirements-audio.txt
rem   - Java es opcional: hace falta un JDK 21 o superior (javac en el PATH o JAVA_HOME).
cd /d "%~dp0"
title Guija Playground
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

if not exist "var" mkdir "var"

rem -- Python (opcional) ----------------------------------------------
if exist ".venv\Scripts\python.exe" goto python_deps
set "PYLAUNCH="
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if not errorlevel 1 set "PYLAUNCH=py -3"
if defined PYLAUNCH goto python_venv
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if not errorlevel 1 set "PYLAUNCH=python"
if defined PYLAUNCH goto python_venv
echo  ^(Python 3.11+ no encontrado: la version Python del playground no estara disponible.
echo   Instalalo desde python.org marcando "Add python.exe to PATH" y vuelve a abrir este archivo.^)
goto java
:python_venv
echo  Preparando Python para el playground ^(solo la primera vez, tarda un poco^)...
%PYLAUNCH% -m venv .venv
if not exist ".venv\Scripts\python.exe" (
    echo  No se pudo crear el entorno .venv de Python.
    goto java
)
:python_deps
".venv\Scripts\python.exe" -c "import numpy, matplotlib" >nul 2>nul
if not errorlevel 1 goto python_warm
echo  Instalando numpy y matplotlib en .venv ...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt
:python_warm
rem La primera importacion de matplotlib construye su cache de fuentes (puede tardar ~10 s): se hace ya, en segundo plano.
if not exist "var\mpl" mkdir "var\mpl"
set "MPLCONFIGDIR=%~dp0var\mpl"
start "" /B ".venv\Scripts\python.exe" -c "import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot"

rem -- Java (opcional) ------------------------------------------------
:java
where javac >nul 2>nul
if not errorlevel 1 goto serve
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\javac.exe" goto serve
echo  ^(JDK no encontrado: la version Java del playground no estara disponible.
echo   Instala un JDK 21 o superior, por ejemplo Eclipse Temurin 21 LTS, y vuelve a abrir este archivo.^)

:serve
echo.
echo  Guija Playground  -  http://127.0.0.1:%PORT%
echo  ^(Ctrl+C para parar^)
echo.
start "" http://127.0.0.1:%PORT%
php -S 127.0.0.1:%PORT% index.php
