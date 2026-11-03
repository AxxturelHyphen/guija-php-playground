"""
Harness de Python del playground: el equivalente a harness.php.

Se lanza así (lo hace PythonLanguage::run):

    python -X utf8 -E -B -P pg_harness.py <archivo del usuario>

y hace tres cosas:

- Ejecuta el archivo del usuario como `__main__` (como si lo hubieras lanzado tú con `python archivo.py`).
- Captura warnings, excepciones, errores de sintaxis, bucles infinitos y memoria agotada, y los manda como
  eventos estructurados (en vez de texto suelto) para poder explicarlos en español y marcarlos en el editor.
- Mete en `builtins` la API de los ejercicios: pendiente(), grupo(), prueba(), comprueba(), lanza() y medir().
  Así el código del usuario las usa sin importar nada, igual que en PHP.

Los eventos van por stdout entre marcas de control, mezclados con la salida normal y en el orden real:

    \\x1ePG{json}\\x1f

El servidor (Core\\Protocol) los separa. La semántica de cada evento es la misma que en PHP:
err · todo · test · bench · img · note · end.

Todo lo interno empieza por `_` para no ensuciar el espacio de nombres del usuario: lo único que ve son las seis
funciones de la API y la excepción PorHacer.
"""
import builtins
import gc
import json
import os
import sys
import threading
import time
import types

_START = '\x1ePG'
_END = '\x1f'
_AQUI = os.path.dirname(os.path.abspath(__file__))


class _Estado:
    """Estado del harness (una sola instancia). Un objeto en vez de globales sueltas: queda claro qué es nuestro."""

    def __init__(self) -> None:
        self.t0 = time.perf_counter_ns()
        self.ruta = ''                  # ruta del archivo del usuario (temporal)
        self.nombre = ''                # su nombre de archivo (el servidor lo cambia por «tu_codigo.py»)
        self.lineas: list[str] = []     # el código del usuario, por líneas (para convertir columnas)
        self.globales: dict = {}        # el espacio de nombres del usuario (su módulo __main__)
        self.grupo = 'general'
        self.medir = os.environ.get('PG_BENCH') == '1'
        self.presupuesto_ms = _entero(os.environ.get('PG_BENCH_BUDGET_MS'), 1500)
        self.timeout = max(1, _entero(os.environ.get('PG_TIMEOUT'), 5))
        self.limite_mb = max(16, _entero(os.environ.get('PG_MEMORY_MB'), 256))
        self.hilo_principal = threading.get_ident()
        self.tiempo_agotado = False     # lo pone el vigía al cortar el programa
        self.terminado = False
        self.imagenes = 0
        self.lock = threading.Lock()


def _entero(texto, defecto: int) -> int:
    try:
        return int(texto)
    except (TypeError, ValueError):
        return defecto


_E = _Estado()

# Los eventos y la salida del usuario van por el MISMO stream, con buffer de línea: así se conserva el orden
# (un print, luego un error, luego otro print…) y, si el servidor mata el proceso, como mucho se pierde media línea.
try:
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
except (AttributeError, ValueError):
    pass
_SALIDA = sys.stdout
sys.stderr = sys.stdout


# ═══════════════════════════════════════ eventos ═══════════════════════════════════════

def emit(ev: dict) -> None:
    """Escribe un evento del protocolo. JSON en ASCII puro: nunca rompe la codificación ni el JSON de PHP."""
    try:
        texto = json.dumps(ev, ensure_ascii=True, allow_nan=False, default=str)
    except (TypeError, ValueError):
        texto = json.dumps(_limpio(ev), ensure_ascii=True, default=str)
    with _E.lock:
        try:
            _SALIDA.write(_START + texto + _END)
            _SALIDA.flush()
        except (OSError, ValueError):
            pass


