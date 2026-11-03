import java.util.*;
import java.util.function.*;

/*
 * TEMA 2 · POO A FONDO
 * ────────────────────────────────────────────────────────────────────────────
 * Ya sabes POO. Aquí vemos cómo se escribe "bien" en Java moderno y las ideas que hay detrás de
 * Spring: interfaces como contratos, composición, inyección de dependencias, Strategy, Repository
 * y objetos de valor (records). Al final hay 5 ejercicios con pruebas.
 *
 * Cómo se trabaja:
 *   1. Ctrl+Enter ejecuta el archivo: verás la teoría y las pruebas en «Pendiente».
 *   2. Sustituye los `pendiente();` por tu código y vuelve a ejecutar.
 *   3. Ctrl+S guarda tu copia en practicas/ (este ejemplo no se modifica).
 *   4. Cuando acabes (o te atasques) abre la pestaña «Solución».
 */
class PooAFondo {

    static void titulo(String texto) {
        System.out.println("\n=== " + texto + " ===");
    }

    static RepositorioUsuariosEnMemoria repositorioCon(int n) {
        var r = new RepositorioUsuariosEnMemoria();
        for (int i = 1; i <= n; i++) {
            r.guardar(new Usuario(i, "u" + i));
        }
        return r;
    }

    public static void main(String[] args) {

// ════════════════════════════════════════════════════════════════════════════
// 1. INTERFACES: CONTRATOS, NO HERENCIA
// ════════════════════════════════════════════════════════════════════════════
        // Una interfaz dice QUÉ se puede hacer, no CÓMO. Quien la use depende del contrato y no de una
        // clase concreta (así se pueden cambiar piezas sin tocar el resto).
        titulo("1. Interfaces");

        interface Notificador {
            String enviar(String destino, String mensaje);
        }
        record NotificadorEmail() implements Notificador {
            public String enviar(String destino, String mensaje) {
                return "[email a " + destino + "] " + mensaje;
            }
        }
        record NotificadorSms() implements Notificador {
            public String enviar(String destino, String mensaje) {
                return "[sms a " + destino + "] " + mensaje.substring(0, Math.min(20, mensaje.length()));
            }
        }

        List<Notificador> canales = List.of(new NotificadorEmail(), new NotificadorSms());
        for (Notificador canal : canales) {
            System.out.println(canal.enviar("ana", "Tu pedido ya está en camino"));   // no sabe (ni le importa) qué canal es
        }

// ════════════════════════════════════════════════════════════════════════════
// 2. COMPOSICIÓN FRENTE A HERENCIA
// ════════════════════════════════════════════════════════════════════════════
        // "Un Pedido NO ES un Notificador, un Pedido USA un Notificador."
        // La herencia ata (una sola clase padre, cambios que se propagan). La composición compone piezas
        // pequeñas y se puede cambiar en tiempo de ejecución.
        titulo("2. Composición");

        class Pedido {
            private final List<String> lineas = new ArrayList<>();
            private final String cliente;
            private final Notificador notificador;                // inyectado desde fuera

            Pedido(String cliente, Notificador notificador) {
                this.cliente = cliente;
                this.notificador = notificador;
            }

            Pedido anadir(String producto) {
                lineas.add(producto);
                return this;                                      // interfaz fluida
            }

            String confirmar() {
                return notificador.enviar(cliente, "Pedido confirmado: " + String.join(", ", lineas));
            }
        }

        System.out.println(new Pedido("ana", new NotificadorEmail()).anadir("teclado").anadir("ratón").confirmar());
        System.out.println(new Pedido("luis", new NotificadorSms()).anadir("monitor").confirmar());

// ════════════════════════════════════════════════════════════════════════════
// 3. INYECCIÓN DE DEPENDENCIAS (DI)
// ════════════════════════════════════════════════════════════════════════════
        // Una clase NO crea lo que necesita (`new NotificadorEmail()` dentro de Pedido): se lo dan en el
        // constructor. Ventajas: se puede probar con un doble falso, se cambia la pieza sin tocar la clase
        // y las dependencias quedan a la vista. Un "contenedor" automatiza esto: mira los constructores
        // con reflexión y construye lo que haga falta (es lo que hace Spring con @Autowired).
        // Lo harás en el ejercicio 4.
        titulo("3. Inyección de dependencias");

        class NotificadorFalso implements Notificador {
            final List<String> enviados = new ArrayList<>();

            public String enviar(String destino, String mensaje) {
                String texto = destino + ": " + mensaje;
                enviados.add(texto);
                return texto;
            }
        }

        var falso = new NotificadorFalso();
        new Pedido("test", falso).anadir("x").confirmar();
        System.out.println("El doble de pruebas guardó " + falso.enviados.size() + " mensaje(s) sin enviar nada de verdad");

// ════════════════════════════════════════════════════════════════════════════
// 4. STRATEGY: ALGORITMOS INTERCAMBIABLES
// ════════════════════════════════════════════════════════════════════════════
        // Se mete la parte que varía detrás de una interfaz y se inyecta. En Java, además, una lambda
        // suele bastar si la interfaz tiene un solo método (no hace falta una clase por estrategia).
        titulo("4. Strategy");

        interface Ordenacion {
            List<Integer> ordenar(List<Integer> xs);
        }
        record Ascendente() implements Ordenacion {
            public List<Integer> ordenar(List<Integer> xs) {
                var copia = new ArrayList<>(xs);              // NO ordenamos la lista del llamador: sort modifica
                Collections.sort(copia);
                return copia;
            }
        }
        record Descendente() implements Ordenacion {
            public List<Integer> ordenar(List<Integer> xs) {
                var copia = new ArrayList<>(xs);
                copia.sort(Comparator.reverseOrder());
                return copia;
            }
        }

        for (Ordenacion criterio : List.of(new Ascendente(), new Descendente())) {
            System.out.println(criterio.ordenar(List.of(3, 1, 2)));
        }

        // Misma idea con una lambda (más corto cuando la estrategia es una sola función):
        Comparator<String> porLongitud = (x, y) -> Integer.compare(x.length(), y.length());
        var palabras = new ArrayList<>(List.of("kiwi", "fresa", "pera"));
        palabras.sort(porLongitud);                           // estable: kiwi y pera conservan su orden
        System.out.println(palabras);

// ════════════════════════════════════════════════════════════════════════════
// 5. OBJETOS DE VALOR (VALUE OBJECTS), record Y enum
// ════════════════════════════════════════════════════════════════════════════
        // Un objeto de valor se define por sus datos, no por su identidad, y es INMUTABLE: cualquier
        // "cambio" devuelve un objeto nuevo. Sustituyen a los `int euros` sueltos que no saben validarse
        // ni tienen comportamiento. Un record (Java 16) lo garantiza: campos final, equals y hashCode.
        titulo("5. Value objects");

        record Punto(int x, int y) {
            Punto mover(int dx, int dy) {
                return new Punto(x + dx, y + dy);             // no modifica: devuelve otro
            }

            @Override
            public String toString() {
                return "(" + x + ", " + y + ")";
            }
        }

        var a = new Punto(1, 2);
        var b = a.mover(3, 4);
        System.out.println("a = " + a + ", b = " + b + ", ¿iguales? " + a.equals(b) + " | equals de datos iguales: " + a.equals(new Punto(1, 2)));
        // a.x = 99;  ← no compila: los campos de un record son final (y no hay setters)

        // Los enum son valores con nombre: el sustituto de las "constantes mágicas" y los strings sueltos.
        enum Estado {
            PENDIENTE, ENVIADO;

            String etiqueta() {
                return switch (this) {                        // exhaustivo: si olvidas un caso, no compila
                    case PENDIENTE -> "Esperando";
                    case ENVIADO -> "En camino";
                };
            }
        }
        String desconocido;
        try {
            desconocido = Estado.valueOf("ROTO").etiqueta();
        } catch (IllegalArgumentException e) {
            desconocido = "(valor desconocido)";               // valueOf lanza; no hay tryFrom
        }
        System.out.println(Estado.valueOf("ENVIADO").etiqueta() + " · " + desconocido);

// ════════════════════════════════════════════════════════════════════════════
// 6. REPOSITORY: ESCONDER DÓNDE SE GUARDAN LOS DATOS
// ════════════════════════════════════════════════════════════════════════════
        // El resto de la aplicación habla con una interfaz ("dame el usuario 7") y no sabe si los datos
        // están en una base de datos, en un archivo o en memoria. En las pruebas se usa la versión en
        // memoria; en producción, la de base de datos. Es el patrón detrás de Spring Data / JPA.
        // (Usuario y RepositorioUsuarios están más abajo, con los ejercicios.)
        titulo("6. Repository (ejemplo resuelto con otra entidad)");

        class RepositorioLibrosEnMemoria {
            private final Map<String, String> libros = new HashMap<>();   // isbn → título

            void guardar(String isbn, String titulo) {
                libros.put(isbn, titulo);                     // guardar dos veces el mismo isbn ACTUALIZA
            }

            Optional<String> buscar(String isbn) {
                return Optional.ofNullable(libros.get(isbn)); // get devuelve null si falta: Optional lo hace explícito
            }
        }

        var repo = new RepositorioLibrosEnMemoria();
        repo.guardar("111", "Clean Code");
        repo.guardar("111", "Clean Code (2.ª ed.)");
        System.out.println(repo.buscar("111").orElse("?") + " | " + repo.buscar("999").orElse("(no existe)"));

// ════════════════════════════════════════════════════════════════════════════
// 7. EXCEPCIONES PROPIAS
// ════════════════════════════════════════════════════════════════════════════
        // Se crean clases con nombre propio para poder capturar lo que te interesa y nada más. Si extienden
        // RuntimeException son "no comprobadas" (no hace falta `throws`); si extienden Exception, el
        // compilador obliga a tratarlas: úsalo solo cuando el llamador pueda hacer algo razonable.
        titulo("7. Excepciones");

        class StockInsuficiente extends RuntimeException {
            StockInsuficiente(String producto, int pedido, int hay) {
                super("No hay stock de " + producto + ": pides " + pedido + " y quedan " + hay);
            }
        }

        try {
            throw new StockInsuficiente("teclado", 5, 2);
        } catch (IllegalArgumentException e) {
            System.out.println("no entra aquí");
        } catch (StockInsuficiente | IllegalStateException e) {   // varios tipos con |
            System.out.println(e.getClass().getSimpleName() + ": " + e.getMessage());
        } finally {
            System.out.println("finally se ejecuta siempre");
        }

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS (no hace falta tocarlas)
// ════════════════════════════════════════════════════════════════════════════

        grupo("Dinero");
        comprueba("euros(12.5) son 1250 céntimos", () -> Dinero.euros(12.5).centimos(), 1250);
        comprueba("euros(0.1 + 0.2) redondea a 30 céntimos", () -> Dinero.euros(0.1 + 0.2).centimos(), 30);
        comprueba("sumar da un Dinero nuevo", () -> Dinero.euros(1).sumar(Dinero.euros(2.5)).centimos(), 350);
        comprueba("sumar no modifica el original", () -> {
            var d = Dinero.euros(1);
            d.sumar(Dinero.euros(1));
            return d.centimos();
        }, 100);
        comprueba("multiplicar redondea", () -> new Dinero(1999).multiplicar(1.5).centimos(), 2999);
        comprueba("igual compara importe y moneda", () -> Dinero.euros(3).igual(new Dinero(300)) && !Dinero.euros(3).igual(new Dinero(300, "USD")), true);
        comprueba("se imprime con coma decimal", () -> Dinero.euros(12.5).toString(), "12,50 EUR");
        comprueba("se imprime con dos decimales", () -> new Dinero(5, "USD").toString(), "0,05 USD");
        lanza("importe negativo", () -> new Dinero(-1), IllegalArgumentException.class);
        lanza("moneda inválida", () -> new Dinero(1, "euro"), IllegalArgumentException.class);
        lanza("sumar monedas distintas", () -> Dinero.euros(1).sumar(new Dinero(100, "USD")), IllegalArgumentException.class);

        List<Linea> lineas = List.of(new Linea("camiseta", 1000, 3), new Linea("gorra", 500, 2));   // subtotal 4000

        grupo("DescuentoPorcentaje");
        comprueba("15 % de 1999", () -> new DescuentoPorcentaje(15).calcular(List.of(new Linea("x", 1999, 1))), 299);
        comprueba("20 % de 4000", () -> new DescuentoPorcentaje(20).calcular(lineas), 800);
        lanza("porcentaje mayor que 100", () -> new DescuentoPorcentaje(101), IllegalArgumentException.class);

        grupo("DescuentoFijo");
        comprueba("resta la cantidad fija", () -> new DescuentoFijo(300).calcular(lineas), 300);
        comprueba("nunca pasa del subtotal", () -> new DescuentoFijo(9999).calcular(lineas), 4000);

        grupo("TresPorDos");
        comprueba("3 camisetas: una gratis", () -> new TresPorDos().calcular(List.of(new Linea("c", 1000, 3))), 1000);
        comprueba("7 unidades: dos gratis", () -> new TresPorDos().calcular(List.of(new Linea("c", 100, 7))), 200);
        comprueba("menos de 3 unidades: nada", () -> new TresPorDos().calcular(List.of(new Linea("c", 100, 2))), 0);

        grupo("Carrito");
        comprueba("subtotal", () -> new Carrito().anadir("camiseta", 1000, 3).anadir("gorra", 500, 2).subtotal(), 4000);
        comprueba("sin descuentos el total es el subtotal", () -> new Carrito().anadir("gorra", 500).total(), 500);
        comprueba("acumula descuentos", () -> new Carrito().anadir("camiseta", 1000, 3).aplicar(new TresPorDos()).aplicar(new DescuentoFijo(500)).total(), 1500);
        comprueba("el descuento nunca supera el subtotal", () -> new Carrito().anadir("gorra", 500).aplicar(new DescuentoFijo(400)).aplicar(new DescuentoFijo(400)).total(), 0);
        lanza("cantidad cero", () -> new Carrito().anadir("gorra", 500, 0), IllegalArgumentException.class);

        grupo("RepositorioUsuariosEnMemoria");
        comprueba("guardar y buscar", () -> {
            var r = new RepositorioUsuariosEnMemoria();
            r.guardar(new Usuario(1, "Ana"));
            return r.buscar(1).nombre();
        }, "Ana");
        comprueba("buscar lo que no existe da null", () -> new RepositorioUsuariosEnMemoria().buscar(7), null);
        comprueba("guardar el mismo id reemplaza sin duplicar", () -> {
            var r = new RepositorioUsuariosEnMemoria();
            r.guardar(new Usuario(1, "Ana"));
            r.guardar(new Usuario(2, "Luis"));
            r.guardar(new Usuario(1, "Ana María"));
            return r.todos().stream().map(Usuario::nombre).toList();
        }, List.of("Ana María", "Luis"));
        comprueba("eliminar devuelve si existía", () -> {
            var r = new RepositorioUsuariosEnMemoria();
            r.guardar(new Usuario(1, "Ana"));
            return Arrays.asList(r.eliminar(1), r.eliminar(1), r.buscar(1));
        }, Arrays.asList(true, false, null));
        comprueba("todos() sigue en orden tras eliminar", () -> {
            var r = new RepositorioUsuariosEnMemoria();
            for (int i = 1; i <= 3; i++) {
                r.guardar(new Usuario(i, "u" + i));
            }
            r.eliminar(2);
            return r.todos().stream().map(Usuario::nombre).toList();
        }, List.of("u1", "u3"));

        grupo("Contenedor");
        comprueba("autowiring de una clase sin dependencias", () -> new Contenedor().get(Motor.class) instanceof Motor, true);
        comprueba("autowiring recursivo eligiendo el constructor resoluble", () -> {
            var coche = new Contenedor().get(Coche.class);
            return List.of(coche instanceof Coche, coche.motor() instanceof Motor, coche.plazas());
        }, List.of(true, true, 5));
        comprueba("devuelve siempre la misma instancia", () -> {
            var c = new Contenedor();
            return c.get(Motor.class) == c.get(Motor.class);
        }, true);
        comprueba("las dependencias compartidas son la misma instancia", () -> {
            var t = new Contenedor().get(Taller.class);
            return t.coche().motor() == t.repuesto();
        }, true);
        comprueba("set() enlaza una interfaz con una implementación", () -> {
            var c = new Contenedor();
            c.set(Reloj.class, cont -> new RelojFijo());
            return c.get(Agenda.class).reloj().ahora();
        }, "2025-01-01");
        comprueba("la fábrica recibe el contenedor", () -> {
            var c = new Contenedor();
            c.set("motor.extra", cont -> cont.get(Motor.class));
            return c.get("motor.extra") == c.get(Motor.class);
        }, true);
        comprueba("has()", () -> {
            var c = new Contenedor();
            c.set("x", cont -> new Motor());
            return List.of(c.has("x"), c.has(Motor.class), c.has(Reloj.class), c.has("NoExiste"));
        }, List.of(true, true, false, false));
        lanza("interfaz sin registrar", () -> new Contenedor().get(Reloj.class), ContenedorException.class);
        lanza("clase inexistente", () -> new Contenedor().get("NoExiste"), ContenedorException.class);
        lanza("parámetro que no es una clase inyectable", () -> new Contenedor().get(SinTipo.class), ContenedorException.class);
        lanza("dependencia circular", () -> new Contenedor().get(CicloA.class), DependenciaCircular.class);

        grupo("Despachador");
        comprueba("despacha a los oyentes con los datos", () -> {
            var d = new Despachador();
            List<Object> visto = new ArrayList<>();
            d.escuchar("alta", datos -> visto.add(datos));
            int n = d.despachar("alta", "ana");
            return List.of(n, visto);
        }, List.of(1, List.of("ana")));
        comprueba("evento sin oyentes", () -> new Despachador().despachar("nada"), 0);
        comprueba("mayor prioridad primero; a igual prioridad, orden de registro", () -> {
            var d = new Despachador();
            List<String> orden = new ArrayList<>();
            d.escuchar("e", datos -> orden.add("b"));
            d.escuchar("e", datos -> orden.add("alta"), 10);
            d.escuchar("e", datos -> orden.add("c"));
            d.despachar("e");
            return orden;
        }, List.of("alta", "b", "c"));
        comprueba("devolver false corta la cadena", () -> {
            var d = new Despachador();
            int[] llamados = {0};
            d.escuchar("e", datos -> {
                llamados[0]++;
                return false;
            }, 5);
            d.escuchar("e", datos -> {
                llamados[0]++;
                return null;
            });
            return List.of(d.despachar("e"), llamados[0]);
        }, List.of(1, 1));
        comprueba("los eventos no se mezclan", () -> {
            var d = new Despachador();
            d.escuchar("a", datos -> null);
            return d.despachar("b");
        }, 0);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        // Cuánto cuesta buscar un usuario según el tamaño del repositorio (O(1) si guardas por id en un mapa).
        medir("RepositorioUsuariosEnMemoria", n -> repositorioCon(n), r -> r.buscar(1));
    }
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════
// Sustituye cada `pendiente();` por tu código. Mantén las firmas: las pruebas las usan.

// ── Ejercicio 1 · Dinero (objeto de valor) ──────────────────────────────────
/**
 * Dinero en céntimos para no arrastrar errores de coma flotante (0.1 + 0.2 != 0.3).
 *  - Es INMUTABLE (record): sumar, multiplicar... devuelven un Dinero nuevo.
 *  - `new Dinero(-1)` lanza IllegalArgumentException (no hay dinero negativo).
 *  - La moneda son tres letras mayúsculas ("EUR", "USD"); si no, IllegalArgumentException.
 *  - `euros(12.5)` crea 1250 céntimos (redondea: euros(0.1 + 0.2) son 30 céntimos).
 *  - `sumar` con monedas distintas lanza IllegalArgumentException.
 *  - `multiplicar(1.5)` redondea al céntimo más cercano.
 *  - `toString()`: "12,50 EUR" (coma decimal, siempre dos decimales). Cuidado: String.format usa el
 *    separador del idioma del sistema; construye el texto con cuidado o fija el Locale.
 * Alternativa ingenua: guardar un double de euros; acumula errores de redondeo y admite negativos.
 */
record Dinero(int centimos, String moneda) {
    Dinero {
        pendiente();
    }

