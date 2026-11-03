import java.util.*;

/*
 * TEMA 7 · ESTRUCTURAS DE DATOS
 * ────────────────────────────────────────────────────────────────────────────
 * Elegir la estructura adecuada suele importar más que optimizar el código. java.util trae casi todas;
 * esta es la tabla de qué clase usar para cada necesidad:
 *
 *   Necesito...                  Java                                    Coste típico
 *   lista con acceso por índice  ArrayList                               get O(1), añadir al final O(1) amortizado
 *   pila (LIFO)                  ArrayDeque (push, pop, peek)            O(1)
 *   cola (FIFO)                  ArrayDeque (offer, poll, peek)          O(1)
 *   inserciones en los extremos  ArrayDeque (LinkedList solo si hay      O(1)
 *                                que admitir null o borrar con iterador)
 *   cola de prioridad / heap     PriorityQueue                           offer, poll: O(log n); peek: O(1)
 *   conjunto / diccionario       HashSet / HashMap                       contains, put, get: O(1) medio
 *   caché LRU                    LinkedHashMap(accessOrder = true)       get, put: O(1)
 *   claves que son OBJETOS       IdentityHashMap (compara con ==),       O(1)
 *                                WeakHashMap (la entrada desaparece si
 *                                nadie más referencia la clave)
 *
 * Recuerda: `ArrayList.remove(0)` es O(n) porque desplaza todos los elementos. Para colas usa ArrayDeque,
 * no un ArrayList con remove(0). Y `Stack` y `Vector` son clases heredadas (sincronizadas, más lentas): no las uses.
 */
class EstructurasDeDatos {

    static void titulo(String texto) {
        System.out.println("\n=== " + texto + " ===");
    }

    /** Muestra cualquier valor (listas, mapas...) con su toString. */
    static String ver(Object valor) {
        return String.valueOf(valor);
    }

    static int[] arr(int... v) {
        return v;
    }

    /** Lista enlazada 1 → 2 → 3 desde unos valores. */
    static Nodo listaDesde(int... valores) {
        Nodo cabeza = null;
        for (int i = valores.length - 1; i >= 0; i--) {
            cabeza = new Nodo(valores[i], cabeza);       // cada nodo nuevo apunta al anterior ya construido
        }
        return cabeza;
    }

    /** Recorre la lista y devuelve sus valores (con un tope por si hay un ciclo). */
    static List<Integer> listaALista(Nodo cabeza) {
        List<Integer> valores = new ArrayList<>();
        for (Nodo n = cabeza; n != null && valores.size() < 10_000; n = n.siguiente) {
            valores.add(n.valor);
        }
        return valores;
    }

    static NodoArbol insertarEn(NodoArbol nodo, int valor) {
        if (nodo == null) {
            return new NodoArbol(valor);
        }
        if (valor < nodo.valor) {
            nodo.izq = insertarEn(nodo.izq, valor);
        } else if (valor > nodo.valor) {
            nodo.der = insertarEn(nodo.der, valor);
        }                                                // si es igual no se inserta (sin duplicados)
        return nodo;
    }

    static void enOrdenDe(NodoArbol nodo, List<Integer> salida) {
        if (nodo != null) {
            enOrdenDe(nodo.izq, salida);
            salida.add(nodo.valor);
            enOrdenDe(nodo.der, salida);
        }
    }

    static List<Integer> aleatoriosLista(int n) {
        List<Integer> r = new ArrayList<>(n);
        for (int x : aleatorios(n, 999_999, 12345)) {
            r.add(x);
        }
        return r;
    }

