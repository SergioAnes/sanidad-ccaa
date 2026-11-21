// @ts-nocheck -- Interfaz imperativa (DOM + SVG) trasladada tal cual de la maqueta aprobada.
// Recibe los datos ya preparados en compilación (datos-app.ts) y pinta las tres vistas por #hash.
import type { DatosApp } from "./datos-app";
import { correlacionCritica, pearson, spearman } from "../estadistica";

let iniciada = false;

export function iniciar(DATA: DatosApp): void {
  if (iniciada) return; // React (modo estricto) puede llamar dos veces al efecto
  iniciada = true;
  // ---------- utilidades ----------
  const $ = (s) => document.querySelector(s);
  const CC = DATA.ccaa;
  const IDS = CC.map((c) => c.id);
  const NOMBRE = Object.fromEntries(CC.map((c) => [c.id, c.nombre]));
  const ABR = Object.fromEntries(CC.map((c) => [c.id, c.abr]));
  const ANIOS = DATA.anios;
  const ULT = ANIOS[ANIOS.length - 1];
  const IND = Object.fromEntries(DATA.inds.map((i) => [i.id, i]));
  // Euros constantes: valor × IPC(último año) / IPC(año). IPC = media anual del índice general del INE.
  const IPC = DATA.ipc;
  const enEuros = (ind) => ind.unidad === "eur_hab";
  for (const ind of DATA.inds) if (enEuros(ind) && ind.serie) {
    const nom = ind.serie;
    const real = Object.fromEntries(Object.entries(nom).map(([id, sr]) => [id, sr.map((v, i) => v == null ? null : v * IPC[ULT] / IPC[ANIOS[i]])]));
    ind.serieNom = nom; ind.serieReal = real;
    Object.defineProperty(ind, "serie", { get: () => (S.real ? real : nom) });
  }
  const sinInfl = (ind) => enEuros(ind) && S.real;

  const nf = (d) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
  function fmt(v, u) {
    if (v == null || !isFinite(v)) return "—";
    if (u === "eur_hab") return nf(0).format(v) + " €";
    if (u === "pct") return nf(1).format(v) + " %";
    if (u === "por_mil") return nf(1).format(v) + " ‰";
    if (u === "dias") return nf(0).format(v) + " días";
    if (u === "var") return (v > 0 ? "+" : v < 0 ? "−" : "") + nf(0).format(Math.abs(v)) + " %";
    if (u === "pp") return (v > 0 ? "+" : v < 0 ? "−" : "") + nf(1).format(Math.abs(v)) + " p.";
    return nf(1).format(v);
  }
  const fmtCorto = (v, u) => u === "dias" ? nf(0).format(v) + " d" : fmt(v, u).replace(" %", "%");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tieneSerie = (ind) => ind.grupo === "gasto";
  function valores(ind, anio) {
    const out = {};
    for (const id of IDS) out[id] = tieneSerie(ind) ? ind.serie[id][anio - ANIOS[0]] : ind.valor[id];
    return out;
  }
  const media = (o) => { const v = Object.values(o).filter((x) => x != null); return v.reduce((a, b) => a + b, 0) / v.length; };
  function ordenados(o) { return IDS.filter((id) => o[id] != null).sort((a, b) => o[b] - o[a]); }
  const esProv = (anio) => DATA.prov.includes(anio);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Escala secuencial azul (un tono). Se omiten #3987e5 y #2a78d6: ni texto oscuro ni blanco llegan a 4,5:1.
  const RAMPA = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
  function oscuro() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function colorEscala(t) {
    // claro: bajo = claro, alto = oscuro. Oscuro: bajo se funde con el fondo (oscuro), alto = claro.
    let i = Math.round(Math.max(0, Math.min(1, t)) * (RAMPA.length - 1));
    if (oscuro()) i = RAMPA.length - 1 - i;
    return { bg: RAMPA[i], fg: i >= 6 ? "#ffffff" : "#142033" };
  }

  // ---------- paletas para el mapa ----------
  const Q_AZUL = ["#cde2fb", "#86b6ef", "#5598e7", "#1c5cab", "#0d366b"];
  const Q_YGB = ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"]; // ColorBrewer YlGnBu
  const DIV = () => ["#184f95", "#9ec5f4", oscuro() ? "#4a4a46" : "#dedcd6", "#f2a29b", "#b8322f"];
  // "auto" = la recomendada: tramos en gasto, encima/debajo de la media en listas de espera.
  const PAL = "auto";
  const palDe = (ind, pal = PAL) => pal === "auto" ? (ind.grupo === "espera" ? "media" : "tramos") : pal;

  function textoSobre(hex) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return (1.05 / (L + 0.05)) >= ((L + 0.05) / (0.0144 + 0.05)) ? "#ffffff" : "#142033";
  }
  const UNI = { eur_hab: "euros por habitante", pct: "%", por_mil: "‰", dias: "días", var: "% de crecimiento", pp: "puntos de cambio" };
  const soloNum = (v, u) => u === "var" || u === "pp" ? fmt(v, u).replace(/ (%|p\.)$/, "") : nf(u === "eur_hab" || u === "dias" ? 0 : 1).format(v);
  // Devuelve el color de cada comunidad y la leyenda, según la paleta.
  function escala(vals, ind, pal0 = PAL) {
    const u = ind.unidad; const pal = palDe(ind, pal0);
    const o = ordenados(vals); const vs = o.map((id) => vals[id]);
    const min = Math.min(...vs), max = Math.max(...vs), m = media(vals);
    const sd = Math.sqrt(vs.reduce((a, v) => a + (v - m) ** 2, 0) / vs.length) || 1;
    const caja = (bg) => ({ bg, fg: textoSobre(bg) });
    const clases = (cols, etiquetas, pie) => `<div class="clases">${cols.map((c, k) => `<span class="clase"><i style="background:${c}"></i>${etiquetas[k]}</span>`).join("")}</div><span class="pie">${pie}</span>`;
    if (pal === "continuo") {
      const paradas = RAMPA.map((_, i) => colorEscala(i / (RAMPA.length - 1)).bg).join(",");
      return { color: (id) => colorEscala(max > min ? (vals[id] - min) / (max - min) : 0.5), colorV: (v) => colorEscala(max > min ? (v - min) / (max - min) : 0.5),
        leyenda: `<span class="num">${fmt(min, u)}</span><span class="barra" style="background:linear-gradient(90deg,${paradas})"></span><span class="num">${fmt(max, u)}</span><span>· más oscuro = valor más alto</span>` };
    }
    if (pal === "tramos" || pal === "multi") {
      // En modo oscuro, el tono más claro (el que más destaca) pasa a ser el valor más alto.
      const cols = pal === "tramos" ? (oscuro() ? [...Q_AZUL].reverse() : Q_AZUL) : Q_YGB;
      const asc = o.slice().reverse();
      const k = (id) => Math.min(4, Math.floor(asc.indexOf(id) * 5 / asc.length));
      const et = cols.map((_, c) => { const mi = asc.filter((id) => k(id) === c).map((id) => vals[id]);
        const sep = u === "var" || u === "pp" ? " a " : "–";
        return `<b class="num">${soloNum(Math.min(...mi), u)}${sep}${soloNum(Math.max(...mi), u)}</b>${c === 0 ? "las que menos" : c === 4 ? "las que más" : ""}`; });
      const topes = cols.map((_, c) => Math.max(...asc.filter((id) => k(id) === c).map((id) => vals[id])));
      const kv = (v) => { const c = topes.findIndex((t) => v <= t); return c < 0 ? 4 : c; };
      return { color: (id) => caja(cols[k(id)]), colorV: (v) => caja(cols[kv(v)]), leyenda: clases(cols, et, `Cada tono agrupa 3 o 4 comunidades, de menos a más. En ${UNI[u]}.`) };
    }
    // media: cinco grupos según la distancia a la media (en desviaciones típicas)
    const cols = DIV();
    const kz = (v) => { const z = (v - m) / sd; return z < -1 ? 0 : z < -1 / 3 ? 1 : z <= 1 / 3 ? 2 : z <= 1 ? 3 : 4; };
    const k = (id) => kz(vals[id]);
    const nombres = ["muy por debajo", "por debajo", "en la media", "por encima", "muy por encima"];
    const et = nombres.map((n, c) => { const n2 = o.filter((id) => k(id) === c).length; return `<b>${n}</b>(${n2})`; });
    return { color: (id) => caja(cols[k(id)]), colorV: (v) => caja(cols[kz(v)]), leyenda: clases(cols, et, `Media de las ${o.length}: <b class="num">${fmt(m, u)}</b>. «En la media» = a menos de ${fmtCorto(sd / 3, u)} de ella.`) };
  }

  // tooltip
  const tip = $("#tip");
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  const hideTip = () => { tip.hidden = true; };

  // ---------- estado ----------
  const S = {
    vista: "datos",
    indP: "gasto_hab", anioP: ULT, vistaE: "ranking",
    modo: "valor", // mapa y ranking: "valor" del año elegido o "cambio" en un periodo
    desde: ANIOS[0], // primer año del periodo en modo «cambio» (el último es anioP)
    sel: [{ id: "MD", slot: 0 }, { id: "AN", slot: 1 }],
    com: "AN",
    real: true,
    yXY: "q_dias",
    campoE: "total", // especialidad o proceso en el Explorador: "total" o "tipo:campo"
    vs: "", // comunidad con la que comparar en la ficha
    anioC: ULT, // año del gasto que se muestra en la ficha
  };
  const NOTAS = DATA.notas; // notas del Ministerio sobre saltos en las series de gasto
  const notasDe = (id) => NOTAS.filter((n) => n.ccaa === id).sort((a, b) => a.anio - b.anio);
  // Variaciones inusuales sin explicación oficial (detectadas en src/lib/avisos.ts)
  const AVISOS = DATA.avisos.filter((a) => !a.explicado);
  const avisosDe = (indId, ccaa) => AVISOS.filter((a) => a.indicador === indId && (!ccaa || a.ccaa === ccaa));
  const firmado = (x, d) => (x > 0 ? "+" : x < 0 ? "−" : "") + nf(d).format(Math.abs(x));
  function textoAviso(a, conNombre = true) {
    const u = a.unidad === "%" ? " %" : " puntos", d = a.unidad === "%" ? 0 : 1;
    return `${conNombre ? `${NOMBRE[a.ccaa]}, ${a.anio}: ` : ""}${firmado(a.cambio, d)}${u} respecto a ${a.anio - 1}${a.unidad === "%" ? " (en euros de cada año)" : ""}, cuando la mediana de las comunidades fue ${firmado(a.mediana, d)}${u}. Es la cifra oficial, pero el Ministerio no explica el motivo.`;
  }

  // ---------- especialidades y procesos (listas de espera) ----------
  // Las tarjetas quirúrgicas (q_*) admiten especialidades quirúrgicas y procesos; las de consultas (c_*), especialidades de consultas.
  const familias = (base) => base.tipo === "consultas" ? ["consultas"] : ["quirurgica", "procesos"];
  function indDetalle(base, clave) {
    if (base.grupo !== "espera" || clave === "total") return base;
    const [tipo, campo] = clave.split(":");
    const t = DATA.detalle[tipo];
    if (!familias(base).includes(tipo) || !t || !t.v[campo]) return base;
    const id = `${base.id}@${tipo}:${campo}`;
    if (!IND[id]) {
      const datos = t.v[campo][base.medida] || {};
      const valor = {}; IDS.forEach((k) => { if (datos[k] != null) valor[k] = datos[k]; });
      const ciu = {}; ["CE", "ML"].forEach((k) => { if (datos[k] != null) ciu[k] = datos[k]; });
      const nombreCampo = t.campos.find((c) => c.id === campo).nombre;
      const que = tipo === "procesos" ? "Proceso" : "Especialidad";
      IND[id] = { ...base, id, valor, nombre: `${base.nombre}: ${nombreCampo}`, desc: `${base.desc.replace(/ \(todas las especialidades\)/, "")} ${que}: ${nombreCampo}.`, campoNombre: nombreCampo };
      DATA.ciudades[id] = ciu;
    }
    return IND[id];
  }
  function selectorCampo(cont, base, selId) {
    if (base.grupo !== "espera") { cont.innerHTML = ""; return; }
    const opc = (tipo, c) => `<option value="${tipo}:${c.id}" ${S.campoE === `${tipo}:${c.id}` ? "selected" : ""}>${esc(c.nombre)}</option>`;
    const grupos = familias(base).map((tipo) => {
      const t = DATA.detalle[tipo];
      const campos = t.campos.filter((c) => c.id !== "total");
      return `<optgroup label="${tipo === "procesos" ? "Procesos frecuentes" : "Especialidades"}">${campos.map((c) => opc(tipo, c)).join("")}</optgroup>`;
    }).join("");
    cont.innerHTML = `<label for="${selId}">Especialidad o proceso:</label>
      <select id="${selId}"><option value="total" ${S.campoE === "total" ? "selected" : ""}>Todas (total)</option>${grupos}</select>` +
      (S.campoE !== "total" ? `<span>Las tarjetas de arriba siguen mostrando el total.</span>` : "");
    cont.querySelector("select").onchange = (e) => { S.campoE = e.target.value; render(); };
  }
  const SLOTS = ["--s1", "--s2", "--s3"];
  const colorSel = (id) => { const s = S.sel.find((x) => x.id === id); return s ? css(SLOTS[s.slot]) : null; };
  function alternarSel(id) {
    const i = S.sel.findIndex((x) => x.id === id);
    if (i >= 0) { S.sel.splice(i, 1); return; }
    if (S.sel.length >= 3) S.sel.shift();
    const libres = [0, 1, 2].filter((s) => !S.sel.some((x) => x.slot === s));
    S.sel.push({ id, slot: libres[0] });
  }

  // ---------- componentes ----------
  // Selector: tema (Gasto / Listas de espera) + tarjetas con la media de las 17 y una minigráfica.
  function selector(cont, actualId, onPick) {
    const grupo = IND[actualId].grupo;
    const acc = css("--accent"), soft = css("--accent-soft"), grey = css("--grey-line");
    const tarjetas = DATA.inds.filter((i) => i.grupo === grupo).map((i) => {
      const anio = tieneSerie(i) ? ULT : null;
      const vals = valores(i, anio); const m = media(vals);
      let mini;
      if (tieneSerie(i)) {
        const medias = ANIOS.map((a) => media(valores(i, a)));
        const lo = Math.min(...medias), hi = Math.max(...medias);
        const sx = (k) => 2 + (k / (medias.length - 1)) * 116, sy = (v) => 3 + (1 - (v - lo) / (hi - lo || 1)) * 22;
        const d = medias.map((v, k) => `${k ? "L" : "M"}${sx(k).toFixed(1)},${sy(v).toFixed(1)}`).join("");
        mini = `<svg viewBox="0 0 122 30" preserveAspectRatio="none" aria-hidden="true"><path d="${d} L${sx(medias.length - 1)},30 L2,30 Z" fill="${soft}"/><path d="${d}" fill="none" stroke="${acc}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
      } else {
        const o = ordenados(vals); const lo = vals[o[o.length - 1]], hi = vals[o[0]];
        const sx = (v) => 5 + ((v - lo) / (hi - lo || 1)) * 112;
        mini = `<svg viewBox="0 0 122 30" aria-hidden="true"><line x1="5" x2="117" y1="15" y2="15" stroke="${grey}"/>` +
          o.filter((k) => k !== S.com).map((k) => `<circle cx="${sx(vals[k]).toFixed(1)}" cy="15" r="3" fill="${grey}"/>`).join("") +
          `<circle cx="${sx(vals[S.com]).toFixed(1)}" cy="15" r="5" fill="${acc}"/></svg>`;
      }
      let pie = `Media de las 17 · en azul, ${ABR[S.com]}`;
      if (tieneSerie(i)) {
        // Crecimiento de la media de las 17: aquí se ve el efecto de descontar o no la inflación.
        const m0 = media(valores(i, ANIOS[0]));
        const c = i.unidad === "pct" ? fmt(m - m0, "pp").replace(" p.", " puntos") : fmt((m / m0 - 1) * 100, "var");
        pie = `Media de las 17 en ${ULT}<br><span class="kpi-c">${c} desde ${ANIOS[0]}${enEuros(i) ? (S.real ? ", sin inflación" : ", con inflación") : ""}</span>`;
      }
      return `<button type="button" class="kpi" data-id="${i.id}" aria-pressed="${i.id === actualId}">
        <span class="kpi-n">${esc(i.corto)}</span><span class="kpi-v">${fmt(m, i.unidad)}</span>
        <span class="kpi-mini">${mini}</span><span class="kpi-s">${pie}</span></button>`;
    }).join("");
    cont.innerHTML = `<div class="seg" role="group" aria-label="Tema">
        <button type="button" data-g="gasto" aria-pressed="${grupo === "gasto"}">Gasto sanitario</button>
        <button type="button" data-g="espera" aria-pressed="${grupo === "espera"}">Listas de espera</button>
      </div><div class="kpis">${tarjetas}</div>` + (enEuros(IND[actualId]) ? `<div class="real">
        <div class="seg sm" role="group" aria-label="Inflación">
          <button type="button" data-r="1" aria-pressed="${S.real}">Descontando la inflación</button>
          <button type="button" data-r="0" aria-pressed="${!S.real}">Sin descontar</button>
        </div><span>${S.real
          ? `Cada año se expresa en euros de ${ULT}: así se ve cuánto ha crecido el gasto de verdad. Los precios han subido un ${nf(0).format((IPC[ULT] / IPC[ANIOS[0]] - 1) * 100)} % desde ${ANIOS[0]} (IPC del INE).`
          : `Cada año, en los euros de entonces: parte de la subida es solo inflación (los precios han subido un ${nf(0).format((IPC[ULT] / IPC[ANIOS[0]] - 1) * 100)} % desde ${ANIOS[0]}).`}
          Solo afecta a los datos en euros y a los años anteriores a ${ULT}: lo verás en la tendencia, al mover la barra de años y en «Cambio entre dos años». Los porcentajes no cambian.</span></div>` : "");
    cont.querySelectorAll(".real button").forEach((b) => b.onclick = () => { S.real = b.dataset.r === "1"; render(); });
    // Solo los botones de tema: los de inflación (.real) también son .seg y tienen su propia acción.
    cont.querySelectorAll('.seg[aria-label="Tema"] button').forEach((b) => b.onclick = () => {
      if (b.dataset.g !== grupo) onPick(DATA.inds.find((i) => i.grupo === b.dataset.g).id);
    });
    cont.querySelectorAll(".kpi").forEach((b) => b.onclick = () => onPick(b.dataset.id));
  }

  // Mapa con las siluetas reales (IGN, vía es-atlas), ya proyectado. Canarias va en un recuadro.
  const GEO = DATA.geo;
  const SIN_DATOS = ["CE", "ML", "GI"]; // Ceuta y Melilla: aparte (círculos) si hay dato; Gibraltar solo de contexto
  const CIUDADES = { CE: "Ceuta", ML: "Melilla" };
  const datoCiudad = (ind, id) => (DATA.ciudades[ind.id] || {})[id];
  const AVISO_CIUDADES = "Se muestran aparte: su sanidad la gestiona directamente el Ministerio (INGESA) y su población es muy pequeña, así que una sola cifra puede variar mucho. No cuentan para la media ni para los puestos de las 17, ni cambian sus colores.";
  const AVISO_GASTO = "No aparecen en gasto: el Excel del Ministerio solo recoge la parte que paga el INGESA (tablas 3.5.1 y 3.5.2); el resto va por los ayuntamientos y no está desglosado. Compararlas con las 17 daría una cifra más baja de la real.";
  function tileMap(cont, vals, ind, { onClick, selIds = [], neutro = false, paleta = PAL } = {}) {
    const esca = neutro ? null : escala(vals, ind, paleta);
    const surf = css("--surface"), fg = css("--fg"), muted = css("--muted"), acc = css("--accent"), linea = css("--grey-line");
    const m = GEO.marco;
    let sv = `<svg class="geo" viewBox="0 0 ${GEO.w} ${GEO.h}" role="group" aria-label="Mapa de las comunidades autónomas">
      <rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="10" fill="none" stroke="${linea}" stroke-dasharray="4 4"/>`;
    const falta = (id) => !neutro && vals[id] == null; // comunidad sin dato en el informe (alguna especialidad)
    const color = (id) => neutro ? (selIds.includes(id) ? { bg: acc, fg: "#ffffff" } : { bg: linea, fg }) : falta(id) ? { bg: linea, fg } : esca.color(id);
    GEO.regiones.forEach((r) => {
      if (SIN_DATOS.includes(r.id)) { sv += `<path d="${r.d}" fill="${muted}" stroke="none"/>`; return; }
      const v = vals ? vals[r.id] : null;
      const et = neutro ? NOMBRE[r.id] : `${NOMBRE[r.id]}: ${falta(r.id) ? "sin dato" : fmt(v, ind.unidad)}`;
      sv += `<path class="reg" data-id="${r.id}" d="${r.d}" fill="${color(r.id).bg}" stroke="${surf}" stroke-width="1" stroke-linejoin="round" tabindex="0" role="button" aria-label="${esc(et)}"/>`;
    });
    // borde de las seleccionadas, por encima de todo
    GEO.regiones.filter((r) => selIds.includes(r.id)).forEach((r) => { sv += `<path d="${r.d}" fill="none" stroke="${fg}" stroke-width="2.6" stroke-linejoin="round" pointer-events="none"/>`; });
    if (!neutro) GEO.regiones.forEach((r) => {
      if (SIN_DATOS.includes(r.id)) return;
      const k = color(r.id), grande = r.area > 2500, peq = r.area < 1300;
      const v = falta(r.id) ? "s/d" : fmtCorto(vals[r.id], ind.unidad).replace(" €", "");
      // Halo del color de la comunidad: la etiqueta se lee aunque se salga de su silueta.
      const halo = `stroke="${k.bg}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"`;
      sv += `<text x="${r.lx}" y="${r.ly + (grande ? -2 : 4)}" text-anchor="middle" font-size="${peq ? 10 : 12}" font-weight="700" fill="${k.fg}" ${halo}>${ABR[r.id]}</text>`;
      if (grande) sv += `<text x="${r.lx}" y="${r.ly + 12}" text-anchor="middle" font-size="11" fill="${k.fg}" class="num" ${halo}>${v}</text>`;
    });
    const conCiud = !neutro && DATA.ciudades[ind.id];
    if (conCiud) GEO.regiones.filter((r) => CIUDADES[r.id]).forEach((r) => {
      const v = datoCiudad(ind, r.id); if (v == null) return;
      const k = esca.colorV(v);
      sv += `<g class="reg ciu" data-id="${r.id}" tabindex="0" role="img" aria-label="${CIUDADES[r.id]}: ${esc(fmt(v, ind.unidad))} (aparte)"><circle cx="${r.lx}" cy="${r.ly}" r="8" fill="${k.bg}" stroke="${fg}" stroke-width="1.2" stroke-dasharray="2 2"/>
        <text x="${r.lx + 12}" y="${r.ly + 4}" font-size="10.5" fill="${fg}">${CIUDADES[r.id]} ${fmtCorto(v, ind.unidad)}*</text></g>`;
    });
    sv += `<text x="${m.x + 8}" y="${m.y + m.h - 8}" font-size="10" fill="${muted}">Canarias</text></svg><p class="geo-fuente">Mapa: Instituto Geográfico Nacional (es-atlas), CC BY 4.0. ${conCiud ? "* Ceuta y Melilla, aparte: no cuentan para la media ni los puestos." : neutro ? "" : "Ceuta y Melilla, en gris: sin gasto comparable."}</p>`;
    cont.innerHTML = sv;
    cont.querySelectorAll(".ciu").forEach((t) => {
      const id = t.dataset.id;
      t.onmousemove = (e) => showTip(`<b>${CIUDADES[id]}</b> (ciudad autónoma)<br>${fmt(datoCiudad(ind, id), ind.unidad)}<br>Aparte: no cuenta para la media ni los puestos.`, e.clientX, e.clientY);
      t.onmouseleave = hideTip;
    });
    cont.querySelectorAll(".reg:not(.ciu)").forEach((t) => {
      const id = t.dataset.id;
      t.onclick = () => onClick && onClick(id);
      t.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(id); } };
      t.onmousemove = (e) => {
        if (neutro) { showTip(`<b>${esc(NOMBRE[id])}</b>`, e.clientX, e.clientY); return; }
        if (falta(id)) { showTip(`<b>${esc(NOMBRE[id])}</b><br>Sin dato en el informe`, e.clientX, e.clientY); return; }
        const orden = ordenados(vals);
        showTip(`<b>${esc(NOMBRE[id])}</b><br>${fmt(vals[id], ind.unidad)}<br>${puestoTxt(ind, orden.indexOf(id) + 1, orden.length)}`, e.clientX, e.clientY);
      };
      t.onmouseleave = hideTip;
      t.onfocus = () => { const r = t.getBoundingClientRect(); t.onmousemove({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); };
      t.onblur = hideTip;
    });
    return esca;
  }

  function leyenda(cont, esca) { cont.innerHTML = esca.leyenda; }

  let timer = null;
  // Línea de tiempo. El control se crea una vez y luego solo se actualiza: si se volviera a crear en cada
  // paso, el navegador soltaría el tirador a mitad de un arrastre.
  const pctAnio = (a) => ((a - ANIOS[0]) / (ULT - ANIOS[0])) * 100;
  const marcasAnios = () => `<div class="marcas" aria-hidden="true">${ANIOS.filter((a, i) => a === ANIOS[0] || a === ULT || (a - ANIOS[0]) % 4 === 0 && ULT - a >= 3)
    .map((a) => `<span style="left:calc(10px + (100% - 20px) * ${pctAnio(a) / 100})">${a}</span>`).join("")}</div>`;
  function barraAnios(cont, ind, anio, onChange) {
    if (!tieneSerie(ind)) {
      cont.dataset.tipo = "";
      cont.innerHTML = `<span class="nota" style="margin:0">Listas de espera: un solo corte (${DATA.corteListas}). La evolución llegará al añadir más informes.</span>`;
      return;
    }
    if (cont.dataset.tipo !== "anio") {
      cont.dataset.tipo = "anio";
      cont.innerHTML = `<button type="button" class="play"></button><span class="anio"></span><span class="prov">provisional</span>
        <div class="linea"><input type="range" min="${ANIOS[0]}" max="${ULT}" step="1" aria-label="Año">${marcasAnios()}</div>
        <span class="ayuda-rango">Mueve el punto para elegir el año. Con ▶ verás cómo cambia año a año.</span>`;
    }
    const inp = cont.querySelector("input"), play = cont.querySelector(".play");
    if (+inp.value !== anio) inp.value = anio;
    cont.querySelector(".anio").textContent = anio;
    cont.querySelector(".prov").hidden = !esProv(anio);
    play.textContent = timer ? "❚❚" : "▶";
    play.setAttribute("aria-label", timer ? "Pausar" : "Reproducir los años");
    inp.oninput = () => { pararPlay(); onChange(+inp.value); };
    play.onclick = () => {
      if (timer) { pararPlay(); render(); return; }
      let a = anio >= ULT ? ANIOS[0] : anio;
      onChange(a);
      timer = setInterval(() => { a++; if (a > ULT) { pararPlay(); render(); return; } onChange(a); }, 420);
      render();
    };
  }
  function pararPlay() { if (timer) { clearInterval(timer); timer = null; } }
  // Año de partida para los cambios: el elegido en modo «Crecimiento», o el primero de la serie.
  const base0 = () => (S.modo === "cambio" ? S.desde : ANIOS[0]);
  // En modo «Crecimiento»: la misma línea de tiempo con dos tiradores (desde y hasta) y el tramo resaltado.
  function barraPeriodo(cont, onChange) {
    if (cont.dataset.tipo !== "rango") {
      cont.dataset.tipo = "rango";
      cont.innerHTML = `<span class="anio rango-txt"></span><span class="prov">provisional</span>
        <div class="linea rango"><div class="pista"></div><div class="tramo"></div>
          <input type="range" class="r-desde" min="${ANIOS[0]}" max="${ULT}" step="1" aria-label="Año de inicio del periodo">
          <input type="range" class="r-hasta" min="${ANIOS[0]}" max="${ULT}" step="1" aria-label="Año final del periodo">${marcasAnios()}</div>
        <span class="ayuda-rango">Arrastra los dos puntos: el de la izquierda es el año de inicio y el de la derecha, el final.</span>`;
    }
    const d = cont.querySelector(".r-desde"), h = cont.querySelector(".r-hasta");
    const pintar = () => {
      if (+d.value !== S.desde) d.value = S.desde;
      if (+h.value !== S.anioP) h.value = S.anioP;
      cont.querySelector(".rango-txt").textContent = `De ${S.desde} a ${S.anioP}`;
      cont.querySelector(".prov").hidden = !esProv(S.anioP) && !esProv(S.desde);
      const t = cont.querySelector(".tramo");
      t.style.left = `calc(10px + (100% - 20px) * ${pctAnio(S.desde) / 100})`;
      t.style.width = `calc((100% - 20px) * ${(pctAnio(S.anioP) - pctAnio(S.desde)) / 100})`;
      // el tirador más cercano al otro extremo queda encima, para poder moverlo siempre
      d.style.zIndex = S.desde > ULT - 2 ? 3 : 2;
    };
    pintar();
    // Los extremos nunca se cruzan: como mínimo, un año de diferencia.
    d.oninput = () => { const v = Math.min(+d.value, S.anioP - 1); d.value = v; if (v !== S.desde) { S.desde = v; onChange(); } };
    h.oninput = () => { const v = Math.max(+h.value, S.desde + 1); h.value = v; if (v !== S.anioP) { S.anioP = v; onChange(); } };
  }

  // Posición en palabras. En listas de espera, el puesto 1 es la peor situación.
  // Posición en palabras, contada desde el extremo más cercano: «4.ª con menos espera» se entiende mejor
  // que «14.ª con más espera de 17». En listas de espera, la que más espera es la peor.
  const arriba = (pos, n) => pos <= Math.ceil(n / 2);
  function puestoTxt(ind, pos, n = 17) {
    if (ind.grupo === "espera") {
      if (pos === 1) return `La peor de las ${n}: la que más espera`;
      if (pos === n) return `La mejor de las ${n}: la que menos espera`;
      return arriba(pos, n) ? `La ${pos}.ª con más espera de ${n}` : `La ${n - pos + 1}.ª con menos espera de ${n}`;
    }
    if (pos === 1) return `La que más de las ${n}`;
    if (pos === n) return `La que menos de las ${n}`;
    return arriba(pos, n) ? `La ${pos}.ª más alta de ${n}` : `La ${n - pos + 1}.ª más baja de ${n}`;
  }

  // ---------- titulares automáticos ----------
  function titulares(ind, anio) {
    const vals = valores(ind, anio);
    const o = ordenados(vals); const top = o[0], bot = o[o.length - 1];
    const m = media(vals); const u = ind.unidad;
    const out = [];
    if (ind.id === "gasto_hab" || ind.id === "farmacia_hab") {
      out.push({ k: "Más y menos", t: `<strong>${NOMBRE[top]}</strong> gasta ${fmt(vals[top], u)} por habitante, un ${nf(0).format((vals[top] / vals[bot] - 1) * 100)} % más que <strong>${NOMBRE[bot]}</strong> (${fmt(vals[bot], u)}).` });
    } else if (u === "dias") {
      out.push({ k: "Más y menos espera", t: `En <strong>${NOMBRE[top]}</strong> se espera de media ${fmt(vals[top], u)}; en <strong>${NOMBRE[bot]}</strong>, ${fmt(vals[bot], u)}. Es ${nf(1).format(vals[top] / vals[bot])} veces más.` });
    } else {
      out.push({ k: "Extremos", t: `<strong>${NOMBRE[top]}</strong> tiene el valor más alto (${fmt(vals[top], u)}) y <strong>${NOMBRE[bot]}</strong> el más bajo (${fmt(vals[bot], u)}).` });
    }
    out.push({ k: "Media", t: `La media de las ${o.length} comunidades${o.length < IDS.length ? " con dato" : ""} es <strong>${fmt(m, u)}</strong>. ${o.filter((id) => vals[id] > m).length} están por encima.` });
    if (tieneSerie(ind) && anio > base0()) {
      const base = valores(ind, base0());
      const cambio = {};
      for (const id of IDS) cambio[id] = u === "pct" ? vals[id] - base[id] : (vals[id] / base[id] - 1) * 100;
      const oc = ordenados(cambio); const a = oc[0], b = oc[oc.length - 1];
      const f = (x) => (x >= 0 ? "+" : "−") + nf(u === "pct" ? 1 : 0).format(Math.abs(x)) + (u === "pct" ? " puntos" : " %");
      out.push({ k: `Cambio de ${base0()} a ${anio}${sinInfl(ind) ? ", descontada la inflación" : ""}`, t: `<strong>${NOMBRE[a]}</strong> es la que más ha cambiado (${f(cambio[a])}); <strong>${NOMBRE[b]}</strong>, la que menos (${f(cambio[b])}).` });
    } else if (!tieneSerie(ind)) {
      out.push({ k: "Dato del informe", t: `Datos del SISLE-SNS a ${DATA.corteListas}. ${ind.desc}` });
    }
    return { out, top, bot };
  }

  // ---------- DATOS (mapa arriba; ranking, evolución y tabla debajo) ----------
  // Si la especialidad elegida no vale para la tarjeta (p. ej. de quirúrgica a consultas), vuelve al total.
  function campoValido(base) {
    if (S.campoE !== "total" && (base.grupo !== "espera" || !familias(base).includes(S.campoE.split(":")[0]))) S.campoE = "total";
    return indDetalle(base, S.campoE);
  }

  // Cambio desde el primer año: % en euros y otros valores; puntos en porcentajes. Respeta la inflación.
  function cambioInd(ind, anio) {
    const vals = valores(ind, anio), base = valores(ind, S.desde), u = ind.unidad;
    const out = {};
    for (const id of IDS) if (vals[id] != null && base[id] != null) out[id] = u === "pct" ? vals[id] - base[id] : (vals[id] / base[id] - 1) * 100;
    const nombre = u === "pct"
      ? `${ind.nombre}: cambio de ${S.desde} a ${anio}, en puntos`
      : `${ind.nombre}: cambio de ${S.desde} a ${anio}, en %${enEuros(ind) ? (S.real ? ", descontada la inflación" : ", sin descontar la inflación") : ""}`;
    return { ind: { ...ind, id: `${ind.id}~cambio`, unidad: u === "pct" ? "pp" : "var", nombre }, vals: out };
  }

  function renderDatos() {
    const baseInd = IND[S.indP];
    const ind = campoValido(baseInd);
    if (!tieneSerie(ind)) S.modo = "valor";
    if (S.modo === "cambio" && S.anioP <= S.desde) { S.anioP = ULT; if (S.desde >= ULT) S.desde = ANIOS[0]; }
    selector($("#sel-datos"), S.indP, (id) => { pararPlay(); S.indP = id; render(); });
    selectorCampo($("#d-campo"), baseInd, "d-campo-sel");

    const anio = tieneSerie(ind) ? S.anioP : null;
    const vals = valores(ind, anio);
    const { out } = titulares(ind, anio);
    const enCambio = S.modo === "cambio";
    // Mapa: el valor de un año, o cuánto ha cambiado entre dos años
    const mapa = enCambio ? cambioInd(ind, anio) : { ind, vals };
    const mo = ordenados(mapa.vals), top = mo[0], bot = mo[mo.length - 1];
    const infl = enEuros(ind) ? (S.real ? "descontada la inflación" : "sin descontar la inflación") : "";
    const verbo = ind.unidad === "pct" ? "subido" : "crecido";

    // «Tu comunidad»: su valor y puesto, o su cambio y puesto en el periodo
    const ficha = `<a href="#comunidad-${S.com.toLowerCase()}">Ver su ficha completa</a>`;
    let tuya;
    if (vals[S.com] == null) tuya = `Sin dato en el informe para esta especialidad. ${ficha}`;
    else if (enCambio) {
      const pos = mo.indexOf(S.com) + 1;
      const puesto = pos === 1 ? `La que más ha ${verbo} de las ${mo.length}` : pos === mo.length ? `La que menos ha ${verbo} de las ${mo.length}` : arriba(pos, mo.length) ? `La ${pos}.ª que más ha ${verbo} de ${mo.length}` : `La ${mo.length - pos + 1}.ª que menos ha ${verbo} de ${mo.length}`;
      tuya = `${fmt(mapa.vals[S.com], mapa.ind.unidad)} de ${S.desde} a ${anio}${infl ? ` (${infl})` : ""}. ${puesto}. ${ficha}`;
    } else {
      const ord = ordenados(vals);
      tuya = `<strong>${fmt(vals[S.com], ind.unidad)}</strong>${tieneSerie(ind) ? ` en ${anio}` : ""}. ${puestoTxt(ind, ord.indexOf(S.com) + 1, ord.length)}. ${ficha}`;
    }
    out.unshift({ k: "Tu comunidad", t: tuya, elegir: true });
    if (enCambio) {
      // En «Cambio entre dos años» todos los cuadros hablan del cambio; el valor final queda como contexto.
      const mc = media(mapa.vals), u2 = mapa.ind.unidad;
      out.splice(1, out.length - 1,
        { k: `Media de las 17, de ${S.desde} a ${anio}`, t: `De media, las comunidades han ${verbo} <strong>${fmt(mc, u2)}</strong>${infl ? ` (${infl})` : ""}. ${mo.filter((id) => mapa.vals[id] > mc).length} están por encima.` },
        { k: `Para situarse: el valor en ${anio}`, t: `<strong>${NOMBRE[ordenados(vals)[0]]}</strong> está arriba (${fmt(vals[ordenados(vals)[0]], ind.unidad)}) y <strong>${NOMBRE[ordenados(vals).at(-1)]}</strong> abajo (${fmt(vals[ordenados(vals).at(-1)], ind.unidad)}). Para verlo en el mapa, elige «Un año».` });
    }
    // «Tu comunidad» lleva su propio desplegable (además de poder pulsarla en el mapa): sirve para las
    // comunidades pequeñas, en el móvil y con teclado o lector de pantalla.
    const opcionesCom = IDS.slice().sort((a, b) => NOMBRE[a].localeCompare(NOMBRE[b], "es")).map((k) => `<option value="${k}" ${k === S.com ? "selected" : ""}>${esc(NOMBRE[k])}</option>`).join("");
    $("#p-insights").innerHTML = out.map((x) => x.elegir
      ? `<div class="insight tuya"><label class="k" for="p-com">${esc(x.k)}</label><select id="p-com">${opcionesCom}</select><p>${x.t}</p></div>`
      : `<div class="insight"><div class="k">${esc(x.k)}</div><p>${x.t}</p></div>`).join("");
    $("#p-com").onchange = (e) => { S.com = e.target.value; render(); };

    // Título y subtítulo: dicen exactamente qué muestra el mapa
    if (enCambio) {
      $("#p-titulo").textContent = `${ind.nombre}: cuánto ha cambiado de ${S.desde} a ${anio}`;
      $("#p-sub").textContent = `${NOMBRE[top]} es la que más ha ${verbo} (${fmt(mapa.vals[top], mapa.ind.unidad)}) y ${NOMBRE[bot]} la que menos (${fmt(mapa.vals[bot], mapa.ind.unidad)})${infl ? `, ${infl}` : ""}.${esProv(anio) || esProv(S.desde) ? ` Los datos de ${[S.desde, anio].filter(esProv).join(" y ")} son provisionales.` : ""} Pulsa una comunidad para elegirla como la tuya.`;
    } else if (tieneSerie(ind)) {
      $("#p-titulo").textContent = `${ind.nombre} en ${anio}: ${NOMBRE[top]} arriba, ${NOMBRE[bot]} abajo`;
      $("#p-sub").textContent = `${esProv(anio) ? "Dato provisional. " : ""}${enEuros(ind) && anio !== ULT ? (S.real ? `En euros de ${ULT}, descontada la inflación. ` : "En euros de ese año. ") : ""}Pulsa una comunidad para elegirla como la tuya.`;
    } else {
      $("#p-titulo").textContent = `${ind.nombre}: ${NOMBRE[top]} arriba, ${NOMBRE[bot]} abajo`;
      $("#p-sub").textContent = `Situación a ${DATA.corteListas}. Pulsa una comunidad para elegirla como la tuya.`;
    }
    // El modo (un año / cambio entre dos años) se elige arriba, en el resumen o en Ajustes.
    leyenda($("#p-leyenda"), tileMap($("#p-mapa"), mapa.vals, mapa.ind, { selIds: [S.com], onClick: (id) => { S.com = id; render(); } }));
    botonPNG($("#p-desc"), "Descargar mapa (PNG)", () => descargarPNG($("#p-mapa svg"), `mapa_${mapa.ind.id}`, $("#p-titulo").textContent, $("#p-leyenda"),
      [$("#p-sub").textContent.replace(" Pulsa una comunidad para elegirla como la tuya.", "")]));
    if (enCambio) barraPeriodo($("#p-anios"), () => { pararPlay(); render(); });
    else barraAnios($("#p-anios"), ind, S.anioP, (a) => { S.anioP = a; render(); });

    renderResumen(baseInd);
    renderDetalle(ind, mapa, anio);
    renderXY(ind);
    guardarEnlace();
  }

  // Barra fija con el dato que estás viendo: aparece al bajar, cuando las tarjetas ya no se ven,
  // para cambiar de dato (y de especialidad) sin tener que volver arriba. Útil sobre todo en el móvil.
  // Cambia algo sin mover la pantalla: el bloque que estabas mirando se queda en el mismo sitio aunque
  // lo de arriba cambie de altura (p. ej. al pasar de gasto a listas de espera).
  function sinMover(accion) {
    const bajo = document.elementFromPoint(innerWidth / 2, Math.min(innerHeight / 2, 160));
    const ancla = bajo && bajo.closest(".panel, .intro");
    const antes = ancla ? ancla.getBoundingClientRect().top : null;
    accion();
    if (ancla && antes != null) scrollBy(0, ancla.getBoundingClientRect().top - antes);
  }
  // ---------- Resumen de lo que estás viendo + panel «Ajustes» ----------
  // Una etiqueta por cada elección (dato, especialidad, años, inflación, tu comunidad, gráfico). El resumen va
  // encima del mapa y se queda fijo arriba al bajar. Las etiquetas que no están como al principio se resaltan.
  const POR_DEFECTO = { indP: "gasto_hab", campoE: "total", modo: "valor", desde: ANIOS[0], real: true, vistaE: "ranking" };
  const aplicar = (fn) => sinMover(() => { pararPlay(); fn(); render(); });
  const opt = (v, txt, sel, dis = false) => `<option value="${v}" ${sel ? "selected" : ""} ${dis ? "disabled" : ""}>${esc(txt)}</option>`;
  const opcionesDato = () => ["gasto", "espera"].map((g) => `<optgroup label="${g === "gasto" ? "Gasto sanitario" : "Listas de espera"}">${DATA.inds.filter((i) => i.grupo === g).map((i) => opt(i.id, i.corto, i.id === S.indP)).join("")}</optgroup>`).join("");
  const opcionesCampo = (base) => opt("total", "Todas (total)", S.campoE === "total") + familias(base).map((tipo) => `<optgroup label="${tipo === "procesos" ? "Procesos" : "Especialidades"}">${DATA.detalle[tipo].campos.filter((c) => c.id !== "total").map((c) => opt(`${tipo}:${c.id}`, c.nombre, S.campoE === `${tipo}:${c.id}`)).join("")}</optgroup>`).join("");
  const opcionesAnio = (lista, sel) => lista.map((a) => opt(a, `${a}${esProv(a) ? " (prov.)" : ""}`, a === sel)).join("");
  const opcionesCom = () => IDS.slice().sort((a, b) => NOMBRE[a].localeCompare(NOMBRE[b], "es")).map((k) => opt(k, NOMBRE[k], k === S.com)).join("");
  const opcionesGraf = (base) => [["ranking", "Ranking"], ["evolucion", "Evolución"], ["tabla", "Tabla"]].map(([v, t]) => opt(v, t, S.vistaE === v, v === "evolucion" && !tieneSerie(base))).join("");

  // «31 de diciembre de 2025» -> «dic. 2025» (para que quepa en una etiqueta)
  const corteCorto = () => { const m = DATA.corteListas.match(/de (\w+) de (\d{4})/); return m ? `${m[1].slice(0, 3)}. ${m[2]}` : DATA.corteListas; };
  function renderResumen(base) {
    const serie = tieneSerie(base);
    const chip = (et, dentro, cambiado = false, extra = "") => `<span class="chip-s${cambiado ? " cambiado" : ""}" ${extra}>${et ? `<span class="et">${et}</span>` : ""}${dentro}</span>`;
    const ayuda = (txt) => `title="${esc(txt)}"`;
    let h = chip("", `<select id="rs-dato" aria-label="Dato">${opcionesDato()}</select>`, false, ayuda("Qué dato muestran el mapa y los gráficos"));
    if (base.grupo === "espera") h += chip("", `<select id="rs-campo" aria-label="Especialidad o proceso">${opcionesCampo(base)}</select>`, S.campoE !== "total", ayuda("Las tarjetas de arriba siguen mostrando el total"));
    if (serie) {
      // Una sola etiqueta para el periodo: «Año 2024» o «Periodo 2002 → 2020», con un botón para cambiar de modo
      const btnModo = `<button type="button" class="rs-modo" id="rs-modo">${S.modo === "cambio" ? "Ver un año" : "Comparar años"}</button>`;
      h += S.modo === "cambio"
        ? chip("", `<select id="rs-desde" aria-label="Año de inicio">${opcionesAnio(ANIOS.filter((a) => a < S.anioP), S.desde)}</select><span class="flecha" aria-hidden="true">→</span><select id="rs-hasta" aria-label="Año final">${opcionesAnio(ANIOS.filter((a) => a > S.desde), S.anioP)}</select>${btnModo}`, true, ayuda("Cuánto ha cambiado entre dos años. «Ver un año» vuelve al valor de un solo año"))
        : chip("", `<select id="rs-anio" aria-label="Año">${opcionesAnio(ANIOS.slice().reverse(), S.anioP)}</select>${btnModo}`, S.anioP !== ULT, ayuda("El año que muestran el mapa y el ranking. «Comparar años» muestra cuánto ha cambiado entre dos"));
    } else h += chip("", `<span class="fijo" title="${DATA.corteListas}">${corteCorto()}</span>`);
    if (enEuros(base)) h += `<button type="button" id="rs-infl" class="chip-s boton${S.real ? "" : " cambiado"}" aria-pressed="${!S.real}" title="Pulsa para ${S.real ? "ver los euros de cada año" : "descontar la inflación"}"><span class="et">Inflación</span>${S.real ? "Descontada" : "Sin descontar"}</button>`;
    h += chip("Tu comunidad", `<select id="rs-com" aria-label="Tu comunidad">${opcionesCom()}</select>`, false, ayuda("Se resalta en el mapa y en los gráficos"));
    h += chip("Gráfico", `<select id="rs-graf" aria-label="Gráfico de abajo">${opcionesGraf(base)}</select>`, false, ayuda("El gráfico que aparece debajo del mapa"));
    // «Restablecer» (en el ordenador), al final de las etiquetas, solo cuando algo no está como al principio
    const cambiado = Object.entries(POR_DEFECTO).some(([k, v]) => S[k] !== v) || S.anioP !== ULT;
    if (cambiado) h += `<button type="button" class="rs-reset" id="rs-reset">Restablecer</button>`;
    $("#rs-chips").innerHTML = h;
    if (cambiado) $("#rs-reset").onclick = () => aplicar(() => Object.assign(S, POR_DEFECTO, { anioP: ULT }));
    // En el móvil, una sola línea con el resumen (lo que no está como al principio, resaltado); al tocarla, Ajustes.
    const parte = (txt, cambiado = false) => `<span class="${cambiado ? "cambiado" : ""}">${esc(txt)}</span>`;
    const partes = [parte(base.corto)];
    if (base.grupo === "espera" && S.campoE !== "total") partes.push(parte(indDetalle(base, S.campoE).campoNombre || "", true));
    if (serie) partes.push(S.modo === "cambio" ? parte(`${S.desde} → ${S.anioP}`, true) : parte(String(S.anioP), S.anioP !== ULT));
    else partes.push(parte(corteCorto()));
    if (enEuros(base)) partes.push(parte(S.real ? "sin inflación" : "con inflación", !S.real));
    partes.push(parte(NOMBRE[S.com]));
    $("#rs-texto").innerHTML = `<span class="rs-linea">${partes.join('<span class="sep"> · </span>')}</span><span class="rs-mas" aria-hidden="true">▾</span>`;
    $("#rs-texto").setAttribute("aria-label", `Estás viendo: ${$("#rs-texto").textContent.replace("▾", "")}. Pulsa para cambiarlo`);
    $("#rs-texto").onclick = () => { renderAjustes(); $("#ajustes").showModal(); };
    const barra = $("#resumen");
    barra.classList.remove("compacta");
    if (innerWidth > 640 && $("#rs-chips").scrollHeight > 46) barra.classList.add("compacta");
    const on = (id, fn) => { const el = $("#" + id); if (el) el.onchange = (e) => aplicar(() => fn(e.target.value)); };
    on("rs-dato", (v) => { S.indP = v; });
    on("rs-campo", (v) => { S.campoE = v; });
    if ($("#rs-modo")) $("#rs-modo").onclick = () => aplicar(() => { S.modo = S.modo === "cambio" ? "valor" : "cambio"; });
    on("rs-anio", (v) => { S.anioP = +v; });
    on("rs-desde", (v) => { S.desde = +v; });
    on("rs-hasta", (v) => { S.anioP = +v; });
    on("rs-com", (v) => { S.com = v; });
    on("rs-graf", (v) => { S.vistaE = v; });
    if ($("#rs-infl")) $("#rs-infl").onclick = () => aplicar(() => { S.real = !S.real; });
    $("#rs-ajustes").onclick = () => { renderAjustes(); $("#ajustes").showModal(); };
    if ($("#ajustes").open) renderAjustes();
  }

  // Panel con todas las opciones juntas y explicadas (en el móvil sale desde abajo).
  function renderAjustes() {
    const base = IND[S.indP], serie = tieneSerie(base);
    const radios = (nombre, valor, ops) => `<div class="aj-radios" role="radiogroup" aria-label="${nombre}">${ops.map(([v, t, nota, dis]) => `<label class="aj-radio${dis ? " dis" : ""}"><input type="radio" name="aj-${nombre}" id="aj-${nombre}-${v}" value="${v}" ${String(valor) === String(v) ? "checked" : ""} ${dis ? "disabled" : ""}><span>${t}${nota ? ` <small>${nota}</small>` : ""}</span></label>`).join("")}</div>`;
    const fila = (titulo, control, ayuda = "") => `<div class="aj-fila"><div class="aj-t">${titulo}</div><div>${control}${ayuda ? `<p class="aj-ayuda">${ayuda}</p>` : ""}</div></div>`;
    let h = `<div class="aj-cab"><h2 id="aj-titulo">Ajustes de la vista</h2><button type="button" class="aj-cerrar" id="aj-cerrar" aria-label="Cerrar">×</button></div>`;
    h += fila("Dato", `<select id="aj-dato">${opcionesDato()}</select>`);
    if (base.grupo === "espera") h += fila("Especialidad", `<select id="aj-campo">${opcionesCampo(base)}</select>`, "Las tarjetas siguen mostrando el total.");
    if (serie) {
      h += fila("¿Qué ver?", radios("modo", S.modo, [["valor", "Un año"], ["cambio", "Cambio entre dos años"]]), "El mapa y el ranking muestran el valor de un año o cuánto ha cambiado entre dos.");
      h += S.modo === "cambio"
        ? fila("Años", `<span class="aj-anios">Desde <select id="aj-desde">${opcionesAnio(ANIOS.filter((a) => a < S.anioP), S.desde)}</select> hasta <select id="aj-hasta">${opcionesAnio(ANIOS.filter((a) => a > S.desde), S.anioP)}</select></span>`)
        : fila("Año", `<select id="aj-anio">${opcionesAnio(ANIOS.slice().reverse(), S.anioP)}</select>`);
    } else h += fila("Fecha", `<span>${DATA.corteListas}</span>`, "Hay un solo informe de listas de espera; la evolución llegará con los siguientes.");
    if (enEuros(base)) h += fila("Inflación", radios("infl", S.real ? "1" : "0", [["1", "Descontada", "(recomendado)"], ["0", "Sin descontar"]]), `Descontada: cada año en euros de ${ULT}, para ver cuánto ha crecido el gasto de verdad.`);
    h += fila("Tu comunidad", `<select id="aj-com">${opcionesCom()}</select>`, "Se resalta en el mapa y en los gráficos.");
    h += fila("Gráfico", radios("graf", S.vistaE, [["ranking", "Ranking"], ["evolucion", "Evolución", "", !serie], ["tabla", "Tabla"]]), "El gráfico que aparece debajo del mapa.");
    h += `<div class="aj-pie"><button type="button" class="btn" id="aj-reset">Restablecer</button><button type="button" class="btn primary" id="aj-ver">Ver resultado</button></div>`;
    $("#aj-cuerpo").innerHTML = h;
    const on = (sel, fn) => $("#aj-cuerpo").querySelectorAll(sel).forEach((el) => el.onchange = (e) => { pararPlay(); fn(e.target.value); render(); });
    on("#aj-dato", (v) => { S.indP = v; });
    on("#aj-campo", (v) => { S.campoE = v; });
    on('input[name="aj-modo"]', (v) => { S.modo = v; });
    on("#aj-anio", (v) => { S.anioP = +v; });
    on("#aj-desde", (v) => { S.desde = +v; });
    on("#aj-hasta", (v) => { S.anioP = +v; });
    on('input[name="aj-infl"]', (v) => { S.real = v === "1"; });
    on("#aj-com", (v) => { S.com = v; });
    on('input[name="aj-graf"]', (v) => { S.vistaE = v; });
    const cerrar = () => $("#ajustes").close();
    $("#aj-cerrar").onclick = cerrar;
    $("#aj-ver").onclick = () => { cerrar(); document.querySelector("#v-datos .portada-grid").scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("#aj-reset").onclick = () => { pararPlay(); Object.assign(S, POR_DEFECTO, { anioP: ULT }); render(); };
  }

  // Pestañas bajo el mapa. El ranking sigue al mapa (valor o cambio); la tabla trae los dos.
  function renderDetalle(ind, mapa, anio) {
    if (!tieneSerie(ind) && S.vistaE === "evolucion") S.vistaE = "ranking";
    document.querySelectorAll("#e-vistas button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.v === S.vistaE);
      b.disabled = b.dataset.v === "evolucion" && !tieneSerie(ind);
      b.title = b.disabled ? "Hace falta más de un informe de listas de espera" : "";
      b.onclick = () => { pararPlay(); S.vistaE = b.dataset.v; render(); };
    });
    const opts = IDS.filter((id) => !S.sel.some((x) => x.id === id)).map((id) => `<option value="${id}">${esc(NOMBRE[id])}</option>`).join("");
    $("#e-selec").innerHTML = `<span>Destacar:</span>` + S.sel.map((s) =>
      `<span class="pill"><i style="background:${css(SLOTS[s.slot])}"></i>${esc(NOMBRE[s.id])}<button type="button" aria-label="Quitar ${esc(NOMBRE[s.id])}" data-id="${s.id}">×</button></span>`).join("") +
      `<select aria-label="Añadir comunidad"><option value="">+ Añadir (máx. 3)</option>${opts}</select>`;
    $("#e-selec").querySelectorAll(".pill button").forEach((b) => b.onclick = () => { alternarSel(b.dataset.id); render(); });
    $("#e-selec select").onchange = (e) => { if (e.target.value) { alternarSel(e.target.value); render(); } };

    const cont = $("#e-chart");
    const vals = valores(ind, anio);
    const fecha = tieneSerie(ind) ? `${anio}${esProv(anio) ? " (provisional)" : ""}` : DATA.corteListas;
    if (S.vistaE === "evolucion") {
      $("#e-titulo").textContent = `${ind.nombre}, ${ANIOS[0]}-${ULT}${sinInfl(ind) ? `, en euros de ${ULT}` : enEuros(ind) ? ", en euros de cada año" : ""}`;
      $("#e-sub").textContent = "Las 17 comunidades en gris; en color, las que destaques. Pasa el ratón por el gráfico para ver cada año.";
      lineas(cont, ind);
    } else if (S.vistaE === "tabla") {
      const n = ordenados(vals).length;
      $("#e-titulo").textContent = `${ind.nombre}, ${fecha}`;
      $("#e-sub").textContent = `Las ${n} comunidades${n < IDS.length ? " con dato" : ""}, de más a menos. Tu comunidad va resaltada.`;
      tabla(cont, ind, anio);
    } else {
      const mo = ordenados(mapa.vals);
      $("#e-titulo").textContent = S.modo === "cambio" ? `${mapa.ind.nombre}` : `${ind.nombre}, ${fecha}: ${NOMBRE[mo[0]]} en cabeza`;
      $("#e-sub").textContent = "Pulsa una barra para destacar esa comunidad en la evolución.";
      ranking(cont, mapa.vals, mapa.ind);
    }
    if (S.vistaE === "tabla") $("#e-desc").innerHTML = "";
    else botonPNG($("#e-desc"), "Descargar gráfico (PNG)", () => descargarPNG($("#e-chart svg"), `${S.vistaE}_${ind.id}`, $("#e-titulo").textContent, null,
      [...document.querySelectorAll("#e-chart .notas-oficiales li")].map((li, k) => `${k + 1}. ${li.textContent.replace(/\s+/g, " ").trim()}`)));
    const sinDato = IDS.filter((k) => vals[k] == null);
    $("#e-nota").innerHTML = `${esc(ind.desc)} Fuente: Ministerio de Sanidad${tieneSerie(ind) ? ", Estadística de Gasto Sanitario Público" : ", SISLE-SNS"}.` +
      (sinDato.length ? ` Sin dato en el informe: ${sinDato.map((k) => esc(NOMBRE[k])).join(", ")}.` : "") +
      (tieneSerie(ind) && S.vistaE !== "evolucion" ? NOTAS.filter((n) => n.anio === anio).map((n) => `<div class="notas-oficiales"><b>Nota del Ministerio (${esc(NOMBRE[n.ccaa])}, ${n.anio}):</b> ${esc(n.texto)}</div>`).join("") : "") +
      (tieneSerie(ind) && S.vistaE !== "evolucion" ? (() => {
        const lista = S.modo === "cambio" ? avisosDe(ind.id).filter((a) => a.anio > S.desde && a.anio <= anio) : avisosDe(ind.id).filter((a) => a.anio === anio);
        if (!lista.length) return "";
        return `<div class="notas-oficiales"><b>${S.modo === "cambio" ? `Variaciones inusuales entre ${S.desde} y ${anio} que influyen en el crecimiento` : `Variación inusual en ${anio}`}:</b><ul>${lista.map((a) => `<li>${esc(textoAviso(a))}</li>`).join("")}</ul> <a href="#metodo-calidad">Cómo las detectamos</a>.</div>`;
      })() : "") +
      (S.vistaE !== "evolucion" ? `<div class="aviso"><b>Ceuta y Melilla.</b> ${tieneSerie(ind) ? AVISO_GASTO : AVISO_CIUDADES}</div>` : "");
  }

  // ---------- enlace compartible: el estado de la vista Datos va en la dirección ----------
  function guardarEnlace() {
    const q = new URLSearchParams();
    if (S.indP !== "gasto_hab") q.set("dato", S.indP);
    if (S.campoE !== "total") q.set("campo", S.campoE);
    if (S.anioP !== ULT && tieneSerie(IND[S.indP])) q.set("anio", S.anioP);
    if (S.modo !== "valor") q.set("modo", S.modo);
    if (S.modo === "cambio" && S.desde !== ANIOS[0]) q.set("desde", S.desde);
    if (S.vistaE !== "ranking") q.set("grafico", S.vistaE);
    if (!S.real) q.set("inflacion", "no");
    if (S.com !== "AN") q.set("com", S.com.toLowerCase());
    const hash = "#datos" + (q.toString() ? "?" + q.toString() : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  function leerEnlace(qs) {
    const q = new URLSearchParams(qs);
    const dato = q.get("dato"); if (dato && IND[dato] && !dato.includes("@")) S.indP = dato;
    const campo = q.get("campo"); if (campo && /^\w+:\w+$/.test(campo)) S.campoE = campo;
    const anio = +q.get("anio"); if (ANIOS.includes(anio)) S.anioP = anio;
    const modo = q.get("modo"); if (modo === "cambio" || modo === "valor") S.modo = modo;
    const desde = +q.get("desde"); if (ANIOS.includes(desde) && desde < ULT) S.desde = desde;
    const g = q.get("grafico"); if (["ranking", "evolucion", "tabla"].includes(g)) S.vistaE = g;
    if (q.get("inflacion") === "no") S.real = false;
    const com = (q.get("com") || "").toUpperCase(); if (IDS.includes(com)) S.com = com;
  }

  function ranking(cont, vals, ind) {
    const ciu = DATA.ciudades[ind.id] ? Object.keys(CIUDADES).filter((k) => datoCiudad(ind, k) != null) : [];
    const o = ordenados(vals);
    const W = Math.max(320, cont.clientWidth || 800), fila = 26, top = 8, extra = ciu.length ? 30 + ciu.length * fila : 0, H = top + o.length * fila + 26 + extra;
    const lab = W < 520 ? 92 : 140, der = 70;
    const todos = [...o.map((id) => vals[id]), ...ciu.map((k) => datoCiudad(ind, k))];
    const lo = Math.min(0, ...todos), hi = Math.max(0, ...todos);
    const x = (v) => lab + ((v - lo) / (hi - lo || 1)) * (W - lab - der);
    // Barra desde el cero (los cambios pueden ser negativos), con el extremo de datos redondeado.
    const barra = (y, v, rel) => { const a = Math.min(x(0), x(v)), w = Math.abs(x(v) - x(0));
      return `<rect x="${a}" y="${y + 5}" width="${Math.max(w, 1)}" height="${fila - 10}" rx="3" ${rel}/>`; };
    const m = media(vals);
    const fg = css("--fg"), muted = css("--muted"), line = css("--line"), base = css("--grey-line");
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ranking de ${esc(ind.nombre)}">`;
    o.forEach((id, i) => {
      const y = top + i * fila; const c = colorSel(id);
      const destacado = c || i === 0 || i === o.length - 1;
      s += `<g class="barra" data-id="${id}" style="cursor:pointer" tabindex="0" role="button" aria-label="${esc(NOMBRE[id])}: ${esc(fmt(vals[id], ind.unidad))}. ${puestoTxt(ind, i + 1, o.length)}. Pulsa para ${c ? "dejar de destacar" : "destacar"}">
        <rect x="0" y="${y}" width="${W}" height="${fila}" fill="transparent"/>
        <text x="${lab - 8}" y="${y + fila / 2 + 4}" text-anchor="end" font-size="12.5" fill="${c ? fg : muted}" font-weight="${c ? 700 : 400}">${esc(NOMBRE[id])}</text>
        ${barra(y, vals[id], `fill="${c || base}"`)}
        ${destacado ? `<text x="${vals[id] < 0 ? x(0) + 6 : x(vals[id]) + 6}" y="${y + fila / 2 + 4}" font-size="12" fill="${fg}" class="num">${fmt(vals[id], ind.unidad)}</text>` : ""}
      </g>`;
    });
    const xm = x(m), y17 = top + o.length * fila;
    s += `<line x1="${xm}" x2="${xm}" y1="${top - 4}" y2="${y17 + 4}" stroke="${fg}" stroke-dasharray="3 3" stroke-width="1.2"/>
      <text x="${xm}" y="${y17 + 18}" text-anchor="middle" font-size="11.5" fill="${muted}">media de las ${o.length}: ${fmt(m, ind.unidad)}</text>`;
    s += `<line x1="${x(0)}" x2="${x(0)}" y1="${top}" y2="${y17}" stroke="${line}"/>`;
    if (ciu.length) {
      const y0 = y17 + 30;
      s += `<line x1="0" x2="${W}" y1="${y0 - 4}" y2="${y0 - 4}" stroke="${line}"/><text x="0" y="${y0 + 10}" font-size="11" fill="${muted}">Aparte, sin puesto:</text>`;
      ciu.forEach((k, i) => {
        const y = y0 + 14 + i * fila, v = datoCiudad(ind, k);
        s += `<g class="barra-ciu" data-id="${k}"><text x="${lab - 8}" y="${y + fila / 2 + 4}" text-anchor="end" font-size="12.5" fill="${muted}" font-style="italic">${CIUDADES[k]}*</text>
          ${barra(y, v, `fill="none" stroke="${muted}" stroke-dasharray="3 2"`)}
          <text x="${x(v) + 6}" y="${y + fila / 2 + 4}" font-size="12" fill="${fg}" class="num">${fmt(v, ind.unidad)}</text></g>`;
      });
    }
    s += `</svg>`;
    cont.innerHTML = s;
    cont.querySelectorAll(".barra").forEach((g) => {
      const id = g.dataset.id;
      g.onclick = () => { alternarSel(id); render(); };
      g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternarSel(id); render(); } };
      const enPuntos = ["pct", "pp", "var"].includes(ind.unidad);
      const dif = enPuntos ? `${vals[id] >= m ? "+" : "−"}${nf(1).format(Math.abs(vals[id] - m))} puntos frente a la media`
        : `${vals[id] >= m ? "+" : "−"}${nf(0).format(Math.abs(vals[id] / m - 1) * 100)} % frente a la media`;
      g.onmousemove = (e) => showTip(`<b>${esc(NOMBRE[id])}</b><br>${fmt(vals[id], ind.unidad)}<br>${puestoTxt(ind, o.indexOf(id) + 1, o.length)}<br>${dif}`, e.clientX, e.clientY);
      g.onmouseleave = hideTip;
    });
  }

  function tabla(cont, ind, anio) {
    const u = ind.unidad, serie = tieneSerie(ind);
    const vals = valores(ind, anio), o = ordenados(vals), m = media(vals);
    const b0 = base0(), base = serie ? valores(ind, b0) : null;
    const signo = (x, txt) => /^0( |$)/.test(txt) ? `<span class="neg">≈ ${txt}</span>` : `<span class="${x < 0 ? "neg" : ""}">${x >= 0 ? "+" : "−"}${txt}</span>`;
    const difMedia = (v) => u === "pct" ? signo(v - m, nf(1).format(Math.abs(v - m)) + " p.") : signo(v - m, nf(0).format(Math.abs(v / m - 1) * 100) + " %");
    const cambio = (id) => u === "pct" ? signo(vals[id] - base[id], nf(1).format(Math.abs(vals[id] - base[id])) + " p.") : signo(vals[id] - base[id], nf(0).format(Math.abs(vals[id] / base[id] - 1) * 100) + " %");
    const cab = `<tr><th>#</th><th>Comunidad</th>${serie ? `<th>${b0}${sinInfl(ind) ? ` <span style="font-weight:400">(en € de ${ULT})</span>` : ""}</th>` : ""}<th>${serie ? anio : "Valor"}</th>${serie ? `<th>Cambio${sinInfl(ind) ? " real" : ""}</th>` : ""}<th>Frente a la media</th></tr>`;
    const filas = o.map((id, i) => `<tr class="${id === S.com ? "tuya" : ""}"><td>${i + 1}</td><td>${esc(NOMBRE[id])}</td>${serie ? `<td>${fmt(base[id], u)}</td>` : ""}<td>${fmt(vals[id], u)}</td>${serie ? `<td>${cambio(id)}</td>` : ""}<td>${difMedia(vals[id])}</td></tr>`).join("");
    const pie = `<tr><td></td><td>Media de las ${o.length}</td>${serie ? `<td>${fmt(media(base), u)}</td>` : ""}<td>${fmt(m, u)}</td>${serie ? "<td></td>" : ""}<td></td></tr>`;
    const nCol = 4 + (serie ? 2 : 0);
    const ciu = !serie && DATA.ciudades[ind.id] ? Object.keys(CIUDADES).filter((k) => datoCiudad(ind, k) != null) : [];
    const filasC = ciu.length ? `<tr class="sep"><td colspan="${nCol}">Aparte: no cuentan para la media ni los puestos</td></tr>` +
      ciu.map((k) => `<tr class="ciudad"><td>—</td><td>${CIUDADES[k]}*</td><td>${fmt(datoCiudad(ind, k), u)}</td><td>${difMedia(datoCiudad(ind, k))}</td></tr>`).join("") : "";
    cont.innerHTML = `<div class="tabla-wrap"><table class="tabla"><thead>${cab}</thead><tbody>${filas}${pie}${filasC}</tbody></table></div>
      <div class="cta" style="margin-top:14px"><button type="button" class="btn" id="csv">Descargar CSV${serie ? ` (${ANIOS[0]}-${ULT})` : ""}</button></div>`;
    $("#csv").onclick = () => descargarCSV(ind);
  }
  function descargarCSV(ind) {
    const n = (v) => v == null ? "" : String(+v.toFixed(3)).replace(".", ",");
    let filas;
    if (tieneSerie(ind)) {
      const real = enEuros(ind);
      filas = [["indicador", "comunidad", "anio", real ? "valor_euros_corrientes" : "valor", ...(real ? [`valor_euros_${ULT}`] : []), "provisional"]];
      IDS.forEach((id) => ANIOS.forEach((a, i) => filas.push([ind.nombre, NOMBRE[id], a, n((real ? ind.serieNom : ind.serie)[id][i]), ...(real ? [n(ind.serieReal[id][i])] : []), esProv(a) ? "si" : "no"])));
    } else {
      filas = [["indicador", "comunidad", "fecha", "valor", "nota"]];
      IDS.forEach((id) => filas.push([ind.nombre, NOMBRE[id], DATA.corteListas, n(ind.valor[id]), ind.valor[id] == null ? "sin dato en el informe" : ""]));
      Object.keys(CIUDADES).forEach((k) => { const v = datoCiudad(ind, k); if (v != null) filas.push([ind.nombre, CIUDADES[k], DATA.corteListas, n(v), "ciudad autonoma: fuera de la media de las 17"]); });
    }
    const csv = "\ufeff" + filas.map((f) => f.map((c) => /[;"\n]/.test(c) ? `"${String(c).replace(/"/g, '""')}"` : c).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${ind.id.replace(/[^a-z0-9_-]+/gi, "_")}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }

  // Imagen PNG de un gráfico: título, el propio SVG, la leyenda (si la hay) y la fuente.
  function descargarPNG(svgEl, nombre, titulo, leyendaEl, notasPie = []) {
    const vb = svgEl.viewBox.baseVal, W = vb.width, H = vb.height;
    const ancho = Math.max(W, 720), esc2 = Math.min(1, (ancho - 48) / W), w = W * esc2, h = H * esc2;
    const fondo = css("--surface"), fg = css("--fg"), muted = css("--muted");
    // título en una o dos líneas
    const palabras = titulo.split(" "), lineasT = [""];
    palabras.forEach((pa) => { const l = lineasT[lineasT.length - 1]; if ((l + " " + pa).length > ancho / 11 && l) lineasT.push(pa); else lineasT[lineasT.length - 1] = (l ? l + " " : "") + pa; });
    const cab = 24 + lineasT.length * 26 + 10;
    let leg = "", legH = 0;
    if (leyendaEl) {
      // Solo el rango o el nombre de cada tramo (lo que va en negrita), para que no se pisen
      const items = [...leyendaEl.querySelectorAll(".clase")].map((c) => ({ color: c.querySelector("i").style.background, txt: (c.querySelector("b") || c).textContent.replace(/\s+/g, " ").trim() }));
      const anchoItem = (ancho - 48) / Math.max(items.length, 1);
      items.forEach((it, k) => { leg += `<rect x="${24 + k * anchoItem}" y="${cab + h + 12}" width="${anchoItem - 4}" height="10" rx="3" fill="${it.color}"/><text x="${24 + k * anchoItem}" y="${cab + h + 38}" font-size="12" fill="${fg}">${esc(it.txt)}</text>`; });
      legH = items.length ? 48 : 0;
    }
    // Notas (p. ej. las del Ministerio numeradas en la evolución), en líneas de ~ancho del gráfico
    const porLinea = Math.floor((ancho - 48) / 6.6), lineasN = [];
    notasPie.forEach((t) => { let l = ""; t.split(" ").forEach((pa) => { if ((l + " " + pa).length > porLinea && l) { lineasN.push(l); l = pa; } else l = l ? l + " " + pa : pa; }); if (l) lineasN.push(l); });
    const notasH = lineasN.length ? lineasN.length * 16 + 12 : 0;
    const notasSvg = lineasN.map((l, k) => `<text x="24" y="${cab + h + legH + 22 + k * 16}" font-size="11.5" fill="${muted}">${esc(l)}</text>`).join("");
    const total = cab + h + legH + notasH + 40;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${total}" font-family="Inter, Arial, sans-serif">
      <rect width="100%" height="100%" fill="${fondo}"/>
      ${lineasT.map((l, k) => `<text x="24" y="${34 + k * 26}" font-size="20" font-weight="700" fill="${fg}">${esc(l)}</text>`).join("")}
      <svg x="${(ancho - w) / 2}" y="${cab}" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}">${svgEl.innerHTML}</svg>
      ${leg}${notasSvg}
      <text x="24" y="${total - 14}" font-size="12" fill="${muted}">Fuente: Ministerio de Sanidad · sanidad-ccaa.vercel.app</text></svg>`;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = ancho * 2; cv.height = total * 2;
      const cx = cv.getContext("2d"); cx.scale(2, 2); cx.drawImage(img, 0, 0);
      cv.toBlob((blob) => {
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `${nombre.replace(/[^a-z0-9_-]+/gi, "_")}.png`; document.body.appendChild(a); a.click(); a.remove();
      }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function botonPNG(cont, texto, accion) {
    cont.innerHTML = `<button type="button" class="btn sm">${texto}</button>`;
    cont.querySelector("button").onclick = accion;
  }

  // ---------- gasto frente a espera ----------
  // Gasto frente a espera. Solo con «Listas de espera»: compara el gasto por habitante con la espera que
  // esté elegida arriba (tarjeta y especialidad). Con «Gasto», solo una invitación a verlo.
  function renderXY(ind) {
    const gx = IND.gasto_hab;
    if (ind.grupo !== "espera") {
      $("#x-titulo").textContent = "¿Van juntos el gasto y la espera?";
      $("#x-sub").textContent = "Compara el gasto por habitante de cada comunidad con sus listas de espera.";
      $("#x-y").innerHTML = `<button type="button" class="btn sm" id="x-ir">Verlo en Listas de espera</button>`;
      $("#x-y").classList.remove("seg");
      $("#x-ir").onclick = () => { S.indP = "q_dias"; render(); document.querySelector("#v-datos .xy").scrollIntoView({ behavior: "smooth" }); };
      $("#x-chart").innerHTML = ""; $("#x-nota").textContent = "";
      return;
    }
    const gy = ind, nombreY = gy.campoNombre ? `${gy.corto} en ${gy.campoNombre.toLowerCase()}` : gy.corto;
    $("#x-y").innerHTML = ""; $("#x-y").classList.remove("seg");
    const vx = valores(gx, ULT), vy = valores(gy, null);
    const ids = IDS.filter((id) => vx[id] != null && vy[id] != null);
    // Relación descriptiva entre comunidades (no causal). Con tan pocos puntos, solo se habla de relación si la
    // correlación supera el umbral a partir del cual no se puede atribuir fácilmente al azar (95 %).
    const xsR = ids.map((id) => vx[id]), ysR = ids.map((id) => vy[id]);
    const r = pearson(xsR, ysR), rho = spearman(xsR, ysR), rc = correlacionCritica(ids.length);
    const clara = Math.abs(r) > rc && Math.abs(rho) > rc && Math.sign(r) === Math.sign(rho);
    const respuesta = !clara ? "No se aprecia una relación clara" : `Posible relación: las que más gastan tienden a esperar ${r < 0 ? "menos" : "más"}`;
    // Comparaciones múltiples: se pueden mirar muchas combinaciones de espera y especialidad; al 95 %, alrededor
    // del 5 % saldría con «relación» solo por azar. Se avisa siempre que aparezca una.
    const combinaciones = DATA.inds.filter((i) => i.grupo === "espera").reduce((n, i) => n + 1 + familias(i).reduce((m, t) => m + DATA.detalle[t].campos.filter((c) => c.id !== "total").length, 0), 0);
    $("#x-titulo").textContent = `¿Van juntos el gasto y la espera? ${respuesta}`;
    $("#x-sub").textContent = `Cada punto es una comunidad: a la derecha, más gasto por habitante (${ULT}); arriba, ${nombreY.toLowerCase()} (${DATA.corteListas}). Cambia la tarjeta o la especialidad de arriba para comparar otra espera.`;
    const cont = $("#x-chart");
    const W = Math.max(320, cont.clientWidth || 800), H = W < 520 ? 340 : 420;
    const L = W < 520 ? 54 : 64, R = 24, T = 16, B = 40;
    const xs = ids.map((id) => vx[id]), ys = ids.map((id) => vy[id]);
    const px = (Math.max(...xs) - Math.min(...xs)) * 0.08, py = (Math.max(...ys) - Math.min(...ys)) * 0.1;
    const x0 = Math.min(...xs) - px, x1 = Math.max(...xs) + px, y0 = Math.max(0, Math.min(...ys) - py), y1 = Math.max(...ys) + py;
    const X = (v) => L + (v - x0) / (x1 - x0) * (W - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const fg = css("--fg"), muted = css("--muted"), line = css("--line"), grey = css("--grey-line"), acc = css("--accent"), surf = css("--surface");
    const mx = media(Object.fromEntries(ids.map((k) => [k, vx[k]]))), my = media(Object.fromEntries(ids.map((k) => [k, vy[k]])));
    let sv = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto por habitante frente a ${esc(gy.corto)}">`;
    ticks(y0, y1, 4).forEach((v) => { sv += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${line}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="${muted}">${fmtCorto(v, gy.unidad)}</text>`; });
    ticks(x0, x1, W < 520 ? 4 : 5).forEach((v) => { sv += `<text x="${X(v)}" y="${H - B + 18}" text-anchor="middle" font-size="11" fill="${muted}">${fmt(v, "eur_hab")}</text>`; });
    sv += `<line x1="${X(mx)}" x2="${X(mx)}" y1="${T}" y2="${H - B}" stroke="${muted}" stroke-dasharray="3 3"/><line x1="${L}" x2="${W - R}" y1="${Y(my)}" y2="${Y(my)}" stroke="${muted}" stroke-dasharray="3 3"/>`;
    const esq = (txt, xx, yy, anc) => `<text x="${xx}" y="${yy}" text-anchor="${anc}" font-size="11" fill="${muted}" font-style="italic">${txt}</text>`;
    if (W >= 520) sv += esq("gasta menos, espera más", L + 6, T + 12, "start") + esq("gasta más, espera más", W - R - 4, T + 12, "end") +
          esq("gasta menos, espera menos", L + 6, H - B - 8, "start") + esq("gasta más, espera menos", W - R - 4, H - B - 8, "end");
    // Coloca cada etiqueta a la derecha; si choca con otra, prueba izquierda, arriba y abajo.
    const cajas = [];
    const choca = (b) => cajas.some((c) => b.x < c.x + c.w && c.x < b.x + b.w && b.y < c.y + c.h && c.y < b.y + b.h);
    const colocar = (id, w) => {
      const cx = X(vx[id]), cy = Y(vy[id]);
      const opc = [[cx + 8, cy + 4, "start"], [cx - 8, cy + 4, "end"], [cx, cy - 9, "middle"], [cx, cy + 16, "middle"]];
      for (const [tx, ty, an] of opc) {
        const x0b = an === "start" ? tx : an === "end" ? tx - w : tx - w / 2;
        const b = { x: x0b, y: ty - 10, w, h: 12 };
        if (!choca(b) && b.x >= L && b.x + b.w <= W - R + 20) { cajas.push(b); return [tx, ty, an]; }
      }
      return opc[0];
    };
    const c0 = S.com, anchoNom = NOMBRE[c0].length * 7.4, conTuya = ids.includes(c0);
    // El nombre de tu comunidad va a la derecha del punto, o a la izquierda si no cabe.
    const nomDer = conTuya && X(vx[c0]) + 11 + anchoNom <= W - 4;
    if (conTuya) cajas.push({ x: nomDer ? X(vx[c0]) + 11 : X(vx[c0]) - 11 - anchoNom, y: Y(vy[c0]) - 8, w: anchoNom, h: 14 });
    ids.forEach((id) => cajas.push({ x: X(vx[id]) - 5, y: Y(vy[id]) - 5, w: 10, h: 10 }));
    ids.filter((id) => id !== S.com).forEach((id) => {
      const [tx, ty, an] = colocar(id, ABR[id].length * 6.8);
      sv += `<g class="pt" data-id="${id}" style="cursor:pointer" tabindex="0" role="button" aria-label="${esc(NOMBRE[id])}: gasto ${esc(fmt(vx[id], "eur_hab"))}, ${esc(nombreY)} ${esc(fmt(vy[id], gy.unidad))}. Pulsa para elegirla como tu comunidad"><circle cx="${X(vx[id])}" cy="${Y(vy[id])}" r="12" fill="transparent"/><circle cx="${X(vx[id])}" cy="${Y(vy[id])}" r="5.5" fill="${grey}" stroke="${surf}" stroke-width="1.5"/><text x="${tx}" y="${ty}" text-anchor="${an}" font-size="11" fill="${muted}">${ABR[id]}</text></g>`;
    });
    const c = S.com;
    if (conTuya) sv += `<g class="pt" data-id="${c}"><circle cx="${X(vx[c])}" cy="${Y(vy[c])}" r="8" fill="${acc}" stroke="${surf}" stroke-width="2"/><text x="${nomDer ? X(vx[c]) + 11 : X(vx[c]) - 11}" y="${Y(vy[c]) + 4}" text-anchor="${nomDer ? "start" : "end"}" font-size="12.5" font-weight="700" fill="${fg}">${esc(NOMBRE[c])}</text></g>`;
    sv += `<text x="${W - R}" y="${H - 4}" text-anchor="end" font-size="11" fill="${muted}">Gasto por habitante →</text></svg>`;
    cont.innerHTML = sv;
    cont.querySelectorAll(".pt").forEach((g) => {
      const id = g.dataset.id;
      g.onclick = () => { S.com = id; render(); };
      g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); S.com = id; render(); } };
      g.onmousemove = (e) => showTip(`<b>${esc(NOMBRE[id])}</b><br>Gasto: ${fmt(vx[id], "eur_hab")}<br>${esc(nombreY)}: ${fmt(vy[id], gy.unidad)}`, e.clientX, e.clientY);
      g.onmouseleave = hideTip;
    });
    const c2 = (v) => (v < 0 ? "−" : "") + nf(2).format(Math.abs(v));
    $("#x-nota").innerHTML = `<b>Cómo leer este gráfico</b><ul class="leer">
      <li><b>Qué muestra:</b> cada punto es una comunidad; las líneas discontinuas marcan la media de las ${ids.length}. ${conTuya ? "" : `${esc(NOMBRE[c0])} no aparece: el informe no trae ese dato. `}Sin Ceuta y Melilla (no tienen gasto comparable).</li>
      <li><b>Relación:</b> correlación ${c2(r)} (Pearson) y ${c2(rho)} por rangos (Spearman), en una escala de −1 a 1 en la que 0 es ninguna relación. Con ${ids.length} comunidades, cualquier valor entre −${c2(rc)} y +${c2(rc)} podría deberse al azar, así que ${clara ? `esta relación supera ese umbral. <b>Pero ojo:</b> la web permite mirar ${combinaciones} combinaciones de espera y especialidad, y al mirar tantas, unas ${Math.round(combinaciones * 0.05)} saldrían con «relación» solo por azar. Tómalo como una pista para investigar, no como una conclusión` : "no hay base para hablar de relación entre estos dos datos"}.</li>
      <li><b>Ir juntos no es causar:</b> ${clara ? "esta relación no prueba" : "ni aunque hubiera relación probaría"} que gastar más acorte o alargue la espera. Influyen otros factores que el gráfico no tiene en cuenta: la edad de la población, la dispersión geográfica, las derivaciones a centros concertados, el seguro privado, la organización de cada servicio y cómo registra cada comunidad sus listas.</li>
      <li><b>Fechas distintas:</b> el gasto es de ${ULT}${esProv(ULT) ? " (provisional)" : ""} y la espera, la situación a ${DATA.corteListas}.</li>
      <li><b>Comunidades, no personas:</b> compara cifras de comunidades enteras; no dice nada de lo que espera cada paciente.</li>
    </ul><a href="#metodo-comparar">Más en «Cómo leer los datos»</a>`;
  }

  function ticks(min, max, n = 5) {
    const paso0 = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(paso0)));
    const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= paso0);
    const out = []; for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(+v.toFixed(6));
    return out;
  }

  // Años del eje horizontal según el espacio: siempre el primero y el último; en medio, cada 2, 4, 5 o 10 años
  // (el menor salto que deje sitio a cada etiqueta) y sin años intermedios pegados al último.
  function aniosEje(ancho, fuente = 11) {
    const anchoEtiqueta = fuente * 2.6 + 10; // «2024» más un margen
    const porAnio = ancho / (ULT - ANIOS[0]);
    const paso = [2, 4, 5, 10].find((p) => p * porAnio >= anchoEtiqueta) || 10;
    const out = ANIOS.filter((a) => (a - ANIOS[0]) % paso === 0 && (ULT - a) * porAnio >= anchoEtiqueta);
    return [...out, ULT];
  }

  function lineas(cont, ind) {
    const W = Math.max(320, cont.clientWidth || 800), H = W < 520 ? 300 : 380;
    const L = W < 520 ? 56 : 64, R = W < 520 ? 74 : 120, T = 14, B = 30;
    const todos = IDS.flatMap((id) => ind.serie[id]).filter((v) => v != null);
    let ymin = Math.min(...todos), ymax = Math.max(...todos);
    const pad = (ymax - ymin) * 0.06; ymin = Math.max(0, ymin - pad); ymax += pad;
    const tk = ticks(ymin, ymax); ymin = Math.min(ymin, tk[0]); ymax = Math.max(ymax, tk[tk.length - 1]);
    const x = (a) => L + ((a - ANIOS[0]) / (ULT - ANIOS[0])) * (W - L - R);
    const y = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
    const fg = css("--fg"), muted = css("--muted"), line = css("--line"), grey = css("--grey-line"), noteBg = css("--note-bg"), note = css("--note");
    const path = (serie) => serie.map((v, i) => v == null ? "" : `${i === 0 ? "M" : "L"}${x(ANIOS[i]).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const medias = ANIOS.map((a, i) => media(Object.fromEntries(IDS.map((id) => [id, ind.serie[id][i]]))));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de ${esc(ind.nombre)}">`;
    s += `<rect x="${x(DATA.prov[0]) - (x(2023) - x(2022)) / 2}" y="${T}" width="${x(ULT) - x(DATA.prov[0]) + (x(2023) - x(2022)) / 2}" height="${H - T - B}" fill="${noteBg}"/>
          <text x="${x(ULT)}" y="${T + 12}" text-anchor="end" font-size="10.5" fill="${note}">provisional</text>`;
    tk.forEach((v) => { s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${line}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${muted}">${fmtCorto(v, ind.unidad)}</text>`; });
    aniosEje(W - L - R, 11).forEach((a) => { s += `<text x="${x(a)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${muted}">${a}</text>`; });
    IDS.filter((id) => !colorSel(id)).forEach((id) => { s += `<path d="${path(ind.serie[id])}" fill="none" stroke="${grey}" stroke-width="1.2"/>`; });
    s += `<path d="${path(medias)}" fill="none" stroke="${fg}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    // etiquetas finales sin solapar
    const etiquetas = [{ id: "media", txt: "Media", v: medias[medias.length - 1], c: fg }];
    S.sel.forEach((sl) => {
      const c = css(SLOTS[sl.slot]);
      s += `<path d="${path(ind.serie[sl.id])}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`;
      const v = ind.serie[sl.id][ANIOS.length - 1];
      s += `<circle cx="${x(ULT)}" cy="${y(v)}" r="4" fill="${c}" stroke="${css("--surface")}" stroke-width="2"/>`;
      etiquetas.push({ id: sl.id, txt: NOMBRE[sl.id], v, c });
    });
    etiquetas.sort((a, b) => y(a.v) - y(b.v));
    let ult = -Infinity;
    etiquetas.forEach((e) => { const yy = Math.max(y(e.v) + 4, ult + 14); ult = yy;
      s += `<text x="${x(ULT) + 8}" y="${yy}" font-size="12" font-weight="${e.id === "media" ? 400 : 700}" fill="${e.id === "media" ? muted : fg}">${esc(W < 520 ? (ABR[e.id] || e.txt) : e.txt)}</text>`; });
    s += `<line id="cruz" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="${muted}" stroke-width="1" visibility="hidden"/>
          <rect id="zona" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
    // Notas del Ministerio de las comunidades destacadas: un número sobre su línea y la explicación debajo.
    // Notas del Ministerio (círculo continuo) y variaciones inusuales sin explicar (círculo discontinuo)
    // de las comunidades destacadas, numeradas sobre su línea y explicadas debajo.
    const marcas = S.sel.flatMap((sl) => [
      ...notasDe(sl.id).map((n) => ({ ccaa: n.ccaa, anio: n.anio, tipo: "nota", texto: n.texto, c: css(SLOTS[sl.slot]) })),
      ...avisosDe(ind.id, sl.id).map((a) => ({ ccaa: a.ccaa, anio: a.anio, tipo: "aviso", texto: textoAviso(a, false), c: css(SLOTS[sl.slot]) })),
    ]).sort((a, b) => a.ccaa.localeCompare(b.ccaa) || a.anio - b.anio);
    marcas.forEach((n, k) => {
      const v = ind.serie[n.ccaa][n.anio - ANIOS[0]];
      if (v == null) return;
      s += `<g aria-hidden="true"><circle cx="${x(n.anio)}" cy="${y(v)}" r="8" fill="${css("--surface")}" stroke="${n.c}" stroke-width="2" ${n.tipo === "aviso" ? 'stroke-dasharray="2 2"' : ""}/><text x="${x(n.anio)}" y="${y(v) + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="${fg}">${k + 1}</text></g>`;
    });
    s += `</svg>`;
    const otrasNotas = [...new Set(NOTAS.map((n) => n.ccaa))].filter((k) => !S.sel.some((sl) => sl.id === k));
    const otrosAvisos = [...new Set(avisosDe(ind.id).map((a) => a.ccaa))].filter((k) => !S.sel.some((sl) => sl.id === k));
    s += `<div class="notas-oficiales">` + (marcas.length
      ? `<b>Sobre las comunidades destacadas:</b><ol>${marcas.map((n) => `<li><b>${n.tipo === "nota" ? "Nota del Ministerio" : "Variación inusual"} · ${esc(NOMBRE[n.ccaa])}, ${n.anio}.</b> ${esc(n.texto)}</li>`).join("")}</ol>`
      : "") +
      (otrasNotas.length ? `<p>El Ministerio explica saltos en las series de ${otrasNotas.map((k) => esc(NOMBRE[k])).join(", ")}.</p>` : "") +
      (otrosAvisos.length ? `<p>Hay variaciones inusuales sin explicación oficial en este dato en ${otrosAvisos.map((k) => esc(NOMBRE[k])).join(", ")}.</p>` : "") +
      (otrasNotas.length || otrosAvisos.length ? `<p>Destaca una comunidad para verlo en el gráfico. <a href="#metodo-calidad">Cómo los detectamos</a>.</p>` : "") + `</div>`;
    cont.innerHTML = s;
    const svg = cont.querySelector("svg"), cruz = svg.querySelector("#cruz");
    svg.querySelector("#zona").onmousemove = (e) => {
      const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(ANIOS.length - 1, Math.round(((px - L) / (W - L - R)) * (ULT - ANIOS[0]))));
      const a = ANIOS[i];
      cruz.setAttribute("x1", x(a)); cruz.setAttribute("x2", x(a)); cruz.setAttribute("visibility", "visible");
      const filas = S.sel.map((sl) => `<span style="color:${css(SLOTS[sl.slot])}">●</span> ${esc(NOMBRE[sl.id])}: ${fmt(ind.serie[sl.id][i], ind.unidad)}`);
      filas.push(`Media: ${fmt(medias[i], ind.unidad)}`);
      showTip(`<b>${a}${esProv(a) ? " (provisional)" : ""}</b><br>${filas.join("<br>")}`, e.clientX, e.clientY);
    };
    svg.querySelector("#zona").onmouseleave = () => { cruz.setAttribute("visibility", "hidden"); hideTip(); };
  }

  // ---------- TU COMUNIDAD ----------
  function filaInd(ind, id, vs = "", anioSel = ULT) {
    const anio = tieneSerie(ind) ? anioSel : null;
    const vals = valores(ind, anio); const o = ordenados(vals); const v = vals[id]; const m = media(vals);
    const pos = o.indexOf(id) + 1;
    const dif = ind.unidad === "pct" ? `${v >= m ? "+" : "−"}${nf(1).format(Math.abs(v - m))} puntos frente a la media`
      : `${v >= m ? "+" : "−"}${nf(0).format(Math.abs(v / m - 1) * 100)} % frente a la media`;
    // tira de puntos
    const W = 300, H = 34, P = 8;
    const min = Math.min(...o.map((k) => vals[k])), max = Math.max(...o.map((k) => vals[k]));
    const x = (val) => P + ((val - min) / (max - min || 1)) * (W - 2 * P);
    const grey = css("--grey-line"), fg = css("--fg"), acc = css("--accent"), surf = css("--surface"), muted = css("--muted");
    let strip = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><line x1="${P}" x2="${W - P}" y1="17" y2="17" stroke="${css("--line")}" stroke-width="2"/>`;
    o.filter((k) => k !== id).forEach((k) => { strip += `<circle cx="${x(vals[k])}" cy="17" r="4.5" fill="${grey}"><title>${esc(NOMBRE[k])}: ${fmt(vals[k], ind.unidad)}</title></circle>`; });
    strip += `<line x1="${x(m)}" x2="${x(m)}" y1="6" y2="28" stroke="${fg}" stroke-width="1.5"/>`;
    const cvs = css("--s2");
    if (vs && vals[vs] != null) strip += `<circle cx="${x(vals[vs])}" cy="17" r="6" fill="${cvs}" stroke="${surf}" stroke-width="2"><title>${esc(NOMBRE[vs])}: ${fmt(vals[vs], ind.unidad)}</title></circle>`;
    strip += `<circle cx="${x(v)}" cy="17" r="7.5" fill="${acc}" stroke="${surf}" stroke-width="2.5"/>`;
    strip += `<text x="${P}" y="${H}" font-size="9" fill="${muted}">menos</text><text x="${W - P}" y="${H}" font-size="9" fill="${muted}" text-anchor="end">más</text></svg>`;
    // sparkline
    let spark = "";
    if (tieneSerie(ind)) {
      const serie = ind.serie[id]; const sw = 120, sh = 34;
      const otra = vs ? ind.serie[vs] : null;
      const smin = Math.min(...serie, ...(otra || [])), smax = Math.max(...serie, ...(otra || []));
      const sx = (i) => 2 + (i / (serie.length - 1)) * (sw - 8), sy = (val) => 4 + (1 - (val - smin) / (smax - smin || 1)) * (sh - 8);
      const d = serie.map((val, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(val).toFixed(1)}`).join("");
      spark = `<svg viewBox="0 0 ${sw} ${sh}" aria-label="Evolución ${ANIOS[0]}-${ULT}"><path d="${d} L${sx(serie.length - 1)},${sh} L${sx(0)},${sh} Z" fill="${css("--accent-soft")}"/>${otra ? `<path d="${otra.map((val, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(val).toFixed(1)}`).join("")}" fill="none" stroke="${css("--s2")}" stroke-width="1.5"/>` : ""}<path d="${d}" fill="none" stroke="${acc}" stroke-width="1.8"/>${(() => { const k = anioSel - ANIOS[0]; return `<line x1="${sx(k)}" x2="${sx(k)}" y1="2" y2="${sh}" stroke="${muted}" stroke-dasharray="2 2"/><circle cx="${sx(k)}" cy="${sy(serie[k])}" r="3.5" fill="${acc}" stroke="${surf}" stroke-width="1.5"/>`; })()}</svg><div class="pos">${ANIOS[0]}-${ULT}${anioSel !== ULT ? ` · marcado ${anioSel}` : ""}${sinInfl(ind) ? ` · € de ${ULT}` : ""}</div>`;
    } else {
      spark = `<div class="pos">Evolución: con más informes</div>`;
    }
    return `<div class="ind">
      <div><div class="n">${esc(ind.corto)}</div><div class="pos">${puestoTxt(ind, pos, o.length)}</div></div>
      <div><div class="val">${fmt(v, ind.unidad)}</div><div class="delta">${dif}</div>${vs ? `<div class="vs">${esc(NOMBRE[vs])}: ${fmt(vals[vs], ind.unidad)}</div>` : ""}</div>
      <div class="strip">${strip}</div>
      <div class="spark">${spark}</div>
    </div>`;
  }

  function renderComunidad() {
    const id = S.com;
    // La dirección refleja la comunidad elegida, para poder compartir el enlace (sin volver a dibujar).
    const params = new URLSearchParams();
    if (S.vs) params.set("vs", S.vs.toLowerCase());
    if (S.anioC !== ULT) params.set("anio", S.anioC);
    const hash = "#comunidad-" + id.toLowerCase() + (params.toString() ? "?" + params.toString() : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
    $("#c-sel").innerHTML = IDS.slice().sort((a, b) => NOMBRE[a].localeCompare(NOMBRE[b], "es")).map((k) => `<option value="${k}" ${k === id ? "selected" : ""}>${esc(NOMBRE[k])}</option>`).join("");
    $("#c-sel").onchange = (e) => { S.com = e.target.value; render(); };
    tileMap($("#c-mapa"), Object.fromEntries(IDS.map((k) => [k, 1])), IND.gasto_hab, { neutro: true, selIds: [id], onClick: (k) => { S.com = k; render(); } });
    $("#c-nombre").textContent = NOMBRE[id];
    const aC = S.anioC;
    const g = IND.gasto_hab, gv = valores(g, aC), go = ordenados(gv);
    const q = IND.q_dias, qv = valores(q, null), qo = ordenados(qv);
    const gp = go.indexOf(id) + 1, qp = qo.indexOf(id) + 1;
    const gtx = gp === 1 ? "la que más de las 17" : gp === 17 ? "la que menos de las 17" : arriba(gp, 17) ? `la ${gp}.ª que más gasta de 17` : `la ${18 - gp}.ª que menos gasta de 17`;
    const qtx = qp === 1 ? "la espera más larga de las 17" : qp === 17 ? "la espera más corta de las 17" : arriba(qp, 17) ? `la ${qp}.ª espera más larga de 17` : `la ${18 - qp}.ª espera más corta de 17`;
    const enQueEuros = aC !== ULT ? (S.real ? ` (en euros de ${ULT}, descontada la inflación)` : " (en euros de ese año)") : "";
    $("#c-resumen").innerHTML = `En ${aC} gastó <strong>${fmt(gv[id], g.unidad)}</strong> por habitante en sanidad pública${enQueEuros}: ${gtx}. Sus pacientes llevan de media <strong>${fmt(qv[id], q.unidad)}</strong> esperando una operación: ${qtx}.`;
    $("#c-gasto-sub").innerHTML = `<label class="periodo" for="c-anio">Año <select id="c-anio">${ANIOS.slice().reverse().map((a) => `<option value="${a}" ${a === aC ? "selected" : ""}>${a}${esProv(a) ? " (provisional)" : ""}</option>`).join("")}</select></label>
      <span class="seg sm" role="group" aria-label="Inflación"><button type="button" data-r="1" aria-pressed="${S.real}">Descontando la inflación</button><button type="button" data-r="0" aria-pressed="${!S.real}">Sin descontar</button></span>
      <span class="sub-ficha">${S.real ? `Los euros de cada año están en euros de ${ULT}.` : "Cada año, en los euros de entonces."} Cada punto gris es otra comunidad; la raya marca la media de las 17. La línea de la derecha es la evolución desde ${ANIOS[0]}, con el año elegido marcado.</span>`;
    $("#c-anio").onchange = (e) => { S.anioC = +e.target.value; render(); };
    $("#c-gasto-sub").querySelectorAll("button[data-r]").forEach((b) => b.onclick = () => { S.real = b.dataset.r === "1"; render(); });
    if (S.vs === id) S.vs = "";
    $("#c-vs").innerHTML = `<option value="">Nadie</option>` + IDS.filter((k) => k !== id).sort((a, b) => NOMBRE[a].localeCompare(NOMBRE[b], "es")).map((k) => `<option value="${k}" ${k === S.vs ? "selected" : ""}>${esc(NOMBRE[k])}</option>`).join("");
    $("#c-vs").onchange = (e) => { S.vs = e.target.value; render(); };
    $("#c-leyenda-vs").innerHTML = S.vs ? `<span><i style="background:${css("--accent")}"></i>${esc(NOMBRE[id])}</span><span><i style="background:${css("--s2")}"></i>${esc(NOMBRE[S.vs])}</span>` : "";
    $("#c-gasto").innerHTML = DATA.inds.filter((i) => i.grupo === "gasto").map((i) => filaInd(i, id, S.vs, aC)).join("");
    const nts = notasDe(id), avs = AVISOS.filter((a) => a.ccaa === id);
    $("#c-notas").innerHTML = (nts.length ? `<b>Notas del Ministerio sobre la serie de gasto de ${esc(NOMBRE[id])}:</b><ul>${nts.map((n) => `<li><b>${n.anio}.</b> ${esc(n.texto)}</li>`).join("")}</ul>` : "") +
      (avs.length ? `<b>Variaciones inusuales sin explicación oficial:</b><ul>${avs.map((a) => `<li><b>${esc(IND[a.indicador].corto)}, ${a.anio}.</b> ${esc(textoAviso(a, false))}</li>`).join("")}</ul><a href="#metodo-calidad">Cómo las detectamos</a>` : "");
    $("#c-espera-sub").textContent = `Situación a ${DATA.corteListas}. Un valor más alto significa más espera.`;
    $("#c-espera").innerHTML = DATA.inds.filter((i) => i.grupo === "espera").map((i) => filaInd(i, id, S.vs)).join("");
    const esp = Object.entries(DATA.especQuir).map(([n, o]) => [n, o[id]]).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    $("#c-extra").innerHTML = `Especialidad quirúrgica con más espera en ${esc(NOMBRE[id])}: <strong>${esc(esp[0][0])}</strong> (${fmt(esp[0][1], "dias")} de media). Con menos: <strong>${esc(esp[esp.length - 1][0])}</strong> (${fmt(esp[esp.length - 1][1], "dias")}).`;
  }


  // ---------- CÓMO LEER LOS DATOS ----------
  function renderMetodo() {
    if ($("#m-cuerpo").dataset.listo) return; // contenido fijo: se pinta una vez
    const lista = (grupo) => DATA.inds.filter((i) => i.grupo === grupo).map((i) => `<dt>${esc(i.nombre)}</dt><dd>${esc(i.desc)}</dd>`).join("");
    const subida = nf(0).format((IPC[ULT] / IPC[ANIOS[0]] - 1) * 100);
    const CRIT_TXT = "10 puntos de crecimiento en los datos en euros, o 3 puntos en los porcentajes";
    $("#m-cuerpo").innerHTML = `
      <h1>Cómo leer los datos</h1>
      <p>Todo lo que ves sale de estadísticas oficiales. Aquí explicamos qué mide cada dato, de dónde sale y qué hay que tener en cuenta para no sacar conclusiones equivocadas.</p>
      <nav class="indice" aria-label="Apartados"><a href="#metodo-gasto">Gasto</a><a href="#metodo-espera">Listas de espera</a><a href="#metodo-inflacion">Inflación</a><a href="#metodo-comparar">Comparar comunidades</a><a href="#metodo-notas">Notas del Ministerio</a><a href="#metodo-calidad">Avisos de calidad</a><a href="#metodo-limites">Lo que no dicen estos datos</a></nav>

      <h2 id="metodo-gasto">Gasto sanitario público</h2>
      <p>Fuente: Ministerio de Sanidad, Estadística de Gasto Sanitario Público (EGSP), de ${ANIOS[0]} a ${ULT}. Es <b>gasto real liquidado</b>, es decir, lo que de verdad se gastó, no lo que se presupuestó. Por eso puede no coincidir con noticias que usan los presupuestos iniciales.</p>
      <p>Es el gasto <b>consolidado</b> de cada comunidad (sin contar dos veces el dinero que se pasan entre administraciones). Los datos de ${DATA.prov.join(" y ")} son <b>provisionales</b> y pueden cambiar en la próxima edición.</p>
      <dl>${lista("gasto")}</dl>

      <h2 id="metodo-espera">Listas de espera</h2>
      <p>Fuente: Ministerio de Sanidad, Sistema de Información sobre Listas de Espera del SNS (SISLE-SNS), situación a ${DATA.corteListas}. Es una foto de un día concreto: cuántas personas esperan y cuánto llevan esperando, no cuánto tardaron las que ya fueron atendidas.</p>
      <dl>${lista("espera")}</dl>
      <p>Las listas de espera se pueden ver también por <b>especialidad</b> (Traumatología, Oftalmología…) y por <b>proceso</b> (cataratas, prótesis de cadera…). Si una comunidad no aparece en una especialidad es porque el informe no trae ese dato; se muestra en gris y no cuenta para la media.</p>

      <h2 id="metodo-inflacion">Descontar la inflación</h2>
      <p>Un euro de ${ANIOS[0]} no compra lo mismo que uno de ${ULT}: los precios han subido un ${subida} % (IPC general nacional del INE, media anual). Con «Descontando la inflación», cada año se expresa en euros de ${ULT}, así que el crecimiento que ves es real. Solo afecta a los datos en euros; los porcentajes no cambian, porque suben a la vez el gasto y aquello con lo que se compara.</p>
      <p>Usamos el IPC nacional para todas las comunidades, como es habitual al comparar gasto público entre regiones. El IPC de cada comunidad mide cómo cambian los precios de la cesta de los hogares, no los costes sanitarios, y no permite comparar niveles de precios entre comunidades.</p>

      <h2 id="metodo-comparar">Comparar comunidades</h2>
      <ul>
        <li><b>Medias simples:</b> cada comunidad cuenta igual, sea grande o pequeña.</li>
        <li><b>Colores del mapa:</b> en gasto, cinco tramos de 3 o 4 comunidades cada uno, de menos a más. En listas de espera, el color dice si la comunidad está por encima (rojo) o por debajo (azul) de la media, en gris si está cerca.</li>
        <li><b>Ceuta y Melilla</b> aparecen aparte en listas de espera: su sanidad la gestiona el Ministerio (INGESA) y su población es muy pequeña. No cuentan para medias, puestos ni colores. En gasto no aparecen, porque el Excel solo recoge la parte del INGESA.</li>
        <li><b>Gasto frente a espera:</b> el gráfico describe si las comunidades que más gastan esperan más o menos; no mide causas. Damos dos correlaciones (Pearson y por rangos, Spearman) y solo hablamos de relación si ambas superan el umbral a partir del cual no se pueden atribuir fácilmente al azar (con 17 comunidades, ±0,48). Como se pueden mirar muchas combinaciones de espera y especialidad, alrededor del 5 % superará ese umbral solo por azar: por eso, cuando aparece, la llamamos «posible relación». Aunque la haya, no prueba que una cosa cause la otra: influyen la edad, la dispersión, las derivaciones a la concertada, el seguro privado, la organización de cada servicio y cómo se registran las listas. Además, compara comunidades, no personas, y el gasto (${ULT}) y la espera (${DATA.corteListas}) no son del mismo momento.</li>
      </ul>

      <h2 id="metodo-notas">Notas del Ministerio</h2>
      <p>El Ministerio explica algunos saltos en las series de gasto de cada comunidad. Aparecen también en el gráfico de evolución (al destacar la comunidad) y en su ficha.</p>
      <ul>${NOTAS.slice().sort((a, b) => NOMBRE[a.ccaa].localeCompare(NOMBRE[b.ccaa], "es") || a.anio - b.anio).map((n) => `<li><b>${esc(NOMBRE[n.ccaa])}, ${n.anio}.</b> ${esc(n.texto)}</li>`).join("")}</ul>

      <h2 id="metodo-calidad">Avisos de calidad: cómo revisamos los datos</h2>
      <p>Además de las notas del Ministerio, revisamos los datos de forma automática cada vez que se actualiza la web:</p>
      <ul>
        <li><b>Que se han leído bien.</b> Al extraer el Excel comprobamos que los porcentajes cuadran con los importes y que la población implícita (gasto total entre gasto por habitante) cambia con suavidad cada año. Al extraer el PDF de listas de espera comprobamos que los totales cuadran con la suma de especialidades y que pacientes y tasas son coherentes.</li>
        <li><b>Que son coherentes.</b> No faltan comunidades ni años, los porcentajes están entre 0 y 100 y la farmacia nunca supera al gasto total.</li>
        <li><b>Variaciones inusuales.</b> Para cada dato y año comparamos el cambio de cada comunidad con el de las demás. Si se aleja mucho de lo normal ese año (más de 4 veces la dispersión típica y más de ${CRIT_TXT}), lo señalamos. Si el Ministerio tiene una nota para ese año, mostramos la nota; si no, avisamos de que la cifra es la oficial pero no tiene explicación publicada.</li>
      </ul>
      <p>Estas son las variaciones inusuales que el Ministerio no explica (${AVISOS.length}). No significan que el dato esté mal: puede deberse a cambios contables, a pagos extraordinarios o a otras causas que la estadística no detalla.</p>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Comunidad</th><th>Dato</th><th>Año</th><th>Cambio</th><th>Mediana del año</th></tr></thead><tbody>
        ${AVISOS.map((a) => `<tr><td>${esc(NOMBRE[a.ccaa])}</td><td>${esc(IND[a.indicador].corto)}</td><td>${a.anio}</td><td>${firmado(a.cambio, a.unidad === "%" ? 0 : 1)}${a.unidad === "%" ? " %" : " p."}</td><td>${firmado(a.mediana, a.unidad === "%" ? 0 : 1)}${a.unidad === "%" ? " %" : " p."}</td></tr>`).join("")}
      </tbody></table></div>
      <p>Listas de espera: usamos ${DATA.versionListas ? `el fichero <b>${esc(DATA.versionListas.fichero)}</b>${DATA.versionListas.rectificado ? ", la <b>versión rectificada</b> que publicó el Ministerio" : ""}${DATA.versionListas.fecha_pdf ? ` (fecha del documento: ${DATA.versionListas.fecha_pdf.split("-").reverse().join("/")})` : ""}` : "el último informe publicado"}. Si comparas con otra versión del mismo informe, las cifras pueden no coincidir.${DATA.notasListas.length ? ` Notas del informe: ${DATA.notasListas.map((t) => esc(t)).join(" ")}` : ""}</p>

      <h2 id="metodo-limites">Lo que no dicen estos datos</h2>
      <ul>
        <li><b>La edad de la población:</b> las comunidades más envejecidas necesitan gastar más por habitante. El gasto que mostramos no está ajustado por edad.</li>
        <li><b>La calidad:</b> gastar más o menos, o esperar más o menos, no mide por sí solo si la atención es mejor o peor.</li>
        <li><b>La sanidad privada y las mutualidades</b> (MUFACE, ISFAS, MUGEJU) no están en el gasto público de las comunidades.</li>
        <li><b>La atención primaria:</b> el SISLE no mide cuánto se tarda en conseguir cita con el médico de familia.</li>
      </ul>
      <p>¿Has visto un error? Puedes comprobar cada cifra en las fuentes enlazadas al pie, descargar los datos en CSV desde la tabla o revisar el código en GitHub.</p>`;
    $("#m-cuerpo").dataset.listo = "1";
    // los enlaces del índice no deben cambiar de vista: desplazan dentro de la sección
    $("#m-cuerpo").querySelectorAll(".indice a").forEach((a) => a.onclick = (e) => { e.preventDefault(); document.getElementById(a.getAttribute("href").slice(1)).scrollIntoView({ behavior: "smooth" }); });
  }

  // ---------- navegación ----------
  // Tras redibujar, el foco vuelve al mismo control (si no, quien usa el teclado pierde su sitio).
  function selectorFoco() {
    const f = document.activeElement;
    if (!f || f === document.body) return null;
    if (f.id) return "#" + f.id;
    const caja = f.closest("[id]"); if (!caja) return null;
    for (const a of ["id", "v", "g", "m", "r"]) if (f.dataset[a]) return `#${caja.id} [data-${a}="${f.dataset[a]}"]`;
    return null;
  }
  let anunciado = "";
  function render() {
    const foco = selectorFoco();
    renderVista();
    if (foco) { const e = document.querySelector(foco); if (e && e !== document.activeElement) e.focus({ preventScroll: true }); }
    // Aviso para lectores de pantalla: qué se está mostrando ahora
    const t = S.vista === "datos" ? $("#p-titulo").textContent : S.vista === "comunidad" ? `Ficha de ${NOMBRE[S.com]}` : "Cómo leer los datos";
    if (t !== anunciado) { anunciado = t; $("#anuncio").textContent = t; }
  }
  function renderVista() {
    hideTip();
    document.querySelectorAll(".nav a").forEach((a) => a.toggleAttribute("aria-current", false));
    const act = document.querySelector(`.nav a[data-vista="${S.vista}"]`); if (act) act.setAttribute("aria-current", "page");
    ["datos", "comunidad", "metodo"].forEach((v) => { $("#v-" + v).hidden = v !== S.vista; });
    if (S.vista === "datos") renderDatos();
    if (S.vista === "comunidad") renderComunidad();
    if (S.vista === "metodo") renderMetodo();
  }
  function leerHash() {
    const [h, qs] = location.hash.replace("#", "").split("?");
    const m = h.match(/^comunidad-([a-z]{2})$/);
    if (m && IDS.includes(m[1].toUpperCase())) {
      S.com = m[1].toUpperCase(); S.vista = "comunidad";
      const qq = new URLSearchParams(qs || "");
      const vs = (qq.get("vs") || "").toUpperCase(); S.vs = IDS.includes(vs) ? vs : "";
      const an = +qq.get("anio"); S.anioC = ANIOS.includes(an) ? an : ULT;
    }
    else if (h === "comunidad") S.vista = "comunidad";
    else if (h === "metodo") S.vista = "metodo";
    else if (h.startsWith("metodo-")) { S.vista = "metodo"; render(); const e = document.getElementById(h); if (e) e.scrollIntoView(); return; }
    else { S.vista = "datos"; if (qs) leerEnlace(qs); } // #portada y #explorar (enlaces antiguos) llevan aquí
    pararPlay(); if ($("#ajustes").open) $("#ajustes").close(); render(); window.scrollTo(0, 0);
  }
  // Fechas de los textos fijos, sacadas de los datos (así no se quedan viejas al actualizar).
  $("#p-intro").textContent = `Datos oficiales del Ministerio de Sanidad: gasto de ${ANIOS[0]} a ${ULT} y listas de espera a ${DATA.corteListas}.`;
  $("#f-gasto").textContent = `gasto real ${ANIOS[0]}-${ULT}` + (DATA.prov.length ? `; ${DATA.prov.join(" y ")} provisionales` : "");
  $("#f-listas").textContent = `a ${DATA.corteListas}` + (DATA.versionListas && DATA.versionListas.rectificado ? `, versión rectificada${DATA.versionListas.fecha_pdf ? " del " + DATA.versionListas.fecha_pdf.split("-").reverse().join("/") : ""}` : "");
  addEventListener("hashchange", leerHash);
  let rz, anchoPrevio = innerWidth;
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (innerWidth !== anchoPrevio) { anchoPrevio = innerWidth; render(); } }, 150); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  leerHash();
}
