# Guija PHP Playground

Mini-IDE local para aprender PHP (lenguaje, POO, algoritmos) viniendo de Java. Sin Composer, sin frameworks: solo `php`.

## Arrancar
- **Navegador:** doble clic en `arrancar.bat` (abre http://127.0.0.1:8000).
- **Terminal:** `php pg.php 04-recursion.php --analisis --comparar` (`--medir`, `--timeout=N`, `--sin-color`).

## Qué hace al ejecutar (Ctrl+Enter)
Errores explicados en español con arreglo (Alt+Enter), complejidad ciclomática/cognitiva y O() de cada función,
pruebas de los ejercicios (✓ ✗ ⏳) y, con **Medir** (Ctrl+Alt+Enter), el O() real medido.
**Comparar** (Ctrl+Shift+Enter) enfrenta tu código con la solución de referencia: gráfica log-log y veredicto («×300 más lenta»).

## Temario (`ejemplos/`, soluciones en `soluciones/`)
01 Java → PHP · 02 POO a fondo · 03 Arrays y colecciones · 04 Recursión · 05 Ordenación ·
06 Búsqueda y técnicas · 07 Estructuras de datos · 08 Grafos y programación dinámica.
Cada tema: teoría + ejemplos ejecutables + ejercicios con `pendiente()` y pruebas. Ctrl+S guarda una copia en `practicas/`
(los ejemplos no se modifican).

## Comprobar que todo funciona
`php tests/run.php` (≈ 1 min; `--rapido` omite el contenido): sintaxis, métricas, errores explicados, harness
(timeout, memoria, stdin), las 7 soluciones con sus tests y su O() medido, y seguridad HTTP real.
