"""
SOLUCIONES · Tema 1 · Python esencial
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
"""


@dataclass(frozen=True)
class Dinero:
    """
    Objeto de valor inmutable para dinero.

    @complejidad Tiempo O(1) en todas las operaciones; espacio O(1).
    @explicacion Todo se valida en __post_init__, así que es IMPOSIBLE tener un Dinero inválido en el resto del
    programa. Se guardan céntimos enteros para no arrastrar los errores de la coma flotante (0.1 + 0.2 ≠ 0.3) y solo
    se usa float en el borde (`euros`, `multiplicar`). `frozen=True` impide modificarlo y genera __eq__ y __hash__.
    El `round()` de Python redondea al par (2998,5 → 2998), así que para «medios hacia arriba» se usa Decimal con
    ROUND_HALF_UP, construido desde str(factor) para no heredar el error binario del float.
    @alternativas Guardar un float de euros: más corto, pero acumula errores de redondeo y permite negativos.
    `int(x + 0.5)`: parece medios-hacia-arriba pero falla con los float que no son exactos.
    @bigo 1
    """
    centimos: int
    moneda: str = 'EUR'

    def __post_init__(self):
        if self.centimos < 0:
            raise ValueError(f'El dinero no puede ser negativo: {self.centimos}')
        if not re.fullmatch(r'[A-Z]{3}', self.moneda):
            raise ValueError(f"Moneda no válida: '{self.moneda}' (tres letras mayúsculas)")

    @staticmethod
    def euros(euros: float | int, moneda: str = 'EUR') -> 'Dinero':
        return Dinero(round(euros * 100), moneda)

    def sumar(self, otro: 'Dinero') -> 'Dinero':
        if self.moneda != otro.moneda:
            raise ValueError(f'No se pueden sumar {self.moneda} y {otro.moneda}')
        return Dinero(self.centimos + otro.centimos, self.moneda)

    def multiplicar(self, factor: float) -> 'Dinero':
        producto = Decimal(self.centimos) * Decimal(str(factor))
        return Dinero(int(producto.quantize(Decimal(1), rounding=ROUND_HALF_UP)), self.moneda)

    def igual(self, otro: 'Dinero') -> bool:
        return self == otro

    def __str__(self) -> str:
        return f'{self.centimos // 100},{self.centimos % 100:02d} {self.moneda}'


class DescuentoPorcentaje:
    """
    Descuento por porcentaje sobre el subtotal, redondeando hacia abajo.

    @complejidad Tiempo O(l) con l líneas; espacio O(1).
    @explicacion Se valida el porcentaje al construir. La división entera `//` redondea hacia abajo sin pasar
    por float: 1999 × 15 // 100 = 299.
    @alternativas `int(subtotal * porcentaje / 100)`: usa floats y puede fallar en el último céntimo.
    @bigo n
    """

    def __init__(self, porcentaje: int):
        if not 0 <= porcentaje <= 100:
            raise ValueError(f'Porcentaje fuera de 0..100: {porcentaje}')
        self._porcentaje = porcentaje

    def calcular(self, lineas: list[dict]) -> int:
        return sum(l['precio'] * l['cantidad'] for l in lineas) * self._porcentaje // 100


class DescuentoFijo:
    """
    Descuento de una cantidad fija, acotada por el subtotal.

    @complejidad Tiempo O(l); espacio O(1).
    @explicacion `min(fijo, subtotal)` garantiza que el descuento nunca deja el total en negativo.
    @alternativas Dejar que el Carrito lo recorte: funciona, pero cada estrategia debería ser correcta por sí sola.
    @bigo n
    """

    def __init__(self, centimos: int):
        if centimos < 0:
            raise ValueError(f'Descuento negativo: {centimos}')
        self._centimos = centimos

    def calcular(self, lineas: list[dict]) -> int:
        return min(self._centimos, sum(l['precio'] * l['cantidad'] for l in lineas))


