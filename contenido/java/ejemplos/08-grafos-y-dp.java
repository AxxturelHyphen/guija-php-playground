import java.util.*;

/*
 * TEMA 8 · GRAFOS Y PROGRAMACIÓN DINÁMICA
 * ────────────────────────────────────────────────────────────────────────────
 * GRAFOS: nodos unidos por aristas. Mapas, redes sociales, dependencias entre paquetes (Maven, Gradle), rutas...
 *
 * Se representan casi siempre con una LISTA DE ADYACENCIA: un Map que a cada nodo le asocia sus vecinos.
 *      Map<String, List<String>>:  A → [B, C],  B → [D],  C → [D],  D → []
 * Si las aristas tienen peso: Map<String, Map<String, Integer>>  (A → {B: 4, C: 1}).
 *
 *   Algoritmo           Estructura           Para qué sirve                          Coste (V nodos, E aristas)
 *   BFS (anchura)       cola (ArrayDeque)    camino con MENOS aristas, niveles       O(V + E)
 *   DFS (profundidad)   pila / recursión     componentes, ciclos, islas, orden       O(V + E)
 *   Orden topológico    cola + grados        ordenar tareas con dependencias         O(V + E)
 *   Dijkstra            PriorityQueue        camino de MENOR PESO (pesos ≥ 0)        O((V + E) log V)
 *
 * PROGRAMACIÓN DINÁMICA (DP): cuando un problema se descompone en subproblemas que SE REPITEN, se resuelve cada
 * uno una sola vez y se guarda su resultado. Dos formas equivalentes:
 *   - de arriba abajo: recursión + memoización (lo del tema 4).
 *   - de abajo arriba ("tabulación"): rellenar una tabla desde los casos pequeños. Suele ser más rápida y no
 *     agota la pila de llamadas (StackOverflowError).
 * Receta: (1) define QUÉ significa cada celda de la tabla, (2) escribe cómo se calcula a partir de las anteriores,
 * (3) fija los casos base, (4) decide en qué orden rellenarla.
 */
class GrafosYDp {

    static void titulo(String texto) {
        System.out.println("\n=== " + texto + " ===");
    }

    static int[] arr(int... v) {
        return v;
    }

    /** Un Map con el orden de inserción: mapa("A", x, "B", y) → {A=x, B=y}. Ayuda a escribir grafos y resultados esperados. */
    @SuppressWarnings("unchecked")
    static <V> Map<String, V> mapa(Object... clavesYValores) {
        Map<String, V> m = new LinkedHashMap<>();
        for (int i = 0; i < clavesYValores.length; i += 2) {
            m.put((String) clavesYValores[i], (V) clavesYValores[i + 1]);
        }
        return m;
    }

    /** Lista de aristas desde pares sueltos: aristas("A", "B", "A", "C") → [[A, B], [A, C]]. */
    static List<List<String>> aristas(String... pares) {
        List<List<String>> r = new ArrayList<>();
        for (int i = 0; i < pares.length; i += 2) {
            r.add(List.of(pares[i], pares[i + 1]));
        }
        return r;
    }

    /** BFS: visita por "capas": primero los vecinos, luego los vecinos de los vecinos... */
    static List<String> recorridoAnchura(Map<String, List<String>> grafo, String inicio) {
        Set<String> visitados = new HashSet<>(Set.of(inicio));
        Deque<String> cola = new ArrayDeque<>(List.of(inicio));
        List<String> orden = new ArrayList<>();
        while (!cola.isEmpty()) {
            String nodo = cola.poll();                     // poll() es O(1); ArrayList.remove(0) sería O(n)
            orden.add(nodo);
            for (String vecino : grafo.getOrDefault(nodo, List.of())) {
                if (visitados.add(vecino)) {               // add() devuelve false si ya estaba: marcar al ENCOLAR evita meterlo dos veces
                    cola.offer(vecino);
                }
            }
        }
        return orden;
    }

    /** DFS: se mete todo lo que se pueda por un camino antes de probar otro. */
    static void recorridoProfundidad(Map<String, List<String>> grafo, String nodo, Set<String> visitados, List<String> orden) {
        visitados.add(nodo);
        orden.add(nodo);
        for (String vecino : grafo.getOrDefault(nodo, List.of())) {
            if (!visitados.contains(vecino)) {
                recorridoProfundidad(grafo, vecino, visitados, orden);
            }
        }
    }

