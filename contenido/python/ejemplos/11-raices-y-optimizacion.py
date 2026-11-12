"""
TEMA 11 · RAÍCES Y OPTIMIZACIÓN EN 1D
─────────────────────────────────────────────────────────────────
Entrenar un modelo es minimizar una función, y casi todo lo demás en cálculo numérico es resolver f(x) = 0. Esta lección
convierte la guía de Cálculo «Aplicaciones de la derivada» en código: la bisección (el teorema de Bolzano hecho algoritmo),
la búsqueda binaria sobre la RESPUESTA (el mismo patrón con enteros, clásico de entrevistas), el método de Newton (la
tangente como modelo local, con convergencia cuadrática) y la minimización en 1D: descenso de gradiente y búsqueda ternaria.

  Concepto               Qué es                                               Trampa típica
  teorema de Bolzano     f continua con f(a)·f(b) < 0 ⇒ hay una raíz en       sin continuidad no vale: 1/x cambia de signo en
                         (a, b)                                               [-1, 2] y no tiene raíz (converge al polo)
  bisección              se queda con la mitad donde f cambia de signo:       tol por debajo de la resolución del float: el
                         ancho/2 por iteración, 1 bit ganado cada vez         punto medio ya es un extremo y el bucle no acaba
  búsqueda binaria       predicado monótono F…FV…V sobre enteros: ⌈log2 N⌉    con un predicado no monótono descarta mitades
  sobre la respuesta     evaluaciones, sin floats ni tolerancias              donde sí estaba la respuesta (resultado basura)
  método de Newton       x ← x − f(x)/f'(x): raíz de la tangente en x         f' ≈ 0 lanza el iterado lejísimos; hay ciclos
                                                                              (x³-2x+2 desde 0) y funciones que divergen
  orden de convergencia  p con e_{k+1} ≈ C·e_k^p: p=1 lineal (bits fijos por  la convergencia cuadrática solo vale cerca de una
                         paso), p=2 cuadrática (los dígitos se duplican)      raíz SIMPLE; en una doble es lineal
  descenso de gradiente  x ← x − η·f'(x) con tasa η; en f = (L/2)x² el error  η > 2/L diverge; la tasa «cuanto menor mejor»
                         se multiplica por (1 − ηL) en cada paso              no es cierta: tarda una eternidad
  búsqueda ternaria      en f unimodal compara f(m1) y f(m2) y descarta un    f(m1) == f(m2) por redondeo: x no mejora por
                         tercio del intervalo, sin derivadas                  debajo de ~√eps (lección 10, sección 3)

Costes: bisección ⌈log2((b-a)/tol)⌉ evaluaciones (41 para [0, 2] con tol 1e-12); búsqueda binaria sobre la respuesta
⌈log2 N⌉ predicados; Newton ~log log(1/tol) iteraciones, de 2 evaluaciones cada una (f y f'); descenso de gradiente O(pasos)
con convergencia lineal de razón |1 − ηL|; ternaria 2 evaluaciones por iteración y ancho × 2/3.
"""
import math
import random
from decimal import Decimal, localcontext

import matplotlib.pyplot as plt
import numpy as np


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. BISECCIÓN: BOLZANO HECHO ALGORITMO
# ═════════════════════════════════════════════════════════════════
# Bolzano: si f es continua en [a, b] y f(a), f(b) tienen signos distintos, hay una raíz dentro. Es una prueba de EXISTENCIA
# que ya es un algoritmo: mirar el signo en el punto medio y quedarse con la mitad donde sigue habiendo cambio de signo.
# Invariante: «f(a) y f(b) tienen signo distinto». Es una búsqueda binaria sobre los reales: cada paso gana 1 bit.
titulo('1. Bisección')


def biseccion_traza(f, a, b, pasos):
    """Intervalos [a, b] sucesivos de la bisección. Solo para mirar: el ejercicio `biseccion` es la versión completa."""
    fa = f(a)
    tramos = [(a, b)]
    for _ in range(pasos):
        m = (a + b) / 2
        fm = f(m)
        if (fm > 0) == (fa > 0):                     # f(m) con el signo de f(a): la raíz está en [m, b]
            a, fa = m, fm
        else:
            b = m
        tramos.append((a, b))
    return tramos


def cubica(x):
    return x ** 3 - x - 2                            # f(1) = -2 < 0 y f(2) = 4 > 0: hay una raíz en [1, 2]


