package pg;

/**
 * Se lanza desde pendiente(): el ejercicio aún no está implementado.
 * Extiende Error (no Exception) para que un «catch (Exception e)» del usuario no se lo trague.
 */
@SuppressWarnings("serial")
public final class PorHacer extends Error {
    public PorHacer(String mensaje) {
        super(mensaje, null, false, true);
    }
}
