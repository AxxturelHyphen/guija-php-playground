/*
 * SOLUCIONES · Tema 6 · Búsqueda y técnicas
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
class Soluciones {

    /**
     * Búsqueda binaria (valor exacto).
     *
     * @complejidad Tiempo O(log n); espacio O(1).
     * @bigo log
     * @explicacion Invariante: si `x` está en el array, está entre `bajo` y `alto`. Cada vuelta mira el medio y
     * descarta la mitad que no puede contenerlo, así que el intervalo se divide por dos y en log₂ n pasos queda vacío.
     * Es imprescindible moverse a `medio ± 1` (no a `medio`), o el bucle puede no terminar nunca. El medio se calcula
     * como `bajo + (alto - bajo) / 2`: `(bajo + alto) / 2` desbordaría el int con arrays enormes.
     * @alternativas La búsqueda lineal (un `for`): O(n), válida si no está ordenado o si es muy corto. `Arrays.binarySearch`
     * ya lo hace (devuelve `-(punto de inserción) - 1` si no está). Si buscas muchas veces sobre datos fijos que no
     * tienen orden, un HashSet da O(1).
     */
    static int busquedaBinaria(int[] ordenado, int x) {
        int bajo = 0;
        int alto = ordenado.length - 1;
        while (bajo <= alto) {
            int medio = bajo + (alto - bajo) / 2;
            if (ordenado[medio] == x) {
                return medio;
            }
            if (ordenado[medio] < x) {
                bajo = medio + 1;
            } else {
                alto = medio - 1;
            }
        }
        return -1;
    }

    /**
     * Límite inferior (lower bound).
     *
     * @complejidad Tiempo O(log n); espacio O(1).
     * @bigo log
     * @explicacion Aquí el intervalo es SEMIABIERTO `[bajo, alto)` y `alto` empieza en `length` (la posición "después del
     * último" es una respuesta válida). Si `ordenado[medio] < x`, la respuesta está estrictamente a la derecha; si no,
     * `medio` podría ser la respuesta, así que se conserva (`alto = medio`). Al terminar, `bajo == alto` es la primera
     * posición con valor ≥ x. Con repetidos nunca se "salta" el primero, que es justo lo pedido.
     * @alternativas Una búsqueda binaria exacta seguida de un retroceso lineal para hallar el primer repetido: O(n)
     * en el peor caso (todos iguales).
     */
    static int limiteInferior(int[] ordenado, int x) {
        int bajo = 0;
        int alto = ordenado.length;
        while (bajo < alto) {
            int medio = bajo + (alto - bajo) / 2;
            if (ordenado[medio] < x) {
                bajo = medio + 1;
            } else {
                alto = medio;
            }
        }
        return bajo;
    }

    /**
     * Par con suma objetivo en un array ordenado (dos punteros).
     *
     * @complejidad Tiempo O(n); espacio O(1).
     * @bigo n
     * @explicacion Con el array ordenado, si la suma de los extremos se queda corta hay que subir el menor (puntero
     * izquierdo), y si se pasa hay que bajar el mayor (derecho): ningún otro emparejamiento del elemento descartado
     * puede dar el objetivo. Cada paso elimina un candidato, así que hay como mucho n pasos, sin memoria extra.
     * @alternativas Dos bucles anidados: O(n²). Tabla hash (como en `dosSumas`): O(n) pero con O(n) de memoria, y no
     * aprovecha que está ordenado. Para cada elemento, búsqueda binaria del complemento: O(n log n).
     */
    static int[] parSuma(int[] ordenado, int objetivo) {
        int i = 0;
        int j = ordenado.length - 1;
        while (i < j) {
            int suma = ordenado[i] + ordenado[j];
            if (suma == objetivo) {
                return new int[] {i, j};
            }
            if (suma < objetivo) {
                i++;
            } else {
                j--;
            }
        }
        return null;
    }

    /**
     * Dos sumas con tabla hash.
     *
     * @complejidad Tiempo O(n); espacio O(n).
     * @bigo n
     * @explicacion Al visitar cada número se pregunta "¿ya vi `objetivo - n`?" con `get` (O(1)). Si sí, ya hay par;
     * si no, se apunta `n` y su posición. Una sola pasada, y como se comprueba ANTES de guardar, un número nunca se
     * empareja consigo mismo (pero `[3, 3]` sí funciona para 6). `get` devuelve `Integer` y es null si no está: se
     * guarda en una variable `Integer` y se compara con null (desempaquetarlo a `int` directamente lanzaría
     * NullPointerException).
     * @alternativas Fuerza bruta con dos bucles: O(n²). Ordenar y usar dos punteros: O(n log n), pero hay que ordenar
     * guardando las posiciones originales.
     */
    static int[] dosSumas(int[] nums, int objetivo) {
        Map<Integer, Integer> vistos = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer posicion = vistos.get(objetivo - nums[i]);
            if (posicion != null) {
                return new int[] {posicion, i};
            }
            vistos.put(nums[i], i);
        }
        return null;
    }

    /**
     * Suma máxima de una ventana de tamaño k.
     *
     * @complejidad Tiempo O(n); espacio O(1).
     * @bigo n
     * @explicacion Se calcula la suma de la primera ventana y después se DESLIZA: al avanzar una posición entra
     * `a[i]` y sale `a[i - k]`, así que la nueva suma cuesta O(1) en vez de volver a sumar k elementos. Sumar cada
     * ventana desde cero costaría O(n·k), que con k = n/2 es O(n²). Las sumas se llevan en `long` para que muchos int
     * grandes no desborden.
     * @alternativas Con `Arrays.stream(a, i, i + k).sum()` en cada posición: correcto y muy legible, pero O(n·k). Los
     * mínimos/máximos móviles necesitan una cola doble (deque monótona) para mantener el O(n).
     */
    static long sumaMaximaVentana(int[] a, int k) {
        int n = a.length;
        if (k < 1 || k > n) {
            throw new IllegalArgumentException("k debe estar entre 1 y " + n + ", no " + k);
        }
        long suma = 0;
        for (int i = 0; i < k; i++) {
            suma += a[i];
        }
        long maxima = suma;
        for (int i = k; i < n; i++) {
            suma += a[i] - a[i - k];
            if (suma > maxima) {
                maxima = suma;
            }
        }
        return maxima;
    }

    /**
     * Subcadena más larga sin repetidos.
     *
     * @complejidad Tiempo O(n); espacio O(min(n, tamaño del alfabeto)).
     * @bigo n
     * @explicacion La ventana `[inicio, i]` nunca contiene repetidos. Una tabla guarda la ÚLTIMA posición de cada
     * carácter; si el carácter actual ya estaba DENTRO de la ventana, `inicio` salta justo detrás de esa posición
     * (sin retroceder jamás). Cada carácter se procesa una vez. `codePoints()` trata cada carácter Unicode (tildes,
     * emojis) como una unidad, a diferencia de `charAt(i)`, que lee mitades UTF-16: un emoji sería "dos caracteres".
     * @alternativas Probar todas las subcadenas y comprobar repetidos en cada una: O(n²) o O(n³).
     */
    static int subcadenaSinRepetir(String s) {
        int[] caracteres = s.codePoints().toArray();
        Map<Integer, Integer> ultima = new HashMap<>();
        int inicio = 0;
        int mejor = 0;
        for (int i = 0; i < caracteres.length; i++) {
            Integer previa = ultima.get(caracteres[i]);
            if (previa != null && previa >= inicio) {
                inicio = previa + 1;
            }
            ultima.put(caracteres[i], i);
            mejor = Math.max(mejor, i - inicio + 1);
        }
        return mejor;
    }

    /**
     * Agrupa anagramas.
     *
     * @complejidad Tiempo O(n · k log k) con n palabras de longitud media k; espacio O(n · k).
     * @explicacion Dos palabras son anagramas si tienen las mismas letras ordenadas, así que esa forma "canónica" es la
     * clave de la tabla. Un LinkedHashMap conserva el orden de inserción, así que los grupos salen por la primera
     * aparición sin ordenar nada; `computeIfAbsent` crea el grupo la primera vez. Se ordenan los `char` con
     * `Arrays.sort` y se vuelve a texto con `new String(chars)`.
     * @alternativas Contar las letras (un vector de 26 cuentas como clave) evita ordenar y baja a O(n·k) para alfabetos
     * pequeños. Comparar cada palabra con cada grupo: O(n²·k). Un HashMap normal agruparía igual pero sin orden.
     */
    static List<List<String>> agruparAnagramas(List<String> palabras) {
        Map<String, List<String>> grupos = new LinkedHashMap<>();
        for (String palabra : palabras) {
            char[] letras = palabra.toCharArray();
            Arrays.sort(letras);
            grupos.computeIfAbsent(new String(letras), k -> new ArrayList<>()).add(palabra);
        }
        return new ArrayList<>(grupos.values());
    }
}

