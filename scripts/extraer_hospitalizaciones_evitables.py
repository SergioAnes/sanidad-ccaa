"""Lee las exportaciones anuales de iCMBD del indicador PQI 92 (hospitalizaciones crónicas)."""

from __future__ import annotations

import csv
import json
import re

from extraer_resultados import ORDEN, RAIZ, territorio

ORIGEN = RAIZ / "datos-originales" / "rae-cmbd" / "icmbd-pqi"
SALIDA = RAIZ / "src" / "data" / "hospitalizaciones-evitables.json"
URL = "https://icmbd.sanidad.gob.es/icmbd/inicioIndicador_13_13006.do"
FICHA = "https://icmbd.sanidad.gob.es/recursos/docs/fichas-indicadores.xlsx"
IDS = [c for c, _ in ORDEN]
CIUDADES = ["CE", "ML"]
ANIOS = list(range(2017, 2024))


def numero(texto: str) -> float:
    return float(texto.replace(".", "").replace(",", "."))


def leer(anio: int) -> dict[str, tuple[int, int, float]]:
    f = ORIGEN / f"pqi92-{anio}.csv"
    texto = f.read_text(encoding="utf-8-sig")
    if ("PQI 92" not in texto or "Comunidad Autónoma del Hospital" not in texto or "Filtro: Ninguno" not in texto
            or not re.search(rf"Año:\s*{anio}\b", texto) or "Tasa ajustada por diez mil" not in texto):
        raise ValueError(f"No es la exportación PQI 92 por comunidad del hospital, sin filtro, de {anio}")
    datos = {}
    for fila in csv.reader(texto.splitlines(), delimiter=";"):
        if len(fila) != 9 or not (fila[0].isdigit() or fila[1] == "Total Altas"):
            continue
        c = "ES" if fila[1] == "Total Altas" else territorio(fila[1], incluir_ciudades=True)
        if c is None or c in datos:
            raise ValueError(f"Territorio inesperado o repetido: {fila[1]}")
        altas, poblacion = (int(v.replace(".", "")) for v in fila[2:4])
        bruta, ajustada = map(numero, fila[4:6])
        if not (poblacion > 0 and 0 <= altas <= poblacion and 0 <= ajustada <= 10_000 and abs(altas / poblacion * 10_000 - bruta) < 0.005001):
            raise ValueError(f"Tasa bruta incoherente o tasa ajustada fuera de rango: {c}, {anio}")
        datos[c] = altas, poblacion, ajustada
    if set(datos) != {*IDS, *CIUDADES, "ES"}:
        raise ValueError(f"Cobertura territorial incompleta en {anio}")
    for i, campo in enumerate(("altas", "población")):
        if sum(datos[c][i] for c in IDS + CIUDADES) != datos["ES"][i]:
            raise ValueError(f"No coincide el total de {campo} en {anio}")
    return datos


def main() -> None:
    valores = {a: leer(a) for a in ANIOS}
    datos = {"anios": ANIOS, "valor": {c: [valores[a][c][2] for a in ANIOS] for c in IDS},
             "espana": [valores[a]["ES"][2] for a in ANIOS],
             "ciudades": {c: [valores[a][c][2] for a in ANIOS] for c in CIUDADES},
             "fuente": URL, "ficha": FICHA}
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}; altas y población cuadran con España, y la tasa bruta con su cociente")


if __name__ == "__main__":
    main()
