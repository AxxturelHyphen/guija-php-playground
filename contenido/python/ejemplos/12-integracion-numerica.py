"""
TEMA 12 · INTEGRACIÓN NUMÉRICA Y MONTE CARLO
─────────────────────────────────────────────────────────────────
Casi ninguna integral útil tiene primitiva elemental, y en ML casi todas las que importan (pérdida esperada, evidencia
bayesiana, normalizaciones) viven en dimensión alta. Esta lección convierte las guías de Cálculo «La integral», «Técnicas
de integración», «Aplicaciones de la integral» e «Integrales múltiples» en código: cómo se aproxima una integral con
sumas y por qué cada regla tiene un orden, cómo comprobar una primitiva «de técnica» sin repetir la cuenta a mano, y por
qué Monte Carlo (error ~ 1/√n en cualquier dimensión) gana donde las rejillas se hunden.

  Concepto               Qué es                                               Trampa típica
  suma de Riemann        Σ f(xᵢ*)·h con h = (b-a)/n: la integral como límite   la regla izquierda tiene error O(h): con n = 10
                         de rectángulos finos                                  rectángulos no pasa de 1 cifra
  regla de trapecios     une los puntos con segmentos: h·(f₀/2 + f₁ + ... +   igual de buena que el punto medio (orden 2),
                         fₙ₋₁ + fₙ/2) · error O(h²)                            pero con la constante del error el doble
  regla de Simpson       ajusta parábolas por tríos de puntos · error O(h⁴) ·  n tiene que ser PAR: cada parábola usa 2
                         es (T + 2M)/3, una combinación que cancela el error   subintervalos
  orden del error        p tal que error ≈ C·h^p: la PENDIENTE en log-log      con n enorme el redondeo (~1e-16) tapa la
                         (1, 2, 2 y 4 en las cuatro reglas)                    recta: la pendiente se mide en el medio
  teorema fundamental    si F' = f, entonces ∫ₐᵇ f = F(b) - F(a) · y F' se    F y F + C pasan la misma prueba: una derivada
                         puede comprobar numéricamente                         no ve la constante
  Monte Carlo            ∫ f ≈ (volumen) × media de f en puntos al azar ·      el error baja a la mitad con 4x más puntos,
                         error σ/√n, sin importar la dimensión                 no con 2x: es lento, pero no depende de d
  maldición de la        una rejilla con m puntos por eje cuesta m^d: con un   «más puntos» no arregla d = 8: hace falta
  dimensión              presupuesto fijo, m cae como N^(1/d)                  cambiar de método
  densidad y             P(a ≤ X ≤ b) = ∫ f(x)dx · E[X] = ∫ x·f(x)dx          una densidad puede valer más que 1 (es
  esperanza              (las probabilidades son integrales)                   probabilidad POR UNIDAD, no probabilidad)

Costes: cada regla de n subintervalos evalúa f n+1 veces: O(n) en tiempo; las vectorizadas con numpy dejan el bucle en C.
Con n el error es O(n⁻ᵖ) (p = 1, 2, 2, 4) para integrandos suaves en 1 dimensión. Monte Carlo cuesta O(n) y su error es
O(n^-1/2) en cualquier dimensión; una rejilla producto en d dimensiones cuesta O(m^d) evaluaciones para error O(m⁻ᵖ).
"""
import math

import matplotlib.pyplot as plt
import numpy as np


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. LA INTEGRAL COMO SUMA: RIEMANN, TRAPECIOS, SIMPSON
# ═════════════════════════════════════════════════════════════════
# ∫ₐᵇ f(x)dx es el área bajo f. Se parte [a, b] en n trozos de ancho h = (b-a)/n y se sustituye f en cada trozo por algo
# fácil de integrar. Qué se elige en cada trozo es lo que fija el orden del error:
#   izquierda / punto medio : una constante (f en el extremo izquierdo / en el centro del trozo)    → O(h) / O(h²)
#   trapecios               : una recta por los dos extremos                                        → O(h²)
#   Simpson                 : una parábola por extremos y centro (necesita 2 subintervalos)         → O(h⁴)
# Por Taylor, el error global de cada regla es C·h^p·(b-a)·|f^(p)|: derivadas de orden p más altas, más precisión.
titulo('1. La integral como suma (f = eˣ en [0, 1], exacta e - 1)')


def demo_izquierda(f, a, b, n):
    return (b - a) / n * f(np.linspace(a, b, n + 1)[:-1]).sum()


def demo_medio(f, a, b, n):
    return (b - a) / n * f(a + (np.arange(n) + 0.5) * (b - a) / n).sum()


def demo_trapecios(f, a, b, n):
    y = f(np.linspace(a, b, n + 1))
    return (b - a) / n * (y.sum() - (y[0] + y[-1]) / 2)           # los extremos pesan la mitad: cada uno toca 1 solo trapecio


def demo_simpson(f, a, b, n):
    y = f(np.linspace(a, b, n + 1))
    return (b - a) / n / 3 * (y[0] + y[-1] + 4 * y[1:-1:2].sum() + 2 * y[2:-1:2].sum())   # pesos 1, 4, 2, 4, ..., 4, 1


