"""
TEMA 13 · SERIES Y TAYLOR
─────────────────────────────────────────────────────────────────
Una serie es una suma de infinitos términos, y casi todo el análisis de algoritmos es sumar series: el coste de un bucle
doble, el coste amortizado de un array dinámico, la criba de Eratóstenes. Y casi todo el cálculo numérico es Taylor: así
calcula un ordenador exp o sin, y de ahí salen Newton y el descenso de gradiente. Esta lección convierte las guías
«Sucesiones y series» y «Series de potencias y Taylor» en código.

  Concepto               Qué es                                               Trampa típica
  serie armónica         H_n = 1 + 1/2 + ... + 1/n ≈ ln n + γ, diverge        creer que «los términos → 0» basta para
                         pero de forma lentísima (logarítmica)                 converger: aquí → 0 y diverge
  serie geométrica       Σ r^k = (1 - r^n)/(1 - r) · converge si |r| < 1       la fórmula divide entre 0 si r = 1 (la suma es n)
  amortizado             coste medio por operación sobre TODA la secuencia     «una operación cuesta O(n)» no es «todas cuestan O(n)»
  polinomio de Taylor    P_N(x) = Σ f⁽ᵏ⁾(0)·xᵏ/k! con N términos               más términos NO siempre mejora: fuera del radio
                                                                              de convergencia empeora
  resto de Lagrange      R_N = f⁽ᴺ⁾(c)·xᴺ/N! con c entre 0 y x: cota del       confundir «error ≤ cota» con «error = cota»:
                         error de truncar tras N términos                      la cota se calcula SIN conocer el error real
  radio de convergencia  R tal que Σ aₖxᵏ converge si |x| < R                  1/(1-x) y ln(1+x) tienen R = 1 aunque la función
                                                                              esté definida más allá
  reducción de rango     llevar x a [-π, π] antes de sumar la serie            sumar sin(100) con Taylor directo: los términos
                                                                              llegan a ~1e42 y el resultado es basura

Costes: «para cada i, recorrer sus múltiplos ≤ n» hace Σ n/i = n·H_n = O(n log n) pasos. Duplicar la capacidad de un array
dinámico hace n appends en O(n) en total (O(1) amortizado); crecer de k en k hace O(n²/k) copias. Sumar N términos de
Taylor cuesta O(N), y N depende de la tolerancia pedida.
"""
import math
import sys

import matplotlib.pyplot as plt
import numpy as np


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. LA SERIE ARMÓNICA Y EL COSTE DE UN BUCLE DOBLE
# ═════════════════════════════════════════════════════════════════
# H_n = 1 + 1/2 + ... + 1/n. Comparando con la integral de 1/x: ln(n+1) < H_n < 1 + ln n. Más fino:
#   H_n = ln n + γ + 1/(2n) - 1/(12n²) + ...      con γ = 0.5772156649... (constante de Euler-Mascheroni)
titulo('1. Serie armónica: crece como ln n + γ')

GAMMA = 0.5772156649015329
ks = np.arange(1, 1_000_001)
H = np.cumsum(1.0 / ks)                                    # H[n-1] = H_n, de golpe para todos los n hasta 10^6

print(f'{"n":>9} {"H_n":>12} {"ln n + γ":>12} {"diferencia":>12} {"1/(2n)":>10}')
for n in (1, 10, 100, 1000, 10_000, 100_000, 1_000_000):
    aprox = math.log(n) + GAMMA
    print(f'{n:9d} {H[n - 1]:12.6f} {aprox:12.6f} {H[n - 1] - aprox:12.2e} {1 / (2 * n):10.2e}')
# La diferencia coincide con 1/(2n): el primer término de la corrección. Los términos → 0 y aun así la suma NO converge.

# Diverge, pero tan despacio que cuesta imaginarlo: H_n = S exige n ≈ e^(S - γ) términos.
for S in (10, 20, 100):
    print(f'para que H_n supere {S:3d} hacen falta n ≈ {math.exp(S - GAMMA):.3g} términos')

