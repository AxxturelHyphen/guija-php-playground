"""
SOLUCIONES · Tema 14 · Gradiente, descenso y autodiff
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (`math` y `np` ya están importados en el ejemplo.)
"""


def gradiente_numerico(f, x, h: float = 1e-5):
    """
    Gradiente por diferencias centradas, una coordenada cada vez.

    @complejidad Tiempo O(n · coste de f): 2n evaluaciones; espacio O(n).
    @explicacion La parcial i es la derivada de una variable (lección 10) moviendo solo la coordenada i: se suma y se
    resta h en esa posición y se aplica la diferencia centrada, de error O(h²). Se trabaja sobre una copia en float para
    no tocar `x` ni truncar un array entero. Con h = 1e-5 el error ronda 1e-10: suficiente para comprobar un gradiente
    escrito a mano (gradient checking) pero demasiado caro para entrenar: cada paso costaría 2n evaluaciones de f.
    @alternativas Autodiff inverso (todas las parciales por el precio de ~2-3 evaluaciones de f, sin h); diferencias
    adelante (n + 1 evaluaciones, pero de orden 1); `scipy.optimize.approx_fprime`.
    """
    punto = np.array(x, dtype=float)
    g = np.zeros_like(punto)
    for i in range(punto.size):
        original = punto[i]
        punto[i] = original + h
        arriba = f(punto)
        punto[i] = original - h
        abajo = f(punto)
        punto[i] = original
        g[i] = (arriba - abajo) / (2 * h)
    return g


def descenso_gradiente(grad, x0, tasa: float, pasos: int, tol: float = 0.0):
    """
    Descenso de gradiente con trayectoria y criterio de parada.

    @complejidad Tiempo O(pasos · coste de grad); espacio O(pasos · n) por guardar la trayectoria.
    @explicacion Cada paso resta tasa·∇f al punto actual. La norma del gradiente se mira ANTES de moverse: si ya es
    menor que `tol` se está (casi) en un punto crítico y seguir solo gastaría pasos. Con tol = 0 la condición (estricta)
    nunca se cumple y se hacen todos los pasos. Convergerá si tasa < 2/L (L: curvatura máxima); con una tasa mayor la
    trayectoria diverge, que es justo lo que se quiere poder observar.
    @alternativas Descenso con momento o Adam (amortiguan el zigzag en problemas mal condicionados); búsqueda de línea
    (elige η en cada paso); método de Newton (usa el hessiano: converge en 1 paso en una cuadrática).
    """
    if pasos < 0:
        raise ValueError('pasos no puede ser negativo')
    punto = np.array(x0, dtype=float)
    camino = [punto]
    for _ in range(pasos):
        g = np.asarray(grad(punto), dtype=float)
        if np.linalg.norm(g) < tol:
            break
        punto = punto - tasa * g
        camino.append(punto)
    return np.array(camino)