tramos = biseccion_traza(cubica, 1.0, 2.0, 60)
raiz = sum(tramos[-1]) / 2                           # tras 60 pasos el ancho es ~1e-18: ya es la raíz a precisión de float
print(f'raíz de x³ - x - 2 en [1, 2]: {raiz!r}')
print(f'\n{"k":>3} {"ancho":>12} {"error":>12} {"bits ganados":>13}')
for k in (0, 1, 2, 3, 5, 10, 20, 30, 40):
    a, b = tramos[k]
    print(f'{k:3d} {b - a:12.3e} {abs((a + b) / 2 - raiz):12.3e} {math.log2(1.0 / (b - a)):13.1f}')
# Ancho = (b-a)/2^k: la cota de error baja a la mitad por iteración (convergencia LINEAL, p = 1; el error real de cada
# iterado oscila pero siempre cabe en el ancho). Para tol = 1e-12 en [0, 2] hacen
# falta ⌈log2(2/1e-12)⌉ = 41 iteraciones, y ese número NO depende de f: es la garantía (y el límite) del método.
print('iteraciones para tol = 1e-12 en [0, 2]:', math.ceil(math.log2(2 / 1e-12)))

# Dos trampas. (1) Sin continuidad, Bolzano no se aplica: 1/x cambia de signo en [-1, 2] pero no tiene raíz, tiene un polo.
a, b = biseccion_traza(lambda x: 1 / x, -1.0, 2.0, 40)[-1]
print(f'\n1/x en [-1, 2]: el intervalo se cierra en {(a + b) / 2:.1e}, donde |f| = {abs(1 / ((a + b) / 2)):.1e}: converge a un POLO')
# (2) Resolución del float. Cerca de 123456.789 los floats están separados ~1.5e-11: si tol es menor, el punto medio acaba
# siendo a o b y el ancho deja de bajar. Por eso la solución también para cuando m == a o m == b.
a, b = biseccion_traza(lambda x: x - 123456.789, 0.0, 1e6, 80)[-1]
print(f'separación de floats en 123456.789: {np.spacing(123456.789):.2e} · punto medio == extremo: {(a + b) / 2 in (a, b)}')


# ═════════════════════════════════════════════════════════════════
# 2. BÚSQUEDA BINARIA SOBRE LA RESPUESTA
# ═════════════════════════════════════════════════════════════════
# Mismo patrón, con enteros: si «¿vale x?» es un predicado MONÓTONO (falso, falso, …, verdadero, verdadero), el primer x
# verdadero se encuentra en ⌈log2(N)⌉ evaluaciones sin recorrer los candidatos. No hay tol: los enteros son discretos y el
# bucle acaba solo. Invariante: la respuesta está en [bajo, alto] y pred(alto) es verdadero.
titulo('2. Búsqueda binaria sobre la respuesta')


def primer_verdadero(pred, bajo, alto):
    """Menor entero x en [bajo, alto] con pred(x) verdadero (pred monótona y pred(alto) verdadero). → (x, evaluaciones)."""
    evaluaciones = 0
    while bajo < alto:
        medio = (bajo + alto) // 2                   # // exacto con enteros de cualquier tamaño (sin desbordar en Python)
        evaluaciones += 1
        if pred(medio):
            alto = medio                             # medio sirve: la respuesta está en [bajo, medio]
        else:
            bajo = medio + 1                         # medio no sirve: está en [medio + 1, alto]
    return bajo, evaluaciones


def dias_necesarios(pesos, capacidad):
    dias, carga = 1, 0
    for p in pesos:                                  # los paquetes se envían EN ORDEN: voraz, O(n)
        if carga + p > capacidad:
            dias, carga = dias + 1, 0
        carga += p
    return dias


# Problema clásico (barco con D días): capacidad mínima para enviar todos los paquetes en orden en a lo sumo D días.
# Más capacidad nunca empeora → el predicado «con c basta» es monótono y la capacidad mínima está en [max(pesos), sum(pesos)].
pesos = [(i * 37) % 100 + 1 for i in range(1000)]
cap, n_pred = primer_verdadero(lambda c: dias_necesarios(pesos, c) <= 7, max(pesos), sum(pesos))
print(f'capacidad mínima para 1000 paquetes en 7 días: {cap} ({n_pred} evaluaciones del predicado; '
      f'recorriendo candidatos serían hasta {sum(pesos) - max(pesos) + 1})')

# Con enteros gigantes los floats mienten: float(n) solo guarda 53 bits. Raíz cúbica entera: mayor x con x³ ≤ n.
n = (10 ** 17 + 1) ** 3
x, n_pred = primer_verdadero(lambda x: x ** 3 > n, 0, n + 1)
print(f'\nraíz cúbica entera de (10^17 + 1)³: exacta = {x - 1} (en {n_pred} evaluaciones) · con floats: {int(n ** (1 / 3))}')
# El float se equivoca en las últimas cifras (ni siquiera puede representar 10^17 + 1: sus vecinos distan 16). La búsqueda binaria entera es exacta y cuesta ~log2(n) pasos.


