// Lenguaje "cppx" (resaltado Monarch de C++) para Monaco. El tema está en monaco-theme.js.
// Reparte los colores como Zed con Islands Dark: palabras clave y tipos primitivos en naranja, llamadas en azul,
// miembros (a.b, p->b) en morado, CONSTANTES en morado cursiva, números en turquesa y los tipos (auto, vector,
// variant, Dinero…) en verde pistacho. Monarch no entiende la gramática: los tipos se deducen por su forma.

export function registerCpp(monaco) {
  monaco.languages.register({ id: 'cppx' });
  monaco.languages.setLanguageConfiguration('cppx', {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] }, { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [['{', '}'], ['[', ']'], ['(', ')'], ['"', '"'], ["'", "'"]],
    wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g,
    onEnterRules: [ // continuar los comentarios /** … */ con « * »
      { beforeText: /^\s*\/\*\*(?!\/)([^*]|\*(?!\/))*$/, afterText: /^\s*\*\/$/, action: { indentAction: monaco.languages.IndentAction.IndentOutdent, appendText: ' * ' } },
      { beforeText: /^\s*\/\*\*(?!\/)([^*]|\*(?!\/))*$/, action: { indentAction: monaco.languages.IndentAction.None, appendText: ' * ' } },
      { beforeText: /^(\t|[ ])*[ ]\*([ ]([^*]|\*(?!\/))*)?$/, previousLineText: /(?=^(\s*(\/\*\*|\*)).*)(?=(?!(\s*\*\/)))/, action: { indentAction: monaco.languages.IndentAction.None, appendText: '* ' } },
      { beforeText: /^(\t|[ ])*[ ]\*\/\s*$/, action: { indentAction: monaco.languages.IndentAction.None, removeText: 1 } },
    ],
  });
  monaco.languages.setMonarchTokensProvider('cppx', {
    keywords: [
      'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break', 'case', 'catch', 'char', 'char8_t',
      'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const', 'consteval', 'constexpr', 'constinit', 'continue', 'co_await',
      'co_return', 'co_yield', 'decltype', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'export', 'extern', 'false',
      'final', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not',
      'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'override', 'private', 'protected', 'public', 'register', 'requires', 'return',
      'short', 'signed', 'sizeof', 'static', 'static_assert', 'struct', 'switch', 'template', 'this', 'thread_local', 'throw', 'true',
      'try', 'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while', 'xor',
      'xor_eq',
    ],
    // Tipos que casi nunca son un nombre de variable. Los ambiguos (list, set, map, stack, function…) se reconocen
    // solo si llevan <…> o van seguidos de un nombre (`list x;`), para no pintar `list.push_back`.
    types: [
      'vector', 'string', 'wstring', 'string_view', 'unordered_map', 'unordered_set', 'unordered_multimap', 'unordered_multiset',
      'pair', 'tuple', 'deque', 'priority_queue', 'bitset', 'optional', 'variant', 'unique_ptr', 'shared_ptr', 'weak_ptr',
      'size_t', 'ptrdiff_t', 'ssize_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
      'intmax_t', 'uintmax_t', 'intptr_t', 'uintptr_t', 'ostream', 'istream', 'iostream', 'ifstream', 'ofstream', 'stringstream',
      'istringstream', 'ostringstream', 'exception', 'runtime_error', 'logic_error', 'invalid_argument', 'out_of_range',
      'length_error', 'domain_error', 'overflow_error', 'bad_alloc', 'mt19937', 'mt19937_64', 'random_device',
    ],
    tokenizer: {
      root: [
        [/^(\s*#\s*(?:include|import))(\s*)(<[^>\n]*>|"[^"\n]*")/, ['keyword', '', 'string']],
        [/^\s*#\s*\w+/, 'keyword'],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
        [/R"([^()\\\s]{0,16})\(/, { token: 'string', next: '@rawstring.$1' }],
        [/"/, 'string', '@string'],
        [/'(?:\\.[^']*|[^\\'])'/, 'string'],
        [/\.\d[\d']*([eE][-+]?\d+)?[fFlL]?/, 'number'],
        [/0[xX][0-9a-fA-F']+[uUlLzZ]*/, 'number'],
        [/0[bB][01']+[uUlLzZ]*/, 'number'],
        [/\d[\d']*\.[\d']*([eE][-+]?\d+)?[fFlL]?|\d[\d']*[eE][-+]?\d+[fFlL]?/, 'number'],
        [/\d[\d']*[uUlLzZ]*/, 'number'],
        [/(?:static|dynamic|const|reinterpret)_cast\s*</, 'function.call', '@cast'],
        [/(\.|->)(\s*)(?!(?:long|int|void|auto|bool|char|short|unsigned|signed|float|double|const|decltype)\b)([A-Za-z_]\w*)(?=\s*\()/, ['operator', '', 'method.call']],
        [/(\.|->)(\s*)(?!(?:long|int|void|auto|bool|char|short|unsigned|signed|float|double|const|decltype)\b)([A-Za-z_]\w*)/, ['operator', '', 'field']],
        [/(enum\s+class|enum\s+struct|class|struct|enum|union|typename)(\s+)([A-Za-z_]\w*)/, ['keyword', '', 'type.cpp']],
        [/(using)(\s+)([A-Za-z_]\w*)(?=\s*=)/, ['keyword', '', 'type.cpp']],
        [/[A-Za-z_]\w*(?=\s*\()/, { cases: { '@keywords': 'keyword', '@types': 'type.cpp', '@default': 'function.call' } }],
        // max<int>(a, b) es una llamada; vector<int> x, function<void(int)> f y template<…> no
        [/[A-Za-z_]\w*(?=<(?:(?!&&)[\w:\s,<>*()&])*>\s*\()/, { cases: { '@keywords': 'keyword', '@types': 'type.cpp', '@default': 'function.call' } }],
        [/[A-Za-z_]\w*(?=<(?:(?!&&)[\w:\s,<>*()&])*>)/, { cases: { 'auto': 'type.cpp', '@keywords': 'keyword', '@default': 'type.cpp' } }],
        // declaración «Tipo nombre» (list x;  Nodo* no entra: ahí vale la regla de las Mayúsculas)
        [/[A-Za-z_]\w*(?=\s+[A-Za-z_]\w*\s*[=;,)[({])/, { cases: { 'auto': 'type.cpp', '@keywords': 'keyword', '@default': 'type.cpp' } }],
        [/[A-Za-z_]\w*/, { cases: {
          'auto': 'type.cpp', '@keywords': 'keyword', '@types': 'type.cpp',
          '~[A-Z][A-Z0-9_]+': 'constant', '~[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*': 'type.cpp', '@default': 'identifier' } }],
        [/[{}()[\]]/, '@brackets'],
        [/[;,]/, 'delimiter'],
        [/[=<>!+\-*/%&|^~?:.]+/, 'operator'],
      ],
      // static_cast<…>: todo el argumento de plantilla va en azul, con los < > anidados emparejados
      cast: [
        [/</, 'function.call', '@cast'],
        [/>/, 'function.call', '@pop'],
        [/[^<>]+/, 'function.call'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
      rawstring: [
        [/\)([^"]*)"/, { cases: { '$1==$S2': { token: 'string', next: '@pop' }, '@default': 'string' } }],
        [/[^)]+/, 'string'],
        [/\)/, 'string'],
      ],
      comment: [
        [/[^*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/\*/, 'comment'],
      ],
    },
  });
}
