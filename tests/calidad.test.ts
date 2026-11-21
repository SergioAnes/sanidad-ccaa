/** Comprobaciones de calidad de los datos publicados y de los avisos automáticos. */
import { describe, expect, it } from "vitest";
import notas from "../src/data/notas-egsp.json";
import listas from "../src/data/listas-espera.json";
import ppe from "../src/data/poblacion-equivalente.json";
import contexto from "../src/data/contexto-ccaa.json";
import { CCAA, VALORES } from "../src/lib/datos";
import { detectarAvisos } from "../src/lib/avisos";

const anios = [...new Set(VALORES.map((v) => v.anio))].sort((a, b) => a - b);
const val = (ind: string, c: string, a: number) => VALORES.find((v) => v.indicador === ind && v.ccaa === c && v.anio === a)?.valor;

describe("coherencia de los datos de gasto", () => {
  it("cada indicador tiene las 17 comunidades en todos sus años, sin huecos", () => {
    for (const ind of new Set(VALORES.map((v) => v.indicador))) {
      // El gasto ajustado por edad empieza en 2013 (primer año comparable de la población protegida equivalente).
      const desde = ind === "gasto_hab_edad" ? ppe.primer_anio_comparable : anios[0];
      for (const c of CCAA) for (const a of anios.filter((x) => x >= desde)) expect(val(ind, c.id, a), `${ind} ${c.id} ${a}`).toBeTypeOf("number");
    }
  });

  it("los porcentajes están entre 0 y 100, y primaria + hospitales no pasan de 100", () => {
    for (const v of VALORES.filter((x) => x.indicador.startsWith("pct_"))) {
      expect(v.valor).toBeGreaterThanOrEqual(0);
      expect(v.valor).toBeLessThanOrEqual(100);
    }
    for (const c of CCAA) for (const a of anios) expect(val("pct_primaria", c.id, a)! + val("pct_hospital", c.id, a)!).toBeLessThanOrEqual(100);
  });

  it("la farmacia por habitante es menor que el gasto por habitante", () => {
    for (const c of CCAA) for (const a of anios) expect(val("farmacia_hab", c.id, a)!).toBeLessThan(val("gasto_hab", c.id, a)!);
  });

  it("los conciertos por habitante son menores que el gasto por habitante y cuadran con su porcentaje", () => {
    for (const c of CCAA) for (const a of anios) {
      const ch = val("conciertos_hab", c.id, a)!, gh = val("gasto_hab", c.id, a)!, pc = val("pct_conciertos", c.id, a)!;
      expect(ch).toBeLessThan(gh);
      // El % va sobre el gasto del subsector ANTES de restar las transferencias intersectoriales; por habitante se
      // divide el importe entre la población del Ministerio (aportación total / gasto por habitante). Así que
      // gasto_hab × % = conciertos_hab × (aportación / subsector): algo menor, como mucho un 2,5 % (Extremadura 2002).
      const r = (gh * pc) / 100 / ch;
      expect(r, `${c.id} ${a}`).toBeLessThanOrEqual(1.0012); // ≤ 1 salvo redondeo a dos decimales
      expect(r, `${c.id} ${a}`).toBeGreaterThan(0.97);
    }
  });

  it("solo los últimos años son provisionales", () => {
    const prov = [...new Set(VALORES.filter((v) => v.provisional).map((v) => v.anio))].sort();
    expect(prov.every((a) => a >= anios[anios.length - 3])).toBe(true);
  });
});

describe("avisos de variaciones inusuales", () => {
  const avisos = detectarAvisos(VALORES, notas);

  it("detecta los saltos explicados por el Ministerio y los marca como explicados", () => {
    const cb = avisos.find((a) => a.indicador === "gasto_hab" && a.ccaa === "CB" && a.anio === 2012);
    expect(cb?.explicado).toBe(true);
  });

  it("detecta saltos que la fuente no explica (p. ej. La Rioja 2006)", () => {
    const ri = avisos.find((a) => a.indicador === "gasto_hab" && a.ccaa === "RI" && a.anio === 2006);
    expect(ri).toBeDefined();
    expect(ri?.explicado).toBe(false);
  });

  it("no avisa de cambios pequeños", () => {
    for (const a of avisos) expect(Math.abs(a.cambio - a.mediana)).toBeGreaterThan(a.unidad === "%" ? 10 : 3);
  });
});

