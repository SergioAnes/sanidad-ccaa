"""Extrae las listas de espera por CCAA del informe SISLE-SNS en PDF.

Uso:
    python scripts/extraer_sisle.py [ruta_pdf ...]

Por defecto lee todos los datos-originales/Datos_ccaa_*.pdf y escribe
src/data/listas-espera.json. Requiere `pip install pdfplumber`.

Cada informe ("Datos por comunidad autónoma", situación a 30 de junio o 31 de
diciembre) trae 12 tablas:
  pág. 3-4  Lista de espera quirúrgica por especialidad
  pág. 5-6  Lista de espera quirúrgica de procesos seleccionados
  pág. 7-8  Lista de espera de consultas externas por especialidad
y, en cada bloque, 4 medidas: pacientes, tasa por 1.000 hab., tiempo medio (días)
y % de pacientes que superan 6 meses (quirúrgica) o 60 días (consultas).

Comprobaciones:
  - cada tabla tiene las 19 filas (17 CCAA + Ceuta + Melilla) en el orden esperado;
  - en las tablas de pacientes, la suma de especialidades = columna TOTAL;
  - la población implícita (pacientes / tasa) es coherente entre bloques.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "src" / "data" / "listas-espera.json"

FILAS = [
    ("ANDALUCIA", "AN"), ("ARAGON", "AR"), ("PDO DE ASTURIAS", "AS"), ("BALEARES", "IB"),
    ("CANARIAS", "CN"), ("CANTABRIA", "CB"), ("CASTILLA Y LEON", "CL"), ("CASTILLA-LA MANCHA", "CM"),
    ("CATALUNA", "CT"), ("COMUNIDAD VALENCIANA", "VC"), ("EXTREMADURA", "EX"), ("GALICIA", "GA"),
    ("MADRID", "MD"), ("MURCIA", "MC"), ("C. FORAL DE NAVARRA", "NC"), ("PAIS VASCO", "PV"),
    ("RIOJA", "RI"), ("CEUTA", "CE"), ("MELILLA", "ML"),
]

QUIRURGICA = [
    ("cirugia_general", "Cirugía general y de digestivo"), ("ginecologia", "Ginecología"),
    ("oftalmologia", "Oftalmología"), ("orl", "Otorrinolaringología"), ("traumatologia", "Traumatología"),
    ("urologia", "Urología"), ("cirugia_cardiaca", "Cirugía cardiaca"),
    ("angiologia", "Angiología / cirugía vascular"), ("maxilofacial", "Cirugía maxilofacial"),
    ("cirugia_pediatrica", "Cirugía pediátrica"), ("cirugia_plastica", "Cirugía plástica"),
    ("cirugia_toracica", "Cirugía torácica"), ("neurocirugia", "Neurocirugía"),
    ("dermatologia", "Dermatología"),
]
PROCESOS = [
    ("catarata", "Cataratas"), ("hernia", "Hernia inguinal / crural"), ("protesis_cadera", "Prótesis de cadera"),
    ("artroscopia", "Artroscopia"), ("varices", "Varices en miembros inferiores"),
    ("colecistectomia", "Colecistectomía (vesícula)"), ("hallux_valgus", "Hallux valgus (juanete)"),
    ("adenoamigdalectomia", "Adenoamigdalectomía (vegetaciones y amígdalas)"),
    ("prostata", "Hipertrofia benigna de próstata"), ("quiste_pilonidal", "Quiste pilonidal"),
    ("tunel_carpiano", "Túnel carpiano"), ("total", "Total procesos seleccionados (RD 605/2003)"),
    ("protesis_rodilla", "Prótesis de rodilla"), ("cardiaca_valvular", "Cirugía cardiaca valvular"),
    ("bypass_coronario", "By-pass coronario"), ("histerectomia", "Histerectomía"),
]
CONSULTAS = [
    ("ginecologia", "Ginecología"), ("oftalmologia", "Oftalmología"), ("traumatologia", "Traumatología"),
    ("dermatologia", "Dermatología"), ("orl", "Otorrinolaringología"), ("neurologia", "Neurología"),
    ("cirugia_general", "Cirugía general y de digestivo"), ("urologia", "Urología"),
    ("digestivo", "Aparato digestivo"), ("cardiologia", "Cardiología"),
]

# (página 1-based, tipo, medidas de las dos tablas de la página, columnas, ¿columna TOTAL aparte?)
PAGINAS = [
    (3, "quirurgica", ["pacientes", "tasa"], QUIRURGICA, True),
    (4, "quirurgica", ["dias", "pct_largo"], QUIRURGICA, True),
    (5, "procesos", ["pacientes", "tasa"], PROCESOS, False),
    (6, "procesos", ["dias", "pct_largo"], PROCESOS, False),
    (7, "consultas", ["pacientes", "tasa"], CONSULTAS, True),
    (8, "consultas", ["dias", "pct_largo"], CONSULTAS, True),
]

TIPOS = [
    {"id": "quirurgica", "nombre": "Lista de espera quirúrgica por especialidad",
     "campos": [{"id": "total", "nombre": "Total"}] + [{"id": i, "nombre": n} for i, n in QUIRURGICA],
     "largo": "más de 6 meses"},
    {"id": "procesos", "nombre": "Lista de espera quirúrgica: procesos seleccionados",
     "campos": [{"id": i, "nombre": n} for i, n in PROCESOS], "largo": "más de 6 meses"},
    {"id": "consultas", "nombre": "Consultas externas con el especialista",
     "campos": [{"id": "total", "nombre": "Total"}] + [{"id": i, "nombre": n} for i, n in CONSULTAS],
     "largo": "más de 60 días"},
]

MEDIDAS = [
    {"id": "pacientes", "nombre": "Pacientes en espera", "unidad": "num"},
    {"id": "tasa", "nombre": "Pacientes por 1.000 habitantes", "unidad": "por_mil"},
    {"id": "dias", "nombre": "Tiempo medio de espera", "unidad": "dias"},
    {"id": "pct_largo", "nombre": "% de pacientes con espera larga", "unidad": "pct"},
]

MESES = {"junio": "06", "diciembre": "12"}


def norm(t: str) -> str:
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().upper().strip()


def valor(t: str) -> float | None:
    t = t.strip()
    if t in ("-", ""):
        return None  # en el informe "-" = sin dato
    return float(t.replace(".", "").replace(",", "."))


SALTO = "\n"  # pdfplumber separa con saltos de línea los valores de una columna


def tablas_pagina(pagina) -> list[list[list[str]]]:
    """Devuelve, por cada tabla de la página, sus columnas de valores (19 filas cada una) en orden."""
    out = []
    for t in pagina.extract_tables():
        i = next(k for k, r in enumerate(t) if r[0] and r[0].count(SALTO) == len(FILAS) - 1)
        fila = t[i]
        nombres = [norm(n) for n in fila[0].split(SALTO)]
        if nombres != [n for n, _ in FILAS]:
            raise SystemExit(f"Filas inesperadas en pág. {pagina.page_number}: {nombres}")
        cols = []
        for j, celda in enumerate(fila[1:], start=1):
            if not celda:
                continue
            if SALTO in celda:
                col = celda.split(SALTO)
            else:
                # Columna "partida" (los totales): primer valor aquí, el resto en las filas siguientes.
                col = [celda] + [r[j] for r in t[i + 1:] if r[j]]
            if len(col) != len(FILAS):
                raise SystemExit(f"Pág. {pagina.page_number}, columna {j}: {len(col)} valores")
            cols.append(col)
        out.append(cols)
    return out


def corte_de(pdf) -> str:
    texto = pdf.pages[0].extract_text() + "\n" + pdf.pages[2].extract_text()
    m = re.search(r"(\d{1,2}) de (junio|diciembre) de (\d{4})", texto, re.I)
    if not m:
        raise SystemExit("No se encuentra la fecha de corte")
    return f"{m.group(3)}-{MESES[m.group(2).lower()]}"


def extraer(ruta: Path) -> tuple[str, list[dict]]:
    filas: list[dict] = []
    with pdfplumber.open(str(ruta)) as pdf:
        corte = corte_de(pdf)
        for num, tipo, medidas, campos, con_total in PAGINAS:
            tablas = tablas_pagina(pdf.pages[num - 1])
            if len(tablas) != 2:
                raise SystemExit(f"Pág. {num}: se esperaban 2 tablas y hay {len(tablas)}")
            ids = [c for c, _ in campos] + (["total"] if con_total else [])
            for medida, cols in zip(medidas, tablas):
                if len(cols) != len(ids):
                    raise SystemExit(f"Pág. {num} {medida}: {len(cols)} columnas, esperadas {len(ids)}")
                for campo, col in zip(ids, cols):
                    for (_, ccaa), txt in zip(FILAS, col):
                        v = valor(txt)
                        if v is not None:
                            filas.append({"corte": corte, "tipo": tipo, "campo": campo,
                                          "medida": medida, "ccaa": ccaa, "valor": v})
    return corte, filas


def comprobar(filas: list[dict]) -> None:
    idx = {(f["corte"], f["tipo"], f["campo"], f["medida"], f["ccaa"]): f["valor"] for f in filas}
    cortes = {f["corte"] for f in filas}
    for corte in cortes:
        for tipo, campos in (("quirurgica", QUIRURGICA), ("consultas", CONSULTAS)):
            for _, ccaa in FILAS:
                suma = sum(idx.get((corte, tipo, c, "pacientes", ccaa), 0) for c, _ in campos)
                tot = idx[(corte, tipo, "total", "pacientes", ccaa)]
                # En quirúrgica el TOTAL es exactamente la suma de las 14 especialidades.
                # En consultas el TOTAL incluye especialidades que el informe no desglosa (suma < TOTAL).
                if (tipo == "quirurgica" and suma != tot) or suma > tot:
                    raise SystemExit(f"{corte} {tipo} {ccaa}: suma especialidades {suma} != TOTAL {tot}")
        for _, ccaa in FILAS:
            suma = sum(idx.get((corte, "procesos", c, "pacientes", ccaa), 0) for c, _ in PROCESOS[:11])
            tot = idx[(corte, "procesos", "total", "pacientes", ccaa)]
            if suma != tot:
                raise SystemExit(f"{corte} procesos {ccaa}: suma {suma} != total {tot}")
        # Población implícita = pacientes / tasa * 1000, tomada de la columna con más pacientes
        # (la más precisa). No se usan los totales: en quirúrgica y procesos la tasa total es la
        # suma de las tasas ya redondeadas de cada columna.
        for _, ccaa in FILAS:
            pac_campos = [(pac, k) for k, pac in idx.items()
                          if k[0] == corte and k[4] == ccaa and k[3] == "pacientes" and k[2] != "total"]
            pac, k = max(pac_campos)
            pob = pac / idx[(corte, k[1], k[2], "tasa", ccaa)] * 1000
            print(f"  {corte} {ccaa}: población implícita {pob:,.0f}")
            # Cada columna de pacientes debe dar la tasa publicada con esa población:
            # detecta columnas desplazadas al leer el PDF.
            for (c2, tipo, campo, medida, cc), pac in idx.items():
                if c2 != corte or cc != ccaa or medida != "pacientes" or campo == "total":
                    continue
                tasa = idx.get((corte, tipo, campo, "tasa", ccaa))
                if tasa is not None and abs(pac / pob * 1000 - tasa) > 0.011:
                    raise SystemExit(f"{corte} {tipo}/{campo} {ccaa}: pacientes {pac} no cuadra con tasa {tasa}")


def info_pdf(ruta: Path) -> tuple[dict, list[str]]:
    """Versión del PDF (nombre, si es rectificado, fecha de modificación) y sus notas al pie
    (líneas que empiezan por "(1)" o "*"), para avisar en la web de qué fichero salen los datos."""
    with pdfplumber.open(ruta) as pdf:
        fecha = (pdf.metadata or {}).get("ModDate") or (pdf.metadata or {}).get("CreationDate") or ""
        notas: list[str] = []
        for pagina in pdf.pages:
            actual = None
            for linea in (pagina.extract_text() or "").split(SALTO):
                l = linea.strip()
                if re.match(r"^(\(\d\)|\*)\s*\S", l):
                    actual = [l]
                    notas.append(actual)  # type: ignore[arg-type]
                elif actual is not None and l and not l.lower().startswith(("fuente", "secretar")):
                    actual.append(l)  # la nota sigue en la línea siguiente
                else:
                    actual = None
        # Una entrada por nota (la misma llamada puede repetirse en varias páginas con matices)
        unicas: dict[str, str] = {}
        for partes in notas:
            texto = " ".join(partes)  # type: ignore[arg-type]
            clave = texto.split(")")[0] if texto.startswith("(") else texto[:1]
            if len(texto) > len(unicas.get(clave, "")):
                unicas[clave] = texto
        notas = list(unicas.values())
    m = re.match(r"D:(\d{4})(\d{2})(\d{2})", fecha)
    version = {
        "fichero": ruta.name,
        "rectificado": "rectific" in ruta.name.lower(),
        "fecha_pdf": f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None,
    }
    return version, notas


def main() -> None:
    rutas = [Path(p) for p in sys.argv[1:]] or sorted((RAIZ / "datos-originales").glob("Datos_ccaa_*.pdf"))
    if not rutas:
        raise SystemExit("No hay PDFs del SISLE en datos-originales/")
    filas: list[dict] = []
    cortes = []
    versiones, notas_pdf = {}, []
    for r in rutas:
        corte, f = extraer(r)
        versiones[corte], notas = info_pdf(r)
        notas_pdf += [{"corte": corte, "texto": t} for t in notas]
        if corte in cortes:
            raise SystemExit(f"Corte {corte} repetido ({r.name})")
        cortes.append(corte)
        filas += f
        print(f"{r.name}: corte {corte}, {len(f)} valores")
    comprobar(filas)

    orden_t = {t["id"]: i for i, t in enumerate(TIPOS)}
    orden_m = {m["id"]: i for i, m in enumerate(MEDIDAS)}
    filas.sort(key=lambda f: (f["corte"], orden_t[f["tipo"]], f["campo"], orden_m[f["medida"]], f["ccaa"]))
    meta = {
        "fuente": "Ministerio de Sanidad — Sistema de Información sobre Listas de Espera en el SNS (SISLE-SNS), datos por comunidad autónoma",
        "url": "https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/listaEspera.htm",
        "cortes": sorted(cortes),
        "versiones": versiones,
        "notas_pdf": notas_pdf,
        "tipos": TIPOS,
        "medidas": MEDIDAS,
    }
    cuerpo = ",\n".join("    " + json.dumps(f, ensure_ascii=False) for f in filas)
    cab = json.dumps(meta, ensure_ascii=False, indent=2)[:-2]  # quita el "}" final
    SALIDA.write_text(cab + ',\n  "valores": [\n' + cuerpo + "\n  ]\n}\n", encoding="utf-8")
    json.loads(SALIDA.read_text(encoding="utf-8"))  # valida el JSON escrito
    print(f"Escrito {SALIDA.relative_to(RAIZ)}: {len(filas)} valores")


if __name__ == "__main__":
    main()
