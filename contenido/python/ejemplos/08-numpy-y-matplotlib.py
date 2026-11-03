"""
TEMA 8 · NUMPY Y MATPLOTLIB
─────────────────────────────────────────────────────────────────
NumPy es la base de toda la pila de IA/ML en Python (pandas, scikit-learn, PyTorch, librosa...). Su idea central:
un `ndarray` guarda números del MISMO tipo en un bloque contiguo de memoria, y las operaciones se ejecutan en C
sobre el array entero ("vectorización"), sin pasar por el intérprete elemento a elemento.

  Concepto            Qué es                                              Trampa típica
  dtype               tipo de cada elemento (int64, float64, bool...)     mezclar int y float: el resultado "sube" a float
  shape               tupla con el tamaño de cada dimensión               (3,) no es lo mismo que (3, 1) ni que (1, 3)
  axis                dimensión sobre la que se reduce (0 filas, 1 cols)  axis=0 colapsa las FILAS: queda un valor por columna
  vectorización       operar sobre el array entero, sin bucle for         un bucle for sobre un ndarray es MÁS lento que una list
  broadcasting        alinear shapes distintos "estirando" dimensiones 1  un shape mal alineado da un error o, peor, un resultado equivocado
  vista vs copia      un slice es una VISTA (comparte memoria)           modificar el slice modifica el original; usa .copy()

Costes: casi todo es O(n) con una constante minúscula (en C). Una reducción (sum, mean...) recorre el array una vez.
matplotlib dibuja esos arrays: aquí `plt.show()` hace que la gráfica aparezca en el panel Salida.
"""
import time

import matplotlib.pyplot as plt
import numpy as np


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. EL NDARRAY: DTYPE, SHAPE Y AXIS
# ═════════════════════════════════════════════════════════════════
titulo('1. ndarray, dtype, shape y axis')

a = np.array([[1, 2, 3], [4, 5, 6]])         # desde listas anidadas: O(n)
print('shape:', a.shape, '· ndim:', a.ndim, '· dtype:', a.dtype, '· size:', a.size)
print('con decimales:', np.array([1, 2.5]).dtype)       # float64: un solo float "contagia" a todo el array
print('ceros / unos / rango:', np.zeros(3), np.ones(2), np.arange(0, 10, 3))
print('linspace(0, 1, 5):', np.linspace(0, 1, 5))        # 5 puntos IGUALMENTE espaciados, incluido el final
# arange(0, 1, 0.1) con decimales puede dar un elemento de más o de menos por redondeo; linspace fija el nº de puntos.

print('reshape:', np.arange(6).reshape(2, 3).tolist())    # reorganiza SIN copiar (devuelve una vista); -1 = "calcula tú"
print('acceso a[1, 2] =', a[1, 2], '· fila a[0] =', a[0], '· columna a[:, 1] =', a[:, 1])
print('sum(axis=0) (por columna):', a.sum(axis=0), '· sum(axis=1) (por fila):', a.sum(axis=1))
# Regla para no liarse: el axis que pasas es el que DESAPARECE del shape. (2, 3) con axis=0 → (3,); con axis=1 → (2,).

# ═════════════════════════════════════════════════════════════════
# 2. VECTORIZACIÓN FRENTE A BUCLE
# ═════════════════════════════════════════════════════════════════
titulo('2. Vectorización frente a bucle')

x = np.arange(1_000_000, dtype=np.float64)

t0 = time.perf_counter()
cuadrados_bucle = [v * v for v in x]            # O(n) con constante GRANDE: crea un objeto Python por elemento
t_bucle = time.perf_counter() - t0

t0 = time.perf_counter()
cuadrados_vec = x * x                           # O(n) con constante PEQUEÑA: un solo bucle en C, sin objetos Python
t_vec = time.perf_counter() - t0

