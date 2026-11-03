package pg;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiPredicate;
import java.util.function.Consumer;
import java.util.function.IntFunction;
import java.util.function.Supplier;

/**
 * API pública de las lecciones (se importa sola: import static pg.Pg.*).
 * Misma semántica de eventos que PHP y Python: pendiente, grupo, prueba, comprueba, lanza, medir.
 */
public final class Pg {
    private Pg() {
    }

    // ───────────────────────────── tipos de apoyo ─────────────────────────────

    /** Un caso de prueba: descripción, resultado esperado y argumentos. Se crea con caso(...). */
    public static final class Caso {
        final String desc;
        final Object esperado;
        final Object[] args;

        Caso(String desc, Object esperado, Object[] args) {
            this.desc = desc;
            this.esperado = esperado;
            this.args = args;
        }
    }

    /** Código que puede lanzar cualquier excepción: lo que recibe lanza(). */
    @FunctionalInterface
    public interface Ejecutable {
        void ejecutar() throws Throwable;
    }

    // ───────────────────────────── ejercicios sin hacer ─────────────────────────────

    /** Marca un ejercicio sin implementar: «return pendiente();». Las pruebas lo muestran como pendiente, no como fallo. */
    public static <T> T pendiente() {
        throw new PorHacer("Ejercicio pendiente de implementar");
    }

    public static <T> T pendiente(String mensaje) {
        throw new PorHacer(mensaje);
    }

    /** Agrupa las siguientes comprobaciones (comprueba/lanza) bajo un título. */
    public static void grupo(String nombre) {
        Nucleo.grupo = nombre;
    }

    // ───────────────────────────── helpers de datos ─────────────────────────────

    /** caso("descripción", esperado, argumentos...). */
    public static Caso caso(String desc, Object esperado, Object... args) {
        return new Caso(desc, esperado, args == null ? new Object[]{null} : args);
    }

    /** Argumentos de medir(): args(lista(n), 5). */
    public static Object[] args(Object... a) {
        return a;
    }

    /** [1, 2, ..., n] como List. */
    public static List<Integer> lista(int n) {
        List<Integer> l = new ArrayList<>(Math.max(n, 0));
        for (int i = 1; i <= n; i++) l.add(i);
        return l;
    }

    /** [1, 2, ..., n] como int[]. */
    public static int[] numeros(int n) {
        return rango(1, n, 1);
    }

    /** n números pseudoaleatorios en 0..max, siempre los mismos para la misma semilla (el mismo generador que en PHP). */
    public static int[] aleatorios(int n, int max, long semilla) {
        int[] r = new int[Math.max(n, 0)];
        long x = semilla;
        for (int i = 0; i < r.length; i++) {
            x = (x * 1103515245L + 12345L) & 0x7fffffffL;
            r[i] = (int) (x % (max + 1L));
        }
        return r;
    }

    /** desde, desde+paso, ... hasta (incluido), como range() de PHP. */
    public static int[] rango(int desde, int hasta, int paso) {
        if (paso == 0 || (paso > 0 && desde > hasta) || (paso < 0 && desde < hasta)) return new int[0];
        int n = (int) (((long) hasta - desde) / paso) + 1;
        int[] r = new int[n];
        for (int i = 0; i < n; i++) r[i] = desde + i * paso;
        return r;
    }

    public static int[] rango(int desde, int hasta) {
        return rango(desde, hasta, desde <= hasta ? 1 : -1);
    }

    // ───────────────────────────── eventos de prueba ─────────────────────────────

    static void evento(String grupo, String nombre, String estado, Object... extra) {
        Map<String, Object> m = Nucleo.ev("test", "group", grupo, "name", nombre, "status", estado);
        for (int i = 0; i + 1 < extra.length; i += 2) m.put((String) extra[i], extra[i + 1]);
        Nucleo.emitir(m);
    }

    @FunctionalInterface
    private interface Llamada {
        Object get() throws Throwable;
    }

    /** Ejecuta una prueba y emite su evento. PorHacer sube a quien llama. */
    private static void ejecutar(String grupo, String nombre, Llamada fn, BiPredicate<Object, Object> cmp, Object esperado, Object... extra) {
        long t0 = System.nanoTime();
        try {
            Object actual = fn.get();
            boolean ok = cmp.test(actual, esperado);
            Object[] e = concat(extra, "actual", Nucleo.export(actual, 300), "ms", ms(t0));
            evento(grupo, nombre, ok ? "pass" : "fail", e);
        } catch (PorHacer p) {
            throw p;
        } catch (Throwable t) {
            Throwable e = Nucleo.desenvolver(t);
            if (e instanceof PorHacer p) throw p;
            evento(grupo, nombre, "error", concat(extra, "msg", Nucleo.descripcion(e), "line", Nucleo.linea(e.getStackTrace()), "ms", ms(t0)));
        }
    }

