import { describe, expect, it } from "vitest";
import { correlacionCritica, pearson, rangos, spearman } from "../src/lib/estadistica";

describe("estadística del gráfico gasto-espera", () => {
  it("Pearson: relación perfecta, inversa y nula", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
    expect(pearson([1, 2, 3, 4, 5], [2, 1, 3, 1, 2])).toBeCloseTo(0, 10);
  });

  it("rangos con empates (rango medio)", () => {
    expect(rangos([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1]);
  });

  it("Spearman no se deja arrastrar por un valor extremo", () => {
    const x = [1, 2, 3, 4, 5, 6], y = [1, 2, 3, 4, 5, 1000];
    expect(spearman(x, y)).toBeCloseTo(1, 10);
    expect(pearson(x, y)).toBeLessThan(0.7);
  });

  it("correlación crítica al 95 % según tablas (n=17 → 0,482; n=10 → 0,632)", () => {
    expect(correlacionCritica(17)).toBeCloseTo(0.482, 3);
    expect(correlacionCritica(16)).toBeCloseTo(0.497, 3);
    expect(correlacionCritica(10)).toBeCloseTo(0.632, 3);
  });
});
