/*
 * SOLUCIONES · Tema 7 · Estructuras de datos
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
class Soluciones {

    /**
     * Paréntesis balanceados con una pila.
     *
     * @complejidad Tiempo O(n); espacio O(n) en el peor caso (todo son aperturas).
     * @bigo n
     * @explicacion Cada apertura se apila. Cada cierre debe coincidir con la apertura de la CIMA de la pila: si la pila
     * está vacía (cierre de más) o la cima es de otro tipo (cruce como `([)]`) ya no puede estar bien. Al final la pila
     * debe quedar vacía, o sobran aperturas. Se usa `poll()` (devuelve null si está vacía) en vez de `pop()` (que
     * lanzaría NoSuchElementException) para tratar el cierre de más como un simple "no balanceado".
     * @alternativas Quitar repetidamente `()`, `[]` y `{}` con `replace` hasta que no cambie nada: más corto pero O(n²)
     * en el peor caso. Con un solo tipo de paréntesis basta un contador entero (O(1) de memoria).
     */
    static boolean parentesisBalanceados(String texto) {
        Deque<Character> pila = new ArrayDeque<>();
        for (char c : texto.toCharArray()) {
            switch (c) {
                case '(', '[', '{' -> pila.push(c);
                case ')', ']', '}' -> {
                    Character apertura = pila.poll();
                    if (apertura == null || apertura != abreCon(c)) {
                        return false;
                    }
                }
                default -> { }
            }
        }
        return pila.isEmpty();
    }

    /**
     * Ayudante de parentesisBalanceados(): la apertura que corresponde a un cierre.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @bigo 1
     * @explicacion Un `switch` de expresión evita un `if` por cada tipo de paréntesis y deja claro el emparejamiento.
     * @alternativas Un `Map<Character, Character>` con los tres pares: igual de claro, pero con boxing en cada consulta.
     */
    private static char abreCon(char cierre) {
        return switch (cierre) {
            case ')' -> '(';
            case ']' -> '[';
            default -> '{';
        };
    }

    /**
     * Invierte una lista enlazada.
     *
     * @complejidad Tiempo O(n); espacio O(1).
     * @bigo n
     * @explicacion Se recorre la lista con tres referencias: `anterior` (ya invertido), `actual` y el `siguiente` que se
     * guarda antes de tocar nada. En cada paso se hace que `actual.siguiente` apunte hacia atrás y se avanza. Al
     * acabar, `anterior` es la nueva cabeza (el que era el último nodo). Se reutilizan los mismos nodos.
     * @alternativas Recursión: más corta pero O(n) de pila (una lista de un millón de nodos desbordaría la pila de
     * llamadas). Copiar los valores a un `ArrayList` y reconstruir: O(n) de memoria y crea nodos nuevos.
     */
    static Nodo invertirLista(Nodo cabeza) {
        Nodo anterior = null;
        Nodo actual = cabeza;
        while (actual != null) {
            Nodo siguiente = actual.siguiente;
            actual.siguiente = anterior;
            anterior = actual;
            actual = siguiente;
        }
        return anterior;
    }

    /**
     * Detecta un ciclo con la tortuga y la liebre de Floyd.
     *
     * @complejidad Tiempo O(n); espacio O(1).
     * @bigo n
     * @explicacion La liebre avanza dos nodos por cada uno de la tortuga. Si la lista termina (la liebre llega a
     * `null`), no hay ciclo. Si hay ciclo, ambas acaban dentro de él y la liebre, que se acerca un paso por vuelta, acaba
     * alcanzando a la tortuga. Se compara con `==` (identidad), que es lo que importa: dos nodos con el mismo valor no
     * son el mismo nodo.
     * @alternativas Un conjunto de nodos vistos (`Collections.newSetFromMap(new IdentityHashMap<>())`): O(n) de tiempo
     * pero O(n) de memoria. Un `HashSet<Nodo>` también funcionaría aquí porque Nodo no redefine equals, pero no sería
     * correcto si lo hiciera.
     */
    static boolean tieneCiclo(Nodo cabeza) {
        Nodo tortuga = cabeza;
        Nodo liebre = cabeza;
        while (liebre != null && liebre.siguiente != null) {
            tortuga = tortuga.siguiente;
            liebre = liebre.siguiente.siguiente;
            if (tortuga == liebre) {
                return true;
            }
        }
        return false;
    }

    /**
     * Heap sort sencillo con el MinHeap propio.
     *
     * @complejidad Tiempo O(n log n); espacio O(n).
     * @bigo nlogn
     * @explicacion Se insertan los n elementos (n · O(log n)) y se extraen uno a uno (n · O(log n)): cada extracción
     * devuelve el menor de los que quedan, así que salen ordenados. Es el mismo principio que `PriorityQueue`, pero con
     * la estructura que has escrito tú.
     * @alternativas `Collections.sort` / `List.sort` (TimSort): O(n log n) y en la práctica mucho más rápidos. El heap sort
     * "de verdad" ordena en el sitio con O(1) de memoria extra; este ocupa O(n) por claridad.
     */
    static List<Integer> ordenarConMonticulo(List<Integer> xs) {
        MinHeap heap = new MinHeap();
        for (int x : xs) {
            heap.insertar(x);
        }
        List<Integer> resultado = new ArrayList<>(xs.size());
        while (!heap.vacio()) {
            resultado.add(heap.extraerMinimo());
        }
        return resultado;
    }

    /**
     * Los k mayores con un heap de tamaño k.
     *
     * @complejidad Tiempo O(n log k); espacio O(k).
     * @bigo n
     * @explicacion Una `PriorityQueue` de mínimos guarda los k mayores vistos hasta ahora; su raíz es el MENOR de ellos.
     * Cada valor nuevo se compara con esa raíz: si es mayor, la reemplaza (poll + offer, O(log k)); si no, se descarta
     * (O(1)). Al final se vacía el heap, que da los valores de menor a mayor, y se invierte la lista. Con k fijo y
     * pequeño el coste es prácticamente lineal.
     * @alternativas Ordenar toda la lista y quedarse con los k primeros: O(n log n) y O(n) de memoria. `Collections.max`
     * repetido k veces: O(n·k). Quickselect: O(n) medio, pero más difícil de escribir.
     */
    static List<Integer> topK(List<Integer> xs, int k) {
        List<Integer> resultado = new ArrayList<>();
        if (k <= 0) {
            return resultado;
        }
        PriorityQueue<Integer> heap = new PriorityQueue<>(k);
        for (int x : xs) {
            if (heap.size() < k) {
                heap.offer(x);
            } else if (x > heap.peek()) {
                heap.poll();
                heap.offer(x);
            }
        }
        while (!heap.isEmpty()) {
            resultado.add(heap.poll());
        }
        Collections.reverse(resultado);
        return resultado;
    }
}