DEMO = {'izquierda': demo_izquierda, 'punto medio': demo_medio, 'trapecios': demo_trapecios, 'Simpson': demo_simpson}
exacta = math.e - 1
ns = 2 ** np.arange(1, 10)                                                 # n = 2, 4, ..., 512 (siempre par: Simpson lo exige)
errores = {nombre: np.array([abs(regla(np.exp, 0.0, 1.0, int(n)) - exacta) for n in ns]) for nombre, regla in DEMO.items()}

print(f'{"n":>5}' + ''.join(f'{nombre:>14}' for nombre in DEMO))
for i, n in enumerate(ns[:8]):
    print(f'{n:5d}' + ''.join(f'{errores[nombre][i]:14.3e}' for nombre in DEMO))
print('al duplicar n (error de n=16 / error de n=32):',
      {nombre: round(float(e[3] / e[4]), 1) for nombre, e in errores.items()})
# Duplicar n divide h entre 2 y el error entre 2^p: ~2 (orden 1), ~4 (orden 2) y ~16 (orden 4). Esa es la lectura rápida del orden.

# Gráfica log-log: error = C·h^p con h ∝ 1/n, así que log(error) = log C - p·log n: una recta de pendiente -p. Se ajusta solo
# donde manda el truncamiento (n entre 4 y 64): con n grande Simpson llega a ~1e-15 y lo que se ve es el redondeo.
zona = (ns >= 4) & (ns <= 64)
ordenes = {nombre: -np.polyfit(np.log10(ns[zona]), np.log10(np.maximum(e[zona], 1e-17)), 1)[0] for nombre, e in errores.items()}
print('orden medido (pendiente en log-log):', {nombre: round(float(p), 2) for nombre, p in ordenes.items()})
print('trapecios frente a punto medio: error', round(float(errores['trapecios'][3] / errores['punto medio'][3]), 2),
      'veces mayor (teoría: 2; mismas potencias de h, constantes 1/12 y 1/24)')

# Simpson no es una regla «distinta»: es la combinación (T + 2M)/3 con T y M de m = n/2 trozos. El error de T (+h²/12·f'')
# y el de M (-h²/24·f'') van con signo opuesto y en proporción 2 a 1: la mezcla 1:2 anula el término en h² (extrapolación
# de Richardson), y lo que sobrevive es O(h⁴).
m = 8
combinada = (demo_trapecios(np.exp, 0.0, 1.0, m) + 2 * demo_medio(np.exp, 0.0, 1.0, m)) / 3
print(f'(T + 2M)/3 con m={m}: {combinada:.12f} · Simpson con n={2 * m}: {demo_simpson(np.exp, 0.0, 1.0, 2 * m):.12f}')

plt.figure(figsize=(7, 4))
colores = {'izquierda': 'tab:red', 'punto medio': 'tab:green', 'trapecios': 'tab:orange', 'Simpson': 'tab:blue'}
for nombre, e in errores.items():
    plt.loglog(ns, np.maximum(e, 1e-17), 'o-', color=colores[nombre], label=f'{nombre}: pendiente ≈ -{ordenes[nombre]:.1f}')
plt.loglog(ns, 1 / ns, '--', color='gray', linewidth=0.8, label='referencias n⁻¹, n⁻², n⁻⁴')
plt.loglog(ns, 1 / ns ** 2, '--', color='gray', linewidth=0.8)
plt.loglog(ns, 1 / ns ** 4, '--', color='gray', linewidth=0.8)
plt.ylim(1e-17, 1)
plt.title('Error de ∫₀¹ eˣ dx: la pendiente en log-log es el orden de la regla')
plt.xlabel('n (subintervalos)')
plt.ylabel('error absoluto')
plt.legend(fontsize=8)
plt.show()                                 # la gráfica aparece en el panel Salida
# Más precisión por evaluación: con n = 32, Simpson (33 evaluaciones) ya baja de 1e-8; la izquierda con 1000 no lo consigue.
# Pero el orden alto exige f suave: con una esquina o una singularidad (√x en 0) Simpson degrada su orden y se acerca al resto.


# ═════════════════════════════════════════════════════════════════
# 2. TEOREMA FUNDAMENTAL: COMPROBAR UNA PRIMITIVA SIN HACER LA CUENTA
# ═════════════════════════════════════════════════════════════════
# Si F' = f en [a, b], entonces ∫ₐᵇ f = F(b) - F(a). Las técnicas (sustitución trigonométrica, por partes, fracciones
# simples) producen un candidato F, y es fácil equivocarse. Pero F' se calcula numéricamente (lección 10) y se compara con f:
# si coinciden en toda una rejilla, F es una primitiva (salvo una constante, que la derivada no ve).
titulo('2. Teorema fundamental: ¿es F una primitiva de f?')


def derivada_num(F, x, h=1e-5):
    return (F(x + h) - F(x - h)) / (2 * h)                                 # diferencia centrada, vectorizada


def discrepancia(F, f, a, b):
    x = np.linspace(a, b, 22)[1:-1]                                        # solo puntos interiores: F(x ± h) existe
    return float(np.max(np.abs(derivada_num(F, x) - f(x))))