    /** Atajo: moneda por defecto, EUR (Java no tiene parámetros por defecto: se sobrecarga). */
    Dinero(int centimos) {
        this(centimos, "EUR");
    }

    static Dinero euros(double euros, String moneda) {
        return pendiente();
    }

    static Dinero euros(double euros) {
        return euros(euros, "EUR");
    }

    Dinero sumar(Dinero otro) {
        return pendiente();
    }

    Dinero multiplicar(double factor) {
        return pendiente();
    }

    boolean igual(Dinero otro) {
        return pendiente();
    }

    @Override
    public String toString() {
        return pendiente();
    }
}

// ── Ejercicio 2 · Carrito con descuentos (Strategy) ─────────────────────────
/** Una "línea" del carrito: nombre, precio unitario en céntimos y cantidad. */
record Linea(String nombre, int precio, int cantidad) {
}

interface Descuento {
    /** Céntimos que se descuentan de un carrito. */
    int calcular(List<Linea> lineas);
}

/**
 * Descuento por porcentaje sobre el subtotal (entero, redondeando hacia abajo):
 * 15 % de 1999 céntimos = 299. Un porcentaje fuera de 0..100 lanza IllegalArgumentException.
 * Con enteros: subtotal * porcentaje / 100 (no pases por double).
 */
record DescuentoPorcentaje(int porcentaje) implements Descuento {
    DescuentoPorcentaje {
        pendiente();
    }