/**
 * Cola con dos pilas.
 *
 * @complejidad encolar O(1); desencolar y frente O(1) amortizado (O(n) puntual al trasvasar); espacio O(n).
 * @explicacion `entrada` recibe los elementos nuevos y `salida` los entrega. Cuando `salida` se queda vacía se
 * vuelca en ella toda `entrada`: al ir sacando de una pila y metiendo en la otra el orden se INVIERTE, así que el
 * elemento más antiguo queda arriba. Cada elemento se mueve de pila como mucho una vez en toda su vida, por eso
 * n operaciones cuestan O(n) en total (O(1) amortizado) aunque alguna sola cueste O(n).
 * @alternativas Un `ArrayDeque` usado como cola (offer/poll) da O(1) real en cada operación. `ArrayList.remove(0)`
 * sería O(n) por desencolar, porque desplaza todo.
 */
final class ColaConDosPilas<T> {
    private final Deque<T> entrada = new ArrayDeque<>();
    private final Deque<T> salida = new ArrayDeque<>();

    /**
     * Añade al final de la cola.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion Solo se apila en `entrada`; no se toca `salida`.
     * @bigo 1
     */
    void encolar(T valor) {
        entrada.push(valor);
    }

    /**
     * Quita y devuelve el primero que entró.
     *
     * @complejidad Tiempo O(1) amortizado; espacio O(1).
     * @explicacion Si `salida` está vacía se trasvasa `entrada`; después `pop()` lanza NoSuchElementException si la cola
     * estaba vacía, que es lo que se pide.
     * @bigo 1
     */
    T desencolar() {
        pasarASalida();
        return salida.pop();
    }

