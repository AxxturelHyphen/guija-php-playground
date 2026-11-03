import java.util.*;
import java.util.function.*;
import java.util.stream.*;

/*
 * Java moderno esencial (JDK 17-21), sección a sección.
 * Ejecuta con Ctrl+Enter en el playground. Toca cosas, rómpelas y vuelve a ejecutar: así se aprende.
 *
 * Si vienes de Java 8 o 11, esto es lo que cambió: var, text blocks, records, sealed, switch con flechas,
 * pattern matching, colecciones inmutables y sequenced collections. En cada apartado va la diferencia con
 * "el Java de siempre" y la trampa típica.
 */
class JavaModerno {

    static void titulo(String texto) {
        System.out.println("\n=== " + texto + " ===");
    }

    public static void main(String[] args) {

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("1. Variables, var y primitivos frente a wrappers");
        // var infiere el tipo en tiempo de compilación (sigue siendo tipado estático, no es "dynamic")
        var edad = 30;                    // int
        var nombre = "Ana";               // String
        var precio = 9.99;                // double
        var activo = true;                // boolean
        System.out.println(edad + " " + nombre + " " + precio + " " + activo);
        // var solo vale en variables locales: no en campos, parámetros ni retornos.
        // Los primitivos (int) viven en la pila y no son null; los wrappers (Integer) son objetos y pueden ser null.
        Integer sinValor = null;
        try {
            int roto = sinValor;          // auto-unboxing de null → NullPointerException
            System.out.println(roto);
        } catch (NullPointerException e) {
            System.out.println("NPE al desempaquetar un Integer null");
        }
        // Desbordamiento silencioso: int da la vuelta sin avisar. Math.addExact sí lanza excepción.
        int maximo = Integer.MAX_VALUE;
        System.out.println("MAX + 1 = " + (maximo + 1));
        try {
            Math.addExact(maximo, 1);
        } catch (ArithmeticException e) {
            System.out.println("addExact: " + e.getMessage());
        }
        final int MAX_INTENTOS = 3;       // final = no se reasigna (las constantes de clase son static final)
        System.out.println("MAX_INTENTOS = " + MAX_INTENTOS);

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("2. Strings, StringBuilder y text blocks");
        // String es inmutable: cada + crea un String nuevo. En un bucle, usa StringBuilder (O(n) en vez de O(n²)).
        var sb = new StringBuilder();
        for (int i = 1; i <= 3; i++) {
            sb.append(i).append(',');
        }
        sb.setLength(sb.length() - 1);    // quita la última coma
        System.out.println(sb);
        System.out.println("%s cuesta %.2f €".formatted("El café", precio));   // String.format en forma de método
        System.out.println("hola".toUpperCase() + " " + "backend".contains("end") + " " + "  ab ".strip() + "|" + "ab".repeat(3));
        System.out.println("   ".isBlank() + " " + "".isEmpty());             // isBlank (Java 11) ignora espacios; isEmpty no
        // length() cuenta unidades UTF-16, no caracteres: un emoji ocupa 2.
        String emoji = "a😀";
        System.out.println(emoji.length() + " unidades, " + emoji.codePointCount(0, emoji.length()) + " caracteres");
        System.out.println(emoji.codePoints().mapToObj(Character::toString).collect(Collectors.joining("|")));
        // Text block (Java 15): varias líneas sin concatenar ni \n; la indentación común se recorta.
        String json = """
            {
              "nombre": "Ana",
              "edad": 30
            }
            """;
        System.out.print(json);

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("3. Colecciones: List, Map, Set");
        List<String> lenguajes = new ArrayList<>(List.of("Java", "PHP"));
        lenguajes.add("Go");              // añadir al final: O(1) amortizado
        System.out.println(lenguajes.size() + " elementos, el primero es " + lenguajes.get(0));
        // List.of crea una lista INMUTABLE: añadir lanza UnsupportedOperationException (y no admite null)
        List<Integer> fija = List.of(1, 2, 3);
        try {
            fija.add(4);
        } catch (UnsupportedOperationException e) {
            System.out.println("List.of es inmutable");
        }
        // HashMap no garantiza orden; LinkedHashMap conserva el de inserción; TreeMap ordena por clave (O(log n))
        Map<String, Integer> edades = new LinkedHashMap<>();
        edades.put("Ana", 30);
        edades.put("Luis", 25);
        edades.put("Marta", 41);
        System.out.println("Luis tiene " + edades.get("Luis") + " | Pepe: " + edades.getOrDefault("Pepe", -1) + " | containsKey: " + edades.containsKey("Pepe"));
        for (var e : edades.entrySet()) {
            System.out.println("  " + e.getKey() + ": " + e.getValue());
        }
        System.out.println(new TreeMap<>(Map.of("b", 2, "a", 1, "c", 3)));     // ordenado por clave
        Map<Character, Integer> veces = new TreeMap<>();
        for (char c : "banana".toCharArray()) {
            veces.merge(c, 1, Integer::sum);        // contar con merge
        }
        System.out.println(veces);
        // Streams: map / filter / reduce. Ojo: .toList() (Java 16) es inmutable; Collectors.toList() no lo garantiza.
        var numeros = List.of(1, 2, 3, 4, 5, 6);
        var paresAlCuadrado = numeros.stream().filter(n -> n % 2 == 0).map(n -> n * n).toList();
        System.out.println(paresAlCuadrado + " | suma " + numeros.stream().mapToInt(Integer::intValue).sum());
        // Una lista es una REFERENCIA: dos variables apuntan a la misma. Para copiar: new ArrayList<>(a) o List.copyOf.
        var a = new ArrayList<>(List.of(1, 2, 3));
        var b = a;
        b.add(4);
        System.out.println("a tiene " + a.size() + " (b es la misma lista)");
        var desordenado = new ArrayList<>(List.of(3, 1, 2));
        Collections.sort(desordenado);               // modifica la lista (estable, O(n log n))
        lenguajes.sort(Comparator.comparingInt(String::length).thenComparing(Comparator.naturalOrder()));
        System.out.println(desordenado + " " + lenguajes);

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("4. Métodos: sobrecarga y varargs");
        // Java SÍ tiene sobrecarga: mismo nombre, distintos parámetros (el compilador elige según los tipos estáticos).
        System.out.println(sumar(2, 3) + " " + sumar(2.5, 3) + " " + sumar("2", 3));
        System.out.println(total(1, 2, 3) + " " + total(new int[] {4, 5}) + " " + total());   // varargs = array
        // La sobrecarga se decide en compilación: el tipo declarado manda, no el real.
        Object o = "texto";
        System.out.println(describir(o) + " | " + describir("texto") + " | " + describir(7));
        // Los argumentos se pasan por valor: del objeto se copia la referencia. Reasignar dentro no afecta a fuera.
        int original = 1;
        incrementarInutil(original);
        System.out.println("original sigue valiendo " + original);

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("5. Lambdas e interfaces funcionales");
        Function<Integer, Integer> doble = x -> x * 2;
        BiFunction<Integer, Integer, Integer> mult = (x, y) -> x * y;
        Supplier<String> saludo = () -> "hola";
        Predicate<String> vacio = String::isEmpty;       // referencia a método
        UnaryOperator<String> mayus = String::toUpperCase;
        System.out.println(doble.apply(21) + " " + mult.apply(6, 7) + " " + saludo.get() + " " + vacio.negate().test("x") + " " + mayus.apply("abc"));
        System.out.println(doble.andThen(x -> x + 1).apply(5) + " (andThen)");
        // Una lambda solo captura variables "effectively final": no puedes hacer contador++ dentro.
        int factor = 3;
        Function<Integer, Integer> porFactor = x -> x * factor;
        System.out.println(porFactor.apply(5));
        // factor = 4;  ← descomentarlo rompe la compilación de la lambda de arriba
        // Si necesitas mutar algo capturado, usa un objeto contenedor (AtomicInteger, array de 1 elemento...).
        var contador = new int[] {0};
        Runnable incrementar = () -> contador[0]++;
        incrementar.run();
        incrementar.run();
        System.out.println("contador = " + contador[0]);

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("6. Clases y records");
        record Punto(int x, int y) {                     // campos finales, constructor, getters, equals, hashCode y toString
            Punto {                                      // constructor compacto: validar sin repetir asignaciones
                if (x < 0) {
                    throw new IllegalArgumentException("x negativa");
                }
            }

            Punto conX(int nuevaX) {                     // "wither": devuelve una copia
                return new Punto(nuevaX, y);
            }
        }
        var p1 = new Punto(1, 2);
        var p2 = p1.conX(10);
        System.out.println("p1 = " + p1 + ", p2 = " + p2 + ", x de p2 = " + p2.x());
        System.out.println("equals: " + p1.equals(new Punto(1, 2)) + " | == entre objetos: " + (p1 == new Punto(1, 2)));
        var cuenta = new Cuenta("Ana");
        cuenta.ingresar(100).ingresar(50.5);             // interfaz fluida: devuelve this
        System.out.println(cuenta + " | creadas: " + Cuenta.creadas());
        try {
            cuenta.ingresar(-5);
        } catch (IllegalArgumentException e) {
            System.out.println("IllegalArgumentException: " + e.getMessage());
        }

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("7. Interfaces, sealed y default methods");
        // sealed: lista cerrada de implementaciones permitidas. El compilador sabe que no hay más.
        // (Figura, Circulo y Rectangulo están al final del archivo: sealed no se admite en tipos locales)
        List<Figura> figuras = List.of(new Circulo(2), new Rectangulo(3, 4));
        for (var f : figuras) {
            System.out.println(f.describir());
        }
        // Con sealed, el switch no necesita default: si añades un tipo y olvidas un caso, NO compila.
        for (var f : figuras) {
            String nombreFigura = switch (f) {
                case Circulo c -> "círculo de radio " + c.radio();
                case Rectangulo r -> "rectángulo " + r.ancho() + "x" + r.alto();
            };
            System.out.println(nombreFigura);
        }

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("8. Enums y switch como expresión");
        enum Estado {
            BORRADOR("En borrador"), PUBLICADO("Publicado");

            private final String etiqueta;

            Estado(String etiqueta) {
                this.etiqueta = etiqueta;
            }

            String etiqueta() {
                return etiqueta;
            }
        }
        var estado = Estado.valueOf("PUBLICADO");
        // switch con flechas: devuelve valor, no hace fall-through y no necesita break
        int prioridad = switch (estado) {
            case BORRADOR -> 1;
            case PUBLICADO -> 2;
        };
        System.out.println(estado.name() + " → " + estado.etiqueta() + " (prioridad " + prioridad + ") de " + Estado.values().length + " casos");
        try {
            Estado.valueOf("NO_EXISTE");     // valueOf lanza IllegalArgumentException (no hay tryFrom)
        } catch (IllegalArgumentException e) {
            System.out.println("valueOf lanza: " + e.getMessage());
        }
        // EnumMap y EnumSet son arrays por dentro: más rápidos que HashMap/HashSet para claves enum.
        var porEstado = new EnumMap<Estado, Integer>(Estado.class);
        porEstado.put(Estado.PUBLICADO, 3);
        System.out.println(porEstado);

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("9. == frente a equals (¡importante!)");
        // == con objetos compara IDENTIDAD (la misma referencia); equals compara contenido.
        String s1 = "hola";
        String s2 = new String("hola");
        System.out.println("== " + (s1 == s2) + " | equals " + s1.equals(s2));     // false | true
        // Con wrappers pasa algo peor: Integer cachea de -128 a 127, así que == "funciona"... hasta que deja de hacerlo.
        Integer c1 = 127, c2 = 127, g1 = 1000, g2 = 1000;
        System.out.println("127 == 127: " + (c1 == c2) + " | 1000 == 1000: " + (g1 == g2) + " | equals: " + g1.equals(g2));
        // Para comparar valores usa equals (o Objects.equals si puede haber null). En switch de String se usa equals.
        System.out.println(Objects.equals(null, null) + " " + Objects.equals("a", null));
        // Si sobrescribes equals, sobrescribe hashCode: si no, el objeto se pierde en un HashMap/HashSet.
        System.out.println(new Punto(1, 2).hashCode() == new Punto(1, 2).hashCode());   // el record ya lo hace por ti

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("10. Nulls y Optional");
        // Optional es para valores de RETORNO que pueden faltar. No lo uses en campos ni parámetros.
        Map<String, String> usuario = new HashMap<>();
        usuario.put("nombre", "Ana");
        Optional<String> ciudad = Optional.ofNullable(usuario.get("ciudad"));
        System.out.println(ciudad.orElse("sin ciudad") + " | " + ciudad.isPresent() + " | " + ciudad.map(String::toUpperCase));
        System.out.println(Optional.of("madrid").map(String::toUpperCase).filter(t -> t.startsWith("M")).orElseThrow());
        // orElse evalúa SIEMPRE su argumento; orElseGet solo si hace falta (úsalo con cálculos caros).
        System.out.println(ciudad.orElseGet(() -> "calculado solo si falta"));
        // Optional.get() sin comprobar lanza NoSuchElementException: usa orElseThrow() para dejarlo explícito.
        // Map.computeIfAbsent / getOrDefault evitan el "if (get(k) == null)" de toda la vida.
        usuario.computeIfAbsent("modo", k -> "dev");
        System.out.println("modo = " + usuario.get("modo"));
        // Objects.requireNonNull falla pronto, con mensaje claro, en vez de un NPE lejano.
        try {
            Objects.requireNonNull(null, "el nombre es obligatorio");
        } catch (NullPointerException e) {
            System.out.println("NPE: " + e.getMessage());
        }

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("11. Excepciones comprobadas y no comprobadas");
        // Checked (Exception): el compilador te obliga a capturar o declarar con throws. Unchecked (RuntimeException): no.
        try {
            retirar(cuenta, 1000);
        } catch (SaldoInsuficiente e) {                      // comprobada: hay que tratarla
            System.out.println("Error: " + e.getMessage() + " (falta " + e.falta() + ")");
        } catch (IllegalArgumentException | IllegalStateException e) {   // multi-catch
            System.out.println("Otro error: " + e.getMessage());
        } finally {
            System.out.println("finally se ejecuta siempre");
        }
        // try-with-resources: cierra solo lo que implemente AutoCloseable, aunque haya excepción.
        try (var recurso = new Recurso("conexión")) {
            System.out.println("usando " + recurso.nombre());
            throw new IllegalStateException("fallo dentro");
        } catch (IllegalStateException e) {
            System.out.println("capturada tras cerrar: " + e.getMessage());
        }
        // Las lambdas no pueden lanzar checked exceptions de las interfaces estándar: se envuelven en una unchecked.

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("12. Genéricos");
        // Los genéricos se borran en compilación (type erasure): en ejecución una List<String> es solo una List.
        Caja<String> caja = new Caja<>("hola");
        System.out.println(caja.valor() + " " + caja.map(String::length).valor() + " | mayor: " + mayor(3, 9) + " " + mayor("pera", "manzana"));
        // List<Integer> NO es una List<Number> (invariancia). Con comodines: ? extends T para leer, ? super T para escribir.
        List<Integer> enteros = List.of(1, 2, 3);
        System.out.println("suma " + sumaTodo(enteros));
        // No se puede hacer new T(), ni new T[n], ni instanceof List<String>: por el borrado.
        // Tampoco hay genéricos con primitivos: List<int> no existe; se usa List<Integer> (con auto-boxing).

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("13. Pattern matching y record patterns");
        Object[] cosas = {42, "texto", 3.5, new Punto(1, 2), List.of(1, 2), null};
        for (Object cosa : cosas) {
            System.out.println(clasificar(cosa));
        }
        // instanceof con patrón: comprueba y castea de una vez (adiós al cast manual).
        Object dato = "Hola";
        if (dato instanceof String texto && texto.length() > 3) {
            System.out.println(texto.toUpperCase());
        }
        // Record pattern (Java 21): desestructura el record dentro del propio patrón.
        Object forma = new Rectangulo(3, 4);
        if (forma instanceof Rectangulo(double ancho, double alto)) {
            System.out.println("área = " + ancho * alto);
        }

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("14. Sequenced collections (Java 21)");
        // List, Deque, LinkedHashSet y LinkedHashMap comparten ahora getFirst/getLast/reversed.
        var cola = new ArrayList<>(List.of("a", "b", "c"));
        System.out.println(cola.getFirst() + " " + cola.getLast() + " " + cola.reversed());
        cola.addFirst("z");                // antes: add(0, x), O(n) en ArrayList
        cola.removeLast();
        System.out.println(cola);
        var ordenado = new LinkedHashMap<String, Integer>();
        ordenado.put("x", 1);
        ordenado.put("y", 2);
        System.out.println(ordenado.firstEntry() + " " + ordenado.lastEntry() + " " + ordenado.reversed());
        // List.of(...).getFirst() en una lista vacía lanza NoSuchElementException (antes get(0) daba IndexOutOfBounds).

        // ─────────────────────────────────────────────────────────────────────────────
        titulo("15. Java más reciente: JDK 22-25");
        // Cosas que ya existen en versiones posteriores (aquí corremos en JDK 21, así que solo se mencionan):
        //  · Unnamed variables (_): `catch (Exception _)` o `case Punto(int x, _)` cuando no usas el valor.
        //  · Compact source files y instance main (JDK 25): un archivo con `void main() { System.out.println("hola"); }`
        //    sin clase ni `public static void main(String[] args)`. Pensado para aprender y para scripts.
        //  · Scoped values y structured concurrency: alternativas modernas a ThreadLocal y a lanzar hilos a mano.
        //  · Virtual threads (ya en 21): millones de hilos baratos para código bloqueante, sin reactive.
        //  · Stream Gatherers: operaciones intermedias propias en un stream.
        System.out.println("Estás ejecutando Java " + Runtime.version().feature());
        System.out.println("""
            En Spring la app arranca una vez y los objetos viven en memoria entre peticiones:
            el estado compartido es tu responsabilidad (hilos, caches, singletons).""");
    }

