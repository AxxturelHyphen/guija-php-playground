/*
 * SOLUCIONES · Tema 3 · Arrays y colecciones
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
class Soluciones {

    /**
     * Agrupa los elementos por una clave calculada.
     *
     * @complejidad Tiempo O(n); espacio O(n).
     * @bigo n
     * @explicacion Una sola pasada con un LinkedHashMap: `computeIfAbsent` crea la lista de la clave la primera vez
     * que aparece y devuelve la existente las demás, así que las claves salen en orden de primera aparición y cada
     * grupo conserva el orden original. Un HashMap normal agruparía igual, pero perdería el orden de las claves.
     * @alternativas `stream().collect(Collectors.groupingBy(clave))`: una línea, pero devuelve un HashMap (sin orden
     * garantizado) salvo que le pases `LinkedHashMap::new` como fábrica. Recorrer la lista una vez por cada clave
     * distinta: O(n·g).
     */
    static <T, K> Map<K, List<T>> agruparPor(List<T> items, Function<T, K> clave) {
        Map<K, List<T>> grupos = new LinkedHashMap<>();
        for (T item : items) {
            grupos.computeIfAbsent(clave.apply(item), k -> new ArrayList<>()).add(item);
        }
        return grupos;
    }

    /**
     * Las k palabras más frecuentes.
     *
     * @complejidad Tiempo O(n + d log d) con n palabras y d distintas; espacio O(d).
     * @explicacion Un `matcher` con `\p{L}+` recorre el texto sacando las palabras (con tildes y ñ). Se pasan a
     * minúsculas con `Locale.ROOT` (para no depender del idioma del sistema) y se cuentan con `merge`. Después se
     * ordenan las entradas por veces descendente y, a igualdad, por palabra: el desempate alfabético es lo que hace el
     * resultado determinista. Se vuelcan en un LinkedHashMap para conservar ese orden.
     * @alternativas Una PriorityQueue de tamaño k: O(n + d log k), mejor si k es pequeño y d enorme. `String.split`
     * con `\\W+` partiría las palabras con acento, porque `\w` no incluye letras no ASCII sin la bandera UNICODE.
     */
    static Map<String, Integer> topPalabras(String texto, int k) {
        Map<String, Integer> cuenta = new HashMap<>();
        var m = java.util.regex.Pattern.compile("\\p{L}+").matcher(texto);
        while (m.find()) {
            cuenta.merge(m.group().toLowerCase(Locale.ROOT), 1, Integer::sum);
        }
        Map<String, Integer> resultado = new LinkedHashMap<>();
        cuenta.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
            .limit(Math.max(0, k))
            .forEach(e -> resultado.put(e.getKey(), e.getValue()));
        return resultado;
    }

    /**
     * Aplana listas anidadas.
     *
     * @complejidad Tiempo O(n) con n el número total de elementos; espacio O(n + p) con p la profundidad (pila).
     * @explicacion Recursión con una lista acumuladora compartida: si el elemento es una List o un Object[] se
     * desciende; si no, se añade. Pasar el acumulador evita crear una lista intermedia por cada nivel (que sería
     * O(n·p)). `ArrayList` admite null, así que no se pierden los nulos (con `stream().flatMap` y `List.of`, sí).
     * @alternativas Una pila explícita (ArrayDeque) para evitar el desbordamiento con anidamiento de miles de niveles.
     * `flatMap` recursivo: elegante, pero no deja pasar null y crea un stream por nivel.
     */
    static List<Object> aplanar(List<?> a) {
        List<Object> resultado = new ArrayList<>();
        aplanarEn(a, resultado);
        return resultado;
    }

    /**
     * Ayudante de aplanar(): recorre un nodo y vuelca sus hojas en destino.
     *
     * @complejidad Tiempo O(n) en total; espacio O(p) de pila, con p la profundidad.
     * @explicacion Un nodo List u Object[] se recorre y cada hijo se procesa igual; cualquier otro valor es una hoja
     * y se añade. El acumulador compartido evita copiar sublistas en cada nivel.
     */
    private static void aplanarEn(Object nodo, List<Object> destino) {
        if (nodo instanceof List<?> lista) {
            for (Object e : lista) {
                aplanarEn(e, destino);
            }
        } else if (nodo instanceof Object[] array) {
            for (Object e : array) {
                aplanarEn(e, destino);
            }
        } else {
            destino.add(nodo);
        }
    }

    /**
     * Elimina repetidos conservando el orden.
     *
     * @complejidad Tiempo O(n); espacio O(n).
     * @bigo n
     * @explicacion Un `HashSet` da `add` en O(1) y devuelve false si el elemento ya estaba: se recorre la lista una sola
     * vez y se añade a la salida solo cuando `add` dice true. El truco clave es que `Set.add` hace a la vez la
     * comprobación y la inserción.
     * @alternativas `new ArrayList<>(new LinkedHashSet<>(xs))`: igual de O(n) y una sola línea. `stream().distinct()`:
     * también conserva el orden. Con `contains` de la propia lista dentro del bucle sería O(n²): con 10.000 elementos,
     * 100 millones de comparaciones.
     */
    static <T> List<T> unicos(List<T> xs) {
        Set<T> vistos = new HashSet<>();
        List<T> resultado = new ArrayList<>();
        for (T x : xs) {
            if (vistos.add(x)) {
                resultado.add(x);
            }
        }
        return resultado;
    }

    /**
     * Intersección en orden de la primera lista.
     *
     * @complejidad Tiempo O(n + m); espacio O(n + m).
     * @bigo n
     * @explicacion `new HashSet<>(b)` convierte la segunda lista en un conjunto en O(m); después cada pertenencia es O(1)
     * con `contains`. Un segundo conjunto (`vistos`) evita repetir valores de `a` ya añadidos.
     * @alternativas Bucle doble o `b.contains` por elemento: O(n·m). `retainAll` sobre una copia: cómodo, pero con una
     * lista como argumento es O(n·m) y además no quita los repetidos. Ordenar ambas y avanzar con dos punteros:
     * O(n log n + m log m) y sin memoria extra.
     */
    static List<Integer> interseccion(List<Integer> a, List<Integer> b) {
        Set<Integer> enB = new HashSet<>(b);
        Set<Integer> vistos = new HashSet<>();
        List<Integer> resultado = new ArrayList<>();
        for (Integer x : a) {
            if (enB.contains(x) && vistos.add(x)) {
                resultado.add(x);
            }
        }
        return resultado;
    }

    /**
     * Transpone una matriz.
     *
     * @complejidad Tiempo O(f·c); espacio O(f·c).
     * @explicacion Se crea una fila nueva por cada columna j del primer elemento y se rellena con `m.get(i).get(j)` para
     * cada fila i. Funciona con una sola fila (da una columna) o una sola columna (da una fila); la matriz vacía se
     * trata aparte porque no hay `m.get(0)` del que sacar el número de columnas.
     * @alternativas `IntStream.range(0, columnas).mapToObj(j -> m.stream().map(f -> f.get(j)).toList()).toList()`:
     * lo mismo en estilo funcional. Con int[][] se haría con dos bucles escribiendo `t[j][i] = m[i][j]`.
     */
    static List<List<Integer>> transponer(List<List<Integer>> m) {
        if (m.isEmpty()) {
            return new ArrayList<>();
        }
        List<List<Integer>> resultado = new ArrayList<>();
        for (int j = 0; j < m.get(0).size(); j++) {
            List<Integer> columna = new ArrayList<>(m.size());
            for (List<Integer> fila : m) {
                columna.add(fila.get(j));
            }
            resultado.add(columna);
        }
        return resultado;
    }
}