/**
 * Sumas prefijas para consultas de rango en O(1).
 *
 * @complejidad Construir O(n); cada consulta O(1); espacio O(n).
 * @bigo 1
 * @explicacion `prefijo[i]` guarda la suma de los primeros i elementos (con `prefijo[0] = 0`), así que la suma de
 * `desde..hasta` es `prefijo[hasta + 1] - prefijo[desde]`: la parte común se cancela. El trabajo pesado se paga
 * una vez en el constructor y cada pregunta posterior es una resta. El array es de `long` para que no desborde.
 * @alternativas Sumar el rango en cada consulta (`Arrays.stream(a, desde, hasta + 1).sum()`): O(n) por consulta, de modo
 * que q consultas cuestan O(n·q). Un árbol de Fenwick/segmentos si además hay que ACTUALIZAR valores.
 */
final class SumasPrefijas {
    private final long[] prefijo;

    SumasPrefijas(int[] valores) {
        prefijo = new long[valores.length + 1];
        for (int i = 0; i < valores.length; i++) {
            prefijo[i + 1] = prefijo[i] + valores[i];
        }
    }

    long suma(int desde, int hasta) {
        if (desde < 0 || hasta >= prefijo.length - 1 || desde > hasta) {
            throw new IndexOutOfBoundsException("Rango no válido: " + desde + ".." + hasta);
        }
        return prefijo[hasta + 1] - prefijo[desde];
    }
}
