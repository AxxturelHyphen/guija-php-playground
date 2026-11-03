"""
Comprobación de sintaxis sin ejecutar nada: lee el código por stdin, lo parsea con `ast` y escribe en stdout
un evento `err` de kind 'parse' (con la posición en UTF-16, como Monaco) o la palabra «ok».
"""
import ast
import json
import sys


def u16(s: str) -> int:
    return len(s) + sum(1 for c in s if ord(c) > 0xFFFF)


def main() -> None:
    codigo = sys.stdin.buffer.read().decode('utf-8', 'replace')
    lineas = codigo.split('\n')
    try:
        ast.parse(codigo, 'tu_codigo.py')
    except (SyntaxError, ValueError) as e:
        if not isinstance(e, SyntaxError):
            ev = {'t': 'err', 'kind': 'parse', 'cls': 'SyntaxError', 'msg': str(e), 'line': 1, 'col': 1, 'endLine': 1, 'endCol': 2}
        else:
            linea = e.lineno or 1
            texto = lineas[linea - 1] if 1 <= linea <= len(lineas) else ''
            col = max(1, e.offset or 1)
            col16 = u16(texto[:col - 1]) + 1
            fin_linea = e.end_lineno or linea
            fin = e.end_offset if e.end_offset and e.end_offset > 0 else 0
            if (fin_linea, fin) <= (linea, col):
                fin_linea, fin16 = linea, col16 + 1
            else:
                t_fin = lineas[fin_linea - 1] if 1 <= fin_linea <= len(lineas) else ''
                fin16 = u16(t_fin[:fin - 1]) + 1
            ev = {'t': 'err', 'kind': 'parse', 'cls': type(e).__name__, 'msg': e.msg or str(e), 'line': linea,
                  'col': col16, 'endLine': fin_linea, 'endCol': fin16}
        sys.stdout.write(json.dumps(ev, ensure_ascii=True))
        return
    sys.stdout.write('ok')


main()