def _limpio(v):
    """Copia sin NaN ni infinitos (el JSON de PHP no los admite)."""
    if isinstance(v, float):
        return v if v == v and v not in (float('inf'), float('-inf')) else None
    if isinstance(v, dict):
        return {str(k): _limpio(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_limpio(x) for x in v]
    return v


def _test(grupo: str, nombre: str, estado: str, **extra) -> None:
    emit({'t': 'test', 'group': grupo, 'name': nombre, 'status': estado, **extra})


def _ms(desde_ns: int) -> float:
    return round((time.perf_counter_ns() - desde_ns) / 1e6, 3)


# ═══════════════════════════════════════ posiciones y trazas ═══════════════════════════════════════

def _col16(linea: int, col_bytes: int) -> int:
    """Columna en bytes UTF-8 (0-based, como las da CPython) → columna 1-based en UTF-16 (como Monaco)."""
    if not 1 <= linea <= len(_E.lineas):
        return col_bytes + 1
    texto = _E.lineas[linea - 1]
    if texto.isascii():
        return col_bytes + 1
    prefijo = texto.encode('utf-8')[:max(0, col_bytes)].decode('utf-8', 'replace')
    return _u16(prefijo) + 1


def _u16(s: str) -> int:
    return len(s) + sum(1 for c in s if ord(c) > 0xFFFF)


def _marcos(tb) -> list:
    """Frames de una traza, del más externo al más interno: [(code, línea, índice de instrucción)]."""
    out = []
    while tb is not None:
        out.append((tb.tb_frame, tb.tb_lineno, tb.tb_lasti))
        tb = tb.tb_next
    return out


def _es_usuario(frame) -> bool:
    return frame.f_code.co_filename == _E.ruta


def _nombre_fn(code) -> str:
    nombre = getattr(code, 'co_qualname', code.co_name)
    if nombre == '<lambda>' or nombre.endswith('.<lambda>'):
        return 'lambda'
    return nombre.replace('.<locals>', '')


def _traza(marcos: list) -> list:
    """
    Pila de llamadas al estilo de PHP: cada elemento es «se llamó a fn() en la línea N» (N en tu archivo),
    de la llamada más interna a la más externa, como mucho 20.
    """
    out = []
    for i in range(len(marcos) - 1):
        llamante, linea, _ = marcos[i]
        if _es_usuario(llamante):
            out.append({'fn': _nombre_fn(marcos[i + 1][0].f_code) + '()', 'line': linea})
    out.reverse()
    return out[:20]


def _donde(marcos: list) -> dict:
    """Línea (y columnas, si CPython las sabe) del frame más interno que está en el archivo del usuario."""
    for frame, linea, lasti in reversed(marcos):
        if not _es_usuario(frame):
            continue
        ev = {'line': linea}
        try:
            pos = list(frame.f_code.co_positions())[lasti // 2]
            if pos[0] == linea and pos[2] is not None and pos[3] is not None and pos[1] is not None:
                ev['col'] = _col16(pos[0], pos[2])
                ev['endLine'] = pos[1]
                ev['endCol'] = _col16(pos[1], pos[3])
        except (IndexError, ValueError, TypeError):
            pass
        return ev
    return {'line': 1}


def _linea_actual() -> int:
    """Línea del usuario en la que está ahora el hilo principal (para el vigía de tiempo y memoria)."""
    frame = sys._current_frames().get(_E.hilo_principal)
    while frame is not None:
        if _es_usuario(frame):
            return frame.f_lineno
        frame = frame.f_back
    return 1


def _linea_de(exc: BaseException) -> int:
    return _donde(_marcos(exc.__traceback__))['line']


# ═══════════════════════════════════════ errores ═══════════════════════════════════════

def _publicos(nombres) -> list:
    return sorted({n for n in nombres if isinstance(n, str) and not n.startswith('__')})


def _evento_excepcion(exc: BaseException, kind: str = 'exception') -> dict:
    marcos = _marcos(exc.__traceback__)
    ev = {'t': 'err', 'kind': kind, 'cls': type(exc).__name__, 'msg': _mensaje(exc), 'file': _E.nombre}
    ev.update(_donde(marcos))
    ev['trace'] = _traza(marcos)

    if isinstance(exc, NameError) and getattr(exc, 'name', None):
        ev['name'] = exc.name
        locales = []
        for frame, _, _ in reversed(marcos):
            if _es_usuario(frame):
                try:
                    locales = list(frame.f_locals.keys())
                except Exception:
                    locales = []
                break
        ev['candidates'] = _publicos(locales + list(_E.globales.keys()) + dir(builtins))[:2000]
    elif isinstance(exc, AttributeError) and getattr(exc, 'name', None):
        ev['name'] = exc.name
        obj = getattr(exc, 'obj', None)
        if obj is not None:
            try:
                ev['candidates'] = [n for n in dir(obj) if not n.startswith('_')][:500]
            except Exception:
                pass
            ev['objType'] = type(obj).__name__
    elif isinstance(exc, ModuleNotFoundError) and getattr(exc, 'name', None):
        ev['name'] = exc.name
        ev['candidates'] = sorted(set(getattr(sys, 'stdlib_module_names', ())) | {'numpy', 'matplotlib', 'librosa'})
    elif isinstance(exc, ImportError) and getattr(exc, 'name', None):
        modulo = sys.modules.get(exc.name)
        ev['name'] = exc.name
        if modulo is not None:
            ev['candidates'] = [n for n in dir(modulo) if not n.startswith('_')][:1000]

    causa = exc.__cause__ or (None if exc.__suppress_context__ else exc.__context__)
    if causa is not None and not isinstance(causa, KeyboardInterrupt):
        ev['previous'] = type(causa).__name__ + ': ' + _mensaje(causa)
    return ev


def _mensaje(exc: BaseException) -> str:
    try:
        return str(exc)
    except Exception:
        return '(el mensaje de la excepción no se pudo convertir a texto)'


def _evento_sintaxis(exc: SyntaxError) -> dict:
    """SyntaxError / IndentationError / TabError → evento `parse` con su posición en UTF-16."""
    linea = exc.lineno or 1
    texto = _E.lineas[linea - 1] if 1 <= linea <= len(_E.lineas) else ''
    col = max(1, exc.offset or 1)           # CPython da columnas en caracteres, 1-based
    col16 = _u16(texto[:col - 1]) + 1
    fin_linea = exc.end_lineno or linea
    fin = exc.end_offset if exc.end_offset and exc.end_offset > 0 else 0
    if (fin_linea, fin) <= (linea, col):
        fin_linea, fin16 = linea, col16 + 1
    else:
        texto_fin = _E.lineas[fin_linea - 1] if 1 <= fin_linea <= len(_E.lineas) else ''
        fin16 = _u16(texto_fin[:fin - 1]) + 1
    return {'t': 'err', 'kind': 'parse', 'cls': type(exc).__name__, 'msg': exc.msg or str(exc), 'line': linea,
            'col': col16, 'endLine': fin_linea, 'endCol': fin16, 'file': _E.nombre}


def _mostrar_warning(message, category, filename, lineno, file=None, line=None) -> None:
    """Sustituye a warnings.showwarning: solo los warnings que caen en una línea del usuario."""
    if filename != _E.ruta:
        return
    es_deprecado = issubclass(category, (DeprecationWarning, PendingDeprecationWarning))
    emit({'t': 'err', 'kind': 'deprecated' if es_deprecado else 'warning', 'cls': category.__name__,
          'msg': str(message), 'line': int(lineno or 1), 'file': _E.nombre})


def _hook_hilos(args) -> None:
    """Excepción no capturada en un hilo del usuario: también se explica."""
    if args.exc_type is SystemExit or args.exc_value is None:
        return
    emit(_evento_excepcion(args.exc_value))


# ═══════════════════════════════════════ vigía: tiempo y memoria ═══════════════════════════════════════

def _lector_memoria():
    """
    Devuelve una función sin argumentos → (memoria propia, memoria residente) en bytes, o None si no hay forma.
    La «propia» (sin las bibliotecas compartidas) es la que se compara con el límite: así importar numpy o
    matplotlib no cuenta como si el programa estuviera gastando memoria.
    """
    if os.path.exists('/proc/self/statm'):           # Linux
        pagina = os.sysconf('SC_PAGE_SIZE')
        fd = os.open('/proc/self/statm', os.O_RDONLY)

        def linux():
            campos = os.pread(fd, 128, 0).split()
            residente = int(campos[1]) * pagina
            return residente - int(campos[2]) * pagina, residente
        return linux
    if os.name == 'nt':                               # Windows
        try:
            import ctypes
            from ctypes import wintypes

            class _PMC(ctypes.Structure):
                _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD),
                            ('PeakWorkingSetSize', ctypes.c_size_t), ('WorkingSetSize', ctypes.c_size_t),
                            ('QuotaPeakPagedPoolUsage', ctypes.c_size_t), ('QuotaPagedPoolUsage', ctypes.c_size_t),
                            ('QuotaPeakNonPagedPoolUsage', ctypes.c_size_t), ('QuotaNonPagedPoolUsage', ctypes.c_size_t),
                            ('PagefileUsage', ctypes.c_size_t), ('PeakPagefileUsage', ctypes.c_size_t)]
            k32 = ctypes.WinDLL('kernel32')
            k32.GetCurrentProcess.restype = wintypes.HANDLE
            proceso = k32.GetCurrentProcess()
            pmc = _PMC()
            pmc.cb = ctypes.sizeof(_PMC)

            def windows():
                k32.K32GetProcessMemoryInfo(proceso, ctypes.byref(pmc), pmc.cb)
                return pmc.PagefileUsage, pmc.WorkingSetSize
            return windows
        except Exception:
            return None
    try:                                              # macOS y otros Unix: solo el pico
        import resource
        factor = 1 if sys.platform == 'darwin' else 1024

        def unix():
            pico = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * factor
            return pico, pico
        return unix
    except Exception:
        return None