    // ───────────────────────── apoyo de las secciones ─────────────────────────

    static int sumar(int a, int b) {
        return a + b;
    }

    static double sumar(double a, double b) {
        return a + b;
    }

    static String sumar(String a, int b) {
        return a + b;
    }

    static int total(int... nums) {
        return Arrays.stream(nums).sum();
    }

    static String describir(Object o) {
        return "Object";
    }

    static String describir(String s) {
        return "String";
    }

    static String describir(Integer n) {
        return "Integer";
    }

    static void incrementarInutil(int n) {
        n++;
    }

    static <T extends Comparable<T>> T mayor(T a, T b) {
        return a.compareTo(b) >= 0 ? a : b;
    }

    static double sumaTodo(List<? extends Number> numeros) {      // ? extends: solo leer
        double suma = 0;
        for (Number n : numeros) {
            suma += n.doubleValue();
        }
        return suma;
    }

    static String clasificar(Object o) {
        return switch (o) {
            case null -> "null";
            case Integer i when i > 40 -> "entero grande " + i;
            case Integer i -> "entero " + i;
            case String s -> "texto de " + s.length() + " letras";
            case List<?> l -> "lista de " + l.size();
            default -> "otra cosa: " + o;
        };
    }

    static void retirar(Cuenta c, double cantidad) throws SaldoInsuficiente {
        if (cantidad > c.saldo()) {
            throw new SaldoInsuficiente(cantidad - c.saldo());
        }
    }
}

