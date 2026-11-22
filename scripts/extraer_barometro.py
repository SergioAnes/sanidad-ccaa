"""Barómetro Sanitario (Ministerio de Sanidad y CIS): opinión y acceso a la atención primaria por comunidad.

Uso:
    python scripts/extraer_barometro.py

Fuentes (en datos-originales/, no se suben a git):
  - BS_1998-2025_Principales_variables_CCAA.xlsx: serie oficial del Ministerio por comunidad (pestañas «P 3»,
    satisfacción 1-10, y «P 7b», % que valora buena o muy buena la atención del médico de familia).
    Son las cifras que publica la web. El Ministerio recalculó 2022-2024 (en nuestro análisis, la satisfacción nacional
    de 2023 figuraba antes como 6,27 y la serie dice 6,225; la web no cita esa cifra antigua), con ponderaciones que
    no están en los microdatos públicos: por eso esos años se toman tal cual de la serie.
  - cis-barometro/<estudio>/DA<estudio> + codigo<estudio>.pdf: microdatos del CIS (fichero de ancho fijo y libro de
    códigos). 2022: 8822; 2023: 8823; 2024: 8824 (ficheros anuales); 2025: 3509, 3519, 3531 (las tres oleadas).
    Se usan para (a) los márgenes de error de 2022-2025 y (b) las cifras de acceso al médico de familia de 2025.
  - barometro-informe-2025.pdf: informe anual 2025 del Ministerio (para comprobar las cifras de 2025).

Cálculo (el mismo que el Ministerio, comprobado: reproduce exactamente las cifras oficiales de 2025):
  - ponderación nacional PESO también dentro de cada comunidad;
  - valoraciones: «buena» o «muy buena» sobre todas las respuestas, incluido «no sabe / no contesta»;
  - márgenes: intervalo al 95 % con el tamaño de muestra efectivo de Kish (aproximación: el CIS selecciona por
    cuotas y da su error en el supuesto de muestreo aleatorio simple).

Escribe src/data/barometro.json. Se detiene si 2025 no reproduce las cifras oficiales.
"""

from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path

import openpyxl
import pdfplumber

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "datos-originales"
MICRO = ORIGEN / "cis-barometro"
SALIDA = RAIZ / "src" / "data" / "barometro.json"

# Código CCAA del CIS -> id de src/data/ccaa.json (el CIS ordena Castilla-La Mancha antes que Castilla y León)
CIS_A_ID = {1: "AN", 2: "AR", 3: "AS", 4: "IB", 5: "CN", 6: "CB", 7: "CM", 8: "CL", 9: "CT", 10: "VC", 11: "EX",
            12: "GA", 13: "MD", 14: "MC", 15: "NC", 16: "PV", 17: "RI", 18: "CE", 19: "ML"}
# Filas de la serie del Ministerio -> id
SERIE_A_ID = {"Andalucía": "AN", "Aragón": "AR", "Asturias": "AS", "Baleares": "IB", "Canarias": "CN", "Cantabria": "CB",
              "Castilla-La Mancha": "CM", "Castilla y León": "CL", "Cataluña": "CT", "Comunidad Valenciana": "VC",
              "Extremadura": "EX", "Galicia": "GA", "Madrid": "MD", "Murcia": "MC", "Navarra": "NC", "País Vasco": "PV",
              "Rioja": "RI", "Ceuta": "CE", "Melilla": "ML"}
