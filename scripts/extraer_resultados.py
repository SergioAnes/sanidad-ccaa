"""Resultados en salud por comunidad: esperanza de vida y mortalidad infantil (INE).

Uso:
    python scripts/extraer_resultados.py

Fuentes (INE, API wstempus; se descargan en datos-originales/ine/ si faltan, no se suben a git):
  - Indicadores Demográficos Básicos: esperanza de vida al nacimiento (tabla 1448 por comunidad, 1414 España) y a los
    65 años (1449 y 1415); tasa de mortalidad infantil por comunidad (1447).
  - Movimiento Natural de la Población: defunciones de menores de un año por lugar de residencia (6552) y nacimientos
    por lugar de residencia de la madre (6525).

Esperanza de vida: tal cual la publica el INE (ambos sexos).
Mortalidad infantil: media de tres años (cálculo propio), porque en las comunidades pequeñas mueren muy pocos bebés y
la tasa de un solo año salta mucho por azar (lo mismo hace Eurostat para las regiones). Se calcula con los recuentos,
no promediando tasas: defunciones de menores de un año de los tres años ÷ nacimientos de los tres años × 1.000. El
año que se muestra es el último de los tres.

Comprobaciones (se detiene si fallan):
  - la tasa anual del INE (1447) es defunciones de menores de un año ÷ nacimientos × 1.000 en cada comunidad y año
    (España: solo residentes; la fila «Total Nacional» de las tablas incluye la categoría «No residente»);
  - España 2025 coincide con la nota de prensa del INE del 18/11/2026: esperanza de vida 84,05 años, mortalidad
    infantil 2,60 por mil, 321.684 nacimientos.

Escribe src/data/resultados.json.
"""
from __future__ import annotations

import json
import unicodedata
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INE = RAIZ / "datos-originales" / "ine"
SALIDA = RAIZ / "src" / "data" / "resultados.json"
URL_TABLA = "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{}"
URL_INE_TABLA = "https://www.ine.es/jaxiT3/Tabla.htm?t={}"
ORDEN = [("AN", "andal"), ("AR", "arag"), ("AS", "astur"), ("IB", "balear"), ("CN", "canar"), ("CB", "cantab"),
         ("CL", "castilla y le"), ("CM", "mancha"), ("CT", "catal"), ("VC", "valencian"), ("EX", "extrem"), ("GA", "galic"),
         ("MD", "madrid"), ("MC", "murcia"), ("NC", "navarra"), ("PV", "vasco"), ("RI", "rioja")]
NOTA_2025 = {"esperanza": 84.05, "infantil": 2.60, "nacimientos": 321_684}


def sin_tildes(t: str) -> str:
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()


def tabla(tid: str) -> list[dict]:
    f = INE / f"ine_{tid}.json"
    if not f.exists():
        INE.mkdir(parents=True, exist_ok=True)
        datos = urllib.request.urlopen(urllib.request.Request(URL_TABLA.format(tid), headers={"User-Agent": "Mozilla/5.0"}), timeout=300).read()
        f.write_bytes(datos)
    return json.loads(f.read_text(encoding="utf-8"))


def territorio(nombre: str) -> str | None:
    """Id de la comunidad (o "ES") a partir del nombre de la serie del INE; None si es otra cosa (Ceuta, Melilla, provincias)."""
    t = sin_tildes(nombre)
    if "total nacional" in t:
        return "ES"
    return next((c for c, p in ORDEN if p in t), None)


def series(tid: str, filtro=lambda n: True, mensual: bool = False) -> dict[str, dict[int, float]]:
    """{territorio: {año: valor}}. Con mensual=True suma los doce meses de cada año (y exige que estén los doce)."""
    out: dict[str, dict[int, float]] = {}
    for s in tabla(tid):
        n = s["Nombre"]
        if not filtro(n):
            continue
        partes = [p.strip() for p in n.split(".")]
        c = next((territorio(p) for p in partes if territorio(p)), None)
        if not c or c in out:
            continue
        datos = [d for d in s["Data"] if d.get("Valor") is not None]
        if mensual:
            por_anio: dict[int, list[float]] = {}
            for d in datos:
                por_anio.setdefault(d["Anyo"], []).append(d["Valor"])
            incompletos = [a for a, v in por_anio.items() if len(v) != 12]
            if incompletos:
                raise SystemExit(f"INE {tid} {c}: años sin los doce meses: {incompletos}")
            out[c] = {a: sum(v) for a, v in por_anio.items()}
        else:
            if len({d["Anyo"] for d in datos}) != len(datos):
                raise SystemExit(f"INE {tid} {c}: hay más de un dato por año (¿tabla mensual?)")
            out[c] = {d["Anyo"]: d["Valor"] for d in datos}
    return out


