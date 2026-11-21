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
      clasificación económico-presupuestaria, importe de "Conciertos"   -> conciertos_hab
        (conciertos_hab = importe de conciertos / población, con la población implícita del
         Anexo I.2: aportación total de la comunidad / gasto por habitante)

Los años marcados con (*) en el Excel son provisionales y se guardan con
"provisional": true.

También extrae las notas metodológicas de cada comunidad (años marcados con letra, p. ej. "2012b",
y su texto en el bloque "Notas:" de la hoja) a src/data/notas-egsp.json.

Y la lista de entidades («agentes de gasto») que la estadística cuenta en cada comunidad: cuándo empieza o deja
de contar cada una, con su importe y su peso, a src/data/perimetro-egsp.json. La fuente no explica estos cambios.
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
SALIDA_PERIMETRO = RAIZ / "src" / "data" / "perimetro-egsp.json"
PPE = RAIZ / "src" / "data" / "poblacion-equivalente.json"  # lo genera scripts/extraer_ppe.py

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


def agentes_hoja(s: xlrd.sheet.Sheet) -> dict[str, dict[int, float]]:
    """Entidades («agentes de gasto») que la estadística cuenta en esta comunidad, con su aportación al gasto
    total consolidado por año (miles de euros). Cada entidad tiene su bloque: una fila con su nombre y los años
    en que cuenta, y más abajo la fila «Aportación al gasto total consolidado»."""
    agentes: dict[str, dict[int, float]] = {}
    actual, cab = None, {}
    for r in range(s.nrows):
        fila = s.row_values(r)
        textos = [v for v in fila if isinstance(v, str) and v.strip() and not re.match(r"^\s*\d{4}", v)]
        anios = columnas_anio(fila)
        if len(textos) == 1 and anios and all(2000 <= a <= 2030 for a, _ in anios.values()):
            nombre = re.sub(r"\s+", " ", textos[0]).strip()
            if not re.match(r"(?i)(gasto|aportaci|concepto|clasificaci|miles|total|cuentas|comunidad|ciudad)", nombre):
                actual, cab = nombre, anios
                continue
        if actual and etiqueta(fila).startswith("aportacion al gasto total consolidado"):
            agentes[actual] = {a: numero(fila[c]) or 0.0 for c, (a, _) in cab.items()}
            actual = None
    return agentes