# Caso real de «técnica»: ∫ dx/√(x²+9). Con x = 3·tan θ sale ln(x + √(x²+9)) + C (la guía «Técnicas de integración»).
f_raiz = lambda x: 1 / np.sqrt(x ** 2 + 9)
candidatos = {
    'ln(x + √(x²+9))': lambda x: np.log(x + np.sqrt(x ** 2 + 9)),
    'arcsinh(x/3)  [= la anterior - ln 3]': lambda x: np.arcsinh(x / 3),
    'ln(x + 3)  [error típico al sustituir]': lambda x: np.log(x + 3),
    '½·ln(x + √(x²+9))  [falta un factor]': lambda x: 0.5 * np.log(x + np.sqrt(x ** 2 + 9)),
}
for nombre, F in candidatos.items():
    d = discrepancia(F, f_raiz, 0.0, 6.0)
    print(f'{nombre:42s} max|F\' - f| = {d:9.2e} → {"primitiva" if d < 1e-6 else "NO es primitiva"}')
# Los dos primeros pasan con ~1e-11 (el error de la diferencia centrada): arcsinh(x/3) y ln(x+√(x²+9)) difieren en una
# constante, y ambas son primitivas legítimas. Por eso la integral definida usa F(b) - F(a): la constante se cancela.

# Con una primitiva válida, la integral definida es F(b) - F(a): se contrasta con un método numérico independiente.
F_ok = candidatos['ln(x + √(x²+9))']
paso = 200
print(f'\n∫₀⁴ dx/√(x²+9): F(4) - F(0) = {F_ok(4.0) - F_ok(0.0):.12f} (= ln 3) · Simpson n={paso}: '
      f'{demo_simpson(f_raiz, 0.0, 4.0, paso):.12f}')

# Por partes: ∫ x·eˣ dx = (x - 1)·eˣ + C. El fallo clásico es olvidar el término de la integral restante (x·eˣ a secas).
f_partes = lambda x: x * np.exp(x)
print(f"por partes: (x-1)eˣ → {discrepancia(lambda x: (x - 1) * np.exp(x), f_partes, -2.0, 2.0):.1e} · "
      f"x·eˣ → {discrepancia(lambda x: x * np.exp(x), f_partes, -2.0, 2.0):.1e}")

# La otra dirección del teorema: F(x) = ∫₀ˣ f(t)dt (integral acumulada) cumple F' = f. Se construye F con trapecios acumulados
# y se deriva: la derivada devuelve el integrando. Derivar e integrar son operaciones inversas, y esto lo confirma.
x = np.linspace(0, 2 * math.pi, 2001)
paso_x = x[1] - x[0]
F_acum = np.concatenate(([0.0], np.cumsum((np.cos(x[1:]) + np.cos(x[:-1])) / 2 * paso_x)))   # ∫₀ˣ cos t dt, trapecio a trapecio
print(f'F acumulada frente a sin(x): max error {np.max(np.abs(F_acum - np.sin(x))):.1e} · '
      f'F\' (np.gradient) frente a cos(x) en el interior: {np.max(np.abs(np.gradient(F_acum, x)[1:-1] - np.cos(x)[1:-1])):.1e}')
# El ejercicio `es_primitiva` empaqueta esta comprobación: úsala siempre que hagas una integral a mano.


# ═════════════════════════════════════════════════════════════════
# 3. MONTE CARLO: ERROR 1/√n EN CUALQUIER DIMENSIÓN
# ═════════════════════════════════════════════════════════════════
# Si U es uniforme en [a, b], entonces E[f(U)] = (1/(b-a))·∫ f. Luego ∫ₐᵇ f = (b-a)·E[f(U)] ≈ (b-a)·media de f(uᵢ). En
# dimensión d es igual: integral = volumen × media. Por el teorema central del límite, el error típico es σ/√n, donde σ es la
# desviación típica de f(U): para ganar un decimal hacen falta 100x más puntos. Lo valioso: esa fórmula NO tiene d.
titulo('3. Monte Carlo')

rng = np.random.default_rng(0)                                             # semilla fija: la salida es siempre la misma
n_mc = 100_000
u = rng.random(n_mc)                                                       # uniforme en [0, 1)
muestras = np.exp(u)
estimado = muestras.mean()
error_tipico = muestras.std(ddof=1) / math.sqrt(n_mc)                       # Monte Carlo estima también su propio error
print(f'∫₀¹ eˣ ≈ {estimado:.5f} ± {error_tipico:.5f} (exacta {exacta:.5f}; error real {abs(estimado - exacta):.5f})')

# π con puntos en el cuadrado: el área del cuarto de círculo en [0,1]² es π/4 = P(x² + y² ≤ 1). Es la integral de una
# función indicadora (vale 1 dentro, 0 fuera) y la media de un 0/1 es una proporción: π ≈ 4·(dentro / n).
print(f'\n{"n":>9} {"π estimado":>12} {"|error|":>10}')
ns_pi = [10 ** k for k in range(2, 7)]
for n in ns_pi:
    xy = rng.random((n, 2))
    dentro = np.count_nonzero((xy ** 2).sum(axis=1) <= 1.0)
    print(f'{n:9d} {4 * dentro / n:12.6f} {abs(4 * dentro / n - math.pi):10.2e}')
# La proporción p = π/4 es una Bernoulli: σ = 4·√(p(1-p)) ≈ 1.64, así que el error típico es 1.64/√n: con n = 10⁶, ~1.6e-3.
sigma_pi = 4 * math.sqrt(math.pi / 4 * (1 - math.pi / 4))
print(f'error típico teórico = {sigma_pi:.3f}/√n → n = 10⁶: {sigma_pi / 1e3:.1e}')