    static CacheLRU<Integer> cacheLlena(int n) {
        var c = new CacheLRU<Integer>(n);
        for (int i = 0; i < n; i++) {
            c.poner("k" + i, i);
        }
        return c;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // EJERCICIOS
    // ════════════════════════════════════════════════════════════════════════════

    // ── Ejercicio 1 · parentesisBalanceados (pila) ──────────────────────────────
    /**
     * ¿Están bien emparejados y anidados los paréntesis ( ), corchetes [ ] y llaves { } del texto?
     * Los demás caracteres se ignoran. Usa una pila (un ArrayDeque): cada cierre debe coincidir con la última
     * apertura sin cerrar.
     *   "a(b[c]{d})e" → true    "(]" → false    "([)]" → false    "((" → false    "" → true
     * Ojo: `pila.pop()` en una pila vacía lanza NoSuchElementException; `pila.poll()` devuelve null.
     */
    static boolean parentesisBalanceados(String texto) {
        return pendiente();
    }

    // ── Ejercicio 3 · Lista enlazada: invertir y detectar ciclos ────────────────
    /**
     * Invierte la lista cambiando las referencias `siguiente` (sin crear nodos nuevos) y devuelve la nueva cabeza.
     * O(n) de tiempo y O(1) de memoria. Lista vacía → null.   1 → 2 → 3   pasa a   3 → 2 → 1
     */
    static Nodo invertirLista(Nodo cabeza) {
        return pendiente();
    }

    /**
     * ¿La lista tiene un ciclo (algún nodo vuelve a apuntar a uno anterior)? Con el algoritmo de la tortuga y la liebre
     * de Floyd (dos referencias: una avanza de 1 en 1 y otra de 2 en 2; si hay ciclo acaban coincidiendo): O(n) de
     * tiempo y O(1) de memoria. (Con un Set de nodos vistos sería O(n) de memoria; ojo, un HashSet usaría equals/hashCode
     * y aquí hace falta comparar por identidad: eso es un IdentityHashMap.)
     */
    static boolean tieneCiclo(Nodo cabeza) {
        return pendiente();
    }

    // ── Ejercicio 5 · ordenarConMonticulo (usa tu MinHeap) ──────────────────────
    /**
     * Heap sort sencillo: mete todos los elementos en tu MinHeap y sácalos uno a uno. O(n log n).
     * Devuelve una lista nueva (la de entrada no se modifica).
     */
    static List<Integer> ordenarConMonticulo(List<Integer> xs) {
        return pendiente();
    }

    // ── Ejercicio 7 · topK con un montículo ─────────────────────────────────────
    /**
     * Los k valores MAYORES de la lista, de mayor a menor, sin ordenar toda la lista: mantén una PriorityQueue
     * (montículo de mínimos) de tamaño máximo k (si entra uno más grande que el mínimo, saca el mínimo). O(n log k)
     * y memoria O(k).
     *   topK(List.of(5, 1, 9, 3, 7), 2)  →  [9, 7]       k = 0 → []       k mayor que la lista → toda, ordenada desc.
     * Trampa: iterar o imprimir una PriorityQueue NO la muestra ordenada; hay que sacar con poll().
     */
    static List<Integer> topK(List<Integer> xs, int k) {
        return pendiente();
    }

    public static void main(String[] args) {

// ════════════════════════════════════════════════════════════════════════════
// 1. PILA (LIFO): EL ÚLTIMO EN ENTRAR ES EL PRIMERO EN SALIR
// ════════════════════════════════════════════════════════════════════════════
        // Usos: deshacer/rehacer, recorrido en profundidad, evaluar expresiones, comprobar paréntesis.
        // ArrayDeque es la pila de Java (más rápida que Stack): push/pop/peek actúan sobre el mismo extremo, O(1).
        titulo("1. Pila");

        Deque<String> pila = new ArrayDeque<>();
        for (String letra : List.of("a", "b", "c")) {
            pila.push(letra);
        }
        System.out.println("peek: " + pila.peek() + " · tamaño: " + pila.size() + " · iterando (de la cima a la base): " + pila);
        StringBuilder sacando = new StringBuilder("sacando: ");
        while (!pila.isEmpty()) {
            sacando.append(pila.pop()).append(' ');
        }
        System.out.println(sacando);
        // La trampa: ArrayDeque NO admite null (no sabría distinguir "elemento null" de "vacía" en poll/peek).
        try {
            pila.push(null);
        } catch (NullPointerException e) {
            System.out.println("pila.push(null) → NullPointerException");
        }

// ════════════════════════════════════════════════════════════════════════════
// 2. COLA (FIFO): EL PRIMERO EN ENTRAR ES EL PRIMERO EN SALIR
// ════════════════════════════════════════════════════════════════════════════
        // Usos: tareas pendientes, recorrido en anchura, buffers.
        // El mismo ArrayDeque sirve de cola: offer entra por el final y poll sale por el principio, ambos O(1).
        titulo("2. Cola");

        Queue<String> cola = new ArrayDeque<>();
        for (String tarea : List.of("t1", "t2", "t3")) {
            cola.offer(tarea);
        }
        StringBuilder atendiendo = new StringBuilder("atendiendo: ");
        while (!cola.isEmpty()) {
            atendiendo.append(cola.poll()).append(' ');
        }
        System.out.println(atendiendo);
        // poll() y peek() devuelven null si está vacía; remove() y element() lanzan NoSuchElementException.
        System.out.println("poll en vacía: " + cola.poll());
        try {
            cola.remove();
        } catch (NoSuchElementException e) {
            System.out.println("remove en vacía → NoSuchElementException");
        }

// ════════════════════════════════════════════════════════════════════════════
// 3. MONTÍCULO (HEAP) Y COLA DE PRIORIDAD
// ════════════════════════════════════════════════════════════════════════════
        // Un montículo mantiene "el menor (o mayor) a mano": mirar el mínimo es O(1) y insertar/extraer, O(log n).
        // Se guarda en un array con una regla: los hijos del nodo i son 2i+1 y 2i+2, y un padre nunca es mayor que sus hijos.
        titulo("3. Montículo y cola de prioridad");

        PriorityQueue<Integer> minHeap = new PriorityQueue<>();          // saca primero el MENOR
        for (int n : arr(5, 3, 8, 1, 9, 2)) {
            minHeap.offer(n);
        }
        System.out.println("la trampa: imprimirlo muestra el array interno, NO ordenado: " + minHeap);
        StringBuilder extrayendo = new StringBuilder("extrayendo el menor cada vez: ");
        while (!minHeap.isEmpty()) {
            extrayendo.append(minHeap.poll()).append(' ');
        }
        System.out.println(extrayendo);

        // Para sacar el MAYOR primero (montículo de máximos) se invierte el comparador.
        PriorityQueue<Tarea> tareas = new PriorityQueue<>(Comparator.comparingInt(Tarea::prioridad).reversed());
        tareas.offer(new Tarea("escribir informe", 2));
        tareas.offer(new Tarea("apagar incendio", 10));
        tareas.offer(new Tarea("tomar café", 1));
        StringBuilder porPrioridad = new StringBuilder("por prioridad: ");
        while (!tareas.isEmpty()) {
            porPrioridad.append(tareas.poll().nombre()).append(" | ");
        }
        System.out.println(porPrioridad);
        System.out.println("(con la misma prioridad el orden no está garantizado: PriorityQueue no es estable)");

// ════════════════════════════════════════════════════════════════════════════
// 4. LISTA ENLAZADA: LO QUE PASA "POR DENTRO" EN LinkedList
// ════════════════════════════════════════════════════════════════════════════
        // Cada nodo guarda un valor y la referencia al siguiente. Insertar/borrar al principio es O(1) (solo cambian
        // referencias) pero acceder a la posición k es O(k) (LinkedList.get(i) recorre los nodos). En Java rara vez la
        // necesitas (ArrayList y ArrayDeque son más rápidos casi siempre), pero es el ejemplo clásico para practicar
        // referencias: lo harás en los ejercicios.
        titulo("4. Nodos enlazados");

        Nodo lista = listaDesde(1, 2, 3);
        System.out.println("lista: " + listaALista(lista).toString().replace(", ", " → ").replaceAll("[\\[\\]]", ""));
        // Las variables guardan referencias: modificar n.siguiente cambia la lista de verdad.

// ════════════════════════════════════════════════════════════════════════════
// 5. ÁRBOL BINARIO DE BÚSQUEDA (ABB)
// ════════════════════════════════════════════════════════════════════════════
        // En cada nodo: todo lo de la izquierda es menor y todo lo de la derecha, mayor. Buscar, insertar y
        // borrar cuestan O(altura): O(log n) si está equilibrado, O(n) si degenera en una "lista" (datos ordenados).
        // El recorrido en orden (izquierda, nodo, derecha) devuelve los valores ORDENADOS.
        // (TreeMap/TreeSet de Java son árboles rojinegros: un ABB que se reequilibra solo y garantiza O(log n).)
        titulo("5. Árbol binario de búsqueda");

        NodoArbol raiz = null;
        for (int v : arr(50, 30, 70, 20, 40, 60, 80)) {
            raiz = insertarEn(raiz, v);
        }
        List<Integer> enOrden = new ArrayList<>();
        enOrdenDe(raiz, enOrden);
        System.out.println("en orden: " + ver(enOrden));

// ════════════════════════════════════════════════════════════════════════════
// 6. OBJETOS COMO CLAVES
// ════════════════════════════════════════════════════════════════════════════
        // Un HashMap/HashSet compara claves con equals()/hashCode(): dos objetos "iguales" son la misma clave.
        // Si necesitas distinguir OBJETOS concretos (aunque sean iguales) existe IdentityHashMap, que compara con ==.
        // WeakHashMap guarda las claves con referencia débil: si nadie más las usa, el recolector las borra del mapa.
        titulo("6. Objetos como claves");

        String a = new String("hola");
        String b = new String("hola");                                   // igual a `a`, pero otro objeto
        Set<String> porIgualdad = new HashSet<>(List.of(a));
        Set<String> porIdentidad = Collections.newSetFromMap(new IdentityHashMap<>());
        porIdentidad.add(a);
        System.out.println("HashSet: ¿contiene b? " + porIgualdad.contains(b) + " · IdentityHashMap: ¿contiene b? " + porIdentidad.contains(b)
            + " · ¿contiene a? " + porIdentidad.contains(a));
        Map<Object, String> debil = new WeakHashMap<>();
        debil.put(new Object(), "entrada que el recolector puede borrar cuando quiera");

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

        prueba("parentesisBalanceados",
            caso("vacío", true, ""),
            caso("simple", true, "()"),
            caso("mezclados", true, "([]{})"),
            caso("con texto", true, "a(b[c]{d})e"),
            caso("cierre incorrecto", false, "(]"),
            caso("cruzados", false, "([)]"),
            caso("sin cerrar", false, "(("),
            caso("cierre de más", false, "())"),
            caso("empieza cerrando", false, ")("),
            caso("solo texto", true, "hola"),
            caso("profundo", true, "(".repeat(500) + ")".repeat(500)));

        grupo("ColaConDosPilas");
        comprueba("sale en el orden en que entra", () -> {
            var c = new ColaConDosPilas<Integer>();
            for (int x : arr(1, 2, 3)) {
                c.encolar(x);
            }
            return List.of(c.desencolar(), c.desencolar(), c.desencolar());
        }, List.of(1, 2, 3));
        comprueba("entradas y salidas intercaladas", () -> {
            var c = new ColaConDosPilas<String>();
            c.encolar("a");
            c.encolar("b");
            List<String> salida = new ArrayList<>(List.of(c.desencolar()));
            c.encolar("c");
            salida.add(c.desencolar());
            salida.add(c.desencolar());
            return salida;
        }, List.of("a", "b", "c"));
        comprueba("frente no la quita", () -> {
            var c = new ColaConDosPilas<Integer>();
            c.encolar(5);
            c.encolar(6);
            return List.of(c.frente(), c.frente(), c.tamano());
        }, List.of(5, 5, 2));
        comprueba("vacia y tamano", () -> {
            var c = new ColaConDosPilas<Integer>();
            List<Object> antes = new ArrayList<>(List.of(c.vacia(), c.tamano()));
            c.encolar(1);
            c.desencolar();
            antes.add(c.vacia());
            antes.add(c.tamano());
            return antes;
        }, List.of(true, 0, true, 0));
        comprueba("admite cualquier tipo de valor", () -> {
            var c = new ColaConDosPilas<Object>();
            c.encolar("texto");
            c.encolar(List.of(1));
            return List.of(c.desencolar(), c.desencolar());
        }, List.of("texto", List.of(1)));
        comprueba("mismo resultado que una cola de verdad (2000 operaciones)", () -> {
            var c = new ColaConDosPilas<Integer>();
            Queue<Integer> real = new ArrayDeque<>();
            long x = 7;
            for (int i = 0; i < 2000; i++) {
                x = (x * 1103515245L + 12345) & 0x7fffffffL;
                if (x % 3 != 0 || real.isEmpty()) {
                    c.encolar(i);
                    real.offer(i);
                } else if (!c.desencolar().equals(real.poll())) {
                    return false;
                }
            }
            return c.tamano() == real.size();
        }, true);
        lanza("desencolar en vacía", () -> new ColaConDosPilas<Integer>().desencolar(), NoSuchElementException.class);
        lanza("frente en vacía", () -> new ColaConDosPilas<Integer>().frente(), NoSuchElementException.class);

        grupo("invertirLista");
        comprueba("invierte", () -> listaALista(invertirLista(listaDesde(1, 2, 3, 4))), List.of(4, 3, 2, 1));
        comprueba("un nodo", () -> listaALista(invertirLista(listaDesde(9))), List.of(9));
        comprueba("lista vacía", () -> invertirLista(null), null);
        comprueba("no crea nodos nuevos", () -> {
            Nodo cabeza = listaDesde(1, 2, 3);
            Nodo ultimo = cabeza.siguiente.siguiente;
            return invertirLista(cabeza) == ultimo;
        }, true);
        comprueba("invertir dos veces devuelve la original", () -> listaALista(invertirLista(invertirLista(listaDesde(numeros(50))))), lista(50));

        grupo("tieneCiclo");
        comprueba("lista normal", () -> tieneCiclo(listaDesde(1, 2, 3, 4, 5)), false);
        comprueba("lista vacía", () -> tieneCiclo(null), false);
        comprueba("un nodo", () -> tieneCiclo(listaDesde(1)), false);
        comprueba("el último apunta al segundo", () -> {
            Nodo cabeza = listaDesde(1, 2, 3, 4);
            cabeza.siguiente.siguiente.siguiente.siguiente = cabeza.siguiente;
            return tieneCiclo(cabeza);
        }, true);
        comprueba("un nodo que se apunta a sí mismo", () -> {
            Nodo n = new Nodo(1);
            n.siguiente = n;
            return tieneCiclo(n);
        }, true);
        comprueba("lista larga sin ciclo", () -> tieneCiclo(listaDesde(numeros(5000))), false);

        grupo("ArbolBinarioBusqueda");
        comprueba("enOrden devuelve los valores ordenados", () -> {
            var arbol = new ArbolBinarioBusqueda();
            for (int v : arr(50, 30, 70, 20, 40, 60, 80)) {
                arbol.insertar(v);
            }
            return arbol.enOrden();
        }, List.of(20, 30, 40, 50, 60, 70, 80));
        comprueba("contiene", () -> {
            var arbol = new ArbolBinarioBusqueda();
            for (int v : arr(5, 3, 8)) {
                arbol.insertar(v);
            }
            return List.of(arbol.contiene(3), arbol.contiene(8), arbol.contiene(4));
        }, List.of(true, true, false));
        comprueba("no admite duplicados", () -> {
            var arbol = new ArbolBinarioBusqueda();
            for (int v : arr(5, 5, 5, 3, 3)) {
                arbol.insertar(v);
            }
            return List.of(arbol.tamano(), arbol.enOrden());
        }, List.of(2, List.of(3, 5)));
        comprueba("altura de un árbol equilibrado", () -> {
            var arbol = new ArbolBinarioBusqueda();
            for (int v : arr(4, 2, 6, 1, 3, 5, 7)) {
                arbol.insertar(v);
            }
            return arbol.altura();
        }, 3);
        comprueba("altura si se insertan ordenados (degenera en lista)", () -> {
            var arbol = new ArbolBinarioBusqueda();
            for (int v : numeros(10)) {
                arbol.insertar(v);
            }
            return arbol.altura();
        }, 10);
        comprueba("árbol vacío", () -> {
            var arbol = new ArbolBinarioBusqueda();
            return Arrays.asList(arbol.altura(), arbol.minimo(), arbol.enOrden(), arbol.tamano(), arbol.contiene(1));
        }, Arrays.asList(0, null, List.of(), 0, false));
        comprueba("mínimo", () -> {
            var arbol = new ArbolBinarioBusqueda();
            for (int v : arr(8, 3, 10, 1, 6)) {
                arbol.insertar(v);
            }
            return arbol.minimo();
        }, 1);
        comprueba("un nodo tiene altura 1", () -> {
            var arbol = new ArbolBinarioBusqueda();
            arbol.insertar(1);
            return arbol.altura();
        }, 1);

        grupo("MinHeap");
        comprueba("extrae en orden ascendente", () -> {
            var h = new MinHeap();
            for (int v : arr(5, 3, 8, 1, 9, 2)) {
                h.insertar(v);
            }
            List<Integer> salida = new ArrayList<>();
            while (!h.vacio()) {
                salida.add(h.extraerMinimo());
            }
            return salida;
        }, List.of(1, 2, 3, 5, 8, 9));
        comprueba("minimo no extrae", () -> {
            var h = new MinHeap();
            h.insertar(4);
            h.insertar(2);
            return List.of(h.minimo(), h.minimo(), h.tamano());
        }, List.of(2, 2, 2));
        comprueba("con repetidos", () -> {
            var h = new MinHeap();
            for (int v : arr(2, 2, 1, 1)) {
                h.insertar(v);
            }
            return List.of(h.extraerMinimo(), h.extraerMinimo(), h.extraerMinimo(), h.extraerMinimo());
        }, List.of(1, 1, 2, 2));
        comprueba("operaciones mezcladas igual que PriorityQueue (1500 ops)", () -> {
            var h = new MinHeap();
            PriorityQueue<Integer> real = new PriorityQueue<>();
            long x = 99;
            for (int i = 0; i < 1500; i++) {
                x = (x * 1103515245L + 12345) & 0x7fffffffL;
                if (x % 4 != 0 || real.isEmpty()) {
                    int v = (int) (x % 1000);
                    h.insertar(v);
                    real.offer(v);
                } else if (h.extraerMinimo() != real.poll()) {
                    return false;
                }
            }
            return h.tamano() == real.size() && (real.isEmpty() || h.minimo() == real.peek());
        }, true);
        lanza("extraer de uno vacío", () -> new MinHeap().extraerMinimo(), NoSuchElementException.class);
        lanza("minimo de uno vacío", () -> new MinHeap().minimo(), NoSuchElementException.class);

        prueba("ordenarConMonticulo",
            caso("desordenada", List.of(1, 2, 5, 5, 6, 9), List.of(5, 2, 9, 1, 5, 6)),
            caso("vacía", List.of(), List.of()),
            caso("un elemento", List.of(3), List.of(3)),
            caso("negativos", List.of(-3, -1, 0, 2), List.of(0, -3, 2, -1)),
            caso("inversa", lista(10), List.of(10, 9, 8, 7, 6, 5, 4, 3, 2, 1)));

        grupo("CacheLRU");
        comprueba("guarda y devuelve", () -> {
            var c = new CacheLRU<Integer>(2);
            c.poner("a", 1);
            return Arrays.asList(c.obtener("a"), c.obtener("zzz"));
        }, Arrays.asList(1, null));
        comprueba("expulsa la menos reciente", () -> {
            var c = new CacheLRU<Integer>(2);
            c.poner("a", 1);
            c.poner("b", 2);
            c.poner("c", 3);                   // expulsa a
            return Arrays.asList(c.obtener("a"), c.obtener("b"), c.obtener("c"));
        }, Arrays.asList(null, 2, 3));
        comprueba("obtener cuenta como uso", () -> {
            var c = new CacheLRU<Integer>(2);
            c.poner("a", 1);
            c.poner("b", 2);
            c.obtener("a");                    // ahora la más antigua es b
            c.poner("c", 3);                   // expulsa b
            return Arrays.asList(c.obtener("a"), c.obtener("b"));
        }, Arrays.asList(1, null));
        comprueba("actualizar también cuenta como uso", () -> {
            var c = new CacheLRU<Integer>(2);
            c.poner("a", 1);
            c.poner("b", 2);
            c.poner("a", 10);                  // actualiza y refresca a
            c.poner("c", 3);                   // expulsa b
            return Arrays.asList(c.obtener("a"), c.obtener("b"), c.claves());
        }, Arrays.asList(10, null, List.of("a", "c")));
        comprueba("claves de la más reciente a la más antigua", () -> {
            var c = new CacheLRU<Integer>(3);
            c.poner("a", 1);
            c.poner("b", 2);
            c.poner("c", 3);
            c.obtener("a");
            return c.claves();
        }, List.of("a", "c", "b"));
        comprueba("capacidad 1", () -> {
            var c = new CacheLRU<Integer>(1);
            c.poner("a", 1);
            c.poner("b", 2);
            return Arrays.asList(c.obtener("a"), c.obtener("b"), c.tamano());
        }, Arrays.asList(null, 2, 1));
        comprueba("tamano nunca supera la capacidad", () -> {
            var c = new CacheLRU<Integer>(3);
            for (int i = 0; i < 10; i++) {
                c.poner("k" + i, i);
            }
            return List.of(c.tamano(), c.claves());
        }, List.of(3, List.of("k9", "k8", "k7")));
        comprueba("igual que una versión lenta de referencia (3000 operaciones)", () -> {
            var lru = new CacheLRU<Integer>(5);
            List<String> orden = new ArrayList<>();      // claves de menos a más reciente
            Map<String, Integer> datos = new HashMap<>();
            long x = 5;
            for (int i = 0; i < 3000; i++) {
                x = (x * 1103515245L + 12345) & 0x7fffffffL;
                String clave = "k" + (x % 9);
                if (x % 2 == 0) {
                    Integer esperado = datos.get(clave);
                    if (esperado != null) {
                        orden.remove(clave);
                        orden.add(clave);
                    }
                    if (!Objects.equals(lru.obtener(clave), esperado)) {
                        return "obtener(" + clave + ") falló en la operación " + i;
                    }
                } else {
                    lru.poner(clave, i);
                    datos.put(clave, i);
                    orden.remove(clave);
                    orden.add(clave);
                    if (orden.size() > 5) {
                        datos.remove(orden.remove(0));
                    }
                }
            }
            List<String> alReves = new ArrayList<>(orden);
            Collections.reverse(alReves);
            return lru.claves().equals(alReves) ? "ok" : "claves distintas";
        }, "ok");
        lanza("capacidad cero", () -> new CacheLRU<Integer>(0), IllegalArgumentException.class);

        prueba("topK",
            caso("básico", List.of(9, 7), List.of(5, 1, 9, 3, 7), 2),
            caso("k = 0", List.of(), List.of(1, 2, 3), 0),
            caso("k mayor que la lista", List.of(9, 4, 2), List.of(2, 9, 4), 10),
            caso("con repetidos", List.of(4, 4), List.of(4, 4, 4, 1), 2),
            caso("negativos", List.of(-1, -3), List.of(-5, -1, -3), 2),
            caso("vacía", List.of(), List.of(), 3),
            caso("k = 1", List.of(8), List.of(3, 8, 1), 1));

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        medir("parentesisBalanceados", n -> args("([{".repeat(n / 3) + "}])".repeat(n / 3)));
        medir("ordenarConMonticulo", n -> args(aleatoriosLista(n)));                         // O(n log n)
        medir("topK", n -> args(aleatoriosLista(n), 10));                                    // O(n log k) con k = 10: ~O(n)
        // obtener() en una caché con n entradas: O(1) si no recorres nada; O(n) si buscas la clave a mano.
        medir("CacheLRU", n -> cacheLlena(n), c -> c.obtener("k0"));
    }
}

/** Nodo de una lista enlazada simple (lo usan invertirLista y tieneCiclo). */
final class Nodo {
    int valor;
    Nodo siguiente;

