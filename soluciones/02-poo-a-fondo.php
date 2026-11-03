<?php
declare(strict_types=1);

/*
 * SOLUCIONES · Tema 2 · POO a fondo
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Objeto de valor inmutable para dinero.
 *
 * @complejidad Tiempo O(1) en todas las operaciones; espacio O(1).
 * @explicacion Todo se valida en el constructor, así que es IMPOSIBLE tener un Dinero inválido en el resto del
 * programa (no hay que volver a comprobar nada). Se guardan céntimos enteros para no arrastrar los errores de
 * la coma flotante (0.1 + 0.2 ≠ 0.3) y solo se usa float en el borde (`euros`, `multiplicar`), redondeando una vez.
 * `readonly` impide modificarlo: cada operación devuelve un objeto nuevo.
 * @alternativas Guardar un float de euros: más corto, pero acumula errores de redondeo y permite negativos.
 * Una clase mutable con setters: obliga a copiar defensivamente y a desconfiar en cada uso.
 */
final readonly class Dinero
{
    public function __construct(public int $centimos, public string $moneda = 'EUR')
    {
        if ($centimos < 0) {
            throw new InvalidArgumentException("El dinero no puede ser negativo: {$centimos}");
        }
        if (!preg_match('/^[A-Z]{3}$/', $moneda)) {
            throw new InvalidArgumentException("Moneda no válida: '{$moneda}' (tres letras mayúsculas)");
        }
    }

    public static function euros(float|int $euros, string $moneda = 'EUR'): self
    {
        return new self((int) round($euros * 100), $moneda);
    }

    public function sumar(Dinero $otro): self
    {
        if ($this->moneda !== $otro->moneda) {
            throw new InvalidArgumentException("No se pueden sumar {$this->moneda} y {$otro->moneda}");
        }
        return new self($this->centimos + $otro->centimos, $this->moneda);
    }

    public function multiplicar(float $factor): self
    {
        return new self((int) round($this->centimos * $factor), $this->moneda);
    }

    public function igual(Dinero $otro): bool
    {
        return $this->centimos === $otro->centimos && $this->moneda === $otro->moneda;
    }

    public function __toString(): string
    {
        return number_format($this->centimos / 100, 2, ',', '') . ' ' . $this->moneda;
    }
}

/**
 * Descuento porcentual sobre el subtotal.
 *
 * @complejidad Tiempo O(n) en el número de líneas; espacio O(1).
 * @explicacion Aritmética entera (`intdiv`) para que el resultado en céntimos sea exacto y reproducible.
 * El porcentaje se valida UNA vez, al construir.
 * @alternativas `floor($subtotal * 0.15)`: funciona, pero con floats el 15 % de ciertos importes cae en el
 * céntimo equivocado.
 */
final class DescuentoPorcentaje implements Descuento
{
    public function __construct(private readonly int $porcentaje)
    {
        if ($porcentaje < 0 || $porcentaje > 100) {
            throw new InvalidArgumentException("El porcentaje debe estar entre 0 y 100, no {$porcentaje}");
        }
    }

    public function calcular(array $lineas): int
    {
        $subtotal = array_sum(array_map(static fn(array $l): int => $l['precio'] * $l['cantidad'], $lineas));
        return intdiv($subtotal * $this->porcentaje, 100);
    }
}

/**
 * Descuento de una cantidad fija con tope en el subtotal.
 *
 * @complejidad Tiempo O(n) en el número de líneas; espacio O(1).
 * @explicacion `min()` garantiza que el descuento nunca deje un total negativo, que es la regla de negocio.
 * @alternativas Dejar que el total quede negativo y corregirlo fuera: reparte la regla por todo el código.
 */
final class DescuentoFijo implements Descuento
{
    public function __construct(private readonly int $centimos)
    {
        if ($centimos < 0) {
            throw new InvalidArgumentException('El descuento no puede ser negativo');
        }
    }

    public function calcular(array $lineas): int
    {
        $subtotal = array_sum(array_map(static fn(array $l): int => $l['precio'] * $l['cantidad'], $lineas));
        return min($this->centimos, $subtotal);
    }
}

/**
 * 3x2: de cada tres unidades, una gratis.
 *
 * @complejidad Tiempo O(n) en el número de líneas; espacio O(1).
 * @explicacion `intdiv($cantidad, 3)` son las unidades gratis de la línea; se multiplican por su precio.
 * Cada línea se evalúa por separado (3 camisetas y 2 gorras no hacen un 3x2 mezclado).
 * @alternativas Un bucle que descuente cada tercera unidad: mismo resultado, más código.
 */