_memoria = _lector_memoria()


def _pico() -> tuple:
    """(memoria actual, pico) en bytes para el evento `end`."""
    actual = 0
    if _memoria is not None:
        try:
            actual = _memoria()[1]
        except Exception:
            actual = 0
    pico = actual
    try:
        if os.path.exists('/proc/self/status'):
            with open('/proc/self/status', 'rb') as f:
                for fila in f:
                    if fila.startswith(b'VmHWM:'):
                        pico = int(fila.split()[1]) * 1024
                        break
        elif os.name == 'nt':
            pico = max(pico, actual)
        else:
            import resource
            pico = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)
    except Exception:
        pass
    return actual, max(pico, actual)


def _interrumpir() -> None:
    """Lanza KeyboardInterrupt en el hilo principal (en Unix con una señal real: así también corta un sleep())."""
    if os.name == 'posix':
        try:
            import signal
            signal.pthread_kill(_E.hilo_principal, signal.SIGINT)
            return
        except Exception:
            pass
    import _thread
    _thread.interrupt_main()


def _morir(ev: dict) -> None:
    """Último recurso del vigía: avisa, cierra y sale sin esperar al hilo principal."""
    emit(ev)
    _emitir_fin()
    try:
        _SALIDA.flush()
    except Exception:
        pass
    os._exit(255)


def _vigia() -> None:
    limite = _E.limite_mb * 1024 * 1024
    plazo = time.monotonic() + _E.timeout
    interrumpido = None
    while not _E.terminado:
        time.sleep(0.05)
        if _memoria is not None:
            try:
                propia, _ = _memoria()
            except Exception:
                propia = 0
            if propia > limite:
                _morir({'t': 'err', 'kind': 'memory', 'cls': 'MemoryError', 'line': _linea_actual(), 'file': _E.nombre,
                        'msg': f'El programa superó el límite de {_E.limite_mb} MB de memoria', 'limitMb': _E.limite_mb})
        ahora = time.monotonic()
        if interrumpido is None and ahora >= plazo:
            _E.tiempo_agotado = True
            interrumpido = ahora
            _interrumpir()
        elif interrumpido is not None and ahora - interrumpido > 0.8:
            # El KeyboardInterrupt no bastó (un `except:` que se lo traga, por ejemplo): se corta desde aquí.
            _morir(_evento_timeout(_linea_actual()))


