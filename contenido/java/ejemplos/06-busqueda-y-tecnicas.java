import java.util.*;

/*
 * TEMA 6 · BÚSQUEDA Y TÉCNICAS CLÁSICAS
 * ────────────────────────────────────────────────────────────────────────────
 * Muchos problemas "difíciles" son en realidad un truco de cuatro o cinco que se repiten.
 * Aquí aprenderás los que más rentabilidad tienen y cuándo aplicarlos:
 *
 *   Búsqueda binaria     datos ORDENADOS          O(n) → O(log n)
 *   Dos punteros         datos ordenados / pares  O(n²) → O(n)
 *   Ventana deslizante   subarrays contiguos       O(n·k) → O(n)
 *   Tabla hash           "¿lo he visto ya?"        O(n²) → O(n)
 *   Sumas prefijas       consultas de rango        O(n) por consulta → O(1)
 *
 * La idea común: no recalcular lo que ya sabes. Cambiar tiempo por un poco de memoria.
 */
class BusquedaYTecnicas {

    static void titulo(String texto) {
        System.out.println("\n=== " + texto + " ===");
    }

    /** Muestra un valor en una línea: [1, 2] para listas y arrays primitivos, null si no hay. */
    static String ver(Object valor) {
        if (valor instanceof int[] a) {
            return Arrays.toString(a);
        }
        if (valor instanceof double[] a) {
            return Arrays.toString(a);
        }
        if (valor instanceof long[] a) {
            return Arrays.toString(a);
        }
        return String.valueOf(valor);
    }

    /** Atajo para escribir un int[] en las pruebas: arr(1, 2, 3). */
    static int[] arr(int... xs) {
        return xs;
    }