# ═════════════════════════════════════════════════════════════════
# 3. NEWTON: LA TANGENTE COMO MODELO LOCAL
# ═════════════════════════════════════════════════════════════════
# Se sustituye f por su recta tangente en x (linealizar) y se salta a la raíz de esa recta: 0 = f(x) + f'(x)·(x' - x), es
# decir x' = x - f(x)/f'(x). Con Taylor, si r es raíz simple:  e' ≈ (f''(r) / 2f'(r)) · e²  → el error se ELEVA al cuadrado.
# Si e = 10^-3, el siguiente es ~10^-6, luego ~10^-12: los dígitos correctos se duplican en cada iteración.
titulo('3. Método de Newton')

with localcontext() as ctx:                          # aritmética decimal de 100 cifras para ver la duplicación más allá del float
    ctx.prec = 100
    r, x, anterior = Decimal(2).sqrt(), Decimal(1), None
    print(f'{"k":>3} {"error de x_k":>14} {"dígitos ok":>11} {"e_k / e_(k-1)²":>15} {"bisección":>10}')
    for k in range(8):
        e = abs(x - r)
        cuadrado = f'{float(e / anterior ** 2):15.4f}' if anterior else ' ' * 15
        print(f'{k:3d} {float(e):14.2e} {float(-e.log10()):11.1f} {cuadrado} {0.301 * k:10.1f}')
        anterior, x = e, x - (x * x - 2) / (2 * x)   # Newton para x² - 2 con x0 = 1
# Los dígitos correctos pasan de 0.4 a 1.1, 2.6, 5.7, 11.8, 24, 48, 97: se duplican. El cociente e_k / e_(k-1)² tiende a
# f''/(2f') = 1/(2√2) ≈ 0.354: es la constante C de «e' ≈ C·e²» (el último valor, 0.3547, ya sufre el límite de 100 cifras).
# La bisección (última columna) gana ~0.3 dígitos por paso: 2.1 tras 7 iteraciones frente a 97 de Newton.


def newton_traza(f, df, x0, pasos):
    """Iterados de Newton, parando si f' vale 0 o el iterado se vuelve infinito. Solo para mirar: el ejercicio es `newton`."""
    xs = [x0]
    for _ in range(pasos):
        x = xs[-1]
        d = df(x)
        if d == 0 or not math.isfinite(x):
            break
        xs.append(x - f(x) / d)
    return xs


# Cuándo falla (cuatro casos). Newton necesita f' ≠ 0 y un punto de partida en la «cuenca» de la raíz.
raiz2 = math.sqrt(2)
xs = newton_traza(lambda x: x * x - 2, lambda x: 2 * x, 1e-3, 60)
print(f'\nf\' ≈ 0: x² - 2 desde x0 = 0.001 salta a x1 = {xs[1]:.1f} y necesita {next(k for k, x in enumerate(xs) if abs(x - raiz2) < 1e-12)} '
      'pasos en volver')
print('ciclo: x³ - 2x + 2 desde 0:', newton_traza(lambda x: x ** 3 - 2 * x + 2, lambda x: 3 * x * x - 2, 0.0, 6))
for x0 in (1.0, 2.0):
    xs = newton_traza(math.atan, lambda x: 1 / (1 + x * x), x0, 6)
    print(f'arctan desde {x0}: |x_k| =', [f'{abs(x):.1e}' for x in xs], '→', 'converge' if abs(xs[-1]) < 1 else 'DIVERGE')
xs = newton_traza(lambda x: (x - 1) ** 2, lambda x: 2 * (x - 1), 2.0, 10)
print('raíz doble (x-1)² desde 2: e_(k+1)/e_k =', [round(abs(xs[k + 1] - 1) / abs(xs[k] - 1), 3) for k in range(4)],
      '→ lineal con razón 1/2 (como la bisección), no cuadrática: f\'(r) = 0')
# Moraleja: Newton es rapidísimo si la arrancas cerca y f' no se anula; la bisección es lenta pero NO falla nunca (si hay Bolzano).
# En la práctica se combinan: bisección para acotar y Newton para afinar (es lo que hace brentq de SciPy, con más cuidado).