class TresPorDos:
    """
    3x2 por línea: de cada 3 unidades, una gratis.

    @complejidad Tiempo O(l); espacio O(1).
    @explicacion `cantidad // 3` son los grupos completos de tres, y cada grupo regala una unidad al precio de
    la línea: 7 unidades = 2 grupos = 2 gratis.
    @alternativas Un bucle unidad a unidad: O(cantidad) para algo que se resuelve con una división.
    @bigo n
    """

    def calcular(self, lineas: list[dict]) -> int:
        return sum((l['cantidad'] // 3) * l['precio'] for l in lineas)


class Carrito:
    """
    Carrito con líneas y descuentos intercambiables (Strategy).

    @complejidad Tiempo O(l + d) para el total (l líneas, d descuentos); espacio O(l + d).
    @explicacion El carrito solo conoce el contrato `calcular(lineas)`: sirve cualquier objeto que lo tenga (duck
    typing), sea una clase o una función envuelta. `añadir` y `aplicar` devuelven self para encadenar.
    @alternativas Un `if/elif` por tipo de descuento: cada descuento nuevo obliga a tocar el carrito.
    @bigo n
    """

    def __init__(self):
        self._lineas: list[dict] = []
        self._descuentos = []

    def añadir(self, nombre: str, precio: int, cantidad: int = 1) -> 'Carrito':
        if cantidad < 1:
            raise ValueError(f'Cantidad no válida: {cantidad}')
        self._lineas.append({'nombre': nombre, 'precio': precio, 'cantidad': cantidad})
        return self

    def aplicar(self, descuento) -> 'Carrito':
        self._descuentos.append(descuento)
        return self

    def subtotal(self) -> int:
        return sum(l['precio'] * l['cantidad'] for l in self._lineas)

    def descuento(self) -> int:
        return min(sum(d.calcular(self._lineas) for d in self._descuentos), self.subtotal())

    def total(self) -> int:
        return self.subtotal() - self.descuento()


class RepositorioUsuariosEnMemoria:
    """
    Repositorio de usuarios en un dict indexado por id.

    @complejidad Tiempo O(1) en guardar, buscar y eliminar; todos() es O(n); espacio O(n).
    @explicacion El dict es una tabla hash: buscar por id no recorre nada. Reasignar una clave existente
    conserva su posición, así que reemplazar mantiene el orden de primera inserción; todos() devuelve una lista nueva
    para que quien la reciba no pueda alterar el almacén.
    @alternativas Una lista de usuarios: buscar y eliminar serían O(n).
    @bigo 1
    """

    def __init__(self):
        self._por_id: dict[int, object] = {}

    def guardar(self, usuario) -> None:
        self._por_id[usuario.id] = usuario

    def buscar(self, id: int):
        return self._por_id.get(id)

    def todos(self) -> list:
        return list(self._por_id.values())

    def eliminar(self, id: int) -> bool:
        return self._por_id.pop(id, None) is not None


class Despachador:
    """
    Despachador de eventos con prioridades (Observer).

    @complejidad Tiempo: escuchar O(o) por la reordenación y despachar O(o) llamadas (o oyentes del evento); espacio O(o).
    @explicacion Los oyentes de cada evento viven en una lista que se mantiene ordenada con `sorted(key=-prioridad)`;
    el orden de Python es ESTABLE, así que a igual prioridad queda el orden de registro. Se corta con `is False` (no
    con `not resultado`, porque None también es falso y es lo que devuelve una función normal).
    @alternativas Ordenar al despachar: repite el trabajo en cada evento.
    @bigo n
    """

    def __init__(self):
        self._oyentes: dict[str, list[tuple[int, object]]] = {}

    def escuchar(self, evento: str, oyente, prioridad: int = 0) -> None:
        lista = self._oyentes.setdefault(evento, [])
        lista.append((prioridad, oyente))
        lista.sort(key=lambda par: -par[0])

    def despachar(self, evento: str, datos=None) -> int:
        ejecutados = 0
        for _, oyente in list(self._oyentes.get(evento, [])):
            ejecutados += 1
            if oyente(datos) is False:
                break
        return ejecutados
