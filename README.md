# Sanidad por comunidades

Web pública estática para comparar datos sanitarios públicos entre comunidades autónomas
(gasto por habitante, peso de los conciertos, atención primaria, farmacia…).

> **Estado:** los 6 indicadores son **oficiales**, extraídos de la Estadística de Gasto Sanitario
> Público 2002-2024 del Ministerio de Sanidad. Las cifras de 2023 y 2024 son provisionales.

## Tecnología

- Next.js (exportación estática, sin backend)
- TypeScript
- Recharts
- CSS propio
- Datos separados en `src/data`

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
| `datos-originales/` | Ficheros descargados tal cual de la fuente (Excel/CSV) para trazabilidad |

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

El script regenera `src/data/valores.json` y comprueba que los porcentajes cuadran con los importes.

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
por 1.000 habitantes publicada. Con varios cortes, el selector "Fecha" de la web se activa solo.

## Fuentes previstas

- Ministerio de Sanidad — Estadística de Gasto Sanitario Público (EGSP)
- Ministerio de Sanidad — Indicadores Clave del SNS (INCLASNS)
- Listas de espera del SNS
- INE — población por comunidad (para ratios por habitante)

## Despliegue

Igual que cualquier proyecto Next.js en Vercel: conecta el repositorio de GitHub y despliega.