final class TresPorDos implements Descuento
{
    public function calcular(array $lineas): int
    {
        $total = 0;
        foreach ($lineas as $linea) {
            $total += intdiv($linea['cantidad'], 3) * $linea['precio'];
        }
        return $total;
    }
}

/**
 * Carrito con descuentos inyectados (Strategy).
 *
 * @complejidad añadir O(1); subtotal y descuento O(n·d) con n líneas y d descuentos; espacio O(n + d).
 * @explicacion El carrito depende de la INTERFAZ `Descuento`, no de clases concretas: añadir un descuento
 * nuevo (2x1, por categoría...) no obliga a tocar el carrito. El tope `min($subtotal, ...)` se aplica a la
 * SUMA de descuentos, no a cada uno, porque es una regla del carrito entero.
 * @alternativas Un `switch` por tipo de descuento dentro de Carrito: cada descuento nuevo modifica la clase
 * (viola abierto/cerrado) y hace imposible probarlos por separado.
 */
final class Carrito
{
    /** @var list<array{nombre: string, precio: int, cantidad: int}> */
    private array $lineas = [];
    /** @var list<Descuento> */
    private array $descuentos = [];

    public function __construct()
    {
    }

    public function añadir(string $nombre, int $precio, int $cantidad = 1): self
    {
        if ($cantidad <= 0) {
            throw new InvalidArgumentException("La cantidad debe ser mayor que cero, no {$cantidad}");
        }
        if ($precio < 0) {
            throw new InvalidArgumentException('El precio no puede ser negativo');
        }
        $this->lineas[] = ['nombre' => $nombre, 'precio' => $precio, 'cantidad' => $cantidad];
        return $this;
    }

    public function aplicar(Descuento $descuento): self
    {
        $this->descuentos[] = $descuento;
        return $this;
    }

    public function subtotal(): int
    {
        return array_sum(array_map(static fn(array $l): int => $l['precio'] * $l['cantidad'], $this->lineas));
    }

    public function descuento(): int
    {
        $suma = array_sum(array_map(fn(Descuento $d): int => $d->calcular($this->lineas), $this->descuentos));
        return min($suma, $this->subtotal());
    }

    public function total(): int
    {
        return $this->subtotal() - $this->descuento();
    }
}

/**
 * Repositorio de usuarios en memoria.
 *
 * @complejidad guardar, buscar y eliminar O(1); todos O(n); espacio O(n).
 * @bigo 1
 * @explicacion Un array PHP es una tabla hash: indexarlo por id da búsqueda O(1) (`$this->usuarios[$id] ?? null`).
 * Reasignar una clave existente conserva su posición, que es justo el "reemplazar" que se pide, y `array_values`
 * en `todos()` devuelve una lista limpia.
 * @alternativas Guardar una lista y recorrerla con `foreach`/`array_search` para buscar: O(n) por consulta, de modo
 * que cargar n usuarios y consultarlos todos cuesta O(n²). Pulsa «Comparar» y verás la diferencia.
 */
final class RepositorioUsuariosEnMemoria implements RepositorioUsuarios
{
    /** @var array<int, Usuario> */
    private array $usuarios = [];

    public function guardar(Usuario $usuario): void
    {
        $this->usuarios[$usuario->id] = $usuario;
    }

    public function buscar(int $id): ?Usuario
    {
        return $this->usuarios[$id] ?? null;
    }

    public function todos(): array
    {
        return array_values($this->usuarios);
    }

    public function eliminar(int $id): bool
    {
        if (!isset($this->usuarios[$id])) {
            return false;
        }
        unset($this->usuarios[$id]);
        return true;
    }
}

/**
 * Contenedor de dependencias con autowiring (Reflection).
 *
 * @complejidad Construir un servicio nuevo: O(p) con p el número de parámetros del grafo de dependencias; pedir
 * uno ya construido: O(1) (singleton en caché).
 * @explicacion `get()` mira si ya existe la instancia, si hay una fábrica registrada o, si no, la construye
 * leyendo el constructor con `ReflectionClass`: cada parámetro con tipo de clase se pide recursivamente al propio
 * contenedor, y los que tienen valor por defecto lo usan. Para detectar ciclos se anota qué ids se están
 * construyendo en ese momento (si vuelve a aparecer uno, es circular) y se quita en `finally`, de modo que el
 * contenedor queda utilizable aunque falle una construcción. Es, en pequeño, lo que hace `app()->make()` en Laravel.
 * @alternativas Construir a mano con `new` en un único sitio ("composition root"): más explícito, pero hay que
 * actualizarlo con cada dependencia nueva. Un contenedor compilado (Symfony) genera ese código por adelantado.
 */
