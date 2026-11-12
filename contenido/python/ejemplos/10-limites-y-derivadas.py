"""
TEMA 10 · LÍMITES Y DERIVADAS NUMÉRICAS
─────────────────────────────────────────────────────────────────
Entrenar un modelo es minimizar una función de pérdida, y para minimizarla hace falta su derivada (el gradiente).
Esta lección convierte las guías de Cálculo «Límites» y «Derivada» en código: qué calcula un ordenador cuando "se acerca"
a un límite, por qué aproximar una derivada con un h pequeño tiene un óptimo (y no un «cuanto más pequeño, mejor»), y cómo
los números duales dan la derivada EXACTA sin ningún h: es la idea que hay debajo de PyTorch y JAX.

  Concepto               Qué es                                               Trampa típica
  límite                 valor al que se acerca f(x) cuando x → a, sin        evaluar f(a): puede ser 0/0 y aun así existir
                         necesidad de evaluar f en a                          el límite (sin(x)/x en 0)
  épsilon de máquina     hueco entre 1.0 y el siguiente float: ~2.2e-16       1 + 1e-17 == 1: el sumando simplemente desaparece
  cancelación            restar dos números casi iguales borra los dígitos    (1 - cos x) / x² con x = 1e-8 da 0.0, no 0.5
  catastrófica           que coinciden: queda solo el ruido de redondeo
  diferencia adelante    (f(x+h) - f(x)) / h · error de truncamiento O(h)      un h más pequeño NO siempre mejora el resultado
  diferencia centrada    (f(x+h) - f(x-h)) / 2h · error de truncamiento O(h²)  cuesta 2 evaluaciones nuevas (adelante, 1 si ya
                                                                              tienes f(x)): un orden más de precisión
  orden del error        p tal que error ≈ C · h^p: la PENDIENTE en log-log   p se mide con h donde manda el truncamiento,
                                                                              no donde manda el redondeo
  número dual            a + b·ε con ε² = 0: el término b arrastra f'(a)      derivar con duales es exacto, no «un h muy chico»

Costes: cada aproximación numérica de la derivada son 1-2 evaluaciones de f: O(1) si f lo es. El error total es
truncamiento (crece con h) + redondeo (crece al achicar h): hay un h óptimo. Con duales, f' sale en UNA pasada, con un coste
constante (~2-3x el de f) por variable de entrada.
"""
import math
import sys

import matplotlib.pyplot as plt
import numpy as np


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. LÍMITES EN LA PRÁCTICA (Y DÓNDE SE ROMPEN LOS FLOAT)
# ═════════════════════════════════════════════════════════════════
titulo('1. Límites en la práctica')

eps = sys.float_info.epsilon                  # ~2.22e-16: el salto entre 1.0 y el siguiente float representable
print('épsilon de máquina:', eps)
print('1 + eps == 1:', 1 + eps == 1, '· 1 + eps/2 == 1:', 1 + eps / 2 == 1, '· 1 + 1e-17 == 1:', 1 + 1e-17 == 1)
# Un float64 tiene 53 bits de mantisa (~16 cifras decimales): sumar algo menor que eps/2 a 1.0 no cambia nada.

# (1 + 1/n)^n → e cuando n → ∞. Primero converge... y luego se rompe, porque 1 + 1/n deja de poder distinguirse de 1.
print(f'\n{"n":>8} {"(1+1/n)^n":>20} {"error vs e":>12} {"con log1p":>20}')
for k in (1, 3, 5, 7, 9, 11, 13, 15, 16, 17):
    n = 10.0 ** k
    ingenuo = (1 + 1 / n) ** n                          # 1 + 1/n se redondea ANTES de elevar: el error se amplifica n veces
    estable = math.exp(n * math.log1p(1 / n))           # log1p(u) = log(1+u) calculado sin formar 1+u: conserva los dígitos
    print(f'{n:8.0e} {ingenuo:20.15f} {abs(ingenuo - math.e):12.2e} {estable:20.15f}')
