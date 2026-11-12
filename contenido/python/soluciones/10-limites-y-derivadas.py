"""
SOLUCIONES · Tema 10 · Límites y derivadas numéricas
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (`math` ya está importado en el ejemplo.)
"""


def limite_numerico(f, a: float, pasos: int = 6):
    """
    Límite por muestreo bilateral con h decreciente.

    @complejidad Tiempo O(pasos) evaluaciones de f; espacio O(pasos).
    @explicacion Se evalúa f en a ± 10^-k (nunca en a, que puede ser 0/0). Con los valores de los dos últimos h por cada
    lado se comprueba que no se mueven (max - min dentro de una tolerancia relativa): eso detecta a la vez laterales
    distintos (|x|/x), divergencia (1/x²) y oscilación (sin(1/x)). Si convergen, el límite es la media de los dos
    lados con el h más pequeño. El paso es 10^-pasos y no más pequeño a propósito: más allá de ~1e-8 empieza la
    cancelación y los límites tipo (1 - cos x)/x² se rompen.
    @alternativas Extrapolación de Richardson (combina varios h para cancelar el término de error y converger más rápido);
    cálculo simbólico con sympy (límite exacto, no numérico); aritmética de intervalos para acotar el error.
    """
    if pasos < 2:
        raise ValueError('pasos debe ser al menos 2')
    ultimo, anterior = 10.0 ** -pasos, 10.0 ** -(pasos - 1)
    valores = [f(a - anterior), f(a + anterior), f(a - ultimo), f(a + ultimo)]
    limite = (valores[2] + valores[3]) / 2
    if max(valores) - min(valores) <= 1e-3 * max(1.0, abs(limite)):
        return float(limite)
    return None


def derivada_adelante(f, x: float, h: float = 1e-6) -> float:
    """
    Diferencia hacia delante.

    @complejidad Tiempo O(1): dos evaluaciones de f (una si ya se tiene f(x)); espacio O(1).
    @explicacion (f(x+h) - f(x)) / h. Por Taylor el error de truncamiento es (h/2)·f''(x) + O(h²): de orden 1. Achicar h
    reduce ese error pero aumenta el de redondeo (eps·|f|/h): el óptimo ronda sqrt(eps) ≈ 1.5e-8.
    @alternativas Diferencia centrada (orden 2, mejor precisión con el mismo número de evaluaciones nuevas); autodiff
    con números duales (exacta, sin h).
    """
    return (f(x + h) - f(x)) / h


def derivada_centrada(f, x: float, h: float = 1e-5) -> float:
    """
    Diferencia centrada.

    @complejidad Tiempo O(1): dos evaluaciones de f; espacio O(1).
    @explicacion (f(x+h) - f(x-h)) / 2h. Al restar los desarrollos de Taylor en x+h y x-h desaparecen los términos de
    orden par y queda (h²/6)·f'''(x) + O(h⁴): error de orden 2. Su h óptimo es eps^(1/3) ≈ 6e-6, con un error mínimo
    de ~1e-11, mucho mejor que el de adelante.
    @alternativas Fórmulas de más puntos (orden 4: [f(x-2h) - 8f(x-h) + 8f(x+h) - f(x+2h)]/12h); autodiff exacto.
    """
    return (f(x + h) - f(x - h)) / (2 * h)


def orden_del_error(aprox, f, df, x: float) -> float:
    """
    Orden de convergencia estimado con h y h/2.

    @complejidad Tiempo O(1): cuatro evaluaciones del método; espacio O(1).
    @explicacion Si error ≈ C·h^p, entonces e(h)/e(h/2) ≈ 2^p, luego p = log2(e(h)/e(h/2)). h = 1e-2 es grande a
    propósito: ahí manda el truncamiento y el redondeo no contamina la medida (con h diminuto saldría un orden absurdo).
    Si algún error es 0 el método es exacto en ese punto y se devuelve infinito en vez de dividir entre 0.
    @alternativas Ajustar una recta a varios h en escala log-log (la pendiente es p; más robusto frente a un solo
    punto con ruido); comparar contra tres niveles h, h/2, h/4 para comprobar que p es estable.
    """
    h = 1e-2
    exacta = df(x)
    e1 = abs(aprox(f, x, h) - exacta)
    e2 = abs(aprox(f, x, h / 2) - exacta)
    if e1 == 0 or e2 == 0:
        return float('inf')
    return math.log2(e1 / e2)


