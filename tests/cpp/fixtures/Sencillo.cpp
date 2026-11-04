#include <iostream>
#include <string>

/** Fixture mínimo: un tipo, una función y pruebas. */
struct Punto {
    int x, y;
    int suma() const { return x + y; }
};

int cuadrado(int n) {
    return n * n;
}

int main() {
    std::cout << "hola" << std::endl;
    prueba(cuadrado, caso("tres", 9, 3), caso("cero", 0, 0));
    comprueba("punto", [&] { return Punto{1, 2}.suma(); }, 3);
    return 0;
}