    @Override
    public int calcular(List<Linea> lineas) {
        return pendiente();
    }
}

/** Descuento de una cantidad fija, que nunca puede superar el subtotal. */
record DescuentoFijo(int centimos) implements Descuento {
    DescuentoFijo {
        pendiente();
    }

    @Override
    public int calcular(List<Linea> lineas) {
        return pendiente();
    }
}

/** 3x2 en cada línea: de cada 3 unidades, una es gratis (6 unidades → 2 gratis). */
final class TresPorDos implements Descuento {
    @Override
    public int calcular(List<Linea> lineas) {
        return pendiente();
    }
}

/**
 * El carrito NO sabe qué descuentos existen: los recibe (inyección) y se limita a sumarlos.
 *  - anadir() acepta cantidad > 0 (si no, IllegalArgumentException) y devuelve this.
 *  - subtotal(): suma de precio × cantidad.
 *  - descuento(): suma de todos los descuentos aplicados, sin pasar nunca del subtotal.
 *  - total(): subtotal − descuento.
 */
final class Carrito {
    private final List<Linea> lineas = new ArrayList<>();
    private final List<Descuento> descuentos = new ArrayList<>();

    Carrito anadir(String nombre, int precio, int cantidad) {
        return pendiente();
    }

    /** Sobrecarga en lugar de parámetro por defecto: cantidad 1. */
    Carrito anadir(String nombre, int precio) {
        return anadir(nombre, precio, 1);
    }

