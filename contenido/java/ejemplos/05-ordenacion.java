import java.util.*;

/*
 * TEMA 5 · ORDENACIÓN
 * ────────────────────────────────────────────────────────────────────────────
 * Ordenar es el problema "de laboratorio" de los algoritmos: hay muchas soluciones y
 * cada una enseña una idea. En la vida real casi siempre usarás Arrays.sort() / List.sort()
 * (rápidos y muy afinados), pero entender los algoritmos te enseña a razonar sobre coste,
 * estabilidad y memoria.
 *
 *   Algoritmo        Mejor      Medio       Peor        Memoria   Estable
 *   burbuja          O(n)       O(n²)       O(n²)       O(1)      sí
 *   inserción        O(n)       O(n²)       O(n²)       O(1)      sí
 *   merge sort       O(n log n) O(n log n)  O(n log n)  O(n)      sí
 *   quick sort       O(n log n) O(n log n)  O(n²)       O(log n)  no (típico)
 *   counting sort    O(n + k)   O(n + k)    O(n + k)    O(k)      sí (con cuidado)
 *
 * "Estable" = los elementos que empatan conservan el orden que tenían. Importa cuando
 * ordenas por un criterio y luego por otro.
 */
class Ordenacion {

    static void titulo(String texto) {
        System.out.println("\n=== " + texto + " ===");
    }

    /** Muestra un valor en una línea: [1, 2] para listas y arrays primitivos. */
    static String ver(Object valor) {
        if (valor instanceof int[] a) {
            return Arrays.toString(a);
        }
        if (valor instanceof Object[] a) {
            return Arrays.deepToString(a);
        }
        return String.valueOf(valor);
    }

    /** n números pseudoaleatorios en 0..max (siempre los mismos) como lista: para las pruebas y para medir. */
    static List<Integer> datos(int n, int max) {
        return Arrays.stream(aleatorios(n, max, 12345)).boxed().toList();
    }

