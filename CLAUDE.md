# CLAUDE.md

Proyecto: web estática (Next.js + TypeScript) que compara datos sanitarios públicos entre CCAA.

## Estructura de la web

- Una sola página con dos vistas por `#hash`: Datos (mapa, titulares, ranking/evolución/tabla y gasto frente a
  espera) y Tu comunidad (ficha). El estado de Datos va en la dirección (`#datos?dato=…&campo=…`) para compartirlo.
  `#portada` y `#explorar` (enlaces antiguos) llevan a Datos.
- `public/og.png` es la vista previa al compartir; se regenera con una captura si cambia mucho el diseño.
- `src/lib/app/datos-app.ts` prepara en compilación el paquete de datos de la interfaz a partir de `src/data`
  (textos cortos, abreviaturas e indicadores de listas de espera se definen ahí).
- `src/lib/app/ui.ts` pinta todo (mapa SVG, gráficos, tablas) con DOM imperativo; viene de la maqueta aprobada.
  `src/lib/app/esqueleto.ts` es el HTML fijo y `src/components/App.tsx` los une.
- Decisiones de diseño: mapa con las siluetas reales (no casillas); medias y puestos siempre sobre las 17;
  Ceuta y Melilla solo en listas de espera, aparte y con aviso (en gasto el Excel solo trae la parte del INGESA);
  euros constantes con el IPC general nacional (no el regional).

## Reglas de datos

- Nunca inventar cifras. Todo valor que se marque como `"estado": "oficial"` debe venir de una fuente
  citada en `src/data/indicadores.json` y, cuando sea posible, el fichero original guardado en `datos-originales/`.
- `src/data/valores.json` se genera con `python scripts/extraer_egsp.py` a partir del Excel de la EGSP
  en `datos-originales/`. No editarlo a mano. La compilación falla si algún indicador no tiene `"estado": "oficial"`.
- `src/data/listas-espera.json` se genera con `python scripts/extraer_sisle.py` a partir de los PDF
  `datos-originales/Datos_ccaa_*.pdf` del SISLE-SNS. No editarlo a mano.
- `src/data/ipc.json` se genera con `python scripts/extraer_ipc.py` (API del INE, serie IPC251852).
- `src/data/mapa-ccaa.json` se genera con `node scripts/proyectar_mapa.mjs` a partir de
  `datos-originales/es-atlas-0.6.0-autonomous_regions.json` (IGN vía es-atlas, CC BY 4.0).
- Los ficheros de `datos-originales/` no se suben a git (solo local).
- Valores provisionales de la fuente: `"provisional": true` en la fila.
- Medias entre CCAA: simples salvo que se indique lo contrario. Si se añade media ponderada, usar población INE.
- Formato de `valores.json`: largo (`indicador`, `ccaa`, `anio`, `valor`), ids de CCAA según `src/data/ccaa.json`.

## Comandos

- `npm run dev` — servidor local en http://localhost:3000
- `npm test` — tests (vitest). En Windows, ejecutar desde `C:\Proyectos\sanidad-ccaa` con la C mayúscula:
  con `c:\` vitest carga dos copias de sí mismo y falla con "Cannot read properties of undefined (reading 'config')"
- `npm run build` — exportación estática a `out/`
- En PowerShell, usar `npm.cmd` / `npx.cmd` (los `.ps1` están bloqueados por la política de ejecución).