    private static Object[] concat(Object[] a, Object... b) {
        Object[] r = new Object[a.length + b.length];
        System.arraycopy(a, 0, r, 0, a.length);
        System.arraycopy(b, 0, r, a.length, b.length);
        return r;
    }

    private static double ms(long t0) {
        return Nucleo.redondea((System.nanoTime() - t0) / 1e6, 3);
    }

    // ───────────────────────────── prueba / comprueba / lanza ─────────────────────────────

    /** prueba("suma", caso("básico", 5, 2, 3), caso("negativos", 0, -1, 1)); llama al método static por su nombre. */
    public static void prueba(String metodo, Caso... casos) {
        casosDe(metodo, (a, e) -> Nucleo.igual(a, e, false), casos);
    }

    /** Como prueba(), pero el orden de listas y arrays no importa (resultados que son conjuntos). */
    public static void pruebaSinOrden(String metodo, Caso... casos) {
        casosDe(metodo, (a, e) -> Nucleo.igual(a, e, true), casos);
    }

    /** Como prueba(), con tu propio criterio: comparador.test(actual, esperado). */
    public static void pruebaCon(String metodo, BiPredicate<Object, Object> comparador, Caso... casos) {
        casosDe(metodo, comparador, casos);
    }

    private static void casosDe(String metodo, BiPredicate<Object, Object> cmp, Caso[] casos) {
        String grupo = metodo + "()";
        int n = 0;
        for (Caso c : casos) {
            n++;
            String nombre = c.desc == null || c.desc.isBlank() ? "caso " + n : c.desc;
            Method m = Nucleo.buscar(metodo, c.args.length, c.args);
            if (m == null) {
                evento(grupo, "(existe el método)", "error", "msg",
                    "El método " + metodo + "() con " + c.args.length + " parámetro(s) no existe: ¿lo has borrado o cambiado de nombre?");
                return;
            }
            StringBuilder in = new StringBuilder();
            for (Object a : c.args) in.append(in.length() > 0 ? ", " : "").append(Nucleo.export(a, 120));
            try {
                ejecutar(grupo, nombre, () -> invocar(m, c.args), cmp, c.esperado, "input", in.toString(), "expected", Nucleo.export(c.esperado, 300));
            } catch (PorHacer p) {
                evento(grupo, "(todos los casos)", "todo", "total", casos.length);
                return;
            }
        }
    }

    private static Object invocar(Method m, Object[] args) throws Throwable {
        try {
            return m.invoke(null, Nucleo.convertirArgs(m, args));
        } catch (InvocationTargetException e) {
            throw e.getCause();
        }
    }

    /** comprueba("descripción", () -> objeto.saldo(), 5.0): el resultado debe ser igual al esperado. */
    public static void comprueba(String descripcion, Supplier<?> fn, Object esperado) {
        compruebaCon(descripcion, fn, esperado, false);
    }

    /** comprueba("descripción", () -> condicion): el resultado debe ser true. */
    public static void comprueba(String descripcion, Supplier<?> fn) {
        compruebaCon(descripcion, fn, Boolean.TRUE, false);
    }

    /** comprueba("descripción", a == b). */
    public static void comprueba(String descripcion, boolean ok) {
        compruebaCon(descripcion, () -> ok, Boolean.TRUE, false);
    }

    public static void compruebaSinOrden(String descripcion, Supplier<?> fn, Object esperado) {
        compruebaCon(descripcion, fn, esperado, true);
    }

    private static void compruebaCon(String descripcion, Supplier<?> fn, Object esperado, boolean sinOrden) {
        try {
            ejecutar(Nucleo.grupo, descripcion, fn::get, (a, e) -> Nucleo.igual(a, e, sinOrden), esperado, "expected", Nucleo.export(esperado, 300));
        } catch (PorHacer p) {
            evento(Nucleo.grupo, descripcion, "todo", "expected", Nucleo.export(esperado, 300));
        }
    }

    /** lanza("no admite negativos", () -> new Dinero(-1), IllegalArgumentException.class). */
    public static void lanza(String descripcion, Ejecutable fn, Class<? extends Throwable> excepcion) {
        String g = Nucleo.grupo;
        long t0 = System.nanoTime();
        Object[] extra = {"expected", "lanza " + excepcion.getSimpleName()};
        try {
            fn.ejecutar();
            evento(g, descripcion, "fail", concat(extra, "actual", "no lanzó nada", "ms", ms(t0)));
        } catch (Throwable t) {
            Throwable e = Nucleo.desenvolver(t);
            if (e instanceof PorHacer) {
                evento(g, descripcion, "todo", extra);
                return;
            }
            String m = e.getMessage();
            evento(g, descripcion, excepcion.isInstance(e) ? "pass" : "fail",
                concat(extra, "actual", "lanzó " + e.getClass().getSimpleName() + (m == null ? "" : ": \"" + m + "\""), "ms", ms(t0)));
        }
    }