print(f'bucle: {t_bucle * 1000:.1f} ms · vectorizado: {t_vec * 1000:.2f} ms · el bucle es ~{t_bucle / max(t_vec, 1e-9):.0f}x más lento')
# Ambos son O(n): la complejidad es la misma, lo que cambia es el FACTOR CONSTANTE (y se nota: decenas de veces).
# Por eso en NumPy casi nunca se escribe un `for` sobre los elementos: se busca la operación del array entero.
print('mismo resultado:', bool(np.allclose(cuadrados_bucle, cuadrados_vec)))

# ═════════════════════════════════════════════════════════════════
# 3. BROADCASTING
# ═════════════════════════════════════════════════════════════════
# Reglas: se alinean los shapes por la DERECHA; dos dimensiones son compatibles si son iguales o una vale 1
# (la de valor 1 se "estira" sin copiar memoria).
titulo('3. Broadcasting')

m = np.array([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]])          # (2, 3)
print('matriz - media de cada columna:\n', m - m.mean(axis=0))        # (2,3) - (3,)   → (2,3)
print('matriz / suma de cada fila:\n', m / m.sum(axis=1, keepdims=True))   # (2,3) / (2,1) → (2,3)
# keepdims=True conserva el axis como tamaño 1: (2,) no se alinearía con (2,3), pero (2,1) sí. Sin keepdims, error o resultado erróneo.

col = np.arange(3).reshape(3, 1)       # (3, 1)
fila = np.arange(4)                    # (4,)  → se ve como (1, 4)
print('tabla de sumas (3,1)+(4,) → (3,4):\n', col + fila)         # sin ningún bucle: así se calculan distancias por pares

# ═════════════════════════════════════════════════════════════════
# 4. MÁSCARAS BOOLEANAS
# ═════════════════════════════════════════════════════════════════
titulo('4. Máscaras booleanas')

datos = np.array([3, -1, 7, 0, -5, 9])
mascara = datos > 0                          # array de bool del mismo shape: O(n)
print('máscara:', mascara, '· positivos:', datos[mascara])      # indexar con una máscara COPIA los elementos que cumplen
datos2 = datos.copy()
datos2[datos2 < 0] = 0                       # asignar con máscara: "recorta" los negativos (como un ReLU)
print('negativos a 0:', datos2, '· cuántos > 0:', int((datos > 0).sum()))   # True cuenta como 1
print('np.where(cond, a, b):', np.where(datos > 0, 'pos', 'no'))             # elige elemento a elemento, sin if ni bucle
# Trampa: se combinan con & y | (con paréntesis), NO con `and`/`or`: (datos > 0) & (datos < 8).

# ═════════════════════════════════════════════════════════════════
# 5. ALEATORIOS REPRODUCIBLES: default_rng
# ═════════════════════════════════════════════════════════════════
titulo('5. Aleatorios con semilla')

rng = np.random.default_rng(42)              # generador con SEMILLA: la misma semilla da siempre la misma secuencia
print('uniformes:', rng.random(3).round(3), '· normales:', rng.normal(0, 1, 3).round(3), '· enteros:', rng.integers(0, 10, 5))
print('misma semilla, mismo resultado:', bool(np.array_equal(np.random.default_rng(7).random(4), np.random.default_rng(7).random(4))))
# Preferible a np.random.seed()/np.random.rand(): el estado global es compartido entre módulos y rompe la reproducibilidad;
# un `rng` explícito se pasa a las funciones y se controla. En ML la semilla fija permite repetir un experimento.

# ═════════════════════════════════════════════════════════════════
# 6. REDUCCIONES
# ═════════════════════════════════════════════════════════════════
titulo('6. Reducciones')

notas = rng.normal(6, 2, size=(4, 5)).round(1)       # 4 alumnos × 5 exámenes
print('notas:\n', notas)
print('media global:', round(float(notas.mean()), 2), '· por alumno (axis=1):', notas.mean(axis=1).round(2))
print('desv. típica por examen (axis=0):', notas.std(axis=0).round(2))
print('máx:', notas.max(), '· posición del máx (en el array plano):', int(notas.argmax()), '· ordenar axis=1 es O(n log n)')
# std usa ddof=0 por defecto (población); para muestra, ddof=1. Pandas usa ddof=1: misma función, resultado distinto.