# Un solo experimento es una muestra con ruido. Para ver la tasa se promedia el error cuadrático en 50 repeticiones por n.
repeticiones = 50
ns_grafica = np.array([2 ** k for k in range(6, 16)])                      # 64 ... 32768
rmse = []
una_vez = []
for n in ns_grafica:
    n = int(n)
    estimaciones = 4 * ((rng.random((repeticiones, n)) ** 2 + rng.random((repeticiones, n)) ** 2) <= 1.0).mean(axis=1)
    rmse.append(float(np.sqrt(np.mean((estimaciones - math.pi) ** 2))))
    una_vez.append(abs(float(estimaciones[0]) - math.pi))
rmse = np.array(rmse)
pend_mc = np.polyfit(np.log10(ns_grafica), np.log10(rmse), 1)[0]
print(f'pendiente del error RMS en log-log: {pend_mc:.2f} (teoría: -0.5, no -1 ni -2 como las reglas de la sección 1)')

plt.figure(figsize=(7, 4))
plt.loglog(ns_grafica, np.maximum(una_vez, 1e-6), '.', color='gray', alpha=0.7, label='un experimento (ruidoso)')
plt.loglog(ns_grafica, rmse, 'o-', color='tab:blue', label=f'error RMS de 50 repeticiones (pendiente {pend_mc:.2f})')
plt.loglog(ns_grafica, sigma_pi / np.sqrt(ns_grafica), '--', color='tab:orange', label='teoría σ/√n')
plt.title('Monte Carlo para π: el error cae como 1/√n')
plt.xlabel('n (puntos)')
plt.ylabel('error absoluto')
plt.legend(fontsize=8)
plt.show()

# ¿Por qué Monte Carlo en dimensión alta? Volumen de la bola unidad en R^d: V = π^(d/2)/Γ(d/2+1). Con el mismo presupuesto de
# N = 4⁸ = 65536 evaluaciones, una rejilla de punto medio tiene m = N^(1/d) puntos por eje (256, 16, 4 para d = 2, 4, 8):
# su resolución se desmorona. Monte Carlo conserva su error 1/√N (que depende de d solo vía la fracción p de puntos dentro).
print(f'\n{"d":>3} {"V exacto":>10} {"rejilla":>10} {"Monte Carlo":>12}   (error relativo, N = 65536 evaluaciones)')
N = 4 ** 8
for d, m in ((2, 256), (4, 16), (8, 4)):
    exacto = math.pi ** (d / 2) / math.gamma(d / 2 + 1)
    indices = np.indices((m,) * d).reshape(d, -1).T                        # m^d celdas de la rejilla, como índices enteros
    centros = -1 + (2 * indices + 1) / m                                   # centro de cada celda en [-1, 1]^d
    rejilla = 2 ** d * np.mean((centros ** 2).sum(axis=1) <= 1.0)          # volumen del cubo × proporción dentro
    azar = 2 ** d * np.mean((rng.uniform(-1, 1, (N, d)) ** 2).sum(axis=1) <= 1.0)
    print(f'{d:3d} {exacto:10.5f} {abs(rejilla - exacto) / exacto:10.2e} {abs(azar - exacto) / exacto:12.2e}')
# En d = 2 la rejilla gana de largo (256 puntos por eje); el cruce llega hacia d = 4, y en d = 8 la rejilla ya falla del todo.
# Matiz honesto: la bola ocupa una fracción cada vez menor del cubo (p = 0.8, 0.31, 0.016), así que a Monte Carlo le cuesta más
# acertar a medida que d crece; aun así degrada MUCHO menos que la rejilla. Con importance sampling se reduce esa varianza.


# ═════════════════════════════════════════════════════════════════
# 4. INTEGRAL = PROBABILIDAD: DENSIDAD, P(a ≤ X ≤ b) Y E[X]
# ═════════════════════════════════════════════════════════════════
# Una densidad f ≥ 0 con ∫ f = 1 describe una variable aleatoria continua X: P(a ≤ X ≤ b) = ∫ₐᵇ f. La esperanza es la media
# ponderada E[X] = ∫ x·f(x)dx y, en general, E[g(X)] = ∫ g(x)·f(x)dx. Todo en probabilidad continua es una integral, y las
# que no tienen primitiva (la gaussiana, sin ir más lejos) se resuelven con las reglas de la sección 1.
titulo('4. Integral = probabilidad (la gaussiana)')


def gaussiana(mu: float, sigma: float):
    return lambda x: np.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) / (sigma * math.sqrt(2 * math.pi))


mu, sigma = 3.0, 1.5
f_x = gaussiana(mu, sigma)
total = demo_simpson(f_x, mu - 10 * sigma, mu + 10 * sigma, 2000)
print(f'masa total ∫ f = {total:.12f} (una densidad integra 1; la cola más allá de 10σ es despreciable)')
for k in (1, 2, 3):
    p = demo_simpson(f_x, mu - k * sigma, mu + k * sigma, 2000)
    print(f'P(μ-{k}σ ≤ X ≤ μ+{k}σ) = {p:.6f} · con erf: {math.erf(k / math.sqrt(2)):.6f}')    # erf SÍ es una integral de la gaussiana
