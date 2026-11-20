# Sanidad por comunidades

Web pública estática para comparar datos sanitarios públicos entre comunidades autónomas
(gasto por habitante, peso de los conciertos, atención primaria, farmacia…).

> **Estado:** los valores de `src/data/valores.json` son **ficticios** (solo para maquetar).
> Hay que sustituirlos por datos oficiales antes de publicar.

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

## Fuentes previstas

- Ministerio de Sanidad — Estadística de Gasto Sanitario Público (EGSP)
- Ministerio de Sanidad — Indicadores Clave del SNS (INCLASNS)
- Listas de espera del SNS
- INE — población por comunidad (para ratios por habitante)

## Despliegue

Igual que cualquier proyecto Next.js en Vercel: conecta el repositorio de GitHub y despliega.