class Cuenta {
    private static int creadas = 0;
    private final String titular;
    private double saldo;

    Cuenta(String titular) {
        this.titular = titular;
        creadas++;
    }

    Cuenta ingresar(double cantidad) {
        if (cantidad <= 0) {
            throw new IllegalArgumentException("La cantidad debe ser positiva");
        }
        saldo += cantidad;
        return this;
    }

    double saldo() {
        return saldo;
    }

    static int creadas() {
        return creadas;
    }

    @Override
    public String toString() {
        return "%s: %.2f €".formatted(titular, saldo);
    }
}

/** Excepción comprobada: quien llame a retirar() está obligado a capturarla o declararla. */
class SaldoInsuficiente extends Exception {
    private final double falta;

    SaldoInsuficiente(double falta) {
        super("Faltan %.2f €".formatted(falta));
        this.falta = falta;
    }

    double falta() {
        return falta;
    }
}

record Recurso(String nombre) implements AutoCloseable {
    @Override
    public void close() {
        System.out.println("cerrando " + nombre);
    }
}

record Caja<T>(T valor) {
    <R> Caja<R> map(Function<? super T, ? extends R> f) {
        return new Caja<>(f.apply(valor));
    }
}

/** sealed: solo Circulo y Rectangulo pueden implementarla. */
sealed interface Figura permits Circulo, Rectangulo {
    double area();

    default String describir() {                         // default method: código en la interfaz, heredado por todos
        return "%s con área %.2f".formatted(getClass().getSimpleName(), area());
    }
}

record Circulo(double radio) implements Figura {
    public double area() {
        return Math.PI * radio * radio;
    }
}

record Rectangulo(double ancho, double alto) implements Figura {
    public double area() {
        return ancho * alto;
    }
}
