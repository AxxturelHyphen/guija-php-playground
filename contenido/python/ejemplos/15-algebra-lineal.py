"""
TEMA 15 · ÁLGEBRA LINEAL PARA ML
─────────────────────────────────────────────────────────────────
Casi todo el aprendizaje automático es álgebra lineal con nombres nuevos: un embedding es un vector, una capa de red es una
matriz, ajustar un modelo lineal es proyectar, PageRank es un autovector y PCA es una SVD. Esta lección va de la intuición
geométrica (qué HACE una matriz) al algoritmo: producto escalar y proyección, la matriz como transformación, mínimos cuadrados,
autovectores con la iteración de potencias, y la SVD con su consecuencia práctica, la aproximación de rango bajo y PCA.

  Concepto               Qué es                                               Trampa típica
  producto escalar,      u·v = |u||v|cosθ: cuánto de u apunta hacia v; el      el coseno ignora la magnitud (10·v tiene cos 1 con v);
  coseno                 coseno mide solo el ángulo                           con un vector nulo es 0/0; en alta dimensión casi todo es casi ortogonal
  proyección             proy_v(u) = (u·v / v·v)·v: el punto de la recta de v   u·v/|v| es la LONGITUD con signo, no el vector; el residuo
                         más cercano a u; el residuo u − proy es ⟂ v          es perpendicular a v, no a u
  matriz = transformación columna j de A = A·e_j (adónde va la base); A·x es     det = factor de área CON signo (<0 invierte la orientación);
  lineal, det, rango     combinación de columnas; rango = dim de la imagen    det = 0 ⇔ rango < n: colapsa y no hay inversa; A@B ≠ B@A
  capa de red            W @ x + b es afín; sin no linealidad, W₂(W₁x+b₁)+b₂   una capa n → m con m < n pierde información: rango ≤ m,
                         = (W₂W₁)x + (W₂b₁+b₂): dos capas serían una          no es inyectiva
  mínimos cuadrados      minimizar |Ax − b|: Ax̂ es la proyección de b sobre     formar AᵀA eleva el número de condición AL CUADRADO;
                         col(A), el residuo es ⟂ col(A) ⇒ AᵀA x̂ = Aᵀb        con columnas dependientes AᵀA es singular
  autovector             Av = λv: la matriz solo ESTIRA esa dirección;         eigh devuelve los autovalores en orden CRECIENTE; el signo
                         simétrica ⇒ autovectores ortonormales (A = QΛQᵀ)     del autovector es arbitrario; eig general puede dar complejos
  iteración de potencias v ← Av/|Av| converge al autovector dominante con    no converge si |λ₁| = |λ₂| ([[0,1],[1,0]]: λ = ±1) ni si v₀
                         razón |λ₂/λ₁| por paso (PageRank)                    es perpendicular al autovector dominante
  SVD, Eckart–Young      A = UΣVᵀ = Σ σᵢ uᵢvᵢᵀ; la mejor aproximación de rango k   los signos de uᵢ y vᵢ son arbitrarios (cambian a la vez);
                         es la suma de los k primeros y falla en √Σσᵢ² (i>k)  np.linalg.svd devuelve Vᵀ, no V
  PCA                    SVD de los datos CENTRADOS: filas de Vᵀ = ejes,       sin restar la media, la 1ª componente apunta a la media
                         varianza de cada eje = σᵢ²/(n−1)                     en vez de a la dirección de máxima dispersión

Costes: producto escalar O(n); A@x O(mn); A@B O(mnp); eliminación gaussiana O(n³) y sustitución hacia atrás O(n²); ecuaciones
normales O(mn² + n³), QR O(mn²); iteración de potencias O(n²) por paso (O(aristas) en grafos dispersos: por eso escala PageRank);
SVD O(mn·min(m, n)); la aproximación de rango k guarda k(m + n + 1) números en vez de m·n.
"""
import math

import matplotlib.pyplot as plt
import numpy as np


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. VECTORES: PRODUCTO ESCALAR, NORMA, COSENO Y PROYECCIÓN
# ═════════════════════════════════════════════════════════════════
# u·v = Σ uᵢvᵢ = |u||v|cosθ. Leído como geometría: u·v̂ (con v̂ = v/|v|) es la longitud de la sombra de u sobre la recta de v.
# La norma sale del propio producto: |u| = √(u·u). Y |cosθ| ≤ 1 es la desigualdad de Cauchy–Schwarz: |u·v| ≤ |u||v|.
titulo('1. Vectores')

u, v = np.array([3.0, 4.0]), np.array([4.0, -1.0])
print('|u| =', np.linalg.norm(u), '= √(u·u) =', math.sqrt(u @ u), '· (1, 2)·(−2, 1) =', np.array([1, 2]) @ np.array([-2, 1]), '(perpendiculares)')
e, w = np.array([3.0, 0.0]), 2 * np.array([math.cos(math.pi / 3), math.sin(math.pi / 3)])         # w: norma 2, a 60° de e
print(f'e·w = {e @ w:.4f} = |e||w|cos60° = {3 * 2 * math.cos(math.pi / 3):.4f} · sombra de e sobre w: e·ŵ = {e @ w / np.linalg.norm(w):.4f} = 3·cos60°')

rng = np.random.default_rng(0)
a, b = rng.normal(size=(2, 1000, 5))
prod, norma = (a * b).sum(axis=1), np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1)
print(f'1000 pares aleatorios en R⁵: |u·v| ≤ |u||v| siempre: {bool(np.all(np.abs(prod) <= norma))} · cos en [{(prod / norma).min():.2f}, {(prod / norma).max():.2f}]')

