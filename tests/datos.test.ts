import { describe, expect, it } from "vitest";
import { mediaSimple, ranking, serie, variacionPct } from "../src/lib/datos";
import type { Valor } from "../src/types/datos";

const v: Valor[] = [
  { indicador: "x", ccaa: "MD", anio: 2022, valor: 10 },
  { indicador: "x", ccaa: "CT", anio: 2022, valor: 30 },
  { indicador: "x", ccaa: "AN", anio: 2022, valor: 20 },
  { indicador: "x", ccaa: "MD", anio: 2021, valor: 8 },
  { indicador: "y", ccaa: "MD", anio: 2022, valor: 99 },
];

describe("datos", () => {
  it("ordena el ranking de mayor a menor y filtra por indicador y año", () => {
    const r = ranking("x", 2022, v);
    expect(r.map((f) => f.ccaa)).toEqual(["CT", "AN", "MD"]);
    expect(r[0].posicion).toBe(1);
    expect(r[0].nombre).toBe("Cataluña");
  });

  it("calcula la media simple", () => {
    expect(mediaSimple(ranking("x", 2022, v))).toBe(20);
    expect(mediaSimple([])).toBeNaN();
  });

  it("devuelve la serie ordenada por año", () => {
    expect(serie("x", "MD", v)).toEqual([
      { anio: 2021, valor: 8 },
      { anio: 2022, valor: 10 },
    ]);
  });

  it("calcula variación porcentual", () => {
    expect(variacionPct(10, 30)).toBe(200);
  });
});