media = demo_simpson(lambda x: x * f_x(x), mu - 10 * sigma, mu + 10 * sigma, 2000)
varianza = demo_simpson(lambda x: (x - mu) ** 2 * f_x(x), mu - 10 * sigma, mu + 10 * sigma, 2000)
print(f'E[X] = ∫ x·f = {media:.9f} (μ = {mu}) · Var = ∫ (x-μ)²·f = {varianza:.9f} (σ² = {sigma ** 2})')
print('densidad máxima f(μ) =', round(float(f_x(mu)), 4), '(con σ pequeño supera 1: es probabilidad por unidad, no una probabilidad)')

# Conexión con ML: una función de pérdida es una ESPERANZA. Con el error cuadrático, R(c) = E[(X - c)²] = ∫ (x-c)²·f(x)dx es el
# riesgo de predecir la constante c. Entrenar con n datos no calcula esa integral: calcula su estimación Monte Carlo (la media
# de la pérdida en la muestra), con error ~ 1/√n como en la sección 3. Aquí se comparan las dos (cuadratura exacta frente a la
# media de una muestra) y se ve que el mínimo del riesgo está en c = μ, con valor σ²:
muestra = rng.normal(mu, sigma, 50_000)
print(f'\n{"c":>5} {"riesgo (integral)":>18} {"media muestral":>16} {"σ² + (μ-c)²":>13}')
for c in (1.0, 2.0, 3.0, 4.0, 5.0):
    riesgo = demo_simpson(lambda x: (x - c) ** 2 * f_x(x), mu - 10 * sigma, mu + 10 * sigma, 2000)
    print(f'{c:5.1f} {riesgo:18.6f} {np.mean((muestra - c) ** 2):16.6f} {sigma ** 2 + (mu - c) ** 2:13.6f}')
# La media minimiza el error cuadrático porque R(c) = σ² + (μ - c)². La entropía cruzada es lo mismo con g(x) = -log q(x):
# E_p[-log q] = ∫ -p·log q se minimiza en q = p, y por eso «máxima verosimilitud» es minimizar una integral estimada.

xs = np.linspace(mu - 4 * sigma, mu + 4 * sigma, 400)
plt.figure(figsize=(7, 3.6))
plt.plot(xs, f_x(xs), color='tab:blue')
dentro = (xs >= mu - sigma) & (xs <= mu + sigma)
plt.fill_between(xs[dentro], f_x(xs[dentro]), color='tab:blue', alpha=0.3, label='P(μ-σ ≤ X ≤ μ+σ) ≈ 0.683')
plt.axvline(mu, color='tab:orange', linestyle='--', label='E[X] = μ')
plt.title('Densidad N(3; 1.5²): el área sombreada es una probabilidad')
plt.xlabel('x')
plt.ylabel('f(x)')
plt.legend(fontsize=8)
plt.show()


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS (f, F y las densidades son funciones que ACEPTAN ARRAYS de numpy: se evalúan de una vez, sin bucle)
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · riemann ───────────────────────────────────────
def riemann(f, a: float, b: float, n: int, regla: str = 'medio') -> float:
    """
    Suma de Riemann de f en [a, b] con n rectángulos de ancho h = (b - a) / n, como float.
    Especificación exacta (los nodos de cada rectángulo, k = 0..n-1):
      - 'izquierda': x_k = a + k·h             - 'derecha': x_k = a + (k + 1)·h        - 'medio': x_k = a + (k + 0.5)·h
      - resultado = h · Σ f(x_k). `f` recibe el array completo de nodos de una sola vez (vectorizada).
      - regla distinta de esas tres → ValueError; n < 1 → ValueError.
      - Si a > b, h es negativo y el resultado cambia de signo (orientación).
      riemann(lambda x: x, 0, 1, 4, 'izquierda') → 0.375 · 'derecha' → 0.625 · 'medio' → 0.5
    Coste: O(n) evaluaciones de f. Error: O(h) izquierda/derecha, O(h²) punto medio.
    """
    pendiente()


# ── Ejercicio 2 · trapecios ─────────────────────────────────────
def trapecios(f, a: float, b: float, n: int) -> float:
    """
    Regla de los trapecios con n subintervalos, como float: h·(f(x₀)/2 + f(x₁) + ... + f(xₙ₋₁) + f(xₙ)/2), con
    h = (b - a) / n y xₖ = a + k·h. `f` recibe el array de los n + 1 nodos (vectorizada). n < 1 → ValueError.
    Exacta para rectas. Coste: O(n) evaluaciones de f. Error: O(h²), con constante (b-a)·h²·|f''|/12.
    """
    pendiente()


# ── Ejercicio 3 · simpson ───────────────────────────────────────
def simpson(f, a: float, b: float, n: int) -> float:
    """
    Regla de Simpson compuesta con n subintervalos (n PAR), como float: h/3·(f₀ + 4f₁ + 2f₂ + 4f₃ + ... + 4fₙ₋₁ + fₙ),
    con h = (b - a) / n: peso 4 en los nodos de índice impar, 2 en los pares interiores, 1 en los dos extremos.
    `f` recibe el array de los n + 1 nodos (vectorizada). n impar o n < 2 → ValueError.
    Exacta para polinomios de grado ≤ 3. Coste: O(n). Error: O(h⁴), constante (b-a)·h⁴·|f⁗|/180.
    """
    pendiente()