    Nodo(int valor) {
        this(valor, null);
    }

    Nodo(int valor, Nodo siguiente) {
        this.valor = valor;
        this.siguiente = siguiente;
    }
}

/** Nodo de un árbol binario de búsqueda de enteros. */
final class NodoArbol {
    NodoArbol izq;
    NodoArbol der;
    final int valor;

    NodoArbol(int valor) {
        this.valor = valor;
    }
}

/** Una tarea con prioridad (la usa la demo de PriorityQueue). */
record Tarea(String nombre, int prioridad) {
}

// ── Ejercicio 2 · ColaConDosPilas ───────────────────────────────────────────
/**
 * Una cola FIFO construida SOLO con dos pilas (dos ArrayDeque que usas con push/pop): una para entrar y otra para
 * salir. Cuando la de salida se vacía, se le pasa todo lo de la de entrada (que invierte el orden). Cada elemento
 * cambia de pila una sola vez, así que desencolar es O(1) AMORTIZADO.
 *  - desencolar() y frente() en una cola vacía lanzan NoSuchElementException.
 *  - Trampa: ArrayDeque no admite null, así que esta cola tampoco.
 */
final class ColaConDosPilas<T> {
    void encolar(T valor) {
        pendiente();
    }

    T desencolar() {
        return pendiente();
    }

