// Guía «Punteros». Formato de un paso (parche sobre el anterior):
//   celdas [{id,addr,name,type,size,col}]  empieza una escena nueva (con cols: títulos de columna)
//   mostrar / ocultar / fantasma [ids]     visibilidad (fantasma = ya no es válida: línea discontinua)
//   val {id: valor}                        valor; '→id' = puntero a esa celda, '→∅' = nullptr
//   code, line                             listado y línea resaltada (null = ninguna)
//   hl {id: 'a'|'b'|'c'}                   énfasis solo en este paso (azul, verde, rojo)
//   sec {es,en}                            título de sección · es / en: texto del paso
//   jugar {botones, lecturas, hl}          bloque interactivo · pregunta {opc, why}   comprobación
const cel = (id, addr, name, type, size, col = 0, grupo) => ({ id, addr, name, type, size, col, ...(grupo && { grupo }) });
const ZP = [{ col: 0, titulo: { es: 'Pila (stack)', en: 'Stack' }, tono: 'pila' }]; // la pila dibujada detrás

// ── Escena 1: & y * ──────────────────────────────────────────────
const E1 = [cel('x', '0x7ffe3a10', 'x', 'int', 4), cel('p', '0x7ffe3a18', 'p', 'int*', 8), cel('pp', '0x7ffe3a20', 'pp', 'int**', 8)];
const C1 = `int x = 42;
int* p = &x;
cout << *p;
*p = 7;
int** pp = &p;
**pp = 9;`;

// ── Escena 2: nullptr y colgantes ────────────────────────────────
const E2 = [cel('y', '0x7ffe3a10', 'y', 'int', 4), cel('p', '0x7ffe3a18', 'p', 'int*', 8)];
const C2 = `int* p = nullptr;
if (p) cout << *p;
{
    int y = 5;
    p = &y;
}
cout << *p;`;

// ── Escena 3: arrays ─────────────────────────────────────────────
const E3 = [
  cel('a0', '0x7ffe3a30', 'a[0]', 'int', 4), cel('a1', '0x7ffe3a34', 'a[1]', 'int', 4), cel('a2', '0x7ffe3a38', 'a[2]', 'int', 4),
  cel('a3', '0x7ffe3a3c', 'a[3]', 'int', 4), cel('a4', '0x7ffe3a40', 'a[4]', 'int', 4),
  cel('fin', '0x7ffe3a44', '—', { es: 'fuera de a', en: 'outside a' }, 4), cel('p', '0x7ffe3a48', 'p', 'int*', 8),
];
const C3 = `int a[5] = {10, 20, 30, 40, 50};
int* p = a;
p++;
cout << *p;
cout << p[2];`;
const IDS = ['a0', 'a1', 'a2', 'a3', 'a4', 'fin'];
const idx = v => IDS.indexOf(v.p.slice(1));

// ── Escena 4: intercambiar ───────────────────────────────────────
const C4 = `void swapV(int a, int b)   { int t = a; a = b; b = t; }
void swapP(int* a, int* b) { int t = *a; *a = *b; *b = t; }

int x = 1, y = 2;
swapV(x, y);
swapP(&x, &y);`;
// Dos marcos en una sola pila: main arriba (direcciones altas), la función llamada debajo (la pila crece hacia abajo)
const GR4 = [{ id: 'fm', titulo: 'main()' }, { id: 'fv', titulo: 'swapV(int a, int b)' }];
const GR4P = [{ id: 'fm', titulo: 'main()' }, { id: 'fv', titulo: 'swapP(int* a, int* b)' }];
const E4V = [cel('x', '0x7ffe3a14', 'x', 'int', 4, 0, 'fm'), cel('y', '0x7ffe3a10', 'y', 'int', 4, 0, 'fm'),
  cel('a', '0x7ffe39fc', 'a', 'int', 4, 0, 'fv'), cel('b', '0x7ffe39f8', 'b', 'int', 4, 0, 'fv'), cel('t', '0x7ffe39f4', 't', 'int', 4, 0, 'fv')];
const E4P = [cel('x', '0x7ffe3a14', 'x', 'int', 4, 0, 'fm'), cel('y', '0x7ffe3a10', 'y', 'int', 4, 0, 'fm'),
  cel('a', '0x7ffe39f8', 'a', 'int*', 8, 0, 'fv'), cel('b', '0x7ffe39f0', 'b', 'int*', 8, 0, 'fv'), cel('t', '0x7ffe39ec', 't', 'int', 4, 0, 'fv')];

