# CLAUDE.md

Proyecto: web estática (Next.js + TypeScript) que compara datos sanitarios públicos entre CCAA.

## Estructura de la web

- Una sola página con tres vistas por `#hash`: Datos (mapa, titulares, ranking/evolución/tabla y gasto frente a
  espera), Tu comunidad (ficha, con «Comparar con»: `#comunidad-an?vs=md`) y Cómo leer los datos (`#metodo`). El estado de Datos va en la dirección (`#datos?dato=…&campo=…`) para compartirlo.
  `#portada` y `#explorar` (enlaces antiguos) llevan a Datos.
- `public/og.png` es la vista previa al compartir; se regenera con una captura si cambia mucho el diseño.
- `src/lib/app/datos-app.ts` prepara en compilación el paquete de datos de la interfaz a partir de `src/data`
  (textos cortos, abreviaturas e indicadores de listas de espera se definen ahí).
- `src/lib/app/ui.ts` pinta todo (mapa SVG, gráficos, tablas) con DOM imperativo; viene de la maqueta aprobada.
  `src/lib/app/esqueleto.ts` es el HTML fijo y `src/components/App.tsx` los une.
- Decisiones de diseño: mapa con las siluetas reales (no casillas); medias y puestos siempre sobre las 17;
  Ceuta y Melilla solo en listas de espera, aparte y con aviso (en gasto el Excel solo trae la parte del INGESA);
  euros constantes con el IPC general nacional (no el regional).
- Datos primero: las explicaciones (definiciones, notas, avisos, cambios de entidades) van plegadas con
  `plegable()` de `ui.ts` (un `<details>` con recuento en el resumen, que recuerda si estaba abierto). En la
  evolución, marcas pequeñas sin números; el detalle, en el recuadro del año y en el desplegable.

## Reglas de datos

- Nunca inventar cifras. Todo valor que se marque como `"estado": "oficial"` debe venir de una fuente
  citada en `src/data/indicadores.json` y, cuando sea posible, el fichero original guardado en `datos-originales/`.
- `src/data/valores.json` se genera con `python scripts/extraer_egsp.py` a partir del Excel de la EGSP
  en `datos-originales/`. No editarlo a mano. La compilación falla si algún indicador no tiene `"estado": "oficial"`.
- `src/data/notas-egsp.json` (notas metodológicas del Ministerio por comunidad y año) también lo genera
  `extraer_egsp.py`; la web las muestra en la evolución, la ficha y «Cómo leer los datos». No editarlo a mano.
- `src/data/perimetro-egsp.json` (entidades o «agentes de gasto» que la EGSP empieza o deja de contar en cada
  comunidad, con importe y peso) también lo genera `extraer_egsp.py`, que comprueba que la suma de entidades da el total.
  La web señala los años en que lo que entra (o sale) pesa ≥ 1 % (`UMBRAL_ENTIDADES` en `datos-app.ts`) como
  «Cambio en las entidades» (tercer tipo, junto a «Nota del Ministerio» y «Variación inusual»). Solo hechos: la fuente
  no dice si es entidad nueva, reorganización o reclasificación; no interpretarlo ni afirmar efectos.
- Conciertos: usar la definición literal de la metodología EGSP (pág. 15: centros «de titularidad pública o privada»);
  no describirlos como «privados». `conciertos_hab` = importe / población implícita del Anexo I.2 (cálculo propio).
- `src/data/listas-espera.json` se genera con `python scripts/extraer_sisle.py` a partir de los PDF
  `datos-originales/Datos_ccaa_*.pdf` del SISLE-SNS. No editarlo a mano.
- `src/data/ipc.json` se genera con `python scripts/extraer_ipc.py` (API del INE, serie IPC251852).
- `src/data/mapa-ccaa.json` se genera con `node scripts/proyectar_mapa.mjs` a partir de
  `datos-originales/es-atlas-0.6.0-autonomous_regions.json` (IGN vía es-atlas, CC BY 4.0).
- Avisos de calidad: `src/lib/avisos.ts` detecta en cada compilación las variaciones inusuales de las series de
  gasto (criterio fijo, documentado en «Cómo leer los datos»). La web distingue siempre «Nota del Ministerio»
  (explicación oficial) de «Variación inusual» (detectada por nosotros; la cifra es oficial pero sin explicación).
  Nunca escribir explicaciones propias de un salto: solo las de la fuente.
- `extraer_egsp.py` comprueba que la población implícita no salta; `extraer_sisle.py` guarda la versión del PDF
  (`versiones`: fichero, rectificado, fecha) y sus notas al pie (`notas_pdf`). `tests/calidad.test.ts` revisa la coherencia.
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
- Visitas: Vercel Web Analytics (`<Analytics />` en `layout.tsx`, sin cookies). Se activa en Vercel: proyecto > Analytics.
