import java.util.*;
import java.util.function.*;
import java.util.stream.*;

/*
 * TEMA 3 · ARRAYS Y COLECCIONES
 * ────────────────────────────────────────────────────────────────────────────
 * Las colecciones de java.util son la estructura que más vas a usar: ArrayList (lista), HashMap /
 * LinkedHashMap / TreeMap (mapas), HashSet (conjunto) y ArrayDeque (pila y cola). Elegir la correcta
 * y conocer sus trampas te ahorra el 80 % de los problemas de rendimiento.
 *
 *   Estructura      Acceso por posición   Buscar un valor   Añadir al final   Insertar al principio
 *   ArrayList       O(1)                  O(n)              O(1) amortizado   O(n)
 *   LinkedList      O(n)                  O(n)              O(1)              O(1)
 *   HashMap/HashSet —                     O(1) por clave    O(1)              —
 *   TreeMap/TreeSet —                     O(log n)          O(log n)          —   (ordenado)
 *   ArrayDeque      solo extremos         O(n)              O(1)              O(1)
 *
 * Los arrays ([]) tienen tamaño fijo y los genéricos solo admiten objetos: List<Integer>, nunca List<int>.
 */
class ArraysYColecciones {

    static void titulo(String texto) {
        System.out.println("\n=== " + texto + " ===");
    }

    /** Muestra un valor en una línea: [1, 2] para listas y {a=1} para mapas (arrays con deepToString). */
    static String ver(Object valor) {
        if (valor instanceof Object[] a) {
            return Arrays.deepToString(a);
        }
        return String.valueOf(valor);
    }

    /** Mapa que conserva el orden de inserción: ordenado("a", 1, "b", 2). Para los resultados esperados. */
    static <K, V> Map<K, V> ordenado(Object... clavesYValores) {
        var m = new LinkedHashMap<K, V>();
        for (int i = 0; i + 1 < clavesYValores.length; i += 2) {
            m.put((K) clavesYValores[i], (V) clavesYValores[i + 1]);
        }
        return m;
    }

    static int sumaTodo(int... numeros) {                        // varargs: llegan como array
        return Arrays.stream(numeros).sum();
    }

    // ── Ejercicio 1 · agruparPor ────────────────────────────────────────────────
    /**
     * Agrupa los elementos según lo que devuelva `clave.apply(elemento)`. El resultado es clave → lista de
     * elementos, con las claves en el orden en que aparecen por primera vez (LinkedHashMap) y los elementos
     * de cada grupo en su orden original.
     *
     *   agruparPor(List.of("ana", "luis", "amy"), s -> s.substring(0, 1))   // {a=[ana, amy], l=[luis]}
     *
     * Alternativa ingenua: para cada clave distinta, recorrer toda la lista otra vez: O(n·g). Se puede en una pasada, O(n).
     */
    static <T, K> Map<K, List<T>> agruparPor(List<T> items, Function<T, K> clave) {
        return pendiente();
    }

    // ── Ejercicio 2 · topPalabras ───────────────────────────────────────────────
    /**
     * Las k palabras más frecuentes de un texto: palabra → veces (en un LinkedHashMap, ya ordenado).
     *  - Palabra = secuencia de letras (con acentos y ñ: \p{L}); lo demás separa. No distingue mayúsculas.
     *  - Orden: más veces primero; a igualdad, alfabético.
     *  - Si hay menos de k palabras distintas, devuelve las que haya; con k = 0, vacío.
     *
     * Alternativa ingenua: ordenar todas las palabras y contarlas con bucles anidados, O(n²).
     */
    static Map<String, Integer> topPalabras(String texto, int k) {
        return pendiente();
    }

