/*
 * SOLUCIONES · Tema 2 · POO a fondo
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Objeto de valor inmutable para dinero.
 *
 * @complejidad Tiempo O(1) en todas las operaciones; espacio O(1).
 * @explicacion Todo se valida en el constructor compacto, así que es IMPOSIBLE tener un Dinero inválido en el
 * resto del programa (no hay que volver a comprobar nada). Se guardan céntimos enteros para no arrastrar los
 * errores de la coma flotante (0.1 + 0.2 ≠ 0.3) y solo se usa double en el borde (`euros`, `multiplicar`),
 * redondeando una vez con Math.round. Al ser un record, los campos son final: cada operación devuelve un objeto nuevo.
 * @alternativas Guardar un double de euros: más corto, pero acumula errores de redondeo y permite negativos.
 * BigDecimal: exacto, pero más pesado para un importe que cabe en un int/long. Una clase mutable con setters:
 * obliga a copiar defensivamente y a desconfiar en cada uso.
 */
record Dinero(int centimos, String moneda) {
    Dinero {
        if (centimos < 0) {
            throw new IllegalArgumentException("El dinero no puede ser negativo: " + centimos);
        }
        if (moneda == null || !moneda.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("Moneda no válida: '" + moneda + "' (tres letras mayúsculas)");
        }
    }

    Dinero(int centimos) {
        this(centimos, "EUR");
    }

    static Dinero euros(double euros, String moneda) {
        return new Dinero((int) Math.round(euros * 100), moneda);
    }

    static Dinero euros(double euros) {
        return euros(euros, "EUR");
    }

    Dinero sumar(Dinero otro) {
        if (!moneda.equals(otro.moneda)) {
            throw new IllegalArgumentException("No se pueden sumar " + moneda + " y " + otro.moneda);
        }
        return new Dinero(centimos + otro.centimos, moneda);
    }

    Dinero multiplicar(double factor) {
        return new Dinero((int) Math.round(centimos * factor), moneda);
    }

    boolean igual(Dinero otro) {
        return centimos == otro.centimos && moneda.equals(otro.moneda);
    }

    @Override
    public String toString() {
        return centimos / 100 + "," + String.format("%02d", centimos % 100) + " " + moneda;
    }
}

/**
 * Descuento por porcentaje sobre el subtotal.
 *
 * @complejidad Tiempo O(n) en el número de líneas; espacio O(1).
 * @explicacion Se valida en el constructor compacto. El subtotal se calcula en enteros y `subtotal * porcentaje / 100`
 * ya redondea hacia abajo (división entera), sin pasar por double ni arrastrar errores de coma flotante.
 * @alternativas Multiplicar por `porcentaje / 100.0` y truncar: puede dar 298 donde esperas 299 por el error de
 * representación. BigDecimal sería exacto pero excesivo aquí.
 */
record DescuentoPorcentaje(int porcentaje) implements Descuento {
    DescuentoPorcentaje {
        if (porcentaje < 0 || porcentaje > 100) {
            throw new IllegalArgumentException("El porcentaje debe estar entre 0 y 100: " + porcentaje);
        }
    }

    @Override
    public int calcular(List<Linea> lineas) {
        int subtotal = 0;
        for (Linea l : lineas) {
            subtotal += l.precio() * l.cantidad();
        }
        return subtotal * porcentaje / 100;
    }
}

/**
 * Descuento de una cantidad fija.
 *
 * @complejidad Tiempo O(n) en el número de líneas; espacio O(1).
 * @explicacion Se calcula el subtotal y se devuelve el menor entre la cantidad fija y el subtotal: así un cupón
 * de 50 € sobre un carrito de 20 € descuenta 20, no 50 (el total nunca sería negativo).
 * @alternativas Dejar que el Carrito recorte el excedente: funciona, pero entonces cada Descuento nuevo depende de
 * que el carrito se acuerde de limitarlo. Aquí el límite vive en quien lo conoce.
 */
record DescuentoFijo(int centimos) implements Descuento {
    DescuentoFijo {
        if (centimos < 0) {
            throw new IllegalArgumentException("El descuento no puede ser negativo: " + centimos);
        }
    }

    @Override
    public int calcular(List<Linea> lineas) {
        int subtotal = 0;
        for (Linea l : lineas) {
            subtotal += l.precio() * l.cantidad();
        }
        return Math.min(centimos, subtotal);
    }
}

/**
 * Promoción 3x2 por línea.
 *
 * @complejidad Tiempo O(n) en el número de líneas; espacio O(1).
 * @explicacion Por cada línea, `cantidad / 3` (división entera) es el número de grupos completos de tres, y cada
 * grupo regala una unidad: el descuento es esa cifra por el precio. Con 7 unidades hay 2 grupos y sobra 1.
 * @alternativas Un bucle que cuente de tres en tres: más largo y con más sitios donde equivocarse en el límite.
 */
final class TresPorDos implements Descuento {
    @Override
    public int calcular(List<Linea> lineas) {
        int descuento = 0;
        for (Linea l : lineas) {
            descuento += (l.cantidad() / 3) * l.precio();
        }
        return descuento;
    }
}