def main() -> None:
    ambos = lambda n: "Ambos sexos" in n
    e0 = series("1448", ambos) | series("1414", ambos)
    e65 = series("1449", ambos) | series("1415", ambos)
    tasa = series("1447", ambos)
    # 6552 trae sexo, edad y provincias: defunciones totales de menores de un año, dato base, por comunidad
    defun = series("6552", lambda n: ". Total. Menores de un año. Lugar de residencia. Dato base" in n)
    nac = series("6525", lambda n: "Lugar de residencia de la madre. Dato base" in n, mensual=True)  # la tabla es mensual
    # España, como hace el INE en su tasa: solo residentes (la fila «Total Nacional» incluye «No residente»)
    no_res_d = next(({d["Anyo"]: d["Valor"] for d in x["Data"] if d.get("Valor") is not None} for x in tabla("6552")
                     if x["Nombre"].startswith("No residente. Defunción. Total. Menores de un año. Lugar de residencia. Dato base")), None)
    no_res_n: dict[int, float] = {}
    for x in tabla("6525"):
        if x["Nombre"].startswith("No residente. Nacimiento. Lugar de residencia de la madre. Dato base"):
            for d in x["Data"]:
                if d.get("Valor") is not None:
                    no_res_n[d["Anyo"]] = no_res_n.get(d["Anyo"], 0) + d["Valor"]
    if no_res_d is None or not no_res_n:
        raise SystemExit("INE: no encuentro la categoría «No residente» en defunciones o nacimientos")
    nac_total_es = dict(nac["ES"])  # con no residentes: es la cifra de la nota de prensa
    defun["ES"] = {a: v - no_res_d.get(a, 0) for a, v in defun["ES"].items()}
    nac["ES"] = {a: v - no_res_n.get(a, 0) for a, v in nac["ES"].items()}
    ids = [c for c, _ in ORDEN]
    for nombre, d in (("esperanza al nacer", e0), ("esperanza a los 65", e65), ("tasa infantil", tasa), ("defunciones <1", defun), ("nacimientos", nac)):
        falta = [c for c in ids + ["ES"] if c not in d]
        if falta:
            raise SystemExit(f"INE {nombre}: faltan {falta}")

    # Comprobación 1: la tasa del INE es defunciones / nacimientos en cada comunidad y año
    peor = 0.0
    for c in ids + ["ES"]:
        for a, t in tasa[c].items():
            if a in defun[c] and a in nac[c] and nac[c][a]:
                calc = defun[c][a] / nac[c][a] * 1000
                if abs(calc - t) > 0.011:
                    raise SystemExit(f"INE {c} {a}: tasa infantil {t} frente a defunciones / nacimientos {calc:.3f}")
                peor = max(peor, abs(calc - t))
    # Comprobación 2: España 2025 = nota de prensa del INE
    if abs(e0["ES"][2025] - NOTA_2025["esperanza"]) > 0.005 or abs(tasa["ES"][2025] - NOTA_2025["infantil"]) > 0.005 or nac_total_es[2025] != NOTA_2025["nacimientos"]:
        raise SystemExit(f"España 2025 no coincide con la nota de prensa: {e0['ES'][2025]}, {tasa['ES'][2025]}, {nac_total_es[2025]}")
    print(f"  INE: tasa infantil = defunciones / nacimientos en todos los años (diferencia máxima {peor:.4f}); España 2025 = nota de prensa")

    anios_e = sorted(set.intersection(*(set(e0[c]) for c in ids + ["ES"])))
    anios_i = [a for a in sorted(set.intersection(*(set(defun[c]) & set(nac[c]) for c in ids + ["ES"]))) if a - 2 in nac["ES"]]

    def trienal(c, a):
        d = sum(defun[c][y] for y in (a - 2, a - 1, a)); n = sum(nac[c][y] for y in (a - 2, a - 1, a))
        return round(d / n * 1000, 3)

    inds = [
        {"id": "res_esperanza", "anios": anios_e, "valor": {c: [e0[c][a] for a in anios_e] for c in ids}, "espana": [e0["ES"][a] for a in anios_e]},
        {"id": "res_esperanza65", "anios": anios_e, "valor": {c: [e65[c][a] for a in anios_e] for c in ids}, "espana": [e65["ES"][a] for a in anios_e]},
        {"id": "res_mort_infantil", "anios": anios_i, "valor": {c: [trienal(c, a) for a in anios_i] for c in ids}, "espana": [trienal("ES", a) for a in anios_i]},
    ]
    datos = {
        "fuentes": {
            "esperanza": {"texto": "INE, Indicadores Demográficos Básicos: esperanza de vida al nacimiento y a los 65 años por comunidad autónoma",
                          "urls": [URL_INE_TABLA.format(t) for t in ("1448", "1449", "1414", "1415")]},
            "infantil": {"texto": "INE, Movimiento Natural de la Población: defunciones de menores de un año y nacimientos por comunidad autónoma de residencia",
                         "urls": [URL_INE_TABLA.format(t) for t in ("6552", "6525", "1447")]},
            "publicado": "18/11/2026",
        },
        "indicadores": inds,
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}")
    for i in inds:
        print(f"  {i['id']}: {i['anios'][0]}-{i['anios'][-1]}, España {i['espana'][0]} -> {i['espana'][-1]}")


if __name__ == "__main__":
    main()
