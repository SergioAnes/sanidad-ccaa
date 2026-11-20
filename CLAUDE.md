# CLAUDE.md

Proyecto: web estática (Next.js + TypeScript + Recharts) que compara datos sanitarios públicos entre CCAA.

## Reglas de datos

- Nunca inventar cifras. Todo valor que se marque como `"estado": "oficial"` debe venir de una fuente
  citada en `src/data/indicadores.json` y, cuando sea posible, el fichero original guardado en `datos-originales/`.
- `src/data/valores.json` se genera con `python scripts/extraer_egsp.py` a partir del Excel de la EGSP
  en `datos-originales/`. No editarlo a mano. Si algún indicador tiene `"estado": "ejemplo"`, la web muestra un aviso.
- `src/data/listas-espera.json` se genera con `python scripts/extraer_sisle.py` a partir de los PDF
  `datos-originales/Datos_ccaa_*.pdf` del SISLE-SNS. No editarlo a mano.
- Los ficheros de `datos-originales/` no se suben a git (solo local).
- Valores provisionales de la fuente: `"provisional": true` en la fila.
- Medias entre CCAA: simples salvo que se indique lo contrario. Si se añade media ponderada, usar población INE.
- Formato de `valores.json`: largo (`indicador`, `ccaa`, `anio`, `valor`), ids de CCAA según `src/data/ccaa.json`.

## Comandos

- `npm run dev` — servidor local en http://localhost:3000
- `npm test` — tests (vitest). En Windows, ejecutar desde `C:\Proyectos\sanidad-ccaa` con la C mayúscula:
  con `c:\` vitest carga dos copias de sí mismo y falla con "Cannot read properties of undefined (reading 'config')"
- `npm run build` — exportación estática a `out/`
- Recharts 2 + React 19: `package.json` fuerza `react-is` 19 con `overrides`; sin eso las barras no se dibujan.