def cambios_perimetro(ccaa: str, agentes: dict[str, dict[int, float]], primero: int, ultimo: int) -> list[dict]:
    """Entradas y salidas de entidades en el perímetro de la comunidad, con su peso en el gasto de ese año
    (entrada: peso en el primer año en que cuenta; salida: peso en el último)."""
    total = {a: sum(v.get(a, 0.0) for v in agentes.values()) for a in range(primero, ultimo + 1)}
    out = []
    for nombre, v in agentes.items():
        anios = sorted(v)
        if anios[0] > primero:
            out.append({"ccaa": ccaa, "anio": anios[0], "cambio": "entra", "entidad": nombre,
                        "miles_eur": round(v[anios[0]]), "peso_pct": round(v[anios[0]] / total[anios[0]] * 100, 2)})
        if anios[-1] < ultimo:
            out.append({"ccaa": ccaa, "anio": anios[-1] + 1, "cambio": "sale", "entidad": nombre,
                        "miles_eur": round(v[anios[-1]]), "peso_pct": round(v[anios[-1]] / total[anios[-1]] * 100, 2)})
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
    perimetro: list[dict] = []
    aportaciones: dict[tuple[str, int], float] = {}
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
        aportacion = {a: numero(s.row_values(fin)[c]) for c, (a, _) in cab.items()}
        aportaciones.update({(ccaa, a): v for a, v in aportacion.items()})
        # En esta tabla el % se calcula sobre el gasto consolidado del subsector
        # (antes de restar transferencias intersectoriales).
        r_sub = next(x for x in range(ini, fin) if etiqueta(s.row_values(x)).startswith("gasto publico en sanidad"))
        total_eco = {a: numero(s.row_values(r_sub)[c]) for c, (a, _) in cab.items()}
        for anio, (imp, pct, prov) in fila_pct(s, ini, fin, cab, "conciertos").items():
            # comprobación: el % del Excel cuadra con importe / total
            assert abs(imp / total_eco[anio] * 100 - pct) < 0.01, (s.name, anio)
            add("pct_conciertos", ccaa, anio, pct, prov, 2)
            # Por habitante, con la misma población que el Ministerio: importe × (gasto por habitante / aportación total).
            add("conciertos_hab", ccaa, anio, imp * gasto_hab[(ccaa, anio)][0] / aportacion[anio], prov, 2)

        # Entidades que cuenta la estadística: su suma debe dar el total de la comunidad cada año.
        agentes = agentes_hoja(s)
        for anio, tot_a in aportacion.items():
            suma = sum(v.get(anio, 0.0) for v in agentes.values())
            assert abs(suma - tot_a) <= abs(tot_a) * 1e-4, (s.name, anio, "la suma de entidades no da el total", suma, tot_a)
        perimetro += cambios_perimetro(ccaa, agentes, min(aportacion), max(aportacion))

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

        # Comprobación de coherencia: población implícita = total consolidado / gasto por habitante.
        # Debe variar con suavidad (la población no salta de un año a otro). Si salta, el error estaría en
        # la lectura del Excel; si no, los saltos del gasto son de la fuente (la web los avisa).
        tot = {a: numero(s.row_values(fin)[c]) for c, (a, _) in cab.items()}
        pob = {a: tot[a] * 1000 / gasto_hab[(ccaa, a)][0] for a in tot}
        for anio in sorted(pob)[1:]:
            var = pob[anio] / pob[anio - 1] - 1
            assert abs(var) < 0.06, (s.name, anio, f"población implícita {var:+.1%}")
        print(f"  {ccaa}: población implícita {pob[min(pob)]:,.0f} ({min(pob)}) -> {pob[max(pob)]:,.0f} ({max(pob)}), sin saltos")

    # Gasto por habitante ajustado por edad (cálculo propio con datos oficiales): gasto de la comunidad dividido entre
    # su población protegida equivalente (certificado de Sanidad, scripts/extraer_ppe.py), reescalado para que el
    # conjunto de las 17 quede igual que sin ajustar: gasto_hab / factor, con
    #   factor = (PPE de la comunidad / su población) / (PPE de las 17 / población de las 17),
    # donde la población es la del Ministerio (aportación / gasto por habitante). Solo desde el primer año comparable
    # (2013: desde entonces la población protegida sale de la base de datos de tarjeta sanitaria).
    if PPE.exists():
        ppe_datos = json.loads(PPE.read_text(encoding="utf-8"))
        ppe = {(v["ccaa"], v["anio"]): v["ppe"] for v in ppe_datos["valores"]}
        ids = sorted(NOMBRES.values())
        anios_ppe = sorted({a for _, a in ppe if a >= ppe_datos["primer_anio_comparable"]})
        for anio in anios_ppe:
            if any((c, anio) not in gasto_hab or (c, anio) not in aportaciones for c in ids):
                continue
            pob = {c: aportaciones[(c, anio)] * 1000 / gasto_hab[(c, anio)][0] for c in ids}
            k = sum(ppe[(c, anio)] for c in ids) / sum(pob.values())
            for c in ids:
                factor = ppe[(c, anio)] / pob[c] / k
                gh, prov = gasto_hab[(c, anio)]
                add("gasto_hab_edad", c, anio, gh / factor, prov, 2)
        print(f"  gasto ajustado por edad: {anios_ppe[0]}-{anios_ppe[-1]}")
    else:
        print("  (sin src/data/poblacion-equivalente.json: ejecuta antes scripts/extraer_ppe.py)")

    faltan = set(NOMBRES.values()) - vistos
    if faltan:
        raise SystemExit(f"Faltan hojas de CCAA: {sorted(faltan)}")

    filas.sort(key=lambda f: (f["indicador"], f["ccaa"], f["anio"]))
    # Una fila por línea: legible y con diffs limpios en git.
    cuerpo = ",\n".join("  " + json.dumps(f, ensure_ascii=False) for f in filas)
    SALIDA.write_text("[\n" + cuerpo + "\n]\n", encoding="utf-8")

    SALIDA_NOTAS.write_text(json.dumps(notas, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA_NOTAS.relative_to(RAIZ)}: {len(notas)} notas")

    perimetro.sort(key=lambda x: (x["ccaa"], x["anio"], x["cambio"], -x["peso_pct"]))
    cuerpo = ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in perimetro)
    SALIDA_PERIMETRO.write_text("[\n" + cuerpo + "\n]\n", encoding="utf-8")
    print(f"Escrito {SALIDA_PERIMETRO.relative_to(RAIZ)}: {len(perimetro)} entradas y salidas de entidades "
          f"({sum(x['peso_pct'] >= 1 for x in perimetro)} de al menos un 1 % del gasto)")

    resumen: dict[str, int] = {}
    for f in filas:
        resumen[f["indicador"]] = resumen.get(f["indicador"], 0) + 1
    print(f"Escrito {SALIDA.relative_to(RAIZ)}: {len(filas)} filas")
    for k, n in sorted(resumen.items()):
        print(f"  {k}: {n}")


if __name__ == "__main__":
    main()
