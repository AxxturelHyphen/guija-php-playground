<?php
declare(strict_types=1); // Hace que PHP compruebe los tipos como Java. Sin esto, convierte "5" en 5 sin avisar.

/*
 * De Java a PHP, sección a sección.
 * Ejecuta con Ctrl+Enter en el playground (o en la terminal: php ejemplos/01-java-a-php.php).
 * Toca cosas, rómpelas y vuelve a ejecutar: así es como se aprende.
 */

function titulo(string $texto): void
{
    echo "\n=== {$texto} ===\n";
}

// ─────────────────────────────────────────────────────────────────────────────
titulo('1. Variables y tipos');
// Java: int edad = 30; String nombre = "Ana";
$edad = 30;          // las variables llevan $ y no se declara su tipo
$nombre = 'Ana';
$precio = 9.99;
$activo = true;
$nada = null;

echo get_debug_type($edad), ' ', get_debug_type($nombre), ' ', get_debug_type($precio), ' ',
    get_debug_type($activo), ' ', get_debug_type($nada), "\n";

// Java: static final int MAX_INTENTOS = 3;
const MAX_INTENTOS = 3;
echo 'MAX_INTENTOS = ', MAX_INTENTOS, "\n";

// ─────────────────────────────────────────────────────────────────────────────
titulo('2. Strings');
// Java: "Hola " + nombre   →   PHP: 'Hola ' . $nombre   (el + es SOLO para números)
echo 'Hola ' . $nombre . "\n";

// Las comillas dobles meten variables dentro; las simples no
echo "Dobles: hola {$nombre}, tienes {$edad} años\n";
echo 'Simples: hola {$nombre}', "\n";

// String.format → sprintf / printf
printf("%s cuesta %.2f €\n", 'El café', $precio);

// No hay "abc".length(): son funciones sueltas
echo strlen('hola'), ' ', strtoupper('hola'), ' ', str_contains('backend', 'end') ? 'sí' : 'no', "\n";
// Ojo con los acentos: strlen cuenta bytes, mb_strlen cuenta caracteres
echo strlen('año'), ' bytes vs ', mb_strlen('año'), " caracteres\n";

// ─────────────────────────────────────────────────────────────────────────────
titulo('3. Arrays: List y Map en uno');
// Java: List<String> lista = new ArrayList<>(List.of("Java", "PHP"));
$lista = ['Java', 'PHP'];
$lista[] = 'Go';                              // lista.add("Go")
echo count($lista), ' elementos, el primero es ', $lista[0], "\n";

// Java: Map<String, Integer> edades = new HashMap<>();
$edades = ['Ana' => 30, 'Luis' => 25];
$edades['Marta'] = 41;                        // edades.put("Marta", 41)
echo 'Luis tiene ', $edades['Luis'], "\n";
echo isset($edades['Pepe']) ? "Pepe existe\n" : "Pepe no existe\n"; // containsKey
// A diferencia de HashMap, se MANTIENE el orden de inserción (como LinkedHashMap)

foreach ($edades as $quien => $anios) {       // for (var e : edades.entrySet())
    echo "  {$quien}: {$anios}\n";
}

// Streams → array_map / array_filter / array_reduce
$numeros = [1, 2, 3, 4, 5, 6];
$paresAlCuadrado = array_map(fn(int $n): int => $n ** 2, array_filter($numeros, fn(int $n): bool => $n % 2 === 0));
print_r($paresAlCuadrado);                    // ¡Ojo! array_filter conserva las claves: [1 => 4, 3 => 16, 5 => 36]
print_r(array_values($paresAlCuadrado));      // array_values reindexa: [0 => 4, 1 => 16, 2 => 36]
echo 'Suma: ', array_sum($numeros), ' | Producto: ', array_reduce($numeros, fn(int $acc, int $n): int => $acc * $n, 1), "\n";

// Los arrays se COPIAN al asignarlos (en Java copiarías la referencia a la misma lista)
$a = [1, 2, 3];
$b = $a;
$b[] = 4;
echo 'a tiene ', count($a), ', b tiene ', count($b), "\n";

// Desestructurar
[$primero, $segundo] = $lista;
['Ana' => $edadAna] = $edades;
echo "{$primero}, {$segundo}, Ana: {$edadAna}\n";

