"""Recursos de la sanidad por comunidad: profesionales de atención primaria (SIAP) y camas de hospital (SIAE).

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

Camas de hospital (datos-originales/siae/, no se suben a git): tablas anuales por comunidad de la Estadística de
Centros Sanitarios de Atención Especializada (SIAE), Tablas_CCAA_2010.xls ... Tablas_CCAA_2023.xlsx, de
https://www.sanidad.gob.es/estadEstudios/estadisticas/estHospiInternado/inforAnual/homeESCRI.htm y «Años anteriores».
Tabla de camas según dependencia (D.1. en 2010-2013, 2.1.1-2.1.2 en 2014-2015, 2.1 desde 2016): camas en
funcionamiento de la red pública (SNS) y del total, con su tasa por 1.000 habitantes publicada. Se toman las tasas tal
cual. España: la fila TOTAL (incluye Ceuta y Melilla). Todos los hospitales (agudos, media y larga estancia, salud
mental), públicos y privados, en la comunidad donde está el hospital. La red pública incluye los privados con concierto
sustitutorio o de la Red de Utilización Pública; la definición es la misma desde 2010.
Comprobaciones (se detiene si fallan): cada fila da la misma población en la parte pública y en el total (detecta filas
desplazadas), el % SNS cuadra con las camas, la fila TOTAL es la suma de las comunidades, y España coincide con las
tablas nacionales de evolución (Dotacion_evol_2010_19.xlsx y Dotacion_Evolucion_2014-2023.xlsx).

Ocupación y estancia media (mismas tablas): indicadores de los hospitales de agudos de la red pública (AA.4. en
2010-2013, 5.3.2 en 2014-2015, 5.3 desde 2016): estancia media (días) e índice de ocupación, tal como se publican.
Comprobación: ocupación = estancia media × índice de rotación / 365 (estancias / camas / 365), con margen de redondeo.

Cirugía mayor ambulatoria (mismas tablas): indicadores de actividad quirúrgica (AOA.2. en 2010-2013, 7.2 en
2014-2015, 6.2 desde 2016): «% de ambulatorización» de la red pública = intervenciones de cirugía mayor ambulatoria /
(intervenciones con hospitalización + cirugía mayor ambulatoria). Se toma tal cual; se comprueba recalculándolo con
los números de intervenciones y sus % de la red pública de la misma fila.

Escribe src/data/recursos.json.
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import openpyxl
import xlrd

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


SIAE = RAIZ / "datos-originales" / "siae"
URL_SIAE = "https://www.sanidad.gob.es/estadEstudios/estadisticas/estHospiInternado/inforAnual/homeESCRI.htm"
URL_SIAE_ANTERIORES = "https://www.sanidad.gob.es/estadEstudios/estadisticas/estHospiInternado/inforAnual/anteriores.htm"
# Orden de las comunidades en las tablas del SIAE y una pista de su nombre (algunos años traen etiquetas erróneas)
ORDEN_SIAE = [("AN", "andal"), ("AR", "arag"), ("AS", "astur"), ("IB", "bale"), ("CN", "canar"), ("CB", "cantab"),
              ("CL", "castilla y le"), ("CM", "mancha"), ("CT", "catal"), ("VC", "valen"), ("EX", "extrem"), ("GA", "galic"),
              ("MD", "madrid"), ("MC", "murcia"), ("NC", "navarra"), ("PV", "vasco"), ("RI", "rioja")]


def hoja_camas(anio: int) -> list[list]:
    f = next(SIAE.glob(f"Tablas_CCAA_{anio}.xls*"))
    nombre = "D.1." if anio <= 2013 else "2.1.1-2.1.2" if anio <= 2015 else "2.1"
    if f.suffix == ".xlsx":
        return [list(r) for r in openpyxl.load_workbook(f, data_only=True, read_only=True)[nombre].iter_rows(values_only=True)]
    h = xlrd.open_workbook(f).sheet_by_name(nombre)
    return [h.row_values(i) for i in range(h.nrows)]


def sin_tildes(t) -> str:
    return unicodedata.normalize("NFKD", str(t)).encode("ascii", "ignore").decode().lower()


def camas():
    """Camas en funcionamiento por 1.000 hab., red pública (SNS) y total, por comunidad y año (tablas anuales del SIAE)."""
    anios = sorted(int(re.search(r"(\d{4})", f.name).group(1)) for f in SIAE.glob("Tablas_CCAA_*.xls*"))
    sns = {c: [] for c, _ in ORDEN_SIAE}
    tot = {c: [] for c, _ in ORDEN_SIAE}
    esp_sns, esp_tot, n_sns, n_tot, avisos = [], [], [], [], []
    for a in anios:
        filas = []
        for r in hoja_camas(a):
            # la etiqueta es la primera celda con texto (en 2010-2013 no está en la primera columna)
            j = next((i for i, x in enumerate(r) if isinstance(x, str) and x.strip()), None)
            if j is None:
                continue
            nums = [x for x in r[j + 1:] if isinstance(x, (int, float)) and not isinstance(x, bool)]
            if len(nums) >= 10:
                filas.append((r[j].strip(), nums[:10]))
        if len(filas) < 19:
            raise SystemExit(f"SIAE {a}: solo {len(filas)} filas con datos en la tabla de camas")
        # columnas: instaladas (SNS nº, tasa, total nº, tasa, % SNS) y en funcionamiento (las mismas cinco)
        for (c, pista), (etq, v) in zip(ORDEN_SIAE, filas[:17]):
            if pista not in sin_tildes(etq):
                if any(p in sin_tildes(etq) for _, p in ORDEN_SIAE):
                    raise SystemExit(f"SIAE {a}: en la posición de {c} aparece «{etq}»")
                avisos.append(f"{a}: la fila de {c} trae la etiqueta «{etq}»")
            n_s, t_s, n_t, t_t, pct = v[5], v[6], v[7], v[8], v[9]
            pob_s, pob_t = n_s / t_s * 1000, n_t / t_t * 1000
            if abs(pob_s / pob_t - 1) > 0.015:
                raise SystemExit(f"SIAE {a} {c}: la población implícita no cuadra ({pob_s:.0f} frente a {pob_t:.0f})")
            if abs(n_s / n_t - (pct if pct <= 1 else pct / 100)) > 0.006:
                raise SystemExit(f"SIAE {a} {c}: el % SNS ({pct}) no cuadra con las camas ({n_s}/{n_t})")
            sns[c].append(round(t_s, 3))
            tot[c].append(round(t_t, 3))
        total = next(v for etq, v in filas[17:] if sin_tildes(etq).startswith("total"))
        ceml = next(v for etq, v in filas[17:] if "ceuta" in sin_tildes(etq))
        for i in (5, 7):
            suma = sum(v[i] for _, v in filas[:17]) + ceml[i]
            if abs(suma - total[i]) > 2:
                raise SystemExit(f"SIAE {a}: la fila TOTAL ({total[i]}) no es la suma de las comunidades ({suma})")
        esp_sns.append(round(total[6], 3)); esp_tot.append(round(total[8], 3)); n_sns.append(total[5]); n_tot.append(total[7])
    # España frente a las tablas nacionales de evolución (la edición más reciente sustituye a la anterior)
    ref = {}
    for fichero, hoja in (("Dotacion_evol_2010_19.xlsx", "TABLA 1.5 1.6"), ("Dotacion_Evolucion_2014-2023.xlsx", "TABLA 1.8 1.9")):
        rs = [list(r) for r in openpyxl.load_workbook(SIAE / fichero, data_only=True, read_only=True)[hoja].iter_rows(values_only=True)]
        cab = next(r for r in rs if any(str(x).strip() == "2014" for x in r if x is not None))
        cols = {i: int(str(x).strip()) for i, x in enumerate(cab) if x is not None and re.fullmatch(r"\d{4}", str(x).strip())}
        etq = lambda r: next((str(x).strip() for x in r if isinstance(x, str) and x.strip()), "")
        f_sns = next(r for r in rs if etq(r) == "Públicos-SNS")
        f_tot = next(r for r in rs[rs.index(f_sns):] if sin_tildes(etq(r)) == "total")
        for i, y in cols.items():
            ref[y] = (f_sns[i], f_tot[i])
    peor = 0.0
    for k, a in enumerate(anios):
        if a not in ref:
            raise SystemExit(f"SIAE: no hay dato nacional de evolución para {a}")
        d = max(abs(n_sns[k] / ref[a][0] - 1), abs(n_tot[k] / ref[a][1] - 1))
        print(f"   {a}: tabla anual {n_sns[k]} / {n_tot[k]} · evolución {ref[a][0]} / {ref[a][1]}")
        if d > 0.01:
            raise SystemExit(f"SIAE {a}: España frente a la tabla de evolución difiere un {d:.2%}")
        peor = max(peor, d)
    print(f"  SIAE {anios[0]}-{anios[-1]}: filas cuadradas; España frente a las tablas de evolución, diferencia máxima {peor:.2%}")
    for x in avisos:
        print("   aviso:", x)
    return anios, sns, tot, {"hosp_camas_sns": esp_sns, "hosp_camas_total": esp_tot}, avisos


def hoja(anio: int, nombres: tuple[str, str, str]) -> list[list]:
    """Filas de la hoja del año: nombres = (2010-2013, 2014-2015, desde 2016)."""
    f = next(SIAE.glob(f"Tablas_CCAA_{anio}.xls*"))
    nombre = nombres[0] if anio <= 2013 else nombres[1] if anio <= 2015 else nombres[2]
    if f.suffix == ".xlsx":
        return [list(r) for r in openpyxl.load_workbook(f, data_only=True, read_only=True)[nombre].iter_rows(values_only=True)]
    h = xlrd.open_workbook(f).sheet_by_name(nombre)
    return [h.row_values(i) for i in range(h.nrows)]


def filas_ccaa(rs: list[list], minimo: int, anio: int, avisos: list[str]):
    """Filas con etiqueta y al menos `minimo` números: las 17 comunidades en el orden del SIAE, Ceuta y Melilla y TOTAL."""
    filas = []
    for r in rs:
        j = next((i for i, x in enumerate(r) if isinstance(x, str) and x.strip()), None)
        if j is None:
            continue
        nums = [x for x in r[j + 1:] if isinstance(x, (int, float)) and not isinstance(x, bool)]
        if len(nums) >= minimo:
            filas.append((r[j].strip(), nums))
    if len(filas) < 19:
        raise SystemExit(f"SIAE {anio}: solo {len(filas)} filas con datos")
    for (c, pista), (etq, _) in zip(ORDEN_SIAE, filas[:17]):
        if pista not in sin_tildes(etq):
            if any(p in sin_tildes(etq) for _, p in ORDEN_SIAE):
                raise SystemExit(f"SIAE {anio}: en la posición de {c} aparece «{etq}»")
            avisos.append(f"{anio}: la fila de {c} trae la etiqueta «{etq}»")
    total = next(v for etq, v in filas[17:] if sin_tildes(etq).startswith("total"))
    return {c: v for (c, _), (_, v) in zip(ORDEN_SIAE, filas[:17])}, total


def agudos(anios: list[int]):
    """Estancia media e índice de ocupación de los hospitales de agudos de la red pública, por comunidad y año."""
    ocu = {c: [] for c, _ in ORDEN_SIAE}
    est = {c: [] for c, _ in ORDEN_SIAE}
    esp_ocu, esp_est, avisos, peor = [], [], [], 0.0
    for a in anios:
        com, total = filas_ccaa(hoja(a, ("AA.4.", "5.3.2", "5.3")), 4, a, avisos)  # Ceuta y Melilla no tienen parte privada
        for c, v in list(com.items()) + [("ES", total)]:
            em, io, ir = v[0], v[1], v[2]  # red pública: estancia media, índice de ocupación, índice de rotación
            if not (3 <= em <= 15 and 0.3 <= io <= 1.05 and 15 <= ir <= 70):
                raise SystemExit(f"SIAE {a} {c}: valores fuera de rango (estancia {em}, ocupación {io}, rotación {ir})")
            calc = em * ir / 365
            tol = io * (0.06 / em + 0.06 / ir) + 0.003  # redondeo de la estancia (a veces un decimal) y la rotación
            if abs(calc - io) > tol:
                raise SystemExit(f"SIAE {a} {c}: la ocupación ({io}) no cuadra con estancia × rotación / 365 ({calc:.3f})")
            peor = max(peor, abs(calc - io))
            if c == "ES":
                esp_ocu.append(round(io * 100, 1)); esp_est.append(round(em, 2))
            else:
                ocu[c].append(round(io * 100, 1)); est[c].append(round(em, 2))
    print(f"  SIAE agudos {anios[0]}-{anios[-1]}: ocupación = estancia × rotación / 365 en todas las filas (diferencia máxima {peor:.3f})")
    return ocu, est, {"hosp_ocupacion": esp_ocu, "hosp_estancia": esp_est}, avisos


def cirugia(anios: list[int]):
    """% de cirugía mayor que se hace sin ingreso (ambulatoria) en la red pública, por comunidad y año."""
    amb = {c: [] for c, _ in ORDEN_SIAE}
    esp, avisos, peor = [], [], 0.0
    for a in anios:
        com, total = filas_ccaa(hoja(a, ("AOA.2.", "7.2", "6.2")), 8, a, avisos)
        for c, v in list(com.items()) + [("ES", total)]:
            # columnas: total (nº, por 1.000 hab., % SNS), con hospitalización (nº, % SNS), CMA (nº, % SNS), % ambulatorización SNS
            hosp, p_hosp, cma, p_cma, pct = v[3], v[4], v[5], v[6], v[7]
            cma_sns, hosp_sns = cma * p_cma, hosp * p_hosp
            calc = cma_sns / (cma_sns + hosp_sns)
            if not 0.1 <= pct <= 0.9:
                raise SystemExit(f"SIAE {a} {c}: % de ambulatorización fuera de rango ({pct})")
            if abs(calc - pct) > 0.01:
                raise SystemExit(f"SIAE {a} {c}: el % de ambulatorización ({pct}) no cuadra con las intervenciones ({calc:.3f})")
            peor = max(peor, abs(calc - pct))
            (esp if c == "ES" else amb[c]).append(round(pct * 100, 1))
    print(f"  SIAE cirugía {anios[0]}-{anios[-1]}: % de ambulatorización recalculado en todas las filas (diferencia máxima {peor:.3f})")
    return amb, esp, avisos


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

    anios_h, c_sns, c_tot, esp_h, avisos_h = camas()
    # Años en que las camas de la red pública cambian mucho (≥ 10 %) y las totales poco (< 5 %): camas que la estadística
    # pasa a contar como públicas o como privadas. Solo el hecho aritmético (total = pública + privada), sin explicarlo.
    reclasif = []
    for c in c_sns:
        for k in range(1, len(anios_h)):
            ds, dt = c_sns[c][k] / c_sns[c][k - 1] - 1, c_tot[c][k] / c_tot[c][k - 1] - 1
            if abs(ds) >= 0.10 and abs(dt) < 0.05:
                reclasif.append({"ccaa": c, "anio": anios_h[k], "sns": [c_sns[c][k - 1], c_sns[c][k]], "total": [c_tot[c][k - 1], c_tot[c][k]]})
    print(f"  Cambios de clasificación pública/privada: {[(x['ccaa'], x['anio']) for x in reclasif]}")
    indicadores = [{"id": k, "fuente": "siap", "anios": anios, "valor": v, "espana": espana[k]} for k, v in inds.items()]
    ocu, est, esp_a, avisos_a = agudos(anios_h)
    amb, esp_amb, avisos_c = cirugia(anios_h)
    indicadores += [{"id": "hosp_camas_sns", "fuente": "siae", "anios": anios_h, "valor": c_sns, "espana": esp_h["hosp_camas_sns"]},
                    {"id": "hosp_camas_total", "fuente": "siae", "anios": anios_h, "valor": c_tot, "espana": esp_h["hosp_camas_total"]},
                    {"id": "hosp_ocupacion", "fuente": "siae", "anios": anios_h, "valor": ocu, "espana": esp_a["hosp_ocupacion"]},
                    {"id": "hosp_estancia", "fuente": "siae", "anios": anios_h, "valor": est, "espana": esp_a["hosp_estancia"]},
                    {"id": "hosp_cma", "fuente": "siae", "anios": anios_h, "valor": amb, "espana": esp_amb}]
    datos = {
        "fuentes": {
            "siap": {"texto": "Ministerio de Sanidad, Sistema de Información de Atención Primaria (SIAP), Portal Estadístico", "url": URL_SIAP,
                     "ruta": "Profesionales > Equipos de Atención primaria (EAP): Nº de profesionales y Población asignada, por año, comunidad y tipo de profesional",
                     "resumen": URL_RESUMEN},
            "siae": {"texto": "Ministerio de Sanidad, Estadística de Centros Sanitarios de Atención Especializada (SIAE)", "url": URL_SIAE,
                     "anteriores": URL_SIAE_ANTERIORES,
                     "ruta": "Tablas por Comunidades Autónomas de cada año: dotación de camas según dependencia, camas en funcionamiento por 1.000 habitantes"},
        },
        "ruptura": RUPTURA,
        "repetidos": repetidos,
        "etiquetas_siae": sorted(set(avisos_h + avisos_a + avisos_c)),
        "reclasificaciones": reclasif,
        "profesionales": profesionales,
        "indicadores": indicadores,
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}. Años en que se repiten las tres cifras de profesionales: {repetidos}")
    for i in indicadores:
        print(f"  {i['id']}: España {i['espana'][0]} ({i['anios'][0]}) -> {i['espana'][-1]} ({i['anios'][-1]})")


if __name__ == "__main__":
    main()