# Similitud coseno entre embeddings: compara DIRECCIONES. Ejes de este juguete: (realeza, género, fruta).
palabras = ['rey', 'reina', 'hombre', 'mujer', 'manzana']
E = np.array([[0.9, 0.9, 0.0], [0.9, -0.9, 0.0], [0.1, 0.9, 0.0], [0.1, -0.9, 0.0], [0.0, 0.1, 1.0]])
En = E / np.linalg.norm(E, axis=1, keepdims=True)
print('\ncosenos (todos los pares de una vez: En @ Enᵀ):\n' + '\n'.join(f'{p:>8} ' + ' '.join(f'{c:6.2f}' for c in fila) for p, fila in zip(palabras, En @ En.T)))
q = E[0] - E[2] + E[3]                                          # rey − hombre + mujer
print('rey − hombre + mujer se parece más a:', palabras[int(np.argmax(En @ (q / np.linalg.norm(q))))])
print(f'10·rey: cos con rey = {(10 * E[0]) @ E[0] / (10 * E[0] @ E[0]):.1f} pero distancia = {np.linalg.norm(10 * E[0] - E[0]):.1f}; con vectores unitarios |u − v|² = 2 − 2cos: '
      f'{np.sum((En[0] - En[1]) ** 2):.4f} = {2 - 2 * En[0] @ En[1]:.4f}')

# Proyección de u sobre la recta de v: p = (u·v / v·v)·v, y el residuo r = u − p cumple r ⟂ v (Pitágoras: |u|² = |p|² + |r|²).
p = (u @ v) / (v @ v) * v
r = u - p
print(f'\nproy_v(u) = {p.round(4)} · residuo = {r.round(4)} · r·v = {r @ v:.1e} · |u|² = {u @ u:.1f} = |p|² + |r|² = {p @ p + r @ r:.1f}')
# Alta dimensión: dos vectores aleatorios son casi ortogonales (|cos| ≈ 0.8/√d). Por eso en 1000 dimensiones «parecido» es raro.
for d in (2, 100, 10_000):
    a, b = rng.normal(size=(2, 200, d))
    print(f'd = {d:6d}: |cos| medio entre vectores aleatorios = {np.abs((a * b).sum(axis=1) / (np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1))).mean():.4f}')


# ═════════════════════════════════════════════════════════════════
# 2. UNA MATRIZ ES UNA TRANSFORMACIÓN LINEAL
# ═════════════════════════════════════════════════════════════════
# A·x = x₁·(col 1) + x₂·(col 2): las columnas son las imágenes de la base canónica, y la linealidad hace el resto.
# El cuadrado unidad (generado por e₁ y e₂) se convierte en el paralelogramo generado por las columnas; su área es |det A|.
titulo('2. La matriz como transformación')

A = np.array([[2.0, 1.0], [0.0, 1.5]])
x, y = np.array([3.0, 2.0]), np.array([-1.0, 0.5])
print('A@e₁ =', A @ [1, 0], 'y A@e₂ =', A @ [0, 1], '(las columnas) · A@x =', A @ x, '= 3·col₁ + 2·col₂ =', 3 * A[:, 0] + 2 * A[:, 1])
print('linealidad A(2x + y) = 2Ax + Ay:', np.allclose(A @ (2 * x + y), 2 * A @ x + A @ y))

cuadrado = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=float).T          # 2×4: una columna por esquina


def area_poligono(P):
    """Fórmula del cordón (shoelace) para los vértices en las columnas de P."""
    xs, ys = P
    return abs(float(np.sum(xs * np.roll(ys, -1) - np.roll(xs, -1) * ys))) / 2


c, s = math.cos(math.radians(30)), math.sin(math.radians(30))
B = np.array([[1.0, 2.0], [0.5, 1.0]])                                           # segunda columna = 2·primera
print(f'\n{"matriz":>16} {"det":>6} {"área de la imagen":>18} {"rango":>6}')
for nombre, M in (('A', A), ('rotación 30°', np.array([[c, -s], [s, c]])), ('reflexión', np.diag([1.0, -1.0])), ('B (singular)', B)):
    print(f'{nombre:>16} {np.linalg.det(M):6.2f} {area_poligono(M @ cuadrado):18.2f} {np.linalg.matrix_rank(M):6d}')
print('B@[2, −1] =', B @ [2, -1], '→ el núcleo de B es una recta: todo ese eje se aplasta en 0 (rango + dim núcleo = n)')

fig, ejes = plt.subplots(1, 2, figsize=(10, 4.2))
for ax, M, texto in zip(ejes, (A, B), (f'A: det = {np.linalg.det(A):.1f}, rango 2', f'B: det = {np.linalg.det(B):.1f}, rango 1 (se aplasta)')):
    ax.fill(*cuadrado, alpha=0.3, color='tab:gray', label='cuadrado unidad')
    ax.fill(*(M @ cuadrado), alpha=0.35, color='tab:blue', label='imagen')
    for j, color in enumerate(('tab:red', 'tab:green')):                         # las columnas: adónde van e₁ y e₂
        ax.annotate('', xy=M[:, j], xytext=(0, 0), arrowprops=dict(arrowstyle='->', color=color, lw=2))
    ax.set_aspect('equal')
    ax.set_title(texto, fontsize=10)
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8, loc='upper left')
fig.tight_layout()
plt.show()                                                                       # la gráfica aparece en el panel Salida

# Una capa de red es W @ x + b. Apilar capas SIN no linealidad no añade nada: componer transformaciones afines da otra afín.
W1, b1, W2, b2 = rng.normal(size=(3, 2)), rng.normal(size=3), rng.normal(size=(2, 3)), rng.normal(size=2)      # 2 → 3 → 2
print('\ndos capas lineales = una capa (W₂W₁, W₂b₁ + b₂):', np.allclose(W2 @ (W1 @ x + b1) + b2, (W2 @ W1) @ x + (W2 @ b1 + b2)))
X = rng.normal(size=(5, 2))                                                      # lote de 5 entradas, una por FILA: X @ Wᵀ + b
print('lote: X @ W₁ᵀ + b₁ tiene shape', (X @ W1.T + b1).shape, '· rango de W₁@W₂ (3×3) =', np.linalg.matrix_rank(W1 @ W2), '(el cuello 2 limita)')


# ═════════════════════════════════════════════════════════════════
# 3. MÍNIMOS CUADRADOS: PROYECTAR SOBRE EL ESPACIO DE COLUMNAS
# ═════════════════════════════════════════════════════════════════
# Ax = b con más ecuaciones que incógnitas casi nunca tiene solución: b no está en col(A). Lo mejor es el punto Ax̂ de col(A) más
# cercano a b, que es la proyección de b: el residuo r = b − Ax̂ es perpendicular a CADA columna, Aᵀr = 0, es decir AᵀA x̂ = Aᵀb
# (las ecuaciones normales; equivale a anular el gradiente 2Aᵀ(Ax − b) de |Ax − b|², lección 14).
titulo('3. Mínimos cuadrados')

