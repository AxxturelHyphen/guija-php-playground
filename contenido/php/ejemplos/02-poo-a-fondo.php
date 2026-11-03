<?php
declare(strict_types=1);

/*
 * TEMA 2 · POO A FONDO
 * ────────────────────────────────────────────────────────────────────────────
 * Ya sabes POO desde Java. Aquí vemos cómo se escribe "bien" en PHP moderno y las
 * ideas que hay detrás de frameworks como Laravel o Symfony: interfaces como
 * contratos, composición, inyección de dependencias, Strategy, Repository y
 * objetos de valor. Al final hay 5 ejercicios con pruebas.
 *
 * Cómo se trabaja:
 *   1. Ctrl+Enter ejecuta el archivo: verás la teoría y las pruebas en «Pendiente».
 *   2. Sustituye los `pendiente();` por tu código y vuelve a ejecutar.
 *   3. Ctrl+S guarda tu copia en practicas/ (este ejemplo no se modifica).
 *   4. Cuando acabes (o te atasques) abre la pestaña «Solución».
 */

function titulo(string $texto): void
{
    echo "\n=== {$texto} ===\n";
}

// ════════════════════════════════════════════════════════════════════════════
// 1. INTERFACES: CONTRATOS, NO HERENCIA
// ════════════════════════════════════════════════════════════════════════════
// Igual que en Java: una interfaz dice QUÉ se puede hacer, no CÓMO. Quien la use
// depende del contrato y no de una clase concreta (así se pueden cambiar piezas
// sin tocar el resto).

titulo('1. Interfaces');

interface Notificador
{
    public function enviar(string $destino, string $mensaje): string;
}

final class NotificadorEmail implements Notificador
{
    public function enviar(string $destino, string $mensaje): string
    {
        return "[email a {$destino}] {$mensaje}";
    }
}

final class NotificadorSms implements Notificador
{
    public function enviar(string $destino, string $mensaje): string
    {
        return "[sms a {$destino}] " . mb_substr($mensaje, 0, 20);
    }
}

/** @param list<Notificador> $canales */
function avisarATodos(array $canales, string $destino, string $mensaje): void
{
    foreach ($canales as $canal) {
        echo $canal->enviar($destino, $mensaje), "\n";   // no sabe (ni le importa) qué canal es
    }
}

avisarATodos([new NotificadorEmail(), new NotificadorSms()], 'ana', 'Tu pedido ya está en camino');

// ════════════════════════════════════════════════════════════════════════════
// 2. COMPOSICIÓN FRENTE A HERENCIA
// ════════════════════════════════════════════════════════════════════════════
// "Un Pedido NO ES un Notificador, un Pedido USA un Notificador."
// La herencia ata (una sola clase padre, cambios que se propagan). La composición
// compone piezas pequeñas y se puede cambiar en tiempo de ejecución.

titulo('2. Composición');

final class Pedido
{
    /** @var list<string> */
    private array $lineas = [];

    // Constructor promocionado: declara y asigna la propiedad en una sola línea.
    public function __construct(
        private readonly string $cliente,
        private readonly Notificador $notificador,   // inyectado desde fuera
    ) {
    }

    public function añadir(string $producto): self
    {
        $this->lineas[] = $producto;
        return $this;                                // interfaz fluida
    }

    public function confirmar(): string
    {
        return $this->notificador->enviar($this->cliente, 'Pedido confirmado: ' . implode(', ', $this->lineas));
    }
}

echo (new Pedido('ana', new NotificadorEmail()))->añadir('teclado')->añadir('ratón')->confirmar(), "\n";
echo (new Pedido('luis', new NotificadorSms()))->añadir('monitor')->confirmar(), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. INYECCIÓN DE DEPENDENCIAS (DI)
// ════════════════════════════════════════════════════════════════════════════
// Una clase NO crea lo que necesita (`new NotificadorEmail()` dentro de Pedido):
// se lo dan en el constructor. Ventajas: se puede probar con un doble falso,
// se cambia la pieza sin tocar la clase y las dependencias quedan a la vista.
// Un "contenedor" automatiza esto: mira el constructor con Reflection y construye
// lo que haga falta (es lo que hace Laravel con `app()->make()`). Lo harás en el ejercicio 4.