def regresion_gd(x, y, tasa: float, pasos: int):
    """
    Regresión lineal por descenso de gradiente del ECM, con el gradiente escrito a mano.

    @complejidad Tiempo O(pasos · n); espacio O(n).
    @explicacion Con e = m·x + b - y y L = mean(e²), la regla de la cadena da ∂L/∂m = 2·mean(e·x) y ∂L/∂b = 2·mean(e).
    Se actualizan m y b a la vez con el gradiente del mismo punto. L es una cuadrática en (m, b): converge si
    tasa < 2/λmax(H) y su velocidad depende del número de condición de H (centrar o normalizar x lo reduce).
    @alternativas Forma cerrada con `np.linalg.lstsq` (lección 08): exacta y en un paso, pero O(n·d²) y inviable con
    muchísimos parámetros; descenso estocástico por mini-lotes (un gradiente barato por paso); normalizar x antes.
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if x.shape != y.shape:
        raise ValueError('x e y deben tener la misma longitud')
    m, b = 0.0, 0.0
    for _ in range(pasos):
        e = m * x + b - y
        m, b = m - tasa * 2 * float(np.mean(e * x)), b - tasa * 2 * float(np.mean(e))
    return float(m), float(b)


class Valor:
    """
    Nodo de un grafo de cómputo con autodiff inverso.

    @complejidad Cada operación O(1); backward() O(V + E) en tiempo y espacio (V nodos, E aristas).
    @explicacion Cada operación crea un nodo que guarda sus operandos y una función `_retro` con la regla de la cadena
    LOCAL (suma: 1 y 1; producto: el otro operando; tanh: 1 - tanh²). backward() ordena el grafo con un DFS en post-orden
    (cada nodo después de todo aquello de lo que depende), pone los grad a cero, siembra 1.0 en la raíz y recorre el orden
    al revés: así, cuando un nodo reparte su grad, ya ha recibido el de TODOS sus consumidores. Los repartos usan `+=`:
    un nodo usado dos veces (x * x) recibe dos contribuciones. El DFS es iterativo para soportar grafos muy profundos.
    @alternativas DFS recursivo (más corto, pero se rompe con ~1000 nodos en cadena); algoritmo de Kahn (orden
    topológico por grados de entrada); modo hacia delante con duales (lección 10, una pasada por variable); PyTorch/JAX.
    """

    def __init__(self, dato: float, hijos: tuple = ()) -> None:
        self.dato = float(dato)
        self.grad = 0.0
        self._hijos = tuple(hijos)
        self._retro = lambda: None

    @staticmethod
    def _valor(x) -> 'Valor':
        return x if isinstance(x, Valor) else Valor(x)

    def __repr__(self) -> str:
        return f'Valor(dato={self.dato}, grad={self.grad})'

    def __add__(self, otro):
        otro = Valor._valor(otro)
        salida = Valor(self.dato + otro.dato, (self, otro))

        def retro():
            self.grad += salida.grad
            otro.grad += salida.grad

        salida._retro = retro
        return salida

    __radd__ = __add__

    def __neg__(self):
        return self * -1.0

    def __sub__(self, otro):
        return self + (-Valor._valor(otro))

    def __rsub__(self, otro):
        return Valor._valor(otro) + (-self)

    def __mul__(self, otro):
        otro = Valor._valor(otro)
        salida = Valor(self.dato * otro.dato, (self, otro))

        def retro():
            self.grad += otro.dato * salida.grad
            otro.grad += self.dato * salida.grad

        salida._retro = retro
        return salida

    __rmul__ = __mul__

    def __truediv__(self, otro):
        return self * Valor._valor(otro) ** -1

    def __rtruediv__(self, otro):
        return Valor._valor(otro) * self ** -1

    def __pow__(self, n):
        if isinstance(n, Valor) or isinstance(n, bool) or not isinstance(n, (int, float)):
            raise TypeError('el exponente debe ser un número constante')
        if n == 0:
            return Valor(1.0, (self,))
        salida = Valor(self.dato ** n, (self,))

        def retro():
            self.grad += n * self.dato ** (n - 1) * salida.grad

        salida._retro = retro
        return salida

    def tanh(self):
        t = math.tanh(self.dato)
        salida = Valor(t, (self,))

        def retro():
            self.grad += (1 - t * t) * salida.grad

        salida._retro = retro
        return salida

    def backward(self) -> None:
        orden, visto = [], set()
        pila = [(self, False)]
        while pila:
            nodo, expandido = pila.pop()
            if expandido:
                orden.append(nodo)                   # todos sus hijos ya están en `orden`: post-orden
            elif id(nodo) not in visto:
                visto.add(id(nodo))
                pila.append((nodo, True))
                pila.extend((h, False) for h in nodo._hijos if id(h) not in visto)
        for nodo in orden:
            nodo.grad = 0.0
        self.grad = 1.0
        for nodo in reversed(orden):
            nodo._retro()


def entrenar_neurona(xs, ys, tasa: float, pasos: int):
    """
    Una neurona tanh entrenada con el autodiff propio.

    @complejidad Tiempo O(pasos · n · d); espacio O(n · d) por el grafo de cada paso.
    @explicacion Cada paso construye un grafo nuevo con w y b como hojas, calcula el ECM con operaciones de `Valor`,
    llama a backward() y descuenta tasa·grad: ninguna derivada escrita a mano. Los parámetros viven como floats entre
    pasos y se envuelven en Valor al empezar cada uno, de modo que cada backward parte de hojas limpias. Los parámetros
    iniciales son fijos (w = 0.5, b = 0) para que el resultado sea reproducible.
    @alternativas Vectorizar con numpy y el gradiente analítico dz = (2/n)(a - y)(1 - a²) (mucho más rápido, pero hecho
    a mano); PyTorch (`loss.backward()` + un optimizador); mini-lotes en vez de todo el conjunto en cada paso.
    """
    if not xs or len(xs) != len(ys):
        raise ValueError('xs no puede estar vacía y debe tener tantas muestras como ys')
    d = len(xs[0])

    def perdida(w, b):
        total = Valor(0.0)
        for xi, yi in zip(xs, ys):
            z = b
            for wj, xj in zip(w, xi):
                z = z + wj * xj
            error = z.tanh() - yi
            total = total + error * error
        return total * (1.0 / len(xs))

    w, b = [0.5] * d, 0.0
    for _ in range(pasos):
        pw, pb = [Valor(v) for v in w], Valor(b)
        perdida(pw, pb).backward()
        w = [v - tasa * p.grad for v, p in zip(w, pw)]
        b = b - tasa * pb.grad
    return [float(v) for v in w], float(b), float(perdida([Valor(v) for v in w], Valor(b)).dato)