    // ───────────────────────────── medir ─────────────────────────────

    /** medir("buscar", n -> args(lista(n), 7)): tiempos para n = 64, 128, 256... y estimación de O(). */
    public static void medir(String metodo, IntFunction<Object[]> entrada) {
        medirPorNombre(metodo, entrada, "geometrica", null);
    }

    /** escala: "geometrica" (64, 128, 256...) o "lineal" (1..40, para algoritmos exponenciales). */
    public static void medir(String metodo, IntFunction<Object[]> entrada, String escala) {
        medirPorNombre(metodo, entrada, escala, null);
    }

    /** Con tamaños concretos: medir("fib", n -> args(n), "lineal", rango(10, 30, 2)). */
    public static void medir(String metodo, IntFunction<Object[]> entrada, String escala, int... tamanos) {
        medirPorNombre(metodo, entrada, escala, tamanos);
    }

    /**
     * Variante tipada, sin casts: el preparador crea la entrada (no se cronometra, y es nueva en cada repetición,
     * así que una operación que modifica su entrada, como ordenar en el sitio, se mide bien).
     *   medir("ordenar", n -> aleatorios(n, 1000, 1), a -> ordenar(a));
     */
    public static <T> void medir(String etiqueta, IntFunction<T> preparar, Consumer<T> operacion) {
        medirTipado(etiqueta, preparar, operacion, "geometrica", null);
    }

    public static <T> void medir(String etiqueta, IntFunction<T> preparar, Consumer<T> operacion, String escala, int... tamanos) {
        medirTipado(etiqueta, preparar, operacion, escala, tamanos);
    }

    /** Una repetición ya preparada. */
    private interface Rep {
        void run() throws Throwable;
    }

    /** Fábrica de repeticiones para un tamaño n (la preparación no se cronometra). */
    private interface Fabrica {
        Rep para(int n) throws Throwable;

        /** Una repetición que solo paga el coste de llamar (reflexión), para restarlo en llamadas muy rápidas. Null si no hay. */
        default Rep vacia(int n) throws Throwable {
            return null;
        }
    }

    // Métodos que no hacen nada, con 0 a 4 parámetros: calibran el coste de Method.invoke
    private static void nada0() {
    }

    private static void nada1(Object a) {
    }

    private static void nada2(Object a, Object b) {
    }

    private static void nada3(Object a, Object b, Object c) {
    }

    private static void nada4(Object a, Object b, Object c, Object d) {
    }

    private static void medirPorNombre(String metodo, IntFunction<Object[]> entrada, String escala, int[] tamanos) {
        medirGeneral(metodo, escala, tamanos, new Fabrica() {
            private Object[] conv;

            @Override
            public Rep para(int n) throws Throwable {
                Object[] a = entrada.apply(n);
                Method m = Nucleo.buscar(metodo, a.length, a);
                if (m == null) throw new NoSuchMethodException("El método " + metodo + "() con " + a.length + " parámetro(s) no existe");
                Object[] c = Nucleo.convertirArgs(m, a);
                conv = c;
                return () -> invocar(m, c);          // mismos argumentos en cada repetición
            }

            @Override
            public Rep vacia(int n) throws Throwable {
                if (conv == null || conv.length > 4) return null;
                Method v = Pg.class.getDeclaredMethod("nada" + conv.length, java.util.Arrays.copyOf(new Class<?>[]{Object.class, Object.class, Object.class, Object.class}, conv.length));
                v.setAccessible(true);
                Object[] c = new Object[conv.length];
                return () -> invocar(v, c);
            }
        }, true);
    }

    private static <T> void medirTipado(String etiqueta, IntFunction<T> preparar, Consumer<T> operacion, String escala, int[] tamanos) {
        medirGeneral(etiqueta, escala, tamanos, n -> {
            T x = preparar.apply(n);
            return () -> operacion.accept(x);
        }, false);
    }

    /** Un lote de repeticiones preparado por adelantado: en el variante tipado, cada una con su propia entrada. */
    private static Rep[] lote(Fabrica f, int n, int k, boolean compartido, boolean vacia) throws Throwable {
        Rep[] r = new Rep[k];
        Rep primera = vacia ? f.vacia(n) : f.para(n);
        for (int i = 0; i < k; i++) r[i] = compartido ? primera : (i == 0 ? primera : f.para(n));
        return r;
    }