/**
 * Envoltura fluida e inmutable sobre una lista.
 *
 * @complejidad Cada operación es O(n) (excepto take, O(k)); sortBy O(n log n); espacio O(n) por cada copia.
 * @explicacion Cada método construye una Coleccion NUEVA a partir de una copia de la lista, de modo que la original
 * no cambia nunca. `sortBy` usa `List.sort` (estable): con `reversed()` los empatados conservan su orden original,
 * que es lo que se espera de un orden descendente. `unique` usa un LinkedHashSet, y como compara con `equals`,
 * Integer 1 y String "1" son distintos. `pluck` busca el accesor del record por reflexión (o la clave si es un Map).
 * @alternativas Devolver directamente `Stream<T>`: más flexible y perezoso, pero se consume una sola vez y no se puede
 * pasar por ahí como valor. Usar `List.copyOf`: más corto, pero lanza NullPointerException si hay null.
 */
final class Coleccion<T> implements Iterable<T> {
    private final List<T> items;

    private Coleccion(List<T> items) {
        this.items = Collections.unmodifiableList(new ArrayList<>(items));
    }

    static <T> Coleccion<T> hacer(List<T> items) {
        return new Coleccion<>(items);
    }

    List<T> all() {
        return items;
    }

    int count() {
        return items.size();
    }

