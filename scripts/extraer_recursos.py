"""Recursos de la sanidad por comunidad: profesionales de atención primaria (SIAP) y camas de hospital (SIAE).

Uso:
    python scripts/extraer_recursos.py

Fuentes (en datos-originales/siap/, no se suben a git). Ambas son exportaciones a CSV del Portal Estadístico del
Ministerio de Sanidad > Sistema de Información de Atención Primaria (SIAP) > Profesionales:
  - siap-profesionales-eap-2004-2025.csv: cubo «Equipos de Atención primaria (EAP)». Filas: Año y Comunidad
    Autónoma; columnas: Tipo de profesional; medidas: Nº de profesionales y Población asignada.
  - siap-profesionales-modalidades-2004-2025.csv: cubo «Modalidades asistenciales». Filas: Año y Comunidad Autónoma;
    columnas: Tipo de profesional (nivel detallado); medida: Nº de profesionales. Solo para comprobar.

Consultas por día y profesional (presión asistencial): cubo «Actividad > Ordinaria» del mismo portal, medida «Media
consultas por día y profesional», por año, comunidad y profesional (medicina de familia, pediatría, enfermería):
siap-actividad-ordinaria-2007-2025.csv; y el mismo cubo sin comunidades (fila de España, con Ceuta y Melilla):
siap-actividad-ordinaria-espana-2007-2025.csv. Se toman tal cual, desde 2009 (Cataluña no tiene datos en 2007-2008). Comprobación: la suma de las consultas de las
comunidades da la de España cada año, y 2024 coincide con el resumen oficial (28 consultas al día en medicina de
familia, 16 en pediatría y 16 en enfermería, redondeadas).

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

Ingresos y hospital de día (mismas tablas): ingresos por 1.000 habitantes («frecuentación», AA.2-1. / 5.2.1-5.2.2 /
5.1) × % de la red pública (cálculo propio: ingresos en hospitales de la red pública por 1.000 hab.), y sesiones de
hospital de día por 1.000 habitantes (AOA.5. / 7.5.1-7.5.2 / 6.5; en 2010-2013 la tabla solo trae el número de
sesiones y la tasa se calcula con la población que usa la propia tabla de camas de ese año). Se comprueba que cada tasa
cuadra con número / población. La hospitalización a domicilio no se usa: la serie no es coherente (Extremadura
declara 0 todos los años, Andalucía pasa de 12 a 1,4 y a 40 pacientes por 1.000 ingresos).

TAC y resonancia magnética (mismas tablas): dotación tecnológica en funcionamiento (D.3-2. / D.3. en 2010-2013,
3.2.1-3.2.2-3.2.3 en 2014-2015, 3.2 desde 2016), nº de equipos y % de la red pública (o nº de la red pública en
2023), en cuatro formatos distintos. Tasas por 100.000 habitantes con la población de la tabla de camas de cada año
(cálculo propio). 2022 no se usa: en el Excel y en el PDF de ese año las columnas están desplazadas. Comprobación: la
suma de las comunidades más Ceuta y Melilla coincide con las tablas nacionales de evolución (total y red pública); en
2023 la tasa calculada coincide con la publicada. España: tablas nacionales de evolución (también 2022).

Escribe src/data/recursos.json.

Médicos y enfermería de los hospitales de la red pública por 1.000 habitantes (2016-2023): recuentos de personal vinculado
(sin MIR ni colaboradores) de las tablas 4.2 y 4.4 × % del SNS de la tabla 4.5 (antes de 2016 no hay % SNS por comunidad;
en 2023 la tabla 4.5 del Excel viene descolocada y se usa la página de indicadores del informe anual en PDF). Enfermería =
enfermeros + matronas + otros enfermeros especialistas, como la tabla nacional de evolución. Se comprueba recuento /
población = tasa publicada, suma de comunidades = columna Total y España = tablas nacionales (total y red pública).
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


POB_SIAE: dict = {}  # (año, ccaa o "ES") -> población implícita de la tabla de camas (camas totales / tasa × 1.000)


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
            POB_SIAE[(a, c)] = pob_t
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
        POB_SIAE[(a, "ES")] = total[7] / total[8] * 1000
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
    """Filas de la hoja del año: nombres = (2010-2013, 2014-2015, desde 2016); «A|B» admite nombres alternativos."""
    f = next(SIAE.glob(f"Tablas_CCAA_{anio}.xls*"))
    opciones = (nombres[0] if anio <= 2013 else nombres[1] if anio <= 2015 else nombres[2]).split("|")
    if f.suffix == ".xlsx":
        wb = openpyxl.load_workbook(f, data_only=True, read_only=True)
        nombre = next((n for n in opciones if n in wb.sheetnames), None)
        if nombre is None:
            raise SystemExit(f"SIAE {anio}: no encuentro la hoja {opciones}")
        return [list(r) for r in wb[nombre].iter_rows(values_only=True)]
    wb = xlrd.open_workbook(f)
    nombre = next((n for n in opciones if n in wb.sheet_names()), None)
    if nombre is None:
        raise SystemExit(f"SIAE {anio}: no encuentro la hoja {opciones}")
    h = wb.sheet_by_name(nombre)
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


def picos(serie: dict, anios: list[int], umbral: float = 0.4) -> list[dict]:
    """Años con una cifra muy distinta (≥ 40 %) de la del año anterior y la del siguiente, en el mismo sentido."""
    out = []
    for c, v in serie.items():
        for k in range(1, len(v) - 1):
            a, b = v[k] / v[k - 1] - 1, v[k] / v[k + 1] - 1
            if abs(a) >= umbral and abs(b) >= umbral and (a > 0) == (b > 0):
                out.append({"ccaa": c, "anio": anios[k], "valores": [v[k - 1], v[k], v[k + 1]]})
    return out


def filas_ingresos(rs: list[list], anio: int, avisos: list[str]):
    """Ingresos (nº, por 1.000 hab., % SNS). La tabla de 2022 viene traspuesta: comunidades en columnas, con códigos ES-XX."""
    cab = next((r for r in rs if any(str(x).strip() == "ES-AN" for x in r if x is not None)), None)
    if cab is None:
        return filas_ccaa(rs, 3, anio, avisos)
    cod = {"ES-MU": "MC"}
    cols = {}
    for i, x in enumerate(cab):
        t = str(x).strip() if x is not None else ""
        if t.startswith("ES-") and len(t) == 5:
            cols[cod.get(t, t[3:])] = i
        elif t.lower() == "total":
            cols["ES"] = i
    if set(cols) != {c for c, _ in ORDEN_SIAE} | {"ES"}:
        raise SystemExit(f"SIAE {anio}: columnas inesperadas en la tabla traspuesta de ingresos: {sorted(cols)}")
    k = next(i for i, r in enumerate(rs) if r[0] and str(r[0]).strip().lower().startswith("ingresos"))
    n, frec, pct = rs[k], rs[k + 1], rs[k + 2]
    etq = lambda r: next((str(x).strip() for x in r if isinstance(x, str) and x.strip()), "")
    if "1000" not in etq(frec).replace(".", "") or "sns" not in etq(pct).lower():
        raise SystemExit(f"SIAE {anio}: filas inesperadas en la tabla traspuesta de ingresos ({etq(frec)!r}, {etq(pct)!r})")
    val = {c: [n[i], frec[i], pct[i]] for c, i in cols.items()}
    avisos.append(f"{anio}: la tabla de ingresos viene traspuesta (comunidades en columnas)")
    return {c: val[c] for c, _ in ORDEN_SIAE}, val["ES"]


def ingresos_y_dia(anios: list[int]):
    """Ingresos en la red pública y sesiones de hospital de día, por 1.000 habitantes."""
    ing = {c: [] for c, _ in ORDEN_SIAE}
    dia = {c: [] for c, _ in ORDEN_SIAE}
    esp_ing, esp_dia, avisos, peor = [], [], [], 0.0
    for a in anios:
        com, total = filas_ingresos(hoja(a, ("AA.2-1.|AA.2.", "5.2.1-5.2.2", "5.1")), a, avisos)
        for c, v in list(com.items()) + [("ES", total)]:
            n, frec, pct = v[0], v[1], v[2]
            calc = n / POB_SIAE[(a, c)] * 1000
            if abs(calc / frec - 1) > 0.02 or not 0.3 <= pct <= 1:
                raise SystemExit(f"SIAE {a} {c}: ingresos por 1.000 hab. ({frec}) no cuadran con ingresos / población ({calc:.1f}) o % SNS raro ({pct})")
            peor = max(peor, abs(calc / frec - 1))
            (esp_ing if c == "ES" else ing[c]).append(round(frec * pct, 2))
        com, total = filas_ccaa(hoja(a, ("AOA.5.", "7.5.1-7.5.2", "6.5")), 2, a, avisos)
        for c, v in list(com.items()) + [("ES", total)]:
            calc = v[0] / POB_SIAE[(a, c)] * 1000
            if a >= 2014:  # la tabla trae la tasa: se usa y se comprueba
                if abs(calc / v[1] - 1) > 0.02:
                    raise SystemExit(f"SIAE {a} {c}: hospital de día por 1.000 hab. ({v[1]}) no cuadra con sesiones / población ({calc:.1f})")
                peor = max(peor, abs(calc / v[1] - 1))
                tasa = v[1]
            else:  # 2010-2013: solo el número de sesiones
                tasa = calc
            (esp_dia if c == "ES" else dia[c]).append(round(tasa, 1))
    print(f"  SIAE ingresos y hospital de día {anios[0]}-{anios[-1]}: tasas = número / población (diferencia máxima {peor:.2%})")
    return ing, dia, {"hosp_ingresos": esp_ing, "hosp_dia": esp_dia}, avisos


PRIMER_ANIO_URGENCIAS = 2017  # desde este año la tabla de urgencias trae el % atendido en la red pública


def urgencias(anios: list[int]):
    """Urgencias atendidas en hospitales de la red pública por 1.000 habitantes (cálculo propio: tasa × % SNS)."""
    urg = {c: [] for c, _ in ORDEN_SIAE}
    esp, avisos, peor = [], [], 0.0
    for a in anios:
        com, total = filas_ccaa(hoja(a, ("AOA.4.", "7.4", "6.4")), 2, a, avisos)
        for c, v in list(com.items()) + [("ES", total)]:
            n, pct, tasa = v[0], v[1], v[2]
            calc = n / POB_SIAE[(a, c)] * 1000
            if abs(calc / tasa - 1) > 0.02 or not 0.3 <= pct <= 1:
                raise SystemExit(f"SIAE {a} {c}: urgencias por 1.000 hab. ({tasa}) no cuadran con urgencias / población ({calc:.1f}) o % SNS raro ({pct})")
            peor = max(peor, abs(calc / tasa - 1))
            (esp if c == "ES" else urg[c]).append(round(tasa * pct, 1))
    print(f"  SIAE urgencias {anios[0]}-{anios[-1]}: tasa = urgencias / población (diferencia máxima {peor:.2%})")
    return urg, esp, avisos


ANIO_EQUIPOS_ROTO = 2022  # columnas desplazadas en el Excel y en el PDF de la tabla 3.2
COD_SIAE = {"MU": "MC"}


def _num(v) -> bool:
    if isinstance(v, str):
        return v.strip().replace(".", "").isdigit()
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _val(v) -> float:
    return float(v.strip().replace(".", "")) if isinstance(v, str) else float(v)


def _ccaa(t) -> str | None:
    t = sin_tildes(t)
    if "ceuta" in t:
        return "CEML"
    return next((c for c, p in ORDEN_SIAE if p in t), None)


EQUIPOS = ("tac", "rm", "mam")


def _tipo(t) -> str | None:
    """Tipo de equipo por su nombre en las tablas (la resonancia aparece como RM, RNM o RMN según el año)."""
    t = sin_tildes(t).strip()
    return "tac" if t == "tac" else "rm" if t in ("rm", "rnm", "rmn") else "mam" if t.startswith("mamograf") else None


def equipos_anio(a: int) -> dict:
    """{ccaa: {"tac": (nº, nº red pública), "rm": (...)}} en los cuatro formatos de la tabla de dotación tecnológica."""
    rs = hoja(a, ("D.3-2.|D.3.", "3.2.1-3.2.2-3.2.3", "3.2"))
    if a <= 2013:  # en algunos años la tabla sigue en otra hoja (los mamógrafos están en «D.3-3.»)
        try:
            rs = rs + hoja(a, ("D.3-3.", "", ""))
        except SystemExit:
            pass
    out: dict = {}
    textos = lambda r: [str(v).strip() for v in r if isinstance(v, str) and v.strip()]
    poner = lambda c, k, n, n_sns: out.setdefault(c, {}).setdefault(k, (n, n_sns))
    # 2023: comunidades en columnas (códigos) y filas «TAC | Total», «por 100.000 hab.», «Público-SNS», «por 100.000 hab.»
    cab = next((r for r in rs if "AN" in textos(r) and "MD" in textos(r)), None)
    if cab:
        for i, r in enumerate(rs):
            if r[0] and _tipo(str(r[0])) and str(r[1]).strip() == "Total":
                k = _tipo(str(r[0]))
                for j, cod in enumerate(cab):
                    t = str(cod).strip() if cod else ""
                    c = "CEML" if "CE" in t and "ML" in t else COD_SIAE.get(t, t) if t in [x for x, _ in ORDEN_SIAE] + ["MU"] else None
                    if c and _num(r[j]):
                        poner(c, k, _val(r[j]), _val(rs[i + 2][j]))
                        if c != "CEML":  # la tasa publicada, para comprobar la calculada
                            out[c].setdefault("tasa_" + k, (_val(rs[i + 1][j]), _val(rs[i + 3][j])))
        return out
    # 2016-2020: comunidades en columnas por pares (nº, % SNS), en bloques; el equipo en la primera celda con texto
    if 2016 <= a <= 2020:
        cols: dict = {}
        for r in rs:
            nombres = [(j, _ccaa(v)) for j, v in enumerate(r) if isinstance(v, str) and _ccaa(v)]
            if len(nombres) >= 3:
                cols = {}
                for j, c in nombres:
                    cols.setdefault(c, j)
                continue
            et = next((str(v).strip() for v in r[:3] if isinstance(v, str) and v.strip()), "")
            if cols and _tipo(et):
                for c, j in cols.items():
                    if _num(r[j]) and _num(r[j + 1]):
                        poner(c, _tipo(et), _val(r[j]), _val(r[j]) * _val(r[j + 1]))
        return out
    # 2010-2015 y 2021: comunidades en filas; cabeceras con el equipo al inicio de cada par (nº, % SNS), en bloques
    cols = {}
    for r in rs:
        enc = {_tipo(v): j for j, v in enumerate(r) if isinstance(v, str) and _tipo(v)}
        if enc:
            cols = enc
            continue
        et = next((v for v in r[:3] if isinstance(v, str) and v.strip()), "")
        c = _ccaa(et) if et else None
        if c:
            for k, j in cols.items():
                if _num(r[j]) and _num(r[j + 1]):
                    poner(c, k, _val(r[j]), _val(r[j]) * _val(r[j + 1]))
    return out


def equipos(anios: list[int]):
    """TAC y resonancia por 100.000 habitantes, red pública y total (cálculo propio con la población de la tabla de camas)."""
    # España: tablas nacionales de evolución (la edición más reciente sustituye a la anterior; traen 2022)
    nac: dict = {}
    for fichero, hojas in (("Dotacion_evol_2010_19.xlsx", ("TABLA 1.13",)), ("Dotacion_Evolucion_2014-2023.xlsx", ("TABLA 1.14",))):
        wb = openpyxl.load_workbook(SIAE / fichero, data_only=True, read_only=True)
        h = next(n for n in wb.sheetnames if n.strip() in hojas)
        rs = [list(r) for r in wb[h].iter_rows(values_only=True)]
        cab = next(r for r in rs if any(str(x).strip() == "2014" for x in r if x is not None))
        cols = {i: int(str(x).strip()) for i, x in enumerate(cab) if x is not None and re.fullmatch(r"\d{4}", str(x).strip())}
        bloque = None
        for r in rs:
            et = next((str(x).strip() for x in r if isinstance(x, str) and x.strip()), "")
            if et in ("Públicos-SNS", "Privados"):
                bloque = "sns" if et == "Públicos-SNS" else "priv"
            elif bloque and _tipo(et):
                for i, y in cols.items():
                    nac.setdefault(y, {})[(bloque, _tipo(et))] = float(r[i])
    series = {f"hosp_{e}_{t}": {c: [] for c, _ in ORDEN_SIAE} for e in EQUIPOS for t in ("sns", "total")}
    esp = {k: [] for k in series}
    peor = 0.0
    for a in anios:
        n = nac[a]
        for k, eq in ((e, e) for e in EQUIPOS):
            sns, tot = n[("sns", eq)], n[("sns", eq)] + n[("priv", eq)]
            esp[f"hosp_{k}_sns"].append(round(sns / POB_SIAE[(a, "ES")] * 1e5, 3))
            esp[f"hosp_{k}_total"].append(round(tot / POB_SIAE[(a, "ES")] * 1e5, 3))
        if a == ANIO_EQUIPOS_ROTO:
            for k in series:
                for c in series[k]:
                    series[k][c].append(None)
            continue
        d = equipos_anio(a)
        falta = [(c, e) for c, _ in ORDEN_SIAE + [("CEML", "")] for e in EQUIPOS if c not in d or e not in d[c]]
        if falta:
            raise SystemExit(f"SIAE {a}: faltan equipos en {falta}")
        for eq in EQUIPOS:
            tot = sum(v[eq][0] for v in d.values()); sns = sum(v[eq][1] for v in d.values())
            ref_t, ref_s = n[("sns", eq)] + n[("priv", eq)], n[("sns", eq)]
            dif = max(abs(tot - ref_t) / ref_t, abs(sns - ref_s) / ref_s)
            if dif > 0.02:
                raise SystemExit(f"SIAE {a} {eq}: la suma de las comunidades ({tot:.0f}, {sns:.0f} públicos) no cuadra con la tabla nacional ({ref_t:.0f}, {ref_s:.0f})")
            peor = max(peor, dif)
        for c, _ in ORDEN_SIAE:
            pob = POB_SIAE[(a, c)]
            for eq in EQUIPOS:
                n_t, n_s = d[c][eq]
                series[f"hosp_{eq}_total"][c].append(round(n_t / pob * 1e5, 3))
                series[f"hosp_{eq}_sns"][c].append(round(n_s / pob * 1e5, 3))
                if "tasa_" + eq in d[c]:  # 2023: la tasa publicada debe coincidir con la calculada
                    pub_t, pub_s = d[c]["tasa_" + eq]
                    if abs(n_t / pob * 1e5 - pub_t) > 0.02 or abs(n_s / pob * 1e5 - pub_s) > 0.02:
                        raise SystemExit(f"SIAE {a} {c} {eq}: tasa calculada ({n_t / pob * 1e5:.2f}, {n_s / pob * 1e5:.2f}) frente a la publicada ({pub_t}, {pub_s})")
    print(f"  SIAE TAC, resonancia y mamógrafos {anios[0]}-{anios[-1]} (sin {ANIO_EQUIPOS_ROTO}): suma de comunidades = tablas nacionales (diferencia máxima {peor:.2%})")
    return series, esp


# ---------- Personal de los hospitales públicos (médicos y enfermería) ----------
ANIO_PERSONAL_PDF = 2023  # la tabla 4.5 del Excel de 2023 viene descolocada: indicadores del informe anual (PDF)
CODIGOS_SIAE = {"AN": "AN", "AR": "AR", "AS": "AS", "IB": "IB", "CN": "CN", "CB": "CB", "CL": "CL", "CM": "CM", "CT": "CT",
                "VC": "VC", "EX": "EX", "GA": "GA", "MD": "MD", "MU": "MC", "MC": "MC", "NC": "NC", "PV": "PV", "RI": "RI"}


def _col_ccaa(x) -> str | None:
    """Columna de una cabecera de las tablas de personal: comunidad (código, ES-código o nombre), «CEML» o «TOTAL»."""
    if not isinstance(x, str) or not x.strip():
        return None
    t = x.strip()
    if t.upper().startswith("ES-"):  # 2022: ES-AN, …, ES-CE y ML
        t = t[3:]
    if t.upper() in CODIGOS_SIAE:
        return CODIGOS_SIAE[t.upper()]
    st = sin_tildes(t).strip()
    if st.startswith("total"):
        return "TOTAL"
    if st.startswith("ce y ml") or "ceuta" in st:
        return "CEML"
    return _ccaa(t)


def _bloques(rs: list[list]):
    """Recorre una hoja con una o varias cabeceras de comunidades en columnas: devuelve (etiqueta, {columna: valor}) por fila."""
    cols = None
    for r in rs:
        m = {i: c for i, x in enumerate(r) if (c := _col_ccaa(x))}
        if len(m) >= 8:
            cols = m
            continue
        et = next((x for x in r if isinstance(x, str) and x.strip()), None)
        if cols is None or et is None:
            continue
        vals = {c: float(r[i]) for i, c in cols.items() if i < len(r) and isinstance(r[i], (int, float)) and not isinstance(r[i], bool)}
        if vals:
            yield sin_tildes(et).strip(), vals


def _fila(rs: list[list], cond, anio: int, que: str) -> dict:
    """Une los bloques de la hoja (algunos años parten las comunidades en dos) para la fila que cumple `cond`."""
    out: dict = {}
    for et, vals in _bloques(rs):
        if cond(et):
            out.update(vals)  # si la fila se repite (2015 trae la de 2014 delante), vale la última
    falta = [c for c, _ in ORDEN_SIAE + [("CEML", ""), ("TOTAL", "")] if c not in out]
    if falta:
        raise SystemExit(f"SIAE {anio} {que}: faltan columnas {falta}")
    return out


def _indicadores_pdf(anio: int) -> dict:
    """Médicos y enfermería por 1.000 hab. y % SNS por comunidad, de la página «Indicadores de personal vinculado» del informe."""
    import pdfplumber
    orden = [c for c, _ in ORDEN_SIAE] + ["CEML", "TOTAL"]
    with pdfplumber.open(SIAE / f"{anio}_INFORME_ANUAL_SIAE.pdf") as pdf:
        for pag in pdf.pages:
            t = pag.extract_text() or ""
            if "Indicadores de personal vinculado" not in t or "Medicina" not in t:
                continue
            lineas = [l.strip() for l in t.splitlines()]
            out = {}
            num = lambda l: [float(x.replace("%", "").replace(",", ".")) for x in re.findall(r"\d+,\d+%?", l)]
            for clave, inicio in (("med", "Medicina"), ("enf", "Enfermer"), ("mat", "Matronas")):
                i = next(k for k, l in enumerate(lineas) if l.startswith(inicio))
                sns = next(l for l in lineas[i + 1:i + 7] if l.startswith("% SNS"))
                # la tasa de matronas es por 1.000 mujeres en edad fértil: no se usa (solo su % SNS)
                tasa = sns if clave == "mat" else next(l for l in lineas[i + 1:i + 4] if l.startswith("Por 1000"))
                vt, vs = num(tasa), num(sns)
                if len(vt) != 19 or len(vs) != 19:
                    raise SystemExit(f"SIAE {anio} (informe): esperaba 19 columnas en «{inicio}» y tengo {len(vt)} y {len(vs)}")
                out[clave] = {c: (vt[k], vs[k] / 100) for k, c in enumerate(orden)}
            return out
    raise SystemExit(f"SIAE {anio} (informe): no encuentro la página de indicadores de personal")


def personal(anios_h: list[int]):
    """Médicos y enfermería de los hospitales públicos (SNS) por 1.000 habitantes, 2016-2023.

    Recuentos de personal vinculado (sin MIR ni colaboradores) de las tablas 4.2 y 4.4 × % del SNS de la tabla 4.5 (en
    2023, del informe anual, porque el Excel viene descolocado), con la población de la tabla de camas. Antes de 2016 las
    tablas no traen el % del SNS por comunidad. Se comprueba: recuento / población = tasa publicada (detecta bloques
    descolocados), suma de comunidades = columna Total, y España = tablas nacionales de evolución.
    """
    wb = openpyxl.load_workbook(SIAE / "Personal_Evolucion_2014-2023.xlsx", data_only=True, read_only=True)
    nac: dict = {}
    for hoja_n, clave in (("TABLA 2.3", "med"), ("TABLA 2.7", "enf")):  # 2.7: enfermeros, matronas y otros especialistas
        rs = [list(r) for r in wb[next(n for n in wb.sheetnames if n.strip() == hoja_n)].iter_rows(values_only=True)]
        cab = next(r for r in rs if any(str(x).strip() == "2014" for x in r if x is not None))
        cols = {i: int(str(x).strip()) for i, x in enumerate(cab) if x is not None and re.fullmatch(r"\d{4}", str(x).strip())}
        for r in rs:
            et = sin_tildes(next((x for x in r if isinstance(x, str) and x.strip()), "")).strip()
            if et.startswith("publicos-sns") or et.startswith("total"):
                for i, y in cols.items():
                    nac[(clave, "sns" if et.startswith("publicos") else "tot", y)] = float(r[i])
    anios = [a for a in anios_h if a >= 2016]
    series = {k: {c: [] for c, _ in ORDEN_SIAE} for k in ("hosp_medicos_sns", "hosp_enfermeria_sns")}
    esp = {k: [] for k in series}
    peor_tasa = peor_nac = 0.0
    avisos_p: list[str] = []
    for a in anios:
        med = _fila(hoja(a, ("", "", "4.2")), lambda e: e.startswith("total medico"), a, "total de médicos")
        h44 = hoja(a, ("", "", "4.4"))
        enf = _fila(h44, lambda e: e == "enfermeros", a, "enfermeros")
        mat = _fila(h44, lambda e: e == "matronas", a, "matronas")
        otr = _fila(h44, lambda e: e.startswith("otros enfer"), a, "otros enfermeros especialistas")
        if a == ANIO_PERSONAL_PDF:
            ind = _indicadores_pdf(a)
            ind_m, ind_e, ind_mat = ind["med"], ind["enf"], ind["mat"]
        else:
            rs = hoja(a, ("", "", "4.5"))
            filas = list(_bloques(rs))
            def bloque(es_inicio):
                out: dict = {}
                for k, (et, vals) in enumerate(filas):
                    if es_inicio(et):
                        tasa = next(v for e, v in filas[k + 1:k + 4] if "1000" in e)
                        sns = next((v for e, v in filas[k + 1:k + 5] if e.replace(" ", "") == "%sns"), None)
                        if sns is None:  # 2020: la fila del % SNS de médicos trae la etiqueta «Personal y Formación»
                            e3, sns = filas[k + 3]
                            avisos_p.append(f"{a}: la fila del % SNS de «{et[:20]}» trae la etiqueta «{e3[:25]}» (se lee por su posición)")
                        out.update({c: (tasa[c], sns[c]) for c in tasa if c in sns})
                return out
            ind_m = bloque(lambda e: ("medic" in e) and "residente" not in e and "mir" not in e and "farmac" not in e)
            ind_e = bloque(lambda e: e.startswith("% enfermer") or e.startswith("enfermer"))
            ind_mat = bloque(lambda e: e.startswith("% matrona") or e.startswith("matrona"))
        for nombre, cnt, ind_x in (("médicos", med, ind_m), ("enfermería", enf, ind_e), ("matronas", mat, ind_mat), ("otros enfermeros", otr, None)):
            todas = [c for c, _ in ORDEN_SIAE] + ["CEML"]
            suma = sum(cnt[c] for c in todas)
            if abs(suma / cnt["TOTAL"] - 1) > 0.005:
                raise SystemExit(f"SIAE {a} {nombre}: la suma de comunidades ({suma:.0f}) no es la columna Total ({cnt['TOTAL']:.0f})")
            if suma != cnt["TOTAL"]:  # 2016: la columna Total no es la suma (sí lo es la de los subtotales por especialidad)
                avisos_p.append(f"{a}: {nombre}, columna Total {cnt['TOTAL']:.0f} y suma de comunidades {suma:.0f} (se usa la suma)")
                cnt["TOTAL"] = suma
            if ind_x is None:
                continue
            for c, _ in ORDEN_SIAE:
                if c not in ind_x:
                    raise SystemExit(f"SIAE {a} {nombre}: falta {c} en los indicadores")
                pub, pct = ind_x[c]
                if not 0.5 < pct <= 1:
                    raise SystemExit(f"SIAE {a} {c} {nombre}: % SNS raro ({pct})")
                if nombre == "matronas":
                    continue  # su tasa es por 1.000 mujeres en edad fértil
                # La tasa publicada de enfermería incluye a los «otros enfermeros especialistas» unos años (2016-2022) y otros no (2023)
                calcs = [cnt[c] / POB_SIAE[(a, c)] * 1000] + ([(cnt[c] + otr[c]) / POB_SIAE[(a, c)] * 1000] if nombre == "enfermería" else [])
                calc = min(calcs, key=lambda x: abs(x - pub))
                tol = 0.005 * pub + (0.005 if a == ANIO_PERSONAL_PDF else 0)  # el informe redondea a dos decimales
                if abs(calc - pub) > tol:
                    raise SystemExit(f"SIAE {a} {c} {nombre}: recuento / población ({[round(x, 3) for x in calcs]}) no es la tasa publicada ({pub:.3f}): ¿bloque descolocado?")
                peor_tasa = max(peor_tasa, abs(calc - pub) / pub)
            # Parte pública: suma de comunidades frente a la columna Total
            sns_suma = sum(cnt[c] * ind_x[c][1] for c in todas)
            sns_tot = cnt["TOTAL"] * ind_x["TOTAL"][1]
            if abs(sns_suma / sns_tot - 1) > 0.01:
                raise SystemExit(f"SIAE {a} {nombre}: parte pública, suma de comunidades {sns_suma:.0f} frente a {sns_tot:.0f}")
        # Enfermería = enfermeros + matronas + otros enfermeros especialistas (como la tabla nacional de evolución); la parte
        # pública, con el % SNS de enfermería (matronas, con el suyo)
        pub_med = lambda c: med[c] * ind_m[c][1]
        pub_enf = lambda c: (enf[c] + otr[c]) * ind_e[c][1] + mat[c] * ind_mat[c][1]
        # España frente a la tabla nacional de evolución: total y red pública
        for que, tot, sns in (("med", med["TOTAL"], pub_med("TOTAL")), ("enf", enf["TOTAL"] + mat["TOTAL"] + otr["TOTAL"], pub_enf("TOTAL"))):
            for clave, ref in (("tot", tot), ("sns", sns)):
                d = abs(ref / nac[(que, clave, a)] - 1)
                if d > 0.01:
                    raise SystemExit(f"SIAE {a} {que} ({clave}): {ref:.0f} frente a {nac[(que, clave, a)]:.0f} de la tabla nacional")
                peor_nac = max(peor_nac, d)
        for k, f in (("hosp_medicos_sns", pub_med), ("hosp_enfermeria_sns", pub_enf)):
            for c, _ in ORDEN_SIAE:
                series[k][c].append(round(f(c) / POB_SIAE[(a, c)] * 1000, 3))
            esp[k].append(round(f("TOTAL") / POB_SIAE[(a, "ES")] * 1000, 3))
    print(f"  SIAE personal {anios[0]}-{anios[-1]}: recuento / población = tasa publicada (diferencia máxima {peor_tasa:.2%}); "
          f"España (total y red pública) = tablas nacionales (diferencia máxima {peor_nac:.2%})")
    for x in avisos_p:
        print("   aviso:", x)
    return anios, series, esp


# ---------- Quirófanos en funcionamiento ----------
def quirofanos(anios_h: list[int]):
    """Quirófanos en funcionamiento por 100.000 habitantes, red pública y total (cálculo propio con la población de la tabla
    de camas; se comprueba que coincide con la tasa publicada). 2022 sin dato: la tabla de ese año (Excel y PDF) trae las
    columnas desplazadas (Castilla-La Mancha sale a 0). España: 2010-2019, tabla nacional de evolución 2010-2019 (la de
    2014-2023 repite bajo «Quirófanos» la tabla de hospital de día); 2020-2021, fila TOTAL; 2023, suma de las columnas."""
    wb = openpyxl.load_workbook(SIAE / "Dotacion_evol_2010_19.xlsx", data_only=True, read_only=True)
    rs = [list(r) for r in wb[next(n for n in wb.sheetnames if n.strip().startswith("TABLA 1.11"))].iter_rows(values_only=True)]
    cab = next(r for r in rs if any(str(x).strip() == "2010" for x in r if x is not None))
    cols = {i: int(str(x).strip()) for i, x in enumerate(cab) if x is not None and re.fullmatch(r"\d{4}", str(x).strip())}
    nac: dict = {}
    for r in rs:
        et = sin_tildes(next((x for x in r if isinstance(x, str) and x.strip()), "")).strip()
        if et.startswith("publicos-sns") or et.startswith("total"):
            for i, y in cols.items():
                nac.setdefault(y, {})["sns" if et.startswith("publicos") else "tot"] = float(r[i])
        if et.startswith("total"):
            break
    series = {k: {c: [] for c, _ in ORDEN_SIAE} for k in ("hosp_quir_sns", "hosp_quir_total")}
    esp = {k: [] for k in series}
    peor = peor_nac = 0.0
    avisos: list[str] = []
    for a in anios_h:
        if a == ANIO_EQUIPOS_ROTO:
            for k in series:
                for c in series[k]:
                    series[k][c].append(None)
                esp[k].append(None)
            continue
        d: dict = {}  # ccaa -> (n público, tasa pública, n total, tasa total)
        if a <= 2021:
            rs = hoja(a, ("D.2.", "3.1.1-3.1.2", "3.1"))
            filas, total = filas_ccaa(rs, 4, a, avisos)
            d = {c: v[:4] for c, v in filas.items()}
            tot_sns, tot_tot = total[0], total[2]
            # la fila TOTAL incluye Ceuta y Melilla: la suma de las 17 no puede pasarse ni quedarse muy lejos
            for i, t in ((0, tot_sns), (2, tot_tot)):
                s17 = sum(v[i] for v in d.values())
                if not 0 <= t - s17 <= 20:
                    raise SystemExit(f"SIAE {a} quirófanos: TOTAL {t:.0f} frente a la suma de las 17 comunidades {s17:.0f}")
        else:  # 2023: tabla traspuesta (comunidades en columnas, sin columna TOTAL)
            rs = hoja(a, ("", "", "3.1"))
            cab = next(r for r in rs if sum(1 for x in r if _col_ccaa(x)) >= 17)
            cmap = {i: _col_ccaa(x) for i, x in enumerate(cab) if _col_ccaa(x)}
            k0 = next(i for i, r in enumerate(rs) if sin_tildes(next((x for x in r if isinstance(x, str) and x.strip()), "")).startswith("quirofanos")
                      and not sin_tildes(r[0] or "").startswith("quirofanos r"))
            fila = lambda k: {c: float(rs[k][i]) for i, c in cmap.items()}
            et = [sin_tildes(" ".join(str(x) for x in rs[k] if isinstance(x, str))) for k in range(k0, k0 + 4)]
            if not ("total" in et[0] and "100.000" in et[1] and "publico" in et[2] and "100.000" in et[3]):
                raise SystemExit(f"SIAE {a} quirófanos: filas inesperadas {et}")
            n_t, r_t, n_s, r_s = (fila(k) for k in range(k0, k0 + 4))
            d = {c: (n_s[c], r_s[c], n_t[c], r_t[c]) for c, _ in ORDEN_SIAE}
            tot_sns, tot_tot = sum(n_s.values()), sum(n_t.values())  # con Ceuta y Melilla
        for c, _ in ORDEN_SIAE:
            n_s, r_s, n_t, r_t = d[c]
            pob = POB_SIAE[(a, c)]
            for n, r in ((n_s, r_s), (n_t, r_t)):
                calc = n / pob * 1e5
                if abs(calc - r) > 0.005 * r + 0.01:
                    raise SystemExit(f"SIAE {a} {c} quirófanos: número / población ({calc:.2f}) no es la tasa publicada ({r:.2f}): ¿columnas desplazadas?")
                peor = max(peor, abs(calc - r) / r if r else 0)
            if not 0 < n_s <= n_t:
                raise SystemExit(f"SIAE {a} {c} quirófanos: públicos {n_s} y totales {n_t}")
            series["hosp_quir_sns"][c].append(round(n_s / pob * 1e5, 3))
            series["hosp_quir_total"][c].append(round(n_t / pob * 1e5, 3))
        if a in nac:
            for clave, t in (("sns", tot_sns), ("tot", tot_tot)):
                dif = abs(t / nac[a][clave] - 1)
                if dif > 0.01:
                    raise SystemExit(f"SIAE {a} quirófanos ({clave}): {t:.0f} frente a {nac[a][clave]:.0f} de la tabla nacional")
                peor_nac = max(peor_nac, dif)
            tot_sns, tot_tot = nac[a]["sns"], nac[a]["tot"]
        esp["hosp_quir_sns"].append(round(tot_sns / POB_SIAE[(a, "ES")] * 1e5, 3))
        esp["hosp_quir_total"].append(round(tot_tot / POB_SIAE[(a, "ES")] * 1e5, 3))
    print(f"  SIAE quirófanos {anios_h[0]}-{anios_h[-1]} (sin {ANIO_EQUIPOS_ROTO}): número / población = tasa publicada (diferencia máxima {peor:.2%}); "
          f"España = tabla nacional 2010-2019 (diferencia máxima {peor_nac:.2%})")
    return series, esp, avisos


def leer(nombre: str):
    with open(SIAP / nombre, encoding="latin-1") as f:
        return list(csv.DictReader(f, delimiter=";"))


def actividad_siap():
    """Media de consultas por día y profesional (medicina de familia, pediatría, enfermería), por comunidad y año."""
    tipos = {"Medicina de familia": "ap_consultas_medico", "Pediatría": "ap_consultas_pediatra", "Enfermería": "ap_consultas_enfermera"}
    num = lambda v: float(v.replace(".", "").replace(",", ".")) if v else None
    d: dict = defaultdict(dict)
    for x in leer("siap-actividad-ordinaria-2007-2025.csv"):
        k = tipos.get(x["Profesional"])
        if k:
            d[(int(x["Año"]), SIAP_A_ID[x["Comunidad Autónoma"]])][k] = (num(x["Consultas"]), num(x["Media consultas por día y profesional"]))
    es: dict = defaultdict(dict)
    for x in leer("siap-actividad-ordinaria-espana-2007-2025.csv"):
        k = tipos.get(x["Profesional"])
        if k:
            es[int(x["Año"])][k] = (num(x["Consultas"]), num(x["Media consultas por día y profesional"]))
    # Desde 2009: Cataluña no tiene datos de actividad en 2007 y 2008 (España no sería comparable con los años siguientes).
    anios = [a for a in sorted(es) if a >= 2009]
    falta = [(a, c) for a in anios for c in IDS if (a, c) not in d]
    if falta:
        raise SystemExit(f"SIAP actividad: faltan comunidades {falta}")
    for a in anios:
        for k in tipos.values():
            suma = sum(d[(a, c)][k][0] for c in IDS + ["CEML"] if (a, c) in d)  # Ceuta y Melilla no tienen dato en 2012
            if abs(suma - es[a][k][0]) > 1:
                raise SystemExit(f"SIAP actividad {a} {k}: la suma de las comunidades ({suma:.0f}) no da España ({es[a][k][0]:.0f})")
    resumen_2024 = {"ap_consultas_medico": 28, "ap_consultas_pediatra": 16, "ap_consultas_enfermera": 16}
    for k, v in resumen_2024.items():
        if round(es[2024][k][1]) != v:
            raise SystemExit(f"SIAP actividad 2024 {k}: {es[2024][k][1]} no redondea a {v} (resumen oficial)")
    series = {k: {c: [d[(a, c)][k][1] for a in anios] for c in IDS} for k in tipos.values()}
    espana = {k: [es[a][k][1] for a in anios] for k in tipos.values()}
    print(f"  SIAP actividad {anios[0]}-{anios[-1]}: suma de consultas = España; 2024 = resumen oficial (28, 16 y 16 consultas al día)")
    return anios, series, espana


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
    anios_act, act, esp_act = actividad_siap()
    indicadores += [{"id": k, "fuente": "siap", "anios": anios_act, "valor": v, "espana": esp_act[k]} for k, v in act.items()]
    ocu, est, esp_a, avisos_a = agudos(anios_h)
    amb, esp_amb, avisos_c = cirugia(anios_h)
    ing, dia, esp_id, avisos_i = ingresos_y_dia(anios_h)
    picos_dia = picos(dia, anios_h)
    anios_u = [a for a in anios_h if a >= PRIMER_ANIO_URGENCIAS]
    urg, esp_urg, avisos_u = urgencias(anios_u)
    # Urgencias: años con una cifra un 20 % o más distinta de la del año anterior y de la del siguiente (sin explicarlo)
    # 2020 baja en todas las comunidades (coincide con la pandemia): no se usa como término de comparación.
    picos_urg = [x for x in picos(urg, anios_u, 0.2) if not {x["anio"] - 1, x["anio"], x["anio"] + 1} & {2020}]
    print(f"  Urgencias, años con una cifra muy distinta de los de alrededor: {[(x['ccaa'], x['anio']) for x in picos_urg]}")
    eq, esp_eq = equipos(anios_h)
    print(f"  Hospital de día, años con una cifra muy distinta de los de alrededor: {[(x['ccaa'], x['anio']) for x in picos_dia]}")
    indicadores += [{"id": "hosp_camas_sns", "fuente": "siae", "anios": anios_h, "valor": c_sns, "espana": esp_h["hosp_camas_sns"]},
                    {"id": "hosp_camas_total", "fuente": "siae", "anios": anios_h, "valor": c_tot, "espana": esp_h["hosp_camas_total"]},
                    {"id": "hosp_ocupacion", "fuente": "siae", "anios": anios_h, "valor": ocu, "espana": esp_a["hosp_ocupacion"]},
                    {"id": "hosp_estancia", "fuente": "siae", "anios": anios_h, "valor": est, "espana": esp_a["hosp_estancia"]},
                    {"id": "hosp_cma", "fuente": "siae", "anios": anios_h, "valor": amb, "espana": esp_amb},
                    {"id": "hosp_ingresos", "fuente": "siae", "anios": anios_h, "valor": ing, "espana": esp_id["hosp_ingresos"]},
                    {"id": "hosp_dia", "fuente": "siae", "anios": anios_h, "valor": dia, "espana": esp_id["hosp_dia"]},
                    {"id": "hosp_urgencias", "fuente": "siae", "anios": anios_u, "valor": urg, "espana": esp_urg}]
    indicadores += [{"id": k, "fuente": "siae", "anios": anios_h, "valor": eq[k], "espana": esp_eq[k]} for k in eq]
    anios_p, pers, esp_p = personal(anios_h)
    # Personal, justo después de las camas
    k_camas = next(i for i, x in enumerate(indicadores) if x["id"] == "hosp_camas_total") + 1
    indicadores[k_camas:k_camas] = [{"id": k, "fuente": "siae", "anios": anios_p, "valor": pers[k], "espana": esp_p[k]} for k in pers]
    quir, esp_q, avisos_q = quirofanos(anios_h)
    k_q = next(i for i, x in enumerate(indicadores) if x["id"] == "hosp_cma") + 1
    indicadores[k_q:k_q] = [{"id": k, "fuente": "siae", "anios": anios_h, "valor": quir[k], "espana": esp_q[k]} for k in quir]
    # Cambios de un año al siguiente del 20 % o más (hecho, sin explicarlo: la fuente no lo hace)
    saltos_p = [{"indicador": k, "ccaa": c, "anio": anios_p[j], "valores": [v[j - 1], v[j]]}
                for k in pers for c, v in pers[k].items() for j in range(1, len(v)) if abs(v[j] / v[j - 1] - 1) >= 0.2]
    print(f"  Personal, cambios de un año a otro del 20 % o más: {[(x['indicador'][5:9], x['ccaa'], x['anio']) for x in saltos_p]}")
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
        "etiquetas_siae": sorted(set(avisos_h + avisos_a + avisos_c + avisos_i + avisos_q + avisos_u)),
        "picos": [{"indicador": "hosp_dia", **x} for x in picos_dia] + [{"indicador": "hosp_urgencias", **x} for x in picos_urg],
        "saltos_personal": saltos_p,
        "anio_equipos_sin_dato": ANIO_EQUIPOS_ROTO,
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