    static long fibIngenuo(int n, long[] llamadas) {
        llamadas[0]++;
        return n < 2 ? n : fibIngenuo(n - 1, llamadas) + fibIngenuo(n - 2, llamadas);
    }

    static long fibMemo(int n, Map<Integer, Long> memo, long[] llamadas) {
        llamadas[0]++;
        if (n < 2) {
            return n;
        }
        Long guardado = memo.get(n);                       // get/put a mano: computeIfAbsent recursivo lanzaría ConcurrentModificationException
        if (guardado != null) {
            return guardado;
        }
        long valor = fibMemo(n - 1, memo, llamadas) + fibMemo(n - 2, memo, llamadas);
        memo.put(n, valor);
        return valor;
    }

    static long fibTabla(int n) {
        long[] tabla = new long[Math.max(n + 1, 2)];
        tabla[1] = 1;
        for (int i = 2; i <= n; i++) {
            tabla[i] = tabla[i - 1] + tabla[i - 2];        // cada celda depende solo de las dos anteriores
        }
        return tabla[n];
    }

    static long caminosEnCuadricula(int filas, int columnas) {
        long[][] tabla = new long[filas][columnas];
        for (long[] fila : tabla) {
            Arrays.fill(fila, 1);                          // primera fila y columna: solo 1 camino
        }
        for (int f = 1; f < filas; f++) {
            for (int c = 1; c < columnas; c++) {
                tabla[f][c] = tabla[f - 1][c] + tabla[f][c - 1];
            }
        }
        return tabla[filas - 1][columnas - 1];
    }

    // ════════════════════════════════════════════════════════════════════════════
    // EJERCICIOS · GRAFOS
    // ════════════════════════════════════════════════════════════════════════════

    // ── Ejercicio 1 · construirGrafo ────────────────────────────────────────────
    /**
     * Construye la lista de adyacencia a partir de una lista de aristas [origen, destino].
     *  - No dirigido (construirGrafo(aristas)): cada arista cuenta en los dos sentidos.
     *  - Dirigido (dirigido = true): solo origen → destino, pero el destino TAMBIÉN aparece como nodo (con lista vacía).
     * Los nodos salen en el orden en que aparecen por primera vez (usa LinkedHashMap, no HashMap) y los vecinos en
     * el orden de las aristas. Java no tiene parámetros por defecto: la sobrecarga de un solo parámetro ya existe.
     *   construirGrafo([[A,B],[A,C]])  →  {A=[B, C], B=[A], C=[A]}
     */
    static Map<String, List<String>> construirGrafo(List<List<String>> aristas, boolean dirigido) {
        return pendiente();
    }

    static Map<String, List<String>> construirGrafo(List<List<String>> aristas) {
        return construirGrafo(aristas, false);
    }

    // ── Ejercicio 2 · bfsCaminoMasCorto ─────────────────────────────────────────
    /**
     * Camino con MENOS aristas entre dos nodos de una lista de adyacencia, como lista de nodos
     * (incluidos origen y destino), o null si no hay camino. Si origen es igual a destino devuelve [origen].
     * Ante varios caminos igual de cortos vale el que se descubre antes (según el orden de los vecinos).
     * Pista: BFS con un ArrayDeque guardando de qué nodo vienes (`padre.put(vecino, nodo)`) y reconstruye el camino
     * hacia atrás. Un origen que no es clave del grafo → null.
     */
    static List<String> bfsCaminoMasCorto(Map<String, List<String>> grafo, String origen, String destino) {
        return pendiente();
    }

    // ── Ejercicio 3 · contarIslas ───────────────────────────────────────────────
    /**
     * Cuenta las "islas" de un mapa: grupos de '1' (tierra) conectados en horizontal o vertical (NO en diagonal),
     * rodeados de '0' (agua). El mapa es una lista de filas de texto.
     *   ["11000", "11000", "00100", "00011"]  →  3
     * Pista: recorre las celdas; al encontrar tierra sin visitar, suma 1 y "hunde" toda su isla con DFS/BFS
     * (con una pila explícita, un ArrayDeque, para que no se desborde con mapas grandes: la recursión daría
     * StackOverflowError en una isla de 40.000 celdas).
     */
    static int contarIslas(List<String> mapa) {
        return pendiente();
    }

