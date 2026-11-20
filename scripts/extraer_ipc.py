"""Descarga el IPC general nacional del INE y calcula la media anual del índice.

Uso:  python scripts/extraer_ipc.py

- Fuente: INE, Índice de Precios de Consumo, serie IPC251852
  ("Nacional. Índice general. Índice", base 2021 = 100), API JSON de INEbase (Tempus).
- Guarda la respuesta original en datos-originales/ (no se sube a git).
- Escribe src/data/ipc.json con la media de los 12 meses de cada año completo.
  La web lo usa para expresar el gasto en euros del último año (descontada la inflación).
"""
import json
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SERIE = "IPC251852"
URL = f"https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/{SERIE}?nult=400"
ORIGINAL = RAIZ / "datos-originales" / f"ine-{SERIE.lower()}.json"
SALIDA = RAIZ / "src" / "data" / "ipc.json"


def main() -> None:
    with urllib.request.urlopen(URL, timeout=60) as r:
        crudo = r.read()
    ORIGINAL.parent.mkdir(exist_ok=True)
    ORIGINAL.write_bytes(crudo)
    datos = json.loads(crudo)

    por_anio: dict[int, list[float]] = {}
    for fila in datos["Data"]:
        por_anio.setdefault(fila["Anyo"], []).append(fila["Valor"])
    medias = {str(a): round(sum(v) / len(v), 3) for a, v in sorted(por_anio.items()) if len(v) == 12}

    # Comprobaciones: base 2021 = 100 y años completos consecutivos
    assert abs(medias["2021"] - 100) < 0.01, medias["2021"]
    anios = [int(a) for a in medias]
    assert anios == list(range(anios[0], anios[-1] + 1)), "faltan años"

    SALIDA.write_text(json.dumps({
        "fuente": "INE — Índice de Precios de Consumo, índice general nacional (base 2021), media anual",
        "serie": SERIE,
        "url": "https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176802&menu=ultiDatos&idp=1254735976607",
        "medias": medias,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(medias)} años ({anios[0]}-{anios[-1]}) -> {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