    static int[] burbujaConTraza(int[] xs) {
        int n = xs.length;
        int comparaciones = 0;
        for (int pasada = 1; pasada < n; pasada++) {
            boolean cambio = false;
            for (int i = 0; i < n - pasada; i++) {
                comparaciones++;
                if (xs[i] > xs[i + 1]) {
                    int t = xs[i];                                        // intercambio con variable temporal
                    xs[i] = xs[i + 1];
                    xs[i + 1] = t;
                    cambio = true;
                }
            }
            System.out.println("pasada " + pasada + ": " + ver(xs));
            if (!cambio) {                                                // optimización: ya está ordenado
                break;
            }
        }
        System.out.println("comparaciones: " + comparaciones);
        return xs;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // EJERCICIOS
    // ════════════════════════════════════════════════════════════════════════════
    // Todos reciben una lista y DEVUELVEN otra ordenada de menor a mayor, sin modificar la original.
    // No uses sort()/Arrays.sort()/Collections.sort(): el objetivo es escribir el algoritmo (en
    // ordenarPersonas y ordenarPorFrecuencia, sí).

    // ── Ejercicio 1 · burbuja ───────────────────────────────────────────────────
    /**
     * Ordenación de la burbuja con parada anticipada: si en una pasada completa no se intercambia nada,
     * la lista ya está ordenada y se termina (así una lista ordenada cuesta O(n) y no O(n²)).
     * Trabaja sobre una COPIA (new ArrayList<>(xs)): la lista de entrada puede ser inmutable (List.of).
     */
    static List<Integer> burbuja(List<Integer> xs) {
        return pendiente();
    }

    // ── Ejercicio 2 · insercion ─────────────────────────────────────────────────
    /**
     * Ordenación por inserción: mantén una parte izquierda ya ordenada y va insertando cada nuevo elemento en su sitio,
     * desplazando los mayores una posición a la derecha. Es la que usan las librerías para listas pequeñas.
     */
    static List<Integer> insercion(List<Integer> xs) {
        return pendiente();
    }

    // ── Ejercicio 3 · mergeSort ─────────────────────────────────────────────────
    /**
     * Merge sort (divide y vencerás): parte la lista por la mitad, ordena cada mitad y mézclalas.
     * Debe ser ESTABLE y aceptar un comparador (`Comparator`, como el de List.sort). La sobrecarga
     * mergeSort(xs) ordena de menor a mayor con el orden natural (compareTo) y ya está hecha.
     */
    static <T> List<T> mergeSort(List<T> xs, Comparator<? super T> comparar) {
        return pendiente();
    }

    static <T extends Comparable<? super T>> List<T> mergeSort(List<T> xs) {
        return mergeSort(xs, Comparator.naturalOrder());
    }

    // ── Ejercicio 4 · quickSort ─────────────────────────────────────────────────
    /**
     * Quick sort: elige un pivote (el elemento central), reparte el resto en menores, iguales y mayores,
     * y ordena recursivamente menores y mayores. Con "iguales" aparte, las listas con muchos repetidos no se degradan.
     */
    static List<Integer> quickSort(List<Integer> xs) {
        return pendiente();
    }

    // ── Ejercicio 5 · countingSort ──────────────────────────────────────────────
    /**
     * Ordenación por conteo para enteros en el rango 0..max: cuenta cuántas veces aparece cada valor y reconstruye
     * la lista. No compara elementos, así que se salta el límite O(n log n): cuesta O(n + max).
     * Un valor fuera de 0..max lanza IllegalArgumentException.
     */
    static List<Integer> countingSort(List<Integer> xs, int max) {
        return pendiente();
    }

    // ── Ejercicio 6 · ordenarPersonas ───────────────────────────────────────────
    /**
     * Ordena personas por varios criterios a la vez: apellido ascendente, luego edad DESCENDENTE, luego nombre
     * ascendente. Aquí SÍ puedes usar List.sort con un Comparator encadenado
     * (Comparator.comparing(...).thenComparing(...)); cuidado: el orden descendente de UN criterio se pide con
     * thenComparing(Persona::edad, Comparator.reverseOrder()), no invirtiendo todo el comparador.
     * Devuelve una lista NUEVA, sin modificar la original.
     */
    static List<Persona> ordenarPersonas(List<Persona> personas) {
        return pendiente();
    }

    // ── Ejercicio 7 · ordenarPorFrecuencia ──────────────────────────────────────
    /**
     * Ordena una lista de enteros por frecuencia (los que más se repiten, primero) y, a igual frecuencia,
     * por valor ascendente. Los elementos se repiten en el resultado tantas veces como aparecían.
     *   [4, 6, 2, 6, 4, 4, 6]  →  [4, 4, 4, 6, 6, 6, 2]
     * Alternativa ingenua: contar cada valor recorriendo la lista otra vez, O(n²).
     */
    static List<Integer> ordenarPorFrecuencia(List<Integer> xs) {
        return pendiente();
    }

    public static void main(String[] args) {

// ════════════════════════════════════════════════════════════════════════════
// 1. LA FAMILIA sort() DE JAVA
// ════════════════════════════════════════════════════════════════════════════
        // Ordenan IN SITU (modifican la lista o el array que les pasas) y no devuelven nada: nunca hagas
        // `var ordenado = Collections.sort(lista)`. Para obtener una copia ordenada: `var copia = new ArrayList<>(lista);
        // copia.sort(null);` (null = orden natural). Trampa: una lista de List.of(...) es INMUTABLE y sort lanza
        // UnsupportedOperationException.
        //
        //   Arrays.sort(int[])            primitivos: dual-pivot quicksort, O(n log n), no estable (da igual con int).
        //   Arrays.sort(T[], comp)        objetos: TimSort, ESTABLE.
        //   List.sort(comp)               sobre listas: TimSort, ESTABLE. Con null usa el orden natural.
        //   Collections.sort(lista)       lo mismo que lista.sort(null).
        //   stream.sorted(comp)           devuelve un stream ordenado SIN tocar el origen.
        titulo("1. La familia sort()");

        int[] numeros = {10, 9, 2, 33, 1};
        int[] copia = numeros.clone();
        Arrays.sort(copia);
        System.out.println("original: " + ver(numeros) + " · ordenado: " + ver(copia));

        var edades = new HashMap<>(Map.of("ana", 30, "luis", 25, "eva", 41));
        // Un mapa no se ordena: se ordenan sus entradas (por valor, por clave...) y se vuelcan en otra estructura.
        System.out.println("por edad: " + edades.entrySet().stream().sorted(Map.Entry.comparingByValue()).toList());
        System.out.println("por edad descendente: " + edades.entrySet().stream().sorted(Map.Entry.<String, Integer>comparingByValue().reversed()).toList());
        System.out.println("por clave (TreeMap): " + new TreeMap<>(edades));

        // El comparador devuelve negativo, cero o positivo. Comparator.comparing(...) lo construye por ti.
        var palabras = new ArrayList<>(List.of("kiwi", "fresa", "pera", "uva"));
        palabras.sort(Comparator.comparingInt(String::length).thenComparing(Comparator.naturalOrder()));
        System.out.println("por longitud y luego alfabético: " + palabras);

        // Trampa 1: restar para comparar. `(a, b) -> a - b` DESBORDA con números grandes y da un signo equivocado.
        int a = Integer.MAX_VALUE, b = -1;
        System.out.println("MAX_VALUE - (-1) = " + (a - b) + " (¡negativo! el comparador diría que MAX_VALUE < -1) · Integer.compare = " + Integer.compare(a, b));

        // Trampa 2: el orden natural de String compara por código de carácter, no por alfabeto.
        var mezcla = new ArrayList<>(List.of("banana", "Zebra", "apple", "Árbol"));
        Collections.sort(mezcla);
        System.out.println("natural: " + mezcla + "   (las mayúsculas y la Á van antes que las minúsculas)");
        mezcla.sort(String.CASE_INSENSITIVE_ORDER);
        System.out.println("sin distinguir mayúsculas: " + mezcla);
        var textoNumeros = new ArrayList<>(List.of("10", "9", "2", "1"));
        Collections.sort(textoNumeros);
        System.out.println("números como texto: " + textoNumeros + " (compara carácter a carácter: \"10\" < \"2\")");
        textoNumeros.sort(Comparator.comparingInt(Integer::parseInt));
        System.out.println("como números: " + textoNumeros);

// ════════════════════════════════════════════════════════════════════════════
// 2. ESTABILIDAD
// ════════════════════════════════════════════════════════════════════════════
        // List.sort y Arrays.sort sobre objetos son estables (TimSort). Ordenar por edad deja a los empatados en su orden de entrada.
        titulo("2. Estabilidad");

        var gente = new ArrayList<>(List.of(new Persona("Ana", "Gil", 30), new Persona("Luis", "Gil", 25), new Persona("Eva", "Gil", 30), new Persona("Pau", "Gil", 25)));
        gente.sort(Comparator.comparingInt(Persona::edad));
        System.out.println(gente.stream().map(Persona::nombre).toList() + "   ← Luis antes que Pau, Ana antes que Eva (como entraron)");

// ════════════════════════════════════════════════════════════════════════════
// 3. VER A LA BURBUJA TRABAJAR
// ════════════════════════════════════════════════════════════════════════════
        // La burbuja compara vecinos y los intercambia; en cada pasada, el mayor "sube" al final.
        titulo("3. Una burbuja paso a paso");

        burbujaConTraza(new int[] {5, 1, 4, 2, 8});

// ════════════════════════════════════════════════════════════════════════════
// 4. CUÁNTO CRECE EL TRABAJO
// ════════════════════════════════════════════════════════════════════════════
        // Contamos las comparaciones que hace el List.sort() nativo (O(n log n)) frente a lo que haría un
        // algoritmo O(n²): al multiplicar n por 10, n log n se multiplica por ~13 y n² por 100.
        titulo("4. n log n frente a n²");

        for (int n : new int[] {100, 1000, 10000}) {
            var lista = new ArrayList<>(datos(n, 1_000_000));
            long[] comparaciones = {0};
            lista.sort((x, y) -> {
                comparaciones[0]++;
                return Integer.compare(x, y);
            });
            System.out.printf("n = %6s   sort() hizo %9s comparaciones   (un O(n²) haría ~%s)%n",
                String.format(Locale.GERMANY, "%,d", n), String.format(Locale.GERMANY, "%,d", comparaciones[0]), String.format(Locale.GERMANY, "%,d", (long) n * n / 2));
        }

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

        for (String nombre : new String[] {"burbuja", "insercion", "mergeSort", "quickSort"}) {
            prueba(nombre,
                caso("vacía", List.of(), List.of()),
                caso("un elemento", List.of(7), List.of(7)),
                caso("ya ordenada", List.of(1, 2, 3, 4, 5), List.of(1, 2, 3, 4, 5)),
                caso("inversa", List.of(1, 2, 3, 4, 5), List.of(5, 4, 3, 2, 1)),
                caso("con repetidos", List.of(1, 1, 2, 3, 3, 3), List.of(3, 1, 3, 2, 1, 3)),
                caso("negativos", List.of(-5, -1, 0, 2, 3), List.of(0, -5, 3, -1, 2)),
                caso("todos iguales", List.of(4, 4, 4, 4), List.of(4, 4, 4, 4)),
                caso("dos elementos", List.of(1, 2), List.of(2, 1)));
            grupo(nombre + "()");
            comprueba("500 números aleatorios", () -> {
                var entrada = datos(500, 100000);
                var esperado = new ArrayList<>(entrada);
                Collections.sort(esperado);
                return invoca(nombre, entrada).equals(esperado);
            }, true);
            comprueba("no modifica la lista original", () -> {
                var entrada = new ArrayList<>(List.of(3, 1, 2));
                invoca(nombre, entrada);
                return entrada;
            }, List.of(3, 1, 2));
        }

        grupo("mergeSort()");
        comprueba("es estable", () -> {
            var filas = List.of(new Persona("a", "x", 1), new Persona("b", "x", 0), new Persona("c", "x", 1), new Persona("d", "x", 0));
            return mergeSort(filas, Comparator.comparingInt(Persona::edad)).stream().map(Persona::nombre).toList();
        }, List.of("b", "d", "a", "c"));
        comprueba("acepta un comparador (descendente)", () -> mergeSort(List.of(1, 3, 2), Comparator.reverseOrder()), List.of(3, 2, 1));
        comprueba("ordena textos", () -> mergeSort(List.of("pera", "uva", "fresa")), List.of("fresa", "pera", "uva"));

        prueba("countingSort",
            caso("básica", List.of(0, 1, 1, 2, 3), List.of(3, 1, 2, 1, 0), 3),
            caso("vacía", List.of(), List.of(), 5),
            caso("repetidos", List.of(2, 2, 2), List.of(2, 2, 2), 2),
            caso("rango mayor que los datos", List.of(1, 5), List.of(5, 1), 100));
        grupo("countingSort()");
        lanza("valor fuera de rango", () -> countingSort(List.of(1, 9), 5), IllegalArgumentException.class);
        lanza("negativo", () -> countingSort(List.of(-1, 2), 5), IllegalArgumentException.class);
        comprueba("1000 números en 0..50", () -> {
            var entrada = datos(1000, 50);
            var esperado = new ArrayList<>(entrada);
            Collections.sort(esperado);
            return countingSort(entrada, 50).equals(esperado);
        }, true);

        prueba("ordenarPersonas",
            caso("por apellido",
                List.of(new Persona("Ana", "García", 30), new Persona("Luis", "Pérez", 25)),
                List.of(new Persona("Luis", "Pérez", 25), new Persona("Ana", "García", 30))),
            caso("mismo apellido: edad descendente",
                List.of(new Persona("Eva", "Ruiz", 40), new Persona("Ana", "Ruiz", 20)),
                List.of(new Persona("Ana", "Ruiz", 20), new Persona("Eva", "Ruiz", 40))),
            caso("mismo apellido y edad: nombre ascendente",
                List.of(new Persona("Ana", "Ruiz", 30), new Persona("Zoe", "Ruiz", 30)),
                List.of(new Persona("Zoe", "Ruiz", 30), new Persona("Ana", "Ruiz", 30))),
            caso("vacía", List.of(), List.of()));

        prueba("ordenarPorFrecuencia",
            caso("ejemplo", List.of(4, 4, 4, 6, 6, 6, 2), List.of(4, 6, 2, 6, 4, 4, 6)),
            caso("sin repetidos: por valor", List.of(1, 2, 3), List.of(3, 1, 2)),
            caso("un valor domina", List.of(2, 2, 2, 1, 3), List.of(1, 2, 2, 3, 2)),
            caso("vacía", List.of(), List.of()),
            caso("negativos", List.of(-1, -1, 5, 5, 0), List.of(-1, 5, -1, 5, 0)));

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        // Verás O(n²) para burbuja e inserción y O(n log n) para merge y quick sort. Los datos son pseudoaleatorios
        // pero siempre los mismos, para que las mediciones sean comparables.
        for (String nombre : new String[] {"burbuja", "insercion", "mergeSort", "quickSort"}) {
            medir(nombre, n -> args(datos(n, 1_000_000)));
        }
        medir("countingSort", n -> args(datos(n, 1000), 1000));
    }

    /** Llama por su nombre a uno de los cuatro algoritmos (para repetir las mismas pruebas en todos). */
    static List<Integer> invoca(String nombre, List<Integer> xs) {
        return switch (nombre) {
            case "burbuja" -> burbuja(xs);
            case "insercion" -> insercion(xs);
            case "mergeSort" -> mergeSort(xs);
            default -> quickSort(xs);
        };
    }
}

/** Una persona para ordenar por varios criterios. */
record Persona(String nombre, String apellido, int edad) {
}
