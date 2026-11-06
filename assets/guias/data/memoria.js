// Guía «Gestión de memoria». Mismo formato de paso que data/punteros.js (ver su cabecera):
//   celdas / zonas / grupos · mostrar / ocultar / fantasma · val · code / line · hl · sec · es / en · jugar · pregunta
// Un paso es un parche sobre el anterior; `celdas:` nuevo empieza una escena (mismo array = mismas cajas, sin parpadeo).
const cel = (id, addr, name, type, size, col = 0, grupo) => ({ id, addr, name, type, size, col, ...(grupo && { grupo }) });
// Zonas: la pila y el heap dibujados detrás; grupos: marcos de función y bloques/objetos del heap
const TP = { es: 'Pila (stack)', en: 'Stack' }, TH = { es: 'Heap', en: 'Heap' };
const ZP = [{ col: 0, titulo: TP, tono: 'pila' }];
const ZPH = [...ZP, { col: 1, titulo: TH, tono: 'heap' }];

// ── Escena A: marcos de pila (recursión) ─────────────────────────
const EA = [
  cel('r', '0x7ffe5c78', 'r', 'int', 4, 0, 'fm'),
  cel('n3', '0x7ffe5c4c', 'n', 'int', 4, 0, 'f3'),
  cel('n2', '0x7ffe5c1c', 'n', 'int', 4, 0, 'f2'),
  cel('n1', '0x7ffe5bec', 'n', 'int', 4, 0, 'f1'),
];
// Un marco por llamada: main arriba (direcciones altas) y cada fact debajo (la pila crece hacia abajo)
const GA = [{ id: 'fm', titulo: 'main()' }, { id: 'f3', titulo: 'fact(3)' }, { id: 'f2', titulo: 'fact(2)' }, { id: 'f1', titulo: 'fact(1)' }];
const CA = `int fact(int n) {
    if (n <= 1) return 1;
    return n * fact(n - 1);
}
int main() {
    int r = fact(3);
}`;

// ── Escena B: vida en pila frente a vida en heap ─────────────────
const EB = [
  cel('q', '0x7ffe6b78', 'q', 'int*', 8, 0, 'fm'),
  cel('local', '0x7ffe6b3c', 'local', 'int', 4, 0, 'fc'),
  cel('p', '0x7ffe6b30', 'p', 'int*', 8, 0, 'fc'),
  cel('h', '0x55b2c2a0', { es: 'sin nombre', en: 'unnamed' }, 'int', 4, 1),
];
const GB = [{ id: 'fm', titulo: 'main()' }, { id: 'fc', titulo: 'crear()' }];
const CB = `int* crear() {
    int local = 1;
    int* p = new int(2);
    return p;
}
int main() {
    int* q = crear();
}`;

// ── Escena C1: delete, use-after-free, doble delete ──────────────
const EC1 = [
  cel('p', '0x7ffe6a58', 'p', 'int*', 8),
  cel('q', '0x7ffe6a50', 'q', 'int*', 8),
  cel('h', '0x55b2c3d0', { es: 'sin nombre', en: 'unnamed' }, 'int', 4, 1),
];
const CC1 = `int* p = new int(7);
int* q = p;
delete p;
cout << *q;
delete q;`;

// ── Escena C2: fuga y delete[] ───────────────────────────────────
const EC2 = [
  cel('p', '0x7ffe6a38', 'p', 'int*', 8),
  cel('b1', '0x55b2c3e0', { es: 'bloque 1', en: 'block 1' }, 'int[4]', 16, 1),
  cel('b2', '0x55b2c410', { es: 'bloque 2', en: 'block 2' }, 'int[4]', 16, 1),
];
const CC2 = `int* p = new int[4]{1, 2, 3, 4};
p = new int[4]{5, 6, 7, 8};
delete[] p;`;

// ── Escena D: RAII y unique_ptr ──────────────────────────────────
const ED = [
  cel('a', '0x7ffe7c18', 'a', 'unique_ptr', 8),
  cel('b', '0x7ffe7c10', 'b', 'unique_ptr', 8),
  cel('h', '0x55b2c4a0', { es: 'sin nombre', en: 'unnamed' }, 'int', 4, 1),
];
const CD = `{
    auto a = std::make_unique<int>(10);
    auto b = std::move(a);
}`;