# ═════════════════════════════════════════════════════════════════
# 7. MATPLOTLIB: PLOT, SUBPLOTS Y TÍTULOS
# ═════════════════════════════════════════════════════════════════
titulo('7. matplotlib')

t = np.linspace(0, 2 * np.pi, 200)
ruido = np.random.default_rng(1).normal(0, 0.15, t.size)

# Una gráfica sencilla. Estilo "pyplot" (plt.plot...) vale para algo rápido; para varias gráficas usa fig, ejes:
plt.figure(figsize=(6, 3))
plt.plot(t, np.sin(t), label='sin(t)')
plt.plot(t, np.sin(t) + ruido, '.', markersize=3, label='con ruido')
plt.title('Una señal y su versión ruidosa')
plt.xlabel('t (rad)')
plt.ylabel('amplitud')
plt.legend()
plt.show()                                # aquí aparece la gráfica en el panel Salida

# Varias gráficas: plt.subplots devuelve la figura y un array de ejes; cada eje se configura con set_* (API orientada a objetos).
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8, 3))
ax1.plot(t, np.cos(t), color='tab:orange')
ax1.set_title('Línea')
ax2.hist(rng.normal(0, 1, 2000), bins=30, color='tab:blue')
ax2.set_title('Histograma de 2000 normales')
fig.suptitle('Dos gráficas en una figura')
fig.tight_layout()                        # evita que los títulos se pisen
plt.show()


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · normalizar ────────────────────────────────────
def normalizar(x):
    """
    Normaliza un vector con z-score: (x - media) / desviación típica (población, ddof=0). El resultado tiene media 0
    y desviación 1: es el primer paso de casi cualquier modelo de ML. Si la desviación es 0 (todo igual) devuelve
    ceros, en vez de dividir entre 0. Devuelve un ndarray float.
    Alternativa ingenua: calcular media y desviación con bucles y rellenar una lista. Es O(n) también, pero ~50x más lento.
    Vectorizado: O(n) (dos pasadas en C).
    """
    pendiente()


# ── Ejercicio 2 · distancias_por_pares ──────────────────────────
def distancias_por_pares(a, b):
    """
    Distancia euclídea entre cada fila de `a` (n×d) y cada fila de `b` (m×d). Devuelve una matriz n×m.
    Sin bucles: usa broadcasting con a[:, None, :] - b[None, :, :] → (n, m, d), eleva al cuadrado, suma en el último
    axis y saca la raíz. Con dos bucles anidados sería O(n·m·d) en intérprete; así sigue siendo O(n·m·d) pero en C.
    (Es la base de k-NN y de los clusters.)
    """
    pendiente()


# ── Ejercicio 3 · media_movil ───────────────────────────────────
def media_movil(x, k: int):
    """
    Media móvil de ventana k: el promedio de cada k valores consecutivos. Devuelve len(x) - k + 1 valores
    (solo ventanas completas). k < 1 o k > len(x) → ValueError. Usa np.convolve(x, np.ones(k) / k, mode='valid').
    Alternativa ingenua: sumar la ventana en cada posición, O(n·k). La convolución lo hace en C; para k grande
    existe la versión con suma acumulada (cumsum), O(n).
      media_movil([1, 2, 3, 4, 5], 3)  →  [2., 3., 4.]
    """
    pendiente()


# ── Ejercicio 4 · histograma ────────────────────────────────────
def histograma(datos, n_bins: int, minimo: float, maximo: float):
    """
    Cuenta cuántos datos caen en cada uno de `n_bins` intervalos iguales entre `minimo` y `maximo`. Los intervalos son
    [a, b) salvo el último, que incluye `maximo`. Los datos fuera de [minimo, maximo] se ignoran. Devuelve un ndarray
    de n_bins enteros. n_bins < 1 o maximo <= minimo → ValueError.
    Hazlo sin bucle de datos: calcula el índice de cada dato con aritmética, descarta los de fuera con una máscara y
    cuenta con np.bincount(indices, minlength=n_bins). O(n). (np.histogram hace lo mismo; aquí se construye a mano.)
    """
    pendiente()


