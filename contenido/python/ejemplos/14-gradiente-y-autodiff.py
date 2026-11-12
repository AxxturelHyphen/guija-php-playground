"""
TEMA 14 · GRADIENTE, DESCENSO Y AUTODIFF
─────────────────────────────────────────────────────────────────
Esta lección pone en código las guías de Cálculo «Funciones de varias variables», «Derivadas parciales y gradiente» y
«Optimización»: el gradiente como dirección de máxima subida, el descenso de gradiente como algoritmo que lo usa para
minimizar, y la diferenciación automática en modo inverso, que es exactamente lo que hace `loss.backward()` en PyTorch.
Si en la lección 10 la derivada de UNA variable se obtenía con duales, aquí se obtienen las derivadas de TODAS las
variables a la vez recorriendo el cálculo hacia atrás.

  Concepto               Qué es                                               Trampa típica
  gradiente ∇f           vector de parciales (∂f/∂x₁ … ∂f/∂xₙ): apunta a la  es un vector del ESPACIO DE ENTRADA, no un punto
                         máxima subida y su módulo es la pendiente máxima     de la gráfica; ∇f = 0 no implica mínimo
  curva de nivel         conjunto {f = c}: el gradiente es perpendicular a    la perpendicularidad solo es exacta en el punto,
                         ella en cada punto                                   no a lo largo de toda la curva
  descenso de gradiente  x ← x - η·∇f(x): repetir el paso contra el gradiente  η demasiado grande no «oscila un poco»: DIVERGE
  tasa η y constante L   η debe cumplir η < 2/L, con L la curvatura máxima    una η que funciona en una dirección explota en otra
                         (mayor autovalor del hessiano)
  número de condición κ  cociente curvatura máxima / mínima (L/μ): cuántas    el mismo problema reescalado (centrar x) baja κ
                         veces peor es la dirección «llana» que la «empinada» y acelera el descenso sin tocar el algoritmo
  grafo de cómputo       DAG cuyos nodos son los valores intermedios y cuyas  un nodo usado dos veces recibe gradiente por dos
                         aristas son las operaciones elementales              caminos: hay que SUMARLOS, no sobrescribir
  modo inverso           regla de la cadena aplicada de la salida hacia las   exige guardar el paso hacia delante (memoria)
  (backprop)             entradas: UN recorrido da TODAS las parciales        y un orden correcto de recorrido
  orden topológico       ordenación del DAG donde cada nodo va tras aquello   propagar antes de que el nodo haya recibido todas
                         de lo que depende (un DFS en post-orden la da)       sus contribuciones da gradientes parciales (mal)

Costes: gradiente numérico = 2n evaluaciones de f (n variables). Un paso de descenso = un gradiente. Autodiff inverso:
gradiente COMPLETO en O(coste de f) (una pasada hacia delante + una hacia atrás, ~2-3x f), sin depender de n: por eso se
entrenan redes con millones de parámetros. El orden topológico por DFS es O(V + E) en el tamaño del grafo.
"""
import math

import matplotlib.pyplot as plt
import numpy as np


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. PARCIALES Y GRADIENTE: LA DIRECCIÓN DE MÁXIMA SUBIDA
# ═════════════════════════════════════════════════════════════════
# ∂f/∂x es la derivada de f(x, y) tratando y como constante (lección 10, una variable cada vez). Se aproxima igual, con
# diferencia centrada, moviendo UNA coordenada. El gradiente apila las parciales: ∇f = (∂f/∂x, ∂f/∂y).
titulo('1. Parciales y gradiente')


def cuenco(x, y):
    return x ** 2 + 3 * y ** 2                  # f(x, y) = x² + 3y²  →  ∇f = (2x, 6y)


def parciales(f, x: float, y: float, h: float = 1e-5):
    """Gradiente de f(x, y) con diferencias centradas: una coordenada se mueve y la otra se queda quieta."""
    return np.array([(f(x + h, y) - f(x - h, y)) / (2 * h),
                     (f(x, y + h) - f(x, y - h)) / (2 * h)])


p = np.array([1.0, 1.0])
g = parciales(cuenco, *p)
print('∇f(1, 1) numérico:', g, '· analítico: [2. 6.] · error', np.abs(g - [2.0, 6.0]).max())

# Derivada direccional: D_u f = ∇f · u = |∇f|·cos θ, con θ el ángulo entre u y el gradiente. Es máxima cuando u ∥ ∇f.
angulos = np.linspace(0, 2 * np.pi, 3600, endpoint=False)
direcciones = np.column_stack([np.cos(angulos), np.sin(angulos)])          # 3600 vectores unitarios
pendientes = direcciones @ g                                                # D_u f para cada dirección u
mejor = angulos[pendientes.argmax()]
print(f'dirección de mayor pendiente: {math.degrees(mejor):.1f}° · ángulo del gradiente: '
      f'{math.degrees(math.atan2(g[1], g[0])):.1f}° · pendiente máxima {pendientes.max():.4f} = |∇f| = {np.linalg.norm(g):.4f}')

# Perpendicularidad: un paso s a lo largo del gradiente sube ≈ s·|∇f|; un paso a lo largo de la tangente a la curva de
# nivel, t = (-∂f/∂y, ∂f/∂x)/|∇f|, no cambia f a primer orden (solo a segundo, O(s²)).
s = 1e-3
tangente = np.array([-g[1], g[0]]) / np.linalg.norm(g)
sube_gradiente = cuenco(*(p + s * g / np.linalg.norm(g))) - cuenco(*p)
sube_tangente = cuenco(*(p + s * tangente)) - cuenco(*p)
print(f'paso {s} a lo largo del gradiente: Δf = {sube_gradiente:.2e} · a lo largo de la curva de nivel: Δf = {sube_tangente:.2e}')

gx, gy = np.meshgrid(np.linspace(-2, 2, 200), np.linspace(-1.5, 1.5, 200))
px, py = np.meshgrid(np.linspace(-1.5, 1.5, 7), np.linspace(-1, 1, 5))
plt.figure(figsize=(6.5, 4.5))
plt.contour(gx, gy, cuenco(gx, gy), levels=10, cmap='Greys')
plt.quiver(px, py, 2 * px, 6 * py, color='tab:red', angles='xy')              # flechas ∇f = (2x, 6y)
plt.gca().set_aspect('equal')
plt.title('Curvas de nivel de x² + 3y² y su gradiente (flechas): perpendicular y hacia fuera')
plt.xlabel('x')
plt.ylabel('y')
plt.show()
# Cada flecha corta la curva de nivel en ángulo recto y apunta hacia donde f crece: para MINIMIZAR se va en sentido contrario.