def _evento_timeout(linea: int) -> dict:
    return {'t': 'err', 'kind': 'timeout', 'msg': 'Maximum execution time', 'line': linea, 'limit': _E.timeout,
            'file': _E.nombre}


# ═══════════════════════════════════════ comparación y formato ═══════════════════════════════════════

_ESCALARES = (type(None), bool, int, float, complex, str, bytes)


def _numpy():
    """El módulo numpy si el programa ya lo ha importado (nunca se importa solo por comparar)."""
    return sys.modules.get('numpy')


def _es_ndarray(v) -> bool:
    np = _numpy()
    return np is not None and isinstance(v, np.ndarray)


def _a_python(v):
    """Un escalar de numpy (np.float64, np.int64, np.bool_) se compara como su tipo de Python."""
    np = _numpy()
    if np is not None and isinstance(v, np.generic):
        try:
            return v.item()
        except Exception:
            return v
    return v


def _clase(v) -> str:
    """Familia de tipos para comparar: dos valores de familias distintas nunca son iguales."""
    if v is None:
        return 'none'
    if isinstance(v, bool):
        return 'bool'
    if isinstance(v, int):
        return 'int'
    if isinstance(v, float):
        return 'float'
    if isinstance(v, complex):
        return 'complex'
    if isinstance(v, str):
        return 'str'
    if isinstance(v, (bytes, bytearray)):
        return 'bytes'
    if isinstance(v, dict):
        return 'dict'
    if isinstance(v, list):
        return 'list'
    if isinstance(v, tuple):
        return 'tuple'
    if isinstance(v, (set, frozenset)):
        return 'set'
    if _es_ndarray(v):
        return 'ndarray'
    return 'obj'


def _float_igual(a: float, b: float) -> bool:
    if a != a and b != b:            # NaN es igual a NaN (como en PHP)
        return True
    return a == b or abs(a - b) <= 1e-9 * max(1.0, abs(a), abs(b))


def igual(a, b, sin_orden: bool = False) -> bool:
    """
    Igualdad estricta para las pruebas:
      - int, float y bool son tipos distintos (True != 1, 1 != 1.0); los float con tolerancia relativa 1e-9; NaN == NaN;
      - list y tuple no son intercambiables; en un dict cuenta el orden de las claves; un set se compara como conjunto;
      - un ndarray de numpy, por forma y allclose;
      - `sin_orden` ordena las listas (por su repr) y en los dicts ignora el orden.
    """
    if sin_orden:
        a, b = _normalizar(a), _normalizar(b)
    return _igual(a, b, 0)


def _igual(a, b, prof: int) -> bool:
    if prof > 60:
        return a == b
    a, b = _a_python(a), _a_python(b)
    ca, cb = _clase(a), _clase(b)
    if ca != cb:
        return False
    if ca == 'none':
        return True
    if ca == 'float':
        return _float_igual(a, b)
    if ca == 'complex':
        return _float_igual(a.real, b.real) and _float_igual(a.imag, b.imag)
    if ca in ('list', 'tuple'):
        return len(a) == len(b) and all(_igual(x, y, prof + 1) for x, y in zip(a, b))
    if ca == 'dict':
        ka, kb = list(a.keys()), list(b.keys())
        if len(ka) != len(kb) or not all(_igual(x, y, prof + 1) for x, y in zip(ka, kb)):
            return False
        return all(_igual(a[k], b[k], prof + 1) for k in ka)
    if ca == 'set':
        if len(a) != len(b) or a != b:
            return False
        tipos = sorted(_clase(x) for x in a)
        return tipos == sorted(_clase(x) for x in b)
    if ca == 'ndarray':
        np = _numpy()
        if a.shape != b.shape:
            return False
        try:
            if np.issubdtype(a.dtype, np.number) and np.issubdtype(b.dtype, np.number):
                return bool(np.allclose(a, b, rtol=1e-9, atol=1e-12, equal_nan=True))
            return bool(np.array_equal(a, b))
        except Exception:
            return False
    if ca == 'obj':
        if type(a) is not type(b):
            return False
        try:
            if type(a).__eq__ is object.__eq__ and hasattr(a, '__dict__'):
                # Sin __eq__ propio: se comparan los atributos (como `==` entre objetos en PHP)
                return a is b or _igual(vars(a), vars(b), prof + 1)
            return bool(a == b)
        except Exception:
            return False
    try:
        return bool(a == b)
    except Exception:
        return False


def _normalizar(v):
    """Para `sin_orden`: listas y tuplas ordenadas por su repr; dicts con las claves ordenadas."""
    v = _a_python(v)
    if isinstance(v, (list, tuple)):
        items = sorted((_normalizar(x) for x in v), key=lambda x: export(x, 1000))
        return items if isinstance(v, list) else tuple(items)
    if isinstance(v, dict):
        return {k: _normalizar(v[k]) for k in sorted(v, key=lambda x: export(x, 1000))}
    return v


def export(v, maximo: int = 300) -> str:
    """Vista previa corta de un valor, con la sintaxis de Python: [1, 2], {'a': 1}, 'texto', None…"""
    try:
        s = _exp(v, 0)
    except Exception:
        s = '<' + type(v).__name__ + '>'
    return s if len(s) <= maximo else s[:maximo - 1] + '…'


