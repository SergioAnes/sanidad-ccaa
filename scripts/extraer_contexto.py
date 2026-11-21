"""Datos de contexto de cada comunidad para la ficha (no corrigen el gasto: ayudan a entenderlo).

Uso:
    python scripts/extraer_contexto.py

Fuentes (ficheros en datos-originales/, no se suben a git):
  - Población por edad, 1 de enero: INE, Estadística Continua de Población, tabla 56940
    (ine-56940-poblacion-ccaa-edad.csv) -> % de 65 y más años y de 80 y más años, población total.
  - Superficie (IGN, Registro Central de Cartografía) y núcleos de población («entidades singulares», INE), ambos
    certificados en los anexos de la liquidación del sistema de financiación (liquidacion-sfa-anexos-AAAA.pdf).
    Densidad = población / superficie.
  - Población con seguro privado voluntario además de la sanidad pública («cobertura mixta»): Encuesta de Salud de
    España 2023 (Ministerio de Sanidad e INE), tabla 2.174 (esde2023-mod2-rel.xlsx) y su coeficiente de variación
    (esde2023-errores-muestreo.xlsx). Es una encuesta: se guarda el intervalo de confianza al 95 %.
    En esta encuesta los mutualistas con aseguradora privada cuentan como cobertura PÚBLICA (tabla 2.178:
    «Pública: Mutualidades del Estado acogidas a un seguro privado»); privada es solo el seguro voluntario.

Escribe src/data/contexto-ccaa.json.
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

import openpyxl
import pdfplumber

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "datos-originales"
SALIDA = RAIZ / "src" / "data" / "contexto-ccaa.json"
ANIO = 2024  # fecha de referencia: 1 de enero de 2024 (la de la superficie y los núcleos certificados)
IDS = ["AN", "AR", "AS", "IB", "CN", "CB", "CL", "CM", "CT", "VC", "EX", "GA", "MD", "MC", "NC", "PV", "RI"]


def norm(t: str) -> str:
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", t)


# Claves normalizadas que identifican cada comunidad en los distintos ficheros (INE, IGN, encuesta)
CLAVES = {"AN": ["andalucia"], "AR": ["aragon"], "AS": ["asturias"], "IB": ["balears"], "CN": ["canarias"],
          "CB": ["cantabria"], "CL": ["castillayleon"], "CM": ["castillalamancha"], "CT": ["cataluna"],
          "VC": ["valenciana"], "EX": ["extremadura"], "GA": ["galicia"], "MD": ["madrid"], "MC": ["murcia"],
          "NC": ["navarra"], "PV": ["paisvasco"], "RI": ["rioja"]}


def id_de(nombre: str) -> str | None:
    n = norm(nombre)
    return next((c for c, ks in CLAVES.items() if any(k in n for k in ks)), None)


def poblacion() -> dict[str, dict]:
    tot, m65, m80, suma = {}, {}, {}, {}
    with open(ORIGEN / "ine-56940-poblacion-ccaa-edad.csv", encoding="utf-8-sig") as f:
        r = csv.reader(f, delimiter="\t")
        next(r)
        for edad, ccaa, sexo, periodo, total in r:
            if sexo != "Total" or periodo != f"1 de enero de {ANIO}":
                continue
            c = id_de(re.sub(r"^\d+\s+", "", ccaa))
            if not c or ccaa.startswith("Total"):
                continue
            v = int(total.replace(".", "") or 0)
            if edad == "Todas las edades":
                tot[c] = v
                continue
            # Solo edades sueltas («0 años» … «99 años») y «100 y más años»: la tabla trae también el agregado
            # «85 y más años», que se contaría dos veces.
            if not re.fullmatch(r"\d+ años?|100 y más años", edad):
                continue
            e = int(re.match(r"(\d+)", edad).group(1))
            suma[c] = suma.get(c, 0) + v
            m65[c] = m65.get(c, 0) + (v if e >= 65 else 0)
            m80[c] = m80.get(c, 0) + (v if e >= 80 else 0)
    out = {}
    for c in IDS:
        if suma[c] != tot[c]:
            raise SystemExit(f"{c}: la suma de edades ({suma[c]}) no da el total ({tot[c]})")
        out[c] = {"poblacion": tot[c], "pct65": round(100 * m65[c] / tot[c], 2), "pct80": round(100 * m80[c] / tot[c], 2)}
    return out


def certificados() -> tuple[dict[str, float], dict[str, int], int]:
    """Superficie (km²) y entidades singulares de los certificados del IGN y del INE en los anexos de la liquidación."""
    sup, ent, pag = {}, {}, None
    with pdfplumber.open(ORIGEN / f"liquidacion-sfa-anexos-{ANIO}.pdf") as pdf:
        for i, p in enumerate(pdf.pages, 1):
            t = p.extract_text() or ""
            if f"SUPERFICIE DE LAS CC.AA. ESPAÑOLAS A 1 DE ENERO DE {ANIO}" in t:
                for linea in t.splitlines():
                    m = re.match(r"^\d{2}\s+(.+?)\s+([\d.]+,\d+)$", linea.strip())
                    if m and (c := id_de(m.group(1))):
                        sup[c] = float(m.group(2).replace(".", "").replace(",", "."))
            if "Total" in t and f"01/01/{ANIO}" in t and re.search(r"^\d{2} Andaluc", t, re.M) and not sup.get("_ent"):
                filas = {}
                for linea in t.splitlines():
                    m = re.match(r"^(\d{2})\s+(.+?)\s+([\d.]+)$", linea.strip())
                    if m and (c := id_de(m.group(2))):
                        filas[c] = int(m.group(3).replace(".", ""))
                    m = re.match(r"^Total\s+([\d.]+)$", linea.strip())
                    if m:
                        total = int(m.group(1).replace(".", ""))
                if len(filas) == 17:
                    ent, pag = filas, i
                    # Ceuta (3) y Melilla (1) también están en el total
                    cm = [int(m.group(1)) for m in re.finditer(r"^1[89]\s+(?:Ceuta|Melilla)\s+(\d+)$", t, re.M)]
                    if sum(ent.values()) + sum(cm) != total:
                        raise SystemExit("Entidades singulares: la suma no da el total")
    if len(sup) != 17 or len(ent) != 17:
        raise SystemExit(f"Faltan comunidades: superficie {len(sup)}, entidades {len(ent)}")
    return sup, ent, pag


def cobertura() -> tuple[dict[str, dict], dict]:
    def tabla(fichero: str) -> dict[str, list]:
        wb = openpyxl.load_workbook(ORIGEN / fichero, read_only=True, data_only=True)
        filas, dentro = {}, False
        for r in wb["Tabla 2.174"].iter_rows(values_only=True):
            celdas = [x for x in r if x is not None]
            if not celdas:
                continue
            if str(celdas[0]).strip() == "AMBOS SEXOS":
                dentro = True
                continue
            if dentro and str(celdas[0]).strip() in ("Hombres", "Mujeres"):
                break
            if dentro:
                filas[str(celdas[0]).strip()] = celdas[1:]
        return filas

    pct, cv = tabla("esde2023-mod2-rel.xlsx"), tabla("esde2023-errores-muestreo.xlsx")
    # columnas de porcentajes: Total, Pública excl., Privada excl., Mixta, Otras; de CV: Pública, Privada, Mixta, Otras
    out = {}
    for nombre, fila in pct.items():
        c = id_de(nombre)
        if not c:
            continue
        if abs(sum(float(x) for x in fila[1:5]) - 100) > 0.05:
            raise SystemExit(f"Encuesta: {nombre} no suma 100")
        mixta, cv_mixta = float(fila[3]), float(cv[nombre][2])
        mitad = 1.96 * cv_mixta / 100 * mixta
        out[c] = {"mixta": mixta, "cv": cv_mixta, "ic": [round(mixta - mitad, 1), round(mixta + mitad, 1)]}
    total = pct["TOTAL"]
    espana = {"mixta": float(total[3]), "cv": float(cv["TOTAL"][2])}
    if len(out) != 17:
        raise SystemExit(f"Encuesta: {len(out)} comunidades")
    return out, espana


def main() -> None:
    pob = poblacion()
    sup, ent, pag = certificados()
    cob, espana = cobertura()
    datos = {
        "fecha": f"{ANIO}-01-01",
        "fuentes": {
            "poblacion": "INE, Estadística Continua de Población (tabla 56940), 1 de enero de " + str(ANIO),
            "superficie": "Instituto Geográfico Nacional, Registro Central de Cartografía (certificado en los anexos de la liquidación del sistema de financiación de " + str(ANIO) + ")",
            "entidades": "INE, entidades singulares de población (certificado en los mismos anexos)",
            "cobertura": "Ministerio de Sanidad e INE, Encuesta de Salud de España 2023, tabla 2.174 (cobertura mixta) y coeficientes de variación",
        },
        "urls": {
            "poblacion": "https://www.ine.es/jaxiT3/Tabla.htm?t=56940",
            "liquidacion": "https://www.hacienda.gob.es/es-ES/CDI/Paginas/SistemasFinanciacionDeuda/InformacionCCAAs/Informes%20financiacion%20comunidades%20autonomas2.aspx",
            "encuesta": "https://www.sanidad.gob.es/estadEstudios/estadisticas/encuestaSaludEspana/home.htm",
        },
        "pagina_entidades": pag,
        "espana_cobertura": espana,
        "ccaa": {c: {**pob[c], "superficie": sup[c], "densidad": round(pob[c]["poblacion"] / sup[c], 1),
                     "entidades": ent[c], **{f"cobertura_{k}": v for k, v in cob[c].items()}} for c in IDS},
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA.relative_to(RAIZ)}")
    for c in IDS:
        d = datos["ccaa"][c]
        print(f"  {c}: 65+ {d['pct65']:5.2f} %  80+ {d['pct80']:5.2f} %  densidad {d['densidad']:7.1f}  núcleos {d['entidades']:6d}  mixta {d['cobertura_mixta']:5.2f} % [{d['cobertura_ic'][0]}-{d['cobertura_ic'][1]}]")


if __name__ == "__main__":
    main()
