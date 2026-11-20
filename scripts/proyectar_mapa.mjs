// Genera src/data/mapa-ccaa.json: trazados SVG ya proyectados de las comunidades autónomas.
//
// Uso:  node scripts/proyectar_mapa.mjs
//
// Fuente: es-atlas 0.6.0 (https://github.com/martgnz/es-atlas), TopoJSON elaborado a partir de
// los límites del Instituto Geográfico Nacional (CC BY 4.0). Descarga previa a datos-originales/:
//   https://cdn.jsdelivr.net/npm/es-atlas@0.6.0/es/autonomous_regions.json
//   -> datos-originales/es-atlas-0.6.0-autonomous_regions.json
//
// La península, Baleares, Ceuta y Melilla van en una proyección cónica conforme; Canarias, en un
// recuadro abajo a la izquierda. Así la web no necesita librerías de mapas en el navegador.
import { readFileSync, writeFileSync } from "node:fs";
import { geoConicConformal, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const ENTRADA = new URL("../datos-originales/es-atlas-0.6.0-autonomous_regions.json", import.meta.url);
const SALIDA = new URL("../src/data/mapa-ccaa.json", import.meta.url);

// Códigos del IGN -> ids de src/data/ccaa.json (CE/ML: ciudades autónomas; GI: Gibraltar, solo contexto)
const ID = { "01": "AN", "02": "AR", "03": "AS", "04": "IB", "05": "CN", "06": "CB", "07": "CL", "08": "CM", "09": "CT",
  "10": "VC", "11": "EX", "12": "GA", "13": "MD", "14": "MC", "15": "NC", "16": "PV", "17": "RI", "18": "CE", "19": "ML", "20": "GI" };

const topo = JSON.parse(readFileSync(ENTRADA, "utf8"));
const fc = feature(topo, topo.objects.autonomous_regions);
const W = 600;
const pen = fc.features.filter((f) => f.id !== "05");
const can = fc.features.filter((f) => f.id === "05");

const pPen = geoConicConformal().parallels([36, 43.5]).rotate([3.6, 0])
  .fitWidth(W - 124, { type: "FeatureCollection", features: pen.filter((f) => !["18", "19", "20"].includes(f.id)) });
{ const [tx, ty] = pPen.translate(); pPen.translate([tx + 120, ty + 4]); }
const H = Math.ceil(geoPath(pPen).bounds({ type: "FeatureCollection", features: pen })[1][1] + 6);
const marco = { x: 4, y: H - 112, w: 190, h: 100 };
const pCan = geoConicConformal().parallels([27.5, 29.5]).rotate([15.7, 0])
  .fitExtent([[marco.x + 8, marco.y + 8], [marco.x + marco.w - 8, marco.y + marco.h - 8]], can[0]);

const unDecimal = (s) => s.replace(/(\d+\.\d)\d+/g, "$1");

// Etiqueta en el centro del polígono más grande (Mallorca en Baleares, etc.)
function etiqueta(f, path) {
  const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  let mejor = null, maxA = -1;
  for (const p of polys) {
    const g = { type: "Polygon", coordinates: p };
    const a = path.area(g);
    if (a > maxA) { maxA = a; mejor = g; }
  }
  const [x, y] = path.centroid(mejor);
  return { lx: +x.toFixed(1), ly: +y.toFixed(1), area: Math.round(path.area(f)) };
}

const regiones = fc.features.map((f) => {
  const path = geoPath(f.id === "05" ? pCan : pPen);
  return { id: ID[f.id], d: unDecimal(path(f)), ...etiqueta(f, path) };
});
const faltan = Object.values(ID).filter((id) => !regiones.some((r) => r.id === id));
if (faltan.length) throw new Error("Faltan territorios: " + faltan.join(", "));

writeFileSync(SALIDA, JSON.stringify({
  fuente: "Instituto Geográfico Nacional, vía es-atlas 0.6.0 (CC BY 4.0)",
  w: W, h: H, marco, regiones,
}));
console.log(`${regiones.length} territorios, ${W}x${H} -> src/data/mapa-ccaa.json`);
