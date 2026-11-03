import java.util.*;

/** Fixture mínimo: una lección con un método, un tipo y pruebas. */
class Sencillo {
    record Punto(int x, int y) {
        int suma() { return x + y; }
    }

    static int cuadrado(int n) {
        return n * n;
    }

    public static void main(String[] args) {
        System.out.println("hola");
        prueba("cuadrado", caso("tres", 9, 3), caso("cero", 0, 0));
        comprueba("punto", () -> new Punto(1, 2).suma(), 3);
    }
}