t = np.linspace(0, 1, 20)
A = np.column_stack([np.ones_like(t), t, t ** 2])                                # ajustar y ≈ c₀ + c₁t + c₂t²: 20 ecuaciones, 3 incógnitas
y = 1 + 2 * t - 3 * t ** 2 + 0.05 * rng.normal(size=t.size)
xn = np.linalg.solve(A.T @ A, A.T @ y)
r = y - A @ xn
print('coeficientes (ecuaciones normales):', xn.round(3), '· np.linalg.lstsq:', np.linalg.lstsq(A, y, rcond=None)[0].round(3))
print(f'Aᵀr = {np.abs(A.T @ r).max():.1e} (el residuo es ⟂ a cada columna) · |y|² = {y @ y:.4f} = |Ax̂|² + |r|² = {(A @ xn) @ (A @ xn) + r @ r:.4f}')
print(f'|r| = {np.linalg.norm(r):.4f} < |y − A·x̃| = {np.linalg.norm(y - A @ (xn + 0.01 * rng.normal(size=3))):.4f} para x̃ cerca de x̂ (x̂ es el mínimo)')

# En la práctica NO se resuelven las ecuaciones normales: cond(AᵀA) = cond(A)². Con 10 potencias de t (Vandermonde) y un sistema
# CONSISTENTE con solución conocida (todo unos) el error de cada método se ve sin ruido de por medio.
A = np.vander(np.linspace(0, 1, 30), 10, increasing=True)
y = A @ np.ones(10)
Q, R = np.linalg.qr(A)                                                           # A = QR con Q de columnas ortonormales: R x = Qᵀy
print(f'\ncond(A) = {np.linalg.cond(A):.1e} · cond(AᵀA) = {np.linalg.cond(A.T @ A):.1e} (≈ cond(A)²: 13 de 16 dígitos perdidos)')
for nombre, sol in (('ecuaciones normales', np.linalg.solve(A.T @ A, A.T @ y)), ('QR: R x = Qᵀy', np.linalg.solve(R, Q.T @ y)),
                    ('lstsq (SVD)', np.linalg.lstsq(A, y, rcond=None)[0])):
    print(f'{nombre:>20}: error máximo en los coeficientes {np.abs(sol - 1).max():.1e}')
# Las ecuaciones normales dan ~1e-3 y QR/SVD ~1e-10: operar con Q (condición 1) no empeora el problema. np.linalg.lstsq usa la SVD.


# ═════════════════════════════════════════════════════════════════
# 4. AUTOVECTORES E ITERACIÓN DE POTENCIAS
# ═════════════════════════════════════════════════════════════════
# Casi todo vector GIRA al multiplicarlo por A; los autovectores solo se estiran: Av = λv. Si x = Σ cᵢvᵢ, entonces Aᵏx = Σ cᵢλᵢᵏvᵢ:
# el término de mayor |λ| acaba mandando. Repetir v ← Av/|Av| (normalizar evita el desbordamiento) converge a su dirección, y el
# error angular baja ×|λ₂/λ₁| por paso. Es la iteración de potencias, y con la matriz de enlaces de la web es PageRank.
titulo('4. Autovectores')

A = np.array([[2.0, 1.0], [1.0, 2.0]])
lam, Q = np.linalg.eigh(A)                                                       # eigh (simétricas): autovalores CRECIENTES, columnas de Q
for i in range(2):
    print(f'λ = {lam[i]:.0f} · v = {Q[:, i].round(4)} · A@v = {(A @ Q[:, i]).round(4)} = λ·v')
x = np.array([1.0, 0.0])
print(f'x = (1, 0) sí gira: cos(x, Ax) = {x @ (A @ x) / np.linalg.norm(A @ x):.4f}')
print(f'\n{"k":>3} {"tan²θ (θ: ángulo con v₁)":>26} {"(λ₂/λ₁)^(2k)":>14}')
for k in range(6):
    print(f'{k:3d} {(x @ Q[:, 0]) ** 2 / (x @ Q[:, 1]) ** 2:26.6f} {(lam[0] / lam[1]) ** (2 * k):14.6f}')      # |c₁|=|c₂| en x: coinciden exactamente
    x = A @ x / np.linalg.norm(A @ x)

# PageRank: M[i, j] = 1/(enlaces de salida de j) si j enlaza a i. 0→1,2 · 1→2 · 2→0 · 3→0,2 (nadie enlaza a 3).
M = np.array([[0, 0, 1, 0.5], [0.5, 0, 0, 0], [0.5, 1, 0, 0.5], [0, 0, 0, 0]])
G = 0.85 * M + 0.15 / 4                                                          # surfista: 85 % sigue un enlace, 15 % salta a una página al azar
rango_web = np.full(4, 0.25)
for _ in range(100):
    rango_web = G @ rango_web                                                    # G conserva la suma (columnas estocásticas): no hace falta normalizar
lam, V = np.linalg.eig(G)
pr = V[:, lam.real.argmax()].real
print('\nPageRank por potencias:', rango_web.round(4), '· autovector de λ = 1:', (pr / pr.sum()).round(4), '· λ máx =', lam.real.max().round(6))

S = np.array([[4.0, 1.0, 0.0], [1.0, 3.0, 1.0], [0.0, 1.0, 2.0]])
lam, Q = np.linalg.eigh(S)
print('\nsimétrica (teorema espectral): QᵀQ = I:', np.allclose(Q.T @ Q, np.eye(3)), '· S = QΛQᵀ:', np.allclose(Q @ np.diag(lam) @ Q.T, S))
lam_n, V_n = np.linalg.eig(np.array([[1.0, 1.0], [0.0, 2.0]]))
print(f'no simétrica: |cos| entre sus autovectores = {abs(V_n[:, 0] @ V_n[:, 1]):.4f} (no son ortogonales) · rotación 90°: λ =', np.linalg.eigvals(np.array([[0, -1], [1, 0]])))
# Las matrices de covarianza son simétricas (y semidefinidas positivas): sus ejes principales son ortogonales y sus λ son varianzas ≥ 0.