export default {
  titulo: { es: 'Punteros', en: 'Pointers' },
  fuentes: [
    'Bryant, R. E., & O\'Hallaron, D. R. (2016). *Computer systems: A programmer\'s perspective* (3rd ed.). Pearson.',
    'ISO/IEC. (2020). *Programming languages — C++* (ISO/IEC 14882:2020, 6th ed.). International Organization for Standardization. https://www.iso.org/standard/79358.html',
    '*nullptr, the pointer literal (since C++11)*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/language/nullptr',
    'Stroustrup, B. (2013). *The C++ programming language* (4th ed.). Addison-Wesley.',
    'Stroustrup, B. (2022). *A tour of C++* (3rd ed.). Addison-Wesley.',
  ],
  pasos: [
    // ── & y * ──
    { sec: { es: 'Dirección y valor', en: 'Address and value' }, celdas: E1, zonas: ZP, code: C1, line: null,
      es: 'La memoria es una fila enorme de bytes y cada byte tiene una **dirección**. Una variable es solo un nombre para un trozo de esa fila: tiene dirección, tipo y valor. Un **puntero** es una variable cuyo valor es la dirección de otra.',
      en: 'Memory is a huge row of bytes and every byte has an **address**. A variable is just a name for a slice of that row: it has an address, a type and a value. A **pointer** is a variable whose value is the address of another one.' },
    { line: 1, mostrar: ['x'], val: { x: 42 }, hl: { x: 'a' },
      es: '`int x = 42;` reserva 4 bytes (`sizeof(int)`) en alguna dirección, aquí `0x7ffe3a10`, y guarda ahí el 42. Las direcciones cambian en cada ejecución; lo importante es que existen.',
      en: '`int x = 42;` reserves 4 bytes (`sizeof(int)`) at some address, here `0x7ffe3a10`, and stores 42 there. Addresses change on every run; what matters is that they exist.' },
    { line: 2, mostrar: ['p'], val: { p: '→x' }, hl: { p: 'a', x: 'b' },
      es: '`&x` es **la dirección de** `x`. `int*` se lee «puntero a int»: `p` guarda `0x7ffe3a10`. La flecha es solo el dibujo de ese número: `p` no contiene el 42, contiene *dónde está*.',
      en: '`&x` is **the address of** `x`. `int*` reads “pointer to int”: `p` stores `0x7ffe3a10`. The arrow is just a drawing of that number: `p` does not hold 42, it holds *where it lives*.' },
    { line: 3, hl: { p: 'a', x: 'b' },
      es: '`*p` **desreferencia**: sigues la flecha y llegas al valor. Aquí lee 42. (El `*` de `int*` en la declaración y el de `*p` en una expresión son cosas distintas.)',
      en: '`*p` **dereferences**: you follow the arrow and reach the value. Here it reads 42. (The `*` in the declaration `int*` and the one in the expression `*p` are different things.)' },
    { line: 4, val: { x: 7 }, hl: { p: 'a', x: 'b' },
      es: 'Escribir a través del puntero modifica la variable original: `*p = 7` cambia `x`. `p` no se ha movido, sigue apuntando al mismo sitio.',
      en: 'Writing through the pointer changes the original variable: `*p = 7` changes `x`. `p` did not move; it still points to the same place.' },
    { line: 5, mostrar: ['pp'], val: { pp: '→p' }, hl: { pp: 'a', p: 'b' },
      es: 'Un puntero también es una variable: tiene dirección y alguien puede apuntarle. `int**` = «puntero a puntero a int».',
      en: 'A pointer is a variable too: it has an address and something can point to it. `int**` = “pointer to pointer to int”.' },
    { line: 6, val: { x: 9 }, hl: { pp: 'a', p: 'a', x: 'b' },
      es: '`**pp` sigue dos flechas: `pp` → `p` → `x`. Cada `*` es un salto. Resultado: `x` vale 9.',
      en: '`**pp` follows two arrows: `pp` → `p` → `x`. Each `*` is one hop. Result: `x` is 9.' },
    { line: null, hl: { p: 'a' },
      es: 'Si ejecutamos `cout << p;` (sin asterisco), ¿qué se imprime?',
      en: 'If we run `cout << p;` (no asterisk), what gets printed?',
      pregunta: {
        opc: [
          { es: '`9`, el valor de `x`', en: '`9`, the value of `x`' },
          { es: 'La dirección de `x`: `0x7ffe3a10`', en: 'The address of `x`: `0x7ffe3a10`', ok: 1 },
          { es: 'La dirección de `p`: `0x7ffe3a18`', en: 'The address of `p`: `0x7ffe3a18`' },
        ],
        why: {
          es: 'Sin `*` imprimes el valor de `p`, y ese valor *es* una dirección: la de `x`. Para llegar al 9 hace falta `*p`.',
          en: 'Without `*` you print the value of `p`, and that value *is* an address: the one of `x`. To reach the 9 you need `*p`.',
        },
      } },

    // ── nullptr y colgantes ──
    { sec: { es: 'nullptr y punteros colgantes', en: 'nullptr and dangling pointers' }, celdas: E2, zonas: ZP, code: C2, line: 1, mostrar: ['p'], val: { p: '→∅' }, hl: { p: 'a' },
      es: '`nullptr` significa «no apunto a nada». Es la forma segura de expresar «aún no hay valor». Desreferenciarlo es comportamiento indefinido (normalmente, un crash).',
      en: '`nullptr` means “I point to nothing”. It is the safe way to say “no value yet”. Dereferencing it is undefined behavior (usually a crash).' },
    { line: 2, hl: { p: 'a' },
      es: 'Se comprueba antes de usar: `if (p)` es falso con `nullptr`, así que el `*p` no llega a ejecutarse.',
      en: 'Check before using: `if (p)` is false for `nullptr`, so the `*p` never runs.' },
    { line: 4, mostrar: ['y'], val: { y: 5 }, hl: { y: 'a' },
      es: 'Al entrar en el bloque nace `y`. Su vida está ligada a las llaves.',
      en: 'On entering the block, `y` is born. Its lifetime is tied to the braces.' },
    { line: 5, val: { p: '→y' }, hl: { p: 'a', y: 'b' },
      es: '`p` apunta a `y`. Hasta aquí todo es válido.',
      en: '`p` points to `y`. So far everything is valid.' },
    { line: 6, fantasma: ['y'], hl: { p: 'c', y: 'c' },
      es: 'Al cerrar el bloque `y` deja de existir: su hueco en la pila se reutilizará. Pero `p` sigue guardando esa dirección. Eso es un **puntero colgante** (*dangling*).',
      en: 'When the block closes, `y` ceases to exist: its stack slot will be reused. But `p` still holds that address. That is a **dangling pointer**.' },
    { line: 7, hl: { p: 'c', y: 'c' },
      es: '`*p` lee memoria que ya no es tuya: **comportamiento indefinido**. Puede imprimir 5, basura o romper el programa, y el compilador no avisa. AddressSanitizer (modo *checked* en Linux/macOS) lo detecta como `stack-use-after-scope`.',
      en: '`*p` reads memory that is no longer yours: **undefined behavior**. It may print 5, garbage, or crash, and the compiler does not warn. AddressSanitizer (*checked* mode on Linux/macOS) catches it as `stack-use-after-scope`.' },

    // ── arrays y aritmética ──
    { sec: { es: 'Arrays y aritmética', en: 'Arrays and arithmetic' }, celdas: E3, zonas: ZP, code: C3, line: 1, mostrar: ['a0', 'a1', 'a2', 'a3', 'a4'],
      val: { a0: 10, a1: 20, a2: 30, a3: 40, a4: 50 },
      es: 'Un array son elementos del mismo tipo **contiguos** en memoria: las direcciones suben de 4 en 4 (`sizeof(int)`), sin huecos.',
      en: 'An array is same-typed elements **contiguous** in memory: addresses go up by 4 (`sizeof(int)`), with no gaps.' },
    { line: 2, mostrar: ['p'], val: { p: '→a0' }, hl: { p: 'a', a0: 'b' },
      es: 'El nombre de un array «decae» a un puntero a su primer elemento: `int* p = a;` equivale a `&a[0]`.',
      en: 'An array name “decays” to a pointer to its first element: `int* p = a;` is the same as `&a[0]`.' },
    { line: 3, val: { p: '→a1' }, hl: { p: 'a', a1: 'b' },
      es: '`p++` no suma 1 a la dirección: suma `sizeof(int)`. De `…30` pasa a `…34`. El compilador escala por el tamaño del tipo: $\\text{dir}(p+k)=\\text{dir}(p)+k\\cdot\\text{sizeof}(T)$.',
      en: '`p++` does not add 1 to the address: it adds `sizeof(int)`. From `…30` it goes to `…34`. The compiler scales by the type size: $\\text{addr}(p+k)=\\text{addr}(p)+k\\cdot\\text{sizeof}(T)$.' },
    { line: 4, hl: { p: 'a', a1: 'b' },
      es: '`*p` es ahora `a[1]`, es decir 20.',
      en: '`*p` is now `a[1]`, that is 20.' },
    { line: 5, hl: { p: 'a', a3: 'b' },
      es: '`p[2]` es azúcar de `*(p + 2)`: desde donde está `p`, avanza 2 elementos hasta `a[3]` (40). Por eso `a[i]` y `*(a + i)` son lo mismo.',
      en: '`p[2]` is sugar for `*(p + 2)`: from where `p` is, advance 2 elements to `a[3]` (40). That is why `a[i]` and `*(a + i)` are the same.' },
    { line: null, fantasma: ['fin'], hl: { fin: 'c' },
      es: 'La aritmética de punteros **no sabe dónde acaba el array**. `a + 5` es una dirección válida (una pasada del final: así funcionan `end()` y los iteradores), pero desreferenciarla, o ir más allá, es comportamiento indefinido.',
      en: 'Pointer arithmetic **does not know where the array ends**. `a + 5` is a valid address (one past the end: this is how `end()` and iterators work), but dereferencing it, or going further, is undefined behavior.' },
    { line: null, val: { p: '→a0' },
      es: 'Mueve `p` por el array con los botones, o **arrástralo** hasta cualquier celda, y observa qué cambian `p`, `*p` y `p - a`. Llega hasta el final.',
      en: 'Move `p` through the array with the buttons, or **drag** it onto any cell, and watch what `p`, `*p` and `p - a` do. Go all the way to the end.',
      jugar: {
        botones: [
          { label: 'p++', hacer: v => { v.p = '→' + IDS[idx(v) + 1]; }, off: v => idx(v) >= 5 },
          { label: 'p--', hacer: v => { v.p = '→' + IDS[idx(v) - 1]; }, off: v => idx(v) <= 0 },
          { label: '*p += 1', hacer: v => { v[IDS[idx(v)]] += 1; }, off: v => idx(v) >= 5 },
        ],
        lecturas: (v, { cel }) => [
          { expr: 'p', valor: cel[IDS[idx(v)]].addr },
          { expr: '*p', valor: idx(v) >= 5 ? 'UB' : v[IDS[idx(v)]], malo: idx(v) >= 5 },
          { expr: 'p - a', valor: idx(v) },
        ],
        hl: v => ({ p: 'a', [IDS[idx(v)]]: idx(v) >= 5 ? 'c' : 'b' }),
        arrastrables: ['p'],
        soltar: (v, _origen, destino) => { if (IDS.includes(destino)) v.p = '→' + destino; },
      } },

    // ── pasar punteros a funciones ──
    { sec: { es: 'Punteros y funciones', en: 'Pointers and functions' }, celdas: E4V, zonas: ZP, grupos: GR4, code: C4, line: 4,
      mostrar: ['x', 'y'], val: { x: 1, y: 2 },
      es: 'Queremos una función que intercambie `x` e `y`. Probamos primero la versión «normal».',
      en: 'We want a function that swaps `x` and `y`. Let us try the “normal” version first.' },
    { line: 5, mostrar: ['a', 'b'], val: { a: 1, b: 2 }, hl: { a: 'a', b: 'a' },
      es: 'C++ pasa **por valor**: la función recibe *copias*. `a` y `b` son variables nuevas, en el marco de `swapV`.',
      en: 'C++ passes **by value**: the function receives *copies*. `a` and `b` are brand-new variables in the frame of `swapV`.' },
    { line: 1, mostrar: ['t'], val: { t: 1, a: 2, b: 1 }, hl: { a: 'a', b: 'a', t: 'a' },
      es: 'Dentro, el intercambio funciona… pero sobre las copias.',
      en: 'Inside, the swap works… but on the copies.' },
    { line: 5, ocultar: ['a', 'b', 't'], hl: { x: 'c', y: 'c' },
      es: 'Al volver, las copias desaparecen y `x`, `y` siguen como estaban. Por valor no se puede modificar el original.',
      en: 'On return the copies vanish and `x`, `y` are as they were. By value you cannot modify the original.' },
    { celdas: E4P, zonas: ZP, grupos: GR4P, line: 6, mostrar: ['x', 'y', 'a', 'b'], val: { x: 1, y: 2, a: '→x', b: '→y' }, hl: { a: 'a', b: 'a' },
      es: 'Pasamos las **direcciones**: `&x` y `&y`. Ahora `a` y `b` son punteros que apuntan a las variables de `main`.',
      en: 'We pass the **addresses**: `&x` and `&y`. Now `a` and `b` are pointers aimed at the variables of `main`.' },
    { line: 2, mostrar: ['t'], val: { t: 1 }, hl: { a: 'a', x: 'b', t: 'a' },
      es: '`int t = *a;` lee a través de `a`: sigue la flecha hasta `x` y copia su valor (1) en `t`.',
      en: '`int t = *a;` reads through `a`: follow the arrow to `x` and copy its value (1) into `t`.' },
    { line: 2, val: { x: 2, y: 1 }, hl: { a: 'a', b: 'a', x: 'b', y: 'b' },
      es: '`*a = *b; *b = t;` escribe a través de ambos punteros: ahora `x` vale 2 e `y` vale 1. Esta vez sí cambiaron los originales.',
      en: '`*a = *b; *b = t;` writes through both pointers: now `x` is 2 and `y` is 1. This time the originals changed.' },
    { line: null,
      code: { es: 'void swapR(int& a, int& b) { int t = a; a = b; b = t; }\nswapR(x, y);   // sin & ni * al llamar', en: 'void swapR(int& a, int& b) { int t = a; a = b; b = t; }\nswapR(x, y);   // no & or * at the call' },
      es: 'Una **referencia** (`int&`) es un alias: `a` y `b` *son* `x` e `y`, sin `&` ni `*`. Por debajo el compilador usa punteros. Regla práctica: referencia por defecto; puntero cuando puede ser `nullptr` o tiene que apuntar a otra cosa más tarde.',
      en: 'A **reference** (`int&`) is an alias: `a` and `b` *are* `x` and `y`, with no `&` or `*`. Under the hood the compiler uses pointers. Rule of thumb: reference by default; pointer when it can be `nullptr` or must point elsewhere later.' },
    { line: null,
      code: { es: 'const int* p1 = &x;   // *p1 = 5;  ✗  el dato es const\nint* const p2 = &x;   // p2 = &y;  ✗  el puntero es const', en: 'const int* p1 = &x;   // *p1 = 5;  ✗  the data is const\nint* const p2 = &x;   // p2 = &y;  ✗  the pointer is const' },
      es: '`const` se lee de derecha a izquierda. `const int* p1`: «p1 es un puntero a int constante» (no cambias el dato). `int* const p2`: «p2 es un puntero constante a int» (no cambias a dónde apunta).',
      en: '`const` reads right to left. `const int* p1`: “p1 is a pointer to a constant int” (you cannot change the data). `int* const p2`: “p2 is a constant pointer to int” (you cannot change where it points).' },
    { line: null,
      es: '¿Por qué `swapV(x, y)` no intercambia nada?',
      en: 'Why does `swapV(x, y)` swap nothing?',
      pregunta: {
        opc: [
          { es: 'Recibe copias de `x` e `y` y solo cambia las copias', en: 'It receives copies of `x` and `y` and only changes the copies', ok: 1 },
          { es: 'Porque `int t` es local y se destruye', en: 'Because `int t` is local and gets destroyed' },
          { es: 'Porque una función no puede modificar variables', en: 'Because a function cannot modify variables' },
        ],
        why: {
          es: 'Paso por valor = copia. Para modificar el original necesitas su dirección (puntero) o un alias (referencia).',
          en: 'Pass by value = copy. To modify the original you need its address (pointer) or an alias (reference).',
        },
      } },
  ],
};
