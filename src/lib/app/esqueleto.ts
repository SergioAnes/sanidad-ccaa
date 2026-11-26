// Estructura HTML estática de la página; las vistas se rellenan desde ui.ts.
// Es contenido propio (sin datos de usuario), así que se inserta tal cual.
export const ESQUELETO = `<div class="wrap">
  <noscript><p class="aviso">Esta web necesita JavaScript para mostrar los mapas y gráficos.</p></noscript>
  <header class="top">
    <div class="brand">
      <div class="brand-linea">
        <span>Sanidad por comunidades</span>
        <a class="contacto-x" href="https://x.com/SergioA_Galan" target="_blank" rel="noopener noreferrer" aria-label="Contacto en X con @SergioA_Galan (abre en otra pestaña)">Contacto en X<span class="solo-escritorio"> · @SergioA_Galan</span></a>
      </div>
      <small>Gasto, listas de espera, opinión, recursos y resultados en salud de las 17 comunidades</small>
    </div>
    <nav class="nav" aria-label="Secciones">
      <a href="#datos" data-vista="datos">Datos</a>
      <a href="#comunidad" data-vista="comunidad">Tu comunidad</a>
      <a href="#metodo" data-vista="metodo">Cómo leer los datos</a>
    </nav>
  </header>
  <section id="v-datos" hidden>
    <div class="intro">
      <div class="intro-cab">
        <div>
          <h1><span class="solo-escritorio">¿Cómo está la sanidad en tu comunidad?</span><span class="solo-movil">Sanidad en tu comunidad</span></h1>
          <p class="solo-escritorio" id="p-intro">Datos oficiales del Ministerio de Sanidad.</p>
          <details class="intro-nota solo-movil">
            <summary>Qué datos recoge la web</summary>
            <p id="p-intro-movil">Datos oficiales del Ministerio de Sanidad.</p>
          </details>
        </div>
      </div>
      <div class="selector" id="sel-datos"></div>
      <div class="campo" id="d-campo"></div>
    </div>
    <div class="rs-barra" id="resumen" role="region" aria-label="Lo que estás viendo">
      <div class="rs-controles">
        <div class="rs-chips" id="rs-chips"></div>
        <button type="button" class="rs-texto" id="rs-texto" aria-haspopup="dialog"></button>
      </div>
      <p class="rs-aviso" id="rs-aviso" hidden><span id="rs-motivo" role="status"></span> <a href="#e-nota" id="rs-notas">Ver notas del informe</a></p>
    </div>
    <div class="portada-grid" id="p-vista">
      <div class="panel">
        <h2><span class="solo-escritorio" id="p-titulo"></span><span class="solo-movil" id="p-titulo-movil"></span></h2>
        <p class="sub"><span class="solo-escritorio" id="p-sub"></span><span class="solo-movil" id="p-sub-movil"></span></p>
        <dl class="contexto-grafico" id="p-fuente"></dl>
        <div class="tilemap" id="p-mapa"></div>
        <div class="leyenda" id="p-leyenda"></div>
        <div class="tiempo">
          <div class="anios" id="p-anios"></div>
        </div>
        <div class="descargas" id="p-desc"></div>
      </div>
      <div class="insights" id="p-insights"></div>
    </div>
    <div class="panel detalle" id="e-vista">
      <div class="fila">
        <div class="seg" id="e-vistas" role="group" aria-label="Tipo de gráfico">
          <button type="button" data-v="ranking">Ranking</button>
          <button type="button" data-v="evolucion">Evolución</button>
          <button type="button" data-v="tabla">Tabla</button>
        </div>
        <div class="selec" id="e-selec"></div>
      </div>
      <h2 id="e-titulo"></h2>
      <p class="sub" id="e-sub"></p>
      <dl class="contexto-grafico" id="e-contexto"></dl>
      <div class="chart" id="e-chart"></div>
      <div class="descargas" id="e-desc"></div>
      <div class="nota" id="e-nota"></div>
    </div>
    <section class="panel guardias" id="guardias" aria-labelledby="guardias-titulo" hidden></section>
    <section class="panel" id="medicina-familia" aria-labelledby="medicina-familia-titulo" hidden></section>
    <div class="panel xy">
      <h2 id="x-titulo"></h2>
      <p class="sub" id="x-sub"></p>
      <dl class="contexto-grafico" id="x-contexto"></dl>
      <div class="fila"><div class="seg sm" id="x-y" role="group" aria-label="Qué espera comparar"></div></div>
      <div class="chart" id="x-chart"></div>
      <div class="nota" id="x-nota"></div>
    </div>
  </section>
  <section id="v-comunidad" hidden>
    <div class="ficha-cab">
      <div>
        <label for="c-sel" class="ayuda">Elige una comunidad o ciudad autónoma</label><br>
        <select id="c-sel"></select>
        <h1 id="c-nombre" style="margin-top:12px"></h1>
        <p class="resumen" id="c-resumen"></p>
        <div class="comparar" id="c-comparar"><label for="c-vs">Comparar con</label><select id="c-vs"></select><span class="leyenda-vs" id="c-leyenda-vs"></span></div>
      </div>
      <div>
        <p class="ayuda">También puedes elegir en el mapa</p>
        <div class="tilemap" id="c-mapa"></div>
      </div>
    </div>
    <div id="c-ciudad-datos" hidden></div>
    <div id="c-comunidad-datos">
    <div class="bloque">
      <h2>Gasto sanitario público</h2>
      <p class="sub" id="c-gasto-sub"></p>
      <div class="filas" id="c-gasto"></div>
      <div class="notas-min" id="c-notas"></div>
    </div>
    <div class="bloque">
      <h2>Contexto</h2>
      <p class="sub" id="c-contexto-sub"></p>
      <div class="contexto" id="c-contexto"></div>
      <div class="notas-min" id="c-contexto-notas"></div>
    </div>
    <div class="bloque">
      <h2>Listas de espera</h2>
      <p class="sub" id="c-espera-sub"></p>
      <div class="filas" id="c-espera"></div>
      <p class="extra" id="c-extra"></p>
    </div>
    <div class="bloque">
      <h2>Lo que opina la gente</h2>
      <p class="sub" id="c-opinion-sub"></p>
      <div class="contexto" id="c-opinion"></div>
      <div class="notas-min" id="c-opinion-notas"></div>
    </div>
    <div class="bloque">
      <h2>Atención primaria</h2>
      <p class="sub" id="c-primaria-sub"></p>
      <div class="filas" id="c-primaria"></div>
      <div class="notas-min" id="c-primaria-notas"></div>
    </div>
    <div class="bloque">
      <h2>Hospitales</h2>
      <p class="sub" id="c-hospitales-sub"></p>
      <div class="filas" id="c-hospitales"></div>
      <div class="notas-min" id="c-hospitales-notas"></div>
    </div>
    <div class="bloque">
      <h2>Resultados en salud</h2>
      <p class="sub" id="c-resultados-sub"></p>
      <div class="filas" id="c-resultados"></div>
      <div class="notas-min" id="c-resultados-notas"></div>
    </div>
    <div class="bloque">
      <h2>Prevención</h2>
      <p class="sub">Último dato de cada fuente. España se muestra para el mismo año.</p>
      <div class="contexto" id="c-prevencion"></div>
      <div class="notas-min" id="c-prevencion-notas"></div>
    </div>
    </div>
  </section>

  <section id="v-metodo" hidden>
    <div class="metodo" id="m-cuerpo"></div>
  </section>

  <footer class="pie-fuentes">
    <h2>Fuentes</h2>
    <ul>
      <li>Gasto: Ministerio de Sanidad, <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/finGastoSanit.htm">Estadística de Gasto Sanitario Público</a> (<span id="f-gasto">gasto real</span>).</li>
      <li>Listas de espera: Ministerio de Sanidad, <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/listaEspera.htm">SISLE-SNS</a>, datos por comunidad autónoma (<span id="f-listas">último corte</span>).</li>
      <li>Opinión y acceso declarado: <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/barometro/home.htm">Barómetro Sanitario</a> (Sanidad y CIS) y <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=79194">Encuesta de Condiciones de Vida</a> (INE).</li>
      <li>Atención primaria y hospitales: Ministerio de Sanidad, <a href="https://pestadistico.inteligenciadegestion.sanidad.gob.es/publicoSNS/S/sistema-de-informacion-de-atencion-primaria-siap">Sistema de Información de Atención Primaria (SIAP)</a> (profesionales y población asignada, 2004-2025) y <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/estHospiInternado/inforAnual/homeESCRI.htm">Estadística de Centros Sanitarios de Atención Especializada (SIAE)</a> (camas, ocupación, estancia media, cirugía mayor ambulatoria, quirófanos, ingresos, hospital de día, TAC y resonancia, 2010-2023; médicos y enfermería de la red pública, 2016-2023).</li>
      <li>Reingresos y hospitalizaciones evitables: registro <a href="https://inclasns.sanidad.gob.es/report/indicator/?indicators=225">RAE-CMBD</a>, con datos de los informes anuales del SNS, INCLASNS e <a href="https://icmbd.sanidad.gob.es/">iCMBD</a>.</li>
      <li>Resultados en salud: <a href="https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736177003&idp=1254735573002">Indicadores Demográficos Básicos</a> y Movimiento Natural de la Población (INE), y <a href="https://www.sanidad.gob.es/estadEstudios/sistInfSanit/estSalud/Mortalidad_EdV/home.htm">años de vida saludable</a> (Sanidad).</li>
      <li>Prevención: <a href="https://www.sanidad.gob.es/areas/promocionPrevencion/vacunaciones/coberturas/home.htm">SIVAMIN</a> (Sanidad) y <a href="https://www.ine.es/jaxi/Tabla.htm?tpx=81219&amp;L=0">Encuesta de Salud de España</a> (INE y Sanidad).</li>
      <li>Inflación: INE, <a href="https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&amp;cid=1254736176802&amp;menu=ultiDatos&amp;idp=1254735976607">Índice de Precios de Consumo</a>, índice general nacional, media anual.</li>
      <li>Mapa: Instituto Geográfico Nacional, vía <a href="https://github.com/martgnz/es-atlas">es-atlas</a> (CC BY 4.0).</li>
    </ul>
    <p>Junto a los gráficos se indican el periodo, la fuente y la referencia. Las definiciones están en <a href="#metodo">Cómo leer los datos</a>. Código y datos: <a href="https://github.com/SergioAnes/sanidad-ccaa">GitHub</a>.
    Contamos las visitas de forma anónima y sin cookies (Vercel Web Analytics).</p>
  </footer>
</div>
<div class="tip" id="tip" hidden></div>
<dialog class="ajustes" id="ajustes" aria-labelledby="aj-titulo"><div id="aj-cuerpo"></div></dialog>
<p class="sr" aria-live="polite" id="anuncio"></p>`;
