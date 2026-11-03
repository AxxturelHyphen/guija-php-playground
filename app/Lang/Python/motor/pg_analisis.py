"""
Análisis estático de Python para el playground. NUNCA ejecuta el código del usuario: solo lo parsea con `ast`.

Modos (entrada JSON por stdin: {"codigo": "..."}; salida JSON por stdout):
  analyse  -> {syntax, error, diagnostics, units, summary}   (mismas formas que app/Lang/Php/Analysis/Metrics.php)
  decls    -> {clave: {key, name, kind, line, endLine, start, end (bytes UTF-8), doc, norm}}
  syntax   -> {error: evento 'err' de kind 'parse' | null}
  catalog  -> {python, functions, classes, keywords}

  --servidor RUTA_JSON  analizador residente: escucha en 127.0.0.1 (puerto aleatorio), escribe {port, token, pid} en
                        RUTA_JSON y contesta una línea JSON por petición (con token). Se cierra tras 30 min sin uso.

Posiciones: líneas 1-based y columnas 1-based en UTF-16 (como Monaco). `col_offset` de `ast` cuenta bytes UTF-8,
así que se convierte. endCol 1000 significa «hasta el final de la línea».
"""
from __future__ import annotations

import ast
import builtins
import hashlib
import inspect
import json
import os
import re
import sys
import time
import warnings

warnings.simplefilter('ignore')          # el SyntaxWarning de compile() no debe ensuciar la salida
sys.setrecursionlimit(4000)

AQUI = os.path.dirname(os.path.abspath(__file__))
DATOS = os.path.join(AQUI, '..', 'data', 'catalogo.json')
INACTIVIDAD_S = 30 * 60


def u16(s: str) -> int:
    """Longitud en unidades UTF-16 (un emoji ocupa 2), que es como cuenta Monaco las columnas."""
    return len(s) + sum(1 for c in s if ord(c) > 0xFFFF)


# ───────────────────────────── posiciones ─────────────────────────────

class Fuente:
    def __init__(self, codigo: str):
        self.codigo = codigo
        self.lineas = codigo.split('\n')
        self._c: dict = {}
        self.inicio: list[int] = []         # offset en bytes de cada línea
        off = 0
        for l in self.lineas:
            self.inicio.append(off)
            off += len(l.encode('utf-8', 'surrogatepass')) + 1

    def col(self, ln: int, bcol: int) -> int:
        """Columna 1-based UTF-16 a partir de un offset en bytes dentro de la línea."""
        c = self._c.get(ln)
        if c is None:
            t = self.lineas[ln - 1] if 1 <= ln <= len(self.lineas) else ''
            b = t.encode('utf-8', 'surrogatepass')
            c = self._c[ln] = (b, len(b) == len(t))
        b, ascii_ = c
        return bcol + 1 if ascii_ else u16(b[:bcol].decode('utf-8', 'ignore')) + 1

    def rng(self, n) -> tuple:
        return (n.lineno, self.col(n.lineno, n.col_offset), n.end_lineno, self.col(n.end_lineno, n.end_col_offset))

    def texto(self, n) -> str:
        """Texto fuente de un nodo."""
        if n.lineno == n.end_lineno:
            return self.lineas[n.lineno - 1].encode('utf-8', 'surrogatepass')[n.col_offset:n.end_col_offset].decode('utf-8', 'replace')
        partes = [self.lineas[n.lineno - 1].encode('utf-8', 'surrogatepass')[n.col_offset:].decode('utf-8', 'replace')]
        partes += self.lineas[n.lineno:n.end_lineno - 1]
        partes.append(self.lineas[n.end_lineno - 1].encode('utf-8', 'surrogatepass')[:n.end_col_offset].decode('utf-8', 'replace'))
        return '\n'.join(partes)

    def rango_nombre(self, fn) -> tuple:
        """Rango del identificador en `def nombre` / `class Nombre`."""
        t = self.lineas[fn.lineno - 1]
        m = re.search(r'\b(?:def|class)\s+(\w+)', t)
        if not m:
            return self.rng(fn)
        return (fn.lineno, u16(t[:m.start(1)]) + 1, fn.lineno, u16(t[:m.end(1)]) + 1)

    def linea_codigo(self, ln: int) -> bool:
        t = self.lineas[ln - 1].strip() if 1 <= ln <= len(self.lineas) else ''
        return t != '' and not t.startswith('#')

    def loc(self, a: int, b: int) -> int:
        return sum(1 for i in range(a, b + 1) if self.linea_codigo(i))


def error_sintaxis(codigo: str, fuente: Fuente):
    """Parsea; devuelve (árbol, None) o (None, evento err 'parse')."""
    try:
        return ast.parse(codigo, 'tu_codigo.py'), None
    except SyntaxError as e:
        linea = e.lineno or 1
        texto = fuente.lineas[linea - 1] if 1 <= linea <= len(fuente.lineas) else ''
        col = max(1, e.offset or 1)
        col16 = u16(texto[:col - 1]) + 1
        fin_linea = e.end_lineno or linea
        fin = e.end_offset if e.end_offset and e.end_offset > 0 else 0
        if (fin_linea, fin) <= (linea, col):
            fin_linea, fin16 = linea, col16 + 1
        else:
            t_fin = fuente.lineas[fin_linea - 1] if 1 <= fin_linea <= len(fuente.lineas) else ''
            fin16 = u16(t_fin[:fin - 1]) + 1
        return None, {'t': 'err', 'kind': 'parse', 'cls': type(e).__name__, 'msg': e.msg or str(e), 'line': linea,
                      'col': col16, 'endLine': fin_linea, 'endCol': fin16}
    except (ValueError, RecursionError, MemoryError) as e:
        return None, {'t': 'err', 'kind': 'parse', 'cls': 'SyntaxError', 'msg': str(e) or 'Código no válido', 'line': 1, 'col': 1, 'endLine': 1, 'endCol': 2}


# ───────────────────────────── utilidades de árbol ─────────────────────────────

DEFS = (ast.FunctionDef, ast.AsyncFunctionDef)
BUCLES = (ast.For, ast.AsyncFor, ast.While)
COMPRENSIONES = (ast.ListComp, ast.SetComp, ast.GeneratorExp, ast.DictComp)


def sin_defs(nodos):
    """Recorre un conjunto de nodos sin entrar en funciones ni clases anidadas (aunque sí las devuelve)."""
    pila = list(reversed(nodos)) if isinstance(nodos, list) else [nodos]
    while pila:
        n = pila.pop()
        yield n
        if isinstance(n, DEFS + (ast.ClassDef,)):
            continue
        pila.extend(reversed(list(ast.iter_child_nodes(n))))


def es_elif(fuente: Fuente, n: ast.If) -> bool:
    return fuente.lineas[n.lineno - 1].encode('utf-8', 'surrogatepass')[n.col_offset:n.col_offset + 4] == b'elif'


def nombres(n) -> set:
    return {x.id for x in ast.walk(n) if isinstance(x, ast.Name)}


def docstring_stmt(body):
    return bool(body) and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str)


def es_esqueleto(fn) -> bool:
    """Función sin hacer: solo docstring, pass, ..., pendiente() o raise NotImplementedError."""
    for s in fn.body:
        if isinstance(s, ast.Pass):
            continue
        if isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant):
            continue
        if isinstance(s, ast.Expr) and isinstance(s.value, ast.Call) and isinstance(s.value.func, ast.Name) and s.value.func.id == 'pendiente':
            continue
        if isinstance(s, ast.Raise) and 'NotImplementedError' in ast.dump(s):
            continue
        return False
    return True


# ───────────────────────────── métricas: ciclomática, cognitiva, anidamiento ─────────────────────────────

class Medidor:
    """Una sola pasada: ciclomática (McCabe), cognitiva (Sonar), anidamiento máximo y nº de returns."""

    def __init__(self, fuente: Fuente):
        self.f = fuente
        self.cc = 1
        self.cog = 0
        self.nmax = 0
        self.returns = 0

    def lista(self, stmts, nest):
        self.nmax = max(self.nmax, nest)
        for s in stmts:
            self.m(s, nest)

    def m(self, n, nest, pb=None):
        t = type(n)
        if t in DEFS or t is ast.ClassDef:
            return                                   # son otra unidad
        if t is ast.If:
            self.cc += 1
            self.cog += 1 + nest
            self.m(n.test, nest)
            self.lista(n.body, nest + 1)
            o = n.orelse
            while o:
                if len(o) == 1 and isinstance(o[0], ast.If) and es_elif(self.f, o[0]):
                    e = o[0]
                    self.cc += 1
                    self.cog += 1                    # elif: +1 sin penalizar anidamiento
                    self.m(e.test, nest)
                    self.lista(e.body, nest + 1)
                    o = e.orelse
                else:
                    self.cog += 1                    # else
                    self.lista(o, nest + 1)
                    break
        elif t in BUCLES:
            self.cc += 1
            self.cog += 1 + nest
            for c in ([n.iter] if t is not ast.While else [n.test]):
                self.m(c, nest)
            self.lista(n.body, nest + 1)
            self.lista(n.orelse, nest + 1)
        elif t is ast.Try or t.__name__ == 'TryStar':
            self.lista(n.body, nest)
            for h in n.handlers:
                self.cc += 1
                self.cog += 1 + nest
                if h.type is not None:
                    self.m(h.type, nest)
                self.lista(h.body, nest + 1)
            self.lista(n.orelse, nest)
            self.lista(n.finalbody, nest)
        elif t is ast.Match:
            self.cog += 1 + nest
            self.m(n.subject, nest)
            for c in n.cases:
                comodin = isinstance(c.pattern, ast.MatchAs) and c.pattern.pattern is None and c.pattern.name is None and c.guard is None
                if not comodin:
                    self.cc += 1
                if c.guard is not None:
                    self.m(c.guard, nest)
                self.lista(c.body, nest + 1)
        elif t is ast.IfExp:
            self.cc += 1
            self.cog += 1 + nest
            self.m(n.test, nest)
            self.m(n.body, nest + 1)
            self.m(n.orelse, nest + 1)
        elif t is ast.BoolOp:
            self.cc += len(n.values) - 1
            if not (pb is not None and type(pb) is type(n.op)):
                self.cog += 1                        # una secuencia de operadores iguales cuenta una vez
            for v in n.values:
                self.m(v, nest, n.op)
        elif t in COMPRENSIONES:
            for g in n.generators:
                self.cc += 1 + len(g.ifs)
            for c in ast.iter_child_nodes(n):
                self.m(c, nest)
        elif t is ast.Lambda:
            self.m(n.body, nest + 1)
        else:
            if t is ast.Return:
                self.returns += 1
            for c in ast.iter_child_nodes(n):
                self.m(c, nest)