    /**
     * Mira el primero sin quitarlo.
     *
     * @complejidad Tiempo O(1) amortizado; espacio O(1).
     * @explicacion Igual que desencolar, pero con `getFirst()`, que también lanza NoSuchElementException si no hay nada.
     * @bigo 1
     */
    T frente() {
        pasarASalida();
        return salida.getFirst();
    }

    /**
     * Cuántos elementos hay.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion La suma de las dos pilas.
     * @bigo 1
     */
    int tamano() {
        return entrada.size() + salida.size();
    }

    /**
     * Indica si no hay elementos.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion Ambas pilas vacías.
     * @bigo 1
     */
    boolean vacia() {
        return tamano() == 0;
    }

    /**
     * Ayudante: si la pila de salida está vacía, le pasa la de entrada invirtiendo el orden.
     *
     * @complejidad Tiempo O(n) puntual, O(1) amortizado; espacio O(1).
     * @explicacion Solo trasvasa cuando `salida` está vacía; por eso cada elemento se mueve una sola vez.
     * @bigo 1
     */
    private void pasarASalida() {
        if (salida.isEmpty()) {
            while (!entrada.isEmpty()) {
                salida.push(entrada.pop());
            }
        }
    }
}

/**
 * Árbol binario de búsqueda sin duplicados.
 *
 * @complejidad insertar, contiene y minimo O(altura): O(log n) si está equilibrado y O(n) si se insertan datos ordenados;
 * enOrden, tamano y altura O(n); espacio O(n).
 * @explicacion Cada nodo manda lo menor a la izquierda y lo mayor a la derecha, así que buscar es descartar media rama
 * en cada paso. El recorrido en orden (izquierda, nodo, derecha) lista los valores ordenados. No se reequilibra: si se
 * insertan 1, 2, 3, 4... degenera en una lista de altura n.
 * @alternativas `TreeSet<Integer>` / `TreeMap` (árbol rojinegro): se reequilibra solo y garantiza O(log n) siempre.
 */
final class ArbolBinarioBusqueda {
    private NodoArbol raiz;
    private int tamano;

    /**
     * Inserta un valor (si ya está, no hace nada).
     *
     * @complejidad Tiempo O(altura); espacio O(altura) de pila.
     * @explicacion Baja comparando hasta encontrar el hueco vacío y devuelve el nodo para que el padre lo enganche; el
     * contador solo sube si el valor era nuevo.
     * @bigo log
     */
    void insertar(int valor) {
        raiz = insertar(raiz, valor);
    }

    /**
     * Ayudante recursivo de insertar().
     *
     * @complejidad Tiempo O(altura); espacio O(altura) de pila.
     * @explicacion Devuelve la raíz del subárbol ya con el valor dentro; si el valor es igual al del nodo no hay cambio.
     * @bigo log
     */
    private NodoArbol insertar(NodoArbol nodo, int valor) {
        if (nodo == null) {
            tamano++;
            return new NodoArbol(valor);
        }
        if (valor < nodo.valor) {
            nodo.izq = insertar(nodo.izq, valor);
        } else if (valor > nodo.valor) {
            nodo.der = insertar(nodo.der, valor);
        }
        return nodo;
    }

    /**
     * Indica si el valor está.
     *
     * @complejidad Tiempo O(altura); espacio O(1).
     * @explicacion Un bucle que baja a la izquierda o a la derecha según la comparación.
     * @bigo log
     */
    boolean contiene(int valor) {
        NodoArbol n = raiz;
        while (n != null) {
            if (valor == n.valor) {
                return true;
            }
            n = valor < n.valor ? n.izq : n.der;
        }
        return false;
    }

    /**
     * Número de valores distintos.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion Se lleva la cuenta al insertar.
     * @bigo 1
     */
    int tamano() {
        return tamano;
    }

    /**
     * Valores de menor a mayor.
     *
     * @complejidad Tiempo O(n); espacio O(altura) de pila más la lista de salida.
     * @explicacion Recorrido en orden con el ayudante recursivo.
     * @bigo n
     */
    List<Integer> enOrden() {
        List<Integer> salida = new ArrayList<>(tamano);
        enOrden(raiz, salida);
        return salida;
    }

