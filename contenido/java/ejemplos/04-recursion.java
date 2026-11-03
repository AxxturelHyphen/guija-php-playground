import java.util.*;

/*
 * TEMA 4 · RECURSIÓN
 * ────────────────────────────────────────────────────────────────────────────
 * Un método recursivo se llama a sí mismo resolviendo un problema más pequeño.
 * Toda recursión necesita dos cosas:
 *     1. CASO BASE: cuándo parar (si falta, recursión infinita → StackOverflowError).
 *     2. PASO RECURSIVO: acercarse al caso base en cada llamada.
 *
 * Cada llamada apila un "marco" en la pila de llamadas. Java NO optimiza la recursión de cola (tail call)
 * y la profundidad máxima la fija el tamaño de la pila del hilo (aquí 64 MB, del orden de un millón de
 * llamadas sencillas; con el valor por defecto de la JVM, 512 KB-1 MB, son unas 10.000-20.000). Cuando
 * se agota, Java lanza StackOverflowError. Por eso se prefiere un bucle cuando la profundidad puede ser enorme.
 */
class Recursion {

    static void titulo(String texto) {
        System.out.println("\n=== " + texto + " ===");
    }

    /** Formatea con punto de millar: 1234567 → 1.234.567. */
    static String miles(long n) {
        return String.format(Locale.GERMANY, "%,d", n);
    }

    private static boolean calentada;

    /** Calienta la JVM una sola vez (sin cronometrar) para que las mediciones no incluyan el código aún sin compilar. */
    static void calentar() {
        if (calentada) {
            return;
        }
        calentada = true;
        long fin = System.nanoTime() + 300_000_000L;
        while (System.nanoTime() < fin) {
            fibonacci(90);
            potencia(1.0, 100_000);
        }
    }

    static void cuentaAtras(int n, int nivel) {
        String sangria = "  ".repeat(nivel);
        if (n == 0) {                                     // CASO BASE
            System.out.println(sangria + "¡despegue! (caso base: aquí empiezan a volver)");
            return;
        }
        System.out.println(sangria + "baja n=" + n);
        cuentaAtras(n - 1, nivel + 1);                    // PASO RECURSIVO: n más pequeño
        System.out.println(sangria + "vuelve n=" + n);    // esto se ejecuta al DESAPILAR
    }

    // suma(n) = n + suma(n - 1)            suma(0) = 0
    static long sumaHasta(long n) {
        return n == 0 ? 0 : n + sumaHasta(n - 1);
    }

    /** Suma los tamaños de un árbol de carpetas: un valor Integer es un fichero y un Map es una subcarpeta. */
    static int sumaCarpetas(Map<String, Object> carpeta) {
        int total = 0;
        for (Object contenido : carpeta.values()) {
            if (contenido instanceof Map<?, ?> sub) {
                @SuppressWarnings("unchecked")
                var hijo = (Map<String, Object>) sub;
                total += sumaCarpetas(hijo);
            } else {
                total += (Integer) contenido;
            }
        }
        return total;
    }

    // Recursión mutua: dos métodos que se llaman entre sí.
    static boolean esPar(int n) {
        return n == 0 ? true : esImpar(n - 1);
    }

    static boolean esImpar(int n) {
        return n == 0 ? false : esPar(n - 1);
    }

    static long fibIngenuo(int n, long[] llamadas) {
        llamadas[0]++;
        return n < 2 ? n : fibIngenuo(n - 1, llamadas) + fibIngenuo(n - 2, llamadas);
    }

    /** memo recuerda lo ya calculado (el Map se pasa por referencia: todas las llamadas ven el mismo). */
    static long fibMemo(int n, Map<Integer, Long> memo, long[] llamadas) {
        llamadas[0]++;
        if (n < 2) {
            return n;
        }
        Long guardado = memo.get(n);
        if (guardado != null) {
            return guardado;
        }
        long valor = fibMemo(n - 1, memo, llamadas) + fibMemo(n - 2, memo, llamadas);
        memo.put(n, valor);
        return valor;
    }

    /** Todas las cadenas binarias de longitud n: decide un bit, sigue, y al volver prueba el otro. */
    static void binarios(int n, String actual, List<String> resultado) {
        if (actual.length() == n) {                       // CASO BASE: solución completa
            resultado.add(actual);
            return;
        }
        for (String bit : new String[] {"0", "1"}) {
            binarios(n, actual + bit, resultado);         // al volver, "se deshace" solo: los String son inmutables
        }                                                 // (con un StringBuilder compartido habría que borrar el último carácter)
    }

