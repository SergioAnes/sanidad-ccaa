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
  // Gasto por habitante ajustado por edad: variante de gasto_hab con sus propios años (desde 2013).
  const EDAD = DATA.edad;
  if (EDAD) IND[EDAD.id] = EDAD;
  // Euros constantes: valor × IPC(último año) / IPC(año). IPC = media anual del índice general del INE.
  const IPC = DATA.ipc;
  const enEuros = (ind) => ind.unidad === "eur_hab";
  for (const ind of [...DATA.inds, ...(EDAD ? [EDAD] : [])]) if (enEuros(ind) && ind.serie) {
    const nom = ind.serie, anios = ind.anios || ANIOS;
    const real = Object.fromEntries(Object.entries(nom).map(([id, sr]) => [id, sr.map((v, i) => v == null ? null : v * IPC[ULT] / IPC[anios[i]])]));
    ind.serieNom = nom; ind.serieReal = real;
    Object.defineProperty(ind, "serie", { get: () => (S.real ? real : nom) });
  }
  const sinInfl = (ind) => enEuros(ind) && S.real;

  const nf = (d) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
  function fmt(v, u) {
    if (v == null || !isFinite(v)) return "—";
    if (u === "eur_hab") return nf(0).format(v) + " €";
    if (u === "pct") return nf(1).format(v) + " %";
    // Sin «‰»: mucha gente lo confunde con «%». El título y la leyenda ya dicen «por 1.000 habitantes».
    if (u === "por_mil") return nf(1).format(v);
    if (u === "dias") return nf(0).format(v) + " días";
    if (u === "num") return nf(0).format(v);
    if (u === "nota10") return nf(2).format(v);
    if (u === "dias_media") return nf(1).format(v) + " días";
    if (u === "personas") return nf(0).format(v);
    if (u === "camas_mil") return nf(2).format(v);
    if (u === "por_mil_hab") return nf(1).format(v);
    if (u === "sesiones_mil") return nf(0).format(v);
    if (u === "equipos_100k") return nf(2).format(v);
    if (u === "var" || u === "pp") {
      const d = u === "pp" ? 1 : 0;
      const signo = v === 0 ? "" : Math.abs(v) < (u === "pp" ? 0.05 : 0.5) ? "≈ " : v > 0 ? "+" : "−";
      return signo + nf(d).format(Math.abs(v)) + (u === "pp" ? " p." : " %");
    }
    return nf(1).format(v);
  }
  const fmtCorto = (v, u) => u === "dias" ? nf(0).format(v) + " d" : u === "dias_media" ? nf(Number.isInteger(v) ? 0 : 1).format(v) + " d" : fmt(v, u).replace(" %", "%");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CORTES = DATA.cortes;
  const PERIODOS_ESPERA = CORTES.map((_, i) => i);
  const ULT_CORTE = PERIODOS_ESPERA.at(-1);
  // Barómetro (grupo «opinion»): los periodos son índices de sus años, como los cortes de las listas de espera.
  const periodos = (ind) => ind.grupo === "opinion" ? ind.fechas.map((_, i) => i) : ind.anios || (ind.grupo === "espera" ? PERIODOS_ESPERA : ANIOS);
  // Temas «Atención primaria» y «Hospitales» (antes «Recursos»): misma lógica, con sus años y su referencia España.
  const esRecurso = (ind) => ind.grupo === "primaria" || ind.grupo === "hospitales";
  const primero = (ind) => periodos(ind)[0];
  const ultimo = (ind) => periodos(ind).at(-1);
  const tieneSerie = (ind) => periodos(ind).length > 1;
  // «Comparar años» no se ofrece en el Barómetro: con sus márgenes, la mayoría de cambios no se distinguen del azar.
  const permiteCambio = (ind) => tieneSerie(ind) && ind.grupo !== "opinion";
  const periodo = (ind, a, corto = false) => {
    if (ind.grupo === "gasto" || esRecurso(ind)) return String(a);
    if (ind.grupo === "opinion") return String(ind.fechas[a]);
    const [anio, mes] = CORTES[a].id.split("-");
    // En minúscula y con «de», como se escribe en español en mitad de una frase: «diciembre de 2025».
    return mes === "06" ? (corto ? `jun. ${anio}` : `junio de ${anio}`) : (corto ? `dic. ${anio}` : `diciembre de ${anio}`);
  };
  // Indicador que se está viendo: el elegido, o su versión ajustada por edad si está activada.
  const conEdad = () => S.edad && S.indP === "gasto_hab" && !!EDAD;
  const periodoActual = () => conEdad() ? EDAD : IND[S.indP];
  const indice = (ind, a) => periodos(ind).indexOf(a ?? ultimo(ind));
  const dato = (ind, id, a) => ind.serie[id]?.[indice(ind, a)] ?? null;
  function motivoComparacion(ind, desde, hasta, medida = ind.medida) {
    if (ind.tipo !== "consultas") return "";
    const a = CORTES[desde].id, b = CORTES[hasta].id;
    if (a === "2023-06" || b === "2023-06") return "El informe de consultas de junio de 2023 repite cifras de diciembre de 2022.";
    if (medida === "pct_largo" && (a < "2024-12") !== (b < "2024-12")) {
      return "En diciembre de 2024 cambió la definición del porcentaje de consultas de más de 60 días.";
    }
    return "";
  }
  const comparar = (ind, desde, hasta) => !motivoComparacion(ind, desde, hasta);
  const diferencia = (ind, a, b) => a == null || b == null || (ind.unidad !== "pct" && a === 0)
    ? null : ind.unidad === "pct" ? b - a : (b / a - 1) * 100;
  function valores(ind, anio) {
    const out = {};
    for (const id of IDS) out[id] = dato(ind, id, anio);
    return out;
  }
  const media = (o) => { const v = Object.values(o).filter((x) => x != null); return v.reduce((a, b) => a + b, 0) / v.length; };
  function ordenados(o) { return IDS.filter((id) => o[id] != null).sort((a, b) => o[b] - o[a]); }
  // Años provisionales: solo los del gasto (la EGSP). Sin indicador, se mira el que se está viendo.
  const esProv = (anio, ind = IND[S.indP]) => (!ind || ind.grupo === "gasto") && DATA.prov.includes(anio);
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
  const palDe = (ind, pal = PAL) => pal === "auto" ? (ind.grupo === "opinion" ? "ic" : ind.grupo === "espera" ? "media" : "tramos") : pal;

  function textoSobre(hex) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return (1.05 / (L + 0.05)) >= ((L + 0.05) / (0.0144 + 0.05)) ? "#ffffff" : "#142033";
  }
  const UNI = { eur_hab: "euros por habitante", pct: "%", por_mil: "pacientes por cada 1.000 habitantes", dias: "días", dias_media: "días", nota10: "puntos (de 1 a 10)", personas: "personas por profesional", camas_mil: "camas por 1.000 habitantes", por_mil_hab: "por 1.000 habitantes", sesiones_mil: "sesiones por 1.000 habitantes", equipos_100k: "equipos por 100.000 habitantes", var: "% de crecimiento", pp: "puntos de cambio" };
  const soloNum = (v, u) => u === "var" || u === "pp" ? fmt(v, u).replace(/ (%|p\.)$/, "") : nf(u === "eur_hab" || u === "dias" ? 0 : 1).format(v);
  // Devuelve el color de cada comunidad y la leyenda, según la paleta.
  function escala(vals, ind, pal0 = PAL) {
    const u = ind.unidad; const pal = palDe(ind, pal0);
    const o = ordenados(vals); const vs = o.map((id) => vals[id]);
    const min = Math.min(...vs), max = Math.max(...vs), m = media(vals);
    const sd = Math.sqrt(vs.reduce((a, v) => a + (v - m) ** 2, 0) / vs.length) || 1;
    const caja = (bg) => ({ bg, fg: textoSobre(bg) });
    const clases = (cols, etiquetas, pie) => `<div class="clases">${cols.map((c, k) => `<span class="clase"><i style="background:${c}"></i>${etiquetas[k]}</span>`).join("")}</div><span class="pie">${pie}</span>`;
    if (pal === "ic") {
      // Barómetro: tres grupos según el margen de error frente a España (no un orden del 1 al 17).
      const a = S.anioP, ref = ind.espana[a];
      const grupos = [1, 0, -1].filter((c) => o.some((id) => claseOpinion(ind, id, a) === c));
      const et = grupos.map((c) => `<b>${textoClase(ind, c).replace(" de la media de España", "").replace(" que la media de España", "")}</b>(${o.filter((id) => claseOpinion(ind, id, a) === c).length})`);
      return { color: (id) => caja(colorClase(ind, claseOpinion(ind, id, a))), colorV: () => caja(colorClase(ind, 0)),
        leyenda: clases(grupos.map((c) => colorClase(ind, c)), et, `Frente a la media de España (${fmt(ref, u)}), teniendo en cuenta el margen de error de la encuesta.`) };
    }
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
    if (!o.length) return { leyenda: `<span>Sin valores para las comunidades autónomas.</span>` };
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
    left = Math.max(8, Math.min(left, innerWidth - r.width - 8)); // en pantallas estrechas, que no se salga
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
    edad: false, // gasto por habitante ajustado por edad (solo en «Gasto por habitante»)
    yXY: "q_dias",
    campoE: "total", // especialidad o proceso en el Explorador: "total" o "tipo:campo"
    vs: "", // comunidad con la que comparar en la ficha
    corteC: ULT_CORTE,
    anioC: ULT, // año del gasto que se muestra en la ficha
    abiertos: {}, // desplegables de explicaciones abiertos (por clave)
  };
  const NOTAS = DATA.notas; // notas del Ministerio sobre saltos en las series de gasto
  const notasDe = (id) => NOTAS.filter((n) => n.ccaa === id).sort((a, b) => a.anio - b.anio);
  // Variaciones inusuales sin explicación oficial (detectadas en src/lib/avisos.ts)
  const AVISOS = DATA.avisos.filter((a) => !a.explicado);
  const avisosDe = (indId, ccaa) => AVISOS.filter((a) => a.indicador === indId && (!ccaa || a.ccaa === ccaa));
  const firmado = (x, d) => (x > 0 ? "+" : x < 0 ? "−" : "") + nf(d).format(Math.abs(x));
  function textoAviso(a, conNombre = true) {
    const u = a.unidad === "%" ? " %" : " puntos", d = a.unidad === "%" ? 0 : 1;
    return `${conNombre ? `${NOMBRE[a.ccaa]}, ${a.anio}: ` : ""}${firmado(a.cambio, d)}${u} respecto a ${a.anio - 1}${a.unidad === "%" ? " (en euros de cada año)" : ""}, cuando la mediana de las comunidades fue ${firmado(a.mediana, d)}${u}. Es la cifra oficial, pero el Ministerio no explica el motivo.` +
      (entidadesDe(a.ccaa).some((e) => e.anio === a.anio) ? " Ese año también cambió la lista de entidades que cuenta la estadística." : "");
  }

  // Explicaciones plegadas: los datos primero; el texto, para quien lo quiera. Cada desplegable recuerda si
  // estaba abierto al volver a dibujar la vista (S.abiertos[clave]).
  function plegable(clave, resumen, cuerpo) {
    return `<details class="pliegue" data-p="${clave}" ${S.abiertos[clave] ? "open" : ""}><summary>${resumen}</summary><div class="pliegue-c">${cuerpo}</div></details>`;
  }
  document.addEventListener("toggle", (e) => { const d = e.target; if (d.matches && d.matches("details[data-p]")) S.abiertos[d.dataset.p] = d.open; }, true);

  // ---------- gasto ajustado por edad: explicación ----------
  const URL_LEY = "https://www.boe.es/buscar/act.php?id=BOE-A-2009-20375";
  const URL_LIQ = "https://www.hacienda.gob.es/es-ES/CDI/Paginas/SistemasFinanciacionDeuda/InformacionCCAAs/Informes%20financiacion%20comunidades%20autonomas2.aspx";
  const URL_INF = "https://www.hacienda.gob.es/GabineteMinistro/varios/03-12-21-informe-poblacion-ajustada.pdf";
  const tramosEdad = () => Object.entries(EDAD.coeficientes).map(([t, c]) => `${t.replace("75+", "75 y más")} años: ${nf(3).format(c)}`).join("; ");
  function textoEdadCorto() {
    return `<p>Dividimos el gasto de cada comunidad entre su <b>población protegida equivalente</b>: las personas con tarjeta sanitaria de su servicio de salud, ponderadas por edad con los pesos de la <a href="${URL_LEY}">Ley 22/2009</a> (art. 9). Una persona de 75 años o más cuenta como 2,759; una de 15 a 44, como 0,547. El Ministerio de Sanidad la certifica cada año para repartir la financiación autonómica.</p>
      <p>Después se reescala para que el conjunto de las 17 quede igual: una comunidad con la estructura de edad media no cambia, una más envejecida baja y una más joven sube.</p>
      <p>Es un cálculo nuestro con datos oficiales, desde ${EDAD.anios[0]}. <a href="#metodo-edad">Método completo y límites</a>.</p>`;
  }

  // ---------- entidades que cuenta la estadística (src/data/perimetro-egsp.json) ----------
  // Solo hechos: qué entidades aparecen o dejan de aparecer en la lista del Ministerio, cuánto pesaban y cuándo.
  // La fuente no dice por qué; no lo interpretamos.
  const ENTIDADES = DATA.entidades;
  const UMBRAL_ENT = DATA.umbralEntidades;
  const entidadesDe = (id) => ENTIDADES.filter((e) => e.ccaa === id);
  const millones = (x) => `${nf(x >= 10 ? 0 : 1).format(x)} M€`;
  const pctTxt = (x) => `${nf(1).format(x)} %`;
  const AVISO_ENTIDADES = "La estadística no explica el motivo: puede ser una entidad nueva, una reorganización entre organismos públicos o una entidad que antes no se clasificaba como pública. No siempre mueve las cifras.";
  // Marcas del gráfico de evolución: misma forma en el SVG, en la leyenda y en el recuadro.
  const TIPO_MARCA = { nota: "Nota del Ministerio", aviso: "Variación inusual", entidades: "Cambio en las entidades" };
  const LEYENDA_MARCA = { nota: "nota del Ministerio", aviso: "variación inusual", entidades: "cambio en las entidades" };
  function formaMarca(tipo, cx, cy, color, relleno) {
    return tipo === "entidades"
      ? `<rect x="${cx - 4.5}" y="${cy - 4.5}" width="9" height="9" rx="1.5" fill="${relleno}" stroke="${color}" stroke-width="2"/>`
      : `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${relleno}" stroke="${color}" stroke-width="2" ${tipo === "aviso" ? 'stroke-dasharray="2 1.6"' : ""}/>`;
  }
  const iconoMarca = (tipo, color) => `<svg class="marca-ico" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">${formaMarca(tipo, 7, 7, color || css("--fg"), css("--surface"))}</svg>`;
  function textoEntidades(e, conNombre = true) {
    const grandes = e.entidades.filter((x) => x.peso >= 0.5), resto = e.entidades.filter((x) => x.peso < 0.5);
    const lista = grandes.map((x) => `${x.nombre} (${millones(x.millones)}, ${pctTxt(x.peso)})`);
    const pesoResto = pctTxt(resto.reduce((s, x) => s + x.peso, 0));
    if (resto.length && grandes.length) lista.push(`${resto.length === 1 ? "otra" : `otras ${resto.length}`} más pequeña${resto.length === 1 ? "" : "s"} (${pesoResto} en total)`);
    else if (resto.length) lista.push(`${resto.length} entidades que no llegan al 0,5 % cada una`);
    const juntas = lista.length > 1 ? `${lista.slice(0, -1).join("; ")} y ${lista[lista.length - 1]}` : lista[0];
    const n = e.entidades.length;
    const que = e.cambio === "entra"
      ? `${n === 1 ? "Aparece" : "Aparecen"} en la lista`
      : `${n === 1 ? "Deja" : "Dejan"} de aparecer en la lista`;
    const peso = e.cambio === "entra" ? `${pctTxt(e.peso)} del gasto de ese año` : `${pctTxt(e.peso)} del gasto en ${e.anio - 1}, su último año en la lista`;
    const nota = NOTAS.some((x) => x.ccaa === e.ccaa && x.anio === e.anio) ? " Ver también la nota del Ministerio de ese año." : "";
    return `${conNombre ? `${NOMBRE[e.ccaa]}, ${e.anio}: ` : ""}${que}: ${juntas}.${n > 1 ? ` En conjunto, ${peso}.` : e.cambio === "sale" ? ` Importe y peso de ${e.anio - 1}, su último año en la lista.` : ""}${nota}`;
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
      const nombreCampo = t.campos.find((c) => c.id === campo).nombre;
      const que = tipo === "procesos" ? "Proceso" : "Especialidad";
      IND[id] = { ...base, id, tipo, campo, serie: t.v[campo][base.medida], nombre: `${base.nombre}: ${nombreCampo}`, desc: `${base.desc.replace(/ \(todas las especialidades\)/, "")} ${que}: ${nombreCampo}.`, campoNombre: nombreCampo };
    }
    return IND[id];
  }
  // Pacientes en espera de la lista que muestra el indicador (total o la especialidad/proceso elegido), por territorio.
  function pacientesDe(ind, a = S.anioP) {
    if (ind.grupo !== "espera") return null;
    const series = DATA.detalle[ind.tipo]?.v[ind.campo || "total"]?.pacientes;
    return series ? Object.fromEntries(Object.entries(series).map(([id, sr]) => [id, sr[a]])) : null;
  }
  function cambioPacientes(ind, desde, hasta, actuales = pacientesDe(ind, hasta)) {
    if (desde >= hasta || !actuales || motivoComparacion(ind, desde, hasta, "pacientes")) return null;
    const anteriores = pacientesDe(ind, desde);
    const cambios = Object.fromEntries(Object.entries(actuales)
      .filter(([id, valor]) => valor != null && anteriores?.[id] != null)
      .map(([id, valor]) => [id, valor - anteriores[id]]));
    const comunidades = IDS.filter((id) => cambios[id] != null);
    const total = comunidades.length ? comunidades.reduce((suma, id) => suma + cambios[id], 0) : null;
    return { cambios, total, n: comunidades.length };
  }
  const queEspera = (ind) => (ind.tipo === "consultas" ? "una primera consulta con el especialista" : "una operación") +
    (ind.campoNombre ? ` (${ind.campoNombre})` : "");

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
      const anio = ultimo(i);
      const vals = valores(i, i.grupo === "espera" ? S.anioP : anio);
      const m = i.grupo === "opinion" ? i.espana[anio] : esRecurso(i) ? i.espana[indice(i, anio)] : media(vals);
      let mini;
      if (tieneSerie(i)) {
        const medias = i.espana ? i.espana.slice() : periodos(i).map((a) => media(valores(i, a)));
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
      if (i.grupo === "espera") pie = `Media de las comunidades con dato · ${periodo(i, S.anioP)}`;
      else if (i.grupo === "opinion") pie = `España · ${periodo(i, anio)} · encuesta`;
      else if (esRecurso(i)) pie = `España en ${periodo(i, anio)}<br><span class="kpi-c">${fmt((m / i.espana[0] - 1) * 100, "var")} desde ${periodo(i, primero(i))}</span>`;
      else if (tieneSerie(i)) {
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
        <button type="button" data-g="opinion" aria-pressed="${grupo === "opinion"}">Lo que opina la gente</button>
        <button type="button" data-g="primaria" aria-pressed="${grupo === "primaria"}">Atención primaria</button>
        <button type="button" data-g="hospitales" aria-pressed="${grupo === "hospitales"}">Hospitales</button>
      </div><div class="kpis">${tarjetas}</div>` + (enEuros(IND[actualId]) ? `<div class="real">
        <div class="seg sm" role="group" aria-label="Inflación">
          <button type="button" data-r="1" aria-pressed="${S.real}">Descontando la inflación</button>
          <button type="button" data-r="0" aria-pressed="${!S.real}">Sin descontar</button>
        </div><span>${S.real
          ? `Cada año se expresa en euros de ${ULT}: así se ve cuánto ha crecido el gasto de verdad. Los precios han subido un ${nf(0).format((IPC[ULT] / IPC[ANIOS[0]] - 1) * 100)} % desde ${ANIOS[0]} (IPC del INE).`
          : `Cada año, en los euros de entonces: parte de la subida es solo inflación (los precios han subido un ${nf(0).format((IPC[ULT] / IPC[ANIOS[0]] - 1) * 100)} % desde ${ANIOS[0]}).`}
          Solo afecta a los datos en euros y a los años anteriores a ${ULT}: lo verás en la tendencia, al mover la barra de años y en «Cambio entre dos años». Los porcentajes no cambian.</span></div>` : "") +
      (actualId === "gasto_hab" && EDAD ? `<div class="real edad">
        <div class="seg sm" role="group" aria-label="Edad de la población">
          <button type="button" data-e="0" aria-pressed="${!S.edad}">Por habitante</button>
          <button type="button" data-e="1" aria-pressed="${S.edad}">Ajustado por edad</button>
        </div><span>${S.edad
          ? `Corrige que unas comunidades tienen más población mayor, que necesita más atención. Desde ${EDAD.anios[0]}.`
          : "El dato oficial. Las comunidades con más población mayor necesitan gastar más por habitante."}</span>
        ${plegable("edad-como", "¿Cómo se calcula?", textoEdadCorto())}</div>` : "");
    cont.querySelectorAll(".real button[data-r]").forEach((b) => b.onclick = () => { S.real = b.dataset.r === "1"; render(); });
    cont.querySelectorAll(".real button[data-e]").forEach((b) => b.onclick = () => { S.edad = b.dataset.e === "1"; render(); });
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
  const datoCiudad = (ind, id, a = S.anioP) => ind.grupo === "espera" ? (ind.cambioCiudades ? ind.cambioCiudades[id] : dato(ind, id, a)) : null;
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
    const conCiud = !neutro && ind.grupo === "espera";
    if (conCiud) GEO.regiones.filter((r) => CIUDADES[r.id]).forEach((r) => {
      const v = datoCiudad(ind, r.id); if (v == null) return;
      sv += `<g class="reg ciu" data-id="${r.id}" tabindex="0" role="img" aria-label="${CIUDADES[r.id]}: ${esc(fmt(v, ind.unidad))} (aparte)"><circle cx="${r.lx}" cy="${r.ly}" r="8" fill="${surf}" stroke="${fg}" stroke-width="1.2" stroke-dasharray="2 2"/>
        <text x="${r.lx + 12}" y="${r.ly + 4}" font-size="10.5" fill="${fg}">${CIUDADES[r.id]} ${fmtCorto(v, ind.unidad)}*</text></g>`;
    });
    sv += `<text x="${m.x + 8}" y="${m.y + m.h - 8}" font-size="10" fill="${muted}">Canarias</text></svg><p class="geo-fuente">Mapa: Instituto Geográfico Nacional (es-atlas), CC BY 4.0. ${conCiud ? "* Ceuta y Melilla, aparte: no cuentan para la media ni los puestos." : neutro ? "" : ind.grupo === "opinion" ? "Ceuta y Melilla no se muestran: tienen muy pocas entrevistas." : esRecurso(ind) ? "Ceuta y Melilla van juntas en la fuente: no se muestran." : "Ceuta y Melilla, en gris: sin gasto comparable."}</p>`;
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
  const pctAnio = (ind, a) => ((a - primero(ind)) / (ultimo(ind) - primero(ind))) * 100;
  const marcasAnios = (ind) => `<div class="marcas" aria-hidden="true">${periodos(ind).filter((a, i) => a === primero(ind) || a === ultimo(ind) || (ind.grupo === "gasto" || esRecurso(ind)) && (a - primero(ind)) % 4 === 0 && ultimo(ind) - a >= 3)
    .map((a) => `<span style="left:calc(10px + (100% - 20px) * ${pctAnio(ind, a) / 100})">${periodo(ind, a, true)}</span>`).join("")}</div>`;
  function barraAnios(cont, ind, anio, onChange) {
    if (!tieneSerie(ind)) {
      cont.dataset.tipo = "";
      cont.innerHTML = ind.grupo === "opinion"
        ? `<span class="nota" style="margin:0">Solo ${periodo(ind, ultimo(ind))}: el único año que se puede comprobar por comunidad con las cifras del Ministerio.</span>`
        : `<span class="nota" style="margin:0">Listas de espera: un solo corte (${DATA.corteListas}). La evolución llegará al añadir más informes.</span>`;
      return;
    }
    // Se rehace si cambia el tema o el rango de años (en «Recursos» cada indicador tiene los suyos)
    const clave = `anio-${ind.grupo}-${primero(ind)}-${ultimo(ind)}`;
    if (cont.dataset.tipo !== clave) {
      cont.dataset.tipo = clave;
      cont.innerHTML = `<button type="button" class="play"></button><span class="anio"></span><span class="prov">provisional</span>
        <div class="linea"><input type="range" min="${primero(ind)}" max="${ultimo(ind)}" step="1" aria-label="${ind.grupo === "espera" ? "Corte" : "Año"}">${marcasAnios(ind)}</div>
        <span class="ayuda-rango">Mueve el punto para elegir la fecha. Pulsa ▶ para reproducir la serie.</span>`;
    }
    const inp = cont.querySelector("input"), play = cont.querySelector(".play");
    if (+inp.value !== anio) inp.value = anio;
    inp.setAttribute("aria-valuetext", periodo(ind, anio));
    cont.querySelector(".anio").textContent = periodo(ind, anio);
    cont.querySelector(".prov").hidden = !esProv(anio);
    play.textContent = timer ? "❚❚" : "▶";
    play.setAttribute("aria-label", timer ? "Pausar" : "Reproducir la serie");
    inp.oninput = () => { pararPlay(); onChange(+inp.value); };
    play.onclick = () => {
      if (timer) { pararPlay(); render(); return; }
      let a = anio >= ultimo(ind) ? primero(ind) : anio;
      onChange(a);
      timer = setInterval(() => { a++; if (a > ultimo(ind)) { pararPlay(); render(); return; } onChange(a); }, 420);
      render();
    };
  }
  function pararPlay() { if (timer) { clearInterval(timer); timer = null; } }
  // Año de partida para los cambios: el elegido en modo «Crecimiento», o el primero de la serie.
  const base0 = (ind) => S.modo === "cambio" ? S.desde : primero(ind);
  // En modo «Crecimiento»: la misma línea de tiempo con dos tiradores (desde y hasta) y el tramo resaltado.
  function barraPeriodo(cont, ind, onChange) {
    const clave = `rango-${ind.grupo}-${primero(ind)}-${ultimo(ind)}`;
    if (cont.dataset.tipo !== clave) {
      cont.dataset.tipo = clave;
      cont.innerHTML = `<span class="anio rango-txt"></span><span class="prov">provisional</span>
        <div class="linea rango"><div class="pista"></div><div class="tramo"></div>
          <input type="range" class="r-desde" min="${primero(ind)}" max="${ultimo(ind)}" step="1" aria-label="Fecha inicial del periodo">
          <input type="range" class="r-hasta" min="${primero(ind)}" max="${ultimo(ind)}" step="1" aria-label="Fecha final del periodo">${marcasAnios(ind)}</div>
        <span class="ayuda-rango">Arrastra los dos puntos: el de la izquierda es la fecha inicial y el de la derecha, la final.</span>`;
    }
    const d = cont.querySelector(".r-desde"), h = cont.querySelector(".r-hasta");
    const pintar = () => {
      if (+d.value !== S.desde) d.value = S.desde;
      if (+h.value !== S.anioP) h.value = S.anioP;
      d.setAttribute("aria-valuetext", periodo(ind, S.desde));
      h.setAttribute("aria-valuetext", periodo(ind, S.anioP));
      cont.querySelector(".rango-txt").textContent = `${periodo(ind, S.desde, true)} → ${periodo(ind, S.anioP, true)}`;
      cont.querySelector(".prov").hidden = !esProv(S.anioP) && !esProv(S.desde);
      const t = cont.querySelector(".tramo");
      t.style.left = `calc(10px + (100% - 20px) * ${pctAnio(ind, S.desde) / 100})`;
      t.style.width = `calc((100% - 20px) * ${(pctAnio(ind, S.anioP) - pctAnio(ind, S.desde)) / 100})`;
      // el tirador más cercano al otro extremo queda encima, para poder moverlo siempre
      d.style.zIndex = S.desde > ultimo(ind) - 2 ? 3 : 2;
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
    if (ind.unidad === "pp" || ind.unidad === "var") return `Puesto ${pos} de ${n} por variación`;
    if (ind.grupo === "espera") {
      if (pos === 1) return `La peor de las ${n}: la que más espera`;
      if (pos === n) return `La mejor de las ${n}: la que menos espera`;
      return arriba(pos, n) ? `La ${pos}.ª con más espera de ${n}` : `La ${n - pos + 1}.ª con menos espera de ${n}`;
    }
    if (pos === 1) return `La cifra más alta de las ${n}`;
    if (pos === n) return `La cifra más baja de las ${n}`;
    return arriba(pos, n) ? `La ${pos}.ª más alta de ${n}` : `La ${n - pos + 1}.ª más baja de ${n}`;
  }

  // Comunidades que comparten la cifra que se muestra (empate): «Cataluña y Madrid».
  function empatadas(vals, id, u) {
    const ids = IDS.filter((k) => vals[k] != null && fmt(vals[k], u) === fmt(vals[id], u));
    return ids.length > 1 ? `${ids.slice(0, -1).map((k) => NOMBRE[k]).join(", ")} y ${NOMBRE[ids.at(-1)]}` : NOMBRE[id];
  }

  // «la cifra más alta, Cataluña y Madrid; la más baja, Aragón»: sin jerga de ranking y sin problemas de número.
  // Años sin dato por comunidad: en TAC y resonancia, 2022 (la tabla del SIAE trae las columnas desplazadas).
  const sinDatosTxt = (ind, anio) => /^hosp_(tac|rm)_/.test(ind.id) && anio === DATA.recursos.anioEquiposSinDato
    ? "sin dato por comunidad (la tabla de ese año trae las columnas desplazadas; el dato de España sí está)" : "sin datos";
  const extremosTxt = (vals, top, bot, u) => `la cifra más alta, ${empatadas(vals, top, u)}; la más baja, ${empatadas(vals, bot, u)}`;

  // ---------- titulares automáticos ----------
  function titulares(ind, anio) {
    const vals = valores(ind, anio);
    const o = ordenados(vals); const top = o[0], bot = o[o.length - 1];
    const m = media(vals); const u = ind.unidad;
    const out = [];
    if (!o.length) return { out, top, bot };
    if (ind.grupo === "opinion") {
      const n = (c) => IDS.filter((id) => claseOpinion(ind, id, anio) === c).length;
      const dias = u === "dias_media";
      out.push({ k: `Frente a España (${fmt(ind.espana[anio], u)})`, t: `<strong>${n(1)}</strong> ${dias ? "con más días" : "por encima"}, <strong>${n(0)}</strong> que no se distinguen y <strong>${n(-1)}</strong> ${dias ? "con menos días" : "por debajo"}, teniendo en cuenta el margen de error de la encuesta.` });
      out.push({ k: "Extremos", t: `<strong>${NOMBRE[top]}</strong>: ${fmt(vals[top], u)} (${intervalo(ind, top, anio)}). <strong>${NOMBRE[bot]}</strong>: ${fmt(vals[bot], u)} (${intervalo(ind, bot, anio)}).` });
      const ch = anio > 0 ? cambioOpinion(ind, "ES", 0, anio) : null;
      if (ch) out.push({ k: `España desde ${ind.fechas[0]}`, t: `De ${fmt(ch.desde, u)} a <strong>${fmt(ch.hasta, u)}</strong> en ${ind.fechas[anio]}: ${textoCambio(ind, ch)}.` });
      return { out, top, bot };
    }
    if (esRecurso(ind)) {
      // Empates con la cifra que se muestra: se nombran todas las comunidades que la comparten.
      const igual = (ref) => o.filter((id) => fmt(vals[id], u) === fmt(vals[ref], u));
      const nombres = (ids) => { const n = ids.map((id) => `<strong>${NOMBRE[id]}</strong>`); return n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n.at(-1)}` : n[0]; };
      const [ta, tb] = [igual(top), igual(bot)];
      out.push({ k: "Más y menos", t: `${nombres(ta)} ${ta.length > 1 ? "tienen" : "tiene"} la cifra más alta (${fmt(vals[top], u)} ${esc(ind.que)}) y ${nombres(tb)} la más baja (${fmt(vals[bot], u)}).` });
      out.push({ k: `España en ${anio}`, t: `<strong>${fmt(ind.espana[indice(ind, anio)], u)}</strong> ${esc(ind.que)}, ${esc(ind.espanaTxt)}. ${o.filter((id) => vals[id] > ind.espana[indice(ind, anio)]).length} comunidades están por encima.` });
    } else if (ind.id === "gasto_hab" || ind.id === "gasto_hab_edad" || ind.id === "farmacia_hab") {
      out.push({ k: "Más y menos", t: `<strong>${NOMBRE[top]}</strong> gasta ${fmt(vals[top], u)} por habitante, un ${nf(0).format((vals[top] / vals[bot] - 1) * 100)} % más que <strong>${NOMBRE[bot]}</strong> (${fmt(vals[bot], u)}).` });
    } else if (u === "dias") {
      out.push({ k: "Más y menos espera", t: `En <strong>${NOMBRE[top]}</strong> se espera de media ${fmt(vals[top], u)}; en <strong>${NOMBRE[bot]}</strong>, ${fmt(vals[bot], u)}. ${vals[bot] > 0 ? `El primero es ${nf(1).format(vals[top] / vals[bot])} veces el segundo.` : ""}` });
    } else {
      out.push({ k: "Extremos", t: `<strong>${NOMBRE[top]}</strong> tiene el valor más alto (${fmt(vals[top], u)}) y <strong>${NOMBRE[bot]}</strong> el más bajo (${fmt(vals[bot], u)}).` });
    }
    if (!esRecurso(ind)) out.push({ k: "Media", t: `La media de las ${o.length} comunidades${o.length < IDS.length ? " con dato" : ""} es <strong>${fmt(m, u)}</strong>. ${o.filter((id) => vals[id] > m).length} están por encima.` });
    if ((ind.grupo === "gasto" || esRecurso(ind)) && anio > base0(ind)) {
      const base = valores(ind, base0(ind));
      const cambio = {};
      for (const id of IDS) cambio[id] = u === "pct" ? vals[id] - base[id] : (vals[id] / base[id] - 1) * 100;
      const oc = ordenados(cambio); const a = oc[0], b = oc[oc.length - 1];
      const f = (x) => (x >= 0 ? "+" : "−") + nf(u === "pct" ? 1 : 0).format(Math.abs(x)) + (u === "pct" ? " puntos" : " %");
      // Camas: si en el periodo hay camas que cambian de clasificación (pública/privada), se avisa junto al dato.
      const recl = (id) => esRecurso(ind) && ind.unidad === "camas_mil" ? DATA.recursos.reclasificaciones.filter((x) => x.ccaa === id && x.anio > base0(ind) && x.anio <= anio) : [];
      const conRecl = (id) => recl(id).length ? `; incluye camas que en ${recl(id).map((x) => x.anio).join(" y ")} pasan a contarse en otra red` : "";
      out.push({ k: `Cambio de ${base0(ind)} a ${anio}${sinInfl(ind) ? ", descontada la inflación" : ""}`, t: `El cambio más alto es el de <strong>${NOMBRE[a]}</strong> (${f(cambio[a])}${conRecl(a)}); el más bajo, el de <strong>${NOMBRE[b]}</strong> (${f(cambio[b])}${conRecl(b)}).` });
    }
    return { out, top, bot };
  }

  function titularesPacientes(ind, anio) {
    if (ind.grupo !== "espera") return [];
    const out = [];
    const pac = pacientesDe(ind, anio);
    const con = IDS.filter((id) => pac?.[id] != null);
    if (con.length) {
      const total = con.reduce((s, id) => s + pac[id], 0);
      out.push({ k: "Pacientes en espera", t: `En ${periodo(ind, anio, true)}, <strong>${fmt(total, "num")}</strong> personas esperan ${esc(queEspera(ind))} en ${con.length < IDS.length ? `las ${con.length} comunidades con dato` : "las 17 comunidades"}` +
        (pac[S.com] != null ? `; en <strong>${NOMBRE[S.com]}</strong>, ${fmt(pac[S.com], "num")}.` : `. ${NOMBRE[S.com]} no tiene dato en el informe.`) });
    }
    const compararFechas = S.modo === "cambio";
    const desde = compararFechas ? S.desde : anio - 1;
    if (desde >= 0) {
      const cambio = cambioPacientes(ind, desde, anio, pac);
      out.push({ k: compararFechas ? "Cambio de pacientes entre cortes" : "Cambio respecto al corte anterior", t: cambio?.total != null
        ? `<strong>${firmado(cambio.total, 0)} pacientes</strong> desde ${periodo(ind, desde)} (${cambio.n} ${cambio.n === 1 ? "comunidad con dato" : "comunidades con datos"} en ambos cortes).`
        : "Sin cifras comparables de pacientes para los dos cortes." });
    }
    return out;
  }

  // ---------- DATOS (mapa arriba; ranking, evolución y tabla debajo) ----------
  // Si la especialidad elegida no vale para la tarjeta (p. ej. de quirúrgica a consultas), vuelve al total.
  function campoValido(base) {
    if (S.campoE !== "total" && (base.grupo !== "espera" || !familias(base).includes(S.campoE.split(":")[0]))) S.campoE = "total";
    return indDetalle(base, S.campoE);
  }

  // Cambio desde el primer año: % en euros y otros valores; puntos en porcentajes. Respeta la inflación.
  function cambioInd(ind, anio) {
    const u = ind.unidad;
    const out = {};
    const cambioCiudades = {};
    if (comparar(ind, S.desde, anio)) {
      for (const id of [...IDS, ...Object.keys(CIUDADES)]) {
        const cambio = diferencia(ind, dato(ind, id, S.desde), dato(ind, id, anio));
        if (cambio != null) (IDS.includes(id) ? out : cambioCiudades)[id] = cambio;
      }
    }
    const nombre = u === "pct"
      ? `${ind.nombre}: cambio de ${periodo(ind, S.desde)} a ${periodo(ind, anio)}, en puntos`
      : `${ind.nombre}: cambio de ${periodo(ind, S.desde)} a ${periodo(ind, anio)}, en %${enEuros(ind) ? (S.real ? ", descontada la inflación" : ", sin descontar la inflación") : ""}`;
    return { ind: { ...ind, cambioCiudades, id: `${ind.id}~cambio`, unidad: u === "pct" ? "pp" : "var", nombre }, vals: out };
  }

  const seleccionPeriodo = {};
  function cambiarIndicador(id) {
    const anterior = IND[S.indP], siguiente = IND[id];
    if (anterior.grupo !== siguiente.grupo) {
      pararPlay();
      seleccionPeriodo[anterior.grupo] = { anioP: S.anioP, desde: S.desde, modo: S.modo };
      Object.assign(S, seleccionPeriodo[siguiente.grupo] || { anioP: ultimo(siguiente), desde: primero(siguiente), modo: "valor" });
    }
    S.indP = id;
  }

  function renderDatos() {
    const baseInd = periodoActual();
    const ind = campoValido(baseInd);
    if (!periodos(ind).includes(S.anioP)) S.anioP = ultimo(ind);
    if (!periodos(ind).includes(S.desde)) S.desde = primero(ind);
    if (ind === baseInd) S.campoE = "total";
    if (!tieneSerie(ind) && S.vistaE === "evolucion") S.vistaE = "ranking";
    if (!permiteCambio(ind)) S.modo = "valor";
    if (S.modo === "cambio" && S.anioP <= S.desde) {
      if (S.anioP === primero(ind)) S.anioP = periodos(ind)[1];
      S.desde = primero(ind);
    }
    selector($("#sel-datos"), S.indP, (id) => { pararPlay(); cambiarIndicador(id); render(); });
    $("#d-campo").innerHTML = ind !== baseInd
      ? `<span>Mapa y gráficos: <b>${esc(ind.campoNombre)}</b>. Las tarjetas siguen mostrando el total.</span><button type="button" class="btn-link" id="d-campo-total">Volver al total</button>`
      : "";
    if ($("#d-campo-total")) $("#d-campo-total").onclick = () => sinMover(() => { S.campoE = "total"; render(); });

    const anio = S.anioP;
    const vals = valores(ind, anio);
    const { out } = titulares(ind, anio);
    const enCambio = S.modo === "cambio";
    // Mapa: el valor de un año, o cuánto ha cambiado entre dos años
    const mapa = enCambio ? cambioInd(ind, anio) : { ind, vals };
    const mo = ordenados(mapa.vals), top = mo[0], bot = mo[mo.length - 1];
    const infl = enEuros(ind) ? (S.real ? "descontada la inflación" : "sin descontar la inflación") : "";
    const volver = ind.grupo === "espera" ? "Ver un corte" : "Ver un año";

    // «Tu comunidad»: su valor y puesto, o su cambio y puesto en el periodo
    const ficha = `<a href="#comunidad-${S.com.toLowerCase()}${ind.grupo === "espera" ? `?corte=${CORTES[anio].id}` : ""}">Ver su ficha completa</a>`;
    let tuya;
    if (enCambio && mapa.vals[S.com] == null) tuya = `Sin cambio comparable para ${NOMBRE[S.com]}. ${ficha}`;
    else if (vals[S.com] == null) tuya = `Sin dato en el informe para esta especialidad. ${ficha}`;
    else if (enCambio) {
      const pos = mo.indexOf(S.com) + 1;
      const puesto = puestoTxt(mapa.ind, pos, mo.length);
      tuya = `${fmt(mapa.vals[S.com], mapa.ind.unidad)} de ${periodo(ind, S.desde)} a ${periodo(ind, anio)}${infl ? ` (${infl})` : ""}. ${puesto}. ${ficha}`;
    } else {
      const ord = ordenados(vals);
      tuya = ind.grupo === "opinion"
        ? `<strong>${fmt(vals[S.com], ind.unidad)}</strong> en ${periodo(ind, anio)} (${intervalo(ind, S.com, anio)}). ${textoClase(ind, claseOpinion(ind, S.com, anio))}. ${ficha}`
        : `<strong>${fmt(vals[S.com], ind.unidad)}</strong>${tieneSerie(ind) ? ` en ${periodo(ind, anio)}` : ""}. ${puestoTxt(ind, ord.indexOf(S.com) + 1, ord.length)}. ${ficha}`;
    }
    out.unshift({ k: "Tu comunidad", t: tuya, elegir: true });
    if (enCambio && mo.length) {
      // En «Cambio entre dos años» todos los cuadros hablan del cambio; el valor final queda como contexto.
      const mc = media(mapa.vals), u2 = mapa.ind.unidad;
      const enPuntos = u2 === "pp";
      const valor = nf(enPuntos ? 1 : 0).format(Math.abs(mc));
      const resumenCambio = Math.abs(mc) < (enPuntos ? 0.05 : 0.5)
        ? "El valor apenas varió de media entre las comunidades"
        : `El valor ${mc < 0 ? "bajó" : "subió"}${enPuntos ? "" : " un"} <strong>${valor}${enPuntos ? " puntos porcentuales" : " %"}</strong> de media entre las comunidades`;
      const orden = ordenados(vals);
      out.splice(1, out.length - 1,
        { k: `Media de las ${mo.length}, de ${periodo(ind, S.desde)} a ${periodo(ind, anio)}`, t: `${resumenCambio}${infl ? ` (${infl})` : ""}.` },
        { k: `Para situarse: el valor en ${periodo(ind, anio)}`, t: `La cifra más alta es la de <strong>${empatadas(vals, orden[0], ind.unidad)}</strong> (${fmt(vals[orden[0]], ind.unidad)}) y la más baja, la de <strong>${empatadas(vals, orden.at(-1), ind.unidad)}</strong> (${fmt(vals[orden.at(-1)], ind.unidad)}). Para verlo en el mapa, elige «${volver}».` });
    }
    if (enCambio && !mo.length) out.splice(1);
    out.push(...titularesPacientes(ind, anio));
    // «Tu comunidad» lleva su propio desplegable (además de poder pulsarla en el mapa): sirve para las
    // comunidades pequeñas, en el móvil y con teclado o lector de pantalla.
    const opcionesCom = IDS.slice().sort((a, b) => NOMBRE[a].localeCompare(NOMBRE[b], "es")).map((k) => `<option value="${k}" ${k === S.com ? "selected" : ""}>${esc(NOMBRE[k])}</option>`).join("");
    $("#p-insights").innerHTML = out.map((x) => x.elegir
      ? `<div class="insight tuya"><label class="k" for="p-com">${esc(x.k)}</label><select id="p-com">${opcionesCom}</select><p>${x.t}</p></div>`
      : `<div class="insight"><div class="k">${esc(x.k)}</div><p>${x.t}</p></div>`).join("");
    $("#p-com").onchange = (e) => { S.com = e.target.value; render(); };

    // Título y subtítulo: dicen exactamente qué muestra el mapa
    if (enCambio) {
      const sinCambio = !Object.values(mapa.vals).some((v) => v != null);
      const anioSin = [S.desde, anio].find((a) => sinDatosTxt(ind, a) !== "sin datos");
      $("#p-titulo").textContent = `${ind.nombre}: cuánto ha cambiado de ${periodo(ind, S.desde)} a ${periodo(ind, anio)}${sinCambio && anioSin ? `: ${anioSin}, ${sinDatosTxt(ind, anioSin)}` : ""}`;
      const extremos = mapa.vals[top] === mapa.vals[bot]
        ? `Mismo cambio en las ${mo.length} comunidades con datos comparables (${fmt(mapa.vals[top], mapa.ind.unidad)})`
        : `El cambio más alto es el de ${NOMBRE[top]} (${fmt(mapa.vals[top], mapa.ind.unidad)}) y el más bajo, el de ${NOMBRE[bot]} (${fmt(mapa.vals[bot], mapa.ind.unidad)})`;
      $("#p-sub").textContent = !comparar(ind, S.desde, anio)
        ? "Sin cambios comparables para los cortes seleccionados. Consulta las notas del informe bajo el gráfico."
        : !mo.length ? "Ninguna comunidad tiene valores que permitan calcular el cambio entre los dos cortes."
        : `${extremos}${infl ? `, ${infl}` : ""}.${esProv(anio) || esProv(S.desde) ? ` Los datos de ${[S.desde, anio].filter(esProv).join(" y ")} son provisionales.` : ""} Pulsa una comunidad para elegirla como la tuya.`;
    } else if (tieneSerie(ind)) {
      $("#p-titulo").textContent = ind.grupo === "opinion" ? `${ind.nombre}, ${periodo(ind, anio)}, frente a la media de España` : `${ind.nombre} en ${periodo(ind, anio)}: ${top ? extremosTxt(mapa.vals, top, bot, mapa.ind.unidad) : sinDatosTxt(ind, anio)}`;
      $("#p-sub").textContent = `${ind.grupo === "opinion" ? "Encuesta: el color tiene en cuenta el margen de error. " : ""}${esProv(anio) ? "Dato provisional. " : ""}${enEuros(ind) && anio !== ULT ? (S.real ? `En euros de ${ULT}, descontada la inflación. ` : "En euros de ese año. ") : ""}Pulsa una comunidad para elegirla como la tuya.`;
    } else {
      $("#p-titulo").textContent = ind.grupo === "opinion" ? `${ind.nombre}, ${periodo(ind, anio)}, frente a la media de España` : `${ind.nombre}: ${extremosTxt(mapa.vals, top, bot, mapa.ind.unidad)}`;
      $("#p-sub").textContent = ind.grupo === "opinion" ? "Encuesta: el color tiene en cuenta el margen de error. Pulsa una comunidad para elegirla como la tuya." : `Situación a ${DATA.corteListas}. Pulsa una comunidad para elegirla como la tuya.`;
    }
    // El modo (un año / cambio entre dos años) se elige arriba, en el resumen o en Ajustes.
    leyenda($("#p-leyenda"), tileMap($("#p-mapa"), mapa.vals, mapa.ind, { selIds: [S.com], onClick: (id) => { S.com = id; render(); } }));
    botonPNG($("#p-desc"), "Descargar mapa (PNG)", () => descargarPNG($("#p-mapa svg"), `mapa_${mapa.ind.id}`, $("#p-titulo").textContent, $("#p-leyenda"),
      [$("#p-sub").textContent.replace(" Pulsa una comunidad para elegirla como la tuya.", "")]));
    if (enCambio) barraPeriodo($("#p-anios"), ind, () => { pararPlay(); render(); });
    else barraAnios($("#p-anios"), ind, S.anioP, (a) => { S.anioP = a; render(); });

    renderResumen(baseInd, ind);
    renderDetalle(ind, mapa, anio);
    // «¿Van juntos el gasto y la espera?» solo en el tema de listas de espera
    const xy = document.querySelector("#v-datos .xy");
    xy.style.display = ind.grupo === "espera" ? "" : "none";
    if (ind.grupo === "espera") renderXY(ind);
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
  function filtrosIniciales(base) {
    return {
      indP: DATA.inds.find((ind) => ind.grupo === base.grupo).id,
      campoE: "total", modo: "valor", anioP: ultimo(base), desde: primero(base), vistaE: "ranking",
      ...(base.grupo === "gasto" ? { real: true, edad: false } : {}),
    };
  }
  function filtrosModificados(base) {
    return Object.entries(filtrosIniciales(base)).some(([k, valor]) => k !== "desde" && S[k] !== valor);
  }
  function restablecer() {
    Object.assign(S, filtrosIniciales(periodoActual()));
  }
  const aplicar = (fn) => sinMover(() => { pararPlay(); fn(); render(); });
  const opt = (v, txt, sel, dis = false) => `<option value="${v}" ${sel ? "selected" : ""} ${dis ? "disabled" : ""}>${esc(txt)}</option>`;
  const opcionesDato = () => ["gasto", "espera", "opinion", "primaria", "hospitales"].map((g) => `<optgroup label="${{ gasto: "Gasto sanitario", espera: "Listas de espera", opinion: "Lo que opina la gente", primaria: "Atención primaria", hospitales: "Hospitales" }[g]}">${DATA.inds.filter((i) => i.grupo === g).map((i) => opt(i.id, i.corto, i.id === S.indP)).join("")}</optgroup>`).join("");
  const opcionesCampo = (base) => opt("total", "Todas (total)", S.campoE === "total") + familias(base).map((tipo) => `<optgroup label="${tipo === "procesos" ? "Procesos" : "Especialidades"}">${DATA.detalle[tipo].campos.filter((c) => c.id !== "total").map((c) => opt(`${tipo}:${c.id}`, c.nombre, S.campoE === `${tipo}:${c.id}`)).join("")}</optgroup>`).join("");
  const opcionesAnio = (ind, lista, sel) => lista.map((a) => opt(a, `${periodo(ind, a)}${esProv(a, ind) ? " (prov.)" : ""}`, a === sel)).join("");
  const opcionesCom = () => IDS.slice().sort((a, b) => NOMBRE[a].localeCompare(NOMBRE[b], "es")).map((k) => opt(k, NOMBRE[k], k === S.com)).join("");
  const opcionesGraf = (base) => [["ranking", "Ranking"], ["evolucion", "Evolución"], ["tabla", "Tabla"]].map(([v, t]) => opt(v, t, S.vistaE === v, v === "evolucion" && !tieneSerie(base))).join("");

  // «31 de diciembre de 2025» -> «dic. 2025» (para que quepa en una etiqueta)
  const corteCorto = () => { const m = DATA.corteListas.match(/de (\w+) de (\d{4})/); return m ? `${m[1].slice(0, 3)}. ${m[2]}` : DATA.corteListas; };
  const avisoComparacion = (ind) => {
    const motivo = S.modo === "cambio" ? motivoComparacion(ind, S.desde, S.anioP) : "";
    return motivo ? `Cambio del indicador sin calcular. ${motivo}` : "";
  };
  function renderResumen(base, ind) {
    const serie = tieneSerie(base), fecha = base.grupo === "espera" ? "Corte" : "Año";
    const chip = (et, dentro, cambiado = false, extra = "") => `<span class="chip-s${cambiado ? " cambiado" : ""}" ${extra}>${et ? `<span class="et">${et}</span>` : ""}${dentro}</span>`;
    const ayuda = (txt) => `title="${esc(txt)}"`;
    let h = chip("", `<select id="rs-dato" aria-label="Dato">${opcionesDato()}</select>`, false, ayuda("Qué dato muestran el mapa y los gráficos"));
    if (base.grupo === "espera") h += chip("", `<select id="rs-campo" aria-label="Especialidad o proceso">${opcionesCampo(base)}</select>`, S.campoE !== "total", ayuda("Las tarjetas de arriba siguen mostrando el total"));
    if (serie) {
      // Una sola etiqueta para el periodo: «Año 2024» o «Periodo 2002 → 2020», con un botón para cambiar de modo
      const btnModo = !permiteCambio(base) ? "" : `<button type="button" class="rs-modo" id="rs-modo">${S.modo === "cambio" ? (base.grupo === "espera" ? "Ver un corte" : "Ver un año") : "Comparar años"}</button>`;
      h += S.modo === "cambio"
        ? chip("", `<select id="rs-desde" aria-label="${fecha} inicial">${opcionesAnio(base, periodos(base).filter((a) => a < S.anioP), S.desde)}</select><span class="flecha" aria-hidden="true">→</span><select id="rs-hasta" aria-label="${fecha} final">${opcionesAnio(base, periodos(base).filter((a) => a > S.desde), S.anioP)}</select>${btnModo}`, true, ayuda("Cuánto ha cambiado entre las fechas elegidas"))
        : chip("", `<select id="rs-anio" aria-label="${fecha}">${opcionesAnio(base, periodos(base).slice().reverse(), S.anioP)}</select>${btnModo}`, S.anioP !== ultimo(base), ayuda("Fecha del mapa y del ranking. «Comparar años» permite elegir dos fechas"));
    } else h += chip("", base.grupo === "opinion" ? `<span class="fijo">${periodo(base, ultimo(base))}</span>` : `<span class="fijo" title="${DATA.corteListas}">${corteCorto()}</span>`);
    if (S.indP === "gasto_hab" && EDAD) h += `<button type="button" id="rs-edad" class="chip-s boton${S.edad ? " cambiado" : ""}" aria-pressed="${S.edad}" title="Pulsa para ${S.edad ? "ver el dato oficial, sin ajustar" : "ajustar por la edad de la población"}"><span class="et">Edad</span>${S.edad ? "Ajustado" : "Sin ajustar"}</button>`;
    if (enEuros(base)) h += `<button type="button" id="rs-infl" class="chip-s boton${S.real ? "" : " cambiado"}" aria-pressed="${!S.real}" title="Pulsa para ${S.real ? "ver los euros de cada año" : "descontar la inflación"}"><span class="et">Inflación</span>${S.real ? "Descontada" : "Sin descontar"}</button>`;
    h += chip("Tu comunidad", `<select id="rs-com" aria-label="Tu comunidad">${opcionesCom()}</select>`, false, ayuda("Se resalta en el mapa y en los gráficos"));
    h += chip("Gráfico", `<select id="rs-graf" aria-label="Gráfico de abajo">${opcionesGraf(base)}</select>`, false, ayuda("El gráfico que aparece debajo del mapa"));
    // «Restablecer» (en el ordenador), al final de las etiquetas, solo cuando algo no está como al principio
    const cambiado = filtrosModificados(base);
    if (cambiado) h += `<button type="button" class="rs-reset" id="rs-reset">Restablecer</button>`;
    $("#rs-chips").innerHTML = h;
    const aviso = avisoComparacion(ind);
    $("#rs-aviso").hidden = !aviso;
    if ($("#rs-motivo").textContent !== aviso) $("#rs-motivo").textContent = aviso;
    $("#rs-notas").onclick = (e) => {
      e.preventDefault();
      const notas = $("#e-nota details");
      if (!notas) return;
      notas.open = true;
      notas.querySelector("summary").focus({ preventScroll: true });
      notas.scrollIntoView({ block: "center" });
    };
    if (cambiado) $("#rs-reset").onclick = () => {
      const teniaFoco = document.activeElement === $("#rs-reset");
      aplicar(restablecer);
      if (teniaFoco) $("#rs-dato").focus({ preventScroll: true });
    };
    // En el móvil, una sola línea con el resumen (lo que no está como al principio, resaltado); al tocarla, Ajustes.
    const parte = (txt, cambiado = false) => `<span class="${cambiado ? "cambiado" : ""}">${esc(txt)}</span>`;
    const partes = [parte(base.corto)];
    if (base.grupo === "espera") partes.push(S.campoE !== "total" ? parte(indDetalle(base, S.campoE).campoNombre || "", true) : parte("total"));
    if (serie) partes.push(S.modo === "cambio" ? parte(`${periodo(base, S.desde, true)} → ${periodo(base, S.anioP, true)}`, true) : parte(periodo(base, S.anioP, true), S.anioP !== ultimo(base)));
    else partes.push(parte(base.grupo === "opinion" ? periodo(base, ultimo(base)) : corteCorto()));
    if (conEdad()) partes.push(parte("ajustado por edad", true));
    if (enEuros(base)) partes.push(parte(S.real ? "sin inflación" : "con inflación", !S.real));
    partes.push(parte(NOMBRE[S.com]));
    $("#rs-texto").innerHTML = `<span class="rs-linea">${partes.join('<span class="sep"> · </span>')}</span><span class="rs-mas" aria-hidden="true">▾</span>`;
    $("#rs-texto").setAttribute("aria-label", `Estás viendo: ${$("#rs-texto").textContent.replace("▾", "")}. Pulsa para cambiarlo`);
    $("#rs-texto").onclick = () => { renderAjustes(); $("#ajustes").showModal(); };
    const on = (id, fn) => { const el = $("#" + id); if (el) el.onchange = (e) => aplicar(() => fn(e.target.value)); };
    on("rs-dato", (v) => { cambiarIndicador(v); });
    on("rs-campo", (v) => { S.campoE = v; });
    if ($("#rs-modo")) $("#rs-modo").onclick = () => aplicar(() => { S.modo = S.modo === "cambio" ? "valor" : "cambio"; });
    on("rs-anio", (v) => { S.anioP = +v; });
    on("rs-desde", (v) => { S.desde = +v; });
    on("rs-hasta", (v) => { S.anioP = +v; });
    on("rs-com", (v) => { S.com = v; });
    on("rs-graf", (v) => { S.vistaE = v; });
    if ($("#rs-infl")) $("#rs-infl").onclick = () => aplicar(() => { S.real = !S.real; });
    if ($("#rs-edad")) $("#rs-edad").onclick = () => aplicar(() => { S.edad = !S.edad; });
    $("#rs-ajustes").onclick = () => { renderAjustes(); $("#ajustes").showModal(); };
    if ($("#ajustes").open) renderAjustes();
  }

  // Panel con todas las opciones juntas y explicadas (en el móvil sale desde abajo).
  function renderAjustes() {
    const base = periodoActual(), serie = tieneSerie(base);
    const aviso = avisoComparacion(indDetalle(base, S.campoE));
    const radios = (nombre, valor, ops) => `<div class="aj-radios" role="radiogroup" aria-label="${nombre}">${ops.map(([v, t, nota, dis]) => `<label class="aj-radio${dis ? " dis" : ""}"><input type="radio" name="aj-${nombre}" id="aj-${nombre}-${v}" value="${v}" ${String(valor) === String(v) ? "checked" : ""} ${dis ? "disabled" : ""}><span>${t}${nota ? ` <small>${nota}</small>` : ""}</span></label>`).join("")}</div>`;
    const fila = (titulo, control, ayuda = "") => `<div class="aj-fila"><div class="aj-t">${titulo}</div><div>${control}${ayuda ? `<p class="aj-ayuda">${ayuda}</p>` : ""}</div></div>`;
    let h = `<div class="aj-cab"><h2 id="aj-titulo">Ajustes de la vista</h2><button type="button" class="aj-cerrar" id="aj-cerrar" aria-label="Cerrar">×</button></div>`;
    h += fila("Dato", `<select id="aj-dato">${opcionesDato()}</select>`);
    if (base.grupo === "espera") h += fila("Especialidad", `<select id="aj-campo">${opcionesCampo(base)}</select>`, "Las tarjetas siguen mostrando el total.");
    if (serie) {
      if (permiteCambio(base)) h += fila("¿Qué ver?", radios("modo", S.modo, [["valor", base.grupo === "espera" ? "Un corte" : "Un año"], ["cambio", "Comparar años"]]), "El mapa y el ranking muestran el valor en una fecha o el cambio entre dos.");
      h += S.modo === "cambio"
        ? fila(base.grupo === "espera" ? "Cortes" : "Años", `<span class="aj-anios">Desde <select id="aj-desde">${opcionesAnio(base, periodos(base).filter((a) => a < S.anioP), S.desde)}</select> hasta <select id="aj-hasta">${opcionesAnio(base, periodos(base).filter((a) => a > S.desde), S.anioP)}</select></span>`, aviso && `<span role="status">${esc(aviso)}</span>`)
        : fila(base.grupo === "espera" ? "Corte" : "Año", `<select id="aj-anio">${opcionesAnio(base, periodos(base).slice().reverse(), S.anioP)}</select>`);
    } else h += base.grupo === "opinion" ? fila("Año", `<span>${periodo(base, ultimo(base))}</span>`, "Es el único año que se puede comprobar por comunidad con las cifras del Ministerio.")
      : fila("Fecha", `<span>${DATA.corteListas}</span>`, "Hay un solo informe de listas de espera; la evolución llegará con los siguientes.");
    if (S.indP === "gasto_hab" && EDAD) h += fila("Edad", radios("edad", S.edad ? "1" : "0", [["0", "Por habitante", "(dato oficial)"], ["1", "Ajustado por edad"]]), `Ajustado: corrige que unas comunidades tienen más población mayor. Desde ${EDAD.anios[0]}. <a href="#metodo-edad">Cómo se calcula</a>.`);
    if (enEuros(base)) h += fila("Inflación", radios("infl", S.real ? "1" : "0", [["1", "Descontada", "(recomendado)"], ["0", "Sin descontar"]]), `Descontada: cada año en euros de ${ULT}, para ver cuánto ha crecido el gasto de verdad.`);
    h += fila("Tu comunidad", `<select id="aj-com">${opcionesCom()}</select>`, "Se resalta en el mapa y en los gráficos.");
    h += fila("Gráfico", radios("graf", S.vistaE, [["ranking", "Ranking"], ["evolucion", "Evolución", "", !serie], ["tabla", "Tabla"]]), "El gráfico que aparece debajo del mapa.");
    const cambiado = filtrosModificados(base);
    h += `<div class="aj-pie">${cambiado ? '<button type="button" class="btn" id="aj-reset">Restablecer</button>' : ""}<button type="button" class="btn primary" id="aj-ver">Ver resultado</button></div>`;
    $("#aj-cuerpo").innerHTML = h;
    const on = (sel, fn) => $("#aj-cuerpo").querySelectorAll(sel).forEach((el) => el.onchange = (e) => { pararPlay(); fn(e.target.value); render(); });
    on("#aj-dato", (v) => { cambiarIndicador(v); });
    on("#aj-campo", (v) => { S.campoE = v; });
    on('input[name="aj-modo"]', (v) => { S.modo = v; });
    on("#aj-anio", (v) => { S.anioP = +v; });
    on("#aj-desde", (v) => { S.desde = +v; });
    on("#aj-hasta", (v) => { S.anioP = +v; });
    on('input[name="aj-infl"]', (v) => { S.real = v === "1"; });
    on('input[name="aj-edad"]', (v) => { S.edad = v === "1"; });
    on("#aj-com", (v) => { S.com = v; });
    on('input[name="aj-graf"]', (v) => { S.vistaE = v; });
    const cerrar = () => $("#ajustes").close();
    $("#aj-cerrar").onclick = cerrar;
    $("#aj-ver").onclick = () => { cerrar(); document.querySelector("#v-datos .portada-grid").scrollIntoView({ behavior: "smooth", block: "start" }); };
    if (cambiado) $("#aj-reset").onclick = () => {
      pararPlay();
      restablecer();
      render();
      $("#aj-ver").focus({ preventScroll: true });
    };
  }

  // Pestañas bajo el mapa. El ranking sigue al mapa (valor o cambio); la tabla trae los dos.
  function renderDetalle(ind, mapa, anio) {
    if (!tieneSerie(ind) && S.vistaE === "evolucion") S.vistaE = "ranking";
    document.querySelectorAll("#e-vistas button").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.v === S.vistaE);
      b.disabled = b.dataset.v === "evolucion" && !tieneSerie(ind);
      b.title = b.disabled ? (ind.grupo === "opinion" ? "Solo hay datos de un año" : "Hace falta más de un informe de listas de espera") : "";
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
    const fecha = ind.grupo === "espera" ? CORTES[anio].fecha : ind.grupo === "opinion" ? periodo(ind, anio) : `${anio}${esProv(anio, ind) ? " (provisional)" : ""}`;
    if (S.vistaE === "evolucion") {
      $("#e-titulo").textContent = `${ind.nombre}, ${periodo(ind, primero(ind), true)} – ${periodo(ind, ultimo(ind), true)}${sinInfl(ind) ? `, en euros de ${ULT}` : enEuros(ind) ? ", en euros de cada año" : ""}`;
      $("#e-sub").textContent = "Las 17 comunidades en gris; en color, las que destaques. Pasa el ratón o toca el gráfico para ver cada fecha.";
      if (ind.grupo === "opinion") evolucionOpinion(cont, ind); else lineas(cont, ind);
    } else if (S.vistaE === "tabla") {
      const enCambio = S.modo === "cambio";
      const fechasTabla = ind.grupo === "espera" && enCambio
        ? `de ${periodo(ind, S.desde, true)} a ${periodo(ind, anio, true)}` : fecha;
      $("#e-titulo").textContent = `${ind.nombre}, ${fechasTabla}`;
      $("#e-sub").textContent = `Ordenada por ${enCambio ? "cambio entre las fechas elegidas" : "valor en la fecha elegida"}. Tu comunidad va resaltada.`;
      if (ind.grupo === "opinion") tablaOpinion(cont, ind, anio); else tabla(cont, ind, anio, mapa.vals);
    } else {
      const mo = ordenados(mapa.vals);
      $("#e-titulo").textContent = ind.grupo === "opinion" ? `${ind.nombre}, ${fecha}, con su margen de error`
        : S.modo === "cambio" ? `${mapa.ind.nombre}` : `${ind.nombre}, ${fecha}${mo.length ? `: la cifra más alta, ${empatadas(mapa.vals, mo[0], mapa.ind.unidad)}` : ""}`;
      $("#e-sub").textContent = ind.grupo === "opinion" ? "El punto es la cifra de la encuesta y la raya, su margen de error al 95 %. La línea discontinua es España. Si la raya la cruza, esa comunidad no se distingue de España. Pulsa una comunidad para destacarla."
        : tieneSerie(ind) ? "Pulsa una barra para destacar esa comunidad en la evolución." : "Pulsa una barra para destacar esa comunidad.";
      if (ind.grupo === "opinion") rankingOpinion(cont, ind, anio); else ranking(cont, mapa.vals, mapa.ind);
    }
    if (S.vistaE === "tabla") $("#e-desc").innerHTML = "";
    else if (!cont.querySelector("svg")) $("#e-desc").innerHTML = "";
    else botonPNG($("#e-desc"), "Descargar gráfico (PNG)", () => descargarPNG($("#e-chart svg"), `${S.vistaE}_${ind.id}`, $("#e-titulo").textContent, null,
      [...document.querySelectorAll("#e-chart .pliegue[open] li")].map((li) => li.textContent.replace(/\s+/g, " ").trim())));
    const sinDato = S.vistaE === "evolucion" ? [] : IDS.filter((k) => vals[k] == null);
    // Debajo del gráfico, a la vista solo la fuente; la definición y los avisos, en un desplegable con su recuento.
    const conAvisos = ind.grupo === "gasto" && S.vistaE !== "evolucion";
    const notasAnio = conAvisos ? NOTAS.filter((n) => n.anio === anio) : [];
    const avisosV = !conAvisos ? [] : S.modo === "cambio" ? avisosDe(ind.id).filter((a) => a.anio > S.desde && a.anio <= anio) : avisosDe(ind.id).filter((a) => a.anio === anio);
    // Al comparar un periodo, avisa si en él cambió la lista de entidades de alguna comunidad.
    const ccEnt = conAvisos && S.modo === "cambio" ? [...new Set(ENTIDADES.filter((e) => e.anio > S.desde && e.anio <= anio).map((e) => e.ccaa))] : [];
    const cortesConNotas = ind.grupo === "espera"
      ? (S.vistaE === "evolucion" ? CORTES : S.modo === "cambio" ? CORTES.slice(S.desde, anio + 1) : [CORTES[anio]])
      : [];
    const notasSISLE = cortesConNotas.flatMap((c) => c.notas.map((texto) => ({ fecha: c.fecha, texto })));
    const consulta2023 = ind.tipo === "consultas" && cortesConNotas.some((c) => c.id === "2023-06");
    const cambioDefinicion = ind.id.split("@")[0] === "c_pct";
    const cuenta = [
      notasSISLE.length || consulta2023 || cambioDefinicion ? "notas SISLE" : "",
      notasAnio.length ? `${notasAnio.length} ${notasAnio.length === 1 ? "nota" : "notas"} del Ministerio` : "",
      avisosV.length ? `${avisosV.length} ${avisosV.length === 1 ? "variación inusual" : "variaciones inusuales"}` : "",
      ccEnt.length ? "cambios en las entidades" : "",
    ].filter(Boolean);
    const cuerpo = `<p>${esc(ind.desc)}</p>` + (ind.grupo === "opinion" ? notasOpinion(ind) : esRecurso(ind) ? notasRecursos(ind.fuente) : "") +
      (cambioDefinicion ? '<p>Hasta junio de 2024 el indicador se refería a pacientes con cita asignada. Desde diciembre de 2024 se incluyen pacientes sin cita que ya superaban 60 días en el registro. El cambio entre ambas definiciones no se calcula. <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/docs/Datos_ccaa_dic2024.pdf#page=8">Informe de diciembre de 2024</a>.</p>' : "") +
      (consulta2023 ? '<p>En junio de 2023, el informe de consultas repite los recuentos, tiempos medios y porcentajes de diciembre de 2022, aunque publica tasas distintas. Se muestran las cifras de la fuente y se omiten los cambios que usan ese corte. <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/ListaEsperaInfAntCCAA.htm">Informes del Ministerio</a>.</p>' : "") +
      notasSISLE.map((n) => `<p><b>Nota del Ministerio (${n.fecha}):</b> ${esc(n.texto)}</p>`).join("") +
      notasAnio.map((n) => `<p><b>Nota del Ministerio (${esc(NOMBRE[n.ccaa])}, ${n.anio}):</b> ${esc(n.texto)}</p>`).join("") +
      (avisosV.length ? `<p><b>${S.modo === "cambio" ? `Variaciones inusuales entre ${S.desde} y ${anio} que influyen en el crecimiento` : `Variación inusual en ${anio}`}:</b></p><ul>${avisosV.map((a) => `<li>${esc(textoAviso(a))}</li>`).join("")}</ul><p><a href="#metodo-calidad">Cómo las detectamos</a>.</p>` : "") +
      (ccEnt.length ? `<p><b>Entre ${S.desde} y ${anio} cambió la lista de entidades que cuenta la estadística</b> en ${ccEnt.map((k) => esc(NOMBRE[k])).join(", ")}. ${esc(AVISO_ENTIDADES)} Detalle en la ficha de cada comunidad. <a href="#metodo-entidades">Más información</a>.</p>` : "") +
      (S.vistaE !== "evolucion" ? `<p><b>Ceuta y Melilla.</b> ${ind.grupo === "gasto" ? AVISO_GASTO : ind.grupo === "opinion" ? AVISO_OPINION_CIUDADES : esRecurso(ind) ? AVISO_RECURSOS_CIUDADES : AVISO_CIUDADES}</p>` : "");
    $("#e-nota").innerHTML = `Fuente: Ministerio de Sanidad${ind.grupo === "gasto" ? ", Estadística de Gasto Sanitario Público" : ind.grupo === "opinion" ? " y CIS, Barómetro Sanitario" : esRecurso(ind) ? (ind.fuente === "siae" ? ", Estadística de Centros Sanitarios de Atención Especializada (SIAE)" : ", Sistema de Información de Atención Primaria (SIAP)") : ", SISLE-SNS"}.` +
      (sinDato.length ? ` Sin dato en el informe: ${sinDato.map((k) => esc(NOMBRE[k])).join(", ")}.` : "") +
      plegable("e-nota", `Qué mide este dato${cuenta.length ? ` · ${cuenta.join(" · ")}` : ""}`, cuerpo);
  }

  // ---------- enlace compartible: el estado de la vista Datos va en la dirección ----------
  function guardarEnlace() {
    const q = new URLSearchParams();
    if (S.indP !== "gasto_hab") q.set("dato", S.indP);
    if (S.campoE !== "total") q.set("campo", S.campoE);
    const ind = periodoActual();
    const fecha = (a) => ind.grupo === "espera" ? CORTES[a].id : ind.grupo === "opinion" ? ind.fechas[a] : a;
    if (S.anioP !== ultimo(ind) || S.modo === "cambio") q.set("anio", fecha(S.anioP));
    if (S.modo !== "valor") q.set("modo", S.modo);
    if (S.modo === "cambio" && S.desde !== primero(ind)) q.set("desde", fecha(S.desde));
    if (S.vistaE !== "ranking") q.set("grafico", S.vistaE);
    if (!S.real) q.set("inflacion", "no");
    if (conEdad()) q.set("edad", "si");
    if (S.com !== "AN") q.set("com", S.com.toLowerCase());
    const hash = "#datos" + (q.toString() ? "?" + q.toString() : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  function leerEnlace(qs) {
    const q = new URLSearchParams(qs);
    const id = q.get("dato");
    S.indP = id && Object.hasOwn(IND, id) && !id.includes("@") && id !== EDAD?.id ? id : "gasto_hab";
    S.edad = q.get("edad") === "si";
    const ind = periodoActual();
    const leerPeriodo = (clave) => ind.grupo === "espera" ? CORTES.findIndex((c) => c.id === q.get(clave)) : ind.grupo === "opinion" ? ind.fechas.indexOf(+q.get(clave)) : +q.get(clave);
    S.campoE = "total";
    S.modo = "valor";
    S.vistaE = "ranking";
    S.real = true;
    const campo = q.get("campo"); if (campo && /^\w+:\w+$/.test(campo)) S.campoE = campo;
    const anio = leerPeriodo("anio"); S.anioP = periodos(ind).includes(anio) ? anio : ultimo(ind);
    const modo = q.get("modo"); if (modo === "cambio" || modo === "valor") S.modo = modo;
    const desde = leerPeriodo("desde"); S.desde = periodos(ind).includes(desde) && desde < ultimo(ind) ? desde : primero(ind);
    const g = q.get("grafico"); if (["ranking", "evolucion", "tabla"].includes(g)) S.vistaE = g;
    if (q.get("inflacion") === "no") S.real = false;
    const com = (q.get("com") || "").toUpperCase(); if (IDS.includes(com)) S.com = com;
  }


  // ---------- Barómetro Sanitario (tema «Lo que opina la gente») ----------
  // Es una encuesta: cada cifra tiene margen de error. No se ordena a las comunidades como un registro: se dice si
  // su intervalo al 95 % queda por encima, por debajo o incluye el valor de España.
  const AVISO_OPINION_CIUDADES = "Ceuta y Melilla tienen muy pocas entrevistas (unas 30 por oleada) y márgenes de error muy grandes, así que no se muestran. Sus cifras están en las fuentes.";
  function claseOpinion(ind, id, a) {
    const v = ind.serie[id]?.[a], m = ind.margen[id]?.[a], ref = ind.espana[a];
    if (v == null || m == null || ref == null) return null;
    return v - m > ref ? 1 : v + m < ref ? -1 : 0;
  }
  // Cambio entre dos años: «sube» o «baja» solo si la diferencia supera el margen de error combinado de los dos años
  // (raíz de la suma de los cuadrados: muestras independientes). id "ES" = España.
  function cambioOpinion(ind, id, a, b) {
    const v = id === "ES" ? ind.espana : ind.serie[id] || [], m = id === "ES" ? ind.margenEspana : ind.margen[id] || [];
    if (v[a] == null || v[b] == null || m[a] == null || m[b] == null) return null;
    const d = v[b] - v[a], e = Math.hypot(m[a], m[b]);
    return { desde: v[a], hasta: v[b], d, e, c: d > e ? 1 : d < -e ? -1 : 0 };
  }
  const difOpinion = (ind, d) => ind.unidad === "pct" ? `${nf(1).format(Math.abs(d))} puntos` : fmt(Math.abs(d), ind.unidad);
  function textoCambio(ind, ch, corto = false) {
    if (ch.c === 0) return corto ? "no se distingue un cambio" : `el cambio (${ch.d >= 0 ? "+" : "−"}${difOpinion(ind, ch.d)}) no supera el margen de error (±${difOpinion(ind, ch.e)})`;
    const v = ch.c > 0 ? "sube" : "baja";
    return corto ? v : `${v} ${difOpinion(ind, ch.d)}, más que el margen de error (±${difOpinion(ind, ch.e)})`;
  }
  function textoClase(ind, c) {
    if (c == null) return "Sin margen de error calculado";
    if (c === 0) return "No se distingue de la media de España";
    if (ind.unidad === "dias_media") return c > 0 ? "Más días que la media de España" : "Menos días que la media de España";
    return c > 0 ? "Por encima de la media de España" : "Por debajo de la media de España";
  }
  const colorClase = (ind, c) => { const cols = DIV(); return c == null || c === 0 ? cols[2] : (c > 0) === ind.mejorAlto ? cols[0] : cols[4]; };
  const intervalo = (ind, id, a) => { const v = ind.serie[id]?.[a], m = ind.margen[id]?.[a]; return v == null || m == null ? "" : `entre ${fmt(v - m, ind.unidad)} y ${fmt(v + m, ind.unidad)}`; };
  function fuentesOpinion() {
    const F = DATA.barometro.fuentes;
    return `<a href="${F.serie.url}">${esc(F.serie.texto)}</a> (fichero <a href="${F.serie.url_fichero}">${esc(F.serie.fichero)}</a>); <a href="${F.informe.url}">${esc(F.informe.texto)}</a>; microdatos del CIS: ${F.microdatos.map((m) => `<a href="${m.url}">${m.anio}, estudio ${m.estudio}</a>`).join(", ")}.`;
  }
  function notasOpinion(ind) {
    const unAnio = ind && ind.fechas.length === 1;
    return `<p><b>Es una encuesta.</b> Cada cifra tiene un margen de error (intervalo de confianza al 95 %). Por eso no ordenamos a las comunidades del 1 al 17: el color dice si están por encima, por debajo o no se distinguen de la media de España. El margen lo calculamos con los microdatos del CIS (con el tamaño de muestra efectivo de Kish); es una aproximación, como el error que da el propio CIS. Al comparar 17 comunidades, alguna puede salir distinta solo por azar.</p>
      <p><b>Cambio de método en ${DATA.barometro.primerAnioMetodo}.</b> La encuesta pasó de entrevista en persona a telefónica, y en 2020 y 2021 no se hizo. Solo comparamos años del mismo método; la serie anterior se ve aparte en la evolución.</p>
      <p><b>Cambios entre años.</b> Decimos que un dato sube o baja solo si la diferencia supera el margen de error combinado de los dos años; si no, «no se distingue un cambio». Por eso no hay mapa de «Comparar años»: en la mayoría de comunidades los cambios no superan ese margen.</p>
      ${unAnio ? `<p><b>Solo ${periodo(ind, 0)}.</b> Es el único año que podemos comprobar por comunidad con las cifras que publica el Ministerio.</p>`
        : `<p><b>Cifras de 2022 a 2024.</b> Son las de la serie actual del Ministerio, que las ha recalculado: con los microdatos públicos del CIS no salen exactamente iguales (las de 2025, sí). Los márgenes de error de esos años sí salen de los microdatos.</p>`}
      <p><b>Para contrastar las cifras:</b> ${fuentesOpinion()}</p>`;
  }
  // ---------- Recursos (profesionales de atención primaria, SIAP) ----------
  const AVISO_RECURSOS_CIUDADES = "En el SIAP, Ceuta y Melilla van juntas (las gestiona el INGESA), así que no se pueden mostrar por separado.";
  function notasRecursos(fuente = "siap") {
    const R = DATA.recursos;
    if (fuente === "siae") return notasCamas();
    const F = R.fuentes.siap;
    const rep = R.repetidos.map((x) => `${NOMBRE[x.ccaa]} (${x.anio})`);
    return `<p><b>De dónde sale.</b> <a href="${F.url}">${esc(F.texto)}</a>: ${esc(F.ruta)}. Dividimos la población asignada entre los profesionales; España es el conjunto de las 17 comunidades. La población asignada de 2024 coincide con la del <a href="${F.resumen}">resumen oficial del SIAP 2024</a> (48.034.708 personas, con Ceuta y Melilla). Ese resumen, publicado antes, da algunos profesionales más que la consulta actual (31.241 médicos de familia frente a 31.118); usamos la consulta, que es la fuente detallada.</p>
      <p><b>Qué cuenta.</b> Los profesionales de los equipos de atención primaria, del modelo tradicional y de pediatría de área, a 31 de diciembre. No cuenta los de urgencias ni los residentes. Es la población que tiene asignada cada profesional en su cupo, no cuánta gente atiende de verdad ni cuánto se espera.</p>
      <p><b>Cataluña, 2020.</b> El Ministerio avisa: «${esc(R.ruptura.texto)}» Los años anteriores y posteriores no son del todo comparables.</p>
      ${rep.length ? `<p><b>Cifras repetidas.</b> En ${rep.join(", ")}, las cifras de médicos de familia, pediatras y enfermería son exactamente las del año anterior. La fuente no explica por qué.</p>` : ""}
      <p><b>No está ajustado por edad.</b> Con una población mayor, las mismas personas necesitan más consultas. El porcentaje de mayores de 65 años de cada comunidad está en su ficha, en «Contexto».</p>
      <p><b>Para comparar entre comunidades,</b> ten en cuenta que la organización cambia mucho, sobre todo en zonas rurales con muchos consultorios pequeños: lo dice el propio Ministerio en sus resúmenes del SIAP.</p>`;
  }

  // Errores de formato de las tablas del SIAE, a partir de los avisos del script (etiquetas cambiadas, tabla traspuesta).
  function erroresTablas(lista) {
    const etiq = lista.filter((x) => /trae la etiqueta/.test(x));
    const com = [...new Set(etiq.map((x) => x.match(/fila de (\w\w)/)?.[1]).filter(Boolean))].map((c) => NOMBRE[c]);
    const anios = [...new Set(etiq.map((x) => x.slice(0, 4)))];
    const trasp = lista.filter((x) => /traspuesta/.test(x)).map((x) => x.slice(0, 4));
    return (etiq.length ? `En las tablas de ${anios.join(", ")}, la fila de ${com.join(" o de ")} lleva una etiqueta equivocada («Personal y Formación»). ` : "") +
      (trasp.length ? `La tabla de ingresos de ${trasp.join(", ")} viene traspuesta (comunidades en columnas). ` : "") +
      "Identificamos cada comunidad por su posición o su código y por esas comprobaciones.";
  }

  function notasCamas() {
    const R = DATA.recursos, F = R.fuentes.siae, h = IND.hosp_camas_sns;
    const rec = R.reclasificaciones.map((x) => `<li>${esc(NOMBRE[x.ccaa])}, ${x.anio}: las camas de la red pública pasan de ${fmt(x.sns[0], "camas_mil")} a ${fmt(x.sns[1], "camas_mil")} por 1.000 habitantes y las totales, de ${fmt(x.total[0], "camas_mil")} a ${fmt(x.total[1], "camas_mil")}.</li>`).join("");
    return `<p><b>De dónde sale.</b> <a href="${F.url}">${esc(F.texto)}</a> (los años anteriores, en <a href="${F.anteriores}">«Años anteriores»</a>): ${esc(F.ruta)}. Son las tasas que publica el Ministerio, sin cálculo nuestro. Cada año sale de su propia tabla, tal como se publicó; las ediciones posteriores revisan algo algunas cifras (en España, como mucho un 0,7 %). España es la fila «TOTAL» de las tablas, que incluye Ceuta y Melilla.</p>
      <p><b>Qué cuenta.</b> Las camas en funcionamiento (las que han funcionado de media en el año), en todos los hospitales: agudos, media y larga estancia y salud mental. Se cuentan en la comunidad donde está el hospital, aunque atienda a pacientes de otras comunidades. La red pública incluye los hospitales privados con concierto sustitutorio o de una Red de Utilización Pública; esa definición es la misma desde 2010, por eso la serie empieza ese año.</p>
      ${rec ? `<p><b>Camas que cambian de clasificación.</b> Total = camas públicas + privadas. Señalamos los años en que las públicas cambian un 10 % o más y las totales menos de un 5 %: son camas que la estadística pasa a contar como públicas (o como privadas). La fuente no explica por qué.</p><ul>${rec}</ul>` : ""}
      <p><b>Cómo lo comprobamos.</b> En cada fila, la población que sale de las camas públicas y la de las totales es la misma; el porcentaje de la red pública cuadra con las camas; la fila «TOTAL» es la suma de las comunidades, y España coincide con las tablas nacionales de evolución del SIAE.${R.etiquetasSiae.length ? ` ${erroresTablas(R.etiquetasSiae)}` : ""}</p>
      <p><b>Ocupación y estancia media.</b> Son de los hospitales de agudos de la red pública (sin larga estancia ni salud mental), tal como los publica el Ministerio en las mismas tablas. Las comprobamos con su relación: ocupación = estancia media × índice de rotación (altas por cama) ÷ 365. Es una media de todo el año y de todas las camas de agudos de la comunidad: los picos de unas semanas o de unas unidades concretas (como las UCI) no se ven en ella. En 2020 la ocupación baja en las 17 comunidades; ese año coincide con la pandemia de COVID-19. La cirugía mayor ambulatoria es el «porcentaje de ambulatorización» de la red pública; lo comprobamos recalculándolo con el número de operaciones con ingreso y sin ingreso de cada fila. Conviene leer las camas, la ocupación, la estancia y la cirugía sin ingreso juntas: pocas camas muy ocupadas no es lo mismo que muchas camas medio vacías, y si los pacientes se van antes a casa, la ocupación baja aunque haya las mismas camas.</p>
      <p><b>Ingresos y hospital de día.</b> Los ingresos son los de los hospitales de la red pública por 1.000 habitantes (cálculo propio: la tasa de ingresos que publica el Ministerio por su porcentaje de la red pública). El hospital de día cuenta las sesiones de todos los hospitales, públicos y privados, porque la tabla no las separa; en 2010-2013 solo trae el número de sesiones y calculamos la tasa con la población de esa misma tabla (desde 2014, cuando la tabla sí la publica, ese cálculo coincide con ella). Comprobamos que cada tasa cuadra con el número dividido entre la población.${(R.picos || []).length ? ` Años con una cifra muy distinta (un 40 % o más) de la del año anterior y la del siguiente: ${R.picos.map((x) => `${esc(NOMBRE[x.ccaa])} ${x.anio} (${fmt(x.valores[0], "sesiones_mil")}, ${fmt(x.valores[1], "sesiones_mil")} y ${fmt(x.valores[2], "sesiones_mil")} sesiones por 1.000 habitantes)`).join("; ")}. La cifra es la oficial; la fuente no explica el salto.` : ""}</p>
      <p><b>TAC y resonancia.</b> Equipos en funcionamiento a 31 de diciembre, en la red pública y en total (públicos y privados), por cada 100.000 habitantes. Las tablas dan el número de equipos y el porcentaje de la red pública; la tasa la calculamos con la población de esa misma estadística (en 2023, que el Ministerio sí la publica, nuestro cálculo coincide). Comprobamos que la suma de las comunidades, con Ceuta y Melilla, coincide con las tablas nacionales del SIAE. ${DATA.recursos.anioEquiposSinDato}: sin dato por comunidad, porque la tabla de ese año trae las columnas desplazadas, tanto en Excel como en PDF; el dato de España sí está, en la tabla nacional. No mostramos PET ni aceleradores lineales: hay tan pocos que, en una comunidad pequeña, un solo equipo cambia mucho la tasa.</p>
      <p><b>Hospitalización a domicilio: no la mostramos.</b> Las mismas tablas la traen, pero la serie no es coherente: Extremadura declara cero todos los años y Andalucía pasa de 12 a 1,4 pacientes por 1.000 ingresos y, en 2020, a 40. La fuente no explica estas diferencias, y con una serie así comparar comunidades sería engañoso.</p>
      <p><b>No está ajustado por edad.</b> Una comunidad con más población mayor necesita, en principio, más camas, más ingresos y estancias más largas. El porcentaje de mayores de 65 años de cada comunidad está en su ficha, en «Contexto».</p>
      <p><b>Más camas no es por sí solo mejor ni peor:</b> depende de cómo se organiza la atención (cirugía sin ingreso, hospital de día, atención a domicilio) y de la edad de la población. Los hospitales de referencia atienden también a pacientes de otras comunidades. Ceuta y Melilla van juntas en la fuente.</p>`;
  }

  function rankingOpinion(cont, ind, a) {
    const vals = valores(ind, a), o = ordenados(vals), ref = ind.espana[a];
    if (!o.length) { cont.innerHTML = '<p class="nota">Sin datos.</p>'; return; }
    const W = Math.max(320, cont.clientWidth || 800), fila = 26, top = 24, H = top + o.length * fila + 24;
    const estrecho = W < 520, lab = estrecho ? 112 : 140, der = estrecho ? 44 : 60;
    const ext = o.flatMap((id) => [vals[id] - (ind.margen[id]?.[a] || 0), vals[id] + (ind.margen[id]?.[a] || 0)]).concat(ref ?? []);
    const pad = (Math.max(...ext) - Math.min(...ext)) * 0.04;
    const tk = ticks(Math.max(0, Math.min(...ext) - pad), Math.max(...ext) + pad);
    const lo = Math.min(tk[0], Math.min(...ext) - pad), hi = Math.max(tk[tk.length - 1], Math.max(...ext) + pad);
    const x = (v) => lab + ((v - lo) / (hi - lo)) * (W - lab - der);
    const fg = css("--fg"), muted = css("--muted"), line = css("--line"), surf = css("--surface");
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ind.nombre)}, ${periodo(ind, a)}, con su margen de error">`;
    tk.filter((t, i) => t >= lo && t <= hi && (!estrecho || tk.length <= 5 || i % 2 === 0)).forEach((t) => { s += `<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${top + o.length * fila}" stroke="${line}"/><text x="${x(t)}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${muted}">${fmtCorto(t, ind.unidad)}</text>`; });
    o.forEach((id, i) => {
      const y = top + i * fila, v = vals[id], m = ind.margen[id]?.[a], c = claseOpinion(ind, id, a), sel = colorSel(id);
      const cy = y + fila / 2;
      s += `<g class="barra" data-id="${id}" style="cursor:pointer" tabindex="0" role="button" aria-label="${esc(NOMBRE[id])}: ${esc(fmt(v, ind.unidad))}, ${esc(intervalo(ind, id, a))}. ${textoClase(ind, c)}. Pulsa para ${sel ? "dejar de destacar" : "destacar"}">
        <rect x="0" y="${y}" width="${W}" height="${fila}" fill="transparent"/>
        <text x="${lab - 8}" y="${cy + 4}" text-anchor="end" font-size="${estrecho ? 11.5 : 12.5}" fill="${sel ? fg : muted}" font-weight="${sel ? 700 : 400}">${esc(NOMBRE[id])}</text>
        ${m != null ? `<path d="M${x(v - m)},${cy}H${x(v + m)}M${x(v - m)},${y + 9}V${y + fila - 9}M${x(v + m)},${y + 9}V${y + fila - 9}" stroke="${muted}" stroke-width="1.5" fill="none"/>` : ""}
        <circle cx="${x(v)}" cy="${cy}" r="${sel ? 7 : 6}" fill="${colorClase(ind, c)}" stroke="${sel || surf}" stroke-width="${sel ? 2.5 : 2}"/>
        <text x="${x(v + (m || 0)) + 6}" y="${cy + 4}" font-size="12" fill="${fg}" class="num">${estrecho ? fmtCorto(v, ind.unidad) : fmt(v, ind.unidad)}</text>
      </g>`;
    });
    const yb = top + o.length * fila;
    if (ref != null) s += `<line x1="${x(ref)}" x2="${x(ref)}" y1="${top - 4}" y2="${yb + 4}" stroke="${fg}" stroke-dasharray="3 3" stroke-width="1.2"/>
      <text x="${x(ref)}" y="${top - 10}" text-anchor="middle" font-size="11.5" font-weight="600" fill="${fg}" paint-order="stroke" stroke="${surf}" stroke-width="4">España: ${fmt(ref, ind.unidad)}</text>`;
    cont.innerHTML = s + "</svg>";
    cont.querySelectorAll(".barra").forEach((g) => {
      const id = g.dataset.id;
      g.onclick = () => { alternarSel(id); render(); };
      g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternarSel(id); render(); } };
      g.onmousemove = (e) => showTip(`<b>${esc(NOMBRE[id])}</b><br>${fmt(vals[id], ind.unidad)} (${intervalo(ind, id, a)})<br>${textoClase(ind, claseOpinion(ind, id, a))}`, e.clientX, e.clientY);
      g.onmouseleave = hideTip;
    });
  }
  function tablaOpinion(cont, ind, a) {
    const vals = valores(ind, a), o = ordenados(vals), u = ind.unidad;
    const filas = o.map((id) => `<tr class="${id === S.com ? "tuya" : ""}"><td>${esc(NOMBRE[id])}</td><td>${fmt(vals[id], u)}</td><td>${ind.margen[id]?.[a] != null ? `± ${fmt(ind.margen[id][a], u)}` : "—"}</td><td>${textoClase(ind, claseOpinion(ind, id, a))}</td></tr>`).join("");
    cont.innerHTML = `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Comunidad</th><th>${periodo(ind, a)}</th><th>Margen de error (95 %)</th><th>Frente a España</th></tr></thead><tbody>${filas}
      <tr><td>España</td><td>${fmt(ind.espana[a], u)}</td><td>${ind.margenEspana[a] != null ? `± ${fmt(ind.margenEspana[a], u)}` : "—"}</td><td></td></tr></tbody></table></div>
      <div class="cta" style="margin-top:14px"><button type="button" class="btn" id="csv">Descargar CSV (${periodo(ind, primero(ind))}${tieneSerie(ind) ? ` – ${periodo(ind, ultimo(ind))}` : ""}${ind.historico ? ", con la serie anterior" : ""})</button></div>`;
    $("#csv").onclick = () => descargarCSV(ind);
  }
  function filasCSVOpinion(ind) {
    const n = (v) => v == null ? "" : String(+v.toFixed(3)).replace(".", ",");
    const fuente = "Ministerio de Sanidad y CIS, Barómetro Sanitario";
    const filas = [["indicador", "comunidad", "anio", "valor", "margen_error_95", "frente_a_espana", "metodo", "fuente"]];
    periodos(ind).forEach((a) => {
      IDS.forEach((id) => filas.push([ind.nombre, NOMBRE[id], ind.fechas[a], n(ind.serie[id]?.[a]), n(ind.margen[id]?.[a]), textoClase(ind, claseOpinion(ind, id, a)), "entrevista telefónica", fuente]));
      filas.push([ind.nombre, "España", ind.fechas[a], n(ind.espana[a]), n(ind.margenEspana[a]), "", "entrevista telefónica", fuente]);
    });
    if (ind.historico) ind.historico.fechas.forEach((f, i) => {
      [...IDS, "ES"].forEach((id) => {
        const v = id === "ES" ? ind.historico.espana[i] : ind.historico.serie[id]?.[i];
        if (v != null) filas.push([ind.nombre, id === "ES" ? "España" : NOMBRE[id], f, n(v), "", "", "entrevista en persona (serie anterior a 2022, no comparable)", fuente]);
      });
    });
    return filas;
  }
  function evolucionOpinion(cont, ind) {
    const h = ind.historico;
    cont.innerHTML = `<div class="evo-a"></div>` + (h ? `<div class="evo-hist"><h3>Antes del cambio de método: ${h.fechas[0]}-${h.fechas.at(-1)}, entrevista en persona</h3>
      <p class="sub">Serie oficial anterior, sin margen de error. No se compara con la de arriba: en 2022 la encuesta pasó a hacerse por teléfono, y en 2020 y 2021 no se hizo. Si ves un salto entre 2019 y 2022, en esos años coinciden la pandemia y el cambio de método, y los datos no permiten saber cuánto se debe a cada cosa.</p>
      <div class="evo-b"></div></div>` : "");
    lineas(cont.querySelector(".evo-a"), ind);
    if (h) lineas(cont.querySelector(".evo-b"), { ...ind, id: `${ind.id}~hist`, nombre: `${ind.nombre} (${h.fechas[0]}-${h.fechas.at(-1)})`, fechas: h.fechas, serie: h.serie, espana: h.espana, historico: null });
  }
  function renderOpinionFicha(id) {
    const inds = DATA.inds.filter((i) => i.grupo === "opinion"), vs = S.vs;
    $("#c-opinion-sub").textContent = "Barómetro Sanitario (encuesta del Ministerio de Sanidad y el CIS). Cada cifra tiene margen de error, así que se compara con la media de España.";
    $("#c-opinion").innerHTML = inds.map((ind) => {
      const a = ultimo(ind), v = ind.serie[id]?.[a], c = claseOpinion(ind, id, a);
      return `<div class="ctx"><div class="ctx-t">${esc(ind.corto)} · ${periodo(ind, a)}</div><div class="ctx-v">${fmt(v, ind.unidad)}</div>
        <div class="ctx-d">${v == null ? "Sin dato" : `${intervalo(ind, id, a)}. ${textoClase(ind, c)} (${fmt(ind.espana[a], ind.unidad)})`}</div>
        ${(() => { const ch = a > 0 ? cambioOpinion(ind, id, 0, a) : null; return ch ? `<div class="ctx-d">Desde ${ind.fechas[0]} (${fmt(ch.desde, ind.unidad)}): <b>${textoCambio(ind, ch, true)}</b></div>` : ""; })()}
        ${vs && ind.serie[vs]?.[a] != null ? `<div class="vs">${esc(NOMBRE[vs])}: ${fmt(ind.serie[vs][a], ind.unidad)}</div>` : ""}</div>`;
    }).join("");
    $("#c-opinion-notas").innerHTML = plegable("opinion-ficha", "¿Qué mide cada dato y de dónde sale?",
      `<ul>${inds.map((i) => `<li><b>${esc(i.corto)}.</b> ${esc(i.desc)}</li>`).join("")}</ul>` + notasOpinion(inds[0]));
  }

  function ranking(cont, vals, ind) {
    const ciu = ind.grupo === "espera" ? Object.keys(CIUDADES).filter((k) => datoCiudad(ind, k) != null) : [];
    const o = ordenados(vals);
    if (!o.length && !ciu.length) { cont.innerHTML = '<p class="nota">Sin valores comparables para el ranking.</p>'; return; }
    const W = Math.max(320, cont.clientWidth || 800), fila = 26, top = 8, extra = ciu.length ? 30 + ciu.length * fila : 0, H = top + o.length * fila + 26 + extra;
    const lab = W < 520 ? 92 : 140, der = 70;
    const todos = [...o.map((id) => vals[id]), ...ciu.map((k) => datoCiudad(ind, k))];
    const lo = Math.min(0, ...todos), hi = Math.max(0, ...todos);
    const x = (v) => lab + ((v - lo) / (hi - lo || 1)) * (W - lab - der);
    // Barra desde el cero (los cambios pueden ser negativos), con el extremo de datos redondeado.
    const barra = (y, v, rel) => { const a = Math.min(x(0), x(v)), w = Math.abs(x(v) - x(0));
      return `<rect x="${a}" y="${y + 5}" width="${Math.max(w, 1)}" height="${fila - 10}" rx="3" ${rel}/>`; };
    // Recursos: la referencia es España (toda la población asignada entre todos los profesionales), como en el SIAP.
    const refEsp = esRecurso(ind) && !/~cambio$/.test(ind.id);
    const m = refEsp ? ind.espana[indice(ind, S.anioP)] : media(vals);
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
    const xm = Number.isFinite(m) ? x(m) : x(0), y17 = top + o.length * fila;
    if (o.length) s += `<line x1="${xm}" x2="${xm}" y1="${top - 4}" y2="${y17 + 4}" stroke="${fg}" stroke-dasharray="3 3" stroke-width="1.2"/>
      <text x="${xm}" y="${y17 + 18}" text-anchor="middle" font-size="11.5" fill="${muted}">${refEsp ? "España" : `media de las ${o.length}`}: ${fmt(m, ind.unidad)}</text>`;
    s += `<line x1="${x(0)}" x2="${x(0)}" y1="${top}" y2="${y17}" stroke="${line}"/>`;
    if (ciu.length) {
      const y0 = y17 + 30;
      s += `<line x1="0" x2="${W}" y1="${y0 - 4}" y2="${y0 - 4}" stroke="${line}"/><text x="0" y="${y0 + 10}" font-size="11" fill="${muted}">Aparte, sin puesto:</text>`;
      ciu.forEach((k, i) => {
        const y = y0 + 14 + i * fila, v = datoCiudad(ind, k);
        s += `<g class="barra-ciu" data-id="${k}"><text x="${lab - 8}" y="${y + fila / 2 + 4}" text-anchor="end" font-size="12.5" fill="${muted}" font-style="italic">${CIUDADES[k]}*</text>
          ${barra(y, v, `fill="none" stroke="${muted}" stroke-dasharray="3 2"`)}
          <text x="${v < 0 ? x(0) + 6 : x(v) + 6}" y="${y + fila / 2 + 4}" font-size="12" fill="${fg}" class="num">${fmt(v, ind.unidad)}</text></g>`;
      });
    }
    s += `</svg>`;
    cont.innerHTML = s;
    cont.querySelectorAll(".barra").forEach((g) => {
      const id = g.dataset.id;
      g.onclick = () => { alternarSel(id); render(); };
      g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternarSel(id); render(); } };
      const enPuntos = ["pct", "pp", "var"].includes(ind.unidad);
      const dif = enPuntos ? `${vals[id] >= m ? "+" : "−"}${nf(1).format(Math.abs(vals[id] - m))} puntos porcentuales frente a la media`
        : m === 0 ? "Igual a la media"
        : `${vals[id] >= m ? "+" : "−"}${nf(0).format(Math.abs(vals[id] / m - 1) * 100)} % frente a la media`;
      g.onmousemove = (e) => showTip(`<b>${esc(NOMBRE[id])}</b><br>${fmt(vals[id], ind.unidad)}<br>${puestoTxt(ind, o.indexOf(id) + 1, o.length)}<br>${dif}`, e.clientX, e.clientY);
      g.onmouseleave = hideTip;
    });
  }

  function tabla(cont, ind, anio, ordenMapa) {
    const u = ind.unidad, b0 = base0(ind);
    const serie = tieneSerie(ind) && b0 < anio;
    const vals = valores(ind, anio), m = media(vals);
    const o = ordenados(ordenMapa);
    const territorios = ind.grupo === "espera" ? IDS : ordenados(vals);
    const ids = [...o, ...territorios.filter((id) => ordenMapa[id] == null)];
    const base = serie ? valores(ind, b0) : null;
    const comparable = serie && comparar(ind, b0, anio);
    const signo = (x, txt) => /^0( |$)/.test(txt) ? `<span class="neg">≈ ${txt}</span>` : `<span class="${x < 0 ? "neg" : ""}">${x >= 0 ? "+" : "−"}${txt}</span>`;
    const difMedia = (v) => {
      if (v == null || !Number.isFinite(m)) return "—";
      if (u === "pct") return signo(v - m, nf(1).format(Math.abs(v - m)) + " p.");
      return m === 0 ? "—" : signo(v - m, nf(0).format(Math.abs(v / m - 1) * 100) + " %");
    };
    const cambio = (id) => {
      const d = comparable ? diferencia(ind, dato(ind, id, b0), dato(ind, id, anio)) : null;
      return d == null ? "—" : signo(d, nf(u === "pct" ? 1 : 0).format(Math.abs(d)) + (u === "pct" ? " p." : " %"));
    };
    const pac = pacientesDe(ind, anio);
    const mostrarCambioPac = !!pac && S.modo === "cambio";
    const cambioPac = mostrarCambioPac ? cambioPacientes(ind, b0, anio, pac) : null;
    const deltaPac = (v) => v == null ? "—" : firmado(v, 0);
    const celdasPac = (id) => pac
      ? `<td>${fmt(pac[id], "num")}</td>${mostrarCambioPac ? `<td>${deltaPac(cambioPac?.cambios[id])}</td>` : ""}` : "";
    const cab = `<tr><th>#</th><th>Comunidad</th>${serie ? `<th>${periodo(ind, b0, true)}${sinInfl(ind) ? ` <span style="font-weight:400">(en € de ${ULT})</span>` : ""}</th>` : ""}<th>${periodo(ind, anio, true)}</th>${serie ? `<th>Cambio${mostrarCambioPac ? " del indicador" : sinInfl(ind) ? " real" : ""}</th>` : ""}<th>Frente a la media</th>${pac ? `<th>Pacientes en espera (${periodo(ind, anio, true)})</th>` : ""}${mostrarCambioPac ? "<th>Cambio de pacientes</th>" : ""}</tr>`;
    const filas = ids.map((id, i) => `<tr class="${id === S.com ? "tuya" : ""}"><td>${i < o.length ? i + 1 : "—"}</td><td>${esc(NOMBRE[id])}</td>${serie ? `<td>${fmt(base[id], u)}</td>` : ""}<td>${fmt(vals[id], u)}</td>${serie ? `<td>${cambio(id)}</td>` : ""}<td>${difMedia(vals[id])}</td>${celdasPac(id)}</tr>`).join("");
    const recuentos = pac ? IDS.map((id) => pac[id]).filter((v) => v != null) : [];
    const totalPac = recuentos.length ? recuentos.reduce((s, v) => s + v, 0) : null;
    const cobertura = cambioPac?.total != null
      ? ` <span style="font-weight:400">${cambioPac.n === IDS.length ? "en total" : `en ${cambioPac.n} ${cambioPac.n === 1 ? "comunidad" : "comunidades"}`}</span>` : "";
    const pie = `<tr><td></td><td>Media de las comunidades con dato</td>${serie ? `<td>${fmt(media(base), u)}</td>` : ""}<td>${fmt(m, u)}</td>${serie ? "<td></td>" : ""}<td></td>${pac ? `<td>${fmt(totalPac, "num")}${totalPac != null ? ' <span style="font-weight:400">en total</span>' : ""}</td>` : ""}${mostrarCambioPac ? `<td>${deltaPac(cambioPac?.total)}${cobertura}</td>` : ""}</tr>`;
    const nCol = 4 + (serie ? 2 : 0) + (pac ? 1 : 0) + (mostrarCambioPac ? 1 : 0);
    const ciu = ind.grupo === "espera" ? Object.keys(CIUDADES).filter((k) => datoCiudad(ind, k) != null || pac?.[k] != null || serie && datoCiudad(ind, k, b0) != null) : [];
    const filasC = ciu.length ? `<tr class="sep"><td colspan="${nCol}">Aparte: no cuentan para la media ni los puestos</td></tr>` +
      ciu.map((k) => `<tr class="ciudad"><td>—</td><td>${CIUDADES[k]}*</td>${serie ? `<td>${fmt(datoCiudad(ind, k, b0), u)}</td>` : ""}<td>${fmt(datoCiudad(ind, k), u)}</td>${serie ? `<td>${cambio(k)}</td>` : ""}<td>${difMedia(datoCiudad(ind, k))}</td>${celdasPac(k)}</tr>`).join("") : "";
    cont.innerHTML = `<div class="tabla-wrap"><table class="tabla"><thead>${cab}</thead><tbody>${filas}${pie}${filasC}</tbody></table></div>
      <div class="cta" style="margin-top:14px"><button type="button" class="btn" id="csv">Descargar CSV${serie ? ` (${periodo(ind, primero(ind), true)} – ${periodo(ind, ultimo(ind), true)})` : ""}</button></div>`;
    $("#csv").onclick = () => descargarCSV(ind);
  }
  function descargarCSV(ind) {
    const n = (v) => v == null ? "" : String(+v.toFixed(3)).replace(".", ",");
    let filas;
    if (ind.grupo === "opinion") filas = filasCSVOpinion(ind);
    else if (esRecurso(ind)) {
      // Qué es dato publicado tal cual y qué es cálculo propio, indicador a indicador
      const fuente = ind.fuente === "siap" ? "Ministerio de Sanidad, SIAP (cálculo propio: población asignada / profesionales)"
        : /^hosp_(tac|rm)_/.test(ind.id) ? "Ministerio de Sanidad, SIAE (cálculo propio: equipos / población de la propia estadística; España, de la tabla nacional)"
        : ind.id === "hosp_ingresos" ? "Ministerio de Sanidad, SIAE (cálculo propio: ingresos por 1.000 hab. × % de la red pública, ambos publicados)"
        : ind.id === "hosp_dia" ? "Ministerio de Sanidad, SIAE (dato publicado; 2010-2013, cálculo propio con la población de la propia estadística)"
        : "Ministerio de Sanidad, SIAE (dato publicado en las tablas por comunidad de cada año)";
      filas = [["indicador", "comunidad", "anio", "valor", "fuente"]];
      [...IDS, "ES"].forEach((id) => periodos(ind).forEach((a, i) => filas.push([ind.nombre, id === "ES" ? (ind.fuente === "siae" ? "España (con Ceuta y Melilla)" : "España (las 17)") : NOMBRE[id], a, n(id === "ES" ? ind.espana[i] : ind.serie[id][i]), fuente])));
    }
    else if (ind.grupo === "gasto") {
      const real = enEuros(ind);
      filas = [["indicador", "comunidad", "anio", real ? "valor_euros_corrientes" : "valor", ...(real ? [`valor_euros_${ULT}`] : []), "provisional"]];
      IDS.forEach((id) => periodos(ind).forEach((a, i) => filas.push([ind.nombre, NOMBRE[id], a, n((real ? ind.serieNom : ind.serie)[id][i]), ...(real ? [n(ind.serieReal[id][i])] : []), esProv(a) ? "si" : "no"])));
    } else {
      filas = [["indicador", "comunidad", "fecha", "valor", "pacientes_en_espera", "nota"]];
      CORTES.forEach((c, a) => {
        const pac = pacientesDe(ind, a);
        for (const id of [...IDS, ...Object.keys(CIUDADES)]) {
          const v = dato(ind, id, a);
          const nota = [CIUDADES[id] ? "Ciudad autónoma: fuera de la media" : "", v == null ? "Sin dato en el informe" : "",
            ind.tipo === "consultas" && c.id === "2023-06" ? "Datos de consultas repetidos respecto a diciembre de 2022 (salvo tasas)" : "",
            ind.tipo === "consultas" && ind.medida === "pct_largo"
              ? (c.id < "2024-12" ? "Porcentaje referido a pacientes con cita asignada" : "El porcentaje incluye también a pacientes sin cita que superaban 60 días") : ""].filter(Boolean).join(". ");
          filas.push([ind.nombre, NOMBRE[id] || CIUDADES[id], c.id, n(v), n(pac[id]), nota]);
        }
      });
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
    const gy = ind, nombreY = gy.campoNombre ? `${gy.corto} en ${gy.campoNombre.toLowerCase()}` : gy.corto;
    $("#x-y").innerHTML = ""; $("#x-y").classList.remove("seg");
    const vx = valores(gx, ULT), vy = valores(gy, S.anioP);
    const ids = IDS.filter((id) => vx[id] != null && vy[id] != null);
    if (ids.length < 3) {
      $("#x-titulo").textContent = "¿Van juntos el gasto y la espera?";
      $("#x-sub").textContent = `Pocos datos de espera para ${periodo(gy, S.anioP)} y la especialidad o el proceso elegido.`;
      $("#x-chart").innerHTML = "";
      $("#x-nota").textContent = "Fuente: Ministerio de Sanidad.";
      return;
    }
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
    $("#x-sub").textContent = `Cada punto es una comunidad: a la derecha, más gasto por habitante (${ULT}); arriba, ${nombreY.toLowerCase()} (${CORTES[S.anioP].fecha}). Cambia la tarjeta o la especialidad de arriba para comparar otra espera.`;
    const cont = $("#x-chart");
    const W = Math.max(320, cont.clientWidth || 800), H = W < 520 ? 340 : 420;
    const L = W < 520 ? 54 : 64, R = 24, T = 16, B = 40;
    const xs = ids.map((id) => vx[id]), ys = ids.map((id) => vy[id]);
    const px = (Math.max(...xs) - Math.min(...xs)) * 0.08 || 1, py = (Math.max(...ys) - Math.min(...ys)) * 0.1 || 1;
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
    const c2 = (v) => Number.isFinite(v) ? (v < 0 ? "−" : "") + nf(2).format(Math.abs(v)) : "—";
    const relacion = Number.isFinite(r) && Number.isFinite(rho)
      ? `Correlación ${c2(r)} (Pearson) y ${c2(rho)} por rangos (Spearman), en una escala de −1 a 1. Con ${ids.length} comunidades, cualquier valor entre −${c2(rc)} y +${c2(rc)} podría deberse al azar. ${clara ? `En este corte puedes explorar hasta ${combinaciones} combinaciones. A un nivel del 5 %, algunas podrían superar el umbral por azar.` : "Las cifras no ofrecen evidencia clara de relación."}`
      : "Los datos de este corte no permiten calcular la correlación porque una de las variables tiene el mismo valor en todas las comunidades con dato.";
    $("#x-nota").innerHTML = plegable("xy", "Cómo leer este gráfico: correlación, causas y fechas", `<ul class="leer">
      <li><b>Qué muestra:</b> cada punto es una comunidad; las líneas discontinuas marcan la media de las ${ids.length}. ${conTuya ? "" : `${esc(NOMBRE[c0])} no aparece: el informe no trae ese dato. `}Sin Ceuta y Melilla (no tienen gasto comparable).</li>
      <li><b>Relación</b> ${relacion}</li>
      <li><b>Ir juntos no es causar:</b> ${clara ? "esta relación no prueba" : "ni aunque hubiera relación probaría"} que gastar más acorte o alargue la espera. Influyen otros factores que el gráfico no tiene en cuenta: la edad de la población, la dispersión geográfica, las derivaciones a centros concertados, el seguro privado, la organización de cada servicio y cómo registra cada comunidad sus listas.</li>
      <li><b>Fechas distintas:</b> el gasto es de ${ULT}${esProv(ULT, IND.gasto_hab) ? " (provisional)" : ""} y la espera, la situación a ${CORTES[S.anioP].fecha}.</li>
      <li><b>Comunidades, no personas:</b> compara cifras de comunidades enteras; no dice nada de lo que espera cada paciente.</li>
    </ul><a href="#metodo-comparar">Más en «Cómo leer los datos»</a>`);
  }

  function ticks(min, max, n = 5) {
    const paso0 = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(paso0)));
    const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= paso0);
    const out = []; for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(+v.toFixed(6));
    return out;
  }

  // Años del eje horizontal según el espacio: siempre el primero y el último; en medio, cada 2, 4, 5 o 10 años
  // (el menor salto que deje sitio a cada etiqueta) y sin años intermedios pegados al último.
  function aniosEje(ancho, fuente = 11, anios = ANIOS) {
    const anchoEtiqueta = fuente * 2.6 + 10; // «2024» más un margen
    const a0 = anios[0], aN = anios.at(-1);
    const porAnio = ancho / (aN - a0);
    const paso = [2, 4, 5, 10].find((p) => p * porAnio >= anchoEtiqueta) || 10;
    const out = anios.filter((a) => (a - a0) % paso === 0 && (aN - a) * porAnio >= anchoEtiqueta);
    return [...out, aN];
  }

  function lineas(cont, ind) {
    const fechas = periodos(ind), inicio = primero(ind), fin = ultimo(ind);
    const salto = (a, b) => !comparar(ind, a, b);
    const W = Math.max(320, cont.clientWidth || 800), H = W < 520 ? 300 : 380;
    const L = W < 520 ? 56 : 64, R = W < 520 ? 74 : 120, T = 14, B = 30;
    const todos = IDS.flatMap((id) => (ind.serie[id] || [])).filter((v) => v != null);
    if (!todos.length) { cont.innerHTML = '<p class="nota">Sin datos para esta serie.</p>'; return; }
    let ymin = Math.min(...todos), ymax = Math.max(...todos);
    const pad = (ymax - ymin) * 0.06 || 1; ymin = Math.max(0, ymin - pad); ymax += pad;
    const tk = ticks(ymin, ymax); ymin = Math.min(ymin, tk[0]); ymax = Math.max(ymax, tk[tk.length - 1]);
    const x = (a) => L + ((a - inicio) / (fin - inicio)) * (W - L - R);
    const y = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
    const fg = css("--fg"), muted = css("--muted"), line = css("--line"), grey = css("--grey-line"), noteBg = css("--note-bg"), note = css("--note");
    const path = (serie = []) => serie.map((v, i) => !Number.isFinite(v) ? "" :
      `${!i || !Number.isFinite(serie[i - 1]) || salto(fechas[i - 1], fechas[i]) ? "M" : "L"}${x(fechas[i]).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const valoresPorFecha = fechas.map((_, i) => IDS.map((id) => ind.serie[id]?.[i]).filter(Number.isFinite));
    const medias = ind.espana ? fechas.map((_, i) => ind.espana[i] ?? null) : valoresPorFecha.map(media);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de ${esc(ind.nombre)}">`;
    if (ind.grupo === "gasto" && DATA.prov.length) s += `<rect x="${x(DATA.prov[0]) - (x(2023) - x(2022)) / 2}" y="${T}" width="${x(fin) - x(DATA.prov[0]) + (x(2023) - x(2022)) / 2}" height="${H - T - B}" fill="${noteBg}"/>
          <text x="${x(fin)}" y="${T + 12}" text-anchor="end" font-size="10.5" fill="${note}">provisional</text>`;
    tk.forEach((v) => { s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${line}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${muted}">${fmtCorto(v, ind.unidad)}</text>`; });
    const paso = Math.max(1, Math.ceil(58 * (fin - inicio) / (W - L - R)));
    const etiquetasEje = ind.grupo === "gasto" || esRecurso(ind) ? aniosEje(W - L - R, 11, fechas) :
      fechas.filter((a) => a === fin || (a - inicio) % paso === 0 && fin - a >= paso);
    etiquetasEje.forEach((a) => { s += `<text x="${x(a)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${muted}">${periodo(ind, a, true)}</text>`; });
    IDS.filter((id) => !colorSel(id)).forEach((id) => { s += `<path d="${path(ind.serie[id])}" fill="none" stroke="${grey}" stroke-width="1.2"/>`; });
    s += `<path d="${path(medias)}" fill="none" stroke="${fg}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    // etiquetas finales sin solapar
    const etiquetas = [];
    if (Number.isFinite(medias.at(-1))) etiquetas.push({ id: "media", txt: ind.espana ? "España" : "Media", v: medias.at(-1), c: fg });
    S.sel.forEach((sl) => {
      const c = css(SLOTS[sl.slot]);
      s += `<path d="${path(ind.serie[sl.id])}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>`;
      const serie = ind.serie[sl.id] || [];
      if (ind.grupo === "espera") serie.forEach((v, i) => {
        if (v != null) s += `<circle cx="${x(fechas[i])}" cy="${y(v)}" r="2.8" fill="${c}"/>`;
      });
      const v = serie.at(-1);
      if (v == null) return;
      s += `<circle cx="${x(fin)}" cy="${y(v)}" r="4" fill="${c}" stroke="${css("--surface")}" stroke-width="2"/>`;
      etiquetas.push({ id: sl.id, txt: NOMBRE[sl.id], v, c });
    });
    etiquetas.sort((a, b) => y(a.v) - y(b.v));
    let ult = -Infinity;
    etiquetas.forEach((e) => { const yy = Math.max(y(e.v) + 4, ult + 14); ult = yy;
      s += `<text x="${x(fin) + 8}" y="${yy}" font-size="12" font-weight="${e.id === "media" ? 400 : 700}" fill="${e.id === "media" ? muted : fg}">${esc(W < 520 ? (ABR[e.id] || e.txt) : e.txt)}</text>`; });
    s += `<line id="cruz" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="${muted}" stroke-width="1" visibility="hidden"/>
          <rect id="zona" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
    // Notas del Ministerio de las comunidades destacadas: un número sobre su línea y la explicación debajo.
    // Notas del Ministerio (círculo continuo) y variaciones inusuales sin explicar (círculo discontinuo)
    // de las comunidades destacadas, numeradas sobre su línea y explicadas debajo.
    const marcas = ind.grupo !== "gasto" ? [] : S.sel.flatMap((sl) => [
      ...notasDe(sl.id).map((n) => ({ ccaa: n.ccaa, anio: n.anio, tipo: "nota", texto: n.texto, c: css(SLOTS[sl.slot]) })),
      ...avisosDe(ind.id, sl.id).map((a) => ({ ccaa: a.ccaa, anio: a.anio, tipo: "aviso", texto: textoAviso(a, false), c: css(SLOTS[sl.slot]) })),
      ...entidadesDe(sl.id).map((e) => ({ ccaa: e.ccaa, anio: e.anio, tipo: "entidades", texto: textoEntidades(e, false), c: css(SLOTS[sl.slot]) })),
    ]).sort((a, b) => a.ccaa.localeCompare(b.ccaa) || a.anio - b.anio);
    // Marcas pequeñas sobre la línea, sin números: el detalle va en el recuadro al pasar por el año y en un
    // desplegable debajo (cerrado por defecto), para que el gráfico no se llene de texto.
    // Nota del Ministerio: círculo; variación inusual: círculo discontinuo; cambio de entidades: cuadrado.
    const apiladas = {};
    marcas.forEach((n) => {
      const v = ind.serie[n.ccaa][n.anio - inicio];
      if (v == null) return;
      const clave = `${n.ccaa}|${n.anio}`, nivel = apiladas[clave] = (apiladas[clave] ?? -1) + 1;
      s += `<g aria-hidden="true" pointer-events="none">${formaMarca(n.tipo, x(n.anio), y(v) - nivel * 11, n.c, css("--surface"))}</g>`;
    });
    s += `</svg>`;
    const fuera = (k) => !S.sel.some((sl) => sl.id === k);
    const otrasNotas = ind.grupo !== "gasto" ? [] : [...new Set(NOTAS.map((n) => n.ccaa))].filter(fuera);
    const otrosAvisos = [...new Set(avisosDe(ind.id).map((a) => a.ccaa))].filter(fuera);
    const otrasEntidades = ind.grupo !== "gasto" ? [] : [...new Set(ENTIDADES.map((e) => e.ccaa))].filter(fuera);
    const recl = esRecurso(ind) && ind.fuente === "siae" && ind.unidad === "camas_mil" ? DATA.recursos.reclasificaciones : [];
    const tipos = [...new Set(marcas.map((n) => n.tipo))];
    const leyenda = tipos.map((t) => `<span class="marca-ley">${iconoMarca(t)}${LEYENDA_MARCA[t]}</span>`).join("");
    const otras = (otrasNotas.length ? `<p>El Ministerio explica saltos en las series de ${otrasNotas.map((k) => esc(NOMBRE[k])).join(", ")}.</p>` : "") +
      (otrosAvisos.length ? `<p>Hay variaciones inusuales sin explicación oficial en este dato en ${otrosAvisos.map((k) => esc(NOMBRE[k])).join(", ")}.</p>` : "") +
      (otrasEntidades.length ? `<p>Cambia la lista de entidades que cuenta la estadística en ${otrasEntidades.map((k) => esc(NOMBRE[k])).join(", ")}.</p>` : "") +
      (otrasNotas.length || otrosAvisos.length || otrasEntidades.length ? `<p>Destaca una comunidad para verlo en el gráfico.</p>` : "") +
      (recl.length ? `<p>Camas que pasan a contarse en otra red (pública o privada): ${recl.map((x) => `${esc(NOMBRE[x.ccaa])} en ${x.anio}`).join(", ")}. Detalle en «Qué mide este dato».</p>` : "");
    const nombresSel = S.sel.filter((sl) => marcas.some((n) => n.ccaa === sl.id)).map((sl) => NOMBRE[sl.id]);
    s += `<div class="notas-oficiales">` + (marcas.length
      ? `<p class="marcas-cab">En el gráfico: ${leyenda}<span class="marca-ayuda">Pasa el ratón (o toca) por un año para verlas.</span></p>`
      : "") +
      (marcas.length || otras
        ? plegable("evolucion", marcas.length ? `Ver las ${marcas.length} ${marcas.length === 1 ? "nota" : "notas"} de ${esc(nombresSel.length > 1 ? `${nombresSel.slice(0, -1).join(", ")} y ${nombresSel[nombresSel.length - 1]}` : nombresSel[0])}` : recl.length ? "Notas sobre la serie" : "Notas sobre otras comunidades",
          (marcas.length ? `<ul>${marcas.map((n) => `<li><b>${iconoMarca(n.tipo)}${TIPO_MARCA[n.tipo]} · ${esc(NOMBRE[n.ccaa])}, ${n.anio}.</b> ${esc(n.texto)}</li>`).join("")}</ul>` : "") +
          (marcas.some((n) => n.tipo === "entidades") ? `<p>${esc(AVISO_ENTIDADES)} <a href="#metodo-entidades">Más información</a>.</p>` : "") +
          otras + (ind.grupo === "gasto" ? `<p><a href="#metodo-calidad">Cómo detectamos las variaciones inusuales</a>.</p>` : ""))
        : "") + `</div>`;
    cont.innerHTML = s;
    const svg = cont.querySelector("svg"), cruz = svg.querySelector("#cruz");
    svg.querySelector("#zona").onmousemove = (e) => {
      const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(fechas.length - 1, Math.round(((px - L) / (W - L - R)) * (fin - inicio))));
      const a = fechas[i];
      cruz.setAttribute("x1", x(a)); cruz.setAttribute("x2", x(a)); cruz.setAttribute("visibility", "visible");
      const filas = S.sel.map((sl) => `<span style="color:${css(SLOTS[sl.slot])}">●</span> ${esc(NOMBRE[sl.id])}: ${fmt(ind.serie[sl.id]?.[i], ind.unidad)}`);
      const n = valoresPorFecha[i].length;
      if (ind.espana) filas.push(`España: ${fmt(medias[i], ind.unidad)}`);
      else filas.push(n
        ? `Media${ind.grupo === "espera" ? ` de ${n} ${n === 1 ? "comunidad" : "comunidades"}` : ""}: ${fmt(medias[i], ind.unidad)}`
        : "Sin datos para calcular la media");
      const delAnio = marcas.filter((n) => n.anio === a);
      const extra = delAnio.length ? `<div class="tip-marcas">${delAnio.map((n) => `${iconoMarca(n.tipo, n.c)}${TIPO_MARCA[n.tipo]} (${esc(ABR[n.ccaa] || NOMBRE[n.ccaa])})`).join("<br>")}<br><span class="tip-ayuda">Detalle debajo del gráfico</span></div>` : "";
      showTip(`<b>${periodo(ind, a)}${esProv(a, ind) ? " (provisional)" : ""}</b><br>${filas.join("<br>")}${extra}`, e.clientX, e.clientY);
    };
    svg.querySelector("#zona").onclick = svg.querySelector("#zona").onmousemove;
    svg.querySelector("#zona").onmouseleave = () => { cruz.setAttribute("visibility", "hidden"); hideTip(); };
  }

  // ---------- TU COMUNIDAD ----------
  // En la fila «Gasto por habitante» de la ficha, una línea con el dato ajustado por edad (no una fila aparte: diría
  // casi lo mismo que la anterior). El puesto puede cambiar mucho: por eso se muestra siempre, no solo al pedirlo.
  function lineaEdad(ind, id, vs, anio) {
    if (ind.id !== "gasto_hab" || !EDAD) return "";
    const que = `<a href="#metodo-edad">¿Qué es esto?</a>`;
    if (!periodos(EDAD).includes(anio)) return `<div class="edad-ficha">Ajuste por edad: disponible desde ${EDAD.anios[0]}. ${que}</div>`;
    const ve = valores(EDAD, anio), oe = ordenados(ve);
    if (ve[id] == null) return "";
    const puesto = puestoTxt(EDAD, oe.indexOf(id) + 1, oe.length);
    return `<div class="edad-ficha">Ajustado por edad: <b>${fmt(ve[id], "eur_hab")}</b> · ${puesto.charAt(0).toLowerCase() + puesto.slice(1)}` +
      `${vs && ve[vs] != null ? ` · ${esc(NOMBRE[vs])}: ${fmt(ve[vs], "eur_hab")}` : ""}. ${que}</div>`;
  }

  // ---------- Contexto de la comunidad (ficha) ----------
  // Cuatro datos que ayudan a entender el gasto, sin corregirlo. Tres son registros (puesto entre las 17) y uno es
  // una encuesta: para ese no se da puesto, solo si se distingue de la media de España con su margen de error.
  function renderContexto(id) {
    const C = DATA.contexto, d = C.ccaa[id], vs = S.vs && C.ccaa[S.vs] ? S.vs : "";
    const nf1 = nf(1), nf0 = nf(0);
    const puesto = (campo) => {
      const o = IDS.slice().sort((a, b) => C.ccaa[b][campo] - C.ccaa[a][campo]);
      return puestoTxt({ grupo: "gasto" }, o.indexOf(id) + 1, o.length);
    };
    const esp = C.espana_cobertura.mixta, [lo, hi] = d.cobertura_ic;
    const frente = lo > esp ? `Por encima de la media de España (${nf1.format(esp)} %)` : hi < esp ? `Por debajo de la media de España (${nf1.format(esp)} %)` : `No se distingue de la media de España (${nf1.format(esp)} %)`;
    const celda = (titulo, valor, detalle, campoVs) => `<div class="ctx"><div class="ctx-t">${titulo}</div><div class="ctx-v">${valor}</div><div class="ctx-d">${detalle}</div>${vs && campoVs ? `<div class="vs">${esc(NOMBRE[vs])}: ${campoVs(C.ccaa[vs])}</div>` : ""}</div>`;
    const fecha = C.fecha.split("-").reverse().join("/");
    $("#c-contexto-sub").textContent = `Datos que ayudan a entender el gasto, sin corregirlo. A 1 de enero de ${C.fecha.slice(0, 4)}, salvo el seguro privado (encuesta de 2023).`;
    $("#c-contexto").innerHTML =
      celda("Mayores de 65 años", `${nf1.format(d.pct65)} %`, `${puesto("pct65")} · 80 años o más: ${nf1.format(d.pct80)} %`, (x) => `${nf1.format(x.pct65)} %`) +
      celda("Densidad de población", `${nf0.format(d.densidad)} hab./km²`, puesto("densidad"), (x) => `${nf0.format(x.densidad)} hab./km²`) +
      celda("Núcleos de población", nf0.format(d.entidades), `${puesto("entidades")} · el sistema de financiación lo usa para medir la dispersión`, (x) => nf0.format(x.entidades)) +
      celda("Con seguro privado además del público", `${nf1.format(d.cobertura_mixta)} %`, `Entre ${nf1.format(lo)} % y ${nf1.format(hi)} % (encuesta). ${frente}`, (x) => `${nf1.format(x.cobertura_mixta)} %`);
    $("#c-contexto-notas").innerHTML = plegable("contexto", "¿Por qué importan y de dónde salen?", `
      <p><b>Ninguno de estos datos corrige el gasto.</b> Sirven para entender por qué unas comunidades gastan más que otras, pero su efecto no se puede medir con estas cifras.</p>
      <ul>
        <li><b>Mayores de 65 años.</b> Las personas mayores necesitan más atención. Es el factor que corrige el «Gasto por habitante, ajustado por edad». Fuente: INE, Estadística Continua de Población (1/1/${C.fecha.slice(0, 4)}).</li>
        <li><b>Densidad y núcleos de población.</b> Una población dispersa puede obligar a mantener más centros y desplazamientos, lo que puede encarecer la atención. Las zonas densas pueden tener otros costes (personal, suelo) y hospitales de referencia que atienden a pacientes de otras comunidades. El efecto puede ir en los dos sentidos. Superficie: Instituto Geográfico Nacional; núcleos («entidades singulares»): INE. Ambos certificados en la <a href="${C.urls.liquidacion}">liquidación del sistema de financiación</a> (1/1/${C.fecha.slice(0, 4)}).</li>
        <li><b>Seguro privado además del público.</b> Personas con un seguro médico privado voluntario (individual o de empresa) que conservan la sanidad pública. Tener un seguro privado no quita el derecho a la sanidad pública, y quien lo tiene puede seguir usándola, también para lo más caro. Por eso un porcentaje alto no implica por sí solo que la comunidad atienda a menos gente. Fuente: <a href="${C.urls.encuesta}">Encuesta de Salud de España 2023</a> (Ministerio de Sanidad e INE). Es una encuesta: damos el intervalo de confianza al 95 % y no ordenamos comunidades que no se distinguen. Los mutualistas (MUFACE, ISFAS, MUGEJU) atendidos por una aseguradora cuentan en esta encuesta como cobertura pública, no como seguro privado.</li>
        <li><b>Mutualistas.</b> No hay datos oficiales completos por comunidad (MUFACE los publica, ISFAS y MUGEJU no), así que no los mostramos. El gasto ajustado por edad ya los tiene en cuenta: la población con tarjeta sanitaria no incluye a los que eligieron una aseguradora.</li>
      </ul>`);
  }

  function filaInd(ind, id, vs = "", anioSel = ULT) {
    const anio = anioSel;
    const vals = valores(ind, anio); const o = ordenados(vals); const v = vals[id];
    const m = esRecurso(ind) ? ind.espana[indice(ind, anio)] : media(vals), frente = esRecurso(ind) ? "frente a España" : "frente a la media";
    const pos = o.indexOf(id) + 1;
    const hayDato = v != null;
    const dif = ind.unidad === "pct" ? `${v >= m ? "+" : "−"}${nf(1).format(Math.abs(v - m))} puntos ${frente}`
      : `${v >= m ? "+" : "−"}${nf(0).format(Math.abs(v / m - 1) * 100)} % ${frente}`;
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
    if (hayDato) strip += `<circle cx="${x(v)}" cy="17" r="7.5" fill="${acc}" stroke="${surf}" stroke-width="2.5"/>`;
    strip += `<text x="${P}" y="${H}" font-size="9" fill="${muted}">menos</text><text x="${W - P}" y="${H}" font-size="9" fill="${muted}" text-anchor="end">más</text></svg>`;
    // sparkline
    let spark = "";
    if (tieneSerie(ind)) {
      const fechas = periodos(ind), inicio = primero(ind), fin = ultimo(ind);
      const serie = ind.serie[id]; const sw = 120, sh = 34;
      const otra = vs ? ind.serie[vs] : null;
      const smin = Math.min(...serie.filter(v => v != null), ...(otra || []).filter(v => v != null)), smax = Math.max(...serie.filter(v => v != null), ...(otra || []).filter(v => v != null));
      const sx = (i) => 2 + (i / (serie.length - 1)) * (sw - 8), sy = (val) => 4 + (1 - (val - smin) / (smax - smin || 1)) * (sh - 8);
      const path = (sr) => sr.map((val, i) => val == null ? "" : `${i && sr[i - 1] != null && comparar(ind, fechas[i - 1], fechas[i]) ? "L" : "M"}${sx(i).toFixed(1)},${sy(val).toFixed(1)}`).join("");
      const d = path(serie);
      const k = indice(ind, anioSel);
      spark = `<svg viewBox="0 0 ${sw} ${sh}" aria-label="Evolución ${periodo(ind, inicio)} – ${periodo(ind, fin)}">${ind.grupo === "gasto" ? `<path d="${d} L${sx(serie.length - 1)},${sh} L${sx(0)},${sh} Z" fill="${css("--accent-soft")}"/>` : ""}${otra ? `<path d="${path(otra)}" fill="none" stroke="${css("--s2")}" stroke-width="1.5"/>` : ""}<path d="${d}" fill="none" stroke="${acc}" stroke-width="1.8"/>${(() => { return `<line x1="${sx(k)}" x2="${sx(k)}" y1="2" y2="${sh}" stroke="${muted}" stroke-dasharray="2 2"/>${hayDato ? `<circle cx="${sx(k)}" cy="${sy(serie[k])}" r="3.5" fill="${acc}" stroke="${surf}" stroke-width="1.5"/>` : ""}`; })()}</svg><div class="pos">${periodo(ind, inicio, true)} – ${periodo(ind, fin, true)}${anioSel !== fin ? ` · marcado ${periodo(ind, anioSel, true)}` : ""}${sinInfl(ind) ? ` · € de ${ULT}` : ""}</div>`;
    } else {
      spark = `<div class="pos">Evolución: con más informes</div>`;
    }
    return `<div class="ind">
      <div><div class="n">${esc(ind.corto)}</div><div class="pos">${hayDato ? puestoTxt(ind, pos, o.length) : "Sin dato en el informe"}</div></div>
      <div><div class="val">${fmt(v, ind.unidad)}</div><div class="delta">${hayDato ? dif : ""}</div>${vs ? `<div class="vs">${esc(NOMBRE[vs])}: ${fmt(vals[vs], ind.unidad)}</div>` : ""}</div>
      <div class="strip">${strip}</div>
      <div class="spark">${spark}</div>${lineaEdad(ind, id, vs, anio)}
    </div>`;
  }

  function renderComunidad() {
    const id = S.com;
    // La dirección refleja la comunidad elegida, para poder compartir el enlace (sin volver a dibujar).
    const params = new URLSearchParams();
    if (S.vs) params.set("vs", S.vs.toLowerCase());
    if (S.corteC !== ULT_CORTE) params.set("corte", CORTES[S.corteC].id);
    if (S.anioC !== ULT) params.set("anio", S.anioC);
    const hash = "#comunidad-" + id.toLowerCase() + (params.toString() ? "?" + params.toString() : "");
    if (location.hash !== hash) history.replaceState(null, "", hash);
    $("#c-sel").innerHTML = IDS.slice().sort((a, b) => NOMBRE[a].localeCompare(NOMBRE[b], "es")).map((k) => `<option value="${k}" ${k === id ? "selected" : ""}>${esc(NOMBRE[k])}</option>`).join("");
    $("#c-sel").onchange = (e) => { S.com = e.target.value; render(); };
    tileMap($("#c-mapa"), Object.fromEntries(IDS.map((k) => [k, 1])), IND.gasto_hab, { neutro: true, selIds: [id], onClick: (k) => { S.com = k; render(); } });
    $("#c-nombre").textContent = NOMBRE[id];
    const aC = S.anioC;
    const g = IND.gasto_hab, gv = valores(g, aC), go = ordenados(gv);
    const q = IND.q_dias, qv = valores(q, S.corteC), qo = ordenados(qv);
    const gp = go.indexOf(id) + 1, qp = qo.indexOf(id) + 1;
    const gtx = gp === 1 ? "la que más gasta de las 17" : gp === 17 ? "la que menos gasta de las 17" : arriba(gp, 17) ? `la ${gp}.ª que más gasta de 17` : `la ${18 - gp}.ª que menos gasta de 17`;
    const qtx = qp === 1 ? "la espera más larga de las 17" : qp === 17 ? "la espera más corta de las 17" : arriba(qp, 17) ? `la ${qp}.ª espera más larga de 17` : `la ${18 - qp}.ª espera más corta de 17`;
    const enQueEuros = aC !== ULT ? (S.real ? ` (en euros de ${ULT}, descontada la inflación)` : " (en euros de ese año)") : "";
    $("#c-resumen").innerHTML = `En ${aC} gastó <strong>${fmt(gv[id], g.unidad)}</strong> por habitante en sanidad pública${enQueEuros}: ${gtx}. En ${periodo(q, S.corteC)} sus pacientes llevaban de media <strong>${fmt(qv[id], q.unidad)}</strong> esperando una operación: ${qtx}.`;
    $("#c-gasto-sub").innerHTML = `<label class="periodo" for="c-anio">Año <select id="c-anio">${ANIOS.slice().reverse().map((a) => `<option value="${a}" ${a === aC ? "selected" : ""}>${a}${esProv(a, IND.gasto_hab) ? " (provisional)" : ""}</option>`).join("")}</select></label>
      <span class="seg sm" role="group" aria-label="Inflación"><button type="button" data-r="1" aria-pressed="${S.real}">Descontando la inflación</button><button type="button" data-r="0" aria-pressed="${!S.real}">Sin descontar</button></span>
      <span class="sub-ficha">${S.real ? `Los euros de cada año están en euros de ${ULT}.` : "Cada año, en los euros de entonces."} Cada punto gris es otra comunidad; la raya marca la media de las 17. La línea de la derecha es la evolución desde ${ANIOS[0]}, con el año elegido marcado.</span>`;
    $("#c-anio").onchange = (e) => { S.anioC = +e.target.value; render(); };
    $("#c-gasto-sub").querySelectorAll("button[data-r]").forEach((b) => b.onclick = () => { S.real = b.dataset.r === "1"; render(); });
    if (S.vs === id) S.vs = "";
    $("#c-vs").innerHTML = `<option value="">Nadie</option>` + IDS.filter((k) => k !== id).sort((a, b) => NOMBRE[a].localeCompare(NOMBRE[b], "es")).map((k) => `<option value="${k}" ${k === S.vs ? "selected" : ""}>${esc(NOMBRE[k])}</option>`).join("");
    $("#c-vs").onchange = (e) => { S.vs = e.target.value; render(); };
    $("#c-leyenda-vs").innerHTML = S.vs ? `<span><i style="background:${css("--accent")}"></i>${esc(NOMBRE[id])}</span><span><i style="background:${css("--s2")}"></i>${esc(NOMBRE[S.vs])}</span>` : "";
    $("#c-gasto").innerHTML = DATA.inds.filter((i) => i.grupo === "gasto").map((i) => filaInd(i, id, S.vs, aC)).join("");
    const nts = notasDe(id), avs = AVISOS.filter((a) => a.ccaa === id), ents = entidadesDe(id);
    const cuentaC = [
      nts.length ? `${nts.length} ${nts.length === 1 ? "nota" : "notas"} del Ministerio` : "",
      avs.length ? `${avs.length} ${avs.length === 1 ? "variación inusual" : "variaciones inusuales"}` : "",
      ents.length ? `${ents.length} ${ents.length === 1 ? "cambio" : "cambios"} en las entidades` : "",
    ].filter(Boolean);
    $("#c-notas").innerHTML = !cuentaC.length ? "" : plegable("ficha", `Notas sobre estas cifras: ${cuentaC.join(" · ")}`, (nts.length ? `<b>Notas del Ministerio sobre la serie de gasto de ${esc(NOMBRE[id])}:</b><ul>${nts.map((n) => `<li><b>${n.anio}.</b> ${esc(n.texto)}</li>`).join("")}</ul>` : "") +
      (avs.length ? `<b>Variaciones inusuales sin explicación oficial:</b><ul>${avs.map((a) => `<li><b>${esc(IND[a.indicador].corto)}, ${a.anio}.</b> ${esc(textoAviso(a, false))}</li>`).join("")}</ul><a href="#metodo-calidad">Cómo las detectamos</a>` : "") +
      (ents.length ? `<p><b>Entidades que cuenta la estadística en ${esc(NOMBRE[id])}.</b> La estadística suma el gasto de las entidades públicas que gestionan la sanidad de cada comunidad, y esa lista cambia con los años. Cambios que pesan al menos un ${UMBRAL_ENT} % del gasto:</p><ul>${ents.map((e) => `<li><b>${e.anio}.</b> ${esc(textoEntidades(e, false))}</li>`).join("")}</ul><p>${esc(AVISO_ENTIDADES)} <a href="#metodo-entidades">Más información</a></p>` : ""));
    $("#c-espera-sub").innerHTML = `<label class="periodo" for="c-corte">Corte <select id="c-corte">${opcionesAnio(q, PERIODOS_ESPERA.slice().reverse(), S.corteC)}</select></label> <span class="sub-ficha">Un valor más alto significa más espera.${CORTES[S.corteC].id === "2023-06" ? ' Las cifras de consultas de este corte llevan un aviso en <a href="#metodo">Cómo leer los datos</a>.' : ""}</span>`;
    $("#c-corte").onchange = (e) => { S.corteC = +e.target.value; render(); };
    $("#c-espera").innerHTML = DATA.inds.filter((i) => i.grupo === "espera").map((i) => filaInd(i, id, S.vs, S.corteC)).join("");
    renderOpinionFicha(id);
    const ap = DATA.inds.filter((i) => i.grupo === "primaria"), hosp = DATA.inds.filter((i) => i.grupo === "hospitales");
    $("#c-primaria-sub").textContent = `Profesionales de atención primaria de la sanidad pública, a 31 de diciembre de ${ultimo(ap[0])}. Más personas por profesional quiere decir menos profesionales para la misma población. La raya marca España.`;
    $("#c-primaria").innerHTML = ap.map((i) => filaInd(i, id, S.vs, ultimo(i))).join("");
    $("#c-primaria-notas").innerHTML = plegable("primaria-ficha", "¿De dónde salen estos datos?", notasRecursos("siap"));
    $("#c-hospitales-sub").textContent = `Recursos y actividad de los hospitales en ${ultimo(hosp[0])}. La raya marca España.`;
    $("#c-hospitales").innerHTML = hosp.map((i) => filaInd(i, id, S.vs, ultimo(i))).join("");
    $("#c-hospitales-notas").innerHTML = plegable("hospitales-ficha", "¿De dónde salen estos datos?", notasRecursos("siae"));
    renderContexto(id);
    const quir = DATA.detalle.quirurgica;
    const esp = quir.campos.filter((c) => c.id !== "total").map((c) => [c.nombre, quir.v[c.id].dias[id]?.[S.corteC]]).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    $("#c-extra").innerHTML = esp.length ? `Especialidad quirúrgica con más espera en ${esc(NOMBRE[id])}: <strong>${esc(esp[0][0])}</strong> (${fmt(esp[0][1], "dias")} de media). Con menos: <strong>${esc(esp[esp.length - 1][0])}</strong> (${fmt(esp[esp.length - 1][1], "dias")}).` : "";
  }


  // ---------- CÓMO LEER LOS DATOS ----------
  function renderMetodo() {
    if ($("#m-cuerpo").dataset.listo) return; // contenido fijo: se pinta una vez
    const lista = (grupo) => DATA.inds.filter((i) => i.grupo === grupo).map((i) => `<dt>${esc(i.nombre)}</dt><dd>${esc(i.desc)}</dd>`).join("");
    const subida = nf(0).format((IPC[ULT] / IPC[ANIOS[0]] - 1) * 100);
    const CRIT_TXT = "10 puntos de crecimiento en los datos en euros, o 3 puntos en los porcentajes";
    const MET_EGSP = "https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/gastoSanitario2005/tablasEstEGSP/Metodologia_general.pdf";
    const INV_IGAE = "https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/InformacionGeneral/Documents/Entidades_incluidas_en_el_sector_de_las_Administraciones_P%C3%BAblicas.pdf";
    $("#m-cuerpo").innerHTML = `
      <h1>Cómo leer los datos</h1>
      <p>Todo lo que ves sale de estadísticas oficiales. Aquí explicamos qué mide cada dato, de dónde sale y qué hay que tener en cuenta para no sacar conclusiones equivocadas.</p>
      <nav class="indice" aria-label="Apartados"><a href="#metodo-gasto">Gasto</a><a href="#metodo-espera">Listas de espera</a><a href="#metodo-opinion">Lo que opina la gente</a><a href="#metodo-recursos">Atención primaria y hospitales</a><a href="#metodo-inflacion">Inflación</a>${EDAD ? '<a href="#metodo-edad">Ajuste por edad</a>' : ""}<a href="#metodo-comparar">Comparar comunidades</a><a href="#metodo-entidades">Conciertos y entidades</a><a href="#metodo-notas">Notas del Ministerio</a><a href="#metodo-calidad">Avisos de calidad</a><a href="#metodo-limites">Lo que no dicen estos datos</a></nav>

      <h2 id="metodo-gasto">Gasto sanitario público</h2>
      <p>Fuente: Ministerio de Sanidad, Estadística de Gasto Sanitario Público (EGSP), de ${ANIOS[0]} a ${ULT}. Es <b>gasto real liquidado</b>, es decir, lo que de verdad se gastó, no lo que se presupuestó. Por eso puede no coincidir con noticias que usan los presupuestos iniciales.</p>
      <p>Es el gasto <b>consolidado</b> de cada comunidad (sin contar dos veces el dinero que se pasan entre administraciones). Los datos de ${DATA.prov.join(" y ")} son <b>provisionales</b> y pueden cambiar en la próxima edición.</p>
      <dl>${lista("gasto")}</dl>

      <h2 id="metodo-espera">Listas de espera</h2>
      <p>Fuente: Ministerio de Sanidad, Sistema de Información sobre Listas de Espera del SNS (SISLE-SNS), cortes de ${CORTES[0].fecha} a ${DATA.corteListas}. Cada corte es una foto de un día concreto: cuántas personas esperan y cuánto llevan esperando, no cuánto tardaron las que ya fueron atendidas.</p>
      <p>Para el porcentaje de consultas de más de 60 días, desde diciembre de 2024 el Ministerio incluye también a quienes superaban ese plazo y seguían sin cita. En junio de 2023, el informe de consultas repite los recuentos, los días y los porcentajes de diciembre de 2022, aunque cambian las tasas. En ambos casos se omiten los cambios entre cortes afectados.</p>
      <p><a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/ListaEsperaInfAntCCAA.htm">Informes de las comunidades autónomas</a> · <a href="https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/listaEsperaInfAnt.htm">Informes resumen del SNS</a>. Usamos las tablas de indicadores globales del informe resumen para los totales quirúrgicos anteriores a 2025.</p>
      <dl>${lista("espera")}</dl>
      <p>Las listas de espera se pueden ver también por <b>especialidad</b> (Traumatología, Oftalmología…) y por <b>proceso</b> (cataratas, prótesis de cadera…). Si una comunidad no aparece en una especialidad es porque el informe no trae ese dato; se muestra en gris y no cuenta para la media.</p>

      <h2 id="metodo-inflacion">Descontar la inflación</h2>
      <p>Un euro de ${ANIOS[0]} no compra lo mismo que uno de ${ULT}: los precios han subido un ${subida} % (IPC general nacional del INE, media anual). Con «Descontando la inflación», cada año se expresa en euros de ${ULT}, así que el crecimiento que ves es real. Solo afecta a los datos en euros; los porcentajes no cambian, porque suben a la vez el gasto y aquello con lo que se compara.</p>
      <p>Usamos el IPC nacional para todas las comunidades, como es habitual al comparar gasto público entre regiones. El IPC de cada comunidad mide cómo cambian los precios de la cesta de los hogares, no los costes sanitarios, y no permite comparar niveles de precios entre comunidades.</p>

      ${EDAD ? `<h2 id="metodo-edad">Gasto ajustado por edad</h2>
      <p>Las comunidades con más población mayor necesitan gastar más por habitante: una persona de 80 años necesita más atención que una de 30. En «Gasto por habitante» puedes elegir «Ajustado por edad» para ver el gasto corrigiendo ese efecto. Por defecto se muestra el dato oficial, sin ajustar.</p>
      <p><b>Cómo se calcula.</b> Gasto de la comunidad ÷ su <b>población protegida equivalente</b>, reescalado para que el conjunto de las 17 no cambie. En la práctica, el gasto por habitante se divide entre un «factor de edad»: mayor que 1 si la comunidad necesita más gasto por su población que la media de las 17, menor que 1 si necesita menos.</p>
      <p><b>Qué es la población protegida equivalente.</b> Es la población con tarjeta sanitaria de cada servicio de salud, ponderada por edad con los pesos del artículo 9 de la <a href="${URL_LEY}">Ley 22/2009</a> (${tramosEdad()}). Es la variable con la que el sistema de financiación autonómica reparte el dinero de la sanidad. El Ministerio de Sanidad la certifica cada año y Hacienda la publica en los anexos de la <a href="${URL_LIQ}">liquidación del sistema de financiación</a>. De 2009 a 2020 esos certificados son documentos escaneados: hemos transcrito sus cifras y comprobado que la suma de las comunidades da el total y que coinciden con los cuadros de la liquidación.</p>
      <p><b>Por qué desde ${EDAD.anios[0]}.</b> Hay certificados desde ${EDAD.aniosPPE[0]}, pero según Hacienda la población protegida se calcula con la base de datos de tarjeta sanitaria «desde el 2013» (<a href="${URL_INF}">informe sobre la población ajustada, 2021</a>, pág. 178). Las cifras de antes y de después no son comparables, así que el ajuste empieza en ${EDAD.anios[0]}.</p>
      <p><b>Límites.</b></p>
      <ul>
        <li>No es una cifra del Ministerio de Sanidad, sino un cálculo nuestro con dos datos oficiales.</li>
        <li>Los pesos por edad de la ley se calcularon con datos de 2001. En 2026 se aprobó un nuevo modelo de financiación con 20 tramos de edad y pesos actualizados; los cambiaremos cuando se publiquen.</li>
        <li>La población equivalente solo cuenta a quien atiende el servicio de salud de cada comunidad (por ejemplo, no a los mutualistas que eligieron una aseguradora privada). Por eso el ajuste corrige la edad y también la población que de verdad atiende cada servicio de salud.</li>
        <li>Solo corrige la edad. No tiene en cuenta otras diferencias, como la dispersión de la población, los costes o la insularidad.</li>
        <li>Se aplica al gasto total por habitante, no a la farmacia ni a los conciertos, que tienen su propia relación con la edad.</li>
      </ul>` : ""}

      <h2 id="metodo-comparar">Comparar comunidades</h2>
      <ul>
        <li><b>Medias simples:</b> cada comunidad cuenta igual, sea grande o pequeña.</li>
        <li><b>Colores del mapa:</b> en gasto, cinco tramos de 3 o 4 comunidades cada uno, de menos a más. En listas de espera, el color dice si la comunidad está por encima (rojo) o por debajo (azul) de la media, en gris si está cerca.</li>
        <li><b>Ceuta y Melilla</b> aparecen aparte en listas de espera: su sanidad la gestiona el Ministerio (INGESA) y su población es muy pequeña. No cuentan para medias, puestos ni colores. En gasto no aparecen, porque el Excel solo recoge la parte del INGESA.</li>
        <li><b>Gasto frente a espera:</b> el gráfico describe si las comunidades que más gastan esperan más o menos; no mide causas. Damos dos correlaciones (Pearson y por rangos, Spearman) y solo hablamos de relación si ambas superan el umbral a partir del cual no se pueden atribuir fácilmente al azar (con 17 comunidades, ±0,48). Como se pueden mirar muchas combinaciones de espera y especialidad, alrededor del 5 % superará ese umbral solo por azar: por eso, cuando aparece, la llamamos «posible relación». Aunque la haya, no prueba que una cosa cause la otra: influyen la edad, la dispersión, las derivaciones a la concertada, el seguro privado, la organización de cada servicio y cómo se registran las listas. Además, compara comunidades, no personas, y el gasto (${ULT}) y la espera (${DATA.corteListas}) no son del mismo momento.</li>
      </ul>

      <h2 id="metodo-entidades">Conciertos y entidades que cuenta la estadística</h2>
      <p><b>Qué es un concierto.</b> La <a href="${MET_EGSP}">metodología de la EGSP</a> llama conciertos a la asistencia prestada «con recursos patrimoniales ajenos a aquella entidad que financia la asistencia», y añade que «pueden estar suscritos con profesionales, instituciones o empresas que sean de titularidad pública o privada» (pág. 15). En otro apartado, el mismo documento se refiere a ellos como «producción privada» (pág. 6). Recogemos las dos formulaciones; la definición formal incluye centros públicos y privados.</p>
      <p>De esa definición se deduce que cuánto se clasifica como concierto depende de cómo organiza cada comunidad sus servicios: lo que presta con medios propios o con entidades de su sector público no es concierto; lo que contrata con centros ajenos, sí. Por eso el peso de los conciertos no mide por sí solo cuánta asistencia pública prestan centros privados. Lo mostramos en porcentaje del gasto y en euros por habitante.</p>
      <p><b>Qué entidades cuenta la estadística.</b> La EGSP recoge el gasto de las unidades del sector Administraciones Públicas según el Sistema Europeo de Cuentas, incluidas las instituciones sin fines de lucro «controladas y financiadas principalmente por las AAPP» y las empresas públicas sanitarias con «financiación mayoritaria» de las administraciones (pág. 6). Al sumar, elimina los pagos entre administraciones públicas para no contar dos veces el mismo dinero: el gasto se anota en la entidad que presta el servicio (pág. 13).</p>
      <p>Ejemplo: según el <a href="${INV_IGAE}">inventario de entidades del sector público de la IGAE</a> (Ministerio de Hacienda, actualizado el 17/09/2025), el Hospital Clínic de Barcelona, el Consorci Mar Parc de Salut de Barcelona, el Consorci Corporació Sanitària Parc Taulí o la Fundació de Gestió Sanitària de l'Hospital de la Santa Creu i Sant Pau están clasificados en el sector público de la Generalitat de Cataluña. En la EGSP aparecen en la lista de entidades de Cataluña entre 2006 y 2011. Desde entonces, su gasto propio (personal, compras…) se suma al de la comunidad.</p>
      <p><b>Cambios en la lista.</b> La lista de entidades de cada comunidad cambia con los años. Señalamos los años en que las entidades que aparecen, o las que dejan de aparecer, pesan juntas al menos un ${UMBRAL_ENT} % del gasto de la comunidad. Es un umbral nuestro: por debajo casi todo son fundaciones de investigación pequeñas. ${esc(AVISO_ENTIDADES)} Dos ejemplos de lo que se ve en las cifras:</p>
      <ul>
        <li>Baleares, 2013: dejan de aparecer cuatro fundaciones y empresas públicas que en 2012 sumaban 321 M€ (el 25 % del gasto). El gasto total de la comunidad pasa de 1.293 a 1.278 M€ y el del Servei de Salut, de 950 a 1.258 M€.</li>
        <li>Cataluña, 2006: aparecen once entidades, casi todas consorcios sanitarios, que suman el 8 % del gasto de ese año. Los conciertos pasan de 2.565 a 2.522 M€, pero su peso baja del 35,5 % al 30,9 % porque el gasto total pasa de 7.227 a 8.152 M€.</li>
      </ul>
      <p>Al comparar un periodo en el que cambió la lista, parte de la diferencia puede deberse a ese cambio. No se puede rehacer la serie con las mismas entidades todos los años: la estadística no trae las cuentas de una entidad antes de que entre en la lista, ni dice qué parte de lo que se le pagaba antes contaba como concierto. Estos son todos los cambios que señalamos (${ENTIDADES.length}); los verás también en la evolución (al destacar la comunidad) y en su ficha:</p>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Comunidad</th><th>Año</th><th>Cambio</th><th>Peso</th><th>Entidades</th></tr></thead><tbody>
        ${ENTIDADES.map((e) => `<tr><td>${esc(NOMBRE[e.ccaa])}</td><td>${e.anio}</td><td>${e.cambio === "entra" ? "Aparecen" : "Dejan de aparecer"}</td><td>${pctTxt(e.peso)}</td><td>${esc(e.entidades.filter((x) => x.peso >= 0.5).map((x) => x.nombre).join("; ") || "Varias pequeñas")}${e.entidades.some((x) => x.peso < 0.5) && e.entidades.some((x) => x.peso >= 0.5) ? " y otras más pequeñas" : ""}</td></tr>`).join("")}
      </tbody></table></div>

      <h2 id="metodo-opinion">Lo que opina la gente (Barómetro Sanitario)</h2>
      <p>Fuente: Barómetro Sanitario, encuesta anual del Ministerio de Sanidad y el Centro de Investigaciones Sociológicas (CIS) a la población de 18 y más años: entre unas 7.200 y 7.800 entrevistas al año (de 2022 a 2025), en tres oleadas.</p>
      <dl>${lista("opinion")}</dl>
      ${notasOpinion(null)}
      <p><b>De dónde sale cada cifra.</b> Satisfacción y valoración del médico de familia: serie por comunidad del Ministerio. Atendidos en el día o al siguiente y días para el médico de familia: el Ministerio no publica la serie por comunidad, así que los calculamos con los microdatos del CIS de 2025, con su mismo método.</p>
      <p><b>Cómo lo comprobamos.</b> Con los microdatos reproducimos exactamente la satisfacción y la valoración de 2025 de su serie, en las 17 comunidades, Ceuta y Melilla. En el acceso coinciden todas las cifras que da su informe anual: en España, 9,15 días de media, 21,8 % atendido en el día o al siguiente y 5,1 % que prefirió otra fecha; y los días de País Vasco (4,91), Asturias (5,45), Andalucía (11,16), Cataluña (10,59) y Ceuta (5,55). El cálculo usa la ponderación nacional, también dentro de cada comunidad, y en las valoraciones el «no sabe o no contesta» cuenta en el total.</p>
      <p><b>Los días de espera son de atención primaria.</b> No tienen que ver con las listas de espera de la web, que son de operaciones y consultas con el especialista (registro SISLE-SNS). Aquí se pregunta a la gente por su última visita al médico de familia.</p>

      <h2 id="metodo-recursos">Atención primaria y hospitales</h2>
      <h3>Profesionales de atención primaria</h3>
      <dl>${lista("primaria")}</dl>
      ${notasRecursos("siap")}
      <h3>Hospitales: camas, ocupación, estancia, cirugía sin ingreso, ingresos, hospital de día, TAC y resonancia</h3>
      <dl>${lista("hospitales")}</dl>
      ${notasRecursos("siae")}

      <h2 id="metodo-notas">Notas del Ministerio</h2>
      <p>El Ministerio explica algunos saltos en las series de gasto de cada comunidad. Aparecen también en el gráfico de evolución (al destacar la comunidad) y en su ficha.</p>
      <ul>${NOTAS.slice().sort((a, b) => NOMBRE[a.ccaa].localeCompare(NOMBRE[b.ccaa], "es") || a.anio - b.anio).map((n) => `<li><b>${esc(NOMBRE[n.ccaa])}, ${n.anio}.</b> ${esc(n.texto)}</li>`).join("")}</ul>

      <h2 id="metodo-calidad">Avisos de calidad: cómo revisamos los datos</h2>
      <p>Además de las notas del Ministerio, revisamos los datos de forma automática cada vez que se actualiza la web:</p>
      <ul>
        <li><b>Que se han leído bien.</b> Al extraer el Excel comprobamos que los porcentajes cuadran con los importes y que la población implícita (gasto total entre gasto por habitante) cambia con suavidad cada año. Al extraer el PDF de listas de espera comprobamos que los totales cuadran con la suma de especialidades y que pacientes y tasas son coherentes.</li>
        <li><b>Que son coherentes.</b> Las series de gasto cubren las 17 comunidades en todos los años. Los porcentajes están entre 0 y 100 y la farmacia nunca supera al gasto total. En las listas de espera, los informes pueden dejar huecos por comunidad, especialidad o proceso.</li>
        <li><b>Variaciones inusuales.</b> Para cada dato y año comparamos el cambio de cada comunidad con el de las demás. Si se aleja mucho de lo normal ese año (más de 4 veces la dispersión típica y más de ${CRIT_TXT}), lo señalamos. Si el Ministerio tiene una nota para ese año, mostramos la nota; si no, avisamos de que la cifra es la oficial pero no tiene explicación publicada.</li>
      </ul>
      <p>Estas son las variaciones inusuales que el Ministerio no explica (${AVISOS.length}). No significan que el dato esté mal: puede deberse a cambios contables, a pagos extraordinarios o a otras causas que la estadística no detalla.</p>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Comunidad</th><th>Dato</th><th>Año</th><th>Cambio</th><th>Mediana del año</th></tr></thead><tbody>
        ${AVISOS.map((a) => `<tr><td>${esc(NOMBRE[a.ccaa])}</td><td>${esc(IND[a.indicador].corto)}</td><td>${a.anio}</td><td>${firmado(a.cambio, a.unidad === "%" ? 0 : 1)}${a.unidad === "%" ? " %" : " p."}</td><td>${firmado(a.mediana, a.unidad === "%" ? 0 : 1)}${a.unidad === "%" ? " %" : " p."}</td></tr>`).join("")}
      </tbody></table></div>
      <p>Listas de espera: usamos ${DATA.versionListas ? `el fichero <b>${esc(DATA.versionListas.fichero)}</b>${DATA.versionListas.rectificado ? ", la <b>versión rectificada</b> que publicó el Ministerio" : ""}${DATA.versionListas.fecha_pdf ? ` (fecha del documento: ${DATA.versionListas.fecha_pdf.split("-").reverse().join("/")})` : ""}` : "el último informe publicado"}. Si comparas con otra versión del mismo informe, las cifras pueden no coincidir.${DATA.notasListas.length ? ` Notas del informe: ${DATA.notasListas.map((t) => esc(t)).join(" ")}` : ""}</p>

      <h2 id="metodo-limites">Lo que no dicen estos datos</h2>
      <ul>
        <li><b>La edad de la población:</b> las comunidades más envejecidas necesitan gastar más por habitante. El gasto que mostramos por defecto no está ajustado por edad; en «Gasto por habitante» puedes verlo ajustado desde ${EDAD ? EDAD.anios[0] : ""} (<a href="#metodo-edad">cómo se calcula</a>).</li>
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
      const corte = CORTES.findIndex((c) => c.id === qq.get("corte")); S.corteC = corte < 0 ? ULT_CORTE : corte;
      const an = +qq.get("anio"); S.anioC = ANIOS.includes(an) ? an : ULT;
    }
    else if (h === "comunidad") S.vista = "comunidad";
    else if (h === "metodo") S.vista = "metodo";
    else if (h.startsWith("metodo-")) { S.vista = "metodo"; render(); const e = document.getElementById(h); if (e) e.scrollIntoView(); return; }
    else { S.vista = "datos"; if (qs) leerEnlace(qs); } // #portada y #explorar (enlaces antiguos) llevan aquí
    pararPlay(); if ($("#ajustes").open) $("#ajustes").close(); render(); window.scrollTo(0, 0);
  }
  // Fechas de los textos fijos, sacadas de los datos (así no se quedan viejas al actualizar).
  $("#p-intro").textContent = `Datos oficiales del Ministerio de Sanidad: gasto de ${ANIOS[0]} a ${ULT}, listas de espera de ${periodo(IND.q_dias, 0)} a ${periodo(IND.q_dias, ULT_CORTE)}, el Barómetro Sanitario (encuesta, con el CIS) de ${DATA.barometro.primerAnioMetodo} a ${Math.max(...DATA.inds.filter((i) => i.grupo === "opinion").map((i) => i.fechas.at(-1)))}, profesionales de atención primaria de ${primero(IND.ap_pob_medico)} a ${ultimo(IND.ap_pob_medico)} y actividad y recursos de los hospitales de ${primero(IND.hosp_camas_sns)} a ${ultimo(IND.hosp_camas_sns)}.`;
  $("#f-gasto").textContent = `gasto real ${ANIOS[0]}-${ULT}` + (DATA.prov.length ? `; ${DATA.prov.join(" y ")} provisionales` : "");
  {
    const rect = DATA.versionListas && DATA.versionListas.rectificado
      ? `versión rectificada${DATA.versionListas.fecha_pdf ? " del " + DATA.versionListas.fecha_pdf.split("-").reverse().join("/") : ""}` : "";
    $("#f-listas").textContent = CORTES.length > 1
      ? `cortes semestrales del ${CORTES[0].fecha} al ${DATA.corteListas}${rect ? `; el último, ${rect}` : ""}`
      : `a ${DATA.corteListas}${rect ? `, ${rect}` : ""}`;
  }
  addEventListener("hashchange", leerHash);
  let rz, anchoPrevio = innerWidth;
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (innerWidth !== anchoPrevio) { anchoPrevio = innerWidth; render(); } }, 150); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  leerHash();
}
