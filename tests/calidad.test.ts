/** Comprobaciones de calidad de los datos publicados y de los avisos automáticos. */
import { describe, expect, it } from "vitest";
import notas from "../src/data/notas-egsp.json";
import listas from "../src/data/listas-espera.json";
import { CCAA, VALORES } from "../src/lib/datos";
import { detectarAvisos } from "../src/lib/avisos";

const anios = [...new Set(VALORES.map((v) => v.anio))].sort((a, b) => a - b);
const val = (ind: string, c: string, a: number) => VALORES.find((v) => v.indicador === ind && v.ccaa === c && v.anio === a)?.valor;

describe("coherencia de los datos de gasto", () => {
  it("cada indicador tiene las 17 comunidades en todos los años, sin huecos", () => {
    for (const ind of new Set(VALORES.map((v) => v.indicador))) {
      for (const c of CCAA) for (const a of anios) expect(val(ind, c.id, a), `${ind} ${c.id} ${a}`).toBeTypeOf("number");
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