# ───────────────────────────── tipos conocidos de variables ─────────────────────────────

KIND_ANOT = {'list': 'list', 'List': 'list', 'Sequence': 'list', 'MutableSequence': 'list', 'set': 'set', 'Set': 'set',
             'frozenset': 'set', 'FrozenSet': 'set', 'MutableSet': 'set', 'AbstractSet': 'set', 'dict': 'dict', 'Dict': 'dict',
             'Mapping': 'dict', 'MutableMapping': 'dict', 'defaultdict': 'dict', 'Counter': 'dict', 'OrderedDict': 'dict',
             'str': 'str', 'tuple': 'tuple', 'Tuple': 'tuple', 'deque': 'deque', 'Deque': 'deque'}
KIND_LLAMADA = {'list': 'list', 'sorted': 'list', 'set': 'set', 'frozenset': 'set', 'dict': 'dict', 'defaultdict': 'dict',
                'Counter': 'dict', 'OrderedDict': 'dict', 'deque': 'deque', 'tuple': 'tuple', 'str': 'str', 'range': 'range'}
KIND_METODO_LISTA = {'split', 'splitlines', 'readlines'}
KIND_METODO_STR = {'join', 'strip', 'lstrip', 'rstrip', 'lower', 'upper', 'format', 'replace', 'title', 'capitalize'}
LINEAL = ('list', 'tuple', 'str')              # buscar con `in` recorre todo


def kind_anot(a):
    if a is None:
        return None
    if isinstance(a, ast.Constant) and isinstance(a.value, str):
        m = re.match(r'\s*(?:\w+\.)*(\w+)', a.value)
        return KIND_ANOT.get(m.group(1)) if m else None
    if isinstance(a, ast.Subscript):
        a = a.value
    nombre = a.id if isinstance(a, ast.Name) else a.attr if isinstance(a, ast.Attribute) else None
    return KIND_ANOT.get(nombre)


def kind_expr(e, kinds):
    if isinstance(e, (ast.List, ast.ListComp)):
        return 'list'
    if isinstance(e, (ast.Dict, ast.DictComp)):
        return 'dict'
    if isinstance(e, (ast.Set, ast.SetComp)):
        return 'set'
    if isinstance(e, ast.Tuple):
        return 'cte' if all(isinstance(x, ast.Constant) for x in e.elts) else 'tuple'
    if isinstance(e, ast.JoinedStr):
        return 'str'
    if isinstance(e, ast.Constant):
        return 'cte' if isinstance(e.value, str) else None
    if isinstance(e, ast.Call):
        f = e.func
        nombre = f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else None
        if isinstance(f, ast.Attribute):
            if nombre in KIND_METODO_LISTA:
                return 'list'
            if nombre in KIND_METODO_STR:
                return 'str'
            if nombre == 'copy':
                return kind_expr(f.value, kinds)
        return KIND_LLAMADA.get(nombre)
    if isinstance(e, ast.Name):
        return kinds.get(e.id)
    if isinstance(e, ast.BinOp) and isinstance(e.op, ast.Add):
        a, b = kind_expr(e.left, kinds), kind_expr(e.right, kinds)
        return 'list' if 'list' in (a, b) else None
    if isinstance(e, ast.Subscript) and isinstance(e.slice, ast.Slice):
        return kind_expr(e.value, kinds)
    return None


def construir_kinds(fn, base: dict) -> dict:
    """Tipo conocido de cada variable local: solo si todas sus asignaciones coinciden."""
    kinds = dict(base)
    for _ in range(2):
        vistos: dict = {}

        def anota(nom, k):
            vistos.setdefault(nom, set()).add(k)
        a = fn.args
        for p in a.posonlyargs + a.args + a.kwonlyargs + ([a.vararg] if a.vararg else []) + ([a.kwarg] if a.kwarg else []):
            anota(p.arg, kind_anot(p.annotation))
        for n in sin_defs(fn.body):
            if isinstance(n, ast.Assign):
                k = kind_expr(n.value, kinds)
                for t in n.targets:
                    if isinstance(t, ast.Name):
                        anota(t.id, k)
                    else:
                        for x in ast.walk(t):
                            if isinstance(x, ast.Name):
                                anota(x.id, None)
            elif isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name):
                anota(n.target.id, kind_anot(n.annotation) or (kind_expr(n.value, kinds) if n.value else None))
            elif isinstance(n, (ast.For, ast.AsyncFor, ast.comprehension)):
                for x in ast.walk(n.target):
                    if isinstance(x, ast.Name):
                        anota(x.id, None)
            elif isinstance(n, ast.withitem) and n.optional_vars is not None:
                for x in ast.walk(n.optional_vars):
                    if isinstance(x, ast.Name):
                        anota(x.id, None)
            elif isinstance(n, ast.NamedExpr):
                anota(n.target.id, None)
            elif isinstance(n, ast.ExceptHandler) and n.name:
                anota(n.name, None)
            elif isinstance(n, (ast.Import, ast.ImportFrom)):
                for al in n.names:
                    anota((al.asname or al.name).split('.')[0], None)
            elif isinstance(n, DEFS + (ast.ClassDef,)) and n is not fn:
                anota(n.name, None)
        for nom, ks in vistos.items():
            if len(ks) == 1 and None not in ks:
                kinds[nom] = next(iter(ks))
            else:
                kinds.pop(nom, None)
    return kinds


# ───────────────────────────── coste O() ─────────────────────────────

SUP = {2: '²', 3: '³', 4: '⁴', 5: '⁵'}
MEMO_NOMBRES = {'memo', 'cache', 'dp', 'visitados', 'visitado', 'visited', 'seen', 'memoria', 'tabla', 'memoizado'}
DECO_MEMO = {'cache', 'lru_cache'}
# Coste de funciones conocidas, por nombre: (grado de n, grado de log n)
COSTE_NOMBRE = {
    'sorted': (1, 1), 'heappush': (0, 1), 'heappop': (0, 1), 'heappushpop': (0, 1), 'heapreplace': (0, 1), 'heapify': (1, 0),
    'nlargest': (1, 1), 'nsmallest': (1, 1), 'bisect': (0, 1), 'bisect_left': (0, 1), 'bisect_right': (0, 1),
    'insort': (1, 0), 'insort_left': (1, 0), 'insort_right': (1, 0), 'deepcopy': (1, 0), 'reduce': (1, 0),
}
COSTE_UNICO = {'sum', 'min', 'max', 'any', 'all'}                # O(n) con un solo iterable
COSTE_COPIA = {'list', 'set', 'tuple', 'frozenset', 'dict', 'Counter'}
MODULOS_COSTE = {'heapq', 'bisect', 'copy', 'functools', 'random'}


def etiqueta(a: int, b: int, exp) -> str:
    if exp == '2^n':
        return 'O(2ⁿ)'
    if exp == 'n!':
        return 'O(2ⁿ) o O(n!)'
    if a == 0 and b == 0:
        return 'O(1)'
    poly = '' if a == 0 else 'n' if a == 1 else 'n' + SUP.get(a, '^' + str(a))
    log = '' if b == 0 else 'log n' if b == 1 else 'log' + SUP.get(b, '^' + str(b)) + ' n'
    return 'O(' + (poly + (' ' if poly and log else '') + log).strip() + ')'


def clave(a: int, b: int, exp) -> str:
    if exp:
        return 'exp'
    if a == 0 and b == 0:
        return '1'
    if a == 0:
        return 'log'
    if a == 1 and b == 0:
        return 'n'
    if a == 1:
        return 'nlogn'
    return 'n2' if a == 2 else 'n3'


def const_num(n):
    return n.value if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)) and not isinstance(n.value, bool) else None