# ── Ejercicio 4 · es_primitiva ──────────────────────────────────
def es_primitiva(F, f, a: float, b: float, tol: float = 1e-6) -> bool:
    """
    Comprueba numéricamente que F' = f en (a, b): devuelve True solo si lo cumple en toda una rejilla de puntos.
    Especificación exacta:
      - Rejilla: los 20 puntos interiores de np.linspace(a, b, 22)[1:-1] (así F(x ± h) nunca sale de [a, b]).
      - F'(x) se aproxima con diferencia centrada y h = 1e-5: (F(x + h) - F(x - h)) / (2h). F y f son vectorizadas.
      - Se exige |F'(x) - f(x)| <= tol · max(1, |f(x)|) en TODOS los puntos; un valor no finito (nan, inf) → False.
      - a >= b → ValueError. Devuelve un bool de Python.
    Una constante sumada a F no cambia F': F y F + C pasan a la vez (es lo esperado, por eso ∫ₐᵇ usa F(b) - F(a)).
    Coste: O(1) (40 evaluaciones de F y 20 de f).
    """
    pendiente()


# ── Ejercicio 5 · pi_montecarlo ─────────────────────────────────
def pi_montecarlo(n: int, semilla: int = 0) -> float:
    """
    Estima π con n puntos al azar en el cuadrado unidad, como float: 4 · (puntos con x² + y² <= 1) / n.
    Especificación exacta, para que el resultado sea reproducible bit a bit:
      - rng = np.random.default_rng(semilla), y los puntos salen de UNA sola llamada rng.random((n, 2)) (x = columna 0, y = columna 1).
      - Vectorizada, sin bucles. n < 1 → ValueError.
      pi_montecarlo(1_000_000) → ≈ 3.14 (error típico 1.64/√n ≈ 1.6e-3)
    Coste: O(n) en tiempo y espacio. Error típico: 1.64/√n, independiente de cómo se parta el cuadrado.
    """
    pendiente()