/**
 * Carrito que suma descuentos inyectados.
 *
 * @complejidad añadir O(1); subtotal y descuento O(n·d) con n líneas y d descuentos; espacio O(n + d).
 * @explicacion El carrito solo conoce la interfaz Descuento, así que añadir una promoción nueva no obliga a tocarlo
 * (principio abierto/cerrado). `descuento()` suma todos y recorta al subtotal para que `total()` nunca sea negativo,
 * pase lo que pase con los descuentos que se apliquen.
 * @alternativas Un `switch` por tipo de descuento dentro del carrito: cada promoción nueva obliga a modificar la
 * clase y a repetir pruebas. Calcular y guardar el total al añadir: se queda desfasado si luego se aplica otro descuento.
 */
final class Carrito {
    private final List<Linea> lineas = new ArrayList<>();
    private final List<Descuento> descuentos = new ArrayList<>();

    Carrito anadir(String nombre, int precio, int cantidad) {
        if (cantidad <= 0) {
            throw new IllegalArgumentException("La cantidad debe ser positiva: " + cantidad);
        }
        lineas.add(new Linea(nombre, precio, cantidad));
        return this;
    }

    Carrito anadir(String nombre, int precio) {
        return anadir(nombre, precio, 1);
    }

    Carrito aplicar(Descuento descuento) {
        descuentos.add(descuento);
        return this;
    }

    int subtotal() {
        int suma = 0;
        for (Linea l : lineas) {
            suma += l.precio() * l.cantidad();
        }
        return suma;
    }

    int descuento() {
        int suma = 0;
        for (Descuento d : descuentos) {
            suma += d.calcular(lineas);
        }
        return Math.min(suma, subtotal());
    }

    int total() {
        return subtotal() - descuento();
    }
}

/**
 * Repositorio de usuarios en memoria.
 *
 * @complejidad guardar, buscar y eliminar O(1); todos O(n); espacio O(n).
 * @bigo 1
 * @explicacion Un LinkedHashMap indexado por id: `put` con una clave existente reemplaza el valor SIN cambiar su
 * posición, y recorrer las claves devuelve el orden de primera inserción. `buscar` es un `get` por clave, O(1), en
 * lugar de recorrer una lista. `todos()` devuelve una copia para que el llamador no pueda alterar el estado interno.
 * @alternativas Una List<Usuario> con búsqueda lineal: más simple, pero O(n) por búsqueda (con 100.000 usuarios,
 * 100.000 comparaciones por consulta). Un HashMap normal: O(1) igual, pero `todos()` saldría en orden arbitrario.
 */
final class RepositorioUsuariosEnMemoria implements RepositorioUsuarios {
    private final Map<Integer, Usuario> usuarios = new LinkedHashMap<>();

    @Override
    public void guardar(Usuario usuario) {
        usuarios.put(usuario.id(), usuario);
    }

    @Override
    public Usuario buscar(int id) {
        return usuarios.get(id);
    }

    @Override
    public List<Usuario> todos() {
        return new ArrayList<>(usuarios.values());
    }

    @Override
    public boolean eliminar(int id) {
        return usuarios.remove(id) != null;
    }
}

/**
 * Contenedor de dependencias con autowiring (reflexión).
 *
 * @complejidad Construir un servicio nuevo: O(p) con p el número de parámetros del grafo de dependencias; pedir
 * uno ya construido: O(1) (singleton en caché).
 * @explicacion `get()` mira si ya existe la instancia, si hay una fábrica registrada o, si no, la construye
 * leyendo los constructores con reflexión: se prueban de más a menos parámetros y se usa el primero cuyos tipos
 * son todos inyectables (clases propias; no primitivos, String ni java.*). Como Java no tiene valores por defecto,
 * el constructor "corto" hace de valor por defecto. Cada parámetro se pide recursivamente al propio contenedor.
 * Para detectar ciclos se anota qué tipos se están construyendo en ese momento (si vuelve a aparecer uno, es
 * circular) y se quita en `finally`, de modo que el contenedor queda utilizable aunque falle una construcción.
 * Es, en pequeño, lo que hace Spring con @Autowired.
 * @alternativas Construir a mano con `new` en un único sitio ("composition root"): más explícito, pero hay que
 * actualizarlo con cada dependencia nueva. Un contenedor con generación de código en compilación (Dagger) evita
 * la reflexión y detecta los ciclos al compilar.
 */
final class Contenedor {
    private final Map<String, Function<Contenedor, Object>> fabricas = new HashMap<>();
    private final Map<String, Object> instancias = new HashMap<>();
    private final Set<String> enConstruccion = new HashSet<>();

    <T> void set(Class<T> tipo, Function<Contenedor, ? extends T> fabrica) {
        set(tipo.getName(), c -> fabrica.apply(c));
    }

    void set(String id, Function<Contenedor, Object> fabrica) {
        fabricas.put(id, fabrica);
        instancias.remove(id);
    }

