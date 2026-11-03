// Lenguaje "phpx" (resaltado Monarch de PHP) para Monaco. El tema está en monaco-theme.js.

export function registerPhp(monaco) {
  monaco.languages.register({ id: 'phpx' });
  monaco.languages.setLanguageConfiguration('phpx', {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    colorizedBracketPairs: [], // JetBrains no colorea los paréntesis
    autoClosingPairs: [
      { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] }, { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [['{', '}'], ['[', ']'], ['(', ')'], ['"', '"'], ["'", "'"]],
    wordPattern: /(-?\d*\.\d\w*)|(\$?[^\s`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?]+)/g,
  });
  monaco.languages.setMonarchTokensProvider('phpx', {
    keywords: [
      'abstract', 'and', 'array', 'as', 'bool', 'break', 'callable', 'case', 'catch', 'class', 'clone', 'const',
      'continue', 'declare', 'default', 'die', 'do', 'echo', 'else', 'elseif', 'empty', 'enum', 'exit', 'extends',
      'false', 'final', 'finally', 'float', 'fn', 'for', 'foreach', 'from', 'function', 'global', 'goto', 'if',
      'implements', 'include', 'include_once', 'instanceof', 'insteadof', 'int', 'interface', 'isset', 'iterable',
      'list', 'match', 'mixed', 'namespace', 'never', 'new', 'null', 'object', 'or', 'parent', 'print', 'private',
      'protected', 'public', 'readonly', 'require', 'require_once', 'return', 'self', 'static', 'string', 'switch',
      'throw', 'trait', 'true', 'try', 'unset', 'use', 'var', 'void', 'while', 'xor', 'yield',
    ],
    tokenizer: {
      root: [
        [/<\?(php|=)?|\?>/, 'metatag'],
        [/#\[/, 'annotation', '@attribute'],
        [/\/\*\*(?!\/)/, 'comment.doc', '@docblock'],
        [/\/\*/, 'comment', '@comment'],
        [/(\/\/|#).*$/, 'comment'],
        [/<<<\s*['"]?([a-zA-Z_]\w*)['"]?/, { token: 'string', next: '@heredoc.$1' }],
        [/"/, 'string', '@dstring'],
        [/'/, 'string', '@sstring'],
        [/\$this\b/, 'keyword'],
        [/\$[a-zA-Z_]\w*/, 'variable'],
        [/(\??->)(\s*)([a-zA-Z_]\w*)(?=\s*\()/, ['operator', '', 'method.call']],
        [/(\??->)(\s*)([a-zA-Z_]\w*)/, ['operator', '', 'field']],
        [/(::)(class)\b/, ['operator', 'keyword']],
        [/(::)(\$[a-zA-Z_]\w*)/, ['operator', 'field']],
        [/(::)([a-zA-Z_]\w*)(?!\s*\()/, ['operator', 'constant']],
        [/(function|fn)(\s+)([a-zA-Z_]\w*)/, ['keyword', '', 'function.decl']],
        [/(class|interface|trait|enum|extends|implements|new|instanceof|use)(\s+)(?!(?:self|static|parent|class|function)\b)([a-zA-Z_\\][\w\\]*)/, ['keyword', '', 'type']],
        [/[a-zA-Z_\\][\w\\]*(?=\s*\()/, { cases: { '@keywords': 'keyword', '@default': 'function.call' } }],
        [/[a-zA-Z_\\][\w\\]*/, { cases: { '@keywords': 'keyword', '~[A-Z][A-Z0-9_]+': 'constant', '@default': 'identifier' } }],
        [/\d[\d_]*\.\d[\d_]*([eE][-+]?\d+)?/, 'number'],
        [/0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*/, 'number'],
        [/[{}()[\]]/, '@brackets'],
        [/[;,]/, 'delimiter'],
        [/[=<>!+\-*/%&|^~?:.@]+/, 'operator'],
      ],
      dstring: [
        [/[^\\"${]+/, 'string'],
        [/\\./, 'string.escape'],
        [/\{(?=\$)/, 'string.escape', '@interp'],
        [/\$this\b/, 'keyword'],
        [/\$[a-zA-Z_]\w*/, 'variable'],
        [/[${]/, 'string'],
        [/"/, 'string', '@pop'],
      ],
      interp: [
        [/\}/, 'string.escape', '@pop'],
        [/\$this\b/, 'keyword'],
        [/\$[a-zA-Z_]\w*/, 'variable'],
        [/(\??->)([a-zA-Z_]\w*)(?=\()/, ['operator', 'method.call']],
        [/(\??->)([a-zA-Z_]\w*)/, ['operator', 'field']],
        [/'[^']*'/, 'string'],
        [/[^}]/, 'identifier'],
      ],
      sstring: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
      heredoc: [
        [/^\s*([a-zA-Z_]\w*)/, { cases: { '$1==$S2': { token: 'string', next: '@pop' }, '@default': 'string' } }],
        [/.+/, 'string'],
      ],
      comment: [
        [/[^*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/\*/, 'comment'],
      ],
      docblock: [
        [/@[a-zA-Z-]+/, 'comment.doc.tag'],
        [/[^*@]+/, 'comment.doc'],
        [/\*\//, 'comment.doc', '@pop'],
        [/[*@]/, 'comment.doc'],
      ],
      attribute: [
        [/\]/, 'annotation', '@pop'],
        [/[^\]]+/, 'annotation'],
      ],
    },
  });
}