// ── Escena E: shared_ptr y contador de referencias ───────────────
const EE = [
  cel('a', '0x7ffe7d28', 'a', 'shared_ptr', 16),
  cel('b', '0x7ffe7d18', 'b', 'shared_ptr', 16),
  cel('c', '0x7ffe7d08', 'c', 'shared_ptr', 16),
  cel('ctrl', '0x55b2c5d0', 'control block', 'use_count', 0, 1, 'mk'),
  cel('obj', '0x55b2c5e0', { es: 'objeto', en: 'object' }, 'int', 4, 1, 'mk'),
];
const GE = [{ id: 'mk', titulo: 'make_shared<int>' }];
const CE = `auto a = std::make_shared<int>(5);
auto b = a;
shared_ptr<int> c;`;
const SP = ['a', 'b', 'c'];
const nSP = v => SP.filter(k => v[k] === '→obj').length;
const sinc = v => { const n = nSP(v); v.ctrl = n; v.obj = n ? 5 : 'delete ✓'; };
const reset = k => ({ label: `${k}.reset()`, hacer: v => { v[k] = '→∅'; sinc(v); }, off: v => v[k] !== '→obj' });
const asigna = (k, o) => ({ label: `${k} = ${o}`, hacer: v => { v[k] = v[o]; sinc(v); }, off: v => v[k] === v[o] || !nSP(v) });

// ── Escena F: ciclo de shared_ptr y weak_ptr ─────────────────────
const EF = [
  cel('x', '0x7ffe8e40', 'x', 'shared_ptr', 16),
  cel('y', '0x7ffe8e30', 'y', 'shared_ptr', 16),
  cel('cA', '0x55b2c6f0', 'refs A', 'use_count', 0, 1, 'gA'),
  cel('oA', '0x55b2c700', 'obj A', 'A', 16, 1, 'gA'),
  cel('cB', '0x55b2c720', 'refs B', 'use_count', 0, 1, 'gB'),
  cel('oB', '0x55b2c730', 'obj B', 'B', 16, 1, 'gB'),
];
const GF = [{ id: 'gA', titulo: 'make_shared<A>' }, { id: 'gB', titulo: 'make_shared<B>' }];
const CF = `struct B;
struct A { shared_ptr<B> b; };
struct B { shared_ptr<A> a; };
{
    auto x = std::make_shared<A>();
    auto y = std::make_shared<B>();
    x->b = y;
    y->a = x;
}`;
const CF2 = `struct B;
struct A { shared_ptr<B> b; };
struct B { weak_ptr<A> a; };
{
    auto x = std::make_shared<A>();
    auto y = std::make_shared<B>();
    x->b = y;
    y->a = x;
}`;
const CREGLA = `auto p = std::make_unique<Nodo>();
auto s = std::make_shared<Nodo>();
std::weak_ptr<Nodo> w = s;`;

// ── Escena G: Python, conteo de referencias y recolector de ciclos ──
const EG = [
  cel('a', 'local[0]', 'a', 'PyObject*', 8),
  cel('b', 'local[1]', 'b', 'PyObject*', 8),
  cel('ra', '0x7f3a5c90', 'refs 1', 'ob_refcnt', 8, 1, 'g1'),
  cel('oa', '0x7f3a5ca0', 'obj 1', 'Nodo', 0, 1, 'g1'),
  cel('rb', '0x7f3a5ce0', 'refs 2', 'ob_refcnt', 8, 1, 'g2'),
  cel('ob', '0x7f3a5cf0', 'obj 2', 'Nodo', 0, 1, 'g2'),
].map(c => ({ ...c, nulo: 'None' })); // en Python el nulo se escribe None
const GG = [{ id: 'g1', titulo: 'Nodo 1' }, { id: 'g2', titulo: 'Nodo 2' }];
const ZG = [{ col: 0, titulo: { es: 'Nombres', en: 'Names' }, tono: 'datos' }, { col: 1, titulo: TH, tono: 'heap' }];
const CG = `a = Nodo()
b = Nodo()
a.otro = b
b.otro = a
del a, b`;