    Carrito aplicar(Descuento descuento) {
        return pendiente();
    }

    int subtotal() {
        return pendiente();
    }

    int descuento() {
        return pendiente();
    }

    int total() {
        return pendiente();
    }
}

// ── Ejercicio 3 · Repositorio en memoria ────────────────────────────────────
record Usuario(int id, String nombre) {
}

interface RepositorioUsuarios {
    void guardar(Usuario usuario);

    /** El usuario, o null si no existe. */
    Usuario buscar(int id);

    /** En el orden en que se guardaron por primera vez. */
    List<Usuario> todos();

    /** true si existía y se borró. */
    boolean eliminar(int id);
}

/**
 * Implementa RepositorioUsuarios guardando los usuarios en un mapa indexado por id:
 *  - guardar() inserta o REEMPLAZA (mismo id) sin cambiar su posición (LinkedHashMap, no HashMap).
 *  - buscar() es O(1) (nada de recorrer una lista) y devuelve null si no existe.
 *  - todos() devuelve una lista nueva en orden de primera inserción.
 *  - eliminar() devuelve true si existía.
 * Alternativa ingenua: una List<Usuario> y recorrerla para buscar por id: O(n) por búsqueda.
 */
final class RepositorioUsuariosEnMemoria implements RepositorioUsuarios {
    private final Map<Integer, Usuario> usuarios = new LinkedHashMap<>();