class Coste:
    """Estima O() de una función recorriendo su cuerpo: profundidad de bucles + coste de las llamadas + recursión."""

    def __init__(self, fuente, fn, unit, kinds, callee, funcs_usuario, clases):
        self.f = fuente
        self.fn = fn
        self.u = unit
        self.kinds = kinds
        self.callee = callee
        self.funcs = funcs_usuario
        self.clases = clases
        self.ev: list = []            # (da, db, la, lb, razon, tipo)
        self.sitios: list = []        # lugares para las pistas de rendimiento
        self.auto: list = []          # llamadas a sí misma: (call, da, db)
        self.dependiente = False      # ¿llama a otras funciones del usuario? (entonces su coste depende de las demás)

    # ── bucles ──
    def iter_constante(self, it) -> bool:
        if isinstance(it, ast.Constant):
            return True
        if isinstance(it, (ast.Tuple, ast.List, ast.Set)):
            return all(isinstance(x, ast.Constant) for x in it.elts)
        if isinstance(it, ast.Call) and isinstance(it.func, ast.Name):
            if it.func.id == 'range':
                return all(isinstance(a, ast.Constant) for a in it.args)
            if it.func.id in ('enumerate', 'reversed', 'sorted', 'list', 'zip') and it.args:
                return all(self.iter_constante(a) for a in it.args)
        return False

    def peso_iter(self, it):
        return (0, 0) if self.iter_constante(it) else (1, 0)

    def peso_while(self, w: ast.While):
        """(0,1) si el bucle divide o duplica una variable de su condición en cada vuelta (log n); si no (1,0)."""
        N = nombres(w.test)
        if not N:
            return (1, 0)
        mids = set()
        asigs = []
        for n in sin_defs(w.body):
            if isinstance(n, ast.AugAssign) and isinstance(n.target, ast.Name):
                v = const_num(n.value)
                if n.target.id in N and v is not None and v >= 2 and isinstance(n.op, (ast.FloorDiv, ast.Div, ast.RShift, ast.Mult, ast.LShift)):
                    return (0, 1)
                if n.target.id in N and isinstance(n.op, (ast.RShift, ast.LShift)):
                    return (0, 1)
            elif isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
                asigs.append(n)
        for a in asigs:
            t = a.targets[0].id
            for x in ast.walk(a.value):
                if isinstance(x, ast.BinOp):
                    v = const_num(x.right)
                    if isinstance(x.op, (ast.FloorDiv, ast.Div, ast.RShift)) and (v is None or v >= 2) or (isinstance(x.op, ast.Mult) and v is not None and v >= 2):
                        if t in N and isinstance(x.left, ast.Name) and x.left.id == t:
                            return (0, 1)                   # n = n // 2 · i = i * 2
                        if isinstance(x.op, (ast.FloorDiv, ast.Div, ast.RShift)) and v == 2 and (nombres(x) & N) and t not in N:
                            mids.add(t)                      # mid = (lo + hi) // 2
        if mids:
            for a in asigs:
                if a.targets[0].id in N and (nombres(a.value) & mids):
                    return (0, 1)                           # lo = mid + 1 · hi = mid - 1
        return (1, 0)

    # ── recorrido ──
    def registra(self, da, db, la, lb, razon, tipo=''):
        self.ev.append((da, db, la, lb, razon, tipo))

    def w(self, n, da, db):
        t = type(n)
        if t in DEFS or t is ast.ClassDef:
            return
        if t in (ast.For, ast.AsyncFor):
            p = self.peso_iter(n.iter)
            self.w(n.iter, da, db)
            nd = (da + p[0], db + p[1])
            self.registra(nd[0], nd[1], 0, 0, None, 'bucle' if p != (0, 0) else '')
            for s in n.body + n.orelse:
                self.w(s, *nd)
            return
        if t is ast.While:
            p = self.peso_while(n)
            nd = (da + p[0], db + p[1])
            self.registra(nd[0], nd[1], 0, 0, None, 'bucle')
            self.w(n.test, *nd)
            for s in n.body + n.orelse:
                self.w(s, *nd)
            return
        if t in COMPRENSIONES:
            d = (da, db)
            for g in n.generators:
                self.w(g.iter, *d)
                p = self.peso_iter(g.iter)
                d = (d[0] + p[0], d[1] + p[1])
                self.registra(d[0], d[1], 0, 0, None, 'bucle' if p != (0, 0) else '')
                for c in g.ifs:
                    self.w(c, *d)
            for e in ([n.key, n.value] if t is ast.DictComp else [n.elt]):
                self.w(e, *d)
            return
        if t is ast.Call:
            self.llamada(n, da, db)
        elif t is ast.Compare:
            for op, comp in zip(n.ops, n.comparators):
                if isinstance(op, (ast.In, ast.NotIn)) and not isinstance(comp, (ast.List, ast.Tuple, ast.Set, ast.Dict, ast.Constant)):
                    if kind_expr(comp, self.kinds) in LINEAL:
                        txt = self.f.texto(comp)
                        self.registra(da, db, 1, 0, f'`in` sobre la lista `{txt}` la recorre entera (O(n)); un set o un dict buscan en O(1)', 'in')
                        self.sitios.append({'t': 'in', 'node': n, 'comp': comp, 'loop': (da, db)})
        elif t is ast.BinOp and isinstance(n.op, ast.Add):
            if isinstance(n.left, (ast.List, ast.ListComp)) or isinstance(n.right, (ast.List, ast.ListComp)) or \
                    (kind_expr(n.left, self.kinds) == 'list' and kind_expr(n.right, self.kinds) == 'list'):
                self.registra(da, db, 1, 0, 'concatenar listas con `+` crea una lista nueva (O(n))', 'concat')
        elif t is ast.Subscript and isinstance(n.slice, ast.Slice) and isinstance(n.ctx, ast.Load):
            if not self.rebanada_pequena(n.slice):
                self.registra(da, db, 1, 0, 'una rebanada (slicing) copia los elementos (O(n))', 'slice')
        elif t is ast.Assign and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and isinstance(n.value, ast.BinOp) \
                and isinstance(n.value.op, ast.Add) and isinstance(n.value.left, ast.Name) and n.value.left.id == n.targets[0].id \
                and isinstance(n.value.right, ast.List) and (da or db):
            self.sitios.append({'t': 'concat', 'node': n, 'loop': (da, db)})
        for c in ast.iter_child_nodes(n):
            self.w(c, da, db)

    @staticmethod
    def rebanada_pequena(s: ast.Slice) -> bool:
        lo, up = s.lower, s.upper
        if s.step is not None and not (isinstance(s.step, ast.UnaryOp) or isinstance(s.step, ast.Constant)):
            return False
        if isinstance(lo, ast.Constant) and isinstance(up, ast.Constant):
            return True
        if lo is None and isinstance(up, ast.Constant):
            return True
        if lo is not None and isinstance(up, ast.BinOp) and isinstance(up.op, ast.Add) and isinstance(up.right, ast.Constant) \
                and ast.dump(up.left) == ast.dump(lo):
            return True                      # s[i:i+3]: ventana de tamaño fijo
        return False

    def llamada(self, c: ast.Call, da, db):
        f = c.func
        loop = (da, db)
        if isinstance(f, ast.Name):
            nombre = f.id
            if nombre == self.fn.name and self.u['kind'] == 'function':
                self.auto.append((c, da, db))
                return
            if nombre in self.funcs:
                return self.coste_usuario(nombre, nombre + '()', da, db)
            if nombre in self.clases:
                return self.coste_usuario(nombre + '.__init__', nombre + '()', da, db)
            if nombre == 'sorted':
                self.registra(da, db, 1, 1, '`sorted` ordena: O(n log n)', 'sort')
                self.sitios.append({'t': 'sort', 'node': c, 'loop': loop})
            elif nombre in COSTE_UNICO and len(c.args) == 1 and not isinstance(c.args[0], ast.Starred):
                self.registra(da, db, 1, 0, f'`{nombre}` recorre todo el iterable (O(n))', 'builtin')
            elif nombre in COSTE_COPIA and c.args:
                self.registra(da, db, 1, 0, f'`{nombre}(...)` copia o recorre todos los elementos (O(n))', 'builtin')
            elif nombre in COSTE_NOMBRE:
                a, b = COSTE_NOMBRE[nombre]
                self.registra(da, db, a, b, f'`{nombre}` cuesta {etiqueta(a, b, None)}', 'builtin')
            return
        if not isinstance(f, ast.Attribute):
            return
        nombre, recv = f.attr, f.value
        if isinstance(recv, ast.Name):
            if recv.id in ('self', 'cls') and self.u.get('class'):
                clave_m = self.u['class'] + '.' + nombre
                if nombre == self.fn.name and self.u['kind'] == 'method':
                    self.auto.append((c, da, db))
                    return
                if clave_m in self.funcs:
                    return self.coste_usuario(clave_m, f'{recv.id}.{nombre}()', da, db)
            elif recv.id in self.clases and (recv.id + '.' + nombre) in self.funcs:
                if recv.id == self.u.get('class') and nombre == self.fn.name:
                    self.auto.append((c, da, db))
                    return
                return self.coste_usuario(recv.id + '.' + nombre, f'{recv.id}.{nombre}()', da, db)
            elif recv.id in MODULOS_COSTE and nombre in COSTE_NOMBRE:
                a, b = COSTE_NOMBRE[nombre]
                self.registra(da, db, a, b, f'`{recv.id}.{nombre}` cuesta {etiqueta(a, b, None)}', 'builtin')
                return
            elif recv.id == 'random' and nombre in ('shuffle', 'sample'):
                self.registra(da, db, 1, 0, f'`random.{nombre}` recorre la secuencia (O(n))', 'builtin')
                return
        k = kind_expr(recv, self.kinds)
        txt = self.f.texto(recv) if recv.end_lineno == recv.lineno else '…'
        if nombre == 'sort' and k not in ('set', 'dict'):
            self.registra(da, db, 1, 1, f'`{txt}.sort()` ordena: O(n log n)', 'sort')
            self.sitios.append({'t': 'sort', 'node': c, 'loop': loop})
        elif nombre in ('index', 'count', 'remove') and k not in ('set', 'dict', 'cte'):
            self.registra(da, db, 1, 0, f'`{txt}.{nombre}()` recorre la lista (O(n))', 'metodo')
        elif nombre == 'insert' and k not in ('set', 'dict'):
            self.registra(da, db, 1, 0, f'`{txt}.insert()` desplaza los elementos (O(n))', 'metodo')
            if c.args and const_num(c.args[0]) == 0:
                self.sitios.append({'t': 'insert0', 'node': c, 'loop': loop, 'deque': k == 'deque'})
        elif nombre == 'pop' and c.args and const_num(c.args[0]) == 0 and k not in ('dict', 'set'):
            self.registra(da, db, 1, 0, f'`{txt}.pop(0)` desplaza todos los elementos (O(n))', 'metodo')
            self.sitios.append({'t': 'pop0', 'node': c, 'loop': loop, 'deque': k == 'deque'})
        elif nombre in ('reverse', 'copy') and k in ('list', 'dict', 'set'):
            self.registra(da, db, 1, 0, f'`{txt}.{nombre}()` recorre los elementos (O(n))', 'metodo')
        elif nombre == 'join' and isinstance(recv, ast.Constant):
            self.registra(da, db, 1, 0, '`join` recorre todas las piezas (O(n))', 'metodo')
        elif nombre == 'extend':
            pass

    def coste_usuario(self, clave_f, mostrar, da, db):
        self.dependiente = True
        k = self.callee.get(clave_f)
        if k and not k[2] and (k[0] or k[1]):
            self.registra(da, db, k[0], k[1], f'llama a {mostrar} que cuesta {etiqueta(k[0], k[1], None)}' + (' dentro de un bucle' if da or db else ''), 'usuario')

    # ── recursión ──
    def contar_autollamadas(self, nodos) -> int:
        """Máximo de llamadas a sí misma en un mismo camino de ejecución: las ramas if/else y los `if ...: return` no se suman."""
        total = 0
        lista = nodos if isinstance(nodos, list) else [nodos]
        for i, s in enumerate(lista):
            if isinstance(s, DEFS + (ast.ClassDef,)):
                continue
            if isinstance(s, ast.If) and s.body and isinstance(s.body[-1], (ast.Return, ast.Raise)):
                resto = lista[i + 1:] if not s.orelse else s.orelse + lista[i + 1:]
                return total + self.contar_autollamadas(s.test) + max(self.contar_autollamadas(s.body), self.contar_autollamadas(resto))
            if isinstance(s, (ast.If, ast.IfExp)):
                total += self.contar_autollamadas(s.test) + max(self.contar_autollamadas(s.body), self.contar_autollamadas(s.orelse))
                continue
            if isinstance(s, ast.Call) and any(s is c for c, _, _ in self.auto):
                total += 1
            total += sum(self.contar_autollamadas(c) for c in ast.iter_child_nodes(s))
        return total

    @staticmethod
    def forma_arg(c: ast.Call, mids: set):
        """(divide, decrementa) a partir de los argumentos de una llamada recursiva."""
        div = dec = False
        for a in list(c.args) + [k.value for k in c.keywords]:
            for x in ast.walk(a):
                if isinstance(x, ast.BinOp) and isinstance(x.op, (ast.FloorDiv, ast.Div, ast.RShift)):
                    div = True
                if isinstance(x, ast.Name) and x.id in mids:
                    div = True
                if isinstance(x, ast.BinOp) and isinstance(x.op, (ast.Sub, ast.Add)) and isinstance(x.right, ast.Constant) \
                        and isinstance(x.left, (ast.Name, ast.Attribute)):
                    dec = True
                if isinstance(x, ast.Slice):
                    if (isinstance(x.lower, ast.Constant) and x.lower.value and x.upper is None) or \
                            (isinstance(x.upper, ast.UnaryOp) and x.lower is None):
                        dec = True
        return div, dec

    def tiene_memo(self) -> bool:
        for d in self.fn.decorator_list:
            x = d.func if isinstance(d, ast.Call) else d
            nom = x.id if isinstance(x, ast.Name) else x.attr if isinstance(x, ast.Attribute) else ''
            if nom in DECO_MEMO:
                return True
        for x in ast.walk(self.fn):
            if isinstance(x, ast.Name) and x.id.lower() in MEMO_NOMBRES:
                return True
            if isinstance(x, ast.arg) and x.arg.lower() in MEMO_NOMBRES:
                return True
        return False

    def calcular(self):
        for s in self.fn.body:
            self.w(s, 0, 0)
        best = (0, 0)
        for e in self.ev:
            best = max(best, (e[0] + e[2], e[1] + e[3]))
        why = []
        maxlin = max([e[0] for e in self.ev if e[5] == 'bucle'] or [0])
        if maxlin >= 2:
            why.append(f'bucles anidados (profundidad {maxlin})')
        elif maxlin == 1:
            why.append('un bucle sobre la entrada')
        if any(e[1] > 0 and e[5] == 'bucle' for e in self.ev):
            why.append('un bucle que divide o duplica su variable en cada vuelta: crece como log n')
        for e in self.ev:
            if e[4] and (e[0] + e[2], e[1] + e[3]) == best and best != (0, 0) and (e[2] or e[3]):
                why.append(e[4] + (' dentro de un bucle' if (e[0] or e[1]) and e[5] != 'usuario' else ''))
                break
        w = best
        exp = None
        recursivo = bool(self.auto)
        if recursivo:
            c = max(1, self.contar_autollamadas(self.fn.body))
            en_bucle = any(da or db for _, da, db in self.auto)
            mids = self.puntos_medios()
            div = dec = False
            for call, _, _ in self.auto:
                d1, d2 = self.forma_arg(call, mids)
                div, dec = div or d1, dec or d2
            if self.tiene_memo():
                best = (max(1, w[0]), w[1])
                why.append('recursión con memoización o conjunto de visitados: cada subproblema se calcula una vez')
            elif en_bucle:
                if div:
                    best = (w[0] + 1, w[1])
                else:
                    exp = 'n!'
                    why.append('llamada recursiva dentro de un bucle sin memoización (backtracking): crece de forma exponencial')
            elif c == 1:
                if div:
                    best = (0, 1) if w[0] == 0 else w
                    why.append('recursión que divide el problema a la mitad en cada llamada')
                else:
                    best = (w[0] + 1, w[1])
                    why.append('recursión lineal: una llamada por nivel, n niveles')
            else:
                if dec and not div:
                    exp = '2^n'
                    why.append(f'{c} llamadas recursivas con n-1/n-2 y sin memoización: se repite trabajo (exponencial)')
                else:
                    best = (1, 0) if w[0] == 0 else (w[0], w[1] + 1)
                    why.append(f'divide y vencerás: {c} llamadas sobre trozos más pequeños')
        return {'a': best[0], 'b': best[1], 'exp': exp, 'why': why, 'recursive': recursivo}

    def puntos_medios(self) -> set:
        """Variables que valen «la mitad» de algo: mid = (lo + hi) // 2."""
        out = set()
        for n in sin_defs(self.fn.body):
            if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
                for x in ast.walk(n.value):
                    if isinstance(x, ast.BinOp) and isinstance(x.op, (ast.FloorDiv, ast.Div, ast.RShift)):
                        out.add(n.targets[0].id)
        return out