    /**
     * Ayudante recursivo de enOrden().
     *
     * @complejidad Tiempo O(n); espacio O(altura) de pila.
     * @explicacion Izquierda, nodo, derecha, añadiendo a una única lista compartida (así no se copian listas en cada nivel).
     * @bigo n
     */
    private void enOrden(NodoArbol nodo, List<Integer> salida) {
        if (nodo != null) {
            enOrden(nodo.izq, salida);
            salida.add(nodo.valor);
            enOrden(nodo.der, salida);
        }
    }

    /**
     * Niveles del árbol.
     *
     * @complejidad Tiempo O(n); espacio O(altura) de pila.
     * @explicacion Vacío = 0; si no, 1 más la altura del hijo más alto.
     * @bigo n
     */
    int altura() {
        return altura(raiz);
    }

    /**
     * Ayudante recursivo de altura().
     *
     * @complejidad Tiempo O(n); espacio O(altura) de pila.
     * @explicacion Caso base: nodo nulo, 0 niveles.
     * @bigo n
     */
    private int altura(NodoArbol nodo) {
        return nodo == null ? 0 : 1 + Math.max(altura(nodo.izq), altura(nodo.der));
    }

    /**
     * El menor valor, o null si está vacío.
     *
     * @complejidad Tiempo O(altura); espacio O(1).
     * @explicacion Se baja siempre por la izquierda.
     * @bigo log
     */
    Integer minimo() {
        if (raiz == null) {
            return null;
        }
        NodoArbol n = raiz;
        while (n.izq != null) {
            n = n.izq;
        }
        return n.valor;
    }
}

/**
 * Montículo de mínimos sobre un array.
 *
 * @complejidad insertar y extraerMinimo O(log n); minimo O(1); espacio O(n).
 * @explicacion El árbol se guarda en un array: los hijos de i son 2i+1 y 2i+2 y el padre es (i-1)/2. Invariante: un
 * padre nunca es mayor que sus hijos, así que el mínimo siempre está en la posición 0. Al insertar se coloca al final y
 * se "sube"; al extraer se pone el último en la raíz y se "baja". Como el árbol es completo, su altura es log₂ n.
 * @alternativas `PriorityQueue<Integer>`, que hace exactamente esto (y crece sola).
 */
final class MinHeap {
    private int[] datos = new int[16];
    private int tamano;

    /**
     * Inserta un valor.
     *
     * @complejidad Tiempo O(log n) (O(n) puntual al duplicar el array); espacio O(1) amortizado.
     * @explicacion Si el array está lleno se copia a uno de doble tamaño (coste amortizado O(1)). Se añade al final y
     * se sube mientras sea menor que su padre.
     * @bigo log
     */
    void insertar(int valor) {
        if (tamano == datos.length) {
            datos = java.util.Arrays.copyOf(datos, tamano * 2);
        }
        datos[tamano] = valor;
        subir(tamano);
        tamano++;
    }

    /**
     * Quita y devuelve el menor.
     *
     * @complejidad Tiempo O(log n); espacio O(1).
     * @explicacion Se guarda la raíz, el último elemento ocupa su sitio y se baja a su posición. Vacío: NoSuchElementException.
     * @bigo log
     */
    int extraerMinimo() {
        int menor = minimo();
        tamano--;
        datos[0] = datos[tamano];
        if (tamano > 0) {
            bajar(0);
        }
        return menor;
    }

    /**
     * Mira el menor sin quitarlo.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion Es la raíz del array. Vacío: NoSuchElementException.
     * @bigo 1
     */
    int minimo() {
        if (tamano == 0) {
            throw new java.util.NoSuchElementException("El heap está vacío");
        }
        return datos[0];
    }

    /**
     * Cuántos elementos hay.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion El contador.
     * @bigo 1
     */
    int tamano() {
        return tamano;
    }

    /**
     * Indica si no hay elementos.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion Contador a cero.
     * @bigo 1
     */
    boolean vacio() {
        return tamano == 0;
    }

