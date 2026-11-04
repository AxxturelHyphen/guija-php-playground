# Guija Playground

Mini-IDE local para aprender a programar y razonar sobre rendimiento en **PHP**, **Python**, **Java** y **C++**. Sin Composer, sin frameworks: un servidor `php -S` y un editor (Monaco) en el navegador. Cada lenguaje tiene su temario (lenguaje, POO, colecciones, recursión, ordenación, búsqueda, estructuras de datos, grafos y programación dinámica; Python añade NumPy/matplotlib y audio con librosa; C++ va más a fondo en DSA con 12 lecciones: STL, grafos, programación dinámica, árboles de rangos, bits y matemáticas, y algoritmos de strings).

Al ejecutar (Ctrl+Enter) obtienes errores explicados en español con arreglo (Alt+Enter), complejidad ciclomática/cognitiva y O() de cada función, y las pruebas de los ejercicios (✓ ✗ ⏳). **Medir** (Ctrl+Alt+Enter) calcula el O() real, y **Comparar** (Ctrl+Shift+Enter) enfrenta tu código con la solución de referencia (gráfica log-log y veredicto, p. ej. «×300 más lenta»). Ctrl+S guarda una copia en `practicas/<lenguaje>/`; los ejemplos no se modifican.

## Arrancar
- **Windows:** doble clic en `arrancar.bat`.
- **Linux/macOS:** `./arrancar.sh` (`PORT=9000 ./arrancar.sh` para otro puerto).

Abre http://127.0.0.1:8000: eliges lenguaje en `/` y trabajas en `/php`, `/python`, `/java` o `/cpp`. Solo escucha en 127.0.0.1. Los scripts crean `.venv` e instalan lo de Python la primera vez.

Sin navegador: `php pg.php 04-recursion.php --analisis --comparar` (también `.py`, `.java` y `.cpp`; `--medir`, `--timeout=N`, `--sin-color`).

## Requisitos
- **PHP** (obligatorio; sirve la aplicación). La lección PHP 01 pide PHP 8.5: con una versión anterior se salta con aviso.
- **Python 3.11 o superior** (opcional, activa la versión Python) con un entorno `.venv` y `requirements.txt` (numpy, matplotlib).
- **JDK 21 o superior** (opcional, activa la versión Java): `javac` en el PATH o `JAVA_HOME`.
- **g++ 11+ o clang++ 14+ con C++20** (opcional, activa la versión C++): en Linux `apt install g++`; en macOS `xcode-select --install`; en Windows MinGW-w64 (WinLibs o MSYS2) con `bin` en el PATH (o `PG_CXX` con la ruta al compilador). Ejecutar compila en modo comprobado (AddressSanitizer + UBSan: errores de memoria y desbordamientos con su línea; en Windows, sin sanitizers, `_GLIBCXX_ASSERTIONS`). Medir y Comparar usan `-O2`.
- **librosa** (solo la lección de audio de Python): `.venv/bin/python -m pip install -r requirements-audio.txt` (`.venv\Scripts\python` en Windows).

## Estructura
```
index.php, pg.php     router del servidor y versión de terminal
arrancar.bat/.sh      arranque y preparación del entorno
app/Core/             API, procesos, informe, temario, soluciones, banco de medidas (agnóstico del lenguaje)
app/Lang/Php|Python|Java|Cpp/   análisis, explicador, ejecución y harness de cada lenguaje
assets/               CSS y JS del front (assets/js/lang/ = lo propio de cada lenguaje)
contenido/            temario.json y, por lenguaje, ejemplos/ y soluciones/
practicas/            lo que guarda cada usuario (no se versiona)
var/                  cachés, artefactos de ejecución y capturas E2E (no se versiona)
tests/                autotests; tests/e2e/ = pruebas de navegador
```

## Tests
- `php tests/run.php`: todo (≈ 1-2 min; `--rapido` omite el contenido). Sintaxis, métricas, errores explicados, harness (timeout, memoria, stdin), soluciones con su O() medido, seguridad HTTP real y, por lenguaje, `tests/python/run.php`, `tests/java/run.php` y `tests/cpp/run.php` más la paridad del temario.
- `php tests/tiempos.php [--lang=python|java] [--medir]`: tiempo de ejecutar y de lint por lección frente a PHP; sale con 1 si no cumple.
- E2E (Node + Playwright instalado; arrancan su propio servidor en un puerto libre):
  - `node tests/e2e/fluidez.js`: p50 de carga, abrir lección, cambiar de pestaña, lint y ejecutar por lenguaje frente a PHP.
  - `node tests/e2e/recorrido.js`: elegir → abrir lección → Ejecutar → Medir → Comparar en los tres lenguajes, sin errores de consola ni 4xx/5xx; capturas en `var/e2e/`.