titulo('3. Inyección de dependencias');

final class NotificadorFalso implements Notificador
{
    /** @var list<string> */
    public array $enviados = [];

    public function enviar(string $destino, string $mensaje): string
    {
        return $this->enviados[] = "{$destino}: {$mensaje}";
    }
}

$falso = new NotificadorFalso();
(new Pedido('test', $falso))->añadir('x')->confirmar();
echo 'El doble de pruebas guardó ', count($falso->enviados), " mensaje(s) sin enviar nada de verdad\n";

// ════════════════════════════════════════════════════════════════════════════
// 4. STRATEGY: ALGORITMOS INTERCAMBIABLES
// ════════════════════════════════════════════════════════════════════════════
// Se mete la parte que varía detrás de una interfaz y se inyecta. En PHP, además,
// una función anónima o `callable` suele bastar (no hace falta una clase por estrategia).

titulo('4. Strategy');

interface Ordenacion
{
    /** @param list<int> $xs @return list<int> */
    public function ordenar(array $xs): array;
}

final class Ascendente implements Ordenacion
{
    public function ordenar(array $xs): array
    {
        sort($xs);          // $xs es una copia: PHP pasa los arrays por valor (copy-on-write)
        return $xs;
    }
}

final class Descendente implements Ordenacion
{
    public function ordenar(array $xs): array
    {
        rsort($xs);
        return $xs;
    }
}

function mostrarOrdenado(array $xs, Ordenacion $criterio): void
{
    echo implode(' ', $criterio->ordenar($xs)), "\n";
}

mostrarOrdenado([3, 1, 2], new Ascendente());
mostrarOrdenado([3, 1, 2], new Descendente());

// Misma idea con callables (más corto cuando la estrategia es una sola función):
$porLongitud = static fn(string $a, string $b): int => strlen($a) <=> strlen($b);
$palabras = ['kiwi', 'fresa', 'pera'];
usort($palabras, $porLongitud);
echo implode(' ', $palabras), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 5. OBJETOS DE VALOR (VALUE OBJECTS) Y readonly
// ════════════════════════════════════════════════════════════════════════════
// Un objeto de valor se define por sus datos, no por su identidad, y es INMUTABLE:
// cualquier "cambio" devuelve un objeto nuevo. Sustituyen a los `int $euros` sueltos
// que no saben validarse ni tienen comportamiento. `readonly` lo garantiza.

titulo('5. Value objects');

final readonly class Punto
{
    public function __construct(public int $x, public int $y)
    {
    }

    public function mover(int $dx, int $dy): self
    {
        return new self($this->x + $dx, $this->y + $dy);   // no modifica: devuelve otro
    }

    public function igual(Punto $otro): bool
    {
        return $this->x === $otro->x && $this->y === $otro->y;
    }

    public function __toString(): string
    {
        return "({$this->x}, {$this->y})";
    }
}

$a = new Punto(1, 2);
$b = $a->mover(3, 4);
echo "a = {$a}, b = {$b}, ¿iguales? ", var_export($a->igual($b), true), "\n";

try {
    $a->x = 99;                       // readonly: se prohíbe
} catch (Error $e) {
    echo 'Error esperado: ', $e->getMessage(), "\n";
}

// Los enum son valores con nombre: el sustituto de las "constantes mágicas" y los strings sueltos.
enum Estado: string
{
    case Pendiente = 'pendiente';
    case Enviado = 'enviado';

    public function etiqueta(): string
    {
        return match ($this) {            // match es exhaustivo: si olvidas un caso, falla
            self::Pendiente => 'Esperando',
            self::Enviado => 'En camino',
        };
    }
}
echo Estado::from('enviado')->etiqueta(), ' · ', Estado::tryFrom('roto')?->etiqueta() ?? '(valor desconocido)', "\n";