# ── Ejercicio 6 · esperanza ─────────────────────────────────────
def esperanza(densidad, a: float, b: float, n: int = 1000) -> float:
    """
    Esperanza de una variable con la densidad dada, restringida a [a, b]: ∫ₐᵇ x·f(x) dx, como float, calculada con
    la regla de Simpson de n subintervalos (la del ejercicio 3: puedes llamarla). `densidad` es vectorizada.
    No normaliza: si la masa en [a, b] no es 1, devuelve ∫ x·f igualmente. n impar → ValueError (la lanza Simpson).
      esperanza(lambda x: np.full_like(x, 0.25), 0, 4) → 2.0         (uniforme en [0, 4])
    Coste: O(n) evaluaciones de la densidad.
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS (los resultados aproximados se comparan con una tolerancia explícita)
# ═════════════════════════════════════════════════════════════════

def _cerca(tolerancia: float):
    """Comparador para `prueba`: |actual - esperado| <= tolerancia (solo números reales; un bool o un array no valen)."""
    def comparar(actual, esperado) -> bool:
        if isinstance(actual, bool) or not isinstance(actual, (int, float, np.floating)):
            return False
        return actual == esperado or abs(float(actual) - esperado) <= tolerancia
    return comparar


def _recta(x):
    return x


def _cuadrado(x):
    return x ** 2


prueba('riemann', {
    'x en [0,1], n=4, izquierda': ((_recta, 0, 1, 4, 'izquierda'), 0.375),
    'x en [0,1], n=4, derecha': ((_recta, 0, 1, 4, 'derecha'), 0.625),
    'x en [0,1], n=4, medio (exacto para rectas)': ((_recta, 0, 1, 4, 'medio'), 0.5),
    'la regla por defecto es el punto medio': ((_recta, 0, 1, 4), 0.5),
    'x² en [0,3], n=3, medio: 0.25 + 2.25 + 6.25': ((_cuadrado, 0, 3, 3), 8.75),
    'x² en [0,3], n=3, izquierda: 0 + 1 + 4': ((_cuadrado, 0, 3, 3, 'izquierda'), 5.0),
    'constante 5 en [0,2]': ((lambda x: np.full_like(x, 5.0), 0, 2, 10), 10.0),
    'n = 1: un solo rectángulo': ((_cuadrado, 0, 2, 1, 'medio'), 2.0),
    'intervalo al revés: signo negativo': ((_recta, 1, 0, 4, 'medio'), -0.5),
    'sin en [0, π], n=1000, medio ≈ 2': ((np.sin, 0.0, math.pi, 1000), 2.0),
}, comparador=_cerca(1e-5))
grupo('riemann (casos límite)')
lanza('regla desconocida', lambda: riemann(_recta, 0, 1, 4, 'simpson'), ValueError)
lanza('n = 0', lambda: riemann(_recta, 0, 1, 0), ValueError)
comprueba('devuelve un float', lambda: type(riemann(_recta, 0, 1, 4)).__name__, 'float')

prueba('trapecios', {
    'x² en [0,3], n=3: 9.5 (exacta 9)': ((_cuadrado, 0, 3, 3), 9.5),
    'una recta se integra exacta con n = 1': ((lambda x: 3 * x + 1, 0, 2, 1), 8.0),
    'x² en [0,2], n=1: (b-a)·(f(a)+f(b))/2': ((_cuadrado, 0, 2, 1), 4.0),
    'intervalo al revés: signo negativo': ((lambda x: 3 * x + 1, 2, 0, 4), -8.0),
    'sin en [0,π], n=100: valor cerrado (π/n)·cot(π/2n)': ((np.sin, 0.0, math.pi, 100), math.pi / 100 / math.tan(math.pi / 200)),
    'exp en [0,1], n=1000 ≈ e - 1': ((np.exp, 0.0, 1.0, 1000), math.e - 1),
}, comparador=_cerca(1e-6))
grupo('trapecios (casos límite)')
lanza('n = 0', lambda: trapecios(_recta, 0, 1, 0), ValueError)
comprueba('devuelve un float', lambda: type(trapecios(_recta, 0, 1, 4)).__name__, 'float')

prueba('simpson', {
    'x³ en [0,2], n=2: exacta para cúbicas': ((lambda x: x ** 3, 0, 2, 2), 4.0),
    'x⁴ en [0,2], n=2: 20/3 (exacta 32/5)': ((lambda x: x ** 4, 0, 2, 2), 20 / 3),
    'una recta': ((lambda x: 3 * x + 1, 0, 2, 2), 8.0),
    'sin en [0,π], n=4: valor cerrado': ((np.sin, 0.0, math.pi, 4), math.pi / 12 * (4 * math.sqrt(2) + 2)),
    'exp en [0,1], n=20 ≈ e - 1': ((np.exp, 0.0, 1.0, 20), math.e - 1),
    'intervalo al revés: signo negativo': ((lambda x: x ** 3, 2, 0, 2), -4.0),
    'x⁻² en [1,2], n=100 ≈ 1/2': ((lambda x: 1 / x ** 2, 1.0, 2.0, 100), 0.5),
}, comparador=_cerca(1e-6))
grupo('simpson (casos límite)')
lanza('n impar', lambda: simpson(_recta, 0, 1, 3), ValueError)
lanza('n = 0', lambda: simpson(_recta, 0, 1, 0), ValueError)
lanza('n negativo', lambda: simpson(_recta, 0, 1, -2), ValueError)
comprueba('Simpson = (T + 2M)/3 con la mitad de trozos',
          lambda: abs(simpson(np.exp, 0, 1, 20) - (trapecios(np.exp, 0, 1, 10) + 2 * riemann(np.exp, 0, 1, 10)) / 3) < 1e-12,
          True)


def _orden_de(metodo, n: int = 16) -> float:
    """Orden empírico p = log2(e(n) / e(2n)) de un método sobre ∫₀¹ eˣ (error ≈ C·n^-p)."""
    e1 = abs(metodo(np.exp, 0.0, 1.0, n) - (math.e - 1))
    e2 = abs(metodo(np.exp, 0.0, 1.0, 2 * n) - (math.e - 1))
    return math.log2(e1 / e2)


grupo('órdenes de convergencia (la pendiente de la gráfica 1)')
comprueba('izquierda: orden 1', lambda: abs(_orden_de(lambda f, a, b, n: riemann(f, a, b, n, 'izquierda')) - 1) < 0.15, True)
comprueba('punto medio: orden 2', lambda: abs(_orden_de(riemann) - 2) < 0.15, True)
comprueba('trapecios: orden 2', lambda: abs(_orden_de(trapecios) - 2) < 0.15, True)
comprueba('Simpson: orden 4', lambda: abs(_orden_de(simpson) - 4) < 0.3, True)
comprueba('el trapecio se equivoca el doble que el punto medio', lambda: abs(
    abs(trapecios(np.exp, 0, 1, 32) - (math.e - 1)) / abs(riemann(np.exp, 0, 1, 32) - (math.e - 1)) - 2) < 0.05, True)

prueba('es_primitiva', {
    'x³/3 es primitiva de x²': ((lambda x: x ** 3 / 3, _cuadrado, 0, 2), True),
    'una constante no cambia nada: x³/3 + 7': ((lambda x: x ** 3 / 3 + 7, _cuadrado, 0, 2), True),
    'x³/2 no lo es': ((lambda x: x ** 3 / 2, _cuadrado, 0, 2), False),
    'x³ no lo es (olvidó dividir)': ((lambda x: x ** 3, _cuadrado, 0, 2), False),
    'sin es primitiva de cos': ((np.sin, np.cos, 0, 6), True),
    '-cos es primitiva de sin': ((lambda x: -np.cos(x), np.sin, 0, 6), True),
    'cos NO es primitiva de sin (signo)': ((np.cos, np.sin, 0, 6), False),
    'sustitución trigonométrica: ln(x+√(x²+9))': ((lambda x: np.log(x + np.sqrt(x ** 2 + 9)), lambda x: 1 / np.sqrt(x ** 2 + 9), -4, 4), True),
    'arcsinh(x/3): difiere en ln 3, también vale': ((lambda x: np.arcsinh(x / 3), lambda x: 1 / np.sqrt(x ** 2 + 9), -4, 4), True),
    'ln(x+3): error típico de la sustitución': ((lambda x: np.log(x + 3), lambda x: 1 / np.sqrt(x ** 2 + 9), -2, 4), False),
    'por partes: (x-1)eˣ para x·eˣ': ((lambda x: (x - 1) * np.exp(x), lambda x: x * np.exp(x), -2, 2), True),
    'por partes: x·eˣ no es primitiva de x·eˣ': ((lambda x: x * np.exp(x), lambda x: x * np.exp(x), -2, 2), False),
    'ln x en [1,2]: F no se evalúa fuera del intervalo': ((np.log, lambda x: 1 / x, 1, 2), True),
    'con tolerancia holgada pasa una F casi buena': ((lambda x: x ** 2 + 0.01 * x, lambda x: 2 * x, 0, 1, 0.1), True),
    'con la tolerancia por defecto no': ((lambda x: x ** 2 + 0.01 * x, lambda x: 2 * x, 0, 1), False),
    'F no finita: False': ((lambda x: x * np.nan, lambda x: 1 + 0 * x, 0, 1), False),
})
grupo('es_primitiva (casos límite)')
lanza('intervalo vacío', lambda: es_primitiva(_cuadrado, _recta, 1, 1), ValueError)
lanza('intervalo invertido', lambda: es_primitiva(_cuadrado, _recta, 2, 1), ValueError)
comprueba('devuelve un bool de Python', lambda: type(es_primitiva(_cuadrado, _recta, 0, 1)).__name__, 'bool')


def _pi_referencia(n: int, semilla: int) -> float:
    xy = np.random.default_rng(semilla).random((n, 2))              # receta del enunciado, independiente del ejercicio
    return float(4 * np.count_nonzero(xy[:, 0] ** 2 + xy[:, 1] ** 2 <= 1.0) / n)


prueba('pi_montecarlo', {
    'n=1000, semilla 0: coincide con la receta exacta': ((1000, 0), _pi_referencia(1000, 0)),
    'la semilla por defecto es 0': ((1000,), _pi_referencia(1000, 0)),
    'n=1000, semilla 7': ((1000, 7), _pi_referencia(1000, 7)),
    'n=100000, semilla 3': ((100_000, 3), _pi_referencia(100_000, 3)),
}, comparador=_cerca(1e-9))
grupo('pi_montecarlo (error y reproducibilidad)')
comprueba('n=10⁶: error < 0.01', lambda: abs(pi_montecarlo(1_000_000, 0) - math.pi) < 0.01, True)
comprueba('misma semilla, mismo resultado', lambda: pi_montecarlo(5000, 4) == pi_montecarlo(5000, 4), True)
comprueba('otra semilla, otro resultado', lambda: pi_montecarlo(5000, 4) != pi_montecarlo(5000, 5), True)
comprueba('resultado = 4k/n con k entero', lambda: abs(pi_montecarlo(500, 3) * 500 / 4 - round(pi_montecarlo(500, 3) * 500 / 4)) < 1e-9, True)
comprueba('la media de 20 semillas con n=10⁴ está a < 0.015 de π',
          lambda: abs(float(np.mean([pi_montecarlo(10_000, s) for s in range(20)])) - math.pi) < 0.015, True)
comprueba('n = 1: 0 o 4', lambda: pi_montecarlo(1) in (0.0, 4.0), True)
comprueba('devuelve un float', lambda: type(pi_montecarlo(10)).__name__, 'float')
lanza('n = 0', lambda: pi_montecarlo(0), ValueError)
lanza('n negativo', lambda: pi_montecarlo(-5), ValueError)

prueba('esperanza', {
    'N(0,1) en [-8, 8]: 0': ((gaussiana(0.0, 1.0), -8.0, 8.0), 0.0),
    'N(3, 1.5²) en [-10, 16]: 3': ((gaussiana(3.0, 1.5), -10.0, 16.0), 3.0),
    'uniforme en [0, 4]: 2': ((lambda x: np.full_like(x, 0.25), 0.0, 4.0), 2.0),
    'exponencial λ=1 en [0, 40], n=4000: 1': ((lambda x: np.exp(-x), 0.0, 40.0, 4000), 1.0),
    'triangular 2x en [0,1]: ∫2x² = 2/3': ((lambda x: 2 * x, 0.0, 1.0), 2 / 3),
    'no normaliza: f = 1 en [0,2] da ∫x = 2': ((lambda x: np.ones_like(x), 0.0, 2.0), 2.0),
    'con n explícito': ((gaussiana(-2.0, 0.5), -6.0, 2.0, 200), -2.0),
}, comparador=_cerca(1e-6))
grupo('esperanza (casos límite)')
lanza('n impar', lambda: esperanza(gaussiana(0.0, 1.0), -8.0, 8.0, 7), ValueError)
comprueba('devuelve un float', lambda: type(esperanza(gaussiana(0.0, 1.0), -8.0, 8.0)).__name__, 'float')

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────
# Cada regla evalúa f en n + 1 nodos: O(n). Con numpy la pendiente es pequeña (el bucle está en C), pero la forma es lineal.
medir('trapecios', lambda n: (np.sin, 0.0, 1.0, n), tamanos=[2 ** e for e in range(13, 21)])             # O(n)
medir('simpson', lambda n: (np.sin, 0.0, 1.0, n), tamanos=[2 ** e for e in range(13, 21)])               # O(n) (n par: potencias de 2)
medir('pi_montecarlo', lambda n: (n,), tamanos=[2 ** e for e in range(13, 21)])                          # O(n)

# Medir ajusta el COSTE (cómo crece el tiempo con n), no la PRECISIÓN. Cuánto se equivoca cada método es lo que muestran las
# gráficas log-log: la pendiente -4 de Simpson o la -1/2 de Monte Carlo dicen qué se gana por cada evaluación extra.
