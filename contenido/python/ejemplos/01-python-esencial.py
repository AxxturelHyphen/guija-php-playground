"""
TEMA 1 · PYTHON ESENCIAL
─────────────────────────────────────────────────
Lo que hace distinto a Python y lo que usarás cada día: tipado dinámico, truthiness,
cadenas inmutables, listas/tuplas/dicts/sets, referencias frente a copias, argumentos,
comprensiones, generadores, closures, dataclasses y excepciones. Después, la POO que
sostiene el código profesional: contratos (Protocol), composición, inyección de
dependencias, Strategy con funciones, objetos de valor y Repository. Al final hay
6 ejercicios con pruebas.

Cómo se trabaja:
  1. Ctrl+Enter ejecuta el archivo: verás la teoría y las pruebas en «Pendiente».
  2. Sustituye los `pendiente()` por tu código y vuelve a ejecutar.
  3. Ctrl+S guarda tu copia en practicas/ (este ejemplo no se modifica).
  4. Cuando acabes (o te atasques) abre la pestaña «Solución».
"""
import copy
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from typing import Protocol


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════
# 1. TIPADO DINÁMICO Y TYPE HINTS
# ═════════════════════════════════════════════════
# Una variable es solo una ETIQUETA pegada a un objeto; el tipo vive en el objeto, no en la variable.
# Los type hints (`x: int`) documentan y los lee el editor, pero Python NO los comprueba al ejecutar.
titulo('1. Tipado dinámico y type hints')
x = 5                      # x apunta a un int
x = 'ahora soy texto'      # legal: la etiqueta se mueve a otro objeto
print(type(x).__name__)


def doble(n: int) -> int:
    return n * 2


print(doble(4), doble('ja'))   # 'jajá'... sin error: el hint no se impone (por eso existen herramientas como mypy)

# ═════════════════════════════════════════════════
# 2. TRUTHINESS Y None
# ═════════════════════════════════════════════════
# Son "falsos": None, False, 0, 0.0, '', [], (), {}, set(). Todo lo demás es verdadero.
# `if lista:` es la forma pitónica de preguntar "¿hay algo?". Pero ojo: 0 y '' también son falsos.
titulo('2. Truthiness y None')
for valor in [0, '', [], None, 'a', [0]]:
    print(f'{valor!r:>6} -> {bool(valor)}')
# None es un objeto único: se compara con `is`, no con ==  (`x is None`).
def primero_o_defecto(xs, defecto=None):
    return xs[0] if xs else defecto      # `if xs` cubre lista vacía Y None


print(primero_o_defecto([]), primero_o_defecto([7]), primero_o_defecto([], 'nada'))
# `or` y `and` devuelven uno de sus operandos (no un bool): `nombre or 'anónimo'`.
print('' or 'anónimo', 0 or 5, None and 3)

# ═════════════════════════════════════════════════
# 3. CADENAS: INMUTABLES, SLICING Y f-STRINGS
# ═════════════════════════════════════════════════
# Un str no se modifica: cada operación crea uno nuevo. s[i] = 'x' es TypeError.
# Slicing s[inicio:fin:paso] (fin excluido) copia el trozo: O(k). Los índices negativos cuentan desde el final.
titulo('3. Cadenas')
s = 'programación'
print(s[0], s[-1], s[:4], s[4:], s[::-1], s[::2])
nombre, edad = 'Ana', 30.5
print(f'{nombre} tiene {edad:.1f} años · {edad = } · {1234567:,} · {0.256:.1%} · {nombre:>6}|')
# Unir con ''.join(lista) es O(n); concatenar con += dentro de un bucle puede ser O(n²).
print('-'.join(['a', 'b', 'c']), 'a,b,c'.split(','), '  hola  '.strip().upper())

# ═════════════════════════════════════════════════
# 4. LIST, TUPLE, DICT Y SET
# ═════════════════════════════════════════════════
# list  [1, 2]      mutable, ordenada. append O(1), insert(0, x) O(n), x in lista O(n)
# tuple (1, 2)      inmutable (y hashable si lo que contiene lo es): sirve de clave de dict
# dict  {'a': 1}    clave -> valor, conserva el orden de inserción. d[k], k in d: O(1)
# set   {1, 2}      sin repetidos ni orden. x in conjunto: O(1)
titulo('4. Colecciones')
lista = [10, 20, 30]
lista.append(40)
punto = (3, 4)
x_, y_ = punto                                  # desempaquetado
primero, *resto = lista                         # *resto recoge el sobrante
edades = {'ana': 30, 'luis': 25}
edades['eva'] = 41
colores = {'rojo', 'verde', 'rojo'}
print(lista, x_, y_, primero, resto, edades, sorted(colores))
print(edades.get('nadie'), edades.get('nadie', 0), 'ana' in edades, {punto: 'clave tupla'})
# [], {} y set() vacíos: ojo, `{}` es un dict vacío; el conjunto vacío es set().