    @Override
    public void guardar(Usuario usuario) {
        pendiente();
    }

    @Override
    public Usuario buscar(int id) {
        return pendiente();
    }

    @Override
    public List<Usuario> todos() {
        return pendiente();
    }

    @Override
    public boolean eliminar(int id) {
        return pendiente();
    }
}

// ── Ejercicio 4 · Mini contenedor de inyección de dependencias ──────────────
/** Se lanza cuando el contenedor no puede construir algo (clase inexistente, interfaz sin registrar, parámetro no inyectable...). */
class ContenedorException extends RuntimeException {
    ContenedorException(String mensaje) {
        super(mensaje);
    }
}

/** Dependencia circular: A necesita B y B necesita A. */
final class DependenciaCircular extends ContenedorException {
    DependenciaCircular(String mensaje) {
        super(mensaje);
    }
}

/**
 * Un contenedor como el de Spring, en pequeño:
 *  - set(id, c -> ...) registra cómo construir algo (la fábrica recibe el contenedor). El id puede ser
 *    un nombre (String) o una clase/interfaz (Class).
 *  - get(id) devuelve SIEMPRE la misma instancia (singleton) y construye con AUTOWIRING si es una clase
 *    no registrada: mira sus constructores con reflexión (getDeclaredConstructors) y elige el que tenga
 *    más parámetros cuyos tipos sean TODOS inyectables (clases propias, no primitivos, String ni java.*).
 *    Java no tiene parámetros por defecto: una clase ofrece varios constructores y se usa el más completo
 *    que se pueda resolver. Cada parámetro se pide recursivamente al propio contenedor.
 *  - get(String) de un nombre no registrado intenta cargarlo como nombre de clase (Class.forName);
 *    si no existe, ContenedorException.
 *  - has(id): true si está registrado o es una clase instanciable (no interfaz ni abstracta).
 *  - Una interfaz sin registrar es ContenedorException. Un ciclo, DependenciaCircular.
 */
final class Contenedor {
    private final Map<String, Function<Contenedor, Object>> fabricas = new HashMap<>();
    private final Map<String, Object> instancias = new HashMap<>();
    private final Set<String> enConstruccion = new HashSet<>();