// ── Escena H: Java, marcar y barrer ──────────────────────────────
const EH = [
  cel('a', '0x7f8c3e28', 'a', 'Nodo', 0),
  cel('b', '0x7f8c3e20', 'b', 'Nodo', 0),
  cel('n1', '0x76ab0120', 'n1', 'Nodo', 16, 1),
  cel('n2', '0x76ab0130', 'n2', 'Nodo', 16, 1),
  cel('n3', '0x76ab0140', 'n3', 'Nodo', 16, 1),
  cel('n4', '0x76ab0150', 'n4', 'Nodo', 16, 1),
].map(c => ({ ...c, nulo: 'null' })); // en Java el nulo se escribe null
const CH = `Nodo a = new Nodo();
a.sig = new Nodo();
Nodo b = new Nodo();
b.sig = new Nodo();
b.sig.sig = b;
b = null;`;

export default {
  titulo: { es: 'Gestión de memoria', en: 'Memory management' },
  fuentes: [
    'Bryant, R. E., & O\'Hallaron, D. R. (2016). *Computer systems: A programmer\'s perspective* (3rd ed.). Pearson.',
    'Jones, R., Hosking, A., & Moss, E. (2023). *The garbage collection handbook: The art of automatic memory management* (2nd ed.). CRC Press.',
    'Python Software Foundation. (n.d.). *gc — Garbage Collector interface*. Python 3 documentation. Retrieved November 6, 2026, from https://docs.python.org/3/library/gc.html',
    '*std::unique_ptr*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/memory/unique_ptr',
    '*std::weak_ptr*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/memory/weak_ptr',
    'Stroustrup, B. (2022). *A tour of C++* (3rd ed.). Addison-Wesley.',
  ],
  pasos: [
    // ── Pila y heap ──
    { sec: { es: 'Pila y heap', en: 'Stack and heap' }, celdas: EA, zonas: ZP, grupos: GA, code: CA, line: 6,
      mostrar: ['r', 'n3'], val: { r: '?', n3: 3 }, hl: { n3: 'a' },
      es: 'Un programa usa dos zonas de memoria. La **pila** (*stack*) guarda los marcos de las llamadas: cada llamada apila un marco con sus parámetros y variables locales. Aquí `main` llama a `fact(3)` y nace `n = 3`.',
      en: 'A program uses two memory regions. The **stack** holds call frames: every call pushes a frame with its parameters and local variables. Here `main` calls `fact(3)` and `n = 3` is born.' },
    { line: 3, mostrar: ['n2'], val: { n2: 2 }, hl: { n2: 'a' },
      es: '`fact(3)` llama a `fact(2)`: otro marco encima, con su propia `n`. Cada llamada pendiente tiene sus variables, por eso la recursión funciona. En las plataformas habituales la pila crece hacia direcciones menores, de ahí que las direcciones bajen.',
      en: '`fact(3)` calls `fact(2)`: another frame on top, with its own `n`. Every pending call has its own variables, which is why recursion works. On the usual platforms the stack grows toward lower addresses, hence the falling addresses.' },
    { line: 2, mostrar: ['n1'], val: { n1: 1 }, hl: { n1: 'a' },
      es: '`fact(1)` es el caso base: no hace más llamadas. Hay tres marcos vivos a la vez, uno por cada llamada que aún no ha terminado.',
      en: '`fact(1)` is the base case: it makes no more calls. There are three live frames at once, one per call that has not finished yet.' },
    { line: 2, ocultar: ['n1'], hl: { n2: 'a' },
      es: '`fact(1)` devuelve 1 y su marco se **desapila**: sus variables dejan de existir sin que el programa haga nada. Siempre sale el último que entró (LIFO: *last in, first out*).',
      en: '`fact(1)` returns 1 and its frame is **popped**: its variables cease to exist without the program doing anything. The last one in is always the first one out (LIFO).' },
    { line: 6, ocultar: ['n2', 'n3'], val: { r: 6 }, hl: { r: 'b' },
      es: 'Lo mismo con `fact(2)` y `fact(3)`; `r` recibe 6. La pila es rápida (reservar o liberar es mover un registro) pero **pequeña y de tamaño fijo**: unos pocos MB (8 MB es lo habitual en Linux). Sin caso base la recursión la agota: *stack overflow*.',
      en: 'Same for `fact(2)` and `fact(3)`; `r` gets 6. The stack is fast (allocating or freeing is just moving a register) but **small and fixed in size**: a few MB (8 MB is typical on Linux). Without a base case, recursion exhausts it: *stack overflow*.' },
    { celdas: EB, zonas: ZPH, grupos: GB, code: CB, line: 2, mostrar: ['q', 'local'], val: { q: '?', local: 1 }, hl: { local: 'a' },
      es: 'El **heap** es la otra zona: memoria que pides y liberas tú, sin orden fijo y con el tamaño de la RAM disponible. Dentro de `crear`, `local` vive en el marco de la pila, y dura lo que dure la llamada.',
      en: 'The **heap** is the other region: memory you request and release yourself, in no fixed order and as large as the available RAM. Inside `crear`, `local` lives in the stack frame and lasts as long as the call.' },
    { line: 3, mostrar: ['p', 'h'], val: { p: '→h', h: 2 }, hl: { p: 'a', h: 'b' },
      es: '`new int(2)` pide 4 bytes al heap y devuelve su dirección. La variable `p` está en la pila; el `int` al que apunta, en el heap. El heap no tiene marcos: un bloque existe hasta que alguien lo libera.',
      en: '`new int(2)` asks the heap for 4 bytes and returns their address. The variable `p` is on the stack; the `int` it points to is on the heap. The heap has no frames: a block exists until someone frees it.' },
    { line: 7, ocultar: ['local', 'p'], val: { q: '→h' }, hl: { q: 'a', h: 'b' },
      es: 'Al volver, el marco de `crear` desaparece (`local` y `p` con él), pero el bloque del heap sigue vivo y `q` lo tiene. Su vida no depende de las llaves sino de ti. Si devolviéramos `&local`, `q` apuntaría a un marco muerto.',
      en: 'On return, the frame of `crear` is gone (`local` and `p` with it), but the heap block is still alive and `q` holds it. Its lifetime does not depend on braces but on you. Had we returned `&local`, `q` would point into a dead frame.' },

    // ── new y delete ──
    { sec: { es: 'new y delete', en: 'new and delete' }, celdas: EC1, zonas: ZPH, code: CC1, line: 2,
      mostrar: ['p', 'q', 'h'], val: { p: '→h', q: '→h', h: 7 }, hl: { p: 'a', q: 'a', h: 'b' },
      es: '`new` reserva en el heap y construye el objeto; `q = p` copia la dirección: dos punteros, **un** objeto. Todo `new` exige su `delete`: liberar es responsabilidad del programador.',
      en: '`new` allocates on the heap and constructs the object; `q = p` copies the address: two pointers, **one** object. Every `new` demands its `delete`: freeing is the programmer’s job.' },
    { line: 3, fantasma: ['h'], hl: { h: 'c' },
      es: '`delete p` destruye el objeto y devuelve el bloque al heap. No toca ningún puntero: `p` y `q` siguen guardando una dirección que ya no es válida. Son punteros **colgantes**.',
      en: '`delete p` destroys the object and returns the block to the heap. It touches no pointer: `p` and `q` still hold an address that is no longer valid. They are **dangling** pointers.' },
    { line: 4, hl: { q: 'c', h: 'c' },
      es: '`*q` es un **use-after-free**: leer memoria ya liberada es comportamiento indefinido. Puede imprimir 7, basura o romper el programa mucho más tarde. AddressSanitizer lo detecta como `heap-use-after-free` (Linux/macOS).',
      en: '`*q` is a **use-after-free**: reading memory that was already freed is undefined behavior. It may print 7, garbage, or break the program much later. AddressSanitizer catches it as `heap-use-after-free` (Linux/macOS).' },
    { line: 5, hl: { q: 'c', h: 'c' },
      es: '`delete q` libera otra vez el mismo bloque: **doble `delete`**, también comportamiento indefinido. Con glibc suele abortar con un mensaje de *double free*, y ASan lo informa como `attempting double-free`.',
      en: '`delete q` frees the same block again: a **double `delete`**, also undefined behavior. With glibc it usually aborts with a *double free* message, and ASan reports it as `attempting double-free`.' },
    { line: null, val: { p: '→∅' }, hl: { p: 'a', q: 'c' },
      es: 'Poner `p = nullptr` tras el `delete` evita usar `p` por error (y `delete nullptr` no hace nada), pero `q` sigue colgando. El fallo de fondo es que dos punteros creen mandar sobre el mismo bloque y nadie sabe quién debe liberarlo.',
      en: 'Setting `p = nullptr` after the `delete` stops `p` from being used by mistake (and `delete nullptr` does nothing), but `q` still dangles. The root problem is that two pointers believe they own the same block and nobody knows who must free it.' },
    { celdas: EC2, zonas: ZPH, code: CC2, line: 1, mostrar: ['p', 'b1'], val: { p: '→b1', b1: '{1,2,3,4}' }, hl: { p: 'a', b1: 'b' },
      es: 'Los arrays dinámicos se crean con `new[]` y se liberan con `delete[]` (usar `delete` a secas es comportamiento indefinido). Aquí `p` apunta al bloque 1, de 16 bytes.',
      en: 'Dynamic arrays are created with `new[]` and freed with `delete[]` (using plain `delete` is undefined behavior). Here `p` points to block 1, 16 bytes long.' },
    { line: 2, mostrar: ['b2'], val: { p: '→b2', b2: '{5,6,7,8}' }, hl: { p: 'a', b1: 'c', b2: 'b' },
      es: 'Reasignamos `p` sin liberar antes: su valor era la única dirección del bloque 1. Sigue reservado, pero nadie puede llegar a él ni liberarlo: una **fuga de memoria** (*memory leak*).',
      en: 'We reassign `p` without freeing first: its value was the only address of block 1. It stays reserved, but nobody can reach it or free it: a **memory leak**.' },
    { line: 3, fantasma: ['b2'], hl: { b1: 'c' },
      es: '`delete[] p` libera el bloque 2; el 1 sigue perdido hasta que el proceso termina. En programas de larga vida las fugas se acumulan. En Linux, el modo *checked* (LeakSanitizer, incluido con ASan) las informa al salir.',
      en: '`delete[] p` frees block 2; block 1 stays lost until the process ends. In long-running programs leaks pile up. On Linux, *checked* mode (LeakSanitizer, bundled with ASan) reports them at exit.',
      pregunta: {
        opc: [
          { es: '`int* p = new int(1); delete p;`', en: '`int* p = new int(1); delete p;`' },
          { es: '`int* p = new int(1); p = nullptr;`', en: '`int* p = new int(1); p = nullptr;`', ok: 1 },
          { es: '`int x = 1; int* p = &x;`', en: '`int x = 1; int* p = &x;`' },
        ],
        why: {
          es: 'Poner `p = nullptr` sin `delete` pierde la única dirección del bloque: nadie podrá liberarlo. En el tercero no hay `new`: `x` vive en la pila y se libera sola.',
          en: 'Setting `p = nullptr` without a `delete` loses the only address of the block: nobody can free it. The third has no `new`: `x` lives on the stack and is released on its own.',
        },
      } },

    // ── RAII y smart pointers ──
    { sec: { es: 'RAII y smart pointers', en: 'RAII and smart pointers' }, celdas: ED, zonas: ZPH, code: CD, line: 2,
      mostrar: ['a', 'h'], val: { a: '→h', h: 10 }, hl: { a: 'a', h: 'b' },
      es: '**RAII**: un recurso se ata a un objeto local, y su destructor lo libera al salir del ámbito, pase lo que pase (`return`, excepción). `unique_ptr` es ese objeto para memoria del heap: ocupa lo que un puntero (8 B) y es el único dueño. Sin `new` ni `delete` en tu código.',
      en: '**RAII**: a resource is tied to a local object, and its destructor releases it on leaving the scope, no matter what (`return`, exception). `unique_ptr` is that object for heap memory: it is the size of a pointer (8 B) and the sole owner. No `new` or `delete` in your code.' },
    { line: 3, mostrar: ['b'], val: { a: '→∅', b: '→h' }, hl: { a: 'a', b: 'a', h: 'b' },
      es: 'Copiar un `unique_ptr` no compila: sería tener dos dueños. `std::move` **transfiere** la propiedad: `b` recibe la dirección y `a` queda en `nullptr` (el estándar lo garantiza). Sigue habiendo un solo dueño.',
      en: 'Copying a `unique_ptr` does not compile: it would mean two owners. `std::move` **transfers** ownership: `b` receives the address and `a` is left as `nullptr` (the standard guarantees it). There is still a single owner.' },
    { line: 4, ocultar: ['a', 'b'], fantasma: ['h'],
      es: 'Al llegar a `}` se destruyen `b` y `a`, en orden inverso al de declaración. El destructor de `b` ejecuta el `delete`; el de `a`, que está vacío, no hace nada. Nadie escribió `delete` y no hay fuga ni doble liberación.',
      en: 'At the `}` both `b` and `a` are destroyed, in reverse order of declaration. The destructor of `b` runs the `delete`; the one of `a`, being empty, does nothing. Nobody wrote `delete`, and there is no leak or double free.' },
    { celdas: EE, zonas: ZPH, grupos: GE, code: CE, line: 1, mostrar: ['a', 'ctrl', 'obj'], val: { a: '→obj', ctrl: 1, obj: 5 }, hl: { a: 'a', ctrl: 'b' },
      es: '`shared_ptr` permite **varios dueños**. Junto al objeto hay un *bloque de control* con el contador de referencias. Cada `shared_ptr` ocupa 16 B (puntero al objeto y al bloque de control, lo habitual); la flecha dibuja solo el primero. `make_shared` reserva ambos de una vez.',
      en: '`shared_ptr` allows **several owners**. Next to the object sits a *control block* with the reference count. Each `shared_ptr` takes 16 B (a pointer to the object and one to the control block, the usual layout); the arrow only draws the first. `make_shared` allocates both at once.' },
    { line: 2, mostrar: ['b'], val: { b: '→obj', ctrl: 2 }, hl: { b: 'a', ctrl: 'b' },
      es: 'Copiar un `shared_ptr` no copia el objeto: comparte el puntero y **suma 1** al contador. El contador es atómico (seguro entre hilos, con un pequeño coste); el objeto, no.',
      en: 'Copying a `shared_ptr` does not copy the object: it shares the pointer and **adds 1** to the count. The count is atomic (thread-safe, at a small cost); the object itself is not.' },
    { line: 3, mostrar: ['c'], val: { c: '→∅' },
      es: 'Pruébalo: cada `reset()` y cada asignación cambian el contador. Al llegar a 0, el último dueño destruye el objeto. Un `shared_ptr` también resta 1 por sí solo al salir de su ámbito.',
      en: 'Try it: every `reset()` and every assignment changes the count. At 0, the last owner destroys the object. A `shared_ptr` also subtracts 1 on its own when it leaves its scope.',
      jugar: {
        botones: [
          reset('a'), reset('b'), reset('c'), asigna('b', 'a'), asigna('c', 'a'),
          { label: { es: 'volver a empezar', en: 'start over' }, hacer: v => { v.a = '→obj'; v.b = '→obj'; v.c = '→∅'; sinc(v); } },
        ],
        lecturas: v => [
          { expr: 'use_count()', valor: nSP(v), malo: !nSP(v) },
          { expr: '*a', valor: v.a === '→obj' ? 5 : 'UB', malo: v.a !== '→obj' },
        ],
        hl: v => ({ ctrl: 'a', obj: nSP(v) ? 'b' : 'c' }),
      } },

    // ── Ciclos y weak_ptr ──
    { sec: { es: 'Ciclos y weak_ptr', en: 'Cycles and weak_ptr' }, celdas: EF, zonas: ZPH, grupos: GF, code: CF, line: 6,
      mostrar: ['x', 'y', 'cA', 'oA', 'cB', 'oB'], val: { x: '→oA', y: '→oB', cA: 1, cB: 1, oA: '→∅', oB: '→∅' }, hl: { x: 'a', y: 'a' },
      es: 'Contar referencias tiene un punto débil: los **ciclos**. `A` guarda un `shared_ptr<B>` y `B` uno de `A`. Creamos `x` e `y`; cada objeto tiene contador 1, el de su variable.',
      en: 'Counting references has a weak spot: **cycles**. `A` holds a `shared_ptr<B>` and `B` holds one to `A`. We create `x` and `y`; each object has count 1, from its variable.' },
    { line: 8, val: { oA: '→oB', oB: '→oA', cA: 2, cB: 2 }, hl: { oA: 'a', oB: 'a' },
      es: 'Ahora cada objeto apunta al otro y los dos contadores valen 2. Al llegar a `}` se destruyen `x` e `y`, y cada uno resta 1 a su contador. ¿Qué pasa con los objetos?',
      en: 'Now each object points to the other and both counts are 2. At the `}` both `x` and `y` are destroyed, and each subtracts 1 from its count. What happens to the objects?',
      pregunta: {
        opc: [
          { es: 'Se liberan los dos', en: 'Both are freed' },
          { es: 'Se libera solo `A`, el primero que se creó', en: 'Only `A`, the first one created, is freed' },
          { es: 'No se libera ninguno: los dos contadores quedan en 1', en: 'Neither is freed: both counts are left at 1', ok: 1 },
        ],
        why: {
          es: 'Cada objeto sigue referenciado por el otro, así que ningún contador llega a 0 y nadie ejecuta los destructores. Es una fuga aunque el código no tenga ningún `new` ni `delete`.',
          en: 'Each object is still referenced by the other, so no count reaches 0 and no destructor runs. It is a leak even though the code has no `new` or `delete` at all.',
        },
      } },
    { line: 9, ocultar: ['x', 'y'], val: { cA: 1, cB: 1 }, hl: { cA: 'c', oA: 'c', cB: 'c', oB: 'c' },
      es: 'Los contadores bajan a 1 y se quedan ahí: los objetos se sostienen entre sí y ninguna variable llega ya a ellos. **Fuga.** `shared_ptr` sirve para varios dueños, no para estructuras con ciclos sin más.',
      en: 'The counts drop to 1 and stay there: the objects hold each other up and no variable reaches them anymore. **Leak.** `shared_ptr` is for several owners, not for structures with cycles as they are.' },
    { celdas: EF, zonas: ZPH, grupos: GF, code: CF2, line: 8, mostrar: ['x', 'y', 'cA', 'oA', 'cB', 'oB'],
      val: { x: '→oA', y: '→oB', cA: 1, cB: 2, oA: '→oB', oB: '→oA' }, hl: { oB: 'b' },
      es: 'Solución: la flecha de vuelta pasa a ser un `weak_ptr<A>`. Observa sin poseer: no suma al contador (`refs A` queda en 1). Para usarlo se llama a `lock()`, que da un `shared_ptr` o uno vacío si el objeto ya murió.',
      en: 'Fix: the back arrow becomes a `weak_ptr<A>`. It observes without owning: it does not add to the count (`refs A` stays at 1). To use it you call `lock()`, which gives a `shared_ptr`, or an empty one if the object is already dead.' },
    { line: 9, ocultar: ['x', 'y'], fantasma: ['cA', 'oA', 'cB', 'oB'],
      es: 'Al salir, `y` resta 1 a `refs B` (2 a 1) y `x` resta 1 a `refs A` (1 a 0). `A` se destruye y su `shared_ptr<B>` resta 1 a `refs B`, que llega a 0 y destruye `B`. Se libera todo.',
      en: 'On exit, `y` subtracts 1 from `refs B` (2 to 1) and `x` subtracts 1 from `refs A` (1 to 0). `A` is destroyed and its `shared_ptr<B>` subtracts 1 from `refs B`, which reaches 0 and destroys `B`. Everything is freed.' },
    { code: CREGLA, line: null,
      es: 'Regla práctica: `make_unique` por defecto; `make_shared` solo si de verdad hay varios dueños; `weak_ptr` para observar o romper ciclos. Un `new` desnudo o un `delete` en tu código indica que falta un smart pointer o un contenedor como `std::vector`.',
      en: 'Rule of thumb: `make_unique` by default; `make_shared` only when there really are several owners; `weak_ptr` to observe or break cycles. A bare `new` or a `delete` in your code means a smart pointer or a container such as `std::vector` is missing.' },

    // ── Recolectores de basura ──
    { sec: { es: 'Recolectores de basura', en: 'Garbage collectors' }, celdas: EG, zonas: ZG, grupos: GG, code: CG, line: 4,
      mostrar: ['a', 'b', 'ra', 'oa', 'rb', 'ob'], val: { a: '→oa', b: '→ob', ra: 2, rb: 2, oa: '→ob', ob: '→oa' }, hl: { ra: 'b', rb: 'b' },
      es: 'Python (CPython) usa conteo de referencias, como `shared_ptr`: cada objeto lleva un contador y se libera en cuanto llega a 0. Tras enlazar los dos `Nodo`, cada uno tiene 2 referencias: el nombre y el atributo del otro.',
      en: 'Python (CPython) uses reference counting, like `shared_ptr`: each object carries a count and is freed as soon as it reaches 0. After linking the two `Nodo`, each has 2 references: the name and the attribute of the other.' },
    { line: 5, ocultar: ['a', 'b'], val: { ra: 1, rb: 1 }, hl: { ra: 'c', rb: 'c' },
      es: '`del` quita los nombres y cada contador baja a 1, no a 0. Es el mismo ciclo que vimos con `shared_ptr`, y solo con conteo se quedaría para siempre en memoria.',
      en: '`del` removes the names and each count drops to 1, not 0. It is the same cycle we saw with `shared_ptr`, and with counting alone it would stay in memory forever.' },
    { line: null, fantasma: ['ra', 'oa', 'rb', 'ob'],
      es: 'Por eso CPython añade un **recolector de ciclos** (módulo `gc`): cada cierto tiempo busca grupos de objetos que solo se referencian entre sí y los libera. Lo hace cuando él decide, o con `gc.collect()`, no en el `del`.',
      en: 'That is why CPython adds a **cycle collector** (the `gc` module): every so often it looks for groups of objects that only reference each other and frees them. It runs when it decides, or via `gc.collect()`, not at the `del`.' },
    { celdas: EH, zonas: ZPH, code: CH, line: 6, mostrar: ['a', 'b', 'n1', 'n2', 'n3', 'n4'],
      val: { a: '→n1', b: '→∅', n1: '→n2', n2: '→∅', n3: '→n4', n4: '→n3' },
      es: 'Java no cuenta referencias. Cuando hace falta memoria, el recolector parte de las **raíces** (variables locales del stack, estáticas…) y sigue referencias. Tras `b = null`, `n3` y `n4` forman un ciclo al que no llega ninguna raíz.',
      en: 'Java does not count references. When memory is needed, the collector starts from the **roots** (local variables on the stack, statics…) and follows references. After `b = null`, `n3` and `n4` form a cycle that no root reaches.' },
    { line: null, hl: { a: 'b', n1: 'b', n2: 'b' },
      es: '**Marcado**: desde `a` se alcanzan `n1` y `n2`, que quedan marcados (verde). `n3` y `n4` no se alcanzan por ningún camino desde una raíz: aunque se apunten entre sí, quedan sin marcar.',
      en: '**Marking**: from `a`, `n1` and `n2` are reachable and get marked (green). `n3` and `n4` are reachable by no path from a root: even though they point to each other, they stay unmarked.' },
    { line: null, fantasma: ['n3', 'n4'], hl: { n3: 'c', n4: 'c' },
      es: '**Barrido**: lo no marcado se libera (o se descarta tras copiar los vivos a otra zona, como hacen los recolectores generacionales). Los ciclos no importan: cuenta la alcanzabilidad. El momento lo elige la JVM y puede causar una pausa.',
      en: '**Sweep**: whatever is unmarked is freed (or discarded after copying the live objects elsewhere, as generational collectors do). Cycles do not matter: reachability does. The JVM picks the moment, and it may cause a pause.' },
    { line: null,
      es: '**C++**: el destructor corre en `}`, en un punto exacto y repetible; sin pausas, pero es cosa tuya. **Java/Python**: ni fugas por olvido ni problema con ciclos, a cambio de no saber *cuándo* se libera, posibles pausas y más memoria de margen. Para ficheros usan `try-with-resources` y `with`.',
      en: '**C++**: the destructor runs at the `}`, at an exact and repeatable point; no pauses, but it is on you. **Java/Python**: no leaks from forgetting and no cycle problem, in exchange for not knowing *when* it is freed, possible pauses and extra memory headroom. For files they use `try-with-resources` and `with`.' },
    { line: null,
      es: 'Quieres que un fichero se cierre exactamente al salir de un bloque, sin escribir `close()`. ¿Qué modelo lo garantiza por diseño del lenguaje?',
      en: 'You want a file to be closed exactly on leaving a block, without writing `close()`. Which model guarantees it by language design?',
      pregunta: {
        opc: [
          { es: 'C++ con RAII: el destructor corre al salir del ámbito', en: 'C++ with RAII: the destructor runs on leaving the scope', ok: 1 },
          { es: 'Java: el recolector lo cierra al detectar que no se usa', en: 'Java: the collector closes it once it detects it is unused' },
          { es: 'Cualquier lenguaje con conteo de referencias, como Python', en: 'Any language with reference counting, such as Python' },
        ],
        why: {
          es: 'En C++ el destructor se ejecuta en `}` por definición. En Java no se sabe cuándo actuará el recolector (`finalize` está obsoleto). CPython suele liberar al instante, pero el lenguaje no lo garantiza: por eso existe `with`.',
          en: 'In C++ the destructor runs at `}` by definition. In Java nobody knows when the collector will act (`finalize` is deprecated). CPython usually frees at once, but the language does not guarantee it: that is why `with` exists.',
        },
      } },
  ],
};