# ───────────────────────────── el analizador ─────────────────────────────

THRESH_NOTA = [(5, 'A'), (10, 'B'), (20, 'C'), (30, 'D'), (40, 'E')]
BUILTINS_SOMBRA = {'list', 'dict', 'set', 'str', 'int', 'float', 'sum', 'min', 'max', 'len', 'id', 'type', 'input', 'map', 'filter',
                   'sorted', 'range', 'bytes', 'tuple', 'all', 'any', 'abs', 'round', 'next', 'iter', 'object', 'format', 'hash',
                   'open', 'print', 'vars', 'dir', 'zip', 'enumerate', 'reversed', 'bool', 'pow', 'chr', 'ord', 'bin', 'hex', 'oct',
                   'divmod', 'repr', 'slice', 'complex', 'frozenset', 'callable', 'compile', 'eval', 'exec'}


def nota(cc: int) -> str:
    for lim, g in THRESH_NOTA:
        if cc <= lim:
            return g
    return 'F'


class Analisis:
    def __init__(self, codigo: str):
        self.codigo = codigo
        self.f = Fuente(codigo)
        self.diag: list = []

    # ── diagnósticos ──
    def add(self, codigo, sev, r, titulo, explica, fixes=None):
        self.diag.append({'source': 'analysis', 'severity': sev, 'code': codigo, 'line': r[0], 'col': r[1], 'endLine': r[2], 'endCol': r[3],
                          'title': titulo, 'message': titulo, 'explain': explica, 'fixes': fixes or []})

    def T(self, *tipos):
        out = []
        for t in tipos:
            out += self.tipo.get(t, [])
        return out

    @staticmethod
    def fix(titulo, *ediciones):
        return {'title': titulo, 'edits': [{'range': {'sl': r[0], 'sc': r[1], 'el': r[2], 'ec': r[3]}, 'text': t} for r, t in ediciones]}

    # ── unidades ──
    def recolectar(self, arbol):
        unidades = []

        def bloque(stmts, clase, prefijo, en_func):
            for s in stmts:
                if isinstance(s, DEFS):
                    qn = prefijo + s.name
                    unidades.append({'node': s, 'name': s.name, 'qname': qn, 'class': clase, 'kind': 'method' if clase and not en_func else 'function'})
                    bloque(s.body, None, qn + '.', True)
                elif isinstance(s, ast.ClassDef):
                    bloque(s.body, s.name, prefijo + s.name + '.', en_func)
                else:
                    for campo in ('body', 'orelse', 'finalbody'):
                        v = getattr(s, campo, None)
                        if isinstance(v, list) and v and isinstance(v[0], ast.stmt):
                            bloque(v, clase, prefijo, en_func)
                    for h in getattr(s, 'handlers', []) or []:
                        bloque(h.body, clase, prefijo, en_func)
                    for c in getattr(s, 'cases', []) or []:
                        bloque(c.body, clase, prefijo, en_func)
        bloque(arbol.body, None, '', False)
        return unidades

    def firma(self, fn, es_metodo):
        a = fn.args
        out = []
        pos = a.posonlyargs + a.args
        defaults = [None] * (len(pos) - len(a.defaults)) + list(a.defaults)

        def uno(p, d, pref=''):
            s = pref + p.arg
            if p.annotation is not None:
                s += ': ' + ast.unparse(p.annotation)
            if d is not None:
                s += (' = ' if p.annotation is not None else '=') + ast.unparse(d)
            return s
        for p, d in zip(pos, defaults):
            out.append(uno(p, d))
        if a.vararg:
            out.append(uno(a.vararg, None, '*'))
        elif a.kwonlyargs:
            out.append('*')
        for p, d in zip(a.kwonlyargs, a.kw_defaults):
            out.append(uno(p, d))
        if a.kwarg:
            out.append(uno(a.kwarg, None, '**'))
        if es_metodo and out and out[0].split(':')[0] in ('self', 'cls'):
            out = out[1:]
        return out

    def analizar(self):
        codigo, f = self.codigo, self.f
        arbol, err = error_sintaxis(codigo, f)
        loc = f.loc(1, len(f.lineas))
        if err is not None:
            return {'syntax': True, 'error': err, 'diagnostics': [], 'units': [], 'summary': self.resumen([], loc)}
        # Un solo recorrido del árbol: todos los nodos, agrupados por tipo y ordenados por línea (las pistas los reutilizan)
        self.todos = list(ast.walk(arbol))
        self.tipo: dict = {}
        for n in self.todos:
            self.tipo.setdefault(type(n), []).append(n)
        unidades = self.recolectar(arbol)

        # tipos de las variables del módulo (útiles dentro de las funciones)
        base = {}
        modulo = ast.Module(body=[s for s in arbol.body if not isinstance(s, DEFS + (ast.ClassDef,))], type_ignores=[])
        for s in modulo.body:
            if isinstance(s, ast.Assign):
                k = kind_expr(s.value, {})
                for t in s.targets:
                    if isinstance(t, ast.Name):
                        base[t.id] = k if t.id not in base or base[t.id] == k else None
        base = {k: v for k, v in base.items() if v}

        funcs = {}
        clases = {x.name for x in self.T(ast.ClassDef)}
        for u in unidades:
            clave_f = (u['class'] + '.' + u['name']) if u['kind'] == 'method' else u['name']
            funcs.setdefault(clave_f, u)
        filas = []
        for u in unidades:
            fn = u['node']
            m = Medidor(f)
            m.lista(fn.body, 0)
            u['kinds'] = construir_kinds(fn, base)
            filas.append(m)

        callee: dict = {}
        resultados: list = [None] * len(unidades)
        sitios: list = [[] for _ in unidades]
        for _ in range(3):
            nuevo = {}
            for i, u in enumerate(unidades):
                if sitios[i] != [] and not sitios[i].dependiente:
                    cx = resultados[i]          # no llama a funciones del usuario: su coste no cambia entre pasadas
                else:
                    c = Coste(f, u['node'], u, u['kinds'], callee, funcs, clases)
                    cx = c.calcular()
                    resultados[i] = cx
                    sitios[i] = c
                clave_f = (u['class'] + '.' + u['name']) if u['kind'] == 'method' else u['name']
                if funcs.get(clave_f) is u:
                    nuevo[clave_f] = (cx['a'], cx['b'], cx['exp'])
            callee = nuevo

        filas_u = []
        for i, u in enumerate(unidades):
            fn, m, cx = u['node'], filas[i], resultados[i]
            fin = fn.end_lineno
            cog = m.cog + (1 if cx['recursive'] else 0)
            sig = self.firma(fn, u['kind'] == 'method')
            filas_u.append({
                'name': u['name'], 'qname': u['qname'], 'kind': u['kind'], 'class': u['class'], 'startLine': fn.lineno, 'endLine': fin,
                'loc': f.loc(fn.lineno, fin), 'params': len(sig), 'signature': sig, 'cc': m.cc, 'cognitive': cog, 'nesting': m.nmax,
                'returns': m.returns, 'grade': nota(m.cc), 'bigO': etiqueta(cx['a'], cx['b'], cx['exp']), 'bigOWhy': cx['why'],
                'bigOKey': clave(cx['a'], cx['b'], cx['exp']), 'recursive': cx['recursive'],
            })
        main = self.unidad_main(arbol)
        if main:
            filas_u.append(main)
        filas_u.sort(key=lambda r: r['startLine'])

        self.pistas(arbol, unidades, filas_u[:0] + [r for r in filas_u if r['kind'] != 'main'], sitios, funcs)
        self.diag.sort(key=lambda d: (d['line'], d['col']))
        return {'syntax': False, 'error': None, 'diagnostics': self.diag, 'units': filas_u, 'summary': self.resumen(filas_u, loc)}

    def unidad_main(self, arbol):
        stmts = [s for s in arbol.body if not isinstance(s, DEFS + (ast.ClassDef, ast.Import, ast.ImportFrom))]
        if stmts and docstring_stmt(stmts[:1]) and stmts[0] is arbol.body[0]:
            stmts = stmts[1:]
        if not stmts:
            return None
        m = Medidor(self.f)
        lineas = set()
        for s in stmts:
            m.m(s, 0)
            fin = s.end_lineno
            for n in ast.walk(s):                            # no se cuentan las líneas de las funciones anidadas en el código suelto
                if isinstance(n, DEFS + (ast.ClassDef,)):
                    fin = None
            lineas.update(range(s.lineno, s.end_lineno + 1))
        lineas = {x for x in lineas if self.f.linea_codigo(x)}
        if not lineas:
            return None
        return {'name': '{main}', 'qname': '{main}', 'kind': 'main', 'class': None, 'startLine': min(lineas), 'endLine': max(lineas),
                'loc': len(lineas), 'params': 0, 'signature': [], 'cc': m.cc, 'cognitive': m.cog, 'nesting': m.nmax, 'returns': m.returns,
                'grade': nota(m.cc), 'bigO': None, 'bigOWhy': [], 'bigOKey': None, 'recursive': False}

    @staticmethod
    def resumen(units, loc):
        reales = [u for u in units if u['kind'] != 'main']
        tot = sum(u['cc'] for u in reales)
        mx, peor = 0, None
        for u in reales:
            if u['cc'] > mx:
                mx, peor = u['cc'], u['qname']
        avg = round(tot / len(reales), 1) if reales else 0.0
        return {'loc': loc, 'functions': len(reales), 'ccTotal': tot, 'ccMax': mx, 'ccAvg': avg, 'grade': nota(int(avg + 0.5)),
                'worst': peor, 'maxNesting': max([u['nesting'] for u in reales] or [0])}

    # ───────────────────────────── pistas ─────────────────────────────

    def pistas(self, arbol, unidades, filas, sitios, funcs):
        f = self.f
        self.umbrales(unidades, filas)
        for i, u in enumerate(unidades):
            self.rendimiento(u, sitios[i])
        self.recursion_sin_memo(arbol, unidades, filas)
        self.flujo(arbol)
        self.estilo(arbol, unidades)
        self.sin_usar(arbol, unidades)

    def umbrales(self, unidades, filas):
        f = self.f
        por_nombre = {r['qname']: r for r in filas}
        for u in unidades:
            r = por_nombre.get(u['qname'])
            if r is None:
                continue
            tok = f.rango_nombre(u['node'])
            nom = u['qname'] + '()'
            if r['cc'] > 20:
                self.add('cx.cyclomatic', 'warning', tok, f"{nom}: complejidad ciclomática muy alta ({r['cc']}, nota {r['grade']})",
                         'La complejidad ciclomática cuenta los caminos independientes del código (cada `if`, bucle, `except`, `and`, `or`, `case`...). Por encima de 20 es muy difícil de probar y de entender. Divide la función en funciones más pequeñas, cada una con una sola responsabilidad.')
            elif r['cc'] > 10:
                self.add('cx.cyclomatic', 'info', tok, f"{nom}: complejidad ciclomática alta ({r['cc']}, nota {r['grade']})",
                         'Más de 10 caminos independientes: ya cuesta probarla entera. Busca bloques que puedas extraer a su propia función o condiciones que simplificar con *salida temprana* (`if no_cumple: return`).')
            if r['cognitive'] > 15:
                self.add('cx.cognitive', 'warning', tok, f"{nom}: complejidad cognitiva {r['cognitive']}",
                         'La complejidad cognitiva mide lo difícil que es **leer** el código: penaliza el anidamiento. Por encima de 15 conviene reducir niveles con salidas tempranas (`if not cond: return`) y extraer funciones.')
            if r['nesting'] > 3:
                self.add('cx.nesting', 'info', tok, f"{nom}: {r['nesting']} niveles de anidamiento",
                         'Más de 3 estructuras de control dentro de otras cuesta seguir. Sal pronto con `return`/`continue` en vez de anidar `else`, o extrae el bloque interno a una función.')
            if r['loc'] > 50:
                self.add('cx.length', 'info', tok, f"{nom}: {r['loc']} líneas de código",
                         'Una función larga suele hacer varias cosas. Prueba a separarla en pasos con nombre claro.')
            if r['params'] > 5:
                self.add('cx.params', 'info', tok, f"{nom}: {r['params']} parámetros",
                         'Muchos parámetros son difíciles de recordar y de ordenar bien. Agrúpalos en una `@dataclass` o usa argumentos con nombre.')
            fn = u['node']
            a = fn.args
            todos = a.posonlyargs + a.args + a.kwonlyargs + ([a.vararg] if a.vararg else []) + ([a.kwarg] if a.kwarg else [])
            if not (u['name'].startswith('__') and u['name'].endswith('__')) and fn.returns is None and not any(p.annotation for p in todos):
                self.add('types.missing', 'hint', tok, f"{nom} no tiene anotaciones de tipo",
                         'Anotar los tipos (`def f(n: int) -> int:`) documenta la función y deja que el editor y herramientas como mypy encuentren errores antes de ejecutar. Python no los exige, pero ayudan mucho.')

    def rendimiento(self, u, c: Coste):
        f = self.f
        for s in c.sitios:
            da, db = s['loop']
            en_bucle = da > 0 or db > 0
            n = s['node']
            if s['t'] == 'in' and en_bucle:
                txt = f.texto(s['comp'])
                self.add('perf.in-array-loop', 'warning', f.rng(n), f'`in {txt}` sobre una lista dentro de un bucle: O(n²)',
                         f'Buscar con `in` en una **lista** recorre sus elementos uno a uno (O(n)); dentro de un bucle el coste total es O(n²). Un `set` (o un `dict`) usa una tabla hash y busca en O(1). Crea el conjunto una vez antes del bucle: `vistos = set({txt})` y pregunta por `x in vistos`.')
            elif s['t'] in ('pop0', 'insert0') and en_bucle and not s.get('deque'):
                nom = 'pop(0)' if s['t'] == 'pop0' else 'insert(0, ...)'
                self.add('perf.shift-loop', 'warning', f.rng(n), f'`{nom}` dentro de un bucle: O(n²)',
                         f'`{nom}` obliga a desplazar todos los elementos de la lista (O(n)). Si lo haces en un bucle el coste es O(n²). Usa `collections.deque`: `popleft()` y `appendleft()` cuestan O(1).')
            elif s['t'] == 'sort' and da > 0:
                self.add('perf.sort-loop', 'warning', f.rng(n), 'Ordenar dentro de un bucle',
                         'Ordenar cuesta O(n log n); repetirlo en cada vuelta del bucle es muy caro. Ordena una vez antes del bucle, o usa `heapq` / `bisect` si necesitas mantener el orden mientras insertas.')
            elif s['t'] == 'concat' and en_bucle:
                a = n.value.right
                x = n.targets[0].id
                fixes = []
                if len(a.elts) == 1 and not isinstance(a.elts[0], ast.Starred) and n.lineno == n.end_lineno and kind_expr(n.value.left, u['kinds']) in ('list', None):
                    fixes = [self.fix(f'Usar {x}.append(...)', (f.rng(n), f'{x}.append({f.texto(a.elts[0])})'))]
                self.add('perf.merge-loop', 'warning', f.rng(n), f'`{x} = {x} + [...]` dentro de un bucle: O(n²)',
                         f'`{x} + [...]` construye una lista **nueva** copiando todos los elementos en cada vuelta: O(n²) en total. `{x}.append(...)` añade al final en O(1) amortizado y no copia nada.', fixes)

    def punto_import(self, arbol):
        """(línea, texto) donde insertar un import nuevo: tras el docstring, los __future__ y los imports iniciales."""
        f = self.f
        ultima = 0
        for i, s in enumerate(arbol.body):
            if i == 0 and docstring_stmt([s]):
                ultima = s.end_lineno
            elif isinstance(s, (ast.Import, ast.ImportFrom)):
                ultima = s.end_lineno
            else:
                break
        return ultima + 1

    def recursion_sin_memo(self, arbol, unidades, filas):
        f = self.f
        por = {r['qname']: r for r in filas}
        importado = False
        modulo_functools = False
        otro_cache = False
        for s in self.T(ast.ImportFrom, ast.Import, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef):
            if isinstance(s, ast.ImportFrom) and s.module == 'functools' and any(a.name == 'cache' and not a.asname for a in s.names):
                importado = True
            if isinstance(s, ast.Import) and any(a.name == 'functools' and not a.asname for a in s.names):
                modulo_functools = True
            if isinstance(s, DEFS + (ast.ClassDef,)) and s.name == 'cache':
                otro_cache = True
        for u in unidades:
            r = por.get(u['qname'])
            if not r or not r['recursive'] or r['bigOKey'] != 'exp' or not any('n-1/n-2' in w for w in r['bigOWhy']):
                continue
            fn = u['node']
            a = fn.args
            malos = any(p.annotation is not None and kind_anot(p.annotation) in ('list', 'dict', 'set') for p in a.posonlyargs + a.args + a.kwonlyargs)
            fixes = []
            if not malos and not otro_cache and u['kind'] == 'function' or (not malos and not otro_cache and u['kind'] == 'method'):
                sangria = ' ' * fn.col_offset
                if importado:
                    ed = [((fn.lineno, 1, fn.lineno, 1), f'{sangria}@cache\n')]
                elif modulo_functools:
                    ed = [((fn.lineno, 1, fn.lineno, 1), f'{sangria}@functools.cache\n')]
                else:
                    ln = self.punto_import(arbol)
                    ed = [((fn.lineno, 1, fn.lineno, 1), f'{sangria}@cache\n'), ((ln, 1, ln, 1), 'from functools import cache\n')]
                fixes = [self.fix('Añadir @cache (memoización)', *ed)]
            nom = u['qname'] + '()'
            self.add('perf.recursion', 'warning', f.rango_nombre(fn), f'{nom}: recursión exponencial sin memoización',
                     'Varias llamadas recursivas sobre `n-1`, `n-2`... recalculan los mismos subproblemas una y otra vez. Con `@cache` (de `functools`) Python recuerda cada resultado: pasa de O(2ⁿ) a O(n). También puedes guardar los resultados en un diccionario `memo` o escribir una versión iterativa.', fixes)

    # ── flujo ──
    def flujo(self, arbol):
        f = self.f
        for n in self.T(ast.Module, ast.If, ast.For, ast.AsyncFor, ast.While, ast.Try, ast.With, ast.AsyncWith, ast.FunctionDef,
                        ast.AsyncFunctionDef, ast.ClassDef, ast.ExceptHandler, ast.match_case):
            for campo in ('body', 'orelse', 'finalbody'):
                v = getattr(n, campo, None)
                if not (isinstance(v, list) and v and isinstance(v[0], ast.stmt)):
                    continue
                for i, s in enumerate(v[:-1]):
                    if isinstance(s, (ast.Return, ast.Raise, ast.Continue, ast.Break)):
                        muerto = v[i + 1:]
                        ini, fin = muerto[0], muerto[-1]
                        # si hay otra sentencia en la misma línea (separadas por «;») no se ofrece arreglo
                        misma = ini.lineno == s.end_lineno
                        r = (ini.lineno, f.col(ini.lineno, ini.col_offset), fin.end_lineno, f.col(fin.end_lineno, fin.end_col_offset))
                        fixes = []
                        if not misma and fin.end_lineno < len(f.lineas) + 1:
                            sig = fin.end_lineno + 1
                            quita = (ini.lineno, 1, sig, 1) if sig <= len(f.lineas) else (ini.lineno, 1, fin.end_lineno, 1000)
                            fixes = [self.fix('Eliminar el código inalcanzable', (quita, ''))]
                        nom = {ast.Return: 'return', ast.Raise: 'raise', ast.Continue: 'continue', ast.Break: 'break'}[type(s)]
                        self.add('flow.unreachable', 'warning', r, f'Código inalcanzable después de `{nom}`',
                                 f'Después de `{nom}` el flujo sale de este bloque, así que estas líneas nunca se ejecutan. Bórralas o mueve el `{nom}` a donde corresponda.', fixes)
                        break
            if isinstance(n, ast.If) and n.orelse and n.body and isinstance(n.body[-1], (ast.Return, ast.Raise, ast.Continue, ast.Break)):
                ln = None
                for i in range(n.body[-1].end_lineno + 1, n.orelse[0].lineno + 1):
                    if i <= len(f.lineas) and re.match(r'\s*else\s*:', f.lineas[i - 1]):
                        ln = i
                if ln is not None:
                    t = f.lineas[ln - 1]
                    c0 = t.index('else')
                    self.add('flow.else-after-return', 'hint', (ln, u16(t[:c0]) + 1, ln, u16(t[:c0]) + 5), 'else innecesario después de return',
                             'Si el bloque del `if` termina en `return` (o `raise`, `continue`, `break`), el `else` sobra: lo que sigue ya solo se ejecuta cuando la condición es falsa. Quitar el `else` y bajar un nivel de sangría deja el código más plano y fácil de leer.')
            if isinstance(n, ast.ExceptHandler):
                t = f.lineas[n.lineno - 1]
                c0 = len(t.encode('utf-8', 'surrogatepass')[:n.col_offset].decode('utf-8', 'ignore'))
                r = (n.lineno, u16(t[:c0]) + 1, n.lineno, u16(t[:c0]) + 7)
                if n.type is None:
                    self.add('flow.bare-except', 'warning', r, '`except:` sin tipo captura absolutamente todo',
                             'Un `except:` desnudo atrapa también `KeyboardInterrupt` y `SystemExit`, y esconde errores de programación. Indica qué error esperas (`except ValueError:`) o, como mínimo, `except Exception:`.',
                             [self.fix('Cambiar a `except Exception:`', ((n.lineno, r[3], n.lineno, r[3]), ' Exception'))])
                if all(isinstance(s, ast.Pass) or (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant) and s.value.value is Ellipsis) for s in n.body):
                    self.add('flow.empty-catch', 'warning', r, '`except` vacío: el error se ignora en silencio',
                             'Si capturas un error y no haces nada, el programa sigue como si no hubiera pasado nada y luego es muy difícil saber por qué falla. Al menos muestra el error (`print(e)`), regístralo o vuelve a lanzarlo con `raise`.')

    # ── estilo ──
    def estilo(self, arbol, unidades):
        f = self.f
        for n in self.T(ast.Compare, ast.FunctionDef, ast.AsyncFunctionDef, ast.For):
            if isinstance(n, ast.Compare):
                izq = n.left
                for op, comp in zip(n.ops, n.comparators):
                    if isinstance(op, (ast.Eq, ast.NotEq)) and ((isinstance(comp, ast.Constant) and comp.value is None) or (isinstance(izq, ast.Constant) and izq.value is None)):
                        r = self.buscar_op(izq, comp)
                        neg = isinstance(op, ast.NotEq)
                        fixes = [self.fix('Usar `is not None`' if neg else 'Usar `is None`', (r, 'is not' if neg else 'is'))] if r else []
                        self.add('style.eq-none', 'warning', r or f.rng(n), f'Compara con `None` usando `is{" not" if neg else ""}`, no `{"!=" if neg else "=="}`',
                                 '`None` es un único objeto: se comprueba por identidad con `is None` / `is not None`. `== None` funciona casi siempre, pero una clase puede redefinir `==` y dar resultados inesperados (y numpy lo trata elemento a elemento).', fixes)
                    izq = comp
            elif isinstance(n, DEFS):
                self.defaults_mutables(n)
            elif isinstance(n, ast.For) and isinstance(n.iter, ast.Call) and isinstance(n.iter.func, ast.Name) and n.iter.func.id == 'range':
                args = n.iter.args
                ult = args[-1] if args else None
                if len(args) in (1, 2) and isinstance(ult, ast.Call) and isinstance(ult.func, ast.Name) and ult.func.id == 'len' and len(ult.args) == 1 \
                        and (len(args) == 1 or const_num(args[0]) == 0):
                    seq = f.texto(ult.args[0])
                    idx = f.texto(n.target)
                    self.add('style.range-len', 'hint', f.rng(n.iter), f'`range(len({seq}))`: mejor `enumerate`',
                             f'Para recorrer una secuencia con su índice usa `for {idx}, valor in enumerate({seq}):`; y si no necesitas el índice, `for valor in {seq}:`. Es más corto, más claro y evita errores de índices.')
        self.sombras(arbol)

    def buscar_op(self, izq, comp):
        """Rango del operador ==/!= entre dos operandos de una misma línea, o None."""
        f = self.f
        if izq.end_lineno != comp.lineno:
            return None
        b = f.lineas[izq.end_lineno - 1].encode('utf-8', 'surrogatepass')[izq.end_col_offset:comp.col_offset].decode('utf-8', 'ignore')
        m = re.search(r'==|!=', b)
        if not m:
            return None
        c0 = f.col(izq.end_lineno, izq.end_col_offset) + u16(b[:m.start()])
        return (izq.end_lineno, c0, izq.end_lineno, c0 + 2)

    def defaults_mutables(self, fn):
        f = self.f
        a = fn.args
        pos = a.posonlyargs + a.args
        pares = list(zip(pos[len(pos) - len(a.defaults):], a.defaults)) + [(p, d) for p, d in zip(a.kwonlyargs, a.kw_defaults) if d is not None]
        for p, d in pares:
            mut = isinstance(d, (ast.List, ast.Dict, ast.Set)) or (isinstance(d, ast.Call) and isinstance(d.func, ast.Name) and d.func.id in ('list', 'dict', 'set') and not d.args)
            if not mut:
                continue
            fixes = []
            if d.lineno == d.end_lineno and fn.body[0].lineno > fn.lineno and not (fn.body[0].lineno == fn.lineno):
                orig = f.texto(d)
                cuerpo = fn.body
                if docstring_stmt(cuerpo):
                    ins = cuerpo[0].end_lineno + 1
                    if len(cuerpo) == 1 and ins > len(f.lineas):
                        ins = None
                    ref = cuerpo[1] if len(cuerpo) > 1 else cuerpo[0]
                else:
                    ins = cuerpo[0].lineno
                    ref = cuerpo[0]
                # la sangría real del cuerpo, tomada de la primera línea de la primera sentencia
                lin = f.lineas[ref.lineno - 1]
                sang = lin[:len(lin) - len(lin.lstrip())]
                if ins is not None and ref.lineno > fn.lineno and ins <= len(f.lineas):
                    rd = f.rng(d)
                    texto = f'{sang}if {p.arg} is None:\n{sang}{sang[:4] if sang.startswith(" ") else sang[:1] or "    "}{p.arg} = {orig}\n'
                    if sang.startswith('\t'):
                        texto = f'{sang}if {p.arg} is None:\n{sang}\t{p.arg} = {orig}\n'
                    else:
                        texto = f'{sang}if {p.arg} is None:\n{sang}    {p.arg} = {orig}\n'
                    fixes = [self.fix(f'Usar None y crear {orig} dentro', (rd, 'None'), ((ins, 1, ins, 1), texto))]
            self.add('style.mutable-default', 'warning', f.rng(d), f'Argumento por defecto mutable en `{fn.name}()`: `{p.arg}`',
                     'El valor por defecto se crea **una sola vez**, cuando se define la función, y se comparte entre todas las llamadas: si lo modificas, los cambios se acumulan de una llamada a otra. Usa `None` como valor por defecto y crea la lista/diccionario dentro de la función.', fixes)

    def sombras(self, arbol):
        f = self.f
        vistos = set()

        def marca(nombre, nodo_rango, donde):
            if nombre in BUILTINS_SOMBRA and (nombre, donde) not in vistos:
                vistos.add((nombre, donde))
                self.add('style.shadow-builtin', 'hint', nodo_rango, f'`{nombre}` tapa a la función predefinida `{nombre}()`',
                         f'Con este nombre ya no puedes usar `{nombre}()` de Python en este ámbito, y si lo intentas aparecerán errores raros (`TypeError: ... object is not callable`). Elige otro nombre más descriptivo.')

        def ambito(nodos, donde):
            for n in sin_defs(nodos):
                if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store):
                    marca(n.id, f.rng(n), donde)
                elif isinstance(n, ast.arg):
                    marca(n.arg, f.rng(n), donde)
                elif isinstance(n, DEFS + (ast.ClassDef,)) and n is not nodos and not isinstance(nodos, list):
                    pass
        ambito(arbol.body, 'modulo')
        for fn in self.T(ast.FunctionDef, ast.AsyncFunctionDef):
            if isinstance(fn, DEFS):
                for a in fn.args.posonlyargs + fn.args.args + fn.args.kwonlyargs + ([fn.args.vararg] if fn.args.vararg else []) + ([fn.args.kwarg] if fn.args.kwarg else []):
                    marca(a.arg, f.rng(a), id(fn))
                ambito(fn.body, id(fn))

    # ── sin usar ──
    def sin_usar(self, arbol, unidades):
        f = self.f
        nombres_t = sorted(self.T(ast.Name), key=lambda n: n.lineno)
        cargas = {n.id for n in nombres_t if isinstance(n.ctx, (ast.Load, ast.Del))}
        cadenas = ' '.join(n.value for n in self.T(ast.Constant) if isinstance(n.value, str))
        exportados = set()
        for s in arbol.body:
            if isinstance(s, ast.Assign) and any(isinstance(t, ast.Name) and t.id == '__all__' for t in s.targets):
                exportados = {e.value for e in ast.walk(s.value) if isinstance(e, ast.Constant) and isinstance(e.value, str)}
        # imports
        for s in self.T(ast.Import, ast.ImportFrom):
            if isinstance(s, ast.ImportFrom) and (s.module == '__future__' or any(a.name == '*' for a in s.names)):
                continue
            sobran = []
            for a in s.names:
                ligado = (a.asname or a.name).split('.')[0]
                if ligado not in cargas and ligado not in exportados and not re.search(r'\b' + re.escape(ligado) + r'\b', cadenas):
                    sobran.append(a)
            for a in sobran:
                nombre = a.asname or a.name
                restan = [x for x in s.names if x not in sobran]
                fixes = []
                solo_linea = f.lineas[s.lineno - 1][:s.col_offset].strip() == '' and f.lineas[s.end_lineno - 1][len(f.lineas[s.end_lineno - 1].encode('utf-8', 'surrogatepass')[:s.end_col_offset].decode('utf-8', 'ignore')):].strip() in ('',)
                if solo_linea:
                    if a is sobran[0]:
                        if not restan:
                            sig = s.end_lineno + 1
                            quita = (s.lineno, 1, sig, 1) if sig <= len(f.lineas) else (s.lineno, 1, s.end_lineno, 1000)
                            fixes = [self.fix('Quitar el import', (quita, ''))]
                        else:
                            nuevo = ast.unparse(type(s)(**({'module': s.module, 'level': s.level} if isinstance(s, ast.ImportFrom) else {}), names=restan))
                            fixes = [self.fix('Quitar los imports que no se usan', ((s.lineno, f.col(s.lineno, s.col_offset), s.end_lineno, f.col(s.end_lineno, s.end_col_offset)), nuevo))]
                self.add('unused.import', 'hint', f.rng(s), f'`{nombre}` se importa pero nunca se usa',
                         'Un import que no se usa ensucia el archivo y confunde sobre de qué depende el código. Quítalo.', fixes)
        # variables y parámetros de cada función
        from bisect import bisect_left, bisect_right
        ordenadas = {}
        for nom, lista in (('n', nombres_t), ('c', self.T(ast.Call)), ('a', self.T(ast.AugAssign)), ('g', self.T(ast.Global, ast.Nonlocal))):
            lista = sorted(lista, key=lambda n: n.lineno)
            ordenadas[nom] = (lista, [n.lineno for n in lista])

        def dentro(nom, a, b):
            lista, ks = ordenadas[nom]
            return lista[bisect_left(ks, a):bisect_right(ks, b)]
        for u in unidades:
            fn = u['node']
            a, b = fn.lineno, fn.end_lineno
            if any(isinstance(n.func, ast.Name) and n.func.id in ('locals', 'vars', 'eval', 'exec') for n in dentro('c', a, b)):
                continue
            leidas = {n.id for n in dentro('n', a, b) if isinstance(n.ctx, (ast.Load, ast.Del))}
            leidas |= {n.target.id for n in dentro('a', a, b) if isinstance(n.target, ast.Name)}
            ajenas = set()
            for n in dentro('g', a, b):
                ajenas.update(n.names)
            if not es_esqueleto(fn) and not (u['name'].startswith('__') and u['name'].endswith('__')):
                a = fn.args
                ps = a.posonlyargs + a.args + a.kwonlyargs
                for i, p in enumerate(ps):
                    if i == 0 and u['kind'] == 'method' and p.arg in ('self', 'cls'):
                        continue
                    if p.arg.startswith('_') or p.arg in leidas:
                        continue
                    self.add('unused.param', 'hint', f.rng(p), f'Parámetro `{p.arg}` sin usar en {u["name"]}()',
                             'Este parámetro no se usa en el cuerpo de la función. Quítalo, úsalo, o llámalo `_` si es obligatorio por la firma.')
            vistas = set()
            for n in sin_defs(fn.body):
                if isinstance(n, (ast.Assign, ast.AnnAssign)):
                    objetivos = n.targets if isinstance(n, ast.Assign) else [n.target]
                    if isinstance(n, ast.AnnAssign) and n.value is None:
                        continue
                    for t in objetivos:
                        if isinstance(t, ast.Name) and not t.id.startswith('_') and t.id not in leidas and t.id not in ajenas and t.id not in vistas:
                            vistas.add(t.id)
                            self.add('unused.var', 'hint', f.rng(t), f'`{t.id}` se asigna pero nunca se usa',
                                     'Esta variable recibe un valor que luego no se lee en ninguna parte. Quítala o úsala; si es un valor que no te interesa, llámala `_`.')

    # ───────────────────────────── declaraciones (soluciones) ─────────────────────────────

    def declaraciones(self):
        arbol, err = error_sintaxis(self.codigo, self.f)
        if err is not None:
            return {}
        f = self.f
        out = {}
        for s in arbol.body:
            if isinstance(s, DEFS):
                tipo, pref = 'function', 'function'
            elif isinstance(s, ast.ClassDef):
                tipo, pref = 'type', 'type'
            else:
                continue
            clave_d = f'{pref}:{s.name.lower()}'
            if clave_d in out:
                continue
            ini = min([s.lineno] + [d.lineno for d in s.decorator_list])
            while ini > 1 and f.lineas[ini - 2].strip().startswith('#'):
                ini -= 1                              # comentarios pegados justo encima
            start = f.inicio[ini - 1]
            end = f.inicio[s.end_lineno - 1] + s.end_col_offset
            doc = ast.get_docstring(s)
            out[clave_d] = {'key': clave_d, 'name': s.name, 'kind': tipo, 'line': ini, 'endLine': s.end_lineno, 'start': start, 'end': end,
                            'doc': doc, 'norm': self.normalizado(s)}
        return out

    @staticmethod
    def normalizado(nodo) -> str:
        """Código sin espacios, comentarios ni docstrings (se regenera desde el árbol, así que da igual cómo esté escrito)."""
        import copy
        n = copy.deepcopy(nodo)
        for x in ast.walk(n):
            if isinstance(x, DEFS + (ast.ClassDef,)) and docstring_stmt(x.body):
                x.body = x.body[1:] or [ast.Pass()]
        return re.sub(r'\s+', '', ast.unparse(n))