# Por qué importa en algoritmos: «para cada i de 1 a n, recorrer los múltiplos de i hasta n» hace n/i pasos para cada i.
#   Σ_{i=1..n} n/i = n·H_n ≈ n ln n  →  O(n log n)    (no O(n²): la mayoría de los i recorren muy poco)
# La criba de Eratóstenes solo tacha desde p² y solo para los primos p ≤ √n: sale ≈ n ln ln n, casi lineal.
print(f'\n{"n":>9} {"pasos divisores":>16} {"n·H_n":>13} {"pasos Eratóstenes":>18} {"n·ln ln n":>11}')
for k in (3, 4, 5, 6):
    n = 10 ** k
    pasos_div = int((n // np.arange(1, n + 1)).sum())      # Σ floor(n/i): lo que hace el bucle «para cada i, sus múltiplos»
    es_primo = np.ones(n + 1, dtype=bool)
    es_primo[:2] = False
    marcas = 0
    for p in range(2, math.isqrt(n) + 1):
        if es_primo[p]:
            marcas += (n - p * p) // p + 1                 # múltiplos de p desde p² hasta n
            es_primo[p * p::p] = False
    print(f'{n:9d} {pasos_div:16d} {n * H[n - 1]:13.0f} {marcas:18d} {n * math.log(math.log(n)):11.0f}')
# Los pasos de divisores son n·H_n menos ~n/2 (el suelo de n/i pierde ½ por cada i); los de Eratóstenes quedan por debajo de
# n·ln ln n (tachan desde p²) y crecen mucho más despacio que n log n.

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.8))
m = np.arange(1, 41)
ax1.step(m, H[:40], where='post', label='H_n (escalones)', color='tab:blue')
ax1.plot(m, np.log(m) + GAMMA, '--', label='ln n + γ', color='tab:orange')
ax1.set_title('H_n crece como un logaritmo')
ax1.set_xlabel('n')
ax1.legend()
paso = np.unique(np.logspace(0, 6, 60).astype(int))
dif = H[paso - 1] - (np.log(paso) + GAMMA)
ax2.loglog(paso, dif, 'o', ms=3, label='H_n - (ln n + γ)', color='tab:blue')
ax2.loglog(paso, 1 / (2 * paso), '-', label='1/(2n)', color='tab:orange')
ax2.set_title('El error de ln n + γ es 1/(2n)')
ax2.set_xlabel('n')
ax2.legend()
fig.tight_layout()
plt.show()                                 # la gráfica aparece en el panel Salida


# ═════════════════════════════════════════════════════════════════
# 2. LA SERIE GEOMÉTRICA Y EL ARRAY DINÁMICO
# ═════════════════════════════════════════════════════════════════
# Σ_{k=0..m} r^k = (r^(m+1) - 1)/(r - 1). Con r = 2: 1 + 2 + 4 + ... + 2^m = 2^(m+1) - 1 < 2·2^m.
# Un array dinámico (list.append, vector::push_back) tiene una capacidad: cuando se llena, reserva el doble y COPIA todo.
# Para n appends las copias son 1 + 2 + 4 + ... + (último tamaño lleno) < 2n: O(1) amortizado por append, aunque uno solo cueste O(n).
# Si en vez de multiplicar la capacidad se SUMA una constante k, las copias son k + 2k + 3k + ... ≈ n²/(2k): O(n²).
titulo('2. Array dinámico: duplicar frente a crecer de k en k')


def simular_appends(n: int, crecer, capacidad: int = 1) -> int:
    """Cuenta los elementos copiados al hacer n appends; `crecer(cap)` da la capacidad nueva cuando se llena."""
    copias = 0
    for largo in range(n):                                 # largo = elementos ya guardados antes de este append
        if largo == capacidad:
            copias += largo                                # reservar un bloque nuevo y copiar los `largo` elementos
            capacidad = crecer(capacidad)
    return copias


print(f'{"n":>9} {"copias ×2":>11} {"/ n":>6} {"copias +64":>12} {"/ n":>9}')
for n in (1000, 10_000, 100_000, 1_000_000):
    c2 = simular_appends(n, lambda c: c * 2)
    c64 = simular_appends(n, lambda c: c + 64, capacidad=64)
    print(f'{n:9d} {c2:11d} {c2 / n:6.2f} {c64:12d} {c64 / n:9.1f}')
# ×2: copias/n se queda por debajo de 2 (constante). +64: copias/n crece con n (≈ n/128): cada append «cuesta» cada vez más.

# Cualquier factor g > 1 da O(1) amortizado: las copias son una geométrica de razón 1/g y suman ≤ n·g/(g-1).
print(f'\n{"factor g":>9} {"copias / n":>11} {"cota g/(g-1)":>13}')
for g in (1.125, 1.5, 2.0, 4.0):
    c = simular_appends(100_000, lambda cap: max(cap + 1, math.ceil(cap * g)))
    print(f'{g:9.3f} {c / 100_000:11.2f} {g / (g - 1):13.2f}')
# Tradeoff: g pequeño gasta menos memoria sobrante pero copia más; g grande al revés. CPython usa ~1.125; C++ suele usar 1.5 o 2.