    boolean has(Class<?> tipo) {
        return has(tipo.getName());
    }

    boolean has(String id) {
        if (fabricas.containsKey(id)) {
            return true;
        }
        Class<?> clase = cargar(id);
        return clase != null && !clase.isInterface() && !java.lang.reflect.Modifier.isAbstract(clase.getModifiers());
    }

    @SuppressWarnings("unchecked")
    <T> T get(Class<T> tipo) {
        return (T) get(tipo.getName());
    }

    Object get(String id) {
        Object existente = instancias.get(id);
        if (existente != null) {
            return existente;
        }
        if (!enConstruccion.add(id)) {
            throw new DependenciaCircular("Dependencia circular al construir " + id);
        }
        try {
            Object nueva;
            Function<Contenedor, Object> fabrica = fabricas.get(id);
            if (fabrica != null) {
                nueva = fabrica.apply(this);
            } else {
                nueva = autowire(id);
            }
            instancias.put(id, nueva);
            return nueva;
        } finally {
            enConstruccion.remove(id);
        }
    }

    private static Class<?> cargar(String id) {
        try {
            return Class.forName(id, false, Contenedor.class.getClassLoader());
        } catch (ClassNotFoundException | LinkageError e) {
            return null;
        }
    }

    private static boolean inyectable(Class<?> tipo) {
        return !tipo.isPrimitive() && !tipo.isArray() && !tipo.getName().startsWith("java.");
    }

    private Object autowire(String id) {
        Class<?> clase = cargar(id);
        if (clase == null) {
            throw new ContenedorException("No existe la clase " + id);
        }
        if (clase.isInterface() || java.lang.reflect.Modifier.isAbstract(clase.getModifiers())) {
            throw new ContenedorException("No se puede instanciar " + id + ": regístralo con set()");
        }
        java.lang.reflect.Constructor<?>[] constructores = clase.getDeclaredConstructors();
        Arrays.sort(constructores, Comparator.comparingInt((java.lang.reflect.Constructor<?> k) -> k.getParameterCount()).reversed());
        for (java.lang.reflect.Constructor<?> constructor : constructores) {
            Class<?>[] tipos = constructor.getParameterTypes();
            if (!Arrays.stream(tipos).allMatch(Contenedor::inyectable)) {
                continue;
            }
            Object[] argumentos = new Object[tipos.length];
            for (int i = 0; i < tipos.length; i++) {
                argumentos[i] = get(tipos[i].getName());
            }
            try {
                constructor.setAccessible(true);
                return constructor.newInstance(argumentos);
            } catch (java.lang.reflect.InvocationTargetException e) {
                if (e.getCause() instanceof RuntimeException re) {
                    throw re;
                }
                throw new ContenedorException("Falló el constructor de " + id + ": " + e.getCause());
            } catch (ReflectiveOperationException e) {
                throw new ContenedorException("No se pudo construir " + id + ": " + e);
            }
        }
        throw new ContenedorException("Ningún constructor de " + id + " tiene solo parámetros inyectables");
    }
}

/**
 * Despachador de eventos (Observer).
 *
 * @complejidad escuchar O(k) por la inserción ordenada; despachar O(k) con k oyentes del evento; espacio O(k).
 * @explicacion Cada evento guarda su lista de oyentes ya ordenada: al registrar, se inserta tras el último con
 * prioridad mayor o igual, así que a igual prioridad manda el orden de registro y `despachar` no reordena nada.
 * Se itera sobre una copia para que un oyente pueda registrar otros sin romper el recorrido
 * (ConcurrentModificationException). Solo Boolean.FALSE corta la cadena: `Boolean.FALSE.equals(resultado)`
 * evita confundirlo con null (un oyente "sin retorno").
 * @alternativas Guardar todo sin orden y ordenar en cada despacho (`sort` estable): más simple, pero O(k log k) en
 * cada evento. Una PriorityQueue no sirve: no es estable, y a igual prioridad perderías el orden de registro.
 */
final class Despachador {
    private record Registro(Function<Object, Object> oyente, int prioridad) {
    }

    private final Map<String, List<Registro>> oyentes = new HashMap<>();

    void escuchar(String evento, Function<Object, Object> oyente, int prioridad) {
        List<Registro> lista = oyentes.computeIfAbsent(evento, e -> new ArrayList<>());
        int pos = lista.size();
        while (pos > 0 && lista.get(pos - 1).prioridad() < prioridad) {
            pos--;
        }
        lista.add(pos, new Registro(oyente, prioridad));
    }

    void escuchar(String evento, Function<Object, Object> oyente) {
        escuchar(evento, oyente, 0);
    }

    int despachar(String evento, Object datos) {
        int ejecutados = 0;
        for (Registro r : new ArrayList<>(oyentes.getOrDefault(evento, List.of()))) {
            ejecutados++;
            if (Boolean.FALSE.equals(r.oyente().apply(datos))) {
                break;
            }
        }
        return ejecutados;
    }

    int despachar(String evento) {
        return despachar(evento, null);
    }
}