# ── Ejercicio 5 · softmax ───────────────────────────────────────
def softmax(x):
    """
    Softmax de un vector: exp(x_i) / suma(exp(x)). Convierte puntuaciones en probabilidades (suman 1).
    Hazla ESTABLE: resta el máximo antes de exponenciar (no cambia el resultado, porque softmax(x) = softmax(x - c),
    pero evita el desbordamiento: np.exp(1000) es inf y daría nan). Si x es una matriz, aplica el softmax a cada
    FILA (axis=-1, con keepdims=True).
    """
    pendiente()


# ── Ejercicio 6 · regresion_lineal ──────────────────────────────
def regresion_lineal(x, y):
    """
    Ajusta la recta y ≈ m·x + b por mínimos cuadrados. Devuelve un ndarray [m, b].
    Construye la matriz de diseño A = [x, 1] por columnas (np.column_stack) y resuelve con
    np.linalg.lstsq(A, y, rcond=None)[0]. Mejor que la fórmula con la inversa (A^T A)^-1 A^T y, que es numéricamente
    inestable; lstsq usa una descomposición (SVD) y también funciona con más variables.
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS (los ndarray se comparan por shape + allclose)
# ═════════════════════════════════════════════════════════════════

def _z_media_std() -> list:
    z = normalizar(np.array([3.0, 7.0, 1.0, 9.0, 5.0]))
    return [round(float(z.mean()), 9), round(float(z.std()), 9)]


def _normalizar_no_modifica() -> bool:
    x = np.array([1.0, 2.0, 3.0])
    original = x.copy()
    normalizar(x)
    return bool(np.array_equal(x, original))


prueba('normalizar', {
    'ejemplo': ((np.array([1.0, 2.0, 3.0]),), np.array([-1.0, 0.0, 1.0]) * np.sqrt(1.5)),
    'acepta una lista': (([2, 4, 4, 4, 5, 5, 7, 9],), np.array([-1.5, -0.5, -0.5, -0.5, 0.0, 0.0, 1.0, 2.0])),
    'todo igual: ceros': ((np.array([5.0, 5.0, 5.0]),), np.zeros(3)),
    'un solo valor': ((np.array([4.0]),), np.zeros(1)),
    'negativos': ((np.array([-1.0, 1.0]),), np.array([-1.0, 1.0])),
})
grupo('normalizar (propiedades)')
comprueba('media 0 y desviación 1', _z_media_std, [0.0, 1.0])
comprueba('no modifica la entrada', _normalizar_no_modifica, True)

_A = np.array([[0.0, 0.0], [3.0, 4.0]])
_B = np.array([[0.0, 0.0], [6.0, 8.0], [3.0, 4.0]])

prueba('distancias_por_pares', {
    'ejemplo 2×3': ((_A, _B), np.array([[0.0, 10.0, 5.0], [5.0, 5.0, 0.0]])),
    'un punto frente a sí mismo': ((np.array([[1.0, 1.0]]), np.array([[1.0, 1.0]])), np.zeros((1, 1))),
    'una dimensión': ((np.array([[1.0], [4.0]]), np.array([[2.0]])), np.array([[1.0], [2.0]])),
    'simétrica consigo misma': ((_A, _A), np.array([[0.0, 5.0], [5.0, 0.0]])),
    'tres dimensiones': ((np.array([[1.0, 2.0, 2.0]]), np.array([[0.0, 0.0, 0.0]])), np.array([[3.0]])),
})

prueba('media_movil', {
    'ventana 3': (([1, 2, 3, 4, 5], 3), np.array([2.0, 3.0, 4.0])),
    'ventana 1 es la propia señal': (([4.0, 8.0, 6.0], 1), np.array([4.0, 8.0, 6.0])),
    'ventana = longitud': (([1.0, 2.0, 3.0], 3), np.array([2.0])),
    'ventana 2': ((np.array([1.0, 3.0, 5.0, 7.0]), 2), np.array([2.0, 4.0, 6.0])),
    'constante': (([5.0] * 6, 4), np.array([5.0, 5.0, 5.0])),
})
lanza('ventana mayor que la señal', lambda: media_movil([1, 2], 3), ValueError)
lanza('ventana cero', lambda: media_movil([1, 2], 0), ValueError)

prueba('histograma', {
    'cuatro bins': (([0.5, 1.5, 1.7, 2.5, 3.5], 4, 0.0, 4.0), np.array([1, 2, 1, 1])),
    'el máximo entra en el último': (([0.0, 4.0], 4, 0.0, 4.0), np.array([1, 0, 0, 1])),
    'fuera de rango se ignora': (([-1.0, 5.0, 2.0], 2, 0.0, 4.0), np.array([0, 1])),
    'sin datos': (([], 3, 0.0, 3.0), np.zeros(3, dtype=int)),
    'un solo bin': (([1.0, 2.0, 3.0], 1, 0.0, 10.0), np.array([3])),
    'borde entre bins va al de la derecha': (([2.0], 2, 0.0, 4.0), np.array([0, 1])),
})
lanza('cero bins', lambda: histograma([1.0], 0, 0.0, 1.0), ValueError)
lanza('rango vacío', lambda: histograma([1.0], 2, 3.0, 3.0), ValueError)


def _softmax_suma() -> float:
    return round(float(softmax(np.array([1.0, 2.0, 3.0, 4.0])).sum()), 9)


prueba('softmax', {
    'ejemplo': ((np.array([1.0, 2.0, 3.0]),), np.exp([1.0, 2.0, 3.0]) / np.exp([1.0, 2.0, 3.0]).sum()),
    'iguales: reparto uniforme': ((np.array([2.0, 2.0, 2.0, 2.0]),), np.full(4, 0.25)),
    'estable con valores enormes': ((np.array([1000.0, 1000.0]),), np.array([0.5, 0.5])),
    'estable con negativos enormes': ((np.array([-1000.0, 0.0]),), np.array([0.0, 1.0])),
    'matriz: por filas': ((np.array([[0.0, 0.0], [1.0, 3.0]]),), np.array([[0.5, 0.5], [1 / (1 + np.exp(2)), 1 - 1 / (1 + np.exp(2))]])),
    'acepta una lista': (([0.0, 0.0],), np.array([0.5, 0.5])),
})
comprueba('suma 1', _softmax_suma, 1.0)

_rng_reg = np.random.default_rng(3)
_x_reg = _rng_reg.uniform(-5, 5, 50)
_y_reg = 2.5 * _x_reg - 1.0 + _rng_reg.normal(0, 0.01, 50)
_m_ref, _b_ref = np.polyfit(_x_reg, _y_reg, 1)                  # referencia independiente

prueba('regresion_lineal', {
    'recta exacta': (([0.0, 1.0, 2.0, 3.0], [1.0, 3.0, 5.0, 7.0]), np.array([2.0, 1.0])),
    'pendiente negativa': (([0.0, 1.0, 2.0], [4.0, 2.0, 0.0]), np.array([-2.0, 4.0])),
    'recta horizontal': (([1.0, 2.0, 3.0], [5.0, 5.0, 5.0]), np.array([0.0, 5.0])),
    'con ruido: coincide con polyfit': ((_x_reg, _y_reg), np.array([_m_ref, _b_ref])),
    'dos puntos': (([0.0, 2.0], [1.0, 5.0]), np.array([2.0, 1.0])),
})

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────
def vector_aleatorio(n: int):
    return np.random.default_rng(0).normal(10, 3, n)


medir('normalizar', lambda n: (vector_aleatorio(n),), tamanos=[2 ** e for e in range(13, 21)])           # O(n)
medir('media_movil', lambda n: (vector_aleatorio(n), 8), tamanos=[2 ** e for e in range(13, 21)])        # O(n·k), k fijo = O(n)

# El factor constante entre un bucle y la vectorización se ve en la sección 2: ambos son O(n), pero el vectorizado
# tiene una pendiente muchísimo menor. «Medir» ajusta la complejidad (la forma de la curva), no esa constante.
