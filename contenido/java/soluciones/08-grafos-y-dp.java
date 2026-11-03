/*
 * SOLUCIONES · Tema 8 · Grafos y programación dinámica
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
class Soluciones {

    /**
     * Construir una lista de adyacencia.
     *
     * @complejidad Tiempo O(E); espacio O(V + E).
     * @explicacion Se recorren las aristas una vez. `computeIfAbsent(a, k -> new ArrayList<>())` crea la lista de un nodo
     * la primera vez que aparece. En un grafo dirigido el destino hay que registrarlo EXPLÍCITAMENTE (con
     * `computeIfAbsent`), o los nodos sin salidas no aparecerían como claves. Un `LinkedHashMap` conserva el orden de
     * primera aparición; un `HashMap` lo perdería.
     * @alternativas Una matriz de adyacencia (V×V) ocupa O(V²) y solo compensa en grafos muy densos; buscar si existe una
     * arista concreta es O(1), pero listar los vecinos de un nodo es O(V).
     */
    static Map<String, List<String>> construirGrafo(List<List<String>> aristas, boolean dirigido) {
        Map<String, List<String>> grafo = new LinkedHashMap<>();
        for (List<String> arista : aristas) {
            String a = arista.get(0);
            String b = arista.get(1);
            grafo.computeIfAbsent(a, k -> new ArrayList<>()).add(b);
            if (dirigido) {
                grafo.computeIfAbsent(b, k -> new ArrayList<>());
            } else {
                grafo.computeIfAbsent(b, k -> new ArrayList<>()).add(a);
            }
        }
        return grafo;
    }

    /**
     * Camino más corto en aristas (BFS).
     *
     * @complejidad Tiempo O(V + E); espacio O(V).
     * @explicacion BFS visita los nodos por distancia creciente: primero los que están a 1 arista, luego a 2... Por eso
     * la PRIMERA vez que se descubre un nodo es por un camino mínimo. Se guarda de quién se viene (`padre`) y, al
     * llegar al destino, se reconstruye el camino hacia atrás. `padre` hace también de conjunto de visitados. La cola es un
     * `ArrayDeque`: `poll()` es O(1), mientras que `ArrayList.remove(0)` sería O(n) por llamada.
     * @alternativas DFS NO garantiza el camino más corto. Con pesos hace falta Dijkstra. BFS desde ambos extremos a la vez
     * reduce mucho el trabajo en grafos enormes.
     */
    static List<String> bfsCaminoMasCorto(Map<String, List<String>> grafo, String origen, String destino) {
        if (!grafo.containsKey(origen)) {
            return null;
        }
        Map<String, String> padre = new HashMap<>();
        padre.put(origen, null);                              // HashMap admite valores null; ArrayDeque no
        Deque<String> cola = new ArrayDeque<>();
        cola.offer(origen);
        while (!cola.isEmpty()) {
            String nodo = cola.poll();
            if (nodo.equals(destino)) {
                return reconstruir(padre, destino);
            }
            for (String vecino : grafo.getOrDefault(nodo, List.of())) {
                if (!padre.containsKey(vecino)) {
                    padre.put(vecino, nodo);
                    cola.offer(vecino);
                }
            }
        }
        return null;
    }

    /**
     * Ayudante de bfsCaminoMasCorto(): sigue los padres desde el destino hasta el origen.
     *
     * @complejidad Tiempo O(longitud del camino); espacio O(longitud del camino).
     * @explicacion Se añaden los nodos de atrás hacia delante y se invierte la lista al final.
     * @bigo n
     */
    private static List<String> reconstruir(Map<String, String> padre, String destino) {
        List<String> camino = new ArrayList<>();
        for (String n = destino; n != null; n = padre.get(n)) {
            camino.add(n);
        }
        Collections.reverse(camino);
        return camino;
    }

    /**
     * Contar islas con DFS iterativo.
     *
     * @complejidad Tiempo O(F·C); espacio O(F·C) en el peor caso (la pila y los visitados).
     * @bigo n
     * @explicacion Se recorren todas las celdas una vez. Al encontrar una '1' sin visitar se suma una isla y se "hunde"
     * entera: con una pila explícita (`ArrayDeque`) se marcan como visitadas todas las '1' conectadas en las cuatro
     * direcciones. Cada celda entra en la pila a lo sumo una vez porque se marca al apilarla. La pila explícita evita el
     * StackOverflowError que daría la recursión en una isla de decenas de miles de celdas.
     * @alternativas DFS recursivo: más corto, pero se queda sin pila en islas enormes. BFS: mismo coste. Union-Find: útil si
     * las celdas cambian con el tiempo.
     */
    static int contarIslas(List<String> mapa) {
        int filas = mapa.size();
        if (filas == 0) {
            return 0;
        }
        int columnas = mapa.get(0).length();
        boolean[][] visitada = new boolean[filas][columnas];
        int islas = 0;
        for (int f = 0; f < filas; f++) {
            for (int c = 0; c < columnas; c++) {
                if (mapa.get(f).charAt(c) == '1' && !visitada[f][c]) {
                    islas++;
                    hundir(mapa, visitada, f, c);
                }
            }
        }
        return islas;
    }

    /**
     * Ayudante de contarIslas(): marca como visitada toda la isla que contiene la celda (f0, c0).
     *
     * @complejidad Tiempo O(celdas de la isla); espacio O(celdas de la isla).
     * @explicacion Pila de pares [fila, columna] (un `int[2]`): se saca una celda, se mira a sus cuatro vecinas y se apilan las
     * que son tierra y no se habían visitado, marcándolas al apilar para no meterlas dos veces.
     * @bigo n
     */
    private static void hundir(List<String> mapa, boolean[][] visitada, int f0, int c0) {
        int[][] direcciones = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        Deque<int[]> pila = new ArrayDeque<>();
        visitada[f0][c0] = true;
        pila.push(new int[] {f0, c0});
        while (!pila.isEmpty()) {
            int[] celda = pila.pop();
            for (int[] d : direcciones) {
                int f = celda[0] + d[0];
                int c = celda[1] + d[1];
                if (f >= 0 && f < mapa.size() && c >= 0 && c < mapa.get(f).length()
                    && mapa.get(f).charAt(c) == '1' && !visitada[f][c]) {
                    visitada[f][c] = true;
                    pila.push(new int[] {f, c});
                }
            }
        }
    }

    /**
     * Orden topológico (algoritmo de Kahn).
     *
     * @complejidad Tiempo O(V + E); espacio O(V + E).
     * @explicacion Primero se registran todas las tareas (también las dependencias que no son clave) y se cuenta cuántas
     * dependencias pendientes tiene cada una (`pendientes`), a la vez que se construye el mapa inverso `dependientes`
     * (quién necesita a quién). Se meten en la cola las tareas con 0 pendientes; al sacar una, se añade al resultado y se
     * descuenta una a cada dependiente, encolando los que llegan a 0. Si el resultado no incluye todas las tareas, las que
     * faltan forman un ciclo y se lanza IllegalStateException. Se usan LinkedHashMap para que el resultado sea determinista.
     * @alternativas DFS con tres estados (sin visitar, en curso, terminado): mismo coste, pero detecta el ciclo al volver a
     * un nodo "en curso" y es recursivo.
     */
    static List<String> ordenTopologico(Map<String, List<String>> dependencias) {
        Map<String, Integer> pendientes = new LinkedHashMap<>();
        Map<String, List<String>> dependientes = new HashMap<>();
        for (var e : dependencias.entrySet()) {
            pendientes.merge(e.getKey(), 0, Integer::sum);
            for (String d : e.getValue()) {
                pendientes.putIfAbsent(d, 0);
                pendientes.merge(e.getKey(), 1, Integer::sum);
                dependientes.computeIfAbsent(d, k -> new ArrayList<>()).add(e.getKey());
            }
        }
        Deque<String> cola = new ArrayDeque<>();
        pendientes.forEach((tarea, n) -> {
            if (n == 0) {
                cola.offer(tarea);
            }
        });
        List<String> orden = new ArrayList<>();
        while (!cola.isEmpty()) {
            String tarea = cola.poll();
            orden.add(tarea);
            for (String dependiente : dependientes.getOrDefault(tarea, List.of())) {
                if (pendientes.merge(dependiente, -1, Integer::sum) == 0) {
                    cola.offer(dependiente);
                }
            }
        }
        if (orden.size() != pendientes.size()) {
            throw new IllegalStateException("Hay un ciclo de dependencias");
        }
        return orden;
    }

    /**
     * Dijkstra con PriorityQueue.
     *
     * @complejidad Tiempo O((V + E) log V); espacio O(V + E).
     * @bigo nlogn
     * @explicacion Se mantiene la mejor distancia conocida a cada nodo. La cola de prioridad entrega siempre el nodo
     * pendiente más cercano; al sacarlo, su distancia ya es definitiva (con pesos no negativos no puede mejorar). Se relaja
     * cada arista: si pasar por este nodo mejora la distancia del vecino, se actualiza y se inserta una entrada nueva.
     * `PriorityQueue` no permite bajar la prioridad de una entrada existente, así que pueden quedar entradas "viejas"; se
     * descartan al sacarlas comparando con la distancia ya conocida. Los pesos negativos se rechazan al principio porque
     * invalidan ese razonamiento. El resultado va en un `TreeMap` (ordenado por nodo).
     * @alternativas Con todos los pesos iguales, BFS basta (O(V + E)). Bellman-Ford admite pesos negativos pero cuesta O(V·E).
     * Con una cola de prioridad indexada (sin entradas viejas) se evita el relleno de la cola, a costa de más código.
     */
    static Map<String, Integer> dijkstra(Map<String, Map<String, Integer>> grafo, String origen) {
        for (var aristas : grafo.values()) {
            for (int peso : aristas.values()) {
                if (peso < 0) {
                    throw new IllegalArgumentException("Dijkstra no admite pesos negativos");
                }
            }
        }
        Map<String, Integer> distancia = new HashMap<>();
        distancia.put(origen, 0);
        PriorityQueue<Map.Entry<String, Integer>> cola = new PriorityQueue<>(Map.Entry.comparingByValue());
        cola.offer(Map.entry(origen, 0));
        while (!cola.isEmpty()) {
            var actual = cola.poll();
            String nodo = actual.getKey();
            int d = actual.getValue();
            if (d > distancia.get(nodo)) {
                continue;                                     // entrada vieja: ya se encontró un camino mejor
            }
            for (var vecino : grafo.getOrDefault(nodo, Map.of()).entrySet()) {
                int nueva = d + vecino.getValue();
                Integer conocida = distancia.get(vecino.getKey());
                if (conocida == null || nueva < conocida) {
                    distancia.put(vecino.getKey(), nueva);
                    cola.offer(Map.entry(vecino.getKey(), nueva));
                }
            }
        }
        return new TreeMap<>(distancia);
    }

    /**
     * Escaleras de 1 o 2 pasos con dos variables.
     *
     * @complejidad Tiempo O(n); espacio O(1).
     * @bigo n
     * @explicacion pasos(n) = pasos(n-1) + pasos(n-2) con pasos(0) = pasos(1) = 1: es Fibonacci. Como cada celda solo
     * mira las dos anteriores, basta con dos variables en vez de una tabla. Se suma con `Math.addExact`: un `long` solo llega
     * a escaleras(91) y, con `+`, el siguiente valor desbordaría en silencio dando un número negativo.
     * @alternativas Recursión con memoización (O(n) de espacio y de pila) o la recursión ingenua (O(2ⁿ)). Para n enormes,
     * `BigInteger`.
     */
    static long escaleras(int n) {
        if (n < 0) {
            throw new IllegalArgumentException("n no puede ser negativo");
        }
        long anterior = 1;
        long actual = 1;
        for (int i = 2; i <= n; i++) {
            long siguiente = Math.addExact(anterior, actual);
            anterior = actual;
            actual = siguiente;
        }
        return actual;
    }

    /**
     * Cambio de monedas mínimo (DP).
     *
     * @complejidad Tiempo O(objetivo · monedas); espacio O(objetivo).
     * @bigo n
     * @explicacion `minimo[c]` es el menor número de monedas para sumar c. Se parte de `minimo[0] = 0` y cada cantidad se
     * calcula probando cada moneda: `1 + minimo[c - moneda]`. Las cantidades imposibles se marcan con un valor
     * "infinito" (`objetivo + 1`, que nunca puede ser un resultado válido) y NO con `Integer.MAX_VALUE`, porque
     * sumarle 1 desbordaría a un negativo y ganaría todas las comparaciones. Al final, si sigue siendo "infinito", se devuelve -1.
     * @alternativas El algoritmo voraz falla con monedas como {1, 3, 4}. La recursión con memoización es equivalente pero apila marcos
     * (con objetivos grandes, StackOverflowError).
     */
    static int cambioMonedas(int[] monedas, int objetivo) {
        if (objetivo < 0) {
            throw new IllegalArgumentException("La cantidad no puede ser negativa");
        }
        int infinito = objetivo + 1;
        int[] minimo = new int[objetivo + 1];
        Arrays.fill(minimo, infinito);
        minimo[0] = 0;
        for (int c = 1; c <= objetivo; c++) {
            for (int moneda : monedas) {
                if (moneda <= c && minimo[c - moneda] + 1 < minimo[c]) {
                    minimo[c] = minimo[c - moneda] + 1;
                }
            }
        }
        return minimo[objetivo] >= infinito ? -1 : minimo[objetivo];
    }

    /**
     * Mochila 0/1 con una tabla de una dimensión.
     *
     * @complejidad Tiempo O(objetos · capacidad); espacio O(capacidad).
     * @bigo n
     * @explicacion `mejor[w]` es el mayor valor con capacidad w. Para cada objeto se recorre w de MAYOR a menor: así
     * `mejor[w - peso]` todavía no incluye este objeto y no se usa dos veces. Si se recorriera de menor a mayor se obtendría la
     * mochila "con repetición" (cada objeto ilimitado), que es otro problema.
     * @alternativas Tabla bidimensional objetos × capacidad: O(objetos · capacidad) de espacio, pero permite reconstruir qué objetos se
     * cogen. Fuerza bruta sobre los 2ⁿ subconjuntos.
     */
    static int mochila(int[] pesos, int[] valores, int capacidad) {
        if (pesos.length != valores.length) {
            throw new IllegalArgumentException("pesos y valores deben tener la misma longitud");
        }
        int[] mejor = new int[capacidad + 1];
        for (int i = 0; i < pesos.length; i++) {
            for (int w = capacidad; w >= pesos[i]; w--) {
                mejor[w] = Math.max(mejor[w], mejor[w - pesos[i]] + valores[i]);
            }
        }
        return mejor[capacidad];
    }

    /**
     * Subsecuencia común más larga con dos filas.
     *
     * @complejidad Tiempo O(n·m); espacio O(m).
     * @bigo n2
     * @explicacion `fila[j]` guarda el LCS de los i primeros caracteres de `a` y los j primeros de `b`. Si los caracteres
     * coinciden se suma 1 a la diagonal; si no, se toma el mayor entre arriba e izquierda. Como cada fila solo depende de la
     * anterior, se intercambian dos arrays en lugar de guardar la tabla entera.
     * @alternativas La tabla completa (n+1)×(m+1): O(n·m) de espacio, necesaria para reconstruir la subsecuencia. Recursión sin
     * memoización: O(2^(n+m)).
     */
    static int lcs(String a, String b) {
        int[] anterior = new int[b.length() + 1];
        int[] actual = new int[b.length() + 1];
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                actual[j] = a.charAt(i - 1) == b.charAt(j - 1)
                    ? anterior[j - 1] + 1
                    : Math.max(anterior[j], actual[j - 1]);
            }
            int[] t = anterior;
            anterior = actual;
            actual = t;
        }
        return anterior[b.length()];
    }

    /**
     * Distancia de Levenshtein con dos filas.
     *
     * @complejidad Tiempo O(n·m); espacio O(m).
     * @bigo n2
     * @explicacion `anterior[j]` es la distancia entre los i-1 primeros caracteres de `a` y los j primeros de `b`. La fila 0
     * es 0..m (insertar j caracteres) y cada fila nueva empieza en i (borrar i caracteres). Si los caracteres coinciden se copia la diagonal; si no,
     * 1 + el mínimo de borrar (arriba), insertar (izquierda) o sustituir (diagonal). Se comparan `char`, es decir, unidades
     * UTF-16: un emoji o un carácter fuera del plano básico cuenta como dos.
     * @alternativas La tabla completa (O(n·m) de espacio) si hay que reconstruir las operaciones. Para comparar por caracteres Unicode
     * reales, trabajar con `codePoints()`.
     */
    static int distanciaEdicion(String a, String b) {
        int[] anterior = new int[b.length() + 1];
        int[] actual = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            anterior[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            actual[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                actual[j] = a.charAt(i - 1) == b.charAt(j - 1)
                    ? anterior[j - 1]
                    : 1 + Math.min(anterior[j - 1], Math.min(anterior[j], actual[j - 1]));
            }
            int[] t = anterior;
            anterior = actual;
            actual = t;
        }
        return anterior[b.length()];
    }
}
