package pg;

import java.io.PrintStream;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.lang.reflect.RecordComponent;
import java.util.*;

/**
 * Núcleo del harness: canal de salida único, eventos, trazas del usuario, formato (export) e igualdad (igual).
 * Los eventos van por stdout entre marcas de control, mezclados con la salida normal del programa:
 *     \u001ePG{json}\u001f
 */
final class Nucleo {
    private Nucleo() {
    }

    static PrintStream salida = System.out;
    static long inicioNs = System.nanoTime();
    static Class<?> claseUsuario;
    static String grupo = "general";
    static boolean bench = false;
    static int presupuestoMs = 1500;

    // ───────────────────────────── eventos ─────────────────────────────

    static void emitir(Map<String, Object> ev) {
        // Un solo print: la marca y el JSON llegan juntos aunque haya otros hilos escribiendo
        String s = "\u001ePG" + json(ev) + "\u001f";
        synchronized (salida) {
            salida.print(s);
            salida.flush();
        }
    }

    static Map<String, Object> ev(String tipo, Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("t", tipo);
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    static double redondea(double x, int dec) {
        double p = Math.pow(10, dec);
        return Math.round(x * p) / p;
    }

    // ───────────────────────────── JSON mínimo ─────────────────────────────

    static String json(Object v) {
        StringBuilder sb = new StringBuilder();
        json(sb, v);
        return sb.toString();
    }

    private static void json(StringBuilder sb, Object v) {
        if (v == null) {
            sb.append("null");
        } else if (v instanceof String s) {
            cadena(sb, s);
        } else if (v instanceof Double d) {
            sb.append(d.isNaN() || d.isInfinite() ? "null" : d.toString());
        } else if (v instanceof Number || v instanceof Boolean) {
            sb.append(v);
        } else if (v instanceof Map<?, ?> m) {
            sb.append('{');
            boolean primero = true;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (!primero) {
                    sb.append(',');
                }
                primero = false;
                cadena(sb, String.valueOf(e.getKey()));
                sb.append(':');
                json(sb, e.getValue());
            }
            sb.append('}');
        } else if (v instanceof Iterable<?> it) {
            sb.append('[');
            boolean primero = true;
            for (Object x : it) {
                if (!primero) {
                    sb.append(',');
                }
                primero = false;
                json(sb, x);
            }
            sb.append(']');
        } else {
            cadena(sb, String.valueOf(v));
        }
    }

    private static void cadena(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    boolean suelto = Character.isSurrogate(c)
                        && !(Character.isHighSurrogate(c) && i + 1 < s.length() && Character.isLowSurrogate(s.charAt(i + 1)))
                        && !(Character.isLowSurrogate(c) && i > 0 && Character.isHighSurrogate(s.charAt(i - 1)));
                    if (c < 0x20 || suelto) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
    }

    // ───────────────────────────── trazas del usuario ─────────────────────────────

    /** Un frame es «del usuario» si su clase vive en el classpath (módulo sin nombre) y no es del harness. */
    static boolean esUsuario(StackTraceElement f) {
        return f.getModuleName() == null && !f.getClassName().startsWith("pg.") && f.getLineNumber() > 0;
    }