# Con n = 1e16 el resultado es exactamente 1.0 (1 + 1e-16 == 1): el «límite» numérico se aleja de e justo cuando n crece.
# Regla: los límites numéricos solo valen en una ventana intermedia; ni h demasiado grande (truncamiento) ni demasiado chico.

# sin(x)/x → 1 cuando x → 0: aquí no hay problema (sin(x) ≈ x y el cociente es estable)...
# (1 - cos x)/x² → 1/2 cuando x → 0: aquí sí, por cancelación catastrófica.
print(f'\n{"x":>8} {"sin(x)/x":>20} {"(1-cos x)/x²":>20} {"2·sin²(x/2)/x²":>20}')
for k in range(0, 10, 1):
    x = 10.0 ** -k
    print(f'{x:8.0e} {math.sin(x) / x:20.15f} {(1 - math.cos(x)) / x ** 2:20.15f} {2 * math.sin(x / 2) ** 2 / x ** 2:20.15f}')
# cos(x) ≈ 1 - x²/2: para x = 1e-8 vale 1 - 5e-17, que se redondea a 1.0 → 1 - cos(x) = 0. Se perdieron TODOS los dígitos.
# La identidad 1 - cos x = 2 sin²(x/2) evita la resta: mismo límite matemático, algoritmo numérico estable.


# ═════════════════════════════════════════════════════════════════
# 2. LA DERIVADA COMO LÍMITE: ADELANTE Y CENTRADA
# ═════════════════════════════════════════════════════════════════
# f'(x) = lím_{h→0} (f(x+h) - f(x)) / h. Con h pequeño pero finito se obtiene una aproximación. Taylor dice cuánto se equivoca:
#   f(x+h) = f + h·f' + h²/2·f'' + h³/6·f''' + ...
#   adelante: (f(x+h) - f(x))/h = f' + (h/2)·f'' + O(h²)      → error ≈ (h/2)|f''|      → O(h)
#   centrada: (f(x+h) - f(x-h))/2h = f' + (h²/6)·f''' + O(h⁴) → error ≈ (h²/6)|f'''|    → O(h²)
# En la centrada los términos de orden par se cancelan por simetría: por eso gana un orden entero con el mismo coste.
titulo('2. Derivada adelante frente a centrada (f = exp, f\'(1) = e)')

print(f'{"h":>8} {"error adelante":>16} {"error centrada":>16}')
errores = []
for k in range(1, 7):
    h = 10.0 ** -k
    adelante = (math.exp(1 + h) - math.exp(1)) / h
    centrada = (math.exp(1 + h) - math.exp(1 - h)) / (2 * h)
    errores.append((abs(adelante - math.e), abs(centrada - math.e)))
    print(f'{h:8.0e} {errores[-1][0]:16.3e} {errores[-1][1]:16.3e}')
print('al dividir h entre 10, el error de adelante baja ~', round(errores[0][0] / errores[1][0]), 'x y el de centrada ~',
      round(errores[0][1] / errores[1][1]), 'x')
# 10x = un orden (h¹) y 100x = dos órdenes (h²). Con h = 1e-6 la centrada ya está en el límite de lo que da un float64 (siguiente sección).


# ═════════════════════════════════════════════════════════════════
# 3. EL h ÓPTIMO: TRUNCAMIENTO FRENTE A CANCELACIÓN
# ═════════════════════════════════════════════════════════════════
# El error total tiene dos partes que se oponen:
#   truncamiento ≈ C·h^p       (baja al achicar h)
#   redondeo     ≈ eps·|f|/h   (SUBE al achicar h: f(x+h) - f(x) resta números casi iguales, y luego se divide entre h chico)
# La suma tiene un mínimo: h* ~ eps^(1/2) ≈ 1.5e-8 para adelante (p=1) y h* ~ eps^(1/3) ≈ 6e-6 para centrada (p=2).
titulo('3. El h óptimo (gráfica log-log del error)')