# ═════════════════════════════════════════════════
# 5. REFERENCIAS FRENTE A COPIAS
# ═════════════════════════════════════════════════
# Asignar NO copia: `b = a` pega otra etiqueta al MISMO objeto. Los mutables se comparten.
# copy.copy (o a[:], list(a)) copia solo el nivel de arriba; copy.deepcopy copia todo el árbol.
titulo('5. Referencias y copias')
a = [[1, 2], [3]]
alias = a
superficial = copy.copy(a)
profunda = copy.deepcopy(a)
a[0].append(99)
print('alias:', alias, '· superficial (comparte las listas internas):', superficial, '· profunda:', profunda)
print(alias is a, superficial is a, superficial[0] is a[0], profunda[0] is a[0])

# ═════════════════════════════════════════════════
# 6. LA TRAMPA DEL ARGUMENTO POR DEFECTO MUTABLE
# ═════════════════════════════════════════════════
# El valor por defecto se crea UNA sola vez, al definir la función, y se reutiliza en cada llamada.
titulo('6. Argumento por defecto mutable')


def anadir_mal(x, destino=[]):
    destino.append(x)
    return destino


def anadir_bien(x, destino=None):
    if destino is None:          # se crea una lista nueva en CADA llamada
        destino = []
    destino.append(x)
    return destino


print(anadir_mal(1), anadir_mal(2), '← la misma lista acumulada')
print(anadir_bien(1), anadir_bien(2))

# ═════════════════════════════════════════════════
# 7. *args, **kwargs Y ARGUMENTOS SOLO POR NOMBRE
# ═════════════════════════════════════════════════
titulo('7. Argumentos')


def describir(titulo_, *args, sep=', ', **kwargs):
    # *args llega como tupla, **kwargs como dict; lo que va tras *args solo se pasa POR NOMBRE (keyword-only).
    return f'{titulo_}: ' + sep.join(map(str, args)) + f' {kwargs}'


print(describir('nums', 1, 2, 3, sep='|', color='rojo'))
datos = [4, 5]
opciones = {'sep': ' y '}
print(describir('desde colecciones', *datos, **opciones))     # * y ** al LLAMAR desempaquetan

# ═════════════════════════════════════════════════
# 8. COMPRENSIONES Y GENERADORES
# ═════════════════════════════════════════════════
# [expr for x in it if cond]: más legible y rápido que un bucle con append. También de dict {k: v ...} y set {x ...}.
# Entre paréntesis (expr for ...) es un GENERADOR: produce los valores bajo demanda, con memoria constante.
titulo('8. Comprensiones y generadores')
cuadrados = [n * n for n in range(1, 6) if n % 2 == 1]
longitudes = {p: len(p) for p in ['kiwi', 'fresa']}
print(cuadrados, longitudes, {n % 3 for n in range(10)})
suma = sum(n * n for n in range(1_000_000))     # sin crear la lista de un millón


def contar_hasta(n):
    for i in range(1, n + 1):
        yield i                # devuelve un valor y se "pausa" hasta el siguiente next()


gen = contar_hasta(3)
print(next(gen), list(gen), 'suma sin lista:', suma)     # un generador se consume UNA sola vez

# ═════════════════════════════════════════════════
# 9. CLOSURES Y nonlocal
# ═════════════════════════════════════════════════
# Una función interna "recuerda" las variables de la externa. Para REASIGNARLAS hace falta nonlocal
# (sin él, Python crea una variable local nueva y falla con UnboundLocalError).
titulo('9. Closures')


def contador():
    cuenta = 0

    def siguiente():
        nonlocal cuenta
        cuenta += 1
        return cuenta
    return siguiente


c = contador()
print(c(), c(), c())
# Trampa clásica: las lambdas capturan la VARIABLE, no su valor en ese momento.
trampa = [lambda: i for i in range(3)]
bien = [lambda i=i: i for i in range(3)]
print([f() for f in trampa], [f() for f in bien])