// ════════════════════════════════════════════════════════════════════════════
// 6. REPOSITORY: ESCONDER DÓNDE SE GUARDAN LOS DATOS
// ════════════════════════════════════════════════════════════════════════════
// El resto de la aplicación habla con una interfaz ("dame el usuario 7") y no sabe si
// los datos están en MySQL, en un archivo o en memoria. En las pruebas se usa la versión
// en memoria; en producción, la de base de datos. Es el patrón detrás de Eloquent/Doctrine.

final class Usuario
{
    public function __construct(public readonly int $id, public readonly string $nombre)
    {
    }
}

interface RepositorioUsuarios
{
    public function guardar(Usuario $usuario): void;

    public function buscar(int $id): ?Usuario;

    /** @return list<Usuario> en el orden en que se guardaron por primera vez */
    public function todos(): array;

    /** @return bool true si existía y se borró */
    public function eliminar(int $id): bool;
}

titulo('6. Repository (ejemplo resuelto con otra entidad)');

final class RepositorioLibrosEnMemoria
{
    /** @var array<string, string> isbn => título */
    private array $libros = [];

    public function guardar(string $isbn, string $titulo): void
    {
        $this->libros[$isbn] = $titulo;       // guardar dos veces el mismo isbn ACTUALIZA
    }

    public function buscar(string $isbn): ?string
    {
        return $this->libros[$isbn] ?? null;  // ?? evita el warning de clave inexistente
    }
}

$repo = new RepositorioLibrosEnMemoria();
$repo->guardar('111', 'Clean Code');
$repo->guardar('111', 'Clean Code (2.ª ed.)');
echo $repo->buscar('111'), ' | ', var_export($repo->buscar('999'), true), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 7. EXCEPCIONES PROPIAS
// ════════════════════════════════════════════════════════════════════════════
// En PHP no existen las excepciones "comprobadas" (no hay `throws`). Se crean clases
// con nombre propio para poder capturar lo que te interesa y nada más.

final class StockInsuficiente extends RuntimeException
{
    public static function de(string $producto, int $pedido, int $hay): self
    {
        return new self("No hay stock de {$producto}: pides {$pedido} y quedan {$hay}");
    }
}

