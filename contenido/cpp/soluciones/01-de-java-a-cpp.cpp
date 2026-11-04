#include <algorithm>
#include <cctype>
#include <optional>
#include <string>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 1 · De Java, PHP y Python a C++
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Intercambia dos enteros usando referencias.
 *
 * @complejidad Tiempo O(1); espacio O(1).
 * @explicacion Las referencias `int&` son los propios argumentos del que llama con otro nombre, así que asignar a `a` y
 * `b` cambia las variables originales. Se guarda `a` en una temporal antes de pisarla. Con parámetros por valor se
 * intercambiarían copias que mueren al salir y fuera no cambiaría nada.
 * @alternativas std::swap(a, b) (hace lo mismo, con move). El truco XOR o la suma/resta evitan la temporal pero son
 * ilegibles, fallan si a y b son la MISMA variable (XOR) o pueden desbordar (suma, UB con int).
 */
void intercambiar(int& a, int& b) {
    int temporal = a;
    a = b;
    b = temporal;
}

/**
 * Suma dos int sin desbordar.
 *
 * @complejidad Tiempo O(1); espacio O(1).
 * @explicacion `(long long)a + b` convierte `a` a 64 bits ANTES de sumar, así que la suma se hace en 64 bits (cabe
 * siempre: |a + b| <= 2^32). Hacer `(long long)(a + b)` sería tarde: la suma de int ya se habría desbordado, y con tipos
 * con signo eso es comportamiento indefinido, no «dar la vuelta» como en Java.
 * @alternativas Comprobar antes con `a > INT_MAX - b` y devolver un error, o __builtin_add_overflow. Si el resultado debe
 * caber en un int, esas comprobaciones son la vía; aquí se devuelve un tipo más ancho.
 */
long long sumaSinDesbordar(int a, int b) {
    return (long long)a + b;
}

/**
 * Cuenta las vocales (sin tilde) de un texto.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion Un solo recorrido con `for (char c : s)`. `s` llega por `const string&`: no se copia el texto ni se puede
 * modificar. Se pasa a minúscula con tolower (convirtiendo antes a unsigned char, como exige <cctype>: un char negativo
 * sería UB) y se busca en la cadena "aeiou".
 * @alternativas count_if con una lambda (equivalente). Un switch por letra evita buscar en "aeiou". Para UTF-8 haría falta
 * decodificar los caracteres.
 */
int contarVocales(const string& s) {
    int total = 0;
    for (char c : s) {
        char minuscula = (char)tolower((unsigned char)c);
        if (string("aeiou").find(minuscula) != string::npos) {
            total++;
        }
    }
    return total;
}

/**
 * Da la vuelta a un vector sin usar memoria extra.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion Se intercambian los extremos y se avanza hacia el centro: `i < v.size() / 2` hace n/2 intercambios. No hay
 * `size() - 1` suelto: con el vector vacío valdría 18446744073709551615 (size_t es unsigned) y v[...] leería fuera.
 * @alternativas std::reverse(v.begin(), v.end()). Crear un vector nuevo del revés cuesta O(n) de memoria.
 * @bigo n
 */
void invertirEnSitio(vector<int>& v) {
    for (size_t i = 0; i < v.size() / 2; i++) {
        swap(v[i], v[v.size() - 1 - i]);
    }
}

/**
 * Mayor elemento de un vector, o nullopt si está vacío.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion Si está vacío no hay respuesta y se devuelve un optional vacío (nada de null ni -1 mágicos). Si no, se parte
 * de v[0] y se recorre el resto quedándose con el mayor. Se recorre por const& implícita (no se copia el vector).
 * @alternativas *max_element(v.begin(), v.end()) (desreferenciar el iterador de un vector vacío es UB: hay que comprobar
 * antes). Ordenar y coger el último es O(n log n), innecesario.
 * @bigo n
 */
optional<int> maximo(const vector<int>& v) {
    if (v.empty()) {
        return nullopt;
    }
    int mayor = v[0];
    for (size_t i = 1; i < v.size(); i++) {
        mayor = max(mayor, v[i]);
    }
    return mayor;
}

/**
 * Penúltimo elemento, o nullopt si hay menos de dos.
 *
 * @complejidad Tiempo O(1); espacio O(1).
 * @explicacion `v.size()` es unsigned: con 0 o 1 elementos `v.size() - 2` no es negativo, es un número enorme. Por eso se
 * comprueba `v.size() < 2` ANTES de restar y solo entonces se accede a v[size - 2].
 * @alternativas Convertir a int (`(int)v.size() - 2`) y comprobar `>= 0`: válido mientras el tamaño quepa en un int.
 */
optional<int> penultimo(const vector<int>& v) {
    if (v.size() < 2) {
        return nullopt;
    }
    return v[v.size() - 2];
}