    // ── Ejercicio 3 · aplanar ───────────────────────────────────────────────────
    /**
     * Aplana una lista anidada a cualquier profundidad, en orden, como lista plana. Los elementos pueden ser
     * otras List o arrays de objetos (Object[]). Las listas vacías desaparecen.
     *   aplanar(List.of(1, List.of(2, List.of(3, List.of(4))), 5))  →  [1, 2, 3, 4, 5]
     *
     * Ojo: una List puede contener null (Arrays.asList lo permite); no lo pierdas por el camino.
     */
    static List<Object> aplanar(List<?> a) {
        return pendiente();
    }

    // El ejercicio 4 (Coleccion) es un tipo: está al final del archivo, fuera de esta clase.

    // ── Ejercicio 5 · unicos ────────────────────────────────────────────────────
    /**
     * Quita los repetidos de una lista de enteros o textos conservando el orden de la primera aparición.
     * Tiene que ser O(n): con `contains` de una lista dentro de un bucle sería O(n²) (contains recorre la
     * lista). Pulsa «Medir» y compruébalo.
     */
    static <T> List<T> unicos(List<T> xs) {
        return pendiente();
    }

    // ── Ejercicio 6 · interseccion ──────────────────────────────────────────────
    /**
     * Los valores de a que también están en b, sin repetidos y en el orden de a. Debe ser O(n + m).
     *
     *   interseccion(List.of(3, 1, 3, 2), List.of(2, 3, 9))  →  [3, 2]
     */
    static List<Integer> interseccion(List<Integer> a, List<Integer> b) {
        return pendiente();
    }

    // ── Ejercicio 7 · transponer ────────────────────────────────────────────────
    /**
     * Transpone una matriz rectangular (lista de filas): las filas pasan a ser columnas.
     *   [[1, 2, 3], [4, 5, 6]]  →  [[1, 4], [2, 5], [3, 6]]
     * Ojo con los casos límite: una sola fila, una sola columna y la matriz vacía (da lista vacía).
     */
    static List<List<Integer>> transponer(List<List<Integer>> m) {
        return pendiente();
    }

    /** Lista de n números con muchos repetidos (para medir unicos). */
    static List<Integer> conRepetidos(int n) {
        var r = new ArrayList<Integer>(n);
        for (int i = 0; i < n; i++) {
            r.add((int) ((i * 7919L) % Math.max(1, n / 2)));
        }
        return r;
    }

    /** Los enteros de desde a hasta, incluidos. */
    static List<Integer> desde(int desde, int hasta) {
        return IntStream.rangeClosed(desde, hasta).boxed().toList();
    }

