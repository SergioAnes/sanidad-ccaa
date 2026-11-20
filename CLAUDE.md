# CLAUDE.md

Proyecto: web estática (Next.js + TypeScript + Recharts) que compara datos sanitarios públicos entre CCAA.

## Reglas de datos

- Nunca inventar cifras. Todo valor que se marque como `"estado": "oficial"` debe venir de una fuente
  citada en `src/data/indicadores.json` y, cuando sea posible, el fichero original guardado en `datos-originales/`.
- Los valores actuales de `src/data/valores.json` son ficticios (generados para maquetar). Mientras algún
  indicador tenga `"estado": "ejemplo"`, la web muestra un aviso.
- Medias entre CCAA: simples salvo que se indique lo contrario. Si se añade media ponderada, usar población INE.
- Formato de `valores.json`: largo (`indicador`, `ccaa`, `anio`, `valor`), ids de CCAA según `src/data/ccaa.json`.

## Comandos

- `npm run dev` — servidor local en http://localhost:3000
- `npm test` — tests (vitest)
- `npm run build` — exportación estática a `out/`