    <T> void set(Class<T> tipo, Function<Contenedor, ? extends T> fabrica) {
        pendiente();
    }

    void set(String id, Function<Contenedor, Object> fabrica) {
        pendiente();
    }

    boolean has(Class<?> tipo) {
        return pendiente();
    }

    boolean has(String id) {
        return pendiente();
    }

    @SuppressWarnings("unchecked")
    <T> T get(Class<T> tipo) {
        return pendiente();
    }

    Object get(String id) {
        return pendiente();
    }
}

// Clases de apoyo para las pruebas del contenedor (no hay que tocarlas)
final class Motor {
}

record Coche(Motor motor, int plazas) {
    /** Constructor "corto": Java no tiene valores por defecto, así que se ofrece otro constructor. */
    Coche(Motor motor) {
        this(motor, 5);
    }
}

record Taller(Coche coche, Motor repuesto) {
}

interface Reloj {
    String ahora();
}

final class RelojFijo implements Reloj {
    @Override
    public String ahora() {
        return "2025-01-01";
    }
}

record Agenda(Reloj reloj) {
}

record CicloA(CicloB b) {
}

record CicloB(CicloA a) {
}

/** Su único constructor pide un String: no es una dependencia que el contenedor sepa resolver. */
final class SinTipo {
    SinTipo(String cosa) {
    }
}

// ── Ejercicio 5 · Despachador de eventos (patrón Observer) ──────────────────
/**
 * Los "oyentes" se registran para un evento y se llaman cuando alguien lo despacha.
 *  - escuchar(evento, oyente, prioridad): mayor prioridad se ejecuta antes; con igual prioridad, por orden
 *    de registro. La sobrecarga sin prioridad usa 0. El oyente es una Function<Object, Object>.
 *  - despachar(evento, datos): llama a cada oyente con datos y devuelve cuántos se ejecutaron. Un evento sin
 *    oyentes devuelve 0. Si un oyente devuelve EXACTAMENTE Boolean.FALSE, se corta la cadena (cuenta ese
 *    oyente pero no los siguientes). despachar(evento) pasa null como datos.
 */
final class Despachador {
    void escuchar(String evento, Function<Object, Object> oyente, int prioridad) {
        pendiente();
    }

    void escuchar(String evento, Function<Object, Object> oyente) {
        escuchar(evento, oyente, 0);
    }

    int despachar(String evento, Object datos) {
        return pendiente();
    }

    int despachar(String evento) {
        return despachar(evento, null);
    }
}
