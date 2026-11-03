// Configuración de la interfaz para PHP. Cada lenguaje tiene un módulo con la misma forma (ver lang.js).
import { registerPhp } from '../monaco-php.js';

export default {
  id: 'php',
  name: 'PHP',
  logo: 'PHP',
  color: ['#8892BF', '#4F5B93'],     // degradado del logo
  icon: '#7A86B8',                   // icono de archivo
  monaco: 'phpx',                    // id del lenguaje en Monaco (propio, para no chocar con el 'php' de serie)
  register: registerPhp,             // registra el resaltado (los otros usan el de serie de Monaco)
  ext: 'php',
  nameRe: /^[A-Za-z0-9_-]{1,80}\.php$/,
  newName: 'mi-ejercicio.php',
  template: '<?php\ndeclare(strict_types=1);\n\n',
  templateLine: 3,
  fence: 'php',
  fnPrefix: 'function ',
  lineComment: '//',
  caseInsensitiveFns: true,          // strlen y STRLEN son la misma función
  varRe: /\$[A-Za-z_]\w*/g,          // variables que se ofrecen al autocompletar
  identRe: /([A-Za-z_][\w\\]*)\s*$/, // nombre de la función antes de "(" (ayuda de firma)
  triggerCharacters: ['$', '>', ':', '\\'],
  noCompletionAfter: ['->', '?>'],
  showJava: true,                    // el catálogo trae el equivalente en Java (el curso PHP es para gente que viene de Java)
  stdinHint: 'Una línea por cada fgets(STDIN) / readline()',
  ccRule: 'Complejidad ciclomática (McCabe): 1 + cada if, elseif, for, foreach, while, do, case, catch, &&, ||, and, or, xor, ?:, ?? y cada brazo de match (sin el default). ',
  testsHint: 'Este archivo no tiene pruebas (usa prueba(), comprueba() o lanza()). Escribe «prueba» y pulsa Tab para una plantilla.',
  unwritten: '// (todavía no has escrito esta función)\n',
  ops: ['<=>', '??=', '??', '?->', '...', '==='],
  keywords: ['abstract', 'and', 'array', 'as', 'break', 'case', 'catch', 'class', 'clone', 'const', 'continue', 'declare', 'default', 'do', 'echo', 'else', 'elseif',
    'enum', 'extends', 'final', 'finally', 'fn', 'for', 'foreach', 'function', 'if', 'implements', 'instanceof', 'interface', 'match', 'namespace', 'new', 'private', 'protected',
    'public', 'readonly', 'return', 'self', 'static', 'switch', 'throw', 'trait', 'try', 'use', 'while', 'yield', 'null', 'true', 'false', 'parent', 'isset', 'unset', 'empty'],
  /** Plantillas en vivo (como las de JetBrains): escribe la abreviatura y Tab. */
  templates: [
    ['fore', 'foreach (\\$${1:items} as \\$${2:item}) {\n\t$0\n}', 'foreach sobre un array'],
    ['forek', 'foreach (\\$${1:items} as \\$${2:clave} => \\$${3:valor}) {\n\t$0\n}', 'foreach con clave y valor'],
    ['forr', 'for (\\$${1:i} = 0; \\$${1:i} < ${2:\\$n}; \\$${1:i}++) {\n\t$0\n}', 'for clásico'],
    ['fn', 'fn(\\$${1:x}) => ${2:\\$x}', 'función flecha'],
    ['func', 'function ${1:nombre}(${2:int \\$x}): ${3:int}\n{\n\t$0\n}', 'función con tipos'],
    ['pubf', 'public function ${1:nombre}(${2}): ${3:void}\n{\n\t$0\n}', 'método público'],
    ['class', 'final class ${1:Nombre}\n{\n\tpublic function __construct(\n\t\tprivate readonly ${2:int} \\$${3:valor},\n\t) {\n\t}\n\n\t$0\n}', 'clase con constructor promocionado'],
    ['iface', 'interface ${1:Nombre}\n{\n\tpublic function ${2:metodo}(): ${3:void};\n}', 'interfaz'],
    ['enum', 'enum ${1:Nombre}: string\n{\n\tcase ${2:Uno} = \'${3:uno}\';\n}', 'enum con valores'],
    ['tryc', 'try {\n\t$0\n} catch (${1:Exception} \\$${2:e}) {\n\techo \\$${2:e}->getMessage();\n}', 'try / catch'],
    ['match', 'match (${1:\\$valor}) {\n\t${2:1} => ${3:\'uno\'},\n\tdefault => ${4:\'otro\'},\n}', 'match'],
    ['strict', 'declare(strict_types=1);', 'activar tipos estrictos'],
    ['prueba', "prueba('${1:nombreFuncion}', [\n\t'${2:caso básico}' => [[${3}], ${4}],\n]);", 'prueba() con casos'],
    ['comprueba', "comprueba('${1:descripción}', fn() => ${2}, ${3:true});", 'comprueba() una condición'],
    ['lanza', "lanza('${1:descripción}', fn() => ${2}, ${3:InvalidArgumentException}::class);", 'lanza(): espera una excepción'],
    ['medir', "medir('${1:nombreFuncion}', fn(int \\$n): array => [range(1, \\$n)]);", 'medir() la complejidad'],
  ],
  help: {
    tests: "prueba('suma', [\n    'básico' => [[2, 3], 5],\n    'negativos' => [[-1, 1], 0],\n]);          // casos: [argumentos, esperado]\n\ncomprueba('saldo inicial', fn() => $c->saldo(), 0.0);\nlanza('no admite negativos', fn() => new Dinero(-1), InvalidArgumentException::class);",
    pendiente: 'pendiente();',
    medir: "medir('buscarDuplicados', fn(int $n): array => [range(1, $n)]);\n// n = 64, 128, 256…  → estima O(n), O(n²)…\n// Pulsa «Medir» (Ctrl+Alt+Enter) para que se ejecute.",
  },
};