# ═════════════════════════════════════════════════════════════════
# 5. SVD Y PCA
# ═════════════════════════════════════════════════════════════════
# Toda matriz (también rectangular) es A = UΣVᵀ: gira (Vᵀ), estira cada eje σᵢ ≥ 0 y gira (U). Equivale a la suma de matrices de
# rango 1 A = Σ σᵢ uᵢvᵢᵀ, ordenadas por σ decreciente. Eckart–Young: truncar a los k primeros términos da la MEJOR matriz de rango
# k (en norma 2 y Frobenius), y el error son exactamente los σ descartados: |A − A_k|_F = √(Σ_{i>k} σᵢ²), |A − A_k|₂ = σ_{k+1}.
titulo('5. SVD y PCA')

A = rng.normal(size=(5, 3))
U, S, Vt = np.linalg.svd(A, full_matrices=False)                                 # U: 5×3 · S: (3,) decreciente · Vt: 3×3 (devuelve Vᵀ, no V)
print('A = Σ σᵢuᵢvᵢᵀ:', np.allclose(A, sum(S[i] * np.outer(U[:, i], Vt[i]) for i in range(3))), '· σᵢ² = autovalores de AᵀA:', np.allclose(S ** 2, np.linalg.eigvalsh(A.T @ A)[::-1]))
B = np.array([[3.0, 1.0], [0.0, 2.0]])
ang = np.linspace(0, 2 * np.pi, 3600, endpoint=False)
largos = np.linalg.norm(B @ np.array([np.cos(ang), np.sin(ang)]), axis=0)        # |Bx| sobre la circunferencia unidad: la imagen es una elipse
print(f'|Bx| con |x| = 1: máx {largos.max():.3f}, mín {largos.min():.3f} = semiejes de la elipse = σ(B) = {np.linalg.svd(B, compute_uv=False).round(3)}')

A = rng.normal(size=(60, 3)) @ rng.normal(size=(3, 40)) + 0.1 * rng.normal(size=(60, 40))        # estructura de rango 3 + ruido
U, S, Vt = np.linalg.svd(A, full_matrices=False)
print(f'\n{"k":>3} {"|A−A_k|_F":>10} {"√Σσ² desc.":>11} {"|A−A_k|₂":>9} {"σ_(k+1)":>8} {"memoria":>8}')
for k in (1, 2, 3, 5, 10):
    Ak = (U[:, :k] * S[:k]) @ Vt[:k]
    print(f'{k:3d} {np.linalg.norm(A - Ak):10.4f} {np.sqrt(np.sum(S[k:] ** 2)):11.4f} {np.linalg.norm(A - Ak, 2):9.4f} {S[k]:8.4f} {k * (60 + 40 + 1) / (60 * 40):8.1%}')
# El error cae en picado al llegar a k = 3 (el rango de la estructura) y después es solo ruido: con el 13 % de la memoria se retiene casi todo.

# PCA: centrar y hacer la SVD. Como XcᵀXc/(n−1) = V Σ² Vᵀ/(n−1), las filas de Vᵀ son los autovectores de la covarianza y σᵢ²/(n−1) las varianzas.
rng = np.random.default_rng(3)
X = rng.normal(size=(300, 2)) @ np.array([[2.0, 1.2], [0.0, 0.6]]) + np.array([5.0, 3.0])       # nube correlacionada con media (5, 3)
mu = X.mean(axis=0)
_, S, Vt = np.linalg.svd(X - mu, full_matrices=False)
var = S ** 2 / (len(X) - 1)
val, vec = np.linalg.eigh(np.cov(X.T))
print(f'\nvarianzas σ²/(n−1) = {var.round(3)} · autovalores de la covarianza = {val[::-1].round(3)} · |cos| entre ejes = {abs(Vt[0] @ vec[:, 1]):.6f}')
print(f'varianza explicada: {(var / var.sum()).round(3)} · sin centrar, la 1ª componente apunta a la media: |cos| = {abs(np.linalg.svd(X, full_matrices=False)[2][0] @ mu) / np.linalg.norm(mu):.4f}')
Z = (X - mu) @ Vt[0]                                                             # coordenada en el eje 1: 2 números → 1 por muestra
print(f'error de reconstrucción con 1 componente = {np.sum(((X - mu) - np.outer(Z, Vt[0])) ** 2) / (len(X) - 1):.4f} = varianza descartada {var[1]:.4f}')

fig, ax = plt.subplots(figsize=(6.5, 5))
ax.scatter(*X.T, s=8, alpha=0.45, color='tab:gray')
for i, color in enumerate(('tab:red', 'tab:green')):                             # ejes de longitud 2σ (σ = desviación típica en esa dirección)
    ax.annotate('', xy=mu + 2 * np.sqrt(var[i]) * Vt[i], xytext=mu, arrowprops=dict(arrowstyle='->', color=color, lw=2.5))
    ax.text(*(mu + 2.25 * np.sqrt(var[i]) * Vt[i]), f'PC{i + 1}: {var[i] / var.sum():.0%}', color=color, ha='center')
ax.plot(*mu, 'k+', markersize=12)
ax.set_aspect('equal')
ax.set_title('PCA de una nube 2D: ejes = filas de Vᵀ, longitud 2σ, % de varianza explicada')
ax.grid(alpha=0.3)
plt.show()


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · coseno ────────────────────────────────────────
def coseno(u, v) -> float:
    """
    Coseno del ángulo entre u y v (similitud coseno). Devuelve float.
    Especificación exacta:
      - u y v son secuencias 1-D de números (list o ndarray); se convierten a float. Distinta longitud → ValueError.
      - Si u o v tiene norma 0 el coseno no existe (0/0) → ValueError.
      - El resultado se recorta a [-1, 1]: el redondeo puede dar 1.0000000000000002 y un arccos posterior fallaría.
      coseno([1, 0], [1, 1]) → 0.7071067811865476 · coseno([1, 2], [-2, 1]) → 0.0 · coseno([1, 1], [10, 10]) → 1.0
    Coste: O(n).
    """
    pendiente()


