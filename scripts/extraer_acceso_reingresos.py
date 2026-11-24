"""Genera las series territoriales de acceso a atención médica (ECV) y reingresos (RAE-CMBD)."""

from __future__ import annotations

import json
import re
import urllib.request

from extraer_resultados import ORDEN, RAIZ, URL_INE_TABLA, series

SALIDA = RAIZ / "src" / "data" / "acceso-reingresos.json"
URL_INCLASNS = "https://inclasns.sanidad.gob.es/report/indicator/?indicators=225"
ARCHIVO_RAE = RAIZ / "datos-originales" / "rae-cmbd" / "inclasns-reingresos-225.html"
URL_INFORMES = "https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/tablasEstadisticas/"
IDS = [c for c, _ in ORDEN]
MAPA_RAE = dict(zip(IDS + ["CE", "ML"], (
    "andalucia", "aragon", "asturias", "baleares", "canarias", "cantabria", "castillayleon",
    "castillalamancha", "cataluna", "comunidadvalenciana", "extremadura", "galicia", "madrid",
    "murcia", "navarra", "paisvasco", "riojala", "ceuta", "melilla",
), strict=True))

# Transcripción de las etiquetas de los gráficos oficiales, en el orden de IDS, Ceuta, Melilla y Total SNS.
INFORMES = {
    2021: (
        "InfAnualSNS2022/INFORME_ANUAL_2022.pdf", "5-22", 148,
        [7.1, 6.5, 8.2, 7.1, 7.8, 7.6, 9.3, 8.7, 7.7, 8.5, 9.0, 9.2, 8.0, 8.2, 5.4, 7.4, 8.4, 7.6, 8.8, 7.9],
    ),
    2022: (
        "InfAnualSNS2023/INFORME_ANUAL_2023.pdf", "5-16", 80,
        [7.4, 7.2, 8.6, 7.2, 8.4, 7.8, 9.6, 9.4, 8.2, 8.9, 9.9, 9.6, 8.4, 8.5, 6.4, 8.0, 8.2, 8.2, 8.8, 8.4],
    ),
    2023: (
        "InfAnual2024/INFORME_ANUAL_2024.pdf", "5-16", 71,
        [7.4, 6.9, 8.5, 7.2, 7.8, 7.8, 9.5, 9.3, 8.1, 8.9, 9.5, 9.5, 8.2, 8.3, 6.5, 7.8, 8.5, 7.2, 10.4, 8.3],
    ),
}


def empaquetar(datos: dict[str, dict[int, float]], primero: int) -> dict:
    if set(datos) != {*IDS, "ES"}:
        raise SystemExit("Faltan comunidades o el total nacional")
    anios = list(range(primero, max(datos["ES"]) + 1))
    for territorio, valores in datos.items():
        if set(anios) - valores.keys() or any(not 0 <= valores[a] <= 100 for a in anios):
            raise SystemExit(f"Serie incompleta o porcentaje incorrecto: {territorio}")
    return {
        "anios": anios,
        "valor": {c: [datos[c][a] for a in anios] for c in IDS},
        "espana": [datos["ES"][a] for a in anios],
    }


def acceso() -> dict:
    # En 2015 cambió el cuestionario. La tabla del ODS 3.8.1 ofrece los tres motivos de acceso combinados.
    return {
        **empaquetar(series("79194"), 2015),
        "tabla": URL_INE_TABLA.format("79194"),
        "metodologia": "https://www.ine.es/metodologia/ICV/metodologia_ICV.pdf",
    }


def reingresos() -> dict:
    if not ARCHIVO_RAE.exists():
        ARCHIVO_RAE.parent.mkdir(parents=True, exist_ok=True)
        peticion = urllib.request.Request(URL_INCLASNS, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(peticion, timeout=60) as respuesta:
            ARCHIVO_RAE.write_bytes(respuesta.read())
    pagina = ARCHIVO_RAE.read_text(encoding="utf-8")
    if not re.search(r"\bvar selectedIndicator\s*=\s*225\s*;", pagina):
        raise SystemExit("El archivo INCLASNS no contiene el indicador 225")

    def objeto(nombre: str) -> dict:
        match = re.search(rf"\bvar {nombre}\s*=\s*(\{{[^\n]+\}})\s*;", pagina)
        if not match:
            raise SystemExit(f"No se encuentra {nombre} en INCLASNS")
        return json.loads(match[1].replace("'", '"'))

    # Se usa el corte explícito por año. El mapa inicial cambia al publicarse otro año.
    mapa = objeto("areaValues")["year2024"]
    nacional = objeto("serieTotal")
    if set(mapa) != {*MAPA_RAE.values(), "espana"} or mapa["espana"] != nacional["year2024"]:
        raise SystemExit("El corte de 2024 de INCLASNS no coincide con el territorio o el total esperados")
    territorios = [*MAPA_RAE, "ES"]
    datos = {c: {} for c in territorios}
    for anio, (_, _, _, valores) in INFORMES.items():
        if valores[-1] != round(nacional[f"year{anio}"], 1):
            raise SystemExit(f"El total SNS de {anio} no coincide con INCLASNS")
        for c, valor in zip(territorios, valores, strict=True):
            datos[c][anio] = valor
    for c, clave in (MAPA_RAE | {"ES": "espana"}).items():
        datos[c][2024] = round(mapa[clave], 1)
    return {
        **empaquetar({c: datos[c] for c in [*IDS, "ES"]}, 2021),
        "perfil": URL_INCLASNS,
        "informes": [
            {"anio": a, "url": URL_INFORMES + ruta, "grafico": grafico, "pagina": pagina_impresa}
            for a, (ruta, grafico, pagina_impresa, _) in INFORMES.items()
        ],
    }


if __name__ == "__main__":
    datos = {"acceso": acceso(), "reingresos": reingresos()}
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for nombre, dato in datos.items():
        print(f"{nombre}: {len(dato['valor'])} comunidades, {dato['anios'][0]}–{dato['anios'][-1]}")