# ═════════════════════════════════════════════════════════════════
# 4. MINIMIZAR: DESCENSO DE GRADIENTE Y BÚSQUEDA TERNARIA
# ═════════════════════════════════════════════════════════════════
# Un mínimo de f es una raíz de f': se podría aplicar Newton a f' (usa f''). El descenso de gradiente solo usa f': da un
# paso contra la pendiente, x ← x − η·f'(x). En una parábola f = (L/2)(x - x*)² es f' = L(x - x*) y cada paso hace
#   x' - x* = (x - x*) − ηL(x - x*) = (1 − ηL)·(x - x*)   →   e_k = |1 − ηL|^k · e_0
# Convergencia lineal con razón |1 − ηL|: eso exige |1 − ηL| < 1, es decir 0 < η < 2/L. Con η = 1/L la razón es 0 (un paso).
titulo('4. Descenso de gradiente en 1D')

L = 4.0                                              # f(x) = 2(x - 1)² + 1 → f'(x) = 4(x - 1), curvatura L = f'' = 4, mínimo en x* = 1
print(f'{"η":>6} {"η·L":>6} {"e_1 / e_0":>19} {"|1 − ηL|":>9} {"error tras 25 pasos":>20}')
plt.figure(figsize=(7, 4))
for eta, color in ((0.01, 'tab:gray'), (0.1, 'tab:blue'), (0.25, 'tab:green'), (0.45, 'tab:orange'), (0.55, 'tab:red')):
    x, err = 3.0, [2.0]
    for _ in range(25):
        x -= eta * 4 * (x - 1)
        err.append(abs(x - 1))
    print(f'{eta:6.2f} {eta * L:6.2f} {err[1] / err[0]:19.3f} {abs(1 - eta * L):9.3f} {err[-1]:20.3e}')
    plt.semilogy(np.maximum(err, 1e-17), label=f'η = {eta} ({"diverge" if eta * L > 2 else "converge"})', color=color)
plt.axhline(2.0, color='black', linewidth=0.5, linestyle=':')
plt.title('Descenso de gradiente en f = 2(x-1)² + 1 (L = 4, límite de estabilidad η = 2/L = 0.5)')
plt.xlabel('iteración')
plt.ylabel('|x_k − x*| (escala log)')
plt.legend(fontsize=8)
plt.show()                                         # la gráfica aparece en el panel Salida
# η = 0.01 apenas baja (razón 0.96); η = 0.1 converge bien; η = 0.25 = 1/L cae a 0 en un paso; η = 0.45 oscila (razón −0.8)
# pero converge; η = 0.55 > 2/L la razón es −1.2: el error CRECE ×1.2 por paso. En una función real, L es la curvatura máxima
# (|f''|) en la región que recorres: por eso la tasa «buena» depende de f y se ajusta, o se usa Newton / métodos adaptativos.


# Búsqueda ternaria: para f UNIMODAL (baja y luego sube) basta comparar dos puntos interiores, sin derivadas. Si f(m1) < f(m2)
# el mínimo no puede estar en (m2, b], y si no, no está en [a, m1): se descarta un tercio y el ancho queda × 2/3 por iteración.
def ternaria_traza(f, a, b, pasos):
    """Centro del intervalo tras cada iteración de la ternaria. Solo para mirar: el ejercicio es `minimo_ternario`."""
    centros = []
    for _ in range(pasos):
        tercio = (b - a) / 3
        m1, m2 = a + tercio, b - tercio
        if f(m1) < f(m2):
            b = m2
        else:
            a = m1
        centros.append((a + b) / 2)
    return centros


centros = ternaria_traza(lambda x: (x - 2) ** 2 + 1, 0.0, 5.0, 80)
print(f'\n{"iteración":>9} {"evaluaciones":>13} {"error de x":>12}')
for k in (10, 20, 30, 40, 50, 60, 80):
    print(f'{k:9d} {2 * k:13d} {abs(centros[k - 1] - 2):12.2e}')