def _items(it, total: int, prof: int, fmt) -> list:
    partes = []
    for i, x in enumerate(it):
        if i >= 40:
            partes.append(f'…(+{total - 40})')
            break
        partes.append(fmt(x))
    return partes


def _exp(v, prof: int) -> str:
    v = _a_python(v)
    t = type(v)
    if v is None or t in (bool, int, str, bytes):
        return repr(v)
    if t is float:
        return repr(v)
    if isinstance(v, (list, tuple, set, frozenset, dict)):
        if prof >= 4:
            return '[…]' if isinstance(v, list) else '(…)' if isinstance(v, tuple) else '{…}'
        if isinstance(v, dict):
            cuerpo = '{' + ', '.join(_items(v.items(), len(v), prof, lambda kv: _exp(kv[0], prof + 1) + ': ' + _exp(kv[1], prof + 1))) + '}'
            return cuerpo if t is dict else f'{t.__name__}({cuerpo})'
        if isinstance(v, list):
            cuerpo = '[' + ', '.join(_items(v, len(v), prof, lambda x: _exp(x, prof + 1))) + ']'
            return cuerpo if t is list else f'{t.__name__}({cuerpo})'
        if isinstance(v, tuple):
            if hasattr(v, '_fields'):                     # namedtuple: su repr ya es claro
                return repr(v)
            partes = _items(v, len(v), prof, lambda x: _exp(x, prof + 1))
            return '(' + ', '.join(partes) + (',' if len(v) == 1 else '') + ')'
        if not v:
            return t.__name__ + '()'
        partes = _items(sorted(v, key=repr), len(v), prof, lambda x: _exp(x, prof + 1))
        cuerpo = '{' + ', '.join(partes) + '}'
        return cuerpo if t is set else f'{t.__name__}({cuerpo})'
    if _es_ndarray(v):
        np = _numpy()
        with np.printoptions(threshold=40, edgeitems=3, precision=6):
            return repr(v)
    if isinstance(v, types.FunctionType):
        return f'<función {v.__qualname__}>' if v.__name__ != '<lambda>' else '<lambda>'
    if isinstance(v, type):
        return f'<clase {v.__name__}>'
    if isinstance(v, types.GeneratorType):
        return '<generador>'
    if t.__repr__ is object.__repr__ and hasattr(v, '__dict__'):
        # Objeto sin __repr__ propio: Clase(atributo=valor, ...) en vez de <Clase object at 0x...>
        if prof >= 3:
            return t.__name__ + '(…)'
        attrs = ', '.join(f'{k}={_exp(x, prof + 1)}' for k, x in list(vars(v).items())[:40])
        return f'{t.__name__}({attrs})'
    import enum
    if isinstance(v, enum.Enum):
        return f'{t.__name__}.{v.name}'
    return repr(v)


# ═══════════════════════════════════════ API pública ═══════════════════════════════════════

class PorHacer(BaseException):
    """
    La lanza pendiente(): el ejercicio todavía no está implementado.
    Hereda de BaseException (no de Exception) para que un `except Exception:` del usuario no se la trague.
    """


def pendiente(mensaje: str = 'Ejercicio pendiente de implementar'):
    """Marca un ejercicio sin implementar. Las pruebas lo muestran como «pendiente», no como fallo."""
    raise PorHacer(mensaje)


def grupo(nombre: str) -> None:
    """Agrupa las siguientes comprobaciones (comprueba/lanza) bajo un título."""
    _E.grupo = str(nombre)


def _resolver(nombre: str):
    """Busca una función por nombre en el código del usuario («suma» o «Clase.metodo»)."""
    partes = nombre.split('.')
    obj = _E.globales.get(partes[0], getattr(builtins, partes[0], None))
    for p in partes[1:]:
        obj = getattr(obj, p, None)
    return obj if callable(obj) else None


def _nombre_callable(fn) -> str:
    nombre = getattr(fn, '__qualname__', None) or getattr(fn, '__name__', None)
    if not nombre or nombre == '<lambda>' or nombre.endswith('.<lambda>'):
        return 'lambda'
    return nombre.replace('.<locals>', '')


def _ejecutar(grupo_: str, nombre: str, llamada, comprobar, extra: dict) -> bool:
    """Ejecuta una prueba y emite su evento. `llamada()` devuelve el valor actual. PorHacer sube a quien llama."""
    t0 = time.perf_counter_ns()
    try:
        actual = llamada()
        ok = bool(comprobar(actual))
        ms = _ms(t0)
        _test(grupo_, nombre, 'pass' if ok else 'fail', **extra, actual=export(actual), ms=ms)
        return ok
    except PorHacer:
        raise
    except Exception as e:
        _test(grupo_, nombre, 'error', **extra, msg=f'{type(e).__name__}: {_mensaje(e)}', line=_linea_de(e), ms=_ms(t0))
        return False


