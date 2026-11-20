// Estructura HTML estática de la página; las vistas se rellenan desde ui.ts.
// Es contenido propio (sin datos de usuario), así que se inserta tal cual.
export const ESQUELETO = `<div class="wrap">
  <header class="top">
    <div class="brand">Sanidad por comunidades<small>Gasto sanitario público y listas de espera de las 17 comunidades</small></div>
    <nav class="nav" aria-label="Secciones">
      <a href="#portada" data-vista="portada">Portada</a>
      <a href="#explorar" data-vista="explorar">Explorador</a>
      <a href="#comunidad" data-vista="comunidad">Tu comunidad</a>
    </nav>
  </header>
  <section id="v-portada" hidden>
    <div class="intro">
      <div class="intro-cab">
        <div>
          <h1>¿Cuánto gasta tu comunidad en sanidad y cuánto se espera?</h1>
          <p>Datos oficiales del Ministerio de Sanidad: gasto de 2002 a 2024 y listas de espera a 31 de diciembre de 2025.</p>
        </div>
        <label class="tucom" for="p-com">Tu comunidad<select id="p-com"></select></label>
      </div>
      <div class="selector" id="sel-portada"></div>
    </div>
    <div class="portada-grid">
      <div class="panel">
        <h2 id="p-titulo"></h2>
        <p class="sub" id="p-sub"></p>
        <div class="tilemap" id="p-mapa"></div>
        <div class="leyenda" id="p-leyenda"></div>
        <div class="anios" id="p-anios"></div>
      </div>
      <div class="insights" id="p-insights"></div>
    </div>
    <div class="panel xy">
      <h2 id="x-titulo"></h2>
      <p class="sub" id="x-sub"></p>
      <div class="fila"><div class="seg sm" id="x-y" role="group" aria-label="Qué espera comparar"></div></div>
      <div class="chart" id="x-chart"></div>
      <p class="nota" id="x-nota"></p>
    </div>
  </section>
  <section id="v-explorar" hidden>
    <div class="toolbar">
      <div class="selector" id="sel-explorar"></div>
      <div class="campo" id="e-campo"></div>
      <div class="fila">
        <div class="seg" id="e-vistas" role="group" aria-label="Tipo de vista">
          <button type="button" data-v="mapa">Mapa</button>
          <button type="button" data-v="ranking">Ranking</button>
          <button type="button" data-v="evolucion">Evolución</button>
          <button type="button" data-v="tabla">Tabla</button>
        </div>
        <div class="selec" id="e-selec"></div>
      </div>
    </div>
    <div class="panel">
      <h2 id="e-titulo"></h2>
      <p class="sub" id="e-sub"></p>
      <div class="chart" id="e-chart"></div>
      <div class="anios" id="e-anios"></div>
      <p class="nota" id="e-nota"></p>
    </div>
  </section>
  <section id="v-comunidad" hidden>
    <div class="ficha-cab">
      <div>
        <label for="c-sel" class="ayuda">Elige tu comunidad</label><br>
        <select id="c-sel"></select>
        <h1 id="c-nombre" style="margin-top:12px"></h1>
        <p class="resumen" id="c-resumen"></p>
      </div>
      <div>
        <p class="ayuda">O púlsala en el mapa</p>
        <div class="tilemap" id="c-mapa"></div>
      </div>
    </div>
    <div class="bloque">
      <h2>Gasto sanitario público</h2>
      <p class="sub">Año 2024 (provisional). Cada punto gris es otra comunidad; la raya marca la media de las 17.</p>
      <div class="filas" id="c-gasto"></div>
    </div>
    <div class="bloque">
      <h2>Listas de espera</h2>
      <p class="sub" id="c-espera-sub"></p>
      <div class="filas" id="c-espera"></div>
      <p class="extra" id="c-extra"></p>
    </div>
  </section>

  <footer class="pie-fuentes">
    <h2>Fuentes</h2>
    <ul>
      <li>Gasto: Ministerio de Sanidad, <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/sisInfSanSNS/finGastoSanit.htm">Estadística de Gasto Sanitario Público</a> (gasto real 2002-2024; 2023 y 2024 provisionales).</li>
      <li>Listas de espera: Ministerio de Sanidad, <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/listaEspera.htm">SISLE-SNS</a>, datos por comunidad autónoma.</li>
      <li>Inflación: INE, <a href="https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&amp;cid=1254736176802&amp;menu=ultiDatos&amp;idp=1254735976607">Índice de Precios de Consumo</a>, índice general nacional, media anual.</li>
      <li>Mapa: Instituto Geográfico Nacional, vía <a href="https://github.com/martgnz/es-atlas">es-atlas</a> (CC BY 4.0).</li>
    </ul>
    <p>Las medias entre comunidades son simples (cada comunidad cuenta igual). Código y datos: <a href="https://github.com/SergioAnes/sanidad-ccaa">GitHub</a>.</p>
  </footer>
</div>
<div class="tip" id="tip" hidden></div>`;