    // ── Ejercicio 4 · ordenTopologico ───────────────────────────────────────────
    /**
     * Ordena tareas con dependencias de modo que cada tarea aparezca DESPUÉS de todas aquellas de las que depende.
     * Es lo que hace Maven o Gradle al construir módulos. Entrada: {tarea=[dependencia1, ...]}; una dependencia
     * puede no aparecer como clave (es una tarea sin dependencias). Devuelve todas las tareas.
     * Si hay un ciclo (a necesita b y b necesita a) lanza IllegalStateException.
     * Algoritmo de Kahn: cuenta cuántas dependencias pendientes tiene cada tarea; saca las que tienen 0 y, al sacarlas,
     * descuenta una a las tareas que dependían de ellas. Si al acabar quedan tareas sin sacar, había un ciclo. O(V + E).
     */
    static List<String> ordenTopologico(Map<String, List<String>> dependencias) {
        return pendiente();
    }

    // ── Ejercicio 5 · dijkstra ──────────────────────────────────────────────────
    /**
     * Distancia mínima desde un origen a todos los nodos ALCANZABLES de un grafo con pesos:
     * {A={B=4, C=1}, ...}. Devuelve {nodo=distancia} ordenado por nodo (un TreeMap); los
     * inalcanzables no aparecen. Un peso negativo lanza IllegalArgumentException (Dijkstra no lo soporta).
     * Usa una PriorityQueue de pares (nodo, distancia) con comparador por distancia, y descarta las entradas "viejas"
     * (si sacas un nodo con una distancia peor que la ya conocida, sáltalo): PriorityQueue no tiene "bajar la prioridad",
     * así que se inserta una entrada nueva en vez de actualizar la vieja. O((V + E) log V).
     */
    static Map<String, Integer> dijkstra(Map<String, Map<String, Integer>> grafo, String origen) {
        return pendiente();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // EJERCICIOS · PROGRAMACIÓN DINÁMICA
    // ════════════════════════════════════════════════════════════════════════════

    // ── Ejercicio 6 · escaleras ─────────────────────────────────────────────────
    /**
     * ¿De cuántas formas se sube una escalera de n peldaños dando pasos de 1 o 2? (escaleras(0) = 1, escaleras(1) = 1,
     * escaleras(2) = 2, escaleras(3) = 3, escaleras(5) = 8...). Valores negativos → IllegalArgumentException.
     * Es Fibonacci disfrazado: pasos(n) = pasos(n-1) + pasos(n-2). Hazlo en O(n) de tiempo y O(1) de espacio
     * guardando solo las dos últimas celdas.
     * Trampa de Java: un long solo llega a escaleras(91); con n = 92 la suma desborda EN SILENCIO y da un número
     * negativo. Usa Math.addExact, que lanza ArithmeticException.
     */
    static long escaleras(int n) {
        return pendiente();
    }

    // ── Ejercicio 7 · cambioMonedas ─────────────────────────────────────────────
    /**
     * Menor número de monedas que suman exactamente `objetivo`, o -1 si es imposible. Cada moneda se puede usar
     * todas las veces que haga falta. Una cantidad negativa → IllegalArgumentException.
     * ¡El algoritmo voraz (coger siempre la moneda mayor) FALLA! Con {1, 3, 4} y 6 daría 4+1+1 (3 monedas) y lo mejor
     * es 3+3 (2). Tabla: `minimo[c]` = monedas necesarias para sumar c; minimo[0] = 0;
     * minimo[c] = 1 + min(minimo[c - moneda]) para cada moneda ≤ c. O(objetivo · monedas).
     * Cuidado al marcar "imposible" con Integer.MAX_VALUE: sumarle 1 desborda y da un número negativo.
     */
    static int cambioMonedas(int[] monedas, int objetivo) {
        return pendiente();
    }

    // ── Ejercicio 8 · mochila 0/1 ───────────────────────────────────────────────
    /**
     * Mochila 0/1: cada objeto tiene un peso y un valor y se coge entero o no se coge. Devuelve el mayor valor
     * posible sin pasar de la capacidad. Arrays de distinta longitud → IllegalArgumentException.
     * Tabla de una dimensión: `mejor[w]` = mayor valor con capacidad w. Para cada objeto recorre w de MAYOR a menor
     * (si fuera de menor a mayor, usarías el mismo objeto varias veces): mejor[w] = max(mejor[w], mejor[w - peso] + valor).
     * O(objetos · capacidad).
     */
    static int mochila(int[] pesos, int[] valores, int capacidad) {
        return pendiente();
    }

    // ── Ejercicio 9 · lcs (subsecuencia común más larga) ────────────────────────
    /**
     * Longitud de la subsecuencia común más larga de dos textos (los caracteres no tienen por qué ser contiguos, pero
     * sí mantener el orden). "ABCBDAB" y "BDCABA" → 4 ("BCBA"). Tabla de (n+1)×(m+1): si los caracteres coinciden,
     * tabla[i][j] = tabla[i-1][j-1] + 1; si no, max(tabla[i-1][j], tabla[i][j-1]). Es el núcleo del comando `diff`.
     * O(n·m) de tiempo; como cada fila solo mira la anterior, basta con DOS filas (espacio O(m)).
     */
    static int lcs(String a, String b) {
        return pendiente();
    }

    // ── Ejercicio 10 · distanciaEdicion ─────────────────────────────────────────
    /**
     * Distancia de Levenshtein: mínimo de inserciones, borrados y sustituciones de un carácter para convertir `a` en `b`.
     * "kitten" → "sitting" = 3. Java no trae esta función: las pruebas la comparan con una versión recursiva con memoria.
     * tabla[i][j] = distancia entre los i primeros caracteres de `a` y los j primeros de `b`;
     * tabla[i][0] = i; tabla[0][j] = j; y si coinciden: tabla[i-1][j-1], si no: 1 + min(borrar, insertar, sustituir).
     */
    static int distanciaEdicion(String a, String b) {
        return pendiente();
    }

    /** ¿Es `orden` una ordenación topológica válida de `deps`? (hay varias válidas, por eso no se compara con una lista fija). */
    static boolean esOrdenValido(Map<String, List<String>> deps, List<String> orden) {
        Set<String> nodos = new HashSet<>();
        deps.forEach((tarea, ds) -> {
            nodos.add(tarea);
            nodos.addAll(ds);
        });
        if (orden.size() != nodos.size() || new HashSet<>(orden).size() != orden.size()) {
            return false;
        }
        Map<String, Integer> posicion = new HashMap<>();
        for (int i = 0; i < orden.size(); i++) {
            posicion.put(orden.get(i), i);
        }
        for (var e : deps.entrySet()) {
            for (String d : e.getValue()) {
                Integer pd = posicion.get(d);
                Integer pt = posicion.get(e.getKey());
                if (pd == null || pt == null || pd >= pt) {
                    return false;
                }
            }
        }
        return true;
    }

    /** Referencia para las pruebas de distanciaEdicion: recursión con memoria (la otra forma de hacer DP). */
    static int levenshteinReferencia(String a, String b, int i, int j, int[][] memo) {
        if (i == 0) {
            return j;
        }
        if (j == 0) {
            return i;
        }
        if (memo[i][j] >= 0) {
            return memo[i][j];
        }
        int r = a.charAt(i - 1) == b.charAt(j - 1)
            ? levenshteinReferencia(a, b, i - 1, j - 1, memo)
            : 1 + Math.min(levenshteinReferencia(a, b, i - 1, j, memo),
                Math.min(levenshteinReferencia(a, b, i, j - 1, memo), levenshteinReferencia(a, b, i - 1, j - 1, memo)));
        memo[i][j] = r;
        return r;
    }

    /** Mapa pseudoaleatorio de unas n celdas (lado = raíz de n). */
    static List<String> mapaAleatorio(int n) {
        int lado = Math.max(2, (int) Math.sqrt(n));
        long x = 4242;
        List<String> filas = new ArrayList<>();
        for (int f = 0; f < lado; f++) {
            StringBuilder fila = new StringBuilder();
            for (int c = 0; c < lado; c++) {
                x = (x * 1103515245L + 12345) & 0x7fffffffL;
                fila.append((x >> 8) % 100 < 55 ? '1' : '0');
            }
            filas.add(fila.toString());
        }
        return filas;
    }

    /** Grafo ponderado de n nodos: una cadena y un salto "aleatorio" desde cada nodo (unas 2n aristas). */
    static Map<String, Map<String, Integer>> grafoPonderado(int n) {
        Map<String, Map<String, Integer>> g = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            Map<String, Integer> vecinos = new LinkedHashMap<>();
            vecinos.put("n" + ((i + 1) % n), 1 + i % 5);
            vecinos.put("n" + ((i * 7 + 3) % n), 2 + i % 3);
            g.put("n" + i, vecinos);
        }
        return g;
    }

