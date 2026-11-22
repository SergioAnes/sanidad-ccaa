/** Resultados en salud (INE): coherencia del fichero generado y cifras de contraste. */
import { describe, expect, it } from "vitest";
import res from "../src/data/resultados.json";
import { CCAA } from "../src/lib/datos";
import { construirDatos } from "../src/lib/app/datos-app";

const ind = (id: string) => {
  const i = res.indicadores.find((x) => x.id === id);
  if (!i) throw new Error(id);
  return i;
};
const val = (id: string, c: string, a: number) => (ind(id).valor as Record<string, number[]>)[c][ind(id).anios.indexOf(a)];

describe("Resultados en salud (INE)", () => {
  it("cubre 1975-2025 (mortalidad infantil, media de tres años, desde 1977) con las 17 y sin huecos", () => {
    expect(ind("res_esperanza").anios[0]).toBe(1975);
    expect(ind("res_mort_infantil").anios[0]).toBe(1977);
    for (const i of res.indicadores) {
      expect(i.anios.at(-1)).toBe(2025);
      expect(i.espana).toHaveLength(i.anios.length);
      const [lo, hi] = i.id === "res_esperanza" ? [70, 90] : i.id === "res_esperanza65" ? [14, 25] : [1, 30];
      for (const c of CCAA) {
        const s = (i.valor as Record<string, number[]>)[c.id];
        expect(s, `${i.id} ${c.id}`).toHaveLength(i.anios.length);
        for (const v of s) expect(v).toBeGreaterThan(lo), expect(v).toBeLessThan(hi);
      }
    }
  });

  it("reproduce las cifras publicadas por el INE para 2025", () => {
    expect(ind("res_esperanza").espana.at(-1)).toBe(84.05); // nota de prensa del 18/11/2026
    expect(val("res_esperanza", "AN", 2025)).toBe(82.86);
    expect(val("res_esperanza", "MD", 2025)).toBe(85.68);
    expect(ind("res_esperanza65").espana.at(-1)).toBe(21.86);
  });

  it("la media de tres años de la mortalidad infantil queda entre el mínimo y el máximo del periodo", () => {
    const m = ind("res_mort_infantil");
    expect(m.espana.at(-1)).toBeCloseTo(2.757, 3);
    for (const c of CCAA) {
      const s = (m.valor as Record<string, number[]>)[c.id];
      // la serie trienal cambia poco de un año al siguiente (suaviza el azar)
      for (let k = 1; k < s.length; k++) expect(Math.abs(s[k] / s[k - 1] - 1), `${c.id} ${m.anios[k]}`).toBeLessThan(0.45);
    }
  });

  it("entra en la interfaz como tema propio con años, España y fuente INE", () => {
    const D = construirDatos();
    const r = D.inds.filter((i) => i.grupo === "resultados");
    expect(r.map((i) => i.id)).toEqual(["res_esperanza", "res_esperanza65", "res_mort_infantil"]);
    for (const i of r) expect(i.grupo === "resultados" && i.fuente).toBe("ine");
  });
});