titulo('7. Excepciones');
try {
    throw StockInsuficiente::de('teclado', 5, 2);
} catch (InvalidArgumentException) {
    echo "no entra aquí\n";
} catch (StockInsuficiente | LogicException $e) {      // varios tipos con |
    echo get_class($e), ': ', $e->getMessage(), "\n";
} finally {
    echo "finally se ejecuta siempre\n";
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════
// Sustituye cada `pendiente();` por tu código. Mantén las firmas: las pruebas las usan.

// ── Ejercicio 1 · Dinero (objeto de valor) ──────────────────────────────────
/**
 * Dinero en céntimos para no arrastrar errores de coma flotante (0.1 + 0.2 != 0.3).
 *  - Es INMUTABLE (readonly): sumar, multiplicar... devuelven un Dinero nuevo.
 *  - `new Dinero(-1)` lanza InvalidArgumentException (no hay dinero negativo).
 *  - La moneda son tres letras mayúsculas ('EUR', 'USD'); si no, InvalidArgumentException.
 *  - `euros(12.5)` crea 1250 céntimos (redondea: euros(0.1 + 0.2) son 30 céntimos).
 *  - `sumar` con monedas distintas lanza InvalidArgumentException.
 *  - `multiplicar(1.5)` redondea al céntimo más cercano.
 *  - `__toString()`: "12,50 EUR" (coma decimal, siempre dos decimales).
 */
final readonly class Dinero
{
    public function __construct(public int $centimos, public string $moneda = 'EUR')
    {
        pendiente();
    }

    public static function euros(float|int $euros, string $moneda = 'EUR'): self
    {
        pendiente();
    }

    public function sumar(Dinero $otro): self
    {
        pendiente();
    }

    public function multiplicar(float $factor): self
    {
        pendiente();
    }

    public function igual(Dinero $otro): bool
    {
        pendiente();
    }

    public function __toString(): string
    {
        pendiente();
    }
}

// ── Ejercicio 2 · Carrito con descuentos (Strategy) ─────────────────────────
/** Una "línea" del carrito: nombre, precio unitario en céntimos y cantidad. */
interface Descuento
{
    /**
     * Céntimos que se descuentan de un carrito.
     * @param list<array{nombre: string, precio: int, cantidad: int}> $lineas
     */
    public function calcular(array $lineas): int;
}

/**
 * Descuento por porcentaje sobre el subtotal (entero, redondeando hacia abajo):
 * 15 % de 1999 céntimos = 299. Un porcentaje fuera de 0..100 lanza InvalidArgumentException.
 */
final class DescuentoPorcentaje implements Descuento
{
    public function __construct(private readonly int $porcentaje)
    {
        pendiente();
    }

    public function calcular(array $lineas): int
    {
        pendiente();
    }
}

/** Descuento de una cantidad fija, que nunca puede superar el subtotal. */
final class DescuentoFijo implements Descuento
{
    public function __construct(private readonly int $centimos)
    {
        pendiente();
    }

    public function calcular(array $lineas): int
    {
        pendiente();
    }
}

/** 3x2 en cada línea: de cada 3 unidades, una es gratis (6 unidades → 2 gratis). */
final class TresPorDos implements Descuento
{
    public function calcular(array $lineas): int
    {
        pendiente();
    }
}

/**
 * El carrito NO sabe qué descuentos existen: los recibe (inyección) y se limita a sumarlos.
 *  - añadir() acepta cantidad > 0 (si no, InvalidArgumentException) y devuelve $this.
 *  - subtotal(): suma de precio × cantidad.
 *  - descuento(): suma de todos los descuentos aplicados, sin pasar nunca del subtotal.
 *  - total(): subtotal − descuento.
 */
final class Carrito
{
    public function __construct()
    {
        pendiente();
    }

    public function añadir(string $nombre, int $precio, int $cantidad = 1): self
    {
        pendiente();
    }

    public function aplicar(Descuento $descuento): self
    {
        pendiente();
    }

    public function subtotal(): int
    {
        pendiente();
    }

    public function descuento(): int
    {
        pendiente();
    }

    public function total(): int
    {
        pendiente();
    }
}

// ── Ejercicio 3 · Repositorio en memoria ────────────────────────────────────
/**
 * Implementa RepositorioUsuarios guardando los usuarios en un array indexado por id:
 *  - guardar() inserta o REEMPLAZA (mismo id) sin cambiar su posición.
 *  - buscar() es O(1) (nada de recorrer el array) y devuelve null si no existe.
 *  - todos() devuelve una lista (claves 0, 1, 2...) en orden de primera inserción.
 *  - eliminar() devuelve true si existía.
 */
final class RepositorioUsuariosEnMemoria implements RepositorioUsuarios
{
    public function guardar(Usuario $usuario): void
    {
        pendiente();
    }

    public function buscar(int $id): ?Usuario
    {
        pendiente();
    }

    public function todos(): array
    {
        pendiente();
    }

    public function eliminar(int $id): bool
    {
        pendiente();
    }
}

// ── Ejercicio 4 · Mini contenedor de inyección de dependencias ──────────────
/** Se lanza cuando el contenedor no puede construir algo (clase inexistente, parámetro sin tipo...). */
class ContenedorException extends RuntimeException
{
}

/** Dependencia circular: A necesita B y B necesita A. */
final class DependenciaCircular extends ContenedorException
{
}

/**
 * Un contenedor como el de Laravel, en pequeño:
 *  - set($id, fn(Contenedor $c) => ...) registra cómo construir algo (la fábrica recibe el contenedor).
 *  - get($id) devuelve SIEMPRE la misma instancia (singleton) y construye con AUTOWIRING si $id es
 *    una clase no registrada: mira el constructor con ReflectionClass y resuelve cada parámetro:
 *        · parámetro con tipo de clase/interfaz → $this->get(ese tipo)
 *        · parámetro con valor por defecto → ese valor
 *        · cualquier otro → ContenedorException
 *  - has($id): true si está registrado o es una clase instanciable.
 *  - Una interfaz sin registrar es ContenedorException. Un ciclo, DependenciaCircular.
 */
final class Contenedor
{
    public function set(string $id, callable $fabrica): void
    {
        pendiente();
    }

    public function has(string $id): bool
    {
        pendiente();
    }

    public function get(string $id): object
    {
        pendiente();
    }
}

// Clases de apoyo para las pruebas del contenedor (no hay que tocarlas)
final class Motor
{
}

final class Coche
{
    public function __construct(public readonly Motor $motor, public readonly int $plazas = 5)
    {
    }
}

final class Taller
{
    public function __construct(public readonly Coche $coche, public readonly Motor $repuesto)
    {
    }
}

interface Reloj
{
    public function ahora(): string;
}

final class RelojFijo implements Reloj
{
    public function ahora(): string
    {
        return '2025-01-01';
    }
}

final class Agenda
{
    public function __construct(public readonly Reloj $reloj)
    {
    }
}

final class CicloA
{
    public function __construct(public readonly CicloB $b)
    {
    }
}

final class CicloB
{
    public function __construct(public readonly CicloA $a)
    {
    }
}

final class SinTipo
{
    public function __construct($cosa)
    {
    }
}

// ── Ejercicio 5 · Despachador de eventos (patrón Observer) ──────────────────
/**
 * Los "oyentes" se registran para un evento y se llaman cuando alguien lo despacha.
 *  - escuchar($evento, $oyente, $prioridad = 0): mayor prioridad se ejecuta antes;
 *    con igual prioridad, por orden de registro.
 *  - despachar($evento, $datos = null): llama a cada oyente con $datos y devuelve cuántos se ejecutaron.
 *    Un evento sin oyentes devuelve 0. Si un oyente devuelve EXACTAMENTE false, se corta la cadena
 *    (cuenta ese oyente pero no los siguientes).
 */
final class Despachador
{
    public function escuchar(string $evento, callable $oyente, int $prioridad = 0): void
    {
        pendiente();
    }

    public function despachar(string $evento, mixed $datos = null): int
    {
        pendiente();
    }
}

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS (no hace falta tocarlas)
// ════════════════════════════════════════════════════════════════════════════

grupo('Dinero');
comprueba('euros(12.5) son 1250 céntimos', fn() => Dinero::euros(12.5)->centimos, 1250);
comprueba('euros(0.1 + 0.2) redondea a 30 céntimos', fn() => Dinero::euros(0.1 + 0.2)->centimos, 30);
comprueba('sumar da un Dinero nuevo', fn() => Dinero::euros(1)->sumar(Dinero::euros(2.5))->centimos, 350);
comprueba('sumar no modifica el original', function () {
    $a = Dinero::euros(1);
    $a->sumar(Dinero::euros(1));
    return $a->centimos;
}, 100);
comprueba('multiplicar redondea', fn() => (new Dinero(1999))->multiplicar(1.5)->centimos, 2999);
comprueba('igual compara importe y moneda', fn() => Dinero::euros(3)->igual(new Dinero(300)) && !Dinero::euros(3)->igual(new Dinero(300, 'USD')), true);
comprueba('se imprime con coma decimal', fn() => (string) Dinero::euros(12.5), '12,50 EUR');
comprueba('se imprime con dos decimales', fn() => (string) new Dinero(5, 'USD'), '0,05 USD');
lanza('importe negativo', fn() => new Dinero(-1), InvalidArgumentException::class);
lanza('moneda inválida', fn() => new Dinero(1, 'euro'), InvalidArgumentException::class);
lanza('sumar monedas distintas', fn() => Dinero::euros(1)->sumar(new Dinero(100, 'USD')), InvalidArgumentException::class);

$lineas = [
    ['nombre' => 'camiseta', 'precio' => 1000, 'cantidad' => 3],
    ['nombre' => 'gorra', 'precio' => 500, 'cantidad' => 2],
];   // subtotal 4000

grupo('DescuentoPorcentaje');
comprueba('15 % de 1999', fn() => (new DescuentoPorcentaje(15))->calcular([['nombre' => 'x', 'precio' => 1999, 'cantidad' => 1]]), 299);
comprueba('20 % de 4000', fn() => (new DescuentoPorcentaje(20))->calcular($lineas), 800);
lanza('porcentaje mayor que 100', fn() => new DescuentoPorcentaje(101), InvalidArgumentException::class);

grupo('DescuentoFijo');
comprueba('resta la cantidad fija', fn() => (new DescuentoFijo(300))->calcular($lineas), 300);
comprueba('nunca pasa del subtotal', fn() => (new DescuentoFijo(9999))->calcular($lineas), 4000);

grupo('TresPorDos');
comprueba('3 camisetas: una gratis', fn() => (new TresPorDos())->calcular([['nombre' => 'c', 'precio' => 1000, 'cantidad' => 3]]), 1000);
comprueba('7 unidades: dos gratis', fn() => (new TresPorDos())->calcular([['nombre' => 'c', 'precio' => 100, 'cantidad' => 7]]), 200);
comprueba('menos de 3 unidades: nada', fn() => (new TresPorDos())->calcular([['nombre' => 'c', 'precio' => 100, 'cantidad' => 2]]), 0);

grupo('Carrito');
comprueba('subtotal', fn() => (new Carrito())->añadir('camiseta', 1000, 3)->añadir('gorra', 500, 2)->subtotal(), 4000);
comprueba('sin descuentos el total es el subtotal', fn() => (new Carrito())->añadir('gorra', 500)->total(), 500);
comprueba('acumula descuentos', fn() => (new Carrito())->añadir('camiseta', 1000, 3)->aplicar(new TresPorDos())->aplicar(new DescuentoFijo(500))->total(), 1500);
comprueba('el descuento nunca supera el subtotal', fn() => (new Carrito())->añadir('gorra', 500)->aplicar(new DescuentoFijo(400))->aplicar(new DescuentoFijo(400))->total(), 0);
lanza('cantidad cero', fn() => (new Carrito())->añadir('gorra', 500, 0), InvalidArgumentException::class);

grupo('RepositorioUsuariosEnMemoria');
comprueba('guardar y buscar', function () {
    $r = new RepositorioUsuariosEnMemoria();
    $r->guardar(new Usuario(1, 'Ana'));
    return $r->buscar(1)?->nombre;
}, 'Ana');
comprueba('buscar lo que no existe da null', fn() => (new RepositorioUsuariosEnMemoria())->buscar(7), null);
comprueba('guardar el mismo id reemplaza sin duplicar', function () {
    $r = new RepositorioUsuariosEnMemoria();
    $r->guardar(new Usuario(1, 'Ana'));
    $r->guardar(new Usuario(2, 'Luis'));
    $r->guardar(new Usuario(1, 'Ana María'));
    return array_map(static fn(Usuario $u) => $u->nombre, $r->todos());
}, ['Ana María', 'Luis']);
comprueba('eliminar devuelve si existía', function () {
    $r = new RepositorioUsuariosEnMemoria();
    $r->guardar(new Usuario(1, 'Ana'));
    return [$r->eliminar(1), $r->eliminar(1), $r->buscar(1)];
}, [true, false, null]);
comprueba('todos() es una lista tras eliminar', function () {
    $r = new RepositorioUsuariosEnMemoria();
    foreach ([1, 2, 3] as $i) {
        $r->guardar(new Usuario($i, "u{$i}"));
    }
    $r->eliminar(2);
    return array_keys($r->todos());
}, [0, 1]);

grupo('Contenedor');
comprueba('autowiring de una clase sin dependencias', fn() => (new Contenedor())->get(Motor::class) instanceof Motor, true);
comprueba('autowiring recursivo con valor por defecto', function () {
    $coche = (new Contenedor())->get(Coche::class);
    return [$coche instanceof Coche, $coche->motor instanceof Motor, $coche->plazas];
}, [true, true, 5]);
comprueba('devuelve siempre la misma instancia', function () {
    $c = new Contenedor();
    return $c->get(Motor::class) === $c->get(Motor::class);
}, true);
comprueba('las dependencias compartidas son la misma instancia', function () {
    $t = (new Contenedor())->get(Taller::class);
    return $t->coche->motor === $t->repuesto;
}, true);
comprueba('set() enlaza una interfaz con una implementación', function () {
    $c = new Contenedor();
    $c->set(Reloj::class, fn() => new RelojFijo());
    return $c->get(Agenda::class)->reloj->ahora();
}, '2025-01-01');
comprueba('la fábrica recibe el contenedor', function () {
    $c = new Contenedor();
    $c->set('motor.extra', fn(Contenedor $cont) => $cont->get(Motor::class));
    return $c->get('motor.extra') === $c->get(Motor::class);
}, true);
comprueba('has()', function () {
    $c = new Contenedor();
    $c->set('x', fn() => new Motor());
    return [$c->has('x'), $c->has(Motor::class), $c->has(Reloj::class), $c->has('NoExiste')];
}, [true, true, false, false]);
lanza('interfaz sin registrar', fn() => (new Contenedor())->get(Reloj::class), ContenedorException::class);
lanza('clase inexistente', fn() => (new Contenedor())->get('NoExiste'), ContenedorException::class);
lanza('parámetro sin tipo', fn() => (new Contenedor())->get(SinTipo::class), ContenedorException::class);
lanza('dependencia circular', fn() => (new Contenedor())->get(CicloA::class), DependenciaCircular::class);

grupo('Despachador');
comprueba('despacha a los oyentes con los datos', function () {
    $d = new Despachador();
    $visto = [];
    $d->escuchar('alta', function ($datos) use (&$visto) { $visto[] = $datos; });
    $n = $d->despachar('alta', 'ana');
    return [$n, $visto];
}, [1, ['ana']]);
comprueba('evento sin oyentes', fn() => (new Despachador())->despachar('nada'), 0);
comprueba('mayor prioridad primero; a igual prioridad, orden de registro', function () {
    $d = new Despachador();
    $orden = [];
    $d->escuchar('e', function () use (&$orden) { $orden[] = 'b'; });
    $d->escuchar('e', function () use (&$orden) { $orden[] = 'alta'; }, 10);
    $d->escuchar('e', function () use (&$orden) { $orden[] = 'c'; });
    $d->despachar('e');
    return $orden;
}, ['alta', 'b', 'c']);
comprueba('devolver false corta la cadena', function () {
    $d = new Despachador();
    $llamados = 0;
    $d->escuchar('e', function () use (&$llamados) { $llamados++; return false; }, 5);
    $d->escuchar('e', function () use (&$llamados) { $llamados++; });
    return [$d->despachar('e'), $llamados];
}, [1, 1]);
comprueba('los eventos no se mezclan', function () {
    $d = new Despachador();
    $d->escuchar('a', fn() => null);
    return $d->despachar('b');
}, 0);

// Mide cuánto cuesta buscar un usuario según el tamaño del repositorio (O(1) si guardas por id).
function repositorioCon(int $n): RepositorioUsuariosEnMemoria
{
    $r = new RepositorioUsuariosEnMemoria();
    for ($i = 1; $i <= $n; $i++) {
        $r->guardar(new Usuario($i, "u{$i}"));
    }
    return $r;
}
medir(
    fn(RepositorioUsuariosEnMemoria $r, int $id) => $r->buscar($id),
    fn(int $n): array => [repositorioCon($n), $n],
    etiqueta: 'RepositorioUsuariosEnMemoria',
);