def prueba(fn, casos, comparador=None, sin_orden: bool = False) -> None:
    """
    Prueba una función con varios casos.

        prueba('suma', {
            'suma básica': ((2, 3), 5),        # (argumentos, resultado esperado)
            'con negativos': ((-1, 1), 0),
            'un argumento': ([1, 2, 3], 6),    # si no es una tupla, es el único argumento
        })

    fn: nombre de la función (o la función); casos: {descripción: (argumentos, esperado)};
    comparador: fn(actual, esperado) -> bool si la igualdad estricta no sirve;
    sin_orden: True si el resultado es un conjunto (el orden de las listas no importa).
    """
    if isinstance(fn, str):
        grupo_ = fn + '()'
        objetivo = _resolver(fn)
        if objetivo is None:
            _test(grupo_, '(existe la función)', 'error', msg=f'La función {fn}() no existe: ¿la has borrado o cambiado de nombre?')
            return
    else:
        objetivo = fn
        grupo_ = _nombre_callable(fn) + '()' if callable(fn) else 'lambda'
        if not callable(fn):
            _test(grupo_, '(existe la función)', 'error', msg=f'prueba() necesita una función o su nombre, no {type(fn).__name__}')
            return
    if isinstance(casos, dict):
        lista = list(casos.items())
    elif isinstance(casos, (list, tuple)):
        lista = list(enumerate(casos))
    else:
        _test(grupo_, '(casos)', 'error', msg='Los casos van en un diccionario: {descripción: (argumentos, esperado)}')
        return
    for n, (desc, caso) in enumerate(lista, start=1):
        nombre = desc if isinstance(desc, str) else f'caso {n}'
        if not isinstance(caso, (tuple, list)) or len(caso) != 2:
            _test(grupo_, nombre, 'error', msg='Un caso debe ser (argumentos, esperado)')
            continue
        args, esperado = caso
        args = args if isinstance(args, tuple) else (args,)
        entrada = ', '.join(export(a, 120) for a in args)
        try:
            _ejecutar(
                grupo_, nombre,
                lambda: objetivo(*args),
                lambda actual: comparador(actual, esperado) if comparador is not None else igual(actual, esperado, sin_orden),
                {'input': entrada, 'expected': export(esperado)},
            )
        except PorHacer:
            # Un solo «pendiente» por función, no uno por caso
            _test(grupo_, '(todos los casos)', 'todo', total=len(lista))
            return


def comprueba(descripcion: str, fn, esperado=True, sin_orden: bool = False) -> None:
    """
    Comprueba que `fn()` devuelve `esperado` (por defecto True). Pensado para clases y objetos.

        comprueba('un depósito suma al saldo', lambda: Cuenta().ingresar(5).saldo(), 5.0)
    """
    llamada = fn if callable(fn) else (lambda: fn)
    try:
        _ejecutar(_E.grupo, str(descripcion), llamada, lambda actual: igual(actual, esperado, sin_orden),
                  {'expected': export(esperado)})
    except PorHacer:
        _test(_E.grupo, str(descripcion), 'todo', expected=export(esperado))


def lanza(descripcion: str, fn, excepcion=Exception) -> None:
    """
    Comprueba que `fn()` lanza una excepción de esa clase (o de una subclase).

        lanza('retirar más del saldo', lambda: cuenta.retirar(999), SaldoInsuficiente)
    """
    if isinstance(excepcion, str):
        excepcion = _E.globales.get(excepcion, getattr(builtins, excepcion, Exception))
    clases = excepcion if isinstance(excepcion, tuple) else (excepcion,)
    nombre_exc = ' o '.join(getattr(c, '__name__', str(c)) for c in clases)
    extra = {'expected': 'lanza ' + nombre_exc}
    grupo_ = _E.grupo
    t0 = time.perf_counter_ns()
    try:
        fn()
        _test(grupo_, str(descripcion), 'fail', **extra, actual='no lanzó nada', ms=_ms(t0))
    except PorHacer:
        _test(grupo_, str(descripcion), 'todo', **extra)
    except (Exception, *[c for c in clases if isinstance(c, type) and issubclass(c, BaseException)
                          and not issubclass(c, KeyboardInterrupt)]) as e:
        ok = isinstance(e, clases)
        _test(grupo_, str(descripcion), 'pass' if ok else 'fail', **extra,
              actual=f"lanzó {type(e).__name__}: '{_mensaje(e)}'", ms=_ms(t0))