    /**
     * Ayudante: sube el elemento de la posición i mientras sea menor que su padre.
     *
     * @complejidad Tiempo O(log n); espacio O(1).
     * @explicacion Se intercambia con el padre ((i-1) >> 1) hasta que el padre sea menor o igual o se llegue a la raíz.
     * @bigo log
     */
    private void subir(int i) {
        while (i > 0) {
            int padre = (i - 1) >> 1;
            if (datos[padre] <= datos[i]) {
                break;
            }
            intercambiar(padre, i);
            i = padre;
        }
    }

    /**
     * Ayudante: baja el elemento de la posición i mientras algún hijo sea menor.
     *
     * @complejidad Tiempo O(log n); espacio O(1).
     * @explicacion Se elige el hijo MENOR de los dos (así el que sube cumple la regla con el otro) y se intercambia.
     * @bigo log
     */
    private void bajar(int i) {
        while (true) {
            int izq = 2 * i + 1;
            int der = izq + 1;
            int menor = i;
            if (izq < tamano && datos[izq] < datos[menor]) {
                menor = izq;
            }
            if (der < tamano && datos[der] < datos[menor]) {
                menor = der;
            }
            if (menor == i) {
                return;
            }
            intercambiar(i, menor);
            i = menor;
        }
    }

    /**
     * Ayudante: intercambia dos posiciones del array.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion Con una variable temporal.
     * @bigo 1
     */
    private void intercambiar(int a, int b) {
        int t = datos[a];
        datos[a] = datos[b];
        datos[b] = t;
    }
}

/**
 * Caché LRU con LinkedHashMap en modo de acceso.
 *
 * @complejidad obtener, poner y tamano O(1); claves O(n) por copiar; espacio O(capacidad).
 * @bigo 1
 * @explicacion `LinkedHashMap(capacidad, 0.75f, true)` combina una tabla hash (búsqueda O(1)) con una lista doblemente
 * enlazada que ordena las entradas por ÚLTIMO ACCESO: cada `get` o `put` mueve la entrada al final en O(1). La más antigua
 * queda siempre al principio, y `removeEldestEntry` (que el mapa llama tras cada `put`) la expulsa cuando se supera la
 * capacidad. Para `claves()` se recorre la vista en sentido inverso (`reversed()`, Java 21): de la más reciente a la más antigua.
 * @alternativas Un HashMap más una lista propia (el esquema clásico de entrevista): lo mismo pero a mano, con más código y
 * más fácil de equivocarse. Un HashMap y una cola ArrayDeque con `remove(Object)` es O(n) al refrescar.
 */
final class CacheLRU<V> {
    private final int capacidad;
    private final java.util.LinkedHashMap<String, V> mapa;

    CacheLRU(int capacidad) {
        if (capacidad < 1) {
            throw new IllegalArgumentException("La capacidad debe ser al menos 1");
        }
        this.capacidad = capacidad;
        this.mapa = new java.util.LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(java.util.Map.Entry<String, V> masAntigua) {
                return size() > CacheLRU.this.capacidad;
            }
        };
    }

    /**
     * Devuelve el valor y lo marca como el más reciente.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion En modo de acceso, `get` mueve la entrada al final de la lista. Si no está devuelve null.
     * @bigo 1
     */
    V obtener(String clave) {
        return mapa.get(clave);
    }

    /**
     * Inserta o actualiza, y expulsa la más antigua si hace falta.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion `put` deja la entrada como la más reciente y después `removeEldestEntry` decide la expulsión.
     * @bigo 1
     */
    void poner(String clave, V valor) {
        mapa.put(clave, valor);
    }

    /**
     * Claves de la más reciente a la más antigua.
     *
     * @complejidad Tiempo O(n); espacio O(n).
     * @explicacion Copia la vista de claves invertida a una lista nueva (no se expone la interna).
     * @bigo n
     */
    java.util.List<String> claves() {
        return new java.util.ArrayList<>(mapa.sequencedKeySet().reversed());
    }

    /**
     * Cuántas entradas hay.
     *
     * @complejidad Tiempo O(1); espacio O(1).
     * @explicacion El tamaño del mapa, que nunca supera la capacidad.
     * @bigo 1
     */
    int tamano() {
        return mapa.size();
    }
}