# ═════════════════════════════════════════════════════════════════
# 2. DESCENSO DE GRADIENTE EN UN CUENCO ALARGADO
# ═════════════════════════════════════════════════════════════════
# Si el gradiente apunta a la máxima subida, -∇f apunta a la máxima bajada: x_{k+1} = x_k - η·∇f(x_k).
# Para f(x, y) = x² + κ·y² (hessiano diagonal 2 y 2κ, así que L = 2κ) el paso se separa por coordenadas:
#   x ← (1 - 2η)·x        y ← (1 - 2κη)·y
# Cada coordenada converge solo si |1 - η·λ| < 1, es decir η < 2/λ; para que lo hagan todas: η < 2/L = 1/κ. Si 1 - 2κη < 0
# la y cambia de signo en cada paso (zigzag a través del valle); si pasa de -1 diverge. Y la velocidad la manda la coordenada
# lenta (x, factor 1 - 2η ≈ 1 si η es chica por culpa de κ grande): el número de pasos crece como κ.
titulo('2. Descenso de gradiente: η y número de condición κ')


def descenso_demo(grad, x0, tasa: float, pasos: int):
    """Trayectoria con un número FIJO de pasos (el ejercicio `descenso_gradiente` añade un criterio de parada)."""
    punto = np.array(x0, dtype=float)
    camino = [punto]
    for _ in range(pasos):
        punto = punto - tasa * grad(punto)
        camino.append(punto)
    return np.array(camino)


def grad_cuenco(kappa: float):
    return lambda q: np.array([2 * q[0], 2 * kappa * q[1]])                 # ∇(x² + κy²)


def pasos_hasta(camino, tol: float = 1e-6) -> int:
    return int(np.argmax(np.linalg.norm(camino, axis=1) < tol))


print(f'{"κ":>5} {"η = 0.9/κ":>10} {"pasos hasta |x| < 1e-6":>24} {"η óptima 1/(1+κ)":>18} {"pasos":>7}')
for kappa in (1, 2, 10, 50, 200):
    lento = descenso_demo(grad_cuenco(kappa), [1.0, 1.0], 0.9 / kappa, 3000)
    optimo = descenso_demo(grad_cuenco(kappa), [1.0, 1.0], 1 / (1 + kappa), 3000)
    print(f'{kappa:5d} {0.9 / kappa:10.4f} {pasos_hasta(lento):24d} {1 / (1 + kappa):18.4f} {pasos_hasta(optimo):7d}')
# Con η = 0.9/κ los pasos crecen ~linealmente con κ (~7.5·κ). Con la η óptima la tasa de contracción es (κ-1)/(κ+1) → 1:
# tampoco se escapa. Mal condicionado = lento, y no se arregla afinando η: se arregla cambiando el problema (sección 3).

kappa = 10.0                                    # el eje y es 10 veces más empinado que el x: L = 20, 2/L = 0.1
inicio = [1.0, 0.3]
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.2))
cx, cy = np.meshgrid(np.linspace(-1.3, 1.3, 240), np.linspace(-0.6, 0.6, 240))
ax1.contour(cx, cy, cx ** 2 + kappa * cy ** 2, levels=14, cmap='Greys')
for tasa, color, nombre in ((0.02, 'tab:green', 'η = 0.02 (lenta, sin zigzag)'),
                            (0.09, 'tab:blue', 'η = 0.09 (< 2/L: zigzag que converge)'),
                            (0.105, 'tab:red', 'η = 0.105 (> 2/L = 0.1: diverge)')):
    camino = descenso_demo(grad_cuenco(kappa), inicio, tasa, 14)
    ax1.plot(camino[:, 0], camino[:, 1], 'o-', color=color, markersize=3, linewidth=1, label=nombre)
ax1.set_xlim(-1.3, 1.3)
ax1.set_ylim(-0.6, 0.6)
ax1.set_title('Trayectorias sobre x² + 10y²')
ax1.legend(fontsize=8, loc='lower left')
for k, color in ((2, 'tab:green'), (10, 'tab:blue'), (50, 'tab:red')):
    camino = descenso_demo(grad_cuenco(k), [1.0, 1.0], 0.9 / k, 400)
    ax2.semilogy(np.linalg.norm(camino, axis=1), color=color, label=f'κ = {k}')
ax2.set_title('Distancia al mínimo con η = 0.9/κ: más κ, más pasos')
ax2.set_xlabel('paso')
ax2.legend()
plt.show()
# Izquierda: con η = 0.09 la y rebota de lado a lado (factor 1 - 1.8 = -0.8) mientras la x avanza despacio: el zigzag
# típico. Con η = 0.105 el factor de y es -1.1: la amplitud crece y el descenso se escapa del cuenco.


# ═════════════════════════════════════════════════════════════════
# 3. REGRESIÓN LINEAL POR DESCENSO DE GRADIENTE (Y LA FORMA CERRADA)
# ═════════════════════════════════════════════════════════════════
# Modelo ŷ = m·x + b. Pérdida ECM: L(m, b) = (1/n)·Σ eᵢ² con eᵢ = m·xᵢ + b - yᵢ. Regla de la cadena:
#   ∂L/∂m = (1/n)·Σ 2eᵢ·∂eᵢ/∂m = 2·mean(e·x)        ∂L/∂b = 2·mean(e)
# L es una cuadrática en (m, b) con hessiano constante H = 2·[[mean(x²), mean(x)], [mean(x), 1]]: todo lo de la sección 2
# vale tal cual (L = λmax(H), κ = λmax/λmin). La forma cerrada (lstsq, lección 08) es el mínimo exacto de esa cuadrática.
titulo('3. Regresión lineal: descenso de gradiente frente a forma cerrada')

rng = np.random.default_rng(0)
x = rng.uniform(0, 10, 40)
y = 2.5 * x + 1 + rng.normal(0, 1, 40)
cerrada = np.linalg.lstsq(np.column_stack([x, np.ones_like(x)]), y, rcond=None)[0]
print('forma cerrada (lstsq):  m = %.6f  b = %.6f' % tuple(cerrada))