# El error baja ×2/3 por iteración... hasta ~1e-8 y ahí SE PARA. No es un fallo del algoritmo: cerca del mínimo f es plana,
# f(x) = 1 + (x-2)² vale 1.0 en float para |x-2| < ~1e-8 y f(m1) == f(m2) deja de informar. Es el mismo √eps de la lección 10:
# la posición de un mínimo se conoce con ~√eps de precisión (la de una raíz, con ~eps), así que tol < 1e-8 no tiene sentido.
# Con derivada disponible es mejor buscar la raíz de f' (bisección o Newton): precisión eps en x y 1 evaluación por paso.


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · biseccion ─────────────────────────────────────
def biseccion(f, a: float, b: float, tol: float = 1e-12) -> float:
    """
    Raíz de f en [a, b] por bisección. Devuelve float.
    Especificación exacta:
      - a >= b → ValueError (se exige a < b; se comprueba antes de evaluar f).
      - Evalúa f(a) y f(b) UNA sola vez cada uno. Si f(a) == 0 devuelve a; si f(b) == 0 devuelve b.
      - Si f(a) y f(b) tienen el mismo signo estricto (no hay cambio de signo) → ValueError.
      - Después, mientras b - a > tol: m = punto medio; si f(m) == 0 devuelve m; si no, se queda con la mitad
        donde sigue habiendo cambio de signo. Debe evaluar f UNA vez por iteración.
      - Para también si m == a o m == b (tol por debajo de la resolución del float): sin esta guarda el bucle no acaba.
      - Devuelve el punto medio del intervalo final: error <= tol (salvo el límite de resolución del float).
      biseccion(lambda x: x * x - 2, 0, 2)  →  1.4142135623731 (error < 1e-12)
    Coste: ⌈log2((b - a) / tol)⌉ + 2 evaluaciones de f (41 + 2 para [0, 2] con tol = 1e-12).
    """
    pendiente()


# ── Ejercicio 2 · raiz_entera ───────────────────────────────────
def raiz_entera(n: int) -> int:
    """
    ⌊√n⌋ EXACTO para cualquier entero n >= 0, por búsqueda binaria sobre la respuesta (el mayor x con x*x <= n).
    Sin floats ni math.sqrt/math.isqrt/** 0.5: con n ≈ 10**40 un float ya no distingue enteros vecinos.
      - n < 0 → ValueError; n que no sea int (por ejemplo 4.0) → TypeError.
      - Devuelve int. Invariante sugerida: bajo² <= n < alto².
      raiz_entera(10 ** 40)      →  10 ** 20
      raiz_entera(10 ** 40 - 1)  →  10 ** 20 - 1
      raiz_entera(0)             →  0
    Coste: O(log n) iteraciones, cada una con un producto de enteros de ~log n bits.
    """
    pendiente()


# ── Ejercicio 3 · newton ────────────────────────────────────────
def newton(f, df, x0: float, tol: float = 1e-12, max_iter: int = 50) -> float:
    """
    Raíz de f por el método de Newton partiendo de x0; `df` es la derivada de f. Devuelve float.
    Especificación exacta (en cada iteración, empezando en x = float(x0)):
      1. Si f(x) == 0 devuelve x (ya es raíz, aunque f'(x) valga 0).
      2. Si df(x) == 0 → ZeroDivisionError (la tangente es horizontal: no hay a dónde saltar).
      3. paso = f(x) / df(x); x = x - paso. Si x ya no es finito (inf o nan) → RuntimeError.
      4. Si |paso| <= tol devuelve x.
      Si tras max_iter iteraciones no se cumplió 4 (ciclo, divergencia, convergencia demasiado lenta) → RuntimeError.
    Se lanza una excepción en vez de devolver None o el último valor: un «no convergió» silencioso se propaga como un
    número falso. tol es ABSOLUTA: para raíces grandes (>1e4) elige un tol acorde a la resolución del float.
      newton(lambda x: x * x - 2, lambda x: 2 * x, 1.0)  →  1.4142135623731 (6 iteraciones)
    Coste: O(iteraciones) evaluaciones de f y df; cerca de una raíz simple, ~log log(1/tol).
    """
    pendiente()


# ── Ejercicio 4 · descenso_1d ───────────────────────────────────
def descenso_1d(df, x0: float, tasa: float, pasos: int) -> list:
    """
    Descenso de gradiente en 1D: x ← x − tasa · df(x), `pasos` veces. `df` es la derivada de la función a minimizar.
    Devuelve la TRAYECTORIA como lista de float [x_0, x_1, ..., x_pasos] (longitud pasos + 1; x_0 = float(x0)), para poder
    dibujar el error por iteración. pasos = 0 → [x0]; pasos < 0 → ValueError. No se detiene antes aunque df(x) valga 0
    (repite el mismo valor) ni comprueba divergencia: con una tasa demasiado grande los valores simplemente crecen.
      descenso_1d(lambda x: 2 * x, 1.0, 0.25, 3)  →  [1.0, 0.5, 0.25, 0.125]
    Coste: O(pasos) tiempo y memoria (la lista).
    """
    pendiente()