x0 = 1.0
hs = np.logspace(-16, 0, 161)                                          # h = 1e-16 ... 1, equiespaciado en escala log
exacta = math.cos(x0)                                                  # d/dx sin(x) = cos(x): conocemos la derivada de verdad
err_adelante = np.abs((np.sin(x0 + hs) - np.sin(x0)) / hs - exacta)
err_centrada = np.abs((np.sin(x0 + hs) - np.sin(x0 - hs)) / (2 * hs) - exacta)
err_adelante = np.maximum(err_adelante, 1e-18)                         # un error exactamente 0 no existe en una escala log
err_centrada = np.maximum(err_centrada, 1e-18)

mejor_a, mejor_c = int(err_adelante.argmin()), int(err_centrada.argmin())
print(f'adelante: mejor h = {hs[mejor_a]:.1e} (teoría ~{eps ** 0.5:.1e}) con error {err_adelante[mejor_a]:.1e}')
print(f'centrada: mejor h = {hs[mejor_c]:.1e} (teoría ~{eps ** (1 / 3):.1e}) con error {err_centrada[mejor_c]:.1e}')

# En log-log, error = C·h^p es una RECTA: log(error) = log C + p·log h. La pendiente es el orden p. Se ajusta una recta
# solo en la zona donde manda el truncamiento (h entre 1e-3 y 1e-1), no donde manda el ruido.
zona = (hs >= 1e-3) & (hs <= 1e-1)
p_adelante = np.polyfit(np.log10(hs[zona]), np.log10(err_adelante[zona]), 1)[0]
p_centrada = np.polyfit(np.log10(hs[zona]), np.log10(err_centrada[zona]), 1)[0]
print(f'pendiente medida: adelante ≈ {p_adelante:.2f} (orden 1) · centrada ≈ {p_centrada:.2f} (orden 2)')

plt.figure(figsize=(7, 4))
plt.loglog(hs, err_adelante, label='adelante: O(h)', color='tab:orange')
plt.loglog(hs, err_centrada, label='centrada: O(h²)', color='tab:blue')
plt.loglog(hs, hs, '--', color='gray', linewidth=0.8, label='recta pendiente 1')
plt.loglog(hs, hs ** 2, ':', color='gray', linewidth=0.8, label='recta pendiente 2')
plt.axvline(hs[mejor_a], color='tab:orange', alpha=0.3)
plt.axvline(hs[mejor_c], color='tab:blue', alpha=0.3)
plt.ylim(1e-18, 10)
plt.title("Error de f'(1) para f = sin: truncamiento a la derecha, redondeo a la izquierda")
plt.xlabel('h')
plt.ylabel('error absoluto')
plt.legend()
plt.show()                                 # la gráfica aparece en el panel Salida
# A la derecha de cada mínimo manda el truncamiento (rectas de pendiente 1 y 2); a la izquierda manda el redondeo
# (pendiente -1: el error crece como eps/h). El mínimo de la centrada es mucho más profundo (~1e-12 frente a ~1e-9).


# ═════════════════════════════════════════════════════════════════
# 4. AUTODIFF HACIA DELANTE: NÚMEROS DUALES
# ═════════════════════════════════════════════════════════════════
# Un número dual es a + b·ε con ε² = 0 (ε ≠ 0 es un "infinitesimal" formal). Operando con las reglas del álgebra:
#   (a + bε) + (c + dε) = (a + c) + (b + d)ε
#   (a + bε) · (c + dε) = ac + (ad + bc)ε + bd·ε²  =  ac + (ad + bc)ε        ← la regla del producto, sale sola
# Si se evalúa un polinomio en x + 1·ε, la parte en ε es f'(x): f(x + ε) = f(x) + f'(x)·ε. Sin h, sin límite, sin error de truncamiento.
titulo('4. Números duales')