lista, tam, realocaciones = [], sys.getsizeof([]), 0
for i in range(100_000):
    lista.append(i)
    if sys.getsizeof(lista) != tam:                        # el tamaño en bytes solo cambia cuando CPython realoca
        tam, realocaciones = sys.getsizeof(lista), realocaciones + 1
print(f'\nCPython: 100000 appends reservaron memoria {realocaciones} veces (con +64 serían ~1500: crecer proporcional gana)')


# ═════════════════════════════════════════════════════════════════
# 3. TAYLOR: POLINOMIOS QUE APROXIMAN, CON SU COTA DE ERROR
# ═════════════════════════════════════════════════════════════════
# Una función suave se parece cerca de 0 a un polinomio: f(x) ≈ Σ f⁽ᵏ⁾(0)·xᵏ/k!. Para exp todas las derivadas valen 1:
#   exp(x) ≈ 1 + x + x²/2! + x³/3! + ...        sin(x) ≈ x - x³/3! + x⁵/5! - ...
# Cada término sale del anterior con UNA multiplicación (term *= x/(k+1)): sin factoriales ni potencias, O(N) en total.
# Resto de Lagrange: si truncas tras N términos (hasta xᴺ⁻¹), el error es R_N = f⁽ᴺ⁾(c)·xᴺ/N! para algún c entre 0 y x.
# Para exp, |f⁽ᴺ⁾(c)| = e^c ≤ e^max(x,0); para sin y cos, |f⁽ᴺ⁾| ≤ 1. Es una COTA calculable sin saber el error real.
titulo('3. Taylor de exp y sin; resto de Lagrange')


def exp_poli(x, n: int):
    """Suma de los n primeros términos de la serie de exp (grado n-1). Vale para floats y para arrays de numpy."""
    suma, term = 0.0, 1.0
    for k in range(n):
        suma += term
        term *= x / (k + 1)
    return suma


def sin_poli(x, n: int):
    """Suma de los n primeros términos NO nulos de la serie de sin: x - x³/3! + x⁵/5! - ..."""
    suma, term = 0.0, x + 0.0                              # x + 0.0 copia el array: `term *= ...` es in situ y no debe tocar x
    for k in range(n):
        suma += term
        term *= -x * x / ((2 * k + 2) * (2 * k + 3))
    return suma


x = 1.5
print(f'exp({x}) = {math.exp(x):.12f}')
print(f'{"términos N":>10} {"error real":>12} {"cota Lagrange":>14}')
for N in range(1, 11):
    real = abs(math.exp(x) - exp_poli(x, N))
    cota = math.exp(max(x, 0.0)) * abs(x) ** N / math.factorial(N)
    print(f'{N:10d} {real:12.3e} {cota:14.3e}   {"cota ≥ error" if cota >= real else "¡NO!"}')
# La cota es pesimista (usa e^x en vez de e^c) pero siempre cubre el error, y baja como xᴺ/N!: factorial gana a cualquier potencia.

xs = np.linspace(-3, 3, 400)
plt.figure(figsize=(7, 4))
plt.plot(xs, np.exp(xs), 'k', linewidth=2, label='exp(x)')
for N, color in ((2, 'tab:red'), (3, 'tab:orange'), (4, 'tab:olive'), (6, 'tab:green'), (9, 'tab:blue')):
    plt.plot(xs, exp_poli(xs, N), color=color, linewidth=1, label=f'grado {N - 1}')
plt.ylim(-2, 12)
plt.title('Polinomios de Taylor de exp: cada grado extiende el ajuste')
plt.xlabel('x')
plt.legend()
plt.show()

# Reducción de rango. En teoría la serie de sin converge para todo x; en un float64 NO. Para x = 100 el término x^k/k! llega a
# ~1e42 antes de decrecer, y la suma debe cancelarse hasta dar un número en [-1, 1]: se pierden TODAS las cifras (cancelación
# catastrófica, lección 10). La solución es no sumar con x grande: sin es periódica, así que se usa x - 2π·round(x/2π) en [-π, π].
titulo('3b. Por qué sin(100) con Taylor directo falla')


def sin_directo(x: float, n: int = 300) -> tuple:
    suma, term, mayor = 0.0, x, abs(x)
    for k in range(n):
        suma += term
        term *= -x * x / ((2 * k + 2) * (2 * k + 3))
        mayor = max(mayor, abs(term))
    return suma, mayor