# ═════════════════════════════════════════════════
# 10. CLASES: dataclass, property Y MÉTODOS ESPECIALES
# ═════════════════════════════════════════════════
# @dataclass genera __init__, __repr__ y __eq__ a partir de los campos. frozen=True los hace inmutables
# (y hashables). Los "dunders" (__eq__, __hash__, __lt__, __repr__, __str__) personalizan cómo se comporta el objeto.
titulo('10. dataclass, property y dunders')


@dataclass(frozen=True)
class Punto:
    x: int
    y: int

    def mover(self, dx: int, dy: int) -> 'Punto':
        return Punto(self.x + dx, self.y + dy)       # no modifica: devuelve otro

    @property
    def norma2(self) -> int:                         # se usa sin paréntesis: p.norma2
        return self.x ** 2 + self.y ** 2


p = Punto(1, 2)
print(p, p == Punto(1, 2), p.mover(3, 4), p.norma2, len({p, Punto(1, 2)}))
try:
    p.x = 99                       # frozen: se prohíbe
except AttributeError as e:
    print('Error esperado:', type(e).__name__)


class Version:
    """__eq__ y __hash__ deben ir juntos; con __lt__ (+ functools.total_ordering) el objeto se puede ordenar."""

    def __init__(self, mayor: int, menor: int):
        self.mayor, self.menor = mayor, menor

    def __eq__(self, otro):
        return isinstance(otro, Version) and (self.mayor, self.menor) == (otro.mayor, otro.menor)

    def __hash__(self):
        return hash((self.mayor, self.menor))

    def __lt__(self, otro):
        return (self.mayor, self.menor) < (otro.mayor, otro.menor)

    def __repr__(self):
        return f'Version({self.mayor}, {self.menor})'


print(sorted([Version(2, 0), Version(1, 5), Version(1, 2)]), Version(1, 2) == Version(1, 2))

# ═════════════════════════════════════════════════
# 11. PROTOCOL, ABC Y DUCK TYPING: CONTRATOS
# ═════════════════════════════════════════════════
# "Si camina como un pato y hace cuac, es un pato": a Python le basta con que el objeto tenga el método.
# Un Protocol describe ese contrato para los type hints SIN obligar a heredar. Un ABC sí obliga a heredar
# y no deja instanciar la clase si falta un método abstracto.
titulo('11. Protocol, ABC y duck typing')


class Notificador(Protocol):
    def enviar(self, destino: str, mensaje: str) -> str: ...


class NotificadorEmail:                      # no hereda de nada: cumple el contrato por tener enviar()
    def enviar(self, destino: str, mensaje: str) -> str:
        return f'[email a {destino}] {mensaje}'


class NotificadorSms:
    def enviar(self, destino: str, mensaje: str) -> str:
        return f'[sms a {destino}] {mensaje[:20]}'


def avisar_a_todos(canales: list[Notificador], destino: str, mensaje: str) -> None:
    for canal in canales:
        print(canal.enviar(destino, mensaje))      # no sabe (ni le importa) qué canal es


avisar_a_todos([NotificadorEmail(), NotificadorSms()], 'ana', 'Tu pedido ya está en camino')


class Figura(ABC):
    @abstractmethod
    def area(self) -> float: ...


try:
    Figura()
except TypeError as e:
    print('Error esperado:', e)

# ═════════════════════════════════════════════════
# 12. COMPOSICIÓN E INYECCIÓN DE DEPENDENCIAS
# ═════════════════════════════════════════════════
# "Un Pedido NO ES un Notificador, un Pedido USA un Notificador." La herencia ata; la composición compone
# piezas pequeñas. Y la pieza se INYECTA (se recibe en el constructor) en vez de crearla dentro: así se cambia
# sin tocar la clase y se prueba con un doble falso.
titulo('12. Composición e inyección de dependencias')


class Pedido:
    def __init__(self, cliente: str, notificador: Notificador):
        self._cliente = cliente
        self._notificador = notificador          # inyectado desde fuera
        self._lineas: list[str] = []

    def añadir(self, producto: str) -> 'Pedido':
        self._lineas.append(producto)
        return self                              # interfaz fluida

    def confirmar(self) -> str:
        return self._notificador.enviar(self._cliente, 'Pedido confirmado: ' + ', '.join(self._lineas))