    T frente() {
        return pendiente();
    }

    int tamano() {
        return pendiente();
    }

    boolean vacia() {
        return pendiente();
    }
}

// ── Ejercicio 4 · ArbolBinarioBusqueda ──────────────────────────────────────
/**
 * Un ABB de enteros SIN duplicados (insertar un valor que ya está no hace nada), usando NodoArbol.
 *  - insertar(v), contiene(v): boolean, tamano(): int.
 *  - enOrden(): valores ordenados de menor a mayor.
 *  - altura(): niveles del árbol (vacío = 0, un solo nodo = 1).
 *  - minimo(): el menor valor, o null si está vacío (por eso devuelve Integer y no int).
 */
final class ArbolBinarioBusqueda {
    void insertar(int valor) {
        pendiente();
    }

    boolean contiene(int valor) {
        return pendiente();
    }

    int tamano() {
        return pendiente();
    }

    List<Integer> enOrden() {
        return pendiente();
    }

    int altura() {
        return pendiente();
    }

    Integer minimo() {
        return pendiente();
    }
}

// ── Ejercicio 5 · MinHeap (montículo mínimo propio) ─────────────────────────
/**
 * Un montículo de mínimos de enteros guardado en un array (sin usar PriorityQueue):
 *  - insertar(v): añádelo al final y "súbelo" mientras sea menor que su padre ((i-1) >> 1). O(log n).
 *  - extraerMinimo(): quita la raíz, pon el último elemento en su lugar y "bájalo" intercambiándolo con el
 *    hijo menor mientras haga falta (hijos: 2i+1 y 2i+2). O(log n).
 *  - minimo() mira la raíz sin quitarla (O(1)). Ambos, en un montículo vacío, lanzan NoSuchElementException.
 * El array de Java no crece solo: cuando se llene, cópialo a uno doble con Arrays.copyOf.
 */
final class MinHeap {
    void insertar(int valor) {
        pendiente();
    }