    private static void medirGeneral(String nombre, String escala, int[] tamanos, Fabrica f, boolean compartido) {
        if (!Nucleo.bench) {
            Nucleo.emitir(Nucleo.ev("bench", "name", nombre, "status", "skipped"));
            return;
        }
        boolean lineal = "lineal".equals(escala);
        List<Integer> tams = new ArrayList<>();
        if (tamanos != null && tamanos.length > 0) {
            for (int t : tamanos) tams.add(t);
        } else if (lineal) {
            for (int i = 1; i <= 40; i++) tams.add(i);
        } else {
            for (int e = 6; e <= 17; e++) tams.add(1 << e);
        }
        List<Object> puntos = new ArrayList<>();
        double gastado = 0;
        String parada = "done";
        try {
            calentar(f, tams, compartido);
            for (int n : tams) {
                long t0 = System.nanoTime();
                double por = unaMedida(f, n, compartido);
                puntos.add(List.of(n, Nucleo.redondea(por, 6)));
                gastado += (System.nanoTime() - t0) / 1e6;
                if (por > 250) {
                    parada = "slow";      // una sola llamada ya tarda más de 250 ms
                    break;
                }
                if (gastado > Nucleo.presupuestoMs) {
                    parada = "budget";
                    break;
                }
            }
        } catch (Throwable t) {
            Throwable e = Nucleo.desenvolver(t);
            if (e instanceof PorHacer) {
                Nucleo.emitir(Nucleo.ev("bench", "name", nombre, "status", "todo"));
            } else {
                Nucleo.emitir(Nucleo.ev("bench", "name", nombre, "status", "error", "msg", Nucleo.descripcion(e), "line", Nucleo.linea(e.getStackTrace())));
            }
            return;
        }
        // Solo los puntos: el ajuste del modelo (O(n), O(n²)...) lo hace el servidor, igual para todos los lenguajes.
        Nucleo.emitir(Nucleo.ev("bench", "name", nombre, "status", "ok", "scale", lineal ? "lineal" : "geometrica", "stopped", parada, "points", puntos));
    }

    /** Calienta el JIT con varios tamaños (unas decenas de ms): sin esto los primeros puntos salen inflados. */
    private static void calentar(Fabrica f, List<Integer> tams, boolean compartido) throws Throwable {
        int ult = tams.size() - 1;
        for (int i : new int[]{0, Math.min(2, ult), Math.min(5, ult), Math.min(8, ult)}) {
            long ini = System.nanoTime();
            long fin = ini + 40_000_000L;
            Rep r = f.para(tams.get(i));
            for (int k = 0; k < 30_000 && System.nanoTime() < fin; k++) {
                r.run();
                if (!compartido) r = f.para(tams.get(i));
                if (k == 0 && System.nanoTime() - ini > 20_000_000L) break;     // una sola llamada ya es lenta: no hace falta calentar
            }
            Rep v = f.vacia(tams.get(i));
            for (int k = 0; v != null && k < 20_000; k++) v.run();
        }
    }

    /** Milisegundos por llamada (mínimo de varias tandas, para filtrar el ruido). */
    private static double unaMedida(Fabrica f, int n, boolean compartido) throws Throwable {
        double t = tiempo(f, n, compartido, false);
        if (t < 0.05) {                       // llamadas de microsegundos: se resta lo que cuesta llamar por reflexión
            Rep v = f.vacia(n);
            if (v != null) {
                double sobre = tiempo(f, n, true, true);
                t = Math.max(t - sobre, 1e-7);
            }
        }
        return t;
    }

    private static double tiempo(Fabrica f, int n, boolean compartido, boolean vacia) throws Throwable {
        Rep r = vacia ? f.vacia(n) : f.para(n);
        long t0 = System.nanoTime();
        r.run();
        double primera = (System.nanoTime() - t0) / 1e6;
        if (primera > 50) return primera;
        if (primera > 2) {
            double mejor = primera;
            for (int i = 0; i < 2; i++) {
                Rep x = vacia ? f.vacia(n) : f.para(n);
                t0 = System.nanoTime();
                x.run();
                mejor = Math.min(mejor, (System.nanoTime() - t0) / 1e6);
            }
            return mejor;
        }
        int k = (int) Math.min(200000, Math.max(1, Math.ceil(2.0 / Math.max(primera, 0.0005))));
        if (!compartido) k = Math.max(1, Math.min(k, 1_000_000 / Math.max(n, 1)));   // cada repetición tiene su entrada: acota la memoria
        double mejor = Double.MAX_VALUE;
        for (int tanda = 0; tanda < 5; tanda++) {
            Rep[] lote = vacia ? lote(f, n, k, true, true) : lote(f, n, k, compartido, false);
            t0 = System.nanoTime();
            for (Rep x : lote) x.run();
            mejor = Math.min(mejor, (System.nanoTime() - t0) / 1e6 / k);
        }
        return mejor;
    }
}