# ───────────────────────────── catálogo ─────────────────────────────

def catalogo() -> dict:
    with open(DATOS, encoding='utf-8') as fh:
        datos = json.load(fh)
    funciones = {}
    for nombre, e in datos['functions'].items():
        p, ret, req = e.get('p'), e.get('ret'), e.get('r')
        if p is None and e.get('m'):
            try:
                import importlib
                obj = getattr(importlib.import_module(e['m']), e.get('o_py', nombre))
                sig = inspect.signature(obj)
                p = []
                req = 0
                for par in sig.parameters.values():
                    s = ('*' if par.kind is par.VAR_POSITIONAL else '**' if par.kind is par.VAR_KEYWORD else '') + par.name
                    if par.default is not par.empty:
                        s += '=' + repr(par.default)
                    elif par.kind not in (par.VAR_POSITIONAL, par.VAR_KEYWORD):
                        req += 1
                    p.append(s)
                if sig.return_annotation is not sig.empty and ret is None:
                    ret = ' -> ' + (sig.return_annotation if isinstance(sig.return_annotation, str) else getattr(sig.return_annotation, '__name__', str(sig.return_annotation)))
            except (ValueError, TypeError, ImportError, AttributeError):
                p = None
        if p is None:
            p = ['...']
        if req is None:
            req = sum(1 for x in p if '=' not in x and not x.startswith('*') and x != '...')
        out = {'p': p, 'r': req, 'ret': ret or '', 'd': e['d']}
        if e.get('c'):
            out['o'] = e['c']
        if e.get('pg'):
            out['pg'] = True
        funciones[nombre] = out
    clases = {k: {'d': v} for k, v in datos['classes'].items()}
    return {'python': '.'.join(str(x) for x in sys.version_info[:3]), 'functions': funciones, 'classes': clases, 'keywords': datos['keywords']}