print(Pedido('ana', NotificadorEmail()).añadir('teclado').añadir('ratón').confirmar())


class NotificadorFalso:
    def __init__(self):
        self.enviados: list[str] = []

    def enviar(self, destino: str, mensaje: str) -> str:
        self.enviados.append(f'{destino}: {mensaje}')
        return self.enviados[-1]


falso = NotificadorFalso()
Pedido('test', falso).añadir('x').confirmar()
print('El doble de pruebas guardó', len(falso.enviados), 'mensaje(s) sin enviar nada de verdad')

# ═════════════════════════════════════════════════
# 13. STRATEGY CON FUNCIONES
# ═════════════════════════════════════════════════
# La parte que varía se inyecta. En Python las funciones son objetos: casi siempre basta un callable
# (no hace falta una clase por estrategia).
titulo('13. Strategy')
palabras = ['kiwi', 'fresa', 'pera']
print(sorted(palabras, key=len), sorted(palabras, key=len, reverse=True), sorted(palabras, key=lambda p: p[-1]))


def mostrar_ordenado(xs, criterio=sorted):
    print(criterio(xs))


mostrar_ordenado([3, 1, 2])
mostrar_ordenado([3, 1, 2], lambda xs: sorted(xs, reverse=True))

# ═════════════════════════════════════════════════
# 14. OBJETOS DE VALOR Y Enum
# ═════════════════════════════════════════════════
# Un objeto de valor se define por sus datos, no por su identidad, y es INMUTABLE: cualquier "cambio" devuelve
# otro. Sustituye a los `int euros` sueltos que no se validan ni tienen comportamiento (el Punto de arriba lo es).
# Un Enum son valores con nombre: el sustituto de las constantes mágicas y los strings sueltos.
titulo('14. Objetos de valor y Enum')


class Estado(Enum):
    PENDIENTE = 'pendiente'
    ENVIADO = 'enviado'

    def etiqueta(self) -> str:
        return {Estado.PENDIENTE: 'Esperando', Estado.ENVIADO: 'En camino'}[self]


print(Estado('enviado').etiqueta(), Estado.PENDIENTE.name, [e.value for e in Estado])
try:
    Estado('roto')
except ValueError as e:
    print('Error esperado:', e)

# ═════════════════════════════════════════════════
# 15. REPOSITORY: ESCONDER DÓNDE SE GUARDAN LOS DATOS
# ═════════════════════════════════════════════════
# El resto de la aplicación habla con un contrato ("dame el usuario 7") y no sabe si los datos están en una base
# de datos, en un archivo o en memoria. En las pruebas se usa la versión en memoria.
titulo('15. Repository (ejemplo resuelto con otra entidad)')


class RepositorioLibrosEnMemoria:
    def __init__(self):
        self._libros: dict[str, str] = {}      # isbn -> título

    def guardar(self, isbn: str, titulo_: str) -> None:
        self._libros[isbn] = titulo_            # guardar dos veces el mismo isbn ACTUALIZA

    def buscar(self, isbn: str) -> str | None:
        return self._libros.get(isbn)           # .get no lanza KeyError: devuelve None


repo = RepositorioLibrosEnMemoria()
repo.guardar('111', 'Clean Code')
repo.guardar('111', 'Clean Code (2.ª ed.)')
print(repo.buscar('111'), '|', repo.buscar('999'))

# ═════════════════════════════════════════════════
# 16. EXCEPCIONES: EAFP
# ═════════════════════════════════════════════════
# Python prefiere EAFP ("más fácil pedir perdón que permiso"): intenta y captura, en vez de comprobar antes (LBYL).
# Se capturan clases concretas (nunca `except:` a secas) y se crean excepciones propias heredando de Exception.
titulo('16. Excepciones')


class StockInsuficiente(Exception):
    def __init__(self, producto: str, pedido: int, hay: int):
        super().__init__(f'No hay stock de {producto}: pides {pedido} y quedan {hay}')


def a_entero(texto: str) -> int | None:
    try:
        return int(texto)                  # EAFP: lo intentamos directamente
    except ValueError:
        return None
    finally:
        pass                               # finally se ejecuta SIEMPRE (cerrar recursos)


print(a_entero('42'), a_entero('4x2'))
try:
    raise StockInsuficiente('teclado', 5, 2)
except (KeyError, StockInsuficiente) as e:       # varios tipos en una tupla
    print(type(e).__name__ + ':', e)