def ecm_de(xs, ys):
    return lambda m, b: float(np.mean((m * xs + b - ys) ** 2))


m0, b0 = 1.0, -1.0
e = m0 * x + b0 - y
a_mano = np.array([2 * np.mean(e * x), 2 * np.mean(e)])
print('en (1, -1):  gradiente a mano', a_mano, '· numérico', parciales(ecm_de(x, y), m0, b0),
      '→ diferencia', np.abs(a_mano - parciales(ecm_de(x, y), m0, b0)).max())


def hessiano_ecm(xs):
    return 2 * np.array([[np.mean(xs ** 2), np.mean(xs)], [np.mean(xs), 1.0]])


def resolver_gd(xs, ys, pasos: int):
    """GD con η = 1/L (L = autovalor máximo del hessiano) y gradiente NUMÉRICO: solo para ver cuánto converge."""
    ecm = ecm_de(xs, ys)
    autovalores = np.linalg.eigvalsh(hessiano_ecm(xs))
    camino = descenso_demo(lambda q: parciales(ecm, q[0], q[1]), [0.0, 0.0], 1 / autovalores[-1], pasos)
    return camino[-1], autovalores[-1] / autovalores[0]


crudo, kappa_crudo = resolver_gd(x, y, 1000)
centrado, kappa_centrado = resolver_gd(x - x.mean(), y, 1000)       # x centrada: la columna de x y la de 1s quedan ortogonales
centrado[1] -= centrado[0] * x.mean()                               # deshacer el centrado: y = m(x - x̄) + b' = m·x + (b' - m·x̄)
print(f'1000 pasos, x tal cual:   κ = {kappa_crudo:6.1f} → error vs forma cerrada {np.abs(crudo - cerrada).max():.2e}')
print(f'1000 pasos, x centrada:   κ = {kappa_centrado:6.1f} → error vs forma cerrada {np.abs(centrado - cerrada).max():.2e}')
# Mismo algoritmo, mismos pasos, misma η relativa: lo único que cambió es el condicionamiento. Por eso se normalizan las
# entradas antes de entrenar (lección 08, `normalizar`): no es estética, es bajar κ. La forma cerrada cuesta O(n·d²) y deja de
# ser viable con millones de parámetros, donde el descenso (O(n·d) por paso) es la única opción.


# ═════════════════════════════════════════════════════════════════
# 4. AUTODIFF EN MODO INVERSO: EL GRAFO, LA CADENA Y EL ORDEN TOPOLÓGICO
# ═════════════════════════════════════════════════════════════════
# Cada operación crea un NODO que recuerda a sus «hijos» (los operandos). El cálculo queda como un DAG. Sea s = salida:
# cada nodo v guarda grad = ∂s/∂v. Regla de la cadena local: si v = op(a, b), entonces
#   ∂s/∂a += ∂s/∂v · ∂v/∂a        ∂s/∂b += ∂s/∂v · ∂v/∂b        (con +=, no con =)
# Se parte de ∂s/∂s = 1 y se reparte hacia los hijos. Pero un nodo solo puede repartir su grad cuando YA lo ha recibido
# de TODOS los que lo usan: eso es un orden topológico invertido, y se obtiene con un DFS en post-orden (un nodo se
# apunta después de visitar a todos sus hijos). Es el mismo DFS de la lección de grafos, aplicado a un grafo de cálculo.
titulo('4. Autodiff inverso (backprop)')


class ValorDemo:
    """Versión mínima (+, -, ·, tanh) para ver el mecanismo; la completa, con / y potencias, es el ejercicio `Valor`."""

    def __init__(self, dato: float, hijos: tuple = (), etiqueta: str = '') -> None:
        self.dato = float(dato)
        self.grad = 0.0                          # ∂salida/∂(este nodo): lo rellena backward()
        self.hijos = hijos                       # operandos con los que se calculó este nodo (aristas hacia atrás)
        self.etiqueta = etiqueta
        self._retro = lambda: None               # reparte MI grad entre mis hijos; las hojas no reparten nada

    def __add__(self, otro):
        otro = otro if isinstance(otro, ValorDemo) else ValorDemo(otro)
        salida = ValorDemo(self.dato + otro.dato, (self, otro))

        def retro():
            self.grad += salida.grad             # ∂(a+b)/∂a = 1
            otro.grad += salida.grad

        salida._retro = retro
        return salida

    __radd__ = __add__

    def __mul__(self, otro):
        otro = otro if isinstance(otro, ValorDemo) else ValorDemo(otro)
        salida = ValorDemo(self.dato * otro.dato, (self, otro))

        def retro():
            self.grad += otro.dato * salida.grad  # ∂(a·b)/∂a = b
            otro.grad += self.dato * salida.grad  # ∂(a·b)/∂b = a

        salida._retro = retro
        return salida

    __rmul__ = __mul__

    def __neg__(self):
        return self * -1.0

    def __sub__(self, otro):
        return self + (-otro)

    def tanh(self):
        t = math.tanh(self.dato)
        salida = ValorDemo(t, (self,))

        def retro():
            self.grad += (1 - t * t) * salida.grad   # tanh' = 1 - tanh²: reutiliza el valor del paso hacia delante

        salida._retro = retro
        return salida

    def topologico(self) -> list:
        orden, visto = [], set()

        def visitar(v):
            if id(v) in visto:
                return
            visto.add(id(v))
            for h in v.hijos:
                visitar(h)
            orden.append(v)                      # post-orden: v va DESPUÉS de todo aquello de lo que depende

        visitar(self)
        return orden

    def backward(self) -> None:
        orden = self.topologico()
        for v in orden:
            v.grad = 0.0
        self.grad = 1.0                          # ∂s/∂s = 1
        for v in reversed(orden):                # consumidores antes que dependencias
            v._retro()