ESTUDIOS = {2022: (8822,), 2023: (8823,), 2024: (8824,), 2025: (3509, 3519, 3531)}
# Nombre de cada pregunta en cada año (comprobado en los libros de códigos)
VARIABLES = {
    "satisfaccion": {2022: "P2", 2023: "P2", 2024: "P2", 2025: "P2"},
    "valoracion_ap": {2022: "P6F", 2023: "P6E", 2024: "P5F", 2025: "P5F"},
    # Ojo: en 2024-2025 «P8E» / «P8_05» es el especialista en salud mental; el especialista general es P7D / P7E.
    "valoracion_especialista": {2022: "P8E", 2023: "P8D", 2024: "P7D", 2025: "P7E"},
    # 2024: la pregunta pasa de «servicio de urgencias de la sanidad pública la última vez» a «servicio de urgencias
    # (atención primaria/hospitalaria) de la sanidad pública»; la serie oficial la da como continua.
    "valoracion_urgencias": {2022: "P7B", 2023: "P7B", 2024: "P6B", 2025: "P6B"},
}
PRIMER_ANIO_METODO = 2022  # entrevista telefónica (antes, en persona)

URL_SERIE = "https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/barometro/home.htm"
URL_FICHERO = "https://www.sanidad.gob.es/estadEstudios/estadisticas/BarometroSanitario/Barom_Sanit_2025/Totales/BS_1998-2025_Principales_variables_CCAA.xlsx"
URL_INFORME = "https://www.sanidad.gob.es/estadEstudios/estadisticas/BarometroSanitario/Barom_Sanit_2025/Totales/Informe_BS_2025.pdf"
URL_MICRO = "https://www.cis.es/documents/d/cis/MD{}"


@lru_cache(None)
def codigo(e: int) -> dict[str, tuple[int, int]]:
    """{variable: (columna inicial, columna final)} del libro de códigos del CIS."""
    pdf_path = next((MICRO / str(e)).glob("codigo*.pdf"))
    with pdfplumber.open(pdf_path) as pdf:
        t = re.sub(r"\s+", " ", " ".join((p.extract_text() or "") for p in pdf.pages))
    out: dict[str, tuple[int, int]] = {}
    for m in re.finditer(r"(?<![\w,])([A-Z][A-Z0-9_]*) \((\d+)(?:-(\d+))?\)", t):
        out.setdefault(m.group(1), (int(m.group(2)), int(m.group(3) or m.group(2))))
    return out


@lru_cache(None)
def lineas(e: int) -> tuple[str, ...]:
    with open(MICRO / str(e) / f"DA{e}", encoding="latin-1") as f:
        return tuple(l.rstrip("\n") for l in f if l.strip())


def columna(e: int, var: str) -> list[float | None]:
    ini, fin = codigo(e)[var]
    out = []
    for l in lineas(e):
        s = l[ini - 1:fin].strip()
        try:
            out.append(float(s.replace(",", ".")) if s else None)
        except ValueError:
            out.append(None)
    return out


def registros(anio: int, var: str, *extra: str) -> list[tuple]:
    """(ccaa, peso, valor, *extra) de todas las entrevistas del año."""
    out = []
    for e in ESTUDIOS[anio]:
        cols = [columna(e, "CCAA"), columna(e, "PESO"), columna(e, var), *[columna(e, x) for x in extra]]
        out += [t for t in zip(*cols) if t[0] is not None and t[1] is not None and t[2] is not None]
    return out


def estimar(pares: list[tuple[float, float]]) -> tuple[float, float, int]:
    """Media ponderada, semiamplitud del IC 95 % (Kish) y número de respuestas, de [(valor, peso)]."""
    sw = sum(w for _, w in pares)
    m = sum(v * w for v, w in pares) / sw
    var = sum(w * (v - m) ** 2 for v, w in pares) / sw
    neff = sw ** 2 / sum(w * w for _, w in pares)
    return m, 1.96 * math.sqrt(var / neff), len(pares)


def por_territorio(filas, transformar) -> dict[str, tuple[float, float, int]]:
    """Agrupa por comunidad: transformar(valor, *extra) -> valor numérico o None (excluido)."""
    grupos: dict[str, list] = {}
    for c, w, v, *ex in filas:
        x = transformar(v, *ex)
        if x is not None:
            grupos.setdefault(CIS_A_ID[int(c)], []).append((x, w))
    return {k: estimar(v) for k, v in grupos.items()}


def nacional(filas, transformar) -> tuple[float, float, int]:
    pares = [(x, w) for c, w, v, *ex in filas if (x := transformar(v, *ex)) is not None]
    return estimar(pares)


