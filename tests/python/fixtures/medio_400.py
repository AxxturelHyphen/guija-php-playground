"""Fixture de tiempos: unas 400 líneas con funciones y pruebas (stdlib solamente)."""
import math
import re
from collections import Counter


def f1(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 1, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 1
    return total


def f2(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 2, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 2
    return total


def f3(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 3, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 3
    return total


def f4(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 4, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 4
    return total


def f5(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 5, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 5
    return total


def f6(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 6, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 6
    return total


def f7(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 7, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 7
    return total


def f8(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 8, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 8
    return total


def f9(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 9, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 9
    return total


def f10(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 10, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 10
    return total


def f11(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 11, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 11
    return total


def f12(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 12, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 12
    return total


def f13(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 13, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 13
    return total


def f14(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 14, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 14
    return total


def f15(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 15, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 15
    return total


def f16(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 16, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 16
    return total


def f17(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 17, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 17
    return total


def f18(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 18, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 18
    return total


def f19(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 19, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 19
    return total


def f20(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 20, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 20
    return total


def f21(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 21, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 21
    return total


def f22(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 22, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 22
    return total


def f23(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 23, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 23
    return total


def f24(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 24, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 24
    return total


def f25(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 25, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 25
    return total


def f26(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 26, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 26
    return total


def f27(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 27, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 27
    return total


def f28(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 28, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 28
    return total


def f29(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 29, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 29
    return total


def f30(xs: list[int]) -> int:
    """Suma de los elementos multiplicada por 30, ignorando negativos."""
    total = 0
    for x in xs:
        if x > 0:
            total += x * 30
    return total



prueba("f1", {
    "positivos": (([1, 2, 3],), 6),
    "con negativos": (([-1, 2, -3, 4],), 6),
})
prueba("f2", {
    "positivos": (([1, 2, 3],), 12),
    "con negativos": (([-1, 2, -3, 4],), 12),
})
prueba("f3", {
    "positivos": (([1, 2, 3],), 18),
    "con negativos": (([-1, 2, -3, 4],), 18),
})
prueba("f4", {
    "positivos": (([1, 2, 3],), 24),
    "con negativos": (([-1, 2, -3, 4],), 24),
})
prueba("f5", {
    "positivos": (([1, 2, 3],), 30),
    "con negativos": (([-1, 2, -3, 4],), 30),
})
prueba("f6", {
    "positivos": (([1, 2, 3],), 36),
    "con negativos": (([-1, 2, -3, 4],), 36),
})
prueba("f7", {
    "positivos": (([1, 2, 3],), 42),
    "con negativos": (([-1, 2, -3, 4],), 42),
})
prueba("f8", {
    "positivos": (([1, 2, 3],), 48),
    "con negativos": (([-1, 2, -3, 4],), 48),
})
prueba("f9", {
    "positivos": (([1, 2, 3],), 54),
    "con negativos": (([-1, 2, -3, 4],), 54),
})
prueba("f10", {
    "positivos": (([1, 2, 3],), 60),
    "con negativos": (([-1, 2, -3, 4],), 60),
})
prueba("f11", {
    "positivos": (([1, 2, 3],), 66),
    "con negativos": (([-1, 2, -3, 4],), 66),
})
prueba("f12", {
    "positivos": (([1, 2, 3],), 72),
    "con negativos": (([-1, 2, -3, 4],), 72),
})
prueba("f13", {
    "positivos": (([1, 2, 3],), 78),
    "con negativos": (([-1, 2, -3, 4],), 78),
})
prueba("f14", {
    "positivos": (([1, 2, 3],), 84),
    "con negativos": (([-1, 2, -3, 4],), 84),
})
prueba("f15", {
    "positivos": (([1, 2, 3],), 90),
    "con negativos": (([-1, 2, -3, 4],), 90),
})
prueba("f16", {
    "positivos": (([1, 2, 3],), 96),
    "con negativos": (([-1, 2, -3, 4],), 96),
})
prueba("f17", {
    "positivos": (([1, 2, 3],), 102),
    "con negativos": (([-1, 2, -3, 4],), 102),
})
prueba("f18", {
    "positivos": (([1, 2, 3],), 108),
    "con negativos": (([-1, 2, -3, 4],), 108),
})
prueba("f19", {
    "positivos": (([1, 2, 3],), 114),
    "con negativos": (([-1, 2, -3, 4],), 114),
})
prueba("f20", {
    "positivos": (([1, 2, 3],), 120),
    "con negativos": (([-1, 2, -3, 4],), 120),
})
prueba("f21", {
    "positivos": (([1, 2, 3],), 126),
    "con negativos": (([-1, 2, -3, 4],), 126),
})
prueba("f22", {
    "positivos": (([1, 2, 3],), 132),
    "con negativos": (([-1, 2, -3, 4],), 132),
})
prueba("f23", {
    "positivos": (([1, 2, 3],), 138),
    "con negativos": (([-1, 2, -3, 4],), 138),
})
prueba("f24", {
    "positivos": (([1, 2, 3],), 144),
    "con negativos": (([-1, 2, -3, 4],), 144),
})
prueba("f25", {
    "positivos": (([1, 2, 3],), 150),
    "con negativos": (([-1, 2, -3, 4],), 150),
})
prueba("f26", {
    "positivos": (([1, 2, 3],), 156),
    "con negativos": (([-1, 2, -3, 4],), 156),
})
prueba("f27", {
    "positivos": (([1, 2, 3],), 162),
    "con negativos": (([-1, 2, -3, 4],), 162),
})
prueba("f28", {
    "positivos": (([1, 2, 3],), 168),
    "con negativos": (([-1, 2, -3, 4],), 168),
})
prueba("f29", {
    "positivos": (([1, 2, 3],), 174),
    "con negativos": (([-1, 2, -3, 4],), 174),
})
prueba("f30", {
    "positivos": (([1, 2, 3],), 180),
    "con negativos": (([-1, 2, -3, 4],), 180),
})