# ═════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════
# Sustituye cada `pendiente()` por tu código. Mantén los nombres: las pruebas los usan.

# ── Ejercicio 1 · Dinero (objeto de valor) ─────────────────────────────────


@dataclass(frozen=True)
class Dinero:
    """
    Dinero en céntimos para no arrastrar errores de coma flotante (0.1 + 0.2 != 0.3).
     - Es INMUTABLE (frozen): sumar, multiplicar... devuelven un Dinero nuevo.
     - `Dinero(-1)` lanza ValueError (no hay dinero negativo), validado en __post_init__.
     - La moneda son tres letras mayúsculas ('EUR', 'USD'); si no, ValueError.
     - `Dinero.euros(12.5)` crea 1250 céntimos (redondea: euros(0.1 + 0.2) son 30 céntimos).
     - `sumar` con monedas distintas lanza ValueError.
     - `multiplicar(1.5)` redondea al céntimo más cercano, MEDIOS HACIA ARRIBA: 1999 × 1.5 = 2998,5 → 2999.
       Ojo: el `round()` de Python redondea al par (2998), el «redondeo bancario»; para el redondeo de
       toda la vida usa Decimal con ROUND_HALF_UP (y Decimal(str(factor)) para no heredar el error del float).
     - `__str__`: "12,50 EUR" (coma decimal, siempre dos decimales).
    """
    centimos: int
    moneda: str = 'EUR'

    def __post_init__(self):
        pendiente()

    @staticmethod
    def euros(euros: float | int, moneda: str = 'EUR') -> 'Dinero':
        pendiente()

    def sumar(self, otro: 'Dinero') -> 'Dinero':
        pendiente()

    def multiplicar(self, factor: float) -> 'Dinero':
        pendiente()

    def igual(self, otro: 'Dinero') -> bool:
        pendiente()

    def __str__(self) -> str:
        pendiente()


# ── Ejercicio 2 · Carrito con descuentos (Strategy) ─────────────────────────
# Una "línea" del carrito es un dict {'nombre': str, 'precio': int (céntimos), 'cantidad': int}.
class Descuento(Protocol):
    def calcular(self, lineas: list[dict]) -> int:
        """Céntimos que se descuentan de un carrito."""
        ...


class DescuentoPorcentaje:
    """
    Descuento por porcentaje sobre el subtotal (entero, redondeando hacia abajo):
    15 % de 1999 céntimos = 299. Un porcentaje fuera de 0..100 lanza ValueError.
    """

    def __init__(self, porcentaje: int):
        pendiente()

    def calcular(self, lineas: list[dict]) -> int:
        pendiente()


class DescuentoFijo:
    """Descuento de una cantidad fija, que nunca puede superar el subtotal."""

    def __init__(self, centimos: int):
        pendiente()

    def calcular(self, lineas: list[dict]) -> int:
        pendiente()


class TresPorDos:
    """3x2 en cada línea: de cada 3 unidades, una es gratis (6 unidades → 2 gratis)."""

    def calcular(self, lineas: list[dict]) -> int:
        pendiente()


class Carrito:
    """
    Guarda líneas y descuentos (Strategy: cualquier objeto con `calcular(lineas)`).
     - añadir(nombre, precio, cantidad=1) devuelve self (encadenable); cantidad < 1 → ValueError.
     - aplicar(descuento) devuelve self.
     - subtotal(): suma de precio × cantidad.
     - descuento(): suma de todos los descuentos, sin superar nunca el subtotal.
     - total(): subtotal − descuento.
    """

    def __init__(self):
        pendiente()

    def añadir(self, nombre: str, precio: int, cantidad: int = 1) -> 'Carrito':
        pendiente()

    def aplicar(self, descuento: Descuento) -> 'Carrito':
        pendiente()

    def subtotal(self) -> int:
        pendiente()

    def descuento(self) -> int:
        pendiente()

    def total(self) -> int:
        pendiente()


# ── Ejercicio 3 · Repositorio en memoria ────────────────────────────────────
@dataclass(frozen=True)
class Usuario:
    id: int
    nombre: str


class RepositorioUsuarios(Protocol):
    def guardar(self, usuario: Usuario) -> None: ...
    def buscar(self, id: int) -> Usuario | None: ...
    def todos(self) -> list[Usuario]: ...
    def eliminar(self, id: int) -> bool: ...