def medir(fn, entrada, escala: str = 'geometrica', tamanos=None, etiqueta=None) -> None:
    """
    Mide cuánto tarda una función según crece la entrada (para estimar O(n), O(n²)…).
    Solo se ejecuta con «Medir»/«Comparar»; en una ejecución normal se salta, porque tarda.

        medir('buscar_duplicados', lambda n: (list(range(n)),))        # n = 64, 128, 256…
        medir('fibonacci', lambda n: (n,), escala='lineal', tamanos=range(10, 30, 2))

    entrada: fn(n) → tupla con los argumentos para un tamaño n (no se cronometra); si no es una tupla, es el
    único argumento. escala: 'geometrica' (64, 128, 256…) o 'lineal' (1..40, para algoritmos exponenciales).
    """
    nombre = etiqueta or (fn if isinstance(fn, str) else _nombre_callable(fn))
    if not _E.medir:
        emit({'t': 'bench', 'name': nombre, 'status': 'skipped'})
        return
    objetivo = _resolver(fn) if isinstance(fn, str) else fn
    if objetivo is None or not callable(objetivo):
        emit({'t': 'bench', 'name': nombre, 'status': 'error', 'msg': f'La función {fn}() no existe'})
        return
    if tamanos is not None:
        tam = [int(n) for n in tamanos]
    elif escala == 'lineal':
        tam = list(range(1, 41))
    else:
        tam = [2 ** e for e in range(6, 18)]

    puntos = []
    gastado = 0.0
    parada = 'done'
    for n in tam:
        t0 = time.perf_counter_ns()
        try:
            args = entrada(n)
            args = args if isinstance(args, tuple) else (args,)
            por_llamada = _Cronometro.uno(objetivo, args)
        except PorHacer:
            emit({'t': 'bench', 'name': nombre, 'status': 'todo'})
            return
        except Exception as e:
            emit({'t': 'bench', 'name': nombre, 'status': 'error', 'msg': f'{type(e).__name__}: {_mensaje(e)}',
                  'line': _linea_de(e)})
            return
        puntos.append([n, por_llamada])
        gastado += (time.perf_counter_ns() - t0) / 1e6
        if por_llamada > 250:
            parada = 'slow'          # una sola llamada ya tarda más de 250 ms
            break
        if gastado > _E.presupuesto_ms:
            parada = 'budget'
            break

    # Solo los puntos: el ajuste del modelo (O(n), O(n²)…) lo hace el servidor (Core\Bench::fit), igual en los tres lenguajes.
    emit({'t': 'bench', 'name': nombre, 'status': 'ok', 'scale': escala, 'stopped': parada,
          'points': [[n, round(t, 6)] for n, t in puntos]})


