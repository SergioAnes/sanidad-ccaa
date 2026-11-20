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

El script regenera `src/data/valores.json` (y las notas metodológicas en `src/data/notas-egsp.json`) y comprueba que los porcentajes cuadran con los importes.

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

El script lee todos los `Datos_ccaa_*.pdf`, regenera `src/data/listas-espera.json` (un valor por corte,
lista, especialidad, medida y territorio) y comprueba que los pacientes de cada columna cuadran con la tasa
por 1.000 habitantes publicada. La web muestra el corte más reciente.

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