    static String textoAleatorio(int n, long semilla) {
        long x = semilla;
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < n; i++) {
            x = (x * 1103515245L + 12345) & 0x7fffffffL;
            s.append((char) ('a' + (x >> 8) % 4));
        }
        return s.toString();
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
            escaleras(85);
        }
    }

    public static void main(String[] args) {

// ════════════════════════════════════════════════════════════════════════════
// 1. RECORRER UN GRAFO: ANCHURA (BFS) Y PROFUNDIDAD (DFS)
// ════════════════════════════════════════════════════════════════════════════
        titulo("1. BFS y DFS");

        Map<String, List<String>> ciudades = mapa(
            "Madrid", List.of("Toledo", "Zaragoza", "Valencia"),
            "Toledo", List.of("Madrid", "Sevilla"),
            "Zaragoza", List.of("Madrid", "Barcelona"),
            "Valencia", List.of("Madrid", "Barcelona"),
            "Sevilla", List.of("Toledo"),
            "Barcelona", List.of("Zaragoza", "Valencia"));

        List<String> dfs = new ArrayList<>();
        recorridoProfundidad(ciudades, "Madrid", new HashSet<>(), dfs);
        System.out.println("BFS desde Madrid: " + String.join(" → ", recorridoAnchura(ciudades, "Madrid")));
        System.out.println("DFS desde Madrid: " + String.join(" → ", dfs));
        // Sin el conjunto de "visitados" un grafo con ciclos (Madrid ↔ Toledo) se recorrería PARA SIEMPRE.

// ════════════════════════════════════════════════════════════════════════════
// 2. POR QUÉ LA PD: FIBONACCI DE TRES FORMAS
// ════════════════════════════════════════════════════════════════════════════
        titulo("2. Memoización y tabulación");

        long[] llamadas = {0};
        long resultado = fibIngenuo(22, llamadas);
        System.out.println("ingenuo  fib(22) = " + resultado + " con " + llamadas[0] + " llamadas");
        llamadas[0] = 0;
        resultado = fibMemo(22, new HashMap<>(), llamadas);
        System.out.println("memo     fib(22) = " + resultado + " con " + llamadas[0] + " llamadas");
        System.out.println("tabla    fib(22) = " + fibTabla(22) + " con un solo bucle");
        // Como la tabla solo mira las dos últimas celdas, se puede guardar solo ESAS (espacio O(1)): lo harás en `escaleras`.

// ════════════════════════════════════════════════════════════════════════════
// 3. PD EN UNA TABLA: CAMINOS EN UNA CUADRÍCULA
// ════════════════════════════════════════════════════════════════════════════
        // ¿De cuántas formas se llega a la esquina inferior derecha moviéndose solo a la derecha o hacia abajo?
        //  celda(f, c) = celda(f-1, c) + celda(f, c-1)        (se llega desde arriba o desde la izquierda)
        titulo("3. Caminos en una cuadrícula");

        System.out.println("caminos en 3×3: " + caminosEnCuadricula(3, 3) + " · en 10×10: " + caminosEnCuadricula(10, 10));

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

        prueba("construirGrafo",
            caso("no dirigido", mapa("A", List.of("B", "C"), "B", List.of("A"), "C", List.of("A")), aristas("A", "B", "A", "C")),
            caso("dirigido", mapa("A", List.of("B", "C"), "B", List.of(), "C", List.of()), aristas("A", "B", "A", "C"), true),
            caso("sin aristas", mapa(), aristas()),
            caso("orden de aparición", mapa("B", List.of("A"), "A", List.of("B")), aristas("B", "A")),
            caso("cadena dirigida", mapa("a", List.of("b"), "b", List.of("c"), "c", List.of()), aristas("a", "b", "b", "c"), true),
            caso("ciclo no dirigido", mapa("x", List.of("y", "z"), "y", List.of("x", "z"), "z", List.of("y", "x")), aristas("x", "y", "y", "z", "z", "x")));

        Map<String, List<String>> mapaCiudades = mapa("Madrid", List.of("Toledo", "Zaragoza"), "Toledo", List.of("Madrid", "Sevilla"),
            "Zaragoza", List.of("Madrid", "Barcelona"), "Sevilla", List.of("Toledo"), "Barcelona", List.of("Zaragoza"), "Isla", List.of());

        prueba("bfsCaminoMasCorto",
            caso("directo", List.of("Madrid", "Toledo"), mapaCiudades, "Madrid", "Toledo"),
            caso("dos saltos", List.of("Madrid", "Toledo", "Sevilla"), mapaCiudades, "Madrid", "Sevilla"),
            caso("tres saltos", List.of("Sevilla", "Toledo", "Madrid", "Zaragoza", "Barcelona"), mapaCiudades, "Sevilla", "Barcelona"),
            caso("mismo nodo", List.of("Madrid"), mapaCiudades, "Madrid", "Madrid"),
            caso("sin camino", null, mapaCiudades, "Madrid", "Isla"),
            caso("el origen no existe", null, mapaCiudades, "Narnia", "Madrid"),
            caso("elige el más corto, no el primero", List.of("A", "D", "E"),
                mapa("A", List.of("B", "D"), "B", List.of("C"), "C", List.of("E"), "D", List.of("E"), "E", List.of()), "A", "E"),
            caso("con ciclos no se cuelga", List.of("A", "B", "C"),
                mapa("A", List.of("B"), "B", List.of("A", "C"), "C", List.of("B")), "A", "C"));

        prueba("contarIslas",
            caso("ejemplo", 3, List.of("11000", "11000", "00100", "00011")),
            caso("sin mapa", 0, List.of()),
            caso("todo agua", 0, List.of("000", "000")),
            caso("todo tierra", 1, List.of("111", "111")),
            caso("diagonales no conectan", 2, List.of("10", "01")),
            caso("en forma de U", 1, List.of("101", "101", "111")),
            caso("tablero de ajedrez 3×3", 5, List.of("101", "010", "101")),
            caso("una fila", 3, List.of("1011011")),
            caso("una columna", 2, List.of("1", "0", "1", "1")),
            caso("mapa grande", 1, Collections.nCopies(200, "1".repeat(200))));

        grupo("ordenTopologico");
        comprueba("cadena", () -> ordenTopologico(mapa("app", List.of("framework"), "framework", List.of("util"), "util", List.of())),
            List.of("util", "framework", "app"));
        comprueba("dependencia que no es clave", () -> ordenTopologico(mapa("a", List.of("b"))), List.of("b", "a"));
        comprueba("sin tareas", () -> ordenTopologico(mapa()), List.of());
        comprueba("diamante: orden válido", () -> {
            Map<String, List<String>> d = mapa("app", List.of("http", "db"), "http", List.of("util"), "db", List.of("util"), "util", List.of());
            return esOrdenValido(d, ordenTopologico(d));
        }, true);
        comprueba("tareas independientes aparecen todas", () -> {
            Map<String, List<String>> d = mapa("x", List.of(), "y", List.of(), "z", List.of());
            return esOrdenValido(d, ordenTopologico(d));
        }, true);
        comprueba("maven: grafo de módulos", () -> {
            Map<String, List<String>> d = mapa(
                "spring-web", List.of("spring-core", "jackson", "slf4j"),
                "spring-core", List.of("slf4j", "commons-lang"),
                "jackson", List.of("slf4j"),
                "commons-lang", List.of(),
                "mi-app", List.of("spring-web", "jackson"));
            return esOrdenValido(d, ordenTopologico(d));
        }, true);
        comprueba("lista larga sin ciclos", () -> {
            Map<String, List<String>> d = new LinkedHashMap<>();
            for (int i = 1; i <= 2000; i++) {
                d.put("t" + i, i > 1 ? List.of("t" + i / 2) : List.of());
            }
            return esOrdenValido(d, ordenTopologico(d));
        }, true);
        lanza("ciclo de dos", () -> ordenTopologico(mapa("a", List.of("b"), "b", List.of("a"))), IllegalStateException.class);
        lanza("se necesita a sí misma", () -> ordenTopologico(mapa("a", List.of("a"))), IllegalStateException.class);
        lanza("ciclo escondido al final", () -> ordenTopologico(mapa("a", List.of(), "b", List.of("c"), "c", List.of("d"), "d", List.of("b"))),
            IllegalStateException.class);

        Map<String, Map<String, Integer>> red = mapa("A", mapa("B", 4, "C", 1), "B", mapa("D", 1), "C", mapa("B", 2, "D", 5), "D", mapa(), "Z", mapa("A", 1));

        prueba("dijkstra",
            caso("caso clásico", mapa("A", 0, "B", 3, "C", 1, "D", 4), red, "A"),
            caso("el atajo gana al directo", mapa("A", 0, "B", 2, "C", 1), mapa("A", mapa("B", 10, "C", 1), "C", mapa("B", 1)), "A"),
            caso("solo el origen", mapa("A", 0), mapa("A", mapa()), "A"),
            caso("inalcanzables no aparecen", mapa("D", 0), red, "D"),
            caso("nodo que solo es destino", mapa("A", 0, "B", 2), mapa("A", mapa("B", 2)), "A"),
            caso("pesos cero", mapa("A", 0, "B", 0, "C", 0), mapa("A", mapa("B", 0), "B", mapa("C", 0)), "A"),
            caso("desde otro origen", mapa("A", 1, "B", 4, "C", 2, "D", 5, "Z", 0), red, "Z"));
        grupo("dijkstra (casos especiales)");
        lanza("peso negativo", () -> dijkstra(mapa("A", mapa("B", -1)), "A"), IllegalArgumentException.class);
        comprueba("cuadrícula 30×30 de pesos 1: la esquina opuesta está a 58", () -> {
            Map<String, Map<String, Integer>> g = new LinkedHashMap<>();
            for (int f = 0; f < 30; f++) {
                for (int c = 0; c < 30; c++) {
                    Map<String, Integer> vecinos = new LinkedHashMap<>();
                    if (f + 1 < 30) {
                        vecinos.put((f + 1) + "," + c, 1);
                    }
                    if (c + 1 < 30) {
                        vecinos.put(f + "," + (c + 1), 1);
                    }
                    g.put(f + "," + c, vecinos);
                }
            }
            return dijkstra(g, "0,0").get("29,29");
        }, 58);

        prueba("escaleras",
            caso("n = 0", 1L, 0),
            caso("n = 1", 1L, 1),
            caso("n = 2", 2L, 2),
            caso("n = 3", 3L, 3),
            caso("n = 5", 8L, 5),
            caso("n = 10", 89L, 10),
            caso("n = 40", 165580141L, 40),
            caso("n = 80 (sin desbordar)", 37889062373143906L, 80),
            caso("n = 91 (el último que cabe en un long)", 7540113804746346429L, 91));
        grupo("escaleras()");
        lanza("negativo", () -> escaleras(-1), IllegalArgumentException.class);
        lanza("n = 92 desborda un long", () -> escaleras(92), ArithmeticException.class);

        prueba("cambioMonedas",
            caso("ejemplo básico", 3, arr(1, 2, 5), 11),
            caso("el voraz falla", 2, arr(1, 3, 4), 6),
            caso("imposible", -1, arr(2), 3),
            caso("objetivo 0", 0, arr(1, 2), 0),
            caso("sin monedas", -1, arr(), 5),
            caso("una moneda exacta", 1, arr(7), 7),
            caso("monedas europeas", 7, arr(1, 2, 5, 10, 20, 50, 100, 200), 387),
            caso("moneda mayor que el objetivo", -1, arr(5, 10), 3),
            caso("objetivo grande", 405, arr(1, 5, 10, 25), 9999));
        grupo("cambioMonedas()");
        lanza("cantidad negativa", () -> cambioMonedas(arr(1), -1), IllegalArgumentException.class);

        prueba("mochila",
            caso("clásico", 9, arr(1, 3, 4, 5), arr(1, 4, 5, 7), 7),
            caso("capacidad 0", 0, arr(1, 2), arr(10, 20), 0),
            caso("todo cabe", 28, arr(1, 2, 3), arr(6, 10, 12), 10),
            caso("ningún objeto cabe", 0, arr(5, 6), arr(10, 20), 4),
            caso("no se reutilizan objetos", 3, arr(2), arr(3), 10),
            caso("sin objetos", 0, arr(), arr(), 5),
            caso("elegir bien", 220, arr(10, 20, 30), arr(60, 100, 120), 50));
        grupo("mochila()");
        lanza("longitudes distintas", () -> mochila(arr(1, 2), arr(3), 5), IllegalArgumentException.class);

        prueba("lcs",
            caso("clásico", 4, "ABCBDAB", "BDCABA"),
            caso("iguales", 3, "abc", "abc"),
            caso("nada en común", 0, "abc", "def"),
            caso("una vacía", 0, "", "abc"),
            caso("ambas vacías", 0, "", ""),
            caso("subsecuencia", 4, "AGGTAB", "GXTXAYB"),
            caso("una dentro de otra", 3, "ace", "abcde"),
            caso("distinta longitud", 1, "a", "aaaaaaaa"));

        grupo("distanciaEdicion");
        comprueba("kitten → sitting", () -> distanciaEdicion("kitten", "sitting"), 3);
        comprueba("horse → ros", () -> distanciaEdicion("horse", "ros"), 3);
        comprueba("intention → execution", () -> distanciaEdicion("intention", "execution"), 5);
        comprueba("iguales", () -> distanciaEdicion("java", "java"), 0);
        comprueba("desde vacío", () -> distanciaEdicion("", "abc"), 3);
        comprueba("a vacío", () -> distanciaEdicion("abcd", ""), 4);
        comprueba("es simétrica", () -> distanciaEdicion("sábado", "domingo") == distanciaEdicion("domingo", "sábado"), true);
        comprueba("coincide con la versión recursiva en 200 pares", () -> {
            long[] x = {11};
            java.util.function.IntFunction<String> palabra = largo -> {
                StringBuilder s = new StringBuilder();
                for (int i = 0; i < largo; i++) {
                    x[0] = (x[0] * 1103515245L + 12345) & 0x7fffffffL;
                    s.append((char) ('a' + x[0] % 5));
                }
                return s.toString();
            };
            for (int i = 0; i < 200; i++) {
                String a = palabra.apply(i % 9);
                String b = palabra.apply((i * 7) % 11);
                int[][] memo = new int[a.length() + 1][b.length() + 1];
                for (int[] fila : memo) {
                    Arrays.fill(fila, -1);
                }
                if (distanciaEdicion(a, b) != levenshteinReferencia(a, b, a.length(), b.length(), memo)) {
                    return "falla con '" + a + "' y '" + b + "'";
                }
            }
            return "ok";
        }, "ok");

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        medir("contarIslas", n -> args(mapaAleatorio(n)));                                  // O(celdas)
        medir("dijkstra", n -> args(grafoPonderado(n), "n0"));                              // O((V+E) log V)
        // escaleras: una sola llamada tarda nanosegundos (el reloj no la distingue del ruido), así que cada repetición
        // hace 1000 llamadas seguidas; y calentar() deja la JVM caliente antes de empezar.
        medir("escaleras", n -> {
            calentar();
            return n;
        }, n -> {
            for (int i = 0; i < 1000; i++) {
                escaleras(n);
            }
        }, "lineal", rango(5, 85, 5));                                                      // O(n)
        medir("cambioMonedas", n -> args(arr(1, 5, 10, 25), n));                            // O(objetivo · monedas)
        medir("mochila", n -> args(rango(1, 20), rango(21, 40), n));                        // O(objetos · capacidad)
        medir("lcs", n -> args(textoAleatorio(n, 1), textoAleatorio(n, 2)));                // O(n²)
        medir("distanciaEdicion", n -> args(textoAleatorio(n, 3), textoAleatorio(n, 4)));   // O(n²)
    }
}