print(f'{"x":>6} {"error directo":>14} {"término mayor":>14} {"error con reducción":>20}')
for x in (5.0, 10.0, 20.0, 40.0, 70.0, 100.0):
    directo, mayor = sin_directo(x)
    reducido = sin_poli(x - 2 * math.pi * round(x / (2 * math.pi)), 25)
    print(f'{x:6.0f} {abs(directo - math.sin(x)):14.2e} {mayor:14.2e} {abs(reducido - math.sin(x)):20.2e}')
# error directo ≈ eps · (término mayor): crece como e^x/√x. Con reducción el error se queda en ~1e-16 para cualquier x.

xs = np.linspace(0, 60, 241)
red = xs - 2 * math.pi * np.round(xs / (2 * math.pi))
plt.figure(figsize=(7, 4))
plt.semilogy(xs, np.maximum(np.abs(sin_poli(xs, 200) - np.sin(xs)), 1e-17), label='Taylor directo', color='tab:red')
plt.semilogy(xs, np.maximum(np.abs(sin_poli(red, 25) - np.sin(xs)), 1e-17), label='con reducción a [-π, π]', color='tab:blue')
plt.title('Error de sin(x) por Taylor: la cancelación crece como e^x')
plt.xlabel('x')
plt.ylabel('error absoluto')
plt.legend()
plt.show()


# ═════════════════════════════════════════════════════════════════
# 4. TAYLOR POR DEBAJO DE NEWTON, DEL DESCENSO DE GRADIENTE Y DEL RADIO DE CONVERGENCIA
# ═════════════════════════════════════════════════════════════════
# Minimizar f cerca de x: f(x+d) ≈ f + f'·d + ½f''·d².  Con SOLO el término de orden 1 no hay mínimo (es una recta): se avanza
# contra el gradiente un paso lr elegido a mano, d = -lr·f'  → descenso de gradiente. Con el orden 2 sí hay mínimo, en d = -f'/f''
# → método de Newton (la misma fórmula que para hallar raíces, aplicada a f'). Más orden = menos pasos, pero cada paso pide f''.
titulo('4. Newton y descenso de gradiente son Taylor de orden 2 y 1')

df1, df2 = (lambda x: math.exp(x) - 2), math.exp          # f(x) = eˣ - 2x, mínimo en ln 2 (f' = 0)
xn = xg = 2.0
print(f'{"paso":>4} {"error Newton":>13} {"error gradiente (lr=0.3)":>25}')
for paso in range(8):
    print(f'{paso:4d} {abs(xn - math.log(2)):13.2e} {abs(xg - math.log(2)):25.2e}')
    xn -= df1(xn) / df2(xn)
    xg -= 0.3 * df1(xg)
# Newton duplica las cifras correctas en cada paso (convergencia cuadrática); el gradiente gana un factor constante (~0.4).

# Y la estabilidad: para f = (L/2)x² el gradiente hace x ← (1 - lr·L)·x. Converge solo si |1 - lr·L| < 1, es decir lr < 2/L
# (L = f'' es la curvatura: cuanto más curva la función, más pequeño debe ser el paso).
# Newton en una cuadrática es exacto en UN paso: Taylor de orden 2 no tiene resto.
print(f'\n{"lr·L":>5} {"x tras 10 pasos (x₀=1)":>24}')
for lr_L in (0.5, 1.0, 1.9, 2.1):
    print(f'{lr_L:5.1f} {(1 - lr_L) ** 10:24.3e}')

# Radio de convergencia. 1/(1-x) = Σ xᵏ y ln(1+x) = x - x²/2 + x³/3 - ... tienen radio R = 1: fuera de |x| < 1 la serie DIVERGE
# aunque la función esté perfectamente definida (ln 2.5 existe; su serie en x = 1.5 explota). exp y sin tienen R = ∞.
titulo('4b. Radio de convergencia')


def parcial_geom(x: float, n: int) -> float:
    return sum(x ** k for k in range(n))


def parcial_log(x: float, n: int) -> float:
    return sum((-1) ** (k + 1) * x ** k / k for k in range(1, n + 1))


print(f'{"1/(1-x)":>9} {"N=10":>11} {"N=50":>11} {"N=200":>11} {"exacto":>11}')
for x in (0.5, 0.9, 1.1, -1.1):
    print(f'{"x=" + str(x):>9} ' + ' '.join(f'{parcial_geom(x, N):11.4g}' for N in (10, 50, 200)) + f' {1 / (1 - x):11.4g}')
print(f'\n{"ln(1+x)":>9} {"N=10":>11} {"N=50":>11} {"N=200":>11} {"exacto":>11}')
for x in (0.5, 1.0, 1.5):
    print(f'{"x=" + str(x):>9} ' + ' '.join(f'{parcial_log(x, N):11.4g}' for N in (10, 50, 200)) + f' {math.log1p(x):11.4g}')