// Ordenar: sort() modifica el propio array (no devuelve uno nuevo)
$desordenado = [3, 1, 2];
sort($desordenado);
echo implode(', ', $desordenado), "\n";      // String.join(", ", ...)
// Comparator → función con el operador "nave espacial" <=> (devuelve -1, 0 o 1)
usort($lista, fn(string $x, string $y): int => strlen($x) <=> strlen($y));
echo implode(', ', $lista), "\n";

// ─────────────────────────────────────────────────────────────────────────────
titulo('4. Funciones');
// Java: public static int sumar(int a, int b)
function sumar(int $a, int $b): int
{
    return $a + $b;
}
echo sumar(2, 3), "\n";

// No hay sobrecarga: se usan valores por defecto y nullables (?string)
function saludar(string $nombre, string $saludo = 'Hola', ?string $apellido = null): string
{
    return trim("{$saludo} {$nombre} " . ($apellido ?? ''));
}
echo saludar('Ana'), ' | ', saludar('Ana', 'Buenas'), "\n";
// Named arguments: pasas solo los que quieras, en cualquier orden
echo saludar('Ana', apellido: 'García'), "\n";

// Union types: o int o string
function describir(int|string $id): string
{
    return is_int($id) ? "id numérico {$id}" : "id de texto '{$id}'";
}
echo describir(7), ' | ', describir('abc'), "\n";

// Varargs. Java: int total(int... nums)
function total(int ...$nums): int
{
    return array_sum($nums);
}
echo total(1, 2, 3), ' ', total(...[4, 5]), "\n"; // con ... también "esparces" un array

// strict_types en acción: en Java esto no compilaría; aquí lanza TypeError al ejecutarse
try {
    echo sumar('2', 3);
} catch (TypeError $e) {
    echo 'TypeError: ', $e->getMessage(), "\n";
}

// ─────────────────────────────────────────────────────────────────────────────
titulo('5. Lambdas y closures');
// Java: Function<Integer, Integer> doble = x -> x * 2;
$doble = fn(int $x): int => $x * 2;
echo $doble(21), "\n";

// fn captura automáticamente las variables de fuera (por valor)
$factor = 3;
$porFactor = fn(int $x): int => $x * $factor;
echo $porFactor(5), "\n";

// function () normal: dices qué captura con use. Con & la captura por referencia
// (en Java no se puede: las variables capturadas tienen que ser "effectively final")
$contador = 0;
$incrementar = function () use (&$contador): void {
    $contador++;
};
$incrementar();
$incrementar();
echo "contador = {$contador}\n";

// Referencia a método. Java: String::toUpperCase  →  PHP: strtoupper(...)
$mayus = strtoupper(...);
echo implode(' ', array_map($mayus, ['a', 'b', 'c'])), "\n";

// ─────────────────────────────────────────────────────────────────────────────
titulo('6. Clases');

class Cuenta
{
    private static int $creadas = 0;          // static igual que en Java

    // Constructor promotion: declara y asigna propiedades en el propio constructor.
    // En Java serían los campos + this.titular = titular; this.saldo = saldo;
    public function __construct(
        public readonly string $titular,      // readonly ≈ final
        private float $saldo = 0.0,
    ) {
        self::$creadas++;
    }

    public function ingresar(float $cantidad): static // devuelve $this para poder encadenar
    {
        if ($cantidad <= 0) {
            throw new InvalidArgumentException('La cantidad debe ser positiva');
        }
        $this->saldo += $cantidad;            // this.saldo → $this->saldo
        return $this;
    }

    public function saldo(): float
    {
        return $this->saldo;
    }

    public static function creadas(): int
    {
        return self::$creadas;
    }

    public function __toString(): string      // toString()
    {
        return sprintf('%s: %.2f €', $this->titular, $this->saldo);
    }
}

$cuenta = new Cuenta('Ana');
$cuenta->ingresar(100)->ingresar(50.5);       // obj.metodo() → $obj->metodo()
echo $cuenta, "\n";                           // echo usa __toString
echo 'Titular: ', $cuenta->titular, "\n";
echo 'Cuentas creadas: ', Cuenta::creadas(), "\n"; // Clase.metodo() → Clase::metodo()

try {
    $cuenta->titular = 'Otro';                // readonly: no se puede reasignar
} catch (Error $e) {
    echo get_class($e), ': ', $e->getMessage(), "\n";
}