    /** Cadena de n caracteres Unicode distintos (para medir subcadenaSinRepetir). */
    static String cadenaDistinta(int n) {
        var sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            sb.appendCodePoint(0x10000 + i);
        }
        return sb.toString();
    }

    /** Devuelve {índice, número de pasos}. */
    static int[] lineal(int[] xs, int x) {
        int pasos = 0;
        for (int i = 0; i < xs.length; i++) {
            pasos++;
            if (xs[i] == x) {
                return new int[] {i, pasos};
            }
        }
        return new int[] {-1, pasos};
    }

    static int[] binariaConPasos(int[] xs, int x) {
        int pasos = 0;
        int bajo = 0;
        int alto = xs.length - 1;
        while (bajo <= alto) {                      // invariante: si x está, está en [bajo, alto]
            pasos++;
            int medio = bajo + (alto - bajo) / 2;   // NO (bajo + alto) / 2: con listas de ~2.000 millones se desborda el int
            if (xs[medio] == x) {                   // (ese fallo estuvo años escondido en el Arrays.binarySearch del propio JDK)
                return new int[] {medio, pasos};
            }
            if (xs[medio] < x) {
                bajo = medio + 1;                   // descarta la mitad izquierda (y el medio)
            } else {
                alto = medio - 1;                   // descarta la mitad derecha (y el medio)
            }
        }
        return new int[] {-1, pasos};
    }

    static int[] parConSuma(int[] ordenado, int objetivo) {
        int i = 0;
        int j = ordenado.length - 1;
        while (i < j) {
            int suma = ordenado[i] + ordenado[j];
            System.out.println("  " + ordenado[i] + " + " + ordenado[j] + " = " + suma);
            if (suma == objetivo) {
                return new int[] {ordenado[i], ordenado[j]};
            }
            if (suma < objetivo) {
                i++;
            } else {
                j--;
            }
        }
        return null;
    }

    static double[] mediaMovil(int[] xs, int k) {
        double[] medias = new double[xs.length - k + 1];
        long suma = 0;
        for (int i = 0; i < k; i++) {
            suma += xs[i];
        }
        medias[0] = (double) suma / k;
        for (int i = k; i < xs.length; i++) {
            suma += xs[i] - xs[i - k];                // entra xs[i], sale xs[i - k]
            medias[i - k + 1] = (double) suma / k;
        }
        return medias;
    }

    /** Primer carácter que no se repite (null si todos se repiten). */
    static String primerUnico(String s) {
        Map<Integer, Integer> cuentas = new LinkedHashMap<>();   // LinkedHashMap conserva el orden de inserción (HashMap no)
        s.codePoints().forEach(c -> cuentas.merge(c, 1, Integer::sum));
        for (var e : cuentas.entrySet()) {
            if (e.getValue() == 1) {
                return new String(Character.toChars(e.getKey()));
            }
        }
        return null;
    }

    static int[] dosSumasTraza(int[] nums, int objetivo) {
        Map<Integer, Integer> vistos = new HashMap<>();          // valor → índice
        for (int i = 0; i < nums.length; i++) {
            int falta = objetivo - nums[i];
            System.out.println("  n=" + nums[i] + ", busco " + falta + ": " + (vistos.containsKey(falta) ? "encontrado" : "no está aún"));
            if (vistos.containsKey(falta)) {
                return new int[] {vistos.get(falta), i};
            }
            vistos.put(nums[i], i);
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // EJERCICIOS
    // ════════════════════════════════════════════════════════════════════════════

    // ── Ejercicio 1 · busquedaBinaria ───────────────────────────────────────────
    /**
     * Índice de x en el array ORDENADO ascendente, o -1 si no está. Debe ser O(log n).
     * Si hay repetidos, vale cualquier posición válida (las pruebas no los incluyen).
     * (La librería ya lo trae: Arrays.binarySearch, que si no lo encuentra devuelve -(donde iría) - 1.)
     */
    static int busquedaBinaria(int[] ordenado, int x) {
        return pendiente();
    }

    // ── Ejercicio 2 · limiteInferior ────────────────────────────────────────────
    /**
     * Primera posición cuyo valor es MAYOR O IGUAL que x (el "lower bound"); ordenado.length si todos son menores.
     * Con repetidos devuelve la PRIMERA aparición. Es la búsqueda binaria que más se usa en la práctica
     * (insertar en una lista ordenada, contar cuántos hay menores que x...). O(log n).
     *
     *   limiteInferior([1, 3, 3, 3, 7], 3)  →  1        limiteInferior([1, 3, 7], 5)  →  2
     */
    static int limiteInferior(int[] ordenado, int x) {
        return pendiente();
    }

    // ── Ejercicio 3 · parSuma (dos punteros) ────────────────────────────────────
    /**
     * En un array ordenado ascendente, busca dos posiciones i < j cuyos valores sumen objetivo y devuelve {i, j};
     * null si no hay. Usa dos punteros desde los extremos: O(n). (Las pruebas solo tienen una solución posible.)
     */
    static int[] parSuma(int[] ordenado, int objetivo) {
        return pendiente();
    }

    // ── Ejercicio 4 · dosSumas (tabla hash) ─────────────────────────────────────
    /**
     * Como el anterior, pero el array NO está ordenado: devuelve las posiciones {i, j} (i < j) de dos números que
     * suman objetivo, o null. O(n) con una tabla de "valor ya visto → posición" (HashMap<Integer, Integer>).
     * Alternativa ingenua: dos bucles anidados, O(n²).
     */
    static int[] dosSumas(int[] nums, int objetivo) {
        return pendiente();
    }

    // ── Ejercicio 5 · sumaMaximaVentana ─────────────────────────────────────────
    /**
     * La mayor suma de k elementos CONSECUTIVOS. O(n) con ventana deslizante. Devuelve long: la suma de muchos
     * int puede no caber en un int.
     * k < 1 o k > a.length → IllegalArgumentException.
     *   sumaMaximaVentana([2, 1, 5, 1, 3, 2], 3)  →  9   (5 + 1 + 3)
     * Alternativa ingenua: sumar cada ventana desde cero, O(n·k).
     */
    static long sumaMaximaVentana(int[] a, int k) {
        return pendiente();
    }

    // ── Ejercicio 6 · subcadenaSinRepetir ───────────────────────────────────────
    /**
     * Longitud de la subcadena más larga SIN caracteres repetidos (ventana deslizante + tabla de últimas posiciones).
     * Trabaja con caracteres Unicode completos: un emoji ocupa DOS char en Java, así que recorre s.codePoints(),
     * no s.charAt(i). O(n).
     *   "abcabcbb" → 3 ("abc")      "bbbbb" → 1      "pwwkew" → 3 ("wke")      "" → 0
     */
    static int subcadenaSinRepetir(String s) {
        return pendiente();
    }

    // ── Ejercicio 7 · agruparAnagramas ──────────────────────────────────────────
    /**
     * Agrupa las palabras que son anagramas entre sí (mismas letras, distinto orden). Los grupos salen en el orden
     * de la primera palabra de cada uno, y dentro de cada grupo se respeta el orden de entrada. Distingue minúsculas.
     *   [rata, tara, sol, los, arta, pez]  →  [[rata, tara, arta], [sol, los], [pez]]
     * Pista: dos palabras son anagramas si tienen las mismas letras ORDENADAS: esa es la clave del grupo.
     */
    static List<List<String>> agruparAnagramas(List<String> palabras) {
        return pendiente();
    }

    public static void main(String[] args) {

// ════════════════════════════════════════════════════════════════════════════
// 1. BÚSQUEDA LINEAL FRENTE A BINARIA
// ════════════════════════════════════════════════════════════════════════════
        // Lineal: mirar uno por uno → hasta n pasos. Binaria: en una lista ORDENADA, mirar el del medio y descartar la
        // mitad que no puede contenerlo → log₂ n pasos (con mil millones de elementos, ~30).
        titulo("1. Lineal frente a binaria");

        int[] datos = rango(0, 1_000_000, 2);            // 500.001 números pares, ordenados
        for (int buscado : new int[] {1000, 777_776, 999_999}) {
            int[] l = lineal(datos, buscado);
            int[] b = binariaConPasos(datos, buscado);
            System.out.printf("buscando %9s → lineal: pos %6d en %6s pasos · binaria: pos %6d en %2d pasos%n",
                String.format(Locale.GERMANY, "%,d", buscado), l[0], String.format(Locale.GERMANY, "%,d", l[1]), b[0], b[1]);
        }
        System.out.println("(999.999 es impar: no está, y la lineal lo comprueba todo)");

        // Los errores típicos de la binaria: `alto = length - 1` o `length` (hay que ser coherente con `<=` o `<`),
        // no avanzar `medio ± 1` (bucle infinito), el desbordamiento de `(bajo + alto) / 2` y no ordenar antes.
        // Las dos plantillas más usadas:
        //   · buscar un valor exacto:                      while (bajo <= alto) {...}
        //   · buscar la primera posición que cumple algo:  while (bajo < alto) { ... } ("límite inferior")
        // En la librería: Arrays.binarySearch(int[], x) y Collections.binarySearch(lista, x).

// ════════════════════════════════════════════════════════════════════════════
// 2. DOS PUNTEROS
// ════════════════════════════════════════════════════════════════════════════
        // Con la lista ordenada, un puntero al principio y otro al final se van acercando según la suma
        // sea demasiado pequeña o demasiado grande. Cada paso descarta al menos un candidato: O(n).
        titulo("2. Dos punteros");

        System.out.println("par que suma 10 en [1,2,4,7,8,11]: " + ver(parConSuma(arr(1, 2, 4, 7, 8, 11), 10)));

// ════════════════════════════════════════════════════════════════════════════
// 3. VENTANA DESLIZANTE
// ════════════════════════════════════════════════════════════════════════════
        // Para "el mejor tramo CONTIGUO de tamaño k": en vez de sumar k elementos en cada posición (O(n·k)),
        // se desliza la ventana: se suma el que entra y se resta el que sale (O(n)).
        titulo("3. Ventana deslizante");

        System.out.println("media móvil (k = 3) de [1,2,3,4,5,6]: " + ver(mediaMovil(arr(1, 2, 3, 4, 5, 6), 3)));

// ════════════════════════════════════════════════════════════════════════════
// 4. TABLAS HASH: "¿LO HE VISTO YA?"
// ════════════════════════════════════════════════════════════════════════════
        // Un HashMap/HashSet da búsqueda/inserción O(1). Casi cualquier problema de pares, duplicados, frecuencias o
        // agrupaciones se resuelve con una pasada y una tabla auxiliar. Trampa: map.get(clave) devuelve Integer y es
        // null si no existe; desempaquetarlo directamente (`int v = mapa.get(k)`) lanza NullPointerException.
        titulo("4. Tablas hash");

        System.out.println("primer carácter único de \"aabbcdd\": " + primerUnico("aabbcdd"));
        System.out.println("dos sumas a 9 en [2,7,11,15]: " + ver(dosSumasTraza(arr(2, 7, 11, 15), 9)));

// ════════════════════════════════════════════════════════════════════════════
// 5. SUMAS PREFIJAS
// ════════════════════════════════════════════════════════════════════════════
        // prefijo[i] = suma de los primeros i elementos. Entonces suma(desde..hasta) = prefijo[hasta+1] - prefijo[desde].
        // Se paga O(n) una vez y cada consulta cuesta O(1).
        titulo("5. Sumas prefijas");

        int[] valores = {3, 1, 4, 1, 5, 9, 2, 6};
        long[] prefijo = new long[valores.length + 1];
        for (int i = 0; i < valores.length; i++) {
            prefijo[i + 1] = prefijo[i] + valores[i];
        }
        System.out.println("prefijo: " + ver(prefijo));
        System.out.println("suma de las posiciones 2..5: " + (prefijo[6] - prefijo[2]) + " (4+1+5+9 = " + (4 + 1 + 5 + 9) + ")");

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

        prueba("busquedaBinaria",
            caso("en medio", 2, arr(1, 3, 5, 7, 9), 5),
            caso("el primero", 0, arr(1, 3, 5, 7, 9), 1),
            caso("el último", 4, arr(1, 3, 5, 7, 9), 9),
            caso("no está (en medio)", -1, arr(1, 3, 5, 7, 9), 4),
            caso("menor que todos", -1, arr(1, 3, 5), -10),
            caso("mayor que todos", -1, arr(1, 3, 5), 99),
            caso("lista vacía", -1, arr(), 1),
            caso("un elemento (está)", 0, arr(4), 4),
            caso("un elemento (no está)", -1, arr(4), 5),
            caso("negativos", 1, arr(-9, -4, 0, 3), -4));

        prueba("limiteInferior",
            caso("con repetidos: la primera", 1, arr(1, 3, 3, 3, 7), 3),
            caso("no está: donde iría", 2, arr(1, 3, 7), 5),
            caso("menor que todos", 0, arr(1, 3, 7), 0),
            caso("mayor que todos", 3, arr(1, 3, 7), 100),
            caso("vacía", 0, arr(), 5),
            caso("todos iguales", 0, arr(2, 2, 2, 2), 2),
            caso("el último", 2, arr(1, 2, 3), 3));

        prueba("parSuma",
            caso("básico", arr(1, 4), arr(1, 2, 4, 7, 8, 11), 10),
            caso("extremos", arr(0, 2), arr(1, 5, 9), 10),
            caso("no hay", null, arr(1, 2, 3), 100),
            caso("lista corta", null, arr(5), 5),
            caso("negativos", arr(1, 3), arr(-4, -1, 3, 8), 7),
            caso("vacía", null, arr(), 0));

        prueba("dosSumas",
            caso("clásico", arr(0, 1), arr(2, 7, 11, 15), 9),
            caso("desordenada", arr(1, 2), arr(3, 2, 4), 6),
            caso("con repetidos", arr(0, 1), arr(3, 3), 6),
            caso("no hay", null, arr(1, 2, 3), 10),
            caso("vacía", null, arr(), 3),
            caso("con negativos", arr(0, 2), arr(-3, 4, 3, 90), 0));

        prueba("sumaMaximaVentana",
            caso("ejemplo", 9L, arr(2, 1, 5, 1, 3, 2), 3),
            caso("ventana de 1", 8L, arr(4, 8, 2), 1),
            caso("ventana = lista", 6L, arr(1, 2, 3), 3),
            caso("con negativos", -4L, arr(-5, -1, -3, -2), 2),
            caso("al final", 18L, arr(1, 1, 1, 9, 9), 2));
        grupo("sumaMaximaVentana()");
        lanza("k mayor que la lista", () -> sumaMaximaVentana(arr(1, 2), 3), IllegalArgumentException.class);
        lanza("k cero", () -> sumaMaximaVentana(arr(1, 2), 0), IllegalArgumentException.class);

        prueba("subcadenaSinRepetir",
            caso("abcabcbb", 3, "abcabcbb"),
            caso("todos iguales", 1, "bbbbb"),
            caso("pwwkew", 3, "pwwkew"),
            caso("vacía", 0, ""),
            caso("sin repeticiones", 6, "abcdef"),
            caso("se repite al principio", 2, "abba"),
            caso("con tildes", 5, "áéíóúáé"),
            caso("con emojis", 3, "😀😎😀🎉"));

        prueba("agruparAnagramas",
            caso("ejemplo", List.of(List.of("rata", "tara", "arta"), List.of("sol", "los"), List.of("pez")), List.of("rata", "tara", "sol", "los", "arta", "pez")),
            caso("ninguno", List.of(List.of("a"), List.of("b"), List.of("c")), List.of("a", "b", "c")),
            caso("vacía", List.of(), List.of()),
            caso("repetidas", List.of(List.of("ab", "ba", "ab")), List.of("ab", "ba", "ab")),
            caso("distinta longitud", List.of(List.of("a"), List.of("aa"), List.of("aaa")), List.of("a", "aa", "aaa")));

        grupo("SumasPrefijas");
        comprueba("rango en medio", () -> new SumasPrefijas(arr(3, 1, 4, 1, 5, 9, 2, 6)).suma(2, 5), 19L);
        comprueba("un solo elemento", () -> new SumasPrefijas(arr(3, 1, 4)).suma(1, 1), 1L);
        comprueba("toda la lista", () -> new SumasPrefijas(arr(1, 2, 3, 4)).suma(0, 3), 10L);
        comprueba("con negativos", () -> new SumasPrefijas(arr(5, -2, -3, 4)).suma(1, 2), -5L);
        comprueba("muchas consultas", () -> {
            var s = new SumasPrefijas(numeros(100));
            return List.of(s.suma(0, 99), s.suma(10, 19), s.suma(99, 99));
        }, List.of(5050L, 155L, 100L));
        lanza("desde negativo", () -> new SumasPrefijas(arr(1, 2)).suma(-1, 1), IndexOutOfBoundsException.class);
        lanza("hasta fuera de la lista", () -> new SumasPrefijas(arr(1, 2)).suma(0, 2), IndexOutOfBoundsException.class);
        lanza("desde mayor que hasta", () -> new SumasPrefijas(arr(1, 2, 3)).suma(2, 1), IndexOutOfBoundsException.class);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        medir("busquedaBinaria", n -> args(numeros(n), n));                                   // O(log n) (un bucle: O(n))
        medir("parSuma", n -> args(rango(0, n - 1), -1));                                     // O(n) (con bucle doble: O(n²))
        medir("dosSumas", n -> args(rango(0, n - 1), -1));                                    // O(n) (con bucle doble: O(n²))
        medir("sumaMaximaVentana", n -> args(numeros(n), n / 2));                             // O(n) (recalculando cada ventana: O(n²))
        medir("subcadenaSinRepetir", n -> args(cadenaDistinta(n)));
        // O(1) por consulta (sumando el rango en cada consulta: O(n)). Cada repetición recibe el objeto y su n.
        medir("SumasPrefijas", n -> Map.entry(new SumasPrefijas(numeros(n)), n), p -> p.getKey().suma(0, p.getValue() - 1));
    }
}

// ── Ejercicio 8 · SumasPrefijas ─────────────────────────────────────────────
/**
 * Prepara un array una vez (O(n)) para responder "¿cuánto suman las posiciones desde..hasta (inclusive)?"
 * en O(1). Un rango inválido (desde < 0, hasta fuera del array o desde > hasta) lanza IndexOutOfBoundsException.
 * La suma es long: la de muchos int puede no caber en un int.
 */
final class SumasPrefijas {
    SumasPrefijas(int[] valores) {
        pendiente();
    }

    long suma(int desde, int hasta) {
        return pendiente();
    }
}