describe("listas de espera", () => {
  it("se sabe de qué versión del PDF sale cada corte", () => {
    for (const corte of listas.cortes) {
      const v = (listas.versiones as Record<string, { fichero: string }>)[corte];
      expect(v?.fichero).toMatch(/\.pdf$/);
    }
  });
});

describe("población protegida equivalente y gasto ajustado por edad", () => {
  const anioPPE = [...new Set(ppe.valores.map((v) => v.anio))];

  it("hay certificado de las 17 comunidades más Ceuta y Melilla en cada año, desde 2009", () => {
    expect(Math.min(...anioPPE)).toBe(2009);
    for (const a of anioPPE) expect(ppe.valores.filter((v) => v.anio === a)).toHaveLength(19);
  });

  it("coincide con cifras comprobadas en los certificados (Andalucía 2015 y 2023, Navarra 2010)", () => {
    const v = (c: string, a: number) => ppe.valores.find((x) => x.ccaa === c && x.anio === a)?.ppe;
    expect(v("AN", 2015)).toBe(7919261);
    expect(v("AN", 2023)).toBe(8694554);
    expect(v("NC", 2010)).toBe(643735);
  });

  it("el ajuste reparte, no añade: el reescalado deja igual el conjunto de las 17", () => {
    // gasto_hab_edad = gasto_hab / factor, con factor = (PPE / población) / (ΣPPE / Σpoblación). Por tanto
    // Σ PPE / factor = Σ población × (ΣPPE / Σpoblación) = Σ PPE: los factores se compensan entre comunidades.
    for (const a of anios.filter((x) => x >= ppe.primer_anio_comparable)) {
      const P = (c: string) => ppe.valores.find((x) => x.ccaa === c && x.anio === a)!.ppe;
      const sumaP = CCAA.reduce((s, c) => s + P(c.id), 0);
      const sumaPsobreFactor = CCAA.reduce((s, c) => s + P(c.id) * val("gasto_hab_edad", c.id, a)! / val("gasto_hab", c.id, a)!, 0);
      expect(sumaPsobreFactor / sumaP, String(a)).toBeCloseTo(1, 4);
    }
  });

  it("las comunidades más envejecidas bajan y las más jóvenes suben (2024)", () => {
    expect(val("gasto_hab_edad", "AS", 2024)!).toBeLessThan(val("gasto_hab", "AS", 2024)!);
    expect(val("gasto_hab_edad", "CL", 2024)!).toBeLessThan(val("gasto_hab", "CL", 2024)!);
    expect(val("gasto_hab_edad", "MC", 2024)!).toBeGreaterThan(val("gasto_hab", "MC", 2024)!);
    // Asturias 2024: 2.322 € / factor 1,176 ≈ 1.975 € (comprobado a mano)
    expect(val("gasto_hab_edad", "AS", 2024)!).toBeCloseTo(1974.82, 1);
  });
});


describe("contexto de cada comunidad (ficha)", () => {
  const C = contexto.ccaa as Record<string, { pct65: number; pct80: number; densidad: number; entidades: number; superficie: number; poblacion: number; cobertura_mixta: number; cobertura_ic: number[] }>;

  it("están las 17 comunidades con valores razonables", () => {
    expect(Object.keys(C).sort()).toEqual(CCAA.map((c) => c.id).sort());
    for (const [id, d] of Object.entries(C)) {
      expect(d.pct65, id).toBeGreaterThan(10); expect(d.pct65, id).toBeLessThan(35);
      expect(d.pct80, id).toBeLessThan(d.pct65);
      expect(d.densidad, id).toBeCloseTo(d.poblacion / d.superficie, 0);
      expect(d.cobertura_ic[0], id).toBeLessThan(d.cobertura_mixta);
      expect(d.cobertura_ic[1], id).toBeGreaterThan(d.cobertura_mixta);
    }
  });

  it("coincide con cifras publicadas por otras fuentes o comprobadas a mano", () => {
    // Aragón, 65 y más a 1/1/2024: 22,4 % (Instituto Aragonés de Estadística)
    expect(C.AR.pct65).toBeCloseTo(22.4, 1);
    // Galicia, entidades singulares a 1/1/2024: 30.486 (certificado del INE)
    expect(C.GA.entidades).toBe(30486);
    // Encuesta de Salud 2023, cobertura mixta: Cataluña 27,95 %, Extremadura 6,19 %; España 16,3 %
    expect(C.CT.cobertura_mixta).toBe(27.95);
    expect(C.EX.cobertura_mixta).toBe(6.19);
    expect(contexto.espana_cobertura.mixta).toBe(16.3);
  });
});