// ─────────────────────────────────────────────────────────────────────────────
titulo('7. Interfaces, abstract y herencia');

interface Figura
{
    public function area(): float;
}

abstract class FiguraBase implements Figura
{
    public function describir(): string
    {
        // static::class ≈ getClass().getName()
        return sprintf('%s con área %.2f', static::class, $this->area());
    }
}

final class Circulo extends FiguraBase        // final como en Java
{
    public function __construct(private float $radio)
    {
    }

    #[\Override] // como @Override: si el método no existe arriba, PHP da error
    public function area(): float
    {
        return M_PI * $this->radio ** 2;
    }
}

final class Rectangulo extends FiguraBase
{
    public function __construct(private float $ancho, private float $alto)
    {
    }

    #[\Override]
    public function area(): float
    {
        return $this->ancho * $this->alto;
    }
}

/** @var FiguraBase[] $figuras  ← los "genéricos" en PHP son solo documentación */
$figuras = [new Circulo(2), new Rectangulo(3, 4)];
foreach ($figuras as $figura) {
    echo $figura->describir(), "\n";
}
echo $figuras[0] instanceof Figura ? "Circulo es una Figura\n" : "Circulo no es una Figura\n";

// ─────────────────────────────────────────────────────────────────────────────
titulo('8. Traits: reutilizar código sin heredar');
// Java no tiene esto. Lo más parecido son los default methods, pero un trait también puede tener estado

trait TieneFechaCreacion
{
    private ?string $creadoEn = null;

    public function marcarCreado(): void
    {
        $this->creadoEn = date('Y-m-d H:i');
    }

    public function creadoEn(): ?string
    {
        return $this->creadoEn;
    }
}

final class Post
{
    use TieneFechaCreacion; // en Laravel lo verás todo el rato: HasFactory, Notifiable, SoftDeletes...

    public function __construct(public string $titulo)
    {
    }
}

$post = new Post('Hola mundo');
$post->marcarCreado();
echo "'{$post->titulo}' creado el {$post->creadoEn()}\n";

// ─────────────────────────────────────────────────────────────────────────────
titulo('9. Enums');

enum Estado: string // "backed enum": cada caso tiene un valor (muy útil para BD y JSON)
{
    case Borrador = 'borrador';
    case Publicado = 'publicado';

    public function etiqueta(): string
    {
        // match ≈ el switch con flechas de Java 14+: devuelve valor y no necesita break
        return match ($this) {
            self::Borrador => 'En borrador',
            self::Publicado => 'Publicado',
        };
    }
}

$estado = Estado::from('publicado');          // Estado.valueOf(...)
echo $estado->name, ' → ', $estado->etiqueta(), "\n";
var_dump(Estado::tryFrom('no-existe'));       // tryFrom devuelve null en vez de lanzar excepción
echo count(Estado::cases()), " casos\n";      // Estado.values()

// ─────────────────────────────────────────────────────────────────────────────
titulo('10. Records → readonly class');
// Java: record Punto(int x, int y) {}

final readonly class Punto
{
    public function __construct(public int $x, public int $y)
    {
    }

    public function conX(int $x): self        // "wither": devuelve una copia nueva
    {
        return new self($x, $this->y);
    }
}

$p1 = new Punto(1, 2);
$p2 = $p1->conX(10);
echo "p1 = ({$p1->x}, {$p1->y}), p2 = ({$p2->x}, {$p2->y})\n";
var_dump($p1 == new Punto(1, 2));             // ==  compara propiedades (como equals() de un record)
var_dump($p1 === new Punto(1, 2));            // === compara identidad (como == entre objetos en Java)

// ─────────────────────────────────────────────────────────────────────────────
titulo('11. == vs === (¡importante!)');
// == convierte tipos antes de comparar; === compara valor Y tipo. Usa === casi siempre
var_dump(1 == '1');        // true
var_dump(1 === '1');       // false
var_dump('abc' == 0);      // false desde PHP 8 (antes era true...)
var_dump(null == false);   // true
var_dump(null === false);  // false

