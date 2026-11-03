/*
 * SOLUCIONES · Tema 5 · Ordenación
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
class Soluciones {

    /**
     * Burbuja con parada anticipada.
     *
     * @complejidad Tiempo O(n²) en el caso medio y peor, O(n) si ya está ordenada; espacio O(1) extra (trabaja sobre la copia).
     * @bigo n2
     * @explicacion En cada pasada se comparan vecinos y el mayor "sube" hasta su sitio, así que tras la pasada k los k
     * últimos ya están fijos (por eso el bucle interior se acorta). Si una pasada completa no intercambia nada, la lista
     * ya está ordenada y se sale: es lo que convierte el mejor caso en O(n). Se trabaja sobre `new ArrayList<>(xs)`
     * porque la lista recibida puede ser inmutable (`List.of`) y porque no se debe modificar la del llamador;
     * `Collections.swap` hace el intercambio sin variable temporal.
     * @alternativas Es de las peores en la práctica: inserción hace menos trabajo con el mismo coste teórico. Lo normal
     * es `List.sort` (O(n log n), TimSort).
     */
    static List<Integer> burbuja(List<Integer> xs) {
        List<Integer> r = new ArrayList<>(xs);
        int n = r.size();
        for (int pasada = 1; pasada < n; pasada++) {
            boolean cambio = false;
            for (int i = 0; i < n - pasada; i++) {
                if (r.get(i) > r.get(i + 1)) {
                    Collections.swap(r, i, i + 1);
                    cambio = true;
                }
            }
            if (!cambio) {
                break;
            }
        }
        return r;
    }

    /**
     * Ordenación por inserción.
     *
     * @complejidad Tiempo O(n²) medio y peor, O(n) si ya está ordenada; espacio O(1) extra.
     * @bigo n2
     * @explicacion La parte izquierda siempre está ordenada. Cada elemento nuevo se guarda, se desplazan hacia la derecha
     * los mayores que él y se deja caer en el hueco. No hace intercambios (solo desplazamientos), y es muy rápida en
     * listas pequeñas o casi ordenadas: por eso los `sort` de muchos lenguajes la usan para trozos de ~10-20 elementos.
     * Los valores son Integer: se compara con `>` (que los desempaqueta); con `==` se compararían referencias.
     * @alternativas Con búsqueda binaria para encontrar el hueco se reducen las comparaciones a O(n log n), pero los
     * desplazamientos siguen siendo O(n²). Merge o quick sort para listas grandes.
     */
    static List<Integer> insercion(List<Integer> xs) {
        List<Integer> r = new ArrayList<>(xs);
        for (int i = 1; i < r.size(); i++) {
            int actual = r.get(i);
            int j = i - 1;
            while (j >= 0 && r.get(j) > actual) {
                r.set(j + 1, r.get(j));
                j--;
            }
            r.set(j + 1, actual);
        }
        return r;
    }

    /**
     * Merge sort estable con comparador.
     *
     * @complejidad Tiempo O(n log n) siempre; espacio O(n).
     * @bigo nlogn
     * @explicacion Dividir por la mitad da log₂ n niveles y mezclar dos mitades ordenadas cuesta O(n) por nivel. La
     * estabilidad sale de mezclar con `<= 0`: ante un empate se toma el elemento de la IZQUIERDA, que era el que estaba
     * antes. A diferencia de quick sort, su coste no depende de los datos. `new ArrayList<>(subList(...))` copia cada
     * mitad (una vista `subList` ligada a la original se rompería si alguien la modificara).
     * @alternativas Quick sort: suele ser más rápido en memoria, pero no es estable y su peor caso es O(n²). Timsort
     * (el de `List.sort` y `Arrays.sort` para objetos) mezcla merge e inserción aprovechando los trozos ya ordenados.
     */
    static <T> List<T> mergeSort(List<T> xs, Comparator<? super T> comparar) {
        int n = xs.size();
        if (n < 2) {
            return new ArrayList<>(xs);
        }
        int medio = n / 2;
        List<T> izq = mergeSort(new ArrayList<>(xs.subList(0, medio)), comparar);
        List<T> der = mergeSort(new ArrayList<>(xs.subList(medio, n)), comparar);

        List<T> resultado = new ArrayList<>(n);
        int i = 0, j = 0;
        while (i < izq.size() && j < der.size()) {
            resultado.add(comparar.compare(izq.get(i), der.get(j)) <= 0 ? izq.get(i++) : der.get(j++));
        }
        while (i < izq.size()) {
            resultado.add(izq.get(i++));
        }
        while (j < der.size()) {
            resultado.add(der.get(j++));
        }
        return resultado;
    }

    /**
     * Quick sort con pivote central y tres grupos.
     *
     * @complejidad Tiempo O(n log n) medio, O(n²) en el peor caso (muy raro con pivote central); espacio O(n) en esta
     * versión funcional (la in situ usa O(log n)).
     * @bigo nlogn
     * @explicacion El pivote reparte la lista en menores, iguales y mayores; los iguales ya están en su sitio, así que
     * solo se recursa sobre los otros dos. Repartir los iguales aparte evita el clásico problema de las listas con
     * muchos repetidos (que degradaría a O(n²)). Elegir el elemento central hace que las listas ya ordenadas o
     * inversas, que son el peor caso con pivote en un extremo, sean casos buenos. Con `Integer`, compara con
     * `compareTo` (no con `==`, que compara referencias y falla fuera de -128..127).
     * @alternativas La versión in situ con particionado de Hoare/Lomuto no crea listas nuevas. Pivote aleatorio o
     * "mediana de tres" para blindarse contra entradas patológicas. En producción: `List.sort` o `Arrays.sort`.
     */
    static List<Integer> quickSort(List<Integer> xs) {
        int n = xs.size();
        if (n < 2) {
            return new ArrayList<>(xs);
        }
        Integer pivote = xs.get(n / 2);
        List<Integer> menores = new ArrayList<>();
        List<Integer> iguales = new ArrayList<>();
        List<Integer> mayores = new ArrayList<>();
        for (Integer x : xs) {
            int c = x.compareTo(pivote);
            if (c < 0) {
                menores.add(x);
            } else if (c > 0) {
                mayores.add(x);
            } else {
                iguales.add(x);
            }
        }
        List<Integer> resultado = new ArrayList<>(n);
        resultado.addAll(quickSort(menores));
        resultado.addAll(iguales);
        resultado.addAll(quickSort(mayores));
        return resultado;
    }

    /**
     * Ordenación por conteo.
     *
     * @complejidad Tiempo O(n + k) con k = max + 1; espacio O(k).
     * @bigo n
     * @explicacion No compara elementos: usa cada valor como índice de una tabla de contadores y después la recorre en
     * orden. Por eso se salta el límite O(n log n) de los algoritmos basados en comparaciones, a cambio de exigir enteros
     * en un rango pequeño. Si k es mucho mayor que n (p. ej. valores de hasta mil millones) deja de compensar.
     * @alternativas Radix sort (ordena dígito a dígito con counting sort, O(d·(n + b))) para rangos grandes;
     * `List.sort` si no se conoce el rango.
     */
    static List<Integer> countingSort(List<Integer> xs, int max) {
        int[] cuentas = new int[max + 1];
        for (int x : xs) {
            if (x < 0 || x > max) {
                throw new IllegalArgumentException("El valor " + x + " está fuera del rango 0.." + max);
            }
            cuentas[x]++;
        }
        List<Integer> resultado = new ArrayList<>(xs.size());
        for (int valor = 0; valor <= max; valor++) {
            for (int i = 0; i < cuentas[valor]; i++) {
                resultado.add(valor);
            }
        }
        return resultado;
    }

    /**
     * Orden por varios criterios.
     *
     * @complejidad Tiempo O(n log n); espacio O(n).
     * @explicacion Un `Comparator` encadenado: `comparing` fija el primer criterio y cada `thenComparing` solo se
     * consulta si los anteriores empatan. Para que UN criterio sea descendente se le pasa su propio
     * `Comparator.reverseOrder()` (invertir el comparador entero con `.reversed()` al final invertiría también el
     * apellido y el nombre). Se ordena una copia: `List.sort` modifica la lista y la recibida puede ser inmutable.
     * @alternativas Escribir el comparador a mano con `if` anidados sobre `String.compareTo` e `Integer.compare`: más
     * largo. Un `stream().sorted(comp).toList()`, equivalente (y devuelve una lista inmutable).
     */
    static List<Persona> ordenarPersonas(List<Persona> personas) {
        List<Persona> copia = new ArrayList<>(personas);
        copia.sort(Comparator.comparing(Persona::apellido)
            .thenComparing(Persona::edad, Comparator.reverseOrder())
            .thenComparing(Persona::nombre));
        return copia;
    }

    /**
     * Orden por frecuencia.
     *
     * @complejidad Tiempo O(n + d log d) con d valores distintos; espacio O(n).
     * @explicacion Un HashMap con `merge` cuenta en O(n). Solo se ordenan los d valores DISTINTOS (por frecuencia
     * descendente y luego por valor), y después cada uno se repite tantas veces como aparecía. Ordenar la lista entera
     * de n elementos con un comparador que mirase las frecuencias sería O(n log n) y más lento.
     * @alternativas Un único `sort` sobre los n elementos con las frecuencias en un mapa: más corto, algo más caro.
     */
    static List<Integer> ordenarPorFrecuencia(List<Integer> xs) {
        Map<Integer, Integer> cuentas = new HashMap<>();
        for (int x : xs) {
            cuentas.merge(x, 1, Integer::sum);
        }
        List<Integer> valores = new ArrayList<>(cuentas.keySet());
        valores.sort(Comparator.<Integer, Integer>comparing(cuentas::get).reversed().thenComparing(Comparator.naturalOrder()));
        List<Integer> resultado = new ArrayList<>(xs.size());
        for (int v : valores) {
            for (int i = 0; i < cuentas.get(v); i++) {
                resultado.add(v);
            }
        }
        return resultado;
    }
}
