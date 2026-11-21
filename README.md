# Sanidad por comunidades

Web pública estática para comparar el gasto sanitario público y las listas de espera de las 17
comunidades autónomas, con mapa, ranking, evolución, tabla descargable y una ficha por comunidad.

> **Estado:** todos los datos son **oficiales**: Estadística de Gasto Sanitario Público 2002-2024 y
> SISLE-SNS (Ministerio de Sanidad), IPC (INE) y límites territoriales (IGN). Las cifras de gasto de
> 2023 y 2024 son provisionales.

## Tecnología

- Next.js (exportación estática, sin backend) y TypeScript
- Gráficos y mapa en SVG propio, sin librerías de gráficos en el navegador
- CSS propio, con modo oscuro
- Datos separados en `src/data`

## Secciones

- **Datos:** mapa (valor del año o crecimiento desde 2002), titulares automáticos, ranking, evolución
  (descontando o no la inflación), tabla con descarga en CSV, listas de espera por especialidad y proceso,
  y gráfico «¿Gastar más reduce la espera?». La dirección guarda la vista para compartirla.
- **Tu comunidad:** ficha con la posición en cada indicador frente a las otras 16, comparación con otra
  comunidad y notas del Ministerio sobre saltos en sus series.
- **Cómo leer los datos:** qué mide cada dato, fuentes, inflación, cómo comparar y límites.

Mapas y gráficos se pueden descargar en PNG; las tablas, en CSV.

## Instalación local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Tests

```bash
npm test
```

## Estructura de datos

| Archivo | Contenido |
|---|---|
| `src/data/ccaa.json` | Las 17 comunidades (id + nombre) |
| `src/data/indicadores.json` | Qué se mide, unidad, fuente, URL y estado (`ejemplo` / `oficial`) |
| `src/data/valores.json` | Formato largo: una fila por `indicador` + `ccaa` + `anio` + `valor` |
| `src/data/perimetro-egsp.json` | Entidades que la EGSP empieza o deja de contar en cada comunidad, con importe y peso (generado) |
| `src/data/poblacion-equivalente.json` | Población protegida equivalente oficial por comunidad (certificados de Sanidad en las liquidaciones de Hacienda), para el gasto ajustado por edad (generado) |
| `src/data/listas-espera.json` | Listas de espera del SISLE-SNS por corte, lista, especialidad y territorio |
| `src/data/ipc.json` | Media anual del IPC general nacional (INE), para descontar la inflación |
| `src/data/mapa-ccaa.json` | Trazados SVG del mapa ya proyectados (IGN vía es-atlas) |
| `datos-originales/` | Ficheros descargados tal cual de la fuente, para trazabilidad (solo en local) |

Para añadir un indicador nuevo: añádelo a `indicadores.json` y sus filas a `valores.json`.
La web lo muestra automáticamente.

## Actualizar los datos oficiales

Los ficheros de `datos-originales/` **no se suben a GitHub** (están en `.gitignore`); se guardan solo en local.

1. Descarga el Excel de la Estadística de Gasto Sanitario Público ("Gasto real") desde
   https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/finGastoSanit.htm
2. Guárdalo como `datos-originales/egsp-gasto-real-2002-2024.xls` (o pasa la ruta al script).
3. Ejecuta:

```bash
pip install xlrd
python scripts/extraer_egsp.py [ruta_al_excel]
npm test
```

Antes, `python scripts/extraer_ppe.py` (población protegida equivalente; necesita los anexos de las liquidaciones del sistema de financiación en `datos-originales/`). El script regenera `src/data/valores.json`, las notas metodológicas (`src/data/notas-egsp.json`) y los cambios en la lista de entidades de cada comunidad (`src/data/perimetro-egsp.json`). Comprueba que los porcentajes cuadran con los importes y que la suma de las entidades da el total de cada comunidad.

## Actualizar las listas de espera (SISLE-SNS)

1. Descarga el PDF "Datos por comunidad autónoma" de cada corte (30 de junio / 31 de diciembre) desde
   https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/listaEspera.htm
2. Guárdalo en `datos-originales/` con un nombre que empiece por `Datos_ccaa_` (no se sube a GitHub).
3. Ejecuta:

```bash
pip install pdfplumber
python scripts/extraer_sisle.py
npm test
```

Para los cortes de diciembre de 2021 a diciembre de 2024, guarda también los siete
[PDF de indicadores resumen](https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/listaEsperaInfAnt.htm)
con su nombre original `LISTAS_PUBLICACION_*.pdf` en la misma carpeta. De ellos salen los totales quirúrgicos.

El script regenera `src/data/listas-espera.json` por corte, lista, especialidad, medida y territorio.
Comprueba los recuentos frente a las tasas y contrasta los totales con sus desgloses. La web abre el
corte más reciente y permite explorar toda la serie semestral.

## Actualizar el IPC (inflación)

```bash
python scripts/extraer_ipc.py
```

Descarga la serie IPC251852 del INE (índice general nacional, base 2021), guarda la respuesta en
`datos-originales/` y escribe la media de cada año completo en `src/data/ipc.json`.

## Regenerar el mapa

Solo hace falta si cambian los límites. Descarga
https://cdn.jsdelivr.net/npm/es-atlas@0.6.0/es/autonomous_regions.json a
`datos-originales/es-atlas-0.6.0-autonomous_regions.json` y ejecuta:

```bash
node scripts/proyectar_mapa.mjs
```

## Despliegue

Igual que cualquier proyecto Next.js en Vercel: conecta el repositorio de GitHub y despliega.