// ─────────────────────────────────────────────────────────────────────────────
titulo('12. Nulls sin NullPointerException');
$usuario = ['nombre' => 'Ana', 'direccion' => null];
// ?? ≈ Optional.ofNullable(...).orElse(...). No avisa aunque la clave no exista
echo $usuario['direccion']['ciudad'] ?? 'sin ciudad', "\n";

$sinCuenta = null;
var_dump($sinCuenta?->saldo());               // ?-> : si es null devuelve null en vez de petar

$config = [];
$config['modo'] ??= 'dev';                    // asigna solo si no existe o es null
echo "modo = {$config['modo']}\n";

// ─────────────────────────────────────────────────────────────────────────────
titulo('13. Excepciones');
// No hay checked exceptions: no existe "throws" y nada te obliga a capturar

final class SaldoInsuficiente extends RuntimeException
{
    public function __construct(public readonly float $falta)
    {
        parent::__construct(sprintf('Faltan %.2f €', $falta));
    }
}

function retirar(Cuenta $c, float $cantidad): void
{
    if ($cantidad > $c->saldo()) {
        throw new SaldoInsuficiente($cantidad - $c->saldo());
    }
}

try {
    retirar($cuenta, 1000);
} catch (SaldoInsuficiente $e) {
    echo 'Error: ', $e->getMessage(), " (falta {$e->falta})\n";
} catch (InvalidArgumentException | TypeError $e) { // multi-catch, igual que en Java
    echo 'Otro error: ', $e->getMessage(), "\n";
} finally {
    echo "finally se ejecuta siempre\n";
}

// ─────────────────────────────────────────────────────────────────────────────
titulo('14. "Genéricos": colecciones tipadas a mano');
// PHP no tiene genéricos. Se documentan con PHPDoc (@template, list<T>...) y los comprueban
// herramientas como PHPStan. Para que algo funcione con foreach se implementa
// IteratorAggregate (≈ Iterable<T> en Java)

/** @implements IteratorAggregate<int, Cuenta> */
final class Cuentas implements IteratorAggregate, Countable
{
    /** @var list<Cuenta> */
    private array $items = [];

    public function add(Cuenta $cuenta): void // el tipo sí se comprueba aquí, en tiempo de ejecución
    {
        $this->items[] = $cuenta;
    }

    public function getIterator(): Iterator
    {
        return new ArrayIterator($this->items);
    }

    public function count(): int
    {
        return count($this->items);
    }
}

$banco = new Cuentas();
$banco->add($cuenta);
$banco->add((new Cuenta('Luis'))->ingresar(20));
echo count($banco), " cuentas:\n";
foreach ($banco as $c) {
    echo "  {$c}\n";
}

// ─────────────────────────────────────────────────────────────────────────────
titulo('15. PHP moderno (8.4+): cosas que Java no tiene');
// Si tu proyecto Laravel usa una versión más antigua de PHP, esta sección no te funcionará allí

// Visibilidad asimétrica: se lee desde fuera, pero solo se escribe desde dentro
// (como un campo privado con getter, sin escribir el getter)
final class Contador
{
    public private(set) int $valor = 0;

    public function sumar(): void
    {
        $this->valor++;
    }
}
$contadorObj = new Contador();
$contadorObj->sumar();
$contadorObj->sumar();
echo "valor = {$contadorObj->valor}\n";

// Property hooks: lógica al leer o escribir una propiedad (adiós getters y setters)
final class Usuario
{
    public string $email {
        set => strtolower(trim($value));
    }

    public string $dominio {
        get => explode('@', $this->email)[1] ?? '';
    }
}
$u = new Usuario();
$u->email = '  ANA@Ejemplo.COM ';
echo "{$u->email} → dominio {$u->dominio}\n";

// Operador pipe |> (PHP 8.5+): encadenar funciones como en un stream
$slug = '  Hola Mundo PHP  '
    |> trim(...)
    |> strtolower(...)
    |> (fn(string $s): string => str_replace(' ', '-', $s));
echo $slug, "\n";

// ─────────────────────────────────────────────────────────────────────────────
titulo('Y una diferencia de mentalidad');
echo <<<TXT
En Java (Spring) la app arranca una vez y los objetos viven en memoria entre peticiones.
En PHP cada petición HTTP empieza desde cero: se carga todo, se responde y se descarta.
Por eso no hay estado compartido en memoria: eso va a la base de datos, la caché o la sesión.
TXT;
echo "\n";
