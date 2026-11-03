/*
 * SOLUCIONES · Tema 4 · Recursión
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
class Soluciones {

    /**
     * Factorial recursivo con control de desbordamiento.
     *
     * @complejidad Tiempo O(n); espacio O(n) por la pila de llamadas.
     * @explicacion Caso base `n <= 1`; paso `n * factorial(n - 1)`. Como 21! ya no cabe en un long de 64 bits y el
     * operador `*` desbordaría en silencio (dando un número equivocado sin avisar), se multiplica con
     * `Math.multiplyExact`, que lanza ArithmeticException en cuanto el resultado no cabe: es mejor un error claro que
     * un valor silenciosamente falso. El `(long)` evita que la multiplicación se haga en int.
     * @alternativas Un bucle `for` (O(n) de tiempo y O(1) de espacio): preferible en la práctica porque no apila
     * marcos. Para números grandes, `BigInteger` (sin límite, pero más lento).
     */
    static long factorial(int n) {
        if (n < 0) {
            throw new IllegalArgumentException("El factorial no está definido para " + n);
        }
        return n <= 1 ? 1 : Math.multiplyExact((long) n, factorial(n - 1));
    }

    /**
     * Máximo común divisor (Euclides).
     *
     * @complejidad Tiempo O(log min(a, b)); espacio O(log min(a, b)) de pila.
     * @explicacion mcd(a, b) = mcd(b, a mod b) porque cualquier divisor común de a y b también lo es de b y a mod b.
     * El resto baja al menos a la mitad cada dos pasos, de ahí el logaritmo. Se devuelve `Math.abs(a)` en el caso base
     * para que el resultado sea siempre positivo (el `%` de Java conserva el signo del dividendo, pero no importa:
     * el valor absoluto lo corrige al final).
     * @alternativas La versión con `while (b != 0) { int t = b; b = a % b; a = t; }` no apila marcos (O(1) de espacio).
     */
    static int mcd(int a, int b) {
        return b == 0 ? Math.abs(a) : mcd(b, a % b);
    }

    /**
     * Fibonacci con memoización local.
     *
     * @complejidad Tiempo O(n); espacio O(n).
     * @bigo n
     * @explicacion La versión ingenua recalcula los mismos subproblemas una y otra vez (O(2ⁿ) llamadas). Aquí cada
     * valor se calcula UNA vez y se guarda en un array `long[n + 1]`. La caché es LOCAL a cada llamada (no `static`): una
     * caché estática haría que las siguientes llamadas fueran O(1) y falsearía las mediciones, además de ocupar memoria
     * para siempre. Con un HashMap habría que consultar con `get` y guardar con `put` a mano: `computeIfAbsent`
     * recursivo lanzaría ConcurrentModificationException, porque la función modifica el mapa mientras lo ejecuta.
     * @alternativas Un bucle con dos variables (`long t = a + b; a = b; b = t;`): O(n) de tiempo y O(1) de espacio, la
     * mejor opción en la práctica. La fórmula de Binet es O(1) pero con double pierde precisión a partir de n ≈ 70.
     */
    static long fibonacci(int n) {
        if (n < 0) {
            throw new IllegalArgumentException("fibonacci no está definido para " + n);
        }
        return fibonacciMemo(n, new long[n + 1]);
    }

    /**
     * Ayudante de fibonacci(): calcula fib(k) apuntando cada resultado en memo.
     *
     * @complejidad Tiempo O(k) en total (cada valor se calcula una vez); espacio O(k) entre la tabla y la pila.
     * @explicacion Los casos base son k < 2. Para el resto se mira primero la tabla (0 significa "aún no calculado":
     * ningún fib(k) con k >= 2 vale 0); si el valor no está, se calcula con las dos llamadas recursivas y se guarda
     * antes de devolverlo.
     * @bigo n
     */
    private static long fibonacciMemo(int k, long[] memo) {
        if (k < 2) {
            return k;
        }
        if (memo[k] != 0) {
            return memo[k];
        }
        memo[k] = fibonacciMemo(k - 1, memo) + fibonacciMemo(k - 2, memo);
        return memo[k];
    }

    /**
     * Potencia rápida por exponenciación binaria.
     *
     * @complejidad Tiempo O(log n); espacio O(log n) de pila.
     * @bigo log
     * @explicacion Si el exponente es par, x^n = (x^(n/2))²; si es impar, x · (x^((n-1)/2))². Cada llamada divide el
     * exponente entre dos, así que bastan ~log₂(n) llamadas en vez de n multiplicaciones. La mitad se calcula UNA vez
     * y se guarda en una variable (si se llamara dos veces, se perdería la ventaja y volvería a ser O(n)).
     * @alternativas El bucle `for` de n multiplicaciones: O(n). La versión iterativa de la exponenciación binaria
     * (recorrer los bits del exponente) es O(log n) con O(1) de espacio. `Math.pow` es lo que usarías en producción.
     */
    static double potencia(double base, int exp) {
        if (exp < 0) {
            if (base == 0.0) {
                throw new IllegalArgumentException("0 elevado a un exponente negativo no está definido");
            }
            return 1 / potencia(base, -exp);
        }
        if (exp == 0) {
            return 1.0;
        }
        double mitad = potencia(base, exp / 2);
        return exp % 2 == 0 ? mitad * mitad : base * mitad * mitad;
    }

    /**
     * Palíndromo recursivo sobre letras y dígitos.
     *
     * @complejidad Tiempo O(n); espacio O(n) (la cadena limpia y la pila).
     * @explicacion Primero se limpia el texto: `[^\p{L}\p{N}]` quita todo lo que no sea letra o número de cualquier
     * idioma y `toLowerCase(Locale.ROOT)` unifica las mayúsculas sin depender del idioma del sistema. Después el
     * ayudante compara los dos extremos y se acerca al centro con índices (sin copiar subcadenas); el caso base es
     * que los índices se crucen, que siempre es palíndromo.
     * @alternativas `new StringBuilder(s).reverse().toString().equals(s)`: una línea, O(n). Un bucle `while (i < j)`
     * con los dos índices: O(n) sin pila, y es lo que se usa en las entrevistas.
     */
    static boolean esPalindromo(String texto) {
        String limpio = texto.replaceAll("[^\\p{L}\\p{N}]", "").toLowerCase(Locale.ROOT);
        return esPalindromoEntre(limpio, 0, limpio.length() - 1);
    }

    /**
     * Ayudante de esPalindromo(): ¿es palíndromo el trozo s[i..j]?
     *
     * @complejidad Tiempo O(j - i); espacio O(j - i) de pila.
     * @explicacion Si i >= j quedan 0 o 1 caracteres y es verdad por definición. Si no, los extremos deben coincidir y
     * el interior (i + 1, j - 1) también.
     * @bigo n
     */
    private static boolean esPalindromoEntre(String s, int i, int j) {
        if (i >= j) {
            return true;
        }
        return s.charAt(i) == s.charAt(j) && esPalindromoEntre(s, i + 1, j - 1);
    }

    /**
     * Permutaciones por backtracking.
     *
     * @complejidad Tiempo O(n · n!); espacio O(n · n!) para devolver todas.
     * @explicacion Se elige cada elemento como primero y se permuta el resto (que es una lista más corta): caso base,
     * la lista vacía tiene una sola permutación, la lista vacía. Al construir `[x, ...perm]` no hay nada que
     * "deshacer": cada llamada trabaja con su propia copia del resto. Ojo con `remove(i)`: con un `int` quita por
     * POSICIÓN (con un Integer quitaría por valor).
     * @alternativas El algoritmo de Heap genera las permutaciones intercambiando UN par por paso sin copiar listas.
     * Un Iterator o Stream perezoso evita guardar las n! permutaciones en memoria a la vez.
     */
    static <T> List<List<T>> permutaciones(List<T> xs) {
        if (xs.isEmpty()) {
            List<List<T>> unica = new ArrayList<>();
            unica.add(new ArrayList<>());
            return unica;
        }
        List<List<T>> resultado = new ArrayList<>();
        for (int i = 0; i < xs.size(); i++) {
            T x = xs.get(i);
            List<T> resto = new ArrayList<>(xs);
            resto.remove(i);
            for (List<T> perm : permutaciones(resto)) {
                List<T> nueva = new ArrayList<>(perm.size() + 1);
                nueva.add(x);
                nueva.addAll(perm);
                resultado.add(nueva);
            }
        }
        return resultado;
    }

    /**
     * Subconjuntos por backtracking.
     *
     * @complejidad Tiempo O(n · 2ⁿ); espacio O(n · 2ⁿ).
     * @explicacion El ayudante registra el subconjunto actual y luego, para cada elemento posterior, lo añade, baja un
     * nivel y lo QUITA al volver: es el "probar y deshacer" del backtracking. El orden de salida (vacío, [1], [1,2],
     * [1,2,3], [1,3]...) es el del recorrido en profundidad.
     * @alternativas Contar de 0 a 2ⁿ − 1 y usar cada bit como "incluir este elemento" (máscara de bits).
     */
    static <T> List<List<T>> subconjuntos(List<T> xs) {
        List<List<T>> resultado = new ArrayList<>();
        subconjuntosDesde(xs, 0, new ArrayList<>(), resultado);
        return resultado;
    }

    /**
     * Ayudante de subconjuntos(): explora los subconjuntos que extienden `actual` con elementos desde `inicio`.
     *
     * @complejidad Tiempo O(n · 2ⁿ) en total; espacio O(n) de pila más el resultado.
     * @explicacion Se guarda una COPIA de `actual` (si se guardara la propia lista, los cambios posteriores del
     * backtracking la alterarían). Después se prueba cada elemento restante: añadir, recursar con `i + 1` (así no se
     * repite ni se reordena) y quitar el último.
     * @bigo exp
     */
    private static <T> void subconjuntosDesde(List<T> xs, int inicio, List<T> actual, List<List<T>> resultado) {
        resultado.add(new ArrayList<>(actual));
        for (int i = inicio; i < xs.size(); i++) {
            actual.add(xs.get(i));
            subconjuntosDesde(xs, i + 1, actual, resultado);
            actual.remove(actual.size() - 1);
        }
    }

    /**
     * Torres de Hanoi.
     *
     * @complejidad Tiempo O(2ⁿ); espacio O(2ⁿ) por la lista de movimientos (la pila es O(n)).
     * @explicacion Para mover n discos: 1) pasar los n−1 de arriba al auxiliar, 2) mover el grande al destino, 3)
     * pasar los n−1 del auxiliar al destino. Cada llamada hace dos subllamadas de tamaño n−1, de ahí los 2ⁿ − 1
     * movimientos (y no se puede hacer en menos: es óptimo). El ayudante acumula en una lista compartida para no crear
     * una lista nueva por llamada.
     * @alternativas Existe una solución iterativa (alternar el movimiento legal del disco más pequeño con el único
     * otro movimiento posible), pero la recursiva es mucho más clara.
     */
    static List<String> hanoi(int n, String origen, String auxiliar, String destino) {
        List<String> movimientos = new ArrayList<>();
        moverDiscos(n, origen, auxiliar, destino, movimientos);
        return movimientos;
    }

    /**
     * Ayudante de hanoi(): añade a `movimientos` los pasos para mover n discos.
     *
     * @complejidad Tiempo O(2ⁿ); espacio O(n) de pila más los movimientos.
     * @explicacion Caso base n <= 0: nada que mover. Si no, n−1 al auxiliar, el disco grande y n−1 al destino, con
     * los papeles de las tres torres rotados en cada subllamada.
     * @bigo exp
     */
    private static void moverDiscos(int n, String origen, String auxiliar, String destino, List<String> movimientos) {
        if (n <= 0) {
            return;
        }
        moverDiscos(n - 1, origen, destino, auxiliar, movimientos);
        movimientos.add(origen + "→" + destino);
        moverDiscos(n - 1, auxiliar, origen, destino, movimientos);
    }
}