# ───────────────────────────── modos y servidor ─────────────────────────────

def ejecutar(modo: str, codigo: str):
    if modo == 'analyse':
        return Analisis(codigo).analizar()
    if modo == 'decls':
        return Analisis(codigo).declaraciones()
    if modo == 'syntax':
        return {'error': error_sintaxis(codigo, Fuente(codigo))[1]}
    if modo == 'catalog':
        return catalogo()
    if modo == 'ping':
        return {'pong': True, 'pid': os.getpid()}
    raise ValueError('modo desconocido: ' + modo)


def seguro(modo: str, codigo: str):
    """Como ejecutar() pero un fallo interno del análisis nunca debe tumbar al editor."""
    try:
        return ejecutar(modo, codigo)
    except (RecursionError, MemoryError):
        return {'analyse': {'syntax': False, 'error': None, 'diagnostics': [], 'units': [], 'summary': Analisis.resumen([], 0)},
                'decls': {}, 'syntax': {'error': None}}.get(modo, {})


def servidor(ruta_info: str) -> None:
    import secrets
    import socket
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w')
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind(('127.0.0.1', 0))
    srv.listen(8)
    srv.settimeout(1.0)
    token = secrets.token_hex(16)
    pid = os.getpid()
    os.makedirs(os.path.dirname(ruta_info), exist_ok=True)
    tmp = f'{ruta_info}.{pid}.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump({'port': srv.getsockname()[1], 'token': token, 'pid': pid}, fh)
    try:
        os.chmod(tmp, 0o600)                                     # el token solo lo lee este usuario
    except OSError:
        pass
    os.replace(tmp, ruta_info)                                  # escritura atómica: nadie lee un JSON a medias
    cache: dict = {}
    ultimo = time.monotonic()

    def mio() -> bool:
        try:
            with open(ruta_info, encoding='utf-8') as fh:
                return json.load(fh).get('pid') == pid
        except (OSError, ValueError):
            return False

    while True:
        try:
            con, _ = srv.accept()
        except socket.timeout:
            if time.monotonic() - ultimo > INACTIVIDAD_S or not mio():
                break
            continue
        except OSError:
            break
        try:
            con.settimeout(3.0)
            buf = b''
            while b'\n' not in buf and len(buf) < 16_000_000:
                trozo = con.recv(65536)
                if not trozo:
                    break
                buf += trozo
                if buf[:1] != b'{':
                    break                                       # nunca habla HTTP ni otro protocolo: se corta sin contestar
            if buf[:1] != b'{':
                continue
            try:
                req = json.loads(buf.split(b'\n', 1)[0].decode('utf-8'))
                if not isinstance(req, dict) or req.get('token') != token:
                    resp = {'error': 'token'}
                elif req.get('modo') == 'parar':
                    con.sendall(b'{"ok":true}\n')
                    break
                else:
                    ultimo = time.monotonic()
                    modo, cod = str(req.get('modo', '')), str(req.get('codigo', ''))
                    k = modo + hashlib.sha1(cod.encode('utf-8', 'surrogatepass')).hexdigest()
                    if k not in cache:
                        if len(cache) >= 64:
                            cache.pop(next(iter(cache)))
                        cache[k] = seguro(modo, cod)
                    resp = cache[k]
            except (ValueError, UnicodeDecodeError) as e:
                resp = {'error': 'peticion: ' + str(e)}
            con.sendall(json.dumps(resp, ensure_ascii=True).encode('ascii') + b'\n')
        except OSError:
            pass
        finally:
            try:
                con.close()
            except OSError:
                pass
    try:
        if mio():
            os.remove(ruta_info)
    except OSError:
        pass


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == '--servidor':
        servidor(sys.argv[2])
        return
    modo = sys.argv[1] if len(sys.argv) > 1 else 'analyse'
    entrada = sys.stdin.buffer.read().decode('utf-8', 'replace')
    try:
        codigo = json.loads(entrada).get('codigo', '') if entrada.strip().startswith('{') else entrada
    except ValueError:
        codigo = entrada
    sys.stdout.write(json.dumps(seguro(modo, codigo), ensure_ascii=True))


if __name__ == '__main__':
    main()