class DualDemo:
    """Versión mínima (solo + y ·) para ver la idea; la completa, con / y potencias, es el ejercicio `Dual`."""

    def __init__(self, a: float, b: float = 0.0) -> None:
        self.a = float(a)                      # valor f(x)
        self.b = float(b)                      # derivada f'(x): lo que acompaña a ε

    def __add__(self, otro):
        otro = otro if isinstance(otro, DualDemo) else DualDemo(otro)       # un número suelto es un dual con b = 0 (constante)
        return DualDemo(self.a + otro.a, self.b + otro.b)

    __radd__ = __add__                         # 5 + dual: la suma conmuta

    def __mul__(self, otro):
        otro = otro if isinstance(otro, DualDemo) else DualDemo(otro)
        return DualDemo(self.a * otro.a, self.a * otro.b + self.b * otro.a)  # (ac, ad + bc): regla del producto

    __rmul__ = __mul__


def polinomio(x):
    return x * x * x + 2 * x + 1               # f(x) = x³ + 2x + 1  →  f'(x) = 3x² + 2


r = polinomio(DualDemo(2.0, 1.0))             # x = 2 + 1·ε: la semilla "1" dice «derivo respecto a x»
print(f'f(2) = {r.a} · f\'(2) = {r.b} (exacto: 3·2² + 2 = 14)')
centrada = (polinomio(2.0 + 1e-5) - polinomio(2.0 - 1e-5)) / 2e-5
print(f'diferencia centrada con h=1e-5: {centrada!r} → error {abs(centrada - 14):.1e}; con duales el error es {abs(r.b - 14):.1e}')
# Una sola evaluación (con aritmética doble) da la derivada exacta salvo el redondeo normal. Esto se llama autodiff en modo
# hacia delante (forward mode). Cada variable de entrada necesita su propia pasada: n parámetros → n pasadas, O(n·coste(f)).
# Backprop (modo inverso, lección 14) recorre el cálculo al revés y obtiene las n derivadas de una salida escalar en UNA pasada:
# por eso entrenar redes con millones de parámetros usa modo inverso, y los duales son la forma más simple de entender la idea.


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · limite_numerico ───────────────────────────────
def limite_numerico(f, a: float, pasos: int = 6):
    """
    Aproxima lím_{x→a} f(x) mirando f por AMBOS lados, sin evaluar f en `a` (puede ser 0/0).
    Especificación exacta:
      - Usa h_k = 10**(-k) para k = 1..pasos y evalúa f(a - h_k) y f(a + h_k).
      - Si todos esos valores de los DOS últimos pasos (k = pasos-1 y k = pasos, por la izquierda y por la derecha)
        están en un margen estrecho, el límite existe: max(valores) - min(valores) <= 1e-3 * max(1, |v|), donde v es
        la media de f(a - h) y f(a + h) para el h más pequeño (k = pasos). Devuelve entonces v (float).
      - En caso contrario (límites laterales distintos, diverge u oscila) devuelve None.
      - pasos < 2 → ValueError.
      - f nunca se llama con x == a.
      limite_numerico(lambda x: math.sin(x) / x, 0.0)  →  ≈ 1.0
      limite_numerico(lambda x: abs(x) / x, 0.0)       →  None   (por la izquierda -1, por la derecha 1)
    Coste: O(pasos) evaluaciones de f.
    """
    pendiente()


# ── Ejercicio 2 · derivada_adelante ─────────────────────────────
def derivada_adelante(f, x: float, h: float = 1e-6) -> float:
    """
    Diferencia hacia delante: (f(x + h) - f(x)) / h. Error de truncamiento O(h): del orden de (h/2)·|f''(x)|.
    Con h = 1e-6 el error es ~1e-6 (cerca del óptimo teórico, h ~ 1.5e-8, el redondeo ya pesa). Devuelve float.
    """
    pendiente()


