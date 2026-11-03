import javax.tools.*;
import java.io.*;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Compilador RESIDENTE del playground (javax.tools, todo en memoria).
 *
 * Arrancar `javac` cuesta ~0,5 s por compilación; un proceso que ya está caliente compila en unos 50-150 ms.
 * Este proceso escucha SOLO en 127.0.0.1 (puerto aleatorio) y publica {port, token, pid} en el JSON que recibe
 * como argumento. Protocolo: UNA línea JSON por petición, con el token; contesta UNA línea JSON.
 *
 *   {"token":"…","op":"compile","name":"Clase.java","src":"…","cp":"ruta1:ruta2","out":"carpeta"}
 *   {"token":"…","op":"ping"}  ·  {"token":"…","op":"parar"}
 *
 * Seguridad: nunca habla HTTP (lo que no empiece por «{» se cierra sin contestar), exige el token y NUNCA ejecuta código:
 * solo compila, con -proc:none (ni procesadores de anotaciones). Se cierra solo tras 30 minutos sin uso.
 */
public final class PgJavac {
    private static final long INACTIVIDAD_MS = 30 * 60 * 1000L;
    private static final int MAX_PETICION = 16 << 20;
    private static volatile long ultimoUso = System.currentTimeMillis();
    private static String token;
    private static Path archivoInfo;

    public static void main(String[] args) throws Exception {
        archivoInfo = Paths.get(args[0]);
        byte[] r = new byte[16];
        new SecureRandom().nextBytes(r);
        StringBuilder t = new StringBuilder();
        for (byte b : r) t.append(String.format("%02x", b));
        token = t.toString();

        ServerSocket srv = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        srv.setSoTimeout(30_000);
        // Primero un archivo temporal y luego renombrar: quien lo lea nunca ve un JSON a medias
        Path tmp = archivoInfo.resolveSibling(archivoInfo.getFileName() + ".tmp");
        Files.writeString(tmp, "{\"port\":" + srv.getLocalPort() + ",\"token\":\"" + token + "\",\"pid\":" + ProcessHandle.current().pid() + "}");
        Files.move(tmp, archivoInfo, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);

        ExecutorService pool = Executors.newCachedThreadPool(run -> {
            Thread th = new Thread(run, "pgjavac");
            th.setDaemon(true);
            return th;
        });
        while (true) {
            try {
                Socket s = srv.accept();
                pool.execute(() -> atender(s));
            } catch (SocketTimeoutException e) {
                if (System.currentTimeMillis() - ultimoUso > INACTIVIDAD_MS) {
                    salir();
                }
            }
        }
    }

    private static void salir() {
        try {
            if (Files.readString(archivoInfo).contains(token)) {
                Files.deleteIfExists(archivoInfo);
            }
        } catch (IOException ignorado) {
            // ya no está
        }
        Runtime.getRuntime().halt(0);
    }

    private static void atender(Socket s) {
        try (s) {
            s.setSoTimeout(10_000);
            BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
            in.mark(1);
            if (in.read() != '{') {
                return;                    // HTTP u otra cosa: se cierra sin contestar
            }
            in.reset();
            StringBuilder linea = new StringBuilder();
            int c;
            while ((c = in.read()) != -1 && c != '\n') {
                linea.append((char) c);
                if (linea.length() > MAX_PETICION) {
                    return;
                }
            }
            Map<String, String> q = parsear(linea.toString());
            String resp;
            boolean parar = false;
            if (q == null || !token.equals(q.get("token"))) {
                resp = "{\"error\":\"token\"}";
            } else {
                ultimoUso = System.currentTimeMillis();
                String op = q.getOrDefault("op", "");
                switch (op) {
                    case "ping" -> resp = "{\"ok\":true,\"pid\":" + ProcessHandle.current().pid() + "}";
                    case "parar" -> {
                        resp = "{\"ok\":true}";
                        parar = true;
                    }
                    case "compile" -> resp = compilar(q);
                    default -> resp = "{\"error\":\"op\"}";
                }
            }
            OutputStream out = s.getOutputStream();
            out.write((resp + "\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
            if (parar) {
                salir();
            }
        } catch (IOException | RuntimeException e) {
            // un cliente que se va a mitad: no pasa nada
        }
    }

    // ───────────────────────────── compilación ─────────────────────────────

    private static String compilar(Map<String, String> q) {
        long t0 = System.nanoTime();
        String name = q.getOrDefault("name", "");
        String src = q.getOrDefault("src", "");
        String out = q.getOrDefault("out", "");
        if (!name.matches("[A-Za-z0-9_$]+\\.java") || out.isEmpty()) {
            return "{\"error\":\"peticion\"}";
        }
        JavaCompiler jc = ToolProvider.getSystemJavaCompiler();
        if (jc == null) {
            return "{\"error\":\"sin compilador (¿es un JRE?)\"}";
        }
        DiagnosticCollector<JavaFileObject> dc = new DiagnosticCollector<>();
        boolean ok;
        try (StandardJavaFileManager fm = jc.getStandardFileManager(dc, Locale.ROOT, StandardCharsets.UTF_8)) {
            fm.setLocation(StandardLocation.CLASS_OUTPUT, List.of(new File(out)));
            List<File> cp = new ArrayList<>();
            for (String p : q.getOrDefault("cp", "").split(File.pathSeparator)) {
                if (!p.isEmpty()) cp.add(new File(p));
            }
            fm.setLocation(StandardLocation.CLASS_PATH, cp);
            JavaFileObject fuente = new SimpleJavaFileObject(URI.create("string:///" + name), JavaFileObject.Kind.SOURCE) {
                @Override
                public CharSequence getCharContent(boolean ignoreEncodingErrors) {
                    return src;
                }
            };
            List<String> opts = List.of("--release", "21", "-proc:none", "-encoding", "UTF-8", "-g", "-Xlint:none");
            ok = jc.getTask(null, fm, dc, opts, null, List.of(fuente)).call();
        } catch (IOException | RuntimeException e) {
            return "{\"error\":" + cadena(String.valueOf(e)) + "}";
        }

        // Posiciones: de desplazamiento a (línea, columna), 1-based y en unidades UTF-16 (como Monaco)
        List<Integer> inicios = new ArrayList<>();
        inicios.add(0);
        for (int i = 0; i < src.length(); i++) {
            if (src.charAt(i) == '\n') inicios.add(i + 1);
        }
        StringBuilder sb = new StringBuilder("{\"ok\":").append(ok).append(",\"diags\":[");
        boolean primero = true;
        for (Diagnostic<? extends JavaFileObject> d : dc.getDiagnostics()) {
            if (d.getKind() != Diagnostic.Kind.ERROR && d.getKind() != Diagnostic.Kind.WARNING && d.getKind() != Diagnostic.Kind.MANDATORY_WARNING) {
                continue;
            }
            long ini = d.getStartPosition() >= 0 ? d.getStartPosition() : d.getPosition();
            long fin = d.getEndPosition() >= 0 ? d.getEndPosition() : ini + 1;
            if (!primero) sb.append(',');
            primero = false;
            sb.append("{\"kind\":\"").append(d.getKind() == Diagnostic.Kind.ERROR ? "error" : "warning").append("\",\"code\":").append(cadena(d.getCode()));
            if (ini >= 0) {
                if (fin <= ini) fin = ini + 1;
                int l1 = linea(inicios, (int) ini), l2 = linea(inicios, (int) Math.min(fin, Math.max(ini, src.length())));
                sb.append(",\"line\":").append(l1 + 1).append(",\"col\":").append(ini - inicios.get(l1) + 1)
                    .append(",\"endLine\":").append(l2 + 1).append(",\"endCol\":").append(Math.min(fin, src.length()) - inicios.get(l2) + 1)
                    .append(",\"start\":").append(ini).append(",\"end\":").append(fin);
            }
            sb.append(",\"msg\":").append(cadena(d.getMessage(Locale.ENGLISH))).append('}');
        }
        return sb.append("],\"ms\":").append((System.nanoTime() - t0) / 1_000_000).append('}').toString();
    }

    private static int linea(List<Integer> inicios, int off) {
        int lo = 0, hi = inicios.size() - 1;
        while (lo < hi) {
            int mid = (lo + hi + 1) >>> 1;
            if (inicios.get(mid) <= off) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    // ───────────────────────────── JSON mínimo (objeto plano de textos) ─────────────────────────────

    private static String cadena(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> sb.append(c < 0x20 ? String.format("\\u%04x", (int) c) : String.valueOf(c));
            }
        }
        return sb.append('"').toString();
    }

    private static Map<String, String> parsear(String j) {
        Map<String, String> m = new HashMap<>();
        int[] p = {0};
        blancos(j, p);
        if (p[0] >= j.length() || j.charAt(p[0]++) != '{') return null;
        while (true) {
            blancos(j, p);
            if (p[0] >= j.length()) return null;
            if (j.charAt(p[0]) == '}') return m;
            if (j.charAt(p[0]) == ',') {
                p[0]++;
                continue;
            }
            String k = texto(j, p);
            blancos(j, p);
            if (k == null || p[0] >= j.length() || j.charAt(p[0]++) != ':') return null;
            blancos(j, p);
            if (p[0] >= j.length()) return null;
            if (j.charAt(p[0]) == '"') {
                String v = texto(j, p);
                if (v == null) return null;
                m.put(k, v);
            } else {                      // número, true, false, null: se guarda tal cual
                int ini = p[0];
                while (p[0] < j.length() && ",}".indexOf(j.charAt(p[0])) < 0) p[0]++;
                m.put(k, j.substring(ini, p[0]).trim());
            }
        }
    }

    private static void blancos(String j, int[] p) {
        while (p[0] < j.length() && Character.isWhitespace(j.charAt(p[0]))) p[0]++;
    }

    private static String texto(String j, int[] p) {
        if (p[0] >= j.length() || j.charAt(p[0]) != '"') return null;
        p[0]++;
        StringBuilder sb = new StringBuilder();
        while (p[0] < j.length()) {
            char c = j.charAt(p[0]++);
            if (c == '"') return sb.toString();
            if (c != '\\') {
                sb.append(c);
                continue;
            }
            if (p[0] >= j.length()) return null;
            char e = j.charAt(p[0]++);
            switch (e) {
                case 'n' -> sb.append('\n');
                case 'r' -> sb.append('\r');
                case 't' -> sb.append('\t');
                case 'b' -> sb.append('\b');
                case 'f' -> sb.append('\f');
                case 'u' -> {
                    if (p[0] + 4 > j.length()) return null;
                    sb.append((char) Integer.parseInt(j.substring(p[0], p[0] + 4), 16));
                    p[0] += 4;
                }
                default -> sb.append(e);   // \" \\ \/
            }
        }
        return null;
    }
}
