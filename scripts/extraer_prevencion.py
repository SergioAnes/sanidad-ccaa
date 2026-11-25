"""Extrae los indicadores de prevención de las tablas oficiales del INE y Sanidad."""

from __future__ import annotations

import csv
import json
import urllib.request
from urllib.parse import urlencode

from extraer_resultados import CIUDADES, ORDEN, RAIZ, territorio

INE = RAIZ / "datos-originales" / "ine"
SANIDAD = RAIZ / "datos-originales" / "rae-cmbd"
SALIDA = RAIZ / "src" / "data" / "prevencion.json"
IDS = [c for c, _ in ORDEN]
CIUDADES_IDS = [c for c, _ in CIUDADES]
TERRITORIOS = [*IDS, *CIUDADES_IDS, "ES"]
TABLAS_CRIBADO = {2023: 71927, 2025: 81219}
PRIMER_ANIO = "En los últimos 12 meses"
SEGUNDO_ANIO = "Hace 1 año o más pero menos de 2 años"
CODIGOS_INCLASNS = dict(zip(TERRITORIOS, [30, 31, 32, *range(34, 51)], strict=True))
ANIOS_INCLASNS = dict(zip(range(2017, 2025), [68, 69, 70, 89, 90, 91, 92, 93], strict=True))


def vacunacion() -> dict:
    f = SANIDAD / "inclasns-datos-60.json"
    if not f.exists():
        SANIDAD.mkdir(parents=True, exist_ok=True)
        parametros = {"indicators": 60, "sex": 51, "nse": 71, "nsc": 79, "nsi": 84,
                      "areaCode": ",".join(map(str, CODIGOS_INCLASNS.values())), "year": ",".join(map(str, ANIOS_INCLASNS.values()))}
        req = urllib.request.Request("https://inclasns.sanidad.gob.es/export/data?" + urlencode(parametros), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=45) as respuesta:
            f.write_bytes(respuesta.read())
    [informe] = json.loads(f.read_text(encoding="utf-8-sig"))
    if informe["indicator"]["id"] != 60:
        raise ValueError("La exportación no corresponde a la segunda dosis de triple vírica (INCLASNS 60)")
    ids_por_codigo = {v: c for c, v in CODIGOS_INCLASNS.items()}
    anios = list(ANIOS_INCLASNS)
    serie = {c: {} for c in TERRITORIOS}
    for fila in informe["data"]:
        anio = int(fila["year"]["name"].removeprefix("year"))
        c = ids_por_codigo[fila["areaCode"]["id"]]
        v = fila["value"]
        if fila["sex"]["id"] != 51 or anio not in anios or anio in serie[c] or not 0 <= v <= 100:
            raise ValueError(f"Dato de vacunación no válido: {c}, {anio}, {v}")
        serie[c][anio] = round(v, 2)
    if set(serie["ES"]) != set(anios) or round(serie["ES"][2024], 1) != 93.7:
        raise ValueError("La cobertura nacional debe cubrir la serie y coincidir con el 93,7 % definitivo de 2024")
    if any(2024 not in s for s in serie.values()):
        raise ValueError("Faltan coberturas territoriales definitivas de 2024")
    return {"anios": anios, "valor": {c: [serie[c].get(a) for a in anios] for c in IDS},
            "espana": [serie["ES"][a] for a in anios],
            "ciudades": {c: [serie[c].get(a) for a in anios] for c in CIUDADES_IDS},
            "objetivo": 95,
            "fuente": "https://www.sanidad.gob.es/areas/promocionPrevencion/vacunaciones/coberturas/home.htm",
            "plan": "https://www.sanidad.gob.es/areas/alertasEmergenciasSanitarias/preparacionRespuesta/planSarampionyRubeola/docs/PlanEstrategico_SarampionyRubeola_2021.pdf"}


def cribado() -> dict:
    series = {c: [] for c in TERRITORIOS}
    for anio, numero in TABLAS_CRIBADO.items():
        f = INE / f"cribado-{numero}.csv"
        if not f.exists():
            INE.mkdir(parents=True, exist_ok=True)
            url = f"https://www.ine.es/jaxi/files/tpx/csv_bdsc/{numero}.csv"
            with urllib.request.urlopen(url, timeout=45) as respuesta:
                f.write_bytes(respuesta.read())
        por_territorio = {c: {} for c in TERRITORIOS}
        with f.open(encoding="utf-8-sig", newline="") as archivo:
            for fila in csv.DictReader(archivo, delimiter=";"):
                if fila["SEXO"] != "AMBOS SEXOS":
                    continue
                nombre = fila["COMUNIDAD AUTÓNOMA"]
                c = "ES" if nombre.lower() == "total" else territorio(nombre, incluir_ciudades=True)
                categoria = fila["TIEMPO TRANSCURRIDO"]
                if c not in por_territorio or categoria in por_territorio[c]:
                    raise ValueError(f"Territorio desconocido o fila duplicada: {nombre}, {categoria}, {anio}")
                por_territorio[c][categoria] = float(fila["Total"].replace(".", "").replace(",", "."))
        for c, datos in por_territorio.items():
            conocidos = datos["Total"] - datos["No consta"]
            dos_anios = datos[PRIMER_ANIO] + datos[SEGUNDO_ANIO]
            if not 0 <= dos_anios <= conocidos or abs(sum(v for k, v in datos.items() if k != "Total") - datos["Total"]) > 0.5:
                raise ValueError(f"Las categorías de cribado no cuadran: {c}, {anio}")
            series[c].append(round(dos_anios / conocidos * 100, 1))
            if c == "ES" and anio == 2025 and round(datos[PRIMER_ANIO] / conocidos * 100, 1) != 32.3:
                raise ValueError("El resultado de los últimos 12 meses no coincide con la nota de prensa ESdE 2025")
    if series["ES"][0] != 38.7:
        raise ValueError("El dato de 2023 no coincide con el monográfico de detección precoz de cáncer")
    return {
        "anios": list(TABLAS_CRIBADO), "valor": {c: series[c] for c in IDS}, "espana": series["ES"],
        "ciudades": {c: series[c] for c in CIUDADES_IDS},
        "tablas": [{"anio": a, "url": f"https://www.ine.es/jaxi/Tabla.htm?tpx={t}&L=0"} for a, t in TABLAS_CRIBADO.items()],
        "metodologia": "https://www.ine.es/metodologia/t15/esde25_meto.pdf",
    }


if __name__ == "__main__":
    datos = {"vacunacion": vacunacion(), "cribado": cribado()}
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}\nCribado en España: {datos['cribado']['espana']}")
