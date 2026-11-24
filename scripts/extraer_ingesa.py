"""Extrae recursos y actividad por ciudad de la Memoria INGESA 2025 (pp. 18, 50 y 52)."""

from __future__ import annotations

import json
import re
import urllib.request

import pdfplumber

from extraer_resultados import RAIZ

URL = "https://ingesa.sanidad.gob.es/ingesa/ca/dam/jcr%3Abdd7adc8-1d3c-4710-8efc-ee0c204da611/MemoriaINGESA2025.pdf"
PDF = RAIZ / "datos-originales" / "memoria-ingesa-2025.pdf"
SALIDA = RAIZ / "src" / "data" / "ingesa.json"
IDS = {"CEUTA": "CE", "MELILLA": "ML"}
ANIOS = list(range(2019, 2026))


def enteros(texto: str) -> list[int]:
    return [int(valor.replace(".", "")) for valor in re.findall(r"\d[\d.]*", texto)]


def series(texto: str, patron: str) -> dict[str, dict[str, list[int]]]:
    datos = {c: {} for c in IDS.values()}
    trozos = re.split(patron, texto)
    if len(trozos) != 7 or "2019" not in texto or "2025" not in texto:
        raise ValueError("No se encuentran las tres tablas esperadas de atención primaria")
    for nombre, tabla in zip(trozos[1::2], trozos[2::2], strict=True):
        clave = {"MEDICINA DE FAMILIA": "familia", "PEDIATRÍA": "pediatria", "ENFERMERÍA": "enfermeria"}[nombre]
        for ciudad, c in IDS.items():
            fila = re.search(rf"^{ciudad} (.*)$", tabla, re.M)
            valores = enteros(fila[1])[:len(ANIOS)] if fila else []
            if len(valores) != len(ANIOS) or any(v <= 0 for v in valores):
                raise ValueError(f"Serie incompleta de {ciudad}, {nombre}")
            datos[c][clave] = valores
        if patron.startswith("NÚMERO"):
            total = re.search(r"^INGESA (.*)$", tabla, re.M)
            total_publicado = enteros(total[1])[:len(ANIOS)] if total else []
            if [a + b for a, b in zip(datos["CE"][clave], datos["ML"][clave], strict=True)] != total_publicado:
                raise ValueError(f"Las consultas de {nombre} no suman el total de INGESA")
    return datos


def main() -> None:
    if not PDF.exists():
        peticion = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(peticion, timeout=90) as respuesta:
            PDF.write_bytes(respuesta.read())
    profesiones = "(MEDICINA DE FAMILIA|PEDIATRÍA|ENFERMERÍA)"
    with pdfplumber.open(PDF) as pdf:
        ratios = series(pdf.pages[19].extract_text(), rf"(?m)^{profesiones}$")
        consultas = series(pdf.pages[53].extract_text(), rf"NÚMERO DE CONSULTAS [–-] {profesiones}")
        recursos = pdf.pages[51].extract_text().split("DISTRIBUCIÓN DE RECURSOS POR CIUDADES")[1]

    inventario = {}
    for nombre, c in (IDS | {"INGESA": "total"}).items():
        fila = re.search(rf"^\d {nombre} ([\d. ]+)$", recursos, re.M)
        _, hospitales, instaladas, camas, quirofanos, _ = enteros(fila[1])
        inventario[c] = {"hospitales": hospitales, "camas": camas, "quirofanos": quirofanos}
        if camas > instaladas:
            raise ValueError(f"Camas en funcionamiento superiores a las instaladas en {nombre}")
    for k, total in inventario["total"].items():
        if inventario["CE"][k] + inventario["ML"][k] != total:
            raise ValueError(f"El inventario de {k} no cuadra con el total de INGESA")

    datos = {"anio": 2025, "aniosPrimaria": ANIOS, "url": URL, "ciudades": {
        c: {"ratios": ratios[c], "consultas": consultas[c], "hospitales": inventario[c]} for c in IDS.values()
    }}
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}; consultas y recursos de las ciudades cuadran con INGESA")


if __name__ == "__main__":
    main()