# ── Ejercicio 5 · minimo_ternario ───────────────────────────────
def minimo_ternario(f, a: float, b: float, tol: float = 1e-9) -> float:
    """
    Abscisa del mínimo de una función UNIMODAL f en [a, b] por búsqueda ternaria. Devuelve float.
    Especificación exacta:
      - a >= b → ValueError.
      - Mientras b - a > tol: m1 = a + (b-a)/3, m2 = b - (b-a)/3. Si f(m1) < f(m2) se queda con [a, m2]; si no (también
        si son iguales), con [m1, b]. Dos evaluaciones de f por iteración.
      - Para también si no se cumple a < m1 < m2 < b (resolución del float agotada).
      - Devuelve el punto medio del intervalo final. Si el mínimo está en un extremo, converge a ese extremo.
      Para maximizar una f unimodal se pasa `lambda x: -f(x)`.
      minimo_ternario(lambda x: (x - 2) ** 2 + 1, 0, 5)  →  ≈ 2.0 (error ~1e-8, no 1e-9: manda el redondeo de f, sección 4)
    Coste: ⌈log_{3/2}((b - a) / tol)⌉ iteraciones, 2 evaluaciones cada una (~110 para [0, 5] con tol = 1e-9).
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS (los resultados aproximados se comparan con una tolerancia explícita)
# ═════════════════════════════════════════════════════════════════

def _cerca(tolerancia: float):
    """Comparador para `prueba`: |actual - esperado| <= tolerancia. Solo acepta números (no bool) y NaN nunca es cercano."""
    def comparar(actual, esperado) -> bool:
        if isinstance(actual, bool) or not isinstance(actual, (int, float)):
            return False
        return actual == esperado or abs(actual - esperado) <= tolerancia
    return comparar


def _contar(f):
    """Envuelve f y cuenta cuántas veces se la llama (en el atributo `llamadas`)."""
    def envuelta(x):
        envuelta.llamadas += 1
        return f(x)
    envuelta.llamadas = 0
    return envuelta


prueba('biseccion', {
    'x² - 2 en [0, 2] → √2': ((lambda x: x * x - 2, 0.0, 2.0), math.sqrt(2)),
    'x³ - x - 2 en [1, 2]': ((lambda x: x ** 3 - x - 2, 1.0, 2.0), 1.5213797068045676),
    'cos x - x en [0, 1] (punto fijo del coseno)': ((lambda x: math.cos(x) - x, 0.0, 1.0), 0.7390851332151607),
    'función decreciente: 1 - x³ en [0, 3]': ((lambda x: 1 - x ** 3, 0.0, 3.0), 1.0),
    'raíz negativa: x³ + 8 en [-5, 0]': ((lambda x: x ** 3 + 8, -5.0, 0.0), -2.0),
    'extremos enteros': ((lambda x: x - 3, 0, 10), 3.0),
    'la raíz es el punto medio: devuelve exacto': ((lambda x: x - 0.5, 0.0, 1.0), 0.5),
    'la raíz es el extremo a': ((lambda x: x * (x - 4), 0.0, 3.0), 0.0),
    'la raíz es el extremo b': ((lambda x: x - 7, 2.0, 7.0), 7.0),
}, comparador=_cerca(1e-9))
grupo('biseccion (tolerancia, coste y errores)')
comprueba('tol grande: se detiene pronto pero dentro de tol', lambda: abs(biseccion(lambda x: x * x - 2, 0.0, 2.0, 1e-3) - math.sqrt(2)) <= 1e-3, True)
comprueba('devuelve un float', lambda: type(biseccion(lambda x: x - 3, 0, 10)).__name__, 'float')
comprueba('f(a) y f(b) se evalúan una vez y luego una por iteración (≤ 46)', lambda: (lambda g: (biseccion(g, 0.0, 2.0), g.llamadas)[1] <= 46)(_contar(lambda x: x * x - 2)), True)
comprueba('tol por debajo de la resolución del float: acaba igual', lambda: abs(biseccion(lambda x: x - 123456.789, 0.0, 1e6, 1e-15) - 123456.789) < 1e-9, True)
lanza('mismo signo en los extremos: x² + 1', lambda: biseccion(lambda x: x * x + 1, -1.0, 1.0), ValueError)
lanza('mismo signo, los dos positivos', lambda: biseccion(lambda x: x * x - 2, 2.0, 3.0), ValueError)
lanza('a >= b', lambda: biseccion(lambda x: x, 1.0, 0.0), ValueError)
lanza('a == b', lambda: biseccion(lambda x: x, 1.0, 1.0), ValueError)

prueba('raiz_entera', {
    'cero': (0, 0),
    'uno': (1, 1),
    'dos: ⌊√2⌋ = 1': (2, 1),
    'cuadrado perfecto pequeño': (49, 7),
    'un menos que un cuadrado perfecto': (48, 6),
    'cuadrado perfecto 10**40': (10 ** 40, 10 ** 20),
    'justo antes: 10**40 - 1': (10 ** 40 - 1, 10 ** 20 - 1),
    'justo después: 10**40 + 1': (10 ** 40 + 1, 10 ** 20),
    'no es cuadrado: 2·10**40': (2 * 10 ** 40, 141421356237309504880),
    'trampa de float: (10**17 + 1)²': ((10 ** 17 + 1) ** 2, 10 ** 17 + 1),
    'trampa de float: (10**17 + 1)² - 1': ((10 ** 17 + 1) ** 2 - 1, 10 ** 17),
    'potencia de 2 enorme: 2**200': (2 ** 200, 2 ** 100),
})


def _contra_isqrt() -> bool:
    azar = random.Random(11)
    valores = [azar.getrandbits(azar.randint(1, 300)) for _ in range(400)]
    return all(raiz_entera(v) == math.isqrt(v) for v in valores)


grupo('raiz_entera (tipos y casos límite)')
comprueba('coincide con math.isqrt en 400 enteros de hasta 300 bits', _contra_isqrt, True)
comprueba('devuelve int', lambda: type(raiz_entera(10)).__name__, 'int')
lanza('n negativo', lambda: raiz_entera(-1), ValueError)
lanza('n float', lambda: raiz_entera(4.0), TypeError)

prueba('newton', {
    'x² - 2 desde 1 → √2': ((lambda x: x * x - 2, lambda x: 2 * x, 1.0), math.sqrt(2)),
    'x² - 2 desde -1 → -√2': ((lambda x: x * x - 2, lambda x: 2 * x, -1.0), -math.sqrt(2)),
    'cos x - x desde 1': ((lambda x: math.cos(x) - x, lambda x: -math.sin(x) - 1, 1.0), 0.7390851332151607),
    'x³ - 2x - 5 desde 2 (la ecuación de Newton, 1669)': ((lambda x: x ** 3 - 2 * x - 5, lambda x: 3 * x * x - 2, 2.0), 2.0945514815423265),
    'eˣ - 3 desde 0 → ln 3': ((lambda x: math.exp(x) - 3, math.exp, 0.0), math.log(3)),
    'x0 entero': ((lambda x: x * x - 2, lambda x: 2 * x, 2), math.sqrt(2)),
    'x0 ya es la raíz (aunque f\' = 0 ahí): x²': ((lambda x: x * x, lambda x: 2 * x, 0.0), 0.0),
    'raíz doble (x-1)²: converge, pero lineal (≈ 40 iteraciones)': ((lambda x: (x - 1) ** 2, lambda x: 2 * (x - 1), 2.0), 1.0),
    'arctan desde 1 (dentro de la cuenca)': ((math.atan, lambda x: 1 / (1 + x * x), 1.0), 0.0),
}, comparador=_cerca(1e-9))


def _derivadas_pedidas() -> int:
    df = _contar(lambda x: 2 * x)
    newton(lambda x: x * x - 2, df, 1.0)
    return df.llamadas


grupo('newton (velocidad y casos en que falla)')
comprueba('cuadrática: x² - 2 desde 1 usa ≤ 7 evaluaciones de f\'', lambda: _derivadas_pedidas() <= 7, True)
comprueba('devuelve un float', lambda: type(newton(lambda x: x - 3, lambda x: 1.0, 0)).__name__, 'float')
lanza('f\' = 0 en el arranque: x² - 2 desde 0', lambda: newton(lambda x: x * x - 2, lambda x: 2 * x, 0.0), ZeroDivisionError)
lanza('f\' = 0 a mitad de camino: x² + 1 desde 1 (1 → 0)', lambda: newton(lambda x: x * x + 1, lambda x: 2 * x, 1.0), ZeroDivisionError)
lanza('ciclo 0 → 1 → 0: x³ - 2x + 2 desde 0', lambda: newton(lambda x: x ** 3 - 2 * x + 2, lambda x: 3 * x * x - 2, 0.0), RuntimeError)
lanza('diverge: arctan desde 2 (max_iter = 6)', lambda: newton(math.atan, lambda x: 1 / (1 + x * x), 2.0, max_iter=6), RuntimeError)
lanza('max_iter insuficiente: x² - 2 desde 1 con 3', lambda: newton(lambda x: x * x - 2, lambda x: 2 * x, 1.0, max_iter=3), RuntimeError)
lanza('sin raíz real: x² + 1 desde 2', lambda: newton(lambda x: x * x + 1, lambda x: 2 * x, 2.0, max_iter=30), RuntimeError)

prueba('descenso_1d', {
    'x² con η = 1/4: el error se divide entre 2': ((lambda x: 2 * x, 1.0, 0.25, 3), [1.0, 0.5, 0.25, 0.125]),
    'η = 1/2 = 1/L: un paso y se queda en el mínimo': ((lambda x: 2 * x, 3.0, 0.5, 3), [3.0, 0.0, 0.0, 0.0]),
    'η = 1: rebota entre ±x0 (|1 - ηL| = 1)': ((lambda x: 2 * x, 1.0, 1.0, 4), [1.0, -1.0, 1.0, -1.0, 1.0]),
    'η > 2/L diverge: factor -1.5 por paso': ((lambda x: 2 * x, 1.0, 1.25, 3), [1.0, -1.5, 2.25, -3.375]),
    'pendiente constante: avanza tasa·pendiente por paso': ((lambda x: 1.0, 1.0, 0.125, 3), [1.0, 0.875, 0.75, 0.625]),
    'mínimo desplazado: 2(x - 1)² con η = 0.1': ((lambda x: 4 * (x - 1), 3.0, 0.1, 2), [3.0, 2.2, 1.72]),
    'pasos = 0: solo el punto inicial': ((lambda x: 2 * x, 5.0, 0.1, 0), [5.0]),
    'gradiente 0 en x0: se queda': ((lambda x: 2 * x, 0.0, 0.1, 3), [0.0, 0.0, 0.0, 0.0]),
    'x0 entero: la lista es de float': ((lambda x: 2 * x, 4, 0.25, 2), [4.0, 2.0, 1.0]),
})
grupo('descenso_1d (longitud y errores)')
comprueba('devuelve pasos + 1 valores', lambda: len(descenso_1d(lambda x: 2 * x, 1.0, 0.1, 100)), 101)
comprueba('tasa pequeña: converge con la razón |1 - ηL|^k', lambda: abs(descenso_1d(lambda x: 4 * (x - 1), 3.0, 0.1, 25)[-1] - 1) < 2 * 0.6 ** 25 * 1.01, True)
lanza('pasos negativo', lambda: descenso_1d(lambda x: x, 1.0, 0.1, -1), ValueError)

prueba('minimo_ternario', {
    'parábola (x - 2)² + 1 en [0, 5]': ((lambda x: (x - 2) ** 2 + 1, 0.0, 5.0), 2.0),
    'cos x en [2, 5] → π': ((math.cos, 2.0, 5.0), math.pi),
    '|x - 1| en [-3, 4] (no derivable en el mínimo)': ((lambda x: abs(x - 1), -3.0, 4.0), 1.0),
    'x⁴ - 3x en [0, 2] → (3/4)^(1/3)': ((lambda x: x ** 4 - 3 * x, 0.0, 2.0), 0.9085602964160698),
    'mínimo en el extremo izquierdo: x² en [1, 3]': ((lambda x: x * x, 1.0, 3.0), 1.0),
    'mínimo en el extremo derecho: -x en [0, 1]': ((lambda x: -x, 0.0, 1.0), 1.0),
    'maximizar con -f: sen x en [0, π] → π/2': ((lambda x: -math.sin(x), 0.0, math.pi), math.pi / 2),
    'intervalo con extremos enteros': ((lambda x: (x - 7) ** 2, 0, 10), 7.0),
}, comparador=_cerca(1e-6))
grupo('minimo_ternario (coste y errores)')
comprueba('devuelve un float', lambda: type(minimo_ternario(lambda x: (x - 2) ** 2, 0, 5)).__name__, 'float')
comprueba('2 evaluaciones por iteración (≤ 120 en [0, 5] con tol = 1e-9)', lambda: (lambda g: (minimo_ternario(g, 0.0, 5.0), g.llamadas)[1] <= 120)(_contar(lambda x: (x - 2) ** 2 + 1)), True)
comprueba('tol por debajo de la resolución del float: acaba igual', lambda: abs(minimo_ternario(lambda x: (x - 2) ** 2 + 1, 0.0, 5.0, 1e-300) - 2.0) < 1e-6, True)
lanza('a >= b', lambda: minimo_ternario(lambda x: x, 2.0, 1.0), ValueError)
lanza('a == b', lambda: minimo_ternario(lambda x: x, 1.0, 1.0), ValueError)

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
# Solo se mide el descenso: su coste es lineal en `pasos` (n). Bisección, Newton y ternaria hacen un número casi fijo de
# evaluaciones (dependen de tol, no de n) y raiz_entera está dominada por el coste de los enteros grandes: no hay curva útil.
medir('descenso_1d', lambda n: (math.cos, 1.0, 0.1, n))                # O(n) pasos (la lista de la trayectoria también es O(n))