# ── Ejercicio 2 · proyeccion ────────────────────────────────────
def proyeccion(u, v) -> np.ndarray:
    """
    Proyección ortogonal del vector u sobre la recta generada por v: (u·v / v·v)·v. Devuelve ndarray float de la forma de u.
    Especificación exacta:
      - u y v son secuencias 1-D (list o ndarray), se convierten a float. Distinta longitud → ValueError.
      - v con norma 0 (no define una recta) → ValueError.
      - No modifica u ni v. El residuo u − proyeccion(u, v) debe quedar perpendicular a v.
      proyeccion([3, 4], [1, 0]) → [3., 0.] · proyeccion([2, 2], [0, 5]) → [0., 0.] · proyeccion([1, 1], [2, 2]) → [1., 1.]
    Coste: O(n).
    """
    pendiente()


# ── Ejercicio 3 · resolver ──────────────────────────────────────
def resolver(A, b) -> np.ndarray:
    """
    Resuelve A x = b por eliminación gaussiana con pivoteo parcial (SIN np.linalg.solve ni inv). Devuelve ndarray float de forma (n,).
    Especificación exacta:
      - A de forma (n, n) y b de forma (n,) (list o ndarray); otra forma o tamaños que no cuadran → ValueError.
      - Trabaja sobre COPIAS en float (con enteros, la división truncaría) y no modifica A ni b.
      - Para cada columna k: pivote = la fila i ≥ k con mayor |A[i, k]|, se intercambia con la fila k y se anula la columna por debajo.
        Si ese |pivote| <= 1e-12 · max|A| (o A es todo ceros) la matriz es singular → ValueError.
      - Después sustitución hacia atrás. Elegir el pivote MAYOR (no el primero no nulo) es lo que evita dividir por ~1e-20.
      resolver([[2, 1], [1, 3]], [3, 5]) → [0.8, 1.4] · resolver([[0, 1], [1, 0]], [2, 3]) → [3., 2.] · resolver([[1, 2], [2, 4]], [1, 2]) → ValueError
    Coste: O(n³) la eliminación, O(n²) la sustitución.
    """
    pendiente()


# ── Ejercicio 4 · minimos_cuadrados ─────────────────────────────
def minimos_cuadrados(A, b) -> np.ndarray:
    """
    Solución de mínimos cuadrados de A x ≈ b por las ecuaciones normales AᵀA x = Aᵀb. Devuelve ndarray float de forma (n,).
    Especificación exacta:
      - A de forma (m, n) y b de forma (m,) (list o ndarray); otra forma o tamaños que no cuadran → ValueError.
      - Exige m >= n y rango(A) = n (columnas independientes, np.linalg.matrix_rank); si no → ValueError (AᵀA sería singular).
      - Decisión: resuelve el sistema con np.linalg.solve y no con tu `resolver`, para que el ejercicio no dependa del anterior.
        (Para producción se usaría QR o lstsq: ver la sección 3.)
      minimos_cuadrados([[1, 0], [1, 1], [1, 2]], [6, 0, 0]) → [5., -3.]  (la recta y = 5 − 3t por los puntos (0,6), (1,0), (2,0))
    Coste: O(mn² + n³).
    """
    pendiente()


# ── Ejercicio 5 · autovalor_dominante ───────────────────────────
def autovalor_dominante(A, iteraciones: int = 1000, semilla: int = 0) -> tuple:
    """
    Autovalor de mayor módulo y su autovector por iteración de potencias. Devuelve (lambda, v): float y ndarray de forma (n,).
    Especificación exacta:
      - A cuadrada (list o ndarray) → si no, ValueError.
      - v₀ = np.random.default_rng(semilla).normal(size=n) normalizado a norma 1. Se repite `iteraciones` veces:
        w = A @ v; si |w| == 0 → ValueError (v cayó en el núcleo); v = w / |w|.
      - λ = v · (A @ v) (cociente de Rayleigh con |v| = 1; sirve también con λ negativo, donde v alterna de signo).
      - Signo canónico: v se devuelve con su primera componente de |vᵢ| > 1e-6 POSITIVA (el signo de un autovector es arbitrario).
      - No comprueba convergencia: con |λ₁| = |λ₂| no converge, y es cosa de quien llama.
      autovalor_dominante([[2, 1], [1, 2]]) → (3.0, [0.7071, 0.7071]) · autovalor_dominante([[2, 0], [1, 3]]) → (3.0, [0., 1.])
    Coste: O(iteraciones · n²).
    """
    pendiente()


# ── Ejercicio 6 · pca ───────────────────────────────────────────
def pca(X, k: int) -> tuple:
    """
    PCA por SVD de los datos centrados. Devuelve (componentes, varianza): ndarray (k, d) y ndarray (k,).
    Especificación exacta:
      - X de forma (n, d), una muestra por fila, con n >= 2 (list o ndarray). 1 <= k <= min(n, d); si no → ValueError.
      - Se resta la media de cada columna (sin modificar X) y se hace np.linalg.svd(..., full_matrices=False).
      - componentes = las k primeras filas de Vᵀ (orden de varianza decreciente), cada una con su primera componente de
        |c| > 1e-6 POSITIVA (signo canónico). varianza[i] = σᵢ² / (n − 1) (varianza muestral de los datos sobre ese eje).
      pca([[0, 0], [1, 2], [2, 4]], 1) → ([[0.4472, 0.8944]], [2.5])
    Coste: O(n·d·min(n, d)).
    """
    pendiente()