    public static void main(String[] args) {

// ════════════════════════════════════════════════════════════════════════════
// 1. LISTA, MAPA Y CONJUNTO: TRES ESTRUCTURAS, TRES COSTES
// ════════════════════════════════════════════════════════════════════════════
        titulo("1. Lista, mapa y conjunto");

        List<Integer> lista = new ArrayList<>(List.of(10, 20, 30));   // posiciones 0, 1, 2
        lista.add(40);                                                // añadir al final — O(1) amortizado
        Map<String, Integer> mapa = new LinkedHashMap<>();            // LinkedHashMap conserva el orden de inserción
        mapa.put("ana", 30);
        mapa.put("luis", 25);
        mapa.put("eva", 41);
        System.out.println("lista: " + ver(lista));
        System.out.println("mapa: " + ver(mapa));

        // CONJUNTO: HashSet.contains es O(1); List.contains es O(n) (recorre la lista).
        Set<String> set = new HashSet<>(List.of("rojo", "verde", "azul"));
        System.out.println("¿hay verde? " + (set.contains("verde") ? "sí" : "no") + " · ¿hay lila? " + (set.contains("lila") ? "sí" : "no"));
        // HashMap/HashSet NO garantizan orden. LinkedHashSet conserva el de inserción; TreeSet lo ordena (O(log n)).
        System.out.println(new TreeSet<>(set) + " ← TreeSet, ordenado");

        // Las claves se comparan con equals: el Integer 1, el Long 1L y el String "1" son TRES claves distintas.
        Map<Object, String> raro = new LinkedHashMap<>();
        raro.put(1, "a");
        raro.put(1L, "b");
        raro.put("1", "c");
        raro.put(1, "d");                                             // misma clave que la primera: reemplaza
        System.out.println("tres claves: " + ver(raro));

        // ¿Lista o mapa? Una List guarda por posición y un Map por clave. Iterar un mapa: entrySet().
        for (var e : mapa.entrySet()) {
            System.out.print(e.getKey() + "=" + e.getValue() + "  ");
        }
        System.out.println();

// ════════════════════════════════════════════════════════════════════════════
// 2. DESESTRUCTURAR Y COMBINAR
// ════════════════════════════════════════════════════════════════════════════
        titulo("2. Desestructurar y combinar");

        // Java no desestructura listas, pero sí records (Java 21): record patterns.
        Object fila = new Persona("Ana", 30, "Madrid");
        if (fila instanceof Persona(String n, int e, String c)) {
            System.out.println(n + " " + e + " " + c);
        }
        var par = new ArrayList<>(List.of(1, 2));
        Collections.swap(par, 0, 1);                                  // intercambio sin variable temporal
        System.out.println("tras swap: " + par);

        // Unir listas: addAll (modifica la primera) o un stream si quieres una nueva.
        var x = List.of(1, 2);
        var y = new ArrayList<>(x);
        y.add(3);
        y.addAll(List.of(4, 5));
        System.out.println(ver(y) + " | concat: " + Stream.concat(x.stream(), Stream.of(9)).toList());
        System.out.println(sumaTodo(1, 2, 3) + " " + sumaTodo(new int[] {4, 5, 6}) + " " + sumaTodo());   // varargs = int[]

// ════════════════════════════════════════════════════════════════════════════
// 3. map / filter / reduce CON STREAMS
// ════════════════════════════════════════════════════════════════════════════
        // Los streams son perezosos: no hacen nada hasta la operación final (toList, sum, collect...).
        //  · Un stream se consume UNA vez: reutilizarlo lanza IllegalStateException.
        //  · .toList() (Java 16) devuelve una lista inmutable; Collectors.toList() no lo garantiza.
        //  · Para un mapa que conserve orden, pásale un LinkedHashMap a Collectors.toMap (el de por defecto es HashMap).
        titulo("3. map / filter / reduce");

        var nums = List.of(1, 2, 3, 4, 5, 6);
        System.out.println("filter: " + nums.stream().filter(n -> n % 2 == 0).toList());
        System.out.println("map: " + nums.stream().map(n -> n * n).toList());
        System.out.println("reduce: " + nums.stream().reduce(0, Integer::sum) + " | sum: " + nums.stream().mapToInt(Integer::intValue).sum());
        Map<String, Integer> doble = new LinkedHashMap<>();
        mapa.forEach((k, v) -> doble.put(k, v * 2));                  // "map con claves": se recorre el mapa
        System.out.println("map sobre un mapa: " + ver(doble));
        var reutilizado = nums.stream();
        reutilizado.count();
        try {
            reutilizado.count();
        } catch (IllegalStateException e) {
            System.out.println("IllegalStateException: " + e.getMessage());
        }

// ════════════════════════════════════════════════════════════════════════════
// 4. FILAS DE DATOS: records, Comparator Y ORDEN ESTABLE
// ════════════════════════════════════════════════════════════════════════════
        titulo("4. Filas de datos");

        var personas = new ArrayList<>(List.of(
            new Persona("Ana", 30, "Madrid"),
            new Persona("Luis", 25, "Sevilla"),
            new Persona("Eva", 30, "Madrid")));
        System.out.println("nombres: " + personas.stream().map(Persona::nombre).toList());
        System.out.println("edad por nombre: " + personas.stream().collect(Collectors.toMap(Persona::nombre, Persona::edad, (a, b) -> a, LinkedHashMap::new)));

        // Comparator.comparing encadena criterios (edad descendente, luego nombre). Evita restar enteros en un
        // comparator a mano (a - b desborda con números grandes): usa Integer.compare o Comparator.comparingInt.
        personas.sort(Comparator.comparingInt(Persona::edad).reversed().thenComparing(Persona::nombre));
        System.out.println("por edad desc, nombre asc: " + personas.stream().map(Persona::nombre).toList());
        // List.sort y Collections.sort son ESTABLES (TimSort): los empatados conservan su orden original.
        // Arrays.sort(int[]) no lo es, pero con primitivos no se nota.

// ════════════════════════════════════════════════════════════════════════════
// 5. TRAMPAS CLÁSICAS
// ════════════════════════════════════════════════════════════════════════════
        titulo("5. Trampas");

        // 5a. Modificar una lista MIENTRAS la recorres con for-each lanza ConcurrentModificationException.
        var v = new ArrayList<>(List.of(1, 2, 3, 4));
        try {
            for (Integer elemento : v) {
                if (elemento % 2 == 0) {
                    v.remove(elemento);
                }
            }
        } catch (ConcurrentModificationException e) {
            System.out.println("con la trampa: ConcurrentModificationException");
        }
        v = new ArrayList<>(List.of(1, 2, 3, 4));
        v.removeIf(elemento -> elemento % 2 == 0);                    // la forma correcta (O(n))
        System.out.println("con removeIf: " + v);

        // 5b. List.contains es O(n); dentro de un bucle da O(n²). Se arregla pasando la lista a un HashSet UNA vez.
        List<Integer> grandes = desde(1, 5);
        List<Integer> buscar = List.of(2, 4, 9);
        var sinConjunto = new ArrayList<Integer>();
        for (int b : buscar) {
            if (grandes.contains(b)) {
                sinConjunto.add(b);
            }
        }
        Set<Integer> conjunto = new HashSet<>(grandes);
        var conConjunto = buscar.stream().filter(conjunto::contains).toList();
        System.out.println("mismo resultado: " + sinConjunto + " = " + conConjunto);

        // 5c. remove(int) frente a remove(Object): con una List<Integer> la sobrecarga elegida depende del tipo.
        var xs = new ArrayList<>(List.of(10, 20, 30, 1));
        xs.remove(1);                                                 // remove(int índice): quita el 20
        System.out.println("remove(1): " + xs);
        xs.remove(Integer.valueOf(1));                                // remove(Object): quita el VALOR 1
        System.out.println("remove(Integer.valueOf(1)): " + xs);

        // 5d. == entre Integer: la caché guarda de -128 a 127, así que "funciona" hasta que dejas de tener suerte.
        Integer c1 = 127, c2 = 127, g1 = 1000, g2 = 1000;
        System.out.println("127 == 127: " + (c1 == c2) + " | 1000 == 1000: " + (g1 == g2) + " | equals: " + g1.equals(g2));

        // 5e. Arrays.asList: tamaño FIJO. Se puede set() (y escribe en el array original), pero no add/remove.
        String[] original = {"a", "b", "c"};
        List<String> vista = Arrays.asList(original);
        vista.set(0, "z");
        System.out.println("el array también cambia: " + Arrays.toString(original));
        try {
            vista.add("d");
        } catch (UnsupportedOperationException e) {
            System.out.println("UnsupportedOperationException: Arrays.asList no crece (usa new ArrayList<>(...))");
        }
        // Y con primitivos es peor: Arrays.asList(int[]) da una lista de UN elemento (el propio array).
        System.out.println("asList(int[]).size() = " + Arrays.asList(new int[] {1, 2, 3}).size());

        // 5f. Autoboxing: cada int dentro de una List<Integer> es un objeto. Un bucle con Long acumulador crea uno por vuelta.
        Long lento = 0L;
        for (int i = 0; i < 1000; i++) {
            lento += i;                                               // desempaqueta, suma y vuelve a empaquetar
        }
        long rapido = 0;                                              // primitivo: sin objetos
        for (int i = 0; i < 1000; i++) {
            rapido += i;
        }
        System.out.println("mismo resultado: " + lento + " = " + rapido + " (con int[] / long no hay boxing)");

        // 5g. add(0, x) y remove(0) en un ArrayList desplazan todo: O(n). Para una cola o una pila, ArrayDeque (tema 7).
        // 5h. subList devuelve una VISTA, no una copia: modificarla modifica la lista original.

// ════════════════════════════════════════════════════════════════════════════
// 6. RECORRER SIN GUARDAR TODO EN MEMORIA
// ════════════════════════════════════════════════════════════════════════════
        // Un Iterator (o un stream perezoso) produce los valores uno a uno, sin guardarlos.
        titulo("6. Iteradores y streams perezosos");

        Iterable<Long> cuadrados = () -> new Iterator<>() {           // el equivalente de un "generador"
            private long i = 0;

            @Override
            public boolean hasNext() {
                return i < 4;
            }

            @Override
            public Long next() {
                i++;
                return i * i;
            }
        };
        for (long c : cuadrados) {
            System.out.print(c + "  ");
        }
        System.out.println();
        // Sobre 10 millones de elementos, un stream usa memoria constante; una List<Long>, cientos de MB.
        long suma = IntStream.rangeClosed(1, 100000).mapToLong(i -> (long) i * i).sum();
        System.out.println("suma de 100000 cuadrados sin crear la lista: " + suma);
        System.out.println(Stream.iterate(1, i -> i * 2).limit(8).toList() + " ← infinito, pero solo se piden 8");

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

        Function<String, String> porInicial = s -> s.substring(0, 1);
        Function<Integer, Integer> porParidad = n -> n % 2;
        Function<Object, Object> identidad = o -> o;
        Function<String, String> todos = s -> "todos";

        prueba("agruparPor",
            caso("por inicial", ordenado("a", List.of("ana", "amy"), "l", List.of("luis")), List.of("ana", "luis", "amy"), porInicial),
            caso("por paridad (claves enteras)", ordenado(1, List.of(1, 3, 5), 0, List.of(2, 4)), List.of(1, 2, 3, 4, 5), porParidad),
            caso("vacío", ordenado(), List.of(), identidad),
            caso("un solo grupo", ordenado("todos", List.of("x", "y")), List.of("x", "y"), todos));

        prueba("topPalabras",
            caso("cuenta y ordena", ordenado("a", 3, "b", 2), "a b a c b a", 2),
            caso("desempata alfabéticamente", ordenado("gato", 1, "loro", 1), "perro gato loro", 2),
            caso("ignora mayúsculas y signos", ordenado("hola", 3, "adiós", 1), "¡Hola, hola! HOLA... adiós", 5),
            caso("letras con acento", ordenado("él", 3), "Él él ÉL pie", 1),
            caso("k = 0", ordenado(), "a b c", 0),
            caso("texto sin palabras", ordenado(), "123 ... !!!", 3));

        prueba("aplanar",
            caso("anidado", List.of(1, 2, 3, 4, 5), List.of(1, List.of(2, List.of(3, List.of(4))), 5)),
            caso("ya plano", List.of(1, 2, 3), List.of(1, 2, 3)),
            caso("vacíos", List.of(), List.of(List.of(), List.of(List.of()), List.of())),
            caso("mezcla de tipos y null", Arrays.asList("a", true, null, 1.5), List.of("a", List.of(true, Arrays.asList(null, 1.5)))),
            caso("con arrays de objetos dentro", List.of(1, 2, 3), List.of(1, new Object[] {2, new Object[] {3}})));

        var ana = new Persona("Ana", 30, "Madrid");
        var luis = new Persona("Luis", 25, "Sevilla");
        var eva = new Persona("Eva", 30, "Madrid");
        var pau = new Persona("Pau", 41, "Sevilla");
        List<Persona> gente = List.of(ana, luis, eva, pau);

        grupo("Coleccion");
        comprueba("map transforma cada elemento y conserva el orden", () -> Coleccion.hacer(List.of(1, 2)).map(n -> n * 10).all(), List.of(10, 20));
        comprueba("filter devuelve una lista nueva", () -> Coleccion.hacer(List.of(1, 2, 3, 4, 5)).filter(n -> n % 2 == 1).all(), List.of(1, 3, 5));
        comprueba("filter sin función quita los falsos", () -> Coleccion.hacer(Arrays.asList(0, 1, "", "a", null, false)).filter().all(), List.of(1, "a"));
        comprueba("reduce", () -> Coleccion.hacer(List.of(1, 2, 3)).reduce(0, (acc, n) -> acc * 10 + n), 123);
        comprueba("sum y avg", () -> List.of(Coleccion.hacer(List.of(1, 2, 3, 4)).sum(), Coleccion.hacer(List.of(1, 2, 3, 4)).avg()), List.of(10.0, 2.5));
        comprueba("avg de una colección vacía", () -> Coleccion.hacer(List.of()).avg(), 0.0);
        comprueba("first", () -> Arrays.asList(
            Coleccion.hacer(List.of(5, 6, 7)).first(),
            Coleccion.hacer(List.of(5, 6, 7)).first(n -> n > 5),
            Coleccion.<Object>hacer(List.of()).first(n -> true, "nada")), List.of(5, 6, "nada"));
        comprueba("sortBy descendente y estable", () -> Coleccion.hacer(gente).sortBy(Persona::edad, true).pluck("nombre").all(), List.of("Pau", "Ana", "Eva", "Luis"));
        comprueba("sortBy ascendente", () -> Coleccion.hacer(gente).sortBy(Persona::nombre).pluck("nombre").all(), List.of("Ana", "Eva", "Luis", "Pau"));
        comprueba("groupBy conserva el orden de aparición", () -> Coleccion.hacer(gente).groupBy(Persona::ciudad), ordenado("Madrid", List.of(ana, eva), "Sevilla", List.of(luis, pau)));
        comprueba("unique distingue 1 de \"1\"", () -> Coleccion.hacer(List.<Object>of(3, 1, 3, "1", 2, 1)).unique().all(), List.of(3, 1, "1", 2));
        comprueba("take", () -> Coleccion.hacer(List.of(1, 2, 3, 4)).take(2).all(), List.of(1, 2));
        comprueba("encadenado", () -> Coleccion.hacer(desde(1, 10)).filter(n -> n % 2 == 0).map(n -> n * n).sum(), 220.0);
        comprueba("es inmutable", () -> {
            var c = Coleccion.hacer(List.of(1, 2));
            c.map(n -> n * 10);
            c.filter(n -> false);
            return c.all();
        }, List.of(1, 2));
        comprueba("count() y for-each", () -> {
            var c = Coleccion.hacer(List.of(1, 2, 3));
            int suma2 = 0;
            for (int n : c) {
                suma2 += n;
            }
            return List.of(c.count(), suma2);
        }, List.of(3, 6));

        prueba("unicos",
            caso("enteros", List.of(3, 1, 2), List.of(3, 1, 3, 2, 1)),
            caso("textos", List.of("b", "a", "c"), List.of("b", "a", "b", "c", "a")),
            caso("sin repetidos", List.of(1, 2, 3), List.of(1, 2, 3)),
            caso("vacío", List.of(), List.of()),
            caso("todos iguales", List.of(7), List.of(7, 7, 7, 7)));

        prueba("interseccion",
            caso("básica", List.of(3, 2), List.of(3, 1, 3, 2), List.of(2, 3, 9)),
            caso("sin elementos comunes", List.of(), List.of(1, 2), List.of(3, 4)),
            caso("vacía", List.of(), List.of(), List.of(1, 2)),
            caso("una de las dos vacía", List.of(), List.of(1, 2), List.of()),
            caso("conserva el orden de la primera", List.of(5, 3, 1), List.of(5, 4, 3, 2, 1), List.of(1, 3, 5)));

        prueba("transponer",
            caso("rectangular", List.of(List.of(1, 4), List.of(2, 5), List.of(3, 6)), List.of(List.of(1, 2, 3), List.of(4, 5, 6))),
            caso("una sola fila", List.of(List.of(1), List.of(2), List.of(3)), List.of(List.of(1, 2, 3))),
            caso("una sola columna", List.of(List.of(1, 2, 3)), List.of(List.of(1), List.of(2), List.of(3))),
            caso("cuadrada", List.of(List.of(1, 3), List.of(2, 4)), List.of(List.of(1, 2), List.of(3, 4))),
            caso("vacía", List.of(), List.of()));

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        // Con contains de una lista dentro del bucle saldrá O(n²); con un HashSet, O(n).
        medir("unicos", n -> args(conRepetidos(n)));
        medir("interseccion", n -> args(desde(0, n - 1), desde(n / 2, n + n / 2)));
    }
}