# ── Ejercicio 3 · derivada_centrada ─────────────────────────────
def derivada_centrada(f, x: float, h: float = 1e-5) -> float:
    """
    Diferencia centrada: (f(x + h) - f(x - h)) / (2h). Error de truncamiento O(h²): del orden de (h²/6)·|f'''(x)|.
    h = 1e-5 está cerca del óptimo teórico (eps^(1/3) ~ 6e-6): el error ronda 1e-11. Devuelve float.
    """
    pendiente()


# ── Ejercicio 4 · orden_del_error ───────────────────────────────
def orden_del_error(aprox, f, df, x: float) -> float:
    """
    Estima el orden p de un método de derivación numérica, con error ≈ C·h^p.
    `aprox(f, x, h)` es el método (como derivada_adelante o derivada_centrada), `df` la derivada exacta de `f`.
    Mide e(h) = |aprox(f, x, h) - df(x)| con h = 1e-2 y con h/2, y devuelve p = log2(e(h) / e(h/2)):
    si el error baja a la mitad p = 1; si baja a la cuarta parte p = 2. Si alguno de los dos errores es 0 devuelve
    float('inf') (el método es exacto aquí). Debe dar ≈ 1 para adelante y ≈ 2 para centrada.
    Se usa un h GRANDE a propósito: con h diminuto manda el redondeo y la medida no vale (sección 3).
    """
    pendiente()


# ── Ejercicio 5 · Dual ──────────────────────────────────────────
class Dual:
    """
    Número dual a + b·ε con ε² = 0. Atributos: `a` (el valor) y `b` (la derivada), siempre float.
      Dual(a, b=0.0)         # construye; un número suelto es un dual con b = 0 (constante)
      +, -, *, / entre Dual y Dual, y entre Dual y número (por cualquier lado: 3 * d, 1 / d, 5 - d)
      -d                     # negación
      d ** n                 # potencia ENTERA n (cualquier int, también 0 y negativos): (a + bε)^n = a^n + n·a^(n-1)·b·ε
                             # d ** 0 es Dual(1.0, 0.0) aunque a sea 0; un exponente no entero → TypeError
    Reglas: (a+bε)(c+dε) = ac + (ad+bc)ε · (a+bε)/(c+dε) = a/c + (bc - ad)/c² · ε. Dividir entre un dual con c = 0 lanza
    ZeroDivisionError. Las operaciones devuelven duales nuevos: no modifican los operandos.
    Cada operación es O(1): evaluar f con duales cuesta una constante por el coste de f.
    """

    def __init__(self, a: float, b: float = 0.0) -> None:
        pendiente()

    def __add__(self, otro):
        pendiente()

    def __radd__(self, otro):
        pendiente()

    def __sub__(self, otro):
        pendiente()

    def __rsub__(self, otro):
        pendiente()

    def __neg__(self):
        pendiente()

    def __mul__(self, otro):
        pendiente()

    def __rmul__(self, otro):
        pendiente()

    def __truediv__(self, otro):
        pendiente()

    def __rtruediv__(self, otro):
        pendiente()

    def __pow__(self, n: int):
        pendiente()


# ── Ejercicio 6 · seno ──────────────────────────────────────────
def seno(x):
    """
    sin(x) que acepta un Dual o un número. Para un Dual: sin(a + bε) = sin(a) + cos(a)·b·ε (regla de la cadena: la
    derivada de sin es cos, multiplicada por la derivada b de dentro). Para un número devuelve math.sin(x) (float).
    """
    pendiente()


# ── Ejercicio 7 · exponencial ───────────────────────────────────
def exponencial(x):
    """
    exp(x) que acepta un Dual o un número. Para un Dual: exp(a + bε) = exp(a) + exp(a)·b·ε (la exponencial es su propia
    derivada). Para un número devuelve math.exp(x) (float).
    """
    pendiente()