# ── Ejercicio 7 · aproximacion_rango ────────────────────────────
def aproximacion_rango(A, k: int) -> np.ndarray:
    """
    Mejor aproximación de rango k de A (Eckart–Young): suma de los k primeros términos σᵢ uᵢ vᵢᵀ de la SVD. Devuelve ndarray float (m, n).
    Especificación exacta:
      - A de forma (m, n) (list o ndarray); otra dimensión → ValueError. 0 <= k <= min(m, n); si no → ValueError.
      - k = 0 devuelve la matriz de ceros de la forma de A; k = min(m, n) reconstruye A.
      - Usa np.linalg.svd(A, full_matrices=False); el resultado tiene rango k y |A − A_k|_F = √(Σ_{i>k} σᵢ²).
      aproximacion_rango([[3, 0], [0, 1]], 1) → [[3., 0.], [0., 0.]]
    Coste: O(mn·min(m, n)) la SVD; el producto final, O(mnk).
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS (los resultados aproximados se comparan con una tolerancia explícita)
# ═════════════════════════════════════════════════════════════════

def _cerca(tolerancia: float):
    """Comparador para `prueba`: |actual − esperado| <= tolerancia elemento a elemento. Acepta números, ndarrays y tuplas/listas de ellos; la forma debe coincidir."""
    def comparar(actual, esperado) -> bool:
        if isinstance(esperado, (tuple, list)):
            return isinstance(actual, (tuple, list)) and len(actual) == len(esperado) and all(comparar(a, e) for a, e in zip(actual, esperado))
        if isinstance(actual, bool) or not isinstance(actual, (int, float, np.number, np.ndarray)):
            return False
        a, e = np.asarray(actual, dtype=float), np.asarray(esperado, dtype=float)
        return a.shape == e.shape and bool(np.all(np.abs(a - e) <= tolerancia))      # NaN nunca es cercano
    return comparar


def _signo(v) -> np.ndarray:
    """Signo canónico de la referencia: primera componente con |vᵢ| > 1e-6 positiva."""
    v = np.asarray(v, dtype=float)
    return v if v[np.flatnonzero(np.abs(v) > 1e-6)[0]] > 0 else -v


def _ref_pca(X, k):
    """Referencia independiente: autovectores de la covarianza (la solución del ejercicio usa la SVD)."""
    val, vec = np.linalg.eigh(np.cov(np.asarray(X, dtype=float).T))
    orden = np.argsort(val)[::-1][:k]
    return np.array([_signo(vec[:, i]) for i in orden]), val[orden]


gen = np.random.default_rng(42)
M30, b30 = gen.normal(size=(30, 30)), gen.normal(size=30)
A50, b50 = gen.normal(size=(50, 4)), gen.normal(size=50)
Qd, _ = np.linalg.qr(gen.normal(size=(6, 6)))
A_dom = Qd @ np.diag([10.0, 4.0, 3.0, 2.0, 1.0, 0.5]) @ Qd.T                         # autovalores conocidos, cociente |λ₂/λ₁| = 0.4
X3 = gen.normal(size=(200, 3)) * np.array([3.0, 1.0, 0.3]) @ np.linalg.qr(gen.normal(size=(3, 3)))[0] + np.array([4.0, -2.0, 7.0])
A64, Rm = gen.normal(size=(6, 4)), np.array([[1.0, 2.0, 3.0], [2.0, 4.0, 6.0], [1.0, 0.0, 1.0]])
L1 = (-3 - math.sqrt(13)) / 2                                                       # autovalor dominante (negativo) de [[-3, 1], [1, 0]]
U64, S64, V64 = np.linalg.svd(A64, full_matrices=False)

prueba('coseno', {
    'ortogonales': (([1, 0], [0, 1]), 0.0),
    'paralelos del mismo sentido': (([1, 1], [10, 10]), 1.0),
    'opuestos': (([2, 0], [-5, 0]), -1.0),
    '45°': (([1, 0], [1, 1]), math.sqrt(2) / 2),
    '(1, 2) y (−2, 1): perpendiculares': (([1, 2], [-2, 1]), 0.0),
    'en R³': (([1, 2, 3], [4, 5, 6]), 32 / math.sqrt(14 * 77)),
    'ndarray y enteros': ((np.array([3, 4]), np.array([4, 3])), 24 / 25),
    'el redondeo no pasa de 1: (0.1, 0.2, 0.3) con 3 veces él': (([0.1, 0.2, 0.3], [0.3, 0.6, 0.9]), 1.0),
}, comparador=_cerca(1e-12))
grupo('coseno (tipo, rango y errores)')
comprueba('devuelve un float', lambda: type(coseno([1, 2], [3, 4])).__name__, 'float')
comprueba('siempre dentro de [-1, 1] (500 pares aleatorios, d = 7)', lambda: all(-1.0 <= coseno(a, b) <= 1.0 for a, b in gen.normal(size=(500, 2, 7))), True)
comprueba('mismos vectores escalados: cos = 1 exacto o a 1 ulp, nunca > 1', lambda: max(coseno(w, 3.7 * w) for w in gen.normal(size=(300, 5))) <= 1.0, True)
lanza('vector nulo', lambda: coseno([0, 0], [1, 2]), ValueError)
lanza('el otro vector nulo', lambda: coseno([1, 2], [0.0, 0.0]), ValueError)
lanza('longitudes distintas', lambda: coseno([1, 2, 3], [1, 2]), ValueError)

prueba('proyeccion', {
    'sobre el eje x': (([3, 4], [1, 0]), np.array([3.0, 0.0])),
    'v vertical: la componente x desaparece': (([2, 2], [0, 5]), np.array([0.0, 2.0])),
    'u paralelo a v: se queda igual': (([1, 1], [2, 2]), np.array([1.0, 1.0])),
    'la longitud de v no importa (se divide por v·v)': (([3, 4], [10, 0]), np.array([3.0, 0.0])),
    'ejemplo de la teoría: u = (3, 4), v = (4, −1)': (([3, 4], [4, -1]), np.array([32 / 17, -8 / 17])),
    'sentido contrario: proyección negativa': (([-2, 1], [1, 0]), np.array([-2.0, 0.0])),
    'en R³': (([1, 2, 3], [0, 1, 1]), np.array([0.0, 2.5, 2.5])),
}, comparador=_cerca(1e-12))
grupo('proyeccion (residuo, tipo y errores)')
comprueba('el residuo es perpendicular a v (|r·v| < 1e-12, 200 casos en R⁶)', lambda: all(abs((a - proyeccion(a, b)) @ b) < 1e-12 for a, b in gen.normal(size=(200, 2, 6))), True)
comprueba('proyectar dos veces no cambia nada (idempotente)', lambda: np.allclose(proyeccion(proyeccion([1, 5, -2], [2, 1, 1]), [2, 1, 1]), proyeccion([1, 5, -2], [2, 1, 1])), True)
comprueba('no modifica u ni v', lambda: (lambda u, v: (proyeccion(u, v), u.tolist() + v.tolist())[1])(np.array([3.0, 4.0]), np.array([4.0, -1.0])), [3.0, 4.0, 4.0, -1.0])
comprueba('devuelve un ndarray', lambda: type(proyeccion([1, 2], [3, 4])).__name__, 'ndarray')
lanza('v nulo: no define una recta', lambda: proyeccion([1, 2], [0, 0]), ValueError)
lanza('longitudes distintas', lambda: proyeccion([1, 2, 3], [1, 2]), ValueError)

prueba('resolver', {
    '2×2 sencillo': (([[2, 1], [1, 3]], [3, 5]), np.array([0.8, 1.4])),
    'hace falta intercambiar filas: [[0, 1], [1, 0]]': (([[0, 1], [1, 0]], [2, 3]), np.array([3.0, 2.0])),
    'pivote diminuto: sin pivoteo da (0, 1) en vez de (1, 1)': (([[1e-20, 1.0], [1.0, 1.0]], [1.0, 2.0]), np.array([1.0, 1.0])),
    '3×3 clásico': (([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3]), np.array([2.0, 3.0, -1.0])),
    'el pivote cambia a mitad de camino (intercambio en la columna 2)': (([[1, 1, 1], [1, 1, 2], [1, 2, 3]], [6, 9, 14]), np.array([1.0, 2.0, 3.0])),
    'enteros: la división no trunca': (([[2, 0], [0, 3]], [1, 1]), np.array([0.5, 1 / 3])),
    '1×1': (([[4.0]], [2.0]), np.array([0.5])),
    'aleatoria 30×30 frente a np.linalg.solve': ((M30, b30), np.linalg.solve(M30, b30)),
}, comparador=_cerca(1e-8))
grupo('resolver (residuo, copias y matrices singulares)')
comprueba('el residuo |A x − b| es ~0 (30×30)', lambda: np.linalg.norm(M30 @ resolver(M30, b30) - b30) < 1e-9, True)
comprueba('no modifica A ni b', lambda: (lambda A, b: (resolver(A, b), np.array_equal(A, M30) and np.array_equal(b, b30))[1])(M30.copy(), b30.copy()), True)
comprueba('devuelve un ndarray de forma (n,)', lambda: (lambda x: (type(x).__name__, x.shape))(resolver([[1, 0], [0, 1]], [1, 2])), ('ndarray', (2,)))
lanza('singular: filas proporcionales', lambda: resolver([[1, 2], [2, 4]], [1, 2]), ValueError)
lanza('singular: [[1,2,3],[4,5,6],[7,8,9]] (el último pivote es ~1e-16)', lambda: resolver([[1, 2, 3], [4, 5, 6], [7, 8, 9]], [1, 2, 3]), ValueError)
lanza('singular: matriz de ceros', lambda: resolver(np.zeros((3, 3)), [1, 2, 3]), ValueError)
lanza('no cuadrada', lambda: resolver(np.ones((2, 3)), [1, 2]), ValueError)
lanza('b de otro tamaño', lambda: resolver(np.eye(3), [1, 2]), ValueError)

prueba('minimos_cuadrados', {
    'puntos de Strang (0,6), (1,0), (2,0): y = 5 − 3t': (([[1, 0], [1, 1], [1, 2]], [6, 0, 0]), np.array([5.0, -3.0])),
    'datos exactos de una recta: residuo 0': (([[1, 0], [1, 1], [1, 2], [1, 3]], [1, 3, 5, 7]), np.array([1.0, 2.0])),
    'una columna: la media (A = unos)': (([[1], [1], [1], [1]], [2, 4, 6, 8]), np.array([5.0])),
    'cuadrada: coincide con resolver el sistema': (([[2, 1], [1, 3]], [3, 5]), np.array([0.8, 1.4])),
    'aleatoria 50×4 frente a np.linalg.lstsq': ((A50, b50), np.linalg.lstsq(A50, b50, rcond=None)[0]),
}, comparador=_cerca(1e-8))
grupo('minimos_cuadrados (perpendicularidad y errores)')
comprueba('Aᵀ(b − A x̂) = 0: el residuo es perpendicular a las columnas', lambda: np.abs(A50.T @ (b50 - A50 @ minimos_cuadrados(A50, b50))).max() < 1e-9, True)
comprueba('x̂ es mínimo: cualquier perturbación aumenta |Ax − b|', lambda: all(np.linalg.norm(A50 @ (minimos_cuadrados(A50, b50) + d) - b50) > np.linalg.norm(A50 @ minimos_cuadrados(A50, b50) - b50) for d in 0.01 * gen.normal(size=(20, 4))), True)
comprueba('devuelve un ndarray de forma (n,)', lambda: (lambda x: (type(x).__name__, x.shape))(minimos_cuadrados(A50, b50)), ('ndarray', (4,)))
lanza('columnas dependientes: [[1,2],[2,4],[3,6]]', lambda: minimos_cuadrados([[1, 2], [2, 4], [3, 6]], [1, 2, 3]), ValueError)
lanza('menos ecuaciones que incógnitas', lambda: minimos_cuadrados([[1, 2]], [3]), ValueError)
lanza('b de otro tamaño', lambda: minimos_cuadrados(np.ones((3, 2)), [1, 2]), ValueError)

prueba('autovalor_dominante', {
    'simétrica 2×2: λ = 3, v = (1, 1)/√2': (([[2, 1], [1, 2]],), (3.0, np.array([1.0, 1.0]) / math.sqrt(2))),
    'no simétrica: λ = 4, v = (2, 3)/√13': (([[1, 2], [3, 2]],), (4.0, np.array([2.0, 3.0]) / math.sqrt(13))),
    'dominante NEGATIVO: λ = (−3 − √13)/2': (([[-3, 1], [1, 0]],), (L1, np.array([1.0, 3 + L1]) / math.hypot(1.0, 3 + L1))),
    'triangular con v = (0, 1): signo canónico': (([[2, 0], [1, 3]],), (3.0, np.array([0.0, 1.0]))),
    'diagonal 3×3 con un negativo pequeño': (([[5, 0, 0], [0, 2, 0], [0, 0, -1]],), (5.0, np.array([1.0, 0.0, 0.0]))),
    'autovalores 10, 4, 3, 2, 1, 0.5 con Q aleatoria': ((A_dom,), (10.0, _signo(Qd[:, 0]))),
    'PageRank (λ = 1): vector estacionario / |·|': ((G,), (1.0, _signo(pr) / np.linalg.norm(pr))),
}, comparador=_cerca(1e-8))
grupo('autovalor_dominante (propiedades y errores)')
comprueba('devuelve (float, ndarray de norma 1)', lambda: (lambda r: (type(r[0]).__name__, type(r[1]).__name__, bool(abs(np.linalg.norm(r[1]) - 1) < 1e-12)))(autovalor_dominante(A_dom)), ('float', 'ndarray', True))
comprueba('A v = λ v (residuo < 1e-8)', lambda: (lambda r: np.linalg.norm(A_dom @ r[1] - r[0] * r[1]) < 1e-8)(autovalor_dominante(A_dom)), True)
comprueba('la semilla no cambia el resultado (0 y 7)', lambda: np.allclose(autovalor_dominante(A_dom, semilla=7)[1], autovalor_dominante(A_dom, semilla=0)[1], atol=1e-8), True)
comprueba('pocas iteraciones: aún sin converger (razón 0.4, 3 pasos)', lambda: abs(autovalor_dominante(A_dom, iteraciones=3)[0] - 10.0) > 1e-6, True)
lanza('no cuadrada', lambda: autovalor_dominante(np.ones((2, 3))), ValueError)
lanza('matriz nula: A @ v = 0', lambda: autovalor_dominante(np.zeros((3, 3))), ValueError)

prueba('pca', {
    'datos sobre una recta y = 2x: componente (1, 2)/√5, varianza 5·s²(t)': (([[0, 0], [1, 2], [2, 4]], 1), (np.array([[1.0, 2.0]]) / math.sqrt(5), np.array([5.0]))),
    'nube 3D, 2 componentes frente a la covarianza': ((X3, 2), _ref_pca(X3, 2)),
    'nube 3D, 3 componentes': ((X3, 3), _ref_pca(X3, 3)),
    'la media no importa: X + 1000 da lo mismo': ((X3 + 1000, 2), _ref_pca(X3, 2)),
    'lista de listas': (([[1, 0], [-1, 0], [0, 2], [0, -2]], 2), (np.array([[0.0, 1.0], [1.0, 0.0]]), np.array([8 / 3, 2 / 3]))),
}, comparador=_cerca(1e-7))
grupo('pca (invariantes y errores)')
comprueba('componentes ortonormales: C Cᵀ = I', lambda: np.allclose(pca(X3, 3)[0] @ pca(X3, 3)[0].T, np.eye(3), atol=1e-10), True)
comprueba('con k = d las varianzas suman la traza de la covarianza', lambda: abs(pca(X3, 3)[1].sum() - np.trace(np.cov(X3.T))) < 1e-9, True)
comprueba('varianza en orden decreciente', lambda: bool(np.all(np.diff(pca(X3, 3)[1]) <= 0)), True)
comprueba('no modifica X', lambda: (lambda X: (pca(X, 2), np.array_equal(X, X3))[1])(X3.copy()), True)
comprueba('formas: (k, d) y (k,)', lambda: (lambda r: (r[0].shape, r[1].shape))(pca(X3, 2)), ((2, 3), (2,)))
lanza('k = 0', lambda: pca(X3, 0), ValueError)
lanza('k mayor que min(n, d)', lambda: pca(X3, 4), ValueError)
lanza('una sola muestra', lambda: pca([[1.0, 2.0]], 1), ValueError)

prueba('aproximacion_rango', {
    'diagonal: se queda con el σ mayor': (([[3, 0], [0, 1]], 1), np.array([[3.0, 0.0], [0.0, 0.0]])),
    'k = 0: matriz de ceros': ((A64, 0), np.zeros((6, 4))),
    'k = min(m, n) reconstruye A': ((A64, 4), A64),
    'rango 2 con k = 2 es exacta (fila 2 = 2·fila 1)': ((Rm, 2), Rm),
    'k = 2 en 6×4 frente a la suma de términos de la SVD': ((A64, 2), sum(S64[i] * np.outer(U64[:, i], V64[i]) for i in range(2))),
    'rectangular ancha 2×3 con k = 1': (([[1, 2, 2], [2, 4, 4]], 1), np.array([[1.0, 2.0, 2.0], [2.0, 4.0, 4.0]])),
}, comparador=_cerca(1e-9))
grupo('aproximacion_rango (Eckart–Young y errores)')
comprueba('error de Frobenius = √(σ descartados²) para k = 1, 2, 3', lambda: all(abs(np.linalg.norm(A64 - aproximacion_rango(A64, k)) - math.sqrt(np.sum(S64[k:] ** 2))) < 1e-9 for k in (1, 2, 3)), True)
comprueba('error en norma 2 = σ_(k+1)', lambda: abs(np.linalg.norm(A64 - aproximacion_rango(A64, 2), 2) - S64[2]) < 1e-9, True)
comprueba('el resultado tiene rango k', lambda: [int(np.linalg.matrix_rank(aproximacion_rango(A64, k))) for k in range(5)], [0, 1, 2, 3, 4])
comprueba('ninguna matriz de rango 1 aleatoria la mejora (k = 1)', lambda: all(np.linalg.norm(A64 - np.outer(a, b)) >= np.linalg.norm(A64 - aproximacion_rango(A64, 1)) for a, b in zip(gen.normal(size=(50, 6)), gen.normal(size=(50, 4)))), True)
comprueba('devuelve un ndarray con la forma de A', lambda: (lambda R: (type(R).__name__, R.shape))(aproximacion_rango(A64, 2)), ('ndarray', (6, 4)))
lanza('k negativo', lambda: aproximacion_rango(A64, -1), ValueError)
lanza('k mayor que min(m, n)', lambda: aproximacion_rango(A64, 5), ValueError)
lanza('un vector no es una matriz', lambda: aproximacion_rango([1, 2, 3], 1), ValueError)

# ── Medir ───────────────────────────────────────────────────────────────────
# Aquí no hay medir(): resolver es O(n³) pero con numpy por filas su coste real mezcla un término O(n) de intérprete con el O(n²)
# de numpy hasta n grande (el ajuste de O() sería inestable), y el resto delega en LAPACK, cuyo tiempo depende de los hilos del BLAS.