final class Contenedor
{
    /** @var array<string, callable> */
    private array $fabricas = [];
    /** @var array<string, object> */
    private array $instancias = [];
    /** @var array<string, true> */
    private array $enConstruccion = [];

    public function set(string $id, callable $fabrica): void
    {
        $this->fabricas[$id] = $fabrica;
        unset($this->instancias[$id]);
    }

    public function has(string $id): bool
    {
        return isset($this->fabricas[$id]) || (class_exists($id) && (new ReflectionClass($id))->isInstantiable());
    }

    public function get(string $id): object
    {
        if (isset($this->instancias[$id])) {
            return $this->instancias[$id];
        }
        if (isset($this->enConstruccion[$id])) {
            throw new DependenciaCircular('Dependencia circular: ' . implode(' → ', [...array_keys($this->enConstruccion), $id]));
        }
        $this->enConstruccion[$id] = true;
        try {
            $objeto = isset($this->fabricas[$id]) ? ($this->fabricas[$id])($this) : $this->construir($id);
        } finally {
            unset($this->enConstruccion[$id]);
        }
        return $this->instancias[$id] = $objeto;
    }

    private function construir(string $clase): object
    {
        if (!class_exists($clase) && !interface_exists($clase)) {
            throw new ContenedorException("No existe la clase {$clase}");
        }
        $reflejo = new ReflectionClass($clase);
        if (!$reflejo->isInstantiable()) {
            throw new ContenedorException("{$clase} no se puede instanciar (¿interfaz sin registrar con set()?)");
        }
        $constructor = $reflejo->getConstructor();
        if ($constructor === null) {
            return new $clase();
        }
        $argumentos = [];
        foreach ($constructor->getParameters() as $parametro) {
            $tipo = $parametro->getType();
            if ($tipo instanceof ReflectionNamedType && !$tipo->isBuiltin()) {
                $argumentos[] = $this->get($tipo->getName());
            } elseif ($parametro->isDefaultValueAvailable()) {
                $argumentos[] = $parametro->getDefaultValue();
            } else {
                throw new ContenedorException("No puedo resolver el parámetro \${$parametro->getName()} de {$clase}: necesita un tipo de clase o un valor por defecto");
            }
        }
        return $reflejo->newInstanceArgs($argumentos);
    }
}

/**
 * Despachador de eventos (Observer) con prioridades.
 *
 * @complejidad escuchar O(1); despachar O(k log k) con k oyentes del evento (por la ordenación); espacio O(k).
 * @explicacion Cada oyente se guarda con su prioridad y un contador de registro. Al despachar se ordena por
 * prioridad descendente y, a igualdad, por orden de registro (el contador hace el desempate explícito, aunque el
 * `usort` de PHP 8 ya es estable). `=== false` corta la cadena: solo ese valor exacto, no `null` ni `0`, para que
 * un oyente que "no devuelve nada" no frene a los demás por accidente.
 * @alternativas Mantener la lista ordenada al insertar (búsqueda binaria + array_splice): despachar sería O(k),
 * útil si se despacha mucho más de lo que se registra.
 */
final class Despachador
{
    /** @var array<string, list<array{0: int, 1: int, 2: callable}>> */
    private array $oyentes = [];
    private int $contador = 0;

    public function escuchar(string $evento, callable $oyente, int $prioridad = 0): void
    {
        $this->oyentes[$evento][] = [$prioridad, $this->contador++, $oyente];
    }

    public function despachar(string $evento, mixed $datos = null): int
    {
        $lista = $this->oyentes[$evento] ?? [];
        usort($lista, static fn(array $a, array $b): int => [$b[0], $a[1]] <=> [$a[0], $b[1]]);
        $llamados = 0;
        foreach ($lista as [, , $oyente]) {
            $llamados++;
            if ($oyente($datos) === false) {
                break;
            }
        }
        return $llamados;
    }
}