    static List<Map<String, Object>> frames(StackTraceElement[] st) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (StackTraceElement f : st) {
            if (!esUsuario(f)) {
                continue;
            }
            String m = f.getMethodName();
            String fn = m.startsWith("lambda$") ? "{lambda}" : m.equals("<init>") ? "new" : m;
            String c = f.getClassName().replace('$', '.');
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("fn", (fn.equals("{lambda}") ? c + ".{lambda}" : fn.equals("new") ? "new " + c : c + "." + fn) + "()");
            o.put("line", f.getLineNumber());
            out.add(o);
            if (out.size() >= 20) {
                break;
            }
        }
        return out;
    }

    static int linea(StackTraceElement[] st) {
        for (StackTraceElement f : st) {
            if (esUsuario(f)) {
                return f.getLineNumber();
            }
        }
        return 1;
    }

    /** Quita las envolturas de la reflexión para llegar a la excepción del usuario. */
    static Throwable desenvolver(Throwable t) {
        while ((t instanceof InvocationTargetException || t instanceof ExceptionInInitializerError) && t.getCause() != null) {
            t = t.getCause();
        }
        return t;
    }

    static String descripcion(Throwable e) {
        String m = e.getMessage();
        return e.getClass().getName() + (m == null ? "" : ": " + m);
    }

    // ───────────────────────────── formato ─────────────────────────────

    static String export(Object v, int max) {
        String s;
        try {
            s = exp(v, 0);
        } catch (Throwable t) {
            s = "<" + v.getClass().getSimpleName() + ">";
        }
        return s.length() > max ? s.substring(0, max - 1) + "…" : s;
    }

    private static String comillas(String s, char q) {
        return q + s.replace("\\", "\\\\").replace(String.valueOf(q), "\\" + q).replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + q;
    }

    private static String exp(Object v, int d) throws Exception {
        if (v == null) return "null";
        if (v instanceof String s) return comillas(s, '"');
        if (v instanceof Character c) return comillas(String.valueOf(c), '\'');
        if (v instanceof Long l) return l + "L";
        if (v instanceof Float f) return f.isNaN() || f.isInfinite() ? f.toString() : f + "f";
        if (v instanceof Double || v instanceof Integer || v instanceof Short || v instanceof Byte || v instanceof Boolean) return v.toString();
        if (v instanceof Enum<?> e) return e.getDeclaringClass().getSimpleName() + "." + e.name();
        Class<?> k = v.getClass();
        if (k.isArray()) {
            if (d >= 4) return "[…]";
            int n = Array.getLength(v);
            StringBuilder sb = new StringBuilder(k.getComponentType().getSimpleName() + "[]{");
            for (int i = 0; i < n; i++) {
                if (i >= 40) {
                    sb.append(", …(+").append(n - 40).append(')');
                    break;
                }
                sb.append(i > 0 ? ", " : "").append(exp(Array.get(v, i), d + 1));
            }
            return sb.append('}').toString();
        }
        if (v instanceof Collection<?> c) {
            if (d >= 4) return "[…]";
            boolean conj = v instanceof Set;
            StringBuilder sb = new StringBuilder(conj ? "{" : "[");
            int i = 0;
            for (Object x : c) {
                if (i++ >= 40) {
                    sb.append(", …(+").append(c.size() - 40).append(')');
                    break;
                }
                sb.append(i > 1 ? ", " : "").append(exp(x, d + 1));
            }
            return sb.append(conj ? '}' : ']').toString();
        }
        if (v instanceof Map<?, ?> m) {
            if (d >= 4) return "{…}";
            StringBuilder sb = new StringBuilder("{");
            int i = 0;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (i++ >= 40) {
                    sb.append(", …(+").append(m.size() - 40).append(')');
                    break;
                }
                sb.append(i > 1 ? ", " : "").append(exp(e.getKey(), d + 1)).append('=').append(exp(e.getValue(), d + 1));
            }
            return sb.append('}').toString();
        }
        if (k.isSynthetic() || k.getName().contains("$$Lambda")) return "lambda";
        if (k.isRecord()) {
            if (d >= 3) return k.getSimpleName() + "[…]";
            StringBuilder sb = new StringBuilder(k.getSimpleName() + "[");
            boolean primero = true;
            for (RecordComponent rc : k.getRecordComponents()) {
                var acc = rc.getAccessor();
                acc.setAccessible(true);
                sb.append(primero ? "" : ", ").append(rc.getName()).append('=').append(exp(acc.invoke(v), d + 1));
                primero = false;
            }
            return sb.append(']').toString();
        }
        if (k.getMethod("toString").getDeclaringClass() != Object.class) return String.valueOf(v);
        if (d >= 3) return k.getSimpleName() + "{…}";
        StringBuilder sb = new StringBuilder(k.getSimpleName() + "{");
        boolean primero = true;
        for (Field f : k.getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers()) || f.isSynthetic()) continue;
            f.setAccessible(true);
            sb.append(primero ? "" : ", ").append(f.getName()).append(": ").append(exp(f.get(v), d + 1));
            primero = false;
        }
        return sb.append('}').toString();
    }

    // ───────────────────────────── igualdad ─────────────────────────────

    /**
     * Igualdad estricta de pruebas: el tipo cuenta (Integer ≠ Long), decimales con tolerancia relativa de 1e-9, NaN == NaN,
     * arrays en profundidad, List en orden, Set como conjunto, Map como mapa (si el esperado es un SequencedMap, en orden).
     */
    static boolean igual(Object actual, Object esperado, boolean sinOrden) {
        if (sinOrden) {
            actual = normalizar(actual);
            esperado = normalizar(esperado);
        }
        return eq(actual, esperado, !sinOrden);
    }

    private static boolean eq(Object a, Object b, boolean ordenMapas) {
        if (a == b) return true;
        if (a == null || b == null) return false;
        if (a instanceof Double x && b instanceof Double y) return cerca(x, y);
        if (a instanceof Float x && b instanceof Float y) return cerca(x, y);
        Class<?> ka = a.getClass(), kb = b.getClass();
        if (ka.isArray() || kb.isArray()) {
            if (!ka.isArray() || !kb.isArray()) return false;
            if ((ka.getComponentType().isPrimitive() || kb.getComponentType().isPrimitive()) && ka != kb) return false;
            int n = Array.getLength(a);
            if (n != Array.getLength(b)) return false;
            for (int i = 0; i < n; i++) {
                if (!eq(Array.get(a, i), Array.get(b, i), ordenMapas)) return false;
            }
            return true;
        }
        if (a instanceof List<?> la && b instanceof List<?> lb) {
            if (la.size() != lb.size()) return false;
            Iterator<?> i = la.iterator(), j = lb.iterator();
            while (i.hasNext()) {
                if (!eq(i.next(), j.next(), ordenMapas)) return false;
            }
            return true;
        }
        if (a instanceof Set<?> sa && b instanceof Set<?> sb) {
            if (sa.size() != sb.size()) return false;
            try {
                if (sa.containsAll(sb)) return true;
            } catch (RuntimeException e) {
                // conjuntos con comparadores que no admiten ese tipo: se compara a mano
            }
            List<Object> resto = new ArrayList<>(sb);
            for (Object x : sa) {
                boolean hallado = false;
                for (Iterator<Object> it = resto.iterator(); it.hasNext(); ) {
                    if (eq(x, it.next(), ordenMapas)) {
                        it.remove();
                        hallado = true;
                        break;
                    }
                }
                if (!hallado) return false;
            }
            return true;
        }
        if (a instanceof Map<?, ?> ma && b instanceof Map<?, ?> mb) {
            if (ma.size() != mb.size()) return false;
            if (ordenMapas && b instanceof SequencedMap<?, ?>) {
                Iterator<? extends Map.Entry<?, ?>> i = ma.entrySet().iterator(), j = mb.entrySet().iterator();
                while (i.hasNext()) {
                    Map.Entry<?, ?> p = i.next(), q = j.next();
                    if (!eq(p.getKey(), q.getKey(), ordenMapas) || !eq(p.getValue(), q.getValue(), ordenMapas)) return false;
                }
                return true;
            }
            for (Map.Entry<?, ?> p : ma.entrySet()) {
                Object k = p.getKey();
                if (mb.containsKey(k)) {
                    if (!eq(p.getValue(), mb.get(k), ordenMapas)) return false;
                    continue;
                }
                boolean hallado = false;
                for (Map.Entry<?, ?> q : mb.entrySet()) {
                    if (eq(k, q.getKey(), ordenMapas) && eq(p.getValue(), q.getValue(), ordenMapas)) {
                        hallado = true;
                        break;
                    }
                }
                if (!hallado) return false;
            }
            return true;
        }
        if (ka != kb && (a instanceof Number || b instanceof Number || a instanceof Character || a instanceof Boolean)) return false;
        return a.equals(b);
    }

    private static boolean cerca(double a, double b) {
        if (Double.isNaN(a) && Double.isNaN(b)) return true;
        return a == b || Math.abs(a - b) <= 1e-9 * Math.max(1.0, Math.max(Math.abs(a), Math.abs(b)));
    }

    /** Para «sin orden»: listas y arrays se ordenan por su exportación (recursivo). */
    private static Object normalizar(Object v) {
        if (v == null) return null;
        if (v instanceof List<?> l) {
            List<Object> c = new ArrayList<>();
            for (Object x : l) c.add(normalizar(x));
            c.sort(Comparator.comparing(x -> export(x, 1000)));
            return c;
        }
        if (v.getClass().isArray()) {
            int n = Array.getLength(v);
            Object[] tmp = new Object[n];
            for (int i = 0; i < n; i++) tmp[i] = normalizar(Array.get(v, i));
            Arrays.sort(tmp, Comparator.comparing(x -> export(x, 1000)));
            Object r = Array.newInstance(v.getClass().getComponentType(), n);
            for (int i = 0; i < n; i++) Array.set(r, i, tmp[i]);
            return r;
        }
        if (v instanceof Map<?, ?> m) {
            Map<Object, Object> c = new HashMap<>();
            for (Map.Entry<?, ?> e : m.entrySet()) c.put(e.getKey(), normalizar(e.getValue()));
            return c;
        }
        return v;
    }

    // ───────────────────────────── reflexión ─────────────────────────────

    /** Busca un método static por nombre («metodo» en la clase principal o «Clase.metodo») y número de parámetros. */
    static java.lang.reflect.Method buscar(String nombre, int nargs, Object[] args) {
        Class<?> k = claseUsuario;
        String m = nombre;
        int p = nombre.lastIndexOf('.');
        try {
            if (p > 0) {
                k = Class.forName(nombre.substring(0, p));
                m = nombre.substring(p + 1);
            }
        } catch (ClassNotFoundException e) {
            return null;
        }
        java.lang.reflect.Method primero = null;
        for (java.lang.reflect.Method c : k.getDeclaredMethods()) {
            if (!c.getName().equals(m) || c.getParameterCount() != nargs || c.isSynthetic()) continue;
            if (primero == null) primero = c;
            if (args == null || aplicable(c, args)) {
                c.setAccessible(true);
                return c;
            }
        }
        if (primero != null) primero.setAccessible(true);
        return primero;
    }

    private static boolean aplicable(java.lang.reflect.Method m, Object[] args) {
        Class<?>[] ts = m.getParameterTypes();
        for (int i = 0; i < ts.length; i++) {
            try {
                Object c = convertir(args[i], ts[i]);
                if (c != null && !envoltorio(ts[i]).isInstance(c)) return false;
                if (c == null && ts[i].isPrimitive()) return false;
            } catch (RuntimeException e) {
                return false;
            }
        }
        return true;
    }

    static Class<?> envoltorio(Class<?> t) {
        if (!t.isPrimitive()) return t;
        if (t == int.class) return Integer.class;
        if (t == long.class) return Long.class;
        if (t == double.class) return Double.class;
        if (t == boolean.class) return Boolean.class;
        if (t == char.class) return Character.class;
        if (t == float.class) return Float.class;
        if (t == short.class) return Short.class;
        if (t == byte.class) return Byte.class;
        return Void.class;
    }

    /** Boxing/unboxing y ensanchado de números (5 → long, 3 → double) y de arrays (Integer[] → int[]) al tipo del parámetro. */
    static Object convertir(Object v, Class<?> t) {
        if (v == null) return null;
        Class<?> w = envoltorio(t);
        if (w.isInstance(v)) return v;
        if (v instanceof Number n && Number.class.isAssignableFrom(w)) {
            if (w == Long.class && !(v instanceof Double || v instanceof Float)) return n.longValue();
            if (w == Double.class) return n.doubleValue();
            if (w == Float.class) return n.floatValue();
            if (w == Short.class && v instanceof Integer && n.intValue() == (short) n.intValue()) return n.shortValue();
            if (w == Byte.class && v instanceof Integer && n.intValue() == (byte) n.intValue()) return n.byteValue();
        }
        if (v instanceof Integer i && w == Character.class && i >= 0 && i <= 0xFFFF) return (char) i.intValue();
        if (t.isArray() && v.getClass().isArray()) {
            Class<?> ct = t.getComponentType();
            int n = Array.getLength(v);
            Object r = Array.newInstance(ct, n);
            for (int i = 0; i < n; i++) {
                Object e = convertir(Array.get(v, i), ct);
                if (e == null && ct.isPrimitive()) throw new IllegalArgumentException("null en un array primitivo");
                Array.set(r, i, e);
            }
            return r;
        }
        return v;
    }

    static Object[] convertirArgs(java.lang.reflect.Method m, Object[] args) {
        Class<?>[] ts = m.getParameterTypes();
        Object[] r = new Object[args.length];
        for (int i = 0; i < r.length; i++) r[i] = convertir(args[i], ts[i]);
        return r;
    }
}
