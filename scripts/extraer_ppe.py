"""Población protegida equivalente (PPE) oficial de cada comunidad, 2009 en adelante.

Uso:
    python scripts/extraer_ppe.py

Fuente: certificado del Ministerio de Sanidad «Población protegida equivalente del Sistema Nacional de Salud - 7 tramos
de edad», anexo de la liquidación anual del sistema de financiación autonómica (Ministerio de Hacienda). Es la población
con tarjeta sanitaria de cada comunidad ponderada por edad con los coeficientes del artículo 9 de la Ley 22/2009.
Los PDF van en datos-originales/liquidacion-sfa-anexos-AAAA.pdf (no se suben a git).
  - 2009-2020: escaneados; los totales están transcritos en scripts/ppe_certificados_escaneados.py.
  - 2021 en adelante: se leen del texto del PDF.
Comprobaciones: cada fila suma sus 7 tramos (años con texto) y la suma de los 19 territorios da la fila «Total».

Escribe src/data/poblacion-equivalente.json. Ejecutar ANTES de extraer_egsp.py, que lo usa para el gasto ajustado.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pdfplumber

from ppe_certificados_escaneados import ORDEN, PAGINA, TRANSCRITO

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "datos-originales"
SALIDA = RAIZ / "src" / "data" / "poblacion-equivalente.json"
URL_LIQUIDACIONES = "https://www.hacienda.gob.es/es-ES/CDI/Paginas/SistemasFinanciacionDeuda/InformacionCCAAs/Informes%20financiacion%20comunidades%20autonomas2.aspx"
URL_LEY = "https://www.boe.es/buscar/act.php?id=BOE-A-2009-20375"
# Comienzo de las filas del certificado, en el orden de ORDEN
NOMBRES = ["Andaluc", "Arag", "Asturias", "Balears", "Canarias", "Cantabria", "Castilla y Le", "Castilla-La Mancha",
           "Cataluña", "Comunidad Valenciana", "Extremadura", "Galicia", "Madrid", "Murcia", "Navarra", "País Vasco",
           "Rioja", "Ceuta", "Melilla"]


def leer_texto(anio: int) -> tuple[dict[str, int], int]:
    """Lee el certificado de un año con texto. Devuelve ({territorio: PPE}, página)."""
    with pdfplumber.open(ORIGEN / f"liquidacion-sfa-anexos-{anio}.pdf") as pdf:
        pagina, texto = next((i + 1, t) for i, p in enumerate(pdf.pages)
                             if re.search(r"PROTEGIDA\s+EQUIVALENTE", t := p.extract_text() or "") and "Andaluc" in t)
    filas: dict[str, int] = {}
    for linea in texto.splitlines():
        # Algunas filas salen con espacios dentro de los números («6 6.186», «3 .923»): se unen los trozos y la
        # comprobación de que la fila suma sus tramos valida el resultado.
        unidos: list[str] = []
        for x in linea.split():
            if unidos and (re.fullmatch(r"\d", unidos[-1]) and re.match(r"[\d.]", x) or x.startswith(".")):
                unidos[-1] += x
            else:
                unidos.append(x)
        m = re.match(r"^(.*?)\s+((?:[\d.]+\s+){7}[\d.]+)\s*$", " ".join(unidos))
        if not m:
            continue
        cifras = [int(x.replace(".", "")) for x in m.group(2).split()]
        if sum(cifras[1:]) != cifras[0]:
            raise SystemExit(f"{anio}: la fila «{m.group(1)}» no suma sus tramos")
        filas[m.group(1).strip()] = cifras[0]
    total = next(v for k, v in filas.items() if k.startswith("Total"))
    ppe = {c: next(v for k, v in filas.items() if k.startswith(n)) for c, n in zip(ORDEN, NOMBRES)}
    if sum(ppe.values()) != total:
        raise SystemExit(f"{anio}: la suma de territorios no da el total")
    return ppe, pagina


def main() -> None:
    valores, paginas = [], {}
    anios_texto = sorted(int(m.group(1)) for f in ORIGEN.glob("liquidacion-sfa-anexos-*.pdf")
                         if (m := re.search(r"(\d{4})", f.name)) and int(m.group(1)) not in TRANSCRITO)
    for anio, cifras in sorted(TRANSCRITO.items()):
        if sum(cifras[:19]) != cifras[19]:
            raise SystemExit(f"{anio}: la transcripción no cuadra con el total")
        paginas[anio] = PAGINA[anio]
        valores += [{"anio": anio, "ccaa": c, "ppe": v} for c, v in zip(ORDEN, cifras)]
    for anio in anios_texto:
        ppe, paginas[anio] = leer_texto(anio)
        valores += [{"anio": anio, "ccaa": c, "ppe": v} for c, v in ppe.items()]
        print(f"  {anio}: leído del texto (pág. {paginas[anio]}), filas y total cuadran")
    datos = {
        "fuente": "Ministerio de Sanidad, certificado de población protegida equivalente del SNS (7 tramos de edad), "
                  "en los anexos de la liquidación del sistema de financiación autonómica (Ministerio de Hacienda)",
        "url": URL_LIQUIDACIONES,
        "coeficientes": {"fuente": "Ley 22/2009, artículo 9", "url": URL_LEY,
                         "tramos": {"0-4": 1.031, "5-14": 0.433, "15-44": 0.547, "45-54": 0.904, "55-64": 1.292,
                                    "65-74": 2.175, "75+": 2.759}},
        # Hacienda: la base de datos de tarjetas sanitarias «desde el 2013 […] lleva utilizándose para la
        # determinación de la población protegida» (informe de población ajustada, 3/12/2021, pág. 178).
        "primer_anio_comparable": 2013,
        "paginas": {str(a): p for a, p in sorted(paginas.items())},
        "valores": valores,
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}: {len(valores)} valores ({min(paginas)}-{max(paginas)})")


if __name__ == "__main__":
    main()