    int extraerMinimo() {
        return pendiente();
    }

    int minimo() {
        return pendiente();
    }

    int tamano() {
        return pendiente();
    }

    boolean vacio() {
        return pendiente();
    }
}

// ── Ejercicio 6 · CacheLRU ──────────────────────────────────────────────────
/**
 * Caché "Least Recently Used": guarda como mucho `capacidad` entradas y, al pasarse, expulsa la que lleva más tiempo
 * sin usarse. Tanto obtener() como poner() cuentan como "uso".
 *  - obtener(clave): el valor, o null si no está (y la marca como la más reciente).
 *  - poner(clave, valor): inserta o actualiza (también la marca como la más reciente) y expulsa si hace falta.
 *  - claves(): las claves de la MÁS reciente a la MÁS antigua. tamano(): cuántas hay.
 *  - capacidad menor que 1 → IllegalArgumentException.
 * Todo O(1). Pista: LinkedHashMap(capacidad, 0.75f, true) mantiene las entradas por orden de ACCESO (la última usada
 * va al final) y su método removeEldestEntry(...) se llama tras cada put para decidir si expulsa la más antigua.
 * ¡No recorras el mapa para buscar la más antigua!
 */
final class CacheLRU<V> {
    CacheLRU(int capacidad) {
        pendiente();
    }

    V obtener(String clave) {
        return pendiente();
    }

    void poner(String clave, V valor) {
        pendiente();
    }

    List<String> claves() {
        return pendiente();
    }

    int tamano() {
        return pendiente();
    }
}
