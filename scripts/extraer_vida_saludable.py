"""Genera la serie de años de vida saludable al nacer publicada por Sanidad."""

from __future__ import annotations

import json

from extraer_resultados import ORDEN, RAIZ

URL = "https://www.sanidad.gob.es/estadEstudios/sistInfSanit/estSalud/Mortalidad_EdV/Esperanzas_vida/docs/Esperanza_vida_2024.pdf#page=47"
CUADRO = "https://www.sanidad.gob.es/estadEstudios/sanidadDatos/tablas/tabla.htm"
SALIDA = RAIZ / "src" / "data" / "vida-saludable.json"
ANIOS = list(range(2006, 2025))

# Transcripción de la tabla 7, p. 47, ambos sexos, de «Esperanzas de vida en España, 2024».
# La fila CEML corresponde a las dos ciudades agrupadas por Sanidad.
TABLA_7 = """\
ES 77.31 77.33 77.23 77.15 77.51 79.31 77.92 78.27 78.41 78.47 79.25 79.17 79.19 79.89 78.69 79.43 79.35 80.07 80.19
AN 76.28 76.28 75.59 74.92 75.27 76.96 75.17 75.36 75.27 76.14 76.29 76.22 76.10 79.48 78.82 78.73 79.00 77.97 78.20
AR 78.40 78.37 79.05 79.54 79.79 80.64 79.67 80.10 79.81 80.27 81.65 81.40 81.57 81.28 79.64 80.54 80.22 81.59 81.66
AS 76.50 76.64 76.95 77.23 77.39 77.30 77.70 78.34 78.21 77.42 77.14 77.29 77.26 78.81 78.08 78.68 78.32 79.33 79.49
IB 76.15 76.46 77.39 78.36 78.78 78.26 78.72 78.82 78.64 79.49 81.39 81.16 81.54 80.46 80.30 80.14 79.59 80.23 79.92
CN 77.35 77.54 76.62 76.66 77.29 76.75 76.98 77.27 76.73 77.33 78.61 78.80 78.40 79.22 79.13 79.02 77.98 78.92 79.19
CB 79.72 79.74 79.16 78.29 78.42 79.26 78.38 78.49 77.90 78.53 80.00 80.08 80.01 79.00 78.44 79.07 78.37 81.30 81.00
CM 78.54 78.32 78.04 77.85 78.20 79.90 78.73 79.08 79.48 79.24 79.96 79.58 79.99 81.51 78.86 80.91 81.10 80.13 80.96
CL 79.43 79.39 79.69 80.12 80.38 81.70 80.18 80.09 79.86 80.36 81.37 81.28 81.29 80.49 78.57 80.23 79.84 80.69 80.13
CT 77.79 77.83 78.36 78.88 79.27 79.69 78.79 78.58 78.26 78.33 78.99 78.84 78.84 81.19 79.36 80.67 80.68 81.01 80.81
VC 75.87 75.90 75.96 76.03 76.26 79.43 77.73 78.66 79.36 79.37 80.06 79.90 79.88 78.54 77.91 77.76 77.92 80.32 80.58
EX 76.18 76.19 76.14 75.57 75.66 77.72 77.51 78.16 79.30 79.21 79.86 79.70 79.91 81.28 80.21 80.63 80.80 80.61 80.60
GA 76.57 76.67 76.20 75.45 75.84 79.23 76.74 77.33 78.01 79.22 80.90 81.26 81.20 78.23 77.99 78.11 77.80 78.22 78.54
MD 79.25 79.27 78.90 78.31 78.77 81.97 79.84 80.38 80.78 80.25 80.81 80.71 80.98 80.41 77.80 80.08 80.04 83.17 83.23
MC 74.82 74.86 74.85 75.13 75.70 79.40 76.32 76.85 77.38 76.30 75.55 75.46 75.55 77.98 77.76 77.67 77.49 79.51 79.98
NC 77.54 77.70 78.16 79.05 79.71 81.89 79.63 79.50 79.50 79.67 79.83 79.81 80.03 81.02 79.61 80.86 80.11 80.20 79.90
PV 78.75 78.59 78.54 78.28 78.69 80.33 79.70 80.57 80.99 80.80 81.47 81.55 81.57 81.09 80.28 80.78 80.46 80.12 80.27
RI 77.04 76.78 77.55 78.76 79.10 79.70 79.16 79.57 79.69 79.69 80.65 80.38 80.24 80.24 78.90 79.60 79.57 80.46 80.12
CEML 71.58 71.81 73.04 74.53 74.96 75.49 75.57 76.03 76.44 76.12 76.55 75.95 76.23 69.91 68.71 68.60 69.54 77.00 77.94
"""

# Último año contrastado con la tabla «Habitantes, envejecimiento e indicadores de bienestar».
ULTIMO = {
    "ES": 80.19, "AN": 78.20, "AR": 81.66, "AS": 79.49, "IB": 79.92, "CN": 79.19, "CB": 81.00,
    "CM": 80.96, "CL": 80.13, "CT": 80.81, "VC": 80.58, "EX": 80.60, "GA": 78.54, "MD": 83.23,
    "MC": 79.98, "NC": 79.90, "PV": 80.27, "RI": 80.12, "CEML": 77.94,
}


def main() -> None:
    ids = [c for c, _ in ORDEN]
    valores = {}
    for fila in TABLA_7.splitlines():
        c, *datos = fila.split()
        serie = [float(v) for v in datos]
        if c in valores or len(serie) != len(ANIOS) or any(not 0 < v < 100 for v in serie):
            raise SystemExit(f"Fila no válida de años de vida saludable: {c}")
        valores[c] = serie
    if set(valores) != {*ids, "ES", "CEML"} or {c: v[-1] for c, v in valores.items()} != ULTIMO:
        raise SystemExit("El territorio o las cifras de 2024 no coinciden con el cuadro oficial de Sanidad")
    datos = {"anios": ANIOS, "valor": {c: valores[c] for c in ids}, "espana": valores["ES"],
             "ceutaMelilla": valores["CEML"], "fuente": URL, "cuadro": CUADRO}
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}; 2024 coincide con el cuadro de Sanidad en todos los territorios")


if __name__ == "__main__":
    main()