    static int sumaCarpetasIterativa(Map<String, Object> raiz) {
        int total = 0;
        Deque<Map<?, ?>> pila = new ArrayDeque<>();
        pila.push(raiz);
        while (!pila.isEmpty()) {
            Map<?, ?> actual = pila.pop();
            for (Object contenido : actual.values()) {
                if (contenido instanceof Map<?, ?> sub) {
                    pila.push(sub);
                } else {
                    total += (Integer) contenido;
                }
            }
        }
        return total;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // EJERCICIOS
    // ════════════════════════════════════════════════════════════════════════════

    // ── Ejercicio 1 · factorial ─────────────────────────────────────────────────
    /**
     * n! = n × (n-1) × ... × 1, con 0! = 1. Hazlo recursivo.
     *  - n negativo → IllegalArgumentException.
     *  - Un long de 64 bits solo llega a 20! (2.432.902.008.176.640.000): para n > 20 hay que lanzar
     *    ArithmeticException. Usa Math.multiplyExact, que la lanza sola; con `*` Java desbordaría en silencio y
     *    devolvería un número equivocado (sin avisar).
     */
    static long factorial(int n) {
        return pendiente();
    }

    // ── Ejercicio 2 · mcd ───────────────────────────────────────────────────────
    /**
     * Máximo común divisor con el algoritmo de Euclides: mcd(a, b) = mcd(b, a mod b); mcd(a, 0) = |a|.
     * Admite negativos (el resultado siempre es positivo). mcd(0, 0) = 0.
     */
    static int mcd(int a, int b) {
        return pendiente();
    }

    // ── Ejercicio 3 · fibonacci ─────────────────────────────────────────────────
    /**
     * fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2).  n negativo → IllegalArgumentException.
     * La versión ingenua es O(2ⁿ): con n = 50 tarda minutos. Hazla O(n) con memoización
     * (¡ojo con una caché `static`: que no se arrastre entre llamadas!). Pulsa «Medir» para verlo.
     */
    static long fibonacci(int n) {
        return pendiente();
    }

    // ── Ejercicio 4 · potencia ──────────────────────────────────────────────────
    /**
     * base^exp en O(log n) con la idea "divide y vencerás":
     *     x^n = (x^(n/2))² si n es par;   x · (x^((n-1)/2))² si n es impar
     * Exponente negativo → 1 / base^(-exp). Cualquier base elevada a 0 es 1.0. 0 elevado a un exponente negativo
     * → IllegalArgumentException. (El bucle de n multiplicaciones es O(n); aquí se pide mucho menos.)
     */
    static double potencia(double base, int exp) {
        return pendiente();
    }

    // ── Ejercicio 5 · esPalindromo ──────────────────────────────────────────────
    /**
     * ¿Se lee igual al revés? Solo cuentan las letras y los dígitos: se ignoran mayúsculas, espacios y signos
     * (los acentos no se normalizan: é ≠ e). Hazlo con recursión comparando los extremos y acercándote al centro.
     *   "Anita lava la tina" → true   ·   "A man, a plan, a canal: Panama" → true   ·   "hola" → false
     */
    static boolean esPalindromo(String texto) {
        return pendiente();
    }

    // ── Ejercicio 6 · permutaciones ─────────────────────────────────────────────
    /**
     * Todas las ordenaciones posibles de los elementos de la lista (backtracking), en este orden:
     * se elige el primer elemento en el orden original y se permuta el resto.
     *   permutaciones(List.of(1, 2, 3)) → [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]
     * Lista vacía → [[]] (hay exactamente una forma de ordenar nada).
     */
    static <T> List<List<T>> permutaciones(List<T> xs) {
        return pendiente();
    }

    // ── Ejercicio 7 · subconjuntos ──────────────────────────────────────────────
    /**
     * Todos los subconjuntos (el "conjunto de las partes"), en orden de backtracking: primero el vacío, y luego
     * cada elemento seguido de los subconjuntos que se pueden formar con los que le siguen.
     *   subconjuntos(List.of(1, 2, 3)) → [[], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]]
     * Para n elementos hay 2ⁿ subconjuntos.
     */
    static <T> List<List<T>> subconjuntos(List<T> xs) {
        return pendiente();
    }

    // ── Ejercicio 8 · hanoi ─────────────────────────────────────────────────────
    /**
     * Torres de Hanoi: mueve n discos de origen a destino usando auxiliar, sin poner nunca uno grande sobre
     * uno pequeño. Devuelve la lista de movimientos como "A→C". Java no tiene parámetros por defecto: la
     * sobrecarga hanoi(n) ya usa A, B y C.
     *   hanoi(2) → [A→B, A→C, B→C]
     * Hacen falta exactamente 2ⁿ − 1 movimientos. Con n = 0 no hay ninguno.
     */
    static List<String> hanoi(int n, String origen, String auxiliar, String destino) {
        return pendiente();
    }

    static List<String> hanoi(int n) {
        return hanoi(n, "A", "B", "C");
    }

    public static void main(String[] args) {

// ════════════════════════════════════════════════════════════════════════════
// 1. ANATOMÍA: LA PILA DE LLAMADAS
// ════════════════════════════════════════════════════════════════════════════
        titulo("1. La pila de llamadas");

        cuentaAtras(3, 0);

// ════════════════════════════════════════════════════════════════════════════
// 2. PENSAR EN "SI SÉ RESOLVER LO PEQUEÑO, RESUELVO LO GRANDE"
// ════════════════════════════════════════════════════════════════════════════
        titulo("2. Descomponer");

        System.out.println("sumaHasta(100) = " + sumaHasta(100) + " (la fórmula n(n+1)/2 da " + (100 * 101 / 2) + ")");
        System.out.println("sumaHasta(20000) = " + sumaHasta(20000) + " (20.000 marcos apilados sin problema con una pila de 64 MB)");

        // Recursión sobre estructuras anidadas: aquí un bucle no basta, la recursión es natural.
        Map<String, Object> arbol = new LinkedHashMap<>();
        arbol.put("a.txt", 10);
        arbol.put("src", new LinkedHashMap<>(Map.of("b.java", 5, "lib", Map.of("c.java", 7))));
        arbol.put("d.md", 1);
        System.out.println("tamaño total del árbol: " + sumaCarpetas(arbol) + " KB");

        System.out.println("esPar(10): " + esPar(10) + " · esImpar(7): " + esImpar(7));

// ════════════════════════════════════════════════════════════════════════════
// 3. EL PROBLEMA: LLAMADAS REPETIDAS (Y LA MEMOIZACIÓN)
// ════════════════════════════════════════════════════════════════════════════
        // fib(n) = fib(n-1) + fib(n-2). Escrito sin más, recalcula lo mismo una y otra vez:
        // fib(5) llama a fib(3) dos veces, a fib(2) tres veces... El número de llamadas crece como 2ⁿ.
        titulo("3. Memoización");

        for (int n : new int[] {10, 20, 25}) {
            long[] a = {0};
            long[] b = {0};
            long resultado = fibIngenuo(n, a);
            fibMemo(n, new HashMap<>(), b);
            System.out.println("fib(" + n + ") = " + resultado + "   llamadas: ingenuo " + miles(a[0]) + " · con memoria " + b[0]);
        }
        System.out.println("Memoización = cambiar memoria por tiempo: O(2ⁿ) pasa a O(n). Es la base de la programación dinámica (tema 8).");

// ════════════════════════════════════════════════════════════════════════════
// 4. BACKTRACKING: PROBAR, DESHACER, PROBAR OTRA COSA
// ════════════════════════════════════════════════════════════════════════════
        // Se construye una solución paso a paso; si un camino no sirve, se deshace la última
        // decisión y se prueba la siguiente. Es la plantilla de permutaciones, subconjuntos,
        // sudokus, n-reinas...
        titulo("4. Backtracking");

        List<String> cadenas = new ArrayList<>();
        binarios(3, "", cadenas);
        System.out.println(String.join(" ", cadenas));

// ════════════════════════════════════════════════════════════════════════════
// 5. CUÁNDO NO USAR RECURSIÓN
// ════════════════════════════════════════════════════════════════════════════
        // · Cuando la profundidad pueda ser enorme (un bucle no apila marcos).
        // · Cuando el trabajo se repite (usa memoización o un bucle que guarde lo calculado).
        // Cualquier recursión se puede convertir en un bucle con una pila explícita (un ArrayDeque):
        titulo("5. De recursión a bucle con pila explícita");

        System.out.println("mismo resultado sin recursión: " + sumaCarpetasIterativa(arbol) + " KB");

        // La trampa de Java: la pila es finita y, al agotarla, salta un Error (no una Exception): StackOverflowError.
        try {
            sumaHasta(100_000_000);
        } catch (StackOverflowError e) {
            System.out.println("sumaHasta(100.000.000) → StackOverflowError: no caben tantos marcos; un bucle sí lo haría");
        }

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

        prueba("factorial",
            caso("0! = 1", 1L, 0),
            caso("1! = 1", 1L, 1),
            caso("5! = 120", 120L, 5),
            caso("10!", 3628800L, 10),
            caso("20! es el mayor que cabe", 2432902008176640000L, 20));
        grupo("factorial()");
        lanza("negativo", () -> factorial(-1), IllegalArgumentException.class);
        lanza("21! desborda", () -> factorial(21), ArithmeticException.class);

        prueba("mcd",
            caso("básico", 6, 12, 18),
            caso("coprimos", 1, 7, 13),
            caso("con cero", 5, 0, 5),
            caso("con cero (otro orden)", 5, 5, 0),
            caso("negativos", 6, -12, 18),
            caso("iguales", 9, 9, 9),
            caso("los dos cero", 0, 0, 0),
            caso("números grandes", 21, 1071, 462));

        prueba("fibonacci",
            caso("fib(0)", 0L, 0),
            caso("fib(1)", 1L, 1),
            caso("fib(2)", 1L, 2),
            caso("fib(10)", 55L, 10),
            caso("fib(30)", 832040L, 30),
            caso("fib(50) (la versión ingenua no llega)", 12586269025L, 50),
            caso("fib(90)", 2880067194370816120L, 90));
        grupo("fibonacci()");
        lanza("negativo", () -> fibonacci(-1), IllegalArgumentException.class);
        comprueba("dos llamadas seguidas dan lo mismo", () -> List.of(fibonacci(25), fibonacci(25)), List.of(75025L, 75025L));

        prueba("potencia",
            caso("2^10", 1024.0, 2.0, 10),
            caso("3^0", 1.0, 3.0, 0),
            caso("2^1", 2.0, 2.0, 1),
            caso("1.5^3", 3.375, 1.5, 3),
            caso("exponente negativo", 0.25, 2.0, -2),
            caso("0^0", 1.0, 0.0, 0),
            caso("0^5", 0.0, 0.0, 5),
            caso("(-2)^3", -8.0, -2.0, 3),
            caso("exponente enorme sin desbordar", 1.0, 1.0, 1_000_000));
        grupo("potencia()");
        lanza("0 elevado a negativo", () -> potencia(0.0, -1), IllegalArgumentException.class);

        prueba("esPalindromo",
            caso("palabra", true, "reconocer"),
            caso("con espacios y mayúsculas", true, "Anita lava la tina"),
            caso("con signos", true, "A man, a plan, a canal: Panama"),
            caso("no lo es", false, "hola"),
            caso("vacío", true, ""),
            caso("un carácter", true, "x"),
            caso("solo signos", true, "¡?!"),
            caso("dígitos", true, "12321"),
            caso("casi", false, "abca"));

        prueba("permutaciones",
            caso("tres elementos", List.of(List.of(1, 2, 3), List.of(1, 3, 2), List.of(2, 1, 3), List.of(2, 3, 1), List.of(3, 1, 2), List.of(3, 2, 1)), List.of(1, 2, 3)),
            caso("dos elementos", List.of(List.of("a", "b"), List.of("b", "a")), List.of("a", "b")),
            caso("uno", List.of(List.of(7)), List.of(7)),
            caso("vacía", List.of(List.of()), List.of()));
        grupo("permutaciones()");
        comprueba("5 elementos dan 120", () -> permutaciones(List.of(1, 2, 3, 4, 5)).size(), 120);
        comprueba("ninguna se repite", () -> new HashSet<>(permutaciones(List.of(1, 2, 3, 4))).size(), 24);

        prueba("subconjuntos",
            caso("tres elementos", List.of(List.of(), List.of(1), List.of(1, 2), List.of(1, 2, 3), List.of(1, 3), List.of(2), List.of(2, 3), List.of(3)), List.of(1, 2, 3)),
            caso("uno", List.of(List.of(), List.of("x")), List.of("x")),
            caso("vacío", List.of(List.of()), List.of()));
        grupo("subconjuntos()");
        comprueba("10 elementos dan 1024", () -> subconjuntos(lista(10)).size(), 1024);

        prueba("hanoi",
            caso("n = 0", List.of(), 0),
            caso("n = 1", List.of("A→C"), 1),
            caso("n = 2", List.of("A→B", "A→C", "B→C"), 2),
            caso("n = 3", List.of("A→C", "A→B", "C→B", "A→C", "B→A", "B→C", "A→C"), 3),
            caso("otros nombres", List.of("X→Z"), 1, "X", "Y", "Z"));
        grupo("hanoi()");
        comprueba("10 discos = 1023 movimientos", () -> hanoi(10).size(), 1023);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        // fibonacci con la versión ingenua explota (O(2ⁿ)), con memoria es lineal. La escala es lineal (5, 10, 15...)
        // porque con tamaños que se doblan, el ingenuo no acabaría nunca. Una sola llamada tarda microsegundos
        // (el reloj no la distingue del ruido), así que cada repetición hace 500 llamadas seguidas; y calentar()
        // deja la JVM caliente antes de empezar para que el primer punto no incluya código sin compilar.
        medir("fibonacci", n -> {
            calentar();
            return n;
        }, n -> {
            for (int i = 0; i < 500; i++) {
                fibonacci(n);
            }
        }, "lineal", rango(5, 90, 5));
        // potencia: con n = 131072 un bucle hace 131072 multiplicaciones; la versión rápida, 17 (y se repite 200 veces
        // para que el tiempo sea medible).
        medir("potencia", n -> {
            calentar();
            return n;
        }, n -> {
            for (int i = 0; i < 200; i++) {
                potencia(1.0, n);
            }
        });
    }
}