x_, y_ = ValorDemo(2.0, etiqueta='x'), ValorDemo(-3.0, etiqueta='y')
producto = x_ * y_
producto.etiqueta = 'x·y'
z = producto + x_                                # z = x·y + x: x se usa DOS veces (por el producto y por la suma)
z.etiqueta = 'z'
z.backward()
print('orden topológico:', [v.etiqueta or f'{v.dato:g}' for v in z.topologico()])
print(f'z = {z.dato:g} · ∂z/∂x = {x_.grad:g} (exacto: y + 1 = -2) · ∂z/∂y = {y_.grad:g} (exacto: x = 2)')
# x recibe 1 por el camino de la suma y y = -3 por el del producto: -3 + 1 = -2. Si se SOBRESCRIBIERA en vez de acumular, saldría 1 o -3.

for v in (x_, y_, producto, z):                  # el error típico: repartir en el orden del DFS (sin invertirlo)
    v.grad = 0.0
z.grad = 1.0
for v in z.topologico():
    v._retro()
print(f'sin invertir el orden: ∂z/∂x = {x_.grad:g}, ∂z/∂y = {y_.grad:g}  (mal: z repartió antes de recibir)')


def suma_cuadrados(n: int):
    entradas = [ValorDemo(0.1 * (i + 1)) for i in range(n)]
    total = ValorDemo(0.0)
    for v in entradas:
        total = total + v * v                    # f(x₁…xₙ) = Σ xᵢ²  →  ∂f/∂xᵢ = 2xᵢ
    return entradas, total


n = 100
entradas, total = suma_cuadrados(n)
nodos = len(total.topologico())
total.backward()
error = max(abs(v.grad - 2 * v.dato) for v in entradas)
print(f'n = {n} entradas, grafo de {nodos} nodos · UN backward · error máximo de las {n} parciales: {error:.1e}')
print(f'coste para el gradiente completo → numérico: 2n = {2 * n} evaluaciones de f (~{2 * n * nodos} operaciones) · '
      f'duales: n = {n} pasadas · inverso: 1 pasada hacia delante + 1 hacia atrás (~{2 * nodos} operaciones)')
# Esa es la ventaja: para una salida escalar (la pérdida) y n parámetros, el modo inverso cuesta O(coste de f) y no O(n·coste de f).
# El precio: guardar todos los valores intermedios en memoria hasta el backward. Con una salida y muchas entradas (ML)
# gana el inverso; con muchas salidas y pocas entradas gana el modo hacia delante (duales).


# ═════════════════════════════════════════════════════════════════
# 5. UNA NEURONA ENTRENADA CON NUESTRO AUTODIFF
# ═════════════════════════════════════════════════════════════════
# a = tanh(w·x + b), pérdida ECM sobre las muestras. Sin escribir ninguna derivada a mano: se construye el grafo, se llama a
# backward() y cada parámetro ya sabe su grad. Problema «profesor-alumno»: los datos salen de una neurona con w = 1.5 y
# b = -0.5; entrenar es recuperar esos dos números.
titulo('5. Una neurona con autodiff')

xs_n = np.linspace(-2, 2, 9)
ys_n = np.tanh(1.5 * xs_n - 0.5)


def perdida_neurona(w, b):
    total = ValorDemo(0.0)
    for xi, yi in zip(xs_n, ys_n):
        error = (w * float(xi) + b).tanh() - float(yi)
        total = total + error * error
    return total * (1.0 / len(xs_n))


w, b = ValorDemo(0.0), ValorDemo(0.0)
perdida_neurona(w, b).backward()
numerico = parciales(lambda wv, bv: perdida_neurona(ValorDemo(wv), ValorDemo(bv)).dato, 0.0, 0.0)
print(f'primer paso: backprop (∂L/∂w, ∂L/∂b) = ({w.grad:.8f}, {b.grad:.8f}) · numérico = ({numerico[0]:.8f}, {numerico[1]:.8f})')

historia = []
pw, pb = 0.0, 0.0
for paso in range(301):
    w, b = ValorDemo(pw), ValorDemo(pb)          # grafo NUEVO en cada paso: los parámetros son hojas frescas
    perdida = perdida_neurona(w, b)
    perdida.backward()
    historia.append(perdida.dato)
    if paso % 100 == 0:
        print(f'paso {paso:3d}: pérdida {perdida.dato:.3e}  w = {pw:.4f}  b = {pb:.4f}')
    pw -= 0.5 * w.grad                           # descenso de gradiente con η = 0.5
    pb -= 0.5 * b.grad
print(f'objetivo: w = 1.5, b = -0.5 · obtenido: w = {pw:.4f}, b = {pb:.4f}')

plt.figure(figsize=(6.5, 3.8))
plt.semilogy(historia)
plt.title('Pérdida de la neurona durante el entrenamiento')
plt.xlabel('paso')
plt.ylabel('ECM')
plt.show()
# Una red grande es lo mismo con más nodos: más neuronas = más hojas (w, b) y más tanh en el grafo. backward() sigue
# siendo UNA pasada y el descenso (sección 2) sigue siendo x ← x - η·∇.


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · gradiente_numerico ────────────────────────────
def gradiente_numerico(f, x, h: float = 1e-5):
    """
    Gradiente de f: R^n → R por diferencias centradas, una coordenada cada vez (sección 1, ahora en n dimensiones).
    `x` es un vector (ndarray o lista, de floats o enteros); `f` recibe un ndarray 1-D de floats con el MISMO tamaño que x
    y devuelve un número. Devuelve un ndarray float64 con forma (n,) con
        g[i] = (f(x + h·eᵢ) - f(x - h·eᵢ)) / (2h)         (eᵢ: el vector con un 1 en la posición i)
    Exactamente 2n evaluaciones de f. No modifica `x`. Coste: O(n · coste de f).
    """
    pendiente()


# ── Ejercicio 2 · descenso_gradiente ────────────────────────────
def descenso_gradiente(grad, x0, tasa: float, pasos: int, tol: float = 0.0):
    """
    Descenso de gradiente x_{k+1} = x_k - tasa·grad(x_k) y devuelve la TRAYECTORIA: un ndarray de forma (k + 1, n) cuya
    fila 0 es x0 y cuya última fila es el punto final (por eso se puede dibujar sobre las curvas de nivel).
      - `grad(x)` recibe un ndarray 1-D y devuelve el gradiente (ndarray o lista); `x0` es un vector (ndarray o lista).
      - Hace como máximo `pasos` pasos. Criterio de parada: antes de cada paso, si la norma del gradiente es
        MENOR que `tol` (estricto), se detiene. Con tol = 0.0 nunca se detiene antes: siempre salen pasos + 1 filas.
      - Si x0 ya cumple el criterio, devuelve solo [x0] (forma (1, n)).
      - pasos < 0 → ValueError. No modifica x0. No hay protección frente a la divergencia (η > 2/L): la trayectoria crece.
    Coste: O(pasos · coste de grad).
    """
    pendiente()


