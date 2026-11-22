/** Recursos (profesionales de atención primaria, SIAP): coherencia del fichero generado y cifras de contraste. */
import { describe, expect, it } from "vitest";
import rec from "../src/data/recursos.json";
import { CCAA } from "../src/lib/datos";

const ind = (id: string) => {
  const i = rec.indicadores.find((x) => x.id === id);
  if (!i) throw new Error(id);
  return i;
};
const val = (id: string, c: string, a: number) => (ind(id).valor as Record<string, number[]>)[c][ind(id).anios.indexOf(a)];

describe("Recursos de atención primaria (SIAP)", () => {
  it("cubre sus años con las 17 comunidades y sin huecos (SIAP 2004-2025, SIAE 2010-2023)", () => {
    expect(ind("ap_pob_medico").anios[0]).toBe(2004);
    expect(ind("ap_pob_medico").anios.at(-1)).toBe(2025);
    expect(ind("hosp_camas_sns").anios[0]).toBe(2010);
    expect(ind("hosp_camas_sns").anios.at(-1)).toBe(2023);
    for (const i of rec.indicadores) {
      expect(i.espana).toHaveLength(i.anios.length);
      const [lo, hi] = i.fuente === "siap" ? [300, 3000] : i.id === "hosp_ocupacion" ? [40, 100] : i.id === "hosp_cma" ? [10, 90] : i.id === "hosp_ingresos" ? [30, 200] : i.id === "hosp_dia" ? [20, 400] : i.id === "hosp_estancia" ? [3, 15] : [0.5, 6];
      for (const c of CCAA) {
        const s = (i.valor as Record<string, number[]>)[c.id];
        expect(s, `${i.id} ${c.id}`).toHaveLength(i.anios.length);
        for (const v of s) expect(v).toBeGreaterThan(lo), expect(v).toBeLessThan(hi);
      }
    }
  });

  it("camas: son las tasas publicadas en las tablas del SIAE y la red pública no supera el total", () => {
    // Tabla 2.1 de 2023: Andalucía 1,94 (pública) y 2,32 (total); Cataluña 3,27 y 3,65; España 2,43 y 2,89
    expect(val("hosp_camas_sns", "AN", 2023)).toBeCloseTo(1.94, 3);
    expect(val("hosp_camas_total", "AN", 2023)).toBeCloseTo(2.32, 3);
    expect(val("hosp_camas_sns", "CT", 2023)).toBeCloseTo(3.27, 3);
    expect(ind("hosp_camas_sns").espana.at(-1)).toBeCloseTo(2.43, 3);
    // Tabla D.1. de 2010: Andalucía 1,747 y 2,305
    expect(val("hosp_camas_sns", "AN", 2010)).toBeCloseTo(1.747, 3);
    expect(val("hosp_camas_total", "AN", 2010)).toBeCloseTo(2.305, 3);
    // Ocupación y estancia media, hospitales de agudos de la red pública (tabla 5.3 de 2023 y AA.4. de 2010)
    expect(val("hosp_ocupacion", "AN", 2023)).toBeCloseTo(62.6, 1);
    expect(val("hosp_estancia", "AN", 2023)).toBeCloseTo(6.8, 2);
    expect(val("hosp_ocupacion", "AN", 2010)).toBeCloseTo(77.3, 1);
    expect(val("hosp_estancia", "AN", 2010)).toBeCloseTo(6.89, 2);
    // Cirugía mayor ambulatoria, red pública (tabla 6.2 de 2023 y AOA.2. de 2010)
    expect(val("hosp_cma", "AN", 2023)).toBeCloseTo(48.9, 1);
    expect(val("hosp_cma", "AN", 2010)).toBeCloseTo(45.7, 1);
    // Hospital de día (tabla 6.5 de 2023: Andalucía 125 sesiones por 1.000 hab.) e ingresos en la red pública (5.1 de 2023: 84,1 × 0,74)
    expect(val("hosp_dia", "AN", 2023)).toBeCloseTo(125, 1);
    expect(val("hosp_ingresos", "AN", 2023)).toBeCloseTo(84.1 * 0.74, 1);
    expect(rec.picos.map((p) => `${p.ccaa}${p.anio}`)).toContain("EX2021");
    const sns = ind("hosp_camas_sns").valor as Record<string, number[]>, tot = ind("hosp_camas_total").valor as Record<string, number[]>;
    for (const c of CCAA) sns[c.id].forEach((v, k) => expect(v).toBeLessThanOrEqual(tot[c.id][k] + 0.001));
  });

  it("reproduce cifras calculadas a mano con la exportación del SIAP", () => {
    // Población asignada / profesionales, 2025 (Portal Estadístico, cubo EAP)
    expect(val("ap_pob_medico", "AN", 2025)).toBeCloseTo(7621732 / 5288, 1);
    expect(val("ap_pob_pediatra", "AN", 2025)).toBeCloseTo(992455 / 1158, 1);
    expect(val("ap_pob_enfermera", "AN", 2025)).toBeCloseTo((7621732 + 992455) / 6207, 1);
    expect(val("ap_pob_medico", "IB", 2025)).toBeCloseTo(1762.6, 1);
    expect(val("ap_pob_medico", "CL", 2025)).toBeCloseTo(951.6, 1);
  });

  it("España es el conjunto de las 17 (no la media) y queda dentro del rango de las comunidades", () => {
    for (const i of rec.indicadores) {
      i.anios.forEach((_, k) => {
        const vs = CCAA.map((c) => (i.valor as Record<string, number[]>)[c.id][k]);
        expect(i.espana[k]).toBeGreaterThanOrEqual(Math.min(...vs));
        expect(i.espana[k]).toBeLessThanOrEqual(Math.max(...vs));
      });
    }
  });

  it("guarda la ruptura de serie de Cataluña y los años con cifras repetidas", () => {
    expect(rec.ruptura).toMatchObject({ ccaa: "CT", anio: 2020 });
    expect(rec.repetidos).toContainEqual({ ccaa: "CT", anio: 2018 });
    expect(rec.reclasificaciones.map((r) => `${r.ccaa}${r.anio}`)).toContain("CB2023");
    expect(rec.fuentes.siae.url).toMatch(/^https:\/\/www\.sanidad\.gob\.es\//);
    expect(rec.fuentes.siap.url).toMatch(/^https:\/\/pestadistico\.inteligenciadegestion\.sanidad\.gob\.es\//);
  });
});