class RepositorioUsuariosEnMemoria:
    """
    Implementa RepositorioUsuarios guardando los usuarios en un dict indexado por id:
     - guardar() inserta o REEMPLAZA (mismo id) sin cambiar su posición.
     - buscar() es O(1) (nada de recorrer una lista) y devuelve None si no existe.
     - todos() devuelve una lista nueva en orden de primera inserción.
     - eliminar() devuelve True si existía.
    """

    def __init__(self):
        pendiente()

    def guardar(self, usuario: Usuario) -> None:
        pendiente()

    def buscar(self, id: int) -> Usuario | None:
        pendiente()

    def todos(self) -> list[Usuario]:
        pendiente()

    def eliminar(self, id: int) -> bool:
        pendiente()


# ── Ejercicio 4 · Despachador de eventos (patrón Observer) ──────────────────
class Despachador:
    """
    Los "oyentes" (cualquier callable) se registran para un evento y se llaman cuando alguien lo despacha.
     - escuchar(evento, oyente, prioridad=0): mayor prioridad se ejecuta antes;
       con igual prioridad, por orden de registro.
     - despachar(evento, datos=None): llama a cada oyente con `datos` y devuelve cuántos se ejecutaron.
       Un evento sin oyentes devuelve 0. Si un oyente devuelve EXACTAMENTE False, se corta la cadena
       (cuenta ese oyente pero no los siguientes).
    """

    def __init__(self):
        pendiente()

    def escuchar(self, evento: str, oyente, prioridad: int = 0) -> None:
        pendiente()

    def despachar(self, evento: str, datos=None) -> int:
        pendiente()


# ════════════════════════════════════════════════════════════════════════════
# PRUEBAS (no hace falta tocarlas)
# ════════════════════════════════════════════════════════════════════════════

grupo('Dinero')
comprueba('euros(12.5) son 1250 céntimos', lambda: Dinero.euros(12.5).centimos, 1250)
comprueba('euros(0.1 + 0.2) redondea a 30 céntimos', lambda: Dinero.euros(0.1 + 0.2).centimos, 30)
comprueba('sumar da un Dinero nuevo', lambda: Dinero.euros(1).sumar(Dinero.euros(2.5)).centimos, 350)


def _suma_no_modifica():
    a = Dinero.euros(1)
    a.sumar(Dinero.euros(1))
    return a.centimos


comprueba('sumar no modifica el original', _suma_no_modifica, 100)
comprueba('multiplicar redondea (medios hacia arriba)', lambda: Dinero(1999).multiplicar(1.5).centimos, 2999)
comprueba('igual compara importe y moneda',
          lambda: Dinero.euros(3).igual(Dinero(300)) and not Dinero.euros(3).igual(Dinero(300, 'USD')), True)
comprueba('se imprime con coma decimal', lambda: str(Dinero.euros(12.5)), '12,50 EUR')
comprueba('se imprime con dos decimales', lambda: str(Dinero(5, 'USD')), '0,05 USD')
lanza('importe negativo', lambda: Dinero(-1), ValueError)
lanza('moneda inválida', lambda: Dinero(1, 'euro'), ValueError)
lanza('sumar monedas distintas', lambda: Dinero.euros(1).sumar(Dinero(100, 'USD')), ValueError)

lineas = [
    {'nombre': 'camiseta', 'precio': 1000, 'cantidad': 3},
    {'nombre': 'gorra', 'precio': 500, 'cantidad': 2},
]   # subtotal 4000

grupo('DescuentoPorcentaje')
comprueba('15 % de 1999', lambda: DescuentoPorcentaje(15).calcular([{'nombre': 'x', 'precio': 1999, 'cantidad': 1}]), 299)
comprueba('20 % de 4000', lambda: DescuentoPorcentaje(20).calcular(lineas), 800)
lanza('porcentaje mayor que 100', lambda: DescuentoPorcentaje(101), ValueError)

grupo('DescuentoFijo')
comprueba('resta la cantidad fija', lambda: DescuentoFijo(300).calcular(lineas), 300)
comprueba('nunca pasa del subtotal', lambda: DescuentoFijo(9999).calcular(lineas), 4000)

grupo('TresPorDos')
comprueba('3 camisetas: una gratis', lambda: TresPorDos().calcular([{'nombre': 'c', 'precio': 1000, 'cantidad': 3}]), 1000)
comprueba('7 unidades: dos gratis', lambda: TresPorDos().calcular([{'nombre': 'c', 'precio': 100, 'cantidad': 7}]), 200)
comprueba('menos de 3 unidades: nada', lambda: TresPorDos().calcular([{'nombre': 'c', 'precio': 100, 'cantidad': 2}]), 0)