// ── Ejercicio 4 · Coleccion (al estilo collect() de Laravel / Stream de Java) ──
/** Una fila de datos para las pruebas y los ejemplos. */
record Persona(String nombre, int edad, String ciudad) {
}

/**
 * Una envoltura fluida sobre una lista. Es INMUTABLE: cada operación devuelve una Coleccion nueva.
 *  - hacer(items): constructor estático. all(): la lista interna. count() y for-each funcionan (Iterable).
 *  - map(f): aplica f a cada elemento.
 *  - filter(f): se queda con los elementos para los que f da true; filter() sin función se queda con los
 *    "verdaderos": no null, no false, no 0, no "".
 *  - reduce(inicial, f), sum() (como double), avg() (0.0 si está vacía).
 *  - first(): primero o null; first(f): primero que cumpla f o null; first(f, defecto).
 *  - sortBy(clave, desc): ordena por lo que devuelva clave(elemento); ESTABLE. sortBy(clave) es ascendente.
 *  - pluck(campo): la columna campo de cada elemento: el accesor de un record (por reflexión) o la clave de un Map.
 *  - groupBy(f): clave → lista de elementos (como agruparPor), en un LinkedHashMap.
 *  - unique(): sin repetidos, conservando la primera aparición (1 y "1" son distintos).
 *  - take(n): los n primeros.
 */