class _Cronometro:
    """Cronometraje de medir(). El ajuste de modelos está en el servidor (Core\\Bench)."""

    @staticmethod
    def uno(fn, args: tuple) -> float:
        """
        Milisegundos por llamada (mínimo de varias tandas, para filtrar el ruido): el mismo algoritmo que PHP.

        Una diferencia con PHP: allí los arrays se pasan por valor, así que cada repetición recibe la entrada
        original. En Python una lista se pasa por referencia: si la función la modifica (un ordenamiento «in
        situ», por ejemplo), la segunda vuelta ya recibiría la lista ordenada y la medida sería falsa. Por eso,
        si la función cambia su entrada, cada repetición trabaja sobre una copia hecha fuera del cronómetro.
        """
        copia = _Cronometro._copiador(args)
        gc_activo = gc.isenabled()
        gc.disable()
        try:
            if copia is None:
                return _Cronometro._tandas(fn, args)
            original = copia()
            trabajo = copia()
            t0 = time.perf_counter_ns()
            fn(*trabajo)
            primera = (time.perf_counter_ns() - t0) / 1e6
            if igual(trabajo, original):
                return _Cronometro._tandas(fn, args)
            return _Cronometro._con_copias(fn, copia, primera)
        finally:
            if gc_activo:
                gc.enable()

    @staticmethod
    def _tandas(fn, args: tuple) -> float:
        pc = time.perf_counter_ns
        t0 = pc()
        r = fn(*args)
        primera = (pc() - t0) / 1e6
        if isinstance(r, types.GeneratorType):
            # Un generador no hace nada hasta que se recorre: se mide recorriéndolo entero
            def fn(*a, _f=fn):
                for _ in _f(*a):
                    pass
            t0 = pc()
            fn(*args)
            primera = (pc() - t0) / 1e6
        if primera > 50:
            return primera
        if primera > 2:
            mejor = primera
            for _ in range(2):
                t0 = pc()
                fn(*args)
                mejor = min(mejor, (pc() - t0) / 1e6)
            return mejor
        k = int(min(200000, max(1, -(-2.0 // max(primera, 0.0005)))))
        mejor = float('inf')
        for _ in range(5):
            t0 = pc()
            for _ in range(k):
                fn(*args)
            mejor = min(mejor, (pc() - t0) / 1e6 / k)
        return mejor

    @staticmethod
    def _con_copias(fn, copia, primera: float) -> float:
        if primera > 50:
            return primera
        repeticiones = 2 if primera > 2 else int(min(200, max(5, 10.0 / max(primera, 0.0005))))
        mejor = primera
        pc = time.perf_counter_ns
        for _ in range(repeticiones):
            trabajo = copia()
            t0 = pc()
            fn(*trabajo)
            mejor = min(mejor, (pc() - t0) / 1e6)
        return mejor

    @staticmethod
    def _copiador(args: tuple):
        """Una función que devuelve una copia nueva de los argumentos, o None si no hay nada mutable que copiar."""
        if not any(_Cronometro._mutable(a) for a in args):
            return None
        return lambda: tuple(_Cronometro._copia(a) for a in args)

    @staticmethod
    def _mutable(v) -> bool:
        return isinstance(v, (list, dict, set, bytearray)) or _es_ndarray(v)

    @staticmethod
    def _copia(v):
        """Copia de los contenedores «valor» (listas, dicts, sets, arrays); los objetos se comparten, como en PHP."""
        t = type(v)
        if t is list:
            return [x if type(x) in _ESCALARES else _Cronometro._copia(x) for x in v]
        if t is dict:
            return {k: x if type(x) in _ESCALARES else _Cronometro._copia(x) for k, x in v.items()}
        if t is set:
            return set(v)
        if t is bytearray:
            return bytearray(v)
        if t is tuple:
            return tuple(x if type(x) in _ESCALARES else _Cronometro._copia(x) for x in v)
        if _es_ndarray(v):
            return v.copy()
        if isinstance(v, (list, dict, set)):
            import copy
            return copy.copy(v)
        return v


# ═══════════════════════════════════════ matplotlib ═══════════════════════════════════════

def emitir_figura(fig) -> None:
    """Manda una figura de matplotlib como imagen PNG (evento img). Lo usa el backend pg_mpl."""
    _E.imagenes += 1
    if _E.imagenes > 12:
        if _E.imagenes == 13:
            emit({'t': 'img', 'mime': 'image/png', 'skipped': True})   # el servidor avisa de que hay más
        return
    import base64
    import io
    buf = io.BytesIO()
    try:
        fig.savefig(buf, format='png', dpi=100)
    except Exception as e:
        emit({'t': 'note', 'text': f'No se pudo dibujar la gráfica: {type(e).__name__}: {_mensaje(e)}'})
        return
    titulo = ''
    try:
        sup = fig.get_suptitle() if hasattr(fig, 'get_suptitle') else ''
        titulo = sup or next((ax.get_title() for ax in fig.get_axes() if ax.get_title()), '')
    except Exception:
        pass
    emit({'t': 'img', 'mime': 'image/png', 'data': base64.b64encode(buf.getvalue()).decode('ascii'), 'title': titulo})


def _vaciar_figuras() -> None:
    """Al terminar: las figuras que quedaron abiertas sin plt.show() también se muestran."""
    if 'matplotlib.pyplot' not in sys.modules:
        return
    try:
        import pg_mpl
        pg_mpl.vaciar(solo_pendientes=True)
    except Exception:
        pass


# ═══════════════════════════════════════ ejecución ═══════════════════════════════════════

def _emitir_fin() -> None:
    actual, pico = _pico()
    emit({'t': 'end', 'ms': round((time.perf_counter_ns() - _E.t0) / 1e6, 2), 'mem': actual, 'peak': pico})


def _instalar_api() -> None:
    for nombre, valor in (('pendiente', pendiente), ('grupo', grupo), ('prueba', prueba), ('comprueba', comprueba),
                          ('lanza', lanza), ('medir', medir), ('PorHacer', PorHacer)):
        setattr(builtins, nombre, valor)


def _ejecutar_usuario(ruta: str) -> int:
    """Compila y ejecuta el archivo del usuario como __main__. Devuelve el código de salida."""
    with open(ruta, 'rb') as f:
        fuente = f.read().decode('utf-8-sig', 'replace')
    _E.lineas = fuente.split('\n')
    try:
        codigo = compile(fuente, ruta, 'exec', dont_inherit=True)
    except (SyntaxError, ValueError) as e:
        if isinstance(e, SyntaxError):
            emit(_evento_sintaxis(e))
        else:
            emit({'t': 'err', 'kind': 'parse', 'cls': 'SyntaxError', 'msg': str(e), 'line': 1, 'file': _E.nombre})
        return 255

    modulo = types.ModuleType('__main__')
    modulo.__file__ = ruta
    modulo.__builtins__ = builtins
    modulo.__cached__ = None
    sys.modules['__main__'] = modulo
    _E.globales = modulo.__dict__
    sys.argv = [ruta]

    vigia = threading.Thread(target=_vigia, name='pg-vigia', daemon=True)
    vigia.start()
    try:
        exec(codigo, modulo.__dict__)
        return 0
    except PorHacer as e:
        marcos = _marcos(e.__traceback__)
        emit({'t': 'todo', 'msg': _mensaje(e), 'line': _donde(marcos)['line'], 'trace': _traza(marcos)})
        return 0
    except SystemExit as e:
        if e.code is None or isinstance(e.code, int):
            return int(e.code or 0)
        print(e.code)
        return 1
    except KeyboardInterrupt as e:
        if _E.tiempo_agotado:
            emit(_evento_timeout(_linea_de(e)))
        else:
            emit(_evento_excepcion(e))
        return 255
    except RecursionError as e:
        emit(_evento_excepcion(e, 'stack'))
        return 255
    except MemoryError as e:
        emit(_evento_excepcion(e, 'memory'))
        return 255
    except BaseException as e:
        emit(_evento_excepcion(e))
        return 255


def _main() -> int:
    if len(sys.argv) < 2:
        print('Uso: python pg_harness.py archivo.py')
        return 2
    ruta = os.path.abspath(sys.argv[1])
    _E.ruta = ruta
    _E.nombre = os.path.basename(ruta)

    # El backend de matplotlib (pg_mpl) vive junto a este archivo: al final de sys.path, para que no tape nada.
    sys.path.append(_AQUI)
    # pg_mpl importa este módulo por su nombre: que encuentre este mismo (y no lo vuelva a cargar del disco)
    sys.modules['pg_harness'] = sys.modules[__name__]
    _instalar_api()

    import signal
    try:
        signal.signal(signal.SIGINT, signal.default_int_handler)   # para que el vigía pueda interrumpir
    except (ValueError, OSError):
        pass
    import warnings
    warnings.simplefilter('default')
    warnings.showwarning = _mostrar_warning
    threading.excepthook = _hook_hilos

    codigo = _ejecutar_usuario(ruta)
    _E.terminado = True
    _vaciar_figuras()
    _emitir_fin()
    try:
        sys.stdout.flush()
    except Exception:
        pass
    return codigo


if __name__ == '__main__':
    sys.exit(_main())