    @Override
    public Iterator<T> iterator() {
        return items.iterator();
    }

    <R> Coleccion<R> map(Function<? super T, ? extends R> f) {
        List<R> salida = new ArrayList<>(items.size());
        for (T item : items) {
            salida.add(f.apply(item));
        }
        return new Coleccion<>(salida);
    }

    Coleccion<T> filter(Predicate<? super T> f) {
        List<T> salida = new ArrayList<>();
        for (T item : items) {
            if (f.test(item)) {
                salida.add(item);
            }
        }
        return new Coleccion<>(salida);
    }

    Coleccion<T> filter() {
        return filter(item -> !(item == null
            || Boolean.FALSE.equals(item)
            || (item instanceof Number n && n.doubleValue() == 0)
            || (item instanceof CharSequence s && s.isEmpty())));
    }

    <R> R reduce(R inicial, BiFunction<R, ? super T, R> f) {
        R acc = inicial;
        for (T item : items) {
            acc = f.apply(acc, item);
        }
        return acc;
    }

    double sum() {
        double suma = 0;
        for (T item : items) {
            suma += ((Number) item).doubleValue();
        }
        return suma;
    }

    double avg() {
        return items.isEmpty() ? 0.0 : sum() / items.size();
    }

    T first() {
        return items.isEmpty() ? null : items.get(0);
    }

    T first(Predicate<? super T> f) {
        return first(f, null);
    }

    T first(Predicate<? super T> f, T defecto) {
        for (T item : items) {
            if (f.test(item)) {
                return item;
            }
        }
        return defecto;
    }

    <K extends Comparable<? super K>> Coleccion<T> sortBy(Function<? super T, ? extends K> clave, boolean desc) {
        List<T> copia = new ArrayList<>(items);
        Comparator<T> orden = Comparator.comparing(clave);
        copia.sort(desc ? orden.reversed() : orden);
        return new Coleccion<>(copia);
    }

    <K extends Comparable<? super K>> Coleccion<T> sortBy(Function<? super T, ? extends K> clave) {
        return sortBy(clave, false);
    }

    Coleccion<Object> pluck(String campo) {
        return map(item -> {
            if (item instanceof Map<?, ?> m) {
                return m.get(campo);
            }
            try {
                var accesor = item.getClass().getDeclaredMethod(campo);
                accesor.setAccessible(true);
                return accesor.invoke(item);
            } catch (ReflectiveOperationException e) {
                throw new IllegalArgumentException("No existe el campo '" + campo + "' en " + item.getClass().getSimpleName());
            }
        });
    }

    <K> Map<K, List<T>> groupBy(Function<? super T, ? extends K> f) {
        Map<K, List<T>> grupos = new LinkedHashMap<>();
        for (T item : items) {
            grupos.computeIfAbsent(f.apply(item), k -> new ArrayList<>()).add(item);
        }
        return grupos;
    }

    Coleccion<T> unique() {
        return new Coleccion<>(new ArrayList<>(new LinkedHashSet<>(items)));
    }

    Coleccion<T> take(int n) {
        return new Coleccion<>(items.subList(0, Math.max(0, Math.min(n, items.size()))));
    }
}
