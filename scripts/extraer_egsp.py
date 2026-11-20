"""Extrae indicadores por CCAA de la Estadística de Gasto Sanitario Público (EGSP).

Uso:
    python scripts/extraer_egsp.py [ruta_excel]

Por defecto lee datos-originales/egsp-gasto-real-2002-2024.xls y escribe
src/data/valores.json. Requiere `pip install xlrd` (el fichero es .xls antiguo).

Hojas que usa:
  - Anexo I.1  -> pct_pib       (gasto sanitario público consolidado, % del PIB)
  - Anexo I.2  -> gasto_hab     (euros por habitante)
  - Tabla 3.4.01 ... 3.4.17 (una por CCAA):
      clasificación económico-presupuestaria, fila "Conciertos"       -> pct_conciertos
      clasificación funcional, fila "Servicios primarios de salud"     -> pct_primaria
      clasificación funcional, fila "Servicios hospitalarios y esp."   -> pct_hospital
      clasificación funcional, fila "Farmacia"                         -> farmacia_hab
        (farmacia_hab = gasto_hab * % farmacia / 100, es decir, con la misma
         población que usa el Ministerio en el Anexo I.2)

Los años marcados con (*) en el Excel son provisionales y se guardan con
"provisional": true.

También extrae las notas metodológicas de cada comunidad (años marcados con letra, p. ej. "2012b",
y su texto en el bloque "Notas:" de la hoja) a src/data/notas-egsp.json.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import xlrd

RAIZ = Path(__file__).resolve().parent.parent
EXCEL_DEFECTO = RAIZ / "datos-originales" / "egsp-gasto-real-2002-2024.xls"
SALIDA = RAIZ / "src" / "data" / "valores.json"
SALIDA_NOTAS = RAIZ / "src" / "data" / "notas-egsp.json"

# Nombre oficial en el Excel -> id de src/data/ccaa.json
NOMBRES = {
    "comunidad autonoma de andalucia": "AN",
    "comunidad autonoma de aragon": "AR",
    "comunidad autonoma del principado de asturias": "AS",
    "comunidad autonoma de las illes balears": "IB",
    "comunidad autonoma de canarias": "CN",
    "comunidad autonoma de cantabria": "CB",
    "comunidad de castilla y leon": "CL",
    "comunidad autonoma de castilla-la mancha": "CM",
    "comunidad autonoma de cataluna": "CT",
    "comunitat valenciana": "VC",
    "comunidad autonoma de extremadura": "EX",
    "comunidad autonoma de galicia": "GA",
    "comunidad de madrid": "MD",
    "comunidad autonoma de la region de murcia": "MC",
    "comunidad foral de navarra": "NC",
    "comunidad autonoma del pais vasco": "PV",
    "comunidad autonoma de la rioja": "RI",
}


def norm(texto: object) -> str:
    s = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().lower()


def etiqueta(fila: list) -> str:
    """Primer texto no vacío de la fila (las etiquetas no siempre están en la columna A)."""
    return next((norm(v) for v in fila if isinstance(v, str) and v.strip()), "")


def leer_anio(celda: object) -> tuple[int, bool] | None:
    """2002.0 -> (2002, False); '2023(*)' -> (2023, True)."""
    if isinstance(celda, float) and 1990 < celda < 2100:
        return int(celda), False
    # Algunas cabeceras llevan una letra de nota al pie: "2009a", "2020b".
    m = re.fullmatch(r"\s*(\d{4})(?:\.0)?\s*[a-z]?\s*(\(\*\))?\s*", str(celda))
    if m:
        return int(m.group(1)), bool(m.group(2))
    return None


def columnas_anio(fila: list) -> dict[int, tuple[int, bool]]:
    return {c: a for c, v in enumerate(fila) if (a := leer_anio(v))}


def numero(v: object) -> float | None:
    return float(v) if isinstance(v, (int, float)) and v != "" else None


def anexo(libro: xlrd.Book, hoja: str) -> dict[tuple[str, int], tuple[float, bool]]:
    s = libro.sheet_by_name(hoja)
    cab = next(columnas_anio(s.row_values(r)) for r in range(s.nrows) if len(columnas_anio(s.row_values(r))) > 10)
    out = {}
    for r in range(s.nrows):
        fila = s.row_values(r)
        ccaa = NOMBRES.get(etiqueta(fila))
        if not ccaa:
            continue
        for c, (anio, prov) in cab.items():
            v = numero(fila[c])
            if v is not None:
                out[(ccaa, anio)] = (v, prov)
    faltan = set(NOMBRES.values()) - {k[0] for k in out}
    if faltan:
        raise SystemExit(f"{hoja}: no se encuentran {sorted(faltan)}")
    return out


def bloque(s: xlrd.sheet.Sheet, titulo: str) -> tuple[int, int, dict]:
    """Devuelve (fila_inicio, fila_fin, cabecera_años) de un bloque 'Miles de euros / Porcentaje'."""
    # El título también aparece arriba como enlace del índice; el bueno va seguido
    # de la línea de unidades "Miles de euros / Porcentaje sobre el total".
    ini = next(
        r for r in range(s.nrows)
        if etiqueta(s.row_values(r)) == titulo
        and any(etiqueta(s.row_values(x)).startswith("miles de euros / porcentaje") for x in range(r, min(r + 4, s.nrows)))
    )
    r = ini
    while len(columnas_anio(s.row_values(r))) < 10:
        r += 1
    cab = columnas_anio(s.row_values(r))
    fin = next(x for x in range(r, s.nrows) if etiqueta(s.row_values(x)).startswith("aportacion al gasto"))
    return r, fin, cab


def fila_pct(s, ini: int, fin: int, cab: dict, nombre: str) -> dict[int, tuple[float, float, bool]]:
    """Para una fila de importes, devuelve {año: (miles_eur, porcentaje, provisional)}.
    En estas tablas el porcentaje va en la fila inmediatamente inferior."""
    r = next(x for x in range(ini, fin) if etiqueta(s.row_values(x)) == nombre)
    importes, pcts = s.row_values(r), s.row_values(r + 1)
    out = {}
    for c, (anio, prov) in cab.items():
        imp, pct = numero(importes[c]), numero(pcts[c])
        if imp is not None and pct is not None:
            out[anio] = (imp, pct, prov)
    return out


def notas_hoja(s: xlrd.sheet.Sheet) -> dict[int, str]:
    """Notas al pie de una hoja de CCAA: {año: texto}.

    Los años con nota llevan una letra en la cabecera ("2008a"); el texto está tras la fila "Notas:",
    empezando por esa letra ("a En 2008, …"). Una nota puede ocupar varias filas o celdas."""
    letras: dict[str, int] = {}
    for r in range(s.nrows):
        for v in s.row_values(r):
            m = re.fullmatch(r"\s*(\d{4})(?:\.0)?\s*([a-z])\s*(\(\*\))?\s*", str(v))
            if m:
                letras[m.group(2)] = int(m.group(1))
    if not letras:
        return {}
    ini = next((r for r in range(s.nrows) if etiqueta(s.row_values(r)).startswith("nota")), None)
    if ini is None:
        raise SystemExit(f"{s.name}: hay años con nota {letras} pero no el bloque de notas")
    textos: dict[str, list[str]] = {}
    actual = None
    for r in range(ini + 1, s.nrows):
        t = " ".join(str(v).strip() for v in s.row_values(r) if str(v).strip())
        if not t:
            continue
        m = re.match(r"^([a-z])\s+(.*)", t, re.S)
        if m and m.group(1) in letras:
            actual = m.group(1)
            textos[actual] = [m.group(2)]
        elif actual:
            textos[actual].append(t)
    out = {}
    for letra, anio in letras.items():
        if letra not in textos:
            raise SystemExit(f"{s.name}: falta el texto de la nota {letra} ({anio})")
        out[anio] = re.sub(r"\s+", " ", " ".join(textos[letra])).strip()
    return out


def main() -> None:
    excel = Path(sys.argv[1]) if len(sys.argv) > 1 else EXCEL_DEFECTO
    libro = xlrd.open_workbook(str(excel))

    gasto_hab = anexo(libro, "Anexo I.2")
    pct_pib = anexo(libro, "Anexo I.1")

    filas: list[dict] = []

    def add(ind: str, ccaa: str, anio: int, valor: float, prov: bool, dec: int) -> None:
        f = {"indicador": ind, "ccaa": ccaa, "anio": anio, "valor": round(valor, dec)}
        if prov:
            f["provisional"] = True
        filas.append(f)

    for (ccaa, anio), (v, prov) in sorted(gasto_hab.items()):
        add("gasto_hab", ccaa, anio, v, prov, 2)
    for (ccaa, anio), (v, prov) in sorted(pct_pib.items()):
        add("pct_pib", ccaa, anio, v, prov, 2)

    vistos = set()
    notas: list[dict] = []
    for s in libro.sheets():
        if not re.fullmatch(r"Tabla 3\.4\.\d\d", s.name):
            continue
        ccaa = next((NOMBRES[n] for r in range(15) if (n := etiqueta(s.row_values(r))) in NOMBRES), None)
        if not ccaa:
            raise SystemExit(f"{s.name}: no se reconoce la comunidad")
        vistos.add(ccaa)
        for anio, texto in sorted(notas_hoja(s).items()):
            notas.append({"ccaa": ccaa, "anio": anio, "texto": texto, "hoja": s.name})

        ini, fin, cab = bloque(s, "clasificacion economico-presupuestaria")
        # En esta tabla el % se calcula sobre el gasto consolidado del subsector
        # (antes de restar transferencias intersectoriales).
        r_sub = next(x for x in range(ini, fin) if etiqueta(s.row_values(x)).startswith("gasto publico en sanidad"))
        total_eco = {a: numero(s.row_values(r_sub)[c]) for c, (a, _) in cab.items()}
        for anio, (imp, pct, prov) in fila_pct(s, ini, fin, cab, "conciertos").items():
            # comprobación: el % del Excel cuadra con importe / total
            assert abs(imp / total_eco[anio] * 100 - pct) < 0.01, (s.name, anio)
            add("pct_conciertos", ccaa, anio, pct, prov, 2)

        ini, fin, cab = bloque(s, "clasificacion funcional")
        for anio, (_, pct, prov) in fila_pct(s, ini, fin, cab, "servicios primarios de salud").items():
            add("pct_primaria", ccaa, anio, pct, prov, 2)
        for anio, (_, pct, prov) in fila_pct(s, ini, fin, cab, "servicios hospitalarios y especializados").items():
            add("pct_hospital", ccaa, anio, pct, prov, 2)
        for anio, (imp, pct, prov) in fila_pct(s, ini, fin, cab, "farmacia").items():
            gh = gasto_hab.get((ccaa, anio))
            if gh is None:
                continue
            add("farmacia_hab", ccaa, anio, gh[0] * pct / 100, prov, 2)

        # Comprobación de coherencia: población implícita = total consolidado / gasto por habitante
        tot = {a: numero(s.row_values(fin)[c]) for c, (a, _) in cab.items()}
        for anio in (2002, max(tot)):
            pob = tot[anio] * 1000 / gasto_hab[(ccaa, anio)][0]
            print(f"  {ccaa} {anio}: población implícita {pob:,.0f}")

    faltan = set(NOMBRES.values()) - vistos
    if faltan:
        raise SystemExit(f"Faltan hojas de CCAA: {sorted(faltan)}")

    filas.sort(key=lambda f: (f["indicador"], f["ccaa"], f["anio"]))
    # Una fila por línea: legible y con diffs limpios en git.
    cuerpo = ",\n".join("  " + json.dumps(f, ensure_ascii=False) for f in filas)
    SALIDA.write_text("[\n" + cuerpo + "\n]\n", encoding="utf-8")

    SALIDA_NOTAS.write_text(json.dumps(notas, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA_NOTAS.relative_to(RAIZ)}: {len(notas)} notas")

    resumen: dict[str, int] = {}
    for f in filas:
        resumen[f["indicador"]] = resumen.get(f["indicador"], 0) + 1
    print(f"Escrito {SALIDA.relative_to(RAIZ)}: {len(filas)} filas")
    for k, n in sorted(resumen.items()):
        print(f"  {k}: {n}")


if __name__ == "__main__":
    main()