# x = 1 está en el borde: converge a ln 2 pero muy despacio (error ~ 1/N). Más allá de R las sumas parciales se disparan.


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · armonico ──────────────────────────────────────
def armonico(n: int) -> float:
    """
    Número armónico H_n = 1 + 1/2 + ... + 1/n, como float.
      armonico(0) → 0.0 (suma vacía) · armonico(1) → 1.0 · armonico(4) → 25/12 ≈ 2.0833333333333335
      n < 0 → ValueError.
    Suma desde el término más pequeño (1/n) hasta 1: sumar primero lo pequeño pierde menos cifras. Coste: O(n).
    """
    pendiente()


# ── Ejercicio 2 · geometrica ────────────────────────────────────
def geometrica(r: float, n: int) -> float:
    """
    Suma de los n primeros términos de la serie geométrica: r^0 + r^1 + ... + r^(n-1), con la fórmula CERRADA, sin bucle.
      r ≠ 1 → (r^n - 1) / (r - 1)       r = 1 → n (la fórmula daría 0/0)
      geometrica(2, 10) → 1023.0 · geometrica(0.5, 5) → 1.9375 · geometrica(1, 7) → 7.0 · geometrica(5, 0) → 0.0
    n < 0 → ValueError. Devuelve float. Coste: O(1) (una potencia). Con r muy cerca de 1 pierde cifras: r^n - 1 es una resta.
    """
    pendiente()


# ── Ejercicio 3 · suma_multiplos ────────────────────────────────
def suma_multiplos(n: int) -> list:
    """
    Recorre «para cada i de 1 a n, todos los múltiplos de i que sean ≤ n» y devuelve, para cada k, cuántos i lo recorrieron,
    es decir, el número de divisores de k: lista `d` de longitud n + 1 con d[0] = 0 y d[k] = nº de divisores de k.
      suma_multiplos(10) → [0, 1, 2, 2, 3, 2, 4, 2, 4, 3, 4]
      suma_multiplos(0) → [0] · suma_multiplos(1) → [0, 1] · n < 0 → ValueError
    Hazlo con DOS bucles anidados (i, y luego j = i, 2i, 3i... ≤ n) sin calcular módulos: el total de pasos es sum(d) = n·H_n.
    Coste: O(n log n) en tiempo, O(n) en espacio.
    """
    pendiente()


# ── Ejercicio 4 · copias_al_crecer ──────────────────────────────
def copias_al_crecer(n: int, factor: float) -> int:
    """
    Elementos copiados en TOTAL al hacer n appends sobre un array dinámico que crece multiplicando la capacidad.
    Modelo exacto: la capacidad inicial es 1 y el array empieza vacío. Un append con el array lleno (largo == capacidad)
    reserva una capacidad nueva max(capacidad + 1, ceil(capacidad · factor)) y copia los `largo` elementos que había.
      copias_al_crecer(5, 2) → 7  (copias de 1, 2 y 4 elementos) · copias_al_crecer(9, 1.5) → 19 · copias_al_crecer(1, 2) → 0
    factor ≤ 1 → ValueError, n < 0 → ValueError. Simula los n appends: O(n) tiempo, O(1) espacio.
    Con factor = 2 el total es siempre < 2n: O(1) amortizado por append.
    """
    pendiente()


# ── Ejercicio 5 · copias_en_pasos ───────────────────────────────
def copias_en_pasos(n: int, paso: int) -> int:
    """
    Igual que copias_al_crecer pero la capacidad crece SUMANDO: capacidad inicial = paso, y al llenarse pasa a capacidad + paso.
      copias_en_pasos(10, 3) → 18  (copias de 3, 6 y 9 elementos) · copias_en_pasos(3, 3) → 0
      copias_en_pasos(1000, 10) → 49500
    paso < 1 → ValueError, n < 0 → ValueError. Simula los n appends: O(n) tiempo. El TOTAL de copias es O(n²/paso): compáralo
    con copias_al_crecer para ver por qué las listas reales no crecen de k en k.
    """
    pendiente()


# ── Ejercicio 6 · exp_taylor ────────────────────────────────────
def exp_taylor(x: float, terminos: int) -> float:
    """
    Suma de los `terminos` primeros términos de la serie de exp: 1 + x + x²/2! + ... + x^(terminos-1)/(terminos-1)!.
      exp_taylor(1, 4) → 2.6666666666666665 (1 + 1 + 1/2 + 1/6) · exp_taylor(2, 3) → 5.0 · exp_taylor(x, 0) → 0.0
    terminos < 0 → ValueError. Devuelve float. Cada término sale del anterior multiplicando por x/k (sin math.factorial ni
    x ** k: desbordarían para terminos grandes). Coste: O(terminos).
    """
    pendiente()


