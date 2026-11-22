"""Recursos de la sanidad pública por comunidad: profesionales de atención primaria (SIAP).

Uso:
    python scripts/extraer_recursos.py

Fuentes (en datos-originales/siap/, no se suben a git). Ambas son exportaciones a CSV del Portal Estadístico del
Ministerio de Sanidad > Sistema de Información de Atención Primaria (SIAP) > Profesionales:
  - siap-profesionales-eap-2004-2025.csv: cubo «Equipos de Atención primaria (EAP)». Filas: Año y Comunidad
    Autónoma; columnas: Tipo de profesional; medidas: Nº de profesionales y Población asignada.
  - siap-profesionales-modalidades-2004-2025.csv: cubo «Modalidades asistenciales». Filas: Año y Comunidad Autónoma;
    columnas: Tipo de profesional (nivel detallado); medida: Nº de profesionales. Solo para comprobar.

Qué se cuenta (definición del SIAP): profesionales de los equipos de atención primaria, del modelo tradicional y de
pediatría de área, a 31 de diciembre. No incluye urgencias, residentes ni personal directivo. Población asignada: la que
tiene tarjeta sanitaria asignada a un profesional (medicina de familia: adultos; pediatría: niños).

Cálculo propio: población asignada / profesionales (personas por profesional, como el «ratio» del SIAP). Para
enfermería, la población asignada a medicina de familia más la de pediatría. España: suma de las 17 comunidades (Ceuta y
Melilla van juntas en el SIAP y no se muestran).

Comprobaciones (se detiene si fallan):
  - la población asignada de 2024 (17 comunidades + Ceuta y Melilla) es la del resumen del SIAP 2024: 48.034.708;
  - el cubo EAP es la suma de las modalidades «AP», «Modelo tradicional» y «Pediatría de Área» del otro cubo.

Escribe src/data/recursos.json.
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SIAP = RAIZ / "datos-originales" / "siap"
SALIDA = RAIZ / "src" / "data" / "recursos.json"
IDS = ["AN", "AR", "AS", "IB", "CN", "CB", "CL", "CM", "CT", "VC", "EX", "GA", "MD", "MC", "NC", "PV", "RI"]
SIAP_A_ID = {"ANDALUCÍA": "AN", "ARAGÓN": "AR", "ASTURIAS (PRINCIPADO DE)": "AS", "BALEARES (ISLAS)": "IB", "CANARIAS": "CN",
             "CANTABRIA": "CB", "CASTILLA Y LEÓN": "CL", "CASTILLA-LA MANCHA": "CM", "CATALUÑA": "CT",
             "COMUNIDAD VALENCIANA": "VC", "EXTREMADURA": "EX", "GALICIA": "GA", "MADRID (COMUNIDAD DE)": "MD",
             "MURCIA (REGIÓN DE)": "MC", "NAVARRA (COMUNIDAD FORAL DE)": "NC", "PAÍS VASCO": "PV", "LA RIOJA": "RI",
             "CEUTA y MELILLA (INGESA)": "CEML"}
TIPOS = {"Medicina de familia": "mf", "Pediatría": "ped", "Enfermería": "enf"}
# Modalidades del cubo detallado que forman cada tipo del cubo EAP
MODALIDADES = {"mf": ("Medicina Familia y Comunitaria - AP", "Medicina Familia y Comunitaria - Modelo tradicional"),
               "ped": ("Pediatría - AP", "Pediatría - Modelo tradicional", "Pediatría de Area"),
               "enf": ("Enfermería - AP", "Enfermería - Modelo tradicional")}
POBLACION_2024 = 48_034_708  # resumen gráfico SIAP 2024 (Ministerio de Sanidad)
URL_SIAP = "https://pestadistico.inteligenciadegestion.sanidad.gob.es/publicoSNS/S/sistema-de-informacion-de-atencion-primaria-siap"
URL_RESUMEN = "https://www.sanidad.gob.es/estadEstudios/estadisticas/docs/siap/RGraficoSIAP_SNS_2024.pdf"
RUPTURA = {"ccaa": "CT", "anio": 2020, "texto": "A partir del año 2020, ruptura de serie por revisión de los datos de recursos humanos de Cataluña."}


def leer(nombre: str):
    with open(SIAP / nombre, encoding="latin-1") as f:
        return list(csv.DictReader(f, delimiter=";"))


def main() -> None:
    d: dict = defaultdict(dict)  # (año, ccaa) -> tipo -> (población, profesionales)
    for x in leer("siap-profesionales-eap-2004-2025.csv"):
        c, t = SIAP_A_ID.get(x["Comunidad Autónoma"]), TIPOS.get(x["Tipo de profesional"])
        if x["Comunidad Autónoma"] not in SIAP_A_ID:
            raise SystemExit(f"Comunidad desconocida en el SIAP: {x['Comunidad Autónoma']}")
        if t:
            d[(int(x["Año"]), c)][t] = (int(x["Población asignada"] or 0), int(x["Nº de profesionales"] or 0))
    anios = sorted({a for a, _ in d})

    # Comprobación 1: población asignada de 2024
    pob = sum(d[(2024, c)][t][0] for c in IDS + ["CEML"] for t in ("mf", "ped"))
    if pob != POBLACION_2024:
        raise SystemExit(f"Población asignada 2024: {pob} frente a {POBLACION_2024} del resumen del SIAP")
    # Comprobación 2: el cubo EAP = suma de sus modalidades en el cubo detallado
    mod: dict = defaultdict(int)
    for x in leer("siap-profesionales-modalidades-2004-2025.csv"):
        for t, nombres in MODALIDADES.items():
            if x["Tipo de profesional"] in nombres:
                mod[(int(x["Año"]), SIAP_A_ID[x["Comunidad Autónoma"]], t)] += int(x["Nº de profesionales"] or 0)
    distintos = [(a, c, t) for (a, c), v in d.items() for t in v if v[t][1] != mod[(a, c, t)]]
    if distintos:
        raise SystemExit(f"El cubo EAP no coincide con la suma de modalidades en {distintos[:5]}")
    print(f"  SIAP {anios[0]}-{anios[-1]}: población 2024 = resumen oficial; cubo EAP = suma de modalidades en {len(d) * 3} casos")

    inds = {"ap_pob_medico": {}, "ap_pob_pediatra": {}, "ap_pob_enfermera": {}}
    for c in IDS:
        for k in inds:
            inds[k][c] = []
        for a in anios:
            mf, ped, enf = (d[(a, c)][t] for t in ("mf", "ped", "enf"))
            if not (mf[1] and ped[1] and enf[1] and mf[0] and ped[0]):
                raise SystemExit(f"SIAP: faltan datos en {c} {a}")
            inds["ap_pob_medico"][c].append(round(mf[0] / mf[1], 1))
            inds["ap_pob_pediatra"][c].append(round(ped[0] / ped[1], 1))
            inds["ap_pob_enfermera"][c].append(round((mf[0] + ped[0]) / enf[1], 1))
    s = lambda a, t, i: sum(d[(a, c)][t][i] for c in IDS)
    espana = {"ap_pob_medico": [round(s(a, "mf", 0) / s(a, "mf", 1), 1) for a in anios],
              "ap_pob_pediatra": [round(s(a, "ped", 0) / s(a, "ped", 1), 1) for a in anios],
              "ap_pob_enfermera": [round((s(a, "mf", 0) + s(a, "ped", 0)) / s(a, "enf", 1), 1) for a in anios]}
    # Años en que una comunidad repite exactamente las tres cifras de profesionales del año anterior (hecho, sin interpretar)
    repetidos = [{"ccaa": c, "anio": a} for c in IDS for a in anios[1:]
                 if all(d[(a, c)][t][1] == d[(a - 1, c)][t][1] for t in ("mf", "ped", "enf"))]
    profesionales = {c: {t: [d[(a, c)][t][1] for a in anios] for t in ("mf", "ped", "enf")} for c in IDS}

    datos = {
        "fuente": {"texto": "Ministerio de Sanidad, Sistema de Información de Atención Primaria (SIAP), Portal Estadístico", "url": URL_SIAP,
                   "ruta": "Profesionales > Equipos de Atención primaria (EAP): Nº de profesionales y Población asignada, por año, comunidad y tipo de profesional",
                   "resumen": URL_RESUMEN},
        "anios": anios,
        "ruptura": RUPTURA,
        "repetidos": repetidos,
        "profesionales": profesionales,
        "indicadores": [{"id": k, "valor": v, "espana": espana[k]} for k, v in inds.items()],
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}. Años en que se repiten las tres cifras de profesionales: {repetidos}")
    for k in inds:
        print(f"  {k}: España {espana[k][0]} ({anios[0]}) -> {espana[k][-1]} ({anios[-1]})")


if __name__ == "__main__":
    main()
