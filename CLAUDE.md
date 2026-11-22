# CLAUDE.md

Proyecto: web estática (Next.js + TypeScript) que compara datos sanitarios públicos entre CCAA.

## Estructura de la web

- Una sola página con tres vistas por `#hash`: Datos (temas gasto, listas de espera, atención primaria y opinión, y recursos;
  mapa, titulares, ranking/evolución/tabla y gasto frente a espera), Tu comunidad (ficha, con «Comparar con»: `#comunidad-an?vs=md`) y Cómo leer los datos (`#metodo`). El estado de Datos va en la dirección (`#datos?dato=…&campo=…`) para compartirlo.
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
- `src/data/poblacion-equivalente.json` (población protegida equivalente oficial por comunidad, 2009-…) se genera con
  `python scripts/extraer_ppe.py` a partir de los anexos de las liquidaciones del sistema de financiación
  (`datos-originales/liquidacion-sfa-anexos-AAAA.pdf`). 2009-2020 son escaneos: sus totales están transcritos en
  `scripts/ppe_certificados_escaneados.py` (comprobados: suma = total y coinciden con los cuadros de la liquidación).
  Ejecutar ANTES de `extraer_egsp.py`, que calcula `gasto_hab_edad` (gasto por habitante ajustado por edad, desde 2013:
  antes la población protegida no se calculaba con tarjeta sanitaria). En la web es una variante de «Gasto por
  habitante» (interruptor «Ajustado por edad», `edad=si` en la dirección), no una tarjeta; no genera avisos propios.
- `src/data/contexto-ccaa.json` (ficha, bloque «Contexto»: % 65+ y 80+, densidad, núcleos de población, seguro privado
  además del público) se genera con `python scripts/extraer_contexto.py` (INE 56940, certificados IGN/INE de la
  liquidación, Encuesta de Salud de España 2023 con su intervalo al 95 %). Es contexto: no corrige el gasto. La tabla
  del INE trae el agregado «85 y más años» además de las edades sueltas: no sumarlo dos veces.
- `src/data/barometro.json` (tema «Atención primaria y opinión», grupo `opinion` en `datos-app.ts`) se genera con
  `python scripts/extraer_barometro.py`: serie oficial por comunidad del Ministerio (xlsx) + microdatos del CIS
  (`datos-originales/cis-barometro/`) + informe 2025. Es una encuesta: nunca puestos del 1 al 17 ni «Comparar años»;
  se dice si el intervalo al 95 % queda por encima, por debajo o incluye a España. 2022-2025 (teléfono) aparte de
  2002-2019 (en persona): no compararlos ni atribuir el salto a la pandemia o al método. Ceuta y Melilla no se
  muestran (muestra mínima). Los «días para el médico de familia» son de atención primaria, no del SISLE, y solo de
  quien no tuvo cita antes. Cada cifra debe poder contrastarse: la web enlaza serie, informe y estudios del CIS.
- `src/data/recursos.json` (tema «Recursos», grupo `recursos`) se genera con `python scripts/extraer_recursos.py` a partir
  de dos exportaciones a CSV del Portal Estadístico (SIAP > Profesionales: cubos «Equipos de Atención primaria (EAP)» y
  «Modalidades asistenciales») en `datos-originales/siap/`. Personas asignadas por médico de familia, por pediatra y por
  profesional de enfermería (cálculo propio: población asignada / profesionales). España = conjunto de las 17, no media.
  El script comprueba la población de 2024 con el resumen oficial y que el cubo EAP = suma de modalidades. Ruptura de
  serie oficial: Cataluña 2020. Camas de hospital (red pública y total, por 1.000 hab., 2010-2023): tasas publicadas en
  las tablas anuales del SIAE (`datos-originales/siae/Tablas_CCAA_AAAA.xls(x)`, tabla de camas según dependencia), con
  comprobaciones (población implícita igual en pública y total, % SNS, fila TOTAL = suma, España = tablas de evolución).
  No usar INCLASNS para hospitales (no cuadra en 2022-2023) ni el cubo del portal (solo hospitales de agudos). Personal
  y TAC de hospital, pendientes: sus tablas traen filas o columnas desplazadas en algunos años. Años con camas que pasan
  de privadas a públicas (o al revés): `reclasificaciones` (≥ 10 % en la pública y < 5 % en el total), sin explicarlas.
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
