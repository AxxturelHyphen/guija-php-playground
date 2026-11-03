package pg;

import java.io.BufferedOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Arranque del programa del usuario: java -cp harness:tmp pg.PgMain <Clase>
 *
 *  - System.out, System.err y los eventos comparten UN solo PrintStream UTF-8: así se conserva el orden real.
 *  - main corre en un hilo con 64 MB de pila (la recursión profunda de las lecciones no debe romperse pronto).
 *  - Cualquier Throwable se convierte en un evento `err` (exception / stack / memory) con línea y traza del usuario.
 *  - Un hilo vigía corta el programa al vencer PG_TIMEOUT (y luego Runtime.halt, que no espera a nadie).
 */
public final class PgMain {
    private PgMain() {
    }

    private static final AtomicBoolean TERMINADO = new AtomicBoolean(false);
    private static final AtomicBoolean FIN_EMITIDO = new AtomicBoolean(false);
    private static volatile boolean hubo = false;
    /** Memoria de reserva: se libera para poder contar un OutOfMemoryError. */
    private static volatile byte[] reserva = new byte[2 << 20];

    public static void main(String[] args) throws Exception {
        PrintStream out = new PrintStream(new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), 1 << 15), true, StandardCharsets.UTF_8);
        System.setOut(out);
        System.setErr(out);
        Nucleo.salida = out;
        Nucleo.inicioNs = System.nanoTime();
        Nucleo.bench = "1".equals(System.getenv("PG_BENCH"));
        int plazo = entero(System.getenv("PG_TIMEOUT"), 5);
        Nucleo.presupuestoMs = entero(System.getenv("PG_BENCH_BUDGET_MS"), 1500);

        Thread.setDefaultUncaughtExceptionHandler((t, e) -> informar(e));
        // System.exit() del usuario: igualmente se cierra con el evento `end`
        Runtime.getRuntime().addShutdownHook(new Thread(PgMain::fin));

        Thread principal = new Thread(null, () -> {
            try {
                Class<?> c = Class.forName(args[0]);
                Nucleo.claseUsuario = c;
                Method m = c.getDeclaredMethod("main", String[].class);
                m.setAccessible(true);
                m.invoke(null, (Object) new String[0]);
            } catch (Throwable t) {
                informar(t);
            }
            TERMINADO.set(true);
        }, "main", 64L << 20);
        vigia(principal, plazo);
        principal.start();
        principal.join();
        fin();
        out.flush();
        Runtime.getRuntime().halt(hubo ? 255 : 0);
    }

    private static int entero(String s, int def) {
        try {
            return s == null ? def : Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static void vigia(Thread principal, int segundos) {
        Thread v = new Thread(() -> {
            try {
                Thread.sleep(segundos * 1000L);
            } catch (InterruptedException e) {
                return;
            }
            if (TERMINADO.get()) {
                return;
            }
            // Si ni siquiera esto responde (hilo sin puntos de seguridad), se corta igualmente al segundo
            Thread duro = new Thread(() -> {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    return;
                }
                Runtime.getRuntime().halt(255);
            });
            duro.setDaemon(true);
            duro.start();
            StackTraceElement[] st = principal.getStackTrace();
            Nucleo.emitir(Nucleo.ev("err", "kind", "timeout", "msg", "Maximum execution time of " + segundos + " seconds exceeded",
                "line", Nucleo.linea(st), "trace", Nucleo.frames(st)));
            hubo = true;
            fin();
            Nucleo.salida.flush();
            Runtime.getRuntime().halt(255);
        }, "pg-vigia");
        v.setDaemon(true);
        v.start();
    }

    /** Convierte un Throwable en evento. Un PorHacer no capturado se cuenta como pendiente, como en PHP. */
    static void informar(Throwable t) {
        reserva = null;
        hubo = true;
        try {
            Throwable e = Nucleo.desenvolver(t);
            StackTraceElement[] st = e.getStackTrace();
            if (e instanceof PorHacer) {
                Nucleo.emitir(Nucleo.ev("todo", "msg", e.getMessage(), "line", Nucleo.linea(st), "trace", Nucleo.frames(st)));
                return;
            }
            String kind = e instanceof StackOverflowError ? "stack" : e instanceof OutOfMemoryError ? "memory" : "exception";
            Map<String, Object> ev = Nucleo.ev("err", "kind", kind, "cls", e.getClass().getName(), "msg", e.getMessage() == null ? "" : e.getMessage(),
                "line", Nucleo.linea(st), "trace", Nucleo.frames(st));
            if (e.getCause() != null) {
                ev.put("previous", Nucleo.descripcion(e.getCause()));
            }
            Nucleo.emitir(ev);
        } catch (Throwable ignorado) {
            Nucleo.salida.print("\u001ePG{\"t\":\"err\",\"kind\":\"memory\",\"msg\":\"Java heap space\",\"line\":1}\u001f");
        }
    }

    private static void fin() {
        if (!FIN_EMITIDO.compareAndSet(false, true)) {
            return;
        }
        Runtime rt = Runtime.getRuntime();
        Nucleo.emitir(Nucleo.ev("end", "ms", Nucleo.redondea((System.nanoTime() - Nucleo.inicioNs) / 1e6, 2),
            "mem", rt.totalMemory() - rt.freeMemory(), "peak", rt.totalMemory() - rt.freeMemory()));
    }
}