# --- transformaciones de cada pregunta
satisf = lambda v: v if 1 <= v <= 10 else None
# valoración: 1 muy buena, 2 buena, 3 regular, 4 mala, 5 muy mala, 8 N.S., 9 N.C.; 0 = no procede (no fue usuario)
buena = lambda v: None if v == 0 else (100.0 if v in (1, 2) else 0.0)
# tiempo hasta que le atendió el médico de familia: 1 mismo día, 2 día siguiente, 3 más de un día por falta de cita,
# 4 más de un día por conveniencia, 5 solo citas programadas, 6 no hay que pedir cita, 8 N.R., 9 N.C., 0 no procede
en_24h = lambda v: None if v == 0 else (100.0 if v in (1, 2) else 0.0)
dias = lambda v: v if 1 <= v < 998 else None


def serie_oficial(hoja: str) -> tuple[dict[str, dict[int, float]], dict[int, float]]:
    ws = openpyxl.load_workbook(ORIGEN / "BS_1998-2025_Principales_variables_CCAA.xlsx", data_only=True)[hoja]
    filas = list(ws.iter_rows(values_only=True))
    cab = next(r for r in filas if any(str(x).strip() == "1998" for x in r if x is not None))
    anios = {i: int(str(x).strip()) for i, x in enumerate(cab) if x is not None and re.fullmatch(r"\d{4}", str(x).strip())}
    out: dict[str, dict[int, float]] = {}
    espana: dict[int, float] = {}
    for r in filas:
        nombre = str(r[0] or "").strip()
        if nombre in SERIE_A_ID and SERIE_A_ID[nombre] not in out:
            out[SERIE_A_ID[nombre]] = {a: round(float(r[i]), 2) for i, a in anios.items() if isinstance(r[i], (int, float))}
        if nombre == "TOTAL" and not espana:
            espana = {a: round(float(r[i]), 2) for i, a in anios.items() if isinstance(r[i], (int, float))}
    if len(out) != 19:
        raise SystemExit(f"{hoja}: se esperaban 19 territorios y hay {len(out)}")
    return out, espana