grupo('Carrito')
comprueba('subtotal', lambda: Carrito().añadir('camiseta', 1000, 3).añadir('gorra', 500, 2).subtotal(), 4000)
comprueba('sin descuentos el total es el subtotal', lambda: Carrito().añadir('gorra', 500).total(), 500)
comprueba('acumula descuentos',
          lambda: Carrito().añadir('camiseta', 1000, 3).aplicar(TresPorDos()).aplicar(DescuentoFijo(500)).total(), 1500)
comprueba('el descuento nunca supera el subtotal',
          lambda: Carrito().añadir('gorra', 500).aplicar(DescuentoFijo(400)).aplicar(DescuentoFijo(400)).total(), 0)
lanza('cantidad cero', lambda: Carrito().añadir('gorra', 500, 0), ValueError)

grupo('RepositorioUsuariosEnMemoria')


def _guardar_y_buscar():
    r = RepositorioUsuariosEnMemoria()
    r.guardar(Usuario(1, 'Ana'))
    return r.buscar(1).nombre


comprueba('guardar y buscar', _guardar_y_buscar, 'Ana')
comprueba('buscar lo que no existe da None', lambda: RepositorioUsuariosEnMemoria().buscar(7), None)


def _reemplaza():
    r = RepositorioUsuariosEnMemoria()
    r.guardar(Usuario(1, 'Ana'))
    r.guardar(Usuario(2, 'Luis'))
    r.guardar(Usuario(1, 'Ana María'))
    return [u.nombre for u in r.todos()]


comprueba('guardar el mismo id reemplaza sin duplicar', _reemplaza, ['Ana María', 'Luis'])


def _eliminar():
    r = RepositorioUsuariosEnMemoria()
    r.guardar(Usuario(1, 'Ana'))
    return [r.eliminar(1), r.eliminar(1), r.buscar(1)]


comprueba('eliminar devuelve si existía', _eliminar, [True, False, None])


def _lista_tras_eliminar():
    r = RepositorioUsuariosEnMemoria()
    for i in (1, 2, 3):
        r.guardar(Usuario(i, f'u{i}'))
    r.eliminar(2)
    return [type(r.todos()).__name__, [u.id for u in r.todos()]]


comprueba('todos() es una lista tras eliminar', _lista_tras_eliminar, ['list', [1, 3]])

grupo('Despachador')


def _despacha_con_datos():
    d = Despachador()
    visto = []
    d.escuchar('alta', visto.append)
    n = d.despachar('alta', 'ana')
    return [n, visto]


comprueba('despacha a los oyentes con los datos', _despacha_con_datos, [1, ['ana']])
comprueba('evento sin oyentes', lambda: Despachador().despachar('nada'), 0)


def _prioridades():
    d = Despachador()
    orden = []
    d.escuchar('e', lambda _: orden.append('b'))
    d.escuchar('e', lambda _: orden.append('alta'), 10)
    d.escuchar('e', lambda _: orden.append('c'))
    d.despachar('e')
    return orden


comprueba('mayor prioridad primero; a igual prioridad, orden de registro', _prioridades, ['alta', 'b', 'c'])


def _corta_cadena():
    d = Despachador()
    llamados = []
    d.escuchar('e', lambda _: llamados.append(1) or False, 5)
    d.escuchar('e', lambda _: llamados.append(2))
    return [d.despachar('e'), len(llamados)]


comprueba('devolver False corta la cadena', _corta_cadena, [1, 1])


def _eventos_separados():
    d = Despachador()
    d.escuchar('a', lambda _: None)
    return d.despachar('b')


comprueba('los eventos no se mezclan', _eventos_separados, 0)


# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
# Cuánto cuesta buscar un usuario según el tamaño del repositorio (O(1) si guardas por id).
def repositorio_con(n: int) -> RepositorioUsuariosEnMemoria:
    r = RepositorioUsuariosEnMemoria()
    for i in range(1, n + 1):
        r.guardar(Usuario(i, f'u{i}'))
    return r


medir(lambda r, id: r.buscar(id), lambda n: (repositorio_con(n), n), etiqueta='RepositorioUsuariosEnMemoria')
