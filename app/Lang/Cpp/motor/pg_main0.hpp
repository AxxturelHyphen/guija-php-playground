// Se incluye después de pg.hpp cuando el main del usuario no tiene parámetros: «int main()». La etiqueta de ensamblador
// cambia el nombre del símbolo (sigue siendo main para C++, con su return 0 implícito) y pg_main.cpp pone el main de verdad.
int main() __asm__("pg_main_usuario");