# ── Ejercicio 3 · regresion_gd ──────────────────────────────────
def regresion_gd(x, y, tasa: float, pasos: int):
    """
    Ajusta y ≈ m·x + b minimizando el ECM = mean((m·x + b - y)²) por descenso de gradiente, con el gradiente ESCRITO A MANO
    (regla de la cadena de la sección 3, sin gradiente numérico). Parte de m = 0, b = 0 y hace exactamente `pasos` pasos
    simultáneos (m y b se actualizan con el gradiente del mismo punto). Devuelve (m, b) como una tupla de dos float.
    x e y son secuencias o ndarray de la misma longitud (distinta longitud → ValueError). Con pasos = 0 devuelve (0.0, 0.0).
    Si tasa < 2/λmax(H) converge a la forma cerrada de la lección 08. Coste: O(pasos · n).
    """
    pendiente()


# ── Ejercicio 4 · Valor ─────────────────────────────────────────
class Valor:
    """
    Nodo de un grafo de cómputo con autodiff inverso (estilo micrograd). Atributos: `dato` (el valor, float) y `grad`
    (∂salida/∂este nodo, float, 0.0 al crearse). Un número suelto es una constante: se promueve a Valor.
      Valor(dato)                 # una hoja (parámetro o entrada)
      +, -, *, / entre Valor y Valor, y entre Valor y número (por cualquier lado: 3 * v, 1 / v, 5 - v)
      -v                          # negación
      v ** n                      # n es un NÚMERO (int o float), constante: no puede ser un Valor (→ TypeError)
                                  # v ** 0 vale 1.0 con gradiente 0 aunque v.dato sea 0; 0 ** negativo → ZeroDivisionError
      v.tanh()                    # tangente hiperbólica; tanh' = 1 - tanh²
      v.backward()                # calcula el grad de TODOS los nodos alcanzables desde v, tomándolo a él como la salida
    Cada operación devuelve un Valor NUEVO que recuerda a sus operandos (el grafo); no modifica los operandos.
    backward() debe:
      1) ordenar el grafo topológicamente con un DFS en post-orden, ITERATIVO (con pila explícita: el grafo puede tener
         miles de nodos en cadena y la recursión de Python no llega), visitando cada nodo una sola vez;
      2) poner grad = 0.0 en todos los nodos del grafo, y 1.0 en la raíz (así llamarlo dos veces da lo mismo);
      3) recorrer el orden al revés aplicando la regla de la cadena local con `+=`: si un nodo se usa dos veces
         (x * x, x + x) sus gradientes se ACUMULAN. (PyTorch acumula entre llamadas y exige zero_grad(); aquí cada backward
         parte de cero.)
    Coste: cada operación O(1); backward() O(V + E) en tiempo y espacio.
    """

    def __init__(self, dato: float) -> None:
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

    def __pow__(self, n):
        pendiente()

    def tanh(self):
        pendiente()

    def backward(self) -> None:
        pendiente()


