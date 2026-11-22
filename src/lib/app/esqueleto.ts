// Estructura HTML estática de la página; las vistas se rellenan desde ui.ts.
// Es contenido propio (sin datos de usuario), así que se inserta tal cual.
export const ESQUELETO = `<div class="wrap">
  <noscript><p class="aviso">Esta web necesita JavaScript para mostrar los mapas y gráficos.</p></noscript>
  <header class="top">
    <div class="brand">Sanidad por comunidades<small>Gasto, listas de espera, opinión y recursos de las 17 comunidades</small></div>
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
          <h1>¿Cuánto gasta tu comunidad en sanidad y cuánto se espera?</h1>
          <p id="p-intro">Datos oficiales del Ministerio de Sanidad.</p>
        </div>
      </div>
      <div class="selector" id="sel-datos"></div>
      <div class="campo" id="d-campo"></div>
    </div>
    <div class="rs-barra" id="resumen" role="region" aria-label="Lo que estás viendo">
      <div class="rs-controles">
        <div class="rs-chips" id="rs-chips"></div>
        <button type="button" class="rs-texto" id="rs-texto" aria-haspopup="dialog"></button>
        <button type="button" class="rs-ajustes" id="rs-ajustes" aria-haspopup="dialog" aria-label="Ajustes de la vista">⚙<span class="rs-aj-txt"> Ajustes</span></button>
      </div>
      <p class="rs-aviso" id="rs-aviso" hidden><span id="rs-motivo" role="status"></span> <a href="#e-nota" id="rs-notas">Ver notas del informe</a></p>
    </div>
    <div class="portada-grid">
      <div class="panel">
        <h2 id="p-titulo"></h2>
        <p class="sub" id="p-sub"></p>
        <div class="tilemap" id="p-mapa"></div>
        <div class="leyenda" id="p-leyenda"></div>
        <div class="tiempo">
          <div class="anios" id="p-anios"></div>
        </div>
        <div class="descargas" id="p-desc"></div>
      </div>
      <div class="insights" id="p-insights"></div>
    </div>
    <div class="panel detalle">
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
      <div class="chart" id="e-chart"></div>
      <div class="descargas" id="e-desc"></div>
      <div class="nota" id="e-nota"></div>
    </div>
    <div class="panel xy">
      <h2 id="x-titulo"></h2>
      <p class="sub" id="x-sub"></p>
      <div class="fila"><div class="seg sm" id="x-y" role="group" aria-label="Qué espera comparar"></div></div>
      <div class="chart" id="x-chart"></div>
      <div class="nota" id="x-nota"></div>
    </div>
  </section>
  <section id="v-comunidad" hidden>
    <div class="ficha-cab">
      <div>
        <label for="c-sel" class="ayuda">Elige tu comunidad</label><br>
        <select id="c-sel"></select>
        <h1 id="c-nombre" style="margin-top:12px"></h1>
        <p class="resumen" id="c-resumen"></p>
        <div class="comparar"><label for="c-vs">Comparar con</label><select id="c-vs"></select><span class="leyenda-vs" id="c-leyenda-vs"></span></div>
      </div>
      <div>
        <p class="ayuda">O púlsala en el mapa</p>
        <div class="tilemap" id="c-mapa"></div>
      </div>
    </div>
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
      <h2>Atención primaria y opinión</h2>
      <p class="sub" id="c-opinion-sub"></p>
      <div class="contexto" id="c-opinion"></div>
      <div class="notas-min" id="c-opinion-notas"></div>
    </div>
    <div class="bloque">
      <h2>Recursos</h2>
      <p class="sub" id="c-recursos-sub"></p>
      <div class="filas" id="c-recursos"></div>
      <div class="notas-min" id="c-recursos-notas"></div>
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
      <li>Atención primaria y opinión: Ministerio de Sanidad y CIS, <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/barometro/home.htm">Barómetro Sanitario</a> (serie por comunidad y microdatos del CIS; enlaces a cada fichero en «Cómo leer los datos»).</li>
      <li>Recursos: Ministerio de Sanidad, <a href="https://pestadistico.inteligenciadegestion.sanidad.gob.es/publicoSNS/S/sistema-de-informacion-de-atencion-primaria-siap">Sistema de Información de Atención Primaria (SIAP)</a> (profesionales y población asignada, 2004-2025) y <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/estHospiInternado/inforAnual/homeESCRI.htm">Estadística de Centros Sanitarios de Atención Especializada (SIAE)</a> (camas, ocupación y estancia media de los hospitales, 2010-2023).</li>
      <li>Inflación: INE, <a href="https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&amp;cid=1254736176802&amp;menu=ultiDatos&amp;idp=1254735976607">Índice de Precios de Consumo</a>, índice general nacional, media anual.</li>
      <li>Mapa: Instituto Geográfico Nacional, vía <a href="https://github.com/martgnz/es-atlas">es-atlas</a> (CC BY 4.0).</li>
    </ul>
    <p>Las medias entre comunidades son simples (cada comunidad cuenta igual). Más detalles en <a href="#metodo">Cómo leer los datos</a>. Código y datos: <a href="https://github.com/SergioAnes/sanidad-ccaa">GitHub</a>.
    Contamos las visitas de forma anónima y sin cookies (Vercel Web Analytics).</p>
  </footer>
</div>
<div class="tip" id="tip" hidden></div>
<dialog class="ajustes" id="ajustes" aria-labelledby="aj-titulo"><div id="aj-cuerpo"></div></dialog>
<p class="sr" aria-live="polite" id="anuncio"></p>`;