# ── Ejercicio 7 · sin_taylor ────────────────────────────────────
def sin_taylor(x: float, tol: float = 1e-12) -> float:
    """
    sin(x) por su serie de Taylor, con reducción de rango y parada por cota de error. Pasos:
      1. Reducción: x ← x - 2π·round(x / 2π), que lo lleva a [-π, π].
      2. Suma x - x³/3! + x⁵/5! - ... sacando cada término del anterior con term *= -x²/((2k)(2k+1)).
      3. Para en cuanto el siguiente término cumpla |término| < tol, SIN sumarlo: por el resto de Lagrange (|sin⁽ⁿ⁾| ≤ 1) ese
         término ya acota el error de lo sumado.
    x no finito (inf, nan) → ValueError; tol ≤ 0 → ValueError. Devuelve float. sin_taylor(0) → 0.0.
    Coste: O(log(1/tol)) términos, independiente de |x| gracias a la reducción.
    """
    pendiente()


# ── Ejercicio 8 · terminos_para_error ───────────────────────────
def terminos_para_error(x: float, tol: float) -> int:
    """
    Menor N ≥ 0 tal que truncar la serie de exp tras N términos (grado N-1) garantiza error < tol según el resto de Lagrange:
      cota(N) = e^max(x, 0) · |x|^N / N!  < tol           (con 0^0 = 1: cota(0) = e^max(x, 0))
      terminos_para_error(1, 1e-3) → 7 · terminos_para_error(1, 1e-6) → 10 · terminos_para_error(0, 1e-9) → 1
      terminos_para_error(2, 1e-6) → 15 · terminos_para_error(-1, 1e-6) → 10   (para x < 0 el factor e^c ≤ 1)
    tol ≤ 0 → ValueError. Calcula |x|^N/N! iterativamente (t *= |x|/N), sin factoriales. Coste: O(N).
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS (los resultados aproximados se comparan con una tolerancia explícita)
# ═════════════════════════════════════════════════════════════════

def _cerca(tolerancia: float):
    """Comparador para `prueba`: |actual - esperado| <= tolerancia (relativa a max(1, |esperado|))."""
    def comparar(actual, esperado) -> bool:
        if isinstance(actual, bool) or not isinstance(actual, (int, float)):
            return False
        return actual == esperado or abs(actual - esperado) <= tolerancia * max(1.0, abs(esperado))
    return comparar


prueba('armonico', {
    'cero términos: suma vacía': ((0,), 0.0),
    'H_1 = 1': ((1,), 1.0),
    'H_2 = 3/2': ((2,), 1.5),
    'H_4 = 25/12': ((4,), 25 / 12),
    'H_10': ((10,), 7381 / 2520),
    'H_1000': ((1000,), 7.485470860550345),
}, comparador=_cerca(1e-12))
grupo('armonico (comportamiento)')
comprueba('H_n ≈ ln n + γ + 1/2n - 1/12n² con n = 10^6',
          lambda: abs(armonico(10 ** 6) - (math.log(10 ** 6) + GAMMA + 1 / (2 * 10 ** 6) - 1 / (12 * 10 ** 12))) < 1e-9, True)
comprueba('crece sin cota: H_100000 > 12', lambda: armonico(100_000) > 12, True)
comprueba('devuelve un float', lambda: type(armonico(3)).__name__, 'float')
lanza('n negativo', lambda: armonico(-1), ValueError)

prueba('geometrica', {
    'r=2, n=10: 2^10 - 1': ((2, 10), 1023.0),
    'r=0.5, n=5': ((0.5, 5), 1.9375),
    'r=1 no usa la fórmula: n': ((1, 7), 7.0),
    'r=1.0 (float)': ((1.0, 3), 3.0),
    'n=0: suma vacía': ((5, 0), 0.0),
    'n=1: solo r^0 = 1': ((3, 1), 1.0),
    'r=-1 alterna: n par → 0': ((-1, 4), 0.0),
    'r=-1 alterna: n impar → 1': ((-1, 5), 1.0),
    'r=0: solo cuenta r^0': ((0, 3), 1.0),
    'r=0.5, n=1000 converge a 1/(1-r) = 2': ((0.5, 1000), 2.0),
}, comparador=_cerca(1e-12))
grupo('geometrica (comportamiento)')
comprueba('devuelve un float', lambda: type(geometrica(2, 3)).__name__, 'float')
lanza('n negativo', lambda: geometrica(2, -1), ValueError)

prueba('suma_multiplos', {
    'n=10: divisores de 1..10': ((10,), [0, 1, 2, 2, 3, 2, 4, 2, 4, 3, 4]),
    'n=0': ((0,), [0]),
    'n=1': ((1,), [0, 1]),
    'n=2: dos divisores el 2': ((2,), [0, 1, 2]),
    'n=12: el 12 tiene 6 divisores': ((12,), [0, 1, 2, 2, 3, 2, 4, 2, 4, 3, 4, 2, 6]),
})
grupo('suma_multiplos (propiedades)')
comprueba('longitud n + 1', lambda: len(suma_multiplos(100)), 101)
comprueba('un primo tiene 2 divisores: d[97] = 2', lambda: suma_multiplos(100)[97], 2)
comprueba('un cuadrado perfecto tiene nº impar de divisores: d[36] = 9', lambda: suma_multiplos(100)[36], 9)
comprueba('pasos totales = Σ floor(n/i)', lambda: sum(suma_multiplos(1000)), sum(1000 // i for i in range(1, 1001)))
comprueba('pasos totales ≈ n·H_n (n = 10^4)', lambda: abs(sum(suma_multiplos(10_000)) / (10_000 * (math.log(10_000) + GAMMA)) - 1) < 0.05, True)
lanza('n negativo', lambda: suma_multiplos(-1), ValueError)

prueba('copias_al_crecer', {
    'factor 2, n=5: 1 + 2 + 4': ((5, 2), 7),
    'factor 2, n=1: ninguna': ((1, 2), 0),
    'factor 2, n=2': ((2, 2), 1),
    'factor 2, n=3': ((3, 2), 3),
    'factor 2, n=4: aún cabe': ((4, 2), 3),
    'factor 2, n=9: 1 + 2 + 4 + 8': ((9, 2), 15),
    'factor 2, n=1025: 2^11 - 1': ((1025, 2), 2047),
    'factor 3, n=10: 1 + 3 + 9': ((10, 3), 13),
    'factor 1.5, n=9: 1+2+3+5+8': ((9, 1.5), 19),
    'n=0: sin appends': ((0, 2), 0),
})
grupo('copias_al_crecer (amortizado)')
comprueba('factor 2: copias < 2n para n = 10000', lambda: copias_al_crecer(10_000, 2) < 20_000, True)
comprueba('factor 2: copias/n acotado también con n = 100000', lambda: copias_al_crecer(100_000, 2) / 100_000 < 2, True)
comprueba('un factor mayor copia menos', lambda: copias_al_crecer(10_000, 4) < copias_al_crecer(10_000, 2), True)
lanza('factor 1 no crece', lambda: copias_al_crecer(10, 1), ValueError)
lanza('n negativo', lambda: copias_al_crecer(-1, 2), ValueError)

prueba('copias_en_pasos', {
    'paso 3, n=10: 3 + 6 + 9': ((10, 3), 18),
    'cabe en la capacidad inicial': ((3, 3), 0),
    'justo un append más': ((4, 3), 3),
    'paso 10, n=1000': ((1000, 10), 49500),
    'paso 1, n=5: 1+2+3+4': ((5, 1), 10),
    'n=0': ((0, 4), 0),
})
grupo('copias_en_pasos (cuadrático)')
comprueba('forma cerrada k·m(m+1)/2 con m = (n-1)//k', lambda: copias_en_pasos(10_000, 100), 100 * 99 * 100 // 2)
comprueba('mucho peor que duplicar (n = 10000, paso 10)', lambda: copias_en_pasos(10_000, 10) > 100 * copias_al_crecer(10_000, 2), True)
comprueba('copias/n crece con n', lambda: copias_en_pasos(100_000, 10) / 100_000 > 5 * copias_en_pasos(10_000, 10) / 10_000, True)
lanza('paso 0', lambda: copias_en_pasos(10, 0), ValueError)
lanza('n negativo', lambda: copias_en_pasos(-1, 3), ValueError)

prueba('exp_taylor', {
    '0 términos: suma vacía': ((1.0, 0), 0.0),
    '1 término: solo el 1': ((5.0, 1), 1.0),
    '2 términos: 1 + x': ((3.0, 2), 4.0),
    '4 términos con x=1: 8/3': ((1.0, 4), 8 / 3),
    'x=2, 3 términos: 1 + 2 + 2': ((2.0, 3), 5.0),
    'x=-1, 4 términos: 1 - 1 + 1/2 - 1/6': ((-1.0, 4), 1 / 3),
    'x=0: siempre 1': ((0.0, 7), 1.0),
    'x=1, 20 términos ≈ e': ((1.0, 20), math.e),
    'x=3, 40 términos ≈ e³': ((3.0, 40), math.exp(3.0)),
    'x=-3 converge aunque alterne: 60 términos': ((-3.0, 60), math.exp(-3.0)),
}, comparador=_cerca(1e-11))
grupo('exp_taylor (comportamiento)')
comprueba('devuelve un float', lambda: type(exp_taylor(1, 3)).__name__, 'float')
comprueba('muchos términos no desbordan: 500 con x=2', lambda: abs(exp_taylor(2.0, 500) - math.exp(2.0)) < 1e-12, True)
lanza('terminos negativo', lambda: exp_taylor(1.0, -1), ValueError)

prueba('sin_taylor', {
    'sin(0) = 0': ((0.0,), 0.0),
    'sin(1)': ((1.0,), math.sin(1.0)),
    'sin(-2.5): función impar': ((-2.5,), math.sin(-2.5)),
    'sin(π) ≈ 0': ((math.pi,), 0.0),
    'sin(π/2) = 1': ((math.pi / 2,), 1.0),
    'sin(10)': ((10.0,), math.sin(10.0)),
    'sin(100): donde Taylor directo falla': ((100.0,), math.sin(100.0)),
    'sin(-100)': ((-100.0,), math.sin(-100.0)),
    'sin(1000)': ((1000.0,), math.sin(1000.0)),
    'sin(1e6)': ((1e6,), math.sin(1e6)),
}, comparador=_cerca(1e-9))
grupo('sin_taylor (tolerancia y casos límite)')
comprueba('tol grande: para pronto, error < tol', lambda: 1e-5 < abs(sin_taylor(1.0, 1e-3) - math.sin(1.0)) < 1e-3, True)
comprueba('tol pequeña: error < 1e-14', lambda: abs(sin_taylor(2.0, 1e-16) - math.sin(2.0)) < 1e-14, True)
comprueba('devuelve un float', lambda: type(sin_taylor(1.0)).__name__, 'float')
lanza('x infinito', lambda: sin_taylor(math.inf), ValueError)
lanza('x nan', lambda: sin_taylor(math.nan), ValueError)
lanza('tol cero', lambda: sin_taylor(1.0, 0.0), ValueError)
lanza('tol negativa', lambda: sin_taylor(1.0, -1e-3), ValueError)


def _exp_ref(x: float, n: int) -> float:                 # referencia independiente del ejercicio exp_taylor
    suma, term = 0.0, 1.0
    for k in range(n):
        suma += term
        term *= x / (k + 1)
    return suma


prueba('terminos_para_error', {
    'x=1, tol 1e-3': ((1.0, 1e-3), 7),
    'x=1, tol 1e-6': ((1.0, 1e-6), 10),
    'x=1, tol 1e-12': ((1.0, 1e-12), 16),
    'x=0: basta el primer término': ((0.0, 1e-9), 1),
    'x=2, tol 1e-6': ((2.0, 1e-6), 15),
    'x=-1: la cota usa e^0 = 1': ((-1.0, 1e-6), 10),
    'tol mayor que la cota inicial (1): 0 términos': ((0.0, 2.0), 0),
})
grupo('terminos_para_error (garantía)')
comprueba('con N términos el error real es menor que tol (varios x)',
          lambda: all(abs(math.exp(x) - _exp_ref(x, terminos_para_error(x, 1e-8))) < 1e-8 for x in (-3.0, -1.0, 0.5, 2.0, 5.0)), True)
comprueba('más |x| pide más términos',
          lambda: terminos_para_error(5.0, 1e-8) > terminos_para_error(1.0, 1e-8), True)
comprueba('tol más estricta pide más términos', lambda: terminos_para_error(1.0, 1e-12) > terminos_para_error(1.0, 1e-6), True)
comprueba('devuelve un int', lambda: type(terminos_para_error(1.0, 1e-6)).__name__, 'int')
lanza('tol cero', lambda: terminos_para_error(1.0, 0.0), ValueError)

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
# suma_multiplos hace n·H_n pasos: O(n log n). copias_al_crecer simula n appends: O(n) (el TOTAL de copias también es lineal,
# esa es la gracia del amortizado). armonico es O(n). copias_en_pasos hace O(n) pasos pero cuenta O(n²/k) copias: el tiempo
# medido no lo refleja, por eso no se mide aquí: lo que crece cuadráticamente es el valor devuelto, no el tiempo.
medir('suma_multiplos', lambda n: (n,))
medir('copias_al_crecer', lambda n: (n, 2))
medir('armonico', lambda n: (n,))