final class Coleccion<T> implements Iterable<T> {
    private List<T> items;

    private Coleccion(List<T> items) {
        pendiente();
    }

    static <T> Coleccion<T> hacer(List<T> items) {
        return pendiente();
    }

    List<T> all() {
        return pendiente();
    }

    int count() {
        return pendiente();
    }

    @Override
    public Iterator<T> iterator() {
        return pendiente();
    }

    <R> Coleccion<R> map(Function<? super T, ? extends R> f) {
        return pendiente();
    }

    Coleccion<T> filter(Predicate<? super T> f) {
        return pendiente();
    }

    Coleccion<T> filter() {
        return pendiente();
    }

    <R> R reduce(R inicial, BiFunction<R, ? super T, R> f) {
        return pendiente();
    }

    double sum() {
        return pendiente();
    }

    double avg() {
        return pendiente();
    }

    T first() {
        return pendiente();
    }

    T first(Predicate<? super T> f) {
        return pendiente();
    }

    T first(Predicate<? super T> f, T defecto) {
        return pendiente();
    }

    <K extends Comparable<? super K>> Coleccion<T> sortBy(Function<? super T, ? extends K> clave, boolean desc) {
        return pendiente();
    }

    <K extends Comparable<? super K>> Coleccion<T> sortBy(Function<? super T, ? extends K> clave) {
        return sortBy(clave, false);
    }

    Coleccion<Object> pluck(String campo) {
        return pendiente();
    }

    <K> Map<K, List<T>> groupBy(Function<? super T, ? extends K> f) {
        return pendiente();
    }

    Coleccion<T> unique() {
        return pendiente();
    }

    Coleccion<T> take(int n) {
        return pendiente();
    }
}