# ── Ejercicio 8 · derivar ───────────────────────────────────────
def derivar(f, x: float) -> float:
    """
    Derivada EXACTA de f en x por autodiff hacia delante: evalúa f(Dual(x, 1.0)) (la semilla 1.0 significa «derivo
    respecto a x») y devuelve la parte dual `b`, como float. Si f devuelve un número suelto (una constante, que no
    depende de x), la derivada es 0.0. `f` usa +, -, *, /, ** entero, seno y exponencial; no hay ningún h.
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS (los resultados aproximados se comparan con una tolerancia explícita)
# ═════════════════════════════════════════════════════════════════

def _cerca(tolerancia: float):
    """Comparador para `prueba`: |actual - esperado| <= tolerancia. None solo es igual a None; inf solo a inf."""
    def comparar(actual, esperado) -> bool:
        if actual is None or esperado is None:
            return actual is esperado
        if isinstance(actual, bool) or not isinstance(actual, (int, float)):
            return False
        return actual == esperado or abs(actual - esperado) <= tolerancia
    return comparar


prueba('limite_numerico', {
    'sin(x)/x en 0 (0/0 en el punto)': ((lambda x: math.sin(x) / x, 0.0), 1.0),
    'cociente que se simplifica: (x²-4)/(x-2) en 2': ((lambda x: (x * x - 4) / (x - 2), 2.0), 4.0),
    'otro punto, negativo: (x²-1)/(x+1) en -1': ((lambda x: (x * x - 1) / (x + 1), -1.0), -2.0),
    '(1+x)^(1/x) en 0 → e': ((lambda x: (1 + x) ** (1 / x), 0.0), math.e),
    'función continua: el límite es f(a)': ((math.cos, 0.5), math.cos(0.5)),
    'x·sin(1/x) en 0 → 0 (acotada por x)': ((lambda x: x * math.sin(1 / x), 0.0), 0.0),
    'con menos pasos': ((lambda x: math.sin(x) / x, 0.0, 4), 1.0),
    'laterales distintos: |x|/x → None': ((lambda x: abs(x) / x, 0.0), None),
    'diverge a ±∞: 1/x → None': ((lambda x: 1 / x, 0.0), None),
    'diverge a +∞ por los dos lados: 1/x² → None': ((lambda x: 1 / (x * x), 0.0), None),
    'oscila: sin(1/x) → None': ((lambda x: math.sin(1 / x), 0.0), None),
}, comparador=_cerca(1e-4))


def _llamadas_en_a() -> bool:
    visto = []

    def f(x):
        visto.append(x == 2.0)
        return (x * x - 4) / (x - 2)

    limite_numerico(f, 2.0)
    return any(visto)


grupo('limite_numerico (casos límite)')
lanza('pasos menor que 2', lambda: limite_numerico(math.cos, 0.0, 1), ValueError)
comprueba('f nunca se llama con x == a', _llamadas_en_a, False)


prueba('derivada_adelante', {
    'x² con h grande: el error es exactamente h': ((lambda x: x * x, 1.0, 0.5), 2.5),
    'x³ con h grande': ((lambda x: x ** 3, 1.0, 0.5), 4.75),
    'una recta se deriva exacta con cualquier h': ((lambda x: 3 * x + 1, 2.0, 0.1), 3.0),
    'constante: 0': ((lambda x: 5.0, 2.0, 1e-3), 0.0),
    '|x| en 0 mira solo a la derecha: 1': ((abs, 0.0, 1e-3), 1.0),
})
grupo('derivada_adelante (h por defecto)')
comprueba('exp en 1: error < 1e-5', lambda: abs(derivada_adelante(math.exp, 1.0) - math.e) < 1e-5, True)
comprueba('sin en 0: error < 1e-5', lambda: abs(derivada_adelante(math.sin, 0.0) - 1.0) < 1e-5, True)

prueba('derivada_centrada', {
    'x² con h grande: exacta para cuadráticas': ((lambda x: x * x, 1.0, 0.5), 2.0),
    'x³ con h grande: el error es h²': ((lambda x: x ** 3, 1.0, 0.5), 3.25),
    'una recta se deriva exacta': ((lambda x: 3 * x + 1, 2.0, 0.1), 3.0),
    '|x| en 0 es simétrica: 0': ((abs, 0.0, 1e-3), 0.0),
})
grupo('derivada_centrada (h por defecto)')
comprueba('exp en 1: error < 1e-8', lambda: abs(derivada_centrada(math.exp, 1.0) - math.e) < 1e-8, True)
comprueba('sin en 0: error < 1e-8', lambda: abs(derivada_centrada(math.sin, 0.0) - 1.0) < 1e-8, True)
comprueba('más precisa que la de adelante', lambda: abs(derivada_centrada(math.sin, 1.0) - math.cos(1.0))
          < abs(derivada_adelante(math.sin, 1.0) - math.cos(1.0)) / 100, True)


def _adelante(f, x, h):                          # métodos de referencia, independientes de los ejercicios del alumno
    return (f(x + h) - f(x)) / h


def _centrada(f, x, h):
    return (f(x + h) - f(x - h)) / (2 * h)


def _centrada4(f, x, h):                         # centrada de orden 4 (diferencias de Richardson)
    return (f(x - 2 * h) - 8 * f(x - h) + 8 * f(x + h) - f(x + 2 * h)) / (12 * h)


prueba('orden_del_error', {
    'adelante: orden 1': ((_adelante, math.sin, math.cos, 1.0), 1.0),
    'adelante con exp: orden 1': ((_adelante, math.exp, math.exp, 0.5), 1.0),
    'centrada: orden 2': ((_centrada, math.sin, math.cos, 1.0), 2.0),
    'centrada de x³: orden 2': ((_centrada, lambda x: x ** 3, lambda x: 3 * x * x, 1.0), 2.0),
    'centrada de orden 4: orden 4': ((_centrada4, math.sin, math.cos, 1.0), 4.0),
    'método exacto: infinito': (((lambda f, x, h: 2 * x), lambda x: x * x, lambda x: 2 * x, 1.0), math.inf),
}, comparador=_cerca(0.05))


def _par(d) -> tuple:
    return (float(d.a), float(d.b))


grupo('Dual: construcción y suma')
comprueba('Dual(a, b) guarda valor y derivada', lambda: _par(Dual(3, 4)), (3.0, 4.0))
comprueba('un solo argumento: b = 0', lambda: _par(Dual(3)), (3.0, 0.0))
comprueba('suma de duales', lambda: _par(Dual(1, 2) + Dual(3, 4)), (4.0, 6.0))
comprueba('dual + número', lambda: _par(Dual(1, 2) + 5), (6.0, 2.0))
comprueba('número + dual', lambda: _par(5 + Dual(1, 2)), (6.0, 2.0))
comprueba('resta de duales', lambda: _par(Dual(5, 3) - Dual(2, 1)), (3.0, 2.0))
comprueba('número - dual', lambda: _par(10 - Dual(4, 1)), (6.0, -1.0))
comprueba('dual - número', lambda: _par(Dual(4, 1) - 10), (-6.0, 1.0))
comprueba('negación', lambda: _par(-Dual(1, 2)), (-1.0, -2.0))


def _no_muta() -> tuple:
    d = Dual(1, 2)
    _ = d + 1, d * 3, d - 2, d / 4, d ** 2, 5 - d
    return _par(d)


comprueba('las operaciones no modifican los operandos', _no_muta, (1.0, 2.0))

grupo('Dual: producto, cociente y potencia')
comprueba('producto: regla (ad + bc)', lambda: _par(Dual(2, 3) * Dual(4, 5)), (8.0, 22.0))
comprueba('número * dual', lambda: _par(3 * Dual(2, 1)), (6.0, 3.0))
comprueba('dual * número', lambda: _par(Dual(2, 1) * 3), (6.0, 3.0))
comprueba('ε · ε = 0: (0 + 1ε)² no tiene término en ε²', lambda: _par(Dual(0, 1) * Dual(0, 1)), (0.0, 0.0))
comprueba('cociente: regla (bc - ad)/c²', lambda: _par(Dual(4, 8) / Dual(2, 1)), (2.0, 3.0))
comprueba('1 / dual', lambda: _par(1 / Dual(2, 1)), (0.5, -0.25))
comprueba('dual / número', lambda: _par(Dual(6, 2) / 3), (2.0, 2 / 3))
comprueba('potencia 2', lambda: _par(Dual(3, 1) ** 2), (9.0, 6.0))
comprueba('potencia 3 con derivada interna', lambda: _par(Dual(2, 5) ** 3), (8.0, 60.0))
comprueba('potencia 0 es 1 (constante)', lambda: _par(Dual(2, 1) ** 0), (1.0, 0.0))
comprueba('potencia 0 con a = 0 no falla', lambda: _par(Dual(0, 1) ** 0), (1.0, 0.0))
comprueba('potencia negativa', lambda: _par(Dual(2, 1) ** -1), (0.5, -0.25))
comprueba('potencia 2 con a = 0', lambda: _par(Dual(0, 1) ** 2), (0.0, 0.0))
lanza('exponente no entero', lambda: Dual(1, 0) ** 0.5, TypeError)
lanza('dividir entre un dual con valor 0', lambda: Dual(1, 0) / Dual(0, 1), ZeroDivisionError)

grupo('seno y exponencial (regla de la cadena)')
comprueba('seno de un número es math.sin', lambda: seno(0.5), math.sin(0.5))
comprueba('exponencial de un número es math.exp', lambda: exponencial(0.5), math.exp(0.5))
comprueba('seno de un dual en 0: (0, 1)', lambda: _par(seno(Dual(0, 1))), (0.0, 1.0))
comprueba('seno de un dual con derivada interna', lambda: _par(seno(Dual(1, 2))), (math.sin(1.0), 2 * math.cos(1.0)))
comprueba('exponencial de un dual en 0: (1, 1)', lambda: _par(exponencial(Dual(0, 1))), (1.0, 1.0))
comprueba('exponencial con derivada interna', lambda: _par(exponencial(Dual(1, 3))), (math.e, 3 * math.e))

prueba('derivar', {
    'x² en 3': ((lambda x: x * x, 3.0), 6.0),
    'x³ en 2': ((lambda x: x ** 3, 2.0), 12.0),
    'recta 3x + 5': ((lambda x: 3 * x + 5, 7.0), 3.0),
    'constante: 0.0': ((lambda x: 5, 1.0), 0.0),
    'x entero': ((lambda x: x * x, 3), 6.0),
    'producto: sin(x)·eˣ en 0': ((lambda x: seno(x) * exponencial(x), 0.0), 1.0),
    'cociente: (x²+1)/(x-1) en 3': ((lambda x: (x * x + 1) / (x - 1), 3.0), 0.5),
    '1/x en 2': ((lambda x: 1 / x, 2.0), -0.25),
    'composición: sin(eˣ) en 0 = cos(1)': ((lambda x: seno(exponencial(x)), 0.0), math.cos(1.0)),
    'polinomio de grado 5 en 1': ((lambda x: x ** 5 - 2 * x ** 3 + x, 1.0), 0.0),
})
grupo('derivar (exactitud)')
comprueba('x² en 1e8: exacta, sin h', lambda: derivar(lambda x: x * x, 1e8), 2e8)
comprueba('devuelve un float', lambda: type(derivar(lambda x: x * x, 3.0)).__name__, 'float')

# Esta lección no usa medir(): cada función hace un número FIJO de evaluaciones (O(1)). Lo que cambia con h no es el tiempo
# sino la PRECISIÓN, y eso es justo lo que muestra la gráfica log-log de la sección 3.
