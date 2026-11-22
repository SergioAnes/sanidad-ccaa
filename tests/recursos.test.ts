/** Recursos (profesionales de atención primaria, SIAP): coherencia del fichero generado y cifras de contraste. */
import { describe, expect, it } from "vitest";
import rec from "../src/data/recursos.json";
import { CCAA } from "../src/lib/datos";

const ind = (id: string) => {
  const i = rec.indicadores.find((x) => x.id === id);
  if (!i) throw new Error(id);
  return i;
};
const val = (id: string, c: string, a: number) => (ind(id).valor as Record<string, number[]>)[c][rec.anios.indexOf(a)];

describe("Recursos de atención primaria (SIAP)", () => {
  it("cubre 2004-2025 con las 17 comunidades y sin huecos", () => {
    expect(rec.anios[0]).toBe(2004);
    expect(rec.anios.at(-1)).toBe(2025);
    for (const i of rec.indicadores) {
      expect(i.espana).toHaveLength(rec.anios.length);
      for (const c of CCAA) {
        const s = (i.valor as Record<string, number[]>)[c.id];
        expect(s, `${i.id} ${c.id}`).toHaveLength(rec.anios.length);
        for (const v of s) expect(v).toBeGreaterThan(300), expect(v).toBeLessThan(3000);
      }
    }
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
      rec.anios.forEach((_, k) => {
        const vs = CCAA.map((c) => (i.valor as Record<string, number[]>)[c.id][k]);
        expect(i.espana[k]).toBeGreaterThanOrEqual(Math.min(...vs));
        expect(i.espana[k]).toBeLessThanOrEqual(Math.max(...vs));
      });
    }
  });

  it("guarda la ruptura de serie de Cataluña y los años con cifras repetidas", () => {
    expect(rec.ruptura).toMatchObject({ ccaa: "CT", anio: 2020 });
    expect(rec.repetidos).toContainEqual({ ccaa: "CT", anio: 2018 });
    expect(rec.fuente.url).toMatch(/^https:\/\/pestadistico\.inteligenciadegestion\.sanidad\.gob\.es\//);
  });
});
