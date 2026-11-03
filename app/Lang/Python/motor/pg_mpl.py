"""
Backend de matplotlib del playground (se activa con MPLBACKEND=module://pg_mpl).

No abre ninguna ventana: cada figura se dibuja con Agg y se manda al navegador como imagen PNG (evento `img`)
cuando el programa llama a plt.show() o, si nunca lo llama, al terminar.
"""
from matplotlib.backend_bases import FigureManagerBase, _Backend
from matplotlib.backends.backend_agg import FigureCanvasAgg


def _enviar_todas() -> None:
    """Emite y cierra todas las figuras abiertas, en el orden en que se crearon."""
    import matplotlib.pyplot as plt
    import pg_harness
    for numero in plt.get_fignums():
        fig = plt.figure(numero)
        pg_harness.emitir_figura(fig)
        plt.close(fig)


def vaciar(solo_pendientes: bool = False) -> None:
    """Lo llama el harness al terminar: las figuras que no se mostraron con plt.show() salen igualmente."""
    _enviar_todas()


class FigureManagerPG(FigureManagerBase):
    def show(self) -> None:
        _enviar_todas()


@_Backend.export
class _BackendPG(_Backend):
    FigureCanvas = FigureCanvasAgg
    FigureManager = FigureManagerPG

    @staticmethod
    def show(*args, **kwargs) -> None:
        _enviar_todas()