class Dual:
    """
    Número dual a + b·ε con ε² = 0.

    @complejidad Cada operación es O(1) en tiempo y espacio; evaluar f con duales cuesta una constante por el coste de f.
    @explicacion `a` es el valor y `b` la derivada. Las operaciones aplican el álgebra con ε² = 0: la suma suma ambas
    partes, el producto da (ad + bc) (regla del producto), el cociente (bc - ad)/c² (regla del cociente) y la potencia
    entera n·a^(n-1)·b. Un número suelto se promueve a Dual(x, 0): una constante tiene derivada 0. d ** 0 se trata
    aparte para que no falle con a = 0 (0·0^-1).
    @alternativas Autodiff en modo inverso (backprop): una pasada para todas las derivadas de una salida escalar, la
    opción de PyTorch/JAX con muchos parámetros; sympy para derivar simbólicamente.
    """

    def __init__(self, a: float, b: float = 0.0) -> None:
        self.a = float(a)
        self.b = float(b)

    @staticmethod
    def _dual(x) -> 'Dual':
        return x if isinstance(x, Dual) else Dual(x)

    def __repr__(self) -> str:
        return f'Dual({self.a}, {self.b})'

    def __add__(self, otro):
        otro = Dual._dual(otro)
        return Dual(self.a + otro.a, self.b + otro.b)

    __radd__ = __add__

    def __neg__(self):
        return Dual(-self.a, -self.b)

    def __sub__(self, otro):
        otro = Dual._dual(otro)
        return Dual(self.a - otro.a, self.b - otro.b)

    def __rsub__(self, otro):
        return Dual._dual(otro) - self

    def __mul__(self, otro):
        otro = Dual._dual(otro)
        return Dual(self.a * otro.a, self.a * otro.b + self.b * otro.a)

    __rmul__ = __mul__

    def __truediv__(self, otro):
        otro = Dual._dual(otro)
        return Dual(self.a / otro.a, (self.b * otro.a - self.a * otro.b) / (otro.a * otro.a))

    def __rtruediv__(self, otro):
        return Dual._dual(otro) / self

    def __pow__(self, n: int):
        if not isinstance(n, int) or isinstance(n, bool):
            raise TypeError('el exponente debe ser un entero')
        if n == 0:
            return Dual(1.0, 0.0)
        return Dual(self.a ** n, n * self.a ** (n - 1) * self.b)


def seno(x):
    """
    Seno con soporte de duales.

    @complejidad Tiempo O(1); espacio O(1).
    @explicacion Regla de la cadena: sin(a + bε) = sin(a) + cos(a)·b·ε. La derivada de la función externa (cos) se evalúa
    en a y se multiplica por la derivada interna b. Con un número normal se comporta como math.sin.
    @alternativas Una librería de autodiff (JAX, PyTorch) define así cada función primitiva; diferencias finitas
    sobre math.sin (aproximada).
    """
    if isinstance(x, Dual):
        return Dual(math.sin(x.a), math.cos(x.a) * x.b)
    return math.sin(x)


def exponencial(x):
    """
    Exponencial con soporte de duales.

    @complejidad Tiempo O(1); espacio O(1).
    @explicacion exp(a + bε) = exp(a) + exp(a)·b·ε: la exponencial es su propia derivada, así que se calcula una sola vez
    y se reutiliza para el valor y para la derivada.
    @alternativas Diferencias finitas sobre math.exp (aproximada); autodiff inverso, que guarda exp(a) del paso hacia
    delante para usarlo al retroceder.
    """
    if isinstance(x, Dual):
        e = math.exp(x.a)
        return Dual(e, e * x.b)
    return math.exp(x)


def derivar(f, x: float) -> float:
    """
    Derivada exacta por autodiff hacia delante.

    @complejidad Tiempo O(coste de f) con un factor constante pequeño; espacio O(1) extra por valor intermedio.
    @explicacion f(x + 1·ε) = f(x) + f'(x)·ε: se evalúa f con un Dual cuya parte dual vale 1 y se devuelve esa parte.
    No hay h, ni truncamiento ni cancelación: solo el redondeo normal de cada operación. Si f devuelve un número suelto
    (constante), su derivada es 0.
    @alternativas Diferencia centrada (aproximada, error ~1e-11 en el mejor caso); modo inverso (backprop) cuando hay
    muchas variables de entrada y una sola salida.
    """
    resultado = f(Dual(x, 1.0))
    return float(resultado.b) if isinstance(resultado, Dual) else 0.0