def main() -> None:
    indicadores = []

    # --- satisfacción y valoración de la atención primaria: serie oficial + márgenes de los microdatos
    for clave, hoja, transf, unidad in (("satisfaccion", "P 3", satisf, "nota10"), ("valoracion_ap", "P 7b", buena, "pct"),
                                        ("valoracion_especialista", "P 10c", buena, "pct"), ("valoracion_urgencias", "P 9f", buena, "pct")):
        # La valoración de la hospitalización (P 12e, variable P9D) no se usa: solo contestan quienes estuvieron
        # ingresados, hay muy pocas entrevistas por comunidad (margen mediano de ±13 puntos en 2025, hasta ±34) y en
        # algunas todas responden «buena», con lo que el margen calculado sale 0, que no es real.
        oficial, espana = serie_oficial(hoja)
        margen: dict[int, dict[str, float]] = {}
        for anio in sorted(ESTUDIOS):
            filas = registros(anio, VARIABLES[clave][anio])
            est = por_territorio(filas, transf)
            margen[anio] = {c: round(e, 3) for c, (_, e, _) in est.items()}
            margen[anio]["ES"] = round(nacional(filas, transf)[1], 3)
            if anio == 2025:  # 2025 debe reproducir exactamente la serie oficial
                tol = 0.006 if unidad == "nota10" else 0.06
                for c, (m, _, _) in est.items():
                    if abs(m - oficial[c][anio]) > tol:
                        raise SystemExit(f"{clave} 2025 {c}: microdatos {m:.3f} frente a la serie {oficial[c][anio]}")
                print(f"  {clave} 2025: los microdatos reproducen la serie oficial en los 19 territorios")
        anios = sorted(ESTUDIOS)
        indicadores.append({
            "id": clave, "unidad": unidad, "anios": anios,
            "valor": {c: [oficial[c].get(a) for a in anios] for c in oficial},
            "espana": [espana.get(a) for a in anios],
            "margen": {c: [margen[a].get(c) for a in anios] for c in oficial},
            "margen_espana": [margen[a]["ES"] for a in anios],
            "historico": {
                "anios": list(range(2002, PRIMER_ANIO_METODO - 2)),  # 2002-2019 (2020 y 2021 no hubo encuesta)
                "valor": {c: [oficial[c].get(a) for a in range(2002, PRIMER_ANIO_METODO - 2)] for c in oficial},
                "espana": [espana.get(a) for a in range(2002, PRIMER_ANIO_METODO - 2)],
            },
        })

    # --- acceso al médico de familia, 2025 (microdatos; comprobado con el informe anual)
    filas = registros(2025, "P5C")
    rapido = por_territorio(filas, en_24h)
    rapido_es = nacional(filas, en_24h)
    conveniencia_es = nacional(filas, lambda v: None if v == 0 else (100.0 if v == 4 else 0.0))[0]
    filas_d = registros(2025, "P5C_01")
    espera = por_territorio(filas_d, dias)
    espera_es = nacional(filas_d, dias)
    # Informe 2025: 21,8 % atendido en el día o al siguiente; 5,1 % prefirió otra fecha; espera media 9,15 días;
    # País Vasco 4,91; Asturias 5,45; Ceuta 5,55; Andalucía 11,16; Cataluña 10,59.
    comprobar = {"ES_rapido": (rapido_es[0], 21.8, 0.06), "ES_conveniencia": (conveniencia_es, 5.1, 0.06),
                 "ES_dias": (espera_es[0], 9.15, 0.006), "PV": (espera["PV"][0], 4.91, 0.006), "AS": (espera["AS"][0], 5.45, 0.006),
                 "CE": (espera["CE"][0], 5.55, 0.006), "AN": (espera["AN"][0], 11.16, 0.006), "CT": (espera["CT"][0], 10.59, 0.006)}
    for k, (calc, of, tol) in comprobar.items():
        if abs(calc - of) > tol:
            raise SystemExit(f"Acceso a primaria 2025 ({k}): microdatos {calc:.3f} frente al informe {of}")
    print("  acceso al médico de familia 2025: coincide con el informe anual (8 cifras)")
    for clave, est, es, unidad in (("ap_en_24h", rapido, rapido_es, "pct"), ("ap_dias", espera, espera_es, "dias")):
        indicadores.append({
            "id": clave, "unidad": unidad, "anios": [2025],
            "valor": {c: [round(v[0], 2)] for c, v in est.items()},
            "espana": [round(es[0], 2)],
            "margen": {c: [round(v[1], 3)] for c, v in est.items()},
            "margen_espana": [round(es[1], 3)],
            "n": {c: [v[2]] for c, v in est.items()},
        })

    datos = {
        "fuentes": {
            "serie": {"texto": "Ministerio de Sanidad, Barómetro Sanitario: principales variables por comunidad autónoma, 1998-2025",
                      "fichero": "BS_1998-2025_Principales_variables_CCAA.xlsx", "url": URL_SERIE,
                      "url_fichero": URL_FICHERO},
            "informe": {"texto": "Ministerio de Sanidad, Barómetro Sanitario 2025: informe anual", "url": URL_INFORME},
            "microdatos": [{"anio": a, "estudio": e, "url": URL_MICRO.format(f"{e}-zip" if e in (3509, 3519, 3531, 8822) else e)}
                           for a, es in ESTUDIOS.items() for e in es],
        },
        "primer_anio_metodo": PRIMER_ANIO_METODO,
        "indicadores": indicadores,
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}")
    for ind in indicadores:
        print(f"  {ind['id']}: España {ind['espana'][-1]} ± {ind['margen_espana'][-1]} ({ind['anios'][0]}-{ind['anios'][-1]})")


if __name__ == "__main__":
    main()