# ── Ejercicio 5 · entrenar_neurona ──────────────────────────────
def entrenar_neurona(xs, ys, tasa: float, pasos: int):
    """
    Entrena UNA neurona a = tanh(w·x + b) con tu clase `Valor` (sin derivar nada a mano: backward()).
      - `xs`: lista de n muestras, cada una una lista de d entradas; `ys`: lista de n objetivos (en (-1, 1)).
        xs vacía o len(xs) != len(ys) → ValueError.
      - Parámetros iniciales FIJOS: w = [0.5] * d y b = 0.0.
      - Pérdida: ECM = (1/n)·Σ (tanh(w·xᵢ + b) - yᵢ)². Cada paso construye un grafo NUEVO con los parámetros como hojas
        Valor, llama a backward() y actualiza (descenso de gradiente simultáneo): p ← p - tasa·p.grad.
      - Hace exactamente `pasos` actualizaciones y devuelve la tupla (w, b, perdida): `w` una lista de d float, `b` un
        float y `perdida` el ECM evaluado con los parámetros FINALES (los de después de la última actualización).
        Con pasos = 0 son los parámetros iniciales y su pérdida.
    Coste: O(pasos · n · d).
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS (los resultados aproximados se comparan con una tolerancia explícita)
# ═════════════════════════════════════════════════════════════════

def _cerca(tolerancia: float):
    """Comparador para `prueba`: |actual - esperado| <= tolerancia en cada componente (forma incluida)."""
    def comparar(actual, esperado) -> bool:
        try:
            a, e = np.asarray(actual, dtype=float), np.asarray(esperado, dtype=float)
        except (TypeError, ValueError):
            return False
        return a.shape == e.shape and bool(np.allclose(a, e, rtol=0.0, atol=tolerancia))
    return comparar


def _plano(resultado) -> np.ndarray:
    return np.hstack([np.ravel(np.asarray(v, dtype=float)) for v in resultado])


def _cerca_neurona(tolerancia: float):
    """Compara (w, b, perdida) aplanado: la tupla mezcla una lista y dos números."""
    def comparar(actual, esperado) -> bool:
        try:
            a, e = _plano(actual), _plano(esperado)
        except (TypeError, ValueError):
            return False
        return a.shape == e.shape and bool(np.allclose(a, e, rtol=0.0, atol=tolerancia))
    return comparar


def _llamadas_gradiente() -> tuple:
    vistos = []

    def f(v):
        vistos.append(v.shape)
        return float(v @ v)

    gradiente_numerico(f, [1.0, 2.0, 3.0])
    return len(vistos), set(vistos)


prueba('gradiente_numerico', {
    'paraboloide x² + 3y² en (1, 1)': (((lambda v: v[0] ** 2 + 3 * v[1] ** 2), np.array([1.0, 1.0])), np.array([2.0, 6.0])),
    'tres variables: x·y·z en (1, 2, 3)': (((lambda v: v[0] * v[1] * v[2]), np.array([1.0, 2.0, 3.0])), np.array([6.0, 3.0, 2.0])),
    'constante: ceros': ((lambda v: 5.0, np.array([1.0, 2.0, 3.0])), np.zeros(3)),
    '‖x‖² en 5 dimensiones: 2x': ((lambda v: float(v @ v), np.arange(5.0)), 2 * np.arange(5.0)),
    'cuadrática con h grande: exacta': ((lambda v: float(v @ v), np.array([1.0, 2.0]), 0.5), np.array([2.0, 4.0])),
    'cúbica con h grande: el error es h²': ((lambda v: v[0] ** 3, np.array([1.0]), 0.5), np.array([3.25])),
    'acepta una lista': ((lambda v: v[0] * v[1], [3.0, 4.0]), np.array([4.0, 3.0])),
    'x entera (dtype int)': ((lambda v: v[0] ** 2 + v[1], np.array([3, 4])), np.array([6.0, 1.0])),
}, comparador=_cerca(1e-6))


def _no_modifica_x() -> bool:
    x = np.array([1.0, 2.0, 3.0])
    original = x.copy()
    gradiente_numerico(lambda v: float(v @ v), x)
    return bool(np.array_equal(x, original))


def _tipo_gradiente() -> tuple:
    g = gradiente_numerico(lambda v: float(v @ v), np.array([1, 2, 3]))
    return type(g).__name__, str(g.dtype), g.shape


grupo('gradiente_numerico (contrato)')
comprueba('exactamente 2n evaluaciones, siempre con un ndarray de forma (n,)', _llamadas_gradiente, (6, {(3,)}))
comprueba('no modifica x', _no_modifica_x, True)
comprueba('devuelve un ndarray float64 de forma (n,)', _tipo_gradiente, ('ndarray', 'float64', (3,)))


def _cuenco_exacto(kappa: float, tasa: float, inicio, pasos: int) -> np.ndarray:
    """Trayectoria EXACTA de x² + κy² con paso fijo: x ← (1 - 2η)·x, y ← (1 - 2κη)·y (forma cerrada)."""
    k = np.arange(pasos + 1)
    return np.column_stack([(1 - 2 * tasa) ** k * inicio[0], (1 - 2 * kappa * tasa) ** k * inicio[1]])


def _grad_cuenco(kappa: float):
    return lambda q: np.array([2 * q[0], 2 * kappa * q[1]])


prueba('descenso_gradiente', {
    'x² + y² con η = 0.25: la distancia se divide entre 2': ((lambda q: 2 * q, [1.0, 0.0], 0.25, 3),
                                                              np.array([[1.0, 0.0], [0.5, 0.0], [0.25, 0.0], [0.125, 0.0]])),
    'cuenco κ = 10, η = 0.09: zigzag en y que converge': ((_grad_cuenco(10), [1.0, 0.3], 0.09, 12), _cuenco_exacto(10, 0.09, [1.0, 0.3], 12)),
    'cuenco κ = 10, η = 0.02: monótono y lento': ((_grad_cuenco(10), [1.0, 0.3], 0.02, 12), _cuenco_exacto(10, 0.02, [1.0, 0.3], 12)),
    'η > 2/L (κ = 10, η = 0.11): diverge': ((_grad_cuenco(10), [1.0, 0.3], 0.11, 10), _cuenco_exacto(10, 0.11, [1.0, 0.3], 10)),
    'pasos = 0: solo el punto inicial': ((_grad_cuenco(3), [1.0, 2.0], 0.1, 0), np.array([[1.0, 2.0]])),
    'grad devuelve una lista': ((lambda q: [2 * q[0], 2 * q[1]], [1.0, 0.0], 0.25, 1), np.array([[1.0, 0.0], [0.5, 0.0]])),
    'tol: para en cuanto |∇f| < tol (2·0.5^5 < 0.1)': ((lambda q: 2 * q, [1.0, 0.0], 0.25, 100, 0.1),
                                                       np.array([[0.5 ** k, 0.0] for k in range(6)])),
    'tol ya cumplida en x0: solo [x0]': ((lambda q: 2 * q, [0.01, 0.0], 0.25, 100, 0.1), np.array([[0.01, 0.0]])),
}, comparador=_cerca(1e-9))


def _descenso_no_modifica() -> bool:
    x0 = np.array([1.0, 2.0])
    original = x0.copy()
    descenso_gradiente(lambda q: 2 * q, x0, 0.1, 5)
    return bool(np.array_equal(x0, original))


def _una_fila_por_paso() -> tuple:
    t = descenso_gradiente(lambda q: 2 * q, [1.0, 1.0], 0.1, 7)
    return type(t).__name__, t.shape


grupo('descenso_gradiente (contrato)')
comprueba('no modifica x0', _descenso_no_modifica, True)
comprueba('devuelve un ndarray (pasos + 1, n)', _una_fila_por_paso, ('ndarray', (8, 2)))
lanza('pasos negativos', lambda: descenso_gradiente(lambda q: 2 * q, [1.0], 0.1, -1), ValueError)


def _forma_cerrada(x, y) -> tuple:
    m, b = np.linalg.lstsq(np.column_stack([x, np.ones(len(x))]), y, rcond=None)[0]
    return float(m), float(b)


_rng_reg = np.random.default_rng(1)
_x_ruido = _rng_reg.normal(0, 1, 50)
_y_ruido = 1.5 * _x_ruido + 0.7 + _rng_reg.normal(0, 0.3, 50)
_x_centr = np.linspace(-1, 1, 21)

prueba('regresion_gd', {
    'un paso a mano: m = 2η·mean(xy), b = 2η·mean(y)': (([0.0, 1.0, 2.0, 3.0], [1.0, 3.0, 5.0, 7.0], 0.01, 1), (0.17, 0.08)),
    'pasos = 0: (0, 0)': (([0.0, 1.0, 2.0], [1.0, 2.0, 3.0], 0.1, 0), (0.0, 0.0)),
    'dos pasos a mano': (([0.0, 1.0, 2.0, 3.0], [1.0, 3.0, 5.0, 7.0], 0.01, 2), (0.3257, 0.1533)),
    'recta exacta con x centrada: (3, -2)': ((_x_centr, 3 * _x_centr - 2, 0.25, 400), (3.0, -2.0)),
    'recta horizontal: m = 0': (([-1.0, 0.0, 1.0], [5.0, 5.0, 5.0], 0.25, 600), (0.0, 5.0)),
    'con ruido: coincide con la forma cerrada': ((_x_ruido, _y_ruido, 0.1, 1000), _forma_cerrada(_x_ruido, _y_ruido)),
}, comparador=_cerca(1e-6))


def _tipos_regresion() -> tuple:
    r = regresion_gd([0.0, 1.0], [0.0, 1.0], 0.1, 3)
    return type(r).__name__, [type(v).__name__ for v in r]


grupo('regresion_gd (contrato)')
comprueba('devuelve una tupla de dos float de Python', _tipos_regresion, ('tuple', ['float', 'float']))
lanza('longitudes distintas', lambda: regresion_gd([1.0, 2.0], [1.0], 0.1, 5), ValueError)


def _par(v) -> tuple:
    return (float(v.dato), float(v.grad))


def _th(v):
    return v.tanh() if isinstance(v, Valor) else math.tanh(v)       # el mismo código sirve con Valor y con float


def _gradientes(f, *valores) -> tuple:
    """Gradientes de f en `valores` por backward() sobre Valor."""
    hojas = [Valor(v) for v in valores]
    f(*hojas).backward()
    return tuple(float(h.grad) for h in hojas)


def _contra_diferencias(f, *valores) -> bool:
    """¿Coinciden los gradientes de backward() con diferencias finitas centradas sobre los mismos floats?"""
    for i, g in enumerate(_gradientes(f, *valores)):
        mas, menos = list(valores), list(valores)
        mas[i] += 1e-6
        menos[i] -= 1e-6
        numerico = (f(*mas) - f(*menos)) / 2e-6
        if abs(g - numerico) > 1e-6 * max(1.0, abs(numerico)):
            return False
    return True


grupo('Valor: paso hacia delante y atributos')
comprueba('Valor(3): dato 3.0 y grad 0.0', lambda: _par(Valor(3)), (3.0, 0.0))
comprueba('suma', lambda: (Valor(2) + Valor(3.5)).dato, 5.5)
comprueba('resta de Valor y número, por ambos lados', lambda: ((Valor(5) - 2).dato, (10 - Valor(4)).dato), (3.0, 6.0))
comprueba('producto con número por ambos lados', lambda: ((Valor(3) * 4).dato, (4 * Valor(3)).dato), (12.0, 12.0))
comprueba('cociente de Valor y número, por ambos lados', lambda: ((Valor(6) / 4).dato, (6 / Valor(4)).dato), (1.5, 1.5))
comprueba('potencia entera, negativa y fraccionaria', lambda: ((Valor(3) ** 2).dato, (Valor(2) ** -1).dato, (Valor(9) ** 0.5).dato), (9.0, 0.5, 3.0))
comprueba('tanh(0.5) coincide con math.tanh', lambda: Valor(0.5).tanh().dato, math.tanh(0.5))


def _sin_mutar() -> tuple:
    a, b = Valor(2), Valor(3)
    _ = a + b, a * b, a - b, a / b, a ** 2, -a, a.tanh()
    return _par(a), _par(b)


comprueba('las operaciones no modifican los operandos', _sin_mutar, ((2.0, 0.0), (3.0, 0.0)))
lanza('exponente que es un Valor', lambda: Valor(2) ** Valor(2), TypeError)
lanza('dividir entre un Valor que vale 0', lambda: Valor(1) / Valor(0), ZeroDivisionError)


def _hojas_y_raiz() -> tuple:
    a, b = Valor(2), Valor(3)
    c = a * b
    c.backward()
    return _par(c), _par(a), _par(b)


grupo('Valor: backward() y regla de la cadena')
comprueba('c = a·b: la raíz vale 1; ∂c/∂a = b, ∂c/∂b = a', _hojas_y_raiz, ((6.0, 1.0), (2.0, 3.0), (3.0, 2.0)))
comprueba('suma: reparte 1 a cada operando', lambda: _gradientes(lambda a, b: a + b, 2.0, 5.0), (1.0, 1.0))
comprueba('resta: +1 y -1', lambda: _gradientes(lambda a, b: a - b, 2.0, 5.0), (1.0, -1.0))
comprueba('cociente: ∂/∂a = 1/b, ∂/∂b = -a/b²', lambda: _gradientes(lambda a, b: a / b, 6.0, 2.0), (0.5, -1.5))
comprueba('potencia: n·a^(n-1)', lambda: _gradientes(lambda a: a ** 3, 2.0), (12.0,))
comprueba('v ** 0 en 0: valor 1 y gradiente 0, sin fallar', lambda: _gradientes(lambda a: a ** 0, 0.0), (0.0,))
comprueba('tanh en 0: pendiente 1', lambda: _gradientes(lambda a: a.tanh(), 0.0), (1.0,))
comprueba('tanh saturada (20): pendiente 0', lambda: _gradientes(lambda a: a.tanh(), 20.0), (0.0,))
comprueba('regla de la cadena: tanh(2x) en 0 vale 2', lambda: _gradientes(lambda a: (2 * a).tanh(), 0.0), (2.0,))

grupo('Valor: un nodo usado dos veces (los gradientes se ACUMULAN)')
comprueba('x·x → 2x', lambda: _gradientes(lambda a: a * a, 3.0), (6.0,))
comprueba('x + x → 2', lambda: _gradientes(lambda a: a + a, 3.0), (2.0,))
comprueba('x·x·x → 3x²', lambda: _gradientes(lambda a: a * a * a, 2.0), (12.0,))
comprueba('x·y + x → (y + 1, x)', lambda: _gradientes(lambda a, b: a * b + a, 2.0, -3.0), (-2.0, 2.0))
comprueba('diamante: (2x)·(3x) = 6x² → 12x', lambda: _gradientes(lambda a: (2 * a) * (3 * a), 2.0), (24.0,))
comprueba('tanh(x)·tanh(x) comparte el nodo tanh', lambda: _contra_diferencias(lambda a: _th(a) * _th(a), 0.7), True)


def _idempotente() -> tuple:
    a, b = Valor(2), Valor(-3)
    z = a * b + a
    z.backward()
    z.backward()
    return _par(a), _par(b), _par(z)


def _cadena_profunda() -> tuple:
    a = Valor(1.0)
    s = a
    for _ in range(3000):
        s = s + a                                   # 3000 nodos en cadena: una recursión ingenua no llega
    s.backward()
    return s.dato, a.grad


comprueba('backward() dos veces da lo mismo (parte de cero)', _idempotente, ((2.0, -2.0), (-3.0, 2.0), (-4.0, 1.0)))
comprueba('cadena de 3000 sumas: sin desbordar la pila', _cadena_profunda, (3001.0, 3001.0))

grupo('Valor: contraste con diferencias finitas')
comprueba('x·y + x', lambda: _contra_diferencias(lambda a, b: a * b + a, 1.3, -0.4), True)
comprueba('tanh(x·y) + y²', lambda: _contra_diferencias(lambda a, b: _th(a * b) + b ** 2, 0.8, -1.1), True)
comprueba('(x - y) / (x² + 1)', lambda: _contra_diferencias(lambda a, b: (a - b) / (a * a + 1), 0.6, 1.7), True)
comprueba('3 / x - 2·x (división y resta con número a la izquierda)', lambda: _contra_diferencias(lambda a: 3 / a - 2 * a, 1.4), True)
comprueba('tanh(tanh(x)·y - x³/2)', lambda: _contra_diferencias(lambda a, b: _th(_th(a) * b - a ** 3 / 2), 0.5, 1.2), True)
comprueba('raíz y potencia negativa: √x + x^-2', lambda: _contra_diferencias(lambda a: a ** 0.5 + a ** -2, 1.7), True)
comprueba('grafo con 3 entradas y reutilización', lambda: _contra_diferencias(
    lambda a, b, c: _th(a * b + c) * (a - c) + (b * c) ** 2 / (1 + a * a), 0.3, -0.8, 1.1), True)


def _neurona_ref(xs, ys, tasa: float, pasos: int) -> tuple:
    """Referencia con el gradiente analítico de la neurona, en numpy: dL/dz = (2/n)(a - y)(1 - a²)."""
    X, Y = np.asarray(xs, dtype=float), np.asarray(ys, dtype=float)
    w, b = np.full(X.shape[1], 0.5), 0.0
    for _ in range(pasos):
        a = np.tanh(X @ w + b)
        dz = 2 / len(Y) * (a - Y) * (1 - a * a)
        w, b = w - tasa * (X.T @ dz), b - tasa * dz.sum()
    return list(w), float(b), float(np.mean((np.tanh(X @ w + b) - Y) ** 2))


_Y_AND = [-1.0, -1.0, -1.0, 1.0]
_X_AND = [[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]]
_X_PROF = [[x] for x in np.linspace(-2, 2, 9)]
_Y_PROF = list(np.tanh(1.5 * np.linspace(-2, 2, 9) - 0.5))

prueba('entrenar_neurona', {
    'pasos = 0: parámetros iniciales y su pérdida': ((_X_AND, _Y_AND, 0.5, 0), _neurona_ref(_X_AND, _Y_AND, 0.5, 0)),
    'un paso (gradiente analítico a mano)': ((_X_AND, _Y_AND, 0.5, 1), _neurona_ref(_X_AND, _Y_AND, 0.5, 1)),
    'AND, 100 pasos': ((_X_AND, _Y_AND, 0.5, 100), _neurona_ref(_X_AND, _Y_AND, 0.5, 100)),
    'una entrada, 50 pasos (profesor-alumno)': ((_X_PROF, _Y_PROF, 0.5, 50), _neurona_ref(_X_PROF, _Y_PROF, 0.5, 50)),
    'una sola muestra con tres entradas': (([[1.0, -2.0, 0.5]], [0.3], 0.2, 20), _neurona_ref([[1.0, -2.0, 0.5]], [0.3], 0.2, 20)),
}, comparador=_cerca_neurona(1e-9))


def _signos_and() -> list:
    w, b, _ = entrenar_neurona(_X_AND, _Y_AND, 0.5, 100)
    return [float(np.sign(math.tanh(w[0] * x[0] + w[1] * x[1] + b))) for x in _X_AND]


def _baja_la_perdida() -> bool:
    inicial = entrenar_neurona(_X_PROF, _Y_PROF, 0.5, 0)[2]
    final = entrenar_neurona(_X_PROF, _Y_PROF, 0.5, 150)[2]
    return final < inicial / 100


def _recupera_al_profesor() -> tuple:
    w, b, _ = entrenar_neurona(_X_PROF, _Y_PROF, 0.5, 400)
    return round(w[0], 2), round(b, 2)


def _tipos_neurona() -> list:
    w, b, perdida = entrenar_neurona(_X_AND, _Y_AND, 0.5, 2)
    return [type(w).__name__, type(w[0]).__name__, type(b).__name__, type(perdida).__name__]


def _usa_valor() -> bool:
    llamadas = []
    original = Valor.tanh
    Valor.tanh = lambda self: (llamadas.append(1), original(self))[1]
    try:
        entrenar_neurona([[1.0]], [0.5], 0.1, 1)
    finally:
        Valor.tanh = original
    return len(llamadas) > 0


grupo('entrenar_neurona (comportamiento)')
comprueba('AND: tras entrenar clasifica las 4 muestras', _signos_and, [-1.0, -1.0, -1.0, 1.0])
comprueba('la pérdida baja al menos 100 veces en 150 pasos', _baja_la_perdida, True)
comprueba('recupera la neurona profesora (w = 1.5, b = -0.5)', _recupera_al_profesor, (1.5, -0.5))
comprueba('devuelve (list de float, float, float)', _tipos_neurona, ['list', 'float', 'float', 'float'])
comprueba('construye el grafo con Valor (llama a Valor.tanh)', _usa_valor, True)
lanza('xs e ys de distinta longitud', lambda: entrenar_neurona([[1.0], [2.0]], [0.5], 0.1, 5), ValueError)
lanza('sin muestras', lambda: entrenar_neurona([], [], 0.1, 5), ValueError)

# Esta lección no usa medir(): el tiempo de cada función es lineal en el tamaño que ya fijan los argumentos y lo que se
# aprende aquí no es la forma de la curva sino la CONVERGENCIA (pasos hasta el mínimo, según η y κ) y la exactitud de las
# derivadas. Eso es justo lo que muestran las gráficas de las secciones 2 y 5.
